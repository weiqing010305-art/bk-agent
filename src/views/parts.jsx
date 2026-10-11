import React, { useEffect, useRef } from 'react';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Info } from 'lucide-react';

/**
 * 产品层的共用零件。
 *
 * 抽象门槛遵 AGENTS.md §1「复用 ≥2 处才抽象」：
 *   Page      5 处 · Panel 5 处 · Row 5 处 · Amount 全部页面
 *   IconTile  概览宫格 + 卡片页宫格（ZA 的"两种图标语言"就落在这里）
 *   StatBar   账单 / 卡片 / 订阅 / 余额拆分行，4 处
 *   Empty / Failed / Loading  三态的唯一实现，转出 components/StateBlock.jsx
 *
 * **数值对齐的契约也在这一层**：金额 / 日期 / 百分比 / 计数一律等宽数字 + 数值列右对齐
 * （Material 3 数据表的两条，见 styles/state.css 末节）。规则只有一份，
 * 页面里不要再写一遍 —— 页面的职责是给数字，不是给数字排版。
 */

export const Page = ({ title, subtitle, aside, children }) => (
  <div className="page">
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {aside}
    </header>
    <div className="page-body">{children}</div>
  </div>
);

export const Panel = ({ title, aside, children, className = '' }) => (
  <section className={'panel ' + className}>
    {(title || aside) && <div className="panel-head"><h2>{title}</h2>{aside}</div>}
    <div className="panel-body">{children}</div>
  </section>
);

/* 三态从零件层统一转出：页面 import 的还是 '../parts.jsx'，用法不变，
   实现只有一份（照众安真实上线的空/错/载口径，见 StateBlock.jsx）。 */
export { Empty, Failed, Loading } from '../components/StateBlock.jsx';

/** 双列统计条。左值 / 右值 / 中间一根细竖线 / 可选 ⓘ。 */
export const StatBar = ({ left, right }) => (
  <div className="stat-bar">
    {[left, right].filter(Boolean).map((s, i) => (
      <div className={'stat-cell' + (i ? ' stat-cell--right' : '')} key={s.label}>
        <span className="stat-label">
          {s.label}
          {s.hint && <Info size={12} aria-label={s.hint}/>}
        </span>
        <strong className="stat-value">{s.value}</strong>
        {s.note && <small className="stat-note">{s.note}</small>}
      </div>
    ))}
  </div>
);

/**
 * 宫格格子。两种图标语言：
 *   action  = 圆形实底（钱在动，没有"物"）
 *   product = 圆角方块（有具体的消费品）
 * 这条规则来自 ZA Bank 首页宫格，是全篇最重要的单个设计决策。
 */
export const IconTile = ({ variant = 'product', tone = 'accent', icon: Icon, label, onClick }) => (
  <button className={'icon-tile icon-tile--' + variant} onClick={onClick}>
    <span className={'icon-tile-mark icon-tile-mark--' + tone} aria-hidden="true"><Icon size={20}/></span>
    <b>{label}</b>
  </button>
);

/** 金额：统一等宽数字 + 正负号显式。等宽数字由 .amount 声明，页面不必再写。 */
export const Amount = ({ value, positive, size }) => (
  <b className={'amount' + (positive ? ' amount--in' : '') + (size ? ' amount--' + size : '')}>{value}</b>
);

/** 统一的列表行。交易 / 订阅 / 卡片操作三处共用。 */
export const Row = ({ icon, title, sub, value, positive, action, className = '' }) => (
  <li className={'row-item ' + className}>
    {icon && <span className="row-icon" aria-hidden="true">{icon}</span>}
    <span className="row-main">
      <strong>{title}</strong>
      {sub && <small>{sub}</small>}
    </span>
    {value !== undefined && <Amount value={value} positive={positive}/>}
    {action}
  </li>
);

export const TxIcon = ({ item, CategoryIcon }) => <CategoryIcon item={item}/>;

/**
 * 金额滚动增长（0 → 目标值）。
 *
 * 实现方式按 doc/research/motion-and-category-ui.md §C.3 的结论：**用 rAF 直接写 DOM，不用 CSS**。
 * 理由：CSS 做不到数字插值；而走 React state 会每秒触发 60 次重渲染。
 * 只在挂载时跑一次 —— craft-floor 那条「用户正在读的数据不该为了风格而移动」说的是持续动效，
 * 入场一次性不在此列。reduced-motion 下直接出终值。
 */
export function CountUp({ cents, format }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = format(cents); return undefined; }
    const start = performance.now();
    const DUR = 720;
    let raf = 0;
    const tick = now => {
      const p = Math.min(1, (now - start) / DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(Math.round(cents * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cents, format]);
  return <strong className="hero-amount" ref={ref}>{format(cents)}</strong>;
}

export const Arrow = ({ up }) => (up ? <ArrowUpRight size={16}/> : <ArrowDownLeft size={16}/>);
export { CreditCard };
