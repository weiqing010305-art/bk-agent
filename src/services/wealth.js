/**
 * services/wealth.js —— 理财域的业务逻辑（收益 / 榜单 / 校验 / 记账）
 * ============================================================================
 * 本文件是理财域的唯一事实来源，页面只拿结论、不算公式。
 * 依据 doc/research/za-design-and-wealth.md：
 *  §B.4.2  七日年化在业内有多套算法 → **全部列出**，不挑一套假装唯一
 *  §B.4.3  收益的呈现形态是「大数字 + 一句结论 + 一行脚注 + 一个动作」，不是表格
 *  §B.6    榜单只排行为数据，排序口径可复算，定义放脚注
 *  §B.5.1  申购的截止 / 到账 / 起购 / 认购费口径
 *  §B.7    新手引导 = 业务里程碑清单，不是浮层教学
 *
 * ⚠️ 所有产品与数字都是虚构的演示数据（见 domain/wealth.js 的文件头）。
 */

import { money, normalize, ledgerVersion, AS_OF } from '../domain/bank.js';
import { FUNDS, HOLDINGS, RANKS, SINGLE_CAP } from '../domain/wealth.js';

export const yuan = n => '¥' + money(n);
export const fundOf = code => FUNDS.find(f => f.code === code) || null;

/** 持仓：账本里有 wealth 就用它，没有就用种子（后端模式下账本可能不带这一片）。 */
export const holdingsOf = bank => (Array.isArray(bank && bank.wealth) ? bank.wealth : HOLDINGS);

/**
 * 昨日收益。两条口径各自都是**真实口径**，不是把一个数摊出来：
 *  · 货币基金：份额 ÷ 10000 × 每万份收益（货基就是这么披露的，净值恒为 1）
 *  · 其余基金：份额 ×（最新净值 − 前一交易日净值）
 */
function daily(h, fund) {
  if (fund.nav7) return Math.round((h.units / 10000) * fund.wan7[fund.wan7.length - 1] * 100);
  return Math.round(h.units * (fund.nav - fund.navPrev) * 100);
}

/** 持仓汇总：市值 = 份额 × 最新净值，浮盈 = 市值 − 成本（§D.3 的 fund-app 口径）。 */
export function portfolio(bank) {
  const rows = holdingsOf(bank).map(h => {
    const fund = fundOf(h.code);
    /* 份额 × 净值得到的是**元**，账本一律用分 —— 换算是这一步唯一的坑，写在明处。 */
    const value = fund ? Math.round(h.units * fund.nav * 100) : h.cost;
    const profit = value - h.cost;
    return { ...h, fund, value, profit, daily: fund ? daily(h, fund) : 0,
      profitPct: h.cost ? (profit / h.cost) * 100 : 0 };
  });
  const value = rows.reduce((n, r) => n + r.value, 0);
  const cost = rows.reduce((n, r) => n + r.cost, 0);
  const profit = value - cost;
  /* 货基那条单独拎出来：七日年化只对货币基金成立（§B.4.1），报告第二页要它。 */
  const cash = rows.find(r => r.fund && r.fund.nav7) || fundOf('000128');
  const cashFund = cash && cash.fund ? cash.fund : cash;
  return { rows, value, cost, profit, profitPct: cost ? (profit / cost) * 100 : 0,
    daily: rows.reduce((n, r) => n + r.daily, 0), cashFund,
    pending: rows.filter(r => r.status === 'pending') };
}

/**
 * 七日年化的**四套算法**（§B.4.2 的官方样本）。
 * ZA 把每家基金公司的真实公式逐条摊在同一个折叠条目里：泰康/高騰/南方東英用净值复利、
 * 平安用单利折算、華夏用累计收益率年化。这里照做 —— 只看两个公开披露口径：
 * nav7（8 个自然日的单位净值 T1…T8）与 wan7（同 7 日的每万份收益）。
 * **结果确实不一样**（1.888% ~ 1.912%），这正是「不挑一套假装唯一」的意义。
 */
export const SEVEN_DAY = [
  { id: 'compound', label: '复利', formula: '[(T8/T1)^(365/7)−1]×100%',
    of: f => (Math.pow(f.nav7[7] / f.nav7[0], 365 / 7) - 1) * 100 },
  { id: 'simple', label: '单利', formula: '(T8−T1)÷T1÷7×365×100%',
    of: f => ((f.nav7[7] - f.nav7[0]) / f.nav7[0] / 7) * 365 * 100 },
  { id: 'wan', label: '万份折算', formula: 'Σ每万份收益÷10000÷7×365×100%',
    of: f => (f.wan7.reduce((a, b) => a + b, 0) / 10000 / 7) * 365 * 100 },
  { id: 'reinvest', label: '含分红再投', formula: 'Π(1+每万份收益÷10000)^(365/7)−1',
    of: f => (Math.pow(f.wan7.reduce((a, b) => a * (1 + b / 10000), 1), 365 / 7) - 1) * 100 },
];

/** 一只货币基金的四套算法结果。不是货币基金就没有七日年化 —— 返回空数组，页面自然不显示。 */
export const sevenDay = fund => (fund && fund.nav7 ? SEVEN_DAY.map(a => ({ ...a, value: a.of(fund) })) : []);

/**
 * 榜单。排序口径写死在 domain 里（可复算），这里只负责排和截断。
 * 顶部固定取前 3 —— 标题写的是「别人在干什么」，数字是行为数据，没有一处是评级。
 */
export function rankBoard() {
  return RANKS.map(r => ({
    ...r,
    rows: FUNDS.filter(f => Number.isFinite(f.beh[r.by]))
      .sort((a, b) => b.beh[r.by] - a.beh[r.by])
      .slice(0, 3)
      .map(f => ({ fund: f, metric: f.beh[r.by] })),
  }));
}

/** 榜单那一格的数字怎么念。宗数带量词，金额带币种 —— 单位是口径的一部分，不能省。 */
export const metricText = (rank, n) => (rank.kind === 'count' ? n.toLocaleString('zh-CN') + ' 宗' : yuan(n));

/**
 * 新手引导的三个里程碑（§B.7 的 ZA Quest：开户 → 首购 → 留存）。
 * 判据全部**由账本推出**，不是写死的三颗勾 —— 买了第一笔，第二颗自己就亮了。
 */
export function milestones(bank) {
  const p = portfolio(bank);
  return [
    { id: 'account', label: '开户', done: true, hint: '投资账户已开通' },
    { id: 'first', label: '首购', done: p.rows.length > 0, hint: '完成第一笔申购' },
    { id: 'keep', label: '满 10 万', done: p.value >= 10000000, hint: '持有金额满 ¥100,000.00' },
  ];
}

/**
 * 申购前的校验。**就地校验与拒绝态是两种东西**：
 *  · 没到起购 / 没填金额 → 行内一句话（NN/g：就地校验把重填率减半）
 *  · 超过单笔上限 / 活期不够 → 拒绝态，按 §A.4 的公式：原因（拟人化短标题）+ 补救路径 + 错误码
 * 校验只读 available，不写账本 —— 写入在 purchase() 里，并且它会再校验一次。
 */
export function check({ fund, amount, available = 0 }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, id: 'empty' };
  if (amount < fund.min) return { ok: false, id: 'min', inline: yuan(fund.min) + ' 起' };
  if (amount > SINGLE_CAP) return { ok: false, id: 'cap', title: '这笔太大了', code: 'W-1041',
    fix: '单笔最多 ' + yuan(SINGLE_CAP) };
  const fee = Math.round((amount * fund.feePct) / 100);
  if (amount + fee > available) return { ok: false, id: 'cash', title: '活期不够了', code: 'W-1042',
    fix: '改小金额，或先转一笔进来' };
  return { ok: true, fee, units: amount / 100 / fund.nav, total: amount + fee };
}

/**
 * 记账：申购。
 *
 * **资金直连活期账户，没有投资钱包**（§B.2.4 官方原文 "Direct trading, no need to deposit
 * in advance"）—— 所以这里是「扣 available + 加一条持仓」，没有中间账户、没有充值步骤。
 *
 * 与 domain/bank.js 的 transfer() 同一套写法：幂等（同一 id 不重复扣）+ 版本戳
 * （草稿阶段的快照和提交时对不上就拒绝，而不是照扣）。份额 T+N 才确认，所以新持仓是 pending。
 */
export function purchase(state, action) {
  const { id, code, amount, fee = 0, expect } = action || {};
  if (!id || (state.completed || []).includes(id)) return state;
  if (expect && expect !== ledgerVersion(state)) throw new Error('账户刚刚有变动，核对一下再提交。');
  const fund = fundOf(code);
  if (!fund) throw new Error('这只基金不在架上了，换一只看看。');
  if (!Number.isSafeInteger(amount) || amount < fund.min) throw new Error('没到起购金额，改大一点再提交。');
  if (amount > SINGLE_CAP) throw new Error('超过单笔上限，拆成两笔更稳。');
  const total = amount + fee;
  if (total > state.available) throw new Error('活期账户余额不足，改小金额或先转一笔进来。');

  const units = Math.round((amount / 100 / fund.nav) * 100) / 100;
  const next = normalize({
    ...state,
    available: state.available - total,
    completed: [...(state.completed || []), id],
    wealth: [{ id, code, units, cost: total, date: AS_OF, status: 'pending', orderAt: AS_OF }, ...holdingsOf(state)],
    transactions: [{ id, name: '申购 ' + fund.name, category: '理财', amount: -total,
      at: AS_OF + 'T10:00', date: AS_OF, hour: 10, counterparty: fund.code, method: 'wealth', note: fund.code },
      ...state.transactions],
  });
  return { ...next, drift: next.available + next.frozen + next.pending - next.total };
}

/** 申购指令的 id：同一只基金同一笔金额在同一天只会入账一次（幂等键）。 */
export const orderId = (code, amount) => 'w-' + code + '-' + amount + '-' + AS_OF;
