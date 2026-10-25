import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { streamAgentTurn } from '../api/agentStream.js';

const mask = text => text.replace(/(?<!\d)(?:\d[ -]?){15,18}\d(?!\d)/g,
  value => '卡号尾号 ' + value.replace(/\D/g, '').slice(-4))
  .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, value => '手机号尾号 ' + value.slice(-4));
const secret = text => /密码|验证码|口令|密钥|api.?key/i.test(text);

/** Model replies cannot navigate or mutate funds. Only validated task references cross into product pages. */
export function useAgentConversation({ history, route, setRoute, setToast }) {
  const [taskId, setTaskId] = useState(null);
  const [, redraw] = useState(0);
  const current = useRef(null);
  current.current = { id: history.current.id, route };
  const pending = useRef(new Set());
  const retries = useRef(new Map());
  useEffect(() => { if (!['transfer', 'phone'].includes(route)) setTaskId(null); }, [route]);
  useEffect(() => {
    const id = history.current.id;
    if (!history.current.turns.some(t => t.kind === 'agent')) return;
    let ignore = false;
    api('/agent/conversations/' + id).then(task => {
      if (ignore) return;
      if (!task) {
        history.patchTurns(ts => ts.map(t => t.kind === 'agent' && t.pending && !pending.current.has(id)
          ? { ...t, pending: false, streaming: false, text: '尚未收到处理结果，请重新发送消息。' } : t), id);
        return;
      }
      history.patch({ agentTask: { id: task.id, version: task.version, status: task.status, kind: task.kind } }, id);
      history.patchTurns(ts => ts.map(t => t.kind === 'agent' && t.pending && !pending.current.has(id)
        ? { ...t, pending: false, streaming: false, text: task.message, agentTask: { ...task, phone: undefined, operation: null } } : t), id);
    }).catch(() => {
      if (!ignore) history.patchTurns(ts => ts.map(t => t.kind === 'agent' && t.pending
        ? { ...t, pending: false, streaming: false, text: '连接中断，请重新发送消息或查看原任务。' } : t), id);
    });
    return () => { ignore = true; };
  }, [history.current.id]);

  const open = async value => {
    try {
      const task = typeof value === 'string' ? await api('/agent/tasks/' + value) : value;
      if (task.status === 'EXPIRED') return setToast('这笔办理信息已过期，请在当前聊天重新说明需求。');
      if (!task.can_open) return setToast('请先在对话中补齐办理信息。');
      setTaskId(task.id); setRoute(task.kind === 'phone' ? 'phone' : 'transfer');
    } catch (err) { setToast(err.message); }
  };
  const update = async (task, conversationId, turnId) => {
    const summary = { ...task, phone: undefined, operation: task.operation ? {
      id: task.operation.id, status: task.operation.status, receipt_id: task.operation.receipt_id,
    } : null };
    history.patch({ agentTask: { id: task.id, version: task.version, status: task.status, kind: task.kind } }, conversationId);
    history.patchTurns(ts => ts.map(t => t.id === turnId
      ? { ...t, pending: false, streaming: false, text: task.message, agentTask: summary, retry: false } : t), conversationId);
    if (task.handoff) await new Promise(resolve => setTimeout(resolve, 250));
    if (current.current.id === conversationId && current.current.route === 'assistant'
        && task.status === 'READY_FOR_REVIEW' && task.handoff) open(task);
  };
  const send = async (text, retryTurnId) => {
    const conversationId = history.current.id;
    if (pending.current.has(conversationId)) return;
    if (secret(text)) {
      history.patch({ draft: '' }, conversationId);
      setToast('密码与验证码请只在安全验证窗口输入。');
      return;
    }
    pending.current.add(conversationId); redraw(n => n + 1);
    const turnId = retryTurnId || crypto.randomUUID();
    history.patch({ draft: '' }, conversationId);
    if (!retryTurnId) history.patchTurns(ts => [...ts,
      { id: crypto.randomUUID(), role: 'user', text: mask(text) },
      { id: turnId, role: 'assistant', kind: 'agent', text: '', pending: true }], conversationId);
    else history.patchTurns(ts => ts.map(t => t.id === turnId
      ? { ...t, pending: true, streaming: false, text: '', retry: false, agentTask: null } : t), conversationId);
    try {
      let request = retries.current.get(turnId);
      if (!request) {
        const latest = await api('/agent/conversations/' + conversationId);
        request = { conversation_id: conversationId, request_id: crypto.randomUUID(),
          version: latest?.version || 0, text };
        retries.current.set(turnId, request);
      }
      const task = await streamAgentTurn(request, delta => {
        history.patchTurns(ts => ts.map(t => t.id === turnId
          ? { ...t, streaming: true, text: t.text + delta } : t), conversationId);
      });
      retries.current.delete(turnId);
      await update(task, conversationId, turnId);
    } catch (err) {
      if (err.status && err.status < 500) retries.current.delete(turnId);
      history.patchTurns(ts => ts.map(t => t.id === turnId
        ? { ...t, pending: false, streaming: false, text: err.message, retry: retries.current.has(turnId) } : t), conversationId);
    } finally {
      pending.current.delete(conversationId); redraw(n => n + 1);
    }
  };
  const choose = async (task, recipientId, turnId) => {
    if (pending.current.has(history.current.id)) return;
    const conversationId = history.current.id;
    pending.current.add(conversationId); redraw(n => n + 1);
    try {
      const latest = await api('/agent/tasks/' + task.id);
      const result = await api('/agent/tasks/' + task.id + '/edit',
        { version: latest.version, recipient_id: recipientId });
      await update(result, conversationId, turnId);
    } catch (err) { setToast(err.message); }
    finally { pending.current.delete(conversationId); redraw(n => n + 1); }
  };
  return { taskId, open, clear: () => setTaskId(null), send, choose,
    retry: turnId => { const request = retries.current.get(turnId); if (request) send(request.text, turnId); },
    busy: pending.current.has(history.current.id) };
}
