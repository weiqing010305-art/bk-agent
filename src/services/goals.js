/**
 * services/goals.js —— 目标资金计划的服务层（PRD v2.0 §11）
 * ============================================================================
 * 三件事：
 *   ① 账本 → 视图模型：把 domain/goals.js 的判定与 F5 的预测装配成页面能直接渲染的一张表
 *   ② 授权要求：每项任务要过几道门，由 services/policy.js 推（调用方不声明风险，A-04）
 *   ③ 编辑动作：纯函数地返回新的 bank.goals，由页面用 ctx.setBank 一次回写
 *
 * **状态落在账本里（bank.goals）**，不另开 localStorage 覆盖层：App.jsx 的持久化、
 * 「重置数据」、刷新恢复都自动带上目标；助手那条 surface 与页面读的也是同一份账本。
 */

import { money } from '../domain/bank.js';
import { project } from '../domain/forecast.js';
import { assess as assessRisk, PRESENTATION, SMALL_TRANSFER_LIMIT } from './policy.js';
import { DEMO_DATE } from './banking.js';
import {
  HORIZON, BUFFER, STATUS_TEXT, order, allocate, conflicts, raise, assess, nextIncome,
  tasksFor, track, statusOf, goalNote, savedOf, allocatedOf,
} from '../domain/goals.js';

/** 基准日 = 数据截至日。预测、目标倒计时、授权累计口径全部用它，三处不会各说各话。 */
export const TODAY = DEMO_DATE;
export const yuan = cents => '¥' + money(Math.round(cents));
export const goalsOf = bank => (Array.isArray(bank.goals) ? bank.goals : []);

/** 任务要过的门。op 由金额推出（与 useSecurity.gateDraft 同一口径），state 让限额也生效。 */
export function authorization(bank, amount, todayTotal) {
  const op = amount > SMALL_TRANSFER_LIMIT ? 'transfer.large' : 'transfer.small';
  const verdict = assessRisk({ op, amount, todayTotal, state: bank });
  return { level: verdict.level, badge: verdict.blocked || PRESENTATION[verdict.level].badge, blocked: !!verdict.blocked };
}

const todayTotalOf = bank => (bank.transactions || [])
  .filter(t => t.date === TODAY && t.category === '转账')
  .reduce((n, t) => n + Math.abs(t.amount), 0);

/** 一个目标的完整视图：事实（金额/日期/进度）在前，判定（可行/冲突/变化）在后。 */
function viewOf(goal, { bank, f, alloc, income, todayTotal }) {
  const claim = alloc ? alloc.claimed : 0;
  const facts = assess(goal, f, BUFFER, claim);
  const saved = savedOf(bank.transactions, goal);
  const tasks = tasksFor(goal, { f, asOf: TODAY, claim, saved, income });
  const gate = (tasks.find(t => t.waitingFor) || {}).waitingFor || null;
  const drift = track(goal, { asOf: TODAY, available: bank.available, saved, cards: bank.cards, gate });
  const allocated = allocatedOf(tasks);
  const status = statusOf(goal, { saved, ready: facts.ok, changed: drift.changed });
  const amount = goal.amount;
  return {
    id: goal.id, name: goal.name, tag: goal.tag || goal.name, priority: goal.priority ?? 9,
    amount, amountText: yuan(amount), date: goal.date, dateText: goal.date.slice(5).replace('-', '/'),
    status, statusText: STATUS_TEXT[status],
    saved, savedText: yuan(saved), allocated, allocatedText: yuan(allocated),
    need: Math.max(0, amount - saved - allocated), needText: yuan(Math.max(0, amount - saved - allocated)),
    savedPct: amount ? Math.round((saved / amount) * 100) : 0,
    donePct: amount ? Math.round(((saved + allocated) / amount) * 100) : 0,
    facts, drift, conflicts: alloc ? alloc.rivals : [],
    shortfallText: yuan(facts.shortfall),
    keepAmountText: facts.keepAmount ? facts.keepAmount.date.slice(5).replace('-', '/') : null,
    keepAmountWait: facts.keepAmount ? facts.keepAmount.wait : null,
    keepDateText: yuan(facts.keepDate.amount),
    ceilingText: yuan(facts.ceiling),
    lowText: yuan(facts.low.balance),
    lowDate: facts.low.date.slice(5).replace('-', '/'),
    tasks: tasks.map(t => {
      const auth = t.kind === 'transfer' ? authorization(bank, t.amount, todayTotal) : null;
      return { ...t, amountText: yuan(t.amount), dateText: t.date.slice(5).replace('-', '/'), auth,
        waitingText: t.waitingFor ? t.waitingFor.date.slice(5).replace('-', '/') : null };
    }),
  };
}

/** 页面要的全部东西。一次算完，避免每个组件各调一次预测。 */
export function boardOf(bank) {
  const goals = goalsOf(bank);
  const f = project(bank, { asOf: TODAY, horizon: HORIZON, buffer: BUFFER });
  const alloc = allocate(goals, f, BUFFER);
  const income = nextIncome(f);
  const todayTotal = todayTotalOf(bank);
  const views = order(goals).map(g => viewOf(g, { bank, f, alloc: alloc[g.id], income, todayTotal }));
  const total = views.reduce((n, g) => n + g.amount, 0);
  const saved = views.reduce((n, g) => n + g.saved, 0);
  const allocated = views.reduce((n, g) => n + g.allocated, 0);
  return {
    f, goals: views, income, budget: f.budget, low: f.low, asOf: f.asOf, end: f.end,
    free: Math.max(0, f.series[0].balance - BUFFER - allocated),
    freeText: yuan(Math.max(0, f.series[0].balance - BUFFER - allocated)),
    reserveText: yuan(allocated),
    totalText: yuan(total), savedText: yuan(saved), allocatedText: yuan(allocated),
    needText: yuan(Math.max(0, total - saved - allocated)),
    pct: total ? Math.round(((saved + allocated) / total) * 100) : 0,
    conflictList: conflicts(goals, alloc).map(c => ({
      id: c.id, name: c.name, shortfallText: yuan(c.shortfall),
      rivals: c.rivals.map(r => ({ id: r.id, name: r.name, amountText: yuan(r.amount) })),
    })),
  };
}

/* ── 编辑动作：纯函数进、纯函数出，由页面 ctx.setBank 一次回写 ──────────────── */

const uid = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'g' + Math.random().toString(36).slice(2));

/** 建立目标（F6-01）：名称 / 金额 / 日期三个字段，其余全部由系统推。 */
export function createGoal(bank, { name, amount, date, priority = 1 }) {
  const goal = {
    id: uid(), name: String(name).trim(), tag: String(name).trim(), amount: Math.round(amount),
    date, priority, status: 'active', createdAt: TODAY, basis: { at: TODAY, available: bank.available },
  };
  return [...goalsOf(bank), goal];
}

export const patchGoal = (bank, id, patch) => goalsOf(bank).map(g => (g.id === id ? { ...g, ...patch } : g));
export const dropGoal = (bank, id) => goalsOf(bank).filter(g => g.id !== id);
/** 冲突里的「调整优先级」：把某个目标提到最高，重算之后差额落到别人身上。 */
export const raised = (bank, id) => raise(goalsOf(bank), id);

/**
 * 采用一个方案（F6-02 / F6-07 的「提出新方案」）：
 * 方案一改日期、方案二改金额，两者都**重新记基线** —— 那一刻的余额就是新计划的起点，
 * 于是「需调整」被清掉，任务按新数字重算。目标确认只批准计划内容，不授权任何资金操作（F6-06）。
 */
export function adoptPlan(bank, goal, kind) {
  const b = boardOf(bank);
  const view = b.goals.find(g => g.id === goal.id);
  if (!view) return goalsOf(bank);
  const facts = view.facts;
  const next = kind === 'keepAmount' && facts.keepAmount ? { date: facts.keepAmount.date } : { amount: Math.round(facts.keepDate.amount) };
  return patchGoal(bank, goal.id, { ...next, status: 'active', basis: { at: TODAY, available: bank.available } });
}

/** 转账交接（§11.4）：金额与备注带上，收款人由用户在转账流程里选 —— 动钱必须走智能转账。 */
export const handoff = (goal, task) => ({
  amountText: (task.amount / 100).toFixed(2),
  note: goalNote({ tag: goal.tag, name: goal.name }),
});

/* ── 概览页的目标摘要（PRD §5.1：首页要「目标摘要」）──────────────────────── */
export function summaryOf(bank) {
  const b = boardOf(bank);
  if (!b.goals.length) return null;
  const live = b.goals.filter(g => g.status !== 'closed');
  const focus = live.find(g => g.status === 'adjust') || live.find(g => g.status !== 'funded') || b.goals[0];
  return { ...b, focus, count: b.goals.length, liveCount: live.length, adjustCount: live.filter(g => g.status === 'adjust').length };
}
