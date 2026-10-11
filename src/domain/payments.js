import { normalize } from './bank.js';

export const utilityNames = { water: '水费', electricity: '电费', gas: '燃气费' };
// ponytail: 一期演示信用卡账单；还款额从同一本流水派生，避免另存欠款状态。
export const creditBill = { id: '664266', name: '青禾信用卡', tail: '6642', amount: 452000, dueDate: '2026-10-26' };
export const creditPaymentName = '信用卡还款 · ' + creditBill.tail;
export const creditDue = bank => Math.max(0, creditBill.amount + bank.transactions
  .filter(t => t.name === creditPaymentName && t.category === '信用卡还款')
  .reduce((n, t) => n + t.amount, 0));
export function paymentDetails(bank, draft) {
  const card = bank.cards.find(c => c.id === draft.cardId && c.id !== 'credit' && c.status === 'active');
  if (!card) throw new Error('请选择一张可用的银行卡。');
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0 || draft.amount > 10000000) throw new Error('金额须大于 0，且不超过 ¥100,000.00。');
  if (draft.kind === 'phone' && !/^1[3-9]\d{9}$/.test(draft.target)) throw new Error('请输入有效的 11 位手机号。');
  if (draft.kind === 'utility' && (!utilityNames[draft.utility] || !/^\d{6,20}$/.test(draft.target))) throw new Error('请选择缴费类型，并输入 6–20 位户号。');
  if (draft.kind === 'credit' && (draft.target !== creditBill.id || draft.amount > creditDue(bank))) throw new Error('还款金额不能超过本期待还金额。');
  if (draft.kind === 'traffic' && !/^\d{8,20}$/.test(draft.target)) throw new Error('请输入 8–20 位交通卡号。');
  if (!['phone', 'utility', 'credit', 'traffic'].includes(draft.kind)) throw new Error('不支持的支付类型。');
  return { name: draft.kind === 'traffic' ? '交通卡充值' : draft.kind === 'credit' ? creditPaymentName : draft.kind === 'phone' ? '手机充值' : utilityNames[draft.utility] + '缴费', card };
}

export function payLocal(bank, draft) {
  if (bank.completed.includes(draft.id)) return bank;
  const { name, card } = paymentDetails(bank, draft);
  if (draft.password !== '123456') throw new Error('支付密码不正确，请重新输入。');
  const available = bank.balance;
  if (draft.amount > available) throw new Error('账户余额不足，请调整金额或补充演示余额。');
  const at = new Date().toISOString();
  return normalize({ ...bank, available: available - draft.amount,
    completed: [...bank.completed, draft.id],
    transactions: [{ id: draft.id, name, category: draft.kind === 'traffic' ? '交通' : draft.kind === 'credit' ? '信用卡还款' : draft.kind === 'phone' ? '通信' : '生活缴费',
      amount: -draft.amount, date: at.slice(0, 10), at, method: 'card',
      note: `${draft.target} · 尾号${card.tail}`, cardId: card.id }, ...bank.transactions] });
}
