import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, CircleHelp, CreditCard, LockKeyhole, Menu, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react';
import { contacts, intent, money, seed, totals, transfer } from './bank.js';
import './style.css';
import './refinement.css';

const actions = [
  { id: 'transfer', label: '智能转账', hint: '给朋友转账，几步搞定', icon: ArrowUpRight, tone: 'mint' },
  { id: 'bills', label: '账单分析', hint: '看懂每一笔钱的去向', icon: BarChart3, tone: 'blue' },
  { id: 'subscriptions', label: '订阅管理', hint: '整理每月自动扣费', icon: RotateCcw, tone: 'peach' },
  { id: 'cards', label: '卡片管理', hint: '卡片状态，随时掌握', icon: CreditCard, tone: 'lilac' },
];
const workflowKinds = new Set(actions.map(a => a.id));
const uid = () => crypto.randomUUID();
const yuan = n => `¥${money(n)}`;
const initialMessages = [
  { id: 'welcome', role: 'assistant', kind: 'welcome', time: '09:41' }
];
function loadState() { try { const s = JSON.parse(localStorage.getItem('qinghe-mock-v1')); if (s && Number.isSafeInteger(s.balance) && Array.isArray(s.transactions) && Array.isArray(s.cards) && Array.isArray(s.subscriptions) && Array.isArray(s.completed)) return s; } catch {} return seed(); }

function App() {
  const [bank, setBank] = useState(loadState);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState('home');
  const [mobileNav, setMobileNav] = useState(false);
  const [transferDraft, setTransferDraft] = useState({ contactId: '', amount: '', note: '' });
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [billFilter, setBillFilter] = useState('全部');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { localStorage.setItem('qinghe-mock-v1', JSON.stringify(bank)); }, [bank]);
  useEffect(() => {
    const last = messages.at(-1);
    if (!last || last.kind === 'welcome') return;
    const scroller = scrollRef.current;
    const target = [...scroller.querySelectorAll('[data-message-id]')].at(-1);
    if (!target) return;
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 18;
    scroller.scrollTo({ top, behavior: 'smooth' });
  }, [messages]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const onKeyDown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setMessages(initialMessages); setActive('home'); setMobileNav(false); inputRef.current?.focus();
      }
      if (e.key === 'Escape') { setConfirm(null); setMobileNav(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const addMessage = (role, kind, text = '') => setMessages(prev => [...prev, { id: uid(), role, kind, text, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }]);
  const open = (id, withUser = true) => {
    setMobileNav(false); setActive(id);
    if (withUser) addMessage('user', 'text', actions.find(a => a.id === id)?.label || id);
    addMessage('assistant', id);
    if (id === 'transfer') setTransferDraft({ contactId: '', amount: '', note: '' });
  };
  const submit = e => { e.preventDefault(); const text = draft.trim(); if (!text) return; setDraft(''); addMessage('user', 'text', text); const id = intent(text); if (id === 'unknown') { setActive('home'); addMessage('assistant', 'unknown'); } else open(id, false); };
  const onTransfer = e => {
    e.preventDefault();
    const number = Number(transferDraft.amount);
    if (!transferDraft.contactId) return setToast('请选择收款人');
    if (!/^\d+(\.\d{1,2})?$/.test(transferDraft.amount) || number <= 0) return setToast('请输入有效金额，最多两位小数');
    const amount = Math.round(number * 100);
    if (amount > bank.balance) return setToast('余额不足，请修改金额');
    setConfirm({ type: 'transfer', contactId: transferDraft.contactId, amount, note: transferDraft.note, id: uid() });
  };
  const applyConfirmation = () => {
    if (!confirm) return;
    const action = confirm; setConfirm(null);
    if (action.type === 'transfer') {
      try { setBank(prev => transfer(prev, action)); setTransferDraft({ contactId: '', amount: '', note: '' }); addMessage('assistant', 'success', `已模拟转账 ${yuan(action.amount)} 给 ${contacts.find(c=>c.id===action.contactId)?.name}。余额和账单已更新。`); setToast('模拟转账完成'); } catch (err) { setToast(err.message); }
    } else if (action.type === 'cancel') {
      setBank(prev => ({ ...prev, subscriptions: prev.subscriptions.map(s => s.id === action.id ? { ...s, status: 'canceled' } : s) }));
      addMessage('assistant', 'success', `${action.name} 已在演示数据中取消，后续扣费计划已移除。`); setToast('订阅已模拟取消');
    } else if (action.type === 'freeze') {
      setBank(prev => ({ ...prev, cards: prev.cards.map(c => c.id === action.id ? { ...c, status: action.status } : c) }));
      addMessage('assistant', 'success', `尾号 ${action.tail} 的卡片已${action.status === 'frozen' ? '模拟冻结' : '模拟解冻'}。`); setToast('卡片状态已更新');
    } else if (action.type === 'reset') {
      setBank(seed()); setMessages(initialMessages); setActive('home'); setToast('演示数据已重置');
    }
  };
  const summary = totals(bank);
  const activeSubs = bank.subscriptions.filter(s => s.status === 'active');
  const latestWorkflowId = [...messages].reverse().find(m => workflowKinds.has(m.kind))?.id;
  const filtered = billFilter === '全部' ? bank.transactions : bank.transactions.filter(t => t.category === billFilter);
  const closeNav = () => setMobileNav(false);
  return <div className="app-shell">
    {mobileNav && <button className="nav-scrim" aria-label="关闭导航" onClick={closeNav}/>}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-symbol"><span>青</span></div><div><strong>青禾</strong><small>AI BANKING</small></div><button className="mobile-close" onClick={closeNav} aria-label="关闭菜单"><X size={19}/></button></div>
      <button className={`nav-new ${active === 'home' ? 'selected' : ''}`} onClick={() => { setMessages(initialMessages); setActive('home'); closeNav(); }}><Plus size={18}/> 新对话 <span>Ctrl K</span></button>
      <div className="nav-section-label">探索服务</div>
      <nav className="side-nav" aria-label="银行服务">{actions.map(a => <button key={a.id} className={active === a.id ? 'current' : ''} onClick={() => open(a.id)}><a.icon size={18}/><span>{a.label}</span><ArrowRight size={14} className="nav-arrow"/></button>)}</nav>
      <button className="reset-nav" onClick={() => { closeNav(); setConfirm({type:'reset'}); }}><RotateCcw size={16}/> 重置演示数据</button>
      <div className="sidebar-bottom"><div className="support"><div className="support-icon"><Sparkles size={17}/></div><div><strong>让每笔钱都更清晰</strong><p>从一句话开始，管理日常银行事务。</p></div></div><div className="profile"><span className="avatar">林</span><span><strong>林小禾</strong><small>演示账户</small></span></div></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="menu-button" onClick={() => setMobileNav(true)} aria-label="打开菜单"><Menu size={21}/></button><span className="breadcrumb">工作台</span><span className="slash">/</span><strong>{active === 'home' ? '新对话' : actions.find(a=>a.id===active)?.label}</strong></div><div className="topbar-right"><span className="mock-badge"><span/> 演示环境</span><span className="topbar-date">2026 年 9 月 25 日</span><button className="icon-button help-button" title="这是模拟数据与规则回复" onClick={() => setToast('当前为本地模拟演示：无真实转账，也未接入 AI 模型。')}><CircleHelp size={18}/></button></div></header>
      <main className="workspace"><div className="conversation" ref={scrollRef}>
        <div className="conversation-inner">
          {messages.map((m) => <div className={`message ${m.role}`} data-message-id={m.id} key={m.id}>
            {m.role === 'assistant' && <span className="bot-avatar"><Sparkles size={17}/></span>}
            <div className="message-body">{m.role === 'assistant' && <div className="message-name">青禾助手 <span>{m.time}</span></div>}
              {m.kind === 'welcome' && <div className="welcome-content"><span className="eyebrow">YOUR FINANCES, IN FOCUS</span><h1>你好，小禾。<br/><em>今天想先处理什么？</em></h1><p>一句话就可以开始。转账、看账单、整理订阅，或管理你的卡片。</p><div className="action-grid">{actions.map(a => <button className={`action-card ${a.tone}`} key={a.id} onClick={() => open(a.id)}><span className="action-icon"><a.icon size={21}/></span><strong>{a.label}</strong><small>{a.hint}</small><ArrowUpRight className="card-arrow" size={17}/></button>)}</div><div className="demo-note"><ShieldCheck size={16}/><span>安全演示空间 · 所有信息均为模拟数据，不产生真实交易</span></div></div>}
              {m.kind === 'text' && <div className="user-bubble">{m.text}</div>}
              {m.kind === 'unknown' && <div className="assistant-bubble"><p>我可以帮你处理这四类演示业务。选一个继续吧：</p><div className="mini-actions">{actions.map(a=><button key={a.id} onClick={()=>open(a.id)}>{a.label}<ArrowRight size={13}/></button>)}</div></div>}
              {m.kind === 'success' && <div className="assistant-bubble success-bubble"><Check size={18}/><p>{m.text}</p></div>}
              {workflowKinds.has(m.kind) && m.id !== latestWorkflowId ? <div className="assistant-bubble archived-workflow"><span>{actions.find(a => a.id === m.kind)?.label} · 已收起</span><button onClick={() => open(m.kind)}>重新打开 <ArrowRight size={13}/></button></div> : <>
              {m.kind === 'transfer' && <div className="assistant-bubble"><p className="reply-intro">好的，我们来转一笔账。请确认收款人和金额，我会先展示核对信息。</p><div className="module-card"><div className="module-head"><div className="module-icon mint"><ArrowUpRight size={20}/></div><div><small>智能转账</small><h3>发起一笔转账</h3></div><span className="step-label">01 / 02</span></div><form onSubmit={onTransfer} className="transfer-form"><label>收款人<select value={transferDraft.contactId} onChange={e=>setTransferDraft({...transferDraft,contactId:e.target.value})}><option value="">请选择常用收款人</option>{contacts.map(c=><option value={c.id} key={c.id}>{c.name}　{c.number}</option>)}</select></label><label>转账金额<div className="amount-input"><span>¥</span><input inputMode="decimal" placeholder="0.00" value={transferDraft.amount} onChange={e=>setTransferDraft({...transferDraft,amount:e.target.value})}/></div></label><label>备注 <span className="optional">选填</span><input maxLength="30" placeholder="例如：周末聚餐" value={transferDraft.note} onChange={e=>setTransferDraft({...transferDraft,note:e.target.value})}/></label><div className="form-bottom"><span>可用余额 <strong>{yuan(bank.balance)}</strong></span><button className="primary-btn" type="submit">核对转账信息 <ArrowRight size={16}/></button></div></form></div><p className="under-card-note"><LockKeyhole size={13}/> 模拟转账，确认后同步更新余额与账单</p></div>}
              {m.kind === 'bills' && <div className="assistant-bubble"><p className="reply-intro">这是你 9 月的收支概览。点选分类可查看对应明细。</p><div className="module-card bills-card"><div className="module-head"><div className="module-icon blue"><BarChart3 size={20}/></div><div><small>账单分析</small><h3>九月资金流向</h3></div><span className="period-pill">2026.09 <ChevronDown size={13}/></span></div><div className="bill-summary"><div><small>本月支出</small><strong>{yuan(summary.spending)}</strong><span>包含转账与消费</span></div><div><small>本月收入</small><strong>{yuan(summary.income)}</strong><span>共 {bank.transactions.filter(t=>t.amount>0).length} 笔入账</span></div></div><div className="chart-title">支出分布 <span>单位：人民币</span></div><div className="bar-chart">{summary.categories.map((c,i)=><button key={c.name} className={`bar-row ${billFilter===c.name?'active':''}`} onClick={()=>setBillFilter(billFilter===c.name?'全部':c.name)}><span>{c.name}</span><span className="bar-track"><span className={`bar-fill bar-${i}`} style={{width:`${summary.spending ? (c.amount/summary.spending*100) : 0}%`}}/></span><strong>{yuan(c.amount)}</strong></button>)}</div><div className="transactions-head"><strong>交易明细</strong><select aria-label="账单分类" value={billFilter} onChange={e=>setBillFilter(e.target.value)}>{['全部','转账','餐饮','购物','交通','订阅','收入'].map(v=><option key={v}>{v}</option>)}</select></div><div className="transactions">{filtered.map(t=><div className="transaction" key={t.id}><span className={`tx-icon ${t.amount>0?'income':''}`}>{t.amount>0?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><div><strong>{t.name}</strong><small>{t.date} · {t.category}</small></div><b className={t.amount>0?'positive':''}>{t.amount>0?'+':'−'}{yuan(Math.abs(t.amount))}</b></div>)}</div></div></div>}
              {m.kind === 'subscriptions' && <div className="assistant-bubble"><p className="reply-intro">我找到 {activeSubs.length} 项正在续费的服务，每月合计 <strong>{yuan(activeSubs.reduce((n,s)=>n+s.amount,0))}</strong>。你可以查看并模拟取消。</p><div className="module-card"><div className="module-head"><div className="module-icon peach"><RotateCcw size={20}/></div><div><small>订阅管理</small><h3>自动续费清单</h3></div><span className="count-pill">{activeSubs.length} 项进行中</span></div><div className="subscription-list">{bank.subscriptions.map((s,i)=><div className={`subscription ${s.status==='canceled'?'muted':''}`} key={s.id}><span className={`subscription-logo sub-${i}`}>{s.name.slice(0,1)}</span><div className="sub-info"><strong>{s.name}</strong><small>{s.status==='active'?`下次扣费 ${s.date}`:'已取消 · 不再续费'}</small></div><div className="sub-right"><strong>{yuan(s.amount)}<small>/月</small></strong>{s.status==='active'?<button onClick={()=>setConfirm({type:'cancel',id:s.id,name:s.name,amount:s.amount})}>取消订阅</button>:<span className="canceled-tag">已取消</span>}</div></div>)}</div><div className="module-foot"><span>预计下月自动扣费</span><strong>{yuan(activeSubs.reduce((n,s)=>n+s.amount,0))}</strong></div></div><p className="under-card-note"><ShieldCheck size={13}/> 仅修改演示数据，不会取消真实平台服务</p></div>}
              {m.kind === 'cards' && <div className="assistant-bubble"><p className="reply-intro">你的卡片都在这里。冻结后可随时解冻，状态会立即显示在工作台。</p><div className="module-card"><div className="module-head"><div className="module-icon lilac"><CreditCard size={20}/></div><div><small>卡片管理</small><h3>我的卡片</h3></div><span className="count-pill">共 {bank.cards.length} 张</span></div><div className="card-list">{bank.cards.map((c,i)=><div className="bank-card-row" key={c.id}><div className={`mini-bank-card card-${i} ${c.status==='frozen'?'frozen':''}`}><div><span className="mini-card-brand">青禾<span> BANK</span></span><span className="card-wave">◔</span></div><strong>•••• &nbsp; •••• &nbsp; •••• &nbsp; {c.tail}</strong><small>DEBIT</small></div><div className="card-detail"><strong>{c.name}</strong><small>{c.type}</small><span className={`card-status ${c.status}`}>{c.status==='active'?'● 正常使用':'● 已冻结'}</span></div><button className="secondary-btn" onClick={()=>setConfirm({type:'freeze',id:c.id,tail:c.tail,status:c.status==='active'?'frozen':'active'})}>{c.status==='active'?'临时冻结':'解除冻结'}</button></div>)}</div></div><p className="under-card-note"><LockKeyhole size={13}/> 卡片操作仅在本地演示生效</p></div>}
              </>}
            </div>
          </div>)}
        </div>
      </div><div className="composer-wrap"><form className="composer" onSubmit={submit}><input ref={inputRef} aria-label="输入消息" placeholder="问问青禾，比如“帮我看看这个月花了多少”" value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit" disabled={!draft.trim()} aria-label="发送消息"><Send size={19}/></button></form><p>演示对话由预设规则驱动，暂未接入真实 AI 或银行系统</p></div></main>
    </div>
    <aside className="insights"><div className="insights-top"><span>资金一览</span><button title="重置演示数据" aria-label="重置演示数据" onClick={()=>setConfirm({type:'reset'})}><RotateCcw size={16}/></button></div><div className="balance-card"><div className="balance-top"><span>可用余额</span><Wallet size={19}/></div><strong>{yuan(bank.balance)}</strong><div className="balance-bottom"><span>青禾日常账户</span><span>·· 8826</span></div></div><div className="insight-section"><h4>本月概览 <span>2026.09</span></h4><div className="stat-row"><span className="stat-icon spent"><ArrowUpRight size={18}/></span><div><small>总支出</small><strong>{yuan(summary.spending)}</strong></div></div><div className="stat-row"><span className="stat-icon earned"><ArrowDownLeft size={18}/></span><div><small>总收入</small><strong>{yuan(summary.income)}</strong></div></div></div><div className="insight-section"><h4>下次自动扣费</h4>{activeSubs.length ? <div className="upcoming"><span className="date-box"><strong>{activeSubs.sort((a,b)=>a.date.localeCompare(b.date))[0].date.slice(-2)}</strong><small>SEP</small></span><div><strong>{activeSubs[0].name}</strong><small>{activeSubs[0].date} · {yuan(activeSubs[0].amount)}</small></div><ArrowRight size={16}/></div> : <p className="empty-note">暂无待续费订阅</p>}</div><div className="insight-section"><h4>卡片状态</h4>{bank.cards.map(c=><div className="card-mini-status" key={c.id}><CreditCard size={17}/><span>尾号 {c.tail}</span><b className={c.status==='active'?'ok':'frozen'}>{c.status==='active'?'正常':'已冻结'}</b></div>)}</div><div className="insights-disclaimer"><ShieldCheck size={16}/><span>所有余额与交易仅供体验演示</span></div></aside>
    {toast && <div role="status" className="toast"><Check size={16}/>{toast}</div>}
    {confirm && <div className="modal-backdrop" onClick={()=>setConfirm(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e=>e.stopPropagation()}><button className="modal-close" aria-label="关闭" onClick={()=>setConfirm(null)}><X size={19}/></button><span className="modal-icon"><ShieldCheck size={23}/></span><h2 id="confirm-title">{confirm.type==='transfer'?'核对转账信息':confirm.type==='cancel'?'确认取消订阅':confirm.type==='freeze'?(confirm.status==='frozen'?'确认冻结卡片':'确认解除冻结'):'重置演示数据'}</h2><p>{confirm.type==='transfer'?'确认后将更新模拟余额和账单。':confirm.type==='cancel'?'确认后该项目将不再计入模拟续费。':confirm.type==='freeze'?'该操作只改变演示卡片的状态。':'余额、账单、订阅与卡片会恢复到初始样例。'}</p>{confirm.type==='transfer' && <div className="confirm-detail"><div><span>收款人</span><strong>{contacts.find(c=>c.id===confirm.contactId)?.name}</strong></div><div><span>收款账户</span><strong>{contacts.find(c=>c.id===confirm.contactId)?.number}</strong></div><div><span>转账金额</span><strong className="confirm-amount">{yuan(confirm.amount)}</strong></div>{confirm.note && <div><span>备注</span><strong>{confirm.note}</strong></div>}<div><span>确认后余额</span><strong>{yuan(bank.balance-confirm.amount)}</strong></div></div>}{confirm.type==='cancel' && <div className="confirm-detail"><div><span>订阅项目</span><strong>{confirm.name}</strong></div><div><span>每月金额</span><strong>{yuan(confirm.amount)}</strong></div></div>}{confirm.type==='freeze' && <div className="confirm-detail"><div><span>卡片</span><strong>尾号 {confirm.tail}</strong></div></div>}<div className="modal-actions"><button className="ghost-btn" onClick={()=>setConfirm(null)}>返回修改</button><button className="primary-btn" onClick={applyConfirmation}>确认模拟操作 <ArrowRight size={16}/></button></div></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
