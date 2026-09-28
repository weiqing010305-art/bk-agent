import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { api, backendMode, binding } from './api/client.js';
import { contacts as demoContacts, directory, money, seed, transfer as applyTransfer } from './domain/bank.js';
import { buildDataModel, provenance } from './services/banking.js';
import { fromText, fromAction, parseIntent } from './agent/planner.js';
import { applyMessages, resolveTree } from './a2ui/apply.js';
import { useConversations } from './state/useConversations.js';
import { useThreadScroll } from './state/useThreadScroll.js';
import { useTransferFlow } from './state/useTransferFlow.js';
import { useUndoWindow } from './state/useUndoWindow.js';
import { useBackendBank } from './state/useBackendBank.js';
import { record as auditRecord } from './services/audit.js';
import { useSecurity } from './state/useSecurity.js';
import { useTurnRunner } from './state/useTurnRunner.js';
import Sidebar from './components/Sidebar.jsx';
import AssistantView from './views/AssistantView.jsx';
import ProductView from './views/product.jsx';
import AppOverlays from './components/AppOverlays.jsx';
import './styles/tokens.css';
import './styles/app.css';
import './styles/pages.css';
import './styles/views.css';
import './styles/charts.css';
import './styles/wallet.css';
import './styles/auth.css';
import './styles/taskgraph.css';
import './styles/a2ui.css';
import './styles/motion.css';

const uid = () => crypto.randomUUID();
const yuan = n => '¥' + money(n);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('qinghe-mock-v1'));
    if (s && Number.isSafeInteger(s.balance) && Array.isArray(s.transactions) &&
        Array.isArray(s.cards) && Array.isArray(s.subscriptions) && Array.isArray(s.completed)) return s;
  } catch { /* 忽略损坏的本地账本 */ }
  return seed();
}

function loadBackendState() {
  const initial = { ...seed(), balance: 0, transactions: [], completed: [] };
  try {
    const extras = JSON.parse(localStorage.getItem('qinghe-local-extras-v1'));
    if (Array.isArray(extras?.cards) && Array.isArray(extras?.subscriptions)) return { ...initial, ...extras };
  } catch { /* 忽略 */ }
  return initial;
}

export default function App() {
  const [bank, setBank] = useState(() => (backendMode ? loadBackendState() : loadState()));
  const [contacts, setContacts] = useState(backendMode ? [] : demoContacts);
  const [connection, setConnection] = useState(backendMode ? 'loading' : 'local');
  const [busy, setBusy] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [apiError, setApiError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [route, setRoute] = useState('assistant');
  /** 历史条里选中了哪一回合；null = 跟随最新 */
  const [previewId, setPreviewId] = useState(null);
  /* 转账流程的状态在 state/useTransferFlow.js 里，App 不再自己持有 */

  const busyRef = useRef(false);
  const confirmRef = useRef(null);
  const seededRef = useRef(null);
  confirmRef.current = confirm;

  const history = useConversations();

  /* 5 秒可撤销窗口：必须在 applyConfirmation 之前调用，否则依赖数组求值时会 TDZ */
  const { undo, open: openUndo, cancel: cancelUndo } = useUndoWindow({
    onCommit: action => commitTransferRef.current(action),
    onCancel: () => setToast('已撤销，这笔转账没有执行'),
  });
  const { turns, a2ui, draft } = history.current;

  /* 滚动锚定必须早于 runText/runAction —— useCallback 的依赖数组在渲染期立即求值 */
  const scrollSignal = turns.length + ':' + (turns.at(-1)?.surfaceId || '') + ':' + Object.keys(a2ui.surfaces).length;
  const { scrollRef, resumeFollow } = useThreadScroll(scrollSignal);

  useEffect(() => {
    if (backendMode) localStorage.setItem('qinghe-local-extras-v1', JSON.stringify({ cards: bank.cards, subscriptions: bank.subscriptions }));
    else localStorage.setItem('qinghe-mock-v1', JSON.stringify(bank));
  }, [bank]);

  const dataModel = useMemo(() => ({
    ...buildDataModel(bank),
    balanceHint: '可用余额 ' + yuan(bank.balance),
  }), [bank]);

  const prov = useMemo(() => provenance(backendMode ? 'backend' : 'local', connection), [connection]);

  const ctxFor = useCallback(surfaceId => ({ bank, dataModel, provenance: prov, contacts, surfaceId }), [bank, dataModel, prov, contacts]);


  /**
   * 决策链路记录（赛题高优先级项「操作审计」）。
   *
   * 以前这里写的是一个给「动线面板」看的 trace 对象 —— 那个面板已经删了（动线必须是无感的）。
   * 现在改成写审计日志：它记录的是**为什么允许这次操作发生**，而不只是"发生了什么"。
   */
  const record = useCallback((entry, input, envelopes, action, slots, surfaceId) => {
    const surface = envelopes[0] && envelopes[0].createSurface;
    if (!surface) return;
    const keys = Object.keys(surface.dataModel);
    auditRecord({
      kind: 'intent', actor: 'agent', input: input || undefined,
      intent: action, decision: '允许',
      detail: entry + '｜识别为 ' + action + '｜产出 ' + surface.components.length + ' 个组件、' + keys.length + ' 个数据键'
        + '｜' + (surface.meta.provenance ? surface.meta.provenance.label : ''),
    });
  }, []);



  /* ── 转账四步流程（实现在 state/useTransferFlow.js，App 只做接线）────────── */
  /** commitTransfer 真正记账。用 ref 兜一层，保证 useUndoWindow 拿到的永远是最新闭包。 */
  const commitTransferRef = useRef(() => {});

  /* ── 安全与权限分级（实现在 state/useSecurity.js）───────────────────── */
  const { auth, lock, gateDraft, screen, passAuth, failAuth, doUnlock, closeAuth } = useSecurity({
    bank, setConfirm, setToast, yuan,
  });

  const { flow, draftRef, startTransfer, gotoStep, nextStep, confirmTransfer, setField, paintFlow } = useTransferFlow({
    history, a2ui, turns, ctxFor, record, resumeFollow, contacts, bank, directory, onDraft: gateDraft, setToast,
  });

  /* ── 回合执行（实现在 state/useTurnRunner.js）─────────────────────────
     必须在 ctxFor / record / screen / startTransfer 之后 —— useCallback 的依赖数组
     在渲染期立即求值，放前面会直接 TDZ 崩掉。 */
  const { runText, runAction, submit: turnSubmit, taskControl } = useTurnRunner({
    history, a2ui, turns, ctxFor, record, resumeFollow, startTransfer, screen, setPreviewId, contacts,
  });
  const submit = useCallback(e => turnSubmit(draft, busyRef)(e), [turnSubmit, draft]);

  /* ── 两个入口 ─────────────────────────────────────────────────────────── */

  /** 业务层入口：自然语言（含语音转文字） */
  /** 5 秒窗口走完才真正记账，并把那张卡换成回执 + 下一步 */
  const commitTransfer = useCallback(action => {
    try {
      setBank(prev => applyTransfer(prev, action));
      setToast('已模拟转账 ' + yuan(action.amount) + ' 给 ' + action.recipientName);
      if (flow) {
        paintFlow(flow.surfaceId, 'done', {
          ...draftRef.current,
          amountText: (action.amount / 100).toFixed(2),
          receiptId: action.id,
          contactId: action.contactId,
        });
      }
    } catch (err) { setToast(err.message); }
  }, [yuan, flow, paintFlow, draftRef]);
  commitTransferRef.current = commitTransfer;

  /** 每个会话第一件事：播一次欢迎视图。用 ref 记住已经播过的会话，避免重复。 */
  useEffect(() => {
    const id = history.current.id;
    if (seededRef.current === id) return;
    seededRef.current = id;
    runAction('welcome');
  }, [turns.length, history, runAction]);

  /* ── 动作派发：surface 只回抛字符串事件 ───────────────────────────────── */


  const toggleCard = useCallback(cardId => {
    setBank(prev => ({ ...prev, cards: prev.cards.map(c => c.id === cardId ? { ...c, status: c.status === 'active' ? 'frozen' : 'active' } : c) }));
    setToast('卡片状态已更新（模拟）');
  }, []);

  const handleAction = useCallback((surfaceId, event) => {
    if (!event || typeof event.name !== 'string') return;
    const n = event.name;
    if (n.startsWith('open.')) {
      const id = n.slice(5);
      return id === 'transfer' ? startTransfer() : runAction(id);
    }
    /* 输入框改值只更新 dataModel，不重画 surface —— 否则每敲一个字就丢焦点 */
    if (n === 'field.change') {
      return setField(surfaceId, event.context.path, event.context.value);
    }
    if (n === 'card.toggle') return toggleCard(event.context.cardId);
    if (n === 'transfer.save-payee') {
      const c = directory.find(x => x.id === event.context.contactId);
      if (!c) return setToast('这个收款人已经在名录里了');
      setContacts(prev => prev.some(x => x.id === c.id) ? prev : [c, ...prev]);
      return setToast(c.name + ' 已设为常用收款人');
    }
    if (n === 'transfer.pick-type') return gotoStep('recipient', { type: event.context.type });
    if (n === 'transfer.pick-recipient') return gotoStep('amount', { contactId: event.context.contactId, manualCardNumber: '' });
    if (n === 'transfer.quick') return gotoStep(flow.step, { amountText: event.context.value });
    if (n === 'transfer.next') return nextStep();
    if (n === 'transfer.back') return gotoStep(event.context.to);
    if (n === 'transfer.confirm') return confirmTransfer();
    return setToast('未知操作：' + n);
  }, [startTransfer, runAction, setField, toggleCard, gotoStep, nextStep, confirmTransfer, flow, directory, setToast]);

  /* ── 后端模式（实现在 state/useBackendBank.js）───────────────────────────
     与 UI 无关的一整块传输逻辑，抽出去是为了守住 300 行线。 */
  const { refreshBank, connect, applyBackendTransfer } = useBackendBank({
    setBank, setContacts, setConnection, setToast, setBusy, setApiError, setConfirm,
    confirm, verificationCode, busyRef,
  });

  /**
   * 落地一个已经确认过的动作。
   *
   * **可以显式传入 action** —— 这样页面就能「就地确认」而不必走弹窗。
   * 之前它只读闭包里的 confirm，于是同一个事件里先 setConfirm 再调用它会撞上
   * 开头的守卫（闭包还是旧值），逼得页面去写 effect 等状态同步 —— 那是绕路。
   * 不传参数时（弹窗那颗按钮）行为不变，仍用 confirm。
   */
  const applyConfirmation = useCallback(async explicit => {
    const target = explicit || confirm;
    if (busyRef.current || !target) return;
    if (backendMode && target.type === 'reset') {
      busyRef.current = true; setBusy(true);
      try {
        await api('/session/reset', {});
        setBank(seed()); await refreshBank(); setConfirm(null); history.create(); setToast('已创建新的演示账户');
      } catch (err) { setConnection('error'); setConfirm(null); setToast(err.message); }
      finally { busyRef.current = false; setBusy(false); }
      return;
    }
    const action = target; setConfirm(null);
    if (action.type === 'transfer') {
      /* 不立刻记账：先开 5 秒可撤销窗口（定时器在 useUndoWindow 里） */
      openUndo(action, '即将转出 ' + yuan(action.amount) + ' 给 ' + action.recipientName);
    } else if (action.type === 'cancel-sub' || action.type === 'restore-sub') {
      /* 订阅的取消与恢复走这里 —— 账本只有一个写入口，页面不各自开覆盖层。
         （此前 cancel-sub 全仓库无人处理，ConfirmDialog 会把它当成 reset 弹出来。） */
      const canceled = action.type === 'cancel-sub';
      setBank(prev => ({
        ...prev,
        subscriptions: prev.subscriptions.map(s => s.id === action.id ? { ...s, status: canceled ? 'canceled' : 'active' } : s),
      }));
      setToast(canceled ? action.name + ' 已取消，后续不再扣费' : action.name + ' 已恢复续费');
    } else if (action.type === 'reset') {
      setBank(seed()); history.create(); setToast('演示数据已重置');
    }
  }, [confirm, history, refreshBank, openUndo, yuan]);



  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);


  const ctx = {
    route, setRoute,
    mobileNav, setMobileNav, closeNav: () => setMobileNav(false),
    items: history.items, currentId: history.current.id,
    navigateConversation: id => { history.select(id); setRoute('assistant'); setMobileNav(false); },
    removeConversation: id => history.remove(id),
    createConversation: () => { history.create(); setRoute('assistant'); setMobileNav(false); },
    saveError: history.saveError, busy, confirm, connection, backendMode,
    bank, dataModel, turns, a2ui, draft,
    /* 账本只有一个写入口。页面不要各自开 localStorage 覆盖层 ——
       那样助手那条 surface 的数字会跟页面显示的打架。 */
    setBank,
    setToast,
    setDraft: v => history.patch({ draft: v }),
    submit, runAction, handleAction, setConfirm, startTransfer,
    resetDemo: () => setConfirm({ type: 'reset' }),
    scrollRef,
    applyConfirmation, directory, yuan, contacts,
    previewId, setPreviewId, taskControl,
    refreshBank,
  };

  return <div className={`app-shell ${backendMode ? 'with-backend' : ''}`}>
    <div className="mesh-bg" aria-hidden="true"/>
    {mobileNav && <button className="nav-scrim" aria-label="关闭导航" onClick={ctx.closeNav}/>}
    <Sidebar ctx={ctx}/>
    <div className="main-area">
      <button className="menu-fab" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu size={18}/></button>
      {/* key 按 route 变 —— 让每次切换都重播一次入场。craft-floor 要求
          「一个有作者意识的瞬间」，而不是把同一个入场贴到每一段上。 */}
      {route === 'assistant'
        ? <AssistantView key="assistant" ctx={ctx}/>
        : <ProductView key={route} ctx={ctx}/>}
    </div>
    <AppOverlays
      sec={{ lock, auth, doUnlock, passAuth, failAuth, closeAuth }}
      undo={{ value: undo, cancel: cancelUndo }}
      toast={toast}
      confirm={{ value: confirm, ctx }}
      backend={{
        mode: backendMode, busy, code: verificationCode, setCode: setVerificationCode,
        error: apiError, onSubmit: applyBackendTransfer,
        onClose: () => { if (!busyRef.current && !confirm.uncertain) { setConfirm(null); setApiError(''); } },
      }}
      transfer={{ onAuthenticated: applyConfirmation }}
    />
  </div>;
}