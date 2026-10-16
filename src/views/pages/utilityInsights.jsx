import React, { useMemo, useState } from 'react';
import { Droplets, Flame, Zap, ReceiptText, ChevronDown, RotateCcw } from 'lucide-react';
import { Panel, Empty } from '../parts.jsx';
import { utilityNames } from '../../domain/payments.js';
import { utilityReport } from '../../domain/utilityInsights.js';
import './utilityInsights.css';

const icons = { water: Droplets, electricity: Zap, gas: Flame, other: ReceiptText };
const monthLabel = month => month.replace('-', ' 年 ') + ' 月';
export function UtilityTypes({ value, onChange }) {
  return <div className="utility-types" role="group" aria-label="缴费类型">
    {Object.entries(utilityNames).map(([id, name]) => {
      const Icon = icons[id];
      return <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)}>
        <span className="utility-icon"><Icon size={20}/></span><b>{name}</b>
      </button>;
    })}
  </div>;
}

export function useUtilityReport(transactions) {
  const [month, setMonth] = useState(null);
  const report = useMemo(() => utilityReport(transactions, month), [transactions, month]);
  return { report, setMonth };
}

export function UtilityOverview({ report, setMonth, filter, setFilter, yuan }) {
  const max = Math.max(1, ...report.trend.map(t => t.amount));
  return <Panel className="utility-overview" title="缴费支出" aside={
    <label className="utility-period">
      <select aria-label="缴费月份" value={report.month} onChange={e => { setMonth(e.target.value); setFilter('all'); }}>
        {report.months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
    </label>}>
    <div className="utility-summary-grid">
      <section className="utility-composition" aria-label="支出构成">
        <div className="utility-total" data-data><strong>{yuan(report.total)}</strong><span>{report.rows.length} 笔已缴</span></div>
        <div className="utility-share" aria-hidden="true">{report.parts.map(p => <span key={p.id} data-kind={p.id} style={{ flexGrow: p.amount }}/>)}</div>
        <div className="utility-legend" role="group" aria-label="筛选缴费记录">
          {report.parts.map(p => <button key={p.id} type="button" aria-pressed={filter === p.id}
            onClick={() => setFilter(filter === p.id ? 'all' : p.id)}>
            <i data-kind={p.id}/><span>{p.name}</span><b data-data>{yuan(p.amount)}</b><small data-data>{p.percent}%</small>
          </button>)}
        </div>
      </section>
      <section className={'utility-trend' + (report.trend.every(t => !t.count) ? ' utility-trend--empty' : '')} aria-label="最近六个月缴费趋势">
        <h3>近 6 个月<span>点击月份查看</span></h3>
        {report.trend.every(t => !t.count) && <p className="utility-trend-empty">缴费后，在这里查看每月支出变化</p>}
        <div className="utility-columns" data-data>{report.trend.map(t => <button type="button" key={t.month}
          aria-label={`${monthLabel(t.month)}，${t.count ? yuan(t.amount) : '无缴费记录'}`}
          aria-pressed={t.month === report.month} onClick={() => { setMonth(t.month); setFilter('all'); }}>
          <span className="utility-bar-track"><i style={{ height: `${t.amount / max * 100}%` }}/></span>
          <b>{t.count ? yuan(t.amount) : '—'}</b><small>{t.month.slice(5)} 月</small>
        </button>)}</div>
      </section>
    </div>
  </Panel>;
}

export function UtilityHistory({ report, filter, setFilter, onRepeat, canRepeat, yuan }) {
  const [expanded, setExpanded] = useState(null);
  const rows = filter === 'all' ? report.rows : report.rows.filter(t => t.kind === filter);
  return <Panel className="utility-history" title="缴费记录" aside={filter !== 'all'
    ? <button className="link-btn" onClick={() => setFilter('all')}>看全部</button>
    : <span className="panel-hint">{rows.length} 笔</span>}>
    {!rows.length ? <Empty icon={ReceiptText} title="暂无缴费记录"><span>缴费完成后，这里会显示金额与户号。</span></Empty>
      : <ul className="utility-records" data-data>{rows.map(t => {
        const Icon = icons[t.kind];
        const open = expanded === t.id;
        return <li key={t.id}>
          <button className="utility-record" aria-expanded={open} onClick={() => setExpanded(open ? null : t.id)}>
            <span className="utility-icon"><Icon size={18}/></span>
            <span><b>{t.name}</b><small>{t.date}</small></span><strong>{yuan(t.cost)}</strong><ChevronDown size={16}/>
          </button>
          {open && <div className="utility-record-detail">
            <dl><div><dt>户号</dt><dd>{t.target || '未提供'}</dd></div><div><dt>流水编号</dt><dd>{t.id}</dd></div><div><dt>状态</dt><dd>已缴费</dd></div></dl>
            {t.target && t.kind !== 'other' && <button className="link-btn" disabled={!canRepeat} onClick={() => onRepeat(t)}><RotateCcw size={14}/>再次缴费</button>}
          </div>}
        </li>;
      })}</ul>}
  </Panel>;
}
