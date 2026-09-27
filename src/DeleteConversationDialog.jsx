import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

export default function DeleteConversationDialog({ title, onCancel, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="modal delete-chat-dialog" aria-labelledby="delete-chat-title" aria-describedby="delete-chat-description" onCancel={e => { e.preventDefault(); onCancel(); }}>
    <span className="delete-chat-icon"><Trash2 size={23}/></span>
    <h2 id="delete-chat-title">删除这条对话？</h2>
    <strong className="delete-chat-name">{title}</strong>
    <p id="delete-chat-description">将删除此浏览器中的消息和表单草稿，删除后无法恢复。不会删除银行交易、账单，也不会撤销已完成的转账。</p>
    <div className="modal-actions"><button autoFocus className="ghost-btn" onClick={onCancel}>保留对话</button><button className="primary-btn danger-btn" onClick={onDelete}>确认删除</button></div>
  </dialog>;
}
