# banking-domain-map.md 可实现规格原文摘录

> 来源文件：`bk-agent/doc/research/banking-domain-map.md`（1105 行）。以下**全部为原文/原表格摘录**，未添加任何设计意见。行号标注用于回溯。

---

## 1. §余额模型（1.1 节「余额构成（bk-agent 必须先补的模型）」，L85–L99）

> 原文 L87：「真实账户的「余额」不是一个数，是五个数：」

| 字段 | 含义 | 谁占用它 |
|---|---|---|
| `available` 可用余额 | 现在真的能动的钱 | 转账/消费校验就看它 |
| `frozen` 冻结金额 | 司法冻结、账户管控、保证金 | 银行/司法/风控 |
| `pending` 预授权/在途冻结 | 已发起但未清算的交易占款 | 卡片预授权、跨行在途、定时转账预留 |
| `posted` 已入账 | 清算完成的金额 | 记账 |
| `creditLimit` 授信额度 | 信用卡/透支可用额度 | 发卡行 |

**权威对齐（原文 L97）**

> 「TigerBeetle 的账户模型把「预授权/在途」命名为 `debits_pending`（"Money in debits_pending is reserved — that is, **it cannot be spent until the corresponding pending transfer resolves**"），已入账为 `debits_posted`；两阶段转账的三条出路是 **post（确认）/ void（撤销）/ expire（超时自动退回）**。【实证】源码原文见第 6 节 F-1。」

**给 bk-agent 的直接结论（原文 L99）**

> 「`src/domain/bank.js` 里的 `state.balance` 应升级为 `{ available, frozen, pending }`，并且**任何转账草稿只校验 `available - 本次会话已占用的 pending`**。否则「同时发起两笔转账，两笔都显示余额够」这个 bug 一定会出现。」

**不变量（原文可见的六处）**

1. L821（TigerBeetle 引文）：「"The sum of all accounts' `debits_pending` equals the sum of all accounts' `credits_pending`."（**全局守恒不变量**）」
2. L811（TigerBeetle 引文）：「"A pending transfer ... reserves its `amount` in the debit/credit accounts' `debits_pending`/`credits_pending` fields ... Pending transfers leave the `debits_posted`/`credits_posted` unmodified."」
3. 1.4 节「对账恒等式（实现时必须成立）」（L290–L295）：

```
期初余额 + 本期收入合计 − 本期支出合计 = 期末余额
期末余额 − 未达账项（在途收入 − 在途支出） = 可用余额
```

4. 1.2 前置条件（L198）：「任意转账 … 金额 ≤ 单笔限额；`amount ≤ available − pending`」
5. 7.1 缺口 1（L1008）：「余额只有一个数 → `{ available, frozen, pending, creditLimit }`，并提供 `spendable = available − pending`」
6. 7.2（L1029）：「`accountSnapshot(bank) → { available, frozen, pending, spendable }`」

**展示口径（报告要求的展示）**

- 1.1 子功能表（L50）：「余额查询 | 可用 / 冻结 / 在途 / 预授权 / 授信额度 | 低」
- 5.1 月结单结构第 2 项（L740）：「账户摘要 | 期初余额、本期收入合计、本期支出合计、期末余额、**可用余额**」
- 5.3 monthlyReport 结构（L772）：「`account: { nameMasked, accountType, openingBalance, closingBalance, availableBalance }`」
- 5.2 第 6 项（L761）：「**安全垫检查** | 月末余额能否覆盖未来 30 天固定扣费；不足则给出具体差额」

**两阶段授权的状态语义（1.2 状态机，L188–L192）**

> 「对应 TigerBeetle 的语义：`authorized` ≈ `pending`（占款但未入账）、`posted` ≈ `post_pending_transfer`（可**部分** post，余款自动退回原账户）、`cancelled/returned` ≈ `void_pending_transfer`、超时 ≈ `expire`（"If the timeout interval passes before the transfer is either posted or voided, the transfer expires and the full amount is returned to the original account"）。」

**TigerBeetle 原文引文（6.1，L809–L821，全文照录）**

> "A two-phase transfer moves funds in stages: 1. **Reserve funds** (pending transfer) 2. **Resolve funds** (post, void, or expire)"
>
> "A pending transfer ... reserves its `amount` in the debit/credit accounts' `debits_pending`/`credits_pending` fields ... Pending transfers leave the `debits_posted`/`credits_posted` unmodified."
>
> "Money in `debits_pending` is **reserved** — that is, it cannot be spent until the corresponding pending transfer resolves."
>
> "If the posted `amount` is **less than** the pending transfer's amount, then only this amount is posted, and **the remainder is restored to its original accounts**."
>
> "A pending transfer may optionally be created with a `timeout`. If the timeout interval passes before the transfer is either posted or voided, the transfer **expires and the full amount is returned** to the original account."
>
> "Accounts **cannot be deleted** after creation. This provides a strong guarantee for an **audit trail**."
>
> "The sum of all accounts' `debits_pending` equals the sum of all accounts' `credits_pending`."（全局守恒不变量）

**6.1「值得借鉴」原文（L823–L827）**

1. 「把「预授权/冻结/在途」直接建模成 `pending`，把「用户点确认」建模成 `post`，把「撤销/超时」建模成 `void`/`expire`。这给赛题的**中断、回退**一个精确、可测试的语义。」
2. 「**支持部分 post，余款自动退回**——这正是「预授权 ¥1,000 实际消费 ¥860，退 ¥140」的通用解法。」
3. 「**账户不可删、pending 全局守恒** = 审计与对账的强保证。bk-agent 的账本应当是 append-only，没有删除。」
4. 「`timeout` 用**相对秒数**而非绝对时间戳 —— 避免时钟漂移造成的语义歧义。这条对本项目的「定时转账」直接适用。」

**7.1 授权对象最小实现（L1009）**：「`authorizations[]`：`{ id, amount, status: pending/posted/void/expired, expiresAt }`」

**7.2 授权函数签名（L1033–L1036）**

```
reserve(state, { amount, payee, ttl })      → authorization   // pending
post(state, authId, { amount })             → 已入账 + 余额自动退回差额
void(state, authId)                         → 释放
expire(state, now)                          → 超时自动 void
```

---

## 2. §异常交易识别：16 条规则完整清单（第 4 节，L656–L729）

### 2.1 设计原则（原文 L660–L663）

1. 「**每条规则都必须能输出「证据」**，而不只是「一个分数」。这是赛题「审计（决策链路）」的要求。」
2. 「**冷启动要有绝对阈值兜底**：新客户没有历史，均值/方差不可用。」
3. 「**误报抑制是一等公民**：没有白名单和频率上限的规则引擎，第一天就会把用户逼疯。」
4. 「**金额基线要用稳健统计量**：用中位数（P50）和 P95，不用均值——一笔大额就会污染均值。」

### 2.2 约定（原文 L667）

> 「约定：`amt` = 本笔金额（元）；`hist90` = 近 90 天同类目交易；`med90` = 中位数；`p95_90` = 95 分位；`n_hist` = 历史笔数。」

### 2.3 规则表（16 条，原表照录，L669–L686）

| ID | 维度 | 判定条件（可直接写成 if） | 权重 | 动作 |
|---|---|---|---|---|
| **R-AMT-01** | 金额偏离（统计） | `n_hist ≥ 30` 且 `(amt − mean90) / std90 > 3` 且 `amt ≥ 1000` | 25 | 二次确认 |
| **R-AMT-02** | 金额偏离（稳健） | `amt ≥ max(3 × p95_90, 5 × med90)` 且 `amt ≥ 2000` | 25 | 二次确认 |
| **R-AMT-03** | 冷启动绝对阈值 | `n_hist < 30`（或开户 <30 天）且 `amt ≥ 5000` | 20 | 二次确认 |
| **R-AMT-04** | 结构化 / 贴近报告线 | `amt ∈ [49000, 50000)` 或 `[19000, 20000)` 或 `[199000, 200000)` | 35 | 人工复核 |
| **R-AMT-05** | 拆分规避 | 24 小时内 ≥3 笔、单笔均 < ¥50,000、累计 ≥ ¥50,000 | 45 | 人工复核 + 可疑上报评估 |
| **R-TIME-01** | 时间异常 | 当地时间 23:00–06:00 且 `amt ≥ 3000` 且 该用户历史该时段交易占比 < 5% | 20 | 二次确认 |
| **R-TIME-02** | 首次深夜跨境 | 00:00–05:00 且 跨境 且 该用户近 180 天无跨境交易 | 30 | 二次确认 + 卡片境外开关核查 |
| **R-FREQ-01** | 频次异常 | 10 分钟内 ≥3 笔 且 当日笔数 > 4 × 该用户近 30 天日均笔数 | 25 | 二次确认 |
| **R-FREQ-02** | 卡测试（card testing） | 10 分钟内 ≥5 笔 且 单笔 ≤ ¥10 且 商户/类目分散 ≥3 | 55 | **立即拒绝 + 冻结卡** |
| **R-MER-01** | 商户异常（首次类目） | 近 180 天未出现该 MCC/类目 且 `amt ≥ 2000` | 20 | 二次确认 |
| **R-MER-02** | 高风险类目 | MCC ∈ {赌博 7995、加密货币、境外博彩、预付卡} 任意金额 | 60 | 拒绝 + 人工复核 |
| **R-GEO-01** | 位置不可能 | 相邻两笔交易推算速度 > **900 km/h**，或同卡 2 小时内出现在 ≥2 个国家/地区 | 45 | 二次确认 + 卡片冻结建议 |
| **R-DEV-01** | 设备/IP 异常 | 新设备 **且** 新 IP **且** `amt ≥ 3000` | 30 | 二次确认（L3 人脸） |
| **R-ACCT-01** | 睡眠账户复活 | 该账户近 ≥180 天无交易，首笔 `amt ≥ 5000` | 35 | 二次确认 + 人工 |
| **R-BEN-01** | 首次收款人 + 大额 | 首次向该收款人转账 且 `amt ≥ 1000` | 30 | 高风险流程（L2+L3） |
| **R-BIZ-01** | 商业行为特征 | 近 30 天收款笔数 ≥20 且 对手方 ≥15 个（个人账户不得用于经营收款） | 30 | 人工复核 |

### 2.4 合规上报规则（原文 L688–L696，「不是「异常」，是**义务**」）

| ID | 条件 | 动作 | 依据 |
|---|---|---|---|
| **R-AML-01** | 当日单笔或累计：现金 ≥¥5 万；自然人境内划转 ≥¥50 万；自然人跨境 ≥¥20 万；非自然人 ≥¥200 万 | 生成大额交易报告，**5 个工作日**内提交 | 【实证】AML 办法第五条、第八条 |
| **R-AML-02** | 命中 R-AMT-05（拆分）或 R-BIZ-01 且人工确认 | 生成可疑交易报告，最迟 **5 个工作日**内提交，并完整记录分析过程 | 【实证】AML 办法第十四、十五条 |
| **R-AML-03** | 交易对手命中恐怖活动组织/人员名单 | 立即提交可疑报告并报当地人民银行 | 【实证】AML 办法第十八条 |

> 原文注（L696）：「注意第十二条：交易监测标准应参考客户身份、行为，交易的**资金来源、金额、频率、流向、性质**等异常情形。上面 16 条规则正是这五个维度的展开，可直接引用来论证规则集的完备性。」

### 2.5 评分合成与处置（原文 L700–L712）

```
score = min(100, Σ(命中规则权重) × 场景系数)
场景系数：非柜面转账 1.0 / 卡片消费 0.9 / 代扣 0.7 / 登录类 1.2
```

| 分数区间 | 处置 | 用户可见文案 |
|---|---|---|
| 0–39 | 放行 | 无 |
| 40–69 | **二次确认** | 「这笔转账和您平时的习惯不太一样，确认是您本人操作吗？」+ 显示命中的具体证据 |
| 70–89 | **挂起 + 人工复核**（或强制 L3 人脸） | 「为保护您的资金安全，需要人脸核验后才能继续」 |
| ≥90 | **拒绝** + 联系客户 | 「本次操作已被拦截，请拨打客服热线核实」 |

> 「**规则冲突处理**：任何单条权重 ≥55 的规则（R-FREQ-02、R-MER-02）**直接拒绝**，不参与分数合成。」

### 2.6 误报抑制（原文 L714–L723，「没有这一层，规则引擎不可用」）

| 机制 | 内容 |
|---|---|
| 白名单（对手方） | 本人同名账户、雇主工资代发对手方、已签约代扣商户 |
| 白名单（场景） | 用户主动在 App 内发起并完成 L3 认证的操作，24 小时内同类不再触发 |
| 时间衰减 | 命中一次后，同一规则对同一用户 7 天内不重复告警（R-FREQ-02 / R-MER-02 除外） |
| 频率上限 | 每用户每天最多 2 次二次确认；超出则直接转为人工复核（避免「确认疲劳」导致用户无脑点确认） |
| 用户反馈闭环 | 「这是我本人」→ 该规则对该用户/该商户降权 30%，持续 90 天 |
| 规则监控 | 单规则日误报率超过 20% 自动降级并告警 |

### 2.7 为什么不用 ML（原文 L725–L729）

- 「赛题要的是**可判定、可解释、可审计**。规则引擎三条都满足，ML 模型第三条很难满足。」
- 「【实证】《Reproducible Machine Learning for Credit Card Fraud Detection》把评估指标分成 **阈值型（ThresholdBased）/ 无阈值型（ThresholdFree）/ TopK 型（TopKBased）** 三类，并强调真实风控里人工复核能力有限，precision@k 才是业务指标。→ **即使将来上模型，处置层仍然是「评分 → 分档 → 出证据」**，本节的框架不用改。」
- 「建议路径：**先规则（本文件）→ 再用规则产生的标签训练模型 → 模型作为一条额外的「规则」（权重可学习）插进同一套评分框架**。」

### 2.8 相关函数签名（7.2，L1040–L1041）

```
detectAnomalies(transactions)               → [{ txId, ruleId, weight, score, evidence }]
scoreAnomalies(hits, scene)                 → { score, action }
```

### 2.9 与安全锁定的联动（1.7，L429–L435）

| 触发条件 | 动作 | 解除方式 |
|---|---|---|
| 5 分钟内验证失败 ≥3 次 | 锁定该操作 30 分钟 | 等待或人脸复核 |
| 24 小时内验证失败 ≥10 次 | 锁定账户非柜面业务 | 柜面/人脸核身 |
| 24 小时内高危交易被拦截 ≥2 次 | 强制升级为人工复核 | 客服外呼核实 |
| 单日触发异常规则 ≥5 次 | 降级非柜面限额至日常的 20% | 次日自动恢复或人工恢复 |
| 设备指纹突变 + 大额发起 | 会话失效，要求重新登录 + 人脸 | 即时 |

### 2.10 动态升级规则（3.4，L619–L630）

> 「即使金额落在「中风险」，命中下列任一条件即**升级为高风险**：」

| 条件 | 升级动作 |
|---|---|
| 首次向该收款人转账 且 金额 ≥ ¥500 | → 高风险（L2 + L3） |
| 转账发起时段在 23:00–06:00 且 金额 ≥ ¥1,000 | → 高风险 |
| 新设备 / 新 IP / 新地理位置（近 30 天未出现） | → 高风险 |
| 近 24 小时触发异常规则 ≥2 次 | → 高风险 |
| 收款人账户为新增（<24h）且金额 ≥ ¥1,000 | → 高风险 |
| 账户近 180 天无交易（睡眠户复活） | → 高风险 |
| 客户风险等级为高（如曾被惩戒、证件即将过期） | 全部操作上浮一档 |
| 风险评分 ≥70（见第 4 节） | → 高风险 + 人工复核 |

---

## 3. §限额：限额升级为一等对象的全部字段（1.7 节，L401–L415）

> 原文 L403：「Midaz 的限额对象是一个**多字段组合**，而不是「一个日累计数字」【实证，源码见 6-F3】：」

| 字段 | 取值 | 说明 |
|---|---|---|
| `limitType` | `DAILY` / `WEEKLY` / `MONTHLY` / `PER_TRANSACTION` / `CUSTOM` | 周期类型 |
| `maxAmount` | 十进制金额 | 必须 > 0 |
| `asset` | 3 位大写币种（如 CNY/USD） | 分币种 |
| `scopes` | 1–100 个作用域 | 按账户/产品/渠道 |
| `activeTimeStart` / `activeTimeEnd` | `HH:MM`，如 09:00–17:00 | **按时间段生效**——夜间可自动收紧 |
| `customStartDate` / `customEndDate` | 自定义起止 | 配合 `CUSTOM` |
| usage counter | 按周期重置；`resetAt + CounterRetentionDays` 过期 | **原子 upsert 防 TOCTOU** |

**6.3 源码原文摘录（L870–L889，全文照录）**

```go
LimitType  model.LimitType  `json:"limitType" validate:"required,limittype"
            swaggertype:"string" enums:"DAILY,MONTHLY,PER_TRANSACTION,WEEKLY,CUSTOM"`
MaxAmount  decimal.Decimal  `json:"maxAmount" validate:"required" example:"1000.00"`
Asset      string           `json:"asset" validate:"required,len=3,uppercase"`
Scopes     []model.Scope    `json:"scopes" validate:"required,min=1,max=100,dive,scopenotempty"`
ActiveTimeStart *model.TimeOfDay `json:"activeTimeStart,omitempty" example:"09:00"`
ActiveTimeEnd   *model.TimeOfDay `json:"activeTimeEnd,omitempty" example:"17:00"`
CustomStartDate *string          `json:"customStartDate,omitempty" example:"2026-11-27T00:00:00Z"`
CustomEndDate   *string          `json:"customEndDate,omitempty" example:"2026-11-29T00:00:00Z"`
```

```go
// CheckLimits evaluates all applicable limits for a transaction using
// the provided database connection. ... enabling atomic operations
// with other database changes.
// Uses atomic upsert to prevent TOCTOU race conditions.
```

> 原文 L889：「计数器生命周期：`calculateCounterExpiresAt` —— DAILY/WEEKLY/MONTHLY 用 `resetAt + CounterRetentionDays`；CUSTOM 用 `customEndDate + CounterRetentionDays`；**PER_TRANSACTION 不创建计数器**。」

**6.3「值得借鉴」原文（L891–L895）**

1. 「**限额是五元组** `{类型, 金额, 币种, 作用域, 时间窗}`，不是「日累计一个数」。尤其 `activeTimeStart/End`——夜间自动收紧限额，是真实风控的常规做法，而本项目完全没考虑。」
2. 「**限额校验与扣款必须同事务**（防 TOCTOU）。这条直接指出 bk-agent `validateTransferSlots` 当前设计的并发缺口。」
3. 「**PER_TRANSACTION 不建计数器** —— 单笔限额是纯函数，不需要状态。这个区分能省掉一整套无用的计数器。」
4. 「⚠️ License 为 Elastic License 2.0（source-available，非 OSI 认证）。**只借设计，不复制代码**。」

**限额体系子功能原文（1.7，L391）**：「限额体系 | 单笔/日累计/月累计/年累计/按渠道/按账户类型/按时间窗」

**限额对象最小实现（7.1 缺口 3，L1010）**：「`limits[]`：`{ type, maxAmount, scope, activeTimeStart, activeTimeEnd }`」

**限额函数签名（7.2，L1031）**：「`checkLimits(state, { amount, scope, at }) → { ok, limitId, remaining, resetAt }`」

**权限分级四把尺子（3.1，L538–L546）**

| 尺子 | 说明 | 证据 |
|---|---|---|
| **金额** | 单笔 + **日累计**双算（注意：是累计，不是单笔） | 【实证】非柜面单日累计 >¥5 万须数字证书 |
| **账户类型** | Ⅰ/Ⅱ/Ⅲ 类户天然不同限额 | 【实证】 |
| **渠道** | 柜面 / 智能设备 / 手机银行 / 网银 / ATM / 代扣，限额各不同 | 【实证】工行协议「对应不同非柜面渠道支出限额」 |
| **客户风险等级** | 同一类户，按客户风险等级开不同限额账户，且可升降级 | 【实证】工行协议第二条 |
| （欧盟另加）**本方欺诈率表现** | 欺诈率越低，可豁免的金额越高 | 【实证】RTS (EU) 2018/389 TRA |

---

## 4. §40 项可实现数值中与「余额 / 限额 / 异常」相关的项（第 2 节，L489–L530）

### 4.1 限额与账户额度相关

| # | 项目 | 数值 | 口径 | 等级 |
|---|---|---|---|---|
| 1 | Ⅰ类户数量 | 1 个/行 | 全行 | 【实证】 |
| 2 | Ⅱ类户数量 | ≤5 个 | 全行 | 【实证】 |
| 3 | Ⅲ类户数量 | ≤5 个 | 全行 | 【实证】 |
| 4 | Ⅱ类户日累计（入/出各） | ¥10,000 | 非绑定账户 | 【实证】 |
| 5 | Ⅱ类户年累计（入/出各） | ¥200,000 | 非绑定账户 | 【实证】 |
| 6 | Ⅲ类户出金日累计 | ¥2,000 | 消费缴费+非绑定转出 | 【实证】 |
| 7 | Ⅲ类户出金年累计 | ¥50,000 | 同上 | 【实证】 |
| 8 | Ⅲ类户余额上限 | ¥1,000 | PBC 2016 口径 | 【实证】 |
| 10 | **非柜面大额强认证线** | **单日累计 > ¥5 万** | 须数字证书/电子签名；短信不可替代 | 【实证】 |
| 13 | 小额批量支付系统限额 | 工作日 ¥5 万 / 节假日 ¥50 万 | 转账 | 【实证】 |
| 14 | 超级网银（IBPS）限额 | ¥5 万 | 单笔 | 【实证】 |
| 15 | 大额支付系统起点 | ¥0（实质无上限） | 单笔 | 【实证】 |
| 24 | 信用卡 ATM 取现 | ¥10,000/卡/日 | 累计 | 【实证】 |
| 31 | 货基 T+0 快赎 | ¥10,000/日 | 单只 + 单一销售机构 | 【实证】 |
| 40 | 单笔转账上限（本项目） | ¥1,000,000 | 现有 `MAX_TRANSFER` | 【演示值】 |

### 4.2 异常 / 上报 / 报告线相关

| # | 项目 | 数值 | 口径 | 等级 |
|---|---|---|---|---|
| 9 | 睡眠户判定 | 开户起 6 个月无交易 | 暂停非柜面 | 【实证】 |
| 11 | ATM 转账延迟 | 24 小时后到账 | 24h 内可撤销 | 【实证】 |
| 18 | 大额报告：现金 | ¥5 万 | 当日单笔或累计 | 【实证】 |
| 19 | 大额报告：自然人境内 | ¥50 万 | 同上 | 【实证】 |
| 20 | 大额报告：自然人跨境 | ¥20 万 | 同上 | 【实证】 |
| 21 | 大额报告：非自然人 | ¥200 万 | 同上 | 【实证】 |
| 22 | 报告/记录保存 | ≥5 年 | — | 【实证】 |
| 38 | 欧盟 SCA 低价值豁免 | ≤ €30/笔；累计 ≤ €100 或连续 5 笔 | PSD2 | 【实证】 |
| 39 | 欧盟 TRA 豁免 ETV | 欺诈率 ≤0.13%→€100；≤0.06%→€250；≤0.01%→€500 | RTS (EU) 2018/389 | 【实证】 |

### 4.3 余额 / 记账相关的其余项（原文其余编号，供交叉引用）

| # | 项目 | 数值 | 口径 | 等级 |
|---|---|---|---|---|
| 12 | 行内异地手续费 | ¥0 | 同一法人 | 【实证】 |
| 16 | 跨境电报费 | ¥200（≤5 份）+¥40/份 | 另加代理行费 | 【实证】 |
| 17 | 个人年度购汇额度 | US$50,000 | 便利化额度 | 【实证】 |
| 23 | 信用卡透支利率 | 上限日万分之五 / 下限 0.7 倍 | 年化 18.25% / 12.775% | 【实证】 |
| 25 | 信用卡利率调整通知 | 提前 45 个自然日 | 生效前 | 【实证】 |
| 26 | 利率调整报央行 | 提前 60 天 | — | 【实证】 |
| 27 | 信用卡免息期 | 20–50 天 | 发卡行自定 | 【惯例】 |
| 28 | 最低还款额 | 10% | 发卡行自定 | 【惯例】 |
| 29 | 循环利息 | 日万分之五 | 记账日起算 | 【惯例】 |
| 30 | 违约金 | 最低还款额未还部分 5% | 协议约定 | 【惯例】 |
| 32 | 私募合格投资者 | 净资产 ¥300 万 / 金融资产 ¥500 万 / 年收入 ¥40 万 + 2 年投资经历 | 三者满足其一 | 【实证】 |
| 33 | 理财登记时限 | 公募销售前 10 日 / 私募前 2 日 | — | 【实证】 |
| 34 | 代扣授权要素 | 收款人名/用途/账号/周期/期限 | 5 项 | 【实证】 |
| 35 | 代扣非面对面授权 | 须更高级别风控 | — | 【实证】 |
| 36 | 短信动账提醒起点 | ¥100（部分 ¥500） | 各行不同 | 【实证】 |
| 37 | 短信提醒服务费 | ¥2–3/月 | — | 【实证】 |

### 4.4 账户分类限额表（1.1，L60–L67，原表照录）

| 项 | Ⅰ类户 | Ⅱ类户 | Ⅲ类户 |
|---|---|---|---|
| 功能 | 全功能，余额与使用范围无限制 | 存款、买理财、限额消费缴费、限额向非绑定账户转出 | 限额消费缴费、限额向非绑定账户转出 |
| 出入金限制 | 入金无特殊限制；出金按**非柜面渠道支出限额**分级 | 非绑定账户转入+存现：日累计 ¥10,000 / 年累计 ¥200,000；消费缴费+向非绑定转出+取现：日累计 ¥10,000 / 年累计 ¥200,000 | 出金（消费缴费+向非绑定转出）：日累计 ¥2,000 / 年累计 ¥50,000 |
| 余额上限 | 无 | 无 | ¥1,000（PBC 2016 口径） |
| 数量上限 | 同一银行 **1 个** | ≤5 个 | ≤5 个 |
| 实体卡 | 可 | 面签后可配发 | 不可 |
| 面签增强 | — | 面签后可存取现金、非绑定账户转入 | 面签或绑定账户验证后，可非绑定账户转入 |

---

## 5. §月结单结构（第 5 节，L733–L781）

### 5.1 真实银行月结单的结构（逐项对照，原表照录 L737–L748）

| # | 板块 | 内容 | bk-agent 是否已有 |
|---|---|---|---|
| 1 | 抬头 | 银行、账户名、账号（掩码）、账单周期、出具日期 | 部分 |
| 2 | 账户摘要 | 期初余额、本期收入合计、本期支出合计、期末余额、**可用余额** | 部分（缺期初/可用） |
| 3 | 交易明细 | 日期、摘要、对方名称、对方账号（掩码）、借方、贷方、**余额（逐行）** | 部分（缺逐行余额） |
| 4 | 费用汇总 | 手续费、利息、年费、违约金 | **缺** |
| 5 | 信用卡板块 | 账单日、到期还款日、本期应还、最低还款额、循环利息、可用额度 | **缺** |
| 6 | 理财板块 | 持仓市值、申购/赎回明细、收益 | **缺** |
| 7 | 代扣板块 | 本期代扣明细与授权状态 | 部分 |
| 8 | 重要提示 | 争议提出期限、利率调整通知、隐私与费率变更 | **缺** |
| 9 | 联系方式 | 客服、争议受理渠道 | 缺 |
| 10 | 数据来源与截止时间 | — | **已有**（`provenance()` 是现有的亮点） |

### 5.2 AI Agent 应该额外总结什么（差异化点，原表照录 L754–L765）

按「越靠后越难被复制」排序：

| # | 增量 | 具体产出 | 为什么真实银行做不到 |
|---|---|---|---|
| 1 | **环比/同比结论** | 每个类目 MoM / YoY 变动额与变动率，只讲**幅度最大的 3 条** | 月结单是固定模板，不做个性化排序 |
| 2 | **结构迁移归因** | 「餐饮涨了 32%，其中 ¥860 来自新增的 4 家外卖商户」——把涨幅**归因到具体商户** | 需要跨商户聚合 + 归因逻辑 |
| 3 | **订阅体检** | N 项订阅、月合计、占支出比、涨价检测（≥10%）、**静默订阅**（90 天未使用）、一键取消入口 | 订阅识别在真实银行是独立产品 |
| 4 | **异常点标注** | 复用第 4 节规则，输出「哪几笔不正常 + 命中了什么 + 证据」 | 风控系统是内部的，不给客户看 |
| 5 | **现金流预测** | 未来 30 天：已知固定扣费、发薪日、还款日 → 月末余额预测（乐观/中性/悲观三档） | 月结单只看过去 |
| 6 | **安全垫检查** | 月末余额能否覆盖未来 30 天固定扣费；不足则给出具体差额 | 项目已有 `safeAfterText` 雏形 |
| 7 | **可执行建议（带一键动作）** | 每条建议绑定一个可执行操作：取消订阅 / 调低限额 / 设预算 / 结余转货币基金 / 提额申请 | **月结单没有动作，这是最大的空位** |
| 8 | **自然语言追问** | 「上个月外卖花了多少」「跟 8 月比呢」「哪家涨得最凶」 | 静态 PDF |
| 9 | **跨场景触发** | 由账单结论触发第 9 节联动（例：连续 3 个月订阅超支 → 建议年付/取消） | 无 |
| 10 | **可解释 + 可回溯** | 每个结论都可点开看底层交易；每个建议都可点开看依据的规则与阈值 | 审计要求 |

### 5.3 建议的报告数据结构（原文照录 L769–L781）

```
monthlyReport {
  period: { from, to, statementDate, dueDate }
  account: { nameMasked, accountType, openingBalance, closingBalance, availableBalance }
  totals:   { income, expense, net, fees, interest }
  categories: [ { name, amount, prevAmount, momPct, yoyPct, sharePct, topMerchants: [...] } ]
  subscriptions: { count, monthlyTotal, sharePct, priceHikes: [...], silent: [...] }
  anomalies: [ { txId, ruleId, score, evidence, action } ]
  forecast: { next30dFixed, nextPayday, dueDate, closingEstimate: { low, mid, high } }
  insights: [ { id, kind, headline, detail, evidenceRefs, action } ]
  provenance: { source, asOf }
}
```

### 5.4 账单关键日期（1.4，L270–L277）

| 概念 | 演示值 | 说明 |
|---|---|---|
| 账单日 | 每月 5 日 | 统计上一周期 |
| 还款日 | 每月 25 日 | 账单日后 20 天 |
| 免息期 | 20–50 天 | 账单日次日消费享最长免息期；账单日当天消费享最短 |
| 账单周期 | 上月 6 日 – 本月 5 日 | 【演示值】 |

### 5.5 账单域数值（1.4，L281–L288）

| 项 | 数值 | 等级 |
|---|---|---|
| 最低还款额 | 本期应还的 **10%**（+ 上期未还部分 + 超限部分 + 全部费用） | 【惯例】 |
| 循环利息 | 按**日利率万分之五**（年化 18.25%）从**记账日**起算，不享受免息期 | 【实证口径 + 惯例计息方式】 |
| 违约金 | 最低还款额未还部分的 **5%**，最低 ¥10（各行协议不同） | 【惯例】 |
| 账单分期手续费 | 3 期 0.75%/期、6 期 0.70%/期、12 期 0.66%/期（近似年化 13%–16%） | 【演示值】 |
| 分期提前结清 | 剩余本金 + 剩余手续费（部分银行收违约金） | 【惯例】 |
| 争议受理期限 | 账单日后 30 天内提出 | 【惯例】 |

**函数签名（7.2，L1043–L1044）**：

```
monthlyReport(bank, period)                 → 见 5.3 结构
forecastCashflow(bank, days)                → { low, mid, high, events[] }
```

---

## 6. §演示数据规模与埋点建议（7.3，L1052–L1064）

> 原文 L1054：「当前种子数据：1 个账户、2 张卡、3 个订阅、12 笔交易 —— **不足以驱动本文档任何一条规则**。最低建议：」

| 数据 | 最低条数 | 为什么 |
|---|---|---|
| 交易 | **≥ 180 天 × 平均 1.5 笔/天 ≈ 270 笔** | R-AMT-01/02 需要 `n_hist ≥ 30` 与 P95；R-TIME-01 需要时段占比 |
| 商户 | ≥ 40 个，覆盖 ≥ 8 个类目 | R-MER-01「首次出现的类目」需要历史类目集合 |
| 订阅 | ≥ 6 个（含 1 个涨价、1 个静默） | 订阅体检的涨价检测与静默检测 |
| 卡片 | ≥ 4 张（含 1 张虚拟卡、1 张冻结） | 卡片域全部操作 |
| 理财 | ≥ 6 个产品（R1–R5）、≥ 3 个持仓（含在途） | 理财域与适当性校验 |
| 收款人 | ≥ 12 个（含 2 个近 180 天未联系的高风险对手方） | R-BEN-01 |
| 异常样本 | **≥ 15 笔**，每笔命中一条指定规则，且带期望 score 区间 | 否则规则引擎没有回归测试 |

**相关的现状差距（7.0，L1000）**：「**演示数据量不足** | 12 笔交易 | 7.3 | 缺样本」

### 6.1 验收指标（7.4，L1066–L1074）

| 指标 | 目标 |
|---|---|
| 单测覆盖 | 16 条异常规则各 ≥1 条用例；限额/授权各 ≥3 条（含并发与超时） |
| 可解释性 | 任意拦截都能输出 `ruleId + evidence`，UI 可展示 |
| 一致性 | 「卡片上的数字」与「文字里的数字」永远同源（复用现有 `banking.js` 唯一事实来源） |
| 可回退 | 任意已受理未入账的操作都能 void；任意已入账都能 reversed |
| 审计 | 每次写操作产生审计条目，包含风险等级与所用因子 |

---

## 7. §Midaz「原子 upsert 防 TOCTOU」原文（1.7，L415；6.3，L882–L893）

**1.7 节原文（L415，整段照录）**

> 「**必须抄的一点**：Midaz 的 `CheckLimits` 注释明确说 "Uses atomic upsert to **prevent TOCTOU race conditions**"，且允许传入 `*sql.Tx`，使限额校验与扣款在**同一事务**内。bk-agent 的 `validateTransferSlots` 目前是「只读校验、不写余额」，注释里也承认余额校验交给调用方——**演示可接受，但一旦并发就会出现超限**。建议把「限额校验 + 占用 pending」合成一个不可分割的步骤。」

**6.3 节源码注释原文（L882–L887）**

```go
// CheckLimits evaluates all applicable limits for a transaction using
// the provided database connection. ... enabling atomic operations
// with other database changes.
// Uses atomic upsert to prevent TOCTOU race conditions.
```

**6.3 节「值得借鉴」第 2 条原文（L893）**

> 「**限额校验与扣款必须同事务**（防 TOCTOU）。这条直接指出 bk-agent `validateTransferSlots` 当前设计的并发缺口。」

**6.3 抓取路径（L866，原文）**

> 「**抓取**：`components/tracer/internal/adapters/http/in/limit_validation.go`、`components/tracer/internal/services/query/limit_checker.go`」

**证据索引 A17（L1098）**

> 「Midaz 限额模型与 TOCTOU 防护 | https://github.com/LerianStudio/midaz/blob/main/components/tracer/internal/services/query/limit_checker.go | 开源源码」

---

## 8. 附：7.1 数据模型缺口表（原文 L1006–L1015，与余额/限额/异常直接相关）

| # | 缺口 | 建议最小实现 | 对应本文件 |
|---|---|---|---|
| 1 | 余额只有一个数 | `{ available, frozen, pending, creditLimit }`，并提供 `spendable = available − pending` | 1.1 |
| 2 | 没有「授权/预授权」对象 | `authorizations[]`：`{ id, amount, status: pending/posted/void/expired, expiresAt }` | 1.2、F-1 |
| 3 | 没有限额对象 | `limits[]`：`{ type, maxAmount, scope, activeTimeStart, activeTimeEnd }` | 1.7、F-3 |
| 4 | 审计已有但缺「规则命中」字段 | `audit.js` 的 `record(e)` 已记 `{ kind, actor, op, risk, decision, detail }`；补 `ruleHits[]` 与 `factors[]` 即可支撑「决策链路」 | 赛题安全要求、第 4 节 |
| 7 | 没有通知/待办 | 现有 `pendingItems()` 升级为按优先级排序 + 带动作 | 1.8、1.9 |

---

## 9. 附：附录 B「演示值」清单原文（L1103–L1105）

> 「转账手续费、跨境到账 T+1~T+3、补卡时限 3–7 工作日、挂失费 ¥20、账单日 5 日 / 还款日 25 日、最低还款 10%、循环利息日万分之五的计息方式、违约金 5%、分期费率 0.66–0.75%/期、订阅提前 3/7 天提醒、静默订阅 90 天、风险评分阈值 40/70/90、全部异常规则的权重与阈值、预警去重 5 分钟 / 每日 3 条、免打扰 22:00–07:00、单笔转账上限 ¥1,000,000（沿用现有 `MAX_TRANSFER`）。」
