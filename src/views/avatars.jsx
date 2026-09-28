import React from 'react';
import {
  ArrowDownLeft, ArrowLeftRight, Banknote, Beef, Beer, Bike, BookOpen, CarTaxiFront, Clapperboard,
  Cloud, Coffee, CookingPot, Fish, Hammer, HandCoins, House, IceCreamBowl, Landmark, Luggage, Music2,
  Pizza, Receipt, Salad, Scissors, ShieldCheck, ShoppingBag, Soup, Stethoscope, Store,
  TrainFront, TrendingUp, UtensilsCrossed, Wrench,
} from 'lucide-react';
import '../styles/avatars.css';

/**
 * 交易头像体系 —— 按 doc/research/revolut-ai-and-za-deep-dive.md §D 落地。
 *
 * 三条产业界的实测结论决定了这个模块（Plaid Enrich / Monzo / ZA）：
 *   ① 双轨制：有商户就上商户形象，识别不出才退到类别图标 —— 两个字段，不是二选一。
 *   ② 配色三级优先：商户品牌色 > 类别色 > 中性兜底。类别色盘不含红与绿，红绿只做金额信号。
 *   ③ 形状是零文字的区分手法（§D-54）：圆 = 消费/兜底/收入，圆角方形 = 周期性，人物位 = 转账给人。
 *
 * 数据缺失三级降级（Monzo 原话：「绝不允许出现一串看不懂的字母和数字」）：
 *   品牌名 + 品牌色 → 商户名 + 类别色 → 类别名 + 类别图标。
 *
 * 分类对齐 Plaid PFC 的 16 个 primary（§D-46）：category 直接用英文常量，中文名只做显示；
 * 账本里现有的中文旧分类由 LEGACY 兜住，旧数据一个字段都不用改，将来接真实数据源零转换成本。
 */

/* ── ① 类别：16 个 PFC primary ─────────────────────────────────────────
   tone 决定底色（品牌色优先，见 avatars.css）。tone 沿用旧分类的 key，
   pages.css 的类别色与 motion.css 的分类签名动效因此全部继续生效。 */
const C = (label, Icon, tone) => ({ label, Icon, tone });
export const PFC = {
  BANK_FEES:                 C('手续费', Receipt, 'fees'),
  ENTERTAINMENT:             C('影音娱乐', Clapperboard, 'entertain'),
  FOOD_AND_DRINK:            C('餐饮', UtensilsCrossed, 'dining'),
  GENERAL_MERCHANDISE:       C('购物', ShoppingBag, 'shopping'),
  GENERAL_SERVICES:          C('生活服务', Wrench, 'service'),
  GOVERNMENT_AND_NON_PROFIT: C('政务与公益', Landmark, 'gov'),
  HOME_IMPROVEMENT:          C('家居家装', Hammer, 'home'),
  INCOME:                    C('收入', TrendingUp, 'income'),
  LOAN_PAYMENTS:             C('还贷', Banknote, 'loan'),
  MEDICAL:                   C('医疗', Stethoscope, 'medical'),
  PERSONAL_CARE:             C('个人护理', Scissors, 'care'),
  RENT_AND_UTILITIES:        C('房租与水电', House, 'rent'),
  TRANSFER_IN:               C('转入', ArrowDownLeft, 'transfer'),
  TRANSFER_OUT:              C('转出', ArrowLeftRight, 'transfer'),
  TRANSPORTATION:            C('交通', CarTaxiFront, 'transport'),
  TRAVEL:                    C('旅行', Luggage, 'travel'),
};
const LEGACY = { 转账: 'TRANSFER_OUT', 餐饮: 'FOOD_AND_DRINK', 购物: 'GENERAL_MERCHANDISE',
  交通: 'TRANSPORTATION', 订阅: 'GENERAL_SERVICES', 收入: 'INCOME' };
export const pfcOf = category => (PFC[category] ? category : LEGACY[category] || null);
export const catLabel = category => (PFC[pfcOf(category)] || PFC.TRANSFER_OUT).label;

/* ── ② 名称 → 细分。名称优先于分类字段 ────────────────────────────────
   账本里「房租」记在「转账」类下，但它是 RENT_AND_UTILITIES_RENT，收款人也不是人名；
   作者点名的 8 类都在这张表里（工资 / 房租 / 餐饮 / 采购 / 地铁 / 打车 / 云空间 / 光影视频）。 */
const RULES = [
  /* 工资：圆 + 金币 + 绶带 + 一次性扫光 —— 发薪是一件事件，不是普通入账 */
  [/工资|薪资|发薪|月薪|薪酬|年终|奖金|报销/, { pfc: 'INCOME', Icon: HandCoins, detail: 'INCOME_WAGES', payday: true }],
  [/房租|租金|月租|房东/, { pfc: 'RENT_AND_UTILITIES', Icon: House, detail: 'RENT_AND_UTILITIES_RENT' }],
  [/物业|水费|电费|燃气|取暖|宽带|话费/, { pfc: 'RENT_AND_UTILITIES', Icon: Wrench, detail: 'RENT_AND_UTILITIES_UTILITIES' }],
  /* 订阅态：云空间 / 光影视频 / 随听音乐 —— 圆角方形 + 品牌色，零文字就能从一堆消费里分出来 */
  [/云|网盘|存储|空间|icloud|drive|dropbox/i, { pfc: 'GENERAL_SERVICES', Icon: Cloud, detail: 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES' }],
  [/视频|影|剧|netflix|影视|影院/i, { pfc: 'ENTERTAINMENT', Icon: Clapperboard, detail: 'ENTERTAINMENT_TV_AND_MOVIES' }],
  [/音乐|听|歌|music|spotify|播客/i, { pfc: 'ENTERTAINMENT', Icon: Music2, detail: 'ENTERTAINMENT_MUSIC_AND_AUDIO' }],
  [/读书|阅|电子书|杂志|kindle/i, { pfc: 'ENTERTAINMENT', Icon: BookOpen, detail: 'ENTERTAINMENT_BOOKS_AND_AUDIOBOOKS' }],
  /* 交通细分：地铁与打车同属 TRANSPORTATION，两个 detailed 的头像完全不同。
     地铁高频小额 → 头像最简（不加任何小标），一天几十行才不会吵。 */
  [/地铁|轨交|公交|一卡通|轻轨|高铁|火车|metro|transit/i, { pfc: 'TRANSPORTATION', Icon: TrainFront, detail: 'TRANSPORTATION_PUBLIC_TRANSIT' }],
  [/打车|出租|网约|专车|顺风|taxi|uber|lyft/i, { pfc: 'TRANSPORTATION', Icon: CarTaxiFront, detail: 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES' }],
  /* 餐饮：**一张关键词表同时供图标、品类色调、细分三件事用**（look 见 diningLook）。
     品类从 9 个扩到 10 个；底色先看品牌色，再看这里的品类色调，最后才回类别色。 */
  [/咖啡|星巴克|瑞幸|costa|manner|coffee/i, { pfc: 'FOOD_AND_DRINK', Icon: Coffee, detail: 'FOOD_AND_DRINK_COFFEE', store: true, look: 1 }],
  [/披萨|pizza|必胜客/, { pfc: 'FOOD_AND_DRINK', Icon: Pizza, detail: 'FOOD_AND_DRINK_RESTAURANT', store: true, look: 2 }],
  [/汉堡|炸鸡|麦当劳|肯德基|burger|kfc/i, { pfc: 'FOOD_AND_DRINK', Icon: Beef, detail: 'FOOD_AND_DRINK_FAST_FOOD', store: true, look: 3 }],
  [/火锅|烧烤|串|海底捞/, { pfc: 'FOOD_AND_DRINK', Icon: CookingPot, detail: 'FOOD_AND_DRINK_RESTAURANT', store: true, look: 2 }],
  [/奶茶|茶|喜茶|奈雪|阿姨/, { pfc: 'FOOD_AND_DRINK', Icon: IceCreamBowl, detail: 'FOOD_AND_DRINK_COFFEE', store: true, look: 4 }],
  [/日料|寿司|刺身|海鲜|鱼/, { pfc: 'FOOD_AND_DRINK', Icon: Fish, detail: 'FOOD_AND_DRINK_RESTAURANT', look: 5 }],
  [/面|拉面|米线|粉|小吃|快餐/, { pfc: 'FOOD_AND_DRINK', Icon: Soup, detail: 'FOOD_AND_DRINK_FAST_FOOD', look: 3 }],
  [/外卖|美团|饿了么|deliveroo|doordash/i, { pfc: 'FOOD_AND_DRINK', Icon: Bike, detail: 'FOOD_AND_DRINK_FOOD_DELIVERY', look: 0 }],
  /* 酒(?!店)：酒店是住宿（TRAVEL），不是酒水 —— 少了这个否定，「三亚酒店」会被算成酒吧 */
  [/酒(?!店)|酒吧|啤|清酒|beer/i, { pfc: 'FOOD_AND_DRINK', Icon: Beer, detail: 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR', look: 0 }],
  [/沙拉|轻食|健康餐|salad/i, { pfc: 'FOOD_AND_DRINK', Icon: Salad, detail: 'FOOD_AND_DRINK_RESTAURANT', look: 0 }],
  [/餐饮|餐厅|吃饭|餐/, { pfc: 'FOOD_AND_DRINK', Icon: UtensilsCrossed, detail: 'FOOD_AND_DRINK_RESTAURANT', look: 0 }],
  /* 采购与其他类别：认得出的店给品牌色，认不出的用类别图标兜底 */
  [/采购|超市|商场|便利店|日用|百货|market|supermarket/i, { pfc: 'GENERAL_MERCHANDISE', Icon: Store, detail: 'GENERAL_MERCHANDISE_SUPERSTORES' }],
  [/医|药|诊所|体检|挂号/, { pfc: 'MEDICAL', Icon: Stethoscope, detail: 'MEDICAL_OTHER_MEDICAL' }],
  [/理发|美容|美甲|健身|洗浴|按摩|spa/i, { pfc: 'PERSONAL_CARE', Icon: Scissors, detail: 'PERSONAL_CARE_HAIR_AND_BEAUTY' }],
  [/机票|酒店|民宿|旅行|携程|airbnb|booking/i, { pfc: 'TRAVEL', Icon: Luggage, detail: 'TRAVEL_LODGING' }],
  [/家具|装修|建材|家电|维修|五金/, { pfc: 'HOME_IMPROVEMENT', Icon: Hammer, detail: 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT' }],
  [/还款|房贷|车贷|分期/, { pfc: 'LOAN_PAYMENTS', Icon: Banknote, detail: 'LOAN_PAYMENTS_OTHER_PAYMENT' }],
  [/手续费|年费|利息|罚息|汇费/, { pfc: 'BANK_FEES', Icon: Receipt, detail: 'BANK_FEES_OTHER_BANK_FEES' }],
  [/税|社保|公积金|罚款|捐|慈善|公益/, { pfc: 'GOVERNMENT_AND_NON_PROFIT', Icon: Landmark, detail: 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT' }],
  [/保险|保费/, { pfc: 'GENERAL_SERVICES', Icon: ShieldCheck, detail: 'GENERAL_SERVICES_INSURANCE' }],
];
/* ── 餐饮的品类色调：**用的就是上面那张关键词表**（同一条关键词 → 同一个下标），
   所以概览动态、账单明细、卡片流水对同一家店永远是同一个颜色 ——
   旧版一页走语义、一页走哈希，星巴克会一橙一棕，正是这种不一致的来源。

   下标对齐 tokens.css 的餐饮子色调：1 咖啡棕 · 2 火锅红 · 3 面食黄 · 4 奶茶粉 · 5 海味青；
   0 = 认不出是哪一品类的店，回餐饮类别色（一个确定的颜色，不是哈希撞出来的）。
   哈希只在「连品类都认不出」时兜底。 */
const hash = s => [...s].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);
const cuisineOf = name => (RULES.find(([re, r]) => r.look !== undefined && re.test(name)) || [])[1];
export const diningLook = name => { const r = cuisineOf(name); return r ? r.look : hash(name) % 6; };
export const diningIcon = name => (cuisineOf(name) || {}).Icon || UtensilsCrossed;

/* ── ③ 商户品牌色：手抄自 simple-icons 的 data/simple-icons.json（title + hex 两个字段）。
   只搬颜色常量，不引包、不搬 SVG —— Plaid 的商户头像是 logo，我们这里能自带的是品牌色，
   而报告实测这一招「成本最低、观感提升最大」。
   ⚠️ CC0-1.0 覆盖的是这个仓库的数据组织，**不覆盖商标**：每个品牌图形归其所有者，
   演示里标注来源即可，商用要各自遵守 brand guidelines。 */
const BRANDS = [
  /* 星巴克刻意用咖啡棕（#4A2C17）而不是它的品牌绿 #006241：
     账户流水里「餐饮」这一类的底色要让人一眼读出"这是什么消费"，
     品牌绿在一屏餐饮里和别的冷色混在一起反而分不出来。
     这是一个有意的取舍，不是漏抄。 */
  [/星巴克|starbucks/i, '4A2C17'], [/瑞幸|luckin/i, '0022AB'],
  [/麦当劳|mcdonald/i, 'FBC817'], [/肯德基|kfc/i, 'E4002B'],
  [/汉堡王|burger\s*king/i, 'D62300'], [/必胜客|pizza\s*hut/i, 'EE3124'],
  [/沃尔玛|walmart/i, '0071CE'], [/家乐福|carrefour/i, '004E9F'],
  [/宜家|ikea/i, '0058A3'], [/711|7-eleven/i, '008061'],
  [/netflix|奈飞/i, 'E50914'], [/spotify/i, '1ED760'], [/youtube/i, 'FF0000'],
  [/bilibili|哔哩/i, '00A1D6'], [/apple|苹果/i, '000000'], [/google|谷歌/i, '4285F4'],
  [/amazon|亚马逊/i, 'FF9900'], [/dropbox/i, '0061FF'], [/icloud/i, '3693F3'],
  [/uber|优步/i, '000000'], [/airbnb|爱彼迎/i, 'FF5A5F'], [/deliveroo/i, '00CCBC'],
  [/alipay|支付宝/i, '1677FF'], [/wechat|微信/i, '07C160'], [/paypal/i, '003087'],
  [/visa/i, '1A1F71'], [/mastercard|万事达/i, 'EB001B'], [/xiaomi|小米/i, 'FF6900'],
  /* 下面三条是本项目演示账本里的虚构订阅，没有 simple-icons 词条：
     用所在品类的行业色，来源记为「本项目演示品牌色」，不冒充上面那些真实品牌。 */
  [/云空间/, '3693F3'], [/光影视频/, 'E50914'], [/随听音乐/, '1ED760'],
];
const brandOf = name => (BRANDS.find(([re]) => re.test(name)) || [])[1] || null;

const RECUR = /房租|租金|月租|物业|会员|包月|月费|连续包月|云|网盘|存储|空间|视频|影|音乐|听|读书|宽带|话费|水电|电费|水费|燃气|保险|还款|房贷|车贷|社保/;
const SQUARE_OFF = new Set(['INCOME', 'RENT_AND_UTILITIES']);
const RAW_CODE = /^[A-Z0-9][A-Z0-9 .#*&'\/-]{7,}$/;            /* "WM SUPERCENTER #1700 POWAY CAUS" */
const ORG = /房东|物业|公司|集团|有限|超市|商场|平台|医院|学校|大学|银行|保险|电力|水务|燃气|通信|运营|地铁|公交|铁路|航空|酒店|餐厅|咖啡|便利|市场|中心|科技|网络|店|行|局|厅/;

/** 名称清洗：去掉门店编号；整串都是串码时返回空串，由调用方退到类别名 —— 串码一次都不许露面。 */
export const cleanName = name => {
  const s = String(name || '').replace(/#\s*\d+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return !s || RAW_CODE.test(s) ? '' : s;
};
const personOf = name => {
  const m = /^(?:转给|转入|收到|给)(.{2,4})$/.exec(String(name || '').trim());
  return m && !ORG.test(m[1]) ? m[1] : null;
};
/** 「周期或订阅」是一个标签，不是类别 —— 它跨越房租 / 云空间 / 光影视频（§D.4）。
    旧账本里「订阅」是 category 的值，那里它本来就等价于这个标签，所以一并认下。 */
export const isRecurring = (name, category, subs = []) =>
  RECUR.test(name || '') || category === '订阅' || pfcOf(category) === 'RENT_AND_UTILITIES' ||
  subs.some(s => s.name && String(name || '').includes(s.name));

/**
 * 一笔交易 → 一个头像描述。字段全部由这里派生，页面不再各自判断。
 * shape 由报告 §D-54 的形状系统给出，color 的三级优先交给 CSS 的 --av-brand。
 */
export function avatarOf(item = {}, subs = []) {
  const raw = String(item.name || '').trim();
  const name = cleanName(raw);
  const rule = (RULES.find(([re]) => re.test(raw)) || [])[1] || null;
  const who = personOf(raw);
  const pfc = (rule && rule.pfc) || pfcOf(item.category) || (item.positive ? 'INCOME' : 'TRANSFER_OUT');
  const meta = PFC[pfc] || PFC.TRANSFER_OUT;
  const recurring = isRecurring(raw, item.category, subs);
  const brand = brandOf(raw);
  const dining = pfc === 'FOOD_AND_DRINK';
  /* 规则先认领：房租那笔的收款人不是人名，不能因为写着「房东」就当成人物头像 */
  const person = who && !rule ? who : null;
  return {
    pfc, detail: (rule && rule.detail) || pfc, label: meta.label, tone: meta.tone,
    title: name || meta.label, brand, recurring, person, payday: !!(rule && rule.payday),
    toneIndex: dining ? diningLook(raw) : null,
    Icon: person ? null : (rule && rule.Icon) || meta.Icon,
    shape: person ? 'person' : recurring && !SQUARE_OFF.has(pfc) ? 'squircle' : 'circle',
  };
}

/**
 * 头像本体。40px（移动 36），与文字的间距由 .row-item 的 --space-4(12px) 给。
 * 装饰性内容 —— 名字与类别都在旁边的文字里，所以整块 aria-hidden，避免读屏念两遍。
 */
export const TxAvatar = ({ look, small = false, mini = false, iconSize = 20, className = '' }) => {
  const { Icon, tone, shape, brand, payday, person, toneIndex } = look;
  return <span aria-hidden="true" data-tone={toneIndex ?? undefined}
    className={'av av--' + tone + ' av--' + shape + ' tx-icon tx-icon--' + tone
      + (mini ? ' av--mini' : small ? ' av--sm' : '') + (payday ? ' av--payday' : '')
      + (className ? ' ' + className : '')}
    style={brand ? { '--av-brand': '#' + brand } : undefined}>
    {person ? <b className="av-initial">{[...person][0]}</b> : <Icon size={iconSize} strokeWidth={1.9}/>}
    {payday && !mini && <span className="av-sheen"/>}
  </span>;
};
