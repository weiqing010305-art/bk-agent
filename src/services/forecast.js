/**
 * services/forecast.js —— 现金流的读数层
 * ============================================================================
 * domain/forecast.js 算的是数，这里把它变成**可以直接显示的读数**：
 * 金额带上 ¥ 与正负号、日期带上短标签、每一项带上来源说明。
 *
 * 为什么来源说明必须在这一层：PRD §2.3 的目标 2 是「每项重要分析都可以追溯到
 * 交易、账单或用户设定」。追溯不是一句口号，是每一行金额旁边那句
 * 「07-06 · 08-06 · 09-06」（三条流水）或「按月代扣 · 已签约」（协议原文）。
 * 没有来源的金额根本进不了曲线 —— 那在 domain 层就被挡住了。
 *
 * 基准日是 DEMO_DATE（services/banking.js）：订阅页的「3 天后扣费」、动态页的
 * 「今天」都用它。预测必须和它们同一天，否则同一屏里会出现两个「今天」。
 */

import { money } from '../domain/bank.js';
import { DEMO_DATE } from './banking.js';
import { project, HORIZON, parseDay } from '../domain/forecast.js';

const yuan = n => '¥' + money(n);
/** 金额一律带符号：正负号本身就是方向，不必再写「收入 / 支出」。 */
export const signed = n => (n > 0 ? '+' : '−') + yuan(Math.abs(n));

/** 默认假设。缓冲 ¥1,000 是「账户里始终留着的那点钱」，用户可调（PRD §10.4 F5-05）。 */
export const DEFAULT_ASSUMPTIONS = { includeIncome: true, buffer: 100000, horizon: HORIZON };

export const shortDate = iso => iso.slice(5).replace('-', '/');
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
export const weekdayOf = iso => WEEKDAY[parseDay(iso).getDay()];

/** 来源说明。三句话分别对应三类依据，缺一类就说明那个金额不该出现。 */
function sourceText(source) {
  if (!source) return '';
  if (source.type === 'subscription') return source.detail || '代扣协议';
  if (source.type === 'ledger') return (source.dates || []).map(shortDate).join(' · ');
  if (source.type === 'user') return '你填的假设';
  return '按历史估算';
}

const fmtItem = it => ({ ...it, inflow: it.amount > 0, amountText: signed(it.amount), sourceText: sourceText(it.source) });

export function forecastModel(bank, patch = {}) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...patch, asOf: DEMO_DATE };
  const p = project(bank, assumptions);

  const series = p.series.map(d => ({
    ...d,
    label: shortDate(d.date), weekday: weekdayOf(d.date),
    balanceText: yuan(d.balance), netText: signed(d.net),
    isLow: false, isShort: p.short ? d.date === p.short.date : false,
    items: d.items.map(fmtItem),
  }));
  series[p.low.index].isLow = true;

  /* 日历格子：只放**已知的那几笔**（账单、推断出的周期支出、预计收入、试算）。
     日常预算每天都有，把它铺进日历会让 30 个格子全是"有事"，日历就不再是日历了。 */
  const calendar = series.map((d, i) => {
    const items = d.items.filter(it => it.key !== 'budget');
    return {
      date: d.date, label: d.label, weekday: d.weekday, day: Number(d.date.slice(8)), index: i,
      items, inflowText: items.filter(x => x.inflow).map(x => x.amountText).join(' '),
      outflowText: items.filter(x => !x.inflow).map(x => x.amountText).join(' '),
      level: Math.min(items.length, 3), isLow: d.isLow, isShort: d.isShort,
    };
  });

  const gap = {
    ...p.gap,
    amountText: yuan(p.gap.amount), dateLabel: shortDate(p.gap.date),
    estimatedText: yuan(p.gap.estimatedTotal), verifiedText: yuan(p.gap.verifiedTotal),
    totalText: signed(p.gap.total),
    items: p.gap.items.map(g => ({ ...g, inflow: false, amountText: signed(g.amount), sourceText: sourceText(g.source) })),
  };

  /* 有没有算预测的底料。一笔流水都没有、也没有任何代扣协议时，
     画一条平的曲线是不诚实的 —— 那种情况页面该走空态，而不是给一条假曲线。 */
  const basis = {
    tx: (bank.transactions || []).length,
    subs: (bank.subscriptions || []).filter(s => s.status === 'active').length,
  };
  basis.has = basis.tx > 0 || basis.subs > 0;

  const facts = {
    asOf: p.asOf, end: p.end, horizon: p.horizon,
    lowText: yuan(p.low.balance), lowDate: shortDate(p.low.date), lowDay: Number(p.low.date.slice(8)),
    lowNegative: p.low.balance < 0,
    shortText: p.short ? shortDate(p.short.date) : null,
    gapText: yuan(p.gap.amount), gapDate: shortDate(p.gap.date), gapItems: p.gap.items.length,
    bufferText: yuan(p.buffer),
    budgetText: yuan(p.budget.day), budgetLowText: yuan(p.budget.low), budgetHighText: yuan(p.budget.high),
    budgetSample: p.budget.sample,
    incomeText: p.income ? yuan(p.income.amount) : null,
    incomeDay: p.salaryDay || null,
    incomeFrom: p.income ? p.income.who : null,
    balanceText: yuan(p.opening),
    endText: yuan(p.series[p.series.length - 1].balance),
  };

  return {
    ...p, series, calendar, gap, facts, basis, assumptions,
    bufferText: yuan(p.buffer), availableText: yuan(p.opening),
    budget: { ...p.budget, dayText: yuan(p.budget.day), lowText: yuan(p.budget.low), highText: yuan(p.budget.high) },
    low: { ...p.low, label: shortDate(p.low.date), balanceText: yuan(p.low.balance) },
    short: p.short ? { ...p.short, label: shortDate(p.short.date), balanceText: yuan(p.short.balance) } : null,
    belowBuffer: p.belowBuffer ? { ...p.belowBuffer, label: shortDate(p.belowBuffer.date) } : null,
    salaryDay: p.salaryDay || null,
    patterns: p.patterns.map(x => ({ ...x, amountText: yuan(x.amount), evidenceText: x.dates.map(shortDate).join(' · ') })),
  };
}

/** 只要读数的那一处（首页的「未来余额低点」）用它，不必把整条曲线搬过去。 */
export const forecastFacts = (bank, patch) => forecastModel(bank, patch).facts;
