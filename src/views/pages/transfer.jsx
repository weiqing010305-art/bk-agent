import React, { useEffect, useRef, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { applyMessages, initialState, resolveTree } from '../../a2ui/apply.js';
import { updateDataModel } from '../../a2ui/protocol.js';
import { fromAction } from '../../agent/planner.js';
import { transferImpact, validateTransferSlots } from '../../services/banking.js';
import SurfaceView from '../../a2ui/render.jsx';
import { Page, Panel, Empty } from '../parts.jsx';
import './transfer.css';

/**
 * 转账（产品层入口）。
 *
 * 中间那张卡仍然是 agent/transferFlow.js 产出的同一个 A2UI surface —— 产品层不另写表单。
 * 这一页在它之外多做了两件事：
 *
 *  1. **四步流程的状态机在本页**（当前步 + 草稿 + 这张 surface 的 A2UI state）。
 *     之前这里只 applyMessages 了第一步，之后每个动作都转发给 App 的 flow，
 *     而那套 flow 属于助手那条 surface；在本页它是 null，点「转给他人」直接抛异常。
 *
 *  2. **每一步都配一块本页自己的参照信息**。分工是：
 *     surface 负责「这一步要你做什么」，这块负责「做之前你该知道什么」——
 *     核对前的三条跨域结论；方式说明已合并进流程选项。
 *
 *     state/useTransferFlow.js 里那套状态机是给助手那条 surface 用的，它依赖 App 的
 *     history / a2ui / ctxFor / record，这些都不在 ctx 里，本页复用它只能照抄一遍。
 *     真正的解法是 App 暴露一个按 surfaceId 工作的流程入口，那时本页可以塌成一次 hook 调用。
 *     ponytail: 现在这是代价最小的写法 —— 校验与跨域口径仍然复用 services/banking.js。
 */

const SURFACE_ID = 'page-transfer';
const EMPTY_DRAFT = { type: 'person', contactId: '', manualCardNumber: '', amountText: '', note: '' };

export default function Transfer({ ctx }) {
  const { bank, dataModel, contacts, directory, provenance, handleAction, setConfirm, setRoute, yuan } = ctx;
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

  const next = () => {
    const d = draftRef.current;
    if (step === 'recipient') {
      const card = String(d.manualCardNumber || '').replace(/\s/g, '');
      if (!d.contactId && !/^[0-9]{16,19}$/.test(card)) return setNotice('请从常用、最近或名录里选一位收款人；手动输入的话，要填完整卡号。');
      return goto('amount');
    }
    if (step === 'amount') {
      if (!/^\d+(\.\d{1,2})?$/.test(String(d.amountText || '')) || Number(d.amountText) <= 0) return setNotice('请输入有效金额，最多两位小数。');
      return goto('review');
    }
    return undefined;
  };

  const confirmNow = () => {
    const d = draftRef.current;
    const manual = !d.contactId && !!d.manualCardNumber;
    const recipient = manual ? { mode: 'manual', cardNumber: d.manualCardNumber } : { mode: 'saved', contactId: d.contactId };
    const check = validateTransferSlots({ recipient, amountText: d.amountText, balance: bank.balance });
    if (!check.ok) return setNotice(check.error);
    const contact = manual ? directory.find(c => c.number === check.cardNumber) : contacts.find(c => c.id === d.contactId);
    if (!contact) return setNotice('未找到该演示收款人，请核对完整卡号。');
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
  return <Page title="转账" subtitle="选方式、选人、填金额、核对。模拟转账，不产生真实交易。">
    {surface
      ? <SurfaceView key={step} surface={surface} tree={resolveTree(surface)} onAction={onAction}/>
      : <Empty>转账界面不可用。</Empty>}
    {notice && <p className="tf-notice" role="status">{notice}</p>}

    {step === 'review' && <Reassurance bank={bank} amountText={surface && surface.dataModel.amountText} yuan={yuan}/>}

    <p className="page-note">演示环境，不产生真实交易</p>
  </Page>;
}

/* ── 核对前的三条结论：跨域数字由 services/banking.js 统一口径 ────────── */

function Reassurance({ bank, amountText, yuan }) {
  const cents = Math.round(Number(amountText || 0) * 100);
  const im = transferImpact(bank, cents);
  const upcoming = bank.subscriptions.filter(s => s.status === 'active').reduce((n, s) => n + s.amount, 0);
  const after = bank.balance - cents;
  const short = upcoming - after;
  const months = upcoming ? (cents / upcoming).toFixed(1) : null;
  return <Panel title="确认之前，这三件事已经替你算好"
                aside={<span className="panel-hint"><ShieldCheck size={12} style={{ verticalAlign: '-1px' }}/> 与账单同一口径</span>}>
    <ul className="tf-checks">
      <li className={short > 0 ? 'warn' : ''}>
        <Check size={16}/>
        <span>{short > 0
          ? '转完只剩 ' + yuan(after) + '，本月待扣订阅 ' + yuan(upcoming) + '，还差 ' + yuan(short) + '：这一笔会让订阅扣款失败，建议把金额改小。'
          : '转完还剩 ' + yuan(after) + '，本月待扣的订阅 ' + yuan(upcoming) + ' 照扣不误，不会因为这一笔扣款失败。'}</span>
      </li>
      <li>
        <Check size={16}/>
        <span>{months
          ? '这一笔相当于 ' + months + ' 个月的订阅固定支出，也只把本月支出推高 ' + im.monthDeltaPct + '%。'
          : '这一笔会把本月支出推高 ' + im.monthDeltaPct + '%。'}</span>
      </li>
      <li>
        <Check size={16}/>
        <span>确认后先进入 5 秒撤销窗口（窗口在 App.jsx），撤销了这笔钱不会记账；记账之后回执会写进账单。</span>
      </li>
    </ul>
  </Panel>;
}
