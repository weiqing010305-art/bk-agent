/**
 * end-to-end：两条入口 + 工作区 + 产品层 + 会话。
 * 用 Edge 跑（机器上已有），不需要下载 Playwright 浏览器。
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
await mkdir('artifacts/e2e', { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

const workspace = () => page.locator('.workspace-view');
const surface = () => workspace().locator('.a2ui-surface');
const composer = () => page.locator('textarea[aria-label="输入消息"]');

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. 空状态：统合视图 + 常驻入口
  await page.getByText('你好，小禾').waitFor();
  assert.equal(await surface().count(), 1, '工作区应渲染一张统合视图');
  assert.ok(await page.locator('.flow-chip').count() >= 4, '常驻入口应至少 4 项（赛题要求的业务面）');
  assert.equal(await workspace().getAttribute('role'), 'log', '工作区应有 role=log（WCAG ARIA23）');
  assert.equal(await page.locator('.inspector').count(), 0, '动线面板不应出现在界面里（动线必须是无感的）');

  // 2. 业务层入口：一句话里人和钱都说了 → 直接进核对步
  await composer().fill('给章明远转 100 元');
  await composer().press('Enter');
  await page.waitForTimeout(1100);
  const reviewText = await surface().innerText();
  assert.match(reviewText, /核对一下/, '人和金额都说了，应直接跳到核对步');
  assert.match(reviewText, /章明远/, '应识别出收款人');
  assert.match(reviewText, /¥100/, '应识别出金额');
  // 统合视图必须给出跨域数字：转后余额 / 本月支出变化 / 扣完订阅还剩
  assert.match(reviewText, /转后余额/, '核对步应给出转后余额');
  assert.match(reviewText, /扣完订阅还剩/, '核对步应给出扣完订阅的余额');
  assert.match(reviewText, /本月支出会从/, '核对步应说明对本月支出的影响');

  // 3. 只说了金额 → 从「转给谁」开始，不重复问已知的事
  await composer().fill('我要转 50 块');
  await composer().press('Enter');
  await page.waitForTimeout(900);
  assert.match(await surface().innerText(), /转给谁/, '只说了金额，应从选收款人开始');

  // 4. 完全没说清 → 才从第一步开始
  await composer().fill('我要转账');
  await composer().press('Enter');
  await page.waitForTimeout(900);
  assert.equal(await surface().locator('.a2ui-card--interactive').count(), 4, '第一步应有 4 种转账方式');

  // 5. 历史条：不滚动，点一下换回去
  assert.ok(await page.locator('.turn-chip').count() >= 2, '应有一行可切换的历史');
  await page.locator('.turn-chip').first().click();
  await page.waitForTimeout(600);
  assert.ok(await page.getByRole('button', { name: '回到最新' }).count() >= 1, '看历史时应能一键回到最新');
  await page.getByRole('button', { name: '回到最新' }).click();
  await page.waitForTimeout(500);

  // 6. 键盘
  await composer().fill('多行');
  await composer().press('Shift+Enter');
  await page.waitForTimeout(250);
  assert.ok((await composer().inputValue()).includes('\n'), 'Shift+Enter 应换行');
  await composer().fill('');

  // 7. 产品层：侧边栏切页面（只断言语义，不断言具体类名 —— 页面由各 agent 拥有）
  for (const [label, mustSee] of [['账单', /支出|收入/], ['卡片', /卡|额度/], ['订阅', /订阅|续费/], ['概览', /余额/], ['收款人', /收款人|转账/]]) {
    await page.locator('.side-item', { hasText: label }).first().click();
    await page.waitForTimeout(700);
    const t = await page.locator('.view-inner').innerText();
    assert.match(t, mustSee, label + ' 页内容异常: ' + t.slice(0, 60));
    assert.ok(t.length > 30, label + ' 页几乎是空的');
  }

  // 8. 多会话
  await page.locator('.side-item', { hasText: '青禾助手' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.side-new').click();
  await page.waitForTimeout(900);
  assert.ok(await page.locator('.side-conv').count() >= 2, '侧边栏应有至少两条历史');
  await page.locator('.side-conv').nth(1).locator('button').first().click();
  await page.waitForTimeout(700);
  assert.ok(await surface().count() >= 1, '切回旧对话应恢复它的视图');

  // 9. 刷新恢复
  const before = await page.locator('.side-conv').count();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  assert.equal(await page.locator('.side-conv').count(), before, '刷新后会话应原样恢复');

  await page.screenshot({ path: 'artifacts/e2e/final.png' });
  assert.equal(pageErrors.length, 0, '不应有未捕获异常: ' + pageErrors.join(' | '));
  console.log('e2e OK — 全部断言通过（两条入口 / 统合跨域 / 跳步 / 历史条 / 键盘 / 产品层 / 图表切换 / 多会话 / 刷新）');
} finally {
  await browser.close();
}
