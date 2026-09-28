/**
 * a2ui/render.jsx —— 组件白名单的 React 实现
 * ============================================================================
 * 只认 apply.js 解析出来的树。协议里没有颜色/字号字段，所有样式来自 tokens.css，
 * 组件通过语义 class 名（a2ui-*）取样式。
 */

import React from 'react';
import { CardFace as AssistantCardFace } from '../views/pages/cardFace.jsx';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Banknote, BarChart3, Calendar,
  Check, Clock, Cloud, CreditCard, Landmark, LockKeyhole, Music, Repeat, RotateCcw,
  ShieldCheck, ShoppingBag, Smartphone, Sparkles, Train, User, Users, Utensils,
  Video, Wallet,
} from 'lucide-react';

/** 图标名白名单 → lucide 组件。协议里只能写名字，不能写组件。 */
const ICONS = {
  transfer: ArrowUpRight,
  bills: BarChart3,
  subscriptions: RotateCcw,
  cards: CreditCard,
  check: Check,
  lock: LockKeyhole,
  shield: ShieldCheck,
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-left': ArrowDownLeft,
  wallet: Wallet,
  sparkles: Sparkles,
  'arrow-left': ArrowLeft,
  user: User,
  users: Users,
  calendar: Calendar,
  clock: Clock,
  repeat: Repeat,
  smartphone: Smartphone,
  landmark: Landmark,
  utensils: Utensils,
  'shopping-bag': ShoppingBag,
  train: Train,
  cloud: Cloud,
  video: Video,
  music: Music,
  banknote: Banknote,
};

function Node({ node, onAction }) {
  if (!node) return null;
  switch (node.type) {
    case 'Text': {
      /* 悬空引用解析为 null —— 显示占位符而不是 undefined */
      const empty = node.text === null || node.text === undefined || node.text === '';
      return <span className={`a2ui-text a2ui-text--${node.variant}`}>{empty ? '-' : node.text}</span>;
    }
    case 'Icon': {
      const Icon = ICONS[node.name];
      return <span className={`a2ui-icon a2ui-icon--${node.tone}`} aria-hidden="true"><Icon size={18}/></span>;
    }
    case 'Row':
      return <div className={`a2ui-row ${node.align ? 'a2ui-row--' + node.align : ''} ${node.wrap ? 'a2ui-row--wrap' : ''}`} style={node.gap ? { gap: node.gap } : undefined}>{node.children.map(c => <Node key={c.key} node={c} onAction={onAction}/>)}</div>;
    case 'Column':
      return <div className={`a2ui-col ${node.align ? 'a2ui-col--' + node.align : ''}`} style={node.gap ? { gap: node.gap } : undefined}>{node.children.map(c => <Node key={c.key} node={c} onAction={onAction}/>)}</div>;
    case 'Card': {
      const cls = `a2ui-card a2ui-card--${node.tone || 'neutral'}` + (node.action ? ' a2ui-card--interactive' : '');
      if (node.action) {
        return <button type="button" className={cls} onClick={() => onAction && onAction(node.action)}><Node node={node.child} onAction={onAction}/></button>;
      }
      return <div className={cls}><Node node={node.child} onAction={onAction}/></div>;
    }
    case 'TextField':
      return <label className="a2ui-field">
        <span className="a2ui-text a2ui-text--label">{node.label}</span>
        <input
          className="a2ui-input" type="text" inputMode={node.inputMode}
          placeholder={node.placeholder} maxLength={node.maxLength}
          data-testid={node.testId}
          value={node.value === null || node.value === undefined ? '' : node.value}
          onChange={e => onAction && onAction({ name: 'field.change', context: { path: node.path, value: e.target.value } })}
        />
      </label>;
    case 'Divider':
      return <hr className="a2ui-divider"/>;
    case 'CardFace':
      return <AssistantCardFace card={{ id: node.cardId, name: node.name, tail: node.tail }}
                                hidden={node.hidden} frozen={node.frozen} still/>;
    case 'Figure': {
      const empty = node.value === null || node.value === undefined || node.value === '';
      return <div className={'a2ui-figure' + (node.tone ? ' a2ui-figure--' + node.tone : '')}>
        <span className="a2ui-text a2ui-text--caption">{node.label}</span>
        <span className={'a2ui-figure-value' + (empty ? ' is-empty' : '')}>{empty ? '-' : node.value}</span>
        {node.note && <span className="a2ui-text a2ui-text--caption2">{node.note}</span>}
      </div>;
    }
    case 'Progress':
      return <div className="a2ui-progress" role="progressbar" aria-valuenow={node.current} aria-valuemin={1} aria-valuemax={node.total} aria-label={node.label || '进度'}>
        {Array.from({ length: node.total }, (_, i) => (
          <span key={i} className={'a2ui-progress-seg' + (i < node.current ? ' on' : '')}/>
        ))}
      </div>;
    case 'Meter': {
      const inner = <>
        <span className="a2ui-text a2ui-text--label">{node.label}</span>
        <span className="a2ui-meter-track"><span className={`a2ui-meter-fill a2ui-meter-fill--${node.tone}`} style={{ width: node.percent + '%' }}/></span>
        <span className="a2ui-text a2ui-text--amount">{node.value === null ? '-' : node.value}</span>
      </>;
      return node.event
        ? <button type="button" className="a2ui-meter" onClick={() => onAction && onAction(node.event)}>{inner}</button>
        : <div className="a2ui-meter">{inner}</div>;
    }
    case 'Select':
      return <label className="a2ui-field a2ui-field--select">
        <span className="a2ui-text a2ui-text--label">{node.label}</span>
        <select
          className="a2ui-input"
          value={node.value === null || node.value === undefined ? '' : node.value}
          onChange={e => onAction && onAction({ name: 'field.change', context: { path: node.path, value: e.target.value } })}
        >
          {node.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>;
    case 'ActionGroup':
      return <div className={'a2ui-actions' + (node.align === 'start' ? ' a2ui-actions--start' : '')}>{node.actions.map(a => (
        <button
          key={a.event.name}
          type="button"
          className={`a2ui-btn a2ui-btn--${a.variant}`}
          onClick={() => onAction && onAction(a.event)}
        >{a.label}</button>
      ))}</div>;
    default:
      return null;
  }
}

/**
 * 渲染一个 surface。
 * diagnostics 里属于本 surface 的问题会在开发态提示，但**绝不渲染未知内容**。
 */
export default function SurfaceView({ surface, tree, onAction }) {
  if (!surface || !tree) return null;
  return (
    <div className="a2ui-surface" data-surface-id={surface.id} data-step={surface.dataModel.step || undefined}>
      <Node node={tree} onAction={onAction}/>
      {surface.meta && surface.meta.provenance && (
        <p className="a2ui-provenance" title="数据来源">
          {surface.meta.provenance.label}
        </p>
      )}
    </div>
  );
}
