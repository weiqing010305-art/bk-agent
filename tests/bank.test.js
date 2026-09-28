import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, transfer, totals, accountOf, ledgerVersion, newAccountSeed, money } from '../src/domain/bank.js';
import { buildDataModel } from '../src/services/banking.js';
import { detectAnomalies, analyze, dispose, assessTransaction, SUPPRESSION } from '../src/services/anomaly.js';
import { checkLimits, limitBoard, LIMIT_TYPE } from '../src/services/limits.js';

/* ── 测试脚手架：造小账本，逐条验规则 ─────────────────────────────────────
   小账本自己造，不依赖演示数据 —— 演示数据一改，规则测试不该跟着碎。
   tx 参数：[id, 类型, 金额(分,负=支出), 'YYYY-MM-DDTHH:MM', 对手方] */
const mk = ([id, category, amount, at, counterparty = '某商户'], extra = {}) => {
  const ts = at.length === 10 ? at + 'T00:00' : at;      // 只有日期就补午夜：Date.parse('2026-03-01') 是 NaN，时间窗会全乱
  return { id, name: counterparty, category, amount, at: ts, date: ts.slice(0, 10),
    hour: Number(ts.slice(11, 13)), counterparty, method: category === '转账' ? 'transfer' : 'card', ...extra };
};
/** history：基线；probe：要评的那几笔（同一批 = 一个时点）。 */
const fire = (history, probe, ruleId) =>
  detectAnomalies([...history, ...probe].map(mk), { evaluate: probe.map(p => p[0]) })
    .hits.filter(h => h.ruleId === ruleId).length;
/* 基线日期要落在评测日（2026-09-26）之前的 90 天窗口内，否则统计规则看不到它。 */
const long = '2026-08-01T12:00';

/* ══ 1. 余额拆分 ═════════════════════════════════════════════════════════ */
test('余额拆成 available/frozen/pending，且四则恒等式成立', () => {
  for (const s of [seed(), newAccountSeed()]) {
    const a = accountOf(s);
    assert.equal(a.available + a.frozen + a.pending, a.total, 'available+frozen+pending 必须等于 total');
    assert.equal(s.balance, a.available, 'balance 是 available 的别名（老页面靠它活着）');
    assert.equal(s.total, a.total, 'normalize 要把 total 落到账本上');
  }
});
test('账本恒等式：期初 + 全部流水 === 期末可用（drift 必须为 0）', () => {
  const s = seed();
  assert.equal(s.opening + s.transactions.reduce((a, x) => a + x.amount, 0), s.balance);
  assert.equal(s.drift, 0);
  assert.ok(s.opening > 0 && s.balance > 0);
});
test('演示数据规模够驱动规则：账本 ≥60 笔、跨越 ≥90 天、埋点异常 ≥15 笔', () => {
  const s = seed();
  const dates = s.transactions.map(x => x.date).sort();
  const days = Math.round((Date.parse(dates.at(-1)) - Date.parse(dates[0])) / 86400000);
  assert.ok(s.transactions.length >= 60, '交易数 ' + s.transactions.length);
  assert.ok(days >= 90, '跨越 ' + days + ' 天');
  assert.ok(s.transactions.filter(x => /^d/.test(x.id)).length >= 15, '埋点样本要够回归用');
});
test('转账只动可用余额，且只校验可用余额（冻结与在途动不了）', () => {
  const before = seed();
  const after = transfer(before, { id: 't1', contactId: 'zhang', amount: 30000 });
  assert.equal(after.available, before.available - 30000);
  assert.equal(after.frozen, before.frozen);
  assert.equal(after.pending, before.pending);
  assert.equal(accountOf(after).available + after.frozen + after.pending, after.total);
  assert.equal(totals(after).spending, totals(before).spending + 30000);
  assert.equal(transfer(after, { id: 't1', contactId: 'zhang', amount: 30000 }), after, '同 id 重试幂等');
});
test('TOCTOU：草稿快照过期后拒绝记账，不照扣', () => {
  const before = seed();
  const stamp = ledgerVersion(before);
  assert.equal(before.completed.length, 0);
  const mid = transfer(before, { id: 'mid', contactId: 'zhang', amount: 1000 });   // 中间有人动过账
  assert.throws(() => transfer(mid, { id: 'now', contactId: 'zhang', amount: 1000, expect: stamp }), /余额刚刚发生变化/);
  const ok = transfer(mid, { id: 'now', contactId: 'zhang', amount: 1000, expect: ledgerVersion(mid) });
  assert.equal(ok.available, mid.available - 1000);
});
test('非法转账不改账本：金额非法、收款人未知、余额不足', () => {
  const s = seed();
  const snapshot = JSON.stringify(s.transactions.length);
  for (const amount of [0, -1, 1.2, NaN, s.balance + 1]) assert.throws(() => transfer(s, { id: 'bad' + amount, contactId: 'zhang', amount }));
  assert.throws(() => transfer(s, { id: 'bad2', contactId: 'nobody', amount: 100 }));
  assert.equal(s.transactions.length, Number(snapshot));
  assert.equal(s.balance, 4632500);
});
test('拆分转账堵死「同时发两笔都显示够」：先用掉大半，第二笔就失败', () => {
  const s = seed();
  const half = s.available;
  const one = transfer(s, { id: 'half', contactId: 'zhang', amount: half - 1000 });
  assert.equal(one.available, 1000);
  assert.throws(() => transfer(one, { id: 'two', contactId: 'zhang', amount: 5000 }), /余额不足/);
});

/* ══ 2. 逐条规则：正例 + 反例 ═══════════════════════════════════════════ */
const amtHist = Array.from({ length: 30 }, (_, i) => ['h' + i, '购物', -(100000 + i * 100), long, '某商户']);
test('R-AMT-01 统计偏离：须有 ≥30 笔同类目基线且偏离 >3σ、金额 ≥¥1000', () => {
  const probe = [['p1', '购物', -318000, '2026-09-26T21:10', '某商户']];
  assert.equal(fire(amtHist, probe, 'R-AMT-01'), 1, '3σ 之外应命中');
  assert.equal(fire(amtHist, [['p2', '购物', -101000, '2026-09-26T21:10', '某商户']], 'R-AMT-01'), 0, '基数附近的金额不该报');
  assert.equal(fire(amtHist.slice(0, 5), probe, 'R-AMT-01'), 0, '基线不足 30 笔不报（统计量不可用）');
  assert.equal(fire(amtHist, [['p3', '购物', -500, '2026-09-26T21:10', '某商户']], 'R-AMT-01'), 0, '金额 <¥1000 不报');
});
test('R-AMT-02 稳健偏离：金额 ≥ max(3×P95, 5×中位数) 且 ≥¥2000', () => {
  const hist = Array.from({ length: 20 }, (_, i) => ['q' + i, '订阅', -100000, long, '某商户']);
  /* 阈值 = max(3×P95, 5×中位数)：20 笔 ¥1000 时 P95=¥1000、中位数=¥1000 → 阈值 ¥5000。
     所以 ¥5000 命中、¥4999 不命中（边界两侧各验一次）。 */
  assert.equal(fire(hist, [['p', '订阅', -500000, '2026-09-26T10:00', '某商户']], 'R-AMT-02'), 1, '¥5000 恰在阈值上');
  assert.equal(fire(hist, [['p', '订阅', -499900, '2026-09-26T10:00', '某商户']], 'R-AMT-02'), 0, '阈值下一分不报');
  assert.equal(fire([], [['p', '订阅', -200000, '2026-09-26T10:00', '某商户']], 'R-AMT-02'), 0, '零历史归 R-MER-01 管，不在这里报');
});
test('R-AMT-03 冷启动绝对阈值：历史 <30 笔且金额 ≥¥5000', () => {
  const hist = [['c1', '餐饮', -50000, long, '某商户'], ['c2', '餐饮', -52000, long, '某商户']];
  assert.equal(fire(hist, [['p', '餐饮', -800000, '2026-09-26T10:00', '某商户']], 'R-AMT-03'), 1);
  assert.equal(fire(hist, [['p', '餐饮', -499900, '2026-09-26T10:00', '某商户']], 'R-AMT-03'), 0, '¥4999 不报');
});
test('R-AMT-04 贴近报告线：[49000,50000) 等三档区间', () => {
  const p = amt => [['p', '转账', -amt, '2026-09-26T10:00', '某商户']];
  assert.equal(fire([], p(4900000), 'R-AMT-04'), 1, '¥49,000 命中');
  assert.equal(fire([], p(1950000), 'R-AMT-04'), 1, '¥19,500 命中');
  assert.equal(fire([], p(19950000), 'R-AMT-04'), 1, '¥199,500 命中');
  assert.equal(fire([], p(5000000), 'R-AMT-04'), 0, '¥50,000 恰好到线，不算贴近');
  assert.equal(fire([], p(4800000), 'R-AMT-04'), 0, '¥48,000 低于区间');
  assert.equal(fire([], p(2000000), 'R-AMT-04'), 0, '¥20,000 高于区间上界');
});
test('R-AMT-05 拆分规避：24 小时内 ≥3 笔、单笔 <¥5 万、累计 ≥¥5 万', () => {
  const split = [
    ['s1', '转账', -2000000, '2026-09-28T10:05', '周涛'],
    ['s2', '转账', -2000000, '2026-09-28T10:40', '周涛'],
    ['s3', '转账', -2000000, '2026-09-28T11:20', '周涛'],
  ];
  assert.equal(fire([], split, 'R-AMT-05'), 1, '等额三笔合并成一条');
  assert.equal(fire([], split.slice(0, 2), 'R-AMT-05'), 0, '只有两笔不算拆分');
  assert.equal(fire([], split.map(r => [r[0], r[1], -1000000, r[3], r[4]]), 'R-AMT-05'), 0, '累计 ¥3 万不到线');
  assert.equal(fire([], split.map(r => [r[0], r[1], r[2], '2026-09-2' + (4 + 2 * Number(r[0][1])) + 'T10:00', r[4]]), 'R-AMT-05'), 0, '间隔超 24 小时不算同一窗口');
});
test('R-TIME-01 深夜大额：23:00–06:00 且 ≥¥3000 且历史深夜占比 <5%', () => {
  const hist = [['h', '购物', -30000, long, '某商户']];
  assert.equal(fire(hist, [['p', '购物', -520000, '2026-09-26T02:15', '某商户']], 'R-TIME-01'), 1, '凌晨 2 点命中');
  assert.equal(fire(hist, [['p', '购物', -520000, '2026-09-26T23:30', '某商户']], 'R-TIME-01'), 1, '23:30 命中');
  assert.equal(fire(hist, [['p', '购物', -520000, '2026-09-26T22:40', '某商户']], 'R-TIME-01'), 0, '22:40 不在窗口内');
  assert.equal(fire(hist, [['p', '购物', -290000, '2026-09-26T02:15', '某商户']], 'R-TIME-01'), 0, '¥2900 不到 ¥3000');
});
test('R-FREQ-01 频次异常：10 分钟内 ≥3 笔且当日笔数 >4×日均', () => {
  const three = [['f1', '购物', -30000, '2026-09-26T07:05', '某商户'], ['f2', '购物', -30000, '2026-09-26T07:08', '某商户'], ['f3', '购物', -30000, '2026-09-26T07:11', '某商户']];
  assert.equal(fire([], three, 'R-FREQ-01'), 3, '三笔互相都在同一个 10 分钟窗里，各命中一次（告警层再合并）');
  assert.equal(fire([], three.slice(0, 2), 'R-FREQ-01'), 0, '两笔不算高频');
  const spread = three.map((r, i) => [r[0], r[1], r[2], '2026-09-26T1' + (i * 2) + ':05', r[4]]);
  assert.equal(fire([], spread, 'R-FREQ-01'), 0, '拉开到 10 分钟之外不算');
});
test('R-FREQ-02 卡测试：10 分钟内 ≥5 笔、单笔 ≤¥10、商户 ≥3 个', () => {
  const test5 = Array.from({ length: 5 }, (_, i) => ['k' + i, '购物', -(i + 1) * 100, '2026-09-29T03:1' + i, '商户' + i]);
  /* 五笔互相都在同一个 10 分钟窗里，但它们是一次行为 —— 检测阶段就合并成一条告警。 */
  assert.equal(fire([], test5, 'R-FREQ-02'), 1, '同一批卡测试合并成一条');
  assert.equal(detectAnomalies(test5.map(mk)).hits.find(h => h.ruleId === 'R-FREQ-02').group.length, 5, '证据里要能看到合并了 5 笔');
  const oneShop = test5.map(r => [r[0], r[1], r[2], r[3], '同一商户']);
  assert.equal(fire([], oneShop, 'R-FREQ-02'), 0, '同一商户不算卡测试（可能是重试）');
  const big = test5.map((r, i) => [r[0], r[1], -(i + 1) * 2000, r[3], r[4]]);
  assert.equal(fire([], big, 'R-FREQ-02'), 0, '单笔 >¥10 不算试刷（试刷的特征是「金额极小」）');
  assert.equal(fire([], test5.slice(0, 4), 'R-FREQ-02'), 0, '只有 4 笔不算');
});
test('R-MER-01 首次出现的类目：近 180 天没出现过且 ≥¥2000', () => {
  const hist = [['h', '餐饮', -30000, long, '某商户']];
  assert.equal(fire(hist, [['p', '出行', -500000, '2026-09-26T10:00', '携程']], 'R-MER-01'), 1, '新类目 + 大额');
  assert.equal(fire(hist, [['p', '出行', -100000, '2026-09-26T10:00', '携程']], 'R-MER-01'), 0, '¥1000 不到阈值');
  assert.equal(fire([...hist, ['h2', '出行', -30000, long, '携程']], [['p', '出行', -500000, '2026-09-26T10:00', '携程']], 'R-MER-01'), 0, '类目出现过就不算首次');
  assert.equal(fire(hist, [['p', '出行', -500000, '2026-09-26T10:00', '青禾科技有限公司']], 'R-MER-01'), 0, '白名单对手方不报');
});
test('R-MER-02 高风险类目：赌博/加密货币/境外博彩/预付卡，任意金额', () => {
  assert.equal(fire([], [['p', '赌博', -100, '2026-09-26T10:00', '某投注站']], 'R-MER-02'), 1, '¥1 也要报');
  assert.equal(fire([], [['p', '购物', -100, '2026-09-26T10:00', 'Binance']], 'R-MER-02'), 1, '对手方命中名单');
  assert.equal(fire([], [['p', '购物', -100, '2026-09-26T10:00', '某商户']], 'R-MER-02'), 0, '普通消费不报');
});
test('R-ACCT-01 睡眠账户复活：≥180 天无交易且首笔 ≥¥5000', () => {
  const hist = [['old', '转账', -50000, '2026-03-01T10:00', '王建国']];
  assert.equal(fire(hist, [['p', '转账', -600000, '2026-09-30T15:00', '李强']], 'R-ACCT-01'), 1);
  assert.equal(fire(hist, [['p', '转账', -300000, '2026-09-30T15:00', '李强']], 'R-ACCT-01'), 0, '¥3000 不到 ¥5000');
  const recent = [['r', '转账', -50000, '2026-08-20T10:00', '王建国']];
  assert.equal(fire(recent, [['p', '转账', -600000, '2026-09-30T15:00', '李强']], 'R-ACCT-01'), 0, '只有 29 天没交易');
});
test('R-BEN-01 首次收款人 + 大额：首次向该人转账且 ≥¥1000', () => {
  assert.equal(fire([], [['p', '转账', -600000, '2026-09-30T15:00', '李强']], 'R-BEN-01'), 1);
  assert.equal(fire([], [['p', '转账', -50000, '2026-09-30T15:00', '李强']], 'R-BEN-01'), 0, '¥500 不到阈值');
  assert.equal(fire([], [['p', '转账', -600000, '2026-09-30T15:00', '青禾科技有限公司']], 'R-BEN-01'), 0, '雇主代发白名单');
  const seen = [['s', '转账', -60000, long, '李强']];
  assert.equal(fire(seen, [['p', '转账', -600000, '2026-09-30T15:00', '李强']], 'R-BEN-01'), 0, '转过的人不算首次');
});
test('边界：空账本、单笔、全是收入 —— 一条规则都不该误报', () => {
  assert.deepEqual(detectAnomalies([]).hits, []);
  assert.deepEqual(detectAnomalies([mk(['only', '餐饮', -30000, '2026-09-26T12:00', '老乡鸡'])]).hits, []);
  const income = [['i1', '收入', 1500000, '2026-09-05T09:00', '青禾科技有限公司'],
    ['i2', '收入', 18000000, '2026-09-29T09:00', '青禾科技有限公司'], ['i3', '收入', 900000, '2026-09-30T02:00', '本人转账']];
  const r = detectAnomalies(income.map(mk));
  assert.deepEqual(r.hits, [], '收入不进异常规则');
  assert.deepEqual(analyze([]).alerts, []);
});

/* ══ 3. 评分合成与分档处置 ═══════════════════════════════════════════════ */
test('评分按报告 §4.4 合成，档位按 40/70/90 切', () => {
  const a = { txId: 'x', ruleId: 'R-AMT-01', baseWeight: 25, weight: 25, method: 'transfer', evidence: 'e' };
  assert.equal(dispose(a).score, 25, '单条 25 分 → 放行');
  assert.equal(dispose(a).disposition, 'pass');
  const many = assessTransaction({ id: 'x' }, Array.from({ length: 6 }, () => ({ ...a, id: 'x' })));
  assert.equal(many.score, 100, '六条 25 分合成 150 → 封顶 100');
  assert.equal(many.disposition, 'reject');
  const sum = assessTransaction({ id: 'x' }, [{ ...a, id: 'x' }, { ...a, id: 'x' }]);
  assert.equal(sum.score, 50, '两条 25 分合成 50');
  assert.equal(sum.disposition, 'confirm');
  assert.equal(dispose({ ...a, baseWeight: 20, weight: 20 }).disposition, 'pass', '<40 放行');
  assert.equal(dispose({ ...a, baseWeight: 35, weight: 35, method: 'transfer' }).disposition, 'pass', '35 分仍然放行');
  assert.equal(dispose({ ...a, baseWeight: 40, weight: 40, method: 'transfer' }).disposition, 'confirm', '40–69 二次确认');
  assert.equal(dispose({ ...a, baseWeight: 45, weight: 45, method: 'transfer' }).disposition, 'confirm', '45×1.0=45');
  assert.equal(dispose({ ...a, baseWeight: 45, weight: 45, method: 'card' }).score, 41, '卡片消费系数 0.9');
});
test('权重 ≥55 的规则直接拒绝，不参与分数合成', () => {
  const card = dispose({ txId: 'x', ruleId: 'R-FREQ-02', baseWeight: 55, weight: 55, method: 'card', evidence: 'e' });
  assert.equal(card.disposition, 'reject');
  assert.equal(card.hardReject, true);
  assert.equal(card.freezeCard, true, '卡测试要建议冻结卡');
  assert.equal(card.score, 100);
});

/* ══ 4. 误报抑制 ════════════════════════════════════════════════════════ */
test('白名单对手方不告警，但要留痕（说得出「为什么这一笔不管」）', () => {
  const s = seed();
  const salary = s.transactions.filter(x => x.id === 'd7').map(x => x.id);
  const r = detectAnomalies(s.transactions, { evaluate: salary });
  assert.deepEqual(r.hits, [], '工资补发不报');
  /* 命中规则但对手方在名单里（这里是雇主/已签约代扣）→ 不告警，但抑制原因要落库。 */
  const plant = s.transactions.filter(x => x.id === 'd7' || x.id === 'd17').map(x => x.id);
  const r2 = detectAnomalies(s.transactions, { evaluate: plant });
  assert.deepEqual(r2.suppressions, [], 'd7 的对手方命中白名单，规则都没跑起来');
  const fake = [{ ...s.transactions.find(x => x.id === 'd7'), id: 'w1', counterparty: '账户安全险', amount: -900000, category: '购物', method: 'card' }];
  const r3 = detectAnomalies([...s.transactions, ...fake], { evaluate: ['w1'] });
  assert.deepEqual(r3.hits, [], '白名单对手方不告警');
  assert.ok(r3.suppressions.some(x => x.txId === 'w1'), '命中但被白名单挡下的要留痕');
});
test('时间衰减：同一规则 + 同一对手方 7 天内不重复告警', () => {
  const s = seed();
  const probe = [['t1', '转账', -600000, '2026-09-26T15:00', '李强'], ['t2', '转账', -600000, '2026-09-28T15:00', '李强']];
  const r = analyze([...s.transactions.filter(x => x.id !== 'd17'), ...probe.map(mk)], { evaluate: ['t1', 't2'] });
  assert.ok(r.hits.some(h => h.id === 't1' && h.ruleId === 'R-BEN-01'), '第一次转给新收款人照报');
  assert.ok(!r.hits.some(h => h.id === 't2' && h.ruleId === 'R-BEN-01'), '隔两天再转同一个人不重复告警');
  assert.ok(r.dropped.some(d => d.txId.startsWith('t2') && d.reason.includes('时间衰减')));
  assert.equal(SUPPRESSION.decayDays, 7);
});
test('频率上限：每天最多 2 次二次确认，超出转人工复核（防确认疲劳）', () => {
  /* 自造一小本账，避免演示账本里的账户级规则（静默期等）叠进来干扰这条断言。
     三条都命中 R-AMT-03（冷启动，20）+ R-BEN-01（首次收款人，30）= 50 分 → 都在「待确认」档，
     但每天只放行 2 笔，第 3 笔整笔压成人工复核。这就是防确认疲劳。 */
  const day = [['c1', '转账', -600000, '2026-09-29T09:00', '甲'], ['c2', '转账', -600000, '2026-09-29T10:00', '乙'],
    ['c3', '转账', -600000, '2026-09-29T11:00', '丙']];
  const r = analyze(day.map(mk), { evaluate: ['c1', 'c2', 'c3'] });
  /* 一笔交易可能命中多条规则 → 告警列表里是多行，但「问用户几次」按**交易**算，不是按行算。 */
  const ids = d => [...new Set(d.map(a => a.id))];
  const confirmed = ids(r.alerts.filter(a => a.disposition === 'confirm'));
  assert.equal(confirmed.length, SUPPRESSION.confirmPerDay, '当天最多 ' + SUPPRESSION.confirmPerDay + ' 笔待确认，实际 '
    + confirmed.length + '：' + confirmed.join(','));
  assert.deepEqual(ids(r.alerts.filter(a => a.disposition === 'review')), ['c3'], '第三笔整笔转人工复核');
  assert.ok(r.alerts.every(a => a.disposition === 'confirm' ? a.score >= 40 : true), '待确认档要 ≥40 分');
  assert.ok(r.dropped.some(d => d.reason.includes('频率上限')), '降级原因要留痕（说得出为什么不让用户确认）');
  assert.equal(SUPPRESSION.confirmPerDay, 2);
});
test('睡眠户复活只报一次：静默期结束后的第一笔才算「复活」', () => {
  const s = seed();
  const r = analyze(s.transactions, { evaluate: ['d1b', 'd17', 'd6'] });
  assert.deepEqual(r.alerts.filter(a => a.ruleId === 'R-ACCT-01').map(a => a.id), ['d1b'],
    '一段静默期只打扰一次：报静默结束后的第一笔');
  assert.ok(r.dropped.some(d => d.ruleId === 'R-ACCT-01' && d.reason.includes('同一段静默期')), '重复的要有留痕');
  assert.match(r.hits.find(h => h.ruleId === 'R-ACCT-01').evidence, /209 天无交易/);
  assert.equal(r.txCount, new Set(r.alerts.map(a => a.id)).size, 'txCount 是「被标记的交易笔数」，不是告警行数');
});
test('用户反馈闭环：「这是我本人」→ 该规则对该对手方降权 30%', () => {
  const s = seed();
  const feedback = { 'R-BEN-01:李强': { until: '2026-10-30' } };
  const probe = [['f1', '转账', -600000, '2026-09-27T14:00', '李强']];
  const r = detectAnomalies([...s.transactions, ...probe.map(mk)], { evaluate: ['f1'], feedback });
  const hit = r.hits.find(h => h.ruleId === 'R-BEN-01');
  assert.equal(hit.baseWeight, 30, 'R-BEN-01 原始权重');
  assert.equal(hit.weight, Math.round(30 * SUPPRESSION.feedbackFactor), '降权 30% → 21');
  assert.match(hit.evidence, /降权 30%/);
});

/* ══ 5. 演示账本端到端：埋点必须都能解释 ═════════════════════════════════ */
test('演示账本：每条埋点异常都能给出 ruleId + weight + evidence，基线零误报', () => {
  const s = seed();
  const planted = s.transactions.filter(x => /^d/.test(x.id)).map(x => x.id);
  const r = analyze(s.transactions, { evaluate: planted });
  assert.ok(planted.includes('d1b'), '静默期复活那条埋点要存在');
  /* 埋点 → 期望规则。d3-d5（拆分）与 d6（同对手方 7 天内第二次）由 d2/d18 代表示——
     它们被时间衰减与集群合并收进那两条告警里，这正是误报抑制在起作用。 */
  const expect = { d1: 'R-AMT-01', d1b: 'R-ACCT-01', d2: 'R-AMT-04', d3: 'R-AMT-05', d7: '（白名单，不报）',
    d9: 'R-MER-01', d10: 'R-FREQ-02', d15: 'R-TIME-01', d16: 'R-MER-02', d18: 'R-BEN-01' };
  for (const [id, ruleId] of Object.entries(expect)) {
    if (ruleId.startsWith('（')) { assert.ok(!r.hits.some(h => h.id === id), id + ' 不该有命中'); continue; }
    const hit = r.hits.find(h => h.id === id && h.ruleId === ruleId);
    assert.ok(hit, id + ' 应命中 ' + ruleId + '，实际 ' + r.hits.filter(h => h.id === id).map(h => h.ruleId).join(','));
    assert.ok(hit.weight > 0 && hit.evidence.length > 10, '命中必须带权重与证据');
  }
  const all = analyze(s.transactions);
  const noise = all.alerts.filter(a => !/^d/.test(a.id));
  assert.deepEqual(noise.map(a => a.id), [], '基线交易不该产生告警');
});
test('冷启动样本（新开户 8 笔）走绝对阈值，而不是统计量', () => {
  const n = newAccountSeed();
  const r = analyze(n.transactions, { evaluate: ['n8'] });
  const rules = r.hits.map(h => h.ruleId);
  assert.ok(rules.includes('R-AMT-03'), '冷启动要有绝对阈值兜底');
  assert.ok(rules.includes('R-BEN-01'), '首次收款人也该报');
  assert.ok(!rules.includes('R-AMT-01'), '样本 8 笔 <30，统计类规则必须闭嘴（不硬编一个均值出来）');
  /* 两条权重加起来 50 → 二次确认；分数 <40 时只留痕不打扰（处置档位在下面单独测）。 */
  assert.equal(assessTransaction({ id: 'n8' }, r.hits).disposition, 'confirm');
});

/* ══ 6. 限额一等对象 ════════════════════════════════════════════════════ */
test('限额是对象不是常量：多字段 + 时间窗 + 周期', () => {
  const board = limitBoard(seed());
  assert.ok(board.length >= 4);
  const daily = board.find(l => l.limitType === LIMIT_TYPE.DAILY);
  assert.ok(daily.limitType && daily.maxAmount > 0 && daily.resetAt, '周期限额要有额度与重置日');
  assert.ok(typeof daily.window === 'string');
  /* 时间窗是限额的一等字段：夜间该限额直接失效，校验要拦下来（下面「时间窗外拒绝」那条验行为）。 */
  assert.ok(board.some(l => l.window.includes('–')), '限额要带生效时间窗（夜间收紧）');
});
test('限额校验：超单笔拒绝、超日累计拒绝、时间窗外拒绝、额度内放行', () => {
  const s = seed();
  assert.equal(checkLimits(s, { amount: 6000000, scope: 'transfer', at: '2026-09-30T10:00' }).ok, false);
  /* 日累计要看当天已经花了多少 —— 演示账本在 2026-09-28 当天已转 ¥72,800，
     这笔 ¥30,000 会把非柜面日累计顶穿。 */
  assert.equal(checkLimits(s, { amount: 3000000, scope: 'transfer', at: '2026-09-28T10:00' }).ok, false, '当日已用 ¥72,800 后再转 ¥30,000 超日累计');
  const night = checkLimits(s, { amount: 1000, scope: 'transfer', at: '2026-09-30T02:00' });
  assert.equal(night.ok, false);
  assert.match(night.blocked, /受理时段/);
  const fresh = newAccountSeed();
  assert.equal(checkLimits(fresh, { amount: 1000000, scope: 'transfer', at: '2026-09-30T10:00' }).ok, true);
  assert.ok(checkLimits(fresh, { amount: 1000000, scope: 'transfer', at: '2026-09-30T10:00' }).remaining > 0);
});
test('buildDataModel 暴露余额拆分、限额与异常，且 balance 仍是可用余额', () => {
  const s = seed();
  const d = buildDataModel(s);
  assert.equal(d.balance, d.available);
  assert.equal(d.balanceText, '¥' + money(s.available));
  assert.equal(d.available + d.frozen + d.pending, d.total);
  assert.equal(d.balanceParts.length, 3);
  assert.ok(d.anomalyCount > 0 && d.anomalies.every(a => a.ruleId && a.evidence));
  assert.ok(d.limits.length >= 4);
  assert.equal(d.transactionCount, s.transactions.length);
});
