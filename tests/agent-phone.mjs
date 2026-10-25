import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], payments = [];
page.on('pageerror', e => errors.push(e.message));
let task = null, state = { balance: 1286050, currency: 'CNY', contacts: [], transactions: [], completed: [], savings: {} };
const taskId = crypto.randomUUID();
await page.route('**/api/state', route => route.fulfill({ json: state }));
await page.route('**/api/agent/conversations/*', route => route.fulfill({ json: task }));
await page.route('**/api/agent/turn', route => {
  const body = route.request().postDataJSON();
  const unrelated = body.text.includes('天气');
  task = { id: taskId, conversation_id: body.conversation_id, version: (task?.version || 0) + 1,
    kind: unrelated ? null : 'phone', status: 'COLLECTING', missing: ['phone', 'amount'], choices: [],
    can_open: false, handoff: false, message: '要充值哪个手机号？请提供 11 位手机号。',
    ...(!unrelated && task?.phone ? { phone: task.phone } : {}) };
  if (/^1[3-9]\d{9}$/.test(body.text)) Object.assign(task, { phone: body.text, missing: ['amount'], message: '充值多少钱？' });
  if (body.text === '50元') Object.assign(task, { amount: 5000, status: 'READY_FOR_REVIEW', missing: [],
    can_open: true, handoff: true, payment_id: crypto.randomUUID(), message: '已填写好，请核对手机号和金额后确认支付。' });
  if (unrelated) task.message = '可以帮你转账或充值话费，也可从首页选择其他服务。';
  return route.fulfill({ json: task });
});
await page.route('**/api/agent/tasks/**', route => {
  if (route.request().method() === 'POST') {
    const body = route.request().postDataJSON();
    Object.assign(task, { version: task.version + 1, phone: body.phone, amount: Number(body.amount) * 100,
      payment_id: crypto.randomUUID() });
  }
  return route.fulfill({ json: task });
});
await page.route('**/api/payments', route => {
  const body = route.request().postDataJSON(); payments.push(body);
  assert.equal(body.agentTaskId, task.id); assert.equal(body.agentVersion, task.version);
  assert.equal(body.id, task.payment_id); assert.equal(body.amount, task.amount); assert.equal(body.target, task.phone);
  const op = { id: body.id, status: 'SUCCEEDED', receipt_id: body.id };
  Object.assign(task, { status: 'SUCCEEDED', operation: op, handoff: false });
  state = { ...state, balance: state.balance - body.amount, completed: [body.id],
    transactions: [{ id: body.id, name: '手机充值', category: '通信', amount: -body.amount, date: '2026-10-21' }] };
  return route.fulfill({ json: op });
});
const say = async text => {
  await page.getByLabel('输入消息').fill(text);
  const response = page.waitForResponse(r => r.url().endsWith('/api/agent/turn'));
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await response;
};
try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8080');
  await page.getByRole('button', { name: '打开青禾助手' }).click();
  await say('我想手机充值');
  await page.getByText('要充值哪个手机号？请提供 11 位手机号。', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '查看这笔转账', exact: true }).count(), 0);
  await say('13800000000');
  await page.getByText('充值多少钱？', { exact: true }).waitFor();
  assert.equal(payments.length, 0);
  await say('50元');
  await page.getByRole('heading', { name: '手机充值', exact: true }).waitFor();
  await page.getByRole('heading', { name: '核对信息', exact: true }).waitFor();
  assert.equal(payments.length, 0);
  await page.getByRole('button', { name: '修改信息', exact: true }).click();
  await page.getByLabel('充值手机号', { exact: true }).fill('13900000000');
  await page.getByLabel('支付金额（元）', { exact: true }).fill('30');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByRole('heading', { name: '核对信息', exact: true }).waitFor();
  await page.getByLabel('支付密码', { exact: false }).fill('000000');
  await page.getByRole('button', { name: '确认支付', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '支付密码不正确' }).waitFor();
  assert.equal(payments.length, 0);
  await page.getByLabel('支付密码', { exact: false }).fill('123456');
  await page.getByRole('button', { name: '确认支付', exact: true }).click();
  await page.getByRole('heading', { name: '支付成功', exact: true }).waitFor();
  assert.equal(payments.length, 1); assert.equal(payments[0].amount, 3000);
  await page.getByRole('button', { name: '返回对话', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看这笔充值', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新建聊天', exact: true }).click(); task = null;
  await say('天气怎么样');
  await page.getByText('可以帮你转账或充值话费，也可从首页选择其他服务。', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '查看这笔转账', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: '查看这笔充值', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: phone slot questions, automatic review, edits, password confirmation, task-bound request, matching chat link and no unrelated transfer action (mocked APIs).');
} finally { await browser.close(); }
