import React, { useEffect, useRef, useState } from 'react';
import { Check, CreditCard, Plane } from 'lucide-react';
import { Page, Panel, Empty } from '../parts.jsx';
import { TEMPLATE, isHydrated } from './cardData.jsx';
import { travelCurrencies, travelDate, validateTrip, travelCardStatus } from '../../domain/travel.js';
import './everydayServices.css';
import './travelWallet.css';

const emptyTrip = cards => ({ destination: '', start: travelDate(7), end: travelDate(12),
  cardId: cards.find(c => c.id === 'travel')?.id || cards[0]?.id || '', currency: 'JPY', cashAmount: '0' });
const checklist = { documents: '出行证件已核对', backup: '备用支付方式已准备', contact: '银行联系方式已保存' };

export default function TravelWallet({ ctx }) {
  const { bank, services, setServices, setRoute, setExchangeDraft, yuan, travelDraft, setTravelDraft } = ctx;
  // 只补展示档案，不改变卡片状态、限额或账户余额。
  const cards = bank.cards.map(c => ({ ...c, channels: isHydrated(c) ? c.channels : TEMPLATE[c.id]?.channels || [] }));
  const trips = services.trips;
  const [selectedId, setSelectedId] = useState(travelDraft ? null : trips.find(t => t.id === services.activeTripId)?.id || trips[0]?.id || null);
  const selected = trips.find(t => t.id === selectedId);
  const [editing, setEditing] = useState(!selected);
  const [fields, setFields] = useState(selected || { ...emptyTrip(cards), ...travelDraft });
  useEffect(() => { if (travelDraft) setTravelDraft(null); }, [travelDraft, setTravelDraft]);
  const [error, setError] = useState('');
  const composing = useRef(false);
  const card = cards.find(c => c.id === selected?.cardId);
  const readiness = travelCardStatus(card);
  const cashNeeded = Number(selected?.cashAmount) > 0;
  const bookings = services.appointments.filter(b => b.tripId === selectedId);
  const liveBooking = bookings.find(b => b.status === '已预约' && b.currency === selected?.currency && Number(b.amountText) === Number(selected?.cashAmount) && b.date >= travelDate() && b.date < selected?.start);
  const checks = selected?.checks || {};
  const progress = Number(readiness.ready) + Object.keys(checklist).filter(k => checks[k]).length + Number(!cashNeeded || !!checks.cash);
  const update = (key, value) => { setFields(f => ({ ...f, [key]: value })); setError(''); };
  const save = e => {
    e.preventDefault(); if (composing.current) return;
    try {
      const trip = { ...validateTrip(fields, cards), id: selectedId || crypto.randomUUID(), checks: fields.checks || {}, updatedAt: new Date().toISOString() };
      if (selected && (trip.destination !== selected.destination || trip.start !== selected.start || trip.end !== selected.end || trip.cardId !== selected.cardId || trip.currency !== selected.currency || trip.cashAmount !== selected.cashAmount)) trip.checks = {};
      setServices(s => ({ ...s, activeTripId: trip.id, trips: [trip, ...s.trips.filter(t => t.id !== trip.id)] }));
      setSelectedId(trip.id); setFields(trip); setEditing(false); setError('');
    } catch (e) { setError(e.message); }
  };
  const toggle = key => setServices(s => ({ ...s, trips: s.trips.map(t => t.id === selectedId ? { ...t, checks: { ...t.checks, [key]: !t.checks?.[key] } } : t) }));
  const openExchange = () => {
    setServices(s => ({ ...s, activeTripId: selected.id }));
    setExchangeDraft({ currency: selected.currency, amountText: selected.cashAmount, phone: services.phone, tripId: selected.id });
    setRoute('exchange');
  };
  const field = (key, label, props = {}) => <label className="service-field">{label}<input required value={fields[key]} onChange={e => update(key, e.target.value)} {...props}/></label>;
  return <Page title="出行钱袋" subtitle="把用卡、现金兑换和出发准备放在一处"
    aside={<button className="link-btn service-back" onClick={() => setRoute('overview')}>返回概览</button>}>
    {trips.length > 0 && <div className="travel-switch" role="group" aria-label="已保存行程">
      {trips.map(t => <button key={t.id} type="button" className={'chip' + (t.id === selectedId ? ' on' : '')} aria-pressed={t.id === selectedId}
        onClick={() => { setSelectedId(t.id); setFields(t); setEditing(false); setError(''); setServices(s => ({ ...s, activeTripId: t.id })); }}>{t.destination} · {t.start}</button>)}
      <button type="button" className="link-btn" onClick={() => { setSelectedId(null); setFields(emptyTrip(cards)); setEditing(true); setError(''); }}>新建行程</button>
    </div>}
    {editing ? <Panel title={selected ? '修改行程' : '准备一次出行'}>
      <form className="service-form" onSubmit={save} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
        {field('destination', '目的地', { maxLength: 40, placeholder: '例如：日本 · 东京' })}
        <div className="travel-dates">{field('start', '出发日期', { type: 'date', min: travelDate(1) })}{field('end', '返程日期', { type: 'date', min: fields.start })}</div>
        <label className="service-field">出行银行卡<select required value={fields.cardId} onChange={e => update('cardId', e.target.value)}><option value="">请选择银行卡</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name} · 尾号 {c.tail}{c.status !== 'active' ? '（已冻结）' : ''}</option>)}</select><small>保存后检查卡片状态与境外支付渠道。</small></label>
        <label className="service-field">准备的现金币种<select value={fields.currency} onChange={e => update('currency', e.target.value)}>{Object.entries(travelCurrencies).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        {field('cashAmount', '预计外币现金金额', { inputMode: 'numeric', placeholder: '输入整数金额，不准备现金可填 0' })}
        <p className="page-note">现金金额由您决定，不自动换算汇率或扣款。修改行程信息后，准备清单会重新核对。</p>
        {error && <p className="service-error" role="alert">{error}</p>}
        <div className="service-actions"><button type="submit" className="a2ui-btn a2ui-btn--primary">保存行程</button>{selected && <button type="button" className="a2ui-btn a2ui-btn--secondary" onClick={() => { setFields(selected); setEditing(false); setError(''); }}>取消修改</button>}</div>
      </form>
    </Panel> : selected && <>
      <section className="travel-summary">
        <Plane size={26} aria-hidden="true"/>
        <div><h2>{selected.destination}</h2><p>{selected.start} — {selected.end}</p></div>
        <button className="link-btn" onClick={() => { setFields(selected); setEditing(true); }}>修改行程</button>
      </section>
      <Panel title="出行银行卡" aside={<CreditCard size={20} aria-hidden="true"/>}>
        <p><strong>{card ? `${card.name} · 尾号 ${card.tail}` : '请重新选择银行卡'}</strong></p>
        <p className={readiness.ready ? 'travel-ready' : 'service-error'} role="status">{readiness.message}</p>
        {readiness.ready && <p className="page-note">境外支付单笔上限 {yuan(readiness.limit)} · 今日剩余额度 {yuan(readiness.dayRemaining)}</p>}
        <p className="page-note">这是演示卡片的渠道状态；目的地商户是否支持该卡需另行确认。</p>
        <button className="a2ui-btn a2ui-btn--secondary" onClick={() => setRoute('cards')}>前往卡包管理</button>
      </Panel>
      <Panel title="外币现金准备">
        <p><strong>{travelCurrencies[selected.currency]} · {Number(selected.cashAmount).toLocaleString('zh-CN')}</strong></p>
        {!cashNeeded ? <p>本次行程不准备外币现金。</p> : <>
          <p>{checks.cash ? '您已标记现金准备完成。' : liveBooking ? `已预约 ${liveBooking.date} ${liveBooking.slot} · ${liveBooking.branch}，请到店办理。` : '还没有出发前的有效兑换预约。'}</p>
          {!liveBooking && !checks.cash && <button className="a2ui-btn a2ui-btn--primary" disabled={selected.start <= travelDate(1)} onClick={openExchange}>去预约兑换</button>}
          {selected.start <= travelDate(1) && !liveBooking && !checks.cash && <p className="page-note">出发前已没有可选预约日期，请自行联系网点确认。</p>}
          <p className="page-note">兑换可预约未来 30 天的时段，须在出发前办理；预约成功不代表已换到现金。</p>
        </>}
        {bookings.length > 0 && <ul className="service-bookings">{bookings.map(b => <li key={b.id}><div><strong>{b.branch} · {b.status}</strong><p>{b.date} {b.slot} · {travelCurrencies[b.currency]} {b.amountText}</p>{b.status === '已预约' && (b.date < travelDate() || b.date >= selected.start || b.currency !== selected.currency || Number(b.amountText) !== Number(selected.cashAmount)) && <small className="service-error">预约时间、币种或金额与当前行程不符，请调整预约。</small>}</div>{b.status === '已预约' && <button className="link-btn" onClick={() => setServices(s => ({ ...s, appointments: s.appointments.map(a => a.id === b.id ? { ...a, status: '已取消' } : a) }))}>取消兑换预约</button>}</li>)}</ul>}
      </Panel>
      <Panel title="出发准备清单" aside={<span className="panel-hint">已完成 {progress} / 5</span>}>
        <ul className="travel-checklist">
          <li><span className={readiness.ready ? 'travel-ready' : ''}><Check size={18} aria-hidden="true"/>银行卡与境外支付{readiness.ready ? '已检查' : '待处理'}</span></li>
          {Object.entries(checklist).map(([key, label]) => <li key={key}><label><input type="checkbox" checked={!!checks[key]} onChange={() => toggle(key)}/>{label}</label></li>)}
          <li><label><input type="checkbox" checked={!cashNeeded || !!checks.cash} disabled={!cashNeeded} onChange={() => toggle('cash')}/>{cashNeeded ? '已完成兑换，现金已备好' : '无需准备外币现金'}</label></li>
        </ul>
        <p className="page-note">勾选项记录您的准备情况，不会修改银行卡、自动兑换或支付。</p>
      </Panel>
    </>}
    {!cards.length && <Empty>还没有银行卡，请先添加银行卡。</Empty>}
    <p className="page-note">行程与准备清单保存在此浏览器，网点预约为演示预约。</p>
  </Page>;
}
