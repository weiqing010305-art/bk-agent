# AGENTS.md — 项目级开发规约（索引）

> **产品架构在 [`doc/PRODUCT-ARCHITECTURE.md`](doc/PRODUCT-ARCHITECTURE.md)（受保护，agent 不得自行修改）。**
> **决策台账在 [`doc/DECISIONS.md`](doc/DECISIONS.md)（每条 ≤100 字 + 一张 Mermaid）。**
> 任何在本仓库工作的 agent 都必须先读这两份。
>
> 本文件保留，是因为 agent 会自动加载它；但它**只做索引，不复制内容** ——
> 两处写同样的规则必然打架（这正是这次重构要解决的问题）。

---

## 三件必须知道的事

1. **ponytail ultra 全程开启** —— 依赖白名单只有 `react` / `react-dom` / `lucide-react` / `vite` / `@playwright/test`；
   删除优先于新增；单文件 < 300 行；组件里禁止颜色字面量。详见真源 §2.1。

2. **改代码前先看两份文档**：
   - `doc/PRODUCT-ARCHITECTURE.md` = **骨架**（A-01..A-06 不变量）。**agent 不得自行修改**，
     要改必须先拿到用户明确同意，并在 §5 记一行 supersede。
   - `doc/DECISIONS.md` = **血肉**（D-xx）。每条 ≤100 字 + 一张 Mermaid，改了不影响骨架。

3. **文档同步是强制的**：改结构 / 数据流 / 接口 / 组件层级，必须在同一次改动里更新对应文档。
   文档过期视为 bug。

---

## 文档地图

| 文档 | 职责 |
| --- | --- |
| **`doc/PRODUCT-ARCHITECTURE.md`** | **产品架构（受保护）**：A-xx 不变量 + 守门检查 + 变更协议 |
| **`doc/DECISIONS.md`** | **决策台账**：D-xx，每条 ≤100 字 + Mermaid；§3 是用户原话附录 |
| `doc/ARCHITECTURE.md` | 系统架构、组件树、数据流、状态机，全部用 Mermaid |
| `doc/PRD.md` | 产品需求、交互、验收标准 |
| `doc/SECURITY.md` | 权限分级实现说明与已知风险清单（比赛必交） |
| `doc/COMPETITION.md` | 赛题拆解、评分维度、答辩脚本 |
| `doc/CHANGELOG.md` | 变更记录 |

---

## Windows 上的已知坑

`npx vite build` 报 `remove ...\Temp\esbuild-xxx: Access is denied` 时，不是代码问题 ——
是系统 TEMP 被占用。绕法：

```powershell
$env:TEMP = (Resolve-Path .tmp-build).Path; npx vite build
```

---

## 验证义务

```bash
npm test            # 单元测试
npm run build       # 构建
npm run test:e2e    # 端到端
npm run test:text   # 字数：单页界面文案 <= 150
npm run test:copy   # 渲染层禁用词扫描（演示/模拟/预设规则）
npm run test:docs   # Mermaid 全部可渲染
npm run test:smoke  # 全站烟测
npm run test:flow   # 转账四步流程
npm run test:motion # 动效是否真的在跑
```
