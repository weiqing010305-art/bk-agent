# PRODUCT-ARCHITECTURE — 产品架构（受保护）

> **本文记录「不许轻易改」的产品架构与不变量。**
> 改这里的任何一条，必须：**用户明确同意 → 在 §5 记录 supersede 关系 → 同步 §3 的守门检查。**
>
> 与 [DECISIONS.md](DECISIONS.md) 的分工：**本文 = 骨架（改了会塌）**；DECISIONS.md = 血肉（可以改）。
>
> 最后更新：2026-09-29

---

## §1 产品是什么

**两个并列目标**（缺一不成立）：技术上是**银行所有业务的统一入口**；业务上是**个人资产管家**。

```mermaid
flowchart TB
    subgraph BIZ["产品层 · 功能页"]
        direction LR
        B1["概览"] --- B2["账单"] --- B3["订阅"]
        B4["卡片"] --- B5["理财"] --- B6["转账"]
    end
    subgraph AGENT["业务层 · 对话"]
        direction LR
        A1["问候 + 连续对话流"] --> A2["意图理解"] --> A3["统合视图"]
    end
    AGENT -->|"Agent 调取已产品化的能力"| BIZ
    BIZ -.->|"同一份账本，两种入口"| AGENT
```

**不变量**：
- **A-01** ChatBox **只是一个功能**，不取代产品层。两者并存，共用同一本账。
- **A-02** 业务能力**先产品化，Agent 才调得动**。不做只有对话能到达的功能。

---

## §2 不变量（Invariants）

### A-03 · Agent 不产出事实

Agent 只产出 `{path}` 引用；**只有 service 能写 dataModel**。解析不到就显示占位符，绝不猜。

```mermaid
flowchart LR
    P["planner / brief<br/>只产出引用"] -->|"bind"| DM["dataModel"]
    S["services/banking.js<br/>唯一写入者"] -->|"写真实值"| DM
    DM --> R{"解析得到？"}
    R -->|"是"| V["显示真实值"]
    R -->|"否"| N["显示占位符<br/>不猜"]
```

**为什么是骨架**：这是幻觉防护的实现方式。破坏它 = 数字可能是编的。

### A-04 · 权限分级是唯一门禁

风险等级**由操作类型 + 金额 + 日累计推出**，调用方只能报「做什么」，不能报「多危险」。

```mermaid
flowchart TB
    R["写操作请求<br/>op + amount + todayTotal"] --> Q{"白名单内？"}
    Q -->|"否"| H["按最高风险"]
    Q -->|"是"| L["查 OPERATIONS 定级"]
    L -->|"低"| L1["静默执行"]
    L -->|"中"| L2["展示详情 + 确认"]
    L -->|"高"| L3["多因子认证"]
    L1 --> E["执行"]
    L2 --> E
    L3 --> E
```

**为什么是骨架**：降级这个动作在 API 上不存在，所以任何 Prompt 都无法伪造降级。破坏它 = 注入防御失效。
### A-05 · 动线无感，任务编排可见

这是两个不同的东西，曾经混淆过。

```mermaid
flowchart LR
    subgraph N["用户动线 —— 无感"]
        direction TB
        N1["说一句话直接到核对步"] --> N2["跨域信息一次给全"] --> N3["5 秒可撤销"]
    end
    subgraph V["任务编排 —— 可见"]
        direction TB
        V1["定时转账 8 节点 DAG"] --> V2["中断 / 回退 / 人工接管"]
    end
    N -.->|"界面上不放流程图"| X["X 管线面板"]
    V -.->|"用户自己的多步任务"| Y["OK 任务图"]
```

### A-06 · 依赖白名单

```mermaid
flowchart LR
    W["react · react-dom<br/>lucide-react · vite<br/>@playwright/test"] --> OK["只有这些"]
    NEW["任何新依赖"] --> NO["不加"]
    NO --> WHY["图表手绘 SVG<br/>头像手抄品牌色<br/>任务图自研 178 行"]
```

---

## §3 守门检查（改了架构就会红）

| 不变量 | 守它的命令 | 它检查什么 |
| --- | --- | --- |
| A-03 只产出引用 | `npm test` | 组件结构里不含写死的事实数字 |
| A-04 风险不可声明 | `npm test` | 传 level:low 仍判高风险；分两笔绕不过日累计 |
| A-05 动线无感 | `npm run test:e2e` | 界面上不得出现 `.inspector` |
| A-06 无新依赖 | 人工 | 依赖白名单 |
| 单页 ≤150 字 | `npm run test:text` | 界面文案口径（数据不计） |
| 界面无演示备注 | `npm run test:copy` | 渲染层含 title / aria-label / placeholder |
| 文档 Mermaid 可渲染 | `npm run test:docs` | 真实 Mermaid 解析器逐块 parse |

---

## §4 变更协议

```mermaid
flowchart LR
    P["有人要改 §1 或 §2"] --> Q{"用户明确同意？"}
    Q -->|"否"| STOP["不改<br/>改 DECISIONS.md 去"]
    Q -->|"是"| LOG["§5 记一行 supersede"]
    LOG --> SYNC["同步 §3 的守门检查"]
    SYNC --> CI["全部验证跑绿"]
```

**规则**：
- §1 / §2 的每一条都有编号（A-xx），**引用时用编号**，不要凭印象描述
- 被推翻的条目不删除，在 §5 标 `A-03 → A-11`，保留可追溯性
- **任何 agent 都不得自行修改本文** —— 只有用户点头才能改

---

## §5 变更记录

| 日期 | 变更 | 谁同意 |
| --- | --- | --- |
| 2026-09-29 | 建立本文档：A-01..A-06 六条不变量 + 守门检查 + 变更协议 | 用户要求「有一个专门记录产品 architecture 的地方，确保其不被轻易改变」 |
