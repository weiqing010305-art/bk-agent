import { useCallback, useEffect, useRef } from 'react';
import { deleteSurface, updateDataModel } from '../a2ui/protocol.js';
import { applyMessages } from '../a2ui/apply.js';
import { fromAction } from '../agent/planner.js';
import { validateTransferSlots } from '../services/banking.js';
import { backendMode } from '../api/client.js';

const uid = () => crypto.randomUUID();

/**
 * 转账四步流程的完整状态机。
 *
 * 从 App.jsx 抽出来有两个理由：
 *  1. App.jsx 超过 300 行线（AGENTS.md §1）
 *  2. 这是**唯一一处"一个 surface 在原地换页"**的逻辑，独立成文件才好单测
 *
 * 关键约定：输入框的值走 ref 而不是 state —— 走 state 会让每个按键都重画 surface，
 * 结果就是输入框每敲一个字丢一次焦点。
 */
export function useTransferFlow({ history, a2ui, turns, ctxFor, record, resumeFollow, contacts, bank, directory, onDraft, setToast }) {
  const flow = history.current.transferFlow || null;
  const draftRef = useRef({});
  useEffect(() => { draftRef.current = flow?.draft || {}; }, [history.current.id]);

  const paintFlow = useCallback((surfaceId, step, draft) => {
    const envelopes = fromAction('transfer', { ...ctxFor(surfaceId), transferStep: step, transferDraft: draft });
    /* 同一个 surfaceId 先删后建：消息流里只有一张卡，它在"换页"而不是堆叠 */
    history.patch({ a2ui: applyMessages(a2ui, [deleteSurface(surfaceId), ...envelopes]),
      transferFlow: { surfaceId, step, draft } });
    draftRef.current = draft;
    record('业务面 · 转账 ' + step, null, envelopes, 'transfer.' + step, draft, surfaceId);
  }, [a2ui, ctxFor, history, record]);
  useEffect(() => {
    if (backendMode && flow?.operationId && flow.step !== 'done' && bank.completed.includes(flow.operationId)) {
      paintFlow(flow.surfaceId, 'done', { ...flow.draft, receiptId: flow.operationId });
    }
  }, [bank.completed, flow, paintFlow]);

  /**
   * 业务层入口。**已经说过的信息不重复问**：
   * 人和钱都说了就直接进核对，只说了一样就只问另一样。
   */
  const startTransfer = useCallback((slots = {}, userText = null, task = null) => {
    const surfaceId = uid();
    const hit = slots.payeeHint
      ? contacts.find(c => c.name === slots.payeeHint || c.name.includes(slots.payeeHint) || slots.payeeHint.includes(c.name))
      : null;
    const draft = {
      type: slots.type || 'person',
      contactId: hit ? hit.id : '',
      manualCardNumber: '',
      amountText: slots.amountText || '',
      note: slots.note || '',
    };
    const step = hit && draft.amountText ? 'review' : hit ? 'amount' : draft.amountText ? 'recipient' : 'type';
    resumeFollow();
    const envelopes = fromAction('transfer', { ...ctxFor(surfaceId), transferStep: step, transferDraft: draft });
    history.patch({
      a2ui: applyMessages(a2ui, envelopes),
      transferFlow: { surfaceId, step, draft },
      turns: [...turns, ...(userText ? [{ id: uid(), role: 'user', text: userText }] : []),
        /* 复杂转账（定时、AA）带着任务图进来，这样编排在流程内部也看得见。 */
        { id: uid(), role: 'assistant', surfaceId, task }],
    });
    draftRef.current = draft;
    record(userText ? '业务层 · 识别到转账意图' : '产品层 · 直接开转账', userText, envelopes, 'transfer.' + step, draft, surfaceId);
  }, [a2ui, turns, ctxFor, history, resumeFollow, record, contacts]);

  /** 流程内部换步：合并 ref 里的最新输入（用户可能刚打完字还没点下一步） */
  const gotoStep = useCallback((step, patch = {}) => {
    paintFlow(flow.surfaceId, step, { ...draftRef.current, ...patch });
  }, [flow, paintFlow]);

  /** 下一步：前置校验不通过就原地提示，不跳步 */
  const nextStep = useCallback(() => {
    const d = draftRef.current;
    if (flow.step === 'recipient') {
      const card = String(d.manualCardNumber || '').replace(/\s/g, '');
      if (!d.contactId && !/^[0-9]{16,19}$/.test(card)) return setToast('请选择收款人，或输入 16–19 位完整卡号');
      return gotoStep('amount');
    }
    if (flow.step === 'amount') {
      if (!/^\d+(\.\d{1,2})?$/.test(String(d.amountText || '')) || Number(d.amountText) <= 0) return setToast('请输入有效金额，最多两位小数');
      return gotoStep('review');
    }
    return undefined;
  }, [flow, gotoStep, setToast]);

  /** 最后一步：校验后进确认弹窗 */
  const confirmTransfer = useCallback(() => {
    const d = { ...draftRef.current, ...flow.draft };
    const manual = !d.contactId && !!d.manualCardNumber;
    const recipient = manual ? { mode: 'manual', cardNumber: d.manualCardNumber } : { mode: 'saved', contactId: d.contactId };
    const check = validateTransferSlots({ recipient, amountText: d.amountText, balance: bank.balance });
    if (!check.ok) return setToast(check.error);
    if (backendMode) return onDraft({ id: uid(), amount: check.amount, note: d.note || '',
      ...(manual ? { cardNumber: check.cardNumber } : { contactId: d.contactId }) });
    const contact = manual ? directory.find(c => c.number === check.cardNumber) : contacts.find(c => c.id === d.contactId);
    if (!contact) return setToast('这个卡号不在名录里');
    /* 不自己决定走哪道门 —— 交给 App 的策略门禁。
       本 hook 只负责「表单填对了」，风险分级是 policy 层的事。 */
    return onDraft({
      type: 'transfer', id: uid(), contactId: contact.id, amount: check.amount,
      note: d.note || '', recipientName: contact.name, recipientNumber: contact.number,
    });
  }, [flow, bank.balance, contacts, directory, onDraft, setToast]);

  /** 输入框改值：只更新 dataModel，不重画 surface */
  const setField = useCallback((surfaceId, path, value) => {
    draftRef.current = { ...draftRef.current, [path.slice(1)]: value };
    history.patch({ a2ui: applyMessages(a2ui, [updateDataModel({ surfaceId, patch: { [path.slice(1)]: value } })]),
      ...(flow?.surfaceId === surfaceId ? { transferFlow: { ...flow, draft: draftRef.current } } : {}) });
  }, [a2ui, history, flow]);

  return { flow, draftRef, startTransfer, gotoStep, nextStep, confirmTransfer, setField, paintFlow };
}
