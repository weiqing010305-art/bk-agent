import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_STATUS, LOSS_FEE, isUsableCard, reportLoss, seed, usableCards } from '../src/domain/bank.js';
import { assess, RISK } from '../src/services/policy.js';
import { buildDataModel } from '../src/services/banking.js';

/* ══ 卡片挂失补卡（D-19 / 赛题点名的「卡片挂失」）═════════════════════════
   这一组测试守三件事：
     ① 挂失是**不可逆的状态变更**，不是换一个标签：卡进 lost、四个渠道真的关掉；
     ② 它有**后果**：补卡单入账、手续费进流水、账本恒等式不破；
     ③ 挂失的门禁**由 policy 推**：调用方声明低风险也没用（A-04）。
   页面（views/pages/cards.jsx）只报 op，落地口是 App.jsx 的 applyConfirmation → reportLoss。 */

const lossOf = (state, cardId = 'debit') =>
  reportLoss(state, { cardId, id: 'loss-' + cardId, address: '上海市浦东新区世纪大道 100 号 1201 室' });

test('挂失：卡进 lost、四个渠道全部关掉，原卡不再可用', () => {
  const before = seed();
  const after = lossOf(before);
  const card = after.cards.find(c => c.id === 'debit');

  assert.equal(card.status, CARD_STATUS.LOST);
  assert.equal(isUsableCard(card), false, '挂失的卡不算「能用的卡」');
  assert.ok(card.channels.every(c => c.on === false || typeof c === 'string'), '四个渠道必须全部停用');
  assert.ok(!usableCards(after).some(c => c.id === 'debit'), '选卡的地方不该再看到它');
  assert.ok(usableCards(after).length === after.cards.length - 1, '其余卡片照旧可用');
});

test('挂失：补卡单进账本，状态与后续节点能从账本读出来', () => {
  const card = lossOf(seed()).cards.find(c => c.id === 'debit');
  assert.equal(card.replacement.id, 'loss-debit');
  assert.equal(card.replacement.stage, 0, '刚挂失时进度停在「已受理」');
  assert.ok(card.replacement.acceptedAt, '受理日要落账 —— 进度节点的日期由它推出来');
  assert.ok(card.replacement.address.includes('世纪大道'));
  assert.equal(card.replacement.fee, LOSS_FEE);

  const titles = card.history.slice(-2).map(h => h.title);
  assert.deepEqual(titles, ['挂失', '补卡'], '时间线上要留下这两步');
});

test('挂失：手续费真的扣，并且留下一条流水', () => {
  const before = seed();
  const after = lossOf(before);
  assert.equal(after.available, before.available - LOSS_FEE);
  assert.equal(after.balance, after.available, 'balance 仍然是 available 的别名');
  assert.equal(after.transactions[0].name, '挂失手续费');
  assert.equal(after.transactions[0].amount, -LOSS_FEE);
  /* 账本恒等式不能被一次挂失打破：期初 + 全部流水 === 期末可用 */
  assert.equal(after.drift, 0);
  assert.equal(after.opening + after.transactions.reduce((a, t) => a + t.amount, 0), after.available);
  assert.equal(after.available + after.frozen + after.pending, after.total);
});

test('挂失是幂等的：同一张卡重复挂失不再扣费、不开第二张补卡单', () => {
  const once = lossOf(seed());
  const twice = lossOf(once);
  assert.equal(twice.available, once.available);
  assert.equal(twice.transactions.length, once.transactions.length);
  assert.equal(twice.cards.find(c => c.id === 'debit').replacement.id, 'loss-debit');
  assert.equal(reportLoss(once, { cardId: '不存在的卡' }), once, '找不到的卡原样返回，不造一张出来');
});

test('挂失不可自助解冻：解冻那条路只认 frozen', () => {
  const lost = lossOf(seed());
  const card = lost.cards.find(c => c.id === 'debit');
  /* 页面据此隐藏「解冻/冻结」那颗按钮：挂失后没有任何一条回到 active 的边 */
  assert.notEqual(card.status, CARD_STATUS.FROZEN);
  const lostModels = buildDataModel(lost).cards.find(c => c.id === 'debit');
  assert.equal(lostModels.active, false, '助手侧的卡片视图也必须把它当「不能用」');
});

test('挂失的风险等级由 policy 推出：调用方声明低风险也照样是高危', () => {
  assert.equal(assess({ op: 'card.report-loss' }).level, RISK.HIGH);
  assert.equal(assess({ op: 'card.report-loss', level: 'low', risk: 'low', trusted: true }).level, RISK.HIGH);
  assert.deepEqual(assess({ op: 'card.report-loss' }).requires, ['sms', 'face', 'token']);
});
