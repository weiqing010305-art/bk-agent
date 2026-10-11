import React, { useRef, useState } from 'react';
import { Page, Panel, Empty } from '../parts.jsx';
import { api } from '../../api/client.js';
import './everydayServices.css';

const key = 'qinghe-savings-pending-v1';
const today = () => new Date().toLocaleDateString('sv-SE');
function pending() { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } }
const cents = text => /^\d+(\.\d{1,2})?$/.test(text) ? Math.round(Number(text) * 100) : 0;

export default function Savings({ ctx }) {
  const { bank, services, setServices, setRoute, yuan, moveSavings, backendMode, refreshBank } = ctx;
  const [goal, setGoal] = useState({ name: '', amount: '', date: '' });
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(pending);
  const [review, setReview] = useState(!!draft);
  const [uncertain, setUncertain] = useState(!!draft);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const composing = useRef(false), sending = useRef(false);
  const goals = services.savingsGoals || [];
  const saved = id => bank.savings?.[id] || 0;
  const total = Object.values(bank.savings || {}).reduce((n, value) => n + value, 0);
  const change = (field, value) => { setGoal(g => ({ ...g, [field]: value })); setError(''); };
  const saveGoal = e => {
    e.preventDefault(); if (composing.current) return;
    const target = cents(goal.amount);
    if (!goal.name.trim() || !Number.isSafeInteger(target) || target <= 0 || target > 100000000 || goal.date < today()) return setError('请填写名称、1,000,000 元以内的目标金额及有效目标日期。');
    if (editing && target < saved(editing)) return setError('目标金额不能低于已存金额。');
    const next = { id: editing || crypto.randomUUID(), name: goal.name.trim(), target, date: goal.date };
    setServices(s => ({ ...s, savingsGoals: editing ? s.savingsGoals.map(g => g.id === editing ? next : g) : [...(s.savingsGoals || []), next] }));
    setEditing(null); setGoal({ name: '', amount: '', date: '' }); setError(''); setMessage('储蓄目标已保存。');
  };
  const start = (g, direction) => {
    setDraft({ id: crypto.randomUUID(), goalId: g.id, direction, amountText: '', cardId: bank.cards.find(c => c.id !== 'credit' && c.status === 'active')?.id || '' });
    setReview(false); setError(''); setMessage(''); setPassword('');
  };
  const finish = () => { sessionStorage.removeItem(key); setDraft(null); setUncertain(false); setPassword(''); setMessage('资金划转成功，余额与计划进度已更新。'); };
  const transact = async e => {
    e.preventDefault(); if (composing.current || sending.current) return;
    setError('');
    try {
      const amount = cents(draft.amountText), g = goals.find(g => g.id === draft.goalId);
      if (!g) throw new Error('计划已不存在，请返回重新选择。');
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('请输入有效金额，最多两位小数。');
      if (draft.direction === 'deposit' && amount > g.target - saved(g.id)) throw new Error('存入金额不能超过目标剩余金额。');
      if (draft.direction === 'withdraw' && amount > saved(g.id)) throw new Error('取回金额不能超过已存金额。');
      if (draft.direction === 'deposit' && amount > bank.balance) throw new Error('可用余额不足。');
      if (!bank.cards.some(c => c.id === draft.cardId && c.id !== 'credit' && c.status === 'active')) throw new Error('请选择可用银行卡。');
      if (!review) { setReview(true); return; }
      if (password !== '123456') throw new Error('支付密码不正确，请重新输入。');
      sending.current = true; setBusy(true);
      if (backendMode) sessionStorage.setItem(key, JSON.stringify(draft));
      await moveSavings({ id: draft.id, goalId: draft.goalId, direction: draft.direction, cardId: draft.cardId, amount, password });
      finish();
    } catch (err) {
      setError(err.message); setPassword('');
      if (sending.current && backendMode && (!err.status || err.status >= 500)) setUncertain(true);
      else sessionStorage.removeItem(key);
    } finally { sending.current = false; setBusy(false); }
  };
  const query = async () => {
    if (sending.current) return; sending.current = true; setBusy(true); setError('');
    try { const r = await api('/operations/' + draft.id); if (r.status !== 'SUCCEEDED') throw new Error('结果未确认，请稍后再查。'); await refreshBank(); finish(); }
    catch (err) { if (err.status === 404) { setUncertain(false); sessionStorage.removeItem(key); setError('原请求未记账，可使用原编号重新确认。'); } else setError(err.message); }
    finally { sending.current = false; setBusy(false); }
  };
  return <Page title="储蓄计划" subtitle="为想做的事留一笔钱" aside={<button className="link-btn" onClick={() => setRoute('overview')}>返回概览</button>}>
    <Panel title="我的储蓄"><dl className="service-review"><div><dt>计划已存</dt><dd>{yuan(total)}</dd></div><div><dt>可用余额</dt><dd>{yuan(bank.balance)}</dd></div></dl><p className="page-note">存入后从可用余额中留出，随时可取回；不计利息，不自动扣款。</p></Panel>
    {message && <p role="status">{message}</p>}
    {draft ? <Panel title={draft.direction === 'deposit' ? '存入计划' : '取回资金'}>
      <form className="service-form" onSubmit={transact} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
        <p>{goals.find(g => g.id === draft.goalId)?.name || '原储蓄计划'}</p>
        {review ? <dl className="service-review"><div><dt>金额</dt><dd>{yuan(cents(draft.amountText))}</dd></div><div><dt>银行卡</dt><dd>尾号 {bank.cards.find(c => c.id === draft.cardId)?.tail}</dd></div></dl> : <>
          <label className="service-field">金额（元）<input required inputMode="decimal" value={draft.amountText} onChange={e => setDraft(d => ({ ...d, amountText: e.target.value }))}/></label>
          <label className="service-field">银行卡<select required value={draft.cardId} onChange={e => setDraft(d => ({ ...d, cardId: e.target.value }))}><option value="">请选择银行卡</option>{bank.cards.filter(c => c.id !== 'credit').map(c => <option key={c.id} value={c.id} disabled={c.status !== 'active'}>{c.name} · 尾号 {c.tail}{c.status !== 'active' ? '（已冻结）' : ''}</option>)}</select></label>
        </>}
        {review && !uncertain && <label className="service-field">支付密码<input required type="password" inputMode="numeric" maxLength={6} autoComplete="off" value={password} onChange={e => setPassword(e.target.value)}/><small>演示密码：123456</small></label>}
        {uncertain ? <button type="button" className="a2ui-btn a2ui-btn--primary" disabled={busy} onClick={query}>查询原划转结果</button> : <div className="service-actions"><button className="a2ui-btn a2ui-btn--primary" disabled={busy}>{busy ? '处理中…' : review ? '确认划转' : '下一步'}</button><button type="button" className="link-btn" disabled={busy} onClick={() => { setDraft(null); setError(''); setPassword(''); }}>取消</button></div>}
      </form>
    </Panel> : <>
      <Panel title="我的目标">{!goals.length ? <Empty>还没有目标，先为一次旅行或一笔备用金定个计划。</Empty> : goals.map(g => {
        const amount = saved(g.id), left = Math.max(0, g.target - amount);
        const months = Math.max(1, Math.ceil((new Date(g.date + 'T12:00:00') - new Date()) / (86400000 * 30)));
        return <section className="savings-goal" key={g.id}><h3>{g.name}</h3><p>{yuan(amount)} / {yuan(g.target)} · {amount >= g.target ? '目标已达成' : g.date < today() ? '目标日期已过，可调整计划' : '目标日期 ' + g.date}</p><progress max={g.target} value={amount} aria-label={g.name + '储蓄进度'}/><p className="page-note">{left ? `还差 ${yuan(left)}，按剩余时间每月约存 ${yuan(Math.ceil(left / months))}` : '已经存够了，随时可以取回使用。'}</p><div className="service-actions">
          <button className="a2ui-btn a2ui-btn--primary" disabled={!left} onClick={() => start(g, 'deposit')}>存入</button><button className="a2ui-btn a2ui-btn--secondary" disabled={!amount} onClick={() => start(g, 'withdraw')}>取回</button>
          <button className="link-btn" onClick={() => { setEditing(g.id); setGoal({ name: g.name, amount: String(g.target / 100), date: g.date }); setError(''); }}>修改目标</button>
          <button className="link-btn" disabled={!!amount} title={amount ? '先取回全部资金，再删除目标' : ''} onClick={() => { setServices(s => ({ ...s, savingsGoals: s.savingsGoals.filter(x => x.id !== g.id) })); if (editing === g.id) { setEditing(null); setGoal({ name: '', amount: '', date: '' }); } }}>删除空计划</button>
        </div></section>;
      })}</Panel>
      <Panel title={editing ? '修改目标' : '创建储蓄目标'}><form className="service-form" onSubmit={saveGoal} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
        <label className="service-field">目标名称<input required maxLength={30} placeholder="例如：旅行基金、应急备用金" value={goal.name} onChange={e => change('name', e.target.value)}/></label>
        <label className="service-field">目标金额（元）<input required inputMode="decimal" value={goal.amount} onChange={e => change('amount', e.target.value)}/></label>
        <label className="service-field">目标日期<input required type="date" min={today()} value={goal.date} onChange={e => change('date', e.target.value)}/></label>
        <div className="service-actions"><button className="a2ui-btn a2ui-btn--primary">保存目标</button>{editing && <button type="button" className="link-btn" onClick={() => { setEditing(null); setGoal({ name: '', amount: '', date: '' }); }}>取消修改</button>}</div>
      </form></Panel>
    </>}
    {error && <p className="service-error" role="alert">{error}</p>}
    <p className="page-note">演示资金划转。目标名称和日期保存在此浏览器。</p>
  </Page>;
}
