/**
 * end-to-end：两条入口 + 对话流 + 产品层 + 会话。
 * 用 Edge 跑（机器上已有），不需要下载 Playwright 浏览器。
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
await mkdir('artifacts/e2e', { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

const workspace = () => page.locator('.assistant-thread');
const surface = () => workspace().locator('.a2ui-surface').last();
const composer = () => page.locator('textarea[aria-label="输入消息"]');

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. 新会话：左侧欢迎消息 + 七项功能，无底部重复入口
  await page.getByText('您好，我是青禾，您的银行 AI 助手', { exact: false }).waitFor();
  assert.equal(await page.locator('.chat-turn--assistant').count(), 1, '新会话应先显示一条助手消息');
  assert.equal(await page.locator('.chat-avatar').count(), 0, '助手消息不应显示头像');
  assert.equal(await page.locator('.flow-chip').count(), 7, '欢迎消息下应有七项功能');
  assert.equal(await page.locator('.launcher-row').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 7, '桌面快捷入口应为七列卡片');
  assert.equal(await page.locator('.activity-rail').count(), 0, '助手页不再显示交易动态栏');
  const sidebarBox = await page.locator('.sidebar').boundingBox();
  const welcomeBox = await page.locator('.chat-bubble--welcome').boundingBox();
  const composerBox = await page.locator('.assistant-main .composer').boundingBox();
  assert.ok(welcomeBox.x > sidebarBox.x + sidebarBox.width, '欢迎语应位于主内容区');
  assert.ok(sidebarBox.width >= 250, '桌面侧边栏应加宽');
  assert.ok(composerBox.x < welcomeBox.x, '输入框左侧应覆盖消息列边缘');
  assert.ok(composerBox.width >= 1040 && composerBox.width <= 1104, '输入框应比消息列略宽');
  assert.ok(composerBox.height >= 124, '输入框应有更大的默认高度');
  assert.equal(await page.locator('.assistant-main .composer-wrap').evaluate(el => getComputedStyle(el).position), 'absolute', '输入框外层应浮在对话区上方');
  assert.notEqual(await page.locator('.assistant-main .composer-wrap').evaluate(el => getComputedStyle(el).backgroundImage), 'none', '输入框下方应有独立的说明区');
  /* 这里原本断言「输入框下方应显示演示说明」—— 那是被推翻的决策。
     作者明确要求界面上不出现演示 / 模拟 / 预设规则这类备注，
     所以现在断言的是**反面**：那句话必须不在。 */
  assert.equal(await page.locator('.assistant-main .hint').count(), 0, '输入框下方不应出现演示说明');
  assert.ok(await workspace().evaluate(el => parseFloat(getComputedStyle(el).paddingBottom)) >= 180, '对话底部应留出空间供最后一条消息滚出输入框');
  assert.equal(await page.locator('.composer .attach').count(), 0, '输入框不应显示附件入口');
  assert.equal(await page.locator('.chat-turn time').count(), 0, '对话消息不应显示时间');
  assert.equal(await page.locator('.turn-strip').count(), 0, '不应出现重复的历史横条');
  assert.equal(await workspace().getAttribute('role'), 'log', '对话区应有 role=log（WCAG ARIA23）');
  assert.equal(await page.locator('.inspector').count(), 0, '动线面板不应出现在界面里（动线必须是无感的）');

  // 2. 业务层入口：一句话里人和钱都说了 → 直接进核对步
  await composer().fill('给章明远转 100 元');
  await composer().press('Enter');
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('.chat-turn--user').count(), 1, '用户消息应留在对话流中');
  const userBox = await page.locator('.chat-bubble--user').first().boundingBox();
  const assistantBox = await page.locator('.chat-bubble--assistant').first().boundingBox();
  assert.ok(userBox.x > assistantBox.x, '用户应在右侧，助手应在左侧');
  assert.equal(await page.locator('.chat-actions').count(), 0, '对话消息下方不应显示操作图标');
  assert.equal(await workspace().locator('.a2ui-provenance').count(), 0, '助手回复下方不应显示演示账本说明');
  const reviewText = await surface().innerText();
  assert.match(reviewText, /核对一下/, '人和金额都说了，应直接跳到核对步');
  assert.match(reviewText, /章明远/, '应识别出收款人');
  assert.match(reviewText, /¥100/, '应识别出金额');
  // 统合视图必须给出跨域数字：转后余额 / 本月支出变化 / 扣完订阅还剩
  assert.match(reviewText, /转后余额/, '核对步应给出转后余额');
  assert.match(reviewText, /扣完订阅还剩/, '核对步应给出扣完订阅的余额');
  assert.match(reviewText, /本月支出会从/, '核对步应说明对本月支出的影响');

  // 3. 只说了金额 → 从「转给谁」开始，不重复问已知的事
  await composer().fill('我要转 50 块');
  await composer().press('Enter');
  await page.waitForTimeout(900);
  assert.match(await surface().innerText(), /转给谁/, '只说了金额，应从选收款人开始');

  // 4. 完全没说清 → 才从第一步开始
  await composer().fill('我要转账');
  await composer().press('Enter');
  await page.waitForTimeout(900);
  assert.equal(await surface().locator('.a2ui-card--interactive').count(), 4, '第一步应有 4 种转账方式');

  // 5. 历史消息留在原位
  assert.equal(await page.locator('.chat-turn--user').count(), 3, '三条用户消息均应可回看');
  assert.ok(await page.locator('.chat-turn--assistant').count() >= 4, '助手回复应按顺序保留');

  // 6. 键盘
  await composer().fill('多行');
  await composer().press('Shift+Enter');
  await page.waitForTimeout(250);
  assert.ok((await composer().inputValue()).includes('\n'), 'Shift+Enter 应换行');
  await composer().fill('');

  // 7. 产品层：侧边栏切页面（只断言语义，不断言具体类名 —— 页面由各 agent 拥有）
  for (const [label, mustSee] of [['账单', /支出|收入/], ['卡片', /卡|额度/], ['订阅', /订阅|续费/], ['概览', /余额/], ['转账', /收款人|转给谁/]]) {
    await page.locator('.side-item', { hasText: label }).first().click();
    await page.waitForTimeout(700);
    const t = await page.locator('.view-inner').innerText();
    assert.match(t, mustSee, label + ' 页内容异常: ' + t.slice(0, 60));
    assert.ok(t.length > 30, label + ' 页几乎是空的');
  }
  assert.equal(await page.locator('.side-item', { hasText: '收款人' }).count(), 0, '侧边栏不应有独立收款人入口');
  assert.ok(await page.locator('.payees-embedded').count(), '转账页应包含收款人名录');
  await page.locator('.payees-embedded').getByRole('button', { name: '再转一笔' }).first().click();
  assert.equal(await page.locator('.view-inner .a2ui-surface').getAttribute('data-step'), 'amount', '从名录再转一笔应进入转账金额步骤');
  await page.locator('.side-item', { hasText: '概览' }).first().click();
  assert.equal(await page.locator('.icon-grid').getByText('收款', { exact: true }).count(), 0, '概览不应有收款快捷入口');
  assert.equal(await page.locator('.icon-grid').getByText('收款人', { exact: true }).count(), 0, '概览不应有收款人快捷入口');

  // 8. 多会话
  await page.locator('.side-item', { hasText: '青禾助手' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.side-new').click();
  await page.waitForTimeout(900);
  assert.ok(await page.locator('.side-conv').count() >= 2, '侧边栏应有至少两条历史');
  await page.locator('.side-conv').nth(1).locator('button').first().click();
  await page.waitForTimeout(700);
  assert.ok(await surface().count() >= 1, '切回旧对话应恢复它的视图');

  // 9. 刷新恢复
  const before = await page.locator('.side-conv').count();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  assert.equal(await page.locator('.side-conv').count(), before, '刷新后会话应原样恢复');

  await page.screenshot({ path: 'artifacts/e2e/final.png' });
  assert.equal(pageErrors.length, 0, '不应有未捕获异常: ' + pageErrors.join(' | '));
  console.log('e2e OK — 全部断言通过（欢迎入口 / 左右消息 / 统合跨域 / 跳步 / 键盘 / 产品层 / 多会话 / 刷新）');
} finally {
  await browser.close();
}
