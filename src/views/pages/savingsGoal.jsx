import React from 'react';
import { Flag, Check } from 'lucide-react';
import './savingsGoal.css';

export default function SavingsGoal({ goal, amount, yuan, onDeposit, onWithdraw, onEdit, onDelete }) {
  const left = Math.max(0, goal.target - amount);
  const days = Math.ceil((new Date(goal.date + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
  const monthly = Math.ceil(left / Math.max(1, Math.ceil(days / 30)));
  const percent = Math.min(100, Math.round(amount / goal.target * 100));
  const done = left === 0;
  return <section className="savings-goal">
    <header className="savings-goal-head"><span className="utility-icon">{done ? <Check size={20}/> : <Flag size={20}/>}</span>
      <div><h3>{goal.name}</h3><small>{goal.date} · {done ? '已达成' : days < 0 ? '已到期，可调整目标' : days === 0 ? '今天到期' : `剩余 ${days} 天`}</small></div>
      <button className="link-btn" onClick={onEdit}>修改目标</button>
    </header>
    <div className="savings-goal-amount"><span><strong>{yuan(amount)}</strong><small> / {yuan(goal.target)}</small></span><b>{percent}%</b></div>
    <progress max={goal.target} value={Math.min(amount, goal.target)} aria-label={goal.name + '储蓄进度'}/>
    <div className="savings-goal-plan"><span>{done ? '目标已达成' : `还差 ${yuan(left)}`}</span>
      {!done && days > 0 && <span>每月约存 <b>{yuan(monthly)}</b></span>}
    </div>
    <div className="service-actions">
      <button className="a2ui-btn a2ui-btn--primary" disabled={done} onClick={onDeposit}>存入</button>
      <button className="a2ui-btn a2ui-btn--secondary" disabled={!amount} onClick={onWithdraw}>取回</button>
      <button className="link-btn savings-delete" disabled={!!amount} title={amount ? '先取回全部资金，再删除目标' : ''} onClick={onDelete}>删除空计划</button>
    </div>
  </section>;
}
