import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint, LockKeyhole, ShieldAlert, Smartphone, Usb, X } from 'lucide-react';
import { FACTORS } from '../services/policy.js';

/**
 * 多因子认证（赛题高优先级项）。
 *
 * 赛题原文：大额转账、密码修改、卡片挂失解挂、理财申购等，
 * 须通过**人脸识别、短信验证码或 U 盾**等多因子认证。
 *
 * 三种都做成可演示的：
 *   短信 —— 输入 6 位演示验证码（正确码显示在提示里，这是演示环境）
 *   人脸 —— 按钮触发 2 秒活体检测进度，带扫描动效
 *    U 盾 —— 长按 1.2 秒（模拟插入并确认）
 * 失败累计 3 次由 audit 层触发安全锁定。
 */

const ICONS = { sms: Smartphone, face: Fingerprint, token: Usb };

export default function AuthDialog({ request, onPass, onFail, onClose }) {
  const [factor, setFactor] = useState('sms');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [holding, setHolding] = useState(0);
  const [error, setError] = useState('');
  const holdTimer = useRef(null);
  const scanTimer = useRef(null);

  /* 演示用验证码：固定值，明写在提示里 —— 不假装这是真验证 */
  const DEMO_CODE = '824613';

  useEffect(() => () => { clearInterval(holdTimer.current); clearTimeout(scanTimer.current); }, []);

  const fail = msg => {
    setError(msg);
    onFail(msg);
  };

  const submitSms = () => {
    if (code.replace(/\D/g, '').length !== 6) return fail('请输入 6 位验证码');
    if (code !== DEMO_CODE) return fail('验证码不正确');
    onPass('短信验证码');
  };

  const startFace = () => {
    setError(''); setScanning(true);
    scanTimer.current = setTimeout(() => { setScanning(false); onPass('人脸识别'); }, 1800);
  };

  const startHold = () => {
    setError(''); setHolding(1);
    const t0 = Date.now();
    holdTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200);
      setHolding(p);
      if (p >= 1) { clearInterval(holdTimer.current); setHolding(0); onPass('U 盾'); }
    }, 40);
  };
  const stopHold = () => { clearInterval(holdTimer.current); setHolding(0); };

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={e => e.stopPropagation()}>
      <button className="icon-btn" aria-label="关闭" onClick={onClose} style={{ alignSelf: 'flex-end' }}><X size={16}/></button>

      <span className="auth-icon"><ShieldAlert size={22}/></span>
      <h2 id="auth-title">需要多因子认证</h2>
      <p>{request.reason}</p>

      <div className="auth-op">
        <LockKeyhole size={14}/>
        <span>{request.label}</span>
        {request.amountText && <b>{request.amountText}</b>}
      </div>

      <div className="auth-tabs" role="tablist" aria-label="验证方式">
        {FACTORS.map(f => {
          const Icon = ICONS[f.id] || Smartphone;
          return <button key={f.id} role="tab" aria-selected={factor === f.id}
            className={'auth-tab' + (factor === f.id ? ' on' : '')}
            onClick={() => { setFactor(f.id); setError(''); setCode(''); }}>
            <Icon size={16}/>{f.label}
          </button>;
        })}
      </div>

      <div className="auth-body">
        {factor === 'sms' && <>
          <label className="auth-field">
            <span>{FACTORS[0].hint}</span>
            <input className="a2ui-input" inputMode="numeric" maxLength={6} placeholder="6 位验证码"
                   value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus/>
          </label>
          <p className="auth-demo">演示环境验证码：<b>{DEMO_CODE}</b></p>
          <button className="primary-btn" onClick={submitSms}>验证并执行</button>
        </>}

        {factor === 'face' && <>
          <div className={'auth-face' + (scanning ? ' scanning' : '')}>
            <Fingerprint size={40}/>
            {scanning && <span className="auth-scan"/>}
          </div>
          <p className="auth-demo">{scanning ? '正在活体检测…' : FACTORS[1].hint}</p>
          <button className="primary-btn" disabled={scanning} onClick={startFace}>{scanning ? '识别中…' : '开始人脸识别'}</button>
        </>}

        {factor === 'token' && <>
          <button className="auth-hold" onMouseDown={startHold} onMouseUp={stopHold} onMouseLeave={stopHold}
                  onTouchStart={startHold} onTouchEnd={stopHold}>
            <Usb size={22}/>
            <span>长按 1.2 秒确认</span>
            <i style={{ transform: 'scaleX(' + holding + ')' }}/>
          </button>
          <p className="auth-demo">{FACTORS[2].hint}</p>
        </>}
      </div>

      {error && <p className="api-error" role="alert">{error}</p>}
      <p className="auth-note">验证失败累计 3 次会触发安全锁定，需手动解除。</p>
    </div>
  </div>;
}
