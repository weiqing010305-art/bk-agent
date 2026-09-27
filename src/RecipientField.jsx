import React, { useEffect, useState } from 'react';
import { api, backendMode } from './api.js';
import { directory } from './bank.js';

export default function RecipientField({ contacts, draft, onChange, disabled }) {
  const manual = draft.recipientMode === 'manual';
  const number = (draft.cardNumber || '').replace(/\s/g, '');
  const [lookup, setLookup] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    if (!manual || !/^[0-9]{16,19}$/.test(number)) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const person = backendMode ? await api('/recipients/lookup', { cardNumber: number }) : directory.find(c => c.number === number);
        if (current) setLookup({ number, person, error: person ? '' : '数据库中未找到该演示卡号，请核对号码' });
      } catch (err) {
        if (current) setLookup({ number, error: err.status === 404 ? '数据库中未找到该演示卡号，请核对号码' : '查询失败，请检查连接后重试', retry: err.status !== 404 });
      }
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [manual, number, retryCount]);
  const result = lookup?.number === number ? lookup : null;
  const matched = manual ? result?.person : contacts.find(c => c.id === draft.contactId);
  const setMode = recipientMode => onChange({ ...draft, recipientMode, contactId: '', cardNumber: '' });
  return <fieldset className="recipient-field" disabled={disabled}>
    <legend>收款人</legend>
    <div className="recipient-modes">
      <label><input type="radio" name="recipient-mode" checked={!manual} onChange={() => setMode('saved')}/>常用收款人</label>
      <label><input type="radio" name="recipient-mode" checked={manual} onChange={() => setMode('manual')}/>手动输入卡号</label>
    </div>
    {manual ? <label>收款银行卡号
      <input type="text" inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={32} placeholder="输入完整演示卡号，可粘贴带空格的号码" value={draft.cardNumber || ''} onChange={e => onChange({ ...draft, cardNumber: e.target.value })}/>
    </label> : <label className="recipient-select">选择常用收款人
      <select value={draft.contactId} onChange={e => onChange({ ...draft, contactId: e.target.value })}>
        <option value="">请选择常用收款人</option>
        {contacts.map(c => <option value={c.id} key={c.id}>{c.name}　{c.number}</option>)}
      </select>
    </label>}
    <div className="recipient-preview" aria-live="polite">
      {matched ? <><span>收款人：<strong>{matched.name}</strong></span><span className="full-card-number">{matched.number}</span></> :
        manual && number ? <span>{/^[0-9]{16,19}$/.test(number) ? (result?.error || '正在按卡号查询收款人…') : '请输入 16–19 位数字，允许号码中含空格。'}</span> :
        <span>选择或输入后将在此展示姓名和完整卡号。</span>}
      {manual && result?.retry && <button type="button" className="secondary-btn" onClick={() => { setLookup(null); setRetryCount(n => n + 1); }}>重新查询</button>}
    </div>
    <small className="recipient-disclaimer">常用联系人 {contacts.length} 位；其他收款人可输入完整卡号查询。人物及卡号均为虚构，勿输入真实银行卡号。</small>
  </fieldset>;
}
