/**
 * agent/taskGraph.js —— 任务规划：把复杂请求拆成有序子任务 DAG
 * ============================================================================
 * 赛题原文：「复杂任务需拆解为有序的子任务 DAG（有向无环图）；执行过程中支持中断、回退和人工接管」
 *
 * 实现约定：
 *  · 节点只声明 **依赖**（dependsOn），顺序由拓扑决定 —— 不是写死的数组顺序。
 *    这样"回退到某一步"就是把它和它的下游一起重置，不需要特判。
 *  · 每个节点有 **status**，可被中断（`interrupted`）、回退（`rollback`）、
 *    转人工（`handoff`）。这三个是赛题点名的能力，所以是状态机的第一等公民。
 *  · 只读类节点（查询/校验）自动跑完；写类节点必须过 services/policy 的分级门禁。
 */

export const NODE = {
  PENDING: 'pending',
  RUNNING: 'running',
  DONE: 'done',
  BLOCKED: 'blocked',    // 策略层拦住了（缺槽位、超限、需验证）
  HUMAN: 'human',        // 转人工接管
  SKIPPED: 'skipped',
};

/** 拓扑排序：Kahn 算法。节点少，够用。 */
function topo(nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const indeg = new Map(nodes.map(n => [n.id, (n.dependsOn || []).length]));
  const queue = nodes.filter(n => indeg.get(n.id) === 0).map(n => n.id);
  const out = [];
  while (queue.length) {
    const id = queue.shift();
    out.push(id);
    for (const n of nodes) {
      if (!(n.dependsOn || []).includes(id)) continue;
      indeg.set(n.id, indeg.get(n.id) - 1);
      if (indeg.get(n.id) === 0) queue.push(n.id);
    }
  }
  /* 有环就是规划器写错了，直接暴露而不是静默 */
  if (out.length !== nodes.length) throw new Error('任务图有环，规划器有 bug');
  return out;
}

const node = (id, label, kind, dependsOn = [], extra = {}) => ({ id, label, kind, dependsOn, status: NODE.PENDING, ...extra });

/**
 * 为一次请求建图。
 * kind: 'read' 只读（自动跑） | 'write' 写操作（过策略门禁） | 'human' 必须人工
 */
export function buildTaskGraph({ action, slots = {} }, ctx = {}) {
  const contacts = ctx.contacts || [];
  const hit = slots.payeeHint ? contacts.find(c => c.name.includes(slots.payeeHint)) : null;
  const hasAmount = Boolean(slots.amountText);
  const hasDate = Boolean(slots.dateHint);

  /* ── 定时转账：赛题点名的复杂任务 ─────────────────────────────────── */
  if (action === 'transfer.scheduled' || (action === 'transfer' && hasDate)) {
    return {
      id: 'tg-scheduled',
      title: '定时转账：每月自动给' + (slots.payeeHint || '收款人') + '转房租',
      nodes: [
        node('parse',   '理解请求：定时转账 + 收款人 + 周期', 'read'),
        node('resolve', '确定收款人',                     'read',  ['parse']),
        node('amount',  '确认金额',                       'human', ['resolve'], { note: '金额缺失时必须问你，不猜' }),
        node('limit',   '校验限额与当日累计',              'read',  ['amount']),
        node('auth',    '身份验证',                       'write', ['limit'], { op: 'transfer.scheduled' }),
        node('book',    '创建预约任务',                    'write', ['auth']),
        node('remind',  '设置扣款前提醒',                  'write', ['book']),
        node('receipt', '生成预约回执',                    'write', ['remind']),
      ],
    };
  }

  /* ── AA 收款：一键拆给多个人 ──────────────────────────────────────── */
  if (action === 'transfer.aa') {
    return {
      id: 'tg-aa',
      title: 'AA 收款：把一笔消费拆给多个人',
      nodes: [
        node('parse',  '理解请求：AA 收款',        'read'),
        node('people', '确定参与人',              'human', ['parse'], { note: '参与人名单必须你确认，金额才拆得对' }),
        node('split',  '拆分金额',                'read',  ['people']),
        node('auth',   '身份验证',                'write', ['split'], { op: 'transfer.aa' }),
        node('send',   '发出收款请求',            'write', ['auth']),
        node('track',  '跟踪到账',                'write', ['send']),
      ],
    };
  }

  /* ── 月度账单报告：赛题要求的「月度账单报告」 ──────────────────────── */
  if (action === 'bills' || action === 'report') {
    return {
      id: 'tg-report',
      title: '月度账单报告',
      nodes: [
        node('parse',   '理解请求：要一份月度报告',   'read'),
        node('fetch',   '取本月流水',                'read',  ['parse']),
        node('classify','按类别归集',                'read',  ['fetch']),
        node('anomaly', '异常交易识别',              'read',  ['classify'], { note: '偏离历史均值 / 凌晨大额 / 首次出现的类别' }),
        node('compare', '与上月对比',                'read',  ['classify']),
        node('draft',   '生成报告与建议',            'read',  ['anomaly', 'compare']),
      ],
    };
  }

  /* ── 跨场景联动：赛题明确点名的差异化能力 ────────────────────────── */
  if (action === 'occasion') {
    return {
      id: 'tg-occasion',
      title: '跨场景联动：' + (slots.occasion || '特殊日子'),
      nodes: [
        node('parse',   '识别场景：' + (slots.occasion || '特殊日子'), 'read'),
        node('budget',  '看这个月还剩多少可支配',      'read',  ['parse']),
        node('suggest', '给建议（订蛋糕 / 买礼物 / 转账）', 'read', ['budget']),
        node('pick',    '你选一个',                    'human', ['suggest']),
        node('auth',    '按所选动作的风险等级验证',     'write', ['pick']),
        node('execute', '执行',                        'write', ['auth']),
      ],
    };
  }

  /* ── 默认：普通转账（小额 / 大额由策略层再分档）───────────────────── */
  const missing = !hasAmount || !hit;
  return {
    id: 'tg-transfer',
    title: '转账给' + (slots.payeeHint || '收款人'),
    nodes: [
      node('parse',   '理解请求',            'read'),
      node('resolve', '确定收款人',          'read',  ['parse'], { blocked: hit ? null : '收款人不在常用名录里，需要你确认' }),
      node('amount',  '确认金额',            'read',  ['resolve'], { blocked: hasAmount ? null : '金额缺失，需要你补' }),
      node('limit',   '校验限额与当日累计',   'read',  ['amount']),
      node('auth',    '按风险等级验证',       'write', ['limit'], { note: '小额只需确认；当日累计超 ¥1,000 需多因子' }),
      node('commit',  '记账',                'write', ['auth']),
      node('receipt', '出回执',              'write', ['commit']),
    ],
    needsInput: missing,
  };
}

/** 建好图后立刻定序；节点少，每次重算也不贵。 */
export function withOrder(graph) {
  return { ...graph, order: topo(graph.nodes) };
}

/* ── 执行控制：中断 / 回退 / 人工接管 ────────────────────────────────── */

export const advance = (g, id, status, extra = {}) => ({
  ...g,
  nodes: g.nodes.map(n => n.id === id ? { ...n, status, ...extra } : n),
});

/** 中断：把在跑的停下，其余保持。用户随时可以说「先别办了」。 */
export const interrupt = g => ({
  ...g,
  interrupted: true,
  nodes: g.nodes.map(n => n.status === NODE.RUNNING ? { ...n, status: NODE.PENDING } : n),
});

/** 回退：把该节点及其所有下游一起重置 —— 靠依赖图算，不写特判。 */
export const rollback = (g, id) => {
  const downstream = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of g.nodes) {
      if (downstream.has(n.id)) continue;
      if ((n.dependsOn || []).some(d => downstream.has(d))) { downstream.add(n.id); grew = true; }
    }
  }
  return {
    ...g,
    interrupted: false,
    nodes: g.nodes.map(n => downstream.has(n.id) ? { ...n, status: NODE.PENDING } : n),
  };
};

/** 人工接管：把控制权交给用户，Agent 停在原地不再自动推进。 */
export const handoff = (g, id, reason) => ({
  ...g,
  handoff: { id, reason, at: new Date().toLocaleTimeString('zh-CN', { hour12: false }) },
  nodes: g.nodes.map(n => n.id === id ? { ...n, status: NODE.HUMAN, note: reason } : n),
});

export const nextRunnable = g => {
  if (g.interrupted || g.handoff) return null;
  return g.nodes.find(n => n.status === NODE.PENDING && (n.dependsOn || []).every(d => {
    const dep = g.nodes.find(x => x.id === d);
    return dep && dep.status === NODE.DONE;
  })) || null;
};

export const progressOf = g => {
  const done = g.nodes.filter(n => n.status === NODE.DONE).length;
  const blocked = g.nodes.filter(n => n.status === NODE.BLOCKED).length;
  return { done, total: g.nodes.length, blocked, pct: Math.round(done / g.nodes.length * 100) };
};
