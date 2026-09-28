import React from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, Check, CreditCard, Snowflake, Sun, X } from 'lucide-react';
import { money } from '../../domain/bank.js';

/**
 * 冻结必须是一个有感觉的流程，不是「点一下变灰」：
 *   确认（说清后果，列出会失效的渠道）→ 即时反馈（卡面当场换成磨砂暗面 + 徽标）→ 可撤销（从冻结当刻起给后悔的余地）
 * 撤销窗口与 ZA 的做法一致：状态已经变更，但用户能在这一屏直接退回，不用再去翻设置。
 */

/** 卡片页顶部的状态提醒。只在「真的有事」时出现：卡被冻结，或今天的额度已经用满。
    frozen 由页面传入 —— 冻结状态存在本页覆盖层里，读 card.status 会漏掉刚刚冻结的那一下。 */
export function FreezeNotice({ card, isFrozen, onOpen }) {
  const frozen = Boolean(isFrozen);
  const dayUsed = card.channels.reduce((s, c) => s + (c.on ? c.dayUsed : 0), 0);
  const dayLimit = card.channels.reduce((s, c) => s + (c.on ? c.dayLimit : 0), 0);
  const cap = dayUsed >= dayLimit;
  if (!frozen && !cap) return null;
  return <div className={frozen ? 'freeze-notice is-frozen' : 'freeze-notice'} role="status">
    <span className="notice-mark" aria-hidden="true">{frozen ? <Snowflake size={18}/> : <AlertTriangle size={18}/>}</span>
    <span className="notice-body">
      <b>{frozen ? card.name + '已冻结' : '今日支付额度已用满'}</b>
      <small>{frozen ? '四个渠道全部停用，刷卡、线上、境外与取现都会失败' : '今日已用 ¥' + money(dayUsed) + ' / ¥' + money(dayLimit) + '，明天零点恢复'}</small>
    </span>
    {frozen && <button className="link-btn" onClick={onOpen}>解冻</button>}
  </div>;
}

/** 冻结 / 解冻的确认与结果。一次交互里把「会发生什么」讲完。 */
export function CardFreezeSheet({ card, action, phase, onConfirm, onClose, onSwitch }) {
  const isFreeze = action === 'freeze';
  const done = phase === 'done';
  const flip = isFreeze ? 'unfreeze' : 'freeze';
  const dayLimit = card.channels.reduce((s, c) => s + c.dayLimit, 0);

  return <div className="freeze-scrim" onClick={onClose}>
    <div className="freeze-sheet" role="dialog" aria-modal="true" aria-labelledby="freeze-title"
         onClick={e => e.stopPropagation()}>
      <button className="icon-btn sheet-close" aria-label="关闭" onClick={onClose}><X size={16}/></button>

      <span className={isFreeze ? 'sheet-mark' : 'sheet-mark is-thaw'} aria-hidden="true">
        {isFreeze ? <Snowflake size={22}/> : <Sun size={22}/>}</span>
      <h2 id="freeze-title">{done
        ? (isFreeze ? card.name + '已冻结' : card.name + '已解冻')
        : (isFreeze ? '确认冻结这张卡？' : '确认解冻这张卡？')}</h2>
      <p className="sheet-card"><CreditCard size={14} aria-hidden="true"/>尾号 {card.tail} · {card.profile.kind} · {card.profile.linked}</p>

      {done ? <>
        <ul className="sheet-list">
          <li><Check size={15} aria-hidden="true"/>{isFreeze
            ? '卡片状态已切换为已冻结，立即生效'
            : '卡片状态已恢复为正常使用，立即生效'}</li>
          <li><CalendarClock size={15} aria-hidden="true"/>状态历史的时间线末尾新增一条{isFreeze ? '临时冻结' : '解除冻结'}（演示日期 9 月 26 日）</li>
          <li><Check size={15} aria-hidden="true"/>{isFreeze
            ? '已发生的交易不受影响，退款与还款仍会正常入账'
            : '四个渠道回到冻结前的开关状态'}</li>
        </ul>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={() => { onSwitch(); onClose(); }}>查看这张卡</button>
          <button className="primary-btn" onClick={() => { onConfirm(); onClose(); }}>
            {isFreeze ? '撤销冻结' : '再冻结回去'}</button>
        </div>
      </> : <>
        <ul className="sheet-list">
          {card.channels.map(c => <li key={c.id} className="is-off">
            <Snowflake size={15} aria-hidden="true"/>{c.label}立即停用（现日限额 ¥{money(c.dayLimit)}）</li>)}
          {isFreeze
            ? <li><AlertTriangle size={15} aria-hidden="true"/>跨渠道日累计上限 ¥{money(dayLimit)} 一并归零，交易将被拒绝</li>
            : <li><Check size={15} aria-hidden="true"/>恢复后四个渠道按冻结前的开关状态逐项生效，日限额不变</li>}
          <li><Check size={15} aria-hidden="true"/>卡号不变、账户不变，随时可以自助解冻</li>
        </ul>
        <div className="modal-actions">
          <button className="ghost-btn" onClick={onClose}>再想想</button>
          <button className="primary-btn" onClick={onConfirm}>
            {isFreeze ? '确认冻结' : '确认解冻'} <ArrowRight size={15} style={{ verticalAlign: '-3px' }}/></button>
        </div>
      </>}
    </div>
  </div>;
}
