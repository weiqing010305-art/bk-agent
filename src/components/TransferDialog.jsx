import React, { useEffect, useRef } from 'react';
import { ArrowRight, ShieldCheck, X } from 'lucide-react';
import { money } from '../domain/bank.js';

export default function TransferDialog({ operation, busy, code, setCode, error, onClose, onSubmit }) {
  const ref = useRef(null);
  const verifying = Boolean(operation.challenge_id);
  const terminal = ['FAILED', 'EXPIRED'].includes(operation.status);
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
      {/* 副标题原本写的是账本用的是哪个数据库 —— 那是实现细节，不是用户要读的东西。删。 */}
      <h2 id="transfer-title">{operation.uncertain ? '查询转账结果' : verifying ? '安全验证' : '核对转账信息'}</h2>
      <div className="confirm-detail">
        <div><span>收款人</span><strong>{operation.recipient_name}</strong></div>
        <div><span>收款账户</span><strong>{operation.recipient_number}</strong></div>
        <div><span>转账金额</span><strong className="confirm-amount">¥{money(operation.amount)}</strong></div>
        {operation.note && <div><span>备注</span><strong>{operation.note}</strong></div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
        {verifying && !operation.uncertain && <div className="verification-box">
          {/* 演示里验证码必须可见，否则流程走不下去；但「演示」两个字不上界面 ——
              码本身放在输入框右侧当提示，不占一行文字。 */}
          <label htmlFor="demo-code">短信验证码</label>
          <div className="code-row">
            <input id="demo-code" autoComplete="off" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy}/>
            <strong data-testid="demo-code">{operation.demo_code}</strong>
          </div>
          <small>2 分钟内有效，最多 3 次</small>
        </div>}
        {operation.uncertain && <p>结果未确认。请先查询，不要另发一笔。</p>}
        {error && <p className="api-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="ghost-btn" disabled={locked} onClick={onClose}>返回修改</button><button type="submit" className="primary-btn" disabled={terminal || busy || (verifying && !operation.uncertain && code.length !== 6)}>{busy ? '处理中…' : terminal ? '请返回修改' : operation.uncertain ? '查询原操作结果' : verifying ? '验证' : '确认并获取验证码'}<ArrowRight size={16}/></button></div>
      </form>
    </section>
  </div>;
}
