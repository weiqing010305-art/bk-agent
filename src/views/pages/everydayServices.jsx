import React, { useEffect, useRef, useState } from 'react';
import { Page, Panel, Empty } from '../parts.jsx';
import { api } from '../../api/client.js';
import { paymentDetails, utilityNames, creditBill, creditDue } from '../../domain/payments.js';
import { UtilityTypes, UtilityOverview, UtilityHistory, useUtilityReport } from './utilityInsights.jsx';
import { ServiceJourney, ServiceReceipt } from './serviceJourney.jsx';
import PaymentAccount from './paymentAccount.jsx';
import './everydayServices.css';

const titles = { traffic: '交通卡充值', phone: '手机充值', utility: '生活缴费', exchange: '外币兑换', credit: '信用卡还款', appointment: '网点预约' };
const businesses = ['开户与账户服务', '银行卡业务', '现金存取', '信用卡业务', '其他柜台业务'];
const currencies = { USD: '美元 USD', EUR: '欧元 EUR', HKD: '港币 HKD', JPY: '日元 JPY' };
const branches = ['青禾中心支行', '青禾城南支行', '青禾城北支行'];
const slots = ['09:00–10:00', '10:00–11:00', '14:00–15:00', '15:00–16:00'];
const dateAfter = days => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const pendingKey = 'qinghe-payment-pending-v1';
function pendingFor(kind) {
  try { const p = JSON.parse(sessionStorage.getItem(pendingKey)); return p?.kind === kind && p.id ? p : null; }
  catch { return null; }
}

/** 概览服务共用核对、卡片选择与结果样式；密码不进入保存的数据。 */
export default function EverydayServices({ ctx }) {
  const { route: kind, bank, services, setServices, setRoute, payService, yuan, refreshBank, backendMode, exchangeDraft, setExchangeDraft } = ctx;
  const pending = useRef(pendingFor(kind));
  const requestId = useRef(pending.current?.id || ctx.serviceDraft?.id || crypto.randomUUID());
  const composing = useRef(false);
  const paying = useRef(false);
  const [fields, setFields] = useState(pending.current || {
    target: kind === 'credit' ? creditBill.id : kind === 'phone' ? services.phone : kind === 'traffic' ? services.trafficCard : '',
    amountText: kind === 'credit' ? (creditDue(bank) / 100).toFixed(2) : ['phone', 'traffic'].includes(kind) ? '100' : '',
    cardId: bank.cards.find(c => c.id !== 'credit' && c.status === 'active')?.id || '', utility: 'water',
    currency: 'USD', date: dateAfter(1), slot: slots[0], branch: branches[0], phone: services.phone, business: businesses[0],
    ...(kind === 'exchange' ? exchangeDraft : {}),
    ...(ctx.serviceDraft || {}),
  });
  useEffect(() => { if (kind === 'exchange' && exchangeDraft) setExchangeDraft(null); }, [kind, exchangeDraft, setExchangeDraft]);
  const [step, setStep] = useState(pending.current || ctx.serviceDraft ? 'review' : 'form');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(!!pending.current);
  const [result, setResult] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all');
  const { report, setMonth } = useUtilityReport(bank.transactions);
  const entryRef = useRef(null);
  const scrollToEntry = () => requestAnimationFrame(() => {
    const heading = entryRef.current?.querySelector('h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    entryRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  useEffect(() => { if (step !== 'form') scrollToEntry(); }, [step]);
  const exchange = kind === 'exchange';
  const booking = exchange || kind === 'appointment';
  const due = creditDue(bank);
  const appointments = services.appointments.filter(b => (b.kind || 'exchange') === kind);
  const trip = services.trips.find(t => t.id === fields.tripId);
  const backRoute = trip ? 'travel' : 'overview';
  const exchangeMax = trip ? [dateAfter(30), new Date(new Date(trip.start + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10)].sort()[0] : dateAfter(30);
  const update = (key, value) => { setFields(f => ({ ...f, [key]: value })); setError(''); };
  const remember = phone => { if (/^1[3-9]\d{9}$/.test(phone)) setServices(s => ({ ...s, phone })); };
  const draft = () => ({ id: requestId.current, kind, target: fields.target.trim(),
    ...(ctx.serviceTask ? { agentTaskId: ctx.serviceTask.id, agentVersion: ctx.serviceTask.version }
      : pending.current?.agentTaskId ? { agentTaskId: pending.current.agentTaskId, agentVersion: pending.current.agentVersion } : {}),
    utility: fields.utility, cardId: fields.cardId, amount: Math.round(Number(fields.amountText) * 100) });
  const validate = () => {
    if (booking) {
      if (!/^1[3-9]\d{9}$/.test(fields.phone)) throw new Error('请输入有效的联系手机号。');
      if (exchange && (!/^\d+$/.test(fields.amountText) || Number(fields.amountText) < 1 || Number(fields.amountText) > 100000)) throw new Error('请输入 1–100000 的外币预约金额（整数）。');
      if (fields.date < dateAfter(1) || fields.date > dateAfter(30)) throw new Error('请选择未来 30 天内的预约日期。');
      if (exchange && fields.tripId && (!trip || fields.date >= trip.start)) throw new Error('兑换预约必须在行程出发前，请调整日期。');
      if (!branches.includes(fields.branch) || !slots.includes(fields.slot) || (exchange ? !currencies[fields.currency] : !businesses.includes(fields.business))) throw new Error('请选择有效的网点、时段和业务。');
      if (services.appointments.some(b => b.status === '已预约' && b.date === fields.date && b.slot === fields.slot)) throw new Error('这个时段已有预约，请选择其他时段或先取消原预约。');
    } else {
      if (!/^\d+(\.\d{1,2})?$/.test(fields.amountText)) throw new Error('请输入金额，最多两位小数。');
      paymentDetails(bank, draft());
      if (draft().amount > bank.balance) throw new Error('账户余额不足，请调整金额或补充演示余额。');
    }
  };
  const complete = receipt => {
    sessionStorage.removeItem(pendingKey);
    if (kind === 'utility') { setMonth(null); setHistoryFilter('all'); }
    setUncertain(false); setPassword(''); setResult(receipt); setStep('done');
  };
  const submit = async e => {
    e.preventDefault();
    if (composing.current || paying.current) return;
    setError('');
    try {
      validate();
      if (step === 'form') {
        if (ctx.syncAgentPhone) { await ctx.syncAgentPhone(fields); return; }
        if (kind === 'phone') remember(fields.target);
        if (kind === 'traffic') setServices(s => ({ ...s, trafficCard: fields.target.trim() }));
        setStep('review'); return;
      }
      if (booking) {
        const appointment = { ...fields, kind, id: requestId.current, createdAt: new Date().toISOString(), status: '已预约' };
        setServices(s => ({ ...s, phone: fields.phone, appointments: [appointment, ...s.appointments] }));
        setResult(appointment); setStep('done'); return;
      }
      if (password !== '123456') throw new Error('支付密码不正确，请重新输入。');
      const otherPending = pendingFor('phone') || pendingFor('utility') || pendingFor('credit') || pendingFor('traffic');
      if (backendMode && otherPending && otherPending.id !== requestId.current) throw new Error(`还有一笔${titles[otherPending.kind]}结果未确认，请返回该页面查询原支付结果。`);
      paying.current = true; setBusy(true);
      if (backendMode) sessionStorage.setItem(pendingKey, JSON.stringify({ ...fields, kind, id: requestId.current,
        ...(ctx.serviceTask ? { agentTaskId: ctx.serviceTask.id, agentVersion: ctx.serviceTask.version } : {}) }));
      const receipt = await payService({ ...draft(), password });
      complete(receipt);
    } catch (err) {
      setError(err.message); setPassword('');
      if (paying.current && backendMode && (!err.status || err.status >= 500)) setUncertain(true);
      else if (paying.current) sessionStorage.removeItem(pendingKey);
    } finally { paying.current = false; setBusy(false); }
  };
  const query = async () => {
    setBusy(true); setError('');
    try {
      const receipt = await api('/operations/' + requestId.current);
      if (receipt.status !== 'SUCCEEDED') throw new Error('支付结果尚未确认，请稍后再次查询。');
      await refreshBank(); complete(receipt);
    } catch (err) {
      if (err.status === 404) { setUncertain(false); sessionStorage.removeItem(pendingKey); setError('原请求未记账，可重新输入密码继续支付。'); }
      else setError(err.message);
    } finally { setBusy(false); }
  };
  const field = (key, label, props = {}) => <label className={'service-field' + (key === 'amountText' ? ' service-field--amount' : '')}>{label}
    <input required value={fields[key]} onChange={e => update(key, e.target.value)} {...props}/>
  </label>;
  const card = bank.cards.find(c => c.id === fields.cardId);
  const repeat = record => {
    if (busy || uncertain) return;
    requestId.current = crypto.randomUUID();
    setFields(f => ({ ...f, utility: record.kind, target: record.target, amountText: '' }));
    setPassword(''); setError(''); setStep('form'); setResult(null); scrollToEntry();
  };
  return <Page title={titles[kind]} subtitle={kind === 'utility' ? '水、电、燃气，一处查看和办理' : booking ? '选择业务、时间与网点' : '填写信息，核对后支付'}
    aside={<button className="link-btn service-back" onClick={() => setRoute(backRoute)}>{trip ? '返回出行钱袋' : '返回概览'}</button>}>
    {trip && <p className="page-note">为“{trip.destination}”预约兑换 · 出发日期 {trip.start}，保存后会关联到这次行程。</p>}
    {kind === 'credit' && <Panel title={`${creditBill.name} · 尾号 ${creditBill.tail}`}>
      <dl className="service-review"><div><dt>本期待还</dt><dd><strong>{yuan(due)}</strong></dd></div><div><dt>还款日</dt><dd>{creditBill.dueDate}</dd></div></dl>
      <p className="page-note">演示账单 {yuan(creditBill.amount)}；本期还款后待还金额同步减少。</p>
    </Panel>}
    {kind === 'utility' && <UtilityOverview report={report} setMonth={setMonth} filter={historyFilter} setFilter={setHistoryFilter} yuan={yuan}/>}
    <ServiceJourney step={step} booking={booking}/>
    <div className={'service-workspace' + (kind === 'utility' ? ' service-workspace--utility' : '')}>
    <div ref={entryRef} className="service-entry">
    {step === 'done' ? <Panel>
      <ServiceReceipt title={booking ? '预约已保存' : '支付成功'} amount={booking ? null : yuan(draft().amount)}
        action={<button className="a2ui-btn a2ui-btn--primary" onClick={() => setRoute(booking ? backRoute : 'bills')}>{booking ? trip ? '返回出行钱袋' : '返回概览' : '查看账单'}</button>}>
      <p>{booking ? `${fields.date} ${fields.slot} · ${fields.branch}` : `${kind === 'utility' ? utilityNames[fields.utility] + ' · ' + fields.target : titles[kind]}，已记入账单。`}</p>
      <p>编号：{result.id}</p>
      {exchange && <p>{currencies[fields.currency]} {fields.amountText} · 请携带有效身份证件到店，汇率及可兑换金额以柜台确认为准。</p>}
      {kind === 'appointment' && <p>办理业务：{fields.business} · 联系电话：{fields.phone}。请携带有效身份证件，所需材料以网点确认为准。</p>}
      </ServiceReceipt>
    </Panel> : <Panel title={step === 'review' ? '核对信息' : booking ? '填写预约' : '填写信息'}>
      <form className="service-form" onSubmit={submit} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
        {step === 'form' ? <fieldset disabled={busy}>
          {kind === 'phone' && <>
            {field('target', '充值手机号', { type: 'tel', inputMode: 'numeric', maxLength: 11, autoComplete: 'tel', onBlur: () => remember(fields.target), placeholder: '输入一次，自动记住' })}
            <div className="chips-row">{[30, 50, 100, 200, 300].map(n => <button type="button" key={n} className={'chip' + (fields.amountText === String(n) ? ' on' : '')} aria-pressed={fields.amountText === String(n)} onClick={() => update('amountText', String(n))}>{n} 元</button>)}</div>
          </>}
          {kind === 'traffic' && <>
            {field('target', '交通卡号', { inputMode: 'numeric', maxLength: 20, placeholder: '输入 8–20 位卡号，自动记住' })}
            <div className="chips-row">{[20, 50, 100, 200, 500].map(n => <button type="button" key={n} className={'chip' + (fields.amountText === String(n) ? ' on' : '')} aria-pressed={fields.amountText === String(n)} onClick={() => update('amountText', String(n))}>{n} 元</button>)}</div>
          </>}
          {kind === 'utility' && <>
            <UtilityTypes value={fields.utility} onChange={value => update('utility', value)}/>
            {field('target', '缴费户号', { inputMode: 'numeric', maxLength: 20, placeholder: '输入 6–20 位户号' })}
          </>}
          {kind === 'credit' && <div className="service-actions"><button type="button" className="a2ui-btn a2ui-btn--secondary" disabled={!due} onClick={() => update('amountText', (due / 100).toFixed(2))}>全额还款 {yuan(due)}</button><span>也可在下方填写自定义金额</span></div>}
          {booking && <>
            {exchange ? <label className="service-field">兑换币种<select value={fields.currency} onChange={e => update('currency', e.target.value)}>{Object.entries(currencies).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
              : <label className="service-field">办理业务<select value={fields.business} onChange={e => update('business', e.target.value)}>{businesses.map(b => <option key={b}>{b}</option>)}</select></label>}
            {field('phone', '联系手机号', { type: 'tel', inputMode: 'numeric', maxLength: 11 })}
            {field('date', '预约日期', { type: 'date', min: dateAfter(1), max: exchange ? exchangeMax : dateAfter(30) })}
            <label className="service-field">预约时段<select value={fields.slot} onChange={e => update('slot', e.target.value)}>{slots.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="service-field">{exchange ? '兑换网点' : '预约网点'}<select value={fields.branch} onChange={e => update('branch', e.target.value)}>{branches.map(b => <option key={b}>{b}</option>)}</select><small>演示营业时间：09:00–16:00；具体业务及材料需到店确认。</small></label>
          </>}
          {kind !== 'appointment' && field('amountText', exchange ? '预约外币金额' : kind === 'credit' ? '还款金额（元）' : '支付金额（元）', { inputMode: exchange ? 'numeric' : 'decimal', placeholder: exchange ? '输入外币整数金额' : '输入金额' })}
          {!booking && <PaymentAccount cards={bank.cards} value={fields.cardId} onChange={value => update('cardId', value)} balance={yuan(bank.balance)}/>}
        </fieldset> : <>
          <dl className="service-review">
            {Object.entries(booking ? { ...(exchange ? { 币种: currencies[fields.currency], 外币金额: fields.amountText } : { 办理业务: fields.business }), 联系电话: fields.phone, 预约日期: fields.date, 时段: fields.slot, 网点: fields.branch }
              : { 业务: kind === 'utility' ? utilityNames[fields.utility] : titles[kind], [kind === 'credit' ? '信用卡' : kind === 'phone' ? '手机号' : kind === 'traffic' ? '交通卡号' : '户号']: kind === 'credit' ? `${creditBill.name} · 尾号 ${creditBill.tail}` : fields.target, 金额: yuan(draft().amount), 银行卡: `${card?.name || ''} · 尾号 ${card?.tail || ''}` }).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {!booking && !uncertain && <label className="service-field">支付密码<input type="password" inputMode="numeric" autoComplete="off" maxLength={6} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/><small>演示支付密码：123456</small></label>}
        </>}
        {error && <p role="alert" className="service-error">{error}</p>}
        {uncertain ? <button type="button" className="a2ui-btn a2ui-btn--primary" onClick={query} disabled={busy}>{busy ? '查询中…' : '查询原支付结果'}</button> : <div className="service-actions">
          {step === 'review' && <button type="button" className="a2ui-btn a2ui-btn--secondary" disabled={busy} onClick={() => { setStep('form'); setPassword(''); requestId.current = crypto.randomUUID(); }}>修改信息</button>}
          <button className="a2ui-btn a2ui-btn--primary" type="submit" disabled={busy || (kind === 'credit' && !due)}>{busy ? '支付中…' : kind === 'credit' && !due ? '本期已还清' : step === 'form' ? '下一步' : booking ? '确认预约' : '确认支付'}</button>
        </div>}
      </form>
    </Panel>}
    </div>
    {kind === 'utility' && <UtilityHistory report={report} filter={historyFilter} setFilter={setHistoryFilter} yuan={yuan} onRepeat={repeat} canRepeat={!busy && !uncertain}/>}
    </div>
    {booking && <Panel title={exchange ? '我的兑换预约' : '我的网点预约'}>
      {appointments.length ? <ul className="service-bookings">{appointments.map(b => <li key={b.id}>
        <div><strong>{b.branch} · {b.status}</strong><p>{b.date} {b.slot} · {exchange ? `${currencies[b.currency]} ${b.amountText}` : b.business}</p><small>预约编号：{b.id}</small></div>
        {b.status === '已预约' && <button className="link-btn" onClick={() => setServices(s => ({ ...s, appointments: s.appointments.map(a => a.id === b.id ? { ...a, status: '已取消' } : a) }))}>取消预约</button>}
      </li>)}</ul> : <Empty>还没有预约。</Empty>}
    </Panel>}
    <p className="page-note">{booking ? '网点为演示网点，预约保存在此浏览器；不产生真实预约或扣款。' : kind === 'credit' ? '仅演示本期信用卡还款，不向真实信用卡账户还款。' : kind === 'traffic' ? '交通卡为演示充值，未连接真实一卡通，不会向实体卡写入余额。' : '演示支付，不向运营商或水电燃气公司发起真实扣费。'}</p>
  </Page>;
}
