import React from 'react';
import {
  ArrowLeftRight, BarChart3, CreditCard, RotateCcw, Users,
} from 'lucide-react';
import { SURFACES } from '../agent/planner.js';

const ICONS = { transfer: ArrowLeftRight, bills: BarChart3, subscriptions: RotateCcw, cards: CreditCard, payees: Users };

/**
 * 常驻动线入口。
 *
 * 对话流会滚走，但"我现在能做什么"必须一直在 —— 否则用户只看到聊过的那一条，
 * 不知道还有别的业务面可开。
 *
 * 它同时是 A2UI 目录的可视化：这里每一项对应 planner 里的一个 surface 构建器。
 */
export default function FlowLauncher({ ctx }) {
  const { startTransfer, runAction, busy } = ctx;
  return <div className="launcher">
    <div className="launcher-inner">
      <p className="launcher-label">可以让他做什么</p>
      <div className="launcher-row">
        {SURFACES.map(s => {
          const Icon = ICONS[s.icon] || ArrowLeftRight;
          return <button
            key={s.id}
            className="flow-chip"
            disabled={busy}
            onClick={() => (s.id === 'transfer' ? startTransfer() : runAction(s.id))}
          >
            <i aria-hidden="true"><Icon size={14}/></i>
            {s.label}
            {s.steps > 1 && <em>{s.steps} 步</em>}
          </button>;
        })}
      </div>
    </div>
  </div>;
}
