/**
 * domain/forecast.js —— 未来现金流的纯函数
 * ============================================================================
 * 账单分析解释过去，现金流预警预测未来。这一层只做一件事：
 * **给定账本 + 假设，算出未来 N 天每天的余额曲线**，并且让每一天都能被复算。
 *
 * 口径来自 PRD v2.0 §10：
 *   · 某日余额 = 当日开始余额 + 当日流入 − 当日流出（§10.3 原文）
 *   · 只算四类：已签约代扣、已出账账单、按流水推断的周期支出、用户填的日常预算。
 *     取消掉的订阅不算，未发生的退款不算，借贷不算（§10.5）。
 *   · 同一笔钱不能以两个名字各扣一次 —— 订阅与「流水推断出的周期支出」按名称去重（§10.3）。
 *
 * 每个 item 都带 source：订阅 id / 交易 id 列表 / 假设。这是「每项重要分析都可以追溯到
 * 交易」（§2.3 目标 2）在这条链路上的实现 —— 没有来源的金额不许进曲线。
 *
 * 纯函数，零 React、零账本写操作：试算就是换一组假设再算一遍，账本一个字节都不动。
 */

export const DAY_MS = 86400000;
export const HORIZON = 30;

/* ── 业务日历：一律按自然日算 ────────────────────────────────────────────
   不用 Date.parse('2026-09-25')（那是 UTC 午夜，东八区会读成前一天），
   也不用 toISOString（会把本地日推回 UTC）。日期是业务事实，不是时间戳。 */
const pad = n => (n < 10 ? '0' + n : '' + n);
export const parseDay = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const isoDay = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const dayOfMonth = iso => Number(iso.slice(8, 10));
export function addDays(iso, n) { const d = parseDay(iso); d.setDate(d.getDate() + n); return isoDay(d); }
/** 某年某月（0 起）的第 day 天；该月没有这一天就收到月末（1 月 31 日 → 2 月 28 日）。 */
export function onDay(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  return isoDay(new Date(year, month, Math.min(day, last)));
}
/** 从 asOf（含）到 end（含）之间，每个月的第 day 天。 */
export function monthlyFrom(asOf, day, end) {
  const y = Number(asOf.slice(0, 4)), m = Number(asOf.slice(5, 7)) - 1;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const iso = onDay(y, m + i, day);
    if (iso < asOf) continue;
    if (iso > end) break;
    out.push(iso);
  }
  return out;
}
export const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY_MS);

/* ── 从流水里认出「每月都来的那几笔」────────────────────────────────────
   订阅有协议、有下扣费日，直接用。房租、水电、话费这类没有协议，但流水本身就是证据：
   连续三个月、间隔 27–32 天、金额相当。只认**最近这一段连续月度间隔**，
   所以「三月转过一次、七月起每月转」不会被判成周期支出（三月那笔会打断连续性）。
   金额取中位数，证据是那几笔交易的 id —— 答辩问「凭什么说下月 6 号要扣 3000」，
   答案是三条流水，不是规则编号。 */
const GAP_MIN = 27, GAP_MAX = 32, RUN_MIN = 3, SPREAD = 1.35, AMOUNT_FLOOR = 1000;

export function ledgerRecurring(transactions) {
  const byWho = new Map();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const who = t.counterparty || t.name;
    if (!who) continue;
    if (!byWho.has(who)) byWho.set(who, []);
    byWho.get(who).push(t);
  }
  const out = [];
  for (const [who, list] of byWho) {
    const run = list.slice().sort((a, b) => a.date.localeCompare(b.date));
    let i = run.length - 1;
    const keep = [run[i]];
    while (i > 0 && daysBetween(run[i - 1].date, run[i].date) >= GAP_MIN && daysBetween(run[i - 1].date, run[i].date) <= GAP_MAX) {
      keep.unshift(run[--i]);
    }
    if (keep.length < RUN_MIN) continue;
    const amounts = keep.map(t => -t.amount).sort((a, b) => a - b);
    const amount = amounts[Math.floor(amounts.length / 2)];
    if (amount < AMOUNT_FLOOR) continue;
    if (amounts[amounts.length - 1] > amounts[0] * SPREAD) continue;
    const last = keep[keep.length - 1];
    out.push({
      key: 'ledger:' + who, name: last.name || who, who, amount, day: dayOfMonth(last.date),
      category: last.category, evidence: keep.map(t => t.id), dates: keep.map(t => t.date),
    });
  }
  return out;
}

const norm = s => String(s || '').replace(/\s/g, '');

/** 去重：已经有代扣协议的，不再按流水算一遍（云空间既有协议又有三条流水）。 */
export const undoubled = (patterns, subscriptions) => {
  const live = subscriptions.filter(s => s.status === 'active').map(s => norm(s.name));
  return patterns.filter(p => !live.some(n => n && (n === norm(p.who) || n === norm(p.name) || norm(p.who).includes(n))));
};

/** 有效代扣协议 → 未来扣费。日期从协议自己的下扣费日往后按月推。 */
export function subscriptionItems(subscriptions, asOf, end) {
  const out = [];
  for (const s of subscriptions) {
    if (s.status !== 'active') continue;
    /* 下一个月同一天：月份取 Date 的 0 起索引再 +1，所以这里不能减 1。 */
    const nextMonth = iso => { const d = parseDay(iso); return onDay(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
    let date = s.date;
    let guard = 0;
    while (date < asOf && guard++ < 24) date = nextMonth(date);
    while (date <= end && guard++ < 60) {
      out.push({ key: 'sub:' + s.id, date, name: s.name, amount: -s.amount, kind: 'bill', estimated: false,
        source: { type: 'subscription', id: s.id, label: s.name, detail: s.detail } });
      date = nextMonth(date);
    }
  }
  return out;
}

/** 预计收入：同一个对手方、每个月的同一天、至少两个月 → 工资规律。到账前始终是预计。 */
export function incomePattern(transactions) {
  const groups = new Map();
  for (const t of transactions) {
    if (t.amount <= 0 || !t.counterparty) continue;
    const k = t.counterparty + '@' + dayOfMonth(t.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  let best = null;
  for (const [k, list] of groups) {
    if (list.length < 2) continue;
    if (best && list.length <= best.list.length) continue;
    best = { k, list: list.sort((a, b) => a.date.localeCompare(b.date)) };
  }
  if (!best) return null;
  const amounts = best.list.map(t => t.amount).sort((a, b) => a - b);
  const last = best.list[best.list.length - 1];
  return {
    key: 'income:' + best.k, who: last.counterparty, day: dayOfMonth(last.date),
    amount: amounts[Math.floor(amounts.length / 2)],
    evidence: best.list.map(t => t.id), dates: best.list.map(t => t.date), count: best.list.length,
  };
}

/* ── 日常生活预算：从历史里生成候选，用户可改（§10.2）────────────────────
   先把「已经按月单独算过的」那几类剔出去（房租、水电、话费、云空间），
   否则同一笔钱会被算两次：一次作为周期支出，一次摊进日均。
   取值用**有支出的那几天的中位数**，不是平均数 —— 八月那两笔季节性的
   （秋装 ¥1,680、年险 ¥4,500）会把平均数抬高到 ¥475，中位数不受影响。
   p25/p75 一起给出来，是因为 PRD 要求「说明估算区间」：一个数看起来像事实，
   一个区间才是估计。 */
export function livingBudget(transactions, explainedIds, subscriptions, plan) {
  const window = plan.window || 90;
  const from = addDays(plan.asOf, -(window - 1));
  const names = subscriptions.filter(s => s.status === 'active').map(s => norm(s.name));
  const perDay = new Map();
  for (const t of transactions) {
    if (t.amount >= 0 || t.date < from || t.date > plan.asOf) continue;
    if (explainedIds.has(t.id)) continue;
    if (names.some(n => n && (n === norm(t.name) || n === norm(t.counterparty)))) continue;
    perDay.set(t.date, (perDay.get(t.date) || 0) - t.amount);
  }
  const days = [...perDay.values()].sort((a, b) => a - b);
  if (!days.length) return { day: 0, low: 0, high: 0, sample: 0, window };
  const q = p => days[Math.min(days.length - 1, Math.floor(days.length * p))];
  return { day: q(0.5), low: q(0.25), high: q(0.75), sample: days.length, window };
}

/* ── 预测本体 ────────────────────────────────────────────────────────── */
const BUDGET_ITEM = { key: 'budget', name: '日常预算', kind: 'budget', estimated: true,
  source: { type: 'assumption', label: '日常预算' } };

export function project(state, plan) {
  if (!plan || !plan.asOf) throw new Error('缺少基准日');
  const asOf = plan.asOf;
  const horizon = plan.horizon || HORIZON;
  const end = addDays(asOf, horizon - 1);
  const subs = state.subscriptions || [];
  const txs = state.transactions || [];

  const found = ledgerRecurring(txs);
  const patterns = undoubled(found, subs);
  const explained = new Set(found.flatMap(p => p.evidence));
  const budget = Number.isSafeInteger(plan.budgetPerDay) && plan.budgetPerDay >= 0
    ? { day: plan.budgetPerDay, low: plan.budgetPerDay, high: plan.budgetPerDay, sample: 0, window: 0 }
    : livingBudget(txs, explained, subs, { asOf, window: plan.budgetWindow });

  const income = incomePattern(txs);
  const salaryDay = plan.salaryDay || (income && income.day);
  const items = [
    ...subscriptionItems(subs, asOf, end),
    ...patterns.flatMap(p => monthlyFrom(asOf, p.day, end).map(date => ({
      key: p.key, date, name: p.name, amount: -p.amount, kind: 'recurring', estimated: true,
      source: { type: 'ledger', label: p.who, ids: p.evidence, dates: p.dates },
    }))),
  ];
  if (plan.includeIncome !== false && income && salaryDay) {
    for (const date of monthlyFrom(asOf, salaryDay, end)) {
      items.push({ key: income.key, date, name: income.who, amount: income.amount, kind: 'income', estimated: true,
        source: { type: 'ledger', label: income.who, ids: income.evidence, dates: income.dates } });
    }
  }
  if (plan.spend && plan.spend.amount > 0) {
    items.push({ key: 'assumed:spend', date: asOf, name: plan.spend.name || '这笔支出', amount: -plan.spend.amount,
      kind: 'assumed', estimated: true, source: { type: 'user', label: plan.spend.name || '这笔支出' } });
  }

  const dates = Array.from({ length: horizon }, (_, i) => addDays(asOf, i));
  const byDate = new Map(dates.map(d => [d, []]));
  for (const it of items) if (byDate.has(it.date)) byDate.get(it.date).push(it);

  let balance = state.available;
  const series = dates.map(date => {
    const list = byDate.get(date).slice();
    if (budget.day > 0 && plan.includeBudget !== false) list.push({ ...BUDGET_ITEM, date, amount: -budget.day });
    const inflow = list.filter(i => i.amount > 0).reduce((n, i) => n + i.amount, 0);
    const outflow = -list.filter(i => i.amount < 0).reduce((n, i) => n + i.amount, 0);
    const opening = balance;
    balance = opening + inflow - outflow;
    return { date, opening, inflow, outflow, net: inflow - outflow, balance, items: list };
  });

  const lowIndex = series.reduce((best, d, i) => (d.balance < series[best].balance ? i : best), 0);
  const buffer = Number.isSafeInteger(plan.buffer) ? plan.buffer : 0;
  const gap = Math.max(0, -series[lowIndex].balance);
  /* 「这笔钱现在花掉，会影响哪一天」的答案是**第一次不够的那天**，不是最低点那天：
     最低点往往落在窗口最后一天（钱一直在流出去），回答不了「从哪天开始出问题」。 */
  const shortIndex = series.findIndex(d => d.balance < 0);
  const bufferIndex = series.findIndex(d => d.balance < buffer);
  /* 缺口解释只列**从窗口开始到低点那天**的流出，并按来源合并（日常预算 10 天算一行）。
     这样「合计」与「可用余额 → 低点」的差额恒等，可以逐项复算（tests/forecast.test.js）。 */
  const span = series.slice(0, lowIndex + 1).flatMap(d => d.items).filter(i => i.amount < 0);
  const merged = new Map();
  for (const it of span) {
    const g = merged.get(it.key) || { ...it, count: 0, total: 0, lastDate: it.date };
    g.count += 1; g.total += it.amount; g.lastDate = it.date;
    merged.set(it.key, g);
  }
  const gapItems = [...merged.values()].sort((a, b) => a.total - b.total)
    .map(g => ({ key: g.key, name: g.name, kind: g.kind, amount: g.total, count: g.count, lastDate: g.lastDate,
      estimated: g.estimated, source: g.source }));

  return {
    asOf, end, horizon, dates, series, opening: state.available, buffer,
    low: { ...series[lowIndex], index: lowIndex },
    gap: { amount: gap, date: series[lowIndex].date, index: lowIndex, items: gapItems,
      estimatedTotal: gapItems.filter(g => g.estimated).reduce((n, g) => n + g.amount, 0),
      verifiedTotal: gapItems.filter(g => !g.estimated).reduce((n, g) => n + g.amount, 0),
      total: gapItems.reduce((n, g) => n + g.amount, 0) },
    short: shortIndex < 0 ? null : { ...series[shortIndex], index: shortIndex },
    belowBuffer: bufferIndex < 0 ? null : { ...series[bufferIndex], index: bufferIndex, count: series.filter(d => d.balance < buffer).length },
    budget, income, patterns, salaryDay,
    assumptions: { includeIncome: plan.includeIncome !== false, includeBudget: plan.includeBudget !== false, buffer, horizon },
  };
}
