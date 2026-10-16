import { useCallback, useEffect, useState } from 'react';
import { createConversation, deleteConversation, historyKey, initialHistory, updateCurrent } from '../domain/conversations.js';

/**
 * 会话持久化。与旧版的差别：暴露 patch(patchObject) 而不是 setField(name, value)，
 * 因为一次交互常常要同时改 turns 和 a2ui（追加一条消息 + 应用 A2UI 信封），
 * 分两次 setField 会产生两次渲染，中间那一帧的状态是不自洽的。
 */
export function useConversations() {
  const [store, setStore] = useState(() => {
    try { return initialHistory(localStorage.getItem(historyKey)); } catch { return initialHistory(null); }
  });
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(historyKey, JSON.stringify(store)); setSaveError(false); }
    catch { setSaveError(true); }
  }, [store]);

  const patch = useCallback((p, conversationId) => setStore(prev => {
    if (!conversationId) return updateCurrent(prev, p);
    if (!prev.items.some(c => c.id === conversationId)) return prev;
    return { ...updateCurrent({ ...prev, activeId: conversationId }, p), activeId: prev.activeId };
  }), []);
  /** 函数式改 turns：用于「先占位、后填充」这类异步补丁，避免闭包拿到过期的 turns */
  const patchTurns = useCallback((fn, conversationId) => setStore(prev => {
    const targetId = conversationId || prev.activeId;
    const cur = prev.items.find(c => c.id === targetId);
    if (!cur) return prev;
    const next = updateCurrent({ ...prev, activeId: targetId }, { turns: fn(cur.turns) });
    return { ...next, activeId: prev.activeId };
  }), []);
  const select = useCallback(id => setStore(prev => prev.items.some(c => c.id === id) ? { ...prev, activeId: id } : prev), []);
  const create = useCallback(() => setStore(createConversation), []);
  const remove = useCallback(id => setStore(prev => deleteConversation(prev, id)), []);

  return { current: store.items.find(c => c.id === store.activeId), items: store.items, patch, patchTurns, select, create, remove, saveError };
}
