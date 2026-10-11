import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts/design', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'artifacts/design/1-assistant.png' });
for (const [s, n] of [['概览','2-overview'], ['理财','3-wealth'], ['卡片','4-cards'], ['转账','5-transfer']]) {
  await page.locator('.side-item', { hasText: s }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/design/' + n + '.png' });
}
console.log('ok');
await browser.close();
