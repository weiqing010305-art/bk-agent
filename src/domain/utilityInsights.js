import { utilityNames } from './payments.js';

export const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (month, offset) => {
  const [year, m] = month.split('-').map(Number);
  return monthKey(new Date(year, m - 1 + offset, 1));
};

/** Read only: no synthetic bills, debt, household accounts or history. Amounts stay in cents. */
export function utilityRecords(transactions) {
  return transactions.filter(t => t.category === '生活缴费' && Number.isSafeInteger(t.amount) && t.amount < 0)
    .map(t => ({ ...t,
      kind: Object.keys(utilityNames).find(key => t.name === utilityNames[key] + '缴费' || t.name === utilityNames[key]) || 'other',
      target: /^(\d{6,20})(?:\s*·|$)/.exec(t.note || '')?.[1] || '',
      cost: -t.amount,
    })).sort((a, b) => (b.at || b.date).localeCompare(a.at || a.date));
}

export function utilityReport(transactions, picked, current = monthKey()) {
  const all = utilityRecords(transactions);
  const month = picked || current;
  const rows = all.filter(t => t.date.slice(0, 7) === month);
  const total = rows.reduce((sum, t) => sum + t.cost, 0);
  const names = { ...utilityNames, other: '其他缴费' };
  const parts = Object.entries(names).map(([id, name]) => {
    const matches = rows.filter(t => t.kind === id);
    const amount = matches.reduce((sum, t) => sum + t.cost, 0);
    return { id, name, amount, count: matches.length, ratio: total ? amount / total : 0 };
  }).filter(p => p.id !== 'other' || p.count);
  // Largest remainders make the printed shares add to 100 without changing money.
  parts.forEach(p => { p.percent = Math.floor(p.ratio * 100); });
  const ranked = [...parts].sort((a, b) => (b.ratio * 100 - b.percent) - (a.ratio * 100 - a.percent));
  for (let n = 0, remaining = total ? 100 - parts.reduce((sum, p) => sum + p.percent, 0) : 0; n < remaining; n++) ranked[n].percent++;
  const trend = Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(month, i - 5);
    const records = all.filter(t => t.date.slice(0, 7) === key);
    return { month: key, amount: records.reduce((sum, t) => sum + t.cost, 0), count: records.length };
  });
  return { month, rows, total, parts, trend,
    months: [...new Set([current, month, ...all.map(t => t.date.slice(0, 7))])].sort().reverse(),
  };
}
