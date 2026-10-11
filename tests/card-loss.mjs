/**
 * 挂失补卡的端到端测试（D-19：赛题点名的「卡片挂失」要真的能走通）。
 *
 * 分两段，因为它们的依赖不同：
 *   A 段「挂失之后这一屏长什么样」：直接把一份**已经挂失的账本**装进 localStorage
 *     （账本由 domain/bank.js 的 reportLoss 现场算出来，不是手写的字符串）。
 *     这一段只依赖卡片域自己的文件，任何时候都该是绿的。
 *   B 段「从入口走到挂失落地」：入口 → 后果 → 多因子认证 → 账本变 lost。
 *     这一段依赖 App.jsx 的 applyConfirmation 里有 card.report-loss 分支
 *     （接线说明见 src/views/pages/cards.jsx 的文件头与 doc/ARCHITECTURE.md §7.17）。
 *
 * 断言的是流程与状态，不是某一个类名。
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { reportLoss, seed } from '../src/domain/bank.js';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const ADDRESS = '上海市浦东新区世纪大道 100 号 1201 室';
await mkdir('artifacts/card-loss', { recursive: true });

/** A 段用的账本：演示账本 + 借记卡已挂失。 */
const LOST_LEDGER = reportLoss(seed(), { cardId: 'debit', id: 'loss-debit', address: ADDRESS });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

const sheet = () => page.locator('.freeze-sheet');
const ledger = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('qinghe-mock-v1')); } catch { return null; }
});
const openCards = async () => {
  await page.locator('.side-item', { hasText: '卡片' }).first().click();
  await page.waitForTimeout(900);
};
const boot = async () => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
};

try {
  /* ══ A 段：挂失后的这一屏 ═════════════════════════════════════════════ */
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem('qinghe-mock-v1', l); }, JSON.stringify(LOST_LEDGER));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await openCards();

  assert.equal(await page.locator('.card-frozen-badge.is-loss').innerText(), '已挂失', '卡面要挂「已挂失」徽标');
  assert.match(await page.locator('.freeze-notice.is-lost').innerText(), /已挂失/, '顶部提醒条要说已挂失');

  const steps = page.locator('.replacement-steps li');
  assert.equal(await steps.count(), 3, '补卡进度要有三个节点');
  const track = await page.locator('.replacement').innerText();
  for (const word of ['补卡进度', '已受理', '制卡中', '已寄出', '预计']) {
    assert.ok(track.includes(word), '进度里缺 ' + word);
  }
  assert.match(track, /世纪大道/, '新卡寄到哪要写在进度上');
  assert.equal(await steps.nth(0).getAttribute('data-state'), 'now', '刚挂失时进度停在「已受理」');

  // 原卡不能再用：限额不可调、冻结那条路没了、渠道整组锁死
  assert.equal(await page.locator('#card-limits').count(), 0, '挂失后不该还能改限额');
  assert.equal(await page.locator('.freeze-btn').innerText(), '补卡进度', '唯一动作换成补卡进度');
  assert.equal(await page.locator('.action-cell', { hasText: '挂失补卡' }).count(), 0, '挂失过的卡不该再出现挂失入口');
  assert.equal(await page.locator('.channel-board.is-lost').count(), 1, '四个渠道要整组停用');
  assert.equal(await page.locator('.channel-board .switch:not([disabled])').count(), 0, '挂失后渠道开关不可再动');
  const history = await page.locator('.card-history').innerText();
  assert.ok(history.includes('挂失') && history.includes('补卡'), '时间线上要有挂失与补卡');
  await page.screenshot({ path: 'artifacts/card-loss/1-lost.png' });

  // 补卡进度详情：受理号 / 地址 / 预计寄到 / 手续费
  await page.locator('.freeze-btn').click();
  await page.waitForTimeout(400);
  const info = await sheet().innerText();
  for (const word of ['受理号', '寄送地址', '预计寄到', '手续费']) {
    assert.ok(info.includes(word), '补卡进度详情缺 ' + word);
  }
  await sheet().getByRole('button', { name: '关闭' }).first().click();
  await page.waitForTimeout(300);

  // 刷新后仍然查得到进度：状态在账本里，不在页面里
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await openCards();
  assert.match(await page.locator('.replacement').innerText(), /已受理/, '刷新后补卡进度应原样恢复');

  /* ══ B 段：从入口走到挂失落地 ═════════════════════════════════════════ */
  await boot();
  await openCards();
  assert.equal(await page.locator('.wallet .card-face').count(), 3, '卡包里应有三张卡');
  assert.equal(await page.locator('.action-cell', { hasText: '挂失补卡' }).count(), 1, '卡片页应有挂失补卡入口');

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
  await page.screenshot({ path: 'artifacts/card-loss/2-confirm.png' });

  // 确认进的是多因子认证，不是普通确认框 —— 风险等级由 policy 推（A-04）
  await sheet().getByRole('button', { name: '确认挂失' }).click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.auth-modal').count(), 1, '挂失应进多因子认证');
  const authText = await page.locator('.auth-modal').innerText();
  assert.match(authText, /需要多因子认证/, '认证弹窗标题');
  assert.match(authText, /青禾借记卡/, '认证弹窗要说明在认证哪件事; 实际: ' + authText.slice(0, 80));
  await page.screenshot({ path: 'artifacts/card-loss/3-auth.png' });

  // 没认证 = 什么都没发生
  await page.locator('.auth-modal').getByRole('button', { name: '关闭' }).click();
  await page.waitForTimeout(500);
  assert.equal((await ledger()).cards.find(c => c.id === 'debit').status, 'active', '认证没走完，卡不能变');

  // 走完人脸识别 → 挂失落地
  await sheet().getByRole('button', { name: '确认挂失' }).click();
  await page.waitForTimeout(500);
  await page.locator('.auth-modal').getByRole('tab', { name: '人脸识别' }).click();
  await page.locator('.auth-modal .primary-btn').click();
  await page.waitForTimeout(2600);

  const after = await ledger();
  if (after.cards.find(c => c.id === 'debit').status !== 'lost') {
    console.log('!! 账本没有变化 —— App.jsx 的 applyConfirmation 还缺 card.report-loss 分支');
    console.log('   （接线见 src/views/pages/cards.jsx 文件头 / doc/ARCHITECTURE.md §7.17）');
  }
  assert.equal(await page.locator('.auth-modal').count(), 0, '认证通过后弹窗应关闭');
  assert.equal(await sheet().count(), 0, '挂失落地后确认浮层应自己消失，结果由页面呈现');

  const debit = after.cards.find(c => c.id === 'debit');
  assert.equal(debit.status, 'lost', '挂失后卡的状态必须是 lost');
  assert.equal(debit.replacement.id, 'loss-debit', '补卡单要进账本');
  assert.equal(after.transactions[0].name, '挂失手续费', '手续费要留下一条流水');
  assert.equal(after.available + after.frozen + after.pending, after.total, '账本恒等式不能被挂失打破');
  assert.match(await page.locator('.replacement').innerText(), /已受理/, '落地后页面应换到补卡进度');
  await page.screenshot({ path: 'artifacts/card-loss/4-done.png' });

  assert.equal(pageErrors.length, 0, '不应有未捕获异常: ' + pageErrors.join(' | '));
  console.log('card-loss OK — 挂失后的界面 / 后果 / 多因子 / 未认证不变更 / 落地 / 进度 / 刷新恢复 全部通过');
} finally {
  await browser.close();
}
