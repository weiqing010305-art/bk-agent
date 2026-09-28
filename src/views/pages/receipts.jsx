import React from 'react';
import { Receipt } from 'lucide-react';
import { Page, Panel, Empty, Row } from '../parts.jsx';

/** 回执：已完成的操作，可追溯到具体交易。 */
export default function Receipts({ ctx }) {
  const { bank, yuan } = ctx;
  return <Page title="回执" subtitle={bank.completed.length ? bank.completed.length + ' 笔已完成' : '还没有完成过转账'}>
    {bank.completed.length === 0
      ? <Panel><Empty>去「转账」发起一笔，完成后回执会出现在这里。</Empty></Panel>
      : <Panel><ul className="row-list">
          {bank.completed.map(id => {
            const t = bank.transactions.find(x => x.id === id);
            if (!t) return null;
            return <Row key={id}
              icon={<span className="tx-icon tx-icon--income tx-icon--round" aria-hidden="true"><Receipt size={18}/></span>}
              title={t.name}
              sub={t.date + ' · 回执编号 ' + String(id).slice(0, 8).toUpperCase()}
              value={yuan(Math.abs(t.amount))}/>;
          })}
        </ul></Panel>}
    <p className="page-note">演示环境不产生真实交易凭证</p>
  </Page>;
}
