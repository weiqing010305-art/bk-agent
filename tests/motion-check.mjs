import { chromium } from '@playwright/test';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 980 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// 账单页：分类 hover 动效
await page.locator('.side-item', { hasText: '账单' }).first().click();
await page.waitForTimeout(700);
/* 分类签名动效。
   注意：'transfer' 不在这里 —— 转账给人的头像现在是**人物位**（首字母字标，av--person），
   不再是箭头图标，所以 .tx-icon--transfer svg 不存在，那条 flow-x 也失去了目标。
   这是头像体系的设计（形状即语义：圆=消费、圆角方=周期、人物位=转给人），不是动效回归。 */
const cats = ['dining','shopping','transport','income'];
for (const c of cats) {
  const icon = page.locator('.row-item .tx-icon--' + c).first();
  if (await icon.count() === 0) { console.log(c.padEnd(10), '该分类不在当前筛选里'); continue; }
  await page.locator('.row-item').filter({ has: page.locator('.tx-icon--' + c) }).first().hover();
  await page.waitForTimeout(220);
  const name = await icon.evaluate(el => { const svg = el.querySelector('svg'); return svg ? getComputedStyle(svg).animationName : 'none'; });
  console.log(c.padEnd(10), '->', name);
}
// 订阅页：云 / 视频 / 音乐
await page.locator('.side-item', { hasText: '订阅' }).first().click();
await page.waitForTimeout(700);
for (const k of ['cloud','video','music']) {
  const row = page.locator('.sub-row--' + k).first();
  if (await row.count() === 0) { console.log(k.padEnd(10), '缺'); continue; }
  await row.hover();
  await page.waitForTimeout(300);
  const info = await row.evaluate(el => {
    const svg = el.querySelector('.sub-logo svg');
    const eq = el.querySelector('.eq i');
    const after = getComputedStyle(el, '::after').animationName;
    return { svg: svg ? getComputedStyle(svg).animationName : '-', eq: eq ? getComputedStyle(eq).animationName : '-', after };
  });
  console.log(k.padEnd(10), JSON.stringify(info));
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close();
