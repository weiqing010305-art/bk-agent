/**
 * services/anomaly.js —— 异常交易识别引擎（规则 → 评分 → 分档 → 误报抑制）
 * ============================================================================
 * 调研报告 §4：赛题要的是**可判定、可解释、可审计**，规则引擎三条都满足。
 * 每一条命中都输出 { ruleId, weight, evidence } —— 这天然就是赛题的「决策链路审计」：
 * 评委问「为什么标记这一笔」，答案不是「模型觉得像」，而是「命中 R-AMT-01，
 * 该笔偏离同类目 3σ 达 18.4σ，同类目 33 笔基线中位数 ¥400」。
 *
 * 分层（缺任何一层规则引擎都不可用）：
 *   规则命中（anomalyRules.js）→ 评分合成（报告 §4.4）→ 分档处置 → 误报抑制（报告 §4.5）
 */

import {
  RULES, WHITELIST, SCENE_FACTOR, HARD_REJECT_WEIGHT, UNIMPLEMENTED,
  Y, HIST_DAYS, MERCHANT_DAYS, WINDOW_MIN, dayOf, minutes, daysBetween, hourOf, median, percentile,
} from './anomalyRules.js';

export { RULES, WHITELIST, HIGH_RISK, SCENE_FACTOR, HARD_REJECT_WEIGHT, UNIMPLEMENTED, median, percentile } from './anomalyRules.js';

/** 误报抑制的参数（报告 §4.5）。 */
export const SUPPRESSION = { confirmPerDay: 2, decayDays: 7, feedbackDays: 90, feedbackFactor: 0.7 };
const CONFIRM_PER_DAY = SUPPRESSION.confirmPerDay;
const DECAY_DAYS = SUPPRESSION.decayDays;

/* ── 上下文：每笔交易都要的公共统计，算一次 ─────────────────────────────── */
function contextOf(tx, need, all, opts) {
  const t = minutes(tx);
  const prior = all.filter(o => minutes(o) < t);
  const hist90Tx = prior.filter(o => o.amount < 0 && o.category === tx.category && t - minutes(o) <= HIST_DAYS * 1440);
  /* 统计量要的是金额（正数、分），不是交易对象 —— 契约写在 anomalyRules.js 顶部。 */
  const hist90 = hist90Tx.map(o => -o.amount);
  const day = dayOf(tx);
  const last30 = prior.filter(o => o.amount < 0 && t - minutes(o) <= 30 * 1440);
  /* 「当日」＝本笔所在的那一天，不是系统当前日期 —— 演示账本是历史数据。 */
  const todayCount = all.filter(o => o.amount < 0 && dayOf(o) === day).length;
  const nightOf = xs => xs.filter(o => { const h = hourOf(o); return h >= 23 || h < 6; }).length;
  return {
    need, prior,
    window: need,
    merchants180: prior.filter(o => t - minutes(o) <= MERCHANT_DAYS * 1440),
    hist90, n: hist90.length, hist90Tx,
    avgDaily: Math.max(0.5, last30.length / 30),
    todayCount,
    nightRatio: prior.length ? nightOf(prior) / prior.length : 0,
    feedback: opts.feedback || {},
  };
}

/** 同一个 cluster 是一次「分裂的行为」，只出一条告警。 */
const clusterKey = tx => tx.cluster || tx.id;

/**
 * 检测。返回 { hits, suppressions, evaluations }。
 * @param {Array} transactions 待检交易（含要看的与历史）
 * @param {object} opts
 * @param {Array<string>} opts.evaluate 只评这些 id（默认评全部，历史即基线）
 * @param {object} opts.feedback 用户反馈降权表 { 'ruleId:对手方': { until: 'YYYY-MM-DD' } }
 */
export function detectAnomalies(transactions, opts = {}) {
  const all = [...transactions];
  const need = opts.evaluate ? all.filter(t => opts.evaluate.includes(t.id)) : all;
  const hits = [], suppressions = [];

  for (const tx of need) {
    const ctx = contextOf(tx, need, all, opts);
    for (const rule of RULES) {
      const r = rule.each(tx, ctx);
      if (!r) continue;
      /* 白名单对手方（报告 §4.5）：雇主代发/本人同名/已签约代扣 —— 命中即不告警，且要留痕。 */
      const payee = tx.counterparty || '';
      if (WHITELIST.some(p => p.test(payee))) {
        suppressions.push({ txId: tx.id, ruleId: rule.id, reason: '白名单对手方（雇主代发/本人同名/已签约代扣）' });
        continue;
      }
      const fb = ctx.feedback[rule.id + ':' + payee];
      const decayed = Boolean(fb && fb.until >= dayOf(tx));
      const w = decayed ? Math.round(rule.weight * SUPPRESSION.feedbackFactor) : rule.weight;
      hits.push({ txId: tx.id + ':' + rule.id, id: tx.id, ruleId: rule.id, label: rule.label, weight: w,
        baseWeight: rule.weight, action: rule.action, category: tx.category, amount: tx.amount,
        counterparty: payee, at: tx.at, method: tx.method || 'card', day: dayOf(tx),
        groupKey: rule.cluster ? rule.id + ':' + (r.group || clusterKey(tx)) : null,
        evidence: r.evidence + (decayed ? '（用户曾确认本人操作，本规则降权 30%）' : '') });
    }
  }

  /* 合并「同一笔分裂」：R-FREQ-02 / R-AMT-05 里同一个 cluster 是一个行为，只出一条告警。 */
  const merged = [];
  for (const h of hits) {
    if (!h.groupKey) { merged.push(h); continue; }
    const dup = merged.find(m => m.groupKey === h.groupKey);
    if (dup) {
      dup.group = [...(dup.group || [dup.txId]), h.txId];
      dup.evidence = dup.evidence + '（同类行为共 ' + dup.group.length + ' 笔，合并为一条告警）';
      continue;
    }
    merged.push(h);
  }
  return { hits: merged, suppressions, evaluations: need.length };
}

/* ── 评分合成与分档处置（报告 §4.4，逐字实现）─────────────────────────── */
export function scoreAnomaly(hit, scene) {
  const h = hit.method === 'transfer' ? 'transfer' : scene === 'debit' ? 'debit' : 'card';
  const score = Math.min(100, Math.round(hit.weight * (SCENE_FACTOR[h] ?? 1)));
  return { score, factor: SCENE_FACTOR[h] ?? 1 };
}

/** 分档处置：0–39 放行 / 40–69 二次确认 / 70–89 人工复核 / ≥90 拒绝。 */
export const dispositionOf = score => score >= 90 ? 'reject' : score >= 70 ? 'review' : score >= 40 ? 'confirm' : 'pass';

export const DISPOSITION_TEXT = {
  pass: '放行',
  confirm: '这笔交易和您平时的习惯不太一样，确认是您本人操作吗？',
  review: '为保护您的资金安全，需要人工复核（或人脸核验）后才能继续。',
  reject: '本次操作已被拦截，请拨打客服热线核实。',
};

/**
 * 处置一条命中：先看硬拒绝规则（权重 ≥55：R-FREQ-02 / R-MER-02 不参与分数合成），
 * 再走评分 → 分档。返回的东西可以直接进审计层（audit.record 的 detail）。
 */
export function dispose(hit) {
  if (hit.baseWeight >= HARD_REJECT_WEIGHT) {
    return { ruleId: hit.ruleId, txId: hit.txId, score: 100, action: hit.action, disposition: 'reject',
      freezeCard: hit.ruleId === 'R-FREQ-02', text: DISPOSITION_TEXT.reject, evidence: hit.evidence, hardReject: true };
  }
  const { score, factor } = scoreAnomaly(hit);
  const d = dispositionOf(score);
  return { ruleId: hit.ruleId, txId: hit.txId, score, factor, action: hit.action, disposition: d,
    text: DISPOSITION_TEXT[d], evidence: hit.evidence };
}

/** 汇总一条交易的全部命中：总分、档位、证据清单。 */
export function assessTransaction(transaction, hits) {
  const mine = hits.filter(h => h.id === transaction.id);
  const items = mine.map(dispose);
  if (!items.length) return { txId: transaction.id, score: 0, disposition: 'pass', items: [], evidence: [] };
  const hard = items.find(i => i.hardReject);
  if (hard) return { txId: transaction.id, score: 100, disposition: 'reject', items, evidence: [hard.evidence], hardReject: true };
  const score = Math.min(100, items.reduce((a, i) => a + i.score, 0));
  return { txId: transaction.id, score, disposition: dispositionOf(score), items, evidence: items.map(i => i.evidence) };
}

/* ── 误报抑制（报告 §4.5）────────────────────────────────────────────────
   没有这一层，规则引擎第一天就会把用户逼疯。四条机制：
     1. 白名单对手方 —— 在 detectAnomalies 里就地剔除并留痕
     2. 时间衰减 —— 同规则 7 天内不重复告警（硬拒绝规则除外）
     3. 频率上限 —— 每天最多 2 次二次确认，超出转人工复核（防确认疲劳）
     4. 用户反馈闭环 —— 「这是我本人」→ 该规则对该对手方降权 30%，持续 90 天
*/
export function suppress(hits, opts = {}) {
  const kept = [], dropped = [...(opts.suppressions || [])];
  const seen = new Map();
  for (const h of [...hits].sort((a, b) => (a.day + a.at).localeCompare(b.day + b.at))) {
    const key = h.ruleId + ':' + (h.counterparty || '');
    const last = seen.get(key);
    if (last && !(h.baseWeight >= HARD_REJECT_WEIGHT) && daysBetween(h.day, last) < DECAY_DAYS) {
      dropped.push({ txId: h.txId, ruleId: h.ruleId, reason: `时间衰减：${h.ruleId} 对「${h.counterparty}」在 ${DECAY_DAYS} 天内已告警过（${last}）` });
      continue;
    }
    seen.set(key, h.day);
    kept.push(h);
  }
  /* 长窗口规则的「同一件事」去重：R-ACCT-01 的观察窗是 180 天，
     一段静默期若不做去重，静默期后的每一笔活跃都会被报一次。只留最严重的一条。 */
  const longWindow = { 'R-ACCT-01': 180 };
  for (const [ruleId, days] of Object.entries(longWindow)) {
    const hits = kept.filter(h => h.ruleId === ruleId).sort((a, b) => a.at.localeCompare(b.at));
    for (let i = 0; i < hits.length; i += 1) {
      if (hits[i].suppress) continue;
      for (let j = i + 1; j < hits.length; j += 1) {
        if (daysBetween(hits[j].day, hits[i].day) > days) break;
        if (hits[j].suppress) continue;
        hits[j].suppress = true;
        dropped.push({ txId: hits[j].txId, ruleId, reason: `同一段静默期已告警过（${hits[i].day}），${days} 天内不重复打扰` });
      }
    }
  }
  /* 频率上限：按分数从高到低取前 2 条确认为止，其余转人工复核 */
  const byDay = new Map();
  const alerts = [];
  /* 告警的分档要用**整笔交易**的合成分数，不是单条规则的分数 ——
     否则「决策层说需确认、告警层说放行」两边会打架（同一笔交易各算各的）。
     两条路径现在都走 assessTransaction。 */
  const byTx = new Map();
  for (const h of kept.filter(h => !h.suppress)) (byTx.get(h.id) || byTx.set(h.id, []).get(h.id)).push(h);
  for (const [id, group] of byTx) {
    const verdict = assessTransaction({ id }, group);
    const list = byDay.get(group[0].day) || [];
    /* 单条告警保留自己的分数与档位（它解释的是「这条规则为什么响」）；
       整笔交易的合成分数另存 txScore，供分档上限与汇总使用。 */
    /* 一笔交易问用户几次是**一笔一次**：档位取该笔的合成分级（txScore），
       行内仍保留命中它的每条规则与各自权重（那是证据，不是档位）。 */
    for (const h of group) list.push({
      ...h, ...dispose(h), score: verdict.score, disposition: verdict.disposition,
      txScore: verdict.score, txDisposition: verdict.disposition, txEvidence: verdict.evidence,
    });
    byDay.set(group[0].day, list);
  }
  for (const [day, list] of byDay) {
    /* 每天最多放行 CONFIRM_PER_DAY 笔「待确认」，按合成分数从高到低取；其余整笔降级为人工复核。 */
    const quota = new Set([...new Set(list.filter(h => h.disposition === 'confirm').map(h => h.id))]
      .map(id => list.find(h => h.id === id))
      .sort((a, b) => b.txScore - a.txScore)
      .slice(0, CONFIRM_PER_DAY).map(h => h.id));
    for (const h of list) {
      if (h.disposition === 'confirm' && !quota.has(h.id)) {
        alerts.push({ ...h, disposition: 'review', downgraded: true,
          text: DISPOSITION_TEXT.review,
          evidence: h.evidence + `；${day} 当日二次确认已达 ${CONFIRM_PER_DAY} 次，按「确认疲劳」上限转为人工复核` });
        dropped.push({ txId: h.txId, ruleId: h.ruleId, reason: `频率上限：${day} 当日二次确认已达 ${CONFIRM_PER_DAY} 次，转人工复核` });
        continue;
      }
      /* 分数 <40 是「放行」，不进告警列表 —— 但 hits 里仍然保留：审计要能看见「看过但没报」。 */
      if (h.disposition !== 'pass') alerts.push(h);
    }
  }
  return {
    alerts: alerts.sort((a, b) => b.txScore - a.txScore || b.score - a.score || a.txId.localeCompare(b.txId)),
    txCount: new Set(alerts.map(a => a.id)).size,
    dropped,
    byLevel: ['reject', 'review', 'confirm', 'pass'].map(d => ({ disposition: d, count: alerts.filter(a => a.disposition === d).length })),
  };
}

/** 一站式：账单报告里那一步（taskGraph 的 anomaly 节点）调这一个就够。 */
export function analyze(transactions, opts = {}) {
  const { hits, suppressions, evaluations } = detectAnomalies(transactions, opts);
  const suppressed = suppress(hits, { suppressions, ...opts });
  return { ...suppressed, hits, evaluations };
}