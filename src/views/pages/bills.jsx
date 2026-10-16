import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChartPie, SearchX } from 'lucide-react';
import { Page, Panel, StatBar, Row, Empty } from '../parts.jsx';
import { CategoryIcon, CATS } from '../shared.jsx';
import { SpendingChart } from '../charts.jsx';

/**
 * 账单。
 *
 * 信息架构（这一版重排过）：结论 → 结构 → 节奏 → 明细。
 *   旧顺序是「统计 → 图 → 筛选 → 明细」，筛选单独占一排 chips，于是「我要看餐饮」
 *   要跨三个区域操作三次。现在页面上只有一个「当前分类」状态：滑过图形、图例、
 *   读数区里的任一处都在改它，明细里对应的行随之高亮；点一下则只看这一类，
 *   并把明细送到眼前。筛选的入口就在数据旁边，不必再单列一排。
 *   账期用胶囊切换（不给月份做一个大下拉框）：账本里有几个月就显示几个。
 *
 * 所有派生量都在 analyze() 里算完，它是纯函数，0 笔 / 1 笔 / 某类目为 0 都走同一条路径。
 */

/* 分类已从 6 类扩到 16 类（对齐 Plaid PFC）。认不出的落 transfer 兜底 ——
   有确定兜底比"撞到什么色算什么色"好。 */
const CAT_KEY = {
  '转账': 'transfer', '餐饮': 'dining', '购物': 'shopping', '交通': 'transport',
  '订阅': 'subscribe', '收入': 'income', '生活服务': 'dining', '医疗': 'shopping',
  '保险': 'subscribe', '出行': 'transport', '住房': 'transfer', '教育': 'shopping',
  '娱乐': 'dining', '投资': 'income', '税费': 'transfer', '其他': 'transfer',
};
const keyOf = n => CAT_KEY[n] || 'transfer';
const yuan = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, t) => (t > 0 ? Math.round((a / t) * 100) : 0);
const monthNum = m => Number(m.slice(5, 7));
const dayNum = iso => Number(iso.slice(8, 10));

/** 一组交易的类目构成。金额为 0 的类目直接不出现，下游就不用再判空。 */
function partsOf(txns) {
  const map = new Map();
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const c = map.get(t.category) || { name: t.category, key: keyOf(t.category), amount: 0, count: 0 };
    c.amount -= t.amount;
    c.count += 1;
    map.set(t.category, c);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/** 纯函数，导出是为了能在浏览器里直接拿极端数据喂它（见验证脚本），组件本身不依赖导出。 */
export function analyze(all, month) {
  const txns = month ? all.filter(t => t.date.slice(0, 7) === month) : [];
  const parts = partsOf(txns);
  const total = parts.reduce((n, p) => n + p.amount, 0);
  const income = txns.filter(t => t.amount > 0).reduce((n, t) => n + t.amount, 0);
  const incomeCount = txns.filter(t => t.amount > 0).length;
  const spendCount = txns.filter(t => t.amount < 0).length;

  /* 按日 */
  const byDay = new Map();
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const list = byDay.get(t.date) || [];
    list.push(t);
    byDay.set(t.date, list);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, list]) => {
    const own = partsOf(list);
    return { date, day: dayNum(date), count: list.length, segs: own,
      top: [...list].sort((a, b) => a.amount - b.amount)[0],
      amount: own.reduce((n, p) => n + p.amount, 0) };
  });
  const span = days.length ? days[days.length - 1].day : 0;
  const maxDay = days.reduce((n, d) => Math.max(n, d.amount), 0);
  const peak = days.reduce((a, d) => (!a || d.amount > a.amount ? d : a), null);

  /* 热力：从 1 号铺到最后有支出的一天，空格子也是信息（那天没花钱） */
  const heatDays = Array.from({ length: span }, (_, i) => {
    const d = days.find(x => x.day === i + 1);
    const amount = d ? d.amount : 0;
    return { day: i + 1, amount, count: d ? d.count : 0, segs: d ? d.segs : [],
      level: amount === 0 ? 0 : 1 + Math.min(3, Math.floor((amount / (maxDay || 1)) * 4)) };
  });

  /* 占比：按周聚合，一周一根 100% 高的条 */
  const buckets = [];
  for (const d of days) {
    const w = Math.floor((d.day - 1) / 7);
    const b = buckets[w] || (buckets[w] = { amount: 0, map: new Map() });
    b.amount += d.amount;
    for (const s of d.segs) b.map.set(s.name, (b.map.get(s.name) || 0) + s.amount);
  }
  const weeks = [];
  buckets.forEach((b, i) => {
    if (!b) return;
    weeks.push({
      label: (i * 7 + 1) + ' 至 ' + Math.min(i * 7 + 7, span) + ' 日',
      amount: b.amount,
      segs: parts.filter(p => b.map.has(p.name)).map(p => ({ name: p.name, key: p.key, amount: b.map.get(p.name) })),
    });
  });

  /* 环比：拿账本里真实存在的上一期比。没有就退化成单期，不编数据 */
  const months = [...new Set(all.map(t => t.date.slice(0, 7)))].sort();
  const at = months.indexOf(month);
  const prevMonth = at > 0 ? months[at - 1] : null;
  const prevParts = prevMonth ? partsOf(all.filter(t => t.date.slice(0, 7) === prevMonth)) : [];
  const prevMap = new Map(prevParts.map(p => [p.name, p.amount]));
  const rows = parts.map(p => ({ ...p, prevAmount: prevMap.get(p.name) || 0,
    delta: prevMap.get(p.name) ? Math.round((p.amount - prevMap.get(p.name)) / prevMap.get(p.name) * 100) : null }));
  for (const p of prevParts) {
    if (!parts.some(x => x.name === p.name)) rows.push({ ...p, amount: 0, count: 0, prevAmount: p.amount, delta: -100 });
  }

  /* 趋势：累计曲线 + 两句解读（最猛的一天 / 这个月的节奏） */
  let acc = 0;
  const points = days.map(d => { acc += d.amount; return { label: d.day + ' 日', day: d.day, value: acc }; });
  const half = Math.ceil(span / 2);
  const front = days.filter(d => d.day <= half).reduce((n, d) => n + d.amount, 0);
  const monthText = monthNum(month) + ' 月';

  return {
    txns, parts, total, income, incomeCount, spendCount, months, days,
    heat: { monthLabel: monthText, pad: month ? (new Date(month + '-01T00:00:00').getDay() + 6) % 7 : 0,
      avg: span ? Math.round(total / span) : 0, days: heatDays },
    weeks,
    compare: { rows, prev: prevMonth ? monthNum(prevMonth) + ' 月' : null, cur: monthText },
    trend: {
      points, max: acc, peak: peak ? points.findIndex(p => p.day === peak.day) : 0,
      insight: {
        peakText: peak
          ? '最猛的一天是 ' + monthText + ' ' + peak.day + ' 日，' + peak.top.name + '一笔 '
            + yuan(-peak.top.amount) + '，当天占了整月的 ' + pct(peak.amount, total) + '%。'
          : '这一期还没有支出。',
        paceText: total === 0 ? '没有支出，也就没有节奏。'
          : span < 6 ? '这一期才刚开始，节奏还看不出来。'
          : '前 ' + half + ' 天花了 ' + pct(front, total) + '%，后 ' + (span - half) + ' 天花了 ' + pct(total - front, total) + '%。',
      },
    },
    first: txns.length ? txns.reduce((a, t) => (t.date < a ? t.date : a), txns[0].date) : null,
    last: txns.length ? txns.reduce((a, t) => (t.date > a ? t.date : a), txns[0].date) : null,
  };
}

export default function Bills({ ctx }) {
  const { dataModel: d } = ctx;
  const [hover, setHover] = useState(null);
  const [filter, setFilter] = useState('全部');
  const [picked, setPicked] = useState(null);
  const listRef = useRef(null);

  const months = useMemo(() => [...new Set(d.transactions.map(t => t.date.slice(0, 7)))].sort(), [d.transactions]);
  const month = picked || months[months.length - 1] || '';
  const m = useMemo(() => analyze(d.transactions, month), [d.transactions, month]);
  const hot = hover || (filter === '全部' ? null : filter);

  const groups = useMemo(() => {
    const rows = filter === '全部' ? m.txns : m.txns.filter(t => t.category === filter);
    const map = new Map();
    for (const t of rows) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date).push(t);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [m.txns, filter]);

  const shown = groups.reduce((n, g) => n + g[1].length, 0);
  const categories = [...new Set([...CATS, ...m.txns.map(t => t.category)])];

  /* 点了图例之后把明细送到眼前。hover 不触发滚动：一天几十次的高频交互里
     让页面自己跳，比不动更糟（ARCHITECTURE §5A.3 的频率门）。 */
  useEffect(() => {
    if (filter === '全部' || !listRef.current) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }, [filter]);

  const label = month ? monthNum(month) + ' 月' : '本期';

  const subtitle = m.first
    ? monthNum(month) + ' 月 ' + dayNum(m.first) + ' 日'
      + (m.first === m.last ? '' : '到 ' + dayNum(m.last) + ' 日') + ' · ' + m.txns.length + ' 笔'
    : '暂无记录';

  const dayTotal = list => {
    const n = list.reduce((a, t) => a + t.amount, 0);
    return (n > 0 ? '+' : n < 0 ? '−' : '') + yuan(Math.abs(n));
  };

  return <Page title="账单" subtitle={subtitle} aside={
    months.length > 1
      ? <div className="month-pills" role="group" aria-label="账期">
          {months.map(mo => <button key={mo} type="button" aria-pressed={mo === month}
            className={'month-pill' + (mo === month ? ' on' : '')}
            onClick={() => { setPicked(mo); setFilter('全部'); setHover(null); }}>{monthNum(mo)} 月</button>)}
        </div>
      : <span className="month-pills"><span className="month-pill on month-pill--still">{label}</span></span>
  }>
    <Panel title="银行流水" aside={<button className="link-btn" onClick={() => ctx.setRoute('statement')}>查看并下载流水</button>}>
      <p className="page-note">按日期与收支类型筛选，在流水页面预览并下载 CSV 文件。</p>
    </Panel>
    <StatBar
      left={{ label: label + '支出', value: yuan(m.total),
        note: m.spendCount + ' 笔 · 日均 ' + yuan(m.heat.avg) }}
      right={{ label: label + '收入', value: yuan(m.income),
        note: m.incomeCount + ' 笔 · 结余 ' + yuan(m.income - m.total) }}/>

    <Panel title="钱花在哪了">
      {m.parts.length
        ? <SpendingChart model={m} active={hot} onHover={setHover}
            onLock={name => { setFilter(name || '全部'); setHover(null); }} filter={filter}/>
        : <Empty icon={ChartPie} title="暂无支出"/>}
    </Panel>

    <Panel title="明细" aside={<span className="panel-hint">{groups.length} 天 · {shown} 笔</span>}>
      <div className="chips-row">
        {categories.map(c => <button key={c} type="button" className={'chip' + (filter === c ? ' on' : '')}
          aria-pressed={filter === c} onClick={() => { setFilter(c); setHover(null); }}>{c}</button>)}
      </div>
      <div className="day-groups" ref={listRef}>
        {groups.length === 0
          /* 出路只在真有出路时给：筛选状态下给「看全部」，这一期本来就空则不给按钮 */
          ? <Empty icon={SearchX} title="暂无交易"
              action={filter === '全部' ? undefined : '看全部'}
              onAction={() => { setFilter('全部'); setHover(null); }}/>
          : groups.map(([date, list]) => <section className="day-group" key={date}>
              <header className="bills-day">
                <h3>{monthNum(date)} 月 {dayNum(date)} 日</h3>
                <b>{dayTotal(list)}</b>
              </header>
              <ul className="row-list">
                {list.map(t => <Row key={t.id} icon={<CategoryIcon item={t}/>} title={t.name}
                  sub={t.category} value={t.amountText} positive={t.positive}
                  className={!hot ? '' : t.category === hot ? 'row-item--hit' : 'row-item--dim'}/>)}
              </ul>
            </section>)}
      </div>
    </Panel>
  </Page>;
}
