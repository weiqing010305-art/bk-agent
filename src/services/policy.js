/**
 * services/policy.js —— 权限分级（赛题高优先级项）
 * ============================================================================
 * 赛题原文：
 *   低风险 —— 余额/交易记录/账单分析/理财收益等纯查询，Agent 确认意图后**直接执行**，无需二次确认
 *   中风险 —— 小额转账（日累计 ≤1000 元）、订阅查询、虚拟卡申请等，**执行前展示操作详情并获得确认**
 *   高风险 —— 大额转账（>1000 元）、密码修改、挂失解挂、理财申购等，**须人脸识别/短信验证码/U盾多因子认证**
 *
 * 设计要点（这是能不能拿分的地方）：
 *  1. **风险等级不由调用方声明**，而是从操作类型 + 金额 + 当日累计推出来的。
 *     调用方说自己"低风险"不算数 —— 否则任何一段注入都能伪造降级。
 *  2. **策略层是唯一门禁**：页面、动作、Agent 三条路都必须过 assess()。
 *  3. 三级各自对应一种 UI：静默 / 详情确认 / 多因子。
 */

import { checkLimits } from './limits.js';

export const RISK = { low: 'low', LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

/** 中风险与高风险的分界：赛题写的是日累计 1000 元。 */
export const SMALL_TRANSFER_LIMIT = 100000; // 分
/** 单笔上限，超过直接拒绝而不是升级验证。 */
export const HARD_CAP = 5000000;           // ¥50,000.00

/**
 * 操作目录。**风险等级写在这里，不写在调用点。**
 * `verify` 是高风险时需要的验证方式；演示环境三种都可用。
 */
export const OPERATIONS = {
  'query.balance':      { label: '查询余额',     risk: RISK.LOW },
  'query.transactions': { label: '查询交易记录', risk: RISK.LOW },
  'query.bills':        { label: '账单分析',     risk: RISK.LOW },
  'query.wealth':       { label: '理财收益查询', risk: RISK.LOW },
  'query.subscriptions':{ label: '订阅查询',     risk: RISK.LOW },
  'query.recipients':   { label: '收款人查询',   risk: RISK.LOW },

  'transfer.small':     { label: '小额转账',     risk: RISK.MEDIUM },
  'transfer.scheduled': { label: '定时转账',     risk: RISK.MEDIUM },
  'transfer.aa':        { label: 'AA 收款',      risk: RISK.MEDIUM },
  'subscription.cancel':{ label: '取消订阅',     risk: RISK.MEDIUM },
  'card.freeze':        { label: '卡片冻结',     risk: RISK.MEDIUM },
  'card.unfreeze':      { label: '卡片解冻',     risk: RISK.MEDIUM },
  'card.apply-virtual': { label: '虚拟卡申请',   risk: RISK.MEDIUM },

  'transfer.large':     { label: '大额转账',     risk: RISK.HIGH },
  'card.limit':         { label: '额度调整',     risk: RISK.HIGH },
  'card.report-loss':   { label: '卡片挂失',     risk: RISK.HIGH },
  'card.unblock':       { label: '挂失解挂',     risk: RISK.HIGH },
  'password.change':    { label: '密码修改',     risk: RISK.HIGH },
  'wealth.purchase':    { label: '理财申购',     risk: RISK.HIGH },
  'wealth.redeem':      { label: '理财赎回',     risk: RISK.HIGH },
};

/** 高风险可用的验证方式。演示环境三种都能走通。 */
export const FACTORS = [
  { id: 'sms',   label: '短信验证码', hint: '向尾号 8826 发送 6 位验证码' },
  { id: 'face',  label: '人脸识别',   hint: '对准摄像头完成活体检测' },
  { id: 'token', label: 'U 盾',       hint: '插入 U 盾并输入口令' },
];

/**
 * 判定一个操作的风险等级。
 *
 * @param {object} req
 * @param {string} req.op        操作 id（必须在 OPERATIONS 里，未知一律按高风险处理）
 * @param {number} [req.amount]  金额（分）
 * @param {number} [req.todayTotal] 当日已转累计（分），由 ledger 提供，不由调用方声明
 * @returns {{level:string, requires:string[], reason:string, blocked?:string, limit?:number}}
 */
export function assess({ op, amount = 0, todayTotal = 0, state = null }) {
  const def = OPERATIONS[op];
  /* 未知操作不放行，也不降级 —— 白名单之外一律按最高风险处理 */
  if (!def) return { level: RISK.HIGH, requires: FACTORS.map(f => f.id), reason: '未知操作，按最高风险处理' };

  if (def.risk === RISK.LOW) return { level: RISK.LOW, requires: [], reason: def.label + '属于纯查询，确认意图后直接执行' };

  if (op === 'transfer.small' || op === 'transfer.large' || op === 'transfer.scheduled') {
    /* 账户限额先于风险分档。传了 state 就用可配置的限额对象（services/limits.js），
       没传就退回常量 —— 风险定级与账户限额是两件事，不能互相顶替：
       限额说「这笔能不能发」，分档说「发之前要验几道」。 */
    const cap = state ? checkLimits(state, { amount, scope: 'transfer' }) : (amount > HARD_CAP ? { ok: false, blocked: '单笔演示转账不能超过 ¥50,000.00' } : { ok: true });
    if (!cap.ok) return { level: RISK.HIGH, requires: [], blocked: cap.blocked, reason: cap.reason || '超出账户限额' };
    const after = todayTotal + amount;
    /* 关键判定：**按当日累计**，不是按单笔。分两笔 600 逃过 1000 门槛是不允许的。 */
    if (after > SMALL_TRANSFER_LIMIT) {
      return {
        level: RISK.HIGH,
        requires: FACTORS.map(f => f.id),
        reason: '本笔 ¥' + (amount / 100).toFixed(2) + ' 加上今日已转 ¥' + (todayTotal / 100).toFixed(2)
          + ' 达到 ¥' + (after / 100).toFixed(2) + '，超过日累计 ¥1,000.00，需多因子认证',
        limit: SMALL_TRANSFER_LIMIT,
      };
    }
    return { level: RISK.MEDIUM, requires: ['confirm'], reason: '小额转账，需展示操作详情并确认', limit: SMALL_TRANSFER_LIMIT };
  }

  if (def.risk === RISK.MEDIUM) return { level: RISK.MEDIUM, requires: ['confirm'], reason: def.label + '需展示操作详情并确认' };
  return { level: RISK.HIGH, requires: FACTORS.map(f => f.id), reason: def.label + '属高风险，需多因子认证' };
}

/** 三级各自的 UI 形态。页面按这个渲染，不再各自判断。 */
export const PRESENTATION = {
  [RISK.LOW]:    { confirm: false, factors: false, tone: 'positive', badge: '直接执行' },
  [RISK.MEDIUM]: { confirm: true,  factors: false, tone: 'warning',  badge: '需确认' },
  [RISK.HIGH]:   { confirm: true,  factors: true,  tone: 'negative', badge: '需多因子认证' },
};
