import React, { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { applyMessages, initialState, resolveTree } from '../../a2ui/apply.js';
import { updateDataModel } from '../../a2ui/protocol.js';
import { fromAction } from '../../agent/planner.js';
import { MAX_TRANSFER, validateTransferSlots } from '../../services/banking.js';
import SurfaceView from '../../a2ui/render.jsx';
import { Page, Panel, Failed } from '../parts.jsx';
import './transfer.css';

/**
 * 转账（产品层入口）。
 *
 * 中间那张卡仍然是 agent/transferFlow.js 产出的同一个 A2UI surface —— 产品层不另写表单。
 * 这一页在它之外只做两件事：
 *
 *  1. **四步流程的状态机在本页**（当前步 + 草稿 + 这张 surface 的 A2UI state）。
 *     state/useTransferFlow.js 那套是给助手那条 surface 用的，它依赖 App 的
 *     history / a2ui / ctxFor / record，这些都不在 ctx 里，本页复用它只能照抄一遍。
 *     ponytail: 真正的解法是 App 暴露一个按 surfaceId 工作的流程入口，那时本页塌成一次 hook 调用。
 *
 *  2. **surface 强调不了的那一个状态**：这一笔会不会把订阅扣款撞掉（Shortfall），
 *     以及随时可用的「重转一笔」（PayeePanel）。除此之外本页不再复述 surface 已有的东西 ——
 *     四种方式的限额与费率、核对页的跨域数字，surface 自己都给了；
 *     同一个数字摆两遍，用户要在两处之间对照，认知负荷反而更高。
 *
 * 文案口径：四步由进度条 + 卡片表达，不再逐步配一句「这一步做什么」；
 * 一个图标 + 一个数字能说清的（还差多少、还剩多少）不写成句子。
 * 校验与跨域口径仍然复用 services/banking.js，不在页面里重算。
 */

const SURFACE_ID = 'page-transfer';
const EMPTY_DRAFT = { type: 'person', contactId: '', manualCardNumber: '', amountText: '', note: '' };

export default function Transfer({ ctx }) {
  const { bank, dataModel, contacts, directory, provenance, handleAction, setConfirm, setRoute, yuan, backendMode, prepareTransfer } = ctx;
  const draftRef = useRef({ ...EMPTY_DRAFT });
  const pendingRef = useRef(null);
  const [step, setStep] = useState('type');
  /* 校验提示就地显示。ctx 里没有 toast 的写入口，而且校验错误本来就该贴着出错的这一步。 */
  const [notice, setNotice] = useState('');
  const [state, setState] = useState(() => applyMessages(initialState(), fromAction('transfer', {
    bank, dataModel, contacts, provenance, surfaceId: SURFACE_ID,
    transferStep: 'type', transferDraft: draftRef.current,
  })));

  /** 换步：整张 surface 原地重建，而不是往上堆卡。 */
  const goto = (next, patch = {}) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setStep(next);
    setNotice('');
    setState(prev => applyMessages(prev, [
      ...fromAction('transfer', {
        bank, dataModel, contacts, provenance, surfaceId: SURFACE_ID,
        transferStep: next, transferDraft: draftRef.current,
      }),
      /* 把当前步写进数据模型：渲染层的换步动效靠它。
         核对与回执两步的 surface 由 brief.js 产出，数据模型里本来没有这个字段。 */
      updateDataModel({ surfaceId: SURFACE_ID, patch: { step: next } }),
    ]));
  };
  const restart = () => { draftRef.current = { ...EMPTY_DRAFT }; goto('type'); };

  /* 记账完成后接上回执。App 在撤销窗口走完才真正写账本，所以这里等的是账本本身。 */
  useEffect(() => {
    const p = pendingRef.current;
    if (!p || !bank.completed.includes(p.id)) return;
    pendingRef.current = null;
    goto('done', { ...p.draft, amountText: (p.amount / 100).toFixed(2), receiptId: p.id, contactId: p.contactId });
  }, [bank.completed]);

  /* 提示只写「哪里不对」，不写「所以你应该...」：光标就在那个输入框上。 */
  const next = () => {
    const d = draftRef.current;
    if (step === 'recipient') {
      const card = String(d.manualCardNumber || '').replace(/\s/g, '');
      if (!d.contactId && !/^[0-9]{16,19}$/.test(card)) return setNotice('选一位收款人，或填完整卡号');
      return goto('amount');
    }
    if (step === 'amount') {
      if (!/^\d+(\.\d{1,2})?$/.test(String(d.amountText || '')) || Number(d.amountText) <= 0) return setNotice('金额最多两位小数');
      return goto('review');
    }
    return undefined;
  };

  const confirmNow = async () => {
    const d = draftRef.current;
    const manual = !d.contactId && !!d.manualCardNumber;
    const recipient = manual ? { mode: 'manual', cardNumber: d.manualCardNumber } : { mode: 'saved', contactId: d.contactId };
    /* 单笔上限先在本页拦一次，只为给一句人话；真正的门禁仍然是 services/banking.js 那一层。 */
    if (Math.round(Number(d.amountText || 0) * 100) > MAX_TRANSFER) return setNotice('单笔最多 ' + yuan(MAX_TRANSFER));
    const check = validateTransferSlots({ recipient, amountText: d.amountText, balance: bank.balance });
    if (!check.ok) return setNotice(check.error);
    if (backendMode) {
      const op = await prepareTransfer({ amount: check.amount, note: d.note || '',
        ...(manual ? { cardNumber: check.cardNumber } : { contactId: d.contactId }) });
      if (op) pendingRef.current = { id: op.id, amount: op.amount, contactId: op.contactId, draft: d };
      return;
    }
    const contact = manual ? directory.find(c => c.number === check.cardNumber) : contacts.find(c => c.id === d.contactId);
    if (!contact) return setNotice('查不到这个卡号');
    const id = crypto.randomUUID();
    pendingRef.current = { id, amount: check.amount, contactId: contact.id, draft: d };
    setConfirm({
      type: 'transfer', id, contactId: contact.id, amount: check.amount, note: d.note || '',
      recipientName: contact.name, recipientNumber: contact.number,
    });
    return setNotice('');
  };

  const onAction = e => {
    const c = e.context || {};
    /* 输入框改值只写数据模型与草稿，不重画 —— 重画会让每敲一个字都丢焦点 */
    if (e.name === 'field.change') {
      const key = String(c.path).slice(1);
      draftRef.current = { ...draftRef.current, [key]: c.value };
      setNotice('');
      return setState(prev => applyMessages(prev, [updateDataModel({ surfaceId: SURFACE_ID, patch: { [key]: c.value } })]));
    }
    if (e.name === 'transfer.pick-type') return goto('recipient', { type: c.type });
    if (e.name === 'transfer.pick-recipient') return goto('amount', { contactId: c.contactId, manualCardNumber: '' });
    if (e.name === 'transfer.quick') return goto('amount', { amountText: c.value });
    if (e.name === 'transfer.back') return goto(c.to);
    if (e.name === 'transfer.next') return next();
    if (e.name === 'transfer.confirm') return confirmNow();
    /* 回执页的两个「接下来」：在本页就把本页的流程重开，不要甩到对话里去 */
    if (e.name === 'open.transfer') return restart();
    if (e.name === 'open.bills') return setRoute('bills');
    return handleAction(SURFACE_ID, e);   /* 设为常用收款人之类仍然是 App 的账 */
  };

  const surface = state.surfaces[SURFACE_ID];
  return <Page title="转账">
    {surface
      ? <SurfaceView key={step} surface={surface} tree={resolveTree(surface)} onAction={onAction}/>
      /* 这是错误态不是空态：surface 没建起来。ZA 的口径是拟人化标题 + 独立错误码 + 一个动作，
         不解释技术原因。错误码用本页真实的 surface id，报障时念的就是它。 */
      : <Failed code={SURFACE_ID}/>}
    {notice && <p className="tf-notice" role="status">{notice}</p>}

    {step === 'review' && <Shortfall bank={bank} amountText={surface && surface.dataModel.amountText} yuan={yuan}/>}
  </Page>;
}

/* ── 这一笔会不会把订阅扣款撞掉：只在真撞上时出现 ────────────────────────
   转后余额、扣完订阅还剩、本月支出变化，surface 的核对卡上都已经给了，
   本页再排一遍只是把同一组数字换个字号 —— 那是重复，不是参照。
   所以这里只保留 surface 无法强调的那一个状态：**不够**。
   够的时候整块不出现；不够的时候，图标 + 缺口 + 待扣，两个数一条红线。 */

function Shortfall({ bank, amountText, yuan }) {
  const cents = Math.round(Number(amountText || 0) * 100);
  const due = bank.subscriptions.filter(s => s.status === 'active').reduce((n, s) => n + s.amount, 0);
  const gap = due - (bank.balance - cents);
  if (gap <= 0) return null;
  return <p className="tf-gap" role="status">
    <TriangleAlert size={16} aria-hidden="true"/>
    <span className="tf-gap-label">缺口</span><b>{yuan(gap)}</b>
    <span className="tf-gap-label">待扣订阅</span><b>{yuan(due)}</b>
  </p>;
}

/* ── 常用收款人：不用走完四步，直接落到「转多少」 ──────────────────────
   只在「选人」那一步之外出现。选人那一步由 surface 自己的收款人卡片负责，
   再摆一份同样的名字只会让人在两处之间对照 —— 那是重复，不是参照。
   这里也不放名录里没登记过的人：转账流程只认常用收款人与手动输入的卡号，
   点一个没登记的人，到确认那一步会被丢掉，那才是骗人。 */

function PayeePanel({ step, saved, onPick }) {
  if (step === 'recipient' || !saved.length) return null;
  return <Panel>
    <div className="tf-group">
      <span className="tf-label">常用</span>
      <div className="tf-chips" data-data>
        {saved.map(p => <button key={p.id} type="button" className="tf-chip" onClick={() => onPick(p.id)}>{p.name}</button>)}
      </div>
    </div>
  </Panel>;
}
