/**
 * a2ui/apply.js —— 纯函数渲染内核
 * ============================================================================
 * applyMessages(state, messages) -> newState
 *
 * 纯函数、无 React、无副作用。这是「后端替换为零成本」的关键：
 * 将来接真后端只需 stream.onmessage = e => applyMessages(state, JSON.parse(e.data))。
 *
 * 可靠性由这一层保证（这是本文件存在的全部理由）：
 *  · 未知组件名  → 丢弃 + 记诊断，绝不渲染
 *  · 非法属性值  → 丢弃 + 记诊断
 *  · 悬空引用    → 解析为 null，渲染层显示占位符「—」，绝不显示 undefined
 *  · 缺失 root   → 该 surface 不可渲染，记诊断
 */

import { COMPONENT_NAMES, ICON_NAMES, TEXT_VARIANTS, TONES } from './protocol.js';

export const initialState = () => ({ surfaces: {}, diagnostics: [] });

const diag = (state, surfaceId, code, detail) => ({
  ...state,
  diagnostics: [...state.diagnostics, { surfaceId, code, detail }],
});

/** 取 JSON Pointer 风格路径：'/transactions/0/name' */
export function getPath(dataModel, path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return undefined;
  return path.slice(1).split('/').reduce(
    (acc, key) => (acc == null ? undefined : acc[key]),
    dataModel,
  );
}

/** 解析绑定：字面量原样返回；{path} 走数据模型。解析不到一律返回 null（不是 undefined）。 */
export function resolveValue(dataModel, value) {
  if (value && typeof value === 'object' && typeof value.path === 'string') {
    const found = getPath(dataModel, value.path);
    return found === undefined ? null : found;
  }
  return value;
}

function validate(node) {
  if (!node || typeof node !== 'object') return 'not-an-object';
  if (typeof node.id !== 'string' || !node.id) return 'missing-id';
  if (!COMPONENT_NAMES.includes(node.component)) return 'unknown-component:' + node.component;
  const s = (v, list) => v === undefined || list.includes(v);
  switch (node.component) {
    case 'Text':
      if (!s(node.variant, TEXT_VARIANTS)) return 'bad-variant:' + node.variant;
      if (node.text === undefined) return 'missing-text';
      return null;
    case 'Icon':
      if (!ICON_NAMES.includes(node.name)) return 'unknown-icon:' + node.name;
      if (!s(node.tone, TONES)) return 'bad-tone:' + node.tone;
      return null;
    case 'Row':
    case 'Column':
      if (!Array.isArray(node.children)) return 'missing-children';
      return null;
    case 'Card':
      if (typeof node.child !== 'string') return 'missing-child';
      if (!s(node.tone, TONES)) return 'bad-tone:' + node.tone;
      if (node.action && typeof node.action.name !== 'string') return 'bad-card-action';
      return null;
    case 'ActionGroup':
      if (!Array.isArray(node.actions) || !node.actions.length || node.actions.length > 2) return 'bad-actions';
      return null;
    case 'TextField':
      if (typeof node.label !== 'string') return 'missing-label';
      if (!['text', 'decimal', 'numeric'].includes(node.inputMode)) return 'bad-input-mode:' + node.inputMode;
      if (!node.value || typeof node.value.path !== 'string') return 'textfield-requires-binding';
      return null;
    case 'Progress':
      if (!Number.isInteger(node.current) || !Number.isInteger(node.total) || node.total < 1) return 'bad-progress';
      return null;
    case 'Divider':
      return null;
    case 'CardFace':
      if (typeof node.cardId !== 'string') return 'missing-cardId';
      return null;
    case 'Figure':
      if (typeof node.label !== 'string') return 'missing-label';
      if (node.value === undefined) return 'missing-value';
      if (!s(node.tone, TONES)) return 'bad-tone:' + node.tone;
      return null;
    case 'Meter':
      if (typeof node.label !== 'string') return 'missing-label';
      if (!node.percent || typeof node.percent.path !== 'string') return 'meter-requires-binding';
      if (!s(node.tone, TONES)) return 'bad-tone:' + node.tone;
      return null;
    case 'Select':
      if (typeof node.label !== 'string') return 'missing-label';
      if (!Array.isArray(node.options)) return 'missing-options';
      if (!node.value || typeof node.value.path !== 'string') return 'select-requires-binding';
      return null;
    default:
      return null;
  }
}

function applyOne(state, message) {
  if (!message || typeof message !== 'object') return diag(state, '?', 'bad-message', typeof message);

  if (message.createSurface) {
    const { surfaceId, components = [], dataModel = {}, meta = {} } = message.createSurface;
    if (!surfaceId) return diag(state, '?', 'missing-surface-id', null);
    const kept = {};
    let next = state;
    for (const node of components) {
      const err = validate(node);
      if (err) { next = diag(next, surfaceId, 'dropped-component', err + ' @' + (node && node.id)); continue; }
      kept[node.id] = node;
    }
    if (!kept.root) next = diag(next, surfaceId, 'missing-root', 'surface 必须且只能有一个 id 为 root 的组件');
    return {
      ...next,
      surfaces: { ...next.surfaces, [surfaceId]: { id: surfaceId, components: kept, dataModel, meta } },
    };
  }

  if (message.updateComponents) {
    const { surfaceId, components = [] } = message.updateComponents;
    const existing = state.surfaces[surfaceId];
    if (!existing) return diag(state, surfaceId, 'unknown-surface', 'updateComponents 指向不存在的 surface');
    const kept = { ...existing.components };
    let next = state;
    for (const node of components) {
      const err = validate(node);
      if (err) { next = diag(next, surfaceId, 'dropped-component', err + ' @' + (node && node.id)); continue; }
      kept[node.id] = node;
    }
    return { ...next, surfaces: { ...next.surfaces, [surfaceId]: { ...existing, components: kept } } };
  }

  if (message.updateDataModel) {
    const { surfaceId, patch } = message.updateDataModel;
    const existing = state.surfaces[surfaceId];
    if (!existing) return diag(state, surfaceId, 'unknown-surface', 'updateDataModel 指向不存在的 surface');
    return {
      ...state,
      surfaces: {
        ...state.surfaces,
        [surfaceId]: { ...existing, dataModel: { ...existing.dataModel, ...patch } },
      },
    };
  }

  if (message.deleteSurface) {
    const { surfaceId } = message.deleteSurface;
    if (!state.surfaces[surfaceId]) return state;
    const next = { ...state.surfaces };
    delete next[surfaceId];
    return { ...state, surfaces: next };
  }

  return diag(state, '?', 'unknown-envelope', Object.keys(message).join(','));
}

export function applyMessages(state, messages) {
  let next = state;
  for (const m of messages) next = applyOne(next, m);
  return next;
}

/**
 * 把邻接表展开成可渲染的树。
 * 悬空引用（child/children 指向不存在的 id）解析为 null，由渲染层显示占位符。
 */
export function resolveTree(surface, id = 'root', seen = new Set()) {
  const node = surface.components[id];
  if (!node || seen.has(id)) return null;
  const nextSeen = new Set(seen).add(id);
  const dataModel = surface.dataModel;
  switch (node.component) {
    case 'Text':
      return { type: 'Text', key: id, variant: node.variant, text: resolveValue(dataModel, node.text) };
    case 'Icon':
      return { type: 'Icon', key: id, name: node.name, tone: node.tone };
    case 'Row':
    case 'Column':
      return {
        type: node.component, key: id, gap: node.gap, align: node.align, wrap: node.wrap,
        children: node.children.map(c => resolveTree(surface, c, nextSeen)).filter(Boolean),
      };
    case 'Card':
      return { type: 'Card', key: id, tone: node.tone, action: node.action, child: resolveTree(surface, node.child, nextSeen) };
    case 'ActionGroup':
      return { type: 'ActionGroup', key: id, actions: node.actions, align: node.align };
    case 'TextField':
      return { type: 'TextField', key: id, label: node.label, placeholder: node.placeholder,
        inputMode: node.inputMode, maxLength: node.maxLength, testId: node.testId,
        path: node.value.path, value: resolveValue(dataModel, node.value) };
    case 'Progress':
      return { type: 'Progress', key: id, current: node.current, total: node.total, label: node.label };
    case 'Divider':
      return { type: 'Divider', key: id };
    case 'CardFace':
      return { type: 'CardFace', key: id, cardId: node.cardId, hidden: node.hidden, frozen: node.frozen,
        name: resolveValue(dataModel, node.name), tail: resolveValue(dataModel, node.tail) };
    case 'Figure':
      /* label / note / value 都可能是引用 —— 三个都要解析，漏一个就会把 {path} 对象
         直接丢给 React，报 Objects are not valid as a React child。 */
      return { type: 'Figure', key: id, tone: node.tone,
        label: resolveValue(dataModel, node.label),
        note: resolveValue(dataModel, node.note),
        value: resolveValue(dataModel, node.value) };
    case 'Meter': {
      const pct = resolveValue(dataModel, node.percent);
      return { type: 'Meter', key: id, label: node.label, tone: node.tone, event: node.event,
        percent: typeof pct === 'number' ? Math.max(0, Math.min(100, pct)) : 0,
        value: resolveValue(dataModel, node.value) };
    }
    case 'Select':
      return { type: 'Select', key: id, label: node.label, path: node.value.path,
        options: node.options, value: resolveValue(dataModel, node.value) };
    default:
      return null;
  }
}
