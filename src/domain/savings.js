import { normalize } from './bank.js';

export function savingsDetails(bank, draft) {
  if (!/^[a-f0-9-]{36}$/.test(draft.goalId)) throw new Error('储蓄计划不存在。');
  if (!['deposit', 'withdraw'].includes(draft.direction)) throw new Error('请选择存入或取回。');
  if (!bank.cards.some(c => c.id === draft.cardId && c.id !== 'credit' && c.status === 'active')) throw new Error('请选择可用银行卡。');
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0 || draft.amount > 10000000) throw new Error('金额须大于 0，且不超过 100,000 元。');
  const saved = bank.savings?.[draft.goalId] || 0;
  if (draft.direction === 'deposit' && draft.amount > bank.balance) throw new Error('可用余额不足。');
  if (draft.direction === 'withdraw' && draft.amount > saved) throw new Error('取回金额不能超过已存金额。');
}

export function saveLocal(bank, draft) {
  if (bank.completed.includes(draft.id)) return bank;
  savingsDetails(bank, draft);
  if (draft.password !== '123456') throw new Error('支付密码不正确，请重新输入。');
  const delta = draft.direction === 'deposit' ? -draft.amount : draft.amount;
  const at = new Date().toISOString();
  return normalize({ ...bank, available: bank.balance + delta,
    savings: { ...bank.savings, [draft.goalId]: (bank.savings?.[draft.goalId] || 0) - delta },
    completed: [...bank.completed, draft.id],
    transactions: [{ id: draft.id, name: delta < 0 ? '存入储蓄计划' : '取回储蓄资金', category: '储蓄划转',
      amount: delta, date: at.slice(0, 10), at, goalId: draft.goalId, cardId: draft.cardId,
      note: '计划 ' + draft.goalId.slice(0, 8) }, ...bank.transactions] });
}
