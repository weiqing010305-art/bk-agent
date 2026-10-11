export function statementRows(transactions, { start, end, direction }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new Error('请选择有效日期，结束日期不能早于开始日期。');
  if (!['all', 'income', 'expense'].includes(direction)) throw new Error('请选择有效的收支类型。');
  return transactions.filter(t => t.date >= start && t.date <= end &&
    (direction === 'all' || (direction === 'income' ? t.amount > 0 : t.amount < 0)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// 所有外部文本均转义，阻止商户名、备注在表格软件中成为公式。
const csvText = value => {
  let s = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
export const statementCsv = rows => '\uFEFF日期,交易名称,类别,金额（元）,备注,交易编号\r\n' + rows.map(t =>
  [csvText(t.date), csvText(t.name), csvText(t.category), (t.amount / 100).toFixed(2), csvText(t.note), csvText(t.id)].join(',')).join('\r\n');
