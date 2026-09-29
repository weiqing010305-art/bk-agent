import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BadgeCheck, Search, SearchX, Star, Tag } from 'lucide-react';
import { Page, Panel, Empty, StatBar } from '../parts.jsx';
import { DEMO_DATE, MAX_TRANSFER } from '../../services/banking.js';
import './payees.css';

/**
 * 收款人。
 *
 * 这一页回答三个问题，别的都不回答：**这是谁、上次给了他多少、现在还能不能再转**。
 * 所以每行第一眼是人（首字母头像 + 名字 + 关系），第二眼是最近一次往来（日期 / 金额 / 笔数），
 * 第三眼才是动作。卡号只在"没有往来"时出现，而且要用来转账时才需要它。
 *
 * 文案口径：行的内容是数据（名字、日期、金额、用途），不是界面文案 ——
 * 页面上的字只负责「这是哪一组」「这个按钮做什么」。
 *   · 关系标签、往来记录、用途都由排版承担：标签在名字右边，金额与日期同一行，
 *     用途前面放一个 Tag 图标就不必写「用途」两个字；
 *   · 两个动作各自一个图标按钮（title + aria-label 兜住可读性），
 *     十行完全一样的文字按钮会把列表读成一堵墙。
 * 时间词只留「今天 / 昨天 / 日期」，不再写「上次」：收支后面跟一个日期，那就是上次。
 *
 * 每个动作都走已有的内核，不新造一套：
 *   再转一笔 → startTransfer({ payeeHint })，转账流程会带着这个人直接落到「转多少」；
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

/** 关系标签。账本里没有这个字段，在这张十行的表里维护，改一处即可。 */
const RELATION = {
  landlord: '房东', zhang: '同事', li: '家人', chen: '同事', lin: '家人',
  zhao: '同事', zhou: '朋友', wu: '朋友', sun: '家人', xu: '朋友',
};
const RELATIONS = ['房东', '家人', '同事', '朋友'];

/** 账本里有一笔的收款人不是人名（房租 → 王佩兰）。这一条让"上次给了他多少"对
    最重要的那个人真的成立；后端补上 recipient_id 之后可以整段删掉。 */
const ALIAS = { landlord: /房租/ };

/**
 * @param onPick 在**转账页内部**选中一个人（带 contactId 直接落到「转多少」）。
 *               不传时才退回 startTransfer —— 独立成页时用那条路。
 *               作者的产品决策：收款人从导航移除，名录嵌进转账页，
 *               「再转一笔」在同一个页面里闭环，不跳回助手。
 */
export default function Payees({ ctx, onPick, embedded }) {
  const { contacts, directory, bank, startTransfer, handleAction } = ctx;
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
      relation: RELATION[p.id] || '收款人',
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

  /* 查号：账本自带的收款人名录。接后端时换成 POST /api/recipients/lookup
     （见 doc/plans/2026-09-27-bank-directory-design.md），本页只改这个函数。 */
  const lookup = () => {
    const n = cardNo.replace(/\s/g, '');
    if (!/^\d{16,19}$/.test(n)) { setFound(null); return setMsg('卡号要 16–19 位'); }
    const hit = directory.find(p => p.number === n) || null;
    setFound(hit);
    return setMsg(hit ? '' : '没有这个卡号');
  };

  const chips = ['全部', '常用', ...RELATIONS].map(id => ({
    id, n: people.filter(p => id === '全部' || (id === '常用' ? p.saved : p.relation === id)).length,
  }));

  const row = p => (
    <li className="payee-item" key={p.id}>
      <span className="payee-avatar" data-tone={tone(p.name)} aria-hidden="true">{p.name.slice(0, 1)}</span>
      {/* 这一列整列都是行数据：名字 / 关系 / 上次往来 / 用途 */}
      <div className="payee-main" data-data>
        <div className="payee-line">
          <strong>{p.name}</strong>
          <span className="payee-tag">{p.relation}</span>
          {p.saved && <span className="payee-tag payee-tag--saved">常用</span>}
        </div>
        <small className="payee-meta">
          {p.last
            ? dayLabel(p.last.date) + ' · ' + fmt(Math.abs(p.last.amount)) + (p.count > 1 ? ' ×' + p.count : '')
            : '•••• ' + String(p.number).slice(-4)}
        </small>
        {p.uses.length > 0 && <small className="payee-uses">
          <Tag size={12} aria-hidden="true"/>{p.uses.join(' · ')}
        </small>}
      </div>
      {/* 十行一模一样的一个图标，比十行一模一样的四个字更像一份清单；
          动作名进 title 与 aria-label，鼠标悬停和读屏都拿得到 */}
      {p.saved
        ? <button className="payee-act" title="再转一笔" aria-label={'给 ' + p.name + ' 再转一笔'}
                  onClick={() => (onPick ? onPick(p.id) : startTransfer({ payeeHint: p.name }))}><ArrowUpRight size={18} aria-hidden="true"/></button>
        : <button className="payee-act" title="设为常用" aria-label={'把 ' + p.name + ' 设为常用收款人'}
                  onClick={() => save(p.id)}><Star size={18} aria-hidden="true"/></button>}
    </li>
  );

  /* embedded：嵌在转账页里时不要 Page 外壳（标题与副标题都是页面级的，嵌进来是重复） */
  const Body = <>
    <StatBar left={{ label: '常用', value: saved + ' 位', note: '还有 ' + (people.length - saved) + ' 位' }}
             right={{ label: '转出合计', value: fmt(monthOut), note: '最多可转 ' + fmt(canSend) }}/>

    <Panel>
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
      {shown.length
        ? <ul className="payee-list">{shown.map(row)}</ul>
        : <Empty icon={SearchX} title="没有结果" action="清空筛选"
                 onAction={() => { setQ(''); setWho('全部'); }}/>}
    </Panel>

    <Panel title="新增">
      <form className="lookup" onSubmit={e => { e.preventDefault(); if (!composing.current) lookup(); }}>
        <input className="a2ui-input" value={cardNo} inputMode="numeric" aria-label="收款人卡号"
               placeholder="卡号，如 9900 0000 0000 2601"
               onChange={e => setCardNo(e.target.value)}
               onCompositionStart={() => { composing.current = true; }}
               onCompositionEnd={() => { composing.current = false; }}/>
        <button className="a2ui-btn a2ui-btn--primary" type="submit">查询</button>
      </form>

      {found && <div className="lookup-result">
        <span className="payee-avatar" data-tone={tone(found.name)} aria-hidden="true">{found.name.slice(0, 1)}</span>
        <div className="lookup-main" data-data>
          <strong>{found.name}</strong>
          <small className="masked-num">{group(found.number)}</small>
          <small>{RELATION[found.id] || '收款人'}</small>
        </div>
        {savedIds.has(found.id)
          ? <span className="lookup-ok"><BadgeCheck size={15} aria-hidden="true"/>已是常用</span>
          : <button className="a2ui-btn a2ui-btn--primary" onClick={() => save(found.id)}>保存</button>}
      </div>}
      {msg && <p className="lookup-msg" role="status">{msg}</p>}
    </Panel>
  </>;

  return embedded
    ? <section className="payees-embedded" aria-label="收款人名录">{Body}</section>
    : <Page title="收款人">{Body}</Page>;
}
