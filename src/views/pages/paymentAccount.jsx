import React, { useId } from 'react';
import { CreditCard, ChevronDown } from 'lucide-react';

/** 保留原生选择器及银行状态校验，用卡对象而非孤立下拉框呈现。 */
export default function PaymentAccount({ cards, value, onChange, balance }) {
  const id = useId();
  const card = cards.find(c => c.id === value);
  return <div className="payment-account">
    <label htmlFor={id}>支付银行卡</label>
    <div className="payment-account-select">
      <span className="payment-account-icon" aria-hidden="true"><CreditCard size={24}/></span>
      <div className="payment-account-copy" aria-hidden="true"><strong>{card?.name || '请选择银行卡'}</strong>
        <span>{card ? `尾号 ${card.tail}${card.status !== 'active' ? ' · 已冻结' : ''}` : '选择付款账户'}</span></div>
      <ChevronDown size={18} aria-hidden="true"/>
      <select id={id} required value={value} onChange={e => onChange(e.target.value)} aria-describedby={id + '-balance'}>
        <option value="">请选择银行卡</option>{cards.filter(c => c.id !== 'credit').map(c => <option key={c.id} value={c.id}
          disabled={c.status !== 'active'}>{c.name} · 尾号 {c.tail}{c.status !== 'active' ? '（已冻结）' : ''}</option>)}
      </select>
    </div>
    <small id={id + '-balance'}>账户可用余额 <b>{balance}</b></small>
  </div>;
}
