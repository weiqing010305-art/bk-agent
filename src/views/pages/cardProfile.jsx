import React, { useState } from 'react';
import { Calendar, CreditCard, Globe, Landmark, Lock, SlidersHorizontal, Wallet2 } from 'lucide-react';
import { money } from '../../domain/bank.js';
import { Row } from '../parts.jsx';
import { CategoryIcon } from '../shared.jsx';
import { shortDate } from './cardUtils.jsx';

/**
 * 卡包页的实体零件：额度尺、渠道与限额、状态历史、本期小结。
 *
 * 全部定义在本页而不是 parts.jsx —— 这些零件只有卡片页用得上，
 * 放进共用层会变成永远只有一只产品的 factory（AGENTS.md §1 的 ponytail ultra）。
 * 卡面不在此列：它有两个消费者（卡包页 + 助手侧），住在 cardFace.jsx。
 */

const pct = (a, b) => (b ? Math.max(0, Math.min(1, a / b)) : 0);
const low = c => c.on && c.dayUsed >= c.dayLimit * 0.75;

const CH_ICON = { pos: CreditCard, online: Wallet2, abroad: Globe, cash: Landmark };


/** 额度尺 —— 本页最花心思的一处。视觉语法：已用只配一根针（窄），可用才配一块面积（宽）。 */
export function LimitMeter({ card }) {
  const today = card.channels.reduce((s, c) => s + (c.on ? c.dayUsed : 0), 0);
  const cap = card.channels.reduce((s, c) => s + (c.on ? c.dayLimit : 0), 0);
  const capAt = pct(cap, card.limit);
  return <section className="limit-ruler" aria-label="额度尺">
    <header className="ruler-head">
      <span className="ruler-label">可用额度</span>
      <strong className="ruler-amount">¥{money(card.available)}</strong>
    </header>
    <p className="ruler-note">
      总额度 ¥{money(card.limit)}
      <em>已用 ¥{money(card.used)}</em>
      <em>{Math.round(card.rate * 100)}% 已占用</em>
    </p>
    <div className="ruler-track" key={card.id} role="meter" aria-valuemin={0} aria-valuemax={card.limit}
         data-narrow={card.rate < 0.22 ? 'on' : undefined}
         aria-valuenow={card.used} aria-valuetext={'已用 ¥' + money(card.used) + '，可用 ¥' + money(card.available) + '，总额度 ¥' + money(card.limit)}>
      <span className="ruler-fill" style={{ '--rate': card.rate }}/>
      <span className="ruler-cell ruler-cell--used" style={{ '--at': 0, '--w': card.rate }}>已用</span>
      <span className="ruler-cell ruler-cell--free" style={{ '--at': card.rate, '--w': 1 - card.rate }}>可用 ¥{money(card.available)}</span>
      {capAt < 1 && <span className="ruler-mark" style={{ '--at': capAt }}><i/></span>}
    </div>
    <div className="ruler-scale"><span>0</span><span>今日上限 ¥{money(cap)}</span><span>总额度 ¥{money(card.limit)}</span></div>
    <footer className="ruler-foot">
      <span>今日已用 ¥{money(today)}</span>
      <span>今日用掉上限的 {Math.round(pct(today, cap) * 100)}%</span>
    </footer>
  </section>;
}

/** 渠道逐项开关。冻结时整组失效 —— 冻结不是换个颜色，而是这四项一起停摆。 */
export function ChannelBoard({ card, frozen, onToggle }) {
  return <div className={frozen ? 'channel-board is-locked' : 'channel-board'}>
    <div className="channel-head">
      <b>可用渠道</b>
      <span>单笔 ¥{money(card.limits[1])}{card.limits[0] ? ' · 免密 ≤ ¥' + money(card.limits[0]) : ' · 全额验密'}</span>
    </div>
    {card.channels.map(c => {
      const Icon = CH_ICON[c.id] || CreditCard;
      const disabled = frozen || !c.on;
      return <div className="channel-row" key={c.id} data-off={!c.on && !frozen ? 'on' : undefined}>
        <span className="channel-mark"><Icon size={17} aria-hidden="true"/></span>
        <span className="channel-name">
          <b>{c.label}</b>
          <small>{disabled ? '暂不可用' : '今日可用 ¥' + money(Math.max(0, c.dayLimit - c.dayUsed)) + ' / ¥' + money(c.dayLimit)}</small>
          <span className="channel-track" aria-hidden="true">
            <span className={low(c) ? 'channel-use is-high' : 'channel-use'}
                  style={{ '--w': pct(c.dayUsed, c.dayLimit) }}/>
          </span>
        </span>
        <button className="switch" role="switch" aria-checked={c.on} disabled={frozen}
                aria-label={c.label + (c.on ? '，已开启' : '，已关闭')}
                onClick={() => onToggle(c.id)}><i/></button>
      </div>;
    })}
    {frozen && <p className="channel-lock" key="lock"><Lock size={12}/>卡片冻结中，四个渠道全部停用，解冻后逐项恢复。</p>}
  </div>;
}

/** 限额：免密 / 单笔 / 日累计，点行内联调整（不做设置页式的表单堆砌）。 */
export function LimitRows({ card, onLimit, say }) {
  const [editing, setEditing] = useState(null);
  const rows = [
    ['noPwd', '免密小额', card.limits[0], '低于此额无需验密'],
    ['perTxn', '单笔限额', card.limits[1], '单笔支付上限'],
    ['dayLimit', '日累计限额', card.limits[2], '全部渠道合计上限'],
  ];
  return <div className="limit-rows">
    {rows.map(([key, label, value, note]) => <div className="limit-row" key={key}>
      <span className="limit-name"><b>{label}</b><small>{note}</small></span>
      <span className="limit-choices">
        {key === 'noPwd' && <button className="limit-choice" key="off" aria-pressed={value === 0}
          onClick={() => { onLimit(key, 0); say('已关闭小额免密，每次支付都需验密'); }}>关闭</button>}
        {/* 候选值是 1 / 2 / 5 千元三档，点一下就换，不需要输入框 */}
        {editing === key && [100000, 200000, 500000].map(v => <button className="limit-choice" key={v}
          aria-pressed={value === v}
          onClick={() => { onLimit(key, v); setEditing(null); }}>¥{money(v)}</button>)}
      </span>
      <button className="limit-value" aria-expanded={editing === key}
              onClick={() => setEditing(editing === key ? null : key)}>
        {value ? '¥' + money(value) : '已关闭'}<SlidersHorizontal size={14} aria-hidden="true"/>
      </button>
    </div>)}
  </div>;
}

/** 状态历史：一条竖线串起开卡至今。 */
export function StatusHistory({ history }) {
  /* buildCards 已按日期正序排好：时间线从开卡读到最新，最新一条用实心点标出 */
  return <ol className="card-history">
    {history.map((h, i) => <li key={h.date + i} data-now={i === history.length - 1 ? 'on' : undefined}>
      <span className="history-date">{shortDate(h.date)}</span>
      <span className="history-body"><b>{h.title}</b><small>{h.note}</small></span>
    </li>)}
  </ol>;
}

/** 本期小结 + 这张卡自己的动账明细。 */
export function CardActivity({ card, cycleInfo, stat, hidden }) {
  const first = cycleInfo.last, next = cycleInfo.next;
  return <section className="card-activity">
    <div className="activity-head">
      <span className="period-chip"><Calendar size={14} aria-hidden="true"/>本期 {shortDate(first)} 至 {shortDate(next)}</span>
      <span className="period-lead">距账单日还有 {cycleInfo.daysLeft} 天</span>
    </div>
    <div className="activity-stats">
      <span><b>¥{money(stat.spend)}</b><small>本期消费 · {stat.count} 笔</small></span>
      <span><b>{stat.diff >= 0 ? '+' : '−'}¥{money(Math.abs(stat.diff))}</b>
        <small>较上期{stat.diff >= 0 ? '多' : '少'}花</small></span>
      <span><b>¥{money(card.limit - card.used - stat.spend)}</b><small>剔除本期后的可用</small></span>
    </div>
    <ul className="row-list card-feed">
      {card.feed.slice(0, 6).map(t => <Row key={t.id} icon={<CategoryIcon item={t}/>} title={t.name}
        sub={t.date + (t.note ? ' · ' + t.note : ' · ' + t.category)}
        value={hidden ? '••••' : t.amountText} positive={t.positive}/>)}
    </ul>
    <p className="feed-note">以上为本卡近 {card.feed.length} 笔中的前 6 笔，演示数据。</p>
  </section>;
}