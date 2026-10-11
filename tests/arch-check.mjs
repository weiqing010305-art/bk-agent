import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/* 扫 doc/ 下所有 markdown 里的 Mermaid 块，用真实解析器逐块 parse。
   以前只查 ARCHITECTURE.md —— 但决策文档现在每条都配图，它也必须被守住。 */
const files = [];
const walk = d => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.name === '_raw' || f.name === '_tmp') continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.md')) files.push(p);
  }
};
walk('doc');

const blocks = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)) blocks.push({ file: f, body: m[1] });
}
console.log('文档数:', files.length, '| Mermaid 块:', blocks.length);

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const loaded = await page.evaluate(async () => {
  try { const m = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'); window.mermaid = m.default; window.mermaid.initialize({ startOnLoad: false }); return true; }
  catch (e) { return 'LOAD_FAIL: ' + e.message; }
});
if (loaded !== true) { console.log(loaded); process.exit(1); }
const results = await page.evaluate(async (bs) => {
  const out = [];
  for (let i = 0; i < bs.length; i++) {
    try { await window.mermaid.parse(bs[i]); out.push({ i, ok: true }); }
    catch (e) { out.push({ i, ok: false, err: String(e.message || e).slice(0, 160) }); }
  }
  return out;
}, blocks.map(b => b.body));
const bad = results.filter(r => !r.ok);
console.log('解析结果:', results.length - bad.length, '/', results.length, '通过');
bad.forEach(b => console.log('  X ' + blocks[b.i].file + ' 块#' + b.i + ':', b.err));
await browser.close();
if (bad.length) process.exit(1);
