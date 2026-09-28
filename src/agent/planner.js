/**
 * agent/planner.js —— 两个入口，一个内核
 * ============================================================================
 *
 *        业务层入口 fromText()          产品层入口 fromAction()
 *        自然语言（含语音转文字）        用户直接点选功能
 *                 │                              │
 *                 └──────────► plan() ◄──────────┘
 *                                │
 *                        A2UI 信封（纯 JSON）
 *
 * 关键：**两个入口产出同一种 surface**。产品层不是"另一套界面"，
 * 而是跳过意图理解那一步的同一个渲染管线。
 *
 * 可靠性约定（配合 services/banking.js）：
 *  · 本文件**不产出任何事实数字**，只产出 {path:'/x'} 引用；
 *    真正的值只有 service 能写入 dataModel。所以不可能出现幻觉数字。
 *  · 槽位没抽到就留空，让用户补，**绝不编造**（见 transfer 的 payeeHint）。
 */

import {
  createSurface, Column, Row, Card, Text, Icon, ActionGroup,
  TextField, Select, Meter, CardFace, bind,
} from '../a2ui/protocol.js';
import { buildTransfer } from './transferFlow.js';
import { composeHome, composeSpending, composeSubscriptions, composeOccasion } from './brief.js';

/* ── 业务模块清单（产品层导航与欢迎页共用）────────────────────────────── */
export const ACTIONS = [
  { id: 'transfer', label: '转账', hint: '选方式、选人、填金额、核对', icon: 'transfer', steps: 4 },
  { id: 'bills', label: '账单', hint: '本月收支与每笔明细', icon: 'bills', steps: 1 },
  { id: 'subscriptions', label: '订阅', hint: '自动扣费清单', icon: 'subscriptions', steps: 1 },
  { id: 'cards', label: '卡片', hint: '状态与冻结', icon: 'cards', steps: 1 },
  { id: 'transfer.scheduled', label: '定时转账', hint: '每月自动转，可中断可回退', icon: 'transfer', steps: 5 },
  { id: 'transfer.aa', label: 'AA 收款', hint: '一笔消费拆给多个人', icon: 'transfer', steps: 4 },
  { id: 'occasion', label: '跨场景', hint: '生日、纪念日这类日子', icon: 'sparkles', steps: 4 },
];

/** 常驻入口用的目录：只列"从对话里能直接开"的业务面。 */
export const SURFACES = ACTIONS;
export const WORKFLOW_IDS = ACTIONS.map(a => a.id);

/* ── 意图解析：只产出 action + slots，绝不产出数据 ─────────────────────── */

const RE_AMOUNT = /(\d+(?:\.\d{1,2})?)\s*(?:元|块钱|块|¥)?/;
const RE_PAYEE = /(?:给|转给|转账给)\s*([\u4e00-\u9fa5A-Za-z]{2,10}?)\s*(?:转|打|汇|\d|$)/;

export function parseIntent(raw) {
  const t = String(raw || '').trim();
  if (!t) return { action: 'unknown', slots: {} };
  /* ── 复杂任务：赛题要求「复杂任务需拆解为有序的子任务 DAG」 ──────────────
     这三类刻意排在普通转账之前 —— 它们都是转账的近亲，但需要多步编排。 */
  if (/定时|预约|每月|下个?月|每月一?号|自动转|定期转/.test(t)) {
    const payee = t.match(RE_PAYEE);
    const amount = t.match(/(?:¥|转|打|汇)\s*(\d+(?:\.\d{1,2})?)/);
    return { action: 'transfer.scheduled', slots: { payeeHint: payee ? payee[1] : '', amountText: amount ? amount[1] : '', dateHint: '下个月 1 号' } };
  }
  /* AA 要写成两个大写字母，或者用中文的拆分/分摊，避免误伤普通句子 */
  if (/\bAA\b|拆分|分摊|各付各|平摊|一起分/.test(t)) {
    return { action: 'transfer.aa', slots: { payeeHint: '', amountText: '' } };
  }
  if (/生日|纪念日|结婚纪念|节日|礼物|蛋糕|惊喜/.test(t)) {
    return { action: 'occasion', slots: { occasion: (t.match(/(生日|纪念日|节日|礼物|蛋糕)/) || [])[1] || '特殊日子' } };
  }
  if (/转账|转给|汇款|打钱|转笔|给.{1,12}转|转\s*\d/.test(t)) {
    const amount = t.match(RE_AMOUNT);
    const payee = t.match(RE_PAYEE);
    return {
      action: 'transfer',
      /* 抽到就填，抽不到留空 —— 由用户在卡片里补，不猜 */
      slots: {
        amountText: amount ? amount[1] : '',
        payeeHint: payee ? payee[1] : '',
        note: '',
      },
    };
  }
  if (/订阅|续费|会员|扣费/.test(t)) return { action: 'subscriptions', slots: {} };
  if (/卡片|银行卡|冻结|解冻/.test(t)) return { action: 'cards', slots: {} };
  if (/账单|花了|支出|消费|分析|流水/.test(t)) return { action: 'bills', slots: {} };
  return { action: 'unknown', slots: {} };
}

/* ── 两个入口 ───────────────────────────────────────────────────────────── */

/** 业务层入口：自然语言（含语音转文字结果）→ surface */
export const fromText = (text, ctx) => {
  const { action, slots } = parseIntent(text);
  return plan(action, slots, ctx);
};

/** 产品层入口：用户直接点功能 → 同一个 surface 内核 */
export const fromAction = (actionId, ctx) => plan(actionId, {}, ctx);

/** 共享内核 */
export function plan(action, slots, ctx) {
  const build = BUILDERS[action] || BUILDERS.unknown;
  return build(slots, ctx);
}

const envelope = (ctx, components, dataModel) => [createSurface({
  surfaceId: ctx.surfaceId,
  components,
  dataModel,
  meta: { provenance: ctx.provenance },
})];

/* ── Surface 构建器 ─────────────────────────────────────────────────────── */

const BUILDERS = {};

/**
 * 欢迎面：只做"晨间简报"。
 * **不放业务入口** —— 常驻的 FlowLauncher 已经承担了那件事，
 * 再放一遍就是同一个菜单画两遍（craft-floor 里的重复容器）。
 * 这里回答的是另一个问题：「我的钱现在什么状况」。
 */
/** 首页、账单、订阅三张统合视图都在 agent/brief.js —— 它们要跨域取数，不属任何单一产品页。 */
BUILDERS.welcome = (_slots, ctx) => composeHome(ctx);

BUILDERS.transfer = (slots, ctx) => buildTransfer({
  step: ctx.transferStep || slots.step || 'type',
  draft: { ...(ctx.transferDraft || {}), ...slots },
}, ctx);

BUILDERS.bills = (_slots, ctx) => composeSpending(ctx);


BUILDERS.subscriptions = (_slots, ctx) => composeSubscriptions(ctx);


BUILDERS.cards = (_slots, ctx) => {
  const cards = ctx.dataModel.cards || [];
  return envelope(ctx, [
    Column('root', ['intro', 'card', 'note'], { gap: 'var(--space-4)' }),
    Text('intro', '你的卡片都在这里。冻结后可随时解冻，状态会立即显示在工作台。', 'body'),
    Card('card', 'body'),
    Column('body', ['head', ...cards.map((_, i) => 'c-' + i)], { gap: 'var(--space-4)' }),
    Row('head', ['h-icon', 'h-title'], { align: 'head' }),
    Icon('h-icon', 'cards', 'accent'),
    Column('h-title', ['h-name'], { gap: '0px' }),
    Text('h-name', bind('/headline'), 'headline'),
    /* 直接渲染卡面，而不是「一个图标 + 两行字」—— 助手侧也要看得出这是一张卡。
       色调与卡组织由 cardFace 的 TEMPLATE 兜底，这里只给身份字段。 */
    ...cards.flatMap((c, i) => [
      Row('c-' + i, ['c-n-' + i, 'c-a-' + i], { gap: 'var(--space-4)' }),
      CardFace('c-n-' + i, {
        cardId: c.id,
        name: bind('/cards/' + i + '/name'),
        tail: bind('/cards/' + i + '/tail'),
        frozen: !c.active,
      }),
      ActionGroup('c-a-' + i, [{
        label: '切换状态',
        event: 'card.toggle',
        variant: 'secondary',
        context: { cardId: c.id },
      }]),
    ]),
  ], { ...ctx.dataModel, headline: `共 ${ctx.dataModel.cardCount} 张` });
};

BUILDERS.ledger = (_slots, ctx) => composeSpending(ctx);

BUILDERS.occasion = (slots, ctx) => composeOccasion(ctx, slots);

/**
 * 定时转账与 AA 收款。
 *
 * 这两条**曾经缺失** —— ACTIONS 目录里有它们、FlowLauncher 也渲染了入口，
 * 但 BUILDERS 里没有条目，于是 runAction 落到 BUILDERS.unknown，
 * 把一个「说了做不到」的入口摆在了用户面前（点下去画出来的是另一排业务卡片）。
 *
 * 它们本来就是转账的近亲：共用同一条四步流程，区别只在意图与任务编排。
 * 这里给的是流程入口，`useTurnRunner` 会为它们建 DAG 并带上任务图。
 */
BUILDERS['transfer.scheduled'] = (slots, ctx) => buildTransfer({ ...slots, type: 'scheduled' }, ctx, 'type');
BUILDERS['transfer.aa'] = (slots, ctx) => buildTransfer({ ...slots, type: 'collect' }, ctx, 'type');

BUILDERS.unknown = (_slots, ctx) => envelope(ctx, [
  Column('root', ['say', 'chips'], { gap: 'var(--space-4)' }),
  Text('say', '选一件事，我带你走完：', 'body'),
  Row('chips', ACTIONS.map(a => 'chip-' + a.id), { gap: 'var(--space-3)', wrap: true }),
  ...ACTIONS.flatMap(a => [
    Card('chip-' + a.id, 'chip-row-' + a.id, { action: { event: 'open.' + a.id } }),
    Row('chip-row-' + a.id, ['chip-icon-' + a.id, 'chip-label-' + a.id], { gap: 'var(--space-2)' }),
    Icon('chip-icon-' + a.id, a.icon, 'accent'),
    Text('chip-label-' + a.id, a.label, 'label'),
  ]),
]);
