/**
 * a2ui/protocol.js —— A2UI 协议层（v1.0 形状）
 * ============================================================================
 * 依据：doc/research/A2UI-protocol.md（官方仓库 a2ui-project/a2ui，16530★，Apache-2.0）
 *
 * 设计要点（三条，全部为了「可靠」）：
 *  1. **白名单**：只有 6 个组件。名单里没有「颜色」「样式」「HTML」字段，
 *     所以无论 mock 还是将来的 LLM，都不可能产出违反 tokens.css 的 UI。
 *  2. **数据与结构分离**：结构消息里禁止出现事实数字，只能写 {path:'/x'} 引用，
 *     真正的值只由数据模型写入，而数据模型只由 service 层写入。
 *  3. **可溯源**：每个 surface 携带 provenance，UI 能显示「数据截至 …」。
 *
 * ⚠️ 不要抄 v0.8 的 surfaceUpdate / beginRendering / dataModelUpdate —— 那套协议已封闭。
 */

export const PROTOCOL_VERSION = 'v1.0';
export const CATALOG_ID = 'qinghe.banking.v1';

/** 组件白名单。新增业务组件必须在此登记，否则 applyMessages 会丢弃并记诊断。 */
export const COMPONENT_NAMES = ['Text', 'Icon', 'Row', 'Column', 'Card', 'ActionGroup', 'TextField', 'Select', 'Meter', 'Progress', 'Divider', 'Figure', 'CardFace'];

/** Text 的语义变体。样式由 tokens.css 决定，协议不允许指定字号/颜色。 */
export const TEXT_VARIANTS = ['caption2', 'caption', 'label', 'body', 'headline', 'title', 'amount'];

/** 图标名白名单 —— 与 lucide-react 的映射在 render.jsx。 */
export const ICON_NAMES = [
  'transfer', 'bills', 'subscriptions', 'cards', 'check', 'lock', 'shield',
  'arrow-right', 'arrow-up-right', 'arrow-down-left', 'arrow-left', 'wallet', 'sparkles',
  /* 转账流程与分类图标 */
  'user', 'users', 'calendar', 'clock', 'repeat', 'smartphone', 'landmark',
  'utensils', 'shopping-bag', 'train', 'cloud', 'video', 'music', 'banknote',
];

/** muted = 次级数字（用正文色，不抢主数字的注意力）。Figure 需要它的原因见 brief.js。 */
export const TONES = ['neutral', 'accent', 'positive', 'negative', 'warning', 'muted'];

/* ── 信封构造器：Agent / 产品层只允许通过这些函数产出消息 ────────────────── */

export const createSurface = ({ surfaceId, components, dataModel = {}, meta = {} }) => ({
  version: PROTOCOL_VERSION,
  createSurface: { surfaceId, catalogId: CATALOG_ID, components, dataModel, meta },
});

export const updateComponents = ({ surfaceId, components }) => ({
  version: PROTOCOL_VERSION,
  updateComponents: { surfaceId, components },
});

export const updateDataModel = ({ surfaceId, patch }) => ({
  version: PROTOCOL_VERSION,
  updateDataModel: { surfaceId, patch },
});

export const deleteSurface = surfaceId => ({
  version: PROTOCOL_VERSION,
  deleteSurface: { surfaceId },
});

/* ── 组件构造器 ─────────────────────────────────────────────────────────── */

export const Text = (id, text, variant = 'body') => ({ component: 'Text', id, text, variant });
export const Icon = (id, name, tone = 'neutral') => ({ component: 'Icon', id, name, tone });
export const Row = (id, children, opts = {}) => ({ component: 'Row', id, children, ...opts });
export const Column = (id, children, opts = {}) => ({ component: 'Column', id, children, ...opts });
/**
 * Card 是内容层容器。
 * opts.action = { event, context } 时整张卡可点击（建议胶囊模式），事件名必须是字符串。
 */
export const Card = (id, child, opts = {}) => {
  const { action, ...rest } = opts;
  const card = { component: 'Card', id, child, ...rest };
  if (action) {
    if (typeof action.event !== 'string') throw new Error('Card.action.event 必须是字符串');
    /* 事件统一形状为 { name, context } —— 与 ActionGroup 一致，派发方只需认一种结构 */
    card.action = { name: action.event, context: action.context ?? {} };
  }
  return card;
};

/**
 * ActionGroup：最多 2 个动作。
 * 动作只携带**字符串事件名**，不携带函数 —— 这是「后端替换为零成本」的前提之一。
 */
export const ActionGroup = (id, actions, opts = {}) => {
  if (actions.length > 2) throw new Error('ActionGroup 最多 2 个动作');
  return {
    component: 'ActionGroup',
    id,
    align: opts.align,
    actions: actions.map(a => ({
      label: a.label,
      event: { name: String(a.event), context: a.context ?? {} },
      variant: a.variant ?? 'primary',
    })),
  };
};

/** 数据绑定引用。结构里禁止写事实数字，只允许写引用。 */
/* ── 输入类组件 ──────────────────────────────────────────────────────────── */
/* 带 value 绑定的输入组件会把变更通过 field.change 事件回抛，由上层写回 dataModel。
   注意：它们同样没有任何样式自由度。 */

export const TextField = (id, opts) => ({
  component: 'TextField', id,
  label: opts.label, value: opts.value,
  placeholder: opts.placeholder ?? '',
  inputMode: opts.inputMode ?? 'text',
  maxLength: opts.maxLength,
  testId: opts.testId,
});

/**
 * 卡面。助手侧调出卡片时用 —— 以前那里只有一行灰字，看不出是张卡。
 * 只传 id 就能渲染：色调与卡组织由 cardFace 的 TEMPLATE 兜底，不会退化成没品牌的灰块。
 */
export const CardFace = (id, { cardId, name, tail, hidden, frozen }) => ({ component: 'CardFace', id, cardId, name, tail, hidden, frozen });

/** 分组用的细线。取代"每块都套一张卡"那种嵌套容器。 */
export const Divider = id => ({ component: 'Divider', id });

/**
 * 一组「标签 + 数值」。Agent 统合视图的基本单位。
 * 刻意**不是卡片** —— craft-floor 明说卡片是最懒的容器，嵌套卡片永远是错的。
 */
export const Figure = (id, { label, value, note, tone }) => ({ component: 'Figure', id, label, value, note, tone });

/** 多步流程的进度指示。段数由 total 决定，填充到 current。 */
export const Progress = (id, { current, total, label }) => ({ component: 'Progress', id, current, total, label });

/** 极细进度条（参考图那条绿柱）。纯展示，百分比由数据模型给出。 */
export const Meter = (id, opts) => ({
  component: 'Meter', id,
  label: opts.label, percent: opts.percent, value: opts.value,
  tone: opts.tone ?? 'accent',
  event: opts.event,
});

export const Select = (id, opts) => ({
  component: 'Select', id,
  label: opts.label, value: opts.value,
  options: opts.options,
});

/** 数据绑定引用。结构里禁止写事实数字，只允许写引用。 */
export const bind = path => ({ path });
