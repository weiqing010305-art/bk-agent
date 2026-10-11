import React from 'react';
import {
  ArrowUpRight, BarChart3, Clock, CreditCard, House,
  MessageCircle, PiggyBank, Plus, RotateCcw, Trash2, X,
} from 'lucide-react';

/**
 * 导航分三层，按「用户带着什么动词进来」分，不按实现分层：
 *
 *   HOME["首页"]     —— 家里的两个面：概览（看）与助手（说）。进入应用就是这里，不是列表里的一项。
 *   PRODUCTS["功能"] —— 具体科目页。它们的名字本身就是内容名，看名字就知道里面是什么。
 *
 * 「收款人」不在这里 —— 作者的产品决策：它与转账流程内嵌的选人重复。
 * 页面与路由都保留（见 views/product.jsx），只是不给导航入口。
 *   HISTORY["会话"]  —— 会话历史，与页面不是同一类东西，所以不放同一段。
 *
 * 为什么首页要独立成块：首页原本是"功能"列表里的第五项，点它就等于"离开当前所在的地方"。
 * 现在它是常驻（sticky）的一块，切换只在块内换高亮，不会让人觉得自己走丢了。
 * 分隔线只画在"这一段与下一段毫无关系"的地方 —— 没有标题文案，结构自己说话。
 */
const HOME = [
  { id: 'overview', label: '概览', icon: House },
  { id: 'assistant', label: '青禾助手', icon: MessageCircle },
];

const PRODUCTS = [
  { id: 'wealth', label: '理财', icon: PiggyBank },
  { id: 'bills', label: '账单', icon: BarChart3 },
  { id: 'subscriptions', label: '订阅', icon: RotateCcw },
  { id: 'cards', label: '卡片', icon: CreditCard },
  { id: 'transfer', label: '转账', icon: ArrowUpRight },
];

export default function Sidebar({ ctx }) {
  const { route, setRoute, mobileNav, closeNav, items, currentId, navigateConversation, removeConversation, createConversation, saveError } = ctx;
  const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const inHome = HOME.some(n => n.id === route);

  const go = id => { setRoute(id); closeNav(); };
  const item = n => <button key={n.id} className={'side-item' + (n.id === 'assistant' ? ' side-item--assistant' : '') + (route === n.id ? ' current' : '')}
    aria-current={route === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
    <n.icon size={17}/><strong>{n.label}</strong>
  </button>;

  return <aside className={`sidebar ${mobileNav ? 'open' : ''}`} aria-label="主导航">
    <div className="sidebar-head">
      <div className="brand">
        <div className="brand-symbol">青</div>
        <div className="brand-text"><strong>青禾银行</strong></div>
      </div>
      <button className="icon-btn sidebar-close" aria-label="关闭导航" onClick={closeNav}><X size={16}/></button>
    </div>

    <nav className={`side-home ${inHome ? 'current' : ''}`} aria-label="首页">
      {HOME.map(item)}
    </nav>

    <nav className="side-section" aria-label="功能">
      {PRODUCTS.map(item)}
    </nav>

    <section className="side-history" aria-label="历史对话">
      <div className="side-history-head">
        <p className="side-label"><Clock size={12} style={{ verticalAlign: '-1px' }}/> 历史对话</p>
        <button className="side-new" onClick={createConversation} aria-label="新对话"><Plus size={14}/></button>
      </div>
      <div className="side-history-list">
        {sorted.map(c => (
          <div className={`side-conv ${c.id === currentId ? 'current' : ''}`} key={c.id}>
            <button onClick={() => navigateConversation(c.id)} title={c.title} aria-current={c.id === currentId ? 'true' : undefined}>{c.title}</button>
            <button className="side-conv-del" aria-label={`删除对话：${c.title}`} onClick={() => removeConversation(c.id)}><Trash2 size={13}/></button>
          </div>
        ))}
      </div>
      {saveError && <p className="side-note" role="alert">浏览器保存失败，刷新可能丢失对话。</p>}
      <p className="side-note">保存在此浏览器，不跨设备同步</p>
    </section>

  </aside>;
}
