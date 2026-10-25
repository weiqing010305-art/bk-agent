import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { taskResponse } from './agent-response.mjs';

if (process.env.AGENT_LIVE_TEST !== '1') {
  console.log('Set AGENT_LIVE_TEST=1 to test fictional inputs with the configured model.');
  process.exit(0);
}
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
const state = async () => (await page.request.get(base + '/api/state')).json();
const post = (path, data) => page.request.post(base + '/api' + path,
  { data, headers: { 'X-Demo-Request': '1' } });
const say = async text => {
  await page.getByLabel('输入消息').fill(text);
  const pending = page.waitForResponse(r => r.url().endsWith('/api/agent/turn') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200, 'Chat request failed: ' + response.status());
  const task = await taskResponse(response, page);
  results.push({ input: text, kind: task.kind, missing: task.missing, status: task.status, reply: task.message });
  return task;
};
try {
  const initial = page.waitForResponse(r => r.url().endsWith('/api/state'));
  await page.goto(base);
  await initial;
  const before = await state();
  await page.getByRole('button', { name: '打开青禾助手' }).click();
  let task = await say('我想手机充值');
  assert.equal(task.kind, 'phone');
  assert.deepEqual(task.missing, ['phone', 'amount']);
  assert.equal(task.can_open, false);
  task = await say('13800000000'); // Fictional target; the model receives PHONE_1 only.
  assert.deepEqual(task.missing, ['amount']);
  task = await say('五十元');
  assert.equal(task.phone, '13800000000');
  assert.equal(task.amount, 5000);
  assert.equal(task.status, 'READY_FOR_REVIEW');
  await page.getByRole('heading', { name: '手机充值', exact: true }).waitFor();
  await page.getByRole('heading', { name: '核对信息', exact: true }).waitFor();
  assert.equal((await state()).balance, before.balance, 'No debit before confirmation');
  await page.getByRole('button', { name: '修改信息', exact: true }).click();
  await page.getByLabel('充值手机号', { exact: true }).fill('13900000000');
  await page.getByLabel('支付金额（元）', { exact: true }).fill('30');
  const edit = page.waitForResponse(r => r.url().endsWith('/edit') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  const edited = await edit;
  assert.equal(edited.status(), 200);
  const changed = await edited.json();
  assert.equal(changed.phone, '13900000000');
  assert.equal(changed.amount, 3000);
  assert.ok(changed.version > task.version);
  assert.notEqual(changed.payment_id, task.payment_id);
  await page.getByRole('heading', { name: '核对信息', exact: true }).waitFor();
  const oldPayload = { id: task.payment_id, kind: 'phone', utility: 'water', cardId: 'debit',
    target: task.phone, amount: task.amount, agentTaskId: task.id, agentVersion: task.version, password: '123456' };
  assert.equal((await post('/payments', oldPayload)).status(), 409, 'Old draft must be rejected');
  const payload = { ...oldPayload, id: changed.payment_id, target: changed.phone,
    amount: changed.amount, agentVersion: changed.version };
  assert.equal((await post('/payments', { ...payload, password: '000000' })).status(), 422);
  await page.getByLabel('支付密码', { exact: false }).fill('000000');
  await page.getByRole('button', { name: '确认支付', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '支付密码不正确' }).waitFor();
  assert.equal((await state()).balance, before.balance, 'Wrong password must not debit');
  await page.getByLabel('支付密码', { exact: false }).fill('123456');
  await page.getByRole('button', { name: '确认支付', exact: true }).click();
  await page.getByRole('heading', { name: '支付成功', exact: true }).waitFor();
  const after = await state();
  assert.equal(after.balance, before.balance - 3000);
  assert.equal(after.transactions.length, before.transactions.length + 1);
  const retry = await post('/payments', payload);
  assert.equal(retry.status(), 200);
  assert.equal((await retry.json()).id, changed.payment_id);
  assert.equal((await state()).balance, after.balance, 'Retry must not debit again');
  const done = await (await page.request.get(base + '/api/agent/tasks/' + task.id)).json();
  assert.equal(done.status, 'SUCCEEDED');
  assert.ok(done.operation.receipt_id);
  await page.getByRole('button', { name: '返回对话', exact: true }).click();
  await page.getByRole('button', { name: '查看这笔充值', exact: true }).last().click();
  await page.getByRole('heading', { name: '支付成功', exact: true }).waitFor();
  await page.getByText('回执编号：' + done.operation.receipt_id, { exact: true }).waitFor();
  await page.waitForTimeout(800); // Let the existing receipt entrance animation finish before the screenshot.
  await page.screenshot({ path: '.local/agent-phone-live-complete.png', fullPage: true });
  await page.getByRole('button', { name: '返回对话', exact: true }).click();
  await page.getByRole('button', { name: '新建聊天', exact: true }).click();
  assert.equal(await page.locator('.chat-turn--user').count(), 0);
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('"password"'));
  results.push({ check: 'phone real model + real backend + browser', passed: true,
    editedAmount: 3000, ledgerDelta: after.balance - before.balance, transactionDelta: 1,
    staleDraftRejected: true, wrongPasswordRejected: true, retryDebitedAgain: false });

  // Independent conversations use the real model and backend, without confirming any payments.
  const cases = [
    { text: '给王佩兰转100元', kind: 'transfer', ready: true, amount: 10000, recipient_name: '王佩兰' },
    { text: '给13800000000充50元话费', kind: 'phone', ready: true, amount: 5000, phone: '13800000000' },
    { text: '给王佩兰转一千二', kind: 'transfer', ready: false, missing: 'amount' },
    { text: '给王佩兰转0元', kind: 'transfer', ready: false, missing: 'amount' },
    { text: '给王佩兰转50000元', kind: 'transfer', ready: false, missing: 'amount' },
    { text: '给不存在的收款人测试甲转10元', kind: 'transfer', ready: false, missing: 'recipient' },
    { text: '我想手机充值，手机号12345，金额50元', kind: 'phone', ready: false, missing: 'phone' },
    { text: '我想交水费', ready: false },
    { text: '明天给王佩兰转100元', ready: false },
  ];
  for (const c of cases) {
    const conversation_id = crypto.randomUUID();
    const response = await post('/agent/turn', { conversation_id, request_id: crypto.randomUUID(), version: 0, text: c.text });
    assert.equal(response.status(), 200, c.text + ' request status');
    const t = await response.json();
    const result = { input: c.text, kind: t.kind, missing: t.missing, status: t.status,
      can_open: t.can_open, reply: t.message, passed: false };
    results.push(result);
    if (c.kind) assert.equal(t.kind, c.kind, c.text + ' kind');
    assert.equal(t.can_open, c.ready, c.text + ' handoff');
    if (c.missing) assert.ok(t.missing.includes(c.missing), c.text + ' missing field');
    for (const key of ['amount', 'recipient_name', 'phone']) if (c[key] !== undefined) assert.equal(t[key], c[key], c.text + ' ' + key);
    if (c.ready) {
      const cancelled = await post('/agent/turn', { conversation_id, request_id: crypto.randomUUID(),
        version: t.version, text: '取消' });
      assert.equal(cancelled.status(), 200);
      const stopped = await cancelled.json();
      assert.equal(stopped.status, 'CANCELLED');
      assert.equal(stopped.can_open, false);
    }
    result.passed = true;
  }
  assert.equal((await state()).balance, after.balance, 'Draft conversations must never debit');
  assert.deepEqual(errors, []);
  console.log('PASS: real-model phone conversation → edited review → password → receipt; stale/wrong-password/retry protections; 9 real-model input cases.');
} catch (error) {
  await page.screenshot({ path: '.local/agent-inputs-live-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile('.local/agent-inputs-live-results.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
