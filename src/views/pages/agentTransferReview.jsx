import React, { useEffect, useState } from 'react';
import { api, binding } from '../../api/client.js';
import { Page, Panel, Loading } from '../parts.jsx';
import '../../styles/agent.css';

/** Server-owned task data; manual form edits invalidate the prior authorization. */
export default function AgentTransferReview({ ctx }) {
  const { agent, setRoute, bank, yuan } = ctx;
  const [task, setTask] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const adopt = value => {
    setTask(value); setAmount(value.amount ? (value.amount / 100).toFixed(2) : '');
    setNote(value.note || '');
  };
  const load = async () => {
    try { adopt(await api('/agent/tasks/' + agent.taskId)); setError(''); }
    catch (err) { setError(err.message); }
  };
  useEffect(() => {
    let ignore = false;
    api('/agent/tasks/' + agent.taskId).then(value => { if (!ignore) adopt(value); })
      .catch(err => { if (!ignore) setError(err.message); });
    return () => { ignore = true; };
  }, [agent.taskId, bank.completed]);
  const save = async e => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      adopt(await api('/agent/tasks/' + task.id + '/edit', { version: task.version, amount, note }));
      setEditing(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const latest = await api('/agent/tasks/' + task.id + '/prepare', { version: task.version });
      adopt(latest);
      const operation = latest.operation;
      if (operation.status === 'SUCCEEDED') return;
      const auth = await api('/operations/' + operation.id + '/confirm', binding(operation));
      // Only this explicit user click can enter authentication.
      ctx.showOperation(auth);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const done = task?.status === 'SUCCEEDED';
  const canConfirm = task && ['READY_FOR_REVIEW', 'AWAITING_CONFIRMATION', 'AWAITING_VERIFICATION'].includes(task.status);
  return <Page title={done ? '转账完成' : '核对转账信息'}
    aside={<button className="link-btn" onClick={() => setRoute('assistant')}>返回对话</button>}>
    {!task && !error && <Loading/>}
    {task && <Panel title={done ? '交易回执' : '转账'}>
      <div className="agent-review">
        <dl className="agent-review-details">
          <div><dt>收款人</dt><dd>{task.recipient_name || '待补充'}</dd></div>
          <div><dt>收款账户</dt><dd>{task.tail ? '尾号 ' + task.tail : '待补充'}</dd></div>
          <div><dt>付款账户</dt><dd>青禾人民币账户</dd></div>
          <div><dt>金额</dt><dd className="agent-review-amount">{task.amount ? yuan(task.amount) : '待补充'}</dd></div>
          <div><dt>备注</dt><dd>{task.note || '无'}</dd></div>
          {done && <div><dt>回执编号</dt><dd>{task.operation.receipt_id}</dd></div>}
        </dl>
        {!done && editing && <form className="agent-edit" onSubmit={save}>
          <label>金额（元）<input aria-label="修改转账金额" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required/></label>
          <label>备注<input aria-label="修改转账备注" maxLength={30} value={note} onChange={e => setNote(e.target.value)}/></label>
          <button className="primary-btn" disabled={busy}>保存并重新核对</button>
        </form>}
        {!done && !editing && <div className="agent-review-actions">
          <button className="ghost-btn" disabled={busy} onClick={() => setEditing(true)}>修改金额或备注</button>
          <button className="ghost-btn" disabled={busy} onClick={() => setRoute('assistant')}>更换收款人</button>
          <button className="primary-btn" disabled={busy || !canConfirm} onClick={confirm}>{busy ? '校验中…' : '确认转账'}</button>
        </div>}
        {!canConfirm && !done && <p role="status">{task.message || '请返回对话补充信息。'}</p>}
        {done && <button className="primary-btn" onClick={() => setRoute('assistant')}>返回对话</button>}
      </div>
    </Panel>}
    {error && <div role="alert"><p>{error}</p><button className="ghost-btn" onClick={load}>重新加载</button></div>}
  </Page>;
}
