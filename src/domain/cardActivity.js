import { money } from './bank.js';

/** Associate only explicit card IDs or the exact card suffix written by the payment API. */
export function cardTransactions(transactions, card) {
  return transactions.filter(t => t.cardId ? t.cardId === card.id
    : new RegExp('(?:^|·)\\s*尾号\\s*' + card.tail + '\\s*$').test(t.note || ''))
    .map(t => ({ ...t, positive: t.amount > 0,
      amountText: (t.amount < 0 ? '−' : '+') + '¥' + money(Math.abs(t.amount)) }))
    .sort((a, b) => (b.at || b.date).localeCompare(a.at || a.date));
}

export function cardActivitySummary(feed) {
  const month = feed[0]?.date.slice(0, 7) || null;
  const rows = month ? feed.filter(t => t.date.startsWith(month)) : [];
  return { month, count: rows.length, spend: rows.filter(t => t.amount < 0).reduce((n, t) => n - t.amount, 0) };
}
