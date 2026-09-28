import { useCallback, useState } from 'react';
import { assess, SMALL_TRANSFER_LIMIT } from '../services/policy.js';
import { record as auditRecord, noteFailure, noteSuspicious, lockState, unlock } from '../services/audit.js';
import { screenInput } from '../services/guard.js';
import { DEMO_DATE } from '../services/banking.js';

/**
 * 安全与权限分级（赛题三个高优先级项里的两个）。
 *
 * 从 App.jsx 抽出来：它是一整块与 UI 无关的策略代码，而且 App 已经接近 300 行线。
 *
 * 三条不变量：
 *  1. **风险等级由操作类型 + 金额 + 当日累计推出**，调用方只能报「要做什么」，不能报「多危险」。
 *  2. **文本注入检测是第二层**。第一层是结构性白名单，绕过文本也伪造不了降级。
 *  3. **失败与可疑都会累计**，到阈值自动锁定，只能手动解除。
 */
export function useSecurity({ bank, setConfirm, setToast, yuan }) {
  const [auth, setAuth] = useState(null);
  const [lock, setLock] = useState(lockState);

  /** 当日已转累计 —— 赛题的分档依据是**日累计**而不是单笔，否则分两笔就能绕过。 */
  const todayTotal = useCallback(() => bank.transactions
    .filter(t => t.date === DEMO_DATE && t.category === '转账')
    .reduce((n, t) => n + Math.abs(t.amount), 0), [bank.transactions]);

  /** 门禁：低风险放行、中风险进确认、高风险进多因子。 */
  const gateDraft = useCallback(payload => {
    const total = todayTotal();
    const op = payload.amount > SMALL_TRANSFER_LIMIT ? 'transfer.large' : 'transfer.small';
    /* 把账本传给门禁：限额对象（services/limits.js）先判这笔能不能发，风险等级再判要验几道 */
    const verdict = assess({ op, amount: payload.amount, todayTotal: total, state: bank });
    auditRecord({
      kind: 'policy', actor: 'agent', op, risk: verdict.level,
      decision: verdict.blocked ? '拒绝' : verdict.level === 'high' ? '需多因子' : '需确认',
      detail: verdict.reason + '（今日已转 ¥' + (total / 100).toFixed(2) + '）',
    });
    if (verdict.blocked) { setToast(verdict.blocked); return; }
    if (verdict.level === 'high') {
      setAuth({ verdict, payload, op, label: '转账给 ' + payload.recipientName, amountText: yuan(payload.amount) });
      return;
    }
    setConfirm(payload);
  }, [bank, todayTotal, setConfirm, setToast, yuan]);

  /** 入口筛查。返回判定，由调用方决定怎么呈现被拦下的那一条。 */
  const screen = useCallback(text => {
    const r = screenInput(text);
    if (r.ok) return r;
    auditRecord({ kind: 'blocked', actor: 'agent', input: text, decision: '拒绝', risk: 'high', detail: r.reason });
    setLock(noteSuspicious(r.matched));
    return r;
  }, []);

  const passAuth = useCallback(method => {
    if (!auth) return;
    auditRecord({ kind: 'auth', actor: 'user', op: auth.op, risk: 'high', decision: '允许', detail: '多因子认证通过（' + method + '）' });
    const payload = auth.payload;
    setAuth(null);
    setConfirm(null);
    return payload;
  }, [auth]);

  const failAuth = useCallback(msg => setLock(noteFailure(msg)), []);
  const doUnlock = useCallback(() => setLock(unlock()), []);
  const closeAuth = useCallback(() => setAuth(null), []);

  return { auth, lock, gateDraft, screen, passAuth, failAuth, doUnlock, closeAuth };
}
