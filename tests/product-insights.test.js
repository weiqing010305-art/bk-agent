import test from 'node:test';
import assert from 'node:assert/strict';
import { utilityReport, utilityRecords } from '../src/domain/utilityInsights.js';
import { cardTransactions, cardActivitySummary } from '../src/domain/cardActivity.js';
import { overviewInsights } from '../src/domain/overviewInsights.js';

test('overview uses latest ledger month and keeps category totals exact without changing records', () => {
  const rows = [
    { date: '2026-10-01', amount: 10000, category: '收入' },
    ...[1500, 700, 200, 100].map((amount, i) => ({ date: '2026-10-02', amount: -amount, category: '分类' + i })),
    { date: '2026-09-30', amount: -99999, category: '旧账期' },
    { date: 'bad-date', amount: -100, category: '异常' },
    { date: '2027-01-01', amount: NaN, category: '异常' },
  ];
  const before = structuredClone(rows), r = overviewInsights(rows);
  assert.equal(r.month, '2026-10'); assert.equal(r.income, 10000); assert.equal(r.expense, 2500);
  assert.equal(r.count, 5); assert.deepEqual(r.parts.map(p => p.amount), [1500, 700, 300]);
  assert.equal(r.parts.reduce((n, p) => n + p.amount, 0), r.expense); assert.deepEqual(rows, before);
});
test('empty and income-only ledgers never invent spending or an account balance', () => {
  assert.deepEqual(overviewInsights([]), { month: null, income: 0, expense: 0, count: 0, parts: [] });
  const r = overviewInsights([{ date: '2026-12-01', amount: 500, category: '退款' }]);
  assert.equal(r.income, 500); assert.equal(r.expense, 0); assert.deepEqual(r.parts, []);
});

const tx = (id, name, amount, date, extra = {}) => ({ id, name, amount, date, category: '生活缴费', note: '12345678 · 尾号8826', ...extra });
test('utility reports are empty without creating bills, targets, or spending', () => {
  const r = utilityReport([], null, '2026-01');
  assert.equal(r.total, 0); assert.deepEqual(r.rows, []);
  assert.deepEqual(r.trend.map(t => t.month), ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01']);
  assert.ok(r.trend.every(t => t.amount === 0 && t.count === 0));
});
test('totals, shares and trend use only actual matching debit records, including unknown utility providers', () => {
  const list = [tx('a', '水费缴费', -1, '2026-10-01'), tx('b', '电费缴费', -1, '2026-10-02'),
    tx('c', '燃气费缴费', -1, '2026-10-03'), tx('d', '物业缴费', -1, '2026-10-04'),
    tx('refund', '水费缴费', 50, '2026-10-04'), tx('old', '水费缴费', -2000, '2026-09-02'),
    tx('not-utility', '水费缴费', -600, '2026-10-02', { category: '转账' })];
  const before = JSON.stringify(list), r = utilityReport(list, '2026-10', '2026-10');
  assert.equal(r.total, 4); assert.equal(r.rows.length, 4);
  assert.equal(r.parts.reduce((n, p) => n + p.amount, 0), r.total);
  assert.equal(r.parts.reduce((n, p) => n + p.percent, 0), 100);
  assert.equal(r.parts.find(p => p.id === 'other').amount, 1);
  assert.equal(r.trend.at(-2).amount, 2000); assert.equal(JSON.stringify(list), before);
});
test('rounded shares sum to 100 for equal thirds and a single nonzero category', () => {
  const list = ['水费', '电费', '燃气费'].map((n, i) => tx(String(i), n + '缴费', -1, '2026-10-01'));
  assert.deepEqual(utilityReport(list, '2026-10').parts.map(p => p.percent), [34, 33, 33]);
  assert.deepEqual(utilityReport(list.slice(0, 1), '2026-10').parts.map(p => p.percent), [100, 0, 0]);
});
test('repeat target must be a complete validated account, never the payment card tail or an embedded number', () => {
  const rows = utilityRecords([
    tx('a', '水费缴费', -100, '2026-10-01'), tx('b', '电费缴费', -200, '2026-10-01', { note: '尾号8826' }),
    tx('c', '燃气费缴费', -300, '2026-10-01', { note: '户号未知 12345678' }),
    tx('d', '水费缴费', -400, '2026-10-01', { note: '00001234 · 尾号3901' })]);
  assert.deepEqual(rows.map(t => t.target), ['12345678', '', '', '00001234']);
});
test('card association respects explicit IDs and exact backend suffixes, never guesses unknown transactions', () => {
  const rows = [tx('direct', '水费缴费', -1200, '2026-10-01', { cardId: 'debit' }),
    tx('other', '水费缴费', -1000, '2026-10-02', { cardId: 'travel' }),
    tx('suffix', '电费缴费', -2300, '2026-10-03'),
    tx('unknown', '餐饮', -500, '2026-10-03', { note: '备注 8826' }),
    tx('bad', '餐饮', -500, '2026-10-03', { note: '12345678 · 尾号88260' })];
  const feed = cardTransactions(rows, { id: 'debit', tail: '8826' });
  assert.deepEqual(feed.map(t => t.id), ['suffix', 'direct']);
  assert.equal(feed[0].amountText, '−¥23.00');
});
test('card summary uses the latest available month and does not fabricate a previous period', () => {
  const feed = cardTransactions([tx('old', '水费', -600, '2026-09-01'), tx('new', '水费', -1000, '2026-10-01'),
    tx('refund', '退款', 200, '2026-10-02')], { id: 'debit', tail: '8826' });
  assert.deepEqual(cardActivitySummary(feed), { month: '2026-10', count: 2, spend: 1000 });
  assert.deepEqual(cardActivitySummary([]), { month: null, count: 0, spend: 0 });
});
