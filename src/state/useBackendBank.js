import { useCallback, useEffect } from 'react';
import { api, backendMode, binding } from '../api/client.js';
import { normalize } from '../domain/bank.js';

const pendingKey = 'qinghe-pending-transfer-v1';
const savePending = value => {
  try { value ? sessionStorage.setItem(pendingKey, JSON.stringify(value)) : sessionStorage.removeItem(pendingKey); }
  catch { /* The server remains the operation source of truth. */ }
};
const readPending = () => { try { return JSON.parse(sessionStorage.getItem(pendingKey)); } catch { return null; } };
const terminalError = op => op.status === 'EXPIRED' ? '本次核对已过期，请返回修改。'
  : op.failure === 'INSUFFICIENT_FUNDS' ? '余额不足，本次转账未执行。' : '本次验证未通过，请返回修改。';

/** Same-origin backend session, account snapshots and idempotent transfers. */
export function useBackendBank({ setBank, setContacts, setConnection, setToast, setBusy, setApiError,
  setConfirm, confirm, verificationCode, setVerificationCode, busyRef }) {
  const refreshBank = useCallback(async () => {
    const state = await api('/state');
    if (!Number.isSafeInteger(state.balance) || !Array.isArray(state.transactions) || !Array.isArray(state.contacts)) {
      throw new Error('账户数据暂不可用，请稍后重试。');
    }
    setBank(prev => normalize({ ...prev, available: state.balance,
      opening: state.balance - state.transactions.reduce((sum, t) => sum + t.amount, 0),
      savings: state.savings || {}, transactions: state.transactions, completed: state.completed }));
    setContacts(state.contacts);
    setConnection('ready');
    return state;
  }, [setBank, setContacts, setConnection]);

  const showOperation = useCallback(op => {
    const value = { ...op, type: 'transfer', uncertain: false };
    setConfirm(value); setVerificationCode('');
    if (['FAILED', 'EXPIRED'].includes(op.status)) {
      savePending(null); setApiError(terminalError(op));
    } else {
      savePending({ id: op.id }); setApiError('');
    }
    return value;
  }, [setConfirm, setVerificationCode, setApiError]);

  const connect = useCallback(async () => {
    setConnection('loading');
    try {
      await api('/session', {}); await refreshBank();
      const pending = readPending();
      if (!pending) return;
      let op = pending.params
        ? await api('/operations', pending.params, { 'Idempotency-Key': pending.key })
        : await api('/operations/' + pending.id);
      if (op.status === 'SUCCEEDED') { savePending(null); return; }
      if (op.status === 'AWAITING_VERIFICATION') op = await api('/operations/' + op.id + '/confirm', binding(op));
      showOperation(op);
    } catch (err) {
      if (err.status === 404) { savePending(null); return; }
      setConnection('error'); setToast(err.message);
    }
  }, [refreshBank, showOperation, setConnection, setToast]);
  useEffect(() => { if (backendMode) connect(); }, [connect]);

  const prepareTransfer = useCallback(async payload => {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(true); setApiError('');
    const params = { ...(payload.cardNumber ? { cardNumber: payload.cardNumber } : { contactId: payload.contactId }),
      amount: payload.amount, note: payload.note || '' };
    const previous = readPending();
    const key = previous?.params && JSON.stringify(previous.params) === JSON.stringify(params)
      ? previous.key : payload.id || crypto.randomUUID();
    savePending({ params, key });
    try {
      const op = await api('/operations', params, { 'Idempotency-Key': key });
      return showOperation(op);
    } catch (err) {
      if (err.status && err.status < 500) savePending(null);
      setToast(err.message); return null;
    } finally { busyRef.current = false; setBusy(false); }
  }, [busyRef, setBusy, setApiError, showOperation, setToast]);

  const applyBackendTransfer = useCallback(async (credentials = {}) => {
    if (busyRef.current || !confirm || ['FAILED', 'EXPIRED'].includes(confirm.status)) return;
    const op = confirm;
    busyRef.current = true; setBusy(true); setApiError('');
    try {
      let result;
      if (op.uncertain) {
        result = await api('/operations/' + op.id);
        if (result.status === 'AWAITING_VERIFICATION') result = await api('/operations/' + op.id + '/confirm', binding(result));
      } else if (!op.challenge_id) {
        result = await api('/operations/' + op.id + '/confirm', binding(op));
      } else {
        const passwordMode = op.auth_method?.startsWith('password');
        result = await api('/operations/' + op.id + (passwordMode ? '/verify-password' : '/verify'), {
          ...binding(op), challenge_id: op.challenge_id,
          ...(passwordMode ? { password: credentials.password, code: verificationCode } : { code: verificationCode }),
        });
      }
      if (result.status !== 'SUCCEEDED') { showOperation(result); return; }
      savePending(null); setConfirm(null); setVerificationCode('');
      try { await refreshBank(); setToast('转账已完成'); }
      catch { setConnection('error'); setToast('转账已完成，余额刷新失败，请刷新页面。'); }
    } catch (err) {
      setApiError(err.message);
      if (!err.status || err.status >= 500 || err.code === 'STEP_UP_REQUIRED') setConfirm(prev => ({ ...prev, uncertain: true }));
    } finally { busyRef.current = false; setBusy(false); }
  }, [confirm, verificationCode, refreshBank, showOperation, setBusy, setApiError, setConfirm,
    setVerificationCode, setConnection, setToast, busyRef]);

  const closeTransfer = useCallback(() => {
    if (busyRef.current || confirm?.uncertain) return;
    savePending(null); setConfirm(null); setApiError(''); setVerificationCode('');
  }, [busyRef, confirm, setConfirm, setApiError, setVerificationCode]);
  return { refreshBank, connect, prepareTransfer, applyBackendTransfer, closeTransfer, showOperation };
}
