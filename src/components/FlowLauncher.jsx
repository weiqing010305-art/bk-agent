import React, { useId, useState } from 'react';
import {
  ArrowLeftRight, BarChart3, CreditCard, RotateCcw, Sparkles, Users,
} from 'lucide-react';
import { SERVICE_TILES } from '../views/serviceCatalog.js';
import { SURFACES } from '../agent/planner.js';

const ICONS = { transfer: ArrowLeftRight, bills: BarChart3, subscriptions: RotateCcw, cards: CreditCard, payees: Users, sparkles: Sparkles };

/** 新对话欢迎消息下的功能入口，与 planner 的目录共用数据。 */
export default function FlowLauncher({ ctx }) {
  const { startTransfer, runAction, setRoute, busy } = ctx;
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const extraServices = SERVICE_TILES.filter(s => !['transfer', 'bills', 'subscriptions', 'cards'].includes(s.route));
  return <div className="launcher">
    <div className="launcher-inner">
      <div className="launcher-row">
        {SURFACES.map(s => {
          const Icon = s.id === 'transfer.aa' ? Users : ICONS[s.icon] || ArrowLeftRight;
          return <button
            key={s.id}
            className="flow-chip"
            disabled={busy}
            aria-expanded={s.id === 'occasion' ? expanded : undefined}
            aria-controls={s.id === 'occasion' ? panelId : undefined}
            onClick={() => (s.id === 'occasion' ? setExpanded(v => !v) : s.id === 'transfer' ? startTransfer() : runAction(s.id))}
          >
            <i aria-hidden="true"><Icon size={24} strokeWidth={1.9}/></i>
            {s.label}
          </button>;
        })}
      </div>
      {expanded && <section id={panelId} className="launcher-services" aria-label="跨场景服务">
        <p>选择需要办理的服务</p>
        <div className="launcher-services-grid">{extraServices.map(s => {
          const Icon = s.icon;
          return <button key={s.route} className="flow-chip" disabled={busy} onClick={() => setRoute(s.route)}>
            <i aria-hidden="true"><Icon size={24} strokeWidth={1.9}/></i>{s.label}
          </button>;
        })}</div>
      </section>}
    </div>
  </div>;
}
