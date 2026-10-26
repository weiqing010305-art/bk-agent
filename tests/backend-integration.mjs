import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { taskResponse } from './agent-response.mjs';

const url = process.env.BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
const context = await browser.newContext({ viewport: { width: 1560, height: 1050 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(() => fetch('/api/state').then(r => r.json()));
const surface = () => page.locator('.a2ui-surface').last();
const openTransfer = async (name, amount) => {
  await page.locator('.icon-tile').filter({ hasText: /^转账$/ }).click();
  await surface().locator('.a2ui-card--interactive').filter({ hasText: '转给他人' }).click();
  await surface().locator('.a2ui-card--interactive').filter({ hasText: name }).click();
  await surface().getByTestId('amount').fill(amount);
  await surface().getByRole('button', { name: '核对信息', exact: true }).click();
  const [draftResponse] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/operations') && r.request().method() === 'POST'),
    surface().getByRole('button', { name: '确认并获取验证码', exact: true }).click(),
  ]);
  const op = await draftResponse.json();
  await page.locator('.backend-transfer').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 1, 'single server confirmation');
  assert.equal(op.status, 'AWAITING_CONFIRMATION');
  assert.ok(op.params_hash && op.revision);
  return op;
};
const authorize = async () => {
  await page.locator('.backend-transfer').getByRole('button', { name: '确认并获取验证码', exact: true }).click();
  await page.getByTestId('demo-code').waitFor();
  const code = await page.getByTestId('demo-code').innerText();
  await page.locator('#demo-code').fill(code);
};
try {
  await page.goto(url);
  await page.waitForFunction(() => {
    const value = document.querySelector('.hero-amount')?.textContent;
    return value === '¥12,860.50';
  });
  const initial = await state();
  assert.equal(initial.balance, 1286050);
  assert.equal(await page.locator('.icon-tile').count(), 13);
  assert.equal(await page.locator('h1').innerText(), '概览');
  await page.waitForFunction(() => document.querySelector('.hero-amount')?.textContent === '¥12,860.50');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/backend-home.png' });

  const first = await openTransfer(initial.contacts[0].name, '100.50');
  assert.equal((await state()).balance, initial.balance, 'draft does not debit');
  await authorize();
  assert.equal((await state()).balance, initial.balance, 'authorization does not debit');
  // Refresh must restore the same server operation and already-created challenge.
  await page.reload();
  await page.getByTestId('demo-code').waitFor();
  await page.locator('#demo-code').fill(await page.getByTestId('demo-code').innerText());
  await page.getByRole('button', { name: '验证', exact: true }).click();
  await page.locator('.backend-transfer').waitFor({ state: 'detached' });
  await page.waitForFunction(id => fetch('/api/state').then(r => r.json()).then(s => s.completed.includes(id)), first.id);
  const posted = await state();
  assert.equal(posted.balance, initial.balance - 10050);
  assert.equal(posted.transactions.filter(t => t.operation_id === first.id || t.id === first.id).length, 1);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.hero-amount')?.textContent === '¥12,760.00');

  // Lose the HTTP response after the server commits: querying the same operation recovers once.
  const second = await openTransfer(initial.contacts[1].name, '1.00');
  await authorize();
  await page.route('**/api/operations/*/verify', async route => { await route.fetch(); await route.abort('failed'); }, { times: 1 });
  await page.getByRole('button', { name: '验证', exact: true }).click();
  await page.getByRole('button', { name: '查询原操作结果', exact: true }).waitFor();
  await page.getByRole('button', { name: '查询原操作结果', exact: true }).click();
  await page.locator('.backend-transfer').waitFor({ state: 'detached' });
  const recovered = await state();
  assert.equal(recovered.balance, posted.balance - 100);
  assert.equal(recovered.transactions.filter(t => t.id === second.id).length, 1);
  await page.locator('.assistant-home').click();

  if (process.env.AGENT_LIVE_TEST === '1') {
    await page.getByRole('button', { name: '打开青禾助手' }).click();
    const firstTurn = page.waitForResponse(r => r.url().endsWith('/api/agent/turn'));
    await page.locator('.flow-chip').filter({ hasText: /^转账$/ }).click();
    await taskResponse(await firstTurn, page);
    await page.getByLabel('输入消息').fill(`给${initial.contacts[2].name}转2元`);
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await page.getByRole('heading', { name: '核对转账信息', exact: true }).waitFor();
    await page.getByRole('button', { name: '确认转账', exact: true }).click();
    await page.getByLabel('支付密码', { exact: true }).fill('123456');
    await page.getByRole('button', { name: '验证', exact: true }).click();
    await page.getByRole('heading', { name: '转账完成', exact: true }).waitFor();
    assert.equal((await state()).balance, recovered.balance - 200);
    await page.locator('.assistant-home').click();
  } else console.log('SKIP: assistant model path requires AGENT_LIVE_TEST=1; manual API flows still run.');

  const beforeServices = await state();
  await page.locator('.icon-tile').filter({ hasText: /^手机充值$/ }).click();
  await page.getByLabel('充值手机号').fill('13800138000');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByLabel('支付密码').fill('111111');
  await page.getByRole('button', { name: '确认支付', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal((await state()).balance, beforeServices.balance);
  await page.getByLabel('支付密码').fill('123456');
  await page.getByRole('button', { name: '确认支付', exact: true }).click();
  await page.getByText('支付成功', { exact: true }).waitFor();
  const afterPhone = await state();
  const phone = afterPhone.transactions.find(t => t.name === '手机充值');
  assert.ok(phone && phone.amount < 0);
  assert.equal(afterPhone.balance, beforeServices.balance + phone.amount);
  await page.reload();
  await page.waitForFunction(() => fetch('/api/state').then(r => r.json()).then(s => s.transactions.some(t => t.name === '手机充值')));

  await page.locator('.icon-tile').filter({ hasText: /^储蓄计划$/ }).click();
  await page.getByLabel('目标名称').fill('前后端联调目标');
  await page.getByLabel('目标金额（元）').fill('500');
  await page.getByLabel('目标日期').fill('2027-12-31');
  await page.getByRole('button', { name: '保存目标', exact: true }).click();
  await page.getByRole('button', { name: '存入', exact: true }).click();
  await page.getByLabel('金额（元）', { exact: true }).fill('100');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByLabel('支付密码').fill('123456');
  await page.getByRole('button', { name: '确认划转', exact: true }).click();
  await page.getByText('资金划转成功，余额与计划进度已更新。', { exact: true }).waitFor();
  const deposited = await state();
  assert.equal(deposited.balance, afterPhone.balance - 10000);
  assert.equal(Object.values(deposited.savings).reduce((n, amount) => n + amount, 0), 10000);
  await page.reload();
  await page.locator('.icon-tile').filter({ hasText: /^储蓄计划$/ }).click();
  await page.getByRole('button', { name: '取回', exact: true }).click();
  await page.getByLabel('金额（元）', { exact: true }).fill('20');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByLabel('支付密码').fill('123456');
  await page.getByRole('button', { name: '确认划转', exact: true }).click();
  await page.getByText('资金划转成功，余额与计划进度已更新。', { exact: true }).waitFor();
  assert.equal((await state()).balance, afterPhone.balance - 8000);
  await page.locator('.assistant-home').click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(url);
  await otherPage.waitForFunction(() => fetch('/api/state').then(r => r.json()).then(s => s.balance === 1286050));
  await other.close();
  assert.deepEqual(errors, []);
  console.log('PASS: manual transfer, refresh/lost-response recovery, phone, savings, session isolation and mobile; assistant path ' + (process.env.AGENT_LIVE_TEST === '1' ? 'passed with real model.' : 'skipped.'));
} finally { await browser.close(); }
