/**
 * services/banking.js —— 唯一的业务真相来源
 * ============================================================================
 * 「可靠性」由这一层保证，而不是靠渲染层自觉：
 *
 *   planner（含将来的 LLM）**不产出任何事实数字**，只产出 {path:'/x'} 引用；
 *   真正的值只有本文件能写入 dataModel。
 *   → 因此不存在「卡片显示 ¥100、文字说 ¥200」这类幻觉不一致。
 *
 * 同时提供 provenance：每个 surface 都带数据来源与截止时间，UI 可显示。
 */

import { money, totals, accountOf } from '../domain/bank.js';
import { limitBoard } from './limits.js';
import { analyze } from './anomaly.js';

export const DEMO_DATE = '2026-09-25';

/** 数据来源标签 —— 会显示在卡片底部，让用户知道数字从哪来、新不新。 */
export function provenance(mode, connection) {
  if (mode !== 'backend') return { label: `数据截至 ${DEMO_DATE}`, source: 'local' };
  if (connection === 'ready') return { label: `数据截至 ${DEMO_DATE}`, source: 'postgresql' };
  return { label: '后端未连接 · 以下数字可能不是最新', source: 'stale' };
}

const yuan = n => '¥' + money(n);

/**
 * 把账本状态投影成 dataModel。
 * surface 只能引用这里出现过的路径 —— 这是白名单的第二个维度。
 */
export function buildDataModel(bank) {
  const summary = totals(bank);
  const activeSubs = bank.subscriptions.filter(s => s.status === 'active');
  const nextSub = [...activeSubs].sort((a, b) => a.date.localeCompare(b.date))[0];
  /* 余额是四个数不是一个数（调研报告 §1.1）。balance / balanceText 保持原义 =
     **可用余额**，所以老页面（overview / brief / transferFlow / payees）不需要改一行；
     新增字段供拆分展示用。 */
  const acct = accountOf(bank);
  const anomalies = analyze(bank.transactions);
  return {
    balanceText: yuan(acct.available),
    balance: acct.available,
    available: acct.available,
    availableText: yuan(acct.available),
    frozen: acct.frozen,
    frozenText: yuan(acct.frozen),
    pending: acct.pending,
    pendingText: yuan(acct.pending),
    posted: acct.posted,
    total: acct.total,
    totalText: yuan(acct.total),
    creditLimit: bank.cards.reduce((n, c) => n + (c.limit || 0), 0),
    creditLimitText: yuan(bank.cards.reduce((n, c) => n + (c.limit || 0), 0)),
    balanceParts: [
      { id: 'available', label: '可用', amount: acct.available, amountText: yuan(acct.available), hint: '现在真的能动的钱' },
      { id: 'frozen', label: '冻结', amount: acct.frozen, amountText: yuan(acct.frozen), hint: '代扣签约占用' },
      { id: 'pending', label: '在途', amount: acct.pending, amountText: yuan(acct.pending), hint: '已发起未清算' },
    ],
    /* 异常交易识别：决策链路审计的输出口。每条都带 ruleId + weight + evidence。 */
    anomalyCount: anomalies.txCount,                 // 被标记的**交易**笔数（一笔可能命中多条规则）
    anomalyRuleHits: anomalies.alerts.length,        // 规则命中行数（审计视角）
    anomalies: anomalies.alerts.map(a => ({
      id: a.txId, txId: a.id, ruleId: a.ruleId, label: a.label, score: a.score, weight: a.baseWeight,
      disposition: a.disposition, dispositionText: { reject: '已拒绝', review: '人工复核', confirm: '待确认', pass: '放行' }[a.disposition],
      evidence: a.evidence, amountText: yuan(Math.abs(a.amount)), name: (bank.transactions.find(t => t.id === a.id) || {}).name,
    })),
    anomalySuppressed: anomalies.dropped.map(d => ({ txId: d.txId, ruleId: d.ruleId, reason: d.reason })),
    limits: limitBoard(bank).map(l => ({ id: l.id, label: l.label, limitType: l.limitType,
      remainingText: yuan(l.remaining), maxText: yuan(l.maxAmount), window: l.window, active: l.active })),
    spendingText: yuan(summary.spending),
    incomeText: yuan(summary.income),
    incomeCount: bank.transactions.filter(t => t.amount > 0).length,
    categories: summary.categories.map(c => ({
      name: c.name,
      amount: c.amount,
      amountText: yuan(c.amount),
      percent: summary.spending ? Math.round(c.amount / summary.spending * 100) : 0,
    })),
    transactions: bank.transactions.map(t => ({
      id: t.id, name: t.name, category: t.category, date: t.date, amount: t.amount,
      amountText: (t.amount > 0 ? '+' : '−') + yuan(Math.abs(t.amount)),
      positive: t.amount > 0,
    })),
    subscriptions: bank.subscriptions.map(s => ({
      id: s.id, name: s.name, detail: s.detail, date: s.date,
      amountText: yuan(s.amount),
      active: s.status === 'active',
      statusText: s.status === 'active' ? `下次扣费 ${s.date}` : '已取消 · 不再续费',
    })),
    activeSubCount: activeSubs.length,
    monthlySubTotalText: yuan(activeSubs.reduce((n, s) => n + s.amount, 0)),
    nextSubName: nextSub ? nextSub.name : null,
    nextSubDate: nextSub ? nextSub.date : null,
    nextSubAmountText: nextSub ? yuan(nextSub.amount) : null,
    transactionCount: bank.transactions.length,
    cards: bank.cards.map(c => ({
      id: c.id, name: c.name, type: c.type, tail: c.tail,
      active: c.status === 'active',
      statusText: c.status === 'active' ? '● 正常使用' : '● 已冻结',
    })),
    cardCount: bank.cards.length,
  };
}

/* ── 跨域汇总：Agent 之所以是 Agent，就靠这一层 ──────────────────────────
   软件时代的银行：每个功能一个页面，信息按"产品"切开。
   Agent 时代：按"用户此刻要办的事"把跨产品的信息合起来。
   下面这些函数就是"合起来"的那一半 —— 它们不属于任何一个产品页面。 */

/** 这笔转账对账户和各处的影响。核对页与回执页共用，保证口径一致。 */
export function transferImpact(bank, amount) {
  /* 转后余额按**可用**算：冻结与在途动不了。 */
  const after = accountOf(bank).available - amount;
  const monthBefore = totals(bank).spending;
  const monthAfter = monthBefore + amount;
  const pct = monthBefore ? Math.round((amount / monthBefore) * 100) : 0;
  return {
    balanceBeforeText: yuan(accountOf(bank).available),
    balanceAfterText: yuan(after),
    monthBeforeText: yuan(monthBefore),
    monthAfterText: yuan(monthAfter),
    monthDeltaPct: pct,
    /* 转完之后还剩多少"安全垫"：余额减掉未来 30 天的固定扣费 */
    upcomingText: yuan(bank.subscriptions.filter(s => s.status === 'active').reduce((n, s) => n + s.amount, 0)),
    safeAfterText: yuan(after - bank.subscriptions.filter(s => s.status === 'active').reduce((n, s) => n + s.amount, 0)),
  };
}

/** 本月复盘：把支出、最大一笔、订阅影响、同环比合成一段话。 */
export function monthReview(bank) {
  const t = totals(bank);
  const biggest = bank.transactions.filter(x => x.amount < 0).sort((a, b) => a.amount - b.amount)[0];
  const subs = bank.subscriptions.filter(s => s.status === 'active');
  const subTotal = subs.reduce((n, s) => n + s.amount, 0);
  const income = t.income;
  return {
    spendingText: yuan(t.spending),
    incomeText: yuan(income),
    netText: yuan(income - t.spending),
    biggestName: biggest ? biggest.name : '暂无',
    biggestText: biggest ? yuan(Math.abs(biggest.amount)) : '-',
    subCount: subs.length,
    subTotalText: yuan(subTotal),
    subSharePct: t.spending ? Math.round((subTotal / t.spending) * 100) : 0,
    /* 结余能覆盖几个月 */
    runwayMonths: t.spending ? (income / t.spending).toFixed(1) : '-',
    /* 以下是**成句的结论**。放在 service 而不是 planner，因为 planner 只允许产出引用，
       不允许把事实数字拼进组件结构 —— tests/planner.test.js 有一条断言专门守这个。 */
    netNote: '约为支出的 ' + (t.spending ? (income / t.spending).toFixed(1) : '-') + ' 倍',
    subNote: subs.length + ' 项，占支出 ' + (t.spending ? Math.round((subTotal / t.spending) * 100) : 0) + '%',
    readText: '最大一笔是「' + (biggest ? biggest.name : '暂无') + '」' + (biggest ? yuan(Math.abs(biggest.amount)) : '-')
      + '；订阅占了支出的 ' + (t.spending ? Math.round((subTotal / t.spending) * 100) : 0) + '%，共 ' + subs.length + ' 项 ' + yuan(subTotal),
  };
}

/** 未处理的事：Agent 主动提示的入口。软件时代这靠用户自己去各页面找。 */
export function pendingItems(bank) {
  const out = [];
  const subs = bank.subscriptions.filter(s => s.status === 'active');
  const total = subs.reduce((n, s) => n + s.amount, 0);
  if (subs.length) {
    const next = [...subs].sort((a, b) => a.date.localeCompare(b.date))[0];
    out.push({ id: 'subs', kind: '订阅', title: next.name + ' 即将扣费', detail: next.date + ' · ' + yuan(next.amount) + '，本月订阅共 ' + yuan(total), action: 'open.subscriptions' });
  }
  const frozen = bank.cards.filter(c => c.status === 'frozen');
  if (frozen.length) out.push({ id: 'cards', kind: '卡片', title: '尾号 ' + frozen[0].tail + ' 处于冻结', detail: '要用的话记得解冻', action: 'open.cards' });
  const lowBalance = accountOf(bank).available < total * 3;
  if (lowBalance) out.push({ id: 'balance', kind: '余额', title: '余额接近固定扣费的三倍', detail: '本月待扣 ' + yuan(total) + '，留意余额', action: 'open.bills' });
  return out;
}

/* ── 转账：草稿校验是写操作的信任边界，绝不简化 ─────────────────────────── */

export const MAX_TRANSFER = 100000000; // ¥1,000,000.00

/**
 * 校验转账槽位。返回 { ok, amount, error }。
 * 注意：**这里不读也不写余额**，余额校验由调用方在做确认时进行，
 * 因为草稿阶段用户可能还在改金额。
 */
export function validateTransferSlots({ recipient, amountText, balance }) {
  const manual = recipient && recipient.mode === 'manual';
  const cardNumber = ((recipient && recipient.cardNumber) || '').replace(/\s/g, '');
  if (manual && !/^[0-9]{16,19}$/.test(cardNumber)) return { ok: false, error: '卡号要 16–19 位' };
  if (!manual && !(recipient && recipient.contactId)) return { ok: false, error: '请选择收款人' };
  if (!/^\d+(\.\d{1,2})?$/.test(String(amountText || ''))) return { ok: false, error: '金额最多两位小数' };
  const value = Number(amountText);
  if (!(value > 0)) return { ok: false, error: '金额最多两位小数' };
  const amount = Math.round(value * 100);
  if (!Number.isSafeInteger(amount) || amount > MAX_TRANSFER) return { ok: false, error: '单笔最多 ¥1,000,000.00' };
  if (amount > balance) return { ok: false, error: '余额不足，请修改金额' };
  return { ok: true, amount, cardNumber };
}
