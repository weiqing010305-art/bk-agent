import { TODAY } from './cardData.jsx';

/**
 * 卡片页的日期与文案换算。基准日来自 cardData.jsx 的 TODAY（写死），
 * 所以这些函数是纯函数，跑测试和跑半年后打开的页面结果一致。
 */
const DAY = 86400000;
const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ymd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

/**
 * 账期模型：账单日 billDay 把一个月切成两段。
 * 上一个账单日到今天 = 正在累积的这一期；下一个账单日 + dueOffset = 还款日。
 * 借记卡 dueOffset 为 0 时不产生「还款日」，调用方用 due == null 判断。
 */
export function cycle(profile) {
  const { billDay, dueOffset } = profile;
  const day = TODAY.getDate();
  const thisMonthBill = new Date(TODAY.getFullYear(), TODAY.getMonth(), billDay);
  const last = day >= billDay ? thisMonthBill : shift(thisMonthBill, -1);
  const next = shift(last, 1);
  const due = dueOffset ? new Date(next.getFullYear(), next.getMonth(), next.getDate() + dueOffset) : null;
  return {
    last: fmt(last), next: fmt(next),
    due: due ? fmt(due) : null,
    dueShort: due ? (due.getMonth() + 1) + ' 月 ' + due.getDate() + ' 日' : null,
    nextShort: (next.getMonth() + 1) + ' 月 ' + next.getDate() + ' 日',
  };
}

/**
 * 账期进度：从本期账单日走到还款日（借记卡走到下次出账）已完成的比例。
 * 账期条的填充宽度就是它 —— 这一行替掉了「距账单日还有 N 天，M 月 D 日还款」两句说明。
 */
export function periodProgress(info) {
  const from = ymd(info.last), to = ymd(info.due || info.next);
  return Math.max(0, Math.min(1, (TODAY - from) / Math.max(1, to - from)));
}

/** 本期小结：账期内的消费笔数与金额，以及上一期同口径对比。 */
export function summary(card, c) {
  const [cy, cm, cd] = c.last.split('-').map(Number);
  const start = new Date(cy, cm - 1, cd);
  const inRange = (d, from, to) => { const t = ymd((d.length === 5 ? '2026-' : '') + d); return t >= from && t < to; };
  const prevStart = shift(start, -1);
  const out = card.feed.filter(t => t.amount < 0);
  const now = out.filter(t => inRange(t.date, start, shift(start, 1)));
  const prev = out.filter(t => inRange(t.date, prevStart, start));
  const sum = a => a.reduce((s, t) => s - t.amount, 0);
  return { spend: sum(now), count: now.length, prev: sum(prev), diff: sum(now) - sum(prev), since: c.last };
}

/**
 * 时间线上的日期：'2026-08-14' → '08-14'，与流水行的格式一致。
 * 跨年的条目补两位年份（'24-03-11'）—— 时间线从 2024 年读起，只留月日会读不出先后。
 */
export const tickDate = s => (s.startsWith(String(TODAY.getFullYear())) ? s.slice(5) : s.slice(2));
