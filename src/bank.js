export const money = n => (n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const contacts = [{ id: 'landlord', name: '房东 · 王女士', number: '6228 •••• 3821' }, { id: 'zhang', name: '张三', number: '6217 •••• 9062' }, { id: 'li', name: '李四', number: '6222 •••• 1058' }];
export function seed() {
  return { balance: 1286050, completed: [], cards: [{ id: 'debit', name: '青禾借记卡', tail: '8826', status: 'active', type: '日常支付账户' }, { id: 'travel', name: '青禾旅行卡', tail: '3901', status: 'active', type: '备用借记卡 · 余额 ¥0.00' }], subscriptions: [{ id: 'cloud', name: '云空间', detail: '200 GB 云存储', amount: 2900, date: '2026-09-28', status: 'active' }, { id: 'video', name: '光影视频', detail: '连续包月会员', amount: 2500, date: '2026-09-29', status: 'active' }, { id: 'music', name: '随听音乐', detail: '个人音乐会员', amount: 1800, date: '2026-10-02', status: 'active' }], transactions: [
    { id: '1', name: '九月工资', category: '收入', amount: 1500000, date: '2026-09-10' },
    { id: '2', name: '房租', category: '转账', amount: -300000, date: '2026-09-12' },
    { id: '3', name: '日常餐饮', category: '餐饮', amount: -85600, date: '2026-09-24' },
    { id: '4', name: '生活采购', category: '购物', amount: -62800, date: '2026-09-23' },
    { id: '5', name: '地铁与打车', category: '交通', amount: -18600, date: '2026-09-22' },
    { id: '6', name: '云空间', category: '订阅', amount: -2900, date: '2026-09-01' },
    { id: '7', name: '光影视频', category: '订阅', amount: -2500, date: '2026-09-01' },
    { id: '8', name: '随听音乐', category: '订阅', amount: -1800, date: '2026-09-02' }
  ] };
}
export function transfer(state, { id, contactId, amount, note = '' }) {
  if (state.completed.includes(id)) return state;
  const contact = contacts.find(c => c.id === contactId);
  if (!contact || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('请选择收款人，并输入有效金额（最多两位小数）。');
  if (amount > state.balance) throw new Error('账户余额不足，请修改转账金额。');
  return { ...state, balance: state.balance - amount, completed: [...state.completed, id], transactions: [{ id, name: `转给${contact.name}`, category: '转账', amount: -amount, date: '2026-09-25', note }, ...state.transactions] };
}
export function totals(state) {
  const out = state.transactions.filter(t => t.amount < 0);
  return { income: state.transactions.filter(t => t.amount > 0).reduce((a,t) => a+t.amount,0), spending: -out.reduce((a,t) => a+t.amount,0), categories: ['转账','餐饮','购物','交通','订阅'].map(name => ({ name, amount: -out.filter(t => t.category === name).reduce((a,t)=>a+t.amount,0) })) };
}
export function intent(text) {
  if (/转账|转给|转.*\d|汇款/.test(text)) return 'transfer';
  if (/订阅|续费|会员|扣费/.test(text)) return 'subscriptions';
  if (/卡片|银行卡|冻结|解冻/.test(text)) return 'cards';
  if (/账单|花了|支出|消费|分析/.test(text)) return 'bills';
  return 'unknown';
}
