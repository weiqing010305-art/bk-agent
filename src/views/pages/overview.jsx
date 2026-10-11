import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { SERVICE_TILES as TILES } from '../serviceCatalog.js';
import { Page, StatBar, IconTile, CountUp } from '../parts.jsx';
import { EyeIcon } from '../shared.jsx';
import { avatarOf, TxAvatar } from '../avatars.jsx';
import Feed from './feed.jsx';
import './overview.css';

/**
 * 概览：一屏回答三件事 —— 我现在有多少、接下来会发生什么、最近动了什么。
 *
 * 三段：
 *   余额主卡（可用 / 冻结 / 活期储蓄拆分 / 本月结余）
 *   → 快捷操作宫格（圆形 = 钱在动，方形 = 对象，沿用 ZA 的双图标语言）
 *   → 动态（交易 / 即将扣费 / 卡片 三流合一，见 feed.jsx）
 */
const fmt = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 账户画像：**四个数字全部在本页派生**，domain/bank.js 一个字段都没加
 * （它只提供 balance 这一个真相）。规则写在下面，任何一个都能自己复算：
 *
 *   冻结金额   = 活跃订阅合计（代扣签约在扣款日前的预授权）
 *   活期账户   = 可用余额 + 冻结金额
 *   储蓄计划   = 各计划实际留存金额合计，不与可用余额重复计算
 *   待入账     = 0（演示账本没有在途资金，那就给 0，不编一个数字）
 *
 * 主卡脚注标了「派生」，页面上不会被当成账本字段。
 */
function account(bank) {
  const frozen = bank.subscriptions.filter(s => s.status === 'active').reduce((n, s) => n + s.amount, 0);
  const current = bank.balance + frozen;
  const saving = Object.values(bank.savings || {}).reduce((n, amount) => n + amount, 0);
  return { available: bank.balance, frozen, current, saving };
}

/** 代扣预授权不是一个抽象数字：把三笔签约的真身摆出来（16px 行内头像，§D.5）。 */
const RecurMarks = ({ subs }) => (
  <span className="recur-marks">
    {subs.map(s => <TxAvatar key={s.id} mini iconSize={9}
      look={avatarOf({ name: s.name, category: '订阅' }, subs)}/>)}
  </span>
);

/**
 * 宫格。圆形 = 钱在动（动作），方形 = 有具体的对象。
 * 带 demo 的格子是**诚实的占位**：没有页面就说没有，不做假页面、不做假数据。
 * 文案按 §C-40 写成主动语态 + 明确主语：这是"助手没做"，不是"没做成"。
 */


export default function Overview({ ctx }) {
  const { bank, setRoute } = ctx;
  const [hidden, setHidden] = useState(false);
  const [notice, setNotice] = useState('');
  /* 演示占位要有诚实的出口：App 的 ctx 给了 setToast 就用它，没给就退化成页面内说明条 */
  const notify = ctx.setToast || setNotice;

  const acct = useMemo(() => account(bank), [bank]);
  const activeSubs = useMemo(() => bank.subscriptions.filter(s => s.status === 'active'), [bank.subscriptions]);
  const net = useMemo(() => {
    const income = bank.transactions.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const spent = -bank.transactions.filter(t => t.amount < 0).reduce((a, t) => a + t.amount, 0);
    return income - spent;
  }, [bank.transactions]);

  const mask = v => (hidden ? '¥ ••••' : v);

  return <Page title="概览" subtitle="账户、快捷操作与最近动态">
    <section className="balance-hero">
      <div className="balance-hero-top">
        <span>可用余额</span>
        <button className="hero-eye" onClick={() => setHidden(v => !v)} aria-pressed={hidden}
                aria-label={hidden ? '显示金额' : '隐藏金额'}><EyeIcon off={hidden}/></button>
      </div>
      {hidden
        ? <strong className="hero-amount">¥ ••••</strong>
        : <CountUp cents={acct.available} format={fmt}/>}
      {/* 科目名写在 label 上，note 只说这个数是怎么来的 —— 两行不重复同一件事。
          原来的 note（「活期账户合计」「代扣预授权」）与 label（「账户余额」「冻结中」）
          是两个说法指同一笔钱，而且和下面 .acct-split 的两行又说了第三遍。 */}
      <StatBar left={{ label: '活期账户合计', value: mask(fmt(acct.current)), note: '日常 8826 与备用金 3901 相加' }}
               right={{ label: '代扣预授权', value: mask(fmt(acct.frozen)),
                        note: <>按活跃订阅合计 <RecurMarks subs={activeSubs}/></> }}/>
      <ul className="acct-split">
        <li>
          <span className="acct-name">活期 · 日常账户 <b className="masked-num">•• 8826</b></span>
          <b className="acct-amt">{mask(fmt(acct.current))}</b>
        </li>
        <li>
          <span className="acct-name">储蓄 · 计划留存</span>
          <b className="acct-amt">{mask(fmt(acct.saving))}</b>
        </li>
      </ul>
      <div className="balance-hero-foot">
        <span>本月结余 {mask((net >= 0 ? '+' : '−') + fmt(Math.abs(net)))}</span>
        <span>待入账 {mask('¥0.00')} · 待扣 {mask(fmt(acct.frozen))}</span>
      </div>
      <div className="balance-hero-actions">
        <button className="a2ui-btn a2ui-btn--primary" onClick={() => setRoute('transfer')}>转账</button>
      </div>
    </section>

    <div className="icon-grid">
      {TILES.map(t => <IconTile key={t.label}
        variant={t.square ? 'product' : 'action'} tone={t.tone} icon={t.icon} label={t.label}
        onClick={() => (t.route ? setRoute(t.route) : notify(t.demo))}/>)}
    </div>

    {notice && <p className="demo-strip" role="status"><Info size={14} aria-hidden="true"/>{notice}</p>}

    <Feed ctx={ctx}/>

    <p className="page-note">活期储蓄拆分与冻结金额由本页按演示账本派生，不是账本字段。</p>
  </Page>;
}
