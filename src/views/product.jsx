import React from 'react';
import Overview from './pages/overview.jsx';
import Bills from './pages/bills.jsx';
import Subscriptions from './pages/subscriptions.jsx';
import Cards from './pages/cards.jsx';
import Payees from './pages/payees.jsx';
import Receipts from './pages/receipts.jsx';
import Transfer from './pages/transfer.jsx';
import Wealth from './pages/wealth.jsx';

/**
 * 产品层路由。
 *
 * 每个页面各自一个文件，共用 ../parts.jsx（零件）与 ../shared.jsx（分类/订阅的视觉语言）。
 * 这样分工时一个页面一个 owner，互不踩脚。
 */
/* 收款人**不进导航**（作者的产品决策：它与转账流程内嵌的选人重复）。
   但路由保留 —— 去掉它会让任何 setRoute('payees') 静默落到概览，那是个看不见的 bug。 */
const VIEWS = { overview: Overview, bills: Bills, subscriptions: Subscriptions, cards: Cards, payees: Payees, receipts: Receipts, transfer: Transfer, wealth: Wealth };

export default function ProductView({ ctx }) {
  const View = VIEWS[ctx.route] || Overview;
  return <div className="view-scroll"><div className="view-inner"><View ctx={ctx}/></div></div>;
}
