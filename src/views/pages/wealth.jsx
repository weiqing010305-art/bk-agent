import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownNarrowWide, ArrowLeft, Banknote, Calendar, CalendarClock, Check, Clock,
  Coins, Hash, Landmark, LineChart, Percent, TrendingUp, Wallet,
} from 'lucide-react';
import { Page, Panel } from '../parts.jsx';
import { Empty } from '../../components/StateBlock.jsx';
import { ledgerVersion } from '../../domain/bank.js';
import { TYPES } from '../../domain/wealth.js';
import { DEMO_DATE } from '../../services/banking.js';
import {
  SEVEN_DAY, check, fundOf, metricText, milestones, orderId, portfolio, rankBoard, sevenDay, yuan,
} from '../../services/wealth.js';
import './wealth.css';

/**
 * 理财 —— D-13 方案 B：收益查询 + 产品货架 + 申购。
 *
 * 这一页照 doc/research/za-design-and-wealth.md 的实证结论搭，不是照"理财 App 该长什么样"搭：
 *
 *  · §B.4.3 收益不是表格，是「可滚动的大数字长图」—— 每页 = 一个大数字 + 一句结论 + 一行脚注 + 一个动作。
 *           ZA 的《基金服務報告》11 页全是这个结构，一张数据表都没有。
 *  · §B.4.2 一个数字有多套算法时**全部列出**。七日年化的四套公式摊在同一个折叠条目里，
 *           结果确实不同（1.888% ~ 1.912%）—— 不挑一套假装唯一。
 *  · §B.6   产品发现靠榜单，不靠搜索。标题写「别人在干什么」，不写「这个产品好不好」；
 *           定义放脚注，排序口径可复算。三条榜单逐一对应官方口径。
 *  · §B.5.1 申购 4 步：榜单 → 详情 → 填金额 → 确认 + 身份认证。末步统一是身份认证，
 *           提交后不可取消。起购 / 截止 / 到账 / 认购费都是详情页的**固定字段**，不在流程里解释。
 *  · §B.2.4 **资金直连活期账户，没有投资钱包** —— 全页没有"充值"，扣款账户就是活期账户。
 *  · §B.7   新手引导是里程碑清单（开户 → 首购 → 留存），不是浮层教学。判据全部由账本推出。
 *  · §A.4   空态 = 「4 字状态 + 一个按钮」；拒绝态 = 「拟人化短标题 + 错误码 + 一个动作」，
 *           从不解释技术原因。
 *
 * ══ 接线（本页 owner 不管 App.jsx，这两处需要接入）══════════════════════════════
 * 1) App.jsx 的 applyConfirmation 增加一条分支（申购落到账本）：
 *      } else if (action.type === 'wealth.purchase') {
 *        try { setBank(prev => purchase(prev, action)); setToast('已申购 ' + action.name + ' ' + yuan(action.amount)); }
 *        catch (err) { setToast(err.message); }
 *      }
 *    （purchase / yuan 从 services/wealth.js 引入；它自带幂等 + 版本戳，与 transfer() 同一套。）
 * 2) 多因子：本页调用 ctx.gate({ op:'wealth.purchase', amount, payload, label, amountText })。
 *    把 useSecurity 的 gateDraft 泛化出一个 gate 并挂到 ctx 即可 —— 认证通过后
 *    AppOverlays 已经会调 transfer.onAuthenticated(payload) → applyConfirmation(payload)，
 *    所以第 2 步接完，第 1 步的分支就是执行口。ctx.gate 缺席时本页退回 applyConfirmation。
 */

const fmt = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '%';
/** 金额也要带符号：一笔亏了 2.6 元的「昨日」不能显示成 +¥2.60。 */
const signed = n => (n < 0 ? '−' : '+') + yuan(Math.abs(n));

/** 一个图标 + 一个值。字段名走 aria-label 不进屏幕 —— 这就是「用 UI 代替文字」在详情页的样子。 */
const Cell = ({ icon: Icon, label, children }) => (
  <div className="w-cell" role="group" aria-label={label}>
    <Icon size={15} aria-hidden="true"/><b>{children}</b>
  </div>);

/** 榜单的行。整行是一个按钮（键盘可达），行内全是数据，所以图表只由标题与脚注说话。 */
const RankRow = ({ fund, rank, metric, pos, onPick }) => (
  <li><button type="button" className="row-item w-row" data-data
    aria-label={fund.name + '，' + rank.def + ' ' + metricText(rank, metric) + '，近 1 年 ' + fmt(fund.ret.y1)}
    onClick={() => onPick(fund.code)}>
    <span className="w-medal" aria-hidden="true">{pos}</span>
    <span className="row-main"><strong>{fund.name}</strong>
      <small>{fund.code} · {TYPES[fund.type].label}</small></span>
    <b className="w-metric">{metricText(rank, metric)}</b>
    <b className={'w-ret' + (fund.ret.y1 < 0 ? ' w-down' : '')}>
      <TrendingUp size={11} aria-hidden="true"/>{fmt(fund.ret.y1)}</b>
  </button></li>);

export default function Wealth({ ctx }) {
  const { bank, applyConfirmation, gate } = ctx;
  const port = useMemo(() => portfolio(bank), [bank]);
  const ranks = useMemo(rankBoard, []);
  const ms = useMemo(() => milestones(bank), [bank]);
  const [code, setCode] = useState(null);
  const [step, setStep] = useState('shelf');     // shelf → fund → amount → confirm
  const [text, setText] = useState('');
  const [openAlgo, setOpenAlgo] = useState(false);
  const [openRows, setOpenRows] = useState(false);
  const composing = useRef(false);               // 中文输入法：回车不当提交（AGENTS.md §3）

  const fund = code ? fundOf(code) : null;
  const cents = Math.round(Number(text.replace(/[^0-9.]/g, '') || 0) * 100);
  const verdict = fund ? check({ fund, amount: cents, available: bank.available }) : null;
  const seven = sevenDay(port.cashFund);
  const oid = fund ? orderId(fund.code, cents) : '';
  const placed = Boolean(fund && (bank.completed || []).includes(oid));
  const account = '活期账户 •• ' + ((bank.cards[0] || {}).tail || '8826');

  const pick = c => { setCode(c); setText(''); setStep('fund'); };
  const shelf = () => { setCode(null); setText(''); setStep('shelf'); };
  const back = () => (step === 'confirm' ? setStep('amount') : step === 'amount' ? setStep('fund') : shelf());

  /* 高风险操作的提交口。策略层判定 + 多因子由 ctx.gate 负责，本页自己不判风险等级。 */
  const submit = () => {
    const payload = { type: 'wealth.purchase', id: oid, code: fund.code, name: fund.name,
      amount: cents, fee: verdict.fee, units: verdict.units, account,
      label: fund.name + ' ' + yuan(cents), amountText: yuan(cents), expect: ledgerVersion(bank) };
    if (gate) gate({ op: 'wealth.purchase', amount: verdict.total, payload, label: payload.label, amountText: payload.amountText });
    else applyConfirmation(payload);
  };

  const head = { title: <span data-data>{fund ? fund.name : '理财'}</span> };
  const leave = { aside: <button className="icon-btn" aria-label="返回" onClick={back}><ArrowLeft size={16}/></button> };

  /* ── 第 2 步：基金详情。门槛 / 截止 / 到账 / 认购费是固定字段，不在流程里解释（§B.5.1）── */
  if (fund && step === 'fund') return <Page {...head} {...leave}>
    <section className="w-hero">
      <div className="w-hero-main">
        <span className="w-eyebrow">1 年</span>
        <strong className="w-big" data-data><TrendingUp size={22} aria-hidden="true"/>{fmt(fund.ret.y1)}</strong>
      </div>
      <div className="w-tags">
        <span>{TYPES[fund.type].label}</span><span>{fund.risk}</span>
        <span><Percent size={12} aria-hidden="true"/>{fund.feePct}%</span>
      </div>
    </section>
    <section className="w-periods" aria-label="过往回报">
      {[['1 月', fund.ret.m1], ['3 月', fund.ret.m3], ['1 年', fund.ret.y1], ['3 年', fund.ret.y3]]
        .map(([k, v]) => <div key={k}><small>{k}</small>
          <b className={v < 0 ? 'w-down' : 'w-up'}>{fmt(v)}</b></div>)}
    </section>
    <Panel>
      <div className="w-fields" data-data>
        <Cell icon={Hash} label="基金代码">{fund.code}</Cell>
        <Cell icon={LineChart} label="单位净值">{fund.nav.toFixed(4)}</Cell>
        {fund.yieldPct !== null && <Cell icon={Banknote} label="年化派息率 Yield (p.a.)">{fund.yieldPct.toFixed(2)}%</Cell>}
        <Cell icon={Coins} label="起购金额">{yuan(fund.min)}</Cell>
        <Cell icon={Clock} label="申购截止时间">{fund.cutoff}</Cell>
        <Cell icon={CalendarClock} label="份额到账">{fund.settle}</Cell>
        <Cell icon={Calendar} label="上架日期">{fund.listed}</Cell>
        <Cell icon={Landmark} label="扣款账户">{account}</Cell>
      </div>
      <button className="a2ui-btn a2ui-btn--primary w-go" onClick={() => setStep('amount')}>申购</button>
    </Panel>
  </Page>;

  /* ── 第 3 步：填金额。起购与余额就地校验，不弹窗 ─────────────────────────────── */
  if (fund && step === 'amount') return <Page {...head} {...leave}>
    <div className="w-entry" data-data>
      <span aria-hidden="true">¥</span>
      <input className="w-input" inputMode="decimal" value={text} aria-label="申购金额" placeholder="0.00"
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onChange={e => setText(e.target.value.replace(/[^0-9.]/g, ''))}
        onKeyDown={e => { if (e.key === 'Enter' && !composing.current && verdict.ok) setStep('confirm'); }}/>
    </div>
    <div className="w-chips" data-data>
      {[100000, 500000, 1000000].map(c => <button key={c} className="chip" aria-pressed={cents === c}
        onClick={() => setText((c / 100).toFixed(2))}>{yuan(c)}</button>)}
    </div>
    {verdict.inline && <p className="w-inline" role="status">{verdict.inline}</p>}
    {!verdict.ok && verdict.title && <div className="w-reject" role="alert">
      <b>{verdict.title}</b><p>{verdict.fix}</p><small>{verdict.code}</small></div>}
    <div className="w-fields" data-data>
      <Cell icon={Coins} label="起购金额">{yuan(fund.min)}</Cell>
      <Cell icon={Clock} label="申购截止时间">{fund.cutoff}</Cell>
      <Cell icon={CalendarClock} label="份额到账">{fund.settle}</Cell>
      <Cell icon={Landmark} label="活期可用">{yuan(bank.available)}</Cell>
      {verdict.ok && <Cell icon={LineChart} label="预计份额">{verdict.units.toFixed(2)}</Cell>}
      {verdict.ok && fund.feePct > 0 && <Cell icon={Percent} label="认购费">{yuan(verdict.fee)}</Cell>}
    </div>
    <button className="a2ui-btn a2ui-btn--primary w-go" disabled={!verdict.ok}
      onClick={() => setStep('confirm')}>下一步</button>
  </Page>;

  /* ── 第 4 步：核对 → 身份认证。ZA 的末步统一是身份认证，且提交后不可取消 ─────────── */
  if (fund && step === 'confirm') return <Page {...head} {...leave}>
    {placed
      ? <section className="w-done">
          <span className="w-done-mark" aria-hidden="true"><Check size={20}/></span>
          <h2>已提交</h2>
          <div className="w-fields" data-data>
            <Cell icon={Coins} label="申购金额">{yuan(cents)}</Cell>
            <Cell icon={LineChart} label="确认份额">{verdict.units.toFixed(2)}</Cell>
            <Cell icon={Landmark} label="扣款账户">{account}</Cell>
            <Cell icon={CalendarClock} label="份额到账">{fund.settle}</Cell>
          </div>
          <button className="link-btn" onClick={shelf}>回理财</button>
        </section>
      : <>
          <div className="w-fields" data-data>
            <Cell icon={Hash} label="基金代码">{fund.code} · {fund.name}</Cell>
            <Cell icon={Coins} label="申购金额">{yuan(cents)}</Cell>
            <Cell icon={LineChart} label="确认份额">{verdict.units.toFixed(2)}</Cell>
            {fund.feePct > 0 && <Cell icon={Percent} label="认购费">{yuan(verdict.fee)}</Cell>}
            <Cell icon={Landmark} label="扣款账户">{account}</Cell>
            <Cell icon={Wallet} label="扣款后活期余额">{yuan(bank.available - verdict.total)}</Cell>
            <Cell icon={Clock} label="申购截止时间">{fund.cutoff}</Cell>
            <Cell icon={CalendarClock} label="份额到账">{fund.settle}</Cell>
          </div>
          <p className="w-lock">提交后不可取消</p>
          <button className="a2ui-btn a2ui-btn--primary w-go" onClick={submit}>确认</button>
        </>}
  </Page>;

  /* ── 第 1 步：理财主页 = 收益长图 + 里程碑 + 榜单 ─────────────────────────────── */
  return <Page title="理财">
    <ol className="w-report" tabIndex={0} aria-label="收益报告，共三页，左右滚动">
      <li className="w-page">
        <span className="w-eyebrow">持仓市值</span>
        <strong className="w-big" data-data>{yuan(port.value)}</strong>
        {/* 一行两段，中间一根细竖线，不写连接词（§C.1）——「赚了多少」和「昨天赚了多少」是两件事 */}
        <p className="w-line">
          {port.profitPct < 0 ? '比成本低' : '比成本高'}
          <b className={port.profitPct < 0 ? 'w-down' : 'w-up'}>{fmt(port.profitPct)}</b>
          <span className="w-sep" aria-hidden="true"/>
          昨日 <b className={port.daily < 0 ? 'w-down' : 'w-up'}>{signed(port.daily)}</b>
        </p>
        <small className="w-foot">按 {DEMO_DATE} 单位净值</small>
        <button className="link-btn" aria-expanded={openRows} onClick={() => setOpenRows(v => !v)}>持仓明细</button>
      </li>
      <li className="w-page">
        <span className="w-eyebrow">七日年化</span>
        <strong className="w-big" data-data>{seven.length ? seven[0].value.toFixed(3) + '%' : '—'}</strong>
        <p className="w-line">算法不同，数不同</p>
        <small className="w-foot">假设性年化，不代表实际一年回报</small>
        <button className="link-btn" aria-expanded={openAlgo} onClick={() => setOpenAlgo(v => !v)}>
          {SEVEN_DAY.length} 种算法</button>
        {openAlgo && <ul className="w-algos" data-data>
          {seven.map(a => <li key={a.id}><b>{a.label}</b><span>{a.value.toFixed(3)}%</span>
            <code>{a.formula}</code></li>)}
        </ul>}
      </li>
      <li className="w-page">
        <span className="w-eyebrow">货币基金</span>
        <div className="w-blocks" data-data>
          <span><b>¥1</b><i>起</i></span><span><b>0</b><i>%</i></span><span><b>T+0</b><i>到账</i></span>
        </div>
        <p className="w-line">随时申赎</p>
        <small className="w-foot">其余 6 只 ¥100 起</small>
        <button className="link-btn" onClick={() => pick('000128')}>看这只</button>
      </li>
    </ol>

    {openRows && (port.rows.length ? <ul className="row-list w-holds" data-data>
      {port.rows.map(h => <li className="row-item" key={h.id}>
        <span className="row-main"><strong>{h.fund.name}</strong>
          <small>{h.units.toLocaleString('zh-CN')} 份 · {h.status === 'pending' ? '待确认' : h.date}</small></span>
        <b className="w-metric">{yuan(h.value)}</b>
        <b className={'w-ret' + (h.profit < 0 ? ' w-down' : '')}>{fmt(h.profitPct)}</b>
      </li>)}
    </ul> : <Empty icon={LineChart} title="还没持仓" action="挑基金"
      onAction={() => { setOpenRows(false); document.getElementById('w-ranks')?.scrollIntoView({ block: 'start' }); }}/>)}

    <section className="w-ms" aria-label="投资里程碑">
      <h2>里程碑</h2>
      <ol>{ms.map(m => <li key={m.id} aria-label={m.hint} data-done={m.done ? 'on' : undefined}>
        <span className="w-ms-mark" aria-hidden="true">{m.done ? <Check size={12}/> : null}</span>
        <b>{m.label}</b></li>)}</ol>
    </section>

    <Panel>
      <section className="w-ranks" id="w-ranks">
        <div className="w-ranks-hint"><TrendingUp size={12} aria-hidden="true"/>近 1 年</div>
        {ranks.map(r => <div className="w-rank" key={r.id}>
          <header className="w-rank-head">
            <h2>{r.title}</h2>
            <span className="w-rank-def"><ArrowDownNarrowWide size={13} aria-hidden="true"/>{r.def}</span>
          </header>
          <ul className="row-list">{r.rows.map(({ fund: f, metric }, i) =>
            <RankRow key={f.code} fund={f} rank={r} metric={metric} pos={i + 1} onPick={pick}/>)}</ul>
        </div>)}
      </section>
    </Panel>
  </Page>;
}
