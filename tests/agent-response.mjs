import { readAgentResponse } from '../src/api/agentStream.js';

export async function taskResponse(response, page) {
  // Chromium does not retain SSE response bodies in Network.getResponseBody.
  // Read the committed task through its original session instead.
  if (page && response.headers()['content-type']?.includes('text/event-stream')) {
    const body = response.request().postDataJSON();
    const url = new URL('/api/agent/conversations/' + body.conversation_id, response.url());
    for (let i = 0; i < 60; i++) {
      const result = await page.request.get(url.href);
      const task = await result.json();
      if (result.ok() && task && task.version > body.version) return task;
      await page.waitForTimeout(200);
    }
    throw new Error('Stream did not commit a task');
  }
  return readAgentResponse(new Response(await response.body(), {
    status: response.status(), headers: response.headers(),
  }));
}
