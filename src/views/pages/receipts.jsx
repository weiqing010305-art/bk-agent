import React from 'react';
import { Receipt } from 'lucide-react';
import { Page, Panel, Empty, Row } from '../parts.jsx';

/** 回执：已完成的操作，可追溯到具体交易。 */
export default function Receipts({ ctx }) {
  const { bank, yuan, setRoute } = ctx;
  /* 空的时候不写副标题：下面那块空态已经说了同一件事，说两遍就是多一句话 */
  return <Page title="回执" subtitle={bank.completed.length ? bank.completed.length + ' 笔已完成' : null}>
    {bank.completed.length === 0
      ? <Panel><Empty icon={Receipt} title="暂无回执" action="去转账"
                      onAction={() => setRoute('transfer')}/></Panel>
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
  </Page>;
}
