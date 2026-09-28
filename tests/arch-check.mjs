import { chromium } from '@playwright/test';
import fs from 'node:fs';
const src = fs.readFileSync('doc/ARCHITECTURE.md', 'utf8');
const blocks = [...src.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map(m => m[1]);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage();
await page.setContent('<html><body><div id="h"></div></body></html>');
const loaded = await page.evaluate(async () => {
  try {
    const m = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
    window.mermaid = m.default;
    window.mermaid.initialize({ startOnLoad: false });
    return true;
  } catch (e) { return 'LOAD_FAIL: ' + e.message; }
});
console.log('mermaid 加载:', loaded);
if (loaded === true) {
  const results = await page.evaluate(async (blocks) => {
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      try { await window.mermaid.parse(blocks[i]); out.push({ i: i + 1, ok: true }); }
      catch (e) { out.push({ i: i + 1, ok: false, err: String(e.message || e).slice(0, 140) }); }
    }
    return out;
  }, blocks);
  const bad = results.filter(r => !r.ok);
  console.log('解析结果:', results.length - bad.length, '/', results.length, '通过');
  bad.forEach(b => console.log('  ✖ 块 #' + b.i + ':', b.err));
}
await browser.close();
