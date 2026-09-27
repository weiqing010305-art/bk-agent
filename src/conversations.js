export const historyKey = 'qinghe-conversations-v1';
export const emptyTransfer = () => ({ contactId: '', recipientMode: 'saved', cardNumber: '', amount: '', note: '' });

export function newConversation() {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: '新对话', createdAt: now, updatedAt: now,
    messages: [{ id: crypto.randomUUID(), role: 'assistant', kind: 'welcome', time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }],
    active: 'home', draft: '', transferDraft: emptyTransfer(), billFilter: '全部' };
}

export function initialHistory(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.version === 1 && Array.isArray(saved.items) && saved.items.length && saved.items.every(c =>
      typeof c.id === 'string' && typeof c.title === 'string' && typeof c.updatedAt === 'string' &&
      Array.isArray(c.messages) && c.messages.length && c.messages.every(m => m && typeof m.id === 'string' && typeof m.kind === 'string' && ['user', 'assistant'].includes(m.role)) &&
      typeof c.draft === 'string' && typeof c.active === 'string' && c.transferDraft && typeof c.transferDraft.amount === 'string' && typeof c.billFilter === 'string')) {
      return { ...saved, activeId: saved.items.some(c => c.id === saved.activeId) ? saved.activeId : saved.items[0].id };
    }
  } catch {}
  const conversation = newConversation();
  return { version: 1, activeId: conversation.id, items: [conversation] };
}

export function updateCurrent(store, field, value) {
  return { ...store, items: store.items.map(c => {
    if (c.id !== store.activeId) return c;
    const next = { ...c, [field]: typeof value === 'function' ? value(c[field]) : value, updatedAt: new Date().toISOString() };
    if (field === 'messages') next.title = next.messages.find(m => m.role === 'user' && m.text)?.text.slice(0, 26) || '新对话';
    return next;
  }) };
}

export function createConversation(store) {
  const current = store.items.find(c => c.id === store.activeId);
  if (current?.messages.length === 1 && !current.draft && !current.transferDraft.amount && current.active === 'home') return store;
  const conversation = newConversation();
  return { ...store, activeId: conversation.id, items: [conversation, ...store.items] };
}

export function deleteConversation(store, id) {
  if (!store.items.some(c => c.id === id)) return store;
  const items = store.items.filter(c => c.id !== id);
  if (!items.length) {
    const conversation = newConversation();
    return { ...store, activeId: conversation.id, items: [conversation] };
  }
  const activeId = store.activeId === id ? [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].id : store.activeId;
  return { ...store, activeId, items };
}
