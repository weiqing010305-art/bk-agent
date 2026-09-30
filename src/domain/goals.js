/**
 * domain/goals.js —— 目标资金计划（PRD v2.0 §11 · F6）
 * ============================================================================
 * 这一层只回答四件事，纯函数、零 React、零账本写入（ARCHITECTURE §4.1）：
 *   ① 目标口径的「可自由支配」—— 预计余额扣掉生活缓冲
 *   ② 可行性：一个目标到那天行不行、差多少
 *   ③ 冲突：多个目标争同一笔钱时，排在后面的被挤掉多少（F6-04）
 *   ④ 任务：把目标与方案翻译成可执行的步骤（F6-05）
 *
 * **现金流不在这里重写。** PRD §3.1 把「跨场景联动」定义为「目标资金计划调用账单分析、
 * 预测和转账能力」，所以余额曲线一律来自 domain/forecast.js 的 project()（F5）。
 * 两处各算一份预测，结果就是两个页面上两个对不上的余额 —— 那正是这套架构要消灭的东西。
 */

import { daysBetween } from './forecast.js';

/** 目标视界 90 天。F5 的预测按 30 天发布，目标要跨月，取一个季度。 */
export const HORIZON = 90;
/** 生活缓冲：低于它的钱不该被动用（口径沿用 PRD §14.1 的 ¥800）。 */
export const BUFFER = 80000;
/** 「新增大额支出」的门槛：低于它不推翻计划 —— 每天几十块的波动不该把计划变成「需调整」。 */
export const BIG_SPEND = 100000;

export const STATUS = { draft: 'draft', active: 'active', adjust: 'adjust', paused: 'paused', funded: 'funded', closed: 'closed' };
export const STATUS_TEXT = {
  draft: '草稿', active: '进行中', adjust: '需调整', paused: '已暂停', funded: '资金已备齐', closed: '已结束',
};
/* 只有「进行中 / 需调整」参与争用同一笔钱：草稿还没确认，暂停与结束都不再占钱（F6-08）。 */
const CLAIMS = ['active', 'adjust'];

/** 目标日期可能落在视界之外 —— P0 只承诺 90 天，超出就按视界末日判断，并允许 UI 标注。 */
export const beyond = (f, date) => date > f.end;
export const balanceAt = (f, date) => {
  if (date <= f.asOf) return f.series[0].balance;
  const hit = f.series.find(d => d.date >= date);
  return (hit || f.series[f.series.length - 1]).balance;
};
/** 可自由支配 = 到那天为止的预计余额 − 生活缓冲。 */
export const freeAt = (f, date, buffer = BUFFER) => Math.max(0, balanceAt(f, date) - buffer);

/**
 * 优先级小的先占（1 = 最高）。同级按日期，再按 id ——
 * 顺序必须完全确定，否则刷新一次「谁挤掉了谁」就换一对人。
 */
export const order = goals => [...goals].sort((a, b) =>
  (a.priority ?? 9) - (b.priority ?? 9)
  || String(a.date).localeCompare(String(b.date))
  || String(a.id).localeCompare(String(b.id)));

export const claiming = goals => goals.filter(g => CLAIMS.includes(g.status || 'active'));

/**
 * 水位分配（F6-04）：**同一笔钱不能同时完整计入多个目标**。
 * 排在前面的先占用，后面的只能拿到剩下的；拿不满的部分就是差额。
 * 返回的 claimed 是「这个目标之前已经被占住的钱」——它是方案与任务的共同输入。
 */
export function allocate(goals, f, buffer = BUFFER) {
  const out = {};
  const taken = [];
  let claimed = 0;
  for (const g of order(claiming(goals))) {
    const pool = freeAt(f, g.date, buffer);
    const free = Math.max(0, pool - claimed);
    out[g.id] = { id: g.id, pool, free, claimed, shortfall: Math.max(0, g.amount - free), ok: g.amount <= free, rivals: [...taken] };
    const use = Math.min(g.amount, free);
    claimed += use;
    if (use > 0) taken.push({ id: g.id, name: g.name, amount: use });
  }
  return out;
}

/** 冲突清单：受影响的目标 + 差额 + 是谁先占住了这笔钱。 */
export const conflicts = (goals, alloc) => goals
  .filter(g => alloc[g.id] && !alloc[g.id].ok)
  .map(g => ({ id: g.id, name: g.name, shortfall: alloc[g.id].shortfall, rivals: alloc[g.id].rivals }));

/** 把某个目标提到最高优先级（F6-04 的「由用户调整优先级」）。 */
export const raise = (goals, id) => {
  const top = Math.min(...goals.map(g => g.priority ?? 1));
  return goals.map(g => (g.id === id ? { ...g, priority: top - 1 } : g));
};

/**
 * 可行性 + 两种安排（F6-02）。
 *   keepAmount  保留目标金额，把完成日期推到**最早**能备齐的那天
 *   keepDate    保留完成日期，把目标金额降到那天**真的**拿得出的数
 * 两种都不成立时不硬凑：keepAmount 为 null 就是「视界内备不齐」，keepDate 带差额。
 */
export function assess(goal, f, buffer = BUFFER, claim = 0) {
  const date = beyond(f, goal.date) ? f.end : goal.date;
  const pool = freeAt(f, date, buffer);
  const free = Math.max(0, pool - claim);
  const shortfall = Math.max(0, goal.amount - free);
  const need = goal.amount + claim + buffer;                 // 需要的**预计余额**
  const hit = f.series.find(d => d.balance >= need);
  const last = f.series[f.series.length - 1].balance;
  return {
    date, beyond: beyond(f, goal.date), pool, free, shortfall, need, ok: shortfall === 0,
    low: { date: f.low.date, balance: f.low.balance },
    keepAmount: hit ? { date: hit.date, wait: daysBetween(f.asOf, hit.date) } : null,
    keepDate: { amount: Math.min(goal.amount, free), shortfall },
    /* 视界内能拿出的上限：keepAmount 为 null 时，用它说明「到 90 天后也只够这些」 */
    ceiling: Math.max(0, last - buffer - claim),
  };
}

/** 下一笔预计收入（工资）。第二阶段任务与「未到账」都挂在它上面（F6-05 / F6-07）。 */
export function nextIncome(f) {
  for (const d of f.series) {
    const it = d.items.find(i => i.kind === 'income');
    if (it) return { date: d.date, amount: it.amount, name: it.name };
  }
  return null;
}

/**
 * 目标 → 任务（F6-05）：分阶段存入、本人账户划转、到期提醒。
 * 每项只写「对象 / 日期 / 金额」，**不写授权等级** ——
 * 授权由 services/policy.js 按操作类型 + 金额 + 日累计推出（A-04：调用方不能自己声明风险）。
 *
 * 任务是从账本**算出来的**，不是存下来的：存下来的任务在钱真的转出去之后就会和
 * 账本各说各话。saved 一进来，第一阶段自动缩水，已存入与已分配永远不会重复计同一笔钱。
 */
export function tasksFor(goal, { f, buffer = BUFFER, asOf, claim = 0, saved = 0, income = null, object = '储蓄账户' }) {
  const left = Math.max(0, goal.amount - saved);
  const now = Math.min(left, Math.max(0, freeAt(f, asOf, buffer) - claim));
  const rest = left - now;
  const out = [];
  if (now > 0) out.push({ id: goal.id + ':1', kind: 'transfer', stage: 1, date: asOf, amount: now, object, waitingFor: null });
  if (rest > 0) out.push({
    id: goal.id + ':2', kind: 'transfer', stage: 2, date: income ? income.date : goal.date,
    amount: rest, object, waitingFor: income,
  });
  out.push({ id: goal.id + ':r', kind: 'remind', date: goal.date, amount: left, object });
  return out;
}

/**
 * 计划依赖的假设变了吗（F6-07）。四个判据，全部落在两个数上：
 * 账本可用余额，以及**已划到目标名下的钱**（§11.4：转到储蓄账户的钱仍然是用户资产）。
 * 目标自己那笔划转因此不会把自己判成「余额减少」——available 少了多少，saved 就多了多少。
 */
export function track(goal, { asOf, available, saved = 0, cards = [], gate = null }) {
  const base = goal.basis || { at: asOf, available };
  const net = available + saved;
  const reasons = [];
  if (base.available - net >= BIG_SPEND) reasons.push({ kind: 'spend', delta: base.available - net });
  if (gate && asOf > gate.date && net - base.available < gate.amount * 0.8) {
    reasons.push({ kind: 'missed', date: gate.date, amount: gate.amount, name: gate.name });
  }
  const frozen = (cards || []).find(c => c.status && c.status !== 'active');
  if (frozen) reasons.push({ kind: 'card', tail: frozen.tail });
  return { changed: reasons.length > 0, reasons };
}

/** 目标状态：用户设的（草稿/暂停/结束）优先，其余由事实推出。 */
export function statusOf(goal, { saved = 0, ready = true, changed = false }) {
  const set = goal.status || 'active';
  if (set === 'closed' || set === 'paused' || set === 'draft') return set;
  if (saved >= goal.amount) return 'funded';
  return ready && !changed ? 'active' : 'adjust';
}

/* ── 与转账的接缝（§11.4）：计划分配只是用途标记，真正动钱必须走智能转账 ────────
   回执关联靠备注：转账时把这句话写进备注，回来时按同一句话认领。
   tag 在建立目标时定下就不再变 —— 改名字不该把已经转出去的钱弄丢。 */
export const goalNote = goal => '备款 · ' + (goal.tag || goal.name);
export const savedOf = (transactions, goal) => (transactions || [])
  .filter(t => t.amount < 0 && t.note === goalNote(goal))
  .reduce((n, t) => n + -t.amount, 0);
/** 已分配 = 计划里还没执行的划转合计（用途标记，不是银行锁款）。 */
export const allocatedOf = tasks => (tasks || []).filter(t => t.kind === 'transfer').reduce((n, t) => n + t.amount, 0);
