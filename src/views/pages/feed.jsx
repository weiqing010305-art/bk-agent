import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, CreditCard } from 'lucide-react';
import { Amount, Empty } from '../parts.jsx';
import { avatarOf, TxAvatar } from '../avatars.jsx';
import { DEMO_DATE } from '../../services/banking.js';
import './feed.css';

/**
 * 动态流。三流合一：即将扣费（未来）→ 账户（卡片状态）→ 按日的历史交易。
 *
 * 两条来自真实产品的结论决定了这一版的结构：
 *   ① 每条动账都有形象（Brandfetch 的 transaction enrichment：有品牌就上品牌标，
 *      没有就退化成字标）。形象现在由 avatars.jsx 统一给：形状说「这笔是什么性质」，
 *      颜色说「这是谁」（商户品牌色 > 类别色 > 中性兜底），本文件只负责把它排进行里。
 *   ② 日期分组头用「名单底上的小字 + 右侧日小计」（bank_ui_kit 的
 *      BankTransactionGroupHeader：贴着小字排版、不画灰条、日小计用等宽数字、
 *      零小数位不显示）。所以日期不重复出现在每一行里，行只用来说「这是什么」。
 */

const fmt = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* 分组头与角标是摘要，不是账目：¥300 比 ¥300.00 好读。行内金额仍然保留两位。 */
const tiny = c => fmt(c).replace(/\.00$/, '');

/* 账本的「今天」只从 service 取，不在这里再写一遍。 */
const YESTERDAY = new Date(Date.parse(DEMO_DATE) - 86400000).toISOString().slice(0, 10);
const dayLabel = date => (date === DEMO_DATE ? '今天' : date === YESTERDAY ? '昨天'
  : Number(date.slice(5, 7)) + ' 月 ' + Number(date.slice(8)) + ' 日');
const shortDate = date => date.slice(5).replace('-', '/');

const FILTERS = [['all', '全部'], ['in', '入账'], ['out', '支出'], ['dining', '餐饮'], ['sub', '订阅'], ['card', '卡片']];

function FeedRow({ r, open, onToggle, onGo }) {
  const Dir = r.positive ? ArrowDownLeft : ArrowUpRight;
  return <li className="row-item feed-item">
    <button type="button" className="feed-hit" aria-expanded={open} onClick={onToggle}>
      <TxAvatar look={r.look}/>
      <span className="row-main"><strong>{r.name}</strong><small>{r.sub}</small></span>
      {r.amountText
        ? <span className={'feed-amt' + (r.positive ? ' feed-amt--in' : '')}>
            <Dir size={13} className="feed-dir"/><Amount value={r.amountText} positive={r.positive}/>
          </span>
        : <span className="feed-used"><span className="feed-used-label">本月已用 </span>{r.usedText}</span>}
      <ChevronDown size={14} className={'feed-chev' + (open ? ' on' : '')}/>
    </button>
    {open && <div className="feed-detail">
      <dl className="feed-facts">
        {r.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {r.action && <button className="a2ui-btn a2ui-btn--secondary" onClick={() => onGo(r.action.route)}>
        {r.action.label}
      </button>}
    </div>}
  </li>;
}

/* 分组：卡片与即将扣费各成一组（它们不是"某一天的交易"），其余按日期。 */
function groupOf(list) {
  const out = [];
  const at = new Map();
  for (const r of list) {
    const key = r.kind === 'card' ? 'card' : r.kind === 'sub' ? 'soon' : r.date;
    if (!at.has(key)) { at.set(key, out.length); out.push({ key, list: [] }); }
    out[at.get(key)].list.push(r);
  }
  /* 账本按"录入顺序"存，不是按日期 —— 不排一次的话分组头会读成 10 日、12 日、昨天、23 日。
     排序只按组头的语义：即将扣费在最上，账户次之，日期一律新到旧。 */
  const rank = s => (s.key === 'soon' ? 0 : s.key === 'card' ? 1 : 2);
  return out
    .sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.key.localeCompare(a.key) : 0))
    .map(s => ({ ...s, ...headOf(s.key, s.list) }));
}

function headOf(key, list) {
  if (key === 'soon') return { label: '即将扣费', note: list.length + ' 项代扣签约' };
  if (key === 'card') return { label: '账户', note: '卡片状态' };
  const income = list.filter(r => r.cents > 0).reduce((n, r) => n + r.cents, 0);
  const spend = list.filter(r => r.cents < 0).reduce((n, r) => n + r.cents, 0);
  const parts = [];
  if (income) parts.push('+' + tiny(income));
  if (spend) parts.push('−' + tiny(-spend));
  return { label: dayLabel(key), note: parts.join('  ') };
}

export default function Feed({ ctx }) {
  const { bank, dataModel: d, setRoute } = ctx;
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);

  const streams = useMemo(() => {
    const allSubs = bank.subscriptions;
    const spentByCat = new Map(d.categories.map(c => [c.name, c.amount]));
    const tx = d.transactions.map(t => {
      const note = (bank.transactions.find(x => x.id === t.id) || {}).note;
      const look = avatarOf(t, allSubs);
      const facts = [['日期', t.date], ['分类', look.label],
        ['方向', t.positive ? '入账，钱回到这个账户' : '出账，钱离开这个账户']];
      if (!t.positive && spentByCat.get(t.category)) {
        facts.push(['占本月' + look.label, Math.round(Math.abs(t.amount) / spentByCat.get(t.category) * 100) + '%']);
      }
      if (note) facts.push(['备注', note]);
      return { id: 'tx-' + t.id, kind: 'tx', date: t.date, category: t.category, cents: t.amount,
        name: look.title, positive: t.positive, amountText: t.amountText, look, facts,
        sub: look.label + (look.recurring ? ' · 周期' : '') + ' · ' + (t.positive ? '入账' : '出账'),
        action: { label: '去看这一类明细', route: 'bills' } };
    });
    /* 订阅直接读账本：dataModel 的 subscriptions 只有 amountText，没有分值金额，
       而这一组要算「每月固定」合计与年化。dataModel 本来就是它的投影，口径一致。 */
    const subRows = bank.subscriptions.filter(s => s.status === 'active').sort((a, b) => a.date.localeCompare(b.date))
      .map(s => {
        const look = avatarOf({ name: s.name, category: '订阅', positive: false }, allSubs);
        const days = Math.round((Date.parse(s.date) - Date.parse(DEMO_DATE)) / 86400000);
        return { id: 'sub-' + s.id, kind: 'sub', date: s.date, category: '订阅', cents: -s.amount, name: look.title,
          sub: shortDate(s.date) + ' · 每月固定', amountText: fmt(s.amount), positive: false, look,
          facts: [['下次扣费', s.date + (days >= 0 ? '，还有 ' + days + ' 天' : '')], ['每月', fmt(s.amount)],
            ['一年', fmt(s.amount * 12)], ['取消', '扣费日之前都可以取消，取消后不再扣款']],
          action: { label: '去订阅页管理', route: 'subscriptions' } };
      });
    /* 卡片不是交易，但它和交易共用同一套头像底座：形状说性质、颜色说身份。 */
    const cards = bank.cards.map(c => ({
      id: 'card-' + c.id, kind: 'card', date: null, cents: null, category: null,
      name: c.name + ' •• ' + c.tail, sub: (c.status === 'active' ? '正常使用' : '已冻结') + ' · ' + c.type,
      usedText: fmt(c.used || 0), used: c.used || 0,
      look: { tone: 'subscribe', shape: 'circle', Icon: CreditCard, person: null, brand: null,
        recurring: false, payday: false },
      facts: [['卡号', '•• ' + c.tail], ['类型', c.type], ['额度', fmt(c.limit)], ['本月已用', fmt(c.used || 0)],
        ['可用', fmt(c.limit - (c.used || 0))], ['可用渠道', c.channels.join('、')], ['发卡日', c.since]],
      action: { label: '去卡片页', route: 'cards' },
    }));
    return { all: [...subRows, ...cards, ...tx], in: tx.filter(t => t.positive), out: tx.filter(t => !t.positive),
      dining: tx.filter(t => t.category === '餐饮'), sub: subRows, card: cards };
  }, [d, bank]);

  const list = streams[filter];
  const sections = groupOf(list);
  /* 小计只算已经发生的交易：即将扣费与卡片状态不是钱，混进合计会让"出了多少"失真。 */
  const money = list.filter(r => r.kind === 'tx');
  const earned = money.filter(r => r.cents > 0).reduce((n, r) => n + r.cents, 0);
  const spent = money.filter(r => r.cents < 0).reduce((n, r) => n + r.cents, 0);
  const cats = [...money.reduce((m, r) => m.set(r.look.label, (m.get(r.look.label) || 0) + r.cents), new Map())]
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  const monthly = list.filter(r => r.kind === 'sub').reduce((n, r) => n - r.cents, 0);
  const cells = filter === 'card'
    ? [['卡片', list.length + ' 张'], ['本月已用', fmt(list.reduce((n, r) => n + r.used, 0))]]
    : filter === 'sub'
      ? [['订阅', list.length + ' 项'], ['每月固定', fmt(monthly)], ['下次扣费', list.length ? shortDate(list[0].date) : '暂无']]
      : [['交易', money.length + ' 笔'], ['入账', '+' + fmt(Math.abs(earned))], ['出账', '−' + fmt(Math.abs(spent))],
        ['净额', (earned + spent >= 0 ? '+' : '−') + fmt(Math.abs(earned + spent))]];

  return <section className="panel">
    <div className="panel-head">
      <h2>动态</h2>
      <button className="link-btn" onClick={() => setRoute('bills')}>全部明细</button>
    </div>
    <div className="panel-body">
      <div className="chips-row">
        {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id}
          className={'chip' + (filter === id ? ' on' : '')} onClick={() => { setFilter(id); setOpen(null); }}>
          {label}<span className="chip-n">{streams[id].length}</span>
        </button>)}
      </div>

      <div className="feed-tally">
        {cells.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
      </div>
      {cats.length > 0 && <p className="feed-cats">
        {cats.map(([name, cents]) => <span key={name}>{name}<b>{fmt(Math.abs(cents))}</b></span>)}
      </p>}

      {list.length === 0
        ? <Empty>这一流里暂时没有动账。</Empty>
        : <div className="day-groups">
            {sections.map(s => <section className="day-group" key={s.key}>
              <header className="day-head feed-day"><h3>{s.label}</h3><b>{s.note}</b></header>
              <ul className="row-list">
                {s.list.map(r => <FeedRow key={r.id} r={r} open={open === r.id}
                  onToggle={() => setOpen(open === r.id ? null : r.id)} onGo={setRoute}/>)}
              </ul>
            </section>)}
          </div>}
    </div>
  </section>;
}
