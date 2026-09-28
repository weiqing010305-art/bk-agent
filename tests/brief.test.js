import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyMessages, resolveTree } from '../src/a2ui/apply.js';
import { fromAction, fromText } from '../src/agent/planner.js';
import { buildDataModel, provenance, transferImpact, monthReview, pendingItems } from '../src/services/banking.js';
import { seed, transfer } from '../src/domain/bank.js';

const ctx = (extra = {}) => {
  const bank = seed();
  return { bank, dataModel: buildDataModel(bank), provenance: provenance('local', 'local'), contacts: [], surfaceId: 's1', ...extra };
};
const build = (action, extra) => resolveTree(applyMessages(initialState(), fromAction(action, ctx(extra))).surfaces.s1);

/* 统合视图的共同要求：每个数字都必须解析出来。
   解析成 null 意味着引用了不存在的路径，界面上会变成占位符 —— 那等于"统合"失败。 */
function assertAllFiguresResolved(tree, label) {
  const walk = node => {
    if (!node) return;
    if (node.type === 'Figure') {
      assert.notEqual(node.value, null, label + ' 的 ' + node.key + ' 引用没解析出来');
      return;
    }
    (node.children || []).forEach(walk);
    if (node.child) walk(node.child);
  };
  walk(tree);
}

test('首页统合视图：跨域取数（账户 + 账单 + 订阅 + 待办）都解析出来', () => {
  const tree = build('welcome');
  assertAllFiguresResolved(tree, '首页');
  const flat = JSON.stringify(tree);
  assert.match(flat, /可用余额/);
  assert.match(flat, /待扣订阅/);
});

test('账单统合视图：结论句把订阅这个另一个产品页的事拉了进来', () => {
  const tree = build('bills');
  assertAllFiguresResolved(tree, '账单');
  const read = tree.children.find(c => c.key === 'read');
  assert.ok(read, '账单应有结论区');
  const sentence = read.children[1].text;
  assert.match(sentence, /最大一笔是/, '结论要指出最大一笔：' + sentence);
  assert.match(sentence, /订阅/, '结论要跨域带上订阅：' + sentence);
});

test('转账核对：给出转后余额、本月支出变化、扣完订阅的安全垫', () => {
  const bank = seed();
  const c = { ...ctx(), bank, transferStep: 'review', transferDraft: { contactId: 'zhang', amountText: '100' } };
  const surface = applyMessages(initialState(), fromAction('transfer', c)).surfaces.s1;
  const tree = resolveTree(surface);
  assertAllFiguresResolved(tree, '转账核对');
  const flat = JSON.stringify(tree);
  assert.match(flat, /转后余额/, '核对要预先告诉用户转完还剩多少');
  assert.match(flat, /扣完订阅还剩/, '核对要带上订阅的影响');
});

test('转账核对与回执用的是同一套影响口径', () => {
  const bank = seed();
  const im = transferImpact(bank, 10000);
  /* 不硬编码账本数字：期望值从同一个 seed() 派生 —— 演示数据扩容不该让口径测试挂掉。 */
  const yuan = n => '¥' + (n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.equal(im.balanceBeforeText, yuan(seed().balance));
  assert.equal(im.balanceAfterText, yuan(seed().balance - 10000));
  /* 口径一致性：核对页说「转后余额」，记账后余额必须真的是这个数 */
  const after = transfer(bank, { id: 'x', contactId: 'zhang', amount: 10000 });
  assert.equal('¥' + (after.balance / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 }), im.balanceAfterText);
});

test('未处理事项：Agent 主动提示，而不是等用户去各页面找', () => {
  const bank = seed();
  const items = pendingItems(bank);
  assert.ok(items.length >= 1, '有订阅在续费时应至少提示一条');
  assert.ok(items.some(i => i.kind === '订阅'), '应提示即将扣费的订阅');
  bank.cards[0].status = 'frozen';
  assert.ok(pendingItems(bank).some(i => i.kind === '卡片'), '有冻结卡时应提示');
});

test('本月复盘的小结字段齐全（结余倍数 / 订阅占比 / 最大一笔）', () => {
  const r = monthReview(seed());
  assert.match(r.netNote, /倍$/);
  assert.match(r.subNote, /项，占支出 \d+%/);
  assert.match(r.readText, /最大一笔是「.+」/);
});

test('统合视图的组件结构里不含写死的事实数字', () => {
  for (const action of ['welcome', 'bills', 'subscriptions']) {
    const components = JSON.stringify(fromAction(action, ctx())[0].createSurface.components);
    assert.equal(/¥\s?\d/.test(components), false, action + ' 的组件里出现了写死的金额');
  }
});

test('两个入口产出同一种 surface（产品层只是跳过意图理解）', () => {
  const viaAction = JSON.stringify(fromAction('bills', ctx())[0].createSurface.components);
  const viaText = JSON.stringify(fromText('这个月花了多少', ctx())[0].createSurface.components);
  assert.equal(viaAction, viaText, '自然语言与直接点功能必须落到同一张视图');
});
