import React, { useRef } from 'react';
import { Check, History, MessageSquarePlus, X } from 'lucide-react';
import './conversationControls.css';

const dateText = value => new Date(value).toLocaleString('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** 会话管理复用已有持久化，不接触账本。 */
export default function ConversationControls({ ctx }) {
  const { items, currentId, createConversation, navigateConversation, saveError } = ctx;
  const dialogRef = useRef(null);
  const chats = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const select = id => { dialogRef.current.close(); navigateConversation(id); };
  return <>
    <header className="conversation-controls" aria-label="聊天管理">
      <button type="button" className="conversation-new" onClick={createConversation}>
        <MessageSquarePlus size={18}/><span>新建聊天</span>
      </button>
      <button type="button" onClick={() => dialogRef.current.showModal()} aria-haspopup="dialog">
        <History size={18}/><span>历史聊天</span>
      </button>
      {saveError && <small role="status">聊天未保存，请稍后重试</small>}
    </header>
    <dialog ref={dialogRef} className="conversation-history" aria-labelledby="conversation-history-title"
      onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className="conversation-history-head">
        <h2 id="conversation-history-title">历史聊天</h2>
        <button type="button" aria-label="关闭历史聊天" onClick={() => dialogRef.current.close()}><X size={20}/></button>
      </div>
      <ul className="conversation-history-list">
        {chats.map(chat => <li key={chat.id}>
          <button type="button" onClick={() => select(chat.id)} aria-current={chat.id === currentId ? 'true' : undefined}>
            <span><strong>{chat.title}</strong><small>{dateText(chat.updatedAt)}</small></span>
            {chat.id === currentId && <Check size={18} aria-label="当前聊天"/>}
          </button>
        </li>)}
      </ul>
      <p>保存在此浏览器</p>
    </dialog>
  </>;
}
