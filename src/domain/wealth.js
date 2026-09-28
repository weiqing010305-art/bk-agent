/**
 * domain/wealth.js —— 理财域的种子数据（产品 / 持仓 / 榜单口径）
 * ============================================================================
 * ⚠️ 本文件每一个字段都是**虚构的演示数据**：产品名、代码、净值、收益率、行为数据
 *    都不对应任何真实基金。按 DECISIONS D-01 的结论，这句说明只留在代码里，不上界面。
 *
 * 字段照 doc/research/za-design-and-wealth.md §B.2.1 的产品对象模型：
 *   Name / Currency / Code / 近1月·3月·1年·3年回报 / Yield (p.a.) / 類型 / 上架日期
 *
 * 单位约定（与 domain/bank.js 一致）：金额一律是**分**；百分比是百分数本身（3.6 = 3.6%）。
 *
 * 数据是**声明式**的，不是派生的：榜单的排序口径（§B.6.3「排序口径全部可复算」）
 * 必须能对着一行数字手算出来，所以 beh 里的宗数 / 金额 / 盈利额都写死，
 * 不从前端状态里「估」一个出来。
 */

/** 资产类别：§B.2.1 的四类。desc 只留在代码里 —— 界面上一个标签就够。 */
export const TYPES = {
  stock:   { label: '股票型', desc: '投资于本地和/或环球股票' },
  balance: { label: '平衡型', desc: '投资于债券和股票' },
  bond:    { label: '债券型', desc: '投资政府或公司发行的债务证券' },
  money:   { label: '货币型', desc: '主要投资于优质的短期有息证券' },
};

/**
 * 货架：7 只，覆盖四类资产。
 *
 * ret      四个期间就是 ZA 榜单里那四列（近1月 / 近3月 / 近1年 / 近3年）
 * yieldPct Yield (p.a.) 年化派息率。**不派息的写 null，不写 0** —— 0 是一个事实，null 才是「没有这项」。
 * min      起购金额：货币基金 ¥1、一般基金 ¥100（§B.5.1 官方口径）
 * cutoff   截止时间：货币基金 09:00、非货币基金 14:00（§B.5.1 官方口径，每只可在详情里查）
 * settle   到账：货币基金 T+0，一般基金 T+5（官方口径是 T+5–10 个工作日）
 * feePct   认购费：货币 0% / 债券 0.5% / 其余 1%（§B.5.1）
 * navPrev  前一个交易日的单位净值 —— 昨日收益 = 份额 ×（nav − navPrev），不靠"月回报摊 30 天"硬凑
 * nav7     货币基金过去 8 个自然日的单位净值（T1…T8）；wan7 是同 7 日的每万份收益
 *          —— 七日年化的四套算法全部只从这两个公开口径算（§B.4.2）
 * beh      行为数据，供榜单排序：subs14 近 14 天认购宗数 / profit 持有人累计盈利(元) / proAmt 金融业客户认购额(元)
 */
export const FUNDS = [
  { code: '000128', name: '青禾现金宝货币A', type: 'money', currency: 'CNY', nav: 1,
    ret: { m1: 0.16, m3: 0.47, y1: 1.92, y3: 5.85 }, yieldPct: null, listed: '2024-03-11',
    min: 100, feePct: 0, risk: '较低风险', cutoff: '09:00', settle: 'T+0',
    nav7: [1, 1.000052, 1.000104, 1.000155, 1.000207, 1.000259, 1.000311, 1.000363],
    wan7: [0.52, 0.52, 0.51, 0.52, 0.52, 0.52, 0.51],
    beh: { subs14: 1284, profit: 1284000, proAmt: 3120000 } },

  { code: '110022', name: '青禾稳利债券A', type: 'bond', currency: 'CNY', nav: 1.2146,
    ret: { m1: 0.42, m3: 1.28, y1: 4.36, y3: 13.24 }, yieldPct: 3.6, listed: '2023-05-18',
    min: 10000, feePct: 0.5, risk: '中低风险', cutoff: '14:00', settle: 'T+5', navPrev: 1.2144,
    beh: { subs14: 412, profit: 968000, proAmt: 1840000 } },

  { code: '006533', name: '青禾中短债债券C', type: 'bond', currency: 'CNY', nav: 1.0864,
    ret: { m1: 0.38, m3: 1.19, y1: 4.92, y3: 12.08 }, yieldPct: 4.2, listed: '2022-11-07',
    min: 10000, feePct: 0.5, risk: '中低风险', cutoff: '14:00', settle: 'T+5', navPrev: 1.0862,
    beh: { subs14: 286, profit: 742000, proAmt: 1260000 } },

  { code: '050012', name: '青禾裕丰平衡A', type: 'balance', currency: 'CNY', nav: 1.6382,
    ret: { m1: 1.15, m3: 3.42, y1: 9.84, y3: 21.4 }, yieldPct: null, listed: '2023-09-22',
    min: 10000, feePct: 1, risk: '中风险', cutoff: '14:00', settle: 'T+5', navPrev: 1.6376,
    beh: { subs14: 638, profit: 1136000, proAmt: 2680000 } },

  { code: '012399', name: '青禾全球配置平衡C', type: 'balance', currency: 'CNY', nav: 1.1842,
    ret: { m1: 0.94, m3: 2.87, y1: 8.16, y3: 19.32 }, yieldPct: 2.8, listed: '2025-01-16',
    min: 10000, feePct: 1, risk: '中风险', cutoff: '14:00', settle: 'T+5', navPrev: 1.1837,
    beh: { subs14: 194, profit: 486000, proAmt: 980000 } },

  { code: '001618', name: '青禾成长精选股票A', type: 'stock', currency: 'CNY', nav: 2.4708,
    ret: { m1: 2.86, m3: 6.41, y1: 18.62, y3: 32.55 }, yieldPct: null, listed: '2022-06-30',
    min: 10000, feePct: 1, risk: '中高风险', cutoff: '14:00', settle: 'T+5', navPrev: 2.4684,
    beh: { subs14: 521, profit: 1462000, proAmt: 3400000 } },

  { code: '008887', name: '青禾科技先锋股票A', type: 'stock', currency: 'CNY', nav: 3.1025,
    ret: { m1: -1.24, m3: 4.08, y1: 24.76, y3: 41.16 }, yieldPct: null, listed: '2024-08-15',
    min: 10000, feePct: 1, risk: '中高风险', cutoff: '14:00', settle: 'T+5', navPrev: 3.1038,
    beh: { subs14: 473, profit: 1806000, proAmt: 2940000 } },
];

/**
 * 持仓。三条，覆盖三类资产 —— 收益报告的长图要有东西可讲。
 * units 是份额、cost 是买入成本（分）；市值 = units × 最新净值（§D.3 的 fund-app 口径）。
 * 一条 status='pending' 的样本在 services/wealth.js 的 purchase() 里生成：申购后份额 T+N 才确认。
 */
export const HOLDINGS = [
  { id: 'w-cash', code: '000128', units: 62540, cost: 6200000, date: '2026-07-08', status: 'settled' },
  { id: 'w-bal', code: '050012', units: 2000, cost: 305000, date: '2026-08-19', status: 'settled' },
  { id: 'w-tech', code: '008887', units: 2000, cost: 497300, date: '2025-11-04', status: 'settled' },
];

/**
 * 榜单（§B.6）。
 *
 * 三条规则照抄官方八个榜单，一条都不改：
 *  1. **标题的措辞是「别人在干什么」，不是「这个产品好不好」** —— 八个官方榜单没有一个带评级语义，
 *     既避开投顾合规风险，又比"五星好评"更有说服力。
 *  2. **定义放脚注，不放标题**（def）—— 认知成本推迟到用户主动较真的那一刻。
 *  3. **排序口径可复算**（by + 方向固定降序）—— 可复算 = 可信任；没有一个"综合评分"。
 *
 * 取前 3（官方口径是 3–10 只不等），三个人都能一眼看完。
 */
export const RANKS = [
  { id: 'hot',  title: '近两周买最多',   by: 'subs14',  kind: 'count', def: '14 天认购宗数' },
  { id: 'earn', title: '持有人赚最多',   by: 'profit',  kind: 'money', def: '累计盈利金额' },
  { id: 'pro',  title: '金融业的都在买', by: 'proAmt',  kind: 'money', def: '金融业客户认购额' },
];

/** 单笔上限（分）。超过它就不是"自助申购"能办的额度 —— 与 services/limits.js 的账户限额是两件事。 */
export const SINGLE_CAP = 5000000;
