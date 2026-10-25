const interrupted = () => new Error('回复中断，请重试或查看原任务。');
const failure = (data, status) => Object.assign(new Error(data.message || '处理失败，请重试。'),
  { status: data.status || status, code: data.code });

/** Incremental UTF-8/SSE decoder; only complete events can hand off a task. */
export async function readAgentResponse(response, onDelta = () => {}) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw failure(data.detail || {}, response.status);
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) return response.json();
  if (!response.body) throw interrupted();
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', complete = null;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const lines = frame.split(/\r?\n/);
        const kind = lines.find(l => l.startsWith('event:'))?.slice(6).trim();
        const raw = lines.filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (kind === 'error') throw failure(data);
        if (kind === 'delta') {
          if (typeof data.text !== 'string' || complete) throw interrupted();
          onDelta(data.text);
        }
        if (kind === 'complete') complete = data;
      }
      if (done) break;
    }
    if (!complete) throw interrupted();
    return complete;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function streamAgentTurn(body, onDelta) {
  let response;
  try {
    response = await fetch('/api/agent/turn', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Demo-Request': '1' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  } catch { throw interrupted(); }
  return readAgentResponse(response, onDelta);
}
