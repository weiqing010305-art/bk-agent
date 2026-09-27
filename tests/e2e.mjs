import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
await mkdir('artifacts', { recursive: true });
async function assertConversationLayout(page, label) {
  await page.waitForTimeout(350);
  const layout = await page.evaluate(() => {
    const composer = document.querySelector('.composer');
    const scroller = document.querySelector('.conversation');
    const last = [...document.querySelectorAll('[data-message-id]')].at(-1);
    return {
      composerBottom: composer.getBoundingClientRect().bottom,
      scrollerBottom: scroller.getBoundingClientRect().bottom,
      lastTop: last.getBoundingClientRect().top,
      innerHeight,
      bodyHeight: document.body.scrollHeight,
    };
  });
  assert.ok(layout.composerBottom <= layout.innerHeight, `${label}: composer is off screen ${JSON.stringify(layout)}`);
  assert.ok(layout.scrollerBottom <= layout.composerBottom, `${label}: messages overlap composer ${JSON.stringify(layout)}`);
  assert.ok(layout.lastTop < layout.scrollerBottom, `${label}: new response is not visible ${JSON.stringify(layout)}`);
  assert.ok(layout.bodyHeight <= layout.innerHeight + 2, `${label}: page scrolls instead of chat ${JSON.stringify(layout)}`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByText('今天想先处理什么？').waitFor();
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
  await page.getByRole('button', { name: /智能转账 给朋友/ }).click();
  await assertConversationLayout(page, 'transfer');
  await page.getByRole('combobox').first().selectOption('zhang');
  await page.getByPlaceholder('0.00').fill('100.50');
  await page.getByRole('button', { name: '核对转账信息' }).click();
  await page.getByRole('dialog').getByText('¥100.50').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: '确认模拟操作' }).click();
  await page.getByText('¥12,760.00').first().waitFor();
  await page.getByRole('navigation', { name: '银行服务' }).getByRole('button', { name: '账单分析' }).click();
  await assertConversationLayout(page, 'bills');
  await page.getByText('转给张三').last().waitFor();
  await page.getByRole('navigation', { name: '银行服务' }).getByRole('button', { name: '订阅管理' }).click();
  await assertConversationLayout(page, 'subscriptions');
  assert.ok(await page.locator('.archived-workflow').count() >= 2, 'earlier workflows should be collapsed');
  await page.screenshot({ path: 'artifacts/subscriptions-open.png' });
  await page.getByRole('button', { name: '取消订阅' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '确认模拟操作' }).click();
  await page.getByText('预计下月自动扣费').last().waitFor();
  await page.getByRole('navigation', { name: '银行服务' }).getByRole('button', { name: '卡片管理' }).click();
  await assertConversationLayout(page, 'cards');
  await page.getByRole('button', { name: '临时冻结' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '确认模拟操作' }).click();
  await page.getByText('● 已冻结').last().waitFor();
  await page.reload();
  await page.getByText('¥12,760.00').first().waitFor();
  assert.equal(await page.getByText('已冻结', { exact: true }).count() > 0, true);
  await page.getByRole('navigation', { name: '银行服务' }).getByRole('button', { name: '卡片管理' }).click();
  await page.keyboard.press('Control+k');
  await page.getByText('今天想先处理什么？').waitFor();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(baseURL, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, 'mobile has horizontal overflow');
  await mobile.getByRole('button', { name: '打开菜单' }).click();
  await mobile.getByRole('navigation', { name: '银行服务' }).getByRole('button', { name: '账单分析' }).click();
  await mobile.getByText('九月资金流向').waitFor();
  await assertConversationLayout(mobile, 'mobile bills');
  await mobile.getByRole('button', { name: '打开菜单' }).click();
  await mobile.getByRole('button', { name: '重置演示数据' }).click();
  await mobile.getByRole('dialog').getByRole('button', { name: '确认模拟操作' }).click();
  await mobile.getByText('今天想先处理什么？').waitFor();
  console.log('Browser flows passed: desktop transfer, bill, cancel subscription, freeze card, persistence, mobile navigation and overflow.');
} finally { await browser.close(); }
