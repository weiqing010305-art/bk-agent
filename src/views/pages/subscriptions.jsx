import React, { useState } from 'react';
import { CalendarClock, Check, Repeat, X } from 'lucide-react';
import { Page, Panel, StatBar } from '../parts.jsx';
import { subKind } from '../shared.jsx';
import { DEMO_DATE } from '../../services/banking.js';
import './subscriptions.css';

/**
 * 订阅。
 *
 * 这一页要回答的不是「每月 ¥29」，而是四件事，每项订阅都按这四件事摊开：
 *   · 它是谁      → 专属形象（每个细分一套底色、一个图形、一种动效）
 *   · 什么时候扣  → 扣费倒计时（页面上最显眼的一个元素）
 *   · 多少钱      → 每月与每年**同时**给，不做切换（切换等于把另一个视角藏起来）
 *   · 已经花了多少 → 已续时长 + 累计已付
 *
 * 排序仍然是「下一次什么时候扣钱」。每项是一张自己的卡，而不是列表里的一行 ——
 * 一行装不下上面四件事，装得下也读不出来。所以这一页没有把卡片套进面板：
 * 卡片就是这一层的内容（craft-floor：嵌套卡片永远是错的）。
 *
 * 取消与恢复都直接写账本（App.jsx 的 applyConfirmation，可显式传入 action），
 * 本页不留任何覆盖层、也不弹窗 —— 状态只有一份，助手那条订阅 surface 的数字会跟着一起变。
 */

const DAY = 86400000;
const at = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayOf = d => (d || '').slice(5).replace('-', '/');

/** 距扣费还有几天。基准日取 DEMO_DATE —— 页脚那行 provenance 用的就是它，
    所以「3 天后扣费」和「数据截至 9 月 25 日」永远对得上，不会各说各话。 */
const daysTo = d => Math.round((at(d) - at(DEMO_DATE)) / DAY);
const dueText = n => (n < 0 ? '已过扣费日' : n === 0 ? '今天扣费' : n === 1 ? '明天扣费' : n + ' 天后扣费');

/* 演示账本里没有「已续月数」。这里按细分给一个固定的演示值：
   与现实一致（音乐订得最久、云盘是刚续的），且每次渲染都一样，不会跳。
   ponytail: 接真后端时换成订阅的开始日期，下面一行都不用改。 */
const TENURE = { cloud: 6, video: 11, music: 20, read: 8 };
const monthsOf = kind => TENURE[kind] || 6;

/** 取消后会失效的具体权益。按订阅细分给，而不是笼统的一句「权益会失效」。 */
const BENEFITS = {
  cloud: ['200 GB 云存储', '跨设备自动同步', '最近 30 天的误删恢复'],
  video: ['会员片库与独播内容', '4K 清晰度', '同时两台设备播放'],
  music: ['无损音质', '离线下载', '全平台免广告'],
  read: ['电子书与杂志借阅', '离线阅读', '跨设备同步阅读进度'],
};
const benefitsOf = kind => BENEFITS[kind] || ['会员期内的全部权益'];

/** 一项订阅 = 一张有身份的卡。形象、倒计时、双视角价格、已付累计，四件事各占一处。 */
function SubCard({ s, yuan, open, onToggle, onRestore, onCancel }) {
  /* sub-row--<细分> 只挂在**在续**的卡上：三条细分动效（浮 / 扫光 / 律动）说的是
     「这项服务正在运行」，取消之后还动就是在骗人。色调另走 data-tone，两件事分开。 */
  return <li className={'sub-card' + (s.live ? ' sub-row--' + s.kind : '')} data-tone={s.kind}>
    <div className="sub-card-head">
      <span className={'sub-mark sub-logo sub-logo--' + s.kind} aria-hidden="true">
        {s.kind === 'music' ? <span className="eq"><i/><i/><i/><i/></span> : <s.Icon size={22}/>}
      </span>
      <div className="sub-card-id">
        <h3>{s.name}</h3>
        <small>{s.detail}</small>
      </div>
      <span className="sub-card-price">
        <span><i>每月</i><b>{yuan(s.amount)}</b></span>
        <span><i>每年</i><b>{yuan(s.yearly)}</b></span>
      </span>
    </div>

    <div className="sub-card-facts">
      <span className="due-chip">
        <CalendarClock size={14} aria-hidden="true"/>{s.live ? dueText(s.days) : '已取消'}
      </span>
      <span className="due-date">{dayOf(s.date)}</span>
      {/* 三张卡上都有「取消」，读屏读出来是一模一样的三个按钮，所以名字带上是哪一项 */}
      <span className="sub-card-act">{s.live
        ? <button className="a2ui-btn a2ui-btn--secondary" aria-expanded={open}
                  aria-label={'取消 ' + s.name + ' 的续费'} onClick={onToggle}>取消</button>
        : <button className="link-btn" aria-label={'恢复 ' + s.name + ' 的续费'}
                  onClick={onRestore}>恢复</button>}</span>
      <span className="due-tenure">{s.live
        ? '已续 ' + s.months + ' 个月 · 累计已付 ' + yuan(s.paid)
        : '此前已付 ' + yuan(s.paid) + ' · 省下每年 ' + yuan(s.yearly)}</span>
    </div>

    {open && <div className="sub-preview">
      <p className="sub-preview-head">取消后这 {benefitsOf(s.kind).length} 项权益会失效</p>
      <ul className="sub-benefits">
        {benefitsOf(s.kind).map(b => <li key={b}><X size={13} aria-hidden="true"/>{b}</li>)}
      </ul>
      <p className="sub-preview-fact">
        下次扣费日 {dayOf(s.date)} 之后不再扣款；本月已经扣掉的 {yuan(s.amount)} 不会退回。
      </p>
      <p className="sub-preview-fact">取消之后，一年的固定支出少 {yuan(s.yearly)}。</p>
      <div className="sub-preview-actions">
        <button className="a2ui-btn a2ui-btn--secondary" onClick={onToggle}>再想想</button>
        <button className="a2ui-btn a2ui-btn--primary" onClick={onCancel}>确认取消</button>
      </div>
    </div>}
  </li>;
}

export default function Subscriptions({ ctx }) {
  const { bank, yuan, setRoute, applyConfirmation } = ctx;
  /** 正在展开后果预览的那一项 */
  const [preview, setPreview] = useState(null);

  const items = bank.subscriptions.map(s => {
    const [, kind, Icon] = subKind(s.name);
    const months = monthsOf(kind);
    return {
      ...s, kind, Icon, months,
      yearly: s.amount * 12,
      paid: s.amount * months,
      live: s.status === 'active',
      days: daysTo(s.date),
    };
  });
  const live = items.filter(s => s.live).sort((a, b) => a.date.localeCompare(b.date));
  const gone = items.filter(s => !s.live);

  const monthly = live.reduce((n, s) => n + s.amount, 0);
  const yearly = monthly * 12;
  const paid = live.reduce((n, s) => n + s.paid, 0);
  const months = live.reduce((n, s) => n + s.months, 0);
  const savedYearly = gone.reduce((n, s) => n + s.yearly, 0);
  const spending = (ctx.dataModel.categories || []).reduce((n, c) => n + c.amount, 0);
  const biggest = [...live].sort((a, b) => b.yearly - a.yearly)[0];
  const next = live[0];

  /**
   * 就地预览已经把后果说全了，就不再叠一层弹窗：确认后直接把整个动作交给
   * App 的写入口 applyConfirmation（它显式收 action）。不能先走确认弹窗那条路 ——
   * 那会弹出转账语境的弹窗，同一个问题还要再点一次「确认模拟操作」。
   */
  const ask = (type, s) => {
    setPreview(null);
    applyConfirmation({ type, id: s.id, name: s.name });
  };
  const card = s => <SubCard key={s.id} s={s} yuan={yuan}
    open={preview === s.id}
    onToggle={() => setPreview(preview === s.id ? null : s.id)}
    onRestore={() => ask('restore-sub', s)}
    onCancel={() => ask('cancel-sub', s)}/>;

  return <Page title="订阅" subtitle={live.length ? live.length + ' 项正在续费，每年 ' + yuan(yearly) : '没有正在续费的订阅'}>
    <StatBar
      left={{ label: '每月固定支出', value: yuan(monthly), note: '一年 ' + yuan(yearly) }}
      right={{ label: '下次扣费', value: next ? dayOf(next.date) : '暂无', note: next ? dueText(next.days) + ' · ' + next.name : '没有待扣项' }}/>

    {live.length > 0 && <Panel title="长期成本" aside={<span className="panel-hint">按当前配置推算</span>}>
      <div className="sub-year-grid">
        <div>
          <span className="stat-label">每年固定支出</span>
          <strong className="stat-num">{yuan(yearly)}</strong>
          <small className="stat-note">分 12 个月扣</small>
        </div>
        <div>
          <span className="stat-label">已经付了</span>
          <strong className="stat-num">{yuan(paid)}</strong>
          <small className="stat-note">约 {months} 个月</small>
        </div>
        <div>
          <span className="stat-label">占本月支出</span>
          <strong className="stat-num">{spending ? Math.round(yearly / 12 / spending * 100) : 0}%</strong>
          <small className="stat-note">本月共 {yuan(spending)}</small>
        </div>
      </div>
      <p className="sub-read">
        最大的一项是「{biggest.name}」，一年 {yuan(biggest.yearly)}，占年度订阅支出的 {Math.round(biggest.yearly / yearly * 100)}%。
        取消任意一项，上面的三个数字会立刻跟着变。
      </p>
    </Panel>}

    {live.length > 0 && <section className="sub-block">
      <div className="sub-block-head">
        <h2>正在续费</h2>
        <span className="panel-hint">按扣费日排，最近的排在最前</span>
      </div>
      <ul className="sub-cards">{live.map(card)}</ul>
    </section>}

    {gone.length > 0 && <section className="sub-block">
      <div className="sub-block-head">
        <h2>已取消</h2>
        <span className="panel-hint">{gone.length} 项 · 共省下每年 {yuan(savedYearly)}</span>
      </div>
      <ul className="sub-cards sub-cards--gone">{gone.map(card)}</ul>
    </section>}

    {live.length === 0 && <Panel>
      <div className="sub-empty">
        <span className="sub-empty-mark" aria-hidden="true">{gone.length ? <Check size={22}/> : <Repeat size={22}/>}</span>
        <h3>{gone.length ? '现在没有正在续费的订阅' : '还没有任何订阅'}</h3>
        <p>{gone.length
          ? '全部 ' + gone.length + ' 项都已取消，下一个扣费日不会再自动扣款。这是这一页能出现的最好结果：不用再记着哪天会被扣钱。'
          : '绑定一张卡之后，所有自动扣费会集中列在这里：哪天扣、扣多少、一年要花多少，都能提前看到。'}</p>
        {gone.length > 0 && <div className="sub-empty-facts">
          <div>
            <span className="stat-label">以前每年</span>
            <strong className="stat-num">{yuan(savedYearly)}</strong>
          </div>
          <div>
            <span className="stat-label">现在每年</span>
            <strong className="stat-num">¥0.00</strong>
          </div>
        </div>}
        <div className="sub-empty-actions">
          <button className="a2ui-btn a2ui-btn--secondary" onClick={() => setRoute('bills')}>
            {gone.length ? '看订阅花过的钱' : '去看这个月的账单'}
          </button>
        </div>
      </div>
    </Panel>}

    <p className="page-note">仅修改本机演示数据，不会取消真实平台服务</p>
  </Page>;
}
