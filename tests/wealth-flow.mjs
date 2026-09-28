import { chromium } from '@playwright/test';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.locator('.side-item', { hasText: '理财' }).first().click();
await page.waitForTimeout(1000);
console.log('理财页:', (await page.locator('.view-inner').innerText()).replace(/\s+/g,' ').slice(0, 150));
// 点一个榜单行
const row = page.locator('.view-inner button, .view-inner [role=button]').filter({ hasText: /%/ }).first();
if (await row.count()) { await row.click(); await page.waitForTimeout(900); }
console.log('详情页:', (await page.locator('.view-inner').innerText()).replace(/\s+/g,' ').slice(0, 130));
const buy = page.getByRole('button', { name: /申购/ }).first();
if (await buy.count()) { await buy.click(); await page.waitForTimeout(800); }
const amt = page.locator('input[inputmode="decimal"], input[type="text"]').first();
if (await amt.count()) { await amt.fill('5000'); await page.waitForTimeout(400); }
const next = page.getByRole('button', { name: /下一步|核对/ }).first();
if (await next.count()) { await next.click(); await page.waitForTimeout(800); }
const confirm = page.getByRole('button', { name: /确认|提交/ }).first();
if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(900); }
console.log('认证弹窗:', await page.locator('.auth-modal').count(), '| 确认弹窗:', await page.locator('.modal').count());
if (await page.locator('.auth-modal').count()) {
  await page.locator('.auth-modal .aui2-input, .auth-modal input').first().fill('824613');
  await page.locator('.auth-modal').getByRole('button', { name: /验证/ }).click();
  await page.waitForTimeout(1200);
  console.log('通过后 toast:', await page.locator('.toast').innerText().catch(()=>'(无)'));
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close();
