import React from 'react';
import {
  ArrowLeftRight, BarChart3, CreditCard, RotateCcw, Sparkles, Users,
} from 'lucide-react';
import { SURFACES } from '../agent/planner.js';

const ICONS = { transfer: ArrowLeftRight, bills: BarChart3, subscriptions: RotateCcw, cards: CreditCard, payees: Users, sparkles: Sparkles };

/** 新对话欢迎消息下的功能入口，与 planner 的目录共用数据。 */
export default function FlowLauncher({ ctx }) {
  const { startTransfer, runAction, busy } = ctx;
  return <div className="launcher">
    <div className="launcher-inner">
      <div className="launcher-row">
        {SURFACES.map(s => {
          const Icon = s.id === 'transfer.aa' ? Users : ICONS[s.icon] || ArrowLeftRight;
          return <button
            key={s.id}
            className="flow-chip"
            disabled={busy}
            onClick={() => (s.id === 'transfer' ? startTransfer() : runAction(s.id))}
          >
            <i aria-hidden="true"><Icon size={24} strokeWidth={1.9}/></i>
            {s.label}
          </button>;
        })}
      </div>
    </div>
  </div>;
}
