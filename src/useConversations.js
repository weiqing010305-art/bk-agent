import { useCallback, useEffect, useState } from 'react';
import { createConversation, deleteConversation, historyKey, initialHistory, updateCurrent } from './conversations.js';

export function useConversations() {
  const [store, setStore] = useState(() => {
    try { return initialHistory(localStorage.getItem(historyKey)); } catch { return initialHistory(null); }
  });
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(historyKey, JSON.stringify(store)); setSaveError(false); }
    catch { setSaveError(true); }
  }, [store]);
  const setField = useCallback((field, value) => setStore(prev => updateCurrent(prev, field, value)), []);
  const select = useCallback(id => setStore(prev => prev.items.some(c => c.id === id) ? { ...prev, activeId: id } : prev), []);
  const create = useCallback(() => setStore(createConversation), []);
  const remove = useCallback(id => setStore(prev => deleteConversation(prev, id)), []);
  return { current: store.items.find(c => c.id === store.activeId), items: store.items, setField, select, create, remove, saveError };
}
