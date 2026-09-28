import { chromium } from '@playwright/test';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);

/*
  两个口径必须分开，因为它们的性质完全不同：
  · 界面文案 —— 标签、标题、说明句、按钮。这是"用文字解释设计"的部分，越少越好。
  · 数据 —— 列表行、金额、日期、商户名。100 条流水就是 100 行，那是业务本身。
  用户说的 150 字限制针对的是前者。混在一起量会把"账本很长"误判成"设计很差"。
*/
const SCRIPT = `() => {
  const DATA_SEL = '.row-item, .tx-row, .tx-list li, .payee-row, .sub-card, .day-group, .chart-legend li, .chart-bar, .tg-node, .feed-row, .ledger-row, [data-data]';
  const count = (t) => {
    const cjk = (t.match(/[\\u4e00-\\u9fff]/g) || []).length;
    const words = (t.replace(/[\\u4e00-\\u9fff]/g, ' ').match(/[A-Za-z0-9¥%]+/g) || []).length;
    return cjk + words;
  };
  const walk = (n, inData, acc) => {
    if (n.nodeType === 3) { acc[inData ? 'data' : 'copy'] += count(n.textContent); return; }
    if (n.nodeType !== 1) return;
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    if (n.getAttribute('aria-hidden') === 'true') return;
    const nowData = inData || n.matches(DATA_SEL);
    [...n.childNodes].forEach(c => walk(c, nowData, acc));
  };
  const acc = { copy: 0, data: 0 };
  const root = document.querySelector('.main-area');
  if (root) walk(root, false, acc);
  const detail = {};
  document.querySelectorAll('.main-area *').forEach(el => {
    if (!el.children.length || el.matches(DATA_SEL)) return;
    const t = el.textContent || '';
    if (t.length > 60 && !el.querySelector(DATA_SEL)) {
      const key = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName;
      detail[key] = Math.max(detail[key] || 0, count(t));
    }
  });
  return { ...acc, detail };
}`;

const rows = [];
const measure = async (label) => {
  await page.waitForTimeout(700);
  const m = await page.evaluate(eval('(' + SCRIPT + ')'));
  rows.push({ label, ...m });
};

await measure('助手·首页统合视图');
for (const s of ['概览', '账单', '订阅', '卡片', '收款人', '回执', '转账']) {
  await page.locator('.side-item', { hasText: s }).first().click();
  await measure('产品层·' + s);
}
/* 理财域：从概览宫格进（它不在侧边栏里，产品层导航的 8 格之一）。
   申购是一条 4 步动线，每一步都是一屏，所以**每一步单独量** —— 量的是"一屏"，不是"一次会话"。 */
await page.locator('.side-item', { hasText: '概览' }).first().click();
await page.waitForTimeout(600);
await page.locator('.icon-tile', { hasText: '理财' }).click();
await measure('产品层·理财');
await page.locator('.w-rank .w-row').first().click();
await measure('理财·详情');
await page.locator('.page-body .a2ui-btn--primary').click();
await page.locator('.w-input').fill('5000');
await measure('理财·填金额');
await page.locator('.w-go').click();
await measure('理财·核对');

// 助手侧的几个关键 surface
await page.locator('.side-item', { hasText: '青禾助手' }).first().click();
await page.waitForTimeout(600);
await page.locator('textarea[aria-label="输入消息"]').fill('我要转账');
await page.locator('textarea[aria-label="输入消息"]').press('Enter');
await measure('助手·转账第 1 步');

console.log('页面'.padEnd(24) + '界面文案  数据  文案超标');
console.log('-'.repeat(58));
for (const r of rows) {
  const over = r.copy > 150 ? '  ← +' + (r.copy - 150) : (r.copy > 100 ? '  (接近)' : '');
  console.log(r.label.padEnd(22) + String(r.copy).padStart(6) + String(r.data).padStart(8) + over);
}
console.log('');
console.log('=== 各页文案大头（元素 class → 字数）===');
for (const r of rows) {
  const top = Object.entries(r.detail).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, v]) => v > 20);
  if (top.length) console.log(r.label + ': ' + top.map(([k, v]) => k + '=' + v).join('  '));
}
await browser.close();
