/**
 * 转账四步流程走查（业务层入口）。
 * 与 e2e 的分工：e2e 守整体回归，这里只守流程本身的每一步。
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));

const surface = () => page.locator('.workspace-view .a2ui-surface');
const step = async (label, mustMatch) => {
  await page.waitForTimeout(600);
  const t = await surface().innerText();
  assert.match(t, mustMatch, label + ' 步骤内容异常：' + t.replace(/\s+/g, ' ').slice(0, 80));
  console.log('  ' + label + ' ✓  ' + t.replace(/\s+/g, ' ').slice(0, 56));
};

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  // 产品层入口直接开转账：应停在第一步
  /* chips 改版后只剩 4 个，不再显示「N 步」 */
  await page.locator('.flow-chip', { hasText: '转账' }).first().click();
  await step('01 怎么转', /你想怎么转/);
  assert.equal(await surface().locator('.a2ui-card--interactive').count(), 4, '第一步应有 4 种方式');
  assert.equal(await surface().locator('.a2ui-progress-seg').count(), 4, '进度条应有 4 段');

  await surface().getByText('转给他人').click();
  await step('02 转给谁', /转给谁/);

  await surface().getByText('章明远').click();
  await step('03 转多少', /转多少/);

  await surface().getByText('¥100').click();
  await page.waitForTimeout(400);
  assert.equal(await surface().locator('input[inputmode="decimal"]').inputValue(), '100', '快捷金额应填入');

  await surface().getByRole('button', { name: '核对信息' }).click();
  await step('04 核对', /核对一下/);
  const review = await surface().innerText();
  assert.match(review, /转后余额/, '核对页应给出转后余额');
  assert.match(review, /扣完订阅还剩/, '核对页应给出扣完订阅的余额');
  assert.match(review, /本月支出会从/, '核对页应说明本月支出变化');

  // 回退
  await surface().getByText('上一步').click();
  await step('04 → 03 回退', /转多少/);

  await surface().getByRole('button', { name: '核对信息' }).click();
  await page.waitForTimeout(500);
  await surface().getByRole('button', { name: /确认并获取验证码/ }).click();
  await page.waitForTimeout(600);
  /* 门禁有两种结果，都算通过 —— 这正说明权限分级在起作用：
     当日累计没超 ¥1,000 走「展示详情并确认」；超了则升为多因子认证。 */
  assert.equal(await page.locator('.modal').count(), 1, '应弹出确认或认证弹窗');
  const isAuth = await page.locator('.auth-modal').count() > 0;
  if (isAuth) {
    await page.locator('.auth-modal .a2ui-input').fill('824613');
    await page.locator('.auth-modal').getByRole('button', { name: /验证并执行/ }).click();
    console.log('  ↑ 当日累计超过 ¥1,000，门禁升级为多因子认证（预期行为）');
  } else {
    await page.locator('.modal').getByRole('button', { name: /确认转账/ }).click();
  }
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.undo-bar').count(), 1, '通过门禁后应出现 5 秒可撤销条');
  await page.locator('.undo-btn').click();
  await page.waitForTimeout(600);
  assert.match(await page.locator('.toast').innerText(), /已撤销/, '撤销应给出反馈');

  assert.equal(errs.length, 0, '不应有未捕获异常: ' + errs.join(' | '));
  console.log('转账流程 OK — 四步 + 回退 + 跨域核对 + 5 秒可撤销');
} finally {
  await browser.close();
}
