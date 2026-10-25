# 流式回复验证 · 2026-10-23

## 实现范围

POST `/api/agent/turn` 在 Accept 为 `text/event-stream` 时返回 thinking → delta → complete/error；默认仍返回原 JSON。模型调用仍为完整实体提取，服务端校验并提交任务后才分段发送用户回复，**不是直接展示模型 token 或内部推理**。确认和资金接口没有改变。新聊天不会被旧流导航；断流不会以部分文本生成核对动作，重试保留原请求 ID。

## 实际通过

| 检查 | 结果 |
| --- | --- |
| 后端隔离数据库 `pytest backend/tests` | 97 项，新增流协议、任务持久化、重试不重复调用模型、不提前扣款、版本错误和输入校验 |
| `npm test` | 原前端单元 117 项 |
| `node --test tests/agent-stream.test.js` | 3 项，逐字节中文/emoji、CRLF 分包、断流拒绝、错误和 JSON 兼容 |
| `node tests/agent-stream-ui.mjs` | 1440/390px，真实 ReadableStream 增量渲染、加载动画、输出期间无业务动作、减少动态效果、断流重试、新聊天隔离；使用受控浏览器回复替身 |
| `AGENT_LIVE_TEST=1 node tests/agent-flow.mjs` | 真实模型/前后端/虚构账户，追问 → 自动核对 → 修改 → 密码 → 回执；手机及延迟回复隔离 |
| `AGENT_LIVE_TEST=1 node tests/agent-inputs-live.mjs` | 真实模型手机充值追问 → 页面修改 → 密码 → 回执，旧版/错密码/重复支付保护，以及九组独立输入 |
| 构建与样式检测 | 构建成功；Impeccable 机械检测无问题；约 523 KB 的已有单包体积提示保留 |

截图：`.local/agent-thinking-1440.png`、`.local/agent-thinking-390.png`、`.local/agent-streaming-1440.png`、`.local/agent-streaming-390.png`。已检查桌面加载与手机增量状态，无溢出，沿用薄荷色。

首次真实浏览器回归遇到 Chromium 不保存 SSE 正文的测试工具限制；测试辅助函数改为按原会话查询已提交任务后复跑通过。增量显示另由流解析和浏览器专项断言，未将查询任务等同于证明逐段渲染。

仅使用已授权虚构测试数据，不涉及真实资金或运营商。不把有限样本宣称为所有输入均可靠；旧导航套件的历史问题见前期验证记录，本轮未重跑或计为通过。未修改受保护架构，未推送 GitHub。
