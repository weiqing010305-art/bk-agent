import React, { useState } from 'react';
import {
  Calendar, CalendarClock, CreditCard, Globe, Landmark, Lock, PackageCheck, Receipt,
  RefreshCw, ShieldOff, SlidersHorizontal, Snowflake, Sun, TrendingDown, TrendingUp, Wallet2, Zap,
} from 'lucide-react';
import { money } from '../../domain/bank.js';
import { Row } from '../parts.jsx';
import { CategoryIcon } from '../shared.jsx';
import { periodProgress, tickDate } from './cardUtils.jsx';

/**
 * 卡包页的实体零件：额度尺、账期条、档案、渠道、限额、状态历史、本期小结。
 *
 * 本页只遵守一条设计规则：**能画出来的不写出来**。
 *   · 「还剩多少 / 用掉多少」        → 额度尺的针与块（唯一一个原始组件，其余照它改）
 *   · 「什么时候还」                → 账期条的位置
 *   · 「这张卡是干什么的」          → 图标 + 值（档案）
 *   · 「这个渠道今天还能刷多少」    → 渠道使用条（开关状态本身就是信息）
 *   · 「这张卡经历过什么」          → 时间线的竖线 + 节点图标
 * 删掉的每一句说明句，都是上面某张图已经回答过的问题。
 *
 * 全部定义在本页而不是 parts.jsx —— 这些零件只有卡片页用得上，
 * 放进共用层会变成永远只有一只产品的 factory（AGENTS.md §1 的 ponytail ultra）。
 * 卡面不在此列：它有两个消费者（卡包页 + 助手侧），住在 cardFace.jsx。
 */

const pct = (a, b) => (b ? Math.max(0, Math.min(1, a / b)) : 0);
const low = c => c.on && c.dayUsed >= c.dayLimit * 0.75;

/* 渠道图标即渠道名：实体卡 / 线上钱包 / 地球 / 银行柜台。
   「境内刷卡」这四个字因此不用再写一遍。 */
const CH_ICON = { pos: CreditCard, online: Wallet2, abroad: Globe, cash: Landmark };

const mask = v => '••••';


/** 额度尺 —— 本页最花心思的一处。视觉语法：已用只配一根针（窄），可用才配一块面积（宽）。 */
export function LimitMeter({ card, hidden }) {
  const cap = card.channels.reduce((s, c) => s + (c.on ? c.dayLimit : 0), 0);
  const capAt = pct(cap, card.limit);
  return <section className="limit-ruler" aria-label="额度尺">
    <header className="ruler-head">
      <span className="ruler-label">可用额度</span>
      <strong className="ruler-amount">{hidden ? mask() : '¥' + money(card.available)}</strong>
    </header>
    <div className="ruler-track" key={card.id} role="meter" aria-valuemin={0} aria-valuemax={card.limit}
         aria-valuenow={card.used}
         aria-valuetext={'总额度 ¥' + money(card.limit) + '，已用 ¥' + money(card.used) + '，可用 ¥' + money(card.available)}>
      <span className="ruler-fill" style={{ '--rate': card.rate }}/>
      {capAt < 1 && <span className="ruler-mark" style={{ '--at': capAt }}><i/></span>}
    </div>
    <div className="ruler-scale"><span>已用 ¥{money(card.used)}</span><span>¥{money(card.limit)}</span></div>
  </section>;
}

/** 账期条：一条横线从本期账单日走到还款日，填充到哪儿就是过到哪儿。
    替掉了「距账单日还有 N 天」「本账期还有 N 天，M 月 D 日还款」两句——位置比天数好读。 */
export function CardCycle({ info, frozen }) {
  const due = Boolean(info.due);
  const date = due ? info.dueShort : info.nextShort;
  const p = periodProgress(info);
  return <div className={'card-cycle' + (frozen ? ' is-dim' : '')}>
    <span className="cycle-track" role="img"
          aria-label={(due ? '距还款日 ' : '距账单日 ') + (100 - Math.round(p * 100)) + '%，' + date}
          title={(due ? '还款日 ' : '账单日 ') + date}>
      <span className="cycle-fill" style={{ '--p': p }}/>
      <span className="cycle-dot"/>
    </span>
    <span className="cycle-end"><b>{date}</b>{due ? '还款' : '出账'}</span>
  </div>;
}

/** 档案：图标就是标签。卡类型、状态、卡组织不在这里 —— 它们已经写在卡面上了。 */
const FACTS = [
  ['关联账户', Landmark, c => c.profile.linked],
  ['账单日', Calendar, c => '每月 ' + c.profile.billDay + ' 日'],
  ['有效期', CalendarClock, c => c.expiry],
  ['上期账单', Receipt, c => '¥' + money(c.profile.lastBill)],
];

export function CardFacts({ card }) {
  return <dl className="card-facts">
    {FACTS.map(([label, Icon, get]) => <div className="fact" key={label} role="group" aria-label={label}>
      <Icon size={16} aria-hidden="true"/>
      <dd>{get(card)}</dd>
    </div>)}
  </dl>;
}

/** 渠道逐项开关。锁定时整组失效 —— 冻结与挂失都不是换个颜色，而是这四项一起停摆。
    两者的区别只在锁的说明上：冻结还能解冻，挂失之后这四项不会再打开。 */
export function ChannelBoard({ card, frozen, lost, onToggle }) {
  return <div className={'channel-board' + (frozen ? ' is-locked' : '') + (lost ? ' is-lost' : '')}>
    {card.channels.map(c => {
      const Icon = CH_ICON[c.id] || CreditCard;
      const left = Math.max(0, c.dayLimit - c.dayUsed);
      return <div className="channel-row" key={c.id} data-off={!c.on && !frozen ? 'on' : undefined} title={c.label}>
        <span className="channel-mark"><Icon size={17} aria-hidden="true"/></span>
        <span className="channel-bar" aria-hidden="true">
          <span className={low(c) ? 'channel-use is-high' : 'channel-use'} style={{ '--w': pct(c.dayUsed, c.dayLimit) }}/>
        </span>
        <span className="channel-left">¥{money(left)}</span>
        <button className="switch" role="switch" aria-checked={c.on} disabled={frozen}
                aria-label={c.label + (c.on ? '，已开启，今日可用 ¥' + money(left) : '，已关闭')}
                onClick={() => onToggle(c.id)}><i/></button>
      </div>;
    })}
    {frozen && <p className="channel-lock"
      aria-label={lost ? '卡片已挂失，四个渠道全部停用' : '卡片冻结中，四个渠道全部停用'}>
      <Lock size={13} aria-hidden="true"/></p>}
  </div>;
}

/** 限额：免密 / 单笔 / 日累计，点行内联调整（不做设置页式的表单堆砌）。 */
export function LimitRows({ card, onLimit, say }) {
  const [editing, setEditing] = useState(null);
  const rows = [
    ['noPwd', '免密', card.limits[0], '小额免密'],
    ['perTxn', '单笔', card.limits[1], '单笔限额'],
    ['dayLimit', '日累计', card.limits[2], '日累计限额'],
  ];
  return <div className="limit-rows">
    {rows.map(([key, label, value, full]) => <div className="limit-row" key={key}>
      <span className="limit-name">{label}</span>
      <span className="limit-choices">
        {key === 'noPwd' && <button className="limit-choice" key="off" aria-pressed={value === 0}
          onClick={() => { onLimit(key, 0); say('已关闭小额免密'); }}>关闭</button>}
        {/* 候选值是 1 / 2 / 5 千元三档，点一下就换，不需要输入框 */}
        {editing === key && [100000, 200000, 500000].map(v => <button className="limit-choice" key={v}
          aria-pressed={value === v}
          onClick={() => { onLimit(key, v); setEditing(null); }}>¥{money(v)}</button>)}
      </span>
      <button className="limit-value" aria-expanded={editing === key}
              aria-label={full + '，当前 ' + (value ? '¥' + money(value) : '已关闭')}
              onClick={() => setEditing(editing === key ? null : key)}>
        {value ? '¥' + money(value) : '已关闭'}<SlidersHorizontal size={14} aria-hidden="true"/>
      </button>
    </div>)}
  </div>;
}

/* 节点图标即事件类型：挂失 / 补卡 / 冻结 / 解冻 / 激活 / 提额 / 换卡 / 验密 / 境外 / 开卡。 */
const H_ICON = [
  [/挂失/, ShieldOff], [/补卡|寄出|寄送/, PackageCheck],
  [/解冻/, Sun], [/冻结/, Snowflake], [/激活/, Zap], [/提额|额度|限额/, TrendingUp],
  [/换卡|形态|币种/, RefreshCw], [/免密|验密/, Lock], [/境外/, Globe], [/开卡/, CreditCard],
];
const hIcon = title => (H_ICON.find(([re]) => re.test(title)) || [null, Calendar])[1];

/** 状态历史：一条竖线串起开卡至今。节点上只有日期与那两个字的动作，细节走 title。 */
export function StatusHistory({ history }) {
  return <ol className="card-history">
    {history.map((h, i) => {
      const Icon = hIcon(h.title);
      return <li key={h.date + i} data-now={i === history.length - 1 ? 'on' : undefined}
                 title={h.note} aria-label={tickDate(h.date) + ' ' + h.title + (h.note ? '，' + h.note : '')}>
        <span className="history-icon"><Icon size={13} aria-hidden="true"/></span>
        <span className="history-date">{tickDate(h.date)}</span>
        <b>{h.title}</b>
      </li>;
    })}
  </ol>;
}

/** 本期小结 + 这张卡自己的动账明细。「剔除本期后的可用」不在这里 —— 额度尺已经答过。 */
export function CardActivity({ card, stat, hidden }) {
  const up = stat.diff >= 0;
  const Trend = up ? TrendingUp : TrendingDown;
  return <section className="card-activity">
    <div className="activity-stats">
      <span><small>本期消费</small><b>{hidden ? mask() : '¥' + money(stat.spend)}</b></span>
      <span><small>较上期</small><b className={up ? 'is-up' : undefined}>
        <Trend size={15} aria-hidden="true"/>{hidden ? mask() : '¥' + money(Math.abs(stat.diff))}</b></span>
    </div>
    <ul className="row-list card-feed">
      {card.feed.slice(0, 6).map(t => <Row key={t.id} icon={<CategoryIcon item={t}/>} title={t.name}
        sub={t.date + (t.note ? ' · ' + t.note : ' · ' + t.category)}
        value={hidden ? mask() : t.amountText} positive={t.positive}/>)}
    </ul>
  </section>;
}
