import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Page, Panel, Loading } from '../parts.jsx';
import EverydayServices from './everydayServices.jsx';

export default function AgentPhoneReview({ ctx }) {
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let ignore = false;
    api('/agent/tasks/' + ctx.agent.taskId).then(value => { if (!ignore) setTask(value); })
      .catch(err => { if (!ignore) setError(err.message); });
    return () => { ignore = true; };
  }, [ctx.agent.taskId, ctx.bank.completed]);
  if (error) return <Page title="手机充值"><p role="alert">{error}</p><button className="link-btn" onClick={() => ctx.setRoute('assistant')}>返回对话</button></Page>;
  if (!task) return <Page title="手机充值"><Loading/></Page>;
  if (task.kind !== 'phone' || !task.can_open) return <Page title="手机充值"><p>请返回对话补充充值信息。</p><button className="link-btn" onClick={() => ctx.setRoute('assistant')}>返回对话</button></Page>;
  if (task.status === 'SUCCEEDED') return <Page title="手机充值"><Panel title="支付成功">
    <p>{task.phone} · {ctx.yuan(task.amount)}</p><p>回执编号：{task.operation.receipt_id}</p>
    <button className="link-btn" onClick={() => ctx.setRoute('assistant')}>返回对话</button>
  </Panel></Page>;
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem('qinghe-payment-pending-v1')); } catch { /* No valid pending request. */ }
  if (pending?.kind === 'phone' && pending.id !== task.payment_id) return <Page title="手机充值"><Panel>
    <p>还有一笔充值结果未确认，请先查询原支付结果。</p>
    <button className="primary-btn" onClick={() => { ctx.agent.clear(); ctx.setRoute('phone'); }}>查询原支付</button>
  </Panel></Page>;
  const syncAgentPhone = async fields => {
    const result = await api('/agent/tasks/' + task.id + '/edit', {
      version: task.version, phone: fields.target, amount: fields.amountText,
    });
    setTask(result);
  };
  const serviceDraft = { id: task.payment_id, target: task.phone, amountText: (task.amount / 100).toFixed(2) };
  return <EverydayServices key={task.id + ':' + task.version} ctx={{ ...ctx, serviceDraft, serviceTask: task, syncAgentPhone }}/>;
}
