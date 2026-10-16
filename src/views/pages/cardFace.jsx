import React, { useRef } from 'react';
import { ShieldOff, Snowflake, Wifi } from 'lucide-react';
import { money } from '../../domain/bank.js';
import { TEMPLATE, TEMPLATE_FALLBACK } from './cardData.jsx';
import './cardFace.css';

/**
 * 卡面形象 —— 卡片的脸，卡包页与助手侧共用同一张。
 *
 * ⚠️ 为什么要单独一个文件：这张脸有两个消费者，不是一个。
 *   · 卡包页（cards.jsx）：卡面是**可切换的标签页**，要指针跟随的 3D 倾斜、要浮起；
 *   · 助手侧（agent/brief.js 的卡片 surface）：卡面是**一张图**，不可交互，
 *     宽度由容器给，旁边还要挂这张卡的身份信息。
 *   两个消费者共用同一份几何、芯片、卡组织、持卡人与有效期，
 *   差别只在「交不交互」和「多大」——所以区别做成 props，不做成两份组件。
 *
 * 几何（1.669 / 圆角 20px / 角对角渐变）沿用 pages.css 里按 ZA Card 官方截图
 * 逐像素实测的 .bank-card 系列；本文件把「卡号以上」的内容做厚：EMV 芯片、
 * 非接波纹、持卡人、有效期、卡组织标记，以及指针跟随的高光。
 *
 * 比例的第二处佐证：MercadoLibre 的生产级卡组件 meli-card-drawer-android
 * 用 layout_constraintDimensionRatio="H,256:158"（1.62），与 ZA 实测的 1.669 同档；
 * 两侧内缩 10% 卡宽（start/end guideline 0.1/0.9）、内容底线 0.9177，
 * 与这里 21px / 282px ≈ 7.4% 是同一套比例思路。
 */

/** 卡位缺字段时补默认值：助手侧的 dataModel 只有 name / tail / type，
    没有卡组织与色调，直接读会渲染出一张没品牌的灰卡。 */
const look = card => {
  const t = TEMPLATE[card.id] || TEMPLATE_FALLBACK;
  return { tone: card.tone || t.tone, org: card.org || t.org };
};
/* 助手侧的 dataModel 只有 name / tail / type，没有有效期，读不到时用这张兜底。 */
const EXPIRY_FALLBACK = '09 / 29';

/**
 * 卡面。
 *
 * 指针跟随写成原生事件直接改 CSS 变量（不走 React state）：这是高频交互，
 * 走 state 等于每帧重渲染整棵卡包（doc/research/motion-and-category-ui.md §C.3）。
 *
 * still = true 时渲染「一张卡的照片」：没有包装层、没有倾斜、不进 tab 序列，
 * role 用 img 而不是 tab。宽度由父容器决定。
 *
 * decorative = true 用于 CardTile：那张卡面只是它的配图，卡号、状态、卡组织
 * 右侧已经用文字说全了，读屏再念一遍卡面就是同一件事说两遍。
 *
 * 三种状态三种材料（data-state）：
 *   active 彩色渐变 · frozen 磨砂暗面（还能解冻，所以卡还在）· lost 中性灰（卡没了，只剩一条轮廓）
 * 挂失与冻结都用 lost / frozen 两个布尔传进来，卡面自己不读 status —— 助手侧的 dataModel
 * 只有 id / name / tail，读不到状态，靠调用方告诉它这张卡现在是什么材料。
 */
export function CardFace({ card = {}, hidden = false, frozen = false, lost = false, still = false, decorative = false, selected = false, tabIndex, onSelect, id, controls }) {
  const ref = useRef(null);
  const { tone, org } = look(card);
  const tail = card.tail || '••••';
  const state = lost ? 'lost' : frozen ? 'frozen' : 'active';
  const off = state !== 'active';
  const label = (card.name || '银行卡') + (hidden ? '，卡号已隐藏' : '，尾号 ' + tail) + (lost ? '，已挂失' : frozen ? '，已冻结' : '，状态正常');

  const move = e => {
    const el = ref.current;
    if (!el || !selected) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--tilt-y', ((x - .5) * 9).toFixed(2) + 'deg');
    el.style.setProperty('--tilt-x', ((.5 - y) * 7).toFixed(2) + 'deg');
    el.style.setProperty('--spot-x', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--spot-y', (y * 100).toFixed(1) + '%');
    el.dataset.lit = 'on';
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    delete el.dataset.lit;
  };

  const face = (
    <div className="bank-card card-face" data-tone={tone} data-state={state}
         id={id} aria-controls={controls}
         role={decorative ? undefined : still ? 'img' : 'tab'}
         aria-label={decorative ? undefined : label}
         aria-hidden={decorative ? 'true' : undefined}
         aria-selected={still ? undefined : selected}
         tabIndex={still ? undefined : tabIndex}
         onClick={still ? undefined : onSelect}
         onKeyDown={still ? undefined : e => {
           if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
         }}>
      <span className="card-face-top">
        <span className="bank-card-logo" aria-hidden="true">青</span>
        <span className="bank-card-brand" aria-hidden="true">青禾<em> BANK</em></span>
        <span className="card-chip" aria-hidden="true"><i/><i/><i/><i/></span>
        <Wifi className="card-wave" size={17} aria-hidden="true"/>
      </span>
      <strong className="bank-card-num">{hidden ? '••••  ••••  ••••  ••••' : '••••  ••••  ••••  ' + tail}</strong>
      {/* 卡面下半部只留「有效期 · 卡组织」两项。持卡人三张卡是同一个人、三个字段名三张卡各写一遍，
          在卡包里是零信息；卡类型与状态分别由色调和磨砂表达，档案区里也不再重抄一次。 */}
      <span className="card-face-foot">
        <b>{card.expiry || EXPIRY_FALLBACK}</b>
        <b>{org}</b>
      </span>
      {off && <span className="card-frost" aria-hidden="true"/>}
      <span className="card-glare" aria-hidden="true"/>
      {off && <span className={'card-frozen-badge' + (lost ? ' is-loss' : '')}>
        {lost ? <ShieldOff size={12} aria-hidden="true"/> : <Snowflake size={12} aria-hidden="true"/>}
        {lost ? '已挂失' : '已冻结'}</span>}
    </div>
  );

  if (still) return face;
  return <div className="card-face-wrap" ref={ref} onPointerMove={move} onPointerLeave={leave}
              data-state={state} data-on={selected ? 'on' : undefined}>{face}
    <span className="card-face-caption" aria-hidden="true">{card.name}<small>{selected ? '当前卡片' : '点击切换'}</small></span>
  </div>;
}

/**
 * 助手侧的卡片形象：一张小一号的卡面 + 这张卡的身份信息。
 *
 * 「一行灰字」的问题不是字少，而是**没有物**。所以这里左边是真卡面（缩小到 240px），
 * 右边是名字、尾号、状态与可用额度；卡面本身不可交互 —— 助手侧要动手的是按钮，不是卡。
 */
export function CardTile({ card = {}, hidden = false, frozen, action }) {
  const { org } = look(card);
  /* 挂失是「不可用」里更重的那一档：卡面走 lost 材料，状态文字也不能再写「已冻结」。 */
  const lost = card.status === 'lost';
  const off = frozen === undefined ? (lost || card.status === 'frozen' || card.active === false) : frozen;
  const facts = [{ k: '卡片状态', v: lost ? '已挂失' : off ? '已冻结' : '正常使用', warn: off }];
  if (typeof card.available === 'number') facts.push({ k: '可用额度', v: '¥' + money(card.available) });
  facts.push({ k: '卡组织', v: org });

  return <article className="card-tile" data-state={lost ? 'lost' : off ? 'frozen' : 'active'}>
    <CardFace card={card} hidden={hidden} frozen={off} lost={lost} still decorative/>
    <div className="card-tile-body">
      <h3>{card.name || '银行卡'}</h3>
      <p className="card-tile-sub">尾号 {card.tail || '••••'}{card.type ? ' · ' + card.type : ''}</p>
      <dl className="card-tile-facts">
        {facts.map(f => <div key={f.k}>
          <dt>{f.k}</dt>
          <dd className={f.warn ? 'is-warn' : undefined}>{f.v}</dd>
        </div>)}
      </dl>
      {action && <div className="card-tile-act">{action}</div>}
    </div>
  </article>;
}
