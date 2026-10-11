/**
 * services/limits.js —— 限额是一等业务对象（调研报告 §1.7 / §6.3）
 * ============================================================================
 * 现状：policy.js 里只有 SMALL_TRANSFER_LIMIT 与 HARD_CAP 两个常量。
 * 报告 §7.0 的结论是「缺的不是判定逻辑，是可配的限额数据」——所以这里只建对象与
 * 读取函数，**不动 policy.js**（那是唯一门禁，风险等级仍由它推）。
 *
 * 字段照 Midaz 的限额对象抄（五元组 + 时间窗 + 周期计数器）：
 *   { id, limitType, maxAmount, asset, scopes, activeTimeStart, activeTimeEnd, counter }
 * Midaz 的两条设计被保留：
 *   1. activeTimeStart/End —— 夜间自动收紧，真实风控的常规做法；
 *   2. PER_TRANSACTION **不建计数器** —— 单笔限额是纯函数，不需要状态。
 *   以及那条必须抄的：校验与占用要原子（见 domain/bank.js 的 ledgerVersion）。
 *
 * 接口有意与 policy.js 的 assess() 同形（ok/limitId/remaining/resetAt），接线成本最低。
 */

export const LIMIT_TYPE = { PER_TRANSACTION: 'PER_TRANSACTION', DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY', CUSTOM: 'CUSTOM' };

/**
 * 银行所在地的「现在」。
 *
 * 受理时段是**银行的当地时间**，不是看页面那台机器的时区 ——
 * 用 toISOString() 会拿到 UTC：在纽约（UTC-4）演示时，
 * 当地 23:57 会变成 UTC 03:57，于是一笔正常转账被判成「夜间非柜面不受理」。
 * 同一份代码换个时区就跑不通，那是 bug 不是风控。
 *
 * 用 sv-SE 是因为它的日期格式天生是 YYYY-MM-DD HH:mm，切片口径与 ISO 一致。
 */
export const BANK_TZ = 'Asia/Shanghai';
export const bankNow = (d = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: BANK_TZ, dateStyle: 'short', timeStyle: 'short' })
    .format(d).replace(' ', 'T');

/** 账户限额表。金额单位：分。演示值，标注在 doc 的「演示值清单」内。 */
export const ACCOUNT_LIMITS = [
  { id: 'per-tx-transfer', limitType: LIMIT_TYPE.PER_TRANSACTION, maxAmount: 5000000, asset: 'CNY',
    scopes: ['transfer'], label: '单笔转账上限' },
  /* 演示值定在 ¥100,000 而不是真实惯例的 ¥20,000：演示账本把几笔「异常大额」
     刻意埋在了今天，日累计已经用掉 ¥72,800，限额定低了会导致任何转账都被拦，
     演示直接走不动。这个数保证「普通转账放行、大额被拦」两条路都能演。
     ponytail: 换真实后端时改回监管值。 */
  { id: 'daily-nonface', limitType: LIMIT_TYPE.DAILY, maxAmount: 10000000, asset: 'CNY',
    scopes: ['transfer'], label: '非柜面日累计', activeTimeStart: '06:00', activeTimeEnd: '23:00' },
  { id: 'monthly-transfer', limitType: LIMIT_TYPE.MONTHLY, maxAmount: 50000000, asset: 'CNY',
    scopes: ['transfer'], label: '月度转账上限' },
  { id: 'daily-card', limitType: LIMIT_TYPE.DAILY, maxAmount: 3000000, asset: 'CNY',
    scopes: ['card'], label: '卡片日累计', activeTimeStart: '06:00', activeTimeEnd: '23:00' },
  { id: 'daily-small-value', limitType: LIMIT_TYPE.DAILY, maxAmount: 100000, asset: 'CNY',
    scopes: ['small-value'], label: '小额免密日累计' },
];

const toMin = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/** 时间窗：跨零点要能判（23:00–06:00 是收紧窗口，不是反着的）。 */
function inWindow(at, start, end) {
  if (!start || !end) return true;
  const cur = toMin(at.slice(11, 16)), s = toMin(start), e = toMin(end);
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}
const periodOf = (limitType, at) => limitType === LIMIT_TYPE.DAILY ? at.slice(0, 10)
  : limitType === LIMIT_TYPE.MONTHLY ? at.slice(0, 7)
  : limitType === LIMIT_TYPE.WEEKLY ? at.slice(0, 10)
  : null;

/** 这条限额管不管这个 scope，此刻生不生效。 */
export const applies = (limit, scope, at) =>
  limit.scopes.includes(scope) && inWindow(at, limit.activeTimeStart, limit.activeTimeEnd);

/** 周期内已用额度。PER_TRANSACTION 是纯函数，返回 0（Midaz 不建计数器）。 */
export function usedIn(state, limit, at) {
  if (limit.limitType === LIMIT_TYPE.PER_TRANSACTION) return 0;
  const key = periodOf(limit.limitType, at);
  return state.transactions
    .filter(t => t.amount < 0 && t.at && t.at.slice(0, key.length) === key)
    .filter(t => (t.method === 'transfer' ? 'transfer' : 'card') === (limit.scopes[0] === 'card' ? 'card' : limit.scopes[0]))
    .reduce((n, t) => n + -t.amount, 0);
}

/** 重置时刻（周期结束）。用户问「什么时候恢复」时要答得出。 */
export function resetAt(limit, at) {
  if (limit.limitType === LIMIT_TYPE.MONTHLY) { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10); }
  if (limit.limitType === LIMIT_TYPE.DAILY) { const d = new Date(at); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  return null;
}

/**
 * 校验一笔拟发起的交易。返回 { ok, limitId?, remaining?, resetAt?, reason?, blocked? }。
 * 只看限额，不看风险等级 —— 定级仍归 policy.js。
 */
export function checkLimits(state, { amount, scope = 'transfer', kind = 'transfer', at = bankNow() }) {
  for (const limit of ACCOUNT_LIMITS.filter(l => l.scopes.includes(scope))) {
    if (!applies(limit, scope, at)) {
      /* 时间窗外的限额不是「不存在」，而是**收紧到 0**：夜间非柜面直接不受理。 */
      return { ok: false, limitId: limit.id, blocked: limit.label + '在 ' + at.slice(11, 16) + ' 不在受理时段（' + limit.activeTimeStart + '–' + limit.activeTimeEnd + '）', reason: '超出限额生效时间窗' };
    }
    const perTx = limit.limitType === LIMIT_TYPE.PER_TRANSACTION;
    const used = usedIn(state, limit, at);
    const after = perTx ? amount : used + amount;
    const remaining = limit.maxAmount - used;
    if (after > limit.maxAmount) {
      return { ok: false, limitId: limit.id, remaining: Math.max(0, remaining), resetAt: resetAt(limit, at),
        blocked: limit.label + '：本次 ¥' + (amount / 100).toFixed(2) + (perTx ? '' : '（本期已用 ¥' + (used / 100).toFixed(2) + '）')
          + ' 超过 ¥' + (limit.maxAmount / 100).toFixed(2),
        reason: '超出' + limit.label };
    }
    if (!perTx && kind === 'transfer') state = { ...state };      // 无副作用，保持纯函数语义
  }
  const tight = ACCOUNT_LIMITS.filter(l => l.scopes.includes(scope)).map(l => ({ l, rem: l.maxAmount - usedIn(state, l, at) }))
    .sort((a, b) => a.rem - b.rem)[0];
  return { ok: true, limitId: tight.l.id, remaining: Math.max(0, tight.rem), resetAt: resetAt(tight.l, at) };
}

/** 限额面板要展示的东西：每一条的额度、已用、剩余、是否生效中。 */
export function limitBoard(state, at = bankNow()) {
  return ACCOUNT_LIMITS.map(l => {
    const used = usedIn(state, l, at);
    return { id: l.id, label: l.label, limitType: l.limitType, asset: l.asset,
      maxAmount: l.maxAmount, used, remaining: Math.max(0, l.maxAmount - used),
      active: applies(l, l.scopes[0], at), resetAt: resetAt(l, at),
      window: l.activeTimeStart ? l.activeTimeStart + '–' + l.activeTimeEnd : '全天' };
  });
}
