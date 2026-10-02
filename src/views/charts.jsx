import React, { useState } from 'react';

/**
 * 手绘 SVG / CSS 图表。零依赖：不引图表库，也不用 canvas —— SVG 的元素本身就是
 * 命中区，鼠标滑过与键盘聚焦都不需要额外做坐标反查。
 *
 * 两条贯穿全篇的约定：
 *  1. 六个形态共用一份数据与同一个「当前分类」。鼠标在任一形态的任一段上滑过，
 *     圆环、条、图例、读数区一起响应。切换形态不会清空高亮，因为状态不在图里。
 *  2. 图例常驻在形态下方，它同时是筛选器：滑过 = 临时高亮，点一下 = 只看这一类。
 *     筛选服务的对象是明细，所以入口放在离数据最近的地方，页面上就不用再多一排筛选器。
 */

const yuan = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (a, t) => (t > 0 ? Math.round((a / t) * 100) : 0);
const tone = k => 'var(--cat-' + k + ')';
const pick = (locked, name) => (locked === name ? null : name);

function Legend({ parts, total, active, locked, onHover, onLock }) {
  return <ul className="chart-legend" onMouseLeave={() => onHover(null)}>
    {parts.map(p => <li key={p.name}>
      <button type="button" aria-pressed={locked === p.name}
        className={'chart-legend-item' + (active === p.name ? ' on' : '') + (locked === p.name ? ' picked' : '')}
        onMouseEnter={() => onHover(p.name)} onFocus={() => onHover(p.name)} onBlur={() => onHover(null)}
        onClick={() => onLock(pick(locked, p.name))}>
        <span className="chart-swatch" style={{ background: tone(p.key) }}/>
        <span className="chart-legend-name">{p.name}</span>
        <span className="chart-legend-pct">{pct(p.amount, total)}%</span>
        <b>{yuan(p.amount)}</b>
      </button>
    </li>)}
  </ul>;
}

/** 读数区。六种形态共用同一个位置：滑过某类时显示它，否则显示这一形态的解读。 */
function Readout({ parts, total, active, locked, onLock, fallback }) {
  const hit = parts.find(p => p.name === active);
  return <div className="chart-readout" aria-live="polite">
    {hit ? <>
      <span className="chart-swatch" style={{ background: tone(hit.key) }}/>
      <b>{hit.name}</b>
      <span className="chart-readout-amt">{yuan(hit.amount)}</span>
      <span className="chart-readout-note">{pct(hit.amount, total)}% · {hit.count} 笔</span>
      <button type="button" className="chart-locate" onClick={() => onLock(pick(locked, hit.name))}>
        {locked === hit.name ? '看全部交易' : '只看这 ' + hit.count + ' 笔'}
      </button>
    </> : fallback}
  </div>;
}

/* ── 1 圆环：看结构 ──────────────────────────────────────────────────── */
const CX = 66, CY = 66, R_IN = 39, R_OUT = 52;

/* 用整块扇环（fill）而不是 strokeDasharray：扇面上任何一点都能命中，
   而不是只有那一圈描边。gap 也按扇面角度切，一笔数据时不留缺口。 */
function wedge(a0, a1) {
  const p = (r, a) => (CX + r * Math.cos(a)).toFixed(2) + ' ' + (CY + r * Math.sin(a)).toFixed(2);
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return 'M' + p(R_OUT, a0) + ' A' + R_OUT + ' ' + R_OUT + ' 0 ' + big + ' 1 ' + p(R_OUT, a1)
    + ' L' + p(R_IN, a1) + ' A' + R_IN + ' ' + R_IN + ' 0 ' + big + ' 0 ' + p(R_IN, a0) + ' Z';
}

export function Donut({ parts, total, active, locked, onHover, onLock }) {
  const gap = parts.length > 1 ? 0.03 : 0;
  let angle = -Math.PI / 2;
  const segs = parts.map(p => {
    const sweep = (p.amount / total) * Math.PI * 2;
    const cut = Math.min(gap, sweep / 3);
    const on = active === p.name;
    const el = <path key={p.name} d={wedge(angle + cut, angle + sweep - cut)} fill={tone(p.key)}
      className={'chart-seg' + (on ? ' on' : '') + (active && !on ? ' is-dim' : '')}
      tabIndex={0} role="button"
      aria-label={p.name + ' ' + yuan(p.amount) + '，占 ' + pct(p.amount, total) + '%'}
      onMouseEnter={() => onHover(p.name)} onFocus={() => onHover(p.name)} onBlur={() => onHover(null)}
      onClick={() => onLock(pick(locked, p.name))}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLock(pick(locked, p.name)); } }}/>;
    angle += sweep;
    return el;
  });
  const hit = parts.find(p => p.name === active);
  return <div className="chart-donut">
    <svg viewBox="0 0 132 132" role="img" aria-label="支出构成圆环图">
      {segs}
      <text x="66" y="56" className="chart-center-label">{hit ? hit.name : '支出合计'}</text>
      <text x="66" y="76" className="chart-center-value">{yuan(hit ? hit.amount : total)}</text>
      <text x="66" y="92" className="chart-center-sub">{hit ? pct(hit.amount, total) + '% · ' + hit.count + ' 笔' : parts.length + ' 个类目'}</text>
    </svg>
  </div>;
}

/* ── 2 条形：看排名与差距 ────────────────────────────────────────────── */
export function Bars({ parts, total, active, locked, onHover, onLock }) {
  const max = Math.max(...parts.map(p => p.amount), 1);
  return <div className="chart-bars">
    {parts.map(p => <button key={p.name} type="button" aria-pressed={locked === p.name}
      className={'chart-bar' + (active === p.name ? ' on' : '')}
      onMouseEnter={() => onHover(p.name)} onFocus={() => onHover(p.name)} onBlur={() => onHover(null)}
      onClick={() => onLock(pick(locked, p.name))}>
      <span className="chart-bar-label">{p.name}</span>
      <span className="chart-bar-track">
        <span className="chart-bar-fill" style={{ width: (p.amount / max * 100) + '%', background: tone(p.key) }}/>
      </span>
      <span className="chart-bar-pct">{pct(p.amount, total)}%</span>
      <b>{yuan(p.amount)}</b>
    </button>)}
  </div>;
}

/* ── 3 环比：看变化 ──────────────────────────────────────────────────── */
const deltaText = r => r.delta === null ? '上一期没有'
  : r.delta === 0 ? '持平'
  : (r.delta > 0 ? '多 ' : '少 ') + Math.abs(r.delta) + '%';

export function Compare({ compare, active, locked, onHover, onLock }) {
  const { rows, prev, cur } = compare;
  const max = Math.max(...rows.flatMap(r => [r.amount, r.prevAmount]), 1);
  return <div className={'chart-compare' + (prev ? '' : ' chart-compare--solo')}>
    <p className="compare-key">{prev
      ? <><span><i className="compare-dot"/>{prev}</span><span><i className="compare-dot compare-dot--cur"/>{cur}</span></>
      : '账本里只有这一期，还比不出变化。下个月起这里会显示每一类的涨落。'}</p>
    {rows.map(r => <button key={r.name} type="button" aria-pressed={locked === r.name}
      className={'compare-row' + (active === r.name ? ' on' : '')}
      onMouseEnter={() => onHover(r.name)} onFocus={() => onHover(r.name)} onBlur={() => onHover(null)}
      onClick={() => onLock(pick(locked, r.name))}>
      <span className="chart-bar-label">{r.name}</span>
      <span className="compare-tracks">
        {prev && <span className="compare-track"><i style={{ width: (r.prevAmount / max * 100) + '%' }}/></span>}
        <span className="compare-track"><i style={{ width: (r.amount / max * 100) + '%', background: tone(r.key) }}/></span>
      </span>
      {prev && <span className="compare-delta">{deltaText(r)}</span>}
    </button>)}
  </div>;
}

/* ── 4 占比：看时间轴上的构成 ────────────────────────────────────────── */
export function Stack({ weeks, active, locked, onHover, onLock }) {
  return <div className="chart-stack">
    {weeks.map(w => <div className="stack-col" key={w.label}>
      <div className="stack-bar">
        {w.segs.map(s => <button key={s.name} type="button"
          className={'stack-seg' + (active === s.name ? ' on' : '')}
          style={{ flexGrow: s.amount, background: tone(s.key) }}
          aria-label={w.label + ' ' + s.name + ' ' + yuan(s.amount)}
          onMouseEnter={() => onHover(s.name)} onFocus={() => onHover(s.name)} onBlur={() => onHover(null)}
          onClick={() => onLock(pick(locked, s.name))}/>)}
      </div>
      <span className="stack-label">{w.label}</span>
      <b className="stack-total">{yuan(w.amount)}</b>
    </div>)}
  </div>;
}

/* ── 5 热力：看哪一天 ────────────────────────────────────────────────── */
const DOW = ['一', '二', '三', '四', '五', '六', '日'];

export function Heat({ heat, day, onDay }) {
  return <div className="heat-grid" role="group" aria-label={'每日支出强度，' + heat.monthLabel}>
    {DOW.map(d => <span className="heat-dow" key={d}>{d}</span>)}
    {Array.from({ length: heat.pad }, (_, i) => <span className="heat-cell heat-cell--pad" key={'pad' + i}/>)}
    {heat.days.map(d => <button key={d.day} type="button" className="heat-cell" data-level={d.level}
      aria-label={heat.monthLabel + d.day + ' 日，' + (d.amount ? yuan(d.amount) + '，' + d.count + ' 笔' : '没有支出')}
      onMouseEnter={() => onDay(d.day)} onFocus={() => onDay(d.day)}
      onMouseLeave={() => onDay(null)} onBlur={() => onDay(null)}>{d.day}</button>)}
  </div>;
}

/* ── 6 趋势：看节奏 ──────────────────────────────────────────────────── */
const W = 520, H = 168, TOP = 26, BOT = 16, PX = 14;

export function Trend({ trend, day, onDay }) {
  const { points, max, peak } = trend;
  const n = points.length;
  if (!n) return null;
  const step = n > 1 ? (W - PX * 2) / (n - 1) : 0;
  const x = i => PX + i * step;
  const y = v => H - BOT - (v / (max || 1)) * (H - TOP - BOT);
  const line = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ');
  const area = line + ' L' + x(n - 1).toFixed(1) + ' ' + (H - BOT) + ' L' + x(0).toFixed(1) + ' ' + (H - BOT) + ' Z';
  const pk = points[peak];
  const anchor = x(peak) > W * .72 ? 'end' : x(peak) < W * .12 ? 'start' : 'middle';
  return <div className="chart-trend">
    <svg viewBox={'0 0 ' + W + ' ' + H} className="chart-line" role="img"
      aria-label={'每日累计支出折线图，单日峰值出现在 ' + pk.label}>
      {n > 1 && <path d={area} className="chart-area"/>}
      {n > 1
        ? <path d={line} className="chart-stroke"/>
        : <line x1={x(0)} y1={H - BOT} x2={x(0)} y2={y(points[0].value)} className="chart-stroke"/>}
      {points.map((p, i) => (i === peak ? null : <circle key={p.day} cx={x(i)} cy={y(p.value)} r="2.5"
        className={'chart-dot' + (day === p.day ? ' chart-dot--on' : '')}
        tabIndex={0} role="button" aria-label={p.label + '，累计 ' + yuan(p.value)}
        onMouseEnter={() => onDay(p.day)} onFocus={() => onDay(p.day)}
        onMouseLeave={() => onDay(null)} onBlur={() => onDay(null)}/>))}
      <line x1={x(peak)} y1={y(pk.value)} x2={x(peak)} y2={H - BOT} className="chart-guide"/>
      <circle cx={x(peak)} cy={y(pk.value)} r="4.5" className="chart-dot chart-dot--peak"/>
      <text x={x(peak)} y={Math.max(y(pk.value) - 12, 14)} className="chart-mark" textAnchor={anchor}>
        最猛的一天 {pk.label}
      </text>
    </svg>
    <div className="chart-axis">
      <span>{points[0].label}</span>
      <span>累计 {yuan(max)}</span>
      <span>{points[n - 1].label}</span>
    </div>
  </div>;
}

/* ── 形态壳 ──────────────────────────────────────────────────────────── */
const FORMS = [
  { id: 'donut', label: '圆环', hint: '看结构：钱集中在哪一类' },
  { id: 'bars', label: '条形', hint: '看排名：各类目差多少' },
  { id: 'compare', label: '环比', hint: '看变化：哪一类比上一期多花了' },
  { id: 'stack', label: '占比', hint: '看构成：每周的类目怎么变' },
  { id: 'heat', label: '热力', hint: '看日子：哪一天花得最猛' },
  { id: 'trend', label: '趋势', hint: '看节奏：这个月是匀速还是集中' },
];

export function SpendingChart({ model, active, onHover, onLock, filter }) {
  const [form, setForm] = useState('donut');
  const [day, setDay] = useState(null);
  const { parts, total, weeks, heat, compare, trend, spendCount } = model;
  const locked = filter === '全部' ? null : filter;
  const shape = { active, locked, onHover, onLock };
  const dayHit = day ? heat.days.find(d => d.day === day) : null;

  /* 读数区的兜底文案：有当天的明细就优先说当天，否则说这一形态在回答什么 */
  const fallback = dayHit
    ? <><b>{heat.monthLabel} {dayHit.day} 日</b>
        <span className="chart-readout-amt">{dayHit.amount ? yuan(dayHit.amount) : '没有支出'}</span>
        {dayHit.count > 0 && <span className="chart-readout-note">{dayHit.count} 笔</span>}
        {dayHit.segs.map(s => <button key={s.name} type="button" className="readout-tag"
          onMouseEnter={() => onHover(s.name)} onClick={() => onLock(pick(locked, s.name))}>
          <i style={{ background: tone(s.key) }}/>{s.name} {yuan(s.amount)}
        </button>)}</>
    : form === 'trend'
      ? <><span className="chart-readout-lead">{trend.insight.peakText}</span>
          <span className="chart-readout-note">{trend.insight.paceText}</span></>
      : form === 'heat'
        ? <b>日均 {yuan(heat.avg)}</b>
        /* 只留数据，不写操作说明。「滑过任意一段看细节，点一下只看这一类」是在教用户用图 ——
           U-05 要求用设计代替文字指引：热力格与扇区本来就带 hover 与点击，不需要一句说明书。 */
        : <span className="chart-readout-note">{spendCount} 笔 · {parts.length} 个类目</span>;

  return <div className="chart">
    <div className="chart-head">
      <div className="chart-tabs" aria-label="图表形态">
        {FORMS.map(f => <button key={f.id} type="button" aria-pressed={form === f.id}
          className={'chart-tab' + (form === f.id ? ' on' : '')}
          onClick={() => { setForm(f.id); setDay(null); }}>{f.label}</button>)}
      </div>
      <span className="chart-hint">{FORMS.find(f => f.id === form).hint}</span>
    </div>

    <div className="chart-track" onMouseLeave={() => { onHover(null); setDay(null); }}>
      <div className="chart-stage">
        {form === 'donut' && <Donut parts={parts} total={total} {...shape}/>}
        {form === 'bars' && <Bars parts={parts} total={total} {...shape}/>}
        {form === 'compare' && <Compare compare={compare} {...shape}/>}
        {form === 'stack' && <Stack weeks={weeks} {...shape}/>}
        {form === 'heat' && <Heat heat={heat} day={day} onDay={setDay}/>}
        {form === 'trend' && <Trend trend={trend} day={day} onDay={setDay}/>}
      </div>
      <Readout parts={parts} total={total} active={active} locked={locked} onLock={onLock} fallback={fallback}/>
    </div>

    <Legend parts={parts} total={total} active={active} locked={locked} onHover={onHover} onLock={onLock}/>
  </div>;
}
