import React, { useEffect, useRef } from 'react';
import { ArrowRight, ShieldCheck, X } from 'lucide-react';
import { money } from '../domain/bank.js';

export default function TransferDialog({ operation, busy, code, setCode, error, onClose, onSubmit }) {
  const ref = useRef(null);
  const verifying = Boolean(operation.challenge_id);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  const keydown = e => {
    if (e.key !== 'Tab') return;
    const nodes = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const first = nodes[0], last = nodes.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  const locked = busy || operation.uncertain;
  return <div className="modal-backdrop" onClick={() => !locked && onClose()}>
    <section className="modal backend-transfer" role="dialog" aria-modal="true" aria-labelledby="transfer-title" tabIndex={-1} ref={ref} onKeyDown={keydown} onClick={e => e.stopPropagation()}>
      <button className="modal-close" aria-label="关闭" disabled={locked} onClick={onClose}><X size={19}/></button>
      <span className="modal-icon"><ShieldCheck size={23}/></span>
      <h2 id="transfer-title">{operation.uncertain ? '查询转账结果' : verifying ? '模拟安全验证' : '核对转账信息'}</h2>
      <p>PostgreSQL 演示账本 · 不产生真实交易</p>
      <div className="confirm-detail">
        <div><span>收款人</span><strong>{operation.recipient_name}</strong></div>
        <div><span>收款账户</span><strong>{operation.recipient_number}</strong></div>
        <div><span>转账金额</span><strong className="confirm-amount">¥{money(operation.amount)}</strong></div>
        {operation.note && <div><span>备注</span><strong>{operation.note}</strong></div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
        {verifying && !operation.uncertain && <div className="verification-box">
          <p>演示验证码：<strong data-testid="demo-code">{operation.demo_code}</strong></p>
          <label htmlFor="demo-code">输入上述 6 位数字，验证后模拟转账</label>
          <input id="demo-code" autoComplete="off" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy}/>
          <small>未发送短信。验证码 2 分钟有效，最多尝试 3 次。</small>
        </div>}
        {operation.uncertain && <p>请求结果尚未确认。请查询原操作，不要另发一笔转账。</p>}
        {error && <p className="api-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="ghost-btn" disabled={locked} onClick={onClose}>返回修改</button><button type="submit" className="primary-btn" disabled={busy || (verifying && !operation.uncertain && code.length !== 6)}>{busy ? '处理中…' : operation.uncertain ? '查询原操作结果' : verifying ? '验证并模拟转账' : '确认并获取模拟验证码'}<ArrowRight size={16}/></button></div>
      </form>
    </section>
  </div>;
}
