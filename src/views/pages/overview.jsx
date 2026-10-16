import React, { useState } from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { Page, CountUp } from '../parts.jsx';
import { EyeIcon } from '../shared.jsx';
import HomeServices from './homeServices.jsx';
import HomeInsights from './homeInsights.jsx';
import Feed from './feed.jsx';
import './overview.css';

const fmt = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 账户、服务、收支、动态；所有金额来自原账本。 */
export default function Overview({ ctx }) {
  const { bank, dataModel: d, setRoute } = ctx;
  const [hidden, setHidden] = useState(false);
  const mask = value => hidden ? '¥ ••••' : value;
  const savings = Object.values(bank.savings || {}).reduce((n, amount) => n + amount, 0);
  const allocations = [
    { label: '待扣订阅', value: d.frozenText, route: 'subscriptions' },
    { label: '在途', value: d.pendingText, route: 'bills' },
    { label: '计划留存', value: fmt(savings), route: 'savings' },
  ];
  return <Page>
    <section className="balance-hero" aria-label="账户概况">
      <div className="home-balance">
        <div className="balance-hero-top"><span>可用余额</span>
          <button className="hero-eye" onClick={() => setHidden(v => !v)} aria-pressed={hidden}
            aria-label={hidden ? '显示金额' : '隐藏金额'}><EyeIcon off={hidden}/></button>
        </div>
        {hidden ? <strong className="hero-amount">¥ ••••</strong> : <CountUp cents={d.balance} format={fmt}/>}
        <div className="home-balance-actions">
          <button type="button" onClick={() => setRoute('transfer')}>转一笔<ArrowUpRight size={17}/></button>
          <button type="button" onClick={() => setRoute('cards')}>我的银行卡<ChevronRight size={15}/></button>
        </div>
      </div>
      <div className="home-allocation"><h2>资金安排</h2>
        {allocations.map(a => <button type="button" key={a.label} onClick={() => setRoute(a.route)}>
          <span>{a.label}</span><strong>{mask(a.value)}</strong><ChevronRight size={14}/>
        </button>)}
      </div>
    </section>
    <HomeServices onGo={setRoute}/>
    <HomeInsights bank={bank} hidden={hidden} onGo={setRoute} format={fmt}/>
    <Feed ctx={ctx} hidden={hidden}/>
  </Page>;
}
