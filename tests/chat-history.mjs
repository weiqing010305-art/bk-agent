import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { directory } from '../src/domain/bank.js';

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_PATH || process.env.EDGE_PATH || chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const history = () => page.evaluate(() => JSON.parse(localStorage.getItem('qinghe-conversations-v2')));
const openChat = async title => {
  await page.getByRole('button', { name: '历史聊天', exact: true }).click();
  await page.locator('.conversation-history-list button').filter({ hasText: title }).first().click();
  assert.equal(await page.locator('dialog[open]').count(), 0);
};
const surface = () => page.locator('.assistant-thread .a2ui-surface').last();
try {
  await page.goto((process.env.BASE_URL || 'http://127.0.0.1:5173') + '/qinghe-ui-preview.html');
  await page.getByRole('button', { name: '打开青禾助手' }).click();
  await page.getByLabel('输入消息').fill('看看账单');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByLabel('输入消息').fill('保留这个草稿');
  const oldId = (await history()).activeId;
  await page.getByRole('button', { name: '新建聊天', exact: true }).click();
  await page.waitForFunction(id => {
    const state = JSON.parse(localStorage.getItem('qinghe-conversations-v2'));
    return state.activeId !== id && state.items.find(c => c.id === id).turns.every(t => !t.pending);
  }, oldId);
  assert.equal(await page.locator('.chat-turn').count(), 1);
  assert.equal(await page.getByLabel('输入消息').inputValue(), '');
  assert.equal(await page.locator('.chat-turn--user').count(), 0);
  await openChat('看看账单');
  assert.equal((await history()).activeId, oldId);
  assert.equal(await page.getByLabel('输入消息').inputValue(), '保留这个草稿');
  assert.equal(await page.locator('.chat-turn--user').innerText(), '看看账单');
  await surface().waitFor();

  // Different conversations keep independent transfer forms and restore them after reload.
  await page.locator('.flow-chip').filter({ hasText: /^转账$/ }).click();
  await surface().locator('.a2ui-card--interactive').filter({ hasText: '转给他人' }).click();
  await surface().getByTestId('manual-card').fill(directory[0].number);
  await page.getByRole('button', { name: '新建聊天', exact: true }).click();
  await page.locator('.flow-chip').filter({ hasText: /^转账$/ }).click();
  await surface().locator('.a2ui-card--interactive').filter({ hasText: '转给他人' }).click();
  await surface().getByTestId('manual-card').fill(directory[1].number);
  await openChat('看看账单');
  assert.equal(await surface().getByTestId('manual-card').inputValue(), directory[0].number);
  await surface().getByRole('button', { name: '下一步', exact: true }).click();
  await surface().getByTestId('amount').fill('123.45');
  await page.reload();
  await page.getByRole('button', { name: '打开青禾助手' }).click();
  assert.equal((await history()).activeId, oldId);
  assert.equal(await surface().getByTestId('amount').inputValue(), '123.45');
  assert.equal(await page.getByLabel('输入消息').inputValue(), '保留这个草稿');
  await surface().getByRole('button', { name: '上一步', exact: true }).click();
  assert.equal(await surface().getByTestId('manual-card').inputValue(), directory[0].number);
  await page.getByRole('button', { name: '新建聊天', exact: true }).click();
  await page.locator('.chat-bubble--welcome').waitFor();
  await page.screenshot({ path: '../design-samples/qinghe-chat-new.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '历史聊天', exact: true }).click();
  const box = await page.locator('dialog').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390);
  await page.screenshot({ path: '../design-samples/qinghe-chat-history-mobile.png' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.getByRole('button', { name: '历史聊天', exact: true }).click();
  await page.getByRole('button', { name: '关闭历史聊天' }).click();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('新建、历史恢复、延迟回复、独立表单、刷新保存与手机弹窗均通过');
} finally { await browser.close(); }
