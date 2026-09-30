import React from 'react';

/**
 * 未来余额曲线。手绘 SVG，零依赖 —— 与 views/charts.jsx 同一套做法：
 * 图形元素自己就是命中区，滑过哪一天就是哪一天，不需要坐标反查。
 *
 * 三条设计决定：
 *   · **两条线同时在场**。PRD 的创意点是「这笔钱现在花掉，会影响哪一天」，
 *     只给一个结果数字，用户没法比较；基准（实线）与试算（虚线）画在一起，
 *     比较这件事就不需要用户自己做。
 *   · **零线以下铺一层极淡的危险底色**。那是「会出现缺口」的区域 ——
 *     用形状说，不写句子（D-03：能画出来的不写出来）。
 *   · 键盘可达性走日历那一排真按钮（30 个 <button>），这里的矩形只接指针。
 *     图表本身 role="img" + 一句概括，读屏用户拿到的是结论，不是 30 个坐标。
 */
const W = 720, H = 200, TOP = 34, BOT = 24, PX = 12;

export default function ForecastChart({ base, trial, day, onDay }) {
  const series = base.series;
  const n = series.length;
  if (!n) return null;

  const values = [...series.map(d => d.balance), ...(trial ? trial.series.map(d => d.balance) : []), 0, base.buffer];
  const min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max(2000, (max - min) * 0.08);
  const lo = min - pad, hi = max + pad;
  const step = n > 1 ? (W - PX * 2) / (n - 1) : 0;
  const x = i => PX + i * step;
  const y = v => H - BOT - ((v - lo) / (hi - lo)) * (H - TOP - BOT);
  const line = list => list.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.balance).toFixed(1)).join(' ');
  const stroke = line(series);
  const area = stroke + ' L' + x(n - 1).toFixed(1) + ' ' + (H - BOT) + ' L' + x(0).toFixed(1) + ' ' + (H - BOT) + ' Z';
  const hit = day != null ? series[day] : null;

  /** 低点标注：数字在上、日期在下。贴着边的那几天把文字拉回画布内。 */
  const mark = (i, balance, amountText, dateLabel, tone) => {
    if (i == null) return null;
    const cx = x(i), cy = y(balance);
    const anchor = cx > W * 0.86 ? 'end' : cx < W * 0.14 ? 'start' : 'middle';
    const dy = cy > TOP + 26 ? -14 : 22;
    return <g className={'fc-mark fc-mark--' + tone}>
      <line x1={cx} x2={cx} y1={cy} y2={H - BOT} className="fc-guide"/>
      <circle cx={cx} cy={cy} r="4.5" className="fc-dot"/>
      <text x={cx} y={cy + dy} className="fc-mark-amt" textAnchor={anchor}>{amountText}</text>
      <text x={cx} y={cy + dy + (dy < 0 ? -13 : 13)} className="fc-mark-date" textAnchor={anchor}>{dateLabel}</text>
    </g>;
  };

  return <div className="fc-chart">
    <svg viewBox={'0 0 ' + W + ' ' + H} className="fc-svg" role="img"
      aria-label={'未来 ' + n + ' 天余额曲线，预计低点 ' + base.low.balanceText + ' 出现在 ' + base.low.label}
      onMouseLeave={() => onDay(null)}>
      {lo < 0 && <rect x="0" y={y(0)} width={W} height={Math.max(0, H - BOT - y(0))} className="fc-band"/>}
      <path d={area} className="fc-area"/>
      {base.buffer > lo && <line x1="0" x2={W} y1={y(base.buffer)} y2={y(base.buffer)} className="fc-buffer"/>}
      {lo < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="fc-zero"/>}
      <path d={stroke} className="fc-line"/>
      {trial && <path d={line(trial.series)} className="fc-ghost"/>}
      {trial && mark(trial.low.index, trial.low.balance, trial.low.balanceText, trial.low.label, 'ghost')}
      {hit && <line x1={x(day)} x2={x(day)} y1={TOP - 14} y2={H - BOT} className="fc-cursor"/>}
      {hit && <circle cx={x(day)} cy={y(hit.balance)} r="4" className="fc-dot fc-dot--on"/>}
      {mark(base.low.index, base.low.balance, base.low.balanceText, base.low.label, 'low')}
      {base.buffer > lo && <text x={W} y={y(base.buffer) - 6} className="fc-note" textAnchor="end">缓冲</text>}
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x(i) - step / 2} y="0" width={Math.max(step, 2)} height={H} className="fc-hit"
          onMouseEnter={() => onDay(i)}/>
      ))}
    </svg>
    <div className="fc-axis">
      <span>{series[0].label}</span>
      <span className="fc-axis-legend">
        <i className="fc-key fc-key--base"/>基准
        {trial && <><i className="fc-key fc-key--ghost"/>试算</>}
      </span>
      <span>{series[n - 1].label}</span>
    </div>
  </div>;
}
