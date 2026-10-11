import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const open = async () => { await page.locator('.side-item').filter({ hasText: '概览' }).click(); await page.locator('.icon-grid').getByRole('button', { name: '出行钱袋', exact: true }).click(); };
try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByLabel('输入消息').fill('下周去日本五天');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  assert.equal(await page.getByLabel('目的地', { exact: true }).inputValue(), '日本');
  await page.getByLabel('预计外币现金金额').fill('10000');
  await page.getByRole('button', { name: '保存行程', exact: true }).click();
  await page.getByText('卡片可用，境外支付已开启。', { exact: true }).waitFor();
  await page.getByLabel('出行证件已核对').check();
  const balance = await page.evaluate(() => JSON.parse(localStorage.getItem('qinghe-mock-v1')).balance);
  await page.reload({ waitUntil: 'networkidle' }); await open();
  assert.equal(await page.getByLabel('出行证件已核对').isChecked(), true);
  await page.getByRole('button', { name: '去预约兑换', exact: true }).click();
  assert.equal(await page.getByLabel('兑换币种').inputValue(), 'JPY');
  assert.equal(await page.getByLabel('预约外币金额').inputValue(), '10000');
  await page.getByLabel('联系手机号').fill('13800138000');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByRole('button', { name: '确认预约', exact: true }).click();
  await page.getByText('预约已保存', { exact: true }).waitFor();
  await page.getByRole('button', { name: '返回出行钱袋', exact: true }).first().click();
  await page.getByText('青禾中心支行 · 已预约', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('已完成兑换，现金已备好').isChecked(), false);
  await page.getByLabel('已完成兑换，现金已备好').check();
  await page.getByRole('button', { name: '取消兑换预约', exact: true }).click();
  await page.getByText('青禾中心支行 · 已取消', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('qinghe-mock-v1')).balance), balance);
  if (process.env.CAPTURE_TRAVEL) await page.screenshot({ path: 'travel-desktop-check.png' });
  // 模拟另一页面将旅行卡冻结，钱袋再次打开必须重新检查，不能缓存为准备就绪。
  await page.evaluate(() => { const b = JSON.parse(localStorage.getItem('qinghe-mock-v1')); b.cards.find(c => c.id === 'travel').status = 'frozen'; localStorage.setItem('qinghe-mock-v1', JSON.stringify(b)); });
  await page.reload({ waitUntil: 'networkidle' }); await open();
  await page.getByText('这张卡已冻结，请前往卡包处理或改选其他银行卡。', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('已完成兑换，现金已备好').isChecked(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.CAPTURE_TRAVEL) await page.screenshot({ path: 'travel-mobile-check.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('travel flow OK: assistant draft / trip persistence / card checks / linked exchange / checklist / cancellation / no debit / mobile');
} finally { await browser.close(); }
