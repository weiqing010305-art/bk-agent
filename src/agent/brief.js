import {
  createSurface, Column, Row, Card, Text, Icon, ActionGroup, Divider, Figure, Meter, Progress, bind,
} from '../a2ui/protocol.js';
import { transferImpact, monthReview, pendingItems, DEMO_DATE } from '../services/banking.js';

/**
 * Agent 统合视图（composed brief）。
 *
 * 这是「AI Native 银行」与「软件时代银行」的分界线：
 *
 *   软件时代：信息按「产品」切开 —— 余额在账户页，账单在账单页，订阅在订阅页。
 *             用户办一件事要跨三个页面，自己把信息拼起来。
 *   Agent 时代：按「用户此刻要办的事」把跨产品的信息合起来，一次呈现。
 *
 * 所以这里的每个 compose* 函数都刻意**跨域取数**。比如转账核对页不只给收款人和金额，
 * 还会给出「转完还剩多少」「本月支出变成多少」「扣掉订阅后还剩多少安全垫」——
 * 这三件事分散在三个产品页里，用户原本要自己算。
 *
 * 组件层面恪守 craft-floor：**不用嵌套卡片**，分组靠 Divider，数字用 Figure。
 */

const envelope = (ctx, components, dataModel, extra = []) => [createSurface({
  surfaceId: ctx.surfaceId, components, dataModel, meta: { provenance: ctx.provenance },
})];

const head = (icon, title, sub, tone = 'accent') => [
  Row('head', ['h-icon', 'h-text'], { align: 'head' }),
  Icon('h-icon', icon, tone),
  Column('h-text', ['h-title', 'h-sub'], { gap: '2px' }),
  Text('h-title', title, 'headline'),
  Text('h-sub', sub, 'caption'),
];

/* ── 首页：一张状态板，不是三个入口 ───────────────────────────────────── */

export function composeHome(ctx) {
  const d = ctx.dataModel;
  const r = monthReview(ctx.bank);
  const pending = pendingItems(ctx.bank);
  const recent = d.transactions.slice(0, 3);
  const pendIds = pending.map((_, i) => 'p-' + i);
  const txIds = recent.map((_, i) => 't-' + i);

  return envelope(ctx, [
    Column('root', [
      'head', 'figs', 'd1',
      ...(pending.length ? ['p-title', ...pendIds] : []),
      'd2', 'tx-title', ...txIds, 'actions',
    ], { gap: 'var(--space-4)' }),
    ...head('sparkles', '你好，小禾', bind('/homeSub')),

    /* 三个数字一次给全：余额、本月花销、待扣订阅 */
    Row('figs', ['f-bal', 'f-spend', 'f-sub'], { gap: 'var(--space-6)', wrap: true }),
    Figure('f-bal', { label: '可用余额', value: bind('/balanceText'), note: '青禾日常账户' }),
    Figure('f-spend', { label: '本月支出', value: bind('/spendingText'), note: bind('/netNote'), tone: 'muted' }),
    Figure('f-sub', { label: '待扣订阅', value: bind('/subTotalText'), note: bind('/subNote'), tone: 'muted' }),

    Divider('d1'),

    ...(pending.length ? [
      Text('p-title', '需要你留意的', 'label'),
      ...pending.flatMap((p, i) => [
        Row('p-' + i, ['p-i-' + i, 'p-t-' + i], { align: 'between' }),
        Column('p-t-' + i, ['p-k-' + i, 'p-v-' + i], { gap: '0px' }),
        Text('p-k-' + i, bind('/pending/' + i + '/title'), 'body'),
        Text('p-v-' + i, bind('/pending/' + i + '/detail'), 'caption'),
        ActionGroup('p-i-' + i, [{ label: '去看看', event: p.action, variant: 'secondary' }]),
      ]),
      Divider('d2'),
    ] : [Divider('d2')]),

    Text('tx-title', '最近三笔', 'label'),
    ...recent.flatMap((t, i) => [
      Row('t-' + i, ['t-n-' + i, 't-a-' + i], { align: 'between' }),
      Column('t-n-' + i, ['t-name-' + i, 't-meta-' + i], { gap: '0px' }),
      Text('t-name-' + i, bind('/transactions/' + i + '/name'), 'body'),
      Text('t-meta-' + i, bind('/transactions/' + i + '/date'), 'caption'),
      Text('t-a-' + i, bind('/transactions/' + i + '/amountText'), 'amount'),
    ]),

    ActionGroup('actions', [
      { label: '看完整账单', event: 'open.bills', variant: 'secondary' },
      { label: '转账', event: 'open.transfer', variant: 'primary' },
    ]),
  ], { ...d, pending, homeSub: '这是你现在的全部状况，不需要再点进任何页面', subTotalText: r.subTotalText, subCount: r.subCount, subSharePct: r.subSharePct, netText: r.netText, netNote: r.netNote, subNote: r.subNote });
}

/* ── 账单：不只列流水，还给出"这个月发生了什么" ───────────────────────── */

export function composeSpending(ctx) {
  const d = ctx.dataModel;
  const r = monthReview(ctx.bank);
  const cats = d.categories || [];
  return envelope(ctx, [
    Column('root', ['head', 'figs', 'd1', 'cat-title', ...cats.map((_, i) => 'c-' + i), 'd2', 'read', 'actions'], { gap: 'var(--space-4)' }),
    ...head('bills', '本月账单', bind('/ledgerSummary')),

    Row('figs', ['f-out', 'f-in', 'f-net'], { gap: 'var(--space-6)', wrap: true }),
    Figure('f-out', { label: '支出', value: bind('/spendingText'), tone: 'muted' }),
    Figure('f-in', { label: '收入', value: bind('/incomeText'), tone: 'muted' }),
    Figure('f-net', { label: '结余', value: bind('/netText'), note: bind('/netNote'), tone: 'positive' }),

    Divider('d1'),
    Text('cat-title', '钱花在哪了', 'label'),
    ...cats.map((_, i) => Meter('c-' + i, {
      label: cats[i].name,
      percent: bind('/categories/' + i + '/percent'),
      value: bind('/categories/' + i + '/amountText'),
    })),

    Divider('d2'),
    /* 跨域小结：把"订阅"这个另一个产品页的事，拉进账单的结论里 */
    Column('read', ['rd-k', 'rd-v'], { gap: '2px' }),
    Text('rd-k', '这笔账里最值得看的两件事', 'label'),
    Text('rd-v', bind('/readText'), 'body'),

    ActionGroup('actions', [
      { label: '看订阅明细', event: 'open.subscriptions', variant: 'secondary' },
      { label: '看全部流水', event: 'open.ledger', variant: 'secondary' },
    ]),
  ], { ...d, netText: r.netText, netNote: r.netNote, readText: r.readText,
       ledgerSummary: '九月一号到今天，共 ' + d.transactions.length + ' 笔' });
}

/* ── 订阅：清单 + 它吃掉多少支出 ──────────────────────────────────────── */

export function composeSubscriptions(ctx) {
  const d = ctx.dataModel;
  const r = monthReview(ctx.bank);
  const subs = d.subscriptions || [];
  const live = subs.filter(s => s.active);
  return envelope(ctx, [
    Column('root', ['head', 'figs', 'd1', 'list-title', ...subs.map((_, i) => 's-' + i), 'actions'], { gap: 'var(--space-4)' }),
    ...head('subscriptions', live.length + ' 项正在续费', '每月固定支出，取消前先看看它占多少'),

    Row('figs', ['f-total', 'f-share', 'f-next'], { gap: 'var(--space-6)', wrap: true }),
    Figure('f-total', { label: '每月合计', value: bind('/monthlySubTotalText'), tone: 'muted' }),
    Figure('f-share', { label: '占本月支出', value: bind('/subShareText'), tone: 'muted' }),
    Figure('f-next', { label: '下次扣费', value: bind('/nextSubDate'), note: bind('/nextSubName'), tone: 'muted' }),

    Divider('d1'),
    Text('list-title', '全部项目', 'label'),
    ...subs.flatMap((s, i) => [
      Row('s-' + i, ['s-n-' + i, 's-a-' + i], { align: 'between' }),
      Column('s-n-' + i, ['s-name-' + i, 's-meta-' + i], { gap: '0px' }),
      Text('s-name-' + i, bind('/subscriptions/' + i + '/name'), 'body'),
      Text('s-meta-' + i, bind('/subscriptions/' + i + '/statusText'), 'caption'),
      Text('s-a-' + i, bind('/subscriptions/' + i + '/amountText'), 'amount'),
    ]),

    ActionGroup('actions', [
      { label: '和账单对照', event: 'open.bills', variant: 'secondary' },
    ]),
  ], { ...d, nextSubDate: d.nextSubDate || '-', subShareText: r.subSharePct + '%' });
}

/* ── 跨场景联动：赛题点名的差异化能力 ───────────────────────────────────
   例：用户说「我爱人生日」，Agent 不该只回一句祝福 —— 它应该把
   「这个月还剩多少可支配」「能做什么」「选一个」串起来。
   这就是「让 Agent 扮演个人资产管家」与「聊天机器人」的区别。 */

export function composeOccasion(ctx, slots = {}) {
  const d = ctx.dataModel;
  const r = monthReview(ctx.bank);
  const occasion = slots.occasion || '特殊日子';
  return envelope(ctx, [
    Column('root', ['head', 'figs', 'd1', 'tips-title', 't1', 't2', 't3', 'actions'], { gap: 'var(--space-4)' }),
    ...head('sparkles', '要做点什么吗', '你提到了「' + occasion + '」，我先看了看这个月的情况'),
    Row('figs', ['f-free', 'f-spend', 'f-next'], { gap: 'var(--space-6)', wrap: true }),
    Figure('f-free', { label: '可支配', value: bind('/balanceText'), tone: 'muted' }),
    Figure('f-spend', { label: '本月已花', value: bind('/spendingText'), tone: 'muted' }),
    Figure('f-next', { label: '待扣订阅', value: bind('/subTotalText'), tone: 'muted' }),
    Divider('d1'),
    Text('tips-title', '可以这样安排', 'label'),
    Card('t1', 't1-row', { action: { event: 'open.transfer' } }),
    Row('t1-row', ['t1-i', 't1-t'], { gap: 'var(--space-3)' }),
    Icon('t1-i', 'transfer', 'accent'),
    Column('t1-t', ['t1-k', 't1-v'], { gap: '0px' }),
    Text('t1-k', '直接转账给对方', 'body'),
    Text('t1-v', '最快，对方自己安排', 'caption'),
    Card('t2', 't2-row', { action: { event: 'open.bills' } }),
    Row('t2-row', ['t2-i', 't2-t'], { gap: 'var(--space-3)' }),
    Icon('t2-i', 'bills', 'accent'),
    Column('t2-t', ['t2-k', 't2-v'], { gap: '0px' }),
    Text('t2-k', '先看看这个月的账', 'body'),
    Text('t2-v', '确认这笔花完还剩多少', 'caption'),
    Card('t3', 't3-row', { action: { event: 'open.subscriptions' } }),
    Row('t3-row', ['t3-i', 't3-t'], { gap: 'var(--space-3)' }),
    Icon('t3-i', 'subscriptions', 'accent'),
    Column('t3-t', ['t3-k', 't3-v'], { gap: '0px' }),
    Text('t3-k', '顺手清掉不用的订阅', 'body'),
    Text('t3-v', '每月固定支出 ' + r.subTotalText, 'caption'),
    ActionGroup('actions', [{ label: '直接转账', event: 'open.transfer', variant: 'primary' }]),
  ], { ...d, subTotalText: r.subTotalText });
}

/* ── 转账核对：把"转完之后会怎样"提前摆出来 ───────────────────────────── */

export function composeTransferReview(draft, ctx) {
  const contact = (ctx.contacts || []).find(c => c.id === draft.contactId);
  const name = contact ? contact.name : '新收款人';
  const number = contact ? contact.number : (draft.manualCardNumber || '待补充');
  const cents = Math.round(Number(draft.amountText || 0) * 100);
  const im = transferImpact(ctx.bank, cents);

  return envelope(ctx, [
    Column('root', ['back', 'head', 'prog', 'figs', 'd1', 'rows', 'd2', 'after-title', 'after', 'actions', 'note'], { gap: 'var(--space-4)' }),
    /* 四步流程的第三、四步也要能回退 —— 交给 brief 时曾把这两样弄丢 */
    ActionGroup('back', [{ label: '上一步', event: 'transfer.back', variant: 'secondary', context: { to: 'amount' } }], { align: 'start' }),
    ...head('transfer', '核对一下', '这一步不会扣款，确认后才进入验证'),
    Progress('prog', { current: 4, total: 4, label: '转账进度' }),

    Row('figs', ['f-amt', 'f-after', 'f-safe'], { gap: 'var(--space-6)', wrap: true }),
    Figure('f-amt', { label: '转出', value: '¥' + (draft.amountText || '0.00'), tone: 'muted' }),
    Figure('f-after', { label: '转后余额', value: im.balanceAfterText, note: '现在 ' + im.balanceBeforeText }),
    Figure('f-safe', { label: '扣完订阅还剩', value: im.safeAfterText, note: '待扣 ' + im.upcomingText, tone: 'muted' }),

    Divider('d1'),
    Column('rows', ['r1', 'r2', 'r3'], { gap: 'var(--space-3)' }),
    Row('r1', ['r1k', 'r1v'], { align: 'between' }),
    Text('r1k', '收款人', 'label'),
    Text('r1v', name, 'body'),
    Row('r2', ['r2k', 'r2v'], { align: 'between' }),
    Text('r2k', '收款账户', 'label'),
    Text('r2v', number, 'body'),
    Row('r3', ['r3k', 'r3v'], { align: 'between' }),
    Text('r3k', '备注', 'label'),
    Text('r3v', draft.note || '未填写', 'body'),

    Divider('d2'),
    Text('after-title', '这笔钱转出去之后', 'label'),
    Column('after', ['a1', 'a2'], { gap: 'var(--space-2)' }),
    Text('a1', '本月支出会从 ' + im.monthBeforeText + ' 变成 ' + im.monthAfterText + '，增加约 ' + im.monthDeltaPct + '%', 'body'),
    Text('a2', '确认后需安全验证，验证通过才记账', 'caption'),

    ActionGroup('actions', [{ label: '确认并获取验证码', event: 'transfer.confirm', variant: 'primary' }]),
  ], { ...ctx.dataModel, ...draft });
}

/* ── 转账回执：钱去哪了 + 账户现在什么样 ──────────────────────────────── */

export function composeTransferDone(draft, ctx) {
  const contact = (ctx.contacts || []).find(c => c.id === draft.contactId);
  const name = contact ? contact.name : '收款人';
  const cents = Math.round(Number(draft.amountText || 0) * 100);
  const im = transferImpact(ctx.bank, cents);
  return envelope(ctx, [
    Column('root', ['head', 'figs', 'd1', 'receipt', 'd2', 'next-title', 'n1', 'n2', 'actions'], { gap: 'var(--space-4)' }),
    ...head('check', '已转出 ¥' + (draft.amountText || '0.00') + ' 给 ' + name, '回执编号 ' + String(draft.receiptId || '').slice(0, 8).toUpperCase(), 'positive'),

    Row('figs', ['f-bal', 'f-month', 'f-safe'], { gap: 'var(--space-6)', wrap: true }),
    Figure('f-bal', { label: '账户余额', value: bind('/balanceText'), tone: 'muted' }),
    Figure('f-month', { label: '本月支出', value: bind('/spendingText'), note: '含这笔 ' + '¥' + (draft.amountText || '0.00'), tone: 'muted' }),
    Figure('f-safe', { label: '扣完订阅还剩', value: im.safeAfterText, tone: 'muted' }),

    Divider('d1'),
    Column('receipt', ['q1', 'q2'], { gap: 'var(--space-3)' }),
    Row('q1', ['q1k', 'q1v'], { align: 'between' }),
    Text('q1k', '收款账户', 'label'),
    Text('q1v', contact ? contact.number : (draft.manualCardNumber || '待补充'), 'body'),
    Row('q2', ['q2k', 'q2v'], { align: 'between' }),
    Text('q2k', '记账时间', 'label'),
    Text('q2v', DEMO_DATE, 'body'),

    Divider('d2'),
    Text('next-title', '接下来你可能想', 'label'),
    Card('n1', 'n1-row', { action: { event: 'transfer.save-payee', context: { contactId: draft.contactId } } }),
    Row('n1-row', ['n1-i', 'n1-t'], { gap: 'var(--space-3)' }),
    Icon('n1-i', 'users', 'accent'),
    Column('n1-t', ['n1-k', 'n1-v'], { gap: '0px' }),
    Text('n1-k', '把 ' + name + ' 设为常用收款人', 'body'),
    Text('n1-v', '下次直接从常用里选', 'caption'),
    Card('n2', 'n2-row', { action: { event: 'open.bills' } }),
    Row('n2-row', ['n2-i', 'n2-t'], { gap: 'var(--space-3)' }),
    Icon('n2-i', 'bills', 'accent'),
    Column('n2-t', ['n2-k', 'n2-v'], { gap: '0px' }),
    Text('n2-k', '看看这个月的账单', 'body'),
    Text('n2-v', '这笔已经计入', 'caption'),

    ActionGroup('actions', [{ label: '再转一笔', event: 'open.transfer', variant: 'secondary' }]),
  ], { ...ctx.dataModel, ...draft });
}
