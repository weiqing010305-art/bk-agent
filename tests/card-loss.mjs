/**
 * 挂失补卡的端到端流程（D-19：赛题点名的「卡片挂失」要真的能走通）。
 *
 * 断言的是**流程**，不是某一个类名：
 *   ① 入口在卡片页，后果在确认之前就摊开（四个渠道 + 不可恢复 + 补卡工时 + 手续费）
 *   ② 点确认进的是**多因子认证**，不是普通确认框 —— 风险等级由 policy 推（A-04）
 *   ③ 认证没走完就关掉 → 卡还是好的（不可逆操作没有被绕过）
 *   ④ 认证通过 → 卡进 lost：卡面换材料、限额不可调、冻结那条路消失
 *   ⑤ 补卡有进度可查：受理 → 制卡 → 寄出，受理号与寄送地址都在
 *   ⑥ 账本真的变了：手续费进了流水，卡的状态是 lost
 *
 * ⚠️ ④⑤⑥ 依赖 App.jsx 的 applyConfirmation 里有 card.report-loss 分支
 *    （接线说明见 src/views/pages/cards.jsx 的文件头与 doc/ARCHITECTURE.md §7.17）。
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
await mkdir('artifacts/card-loss', { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

const sheet = () => page.locator('.freeze-sheet');
const ledger = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('qinghe-mock-v1')); } catch { return null; }
});

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.locator('.side-item', { hasText: '卡片' }).first().click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.wallet .card-face').count(), 3, '卡包里应有三张卡');
  assert.equal(await page.locator('.action-cell', { hasText: '挂失补卡' }).count(), 1, '卡片页应有挂失补卡入口');

  // ── ① 后果在确认之前摊开 ────────────────────────────────────────────────
  await page.locator('.action-cell', { hasText: '挂失补卡' }).click();
  await page.waitForTimeout(400);
  const openText = await sheet().innerText();
  assert.match(openText, /挂失补卡/, '浮层标题应是挂失补卡');
  for (const word of ['即时生效', '不可恢复', '3–7 个工作日', '手续费']) {
    assert.ok(openText.includes(word), '确认之前必须说清后果：缺 ' + word);
  }
  for (const ch of ['境内刷卡', '线上支付', '境外支付', '取现']) {
    assert.ok(openText.includes(ch), '四个渠道要当场画出来：缺 ' + ch);
  }
  await page.screenshot({ path: 'artifacts/card-loss/1-confirm.png' });

  // ── ② 确认 → 多因子认证（不是普通确认框）────────────────────────────────
  await sheet().getByRole('button', { name: '确认挂失' }).click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.auth-modal').count(), 1, '挂失应进多因子认证');
  assert.ok(!(await page.locator('.modal').innerText()).includes('恢复初始'), '不应掉进通用确认框');
  const authText = await page.locator('.auth-modal').innerText();
  assert.match(authText, /需要多因子认证/, '认证弹窗标题');
  assert.match(authText, /青禾借记卡/, '认证弹窗要说明在认证哪件事');
  await page.screenshot({ path: 'artifacts/card-loss/2-auth.png' });

  // ── ③ 没认证 = 什么都没发生 ─────────────────────────────────────────────
  await page.locator('.auth-modal').getByRole('button', { name: '关闭' }).click();
  await page.waitForTimeout(500);
  const untouched = await ledger();
  assert.equal(untouched.cards.find(c => c.id === 'debit').status, 'active', '认证没走完，卡不能变');

  // ── ④⑤⑥ 走完人脸识别 → 挂失落地 ────────────────────────────────────────
  await sheet().getByRole('button', { name: '确认挂失' }).click();
  await page.waitForTimeout(500);
  await page.locator('.auth-modal').getByRole('tab', { name: '人脸识别' }).click();
  await page.locator('.auth-modal .primary-btn').click();
  await page.waitForTimeout(2600);

  assert.equal(await page.locator('.auth-modal').count(), 0, '认证通过后弹窗应关闭');
  assert.equal(await sheet().count(), 0, '挂失落地后确认浮层应自己消失，结果由页面呈现');

  const after = await ledger();
  const debit = after.cards.find(c => c.id === 'debit');
  if (debit.status !== 'lost') {
    console.log('!! 账本没有变化 —— App.jsx 的 applyConfirmation 还缺 card.report-loss 分支（接线见 cards.jsx 文件头）');
  }
  assert.equal(debit.status, 'lost', '挂失后卡的状态必须是 lost');
  assert.equal(debit.replacement.id, 'loss-debit', '补卡单要进账本');
  assert.equal(after.transactions[0].name, '挂失手续费', '手续费要留下一条流水');
  assert.equal(after.available + after.frozen + after.pending, after.total, '账本恒等式不能被挂失打破');

  // 界面：卡面换材料 + 提醒条 + 补卡进度
  assert.equal(await page.locator('.card-frozen-badge.is-loss').innerText(), '已挂失', '卡面要挂「已挂失」徽标');
  assert.match(await page.locator('.freeze-notice.is-lost').innerText(), /已挂失/, '顶部提醒条要说已挂失');
  const steps = page.locator('.replacement-steps li');
  assert.equal(await steps.count(), 3, '补卡进度要有三个节点');
  const stepText = await page.locator('.replacement').innerText();
  for (const word of ['补卡进度', '已受理', '制卡中', '已寄出', '预计']) {
    assert.ok(stepText.includes(word), '进度里缺 ' + word);
  }
  assert.match(stepText, /世纪大道/, '新卡寄到哪要写在进度上');

  // 原卡不能再用：限额不可调、冻结那条路没了
  assert.equal(await page.locator('#card-limits').count(), 0, '挂失后不该还能改限额');
  assert.equal(await page.locator('.freeze-btn').innerText(), '补卡进度', '唯一动作换成补卡进度');
  assert.equal(await page.locator('.action-cell', { hasText: '挂失补卡' }).count(), 0, '挂失过的卡不该再出现挂失入口');

  // 渠道整组停用 + 状态时间线留下两步
  assert.equal(await page.locator('.channel-board.is-lost').count(), 1, '四个渠道要整组停用');
  assert.equal(await page.locator('.channel-board .switch:not([disabled])').count(), 0, '挂失后渠道开关不可再动');
  const history = await page.locator('.card-history').innerText();
  assert.ok(history.includes('挂失') && history.includes('补卡'), '时间线上要有挂失与补卡');

  // 补卡进度详情（受理号 / 地址 / 预计寄到）
  await page.locator('.freeze-btn').click();
  await page.waitForTimeout(400);
  const info = await sheet().innerText();
  for (const word of ['受理号', '寄送地址', '预计寄到', '手续费']) {
    assert.ok(info.includes(word), '补卡进度详情缺 ' + word);
  }
  await page.screenshot({ path: 'artifacts/card-loss/3-progress.png' });
  await sheet().getByRole('button', { name: '关闭' }).first().click();

  // 刷新后仍然查得到进度（状态在账本里，不在页面里）
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('.side-item', { hasText: '卡片' }).first().click();
  await page.waitForTimeout(900);
  assert.match(await page.locator('.replacement').innerText(), /已受理/, '刷新后补卡进度应原样恢复');

  assert.equal(pageErrors.length, 0, '不应有未捕获异常: ' + pageErrors.join(' | '));
  console.log('card-loss OK — 后果 / 多因子 / 未认证不变更 / 落地 / 进度 / 刷新恢复 全部通过');
} finally {
  await browser.close();
}
