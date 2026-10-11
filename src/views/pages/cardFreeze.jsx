import React from 'react';
import { AlertTriangle, CreditCard, Globe, Landmark, ShieldOff, Snowflake, Sun, Wallet2, X } from 'lucide-react';

/**
 * 冻结必须是一个有感觉的流程，不是「点一下变灰」：
 *   确认（四个渠道图标当场划掉）→ 即时反馈（卡面换成磨砂暗面 + 徽标）→ 可撤销（就在这一屏退回）
 * 撤销窗口与 ZA 的做法一致：状态已经变更，但用户能在这一屏直接退回，不用再去翻设置。
 *
 * 文案纪律：会失效的东西用图标 + 渠道名当场画出来，不写「冻结后刷卡、线上、境外与取现将失败」。
 */

const CH_ICON = { pos: CreditCard, online: Wallet2, abroad: Globe, cash: Landmark };

/** 卡片页顶部的状态提醒。只在「真的有事」时出现：卡被挂失、卡被冻结，或今天的额度已经用满。
    frozen / lost 由页面传入 —— 状态存在账本里，刚刚发生的那一下也要立刻反映。
    挂失排在最前：它是这张卡唯一不可逆的状态，冻结与额度都已经不是重点。 */
export function FreezeNotice({ card, isFrozen, lost, onOpen }) {
  const frozen = Boolean(isFrozen);
  const gone = Boolean(lost);
  const used = card.channels.reduce((s, c) => s + (c.on ? c.dayUsed : 0), 0);
  const cap = card.channels.reduce((s, c) => s + (c.on ? c.dayLimit : 0), 0);
  if (!gone && !frozen && used < cap) return null;
  return <div className={gone ? 'freeze-notice is-frozen is-lost' : frozen ? 'freeze-notice is-frozen' : 'freeze-notice'} role="status">
    <span className="notice-mark" aria-hidden="true">
      {gone ? <ShieldOff size={18}/> : frozen ? <Snowflake size={18}/> : <AlertTriangle size={18}/>}</span>
    <span className="notice-body">
      <b>{card.name.replace('青禾', '')}{gone ? '已挂失' : frozen ? '已冻结' : '今日额度已满'}</b>
    </span>
    {(gone || frozen) && <button className="link-btn" onClick={onOpen}>{gone ? '补卡进度' : '解冻'}</button>}
  </div>;
}

/** 冻结 / 解冻的确认与结果。一次交互里把「会发生什么」讲完。 */
export function CardFreezeSheet({ card, action, phase, onConfirm, onClose, onSwitch }) {
  const isFreeze = action === 'freeze';
  const done = phase === 'done';
  const name = card.name.replace('青禾', '');

  return <div className="freeze-scrim" onClick={onClose}>
    <div className="freeze-sheet" role="dialog" aria-modal="true" aria-labelledby="freeze-title"
         onClick={e => e.stopPropagation()}>
      <button className="icon-btn sheet-close" aria-label="关闭" onClick={onClose}><X size={16}/></button>

      <span className={isFreeze ? 'sheet-mark' : 'sheet-mark is-thaw'} aria-hidden="true">
        {isFreeze ? <Snowflake size={22}/> : <Sun size={22}/>}</span>
      <h2 id="freeze-title">{done
        ? name + (isFreeze ? '已冻结' : '已解冻')
        : isFreeze ? '冻结' : '解冻'}</h2>

      <ul className="sheet-channels" data-done={done ? 'on' : undefined}>
        {card.channels.map(c => {
          const Icon = CH_ICON[c.id] || CreditCard;
          return <li key={c.id}><Icon size={16} aria-hidden="true"/>{c.label}</li>;
        })}
      </ul>
      <p className="sheet-card"><CreditCard size={14} aria-hidden="true"/>•• {card.tail}</p>

      {/* 结果态的那颗按钮走的是**反动作**：撤销冻结 = 真的解冻，不是再冻结一次。 */}
      <div className="modal-actions">
        {done
          ? <button className="primary-btn" onClick={() => { onConfirm(isFreeze ? 'unfreeze' : 'freeze'); onClose(); }}>
              {isFreeze ? '撤销冻结' : '再冻结'}</button>
          : <>
              <button className="ghost-btn" onClick={onClose}>取消</button>
              <button className="primary-btn" onClick={() => onConfirm(isFreeze ? 'freeze' : 'unfreeze')}>
                {isFreeze ? '冻结' : '解冻'}</button>
            </>}
      </div>
    </div>
  </div>;
}
