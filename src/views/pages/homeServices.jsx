import React, { useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { SERVICE_TILES } from '../serviceCatalog.js';
import { IconTile } from '../parts.jsx';

const terms = { utility: '水费 电费 燃气', phone: '话费', traffic: '公交 地铁', credit: '信用卡 还款',
  exchange: '美元 港币 外汇', appointment: '预约 银行 柜台', bills: '流水 明细 收支', savings: '存钱 目标',
  subscriptions: '自动 续费 扣款', cards: '银行卡 冻结 限额 挂失', travel: '旅行 钱包', wealth: '投资 基金' };

export default function HomeServices({ onGo }) {
  const [query, setQuery] = useState('');
  const input = useRef(null);
  const keyword = query.trim().toLowerCase();
  const tiles = SERVICE_TILES.filter(t => (t.label + ' ' + (terms[t.route] || '')).toLowerCase().includes(keyword));
  const groups = keyword ? [{ title: '搜索结果', tiles }] : [
    { title: '日常服务', tiles: tiles.filter(t => !t.square) },
    { title: '资产管理', tiles: tiles.filter(t => t.square) },
  ];
  const clear = () => { setQuery(''); input.current?.focus(); };
  return <section className="home-services" aria-label="全部服务">
    <div className="home-services-head">
      <h2>全部服务</h2>
      <div className="service-search" role="search">
        <Search size={17} aria-hidden="true"/>
        <input ref={input} type="search" aria-label="搜索服务" placeholder="搜索服务，如水费、卡片" value={query}
          onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') clear(); }}/>
        {query && <button type="button" aria-label="清空服务搜索" onClick={clear}><X size={16}/></button>}
      </div>
    </div>
    {groups.map(group => <div className="home-service-group" key={group.title}>
      <h3>{group.title}</h3>
      <div className="icon-grid">{group.tiles.map(t => <IconTile key={t.route} variant={t.square ? 'product' : 'action'}
        tone={t.tone} icon={t.icon} label={t.label} onClick={() => onGo(t.route)}/>)}</div>
    </div>)}
    {keyword && <p className="service-search-status" role="status">{tiles.length ? `找到 ${tiles.length} 项服务` : '没有找到相关服务，试试“转账”或“水费”。'}</p>}
  </section>;
}
