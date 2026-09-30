import React from 'react';

/**
 * 账单日历：哪一天有什么扣费（PRD §10.4 F5-01）。
 *
 * 格子里**只放已知的那几笔**（代扣、推断出的周期支出、预计收入、试算）。
 * 日常预算每天都有，把它也铺进来会让 30 个格子全是"有事" —— 日历就不再是日历了。
 * 它的去向是曲线（每天都算进去了）与缺口明细（合并成一行）。
 *
 * 点任意一格看来源：来源文字写在行里，是数据不是文案（D-01 的口径）。
 */
const DOW = ['一', '二', '三', '四', '五', '六', '日'];

export default function ForecastCalendar({ days, day, onDay }) {
  const first = days[0];
  /* 周一开头：leading 空格的个数 = 第一天是周几（周日推到第 7 格）。 */
  const lead = (new Date(first.date + 'T00:00:00').getDay() + 6) % 7;
  const hit = day != null ? days[day] : null;

  return <div className="fc-cal">
    <div className="fc-cal-head" aria-hidden="true">
      {DOW.map(d => <span key={d} className="fc-cal-dow">{d}</span>)}
    </div>
    <div className="fc-cal-grid" role="group" aria-label="账单日历">
      {Array.from({ length: lead }, (_, i) => <span key={'pad' + i} className="fc-cell fc-cell--pad"/>)}
      {days.map((d, i) => <button key={d.date} type="button"
        className={'fc-cell' + (i === day ? ' on' : '') + (d.isLow ? ' is-low' : '') + (d.isShort ? ' is-short' : '')}
        aria-pressed={i === day} aria-label={cellLabel(d)} onClick={() => onDay(i === day ? null : i)}>
        <span className="fc-day">{d.day}</span>
        <span className="fc-marks">
          {d.items.slice(0, 3).map((it, k) => <i key={it.key + k} className={'fc-markdot fc-markdot--' + it.kind}
            data-in={it.inflow ? '1' : '0'}/>)}
          {d.items.length > 3 && <i className="fc-more">+{d.items.length - 3}</i>}
        </span>
      </button>)}
    </div>
    <div className="fc-cal-detail">
      {!hit
        ? <p className="fc-hint">点某一天看来源</p>
        : hit.items.length === 0
          ? <p className="fc-hint">这天没有安排</p>
          : <ul className="row-list">
              <li className="row-item fc-src">
                <span className="row-main"><strong>{hit.label} 周{hit.weekday}</strong></span>
              </li>
              {hit.items.map((it, k) => <li className="row-item" key={it.key + k}>
                <span className={'fc-src-dot fc-markdot--' + it.kind} aria-hidden="true"/>
                <span className="row-main">
                  <strong>{it.name}</strong>
                  <small>{it.sourceText}</small>
                </span>
                <b className={'amount' + (it.inflow ? ' amount--in' : '')}>{it.amountText}</b>
              </li>)}
            </ul>}
    </div>
  </div>;
}

/** 读屏拿到的是一句话，不是「一个格子 + 几个点」。 */
function cellLabel(d) {
  const parts = d.items.map(it => it.name + ' ' + it.amountText);
  return d.label + (parts.length ? '，' + parts.join('，') : '，没有安排') + (d.isLow ? '，预计低点' : '');
}
