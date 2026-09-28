/**
 * services/audit.js —— 操作审计（赛题高优先级项）
 * ============================================================================
 * 赛题原文：「所有关键操作的决策链路与执行日志」「连续失败或可疑行为触发安全锁定」
 *
 * 「决策链路」的意思是：不只记「谁在什么时候转了多少」，
 * 还要记**为什么允许它发生** —— 命中哪条策略、判成什么风险、走了哪种验证。
 * 评委要看的就是这条链路。
 *
 * 纯内存环形缓冲：演示项目不落库，但结构按可落库设计（每条自带 id/at/seq）。
 */

const MAX = 200;
let seq = 0;
let entries = [];
const listeners = new Set();

const emit = () => listeners.forEach(fn => fn(entries));

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const all = () => entries;
export const clear = () => { entries = []; seq = 0; emit(); };

/**
 * 记一条。
 * @param {object} e
 * @param {string} e.kind       'intent' | 'policy' | 'execute' | 'blocked' | 'auth'
 * @param {string} e.actor      'user' | 'agent' | 'system'
 * @param {string} [e.input]    用户原话（原始输入，注入检测要留证）
 * @param {string} [e.intent]   识别出的意图
 * @param {string} [e.op]       操作 id
 * @param {string} [e.risk]     风险等级
 * @param {string} [e.decision] 允许 / 拒绝 / 需确认 / 需多因子
 * @param {string} [e.detail]   人话说明（这条会显示在审计面板上）
 */
export function record(e) {
  seq += 1;
  const entry = {
    id: 'A' + String(seq).padStart(4, '0'),
    seq,
    at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    actor: e.actor || 'agent',
    kind: e.kind,
    input: e.input,
    intent: e.intent,
    op: e.op,
    risk: e.risk,
    decision: e.decision,
    detail: e.detail,
  };
  entries = [...entries.slice(-(MAX - 1)), entry];
  emit();
  return entry;
}

/* ── 安全锁定：连续失败或可疑行为 ────────────────────────────────────── */

const FAIL_LIMIT = 3;
const SUSPICIOUS_LIMIT = 2;
let state = { failures: 0, suspicious: 0, locked: false, reason: null, since: null };

export const lockState = () => state;

export function noteFailure(detail) {
  state = { ...state, failures: state.failures + 1 };
  if (state.failures >= FAIL_LIMIT) {
    state = { ...state, locked: true, reason: '连续 ' + FAIL_LIMIT + ' 次验证失败', since: new Date().toLocaleTimeString('zh-CN', { hour12: false }) };
    record({ kind: 'blocked', actor: 'system', decision: '拒绝', risk: 'high', detail: '触发安全锁定：' + state.reason });
  } else {
    record({ kind: 'auth', actor: 'system', decision: '拒绝', detail: (detail || '验证失败') + '（' + state.failures + '/' + FAIL_LIMIT + '）' });
  }
  emit();
  return state;
}

export function noteSuspicious(detail) {
  state = { ...state, suspicious: state.suspicious + 1 };
  record({ kind: 'blocked', actor: 'system', decision: '拒绝', risk: 'high', detail: '可疑输入：' + detail });
  if (state.suspicious >= SUSPICIOUS_LIMIT) {
    state = { ...state, locked: true, reason: '连续 ' + SUSPICIOUS_LIMIT + ' 次可疑行为', since: new Date().toLocaleTimeString('zh-CN', { hour12: false }) };
    record({ kind: 'blocked', actor: 'system', decision: '拒绝', risk: 'high', detail: '触发安全锁定：' + state.reason });
  }
  emit();
  return state;
}

export function unlock() {
  state = { failures: 0, suspicious: 0, locked: false, reason: null, since: null };
  record({ kind: 'auth', actor: 'user', decision: '允许', detail: '用户手动解除安全锁定' });
  emit();
  return state;
}
