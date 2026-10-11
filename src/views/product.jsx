import React from 'react';
import Overview from './pages/overview.jsx';
import Bills from './pages/bills.jsx';
import StatementExport from './pages/statementExport.jsx';
import Subscriptions from './pages/subscriptions.jsx';
import Cards from './pages/cards.jsx';
import Transfer from './pages/transfer.jsx';
import EverydayServices from './pages/everydayServices.jsx';
import Savings from './pages/savings.jsx';
import TravelWallet from './pages/travelWallet.jsx';
import Wealth from './pages/wealth.jsx';

/**
 * 产品层路由。
 *
 * 每个页面各自一个文件，共用 ../parts.jsx（零件）与 ../shared.jsx（分类/订阅的视觉语言）。
 * 这样分工时一个页面一个 owner，互不踩脚。
 */
const VIEWS = { overview: Overview, bills: Bills, statement: StatementExport, subscriptions: Subscriptions, cards: Cards, transfer: Transfer,
  savings: Savings, traffic: EverydayServices, phone: EverydayServices, utility: EverydayServices, exchange: EverydayServices,
  credit: EverydayServices, appointment: EverydayServices, travel: TravelWallet, wealth: Wealth };

export default function ProductView({ ctx }) {
  const View = VIEWS[ctx.route] || Overview;
  return <div className="view-scroll"><div className="view-inner"><View ctx={ctx}/></div></div>;
}
