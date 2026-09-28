import { useCallback, useEffect } from 'react';
import { api, backendMode, binding } from '../api/client.js';

/**
 * 后端模式的账本同步。
 *
 * 只在 `VITE_API_MODE=backend` 时工作；本地 mock 模式下这三个函数都不会被调用。
 * 从 App.jsx 抽出来是为了守住 300 行线 —— 它是一整块与 UI 无关的传输逻辑。
 */
export function useBackendBank({ setBank, setContacts, setConnection, setToast, setBusy, setApiError, setConfirm, confirm, verificationCode, busyRef }) {
  const refreshBank = useCallback(async () => {
    const state = await api('/state');
    setBank(prev => ({ ...prev, balance: state.balance, transactions: state.transactions, completed: state.completed }));
    setContacts(state.contacts);
    setConnection('ready');
  }, [setBank, setContacts, setConnection]);

  const connect = useCallback(async () => {
    setConnection('loading');
    try { await api('/session', {}); await refreshBank(); }
    catch (err) { setConnection('error'); setToast(err.message); }
  }, [refreshBank, setConnection, setToast]);

  useEffect(() => { if (backendMode) connect(); }, [connect]);

  /** 核对 → 确认 → 验证码 → 记账。失败一律进入 uncertain，绝不重复发起。 */
  const applyBackendTransfer = useCallback(async () => {
    if (busyRef.current || !confirm) return;
    const op = confirm;
    busyRef.current = true; setBusy(true); setApiError('');
    try {
      if (op.uncertain) await api('/operations/' + op.id);
      else if (!op.challenge_id) {
        const r = await api('/operations/' + op.id + '/confirm', binding(op));
        setConfirm(r);
      } else {
        await api('/operations/' + op.id + '/verify', { ...binding(op), challenge_id: op.challenge_id, code: verificationCode });
      }
      setConfirm(null); setToast('模拟转账已完成');
      await refreshBank();
    } catch (err) {
      setApiError(err.message);
      if (!err.status || err.status >= 500) setConfirm(prev => ({ ...prev, uncertain: true }));
    } finally { busyRef.current = false; setBusy(false); }
  }, [confirm, verificationCode, refreshBank, setBusy, setApiError, setConfirm, setToast, busyRef]);

  return { refreshBank, connect, applyBackendTransfer };
}
