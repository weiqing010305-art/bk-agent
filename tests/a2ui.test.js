import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyMessages, resolveTree, getPath } from '../src/a2ui/apply.js';
import { createSurface, Column, Card, Text, Icon, ActionGroup, bind, updateDataModel, deleteSurface } from '../src/a2ui/protocol.js';

const surfaceWith = components => createSurface({
  surfaceId: 's1',
  components,
  dataModel: { balance: '¥12,860.50' },
  meta: { provenance: { label: '演示账本 · 2026-09-25' } },
});

test('渲染一个合法 surface 并解析数据绑定', () => {
  const s = applyMessages(initialState(), [surfaceWith([
    Column('root', ['title', 'amount'], { gap: '4px' }),
    Text('title', '可用余额', 'label'),
    Text('amount', bind('/balance'), 'amount'),
  ])]);
  assert.equal(s.diagnostics.length, 0);
  const tree = resolveTree(s.surfaces.s1);
  assert.equal(tree.children[0].text, '可用余额');
  assert.equal(tree.children[1].text, '¥12,860.50');
});

test('未知组件被丢弃并记诊断，绝不渲染', () => {
  const s = applyMessages(initialState(), [surfaceWith([
    Column('root', ['evil', 'ok']),
    { component: 'Script', id: 'evil', html: '<img onerror=alert(1)>' },
    Text('ok', '安全', 'body'),
  ])]);
  assert.equal(s.surfaces.s1.components.evil, undefined);
  assert.ok(s.diagnostics.some(d => d.code === 'dropped-component' && d.detail.includes('unknown-component')));
  const tree = resolveTree(s.surfaces.s1);
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].text, '安全');
});

test('悬空数据引用解析为 null 而不是 undefined（渲染层显示占位符）', () => {
  const s = applyMessages(initialState(), [surfaceWith([
    Column('root', ['x']), Text('x', bind('/does/not/exist'), 'body'),
  ])]);
  assert.equal(resolveTree(s.surfaces.s1).children[0].text, null);
});

test('悬空子组件引用被安全丢弃', () => {
  const s = applyMessages(initialState(), [surfaceWith([
    Column('root', ['missing']),
  ])]);
  assert.equal(resolveTree(s.surfaces.s1).children.length, 0);
});

test('缺少 root 的 surface 记诊断', () => {
  const s = applyMessages(initialState(), [surfaceWith([Text('a', 'x', 'body')])]);
  assert.ok(s.diagnostics.some(d => d.code === 'missing-root'));
});

test('非法枚举值被拒（协议无法指定任意颜色）', () => {
  const s = applyMessages(initialState(), [surfaceWith([
    Column('root', ['t']), Text('t', 'x', '#ff0000'),
  ])]);
  assert.equal(s.surfaces.s1.components.t, undefined);
  assert.ok(s.diagnostics.some(d => d.detail.includes('bad-variant')));
});

test('数据模型可增量更新，卡片随后反映新值', () => {
  let s = applyMessages(initialState(), [surfaceWith([
    Column('root', ['amount']), Text('amount', bind('/balance'), 'amount'),
  ])]);
  s = applyMessages(s, [updateDataModel({ surfaceId: 's1', patch: { balance: '¥99.00' } })]);
  assert.equal(resolveTree(s.surfaces.s1).children[0].text, '¥99.00');
});

test('删除 surface 后不再存在', () => {
  let s = applyMessages(initialState(), [surfaceWith([Column('root', [])])]);
  s = applyMessages(s, [deleteSurface('s1')]);
  assert.equal(s.surfaces.s1, undefined);
});

test('ActionGroup 最多 2 个动作', () => {
  assert.throws(() => ActionGroup('a', [
    { label: '1', event: 'x' }, { label: '2', event: 'y' }, { label: '3', event: 'z' },
  ]), /最多 2 个动作/);
});

test('getPath 支持数组下标', () => {
  assert.equal(getPath({ t: [{ n: 'a' }] }, '/t/0/n'), 'a');
});
