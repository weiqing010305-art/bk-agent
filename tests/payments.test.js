import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/domain/bank.js';
import { saveLocal } from '../src/domain/savings.js';
import { payLocal, creditDue, creditBill } from '../src/domain/payments.js';
import { statementRows, statementCsv } from '../src/domain/statement.js';
import { travelDate, validateTrip, travelCardStatus, travelFromText } from '../src/domain/travel.js';

const draft = { id: 'payment-1', kind: 'phone', target: '13800138000', utility: 'water', amount: 10000, cardId: 'debit', password: '123456' };

test('交通卡校验、充值流水及重复充值保护', () => {
  const bank = seed(), traffic = { ...draft, kind: 'traffic', target: '123456789012' };
  const next = payLocal(bank, traffic);
  assert.equal(next.balance, bank.balance - traffic.amount);
  assert.equal(next.transactions[0].category, '交通');
  assert.equal(payLocal(next, traffic), next);
  assert.throws(() => payLocal(bank, { ...traffic, target: '1234567' }), /交通卡号/);
});

test('储蓄存取守恒、重复提交及超额取回保护', () => {
  const bank = seed();
  const move = { ...draft, goalId: '12345678-1234-1234-1234-123456789012', direction: 'deposit' };
  const next = saveLocal(bank, move);
  assert.equal(next.balance + next.savings[move.goalId], bank.balance);
  assert.equal(next.drift, 0);
  assert.equal(saveLocal(next, move), next);
  assert.throws(() => saveLocal(next, { ...move, id: 'withdraw', direction: 'withdraw', amount: 10001 }), /已存金额/);
  assert.throws(() => saveLocal(next, { ...move, id: 'wrong-pin', password: '111111' }), /支付密码/);
  const back = saveLocal(next, { ...move, id: 'withdraw', direction: 'withdraw' });
  assert.equal(back.balance, bank.balance);
  assert.equal(back.savings[move.goalId], 0);
  assert.equal(back.drift, 0);
});
test('出行日期、现金和银行卡必须明确，错误输入不可保存', () => {
  const trip = { destination: '日本', start: travelDate(7), end: travelDate(11), cardId: 'travel', currency: 'JPY', cashAmount: '10000' };
  assert.equal(validateTrip(trip, seed().cards).destination, '日本');
  for (const patch of [{ start: travelDate() }, { end: travelDate(1) }, { destination: ' ' }, { cashAmount: '-1' }, { cashAmount: '100001' }, { cardId: 'missing' }, { start: '2026-02-30' }]) assert.throws(() => validateTrip({ ...trip, ...patch }, seed().cards));
});
test('境外卡片检查识别冻结、关闭渠道、零限额和日额度用尽', () => {
  const card = { status: 'active', channels: [{ id: 'abroad', on: true, perTxn: 100000, dayLimit: 200000, dayUsed: 50000 }] };
  assert.equal(travelCardStatus(card).ready, true);
  assert.equal(travelCardStatus(card).dayRemaining, 150000);
  for (const c of [{ ...card, status: 'frozen' }, { ...card, channels: [] }, ...[{ on: false }, { perTxn: 0 }, { dayUsed: 200000 }].map(p => ({ ...card, channels: [{ ...card.channels[0], ...p }] }))]) assert.equal(travelCardStatus(c).ready, false);
});
test('明确出行语句生成待核对草稿，普通问题不误判', () => {
  const trip = travelFromText('下周去日本五天');
  assert.equal(trip.destination, '日本');
  assert.equal(trip.start, travelDate(7));
  assert.equal(trip.end, travelDate(11));
  assert.equal(trip.currency, 'JPY');
  assert.equal(travelFromText('查看我的账单'), null);
  assert.equal(travelFromText('旅行卡的余额是多少'), null);
});
test('信用卡还款同步待还金额，拒绝超额，重复提交只扣一次', () => {
  const bank = seed();
  const repayment = { ...draft, kind: 'credit', target: creditBill.id, amount: 100000 };
  const partial = payLocal(bank, repayment);
  assert.equal(creditDue(partial), 352000);
  assert.equal(partial.balance, bank.balance - 100000);
  assert.equal(partial.drift, 0);
  assert.equal(payLocal(partial, repayment), partial);
  assert.throws(() => payLocal(partial, { ...repayment, id: 'new', amount: 352001 }));
  const paid = payLocal(partial, { ...repayment, id: 'full', amount: 352000 });
  assert.equal(creditDue(paid), 0);
  assert.equal(paid.transactions[0].category, '信用卡还款');
  assert.throws(() => payLocal(paid, { ...repayment, id: 'over', amount: 1 }));
});
test('流水按日期及收支筛选，拒绝倒置日期', () => {
  const rows = [{ id: '1', date: '2026-10-01', amount: 100 }, { id: '2', date: '2026-10-02', amount: -200 }, { id: '3', date: '2026-10-03', amount: -300 }];
  const range = { start: '2026-10-01', end: '2026-10-02', direction: 'expense' };
  assert.deepEqual(statementRows(rows, range).map(t => t.id), ['2']);
  assert.equal(statementRows(rows, { ...range, direction: 'income' })[0].id, '1');
  assert.throws(() => statementRows(rows, { ...range, start: '2026-11-01' }));
});
test('CSV 保留中文和双引号，屏蔽文本公式', () => {
  const csv = statementCsv([{ id: 'safe', date: '2026-10-01', name: '=1+1', category: '生活缴费', amount: -2550, note: '水费,"核对"\n第二行' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('-25.50'));
  assert.ok(csv.includes('"水费,""核对""\n第二行"'));
});
test('充值记账与重复提交只扣一次', () => {
  const bank = seed();
  const next = payLocal(bank, draft);
  assert.equal(next.balance, bank.balance - 10000);
  assert.equal(next.available, next.balance);
  assert.equal(next.drift, 0);
  assert.equal(next.transactions[0].category, '通信');
  assert.equal(payLocal(next, draft), next);
});
test('密码、手机号、冻结卡、余额校验失败不改账本', () => {
  const bank = seed();
  for (const patch of [{ password: '000000' }, { target: '123' }, { amount: bank.balance + 1 }, { cardId: 'missing' }]) assert.throws(() => payLocal(bank, { ...draft, ...patch }));
  assert.throws(() => payLocal({ ...bank, cards: bank.cards.map(c => ({ ...c, status: 'frozen' })) }, draft));
  assert.equal(bank.completed.length, 0);
});
test('水电燃气缴费均生成正确流水', () => {
  for (const utility of ['water', 'electricity', 'gas']) {
    const next = payLocal(seed(), { ...draft, kind: 'utility', target: '12345678', utility });
    assert.equal(next.transactions[0].category, '生活缴费');
  }
});
