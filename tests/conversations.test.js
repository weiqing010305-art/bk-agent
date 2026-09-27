import test from 'node:test';
import assert from 'node:assert/strict';
import { initialHistory, updateCurrent, createConversation, deleteConversation } from '../src/conversations.js';

test('new conversation preserves old messages and independent drafts', () => {
  let state = initialHistory(null);
  const first = state.activeId;
  state = updateCurrent(state, 'messages', messages => [...messages, { id: 'message', role: 'user', kind: 'text', text: '给陈晨转账' }]);
  state = updateCurrent(state, 'draft', '还没有发送');
  state = updateCurrent(state, 'transferDraft', { contactId: 'zhang', amount: '100', note: '午餐' });
  state = createConversation(state);
  assert.notEqual(state.activeId, first);
  assert.equal(state.items.length, 2);
  const old = state.items.find(c => c.id === first);
  assert.equal(old.title, '给陈晨转账');
  assert.equal(old.messages.length, 2);
  assert.equal(old.draft, '还没有发送');
  assert.equal(old.transferDraft.amount, '100');
  assert.equal(state.items[0].draft, '');
  assert.equal(state.items[0].transferDraft.amount, '');
  assert.deepEqual(initialHistory(JSON.stringify(state)), state);
});

test('repeated new conversation does not accumulate empty entries', () => {
  const state = initialHistory(null);
  assert.equal(createConversation(state), state);
});

test('invalid saved history recovers safely', () => {
  for (const raw of ['bad json', '{}', '{"version":1,"items":[]}']) {
    const state = initialHistory(raw);
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].active, 'home');
  }
});

test('deleting inactive conversation keeps current draft and survives reload', () => {
  let state = updateCurrent(initialHistory(null), 'draft', '旧草稿');
  const oldId = state.activeId;
  state = createConversation(state);
  state = updateCurrent(state, 'draft', '当前草稿');
  const activeId = state.activeId;
  state = deleteConversation(state, oldId);
  assert.equal(state.activeId, activeId);
  assert.equal(state.items[0].draft, '当前草稿');
  assert.equal(state.items.length, 1);
  assert.deepEqual(initialHistory(JSON.stringify(state)), state);
});

test('deleting current conversation selects another; deleting last creates blank', () => {
  let state = updateCurrent(initialHistory(null), 'draft', '保留');
  const first = state.activeId;
  state = createConversation(state);
  state = deleteConversation(state, state.activeId);
  assert.equal(state.activeId, first);
  state = deleteConversation(state, first);
  assert.notEqual(state.activeId, first);
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].draft, '');
  assert.equal(state.items[0].messages.length, 1);
  assert.equal(deleteConversation(state, 'missing'), state);
});
