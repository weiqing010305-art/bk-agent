import React from 'react';
import AuthDialog from './AuthDialog.jsx';
import UndoBar from './UndoBar.jsx';
import Toast from './Toast.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import TransferDialog from './TransferDialog.jsx';

/**
 * 浮层栈。从 App.jsx 抽出来是为了守住 300 行线 —— 这里是纯组合，没有逻辑。
 * 顺序即层级：锁定横幅在最下，认证弹窗在确认弹窗之上。
 */
export default function AppOverlays({ sec, undo, toast, confirm, backend, transfer }) {
  return <>
    {sec.lock.locked && <div className="lock-banner" role="alert">
      <span>安全锁定</span>
      <b>{sec.lock.reason}</b>
      <button className="a2ui-btn a2ui-btn--secondary" onClick={sec.doUnlock}>解除锁定</button>
    </div>}

    {sec.auth && <AuthDialog
      request={sec.auth}
      onPass={method => { const p = sec.passAuth(method); if (p) transfer.onAuthenticated(p); }}
      onFail={sec.failAuth}
      onClose={sec.closeAuth}
    />}

    {undo.value && <UndoBar label={undo.value.label} deadline={undo.value.deadline} onCancel={undo.cancel}/>}
    <Toast toast={toast}/>

    {backend.mode && confirm.value?.type === 'transfer' && <TransferDialog
      operation={confirm.value} busy={backend.busy} code={backend.code} setCode={backend.setCode}
      error={backend.error} onSubmit={backend.onSubmit} onClose={backend.onClose}/>}
    <ConfirmDialog ctx={confirm.ctx}/>
  </>;
}
