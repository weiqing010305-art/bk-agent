import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { inputs, conversations } from './agent-matrix-cases.mjs';
import { taskResponse } from './agent-response.mjs';

if (process.env.AGENT_LIVE_TEST !== '1') {
  console.log('Set AGENT_LIVE_TEST=1 for fictional-data real-model testing.'); process.exit(0);
}
const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
const results = [];
const only = process.env.AGENT_MATRIX_ONLY;
const check = (task, c) => {
  assert.equal(task.can_open, !c.blocked, 'review gate');
  for (const key of ['kind', 'amount', 'recipient_name', 'phone', 'note', 'status']) {
    if (c[key] !== undefined) assert.equal(task[key], c[key], key);
  }
  if (c.missing) assert.ok(task.missing.includes(c.missing), 'missing ' + c.missing);
};
async function record(name, fn) {
  if (only && !name.includes(only)) return;
  const started = Date.now();
  const entry = { name, passed: false, turns: [] }; results.push(entry);
  try { await fn(entry); entry.passed = true; }
  catch (e) { entry.error = e.message.slice(0, 500); }
  entry.elapsedMs = Date.now() - started;
  console.log((entry.passed ? 'PASS ' : 'FAIL ') + name + (entry.error ? ': ' + entry.error : ''));
}
async function apiScenario(cases, entry) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'X-Demo-Request': '1' } });
  try {
    assert.equal((await context.request.post(base + '/api/session')).status(), 200);
    const getState = async () => (await context.request.get(base + '/api/state')).json();
    const before = await getState();
    let task = null;
    const conversation_id = crypto.randomUUID();
    for (const c of cases) {
      const response = await context.request.post(base + '/api/agent/turn', { data: {
        conversation_id, request_id: crypto.randomUUID(), version: task?.version || 0, text: c.text } });
      const value = await response.json();
      entry.turns.push({ input: c.text, http: response.status(), kind: value.kind, status: value.status,
        amount: value.amount, missing: value.missing, can_open: value.can_open, message: value.message || value.detail?.message });
      assert.equal(response.status(), 200, 'HTTP status');
      task = value; check(task, c);
      const after = await getState();
      assert.equal(after.balance, before.balance, 'No chat-only debit');
      assert.equal(after.transactions.length, before.transactions.length, 'No chat-only transaction');
    }
  } finally { await context.close(); }
}
async function uiScenario(text, amount, high, entry, inject503 = false, chooseName = null) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    let originalRequest;
    if (inject503) await page.route('**/api/agent/turn', route => {
      originalRequest = route.request().postDataJSON();
      return route.fulfill({ status: 503, json: { detail: { code: 'AGENT_MODEL_ERROR', message: '助手暂时无法可靠理解这条消息，请重试或手动填写。' } } });
    }, { times: 1 });
    const initial = page.waitForResponse(r => r.url().endsWith('/api/state'));
    await page.goto(base); await initial;
    const getState = async () => (await page.request.get(base + '/api/state')).json();
    const before = await getState();
    await page.getByRole('button', { name: '打开青禾助手' }).click();
    await page.getByLabel('输入消息').fill(text);
    const pending = page.waitForResponse(r => r.url().endsWith('/api/agent/turn') && r.request().method() === 'POST');
    await page.getByLabel('输入消息').press('Enter');
    let response = await pending;
    if (inject503) {
      assert.equal(response.status(), 503);
      assert.equal((await getState()).balance, before.balance);
      const retried = page.waitForResponse(r => r.url().endsWith('/api/agent/turn'));
      await page.getByRole('button', { name: '重试', exact: true }).click();
      response = await retried;
      assert.deepEqual(response.request().postDataJSON(), originalRequest, 'Retry must reuse the same request');
      assert.equal(await page.locator('.chat-turn--user').count(), 1);
      entry.injected503Recovered = true;
    }
    const task = await taskResponse(response, page);
    entry.turns.push({ input: text, kind: task.kind, amount: task.amount, status: task.status });
    assert.equal(task.amount, amount);
    if (chooseName) {
      assert.equal(task.can_open, false);
      assert.ok(task.choices.length > 1);
      await page.getByRole('button', { name: new RegExp('^' + chooseName + ' · 尾号') }).click();
    }
    await page.getByRole('heading', { name: '核对转账信息', exact: true }).waitFor();
    assert.equal((await getState()).balance, before.balance);
    const confirm = page.waitForResponse(r => r.url().endsWith('/confirm') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '确认转账', exact: true }).click();
    const auth = await (await confirm).json();
    assert.equal(auth.auth_method, high ? 'password_code' : 'password');
    if (high) {
      await page.getByLabel('支付密码', { exact: true }).fill('123456');
      await page.getByLabel('短信验证码', { exact: true }).fill(auth.demo_code === '000000' ? '111111' : '000000');
      await page.getByRole('button', { name: '验证', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: '验证码不正确' })).toBeVisible();
      assert.equal((await getState()).balance, before.balance);
      await page.getByLabel('短信验证码', { exact: true }).fill(auth.demo_code);
    }
    await page.getByLabel('支付密码', { exact: true }).fill('123456');
    await page.getByRole('button', { name: '验证', exact: true }).click();
    await page.getByRole('heading', { name: '转账完成', exact: true }).waitFor();
    const after = await getState();
    assert.equal(after.balance, before.balance - amount);
    assert.equal(after.transactions.length, before.transactions.length + 1);
    const retry = await page.request.post(base + '/api/operations/' + auth.id + '/verify-password', {
      headers: { 'X-Demo-Request': '1' }, data: { revision: auth.revision, params_hash: auth.params_hash,
        challenge_id: auth.challenge_id, password: '123456', code: high ? auth.demo_code : '' } });
    assert.equal(retry.status(), 200);
    assert.equal((await retry.json()).status, 'SUCCEEDED');
    assert.equal((await getState()).balance, after.balance);
    entry.debit = amount; entry.transactionDelta = 1; entry.repeatDebitedAgain = false;
    entry.auth = auth.auth_method; entry.wrongCodeRejected = high;
    if (chooseName) {
      await page.getByRole('button', { name: '返回对话', exact: true }).first().click();
      await page.getByLabel('输入消息').fill('再给李思远转2元');
      await page.getByLabel('输入消息').press('Enter');
      await page.getByRole('heading', { name: '核对转账信息', exact: true }).waitFor();
      const next = await (await page.request.get(base + '/api/agent/conversations/' + task.conversation_id)).json();
      assert.notEqual(next.id, task.id); assert.equal(next.amount, 200); assert.equal(next.recipient_name, '李思远');
      const old = await (await page.request.get(base + '/api/agent/tasks/' + task.id)).json();
      assert.equal(old.status, 'SUCCEEDED'); assert.equal(old.operation.receipt_id, auth.receipt_id || auth.id);
      assert.equal((await getState()).balance, after.balance, 'New draft must not execute');
      entry.choice = chooseName; entry.oldReceiptPreserved = true; entry.newDraftDebit = 0;
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}
try {
  for (const c of inputs) await record('输入：' + c.text, e => apiScenario([c], e));
  for (const c of conversations) await record('多轮：' + c.name, e => apiScenario(c.turns, e));
  await record('浏览器：一分钱转账全链路', e => uiScenario('给陈晨转0.01元', 1, false, e));
  await record('浏览器：1500元转账密码加验证码', e => uiScenario('给王佩兰转1500元，备注测试', 150000, true, e));
  await record('浏览器：503后原请求重试到回执', e => uiScenario('给陈晨转10元', 1000, false, e, true));
  await record('浏览器：多匹配选择与完成后同聊再办', e => uiScenario('给远转10元', 1000, false, e, false, '李思远'));
} finally {
  await writeFile(process.env.AGENT_MATRIX_REPORT || '.local/agent-matrix-results.json', JSON.stringify({ at: new Date().toISOString(),
    passed: results.filter(r => r.passed).length, total: results.length, results }, null, 2));
  await browser.close();
}
const failed = results.filter(r => !r.passed);
console.log(`MATRIX: ${results.length - failed.length}/${results.length} passed; ${failed.length} failed.`);
if (failed.length) process.exitCode = 1;
