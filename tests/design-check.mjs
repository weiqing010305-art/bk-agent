import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const m = await page.evaluate(() => {
  const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const inner = document.querySelector('.main-area');
  return {
    主区: box('.main-area'),
    页头: box('.view-head'),
    工作区: box('.workspace-view'),
    入口条: box('.launcher'),
    输入区: box('.composer-wrap'),
    历史条: box('.turn-strip'),
    芯片数: document.querySelectorAll('.flow-chip').length,
    芯片文字: [...document.querySelectorAll('.flow-chip')].map(e => e.innerText.trim()),
  };
});
console.log(JSON.stringify(m, null, 1));

// 工作区占比
const total = m.主区.h;
const used = [m.页头, m.入口条, m.输入区, m.历史条].filter(Boolean).reduce((n, x) => n + x.h, 0);
console.log('主区高 ' + total + 'px；非工作区占用 ' + used + 'px（' + Math.round(used / total * 100) + '%）；工作区 ' + (m.工作区 ? m.工作区.h + 'px' : 'n/a'));

// 纵向滚动：工作区内容是否一屏放下
const fit = await page.evaluate(() => { const w = document.querySelector('.workspace-view'); return { scrollH: w.scrollHeight, clientH: w.clientHeight, fits: w.scrollHeight <= w.clientHeight + 4 }; });
console.log('工作区一屏放下:', fit.fits, JSON.stringify(fit));

// 灰色元素盘点：列出工作区外、字号 < 13px 且颜色是 tertiary/faint 的文字
const grey = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.main-area *').forEach(el => {
    if (el.children.length) return;
    const cs = getComputedStyle(el);
    const t = (el.textContent || '').trim();
    if (!t || t.length > 40) return;
    const isGrey = cs.color.includes('151') || cs.color.includes('142') || cs.opacity < 0.8;
    if (isGrey && parseFloat(cs.fontSize) < 13) {
      const r = el.getBoundingClientRect();
      out.push({ t: t.slice(0, 24), size: cs.fontSize, y: Math.round(r.top) });
    }
  });
  return out;
});
console.log('小号灰字（可能的冗余）:', grey.length ? JSON.stringify(grey) : '无');
await browser.close();
