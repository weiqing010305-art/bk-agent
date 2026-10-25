import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
let saved = { base_url: 'https://original.example/v1', model: 'original-model',
  has_key: true, configured: true, revision: 'a'.repeat(64) };
await page.route('**/api/settings/model**', async route => {
  const request = route.request();
  const suffix = new URL(request.url()).pathname.split('/').at(-1);
  if (request.method() === 'GET') return route.fulfill({ json: saved });
  const body = request.postDataJSON();
  requests.push({ suffix, body });
  if (suffix === 'test') return body.model === 'bad-model'
    ? route.fulfill({ status: 503, json: { detail: { message: '连接未通过，请核对配置。' } } })
    : route.fulfill({ json: { ok: true, message: '连接成功，模型可以正常返回结构化结果。' } });
  saved = suffix === 'clear'
    ? { base_url: '', model: '', has_key: false, configured: false, revision: 'c'.repeat(64) }
    : { ...saved, base_url: body.base_url, model: body.model, revision: 'b'.repeat(64), has_key: true };
  return route.fulfill({ json: saved });
});
try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8080');
  const trigger = page.getByRole('button', { name: '模型设置', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '模型设置', exact: true });
  await expect(page.getByLabel('模型名称', { exact: true })).toHaveValue('original-model');
  const key = page.locator('#model-key');
  assert.equal(await key.inputValue(), '');
  assert.equal(await key.getAttribute('type'), 'password');
  await page.getByLabel('模型名称', { exact: true }).fill('updated-model');
  await page.getByRole('button', { name: '测试连接', exact: true }).click();
  await page.getByText('连接成功，模型可以正常返回结构化结果。', { exact: true }).waitFor();
  assert.equal(saved.model, 'original-model'); // Testing does not save.
  assert.equal(requests.at(-1).body.api_key, '');
  await page.getByRole('button', { name: '保存并应用', exact: true }).click();
  await page.getByText('已保存，下次对话立即生效。', { exact: true }).waitFor();
  assert.equal(saved.model, 'updated-model');
  await page.getByLabel('接口地址 · Base URL', { exact: true }).fill('https://candidate.example/v1');
  await expect(page.getByRole('button', { name: '保存并应用', exact: true })).toBeDisabled();
  await key.fill('ui-only-test-key');
  await page.getByRole('button', { name: '显示 API Key', exact: true }).click();
  assert.equal(await key.getAttribute('type'), 'text');
  await page.getByRole('button', { name: '隐藏 API Key', exact: true }).click();
  await page.getByLabel('模型名称', { exact: true }).fill('bad-model');
  await page.getByRole('button', { name: '测试连接', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '连接未通过' }).waitFor();
  assert.equal(saved.base_url, 'https://original.example/v1');
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  assert.ok(!storage.includes('ui-only-test-key'));
  await page.getByRole('button', { name: '关闭模型设置', exact: true }).click();
  assert.equal(await dialog.count(), 0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(key).toHaveValue('');
  await expect(page.getByLabel('模型名称', { exact: true })).toHaveValue('updated-model');
  await page.getByLabel('服务商', { exact: true }).selectOption('deepseek');
  await expect(page.locator('#model-base')).toHaveValue('https://api.deepseek.com');
  await expect(page.locator('#model-name')).toHaveValue('deepseek-flash');
  await key.fill('ui-only-test-key');
  await page.getByRole('button', { name: '保存并应用', exact: true }).click();
  await page.getByText('已保存，下次对话立即生效。', { exact: true }).waitFor();
  await expect(key).toHaveValue('');
  await page.screenshot({ path: '.local/model-settings-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await dialog.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth));
  await page.screenshot({ path: '.local/model-settings-mobile.png' });
  await page.getByRole('button', { name: '清除配置', exact: true }).click();
  await page.getByRole('button', { name: '确认清除配置', exact: true }).click();
  await page.getByText('配置已清除。', { exact: true }).waitFor();
  assert.equal(saved.configured, false);
  await page.keyboard.press('Escape');
  assert.equal(await dialog.count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: model settings presets, key retention, test/save separation, failure, no browser storage, focus, clear and mobile layout; mocked provider, no actual key changes.');
} finally { await browser.close(); }
