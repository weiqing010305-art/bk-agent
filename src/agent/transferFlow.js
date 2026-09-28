import { composeTransferReview, composeTransferDone } from './brief.js';
import {
  createSurface, Column, Row, Card, Text, Icon, ActionGroup, TextField, Progress, bind,
} from '../a2ui/protocol.js';

/**
 * 转账流程 —— 被产品化的业务面。
 *
 * 设计意图（来自作者反馈）：**不要一进来就问"转多少"**，那是冒犯。
 * 真实银行转账是先问"你想怎么转"，再一路带到核对。
 *
 * 四步：
 *   01 怎么转 → 02 转给谁 → 03 转多少 → 04 核对
 *
 * 每一步都是一个完整的 A2UI surface，所以：
 *   · Agent 识别出"我要转账"后，直接调起第一步，不需要现造 UI
 *   · 产品层「转账」页渲染的是同一个 surface 序列
 */

/** 前四步是流程本身；done 是收尾，由 App 在记账后接上。 */
export const TRANSFER_STEPS = ['type', 'recipient', 'amount', 'review'];
export const ALL_STEPS = [...TRANSFER_STEPS, 'done'];

export const TRANSFER_TYPES = [
  { id: 'person',    label: '转给他人',     hint: '卡号、手机号或常用收款人', icon: 'user' },
  { id: 'self',      label: '本人账户互转', hint: '青禾借记卡 ⇄ 旅行卡',       icon: 'repeat' },
  { id: 'scheduled', label: '预约转账',     hint: '指定日期自动执行',          icon: 'calendar' },
  { id: 'collect',   label: 'AA 收款',      hint: '向多人分摊一笔钱',          icon: 'users' },
];

const TITLE = {
  type: '你想怎么转？',
  recipient: '转给谁？',
  amount: '转多少？',
  review: '核对一下',
};
const HINT = {
  type: '先选一种方式，我带你走完剩下的步骤。',
  recipient: '从常用收款人里挑，或手动输入完整卡号。',
  amount: '输入金额，可以加一句备注。',
  review: '确认无误后再进入验证，这一步不会扣款。',
};

const envelope = (ctx, components, dataModel) => [createSurface({
  surfaceId: ctx.surfaceId, components, dataModel, meta: { provenance: ctx.provenance },
})];

/* 步骤条：四段小横杠，当前段高亮 */
function progress(step) {
  const at = step === 'done' ? TRANSFER_STEPS.length : TRANSFER_STEPS.indexOf(step) + 1;
  return [Progress('prog', { current: at, total: TRANSFER_STEPS.length, label: '转账进度' })];
}

/* 返回上一步：次级按钮，靠左。不用卡片 —— 卡片是"可选项"，返回不是。 */
function backButton(to) {
  return [ActionGroup('back', [
    { label: '上一步', event: 'transfer.back', variant: 'secondary', context: { to } },
  ], { align: 'start' })];
}

function head(step) {
  return [
    Row('head', ['h-icon', 'h-title'], { align: 'head' }),
    Icon('h-icon', 'transfer', 'accent'),
    Column('h-title', ['h-name', 'h-hint'], { gap: '2px' }),
    Text('h-name', TITLE[step], 'headline'),
    Text('h-hint', HINT[step], 'caption'),
  ];
}

/* ── 01 怎么转 ─────────────────────────────────────────────────────────── */
function stepType(draft, ctx) {
  return envelope(ctx, [
    Column('root', ['head', 'prog', 'options', 'note'], { gap: 'var(--space-5)' }),
    ...head('type'),
    ...progress('type'),
    Column('options', TRANSFER_TYPES.map(t => 'opt-' + t.id), { gap: 'var(--space-3)' }),
    ...TRANSFER_TYPES.flatMap(t => [
      Card('opt-' + t.id, 'opt-row-' + t.id, { action: { event: 'transfer.pick-type', context: { type: t.id } } }),
      Row('opt-row-' + t.id, ['opt-icon-' + t.id, 'opt-text-' + t.id], { gap: 'var(--space-4)' }),
      Icon('opt-icon-' + t.id, t.icon, 'accent'),
      Column('opt-text-' + t.id, ['opt-label-' + t.id, 'opt-hint-' + t.id], { gap: '0px' }),
      Text('opt-label-' + t.id, t.label, 'body'),
      Text('opt-hint-' + t.id, t.hint, 'caption'),
    ]),
      ], { ...ctx.dataModel, step: 'type', ...draft });
}

/* ── 02 转给谁 ─────────────────────────────────────────────────────────── */
function stepRecipient(draft, ctx) {
  const recents = (ctx.contacts || []).slice(0, 4);
  return envelope(ctx, [
    Column('root', ['back', 'head', 'prog', 'recents', 'manual', 'actions'], { gap: 'var(--space-5)' }),
    ...backButton('type'),
    ...head('recipient'),
    ...progress('recipient'),
    Column('recents', recents.map(c => 'rc-' + c.id), { gap: 'var(--space-3)' }),
    ...recents.flatMap(c => [
      Card('rc-' + c.id, 'rc-row-' + c.id, { action: { event: 'transfer.pick-recipient', context: { contactId: c.id } } }),
      Row('rc-row-' + c.id, ['rc-icon-' + c.id, 'rc-text-' + c.id], { gap: 'var(--space-4)' }),
      Icon('rc-icon-' + c.id, 'user', 'accent'),
      Column('rc-text-' + c.id, ['rc-name-' + c.id, 'rc-num-' + c.id], { gap: '0px' }),
      Text('rc-name-' + c.id, c.name, 'body'),
      Text('rc-num-' + c.id, c.number, 'caption'),
    ]),
    TextField('manual', {
      label: '或手动输入完整卡号', value: bind('/manualCardNumber'),
      placeholder: '16–19 位卡号', inputMode: 'numeric', maxLength: 32, testId: 'manual-card',
    }),
    ActionGroup('actions', [{ label: '下一步', event: 'transfer.next', variant: 'primary' }]),
  ], { ...ctx.dataModel, step: 'recipient', manualCardNumber: draft.manualCardNumber || '', ...draft });
}

/* ── 03 转多少 ─────────────────────────────────────────────────────────── */
const QUICK = ['50', '100', '200', '500'];

function stepAmount(draft, ctx) {
  return envelope(ctx, [
    Column('root', ['back', 'head', 'prog', 'amount', 'quick', 'note-field', 'balance', 'actions'], { gap: 'var(--space-5)' }),
    ...backButton('recipient'),
    ...head('amount'),
    ...progress('amount'),
    TextField('amount', { label: '转账金额', value: bind('/amountText'), placeholder: '0.00', inputMode: 'decimal', testId: 'amount' }),
    Row('quick', QUICK.map(q => 'q-' + q), { gap: 'var(--space-3)', wrap: true }),
    ...QUICK.flatMap(q => [
      Card('q-' + q, 'q-text-' + q, { action: { event: 'transfer.quick', context: { value: q } } }),
      Text('q-text-' + q, '¥' + q, 'label'),
    ]),
    TextField('note-field', { label: '备注（选填）', value: bind('/note'), placeholder: '例如：周末聚餐', maxLength: 30 }),
    Text('balance', bind('/balanceHint'), 'caption'),
    ActionGroup('actions', [{ label: '核对信息', event: 'transfer.next', variant: 'primary' }]),
  ], { ...ctx.dataModel, step: 'amount', amountText: draft.amountText || '', note: draft.note || '', ...draft });
}

/* ── 04 核对 / 05 回执 ──────────────────────────────────────────────────
   这两步交给 agent/brief.js 的统合视图：核对页要同时给出「转后余额」「本月支出变化」
   「扣完订阅还剩多少」，回执页要同时给出更新后的账户状态。跨域取数不属本文件。 */
const stepReview = (draft, ctx) => composeTransferReview(draft, ctx);
const stepDone = (draft, ctx) => composeTransferDone(draft, ctx);
const STEPS = { type: stepType, recipient: stepRecipient, amount: stepAmount, review: stepReview, done: stepDone };

export function buildTransfer({ step = 'type', draft = {} } = {}, ctx) {
  return (STEPS[step] || STEPS.type)(draft, ctx);
}
