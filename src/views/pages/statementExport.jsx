import React, { useState } from 'react';
import { Empty, Page, Panel } from '../parts.jsx';
import { statementRows, statementCsv } from '../../domain/statement.js';
import './everydayServices.css';

export default function StatementExport({ ctx }) {
  const { bank, yuan, setRoute } = ctx;
  const dates = bank.transactions.map(t => t.date).sort();
  const today = new Date().toLocaleDateString('sv-SE');
  const [range, setRange] = useState({ start: dates[0] || today, end: dates.at(-1) || today, direction: 'all' });
  const [status, setStatus] = useState('');
  let rows = [], error = '';
  try { rows = statementRows(bank.transactions, range); } catch (e) { error = e.message; }
  const update = (key, value) => { setRange(r => ({ ...r, [key]: value })); setStatus(''); };
  const download = () => {
    if (error || !rows.length) return;
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([statementCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
    link.href = url; link.download = `青禾银行流水_${range.start}_${range.end}.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`已导出 ${rows.length} 笔流水。`);
  };
  const income = rows.filter(t => t.amount > 0).reduce((n, t) => n + t.amount, 0);
  const expense = -rows.filter(t => t.amount < 0).reduce((n, t) => n + t.amount, 0);
  return <Page title="银行流水" subtitle="筛选交易记录，预览并下载流水" aside={<button className="link-btn" onClick={() => setRoute('bills')}>返回账单</button>}>
    <Panel title="流水导出" aside={<span className="panel-hint">CSV 文件</span>}>
    <div className="statement-filters">
      <label className="service-field">开始日期<input type="date" value={range.start} onChange={e => update('start', e.target.value)}/></label>
      <label className="service-field">结束日期<input type="date" value={range.end} onChange={e => update('end', e.target.value)}/></label>
      <label className="service-field">收支类型<select value={range.direction} onChange={e => update('direction', e.target.value)}><option value="all">全部收支</option><option value="income">仅收入</option><option value="expense">仅支出</option></select></label>
    </div>
    {error ? <p className="service-error" role="alert">{error}</p> : <>
      <p>共 {rows.length} 笔 · 收入 {yuan(income)} · 支出 {yuan(expense)}</p>
      {rows.length ? <div className="statement-preview"><table><caption>流水预览（显示前 10 笔，导出包含全部筛选结果）</caption><thead><tr><th>日期</th><th>交易名称</th><th>类别</th><th>金额</th></tr></thead><tbody>{rows.slice(0, 10).map(t => <tr key={t.id}><td>{t.date}</td><td>{t.name}</td><td>{t.category}</td><td>{t.amount > 0 ? '+' : '−'}{yuan(Math.abs(t.amount))}</td></tr>)}</tbody></table></div> : <Empty>所选日期和类型下没有交易，请调整筛选条件。</Empty>}
    </>}
    <button type="button" className="a2ui-btn a2ui-btn--primary" onClick={download} disabled={!!error || !rows.length}>下载流水 CSV</button>
    <p role="status">{status}</p>
    <p className="page-note">文件包含当前演示账本流水，不是银行盖章证明。请妥善保存。</p>
    </Panel>
  </Page>;
}
