import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const original = window.fetch;
      let failed = false;
      window.fetch = async (url, options) => {
        if (url !== '/api/agent/turn') return original(url, options);
        const request = JSON.parse(options.body);
        if (options.headers.Accept !== 'text/event-stream') throw new Error('Missing stream negotiation');
        const encoder = new TextEncoder();
        const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
        return new Response(new ReadableStream({ async start(controller) {
          const emit = (kind, data) => controller.enqueue(encoder.encode(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`));
          emit('thinking', {});
          await pause(900);
          const message = request.text === '隔离测试' ? '已填写好，请核对手机号和金额后确认支付。' : '转给谁？请提供收款人姓名或完整卡号。';
          if (request.text === '断流测试' && !failed) {
            failed = true;
            emit('delta', { text: '转给' }); controller.close(); return;
          }
          for (let i = 0; i < message.length; i += 2) {
            emit('delta', { text: message.slice(i, i + 2) }); await pause(100);
          }
          const ready = request.text === '隔离测试';
          emit('complete', { id: crypto.randomUUID(), conversation_id: request.conversation_id,
            version: 1, kind: ready ? 'phone' : 'transfer', status: ready ? 'READY_FOR_REVIEW' : 'COLLECTING',
            handoff: ready, can_open: ready, message, missing: ready ? [] : ['recipient', 'amount'], choices: [] });
          controller.close();
        } }), { headers: { 'Content-Type': 'text/event-stream' } });
      };
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8080');
    await page.getByRole('button', { name: '打开青禾助手' }).click();
    const send = async text => {
      await page.getByLabel('输入消息').fill(text);
      await page.getByRole('button', { name: '发送', exact: true }).click();
    };
    await send('我要转账');
    await expect(page.getByRole('status', { name: '思考中' })).toBeVisible();
    assert.equal(await page.locator('.agent-thinking-icon').evaluate(el => getComputedStyle(el).animationName), 'agent-thinking-spin');
    await page.screenshot({ path: `.local/agent-thinking-${width}.png` });
    await expect(page.locator('.agent-streaming')).toBeVisible();
    const partial = await page.locator('.agent-streaming').innerText();
    assert.ok(partial.length > 0 && partial.length < '转给谁？请提供收款人姓名或完整卡号。'.length);
    assert.equal(await page.getByRole('button', { name: '查看这笔转账', exact: true }).count(), 0);
    await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
    await page.screenshot({ path: `.local/agent-streaming-${width}.png` });
    await expect(page.locator('.agent-answer[aria-busy="false"]')).toBeVisible();
    assert.equal(await page.locator('.agent-thinking').count(), 0);
    assert.equal(await page.locator('.agent-streaming').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await send('隔离测试');
    await expect(page.getByRole('status', { name: '思考中' })).toBeVisible();
    assert.equal(await page.locator('.agent-thinking-icon').evaluate(el => getComputedStyle(el).animationName), 'none');
    await expect(page.locator('.agent-streaming')).toBeVisible();
    await page.getByRole('button', { name: '新建聊天', exact: true }).click();
    await page.waitForTimeout(2000); // Release the old stream and assert it cannot navigate the new chat.
    assert.equal(await page.getByRole('heading', { name: '手机充值', exact: true }).count(), 0);
    assert.equal(await page.locator('.chat-turn--user').count(), 0);
    await send('断流测试');
    await expect(page.getByText('回复中断，请重试或查看原任务。', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.getByRole('status', { name: '思考中' })).toBeVisible();
    await expect(page.getByText('转给谁？请提供收款人姓名或完整卡号。', { exact: true })).toBeVisible();
    await expect(page.locator('.agent-answer[aria-busy="false"]')).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: desktop/mobile thinking motion, incremental SSE text, completion gate, reduced motion, new-chat isolation and interrupted-stream retry (controlled browser streams).');
} finally { await browser.close(); }
