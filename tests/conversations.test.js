import test from 'node:test';
import assert from 'node:assert/strict';
import { initialHistory, updateCurrent, createConversation, deleteConversation, newConversation } from '../src/domain/conversations.js';
import { applyMessages, initialState, resolveTree } from '../src/a2ui/apply.js';
import { Column, Text } from '../src/a2ui/protocol.js';

const turn = (role, v) => role === 'user'
  ? { id: crypto.randomUUID(), role, text: v }
  : { id: crypto.randomUUID(), role, surfaceId: v };

test('新会话是空的：没有 turn，A2UI state 干净', () => {
  const c = newConversation();
  assert.deepEqual(c.turns, []);
  assert.deepEqual(c.a2ui, initialState());
});

test('新对话保留旧会话，且各自独立', () => {
  let s = initialHistory(null);
  const first = s.activeId;
  s = updateCurrent(s, { turns: [turn('user', '看看账单')], draft: '草稿A' });
  s = createConversation(s);
  assert.notEqual(s.activeId, first);
  assert.equal(s.items.length, 2);
  const old = s.items.find(c => c.id === first);
  assert.equal(old.draft, '草稿A');
  assert.equal(old.turns.length, 1);
  assert.equal(old.title, '看看账单');
});

test('重复新建不会堆积空会话', () => {
  let s = initialHistory(null);
  s = createConversation(s);
  s = createConversation(s);
  assert.equal(s.items.length, 1);
});

test('损坏的历史被整份丢弃并重建（不留下悬空 surface 引用）', () => {
  const broken = JSON.stringify({ version: 2, activeId: 'x', items: [{ id: 'x', title: 't', updatedAt: 'now', turns: [{ role: 'assistant', surfaceId: 'gone' }], a2ui: { surfaces: {} }, draft: '' }] });
  const s = initialHistory(broken);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].turns.length, 0);
  assert.equal(s.items[0].id, s.activeId);
  assert.notEqual(s.items[0].id, 'x');
});

test('版本不匹配的旧数据被安全重建', () => {
  const s = initialHistory(JSON.stringify({ version: 1, items: [{ id: 'a' }] }));
  assert.equal(s.items[0].turns.length, 0);
});

test('A2UI state 可整体存进会话并原样恢复', () => {
  let s = initialHistory(null);
  const a2ui = applyMessages(initialState(), [{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'x', components: [Column('root', ['t']), Text('t', '余额 ¥1.00', 'body')], dataModel: {} } }]);
  s = updateCurrent(s, { turns: [turn('assistant', 's1')], a2ui });
  const round = JSON.parse(JSON.stringify(s.items[0].a2ui));
  assert.equal(resolveTree(round.surfaces.s1).children[0].text, '余额 ¥1.00');
});

test('删除非当前会话不影响当前草稿', () => {
  let s = initialHistory(null);
  const first = s.activeId;
  s = updateCurrent(s, { turns: [turn('user', '第一段')] });   // 先让它非空，否则新建会被正确地忽略
  s = createConversation(s);
  const second = s.activeId;
  assert.notEqual(second, first);
  s = updateCurrent(s, { draft: '当前草稿' });
  s = deleteConversation(s, first);
  assert.equal(s.activeId, second);
  assert.equal(s.items[0].draft, '当前草稿');
});

test('删除当前会话会切到另一条；删最后一条会新建空白', () => {
  let s = initialHistory(null);
  const first = s.activeId;
  s = updateCurrent(s, { turns: [turn('user', '第一段')] });
  s = createConversation(s);
  const second = s.activeId;
  s = deleteConversation(s, second);
  assert.equal(s.activeId, first);
  s = deleteConversation(s, first);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].turns.length, 0);
});
