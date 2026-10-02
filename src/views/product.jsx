import React from 'react';
import Overview from './pages/overview.jsx';
import Bills from './pages/bills.jsx';
import Subscriptions from './pages/subscriptions.jsx';
import Cards from './pages/cards.jsx';
import Receipts from './pages/receipts.jsx';
import Transfer from './pages/transfer.jsx';
import Wealth from './pages/wealth.jsx';

/**
 * 产品层路由。
 *
 * 每个页面各自一个文件，共用 ../parts.jsx（零件）与 ../shared.jsx（分类/订阅的视觉语言）。
 * 这样分工时一个页面一个 owner，互不踩脚。
 */
/* 收款人**没有独立页面**（作者决策 D-20）。
   它的形态是「转账页里嵌的一段名录」—— 那一段在 pages/payees.jsx，
   由 pages/transfer.jsx 引入，不在这里挂路由。 */
const VIEWS = { overview: Overview, bills: Bills, subscriptions: Subscriptions, cards: Cards, receipts: Receipts, transfer: Transfer, wealth: Wealth };

export default function ProductView({ ctx }) {
  const View = VIEWS[ctx.route] || Overview;
  return <div className="view-scroll"><div className="view-inner"><View ctx={ctx}/></div></div>;
}
