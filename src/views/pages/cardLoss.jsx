import React from 'react';
import { createPortal } from 'react-dom';
import {
  CreditCard, Globe, Landmark, MapPin, PackageCheck, Receipt, ShieldOff, Truck, Wallet2, X, Zap,
} from 'lucide-react';
import { REPLACEMENT_DAYS, REPLACEMENT_STEPS, money } from '../../domain/bank.js';
import { afterDays, monthDay, tickDate } from './cardUtils.jsx';
import './cardLoss.css';

/**
 * 挂失补卡 —— 卡片状态机里唯一不可逆的那条边。
 *
 * 与冻结的区别决定了这一屏怎么写：冻结是「先停一下」，随时能退回；挂失是「这张卡没了」。
 * 所以后果必须在**确认之前**摊开，而不是点完再告诉用户：
 *   四个渠道当场停用（沿用冻结那套图标语言）+ 不可自助恢复 + 补卡要等寄送 + 手续费。
 *
 * 多因子不在这里：本文件只产出 payload，风险等级与验证方式由
 * `ctx.gate({ op: 'card.report-loss' })` 走 services/policy.js —— 页面不声明等级（A-04）。
 *
 * 「不要点完就没影」靠 ReplacementTrack：挂失落地后这一屏换成补卡进度，
 * 受理 → 制卡 → 寄出三个节点带着各自的日期，寄送地址也在上面。
 *
 * ⚠️ 浮层挂在 body 上（createPortal）而不是页面里：页面滚动容器 .view-scroll 带 transform，
 *    祖先有 transform 时 position: fixed 的参照会变成那个祖先，浮层会被推到视口外 ——
 *    实测过：394px 高的后果清单有 245px 在屏幕上方，用户看不见后果就得点确认。
 *    挂到 body 之后 fixed 才是真的 fixed（与 AuthDialog / ConfirmDialog 同一套）。
 */

const CH_ICON = { pos: CreditCard, online: Wallet2, abroad: Globe, cash: Landmark };

/** 确认浮层：后果逐条画出来（图标 + 两个字），与冻结浮层是同一套语法。 */
export function CardLossSheet({ card, fee = 0, address = '', replacement, lost, onConfirm, onClose }) {
  return createPortal(<div className="freeze-scrim" onClick={onClose}>
    <div className="freeze-sheet" role="dialog" aria-modal="true" aria-labelledby="loss-title"
         onClick={e => e.stopPropagation()}>
      <button className="icon-btn sheet-close" aria-label="关闭" onClick={onClose}><X size={16}/></button>

      <span className={lost ? 'sheet-mark' : 'sheet-mark is-loss'} aria-hidden="true">
        {lost ? <PackageCheck size={22}/> : <ShieldOff size={22}/>}</span>
      <h2 id="loss-title">{lost ? '补卡进度' : '挂失补卡'}</h2>

      {lost && replacement
        ? <dl className="sheet-facts" data-data>
            <div><dt>受理号</dt><dd>{replacement.id}</dd></div>
            <div><dt>受理日期</dt><dd>{tickDate(replacement.acceptedAt)}</dd></div>
            <div><dt>寄送地址</dt><dd>{replacement.address}</dd></div>
            <div><dt>预计寄到</dt><dd>{monthDay(afterDays(replacement.acceptedAt, REPLACEMENT_DAYS))}</dd></div>
            <div><dt>手续费</dt><dd>¥{money(replacement.fee)}</dd></div>
          </dl>
        : <>
            {/* 会失效的东西当场画出来：四个渠道整排划掉，不写句子 */}
            <ul className="sheet-channels" data-lost="on">
              {card.channels.map(c => {
                const Icon = CH_ICON[c.id] || CreditCard;
                return <li key={c.id}><Icon size={16} aria-hidden="true"/>{c.label}</li>;
              })}
            </ul>
            {/* 四条后果里只有「不可恢复」配强调色：风险要靠图标 + 文字说，不靠把整屏涂红 */}
            <ul className="sheet-loss">
              <li><Zap size={15} aria-hidden="true"/><b>即时生效</b></li>
              <li data-warn="on"><ShieldOff size={15} aria-hidden="true"/><b>不可恢复</b></li>
              <li><Truck size={15} aria-hidden="true"/><b>补卡 3–7 个工作日</b></li>
              <li><Receipt size={15} aria-hidden="true"/><b>手续费 ¥{money(fee)}</b></li>
            </ul>
            <p className="sheet-card" data-data><MapPin size={14} aria-hidden="true"/>{address}</p>
          </>}

      <p className="sheet-card"><CreditCard size={14} aria-hidden="true"/>•• {card.tail}</p>

      <div className="modal-actions">
        {lost
          ? <button className="primary-btn" onClick={onClose}>关闭</button>
          : <>
              <button className="ghost-btn" onClick={onClose}>取消</button>
              <button className="primary-btn" onClick={onConfirm}>确认挂失</button>
            </>}
      </div>
    </div>
  </div>, document.body);
}

/**
 * 补卡进度：一条线串起受理 → 制卡 → 寄出，走过的节点实心。
 * 进度是**位置**，不是百分比 —— 「到哪一步了」比「完成了 33%」好读，也不用编一个假百分比。
 * stage 存在账本里（domain/bank.js 的 reportLoss），页面只负责呈现。
 */
export function ReplacementTrack({ replacement }) {
  const { acceptedAt, stage = 0 } = replacement;
  const at = n => tickDate(afterDays(acceptedAt, n));
  return <section className="replacement" aria-label="补卡进度">
    <header className="replacement-head">
      <span className="ruler-label">补卡进度</span>
      <b className="replacement-eta"><Truck size={15} aria-hidden="true"/>预计 {monthDay(afterDays(acceptedAt, REPLACEMENT_DAYS))}</b>
    </header>
    <ol className="replacement-steps">
      {REPLACEMENT_STEPS.map((s, i) => <li key={s.id}
        data-state={i < stage ? 'done' : i === stage ? 'now' : 'todo'}
        aria-label={s.label + ' ' + at(s.after)}>
        <b>{s.label}</b><small>{at(s.after)}</small>
      </li>)}
    </ol>
    <p className="replacement-addr" data-data><MapPin size={13} aria-hidden="true"/>{replacement.address}</p>
  </section>;
}
