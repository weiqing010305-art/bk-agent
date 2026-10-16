import React from 'react';
import { Check, CircleCheck } from 'lucide-react';
import './serviceJourney.css';

export function ServiceJourney({ step, booking }) {
  const index = { form: 0, review: 1, done: 2 }[step];
  return <ol className="service-journey" aria-label="办理进度">
    {['填写信息', '核对确认', booking ? '预约完成' : '支付完成'].map((label, i) => <li key={label}
      aria-current={i === index ? 'step' : undefined} data-complete={i < index || step === 'done'}>
      <span>{i < index || step === 'done' ? <Check size={14}/> : i + 1}</span><b>{label}</b>
    </li>)}
  </ol>;
}

export function ServiceReceipt({ title, amount, children, action }) {
  return <div className="service-receipt" role="status">
    <span className="service-receipt-mark"><CircleCheck size={30}/></span>
    <h2>{title}</h2>{amount && <strong>{amount}</strong>}
    <div className="service-receipt-details">{children}</div>
    <div className="service-actions">{action}</div>
  </div>;
}
