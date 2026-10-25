import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, X } from 'lucide-react';
import { api } from '../api/client.js';
import './modelSettings.css';

const PRESETS = {
  deepseek: { base_url: 'https://api.deepseek.com', model: 'deepseek-flash' },
  openai: { base_url: 'https://api.openai.com/v1', model: '' },
  custom: { base_url: '', model: '' },
};
const providerOf = base => base === PRESETS.deepseek.base_url ? 'deepseek'
  : base === PRESETS.openai.base_url ? 'openai' : 'custom';

export default function ModelSettings({ onClose }) {
  const dialog = useRef(null);
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState({ base_url: '', model: '', api_key: '' });
  const [provider, setProvider] = useState('custom');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const active = useRef(true);
  const adopt = value => {
    setSaved(value); setForm({ base_url: value.base_url, model: value.model, api_key: '' });
    setProvider(providerOf(value.base_url)); setVisible(false); setClearing(false);
  };
  const load = async () => {
    setBusy('loading'); setError('');
    try { const result = await api('/settings/model'); if (active.current) adopt(result); }
    catch (err) { if (active.current) setError(err.message); }
    finally { if (active.current) setBusy(''); }
  };
  useEffect(() => {
    active.current = true;
    const opener = document.activeElement;
    const node = dialog.current;
    node.showModal();
    load();
    return () => { active.current = false; node.close(); opener?.focus(); };
  }, []);
  const change = patch => {
    setForm(prev => ({ ...prev, ...patch })); setMessage(''); setError(''); setClearing(false);
  };
  const select = value => {
    setProvider(value); change({ ...PRESETS[value], api_key: '' });
  };
  const submit = async mode => {
    if (busy || !saved) return;
    setBusy(mode); setMessage(''); setError(''); setVisible(false);
    try {
      const body = mode === 'clear' ? { revision: saved.revision } : { ...form, revision: saved.revision };
      const result = await api('/settings/model' + (mode === 'save' ? '' : '/' + mode), body);
      if (mode === 'test') setMessage(result.message);
      else { adopt(result); setMessage(mode === 'clear' ? '配置已清除。' : '已保存，下次对话立即生效。'); }
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };
  const keepKey = saved?.has_key && form.base_url.replace(/\/$/, '') === saved.base_url;
  const valid = saved && form.base_url.trim() && form.model.trim() && (form.api_key.trim() || keepKey);
  return <dialog ref={dialog} className="model-settings" aria-labelledby="model-settings-title"
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
    onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <header className="model-settings-head">
      <div className="model-settings-title"><span><KeyRound size={21}/></span><h2 id="model-settings-title">模型设置</h2></div>
      <button type="button" className="model-settings-close" aria-label="关闭模型设置" disabled={Boolean(busy)} onClick={onClose}><X size={20}/></button>
    </header>
    <p className="model-settings-intro">接入你自己的模型，配置仅保存在本机。</p>
    <form onSubmit={e => { e.preventDefault(); submit('save'); }}>
      <fieldset disabled={Boolean(busy) || !saved}>
        <label htmlFor="model-provider">服务商</label>
        <select id="model-provider" value={provider} onChange={e => select(e.target.value)}>
          <option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option>
          <option value="custom">自定义兼容接口</option>
        </select>
        <label htmlFor="model-base">接口地址 · Base URL</label>
        <input id="model-base" type="url" autoComplete="off" spellCheck={false} maxLength={500}
          placeholder="https://example.com/v1" value={form.base_url} onChange={e => { setProvider(providerOf(e.target.value)); change({ base_url: e.target.value }); }} required/>
        <label htmlFor="model-name">模型名称</label>
        <input id="model-name" autoComplete="off" spellCheck={false} maxLength={160}
          placeholder="填写服务商提供的模型 ID" value={form.model} onChange={e => change({ model: e.target.value })} required/>
        <label htmlFor="model-key">API Key <small>{keepKey ? '已保存，留空保留' : '请填写此接口的密钥'}</small></label>
        <div className="model-key-input">
          <input id="model-key" type={visible ? 'text' : 'password'} autoComplete="off" spellCheck={false} maxLength={512}
            placeholder={keepKey ? '填写新密钥以替换' : '输入 API Key'} value={form.api_key}
            onChange={e => change({ api_key: e.target.value })} required={!keepKey}/>
          <button type="button" aria-label={visible ? '隐藏 API Key' : '显示 API Key'} aria-pressed={visible} onClick={() => setVisible(v => !v)}>
            {visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
        </div>
        {saved?.has_key && !keepKey && <small className="model-address-note">更换地址需重新填写密钥。</small>}
      </fieldset>
      <div className="model-settings-status" aria-live="polite">
        {busy && <span><LoaderCircle size={17} className="model-settings-spinner"/>{busy === 'loading' ? '读取配置…' : busy === 'test' ? '连接测试中…' : '保存中…'}</span>}
        {message && <span className="model-settings-success"><CheckCircle2 size={17}/>{message}</span>}
        {error && <p role="alert">{error}</p>}
      </div>
      <footer className="model-settings-actions">
        <button type="button" className="ghost-btn" disabled={!valid || Boolean(busy)} onClick={() => submit('test')}>测试连接</button>
        <button type="submit" className="primary-btn" disabled={!valid || Boolean(busy)}>保存并应用</button>
      </footer>
    </form>
    <div className="model-settings-bottom">
      <small>密钥不回显，不保存在浏览器。</small>
      {saved?.configured && <button type="button" className="link-btn" disabled={Boolean(busy)} onClick={() => clearing ? submit('clear') : setClearing(true)}>
        {clearing ? '确认清除配置' : '清除配置'}</button>}
      {!saved && !busy && <button type="button" className="link-btn" onClick={load}>重新加载</button>}
    </div>
  </dialog>;
}
