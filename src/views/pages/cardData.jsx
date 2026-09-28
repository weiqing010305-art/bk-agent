import { money } from '../../domain/bank.js';

/**
 * 卡片页的演示数据与「账本 → 视图」的合并。
 *
 * ⚠️ 为什么扩展字段不写进 domain/bank.js：
 *   bank.js 是跨页面契约（概览、重置、持久化都按它写）。本文件负责把卡包页需要的
 *   「账期 / 卡组织 / 渠道日限额 / 状态历史」在**首次进入本页时补进账本**（见 enrich），
 *   之后这些字段和 status 一样由账本保存，页面只读不另存一份。
 *
 * ⚠️ 全部是静态演示值。基准日写死（TODAY），不跟随系统日期，
 *   否则跨月再跑 e2e，账期进度与「本期小结」就会变样。
 * ⚠️ 金额单位一律是**分**，与 bank.js 的 money() 对齐。
 */

/** 演示基准日，与 bank.js 样例流水同一时间轴。 */
export const TODAY = new Date(2026, 8, 26);

const ch = (id, label, perTxn, dayLimit, dayUsed) => ({ id, label, perTxn, dayLimit, dayUsed, on: true });
const CH = (a, b, c, d) => [
  ch('pos',    '境内刷卡', ...a), ch('online', '线上支付', ...b),
  ch('abroad', '境外支付', ...c), ch('cash',   '取现',     ...d),
];

/**
 * 每张卡的档案模板：额度、账期、开卡日、渠道、限额、开卡至今的状态历史。
 * 这是「写入账本」的那一份演示数据（domain 的 seed() 只发两张卡，这里补齐第三张）。
 * ⚠️ 金额单位是**分**，与 domain/bank.js 的既有约定一致 —— 元制会让概览的
 *    「本月已用 ¥5,077.00」显示成 ¥50.77，而概览不在本页可改范围内。
 */
export const TEMPLATE = {
  debit: {
    name: '青禾借记卡', tail: '8826', type: '日常支付账户', since: '2024-03-11',
    limit: 5000000, used: 507700, org: '银联', tone: 'debit',
    profile: { kind: '借记卡', linked: '青禾日常账户 •• 8826', billDay: 25, dueOffset: 10,
               lastBill: 512400, lastPaid: '2026-09-04', autoPay: true },
    limits: [30000, 2000000, 5000000],
    channels: CH([2000000, 5000000, 1846000], [1000000, 2000000, 623000],
                 [500000, 1000000, 0],        [500000, 1000000, 200000]),
    history: [
      ['2024-03-11', '开卡', '日常账户开户时同步配发'],
      ['2024-03-14', '首次激活', '通过手机银行完成人脸核身'],
      ['2025-09-01', '限额提升', '单笔限额由 1 万元调整为 2 万元'],
      ['2026-08-14', '形态变更', '同号换卡，新卡已寄出并激活'],
    ],
  },
  credit: {
    name: '青禾信用卡', tail: '6642', type: '银联信用卡', since: '2025-11-20',
    limit: 3000000, used: 448600, org: '银联', tone: 'credit',
    profile: { kind: '信用卡', linked: '青禾日常账户 •• 8826', billDay: 8, dueOffset: 18,
               lastBill: 452000, lastPaid: '2026-09-26', autoPay: false },
    limits: [0, 1000000, 3000000],
    channels: CH([1000000, 3000000, 312000], [500000, 2000000, 158000],
                 [300000, 1000000, 0],        [200000, 500000, 0]),
    history: [
      ['2025-11-20', '开卡', '受邀发卡，首年免年费'],
      ['2025-11-22', '首次激活', '收到实体卡后在线激活'],
      ['2026-06-18', '免密小额关闭', '线上支付改为需验密'],
      ['2026-08-20', '额度调整', '总额度由 2 万元调整为 3 万元'],
    ],
  },
  travel: {
    name: '青禾旅行卡', tail: '3901', type: '多币种借记卡', since: '2025-06-02',
    limit: 2000000, used: 0, org: 'VISA', tone: 'travel',
    profile: { kind: '多币种借记卡', linked: '青禾美元账户 •• 4417', billDay: 30, dueOffset: 0,
               lastBill: 0, lastPaid: '2026-09-09', autoPay: false },
    limits: [0, 1000000, 2000000],
    channels: CH([1000000, 2000000, 0],        [500000, 1000000, 43000],
                 [1000000, 2000000, 168000],   [300000, 1000000, 0]),
    history: [
      ['2025-06-02', '开卡', '与留学服务一同配发'],
      ['2025-06-05', '首次激活', '线上激活，同时开通境外支付'],
      ['2026-02-02', '境外支付开启', '用于留学缴费，单笔上限 1 万元'],
      ['2026-07-30', '币种变更', '新增日元子账户，当地直接扣账'],
    ],
  },
};
export const TEMPLATE_FALLBACK = TEMPLATE.debit;

/** '2026-09-26' → 20260926，只用于排序（绕开本地化排序规则，见 buildCards） */
const day = s => Number(s.replace(/-/g, ''));
const hist = rows => rows.map(([date, title, note]) => ({ date, title, note }));

/**
 * 账本里这张卡是否已经补齐档案。
 * ⚠️ 不能只判断 truthy：domain 的 seed() 就给了一张**字符串数组**的 channels
 * （['刷卡', '线上支付', '取现']），只判存在会把它当成已补齐，开关和限额全部读空。
 * 所以这里按形状判：渠道必须是带 id 的对象数组。
 */
export const isHydrated = c => Boolean(
  c.profile && typeof c.profile.billDay === 'number' && typeof c.profile.kind === 'string' &&
  Array.isArray(c.limits) && c.limits.length === 3 &&
  Array.isArray(c.channels) && c.channels.length === 4 && c.channels.every(x => x && typeof x === 'object' && typeof x.id === 'string') &&
  Array.isArray(c.history) && c.history.every(x => x && x.date && x.title),
);

/** 一个卡位是否已经在账本里。 */
export const missingTemplates = cards => Object.keys(TEMPLATE).filter(id => !cards.some(c => c.id === id));

/**
 * 把账本里的卡片补成「一份演示账本」：domain 的 seed() 只发两张卡，
 * 这里补齐第三张，并给每张卡补上完整档案。返回值交给 ctx.setBank 写回账本。
 * 只在卡位缺失或字段缺失时调用 —— 已经补过的卡原样保留，用户改过的状态不会被覆盖。
 */
export function enrich(cards) {
  return Object.entries(TEMPLATE).map(([id, t]) => {
    const c = cards.find(x => x.id === id) || {};
    return {
      ...c,
      id, name: c.name || t.name, tail: c.tail || t.tail,
      status: c.status || 'active', type: c.type || t.type, since: c.since || t.since,
      limit: t.limit, used: t.used,
      org: c.org || t.org, tone: c.tone || t.tone,
      /* 已经补齐过的卡原样保留（用户改过的开关、限额、历史不能被覆盖），
         只补 seed() 那种「字符串数组 channels」的半成品。 */
      profile: (c.profile && c.profile.billDay) ? c.profile : t.profile,
      limits: isHydrated(c) ? c.limits : t.limits,
      channels: isHydrated(c) ? c.channels : t.channels,
      history: (Array.isArray(c.history) && c.history.length) ? c.history : hist(t.history),
    };
  });
}

/** 这张卡自己的动账明细：演示流水明确挂在校验过的卡 id 上，不再拿全局流水糊。 */
export const FEED = {
  debit: [
    { id: 'd1',  name: '九月工资',   category: '收入', amount: 1500000,  date: '09-10', note: '青禾科技' },
    { id: 'd2',  name: '房租',       category: '转账', amount: -300000,  date: '09-12', note: '每月自动扣' },
    { id: 'd3',  name: '日常餐饮',   category: '餐饮', amount: -85600,   date: '09-24' },
    { id: 'd4',  name: '生活采购',   category: '购物', amount: -62800,   date: '09-23' },
    { id: 'd5',  name: '地铁与打车', category: '交通', amount: -18600,   date: '09-22' },
    { id: 'd6',  name: '星巴克咖啡', category: '餐饮', amount: -4200,    date: '09-21' },
    { id: 'd7',  name: '海底捞火锅', category: '餐饮', amount: -23600,   date: '09-21' },
    { id: 'd8',  name: '麦当劳',     category: '餐饮', amount: -3800,    date: '09-19' },
    { id: 'd9',  name: '沪上阿姨',   category: '餐饮', amount: -1900,    date: '09-18' },
    { id: 'd10', name: '光影视频',   category: '订阅', amount: -2500,    date: '09-01' },
  ],
  credit: [
    { id: 'c1', name: '生活采购',       category: '购物', amount: -128600, date: '09-24' },
    { id: 'c2', name: '海底捞火锅',     category: '餐饮', amount: -23600,  date: '09-21' },
    { id: 'c3', name: '山姆会员店',     category: '购物', amount: -86400,  date: '09-17' },
    { id: 'c4', name: '京东',           category: '购物', amount: -64900,  date: '09-15' },
    { id: 'c5', name: '小米之家',       category: '购物', amount: -129900, date: '09-12' },
    { id: 'c6', name: '星巴克咖啡',     category: '餐饮', amount: -4200,   date: '09-10' },
    { id: 'c7', name: '宜家家居',       category: '购物', amount: -28900,  date: '09-08' },
    { id: 'c8', name: '上月账单还款',   category: '转账', amount: 452000,  date: '09-05', note: '自动还款' },
  ],
  travel: [
    { id: 't1', name: 'ANA 机票',     category: '交通', amount: -486000, date: '09-11', note: '上海 至 东京' },
    { id: 't2', name: '境外取现',     category: '转账', amount: -168000, date: '09-12', note: '日本 · 7-11 ATM' },
    { id: 't3', name: 'Booking 酒店', category: '购物', amount: -128000, date: '09-18', note: '日本 · 大阪' },
    { id: 't4', name: 'Suica 充值',   category: '交通', amount: -16800,  date: '09-20', note: '日本 · 东京' },
    { id: 't5', name: '成田机场免税', category: '购物', amount: -64200,  date: '09-11', note: '日本 · 成田' },
    { id: 't6', name: '购汇转入',     category: '转账', amount: 800000,  date: '09-09', note: '人民币购日元' },
  ],
};

/** 账本卡片 + 这张卡的演示动账 → 页面直接可用的一张「有档案的卡」。 */
export function buildCards(ledgerCards) {
  return ledgerCards.filter(c => c.profile && c.limits).map(c => {
    const t = TEMPLATE[c.id] || TEMPLATE_FALLBACK;
    const limit = c.limit || 0, used = c.used || 0;
    return {
      ...c,
      org: c.org || t.org,
      tone: c.tone || t.tone,
      available: Math.max(0, limit - used),
      rate: limit ? Math.min(1, used / limit) : 0,
      channels: c.channels.map(x => ({ ...x, on: x.on !== false })),
      /* 按日期排一次。用去掉连字符后的数字比较，不用 localeCompare ——
         实查过：浏览器里 '2026-08-14'.localeCompare('2026-09-01') 会返回正数，
         时间线会出现「9 月 1 日排在 8 月 14 日前面」这种读不通的顺序。 */
      history: [...c.history].sort((a, b) => day(a.date) - day(b.date)),
      feed: (FEED[c.id] || []).map(x => ({ ...x, amountText: money(Math.abs(x.amount)), positive: x.amount > 0 })),
    };
  });
}
