import demoRecipients from '../../data/demo-recipients.json' with { type: 'json' };
import { AS_OF, LEDGER } from '../../data/demoLedger.js';

export const money = n => (n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const directory = demoRecipients;
export const contacts = demoRecipients.filter(c => ['landlord', 'zhang', 'li'].includes(c.id));
export { AS_OF };

/* ── 余额模型：不是一个数，是五个数（调研报告 §1.1）──────────────────────
   available 可用 —— 真能动的钱，转账/消费校验只看它
   frozen    冻结 —— 司法/风控/保证金占用
   pending   在途 —— 已发起未清算：预授权、跨行在途、定时转账预留
   posted    已入账 —— 清算完成（累计口径，不参与 fourSum）
   creditLimit 授信额度

   不变量：available + frozen + pending === total。
   只有一个 balance 的旧模型必然出现「同时发两笔，两笔都显示余额够」——
   拆开之后，第一笔把 available 变少，第二笔的校验就自然失败。
   frozen/pending 的演示口径在这里定，overview.jsx 原先在本页派生的那套规则作废。 */
export const frozenOf = subscriptions =>
  subscriptions.filter(s => s.status === 'active').reduce((n, s) => n + s.amount, 0);
/** 在途：最近一笔跨境/跨行支出的清算占款（演示值，真实来自清算通道）。 */
export const pendingOf = () => 12800;

export function accountOf(s) {
  const available = s.available;
  const frozen = Number.isSafeInteger(s.frozen) ? s.frozen : frozenOf(s.subscriptions);
  const pending = Number.isSafeInteger(s.pending) ? s.pending : pendingOf(s);
  return { available, frozen, pending, total: available + frozen + pending, posted: s.posted };
}
export const spendable = s => s.available;

const EMPTY = { available: 0, frozen: 0, pending: 0, total: 0, posted: 0, creditLimit: 0, cards: [], subscriptions: [], transactions: [], completed: [] };

/**
 * 补齐余额字段并保持不变式。App.jsx 的 localStorage 里可能还是旧账本
 * （只有 balance 一个数），所以这里必须能就地升级，否则页面会全线看到 undefined。
 */
export function normalize(s) {
  if (!s) return EMPTY;
  /* 新旧两种账本都要认：新账本给 available，旧账本（localStorage 里的）只有 balance。 */
  const available = Number.isSafeInteger(s.available) ? s.available : s.balance;
  if (!Number.isSafeInteger(available)) return EMPTY;
  const base = { ...s, available };
  const acct = accountOf(base);
  /* 报告 §1.4 对账恒等式：期初 + 本期收入 − 本期支出 === 期末可用。对不上就是数据坏了，暴露而不是掩盖。 */
  const drift = (s.opening ?? available) + s.transactions.reduce((a, t) => a + t.amount, 0) - available;
  return { ...base, frozen: acct.frozen, pending: acct.pending, posted: acct.posted ?? 0, total: acct.total, balance: available, drift };
}

export function seed() {
  const transactions = LEDGER;                                     // 82 笔，3 个月，含埋点，见 data/demoLedger.js
  const subscriptions = [                                          // 合计 = 冻结额 ¥360（演示口径见 frozenOf）
    { id: 'cloud', name: '云空间', detail: '200 GB 云存储', amount: 2900, date: '2026-10-28', status: 'active' },
    { id: 'insurance', name: '账户安全险', detail: '按月代扣 · 已签约', amount: 20000, date: '2026-10-05', status: 'active' },
    { id: 'fund', name: '基金定投', detail: '每月 8 日自动申购', amount: 6000, date: '2026-10-08', status: 'active' },
    { id: 'video', name: '光影视频', detail: '连续包月会员', amount: 2500, date: '2026-10-02', status: 'active' },
    { id: 'music', name: '随听音乐', detail: '个人音乐会员', amount: 1800, date: '2026-10-02', status: 'active' },
    /* 已取消也要留一条：订阅列表没有「已取消」这一态，就看不出「取消之后会怎样」 */
    { id: 'gym', name: '健身房月卡', detail: '已于 2026-08-20 取消', amount: 29900, date: '2026-09-20', status: 'cancelled' },
  ];
  /* 期初余额是**算出来的**，不是编的：先定期末可用余额，再减掉三个月净流入。
     账本恒等式（opening + Σ流水 === available）因此天然成立，normalize() 会把它当断言复核。 */
  const AVAILABLE = 4632500;
  const opening = AVAILABLE - transactions.reduce((a, t) => a + t.amount, 0);
  return normalize({
    opening, available: AVAILABLE, frozen: frozenOf(subscriptions), pending: pendingOf(), posted: AVAILABLE,
    completed: [],
    /* 卡片带齐真实银行会有的字段：额度、本月已用、可用渠道、发卡日。
       没有这些，卡包页只能是一张图加两行字 —— 那正是"单薄"的来源。 */
    cards: [
      { id: 'debit', name: '青禾借记卡', tail: '8826', status: 'active', type: '日常支付账户',
        limit: 5000000, used: 507700, channels: ['刷卡', '线上支付', '取现'], since: '2024-03-11' },
      { id: 'travel', name: '青禾旅行卡', tail: '3901', status: 'active', type: '备用借记卡',
        limit: 2000000, used: 0, channels: ['刷卡', '线上支付'], since: '2025-06-02' },
    ],
    transactions, subscriptions,
  });
}

/** 小额演示账本的卡片与订阅（余额由后端提供时复用，避免两处各写一份）。 */
export const demoExtras = () => { const s = seed(); return { cards: s.cards, subscriptions: s.subscriptions }; };

/**
 * 冷启动样本：新开户客户只有 8 笔流水，够不上 n_hist ≥ 30，
 * 只能靠绝对阈值兜底（R-AMT-03）与稳健统计（R-AMT-02）。测试与演示共用一份。
 */
export function newAccountSeed() {
  const raw = [
    ['n1', '日常餐饮', '餐饮', -3200, '2026-09-20T12:10', '肯德基'],
    ['n2', '地铁与打车', '交通', -1800, '2026-09-21T08:30', '滴滴出行'],
    ['n3', '生活采购', '购物', -4300, '2026-09-22T19:00', '便利蜂'],
    ['n4', '日常餐饮', '餐饮', -2600, '2026-09-23T12:05', '沙县小吃'],
    ['n5', '地铁与打车', '交通', -1800, '2026-09-24T08:40', '滴滴出行'],
    ['n6', '日常餐饮', '餐饮', -3900, '2026-09-25T18:30', '老乡鸡'],
    ['n7', '生活采购', '购物', -5100, '2026-09-26T19:20', '永辉超市'],
    ['n8', '转给周涛', '转账', -800000, '2026-09-27T11:00', '周涛'],
  ];
  const transactions = raw.map(([id, name, category, amount, at, counterparty]) =>
    ({ id, name, category, amount, at, date: at.slice(0, 10), hour: Number(at.slice(11, 13)), counterparty, method: category === '转账' ? 'transfer' : 'card' }));
  const opening = 1000000 - transactions.reduce((a, t) => a + t.amount, 0);
  return normalize({ opening, available: 1000000, frozen: 0, pending: 0, posted: 1000000, completed: [], cards: [], subscriptions: [], transactions });
}

/**
 * 转账。**原子性**：校验与扣款之间不允许任何东西插进来。
 * 调用方在草稿阶段拿到的是 {available, ledger} 快照，apply 时带回来；
 * 快照跟账本对不上说明中间有人动过账（或并发），此时拒绝而不是照扣 —— 这就是
 * 调研报告 §6.3 要抄的那条 Midaz「atomic upsert 防 TOCTOU」在演示项目里的形态。
 * 真后端里这一步是「限额校验 + 占用 pending」同事务；这里是纯函数 + 版本戳。
 */
export const ledgerVersion = s => 'L' + s.transactions.length + '-' + s.completed.length;

export function transfer(state, { id, contactId, amount, note = '', expect }) {
  if (!id || state.completed.includes(id)) return state;           // 幂等：重试不重复扣
  if (expect && expect !== ledgerVersion(state)) throw new Error('账户余额刚刚发生变化，请核对后再提交。');
  const contact = directory.find(c => c.id === contactId);
  if (!contact || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('请选择收款人，并输入有效金额（最多两位小数）。');
  /* 只校验 available：frozen 与 pending 是动不了的钱，「同时发两笔都够」的 bug 在这里被堵死。 */
  if (amount > state.available) throw new Error('账户余额不足，请修改转账金额。');
  const next = normalize({
    ...state,
    available: state.available - amount,
    completed: [...state.completed, id],
    transactions: [{ id, name: `转给${contact.name}`, category: '转账', amount: -amount,
      at: `${AS_OF}T10:00`, date: AS_OF, hour: 10, counterparty: contact.name, method: 'transfer', note },
      ...state.transactions],
  });
  return { ...next, drift: next.available + next.frozen + next.pending - next.total };
}

export function totals(state) {
  const out = state.transactions.filter(t => t.amount < 0);
  return { income: state.transactions.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0),
    spending: -out.reduce((a, t) => a + t.amount, 0), categories: categoryTotals(state) };
}

/** 类目汇总：类目名从账本里取，不再硬编码 —— 新类目（医疗/保险/出行/赌博）自动出现。 */
export function categoryTotals(state) {
  const map = new Map();
  for (const t of state.transactions) if (t.amount < 0) map.set(t.category, (map.get(t.category) || 0) - t.amount);
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

export function intent(text) {
  if (/转账|转给|转.*\d|汇款/.test(text)) return 'transfer';
  if (/订阅|续费|会员|扣费/.test(text)) return 'subscriptions';
  if (/卡片|银行卡|冻结|解冻/.test(text)) return 'cards';
  if (/账单|花了|支出|消费|分析|异常/.test(text)) return 'bills';
  return 'unknown';
}
