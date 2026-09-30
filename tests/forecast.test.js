/**
 * tests/forecast.test.js —— 未来现金流预警
 * ============================================================================
 * 这一份测试守的是 PRD §2.3 目标 2：「每项重要分析都可以追溯到交易」。
 * 所以断言几乎全是**复算**，不是抄一遍期望值：
 *   · 每天的余额 = 上一天余额 + 当日流入 − 当日流出（逐日、逐项重算）
 *   · 缺口明细的合计 = 可用余额 + 区间内流入 − 最低点余额（把差额解释干净）
 *   · 每个金额都能指回一条订阅协议或几笔真实流水（指不回去就说明它是编的）
 * 数字会随账本变，这些等式不会。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, newAccountSeed, ledgerVersion, money } from '../src/domain/bank.js';
import {
  project, addDays, monthlyFrom, onDay, ledgerRecurring, undoubled, incomePattern, livingBudget,
} from '../src/domain/forecast.js';
import { forecastModel, forecastFacts, DEFAULT_ASSUMPTIONS } from '../src/services/forecast.js';
import { DEMO_DATE } from '../src/services/banking.js';

const bank = seed();
const PLAN = { asOf: DEMO_DATE, horizon: 30, buffer: 100000 };
const sum = (list, f = x => x) => list.reduce((n, x) => n + f(x), 0);
const items = (p, kind) => p.series.flatMap(d => d.items).filter(i => i.kind === kind);

/* ── 1 曲线本身 ─────────────────────────────────────────────────────── */

test('30 天预测：逐日余额可复算，且首日从可用余额开始', () => {
  const p = project(bank, PLAN);
  assert.equal(p.series.length, 30);
  assert.equal(p.series[0].date, DEMO_DATE);
  assert.equal(p.series[29].date, addDays(DEMO_DATE, 29));
  assert.equal(p.series[0].opening, p.opening);
  p.series.forEach((d, i) => {
    assert.equal(d.balance, d.opening + d.inflow - d.outflow, d.date + ' 余额对不上');
    assert.equal(d.inflow, sum(d.items.filter(x => x.amount > 0), x => x.amount), d.date + ' 流入对不上');
    assert.equal(d.outflow, -sum(d.items.filter(x => x.amount < 0), x => x.amount), d.date + ' 流出对不上');
    if (i) assert.equal(d.opening, p.series[i - 1].balance, d.date + ' 与上一天断开');
  });
});

test('30 天预测：期末余额 = 期初 + 全部流入 − 全部流出', () => {
  const p = project(bank, PLAN);
  const all = p.series.flatMap(d => d.items);
  const inflow = sum(all.filter(i => i.amount > 0), i => i.amount);
  const outflow = -sum(all.filter(i => i.amount < 0), i => i.amount);
  assert.equal(p.opening + inflow - outflow, p.series[29].balance);
});

test('余额低点就是曲线的最低点，日期是它第一次出现的日子', () => {
  const p = project(bank, PLAN);
  const min = Math.min(...p.series.map(d => d.balance));
  assert.equal(p.low.balance, min);
  assert.equal(p.low.date, p.series.find(d => d.balance === min).date);
  assert.ok(p.low.balance > 0, '这份账本在默认假设下不该透支');
  assert.equal(p.gap.amount, 0, '没有透支就不该报缺口');
});

/* ── 2 每一项都要能追溯到交易或协议 ─────────────────────────────────── */

test('曲线里的每一笔都能指回来源', () => {
  const p = project(bank, PLAN);
  const subIds = new Set(bank.subscriptions.map(s => s.id));
  const txIds = new Set(bank.transactions.map(t => t.id));
  for (const it of p.series.flatMap(d => d.items)) {
    assert.ok(it.source && it.source.type, it.name + ' 没有来源');
    if (it.source.type === 'subscription') assert.ok(subIds.has(it.source.id), it.name + ' 指向了不存在的协议');
    if (it.source.type === 'ledger') {
      assert.ok(it.source.ids.length >= 3, it.name + ' 的推断至少要三笔流水才成立');
      it.source.ids.forEach(id => assert.ok(txIds.has(id), it.name + ' 引用了不存在的流水 ' + id));
    }
  }
  const subItems = items(p, 'bill');
  assert.ok(subItems.length > 0, '活跃订阅应该产生未来扣费');
  subItems.forEach(i => assert.equal(i.estimated, false));
});

test('房租是从三条流水里推断出来的，金额取中位数', () => {
  const found = ledgerRecurring(bank.transactions);
  const rent = found.find(x => x.name === '房租');
  assert.ok(rent, '每月 6 日的房租应该被认出来');
  assert.equal(rent.day, 6);
  assert.equal(rent.amount, 300000);
  assert.deepEqual(rent.evidence, ['j2', 'a2', 's2']);
  const p = project(bank, PLAN);
  const hit = items(p, 'recurring').find(i => i.name === '房租');
  assert.equal(hit.date, '2026-10-06');
  assert.equal(hit.estimated, true, '没有协议，只能标预计');
});

test('去重：同一笔钱不能既算协议又算流水推断', () => {
  const found = ledgerRecurring(bank.transactions);
  assert.ok(found.some(x => x.name === '云空间'), '流水里确实有云空间的月度规律');
  assert.ok(!undoubled(found, bank.subscriptions).some(x => x.name === '云空间'), '有协议就不该再按流水算');
  const p = project(bank, PLAN);
  assert.equal(p.series.flatMap(d => d.items).filter(i => i.name === '云空间').length, 0);
});

test('预计收入来自历史工资规律，到账前始终标为预计', () => {
  const inc = incomePattern(bank.transactions);
  assert.equal(inc.who, '青禾科技有限公司');
  assert.equal(inc.day, 5);
  assert.equal(inc.amount, 1500000);
  assert.deepEqual(inc.evidence, ['j1', 'a1', 's1']);
  const p = project(bank, PLAN);
  const salary = items(p, 'income');
  assert.equal(salary.length, 1, '30 天里只有一次发薪');
  assert.equal(salary[0].date, '2026-10-05');
  assert.equal(salary[0].estimated, true);
});

/* ── 3 假设可调，结论跟着动 ─────────────────────────────────────────── */

test('不计未到账收入时，工资那笔从曲线里消失', () => {
  const withInc = project(bank, PLAN);
  const without = project(bank, { ...PLAN, includeIncome: false });
  assert.equal(items(without, 'income').length, 0);
  assert.equal(withInc.series[29].balance - without.series[29].balance, 1500000);
  assert.ok(without.low.balance < withInc.low.balance);
});

test('发薪日推迟，收入那天跟着推迟', () => {
  const p = project(bank, { ...PLAN, salaryDay: 20 });
  assert.equal(items(p, 'income')[0].date, '2026-10-20');
});

test('日常预算越高，低点越低', () => {
  const base = project(bank, PLAN);
  const higher = project(bank, { ...PLAN, budgetPerDay: base.budget.day + 20000 });
  assert.ok(higher.low.balance < base.low.balance);
  assert.equal(higher.series[29].balance, base.series[29].balance - 20000 * 30);
});

test('缓冲线不改变余额，只回答「有几天在缓冲线以下」', () => {
  const loose = project(bank, { ...PLAN, buffer: 0 });
  const tight = project(bank, { ...PLAN, buffer: 4500000 });
  assert.deepEqual(loose.series.map(d => d.balance), tight.series.map(d => d.balance));
  assert.equal(loose.belowBuffer, null);
  assert.equal(tight.belowBuffer.count, 30);
  assert.equal(tight.buffer, 4500000);
});

/* ── 4 操作前试算：不生成任何真实交易 ───────────────────────────────── */

test('试算一笔 4.5 万：缺口、日期、成因都能复算', () => {
  const before = JSON.stringify(bank);
  const p = project(bank, { ...PLAN, spend: { amount: 4500000, name: '这笔花掉' } });
  assert.equal(JSON.stringify(bank), before, '试算不许改账本');

  assert.equal(p.low.balance, -327800);
  assert.equal(p.low.date, '2026-10-04');
  assert.equal(p.gap.amount, 327800, '缺口 = 低点透支的金额');
  assert.equal(p.gap.date, p.low.date);
  assert.equal(p.short.date, '2026-09-27', '第一次不够的那天才是「会影响哪一天」的答案');
  assert.ok(p.short.date < p.low.date);

  /* 缺口解释把差额说干净：期初 + 区间流入 − 明细合计 = 低点余额 */
  const span = p.series.slice(0, p.low.index + 1);
  assert.equal(p.opening + sum(span, d => d.inflow) - p.gap.total, p.low.balance);
  assert.equal(p.gap.total, sum(p.gap.items, g => g.amount));
  assert.equal(p.gap.total, -sum(span.flatMap(d => d.items).filter(i => i.amount < 0), i => i.amount));

  const big = p.gap.items[0];
  assert.equal(big.name, '这笔花掉');
  assert.equal(big.amount, -4500000);
  assert.equal(big.count, 1, '同日同名合并成一行');
  const budget = p.gap.items.find(g => g.key === 'budget');
  assert.equal(budget.count, 10, '10 天的日常预算合成一行');
  assert.equal(budget.amount, -p.budget.day * 10);

  assert.equal(p.gap.estimatedTotal + p.gap.verifiedTotal, p.gap.total);
  assert.ok(p.gap.items.some(g => g.estimated) && p.gap.items.some(g => !g.estimated),
    '成因里既有估计值也有已签约的扣费，两者必须分开报');
});

test('试算金额越大，低点越低或持平，且第一次不够的日子不晚于原来', () => {
  const a = project(bank, { ...PLAN, spend: { amount: 1000000, name: 'x' } });
  const b = project(bank, { ...PLAN, spend: { amount: 4500000, name: 'x' } });
  assert.ok(b.low.balance < a.low.balance);
  assert.ok(a.short === null || b.short.date <= a.short.date);
});

test('纯函数：同样的输入算两次结果完全一样', () => {
  assert.deepEqual(project(bank, PLAN), project(bank, PLAN));
  assert.equal(ledgerVersion(bank), ledgerVersion(seed()));
});

/* ── 5 边界 ─────────────────────────────────────────────────────────── */

test('日期工具：月末、跨月、跨年都不出错', () => {
  assert.equal(onDay(2026, 1, 31), '2026-02-28', '2 月没有 31 日就收到月末');
  assert.equal(onDay(2026, 0, 1), '2026-01-01');
  assert.deepEqual(monthlyFrom('2026-12-20', 5, '2027-02-28'), ['2027-01-05', '2027-02-05']);
  assert.equal(addDays('2026-09-25', 29), '2026-10-24');
});

test('没有基准日就报错，不猜一个今天', () => {
  assert.throws(() => project(bank, { horizon: 30 }), /缺少基准日/);
});

test('冷启动账户（8 笔流水、无订阅）不崩，也不编出周期支出', () => {
  const fresh = newAccountSeed();
  const p = project(fresh, { asOf: '2026-09-25', horizon: 30 });
  assert.equal(p.series.length, 30);
  assert.equal(p.series.flatMap(d => d.items).length, 0);
  assert.equal(p.low.balance, fresh.available);
  assert.equal(p.gap.amount, 0);
  assert.equal(p.budget.day, 0);
  assert.equal(livingBudget(fresh.transactions, new Set(), [], { asOf: '2026-09-25' }).day, 0);
});

test('日常预算把已经单独算过的周期支出剔出去，不重复计', () => {
  const found = ledgerRecurring(bank.transactions);
  const explained = new Set(found.flatMap(p => p.evidence));
  const b = livingBudget(bank.transactions, explained, bank.subscriptions, { asOf: DEMO_DATE });
  assert.ok(b.day > 0 && b.low <= b.day && b.day <= b.high, '必须给出估算区间');
  assert.ok(b.day < 60000, '剔除周期支出后不该是把季节性大额也算进去的平均数');
});

/* ── 6 服务层读数 ───────────────────────────────────────────────────── */

test('服务层把金额、日期、来源都变成可以直接显示的读数', () => {
  const m = forecastModel(bank, {});
  assert.equal(m.assumptions.asOf, DEMO_DATE);
  assert.equal(m.assumptions.buffer, DEFAULT_ASSUMPTIONS.buffer);
  assert.equal(m.low.balanceText, '¥' + money(m.low.balance));
  assert.equal(m.facts.lowText, m.low.balanceText);
  assert.equal(m.facts.lowDate, m.series[m.low.index].label);
  assert.ok(m.basis.has);
  const rent = m.calendar.find(d => d.date === '2026-10-06').items.find(i => i.name === '房租');
  assert.equal(rent.amountText, '−¥3,000.00');
  assert.equal(rent.sourceText, '07-06 · 08-06 · 09-06', '成因必须带得出那三笔流水');
  const sub = m.calendar.find(d => d.date === '2026-10-02').items.find(i => i.name === '光影视频');
  assert.equal(sub.sourceText, '连续包月会员', '协议项的来源就是协议原文');
  assert.deepEqual(forecastFacts(bank), m.facts);
});

test('首页只读低点：一个数一个日期，不需要整条曲线', () => {
  const f = forecastFacts(bank, {});
  assert.match(f.lowText, /^¥[\d,]+\.\d\d$/);
  assert.equal(f.lowDate, '10/04');
  assert.equal(f.gapText, '¥0.00');
  assert.equal(forecastFacts(bank, { spend: { amount: 4500000 } }).shortText, '09/27');
});
