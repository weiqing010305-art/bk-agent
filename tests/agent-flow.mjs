import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { taskResponse } from './agent-response.mjs';

if (process.env.AGENT_LIVE_TEST !== '1') {
  console.log('Set AGENT_LIVE_TEST=1 to run the configured model against fictional banking data.');
  process.exit(0);
}
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const chat = async text => {
  await page.getByLabel('输入消息').fill(text);
  const response = page.waitForResponse(r => r.url().endsWith('/api/agent/turn') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 200);
  return taskResponse(result, page);
};
try {
  await page.goto(base);
  await page.waitForResponse(r => r.url().endsWith('/api/state'));
  const before = await (await page.request.get(base + '/api/state')).json();
  await page.getByRole('button', { name: '打开青禾助手' }).click();
  let task = await chat('我要转账');
  assert.deepEqual(task.missing, ['recipient', 'amount']);
  task = await chat('王佩兰');
  assert.deepEqual(task.missing, ['amount']);
  task = await chat('500元，备注房租');
  assert.equal(task.amount, 50000);
  assert.equal(task.recipient_name, '王佩兰');
  await page.getByRole('heading', { name: '核对转账信息', exact: true }).waitFor();
  assert.equal((await (await page.request.get(base + '/api/state')).json()).balance, before.balance);
  await page.getByRole('button', { name: '修改金额或备注' }).click();
  await page.getByLabel('修改转账金额').fill('123.45');
  await page.getByRole('button', { name: '保存并重新核对' }).click();
  await page.getByText('¥123.45', { exact: true }).waitFor();
  await page.getByRole('button', { name: '确认转账', exact: true }).click();
  await page.getByLabel('支付密码', { exact: true }).fill('123456');
  await page.getByRole('button', { name: '验证', exact: true }).click();
  await page.getByRole('heading', { name: '转账完成', exact: true }).waitFor();
  const after = await (await page.request.get(base + '/api/state')).json();
  assert.equal(after.balance, before.balance - 12345);
  assert.equal(after.transactions.length, before.transactions.length + 1);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  assert.ok(!storage.includes('"password"'));
  await page.screenshot({ path: '.local/agent-transfer-complete.png', fullPage: true });
  await page.getByRole('button', { name: '返回对话', exact: true }).first().click();
  await page.getByRole('button', { name: '新建聊天', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const second = await chat('给陈晨转10元');
  assert.equal(second.recipient_name, '陈晨');
  assert.equal(second.amount, 1000);
  await page.getByRole('heading', { name: '核对转账信息', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.waitForTimeout(800); // Wait for the existing page entrance animation before inspecting the image.
  await page.screenshot({ path: '.local/agent-transfer-mobile.png', fullPage: true });
  // Local delayed reply verifies isolation without another external-model request.
  await page.getByRole('button', { name: '返回对话', exact: true }).first().click();
  await page.getByRole('button', { name: '新建聊天', exact: true }).click();
  let releaseReply;
  const delayed = new Promise(resolve => { releaseReply = resolve; });
  await page.route('**/api/agent/turn', async route => {
    const request = route.request().postDataJSON();
    await delayed;
    await route.fulfill({ json: { id: crypto.randomUUID(), version: 1, status: 'READY_FOR_REVIEW',
      handoff: true, conversation_id: request.conversation_id, message: '隔离测试回复',
      amount: 100, recipient_name: '王佩兰', tail: '3821', choices: [], missing: [] } });
  });
  await page.getByLabel('输入消息').fill('我要转账');
  const requested = page.waitForRequest(r => r.url().endsWith('/api/agent/turn'));
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await requested;
  await page.getByRole('button', { name: '新建聊天', exact: true }).click();
  releaseReply();
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole('heading', { name: '核对转账信息', exact: true }).count(), 0);
  assert.equal(await page.getByText('隔离测试回复', { exact: true }).count(), 0);
  await page.reload();
  await page.getByRole('button', { name: '打开青禾助手' }).click();
  assert.equal(await page.locator('.chat-turn--user').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: live model multi-turn → review → edit → password → receipt; mobile; no early debit; delayed reply/new-chat/reload isolation.');
} finally {
  await browser.close();
}
