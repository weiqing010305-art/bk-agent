# ARCHITECTURE — 青禾银行 AI 资金管家的整体架构

> 本文描述**当前真实实现**，不是设想。每条断言都能在源码里找到对应文件。
> 维护义务见 [AGENTS.md](../AGENTS.md) §2。最后更新：2026-09-28

---

## 1. 这份文档回答什么

| 问题 | 看哪一节 |
| --- | --- |
| 这个项目的范式是什么？和普通银行 App 有什么不同？ | §2 |
| 整体分成几层，谁依赖谁？ | §4 |
| 用户说一句话，到屏幕上出现界面，中间发生了什么？ | §5 |
| **每一个业务环节具体怎么渲染？** | **§7** |
| 权限分级怎么保证不被绕过？ | §6.3 |
| 界面为什么长这样？ | §9 |
| 哪个文件负责什么？ | §10 |

---

## 2. 范式：一个成熟的 AI Native 银行系统由两层组成

这不是「传统银行 App 加一个聊天框」。两层各有各的职责，缺一层都不成立。

```mermaid
flowchart TB
    subgraph AGENT["Agent 系统层 —— A2UI"]
        direction TB
        I["意图理解 parseIntent"] --> C["统合 composeBrief 跨产品域取数"]
        C --> S["产出 A2UI 信封 纯 JSON"]
        S --> R["渲染统合视图"]
        R -.->|"action.name 回抛"| I
    end

    subgraph GOV["治理层 —— 每次写操作必经"]
        direction TB
        P["策略层 权限分级 policy.js"] --> A["审计层 决策链路 audit.js"]
    end

    subgraph BIZ["业务逻辑层 —— 软件时代的银行系统"]
        direction TB
        SVC["services/banking.js 唯一事实来源"] --> DOM["domain/bank.js 账本"]
        SVC --> Q1["账户与余额"]
        SVC --> Q2["交易与账单"]
        SVC --> Q3["收款人与限额"]
        SVC --> Q4["订阅与定期扣款"]
        SVC --> Q5["卡片与渠道"]
        SVC --> Q6["回执与审计"]
    end

    BIZ -->|"dataModel 唯一事实来源"| AGENT
    AGENT -->|"只产出 path 引用 不产出任何事实数字"| BIZ
    AGENT --> GOV
    GOV -->|"放行 / 拒绝 / 需验证"| BIZ
```

### 2.1 两层的分工对照

| | 业务逻辑层 | Agent 系统层 |
| --- | --- | --- |
| **是什么** | 原有银行系统在软件时代的系统逻辑 | A2UI 形式，AI 通过意图识别帮你统合和总结所有业务 |
| **边界** | `services/` + `domain/`，**零 React** | `agent/` + `a2ui/`，**零 React（除渲染器）** |
| **谁拥有事实** | **只有它**。所有数字从 `buildDataModel` 出来 | 不拥有任何事实，只产出 path 引用 |
| **呈现粒度** | 按「产品」切：账户 / 账单 / 订阅 / 卡片 | 按「用户此刻要办的事」切：跨产品合成一张统合视图 |
| **界面** | 产品层：七个功能页（`views/pages/*`） | 业务层：助手工作区（`views/AssistantView.jsx`） |
| **失败方式** | 数据错则界面显示错的值 | 引用错则显示占位符，**绝不退回猜测值** |

### 2.2 「统合视图」是两层之间的接缝

**这是 AI Native 银行与软件时代银行的分界线。**

软件时代：余额在账户页、账单在账单页、订阅在订阅页。用户办一件事要跨三个页面，自己把信息拼起来。
Agent 时代：把跨产品的信息合起来，一次呈现。

```mermaid
flowchart LR
    subgraph OLD["软件时代的银行"]
        U1["用户"] --> P1["账户页"]
        U1 --> P2["账单页"]
        U1 --> P3["订阅页"]
        P1 -.->|"自己拼"| U1
        P2 -.->|"自己拼"| U1
        P3 -.->|"自己拼"| U1
    end

    subgraph NEW["Agent 时代的银行"]
        U2["用户"] --> AG["Agent 统合"]
        A1["账户"] --> AG
        A2["账单"] --> AG
        A3["订阅"] --> AG
        A4["卡片"] --> AG
        AG --> V["一张视图 一次看全"]
    end
```

| 统合视图 | 跨了哪些域 | 代码位置 |
| --- | --- | --- |
| 首页状态板 | 账户 + 账单 + 订阅 + 卡片 + 待处理事项 | `composeHome` |
| 账单结论 | 账单 + 订阅（「订阅占了支出的 X%」） | `composeSpending` |
| 订阅总览 | 订阅 + 账单（占本月支出比例） | `composeSubscriptions` |
| **转账核对** | 转账 + 账户（转后余额）+ 账单（本月支出变化）+ 订阅（扣完还剩多少安全垫） | `composeTransferReview` |
| 转账回执 | 转账 + 账户 + 账单 + 下一步可做什么 | `composeTransferDone` |
| 跨场景联动 | 账户 + 账单 + 订阅 + 可执行建议 | `composeOccasion` |

---

## 3. 技术栈与硬约束

| 项 | 选择 | 理由 |
| --- | --- | --- |
| 框架 | React 19 + Vite 7 | — |
| 语言 | **纯 JSX，无 TypeScript** | 项目决策；不引入 TS 构建链 |
| 样式 | **手写 CSS**，`tokens.css` 是唯一颜色来源 | 组件里禁止出现 hex / rgb 字面量 |
| 图表 | **手绘 SVG**，零依赖 | 六种形态只是几段 path |
| 头像 | **手绘 + 品牌色常量**，零依赖 | 手抄 simple-icons 的 slug 与 hex，不引包、不搬 SVG |
| 任务图 | 自研 178 行 DAG | 需求只有拓扑排序 + 四种状态变换 |

### 3.1 依赖白名单

```
react   react-dom   lucide-react   vite   @playwright/test
```

**其余一律不加。** 这条不是偏好，是项目级硬约束（[AGENTS.md](../AGENTS.md) §1，ponytail ultra）。

### 3.2 其他硬约束

- **单文件 < 300 行**（当前最大 `styles/wallet.css` 277 行）
- **无障碍是底线不是加分项**：流式内容 `aria-live`、弹窗焦点管理、`prefers-reduced-motion` 降级
- **中文输入法**：任何回车提交的输入框必须处理 `compositionstart` / `compositionend`

---

## 4. 整体分层

```mermaid
flowchart TB
    subgraph VIEW["视图层 views/"]
        AV["AssistantView 业务层工作区"]
        PV["product.jsx 产品层路由"]
        PG["pages/* 七个功能页"]
        PT["parts / shared / avatars / charts 共用零件"]
    end

    subgraph STATE["状态层 state/"]
        S1["useConversations 会话持久化"]
        S2["useTurnRunner 回合执行"]
        S3["useTransferFlow 转账四步"]
        S4["useSecurity 安全门禁"]
        S5["useUndoWindow 5 秒撤销"]
        S6["useThreadScroll 滚动锚定"]
        S7["useBackendBank 后端同步"]
    end

    subgraph A2UIL["协议层 a2ui/"]
        A1["protocol.js 组件白名单 + 构造器"]
        A2["apply.js 纯函数 校验 + 展开"]
        A3["render.jsx 白名单的 React 实现"]
    end

    subgraph AGENTL["Agent 层 agent/"]
        G1["planner.js 意图 + 两个入口"]
        G2["brief.js 统合视图"]
        G3["transferFlow.js 四步流程"]
        G4["taskGraph.js 任务 DAG"]
    end

    subgraph SVCL["业务层 services/ domain/"]
        V1["banking.js 唯一事实来源"]
        V2["policy.js 权限分级"]
        V3["audit.js 审计"]
        V4["guard.js 注入防御"]
        V5["limits.js 限额对象"]
        V6["anomaly.js + anomalyRules.js 异常识别"]
        V7["domain/bank.js 账本"]
    end

    VIEW --> STATE
    STATE --> A2UIL
    STATE --> AGENTL
    A2UIL --> SVCL
    AGENTL --> SVCL
```

### 4.1 依赖规则（不可违反）

这三条保证**协议层与业务层可以被单测直接 import** —— 仓库里 87 条测试就是这么跑的，不需要浏览器。

| 模块 | 禁止 |
| --- | --- |
| `a2ui/` | 除 `render.jsx` 外，禁止 import React |
| `agent/` | 禁止 import React |
| `services/` `domain/` | 禁止 import React |
| `views/` | 禁止直接读写账本，必须走 `ctx` |

---

## 5. 端到端数据流

### 5.1 用户说一句话，到界面上出现视图

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant C as Composer
    participant TR as useTurnRunner
    participant G as services/guard
    participant PL as agent/planner
    participant SV as services/banking
    participant AP as a2ui/apply
    participant RD as a2ui/render

    U->>C: 输入「这个月花了多少」
    C->>TR: submit
    TR->>G: screenInput 注入筛查
    alt 命中越权或诱导
        G-->>TR: 拒绝 + 原因
        TR->>TR: 记审计、累加可疑计数
        TR-->>U: 被拦下的那一条
    else 通过
        TR->>PL: parseIntent 识别意图
        PL-->>TR: action = bills, slots = {}
        TR->>PL: fromText 产出 A2UI 信封
        PL->>SV: buildDataModel 取事实
        SV-->>PL: dataModel
        PL-->>TR: createSurface 纯 JSON
        TR->>AP: applyMessages 校验 + 展开
        AP-->>TR: 组件树
        TR->>RD: resolveTree 解析引用
        RD-->>U: 统合视图
    end
```

### 5.2 两个入口，一个内核

**这是「统一入口」这句话的技术含义。**

```mermaid
flowchart LR
    T["业务层入口<br/>fromText 自然语言"] --> PI["parseIntent<br/>意图 + 槽位"]
    PI --> PLAN["plan 共享内核"]
    A["产品层入口<br/>fromAction 直接点功能"] --> PLAN
    PLAN --> ENV["A2UI 信封<br/>纯 JSON"]
    ENV --> SAME["**同一种 surface**"]
```

产品层不是「另一套界面」，而是**跳过意图理解那一步的同一个渲染管线**。
这一点有测试守着：`tests/brief.test.js` 断言「自然语言与直接点功能必须落到同一张视图」。

### 5.3 为什么不可能出现幻觉数字

```mermaid
flowchart TB
    P["planner / brief<br/>**只能产出 path 引用**"] -->|"bind /spendingText"| DM["dataModel"]
    S["services/banking.js<br/>**唯一写入者**"] -->|"写真实值"| DM
    DM --> RV["resolveValue 解析"]
    RV -->|"解析到"| OK["显示真实值"]
    RV -->|"解析不到"| NULL["显示占位符"]
    NULL --> X["**绝不退回猜测值**"]
```

三道防线：

1. **planner 不产出任何事实数字**，只产出引用 —— 有测试断言「组件结构里不含写死的金额字面量」
2. **只有 service 能写 dataModel**
3. **解析不到就显示占位符**，不猜

---

## 6. 六大模块详解

### 6.1 协议层 a2ui/ —— 组件白名单

```mermaid
flowchart LR
    IN["A2UI 信封<br/>纯 JSON"] --> V{"组件在白名单里？"}
    V -->|"否"| DROP["丢弃 + 记诊断"]
    V -->|"是"| V2{"字段合法？"}
    V2 -->|"否"| DROP
    V2 -->|"是"| KEEP["保留"]
    KEEP --> RES["resolveTree<br/>解析全部引用"]
    RES --> R["render.jsx<br/>白名单的 React 实现"]
```

**17 个组件**：Text / Icon / Row / Column / Card / ActionGroup / TextField / Select /
Meter / Progress / Divider / Figure / CardFace（以及 envelope 用的 createSurface 等）。

**为什么要有白名单**：信封将来可以整段来自后端。白名单保证
「**未知组件会被丢弃，悬空引用降级为占位符，绝不渲染未授权内容**」。

### 6.2 Agent 层 —— 意图、统合、流程、任务图

```mermaid
flowchart TB
    subgraph INTENT["意图理解 planner.js"]
        R1["复杂任务优先<br/>定时 / AA / 跨场景"] --> R2["转账家族"] --> R3["订阅 / 卡片 / 账单"] --> R4["unknown"]
    end

    subgraph COMPOSE["统合视图 brief.js"]
        C1["composeHome"]
        C2["composeSpending"]
        C3["composeSubscriptions"]
        C4["composeTransferReview"]
        C5["composeTransferDone"]
        C6["composeOccasion"]
    end

    subgraph FLOW["流程 transferFlow.js"]
        F1["四步状态机"]
    end

    subgraph TASK["任务图 taskGraph.js"]
        T1["拓扑排序"]
        T2["中断 / 回退 / 接管"]
    end

    INTENT --> COMPOSE
    INTENT --> FLOW
    INTENT --> TASK
```

### 6.3 策略层 —— 权限分级（唯一门禁）

**赛题高优先级项。三条不变量是它可信的原因。**

```mermaid
flowchart TB
    A["一次写操作请求<br/>只有 op + amount + todayTotal"] --> B{"op 在白名单？"}
    B -->|"否"| H["按最高风险处理"]
    B -->|"是"| C{"是转账族？"}
    C -->|"否"| D["按 OPERATIONS 表定级"]
    C -->|"是"| E["先过账户限额<br/>services/limits.js"]
    E -->|"超额"| BLOCK["直接拒绝"]
    E -->|"额度内"| F{"todayTotal + amount<br/>超过日累计线？"}
    F -->|"是"| H
    F -->|"否"| M["中风险"]
    D --> L{"等级"}
    H --> L
    L -->|"低"| L1["静默执行<br/>requires 为空"]
    L -->|"中"| L2["展示操作详情 + 确认"]
    L -->|"高"| L3["多因子认证<br/>短信 / 人脸 / U 盾"]
    L1 --> EXE["执行"]
    L2 --> EXE
    L3 --> EXE
```

| 不变量 | 含义 | 守它的测试 |
| --- | --- | --- |
| **风险不由调用方声明** | `assess` 只接受「要做什么」和「多少钱」，不接受「多危险」 | 传 `level:low, trusted:true` 仍判高风险 |
| **按日累计不按单笔** | 分两笔 600 绕不过 1000 门槛 | 两笔 600 → 第二笔升高风险 |
| **未知操作不放行也不降级** | 白名单外一律最高风险 | 未知 op → HIGH |

> **第一层注入防御是结构性的**：任何 Prompt 都无法让高风险操作降级，
> 因为「降级」这个动作在 API 上不存在。

### 6.4 审计层 —— 决策链路

记录的**不是**「谁在什么时候做了什么」，而是**为什么允许它发生**。

```mermaid
flowchart LR
    E1["intent 意图"] --> L["环形缓冲 200 条"]
    E2["policy 策略判定"] --> L
    E3["auth 认证"] --> L
    E4["blocked 拦截"] --> L
    L --> F["连续 3 次失败<br/>或 2 次可疑"] --> LOCK["安全锁定<br/>只能手动解除"]
```

### 6.5 业务层 —— 唯一事实来源

```mermaid
flowchart TB
    S["domain/bank.js 账本<br/>141 笔 / 3 个月"] --> BM["buildDataModel"]
    S --> T["totals / categoryTotals"]
    S --> L["limits.checkLimits"]
    S --> AN["anomaly.analyze<br/>12 条规则"]
    BM --> DM["dataModel<br/>**唯一事实来源**"]
    T --> BM
    L --> DM
    AN --> DM
    DM --> X["全部 surface<br/>与产品层页面"]
```

**余额是四则模型**：`available + frozen + pending = total`。
转账**只校验 available** —— 「同时发两笔都显示余额够」被堵死，有测试守着。

**原子性**：`ledgerVersion()` + `transfer(state, { expect })`，草稿带快照、
提交时比对，对不上直接拒绝而不是照扣（防 TOCTOU）。

---

## 7. 每一个业务环节怎么渲染

> 本节的每张图都是**该环节实际产出的组件树**。信封是纯 JSON，
> 由 `a2ui/apply.js` 校验后交给 `render.jsx` 渲染 —— 所以图与界面一一对应。

### 7.1 首页统合视图（composeHome）

```mermaid
flowchart TB
    ROOT["Column root"]
    ROOT --> H["Row head"]
    H --> HI["Icon sparkles"]
    H --> HT["Column h-text"]
    HT --> HT1["Text 你好，小禾"]
    HT --> HT2["Text 这是你现在的全部状况，不需要再点进任何页面"]

    ROOT --> FIGS["Row figs 跨域三数"]
    FIGS --> F1["Figure 可用余额"]
    FIGS --> F2["Figure 本月支出<br/>note: 结余 X"]
    FIGS --> F3["Figure 待扣订阅<br/>note: 3 项，占支出 X%"]

    ROOT --> D1["Divider"]
    ROOT --> PT["Text 需要你留意的"]
    PT --> P1["Row p-0 + Column + ActionGroup 去看看"]
    ROOT --> D2["Divider"]
    ROOT --> TX["Text 最近三笔"]
    TX --> T1["Row t-0 名称 / 日期 / 金额"]
    ROOT --> ACT["ActionGroup 看完整账单 / 转账"]
```

**跨了哪些域**：账户（余额）+ 账单（本月支出）+ 订阅（待扣）+ 卡片（待处理）+ 账本（最近三笔）。

### 7.2 转账四步流程（transferFlow.js）

四步共用一个 `surfaceId`，**在原地换页而不是堆叠** —— 消息流里始终只有一张卡。

```mermaid
stateDiagram-v2
    [*] --> type: 用户说「我要转账」
    [*] --> recipient: 只说了金额
    [*] --> review: 人和钱都说了
    type --> recipient: 选「转给他人」
    recipient --> amount: 选中收款人
    amount --> review: 填金额 + 核对
    review --> amount: 上一步
    review --> GATE: 确认并获取验证码
    GATE --> done: 通过认证
    GATE --> review: 认证失败
    done --> [*]
```

每一屏的组件树：

```mermaid
flowchart LR
    subgraph S1["① 你想怎么转"]
        A1["Row head"] --> A2["Progress 4 段"]
        A2 --> A3["Card ×4 转账方式<br/>每人一个可点卡片"]
    end

    subgraph S2["② 转给谁"]
        B1["ActionGroup 上一步"] --> B2["Row head"]
        B2 --> B3["Progress"]
        B3 --> B4["Card ×N 常用收款人"]
        B4 --> B5["TextField 手动卡号"]
    end

    subgraph S3["③ 转多少"]
        C1["ActionGroup 上一步"] --> C2["Progress"]
        C2 --> C3["TextField 金额"]
        C3 --> C4["ActionGroup ¥50 ¥100 ¥200 ¥500"]
        C4 --> C5["TextField 备注（选填）"]
    end

    subgraph S4["④ 核对一下"]
        D1["ActionGroup 上一步"] --> D2["Progress"]
        D2 --> D3["Row figs 跨域三数"]
        D3 --> D4["Column 收款人 / 账户 / 备注"]
        D4 --> D5["Text 这笔钱转出去之后"]
        D5 --> D6["ActionGroup 确认并获取验证码"]
    end
```

**核对页的跨域三数**（这是统合视图最直接的证据）：

| Figure | 值 | 来自哪个域 |
| --- | --- | --- |
| 转出 | 用户填的金额 | 转账 |
| **转后余额** | 现在 − 转出 | 账户 |
| **扣完订阅还剩** | 转后余额 − 活跃订阅合计 | 订阅 |

再加一句「本月支出会从 X 变成 Y，增加约 N%」—— 来自账单域。

### 7.3 定时转账：任务 DAG（taskGraph.js）

**赛题要求「复杂任务需拆解为有序的子任务 DAG；支持中断、回退和人工接管」。**

```mermaid
flowchart TB
    PARSE["理解请求：定时转账 + 收款人 + 周期"] --> RESOLVE["确定收款人"]
    RESOLVE --> AMOUNT["确认金额<br/>**kind: human** 金额缺失必须问"]
    AMOUNT --> LIMIT["校验限额与当日累计"]
    LIMIT --> AUTH["身份验证"]
    AUTH --> BOOK["创建预约任务"]
    BOOK --> REMIND["设置扣款前提醒"]
    REMIND --> RECEIPT["生成预约回执"]
```

界面上按**依赖深度缩进**呈现，缩进本身就是「为什么回退会重置后面全部」的答案：

```mermaid
flowchart LR
    subgraph UI["TaskGraph 组件"]
        T["标题 + 0/8 计数"] --> P["进度条"]
        P --> N["节点列表（按拓扑序，缩进 = 依赖深度）"]
        N --> C["先停一下 / 退回上一步 / 我自己来"]
    end
```

三种控制的状态变换：

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> running: nextRunnable 取到
    running --> done: 执行成功
    running --> pending: **中断**（interrupted = true，不再自动推进）
    pending --> blocked: 缺槽位 / 超限
    pending --> human: **人工接管**（Agent 停在原地）
    human --> pending: 用户继续
    done --> pending: **回退**（该节点及全部下游一起重置）
```

> 回退靠**依赖图**算，不写特判：重置目标节点，再沿边找到全部下游一起重置。

### 7.4 AA 收款

```mermaid
flowchart TB
    P["理解请求：AA 收款"] --> PE["确定参与人<br/>**kind: human**"]
    PE --> SPLIT["拆分金额"]
    SPLIT --> AUTH["身份验证"]
    AUTH --> SEND["发出收款请求"]
    SEND --> TRACK["跟踪到账"]
```

### 7.5 账单：六种图表形态共享同一个高亮

```mermaid
flowchart TB
    PAGE["views/pages/bills.jsx"] --> STATE["**单一 activeIndex 状态**"]
    STATE --> DONUT["圆环：扇面膨出，其余降到 30%"]
    STATE --> BARS["条形：条高亮"]
    STATE --> COMPARE["环比：本期 vs 上期同类目"]
    STATE --> STACK["占比：每周一根 100% 堆叠条"]
    STATE --> HEAT["热力：日历格 1-4 级"]
    STATE --> LINE["趋势：累计折线 + 峰值标注"]
    STATE --> LEGEND["图例常驻（不随形态变）"]
    STATE --> DETAIL["明细：该类高亮，其余降到 50%"]
```

**为什么共享状态**：滑过任一形态的任一段，圆环、图例、读数区、明细**一起响应** ——
用户不用读表就能看出结构。切换形态不清空高亮，因为状态不在图里。

```mermaid
flowchart LR
    HOVER["鼠标滑过圆环的餐饮段"] --> IDX["activeIndex = 1"]
    IDX --> A["圆环：餐饮扇面膨出"]
    IDX --> B["图例：餐饮高亮"]
    IDX --> C["读数区：餐饮 ¥1,191，23%，N 笔"]
    IDX --> D["明细：餐饮行高亮"]
    CLICK["点击该段"] --> PICK["只看这一类 + 滚动到明细"]
```

> **hover 不触发滚动，只有点击才滚动** —— 频率门：hover 一天几十次，
> 让页面自己跳比不动更糟。

### 7.6 异常交易识别（anomaly.js）

```mermaid
flowchart TB
    TX["账本 141 笔"] --> D["detectAnomalies"]
    D --> R1["R-AMT-01 金额偏离 3σ"]
    D --> R2["R-AMT-04 贴近报告线 ¥49,000"]
    D --> R3["R-AMT-05 拆分规避"]
    D --> R4["R-TIME-01 深夜大额"]
    D --> R5["R-FREQ-02 卡测试 5 笔 × ≤¥10"]
    D --> R6["R-MER-01/02 商户异常"]
    D --> R7["R-ACCT-01 睡眠户复活"]
    D --> R8["R-BEN-01 首次收款人"]

    R1 --> SCORE["scoreAnomaly 评分合成"]
    R8 --> SCORE
    SCORE --> SUP{"误报抑制"}
    SUP -->|"白名单 / 时间衰减 / 每日限 2 次确认"| DROP["压制"]
    SUP -->|"通过"| DISP["四档处置"]
    DISP --> P1["放行"]
    DISP --> P2["二次确认"]
    DISP --> P3["挂起人工"]
    DISP --> P4["拒绝 + 冻卡"]
```

**每条规则输出 `{ ruleId, weight, evidence }`** —— 这天然满足赛题的「决策链路审计」：
评委问「为什么标记这一笔」，能直接答出规则 id 和证据。

### 7.7 订阅

```mermaid
flowchart TB
    PAGE["views/pages/subscriptions.jsx"] --> HEAD["StatBar 每月固定支出 / 下次扣费"]
    HEAD --> LIVE["生效中：一项一张身份卡"]
    LIVE --> C1["46px 方形形象（圆角方 = 周期性）"]
    LIVE --> C2["下次扣费胶囊：3 天后 + 日期"]
    LIVE --> C3["每月 ¥29 与每年 ¥348 双视角"]
    LIVE --> C4["已续 6 个月 · 累计已付 ¥174"]
    LIVE --> C5["取消按钮 → 就地展开后果预览"]
    HEAD --> GONE["已取消：同一张卡的「不在运行」材料"]
```

**取消的后果预览**（就地展开，不套弹窗 —— 同一个问题不问两遍）：
哪几项权益失效、哪天之后不再扣款、本月已扣不退、一年少付多少。

### 7.8 卡片与卡包

```mermaid
flowchart TB
    PAGE["views/pages/cards.jsx"] --> W["卡包：横向 scroll-snap，选中浮起 10px"]
    W --> SEL["选中卡"]
    SEL --> F["CardFace 卡面<br/>EMV 芯片 / 非接波纹 / 有效期 / 卡组织"]
    SEL --> RUL["LimitMeter 额度尺<br/>可用额度 + 已用块 + 今日上限针"]
    SEL --> CYC["CardCycle 账期条<br/>账单日 → 还款日的进度"]
    SEL --> FACT["CardFacts 档案<br/>图标即标签：账户 / 账单日 / 有效期 / 上期账单"]
    SEL --> CH["ChannelBoard 四类渠道<br/>图标 + 使用条 + 剩余额 + 开关"]
    SEL --> LIM["LimitRows 三档限额就地展开"]
    SEL --> ACT["操作：冻结 / 挂失补卡 / 限额 / 流水"]
    SEL --> HIST["状态历史时间线<br/>节点图标 + 日期 + 两个字的动作"]
    SEL --> ACTI["这张卡自己的动账"]
```

**这一页的文案纪律（唯一一条）**：能画出来的不写出来。额度尺回答「还剩多少」、
账期条回答「什么时候还」、渠道使用条回答「今天还能刷多少」、时间线回答「经历过什么」——
这四张图各自替掉了原来的一段说明句。界面文案因此从 613 字降到 133 字
（口径见 `npm run test:text`：标签 / 标题 / 说明句 / 按钮，不含列表行与金额）。

**冻结是一条流程而不是一个开关**：

```mermaid
stateDiagram-v2
    [*] --> active
    active --> confirming: 点冻结
    confirming --> active: 取消
    confirming --> frozen: 确认<br/>逐条列出哪四个渠道停用
    frozen --> result: 卡面换暗面 + 磨砂斜纹 + 已冻结徽标
    result --> active: 一次性撤销
    result --> frozen: 关闭
```

**助手侧的卡面**：`CardFace` 已进 A2UI 白名单，所以助手说的卡片视图里
渲染的是**真卡面**而不是「一个图标 + 两行灰字」。

卡面有三种材料（`data-state`）：**彩色渐变 = 正常**、**磨砂暗面 = 冻结**（卡还在，随时能退回）、
**中性灰 = 挂失**（卡没了，只剩一条轮廓）。材料是状态本身，不是装饰。

### 7.17 挂失补卡（状态机里唯一不可逆的那条边）

赛题点名的「卡片挂失」在 D-19 之前是**看不见**的 —— 那一版只有一个点下去弹 toast 的死按钮。
现在它是一条真流程，而且是卡片状态机上**不可逆**的那条边，所以它与冻结共用一套语法、
但不是同一个动作：冻结随时能解冻，挂失之后原卡不再可用，只能等补卡寄到。

```mermaid
flowchart TB
    A["active 正常"] -->|"冻结（可逆）"| F["frozen 已冻结"]
    F -->|"解冻"| A
    A -->|"挂失补卡"| C["确认：后果先摊开<br/>四个渠道 / 不可恢复 / 补卡 3–7 个工作日 / 手续费 ¥20"]
    F -->|"挂失补卡"| C
    C -->|"取消"| A
    C -->|"确认挂失"| G{"policy 判高危<br/>A-04：页面只能报做什么"}
    G -->|"多因子通过：短信 / 人脸 / U 盾"| L["lost 已挂失"]
    G -->|"没走完就关闭"| A
    L --> R["补卡进度<br/>已受理 → 制卡中 → 已寄出"]
    L -.->|"原卡不能再用"| X["usableCards() 不再返回它<br/>渠道真关 / 限额不可调 / 没有解冻"]
```

**每个环节的落点**（页面不自己判等级、也不自己写账本）：

| 环节 | 落在哪 | 说明 |
| --- | --- | --- |
| 入口 | `pages/cards.jsx` 的「挂失补卡」 | 与冻结并列的第二类动作，不是同一个按钮 |
| 风险等级 | `services/policy.js` 的 `card.report-loss` | 页面调 `ctx.gate({ op })`，只报做什么（A-04） |
| 多因子 | `components/AuthDialog.jsx` | 三种方式都可走通；关闭弹窗 = 什么都不会发生 |
| 落账 | `domain/bank.js` 的 `reportLoss` | 卡片进 `lost`、四个渠道关掉、补卡单入账、手续费进流水。**幂等**：重试不重复扣费 |
| 呈现 | `pages/cardLoss.jsx` | 确认前的后果清单 + 挂失后的 `ReplacementTrack`（受理 → 制卡 → 寄出） |

**它的落地口是 App.jsx 的 `applyConfirmation`**（与理财申购同一条路，认证通过后执行）：

```js
} else if (action.type === 'card.report-loss') {
  setBank(prev => reportLoss(prev, action));
  setToast(action.name + ' 已挂失');
}
```

**为什么挂失不能是「点一下变灰」**：

| 要求 | 这一版怎么满足 |
| --- | --- |
| 不可逆要说清楚 | 确认浮层在按钮之前列出：四个渠道停用 / 不可恢复 / 补卡 3–7 个工作日 / 手续费 |
| 有后果 | 账本里 `status: 'lost'` + 四个渠道 `on: false` + 一条 `挂失手续费` 流水 |
| 能查进度 | `ReplacementTrack`：三个节点带日期 + 预计寄到 + 寄送地址 + 受理号；刷新后仍在 |
| 原卡不能再用 | `usableCards()` 不再返回它；限额不可调、冻结那条路消失、渠道整组锁死 |

> 测试：`tests/card-loss.test.js`（账本与门禁，跑在 `npm test` 里）、
> `tests/card-loss.mjs`（界面与流程，`npm run test:card`）。

### 7.9 收款人

```mermaid
flowchart TB
    PAGE["views/pages/payees.jsx"] --> Q{"这一页回答什么"}
    Q --> Q1["这是谁"]
    Q --> Q2["上次给了他多少"]
    Q --> Q3["还能不能再转"]
    Q1 --> ROW["每行：首字母头像 + 姓名 + 关系标签"]
    Q2 --> ROW2["上次往来：日期 · 金额 · 用途「房租」"]
    Q3 --> ROW3["已登记 → 再转一笔 / 未登记 → 设为常用"]
```

> **未登记的人不给「转账」按钮，给「设为常用」** —— 转账流程只认常用收款人，
> 硬给一个转账按钮只会在下一步把人丢掉。那是不诚实的设计。

### 7.10 回执

```mermaid
flowchart LR
    DONE["记账完成"] --> UNDO["**5 秒可撤销窗口**<br/>倒计时条 + 撤销按钮"]
    UNDO -->|"撤销"| CANCEL["这笔转账没有执行"]
    UNDO -->|"5 秒走完"| RECEIPT["composeTransferDone"]
    RECEIPT --> A["回执编号"]
    RECEIPT --> B["账户余额 / 本月支出 / 扣完订阅还剩"]
    RECEIPT --> C["下一步：设为常用 / 看账单 / 再转一笔"]
```

### 7.11 跨场景联动（composeOccasion）

赛题点名的差异化能力。用户说「我爱人生日」，Agent 不该只回一句祝福。

```mermaid
flowchart TB
    IN["我爱人生日"] --> G["任务图 tg-occasion"]
    G --> G1["识别场景"] --> G2["看这个月还剩多少可支配"] --> G3["给建议"] --> G4["**你选一个** human"] --> G5["按所选动作的风险等级验证"] --> G6["执行"]

    G --> V["统合视图"]
    V --> V1["Row figs 可支配 / 本月已花 / 待扣订阅"]
    V1 --> V2["三张可执行卡片：直接转账 / 先看账 / 清掉不用的订阅"]
```

### 7.12 助手工作区的布局

**不是一条会不断变长的聊天流。**每办一件事就多一张卡，看到第三张就得往上滑 —— 那违背最小操作原则。

```mermaid
flowchart TB
    subgraph W["AssistantView"]
        direction TB
        H["view-head 标题"]
        WS["**工作区**：当前这件事的统合视图，占满主要面积，一屏看全"]
        TG["TaskGraph（仅复杂任务）"]
        HIST["**历史条**：以往问句折成一行 chips，点一下换回当时那张视图"]
        FL["FlowLauncher 可以让他做什么"]
        CP["Composer"]
    end
    H --> WS
    WS --> TG
    TG --> HIST
    HIST --> FL
    FL --> CP
```

> **不滚动的历史，可切换的现在。**

### 7.13 多因子认证

```mermaid
stateDiagram-v2
    [*] --> sms: 默认短信
    sms --> face: 切到人脸
    sms --> token: 切到 U 盾
    face --> scanning: 开始识别
    scanning --> pass: 1.8s 后通过
    token --> holding: 长按 1.2s
    holding --> pass: 完成
    sms --> fail: 验证码错误
    face --> fail: —
    token --> fail: —
    fail --> counted: 累计失败
    counted --> locked: 满 3 次
    pass --> [*]: 执行操作
    locked --> [*]: 只能手动解除
```

### 7.14 理财：收益长图 + 行为数据榜单 + 申购四步

理财域是整个项目里**唯一一个先做调研、再按真实产品逻辑建起来**的域。
依据是 `doc/research/za-design-and-wealth.md` §B（众安理财逻辑的深挖）。

```mermaid
stateDiagram-v2
    [*] --> Shelf: 理财主页（收益长图 + 里程碑 + 榜单）
    Shelf --> Fund: 点榜单某一行
    Fund --> Amount: 申购
    Amount --> Amount: 未达起购 → 就地校验
    Amount --> Reject: 超单笔上限 / 活期不足
    Reject --> Amount: 改小金额
    Amount --> Review: 下一步
    Review --> Auth: 确认（提交后不可取消）
    Auth --> Book: **多因子通过**
    Book --> Done: 扣活期 + 加持仓
    Done --> Shelf: 回理财
```

**四条照抄自众安的产品逻辑**：

| 结论 | 为什么这样做 |
| --- | --- |
| **榜单标题写「别人在干什么」**（近两周买最多 / 持有人赚最多 / 金融业的都在买），全是**行为数据**，**零评级语义** | 银行不能推荐「好」的产品，只能呈现「别人在做什么」。措辞一变法律性质就变了 |
| **收益是「可滚动的大数字长图」**（每页 = 大数字 + 一句结论 + 一行脚注 + 一个动作），不是表格 | 众安的《基金服務報告》就是 11 页长图 |
| **一个数字有多套算法时全部列出**（七日年化的复利 / 单利 / 万份折算 / 含分红再投四套结果互不相同） | 挑一套假装唯一是在误导 |
| **资金直连活期账户，没有投资钱包** | 众安原文 "Direct trading, no need to deposit in advance" |

申购是**高风险操作**，走 `services/policy.js` 的三级门禁 —— 这一点在界面上是可验证的：
点确认后弹的是**多因子认证**，不是普通确认框。

### 7.15 空 / 错 / 加载三态

三态有**唯一实现**（`components/StateBlock.jsx`），口径照抄众安**真实上线**的文案结构
（一手证据：投资子站的 887 条 UI 字串表）。

| 态 | 结构 | 众安原文 | 本项目 |
| --- | --- | --- | --- |
| 空 | `[4 字状态] + [1 个按钮]` | `頁面不見了` / `暫無記錄` | `暂无支出` / `暂无回执` + 一个出路按钮 |
| 错 | `[拟人化短标题] + [错误码] + [1 个动作]` | `服務器開小差了` / `錯誤碼：{code}` / `刷新` | `页面开小差了` / `错误码：{surfaceId}` / `刷新` |
| 加载 | **零文字** | 887 条字串里 loading 只命中 3 处且都与 PDF 有关 | 纯骨架，文案只进 `aria-label` |

**两条从众安量化出来的预算规则**：
- **插画只投给情绪峰值**（众安 105 条插画资产里 70+ 用于抽奖领奖，常规空态只有 1 张）
  → 本项目不引插画（零依赖），改用一枚 44px 图标底座
- **错误从不解释技术原因，道歉不超过一句**；**拒绝 = 原因 + 补救路径**

### 7.16 注入防御与安全锁定

```mermaid
flowchart TB
    IN["用户输入"] --> L1["**第一层：结构性**（无法绕过）"]
    L1 --> L1a["Agent 不产出事实数字"]
    L1 --> L1b["操作必须在白名单"]
    L1 --> L1c["风险由 policy 推出，不由调用方声明"]
    L1 --> L2["**第二层：文本筛查** guard.js"]
    L2 -->|"命中越权"| B1["拦截 + 审计留痕"]
    L2 -->|"命中诱导"| B2["拦截 + 审计留痕"]
    L2 -->|"通过"| OK["继续"]
    B1 --> CNT["可疑计数 +1"]
    B2 --> CNT
    CNT --> LOCK{"满 2 次？"}
    LOCK -->|"是"| L["**安全锁定**"]
```

> **答辩要讲清楚的一点**：就算第二层被完全绕过，第一层仍然有效 ——
> 因为「把高风险操作降级」这个动作在 API 上不存在。

---
## 8. 关键状态机

### 8.1 会话与回合

```mermaid
stateDiagram-v2
    [*] --> 空会话
    空会话 --> 已播欢迎: runAction welcome
    已播欢迎 --> 待答: 用户提交
    待答 --> 骨架: 先占位（pending = true）
    骨架 --> 已成图: 420ms 后落内容
    已成图 --> 待答: 继续追问
    待答 --> 被拦: 注入筛查未通过
    被拦 --> 待答: 换一句
```

「先占位再填充」的两个作用：**加载态**（craft-floor 要求的四态之一），
以及**让对话有节奏** —— 卡片是被想出来的，不是瞬间贴上来的。

骨架本身由 `components/StateBlock.jsx` 的 `Loading` 渲染（见 §9.5）：**零文字**，
形态自己说明"正在生成"。视图建不起来时走同一个文件的 `Failed`，不是留一个转不完的圈。

### 8.2 滚动锚定

```mermaid
stateDiagram-v2
    [*] --> 跟随
    跟随 --> 脱离: 用户主动上滑超过 32px
    脱离 --> 跟随: 回到底部 24px 以内
    脱离 --> 跟随: **用户明确发送（意图优先）**
```

非对称迟滞（32 / 24）+ 意图优先：用户自己发消息时**强制恢复跟随**，
不管他刚才滑到哪里。

---

## 9. 视觉与动效规约

### 9.1 两层材质模型（Apple）

```mermaid
flowchart LR
    subgraph CONTENT["内容层 —— 不透明"]
        C1["卡片 / 列表 / 面板"]
        C2["不透明底 + 细边或阴影<br/>**禁止玻璃**"]
    end
    subgraph FUNC["功能层 —— 玻璃"]
        F1["顶栏 / 输入框 / 抽屉 / 浮层"]
        F2["tint + blur/saturate + 顶部高光 + 边缘影"]
    end
    CONTENT -.->|"每屏玻璃元素 ≤ 3 个"| FUNC
```

### 9.2 craft-floor 的硬禁令（违反即返工）

| 禁令 | 处理 |
| --- | --- |
| 标题上方的 eyebrow / kicker | 全部删除。原文：「这是一个 ban，没有 brief 能换回来」 |
| ghost card（1px 边框 + 大阴影并存） | 面板只声明一次 elevation |
| 渐变文字 | 未使用 |
| `feTurbulence` 噪点 | 已删除（读起来像业余作品） |
| 卡片半径超过 16px | 已收到 16px |
| emoji / Unicode 当图标 | 一律 lucide-react + 白名单 |
| 用户可见文案里的破折号 | 清零 |
| **嵌套卡片** | 永远禁止 —— 分组靠 Divider |

### 9.3 动效的频率门

**频率是取消资格，不是判断题。**

| 频率 | 规则 | 本项目 |
| --- | --- | --- |
| 一天 100+ 次 | 永不动效 | 侧边栏切换只给按压反馈 |
| 一天几十次 | 只允许几乎不可感知 | 转账对流 ±2px 保留循环；餐饮/购物的签名动作改成**一次性** |
| 偶发 | 标准动效 | 对焦切换、surface 入场 |
| 罕见 / 首次 | 惊喜预算花在这里 | 5 秒可撤销、工资金币的入场扫光 |

**内容不动，交互动**：余额数字不加持续动效、图表不加视差。

### 9.4 设计令牌

`src/styles/tokens.css`（260 行）是**唯一颜色来源**。
组件 CSS 里出现 hex / rgb 字面量即视为 bug，有一条命令可以自查：

```powershell
Get-ChildItem src -Recurse -Include *.css |
  Where-Object { $_.Name -ne 'tokens.css' } |
  Select-String -Pattern '#[0-9a-fA-F]{3,8}\b|rgba?\('
# 期望：无输出
```

配色原则：**单一色相**（蓝）。曾经有靛紫作为品牌渐变第二停靠点，已全部移除 ——
紫色既不表达状态也不是品牌色，纯装饰。

**类别色盘不含红与绿** —— 红绿留给金额方向。

### 9.5 空 / 错 / 载三态与数值对齐

三态**只有一份实现**：`src/components/StateBlock.jsx`（样式在 `styles/state.css`），
页面从 `views/parts.jsx` 拿到 `Empty / Failed / Loading` 三个零件，不各写各的。

口径照众安银行**真实上线**的 i18n 字串（证据：`doc/research/za-design-and-wealth.md` §A.4）：

| 态 | 公式 | ZA 官方原文 | 本项目 |
| --- | --- | --- | --- |
| 空 | `[4 字状态] + [1 个按钮回主路径]`，不写引导句 | 頁面不見了 / 暫無任務，盡請期待 / 暫無記錄 | 暂无回执 / 暂无动态 / 暂无支出 / 暂无交易 / 没有结果 / 都取消了 |
| 错 | `[拟人化短标题] + [错误码独立一行] + [1 个动作]`，不解释技术原因 | 服務器開小差了 / 錯誤碼：{code} / 刷新 | 页面开小差了 / 错误码：{surfaceId} / 刷新 |
| 载 | **零文字**（887 条字串里 loading 只命中 3 处，且都与 PDF 有关） | —— | `Loading`：4 根骨架 + 抖光，正文一个字都没有；"正在生成"只进 `aria-label` |

**插画一律不引**（报告 §A.5：ZA 的 105 条图片资产有 70+ 投给了抽奖领奖，常规空态只有 1 张）。
替代物是一枚 44px 的图标底座 —— 图标说的是「这里没有东西」，不是「我很伤心」。

**数值对齐**（Material 3 / M2 数据表）：数字一律 `tabular-nums`；**金额右对齐，表头也跟着右对齐**，
数值列不居中。政策集中在 `styles/state.css` 末节，用 `:where()`（特异度 0）声明，
页面要覆盖永远覆盖得动；各页面文件里原先那 40 多处分散声明现在是冗余的。
两处**故意居中**：热力图的日号（对齐的是日历格）与占比图的合计（对齐的是柱子）。

---

## 10. 文件职责表

**硬约束：单文件不超过 300 行。** 行数不写死在这里 —— 手写的行数每次改动都要同步，注定腐烂。

```powershell
Get-ChildItem src -Recurse -File |
  Sort-Object FullName |
  ForEach-Object { $_.FullName.Replace((Get-Location).Path + "\src\", "") + "  " + (Get-Content $_.FullName | Measure-Object -Line).Lines }
```

下面按**职责**分组，不按行数。想知道当前行数就跑上面那条命令。

### 协议层 a2ui/ —— 组件白名单与渲染

| 文件 | 职责 |
| --- | --- |
| `protocol.js` | 17 个组件白名单 + 构造器 + 信封统一封装 |
| `apply.js` | `applyMessages` / `resolveTree` / 校验。**纯函数，零 React** |
| `render.jsx` | 白名单的 React 实现 |

### Agent 层 agent/ —— 意图、统合、流程、任务图

| 文件 | 职责 |
| --- | --- |
| `planner.js` | `parseIntent` / `fromText` / `fromAction` / `plan`；`ACTIONS` 目录 |
| `brief.js` | **六个统合视图**：首页 / 账单 / 订阅 / 核对 / 回执 / 跨场景 |
| `transferFlow.js` | 转账四步流程（定时与 AA 共用它） |
| `taskGraph.js` | 任务 DAG：拓扑排序 + 中断 / 回退 / 接管 |

### 业务层 services/ + domain/ —— 唯一事实来源

| 文件 | 职责 |
| --- | --- |
| `banking.js` | `buildDataModel` **唯一事实来源** + 跨域汇总 + 校验 |
| `policy.js` | **权限分级**：三级分档 + 操作目录 |
| `audit.js` | 审计：决策链路 + 安全锁定 |
| `guard.js` | 注入防御：越权 / 诱导两类模式 |
| `limits.js` | 限额一等对象 + 时间窗 + `checkLimits` |
| `anomalyRules.js` | 12 条异常规则 + 统计工具 |
| `anomaly.js` | 检测 → 评分 → 分档 → 误报抑制 |
| `domain/wealth.js` | 理财种子数据：7 只基金 / 持仓 / 榜单口径 |
| `services/wealth.js` | 收益与七日年化四算法 / 榜单 / 申购校验与记账 |
| `domain/bank.js` | 账本：四则余额模型 + 原子转账 |
| `domain/conversations.js` | 会话持久化 |

### 状态层 state/ —— 每个 hook 一个状态机

| 文件 | 职责 |
| --- | --- |
| `useConversations.js` | 会话持久化（含函数式补丁） |
| `useTurnRunner.js` | 回合执行：输入 → 计划 → 信封 → 落进会话 |
| `useTransferFlow.js` | 转账四步状态机 |
| `useSecurity.js` | **安全门禁**：三级路由 + 锁定 |
| `useUndoWindow.js` | 5 秒可撤销窗口 |
| `useThreadScroll.js` | 滚动锚定（非对称迟滞 + 意图优先） |
| `useBackendBank.js` | 后端模式同步 |

### 视图层 views/

| 文件 | 职责 |
| --- | --- |
| `AssistantView.jsx` | 业务层：工作区 + 历史条 + 任务图 + 被拦提示 |
| `product.jsx` | 产品层路由 |
| `parts.jsx` | 共用零件：Page / Panel / StatBar / IconTile / Row / CountUp；三态从 StateBlock 转出 |
| `shared.jsx` | 分类视觉语言的兼容层（实现已搬到 avatars） |
| `avatars.jsx` | **16 类 PFC 头像体系** + 品牌色常量 |
| `charts.jsx` | **六种图表形态**，共享高亮状态 |
| `pages/overview.jsx` | 概览：余额主卡 + 宫格 |
| `pages/feed.jsx` | 动态：三段时间轴 + 可展开 |
| `pages/bills.jsx` | 账单：结论 → 结构 → 节奏 → 明细 |
| `pages/subscriptions.jsx` | 订阅：一项一张身份卡 |
| `pages/cards.jsx` + `cardProfile` + `cardFreeze` + `cardLoss` + `cardFace` | 卡包 / 档案 / 冻结流程 / 挂失补卡流程 / 卡面 |
| `pages/cardData.jsx` + `cardUtils.jsx` | 卡片演示数据与账期模型 |
| `pages/payees.jsx` | 收款人 |
| `pages/transfer.jsx` | 转账页（渲染同一套 A2UI surface） |
| `pages/wealth.jsx` | 理财：收益长图 + 里程碑 + 3 个榜单 + 申购四步 |
| `pages/receipts.jsx` | 回执 |

### 外壳 components/

| 文件 | 职责 |
| --- | --- |
| `App.jsx` | 状态编排；产出 `ctx`；派发 action |
| `Sidebar.jsx` | 首页块 + 功能列表 + 历史对话 |
| `Composer.jsx` | 输入区（IME 三级防护 + autosize） |
| `FlowLauncher.jsx` | 常驻入口（4 项动作） |
| `TaskGraph.jsx` | 任务 DAG 呈现 + 三个控制 |
| `AuthDialog.jsx` | 多因子认证 |
| `BlockedNotice.jsx` | 被拦下的请求：拦了什么 / 为什么 / 依据 |
| `StateBlock.jsx` | 空 / 错 / 加载三态的唯一实现 |
| `StateBlock.jsx` | **空 / 错 / 载三态的唯一实现**（ZA 口径：4 字状态 + 1 个动作 / 拟人化标题 + 错误码 / 零文字） |
| `AppOverlays.jsx` | 浮层栈（纯组合，无逻辑） |
| `UndoBar.jsx` / `ConfirmDialog.jsx` / `TransferDialog.jsx` / `Toast.jsx` | 其余浮层 |

### 样式 styles/

| 文件 | 职责 |
| --- | --- |
| `tokens.css` | **设计令牌唯一来源** |
| `app.css` | 外壳 / 背景 / 浏览器表面 |
| `pages.css` | 侧边栏 / 视图头 / 面板 / 卡面 |
| `views.css` | StatBar / IconTile / Row / 按日分组 / 撤销条 |
| `motion.css` | 对焦切换 / 错峰 / 分类签名动作 |
| `a2ui.css` / `charts.css` / `wallet.css` / `avatars.css` | 各模块自己的样式 |
| `auth.css` / `taskgraph.css` / `blocked.css` | 三个浮层 |
| `state.css` | 空 / 错两态的外观 + **全站数值对齐政策**（等宽数字、数值列与表头右对齐） |

## 11. 已知限制与升级路径

| 限制 | 现状 | 升级路径 |
| --- | --- | --- |
| **意图理解是规则引擎**，不是 LLM | 演示环境 | 接口已隔离在 `parseIntent` 一处，换成 LLM 只改这一个函数 |
| **没有接入 RAG** | 未实现 | 银行规则与费率表可做本地知识库检索 |
| **余额并发** 靠 `ledgerVersion` 快照比对 | 单机演示够用 | 真后端里这一步是「限额校验 + 占用 pending」同事务 |
| **审计只在内存** | 环形缓冲 200 条 | 结构按可落库设计（每条自带 id / seq / at） |
| **规则引擎未接前端** | `anomaly.analyze` 已跑通并有 32 条测试 | 界面上还没有呈现异常标记，是下一步 |
| **理财域不存在** | 赛题要求，尚未实现 | 至少做到「收益查询 + 申购流程」 |
| **沙箱隔离未实现** | 本项目不生成并执行代码 | 若被追问，给 Monzo 的「受限工具子集」定义作为方向 |

完整的已知风险清单见 [SECURITY.md](SECURITY.md) §3。

---

## 12. 维护记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-02 | 新增 **§7.17 挂失补卡**（状态机唯一不可逆的边：后果先摊开 → 多因子 → lost → 补卡进度），§7.8 的卡面补第三种材料 |
| 2026-09-28 | 新增 §2A 两层定义与 §5A 视觉规约（后续并入本文对应章节） |
| 2026-09-28 | 建立本文档：as-is 与 to-be，全部用 Mermaid |
