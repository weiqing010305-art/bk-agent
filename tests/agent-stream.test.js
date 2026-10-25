import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAgentResponse } from '../src/api/agentStream.js';

const frame = (kind, data) => `event: ${kind}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
const response = text => {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.slice(i, i + 1));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
};
test('SSE byte boundaries preserve Chinese, emoji and completion metadata', async () => {
  const deltas = [];
  const result = await readAgentResponse(response(frame('thinking', {}) + frame('delta', { text: '转给' })
    + frame('delta', { text: '谁？🌱' }) + frame('complete', { id: 'task', message: '转给谁？🌱' })), text => deltas.push(text));
  assert.equal(deltas.join(''), result.message);
  assert.equal(deltas.length, 2);
  assert.equal(result.id, 'task');
});
test('truncated stream cannot produce a handoff', async () => {
  await assert.rejects(readAgentResponse(response(frame('delta', { text: '已填写好' }))), /回复中断/);
});
test('SSE errors preserve safe status and JSON responses remain compatible', async () => {
  await assert.rejects(readAgentResponse(response(frame('error', { status: 409, code: 'TASK_VERSION', message: '任务已更新' }))),
    error => error.status === 409 && error.code === 'TASK_VERSION');
  await assert.rejects(readAgentResponse(Response.json({ detail: { message: '请重试' } }, { status: 503 })), /请重试/);
  assert.deepEqual(await readAgentResponse(Response.json({ id: 'old-json-task' })), { id: 'old-json-task' });
});
