import React, { useMemo } from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { overviewInsights } from '../../domain/overviewInsights.js';

export default function HomeInsights({ bank, hidden, onGo, format }) {
  const report = useMemo(() => overviewInsights(bank.transactions), [bank.transactions]);
  const show = value => hidden ? '¥ ••••' : format(value);
  return <section className="home-insights" aria-label="账本收支摘要">
    <header><h2>收支一览</h2><span>{report.month ? `${report.month.replace('-', ' 年 ')} 月` : '暂无账期'}</span>
      <button type="button" className="link-btn" onClick={() => onGo('bills')}>查看账单<ChevronRight size={15}/></button></header>
    {report.month ? <div className="home-insights-body">
      <dl><div><dt>账本收入</dt><dd>{show(report.income)}</dd></div><div><dt>账本支出</dt><dd>{show(report.expense)}</dd></div></dl>
      <div className="home-spending">
        <div className="home-spending-heading"><span>支出构成</span><small>{report.count} 笔收支</small></div>
        {hidden ? <p className="home-spending-hidden">金额与占比已隐藏</p> : report.expense ? <>
          <div className="home-spending-bar" aria-hidden="true">{report.parts.map((p, i) => <i key={p.name} data-tone={i} style={{ flexGrow: p.amount }}/>)}</div>
          <div className="home-spending-legend">{report.parts.map((p, i) => <span key={p.name}><i data-tone={i}/>{p.name}<b>{format(p.amount)}</b></span>)}</div>
        </> : <p className="home-spending-hidden">本账期暂无支出</p>}
      </div>
    </div> : <button className="home-insights-empty" onClick={() => onGo('bills')}>记账后，在这里查看收支与分类<ArrowUpRight size={18}/></button>}
  </section>;
}
