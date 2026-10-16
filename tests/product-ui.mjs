import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || chromium.executablePath() });
const context = await browser.newContext({ viewport: { width: 1560, height: 1080 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const home = async () => { if (!await page.locator('.icon-grid').count()) await page.getByRole('button', { name: '返回概览', exact: true }).first().click(); };
const open = async label => { await home(); await page.locator('.icon-grid').getByRole('button', { name: label, exact: true }).click(); };
const state = () => page.evaluate(() => fetch('/api/state').then(r => r.json()));
try {
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173/');
  await expect(page.locator('.hero-amount')).toHaveText('¥12,860.50');
  const initial = await state();
  const labels = await page.locator('.icon-tile').allTextContents();
  assert.equal(labels.length, 13);
  for (const width of [1440, 1799, 1800, 1920, 2048]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const clearance = await page.evaluate(() => ({
      contentTop: document.querySelector('.view-scroll').getBoundingClientRect().top,
      greetingBottom: document.querySelector('.assistant-greeting').getBoundingClientRect().bottom,
    }));
    assert.ok(clearance.contentTop >= clearance.greetingBottom + 6, `${width}: assistant must not cover overview content`);
  }
  await page.setViewportSize({ width: 1560, height: 1080 });
  const search = page.getByRole('searchbox', { name: '搜索服务' });
  await search.fill('水费'); await expect(page.locator('.icon-tile')).toHaveCount(1);
  await expect(page.locator('.icon-tile')).toContainText('生活缴费');
  await search.fill('不存在的服务'); await expect(page.getByRole('status')).toContainText('没有找到');
  await search.press('Escape'); await expect(search).toBeFocused();
  await expect(page.locator('.icon-tile')).toHaveCount(13);
  await page.getByRole('button', { name: '隐藏金额', exact: true }).click();
  assert.equal(/[¥￥]\s*[0-9]/.test(await page.locator('.page').innerText()), false);
  await expect(page.locator('.home-spending-bar')).toHaveCount(0);
  await page.getByRole('button', { name: '显示金额', exact: true }).click();
  for (const label of labels) {
    await open(label.trim());
    await expect(page.locator('.page-head h1')).toBeVisible();
    assert.equal(await page.locator('.inspector').count(), 0);
  }
  await open('生活缴费');
  await expect(page.getByText('暂无缴费记录', { exact: true })).toBeVisible();
  await expect(page.locator('.utility-total strong')).toHaveText('¥0.00');
  await page.screenshot({ path: 'artifacts/product-utility-empty-desktop.png' });
  for (const [name, amount, target] of [['水费', '38.50', '00123456'], ['电费', '126.80', '12345678'], ['燃气费', '46.20', '87654321']]) {
    if (await page.getByRole('heading', { name: '支付成功', exact: true }).count()) await open('生活缴费');
    await page.getByRole('group', { name: '缴费类型', exact: true }).getByRole('button', { name, exact: true }).click();
    await page.getByLabel('缴费户号').fill(target);
    await page.getByLabel('支付金额（元）').fill(amount);
    await page.getByLabel('支付银行卡', { exact: false }).selectOption('debit');
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await expect(page.locator('.service-journey [aria-current="step"]')).toContainText('核对确认');
    await expect(page.locator('.service-review')).toContainText(target);
    await page.getByRole('button', { name: '修改信息', exact: true }).click();
    assert.equal(await page.getByLabel('缴费户号').inputValue(), target);
    assert.equal(await page.getByLabel('支付金额（元）').inputValue(), amount);
    await page.getByRole('button', { name: '下一步', exact: true }).click();
    await page.getByLabel('支付密码').fill('111111');
    await page.getByRole('button', { name: '确认支付', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('支付密码不正确');
    await page.getByLabel('支付密码').fill('123456');
    await page.getByRole('button', { name: '确认支付', exact: true }).click();
    await expect(page.getByRole('heading', { name: '支付成功', exact: true })).toBeVisible();
  }
  const after = await state();
  assert.equal(initial.balance - after.balance, 21150);
  await expect(page.locator('.utility-total strong')).toHaveText('¥211.50');
  await page.locator('.utility-legend').getByRole('button', { name: /水费/ }).click();
  assert.equal(await page.locator('.utility-record').count(), 1);
  await page.locator('.utility-record').click();
  await page.getByRole('button', { name: '再次缴费' }).click();
  assert.equal(await page.getByLabel('缴费户号').inputValue(), '00123456');
  assert.equal(await page.getByLabel('支付金额（元）').inputValue(), '');
  assert.equal((await state()).balance, after.balance);
  await page.getByRole('button', { name: '看全部', exact: true }).click();
  await page.locator('.view-scroll').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/product-utility-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/product-utility-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('.utility-columns button').first().click();
  await expect(page.getByText('暂无缴费记录', { exact: true })).toBeVisible();
  await open('卡片');
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  await tabs.first().focus(); await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press('End'); await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight'); await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  assert.equal(await page.locator('.card-feed .row-item').count(), 3);
  await page.getByRole('button', { name: '隐藏卡号与金额' }).click();
  assert.ok(!/8826|6642|3901|¥\d/.test(await page.locator('.card-detail').innerText()));
  assert.ok(!(await tabs.first().getAttribute('aria-label')).includes('8826'));
  await page.getByRole('button', { name: '显示卡号与金额' }).click();
  await page.locator('.view-scroll').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/product-cards-mobile.png' });
  await page.setViewportSize({ width: 1560, height: 1080 });
  await page.screenshot({ path: 'artifacts/product-cards-desktop.png' });
  await page.getByRole('button', { name: '冻结这张卡' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '冻结', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click();
  await expect(page.locator('.card-state-label')).toHaveText('已冻结');
  for (const button of await page.getByRole('switch').all()) assert.equal(await button.isDisabled(), true);
  await page.getByRole('button', { name: '解除冻结' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '解冻', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '关闭' }).click();
  await expect(page.locator('.card-state-label')).toHaveText('正常使用');
  await open('账单');
  await page.getByRole('button', { name: '生活缴费', exact: true }).click();
  assert.equal(await page.locator('.day-groups .row-item').count(), 3);
  await expect(page.locator('.bills-day b')).toHaveText('−¥211.50');
  await open('储蓄计划');
  await page.getByLabel('目标名称').fill('旅行基金');
  await page.getByLabel('目标金额（元）').fill('3000');
  await page.getByLabel('目标日期').fill('2027-04-14');
  await page.getByRole('button', { name: '保存目标' }).click();
  await expect(page.locator('.savings-goal h3')).toHaveText('旅行基金');
  await page.getByRole('button', { name: '修改目标', exact: true }).click();
  await expect(page.getByLabel('目标名称')).toBeFocused();
  await page.getByRole('button', { name: '取消修改', exact: true }).click();
  await page.locator('.view-scroll').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/product-savings-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const label of labels) {
    await open(label.trim());
    await expect(page.locator('.assistant-home')).toHaveCSS('bottom', '32px');
    await page.locator('.view-scroll').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label);
    const geometry = await page.evaluate(() => ({ route: document.querySelector('.app-shell').className, title: document.querySelector('.page-head h1')?.textContent,
      content: document.querySelector('.view-scroll').getBoundingClientRect().bottom,
      margin: getComputedStyle(document.querySelector('.view-scroll')).marginBottom,
      homeBottom: getComputedStyle(document.querySelector('.assistant-home')).bottom,
      orb: document.querySelector('.assistant-orb').getBoundingClientRect().top,
      home: document.querySelector('.assistant-home').getBoundingClientRect().top }));
    assert.ok(geometry.content <= Math.min(geometry.orb, geometry.home), `${label}: floating controls must not cover business content ${JSON.stringify(geometry)}`);
  }
  await open('生活缴费');
  await expect(page.locator('.utility-total strong')).toHaveText('¥211.50');
  await page.reload(); await expect(page.locator('.hero-amount')).toHaveText('¥12,649.00');
  await open('生活缴费'); await expect(page.locator('.utility-record')).toHaveCount(3);
  assert.deepEqual(errors, []);
  console.log('Product UI passed: 13 routes desktop/mobile, ledger-derived utility reports, 3 payment flows, repeat prefill, month/category filters, card keyboard/privacy/freeze, savings edit focus, reload persistence.');
} finally { await browser.close(); }
