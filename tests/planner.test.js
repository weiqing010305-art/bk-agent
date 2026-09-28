import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, fromText, fromAction, plan } from '../src/agent/planner.js';
import { initialState, applyMessages, resolveTree } from '../src/a2ui/apply.js';
import { buildDataModel, provenance } from '../src/services/banking.js';
import { seed } from '../src/domain/bank.js';

const ctx = (extra = {}) => {
  const bank = seed();
  return { bank, dataModel: buildDataModel(bank), provenance: provenance('local', 'local'), contacts: [], surfaceId: 's1', ...extra };
};

test('意图解析：抽到金额与收款人', () => {
  const r = parseIntent('给张三转 100 元');
  assert.equal(r.action, 'transfer');
  assert.equal(r.slots.amountText, '100');
  assert.equal(r.slots.payeeHint, '张三');
});

test('意图解析：没抽到收款人就留空，不编造', () => {
  const r = parseIntent('我要转 50 块');
  assert.equal(r.action, 'transfer');
  assert.equal(r.slots.amountText, '50');
  assert.equal(r.slots.payeeHint, '');
});

test('意图解析：四类业务与兜底', () => {
  assert.equal(parseIntent('这个月花了多少').action, 'bills');
  assert.equal(parseIntent('有哪些自动续费').action, 'subscriptions');
  assert.equal(parseIntent('冻结我的卡').action, 'cards');
  assert.equal(parseIntent('今天天气怎么样').action, 'unknown');
});

test('两个入口产出同一种 surface（产品层只是跳过意图理解）', () => {
  const viaText = applyMessages(initialState(), fromText('帮我转账', ctx()));
  const viaAction = applyMessages(initialState(), fromAction('transfer', ctx()));
  assert.deepEqual(Object.keys(viaText.surfaces.s1.components).sort(),
                   Object.keys(viaAction.surfaces.s1.components).sort());
  assert.equal(viaText.diagnostics.length, 0);
  assert.equal(viaAction.diagnostics.length, 0);
});

test('所有业务 surface 都能通过白名单校验（零诊断）', () => {
  for (const id of ['welcome', 'transfer', 'bills', 'subscriptions', 'cards', 'unknown']) {
    const s = applyMessages(initialState(), plan(id, {}, ctx()));
    assert.equal(s.diagnostics.length, 0, id + ' 有诊断: ' + JSON.stringify(s.diagnostics));
    assert.ok(resolveTree(s.surfaces.s1), id + ' 无法解析成树');
  }
});

test('统合视图里的数字全部来自 service 的 dataModel', () => {
  const s = applyMessages(initialState(), fromAction('bills', ctx()));
  const tree = resolveTree(s.surfaces.s1);

  /* 找到 figures 那一行：每个 Figure 的 value 都必须已经解析成真实金额，
     而不是 null（null 意味着引用了不存在的路径，界面会显示占位符） */
  const figs = tree.children.find(c => c.key === 'figs');
  assert.ok(figs, '账单统合视图应有 figures 行');
  for (const f of figs.children) {
    assert.notEqual(f.value, null, f.key + ' 的数据引用没解析出来');
  }
  assert.match(figs.children[0].value, /^¥/, '第一个数字应是金额，实际 ' + figs.children[0].value);

  /* 结论句同样来自 dataModel，不是拼在组件里的 */
  const read = tree.children.find(c => c.key === 'read');
  const readText = read.children[1];
  assert.match(readText.text, /最大一笔是/, '结论句应已解析：' + readText.text);
  assert.match(readText.text, /订阅/, '结论句应跨域带上订阅信息');
});

test('provenance 随 surface 一起下发', () => {
  const s = applyMessages(initialState(), fromAction('welcome', ctx()));
  assert.match(s.surfaces.s1.meta.provenance.label, /数据截至/);
});

test('结构里不含任何硬编码金额字面量（只允许引用）', () => {
  const env = fromAction('bills', ctx());
  const components = JSON.stringify(env[0].createSurface.components);
  assert.equal(/¥\s?\d/.test(components), false, '组件结构里出现了写死的金额: ' + components.slice(0, 200));
});
/* ── 复杂任务的意图路由（赛题「拆解为有序子任务 DAG」的入口）─────────────── */

test('复杂任务被识别成各自的意图，而不是笼统的「转账」', () => {
  assert.equal(parseIntent('下个月 1 号自动给房东转房租').action, 'transfer.scheduled');
  assert.equal(parseIntent('每月给王佩兰转 2000').action, 'transfer.scheduled');
  assert.equal(parseIntent('这顿饭我们 AA 一下').action, 'transfer.aa');
  assert.equal(parseIntent('帮我拆分一下这笔').action, 'transfer.aa');
  assert.equal(parseIntent('我爱人生日').action, 'occasion');
  assert.equal(parseIntent('结婚纪念日快到了').action, 'occasion');
});

test('普通转账不被复杂意图误伤', () => {
  for (const s of ['给章明远转 100 元', '转 50 块给王佩兰', '我要转账']) {
    assert.equal(parseIntent(s).action, 'transfer', '不该误判：' + s);
  }
});

test('定时转账的日期意图被记下来，金额没抽到就留空', () => {
  const a = parseIntent('下个月 1 号自动给房东转房租');
  assert.equal(a.slots.dateHint, '下个月 1 号');
  const b = parseIntent('每月给王佩兰转 2000');
  assert.equal(b.slots.amountText, '2000', '有关键字「转」时应抽出金额');
});

test('跨场景联动产出的视图会带上这个月的可支配情况', () => {
  const s = applyMessages(initialState(), fromText('我爱人生日', ctx()));
  const tree = resolveTree(s.surfaces.s1);
  const flat = JSON.stringify(tree);
  assert.match(flat, /可支配/, '跨场景视图要给资金上下文');
  assert.match(flat, /可以这样安排/, '要给出可选项而不是只回一句祝福');
});
