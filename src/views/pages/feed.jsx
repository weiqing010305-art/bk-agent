import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, CreditCard, Inbox, ShieldCheck } from 'lucide-react';
import { Amount, Empty } from '../parts.jsx';
import { avatarOf, TxAvatar } from '../avatars.jsx';
import { DEMO_DATE } from '../../services/banking.js';
import './feed.css';

/**
 * 动态流。三流合一：即将扣费（未来）→ 卡片（状态）→ 按日的历史交易。
 *
 * 两条来自真实产品的结论决定了这一版的结构：
 *   ① 每条动账都有形象（Brandfetch 的 transaction enrichment：有品牌就上品牌标，
 *      没有就退化成字标）。形象现在由 avatars.jsx 统一给：形状说「这笔是什么性质」，
 *      颜色说「这是谁」（商户品牌色 > 类别色 > 中性兜底），本文件只负责把它排进行里。
 *   ② 日期分组头用「名单底上的小字 + 右侧日小计」（bank_ui_kit 的
 *      BankTransactionGroupHeader：贴着小字排版、不画灰条、日小计用等宽数字、
 *      零小数位不显示）。所以日期不重复出现在每一行里，行只用来说「这是什么」。
 *
 * 本轮改的是**这一屏该承担多少**，四处全是删：
 *   ① 概览不是账本。这里只铺「即将扣费 + 卡片 + 最近三个有动账的日子」，
 *      全量明细在账单页（那一页有六种图形与分类筛选，筛选入口贴在数据旁边）。
 *   ② 于是筛选胶囊整排删除：那些计数（全部 148 / 支出 137 / 餐饮 58）与下面的日小计、
 *      账单页的结论说的是同一批数字，多出来的只是一排要读的字。
 *   ③ 合计条与分类条同样删除：两者都是"整个账本的报表"，账单页的结论 StatBar 与
 *      图形已经把这件事说得更好；动态只回答"最近动了什么"。
 *   ④ 展开里的「方向」一条删除：行首的箭头与金额的正负号已经说了同一件事。
 *
 * 于是这一屏的文字只剩：面板名 + 三个分组名。其余全是头像、金额与日期。
 */

const fmt = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* 分组头与角标是摘要，不是账目：¥300 比 ¥300.00 好读。行内金额仍然保留两位。 */
const tiny = c => fmt(c).replace(/\.00$/, '');

/* 账本的「今天」只从 service 取，不在这里再写一遍。 */
const YESTERDAY = new Date(Date.parse(DEMO_DATE) - 86400000).toISOString().slice(0, 10);
const dayLabel = date => (date === DEMO_DATE ? '今天' : date === YESTERDAY ? '昨天'
  : Number(date.slice(5, 7)) + ' 月 ' + Number(date.slice(8)) + ' 日');
const shortDate = date => date.slice(5).replace('-', '/');

/** 概览只看最近这几天有动账的日子：再往前的交给账单页。 */
const RECENT_DAYS = 3;

function FeedRow({ r, open, onToggle, onGo, hidden }) {
  const Dir = r.positive ? ArrowDownLeft : ArrowUpRight;
  return <li className="row-item feed-item">
    <button type="button" className="feed-hit" aria-expanded={open} onClick={onToggle}>
      <TxAvatar look={r.look}/>
      <span className="row-main"><strong>{r.name}</strong><small>{r.sub}</small></span>
      {r.amountText
        ? <span className={'feed-amt' + (r.positive ? ' feed-amt--in' : '')}>
            <Dir size={13} className="feed-dir"/><Amount value={hidden ? '¥ ••••' : r.amountText} positive={r.positive}/>
          </span>
        : <span className="feed-used"><span className="feed-used-label">本月已用 </span>{hidden ? '¥ ••••' : r.usedText}</span>}
      <ChevronDown size={14} className={'feed-chev' + (open ? ' on' : '')}/>
    </button>
    {open && <div className="feed-detail">
      <dl className="feed-facts">
        {r.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{hidden && /[¥￥]/.test(String(v)) ? '¥ ••••' : v}</dd></div>)}
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
     排序只按组头的语义：即将扣费在最上，卡片次之，日期一律新到旧。 */
  const rank = s => (s.key === 'soon' ? 0 : s.key === 'card' ? 1 : 2);
  const sorted = out.sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.key.localeCompare(a.key) : 0));
  /* 未来与卡片两组永远在（它们不属于任何一天），日期组只留最近 RECENT_DAYS 天。 */
  return [...sorted.filter(s => rank(s) < 2), ...sorted.filter(s => rank(s) === 2).slice(0, RECENT_DAYS)]
    .map(s => ({ ...s, ...headOf(s.key, s.list) }));
}

/* 分组头只说两件事：这一组是什么、这一组多少钱。计数不写 —— 行就在下面，
   数一遍比读一个数字快，而那个数字还要随筛选变。 */
function headOf(key, list) {
  if (key === 'soon') return { label: '即将扣费', note: '−' + tiny(-list.reduce((n, r) => n + r.cents, 0)) };
  if (key === 'card') return { label: '卡片', note: tiny(list.reduce((n, r) => n + r.used, 0)) };
  const income = list.filter(r => r.cents > 0).reduce((n, r) => n + r.cents, 0);
  const spend = list.filter(r => r.cents < 0).reduce((n, r) => n + r.cents, 0);
  const parts = [];
  if (income) parts.push('+' + tiny(income));
  if (spend) parts.push('−' + tiny(-spend));
  return { label: dayLabel(key), note: parts.join('  ') };
}

export default function Feed({ ctx, hidden = false }) {
  const { bank, dataModel: d, setRoute } = ctx;
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => {
    const allSubs = bank.subscriptions;
    const spentByCat = new Map(d.categories.map(c => [c.name, c.amount]));
    const tx = d.transactions.map(t => {
      const note = (bank.transactions.find(x => x.id === t.id) || {}).note;
      const look = avatarOf(t, allSubs);
      const facts = [['日期', t.date], ['分类', look.label]];
      if (!t.positive && spentByCat.get(t.category)) {
        facts.push(['占本月' + look.label, Math.round(Math.abs(t.amount) / spentByCat.get(t.category) * 100) + '%']);
      }
      if (note) facts.push(['备注', note]);
      return { id: 'tx-' + t.id, kind: 'tx', date: t.date, cents: t.amount,
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
        return { id: 'sub-' + s.id, kind: 'sub', date: s.date, cents: -s.amount, name: look.title,
          sub: shortDate(s.date) + ' · 每月固定', amountText: fmt(s.amount), positive: false, look,
          facts: [['下次扣费', s.date + (days >= 0 ? '，还有 ' + days + ' 天' : '')], ['每月', fmt(s.amount)],
            ['一年', fmt(s.amount * 12)], ['取消', '扣费日之前都可以取消，取消后不再扣款']],
          action: { label: '去订阅页管理', route: 'subscriptions' } };
      });
    /* 卡片不是交易，但它和交易共用同一套头像底座：形状说性质、颜色说身份。 */
    const cards = bank.cards.map(c => ({
      id: 'card-' + c.id, kind: 'card', date: null, cents: null,
      name: c.name + ' •• ' + c.tail, sub: (c.status === 'active' ? '正常使用' : '已冻结') + ' · ' + c.type,
      usedText: fmt(c.used || 0), used: c.used || 0,
      look: { tone: 'subscribe', shape: 'circle', Icon: CreditCard, person: null, brand: null,
        recurring: false, payday: false, badge: null,
        seal: c.status === 'active' ? <ShieldCheck size={10}/> : '冻' },
      facts: [['卡号', '•• ' + c.tail], ['类型', c.type], ['额度', fmt(c.limit)], ['本月已用', fmt(c.used || 0)],
        ['可用', fmt(c.limit - (c.used || 0))], ['可用渠道', c.channels.join('、')], ['发卡日', c.since]],
      action: { label: '去卡片页', route: 'cards' },
    }));
    return [...subRows, ...cards, ...tx];
  }, [d, bank]);

  const sections = groupOf(rows);

  return <section className="panel">
    <div className="panel-head">
      <h2>动态</h2>
      {/* 「全部明细」四个字换成一个箭头：去处是账单页，那里才是明细该待的地方 */}
      <button className="link-btn feed-more" onClick={() => setRoute('bills')} aria-label="全部明细">
        <ChevronRight size={16}/>
      </button>
    </div>
    <div className="panel-body">
      {rows.length === 0
        ? <Empty icon={Inbox} title="暂无动态"/>
        : <div className="day-groups">
            {sections.map(s => <section className="day-group" data-kind={s.key} key={s.key}>
              <header className="day-head feed-day"><h3>{s.label}</h3><b>{hidden && s.note ? '¥ ••••' : s.note}</b></header>
              <ul className="row-list">
                {s.list.map(r => <FeedRow key={r.id} r={r} open={open === r.id} hidden={hidden}
                  onToggle={() => setOpen(open === r.id ? null : r.id)} onGo={setRoute}/>)}
              </ul>
            </section>)}
          </div>}
    </div>
  </section>;
}
