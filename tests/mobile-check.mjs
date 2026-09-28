import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
await mkdir('artifacts/mobile', { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
for (const [label, name] of [['账单','1-bills'],['卡片','2-cards'],['概览','3-overview']]) {
  await page.locator('.side-item', { hasText: label }).first().click().catch(async () => {
    await page.getByRole('button', { name: '打开导航' }).click();
    await page.waitForTimeout(400);
    await page.locator('.side-item', { hasText: label }).first().click();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/mobile/' + name + '.png' });
  const overlap = await page.evaluate(() => {
    const fab = document.querySelector('.menu-fab');
    const h = document.querySelector('.page-head h1, .view-head h1');
    if (!fab || !h) return 'n/a';
    const a = fab.getBoundingClientRect(), b = h.getBoundingClientRect();
    return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(name, '| 菜单压标题:', overlap, '| 横向溢出:', overflow);
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close();
