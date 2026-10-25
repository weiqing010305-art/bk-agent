/**
 * domain/conversations.js —— 会话模型（A2UI 版）
 * ============================================================================
 * 一次对话 = 一串 turn + 一份 A2UI state。
 *
 * turn 只有两种：
 *   { role:'user',      text }                用户说的话（含语音转文字结果）
 *   { role:'assistant', kind:'welcome' }      新会话欢迎消息
 *   { role:'assistant', surfaceId }           助手回的一个 A2UI surface
 *
 * 之所以不再把业务卡片塞进消息对象，是因为卡片现在是**协议产物**：
 * 它由 agent/planner.js 产出、由 a2ui/apply.js 展开，可整体序列化、可单测、
 * 将来也可以整段来自后端。会话只需要记住"渲染了哪些 surface"。
 *
 * 纯函数，无 React，可直接单测。
 */

import { initialState } from '../a2ui/apply.js';

export const historyKey = 'qinghe-conversations-v2';

export function newConversation() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '新对话',
    createdAt: now,
    updatedAt: now,
    turns: [],
    a2ui: initialState(),
    draft: '',
  };
}

const isTurn = t => t && typeof t.id === 'string' &&
  ((t.role === 'user' && typeof t.text === 'string') ||
   (t.role === 'assistant' && (t.kind === 'welcome' || (t.kind === 'agent' && typeof t.text === 'string') || typeof t.surfaceId === 'string')));

const isConversation = c => c && typeof c.id === 'string' && typeof c.title === 'string' &&
  typeof c.updatedAt === 'string' && Array.isArray(c.turns) && c.turns.every(isTurn) &&
  c.a2ui && typeof c.a2ui === 'object' && c.a2ui.surfaces && typeof c.draft === 'string';

/**
 * 从 localStorage 恢复。任何一条不合法就整份丢弃并重建 ——
 * 半损坏的历史比没有历史更糟（会渲染出引用了不存在 surface 的 turn）。
 */
export function initialHistory(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.version === 2 && Array.isArray(saved.items) && saved.items.length &&
        saved.items.every(isConversation)) {
      return { ...saved, activeId: saved.items.some(c => c.id === saved.activeId) ? saved.activeId : saved.items[0].id };
    }
  } catch { /* 损坏就重建 */ }
  const conversation = newConversation();
  return { version: 2, activeId: conversation.id, items: [conversation] };
}

/** 更新当前会话。turn 的标题取首条用户消息。 */
export function updateCurrent(store, patch) {
  return {
    ...store,
    items: store.items.map(c => {
      if (c.id !== store.activeId) return c;
      const next = { ...c, ...patch, updatedAt: new Date().toISOString() };
      if (patch.turns) next.title = next.turns.find(t => t.role === 'user' && t.text)?.text.slice(0, 26) || '新对话';
      return next;
    }),
  };
}

export function createConversation(store) {
  const current = store.items.find(c => c.id === store.activeId);
  if (current && current.turns.length === 0 && !current.draft) return store;
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
  const activeId = store.activeId === id
    ? [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0].id
    : store.activeId;
  return { ...store, activeId, items };
}
