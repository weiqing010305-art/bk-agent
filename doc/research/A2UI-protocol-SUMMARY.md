# 调研主题 A：A2UI / Agent-to-UI 协议 —— 浓缩版结论

报告全文（1318 行，已通过 JSON 校验）：`bk-agent/doc/research/A2UI-protocol.md`
原始抓取留档：`bk-agent/doc/research/_raw/`（20 份协议原文/README，可复核）

## 一、事实核验（gh api 实测，2026-09-28）
- **A2UI 官方仓库 = https://github.com/a2ui-project/a2ui**（`gh api repos/google/A2UI` 301 重定向到此，证实是同一仓库）。**16530★ · Apache-2.0 · 2025-09-24 建仓 · 2026-09-26 仍在日级提交（PR 已到 #2811）**。官网 https://a2ui.org/ 。
- **当前生产版 = v0.9.1**（`Status: Current Production`，Last Updated Dec 3 2025，spec 已 closed）；**v1.0 = release candidate**（前身叫 v0.10，Last Updated Jun 8 2026）。v0.8.2 是 legacy。
- 官方渲染器只有 **React / Angular / Lit / Markdown**；基础 catalog 含 **18 组件 + 13 函数**（Text/Image/Icon/Video/AudioPlayer/Row/Column/List/Card/Tabs/Modal/Divider/Button/TextField/CheckBox/ChoicePicker/Slider/DateTimeInput）。

## 二、v0.9.1 → v1.0 关键差异（4 条信封消息两版同名）
| 维度 | v0.9.1 | v1.0 | 本项目影响 |
|---|---|---|---|
| createSurface | 不可内联组件，须再发 updateComponents | **可内联 components + dataModel** | ✅ 刚需：一条消息出一个完整卡片 |
| theme 字段 | 有（primaryColor 等） | **移除**，样式交给框架原生主题 | ✅ 刚需：本项目颜色唯一来源是 tokens.css |
| 双向函数调用 | 无 | callRendererFunction / callAgentFunction | ❌ 不实现 |
| 命名规则 | — | 强制 UAX #31 | ✅ 组件名用 PascalCase 即可 |
→ **结论：按 v1.0 形状写，渲染器对「带/不带 components 的 createSurface」都容错，即可兼容 v0.9.1 后端。**
⚠️ 最大坑：网上大量早期资料讲的是 v0.8 的 `surfaceUpdate` / `beginRendering` / `dataModelUpdate`——**那套已封闭，别抄**。

## 三、机制要点
- **邻接表**：UI = 扁平组件数组，靠 `id` 互引；**必须有且仅有一个 `id: "root"`**；收到 root 前其他更新会被缓冲。本地实现 = 一个 `Map` + 从 root 递归。
- **Catalog = JSON Schema 文档**，同时是「组件白名单」+「给 LLM 的 instructions」。组件/函数级 catalogId → surface 默认 catalogId → **报错，无回退**。硬约束：`$defs` 只允许 anyComponent/anyFunction；每个组件 schema 必须有 `"component": {"const": "<同名>"}`；结构引用必须用 `ComponentId`/`ChildList`。
- **流式增量**：协议明确要求允许前向引用、缺失引用先占位（progressive rendering）。渲染器写成纯函数后，消息变多零成本。
- **无障碍是规范强制的**（accessibility.label/description/live/hidden → aria-live 等），与 AGENTS.md「无障碍是底线」一致。

## 四、生态对比（全部 gh api 实测）
| 方案 | star | License | 格式 | 适合本项目？ |
|---|---|---|---|---|
| **A2UI** | 16530 | Apache-2.0 | JSON 信封+邻接表 catalog | ✅ **只借协议，零依赖** |
| AG-UI | 16073 | MIT | 31 种事件（TEXT_MESSAGE_*/TOOL_CALL_*/STATE_*…） | ⚠️ 借 `part.state` 三段式思路；AG-UI 仓库内有官方 `a2ui-toolkit`（`assembleOps`/`wrapAsOperationsEnvelope` 值得抄） |
| MCP-UI（MCP-UI-Org/mcp-ui，非 mcp-ui/mcp-ui） | 5182 | Apache-2.0 | HTML + `ui://` + sandbox iframe + postMessage JSON-RPC | ❌ 银行场景安全负债 |
| OpenAI Apps SDK | — | 闭源宿主 | 同 MCP Apps 族 | ❌ 需 MCP server |
| Vercel AI SDK UI（tool-call） | 27001 | NOASSERTION | `part.type==='tool-<name>'` + state | ✅ 只借三段式（input-available/output-available/output-error） |
| Vercel AI SDK RSC（streamUI/createStreamableUI） | 同上 | — | RSC 树 | ❌ **官方标注 experimental，明列 5 条缺陷劝退** |
| Thesys OpenUI | 9863 | MIT | 行式 DSL（`root = Stack([...])`） | ❌ 需装运行时+Zod；token 优势对无 LLM 项目为零 |
| vercel-labs/json-render | 18346 | Apache-2.0 | `{root, elements}` flat spec | ❌ 框架需装包，但 spec 形状可作简化参考 |
| CopilotKit | 37568 | MIT | AG-UI + A2UI runtime | ❌ 体量过大 |
| assistant-ui | 12331 | MIT | React 聊天组件 | ❌ 不装（交互细节已有 _tmp 留档） |

## 五、纯前端 mock 无 LLM 时的正确用法（核心结论）
1. **A2UI 官方 README 原文允许「uses a pre-generated A2UI Response」**——即协议允许 UI 描述是预先写好的。**没有 LLM 不是拒绝 A2UI 的理由**，此时它退化为一份纯粹、可单测的 UI DSL。
2. **协议先行，不引依赖**：A2UI 是消息格式规范而非库。只写 ① catalog 常量 ② 约 80 行纯函数渲染器 ③ mock 层产出 A2UI 信封。**零新增 npm 依赖**，符合 AGENTS.md 白名单。
3. **后端替换为零成本的三个前提**：① 消息必须是纯 JSON（无 React 元素/函数）；② 交互只走 `action.event.name` 字符串，由渲染器回抛给上层 dispatch；③ 渲染器不关心来源，只是 `applyMessages(state, messages)` 纯函数。满足后，接真后端只改一行：`stream.onmessage = e => applyMessages(JSON.parse(e.data))`。
4. **严格白名单同时拿到安全性与设计一致性**——catalog 里根本没有「颜色」字段，所以 LLM（或 mock）不可能产出违反 tokens.css 的 UI。

## 六、最小子集提案（报告 §9 有完整 Schema + 四类真实消息）
- **信封**：`createSurface` / `updateComponents` / `updateDataModel` / `deleteSurface`（v1.0 形状）。
- **组件 6 个**：`Text`（variant: caption/body/title/amount）、`Icon`（name + tone）、`Row`、`Column`、`Card`（child + tone + 可选 action）、`ActionGroup`（最多 2 个按钮）。
- **删掉**：functionCall action、functions 目录、List 模板、全部表单类组件、theme、双向函数调用。
- **四类场景已给出可直接当 mock 数据的真实 JSON**：① 欢迎页（Column + Row + 4 张 Card，tone 复用现有 mint/blue/peach/lilac）② 纯文本气泡（单个 Text 或 Row+Icon+Text 作 root，带 `accessibility.live`）③ 业务卡片（Card→Column，`{"path":"/incomeText"}` 数据绑定 + 后续 updateComponents/updateDataModel 演示渐进渲染）④ 确认操作（ActionGroup 两个按钮，`transfer.confirm` / `transfer.cancel` 纯字符串事件 + deleteSurface 换结果面）。

## 七、本项目现状（实际读码）
- `src/surfaces/catalog.js`（11 行，含 mint/blue/peach/lilac 的 tone）**已是 catalog 雏形**；`src/surfaces/` 下有 6 个 `*Surface.jsx`。
- **但那 6 个 Surface 组件是死代码**：全仓库只有 ChatHeader/Sidebar import 了 `catalog.js`，**没有任何文件 import 那些 Surface.jsx**；业务卡片仍内联在 `main.jsx` 第 253–266 行的一大串 `{m.kind === 'xxx' && …}`。
- → 改造 = **补完已有结构**，不是从零引入。预计净减约 100 行，符合 AGENTS.md 的 ultra（净增行为正需说明理由）。

## 八、报告文件
- 正稿：`bk-agent/doc/research/A2UI-protocol.md`（1318 行 / 75928 B，13 个 JSON 块全部通过 `ConvertFrom-Json` 校验）
- 原始证据：`bk-agent/doc/research/_raw/`（a2ui README、v0.9.1/v1.0 协议全文、4 份官方 JSON Schema、basic catalog 45034B、React renderer README、AG-UI 94359B schema、MCP-UI protocol-details、Vercel AI SDK generative-ui + RSC migration、OpenUI spec v0.5 + 官方对比表、json-render README）