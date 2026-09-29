import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight, BarChart3, CreditCard, LineChart, Receipt, Repeat,
} from 'lucide-react';
import { Page, StatBar, IconTile, CountUp } from '../parts.jsx';
import { EyeIcon } from '../shared.jsx';
import { avatarOf, TxAvatar } from '../avatars.jsx';
import Feed from './feed.jsx';
import './overview.css';

/**
 * 概览：一屏回答三件事 —— 我现在有多少、我能做什么、最近动了什么。
 *
 * 三段：
 *   余额主卡（可用余额 = 唯一的主数字，下面两格是它之外另外两笔钱）
 *   → 宫格（圆形 = 钱在动，方形 = 有具体的对象，沿用 ZA 的双图标语言）
 *   → 动态（见 feed.jsx：即将扣费 + 卡片 + 最近三天）
 *
 * 主卡上不留任何一句解释。科目名的归属靠**位置与分组**表达：
 *   「待扣订阅」的金额正下方就是那五笔签约的头像 —— 谁在扣、扣多少一眼看完，
 *   不需要「按活跃订阅合计」这种句子；「在途」与它并排，两格说的是同一件事：
 *   可用余额之外，钱都去哪了。
 *
 * 余额模型（available / frozen / pending）由 domain/bank.js 定义，本页只读 dataModel。
 * 上一版在本页派生 8% 备用金、再摆出「活期 · 日常账户 / 储蓄 · 备用金」两个科目
 * （还借了两张卡的尾号当账号），domain 已明说那套派生口径作废 —— 整段删除。
 */
const fmt = c => '¥' + (c / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 待扣订阅不是一个抽象数字：把签约的真身摆出来（16px 行内头像，§D.5）。
 * 这一档尺寸上收掉周期徽标：那是一枚 16px 的圆，盖在 16px 的头像上会压住形状，
 * 还越界 5px 撞上下一个头像；而形状本身（圆角方 = 周期）已经说了同一件事。
 */
const RecurMarks = ({ subs }) => (
  <span className="recur-marks">
    {subs.map(s => <TxAvatar key={s.id} mini iconSize={9}
      look={{ ...avatarOf({ name: s.name, category: '订阅' }, subs), badge: null }}/>)}
  </span>
);

/**
 * 宫格。圆形 = 钱在动（动作），方形 = 有具体的对象。
 *
 * 只放**真实存在的落地页**（product.jsx 的七个路由，去掉本页）。上一版另外五格
 * （手机充值 / 生活缴费 / 交通卡 / 外币兑换 / 储蓄计划）点下去只能弹一句
 * "助手没法…、演示环境没有接入…"：那是拿首屏最贵的位置换一句免责声明。
 * 五格全删，剩下的宫格没有一格是假的 —— 7 格 = 2 个动作 + 5 个产品。
 */
const TILES = [
  /* 收款与收款人**不进宫格** —— 作者的产品决策：它们与转账流程内嵌的选人重复。
     页面与路由都还在（见 product.jsx 的注释），只是不给入口。 */
  { label: '转账', icon: ArrowLeftRight, tone: 'accent', route: 'transfer' },
  { label: '账单', icon: BarChart3, tone: 'accent', square: true, route: 'bills' },
  { label: '订阅', icon: Repeat, tone: 'subscribe', square: true, route: 'subscriptions' },
  { label: '卡片', icon: CreditCard, tone: 'warning', square: true, route: 'cards' },
  { label: '回执', icon: Receipt, tone: 'subscribe', square: true, route: 'receipts' },
  { label: '理财', icon: LineChart, tone: 'positive', square: true, route: 'wealth' },
];

export default function Overview({ ctx }) {
  const { bank, dataModel: d, setRoute } = ctx;
  const [hidden, setHidden] = useState(false);
  const activeSubs = useMemo(() => bank.subscriptions.filter(s => s.status === 'active'), [bank.subscriptions]);
  const mask = v => (hidden ? '¥ ••••' : v);

  return <Page title="概览">
    <section className="balance-hero">
      <div className="balance-hero-top">
        <span>可用余额</span>
        <button className="hero-eye" onClick={() => setHidden(v => !v)} aria-pressed={hidden}
                aria-label={hidden ? '显示金额' : '隐藏金额'}><EyeIcon off={hidden}/></button>
      </div>
      {hidden
        ? <strong className="hero-amount">¥ ••••</strong>
        : <CountUp cents={d.balance} format={fmt}/>}
      <StatBar left={{ label: '待扣订阅', value: mask(d.frozenText), note: <RecurMarks subs={activeSubs}/> }}
               right={{ label: '在途', value: mask(d.pendingText) }}/>
    </section>

    <div className="icon-grid">
      {TILES.map(t => <IconTile key={t.label}
        variant={t.square ? 'product' : 'action'} tone={t.tone} icon={t.icon} label={t.label}
        onClick={() => setRoute(t.route)}/>)}
    </div>

    <Feed ctx={ctx}/>
  </Page>;
}
