import React from 'react';
import { ArrowRight, ShieldCheck, X } from 'lucide-react';

/** 通用确认弹窗。只处理本地模式下的 transfer / reset。 */
export default function ConfirmDialog({ ctx }) {
  const { confirm, setConfirm, busy, applyConfirmation, yuan } = ctx;
  if (!confirm || confirm.type === 'delete-chat') return null;
  /* 只处理自己认识的类型 —— 以前任何未知 type 都会掉进 else 分支，
     被渲染成「重置演示数据」，点了还什么都不发生。 */
  if (confirm.type !== 'transfer' && confirm.type !== 'reset') return null;
  const isTransfer = confirm.type === 'transfer';
  return <div className="modal-backdrop" onClick={() => setConfirm(null)}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={e => e.stopPropagation()}>
      <button className="icon-btn" aria-label="关闭" onClick={() => setConfirm(null)} style={{ alignSelf: 'flex-end' }}><X size={16}/></button>
      <span className="modal-icon"><ShieldCheck size={22}/></span>
      <h2 id="confirm-title">{isTransfer ? '核对转账信息' : '重置演示数据'}</h2>
      <p>{isTransfer ? '确认后将更新模拟余额和账单，并写入回执。' : '余额、账单、订阅与卡片会恢复到初始样例。'}</p>
      {isTransfer && <div className="confirm-detail">
        <div><span>收款人</span><strong>{confirm.recipientName}</strong></div>
        <div><span>收款账户</span><strong>{confirm.recipientNumber}</strong></div>
        <div><span>转账金额</span><strong className="confirm-amount">{yuan(confirm.amount)}</strong></div>
        {confirm.note && <div><span>备注</span><strong>{confirm.note}</strong></div>}
      </div>}
      <div className="modal-actions">
        <button className="ghost-btn" onClick={() => setConfirm(null)}>返回修改</button>
                {/* 必须包一层：onClick 会把点击事件当第一个参数传进去，
            而 applyConfirmation 的第一个参数是「显式指定的 action」 */}
        <button className="primary-btn" disabled={busy} onClick={() => applyConfirmation()}>确认模拟操作 <ArrowRight size={15} style={{ verticalAlign: '-3px' }}/></button>
      </div>
    </div>
  </div>;
}
