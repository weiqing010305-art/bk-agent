/** 原账本最近有记录月份的收支；不是预算、收益或银行资产总额。 */
export function overviewInsights(transactions = []) {
  const valid = transactions.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isSafeInteger(t.amount));
  const month = valid.map(t => t.date.slice(0, 7)).sort().at(-1) || null;
  const rows = valid.filter(t => t.date.startsWith(month));
  const income = rows.filter(t => t.amount > 0).reduce((n, t) => n + t.amount, 0);
  const expense = rows.filter(t => t.amount < 0).reduce((n, t) => n - t.amount, 0);
  const groups = new Map();
  for (const t of rows) {
    if (t.amount >= 0) continue;
    const name = t.category || '其他';
    groups.set(name, (groups.get(name) || 0) - t.amount);
  }
  const categories = [...groups].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const parts = categories.slice(0, 2);
  if (categories.length > 2) parts.push({ name: '其余分类', amount: categories.slice(2).reduce((n, p) => n + p.amount, 0) });
  return { month, income, expense, count: rows.length, parts };
}
