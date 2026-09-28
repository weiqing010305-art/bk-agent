import React, { useMemo, useRef, useState } from 'react';
import { BadgeCheck, Search } from 'lucide-react';
import { Panel, Empty, StatBar } from '../parts.jsx';
import { DEMO_DATE, MAX_TRANSFER } from '../../services/banking.js';
import './payees.css';

/**
 * 转账页内的收款人名录。
 *
 * 这一页回答三个问题，别的都不回答：**这是谁、上次给了他多少、现在还能不能再转**。
 * 所以每行第一眼是人（首字母头像 + 名字 + 关系），第二眼是最近一次往来（日期 / 金额 / 用途），
 * 第三眼才是动作。卡号只在"没有往来"时出现，而且要用来转账时才需要它。
 *
 * 每个动作都走已有的内核，不新造一套：
 *   再转一笔 → 转账页本地流程会带着这个人直接落到「转多少」；
 *   设为常用 → App 已有的 transfer.save-payee 事件（它负责写 contacts 与提示）。
 * 没有往来的名录里的人**不给"转账"按钮**：转账流程只认得常用收款人，
 * 给了按钮也只会在下一步把人丢掉，那才是骗人。
 */
const fmt = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* 账本的"今天"只从 service 取（与概览页同一口径） */
const YESTERDAY = new Date(Date.parse(DEMO_DATE) - 86400000).toISOString().slice(0, 10);
const dayLabel = date => (date === DEMO_DATE ? '今天' : date === YESTERDAY ? '昨天' : date.slice(5));
const group = n => String(n).replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
/* 头像色只表达"这是同一个人"：名字散列到 5 个色号，改一次名字不会让整列跳色 */
const tone = name => [...name].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7) % 5;

/** 关系标签。演示名录里没有这个字段，在这张十行的表里维护，改一处即可。 */
const RELATION = {
  landlord: '房东', zhang: '同事', li: '家人', chen: '同事', lin: '家人',
  zhao: '同事', zhou: '朋友', wu: '朋友', sun: '家人', xu: '朋友',
};
const RELATIONS = ['房东', '家人', '同事', '朋友'];

/** 账本里有一笔的收款人不是人名（房租 → 王佩兰）。这一条让"上次给了他多少"对
    最重要的那个人真的成立；后端补上 recipient_id 之后可以整段删掉。 */
const ALIAS = { landlord: /房租/ };

export default function Payees({ ctx, onPick }) {
  const { contacts, directory, bank, handleAction } = ctx;
  const [q, setQ] = useState('');
  const [who, setWho] = useState('全部');
  const [cardNo, setCardNo] = useState('');
  const [found, setFound] = useState(null);
  const [msg, setMsg] = useState('');
  const composing = useRef(false);

  const savedIds = useMemo(() => new Set(contacts.map(c => c.id)), [contacts]);

  const people = useMemo(() => directory.map(p => {
    const alias = ALIAS[p.id];
    const out = bank.transactions.filter(t => t.amount < 0 &&
      (String(t.name).includes(p.name) || (alias && alias.test(t.name))));
    const last = out[0] || null;
    return {
      ...p,
      relation: RELATION[p.id] || '名录',
      saved: savedIds.has(p.id),
      last,
      count: out.length,
      total: out.reduce((n, t) => n + Math.abs(t.amount), 0),
      /* 用途 = 这一笔的备注；账本里的交易名本身就是用途（房租），所以两种都算 */
      uses: [...new Set(out.map(t => t.note || String(t.name)).filter(v => v && v !== p.name && v !== '转给' + p.name))].slice(0, 2),
    };
  }).sort((a, b) => (b.last ? b.last.date : '').localeCompare(a.last ? a.last.date : '') ||
                     Number(b.saved) - Number(a.saved) || a.name.localeCompare(b.name, 'zh')), [directory, bank.transactions, savedIds]);

  const key = q.trim();
  const digits = key.replace(/\D/g, '');
  const shown = people.filter(p =>
    (who === '全部' || (who === '常用' ? p.saved : p.relation === who)) &&
    (!key || p.name.includes(key) || (digits.length >= 3 && String(p.number).includes(digits))));

  const saved = people.filter(p => p.saved).length;
  const monthOut = bank.transactions.filter(t => t.category === '转账' && t.amount < 0)
    .reduce((n, t) => n + Math.abs(t.amount), 0);
  const canSend = Math.min(bank.balance, MAX_TRANSFER);

  /** 设为常用走 App 已有的事件，写状态与提示都在那边，本页不自己维护联系人列表 */
  const save = id => handleAction('page-payees', { name: 'transfer.save-payee', context: { contactId: id } });

  /* 查号：本地演示名录。接后端时换成 POST /api/recipients/lookup
     （见 doc/plans/2026-09-27-bank-directory-design.md），本页只改这个函数。 */
  const lookup = () => {
    const n = cardNo.replace(/\s/g, '');
    if (!/^\d{16,19}$/.test(n)) { setFound(null); return setMsg('请输入 16–19 位数字的演示卡号'); }
    const hit = directory.find(p => p.number === n) || null;
    setFound(hit);
    return setMsg(hit ? '' : '演示名录里没有这个卡号，换一个再试');
  };

  const chips = ['全部', '常用', ...RELATIONS].map(id => ({
    id, n: people.filter(p => id === '全部' || (id === '常用' ? p.saved : p.relation === id)).length,
  }));

  const row = p => (
    <li className="payee-item" key={p.id}>
      <span className="payee-avatar" data-tone={tone(p.name)} aria-hidden="true">{p.name.slice(0, 1)}</span>
      <div className="payee-main">
        <div className="payee-line">
          <strong>{p.name}</strong>
          <span className="payee-tag">{p.relation}</span>
          {p.saved && <span className="payee-tag payee-tag--saved">常用</span>}
        </div>
        <small className="payee-meta">
          {p.last
            ? '上次 ' + dayLabel(p.last.date) + ' · ' + fmt(Math.abs(p.last.amount)) + (p.count > 1 ? ' · 共 ' + p.count + ' 笔' : '')
            : '还没有往来 · 尾号 ' + String(p.number).slice(-4)}
        </small>
        {p.uses.length > 0 && <small className="payee-uses">用途「{p.uses.join('」「')}」</small>}
      </div>
      {p.saved
        ? <button className="a2ui-btn a2ui-btn--secondary" onClick={() => onPick(p.id)}>再转一笔</button>
        : <button className="a2ui-btn a2ui-btn--secondary" onClick={() => save(p.id)}>设为常用</button>}
    </li>
  );

  return <section className="payees-embedded" aria-label="收款人名录">
    <h2>收款人</h2>
    <p className="page-note">{saved} 位常用 · 演示名录 {people.length} 位</p>
    <StatBar left={{ label: '常用收款人', value: saved + ' 位', note: '名录里还有 ' + (people.length - saved) + ' 位' }}
             right={{ label: '本月转出', value: fmt(monthOut), note: '现在最多能转 ' + fmt(canSend) }}/>

    <Panel title="往来与名录" aside={<span className="panel-hint">{shown.length} / {people.length} 位</span>}>
      <div className="payee-tools">
        <label className="payee-search">
          <Search size={16} aria-hidden="true"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜名字或卡号后四位" aria-label="搜索收款人"/>
        </label>
        <div className="chips-row">
          {chips.map(c => <button key={c.id} className={'chip' + (who === c.id ? ' on' : '')}
            aria-pressed={who === c.id} onClick={() => setWho(c.id)}>{c.id}<span className="chip-n">{c.n}</span></button>)}
        </div>
      </div>
      {shown.length ? <ul className="payee-list">{shown.map(row)}</ul>
                    : <Empty>没有匹配的收款人。换个名字，或只用卡号后四位试试。</Empty>}
    </Panel>

    <Panel title="新增收款人" aside={<span className="panel-hint">按完整卡号查演示名录</span>}>
      <form className="lookup" onSubmit={e => { e.preventDefault(); if (!composing.current) lookup(); }}>
        <input className="a2ui-input" value={cardNo} inputMode="numeric" aria-label="收款人卡号"
               placeholder="16–19 位演示卡号，可含空格"
               onChange={e => setCardNo(e.target.value)}
               onCompositionStart={() => { composing.current = true; }}
               onCompositionEnd={() => { composing.current = false; }}/>
        <button className="a2ui-btn a2ui-btn--primary" type="submit">查询</button>
      </form>

      {found && <div className="lookup-result">
        <span className="payee-avatar" data-tone={tone(found.name)} aria-hidden="true">{found.name.slice(0, 1)}</span>
        <div className="lookup-main">
          <strong>{found.name}</strong>
          <small className="masked-num">{group(found.number)}</small>
          <small>{RELATION[found.id] || '名录'} · 青禾演示名录</small>
        </div>
        {savedIds.has(found.id)
          ? <span className="lookup-ok"><BadgeCheck size={15} aria-hidden="true"/>已是常用</span>
          : <button className="a2ui-btn a2ui-btn--primary" onClick={() => save(found.id)}>保存为常用</button>}
      </div>}
      {msg && <p className="lookup-msg" role="status">{msg}</p>}

      <p className="page-note">
        人物与卡号均为虚构，不要输入真实银行卡号。
        <button className="link-btn" onClick={() => { setCardNo('9900 0000 0000 2601'); setFound(null); setMsg(''); }}>填一个演示卡号</button>
      </p>
    </Panel>
  </section>;
}
