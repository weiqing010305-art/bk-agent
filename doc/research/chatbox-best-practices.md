# ChatBox / 对话式 AI 界面最佳实践与开源实现调研

> 调研主题 B · 面向「青禾 · 银行 AI 资金管家」前端重构（极简优雅的苹果风格 ChatBox）
> 调研日期：**2026-09-28**（所有 star / 更新时间均为此日通过 \`gh api\` 实测值）
> 证据等级：所有 star、License、push 时间均由 GitHub API 实时查询；所有代码片段均从 \`gh api repos/{owner}/{repo}/contents/{path}\` 实际拉取的原文摘录，未凭记忆书写。
>
> ⚠️ **本文所有"推荐依赖"均已按 \`bk-agent/AGENTS.md\`（ponytail ultra：仅允许 react / react-dom / lucide-react / vite / @playwright/test）做过过滤。凡涉及第三方库的方案，本文都只把它当作"算法参考"，并给出零依赖的等价实现。**

---

## 0. 结论速览（TL;DR）

| # | 结论 | 证据来源 |
|---|---|---|
| 1 | **不要**给 ChatBox 做虚拟滚动，除非单会话稳定超过 ~1000 条消息 | assistant-ui 官方虚拟滚动示例明确以 "500-message thread" 为演示规模，且需要引入 \`@tanstack/react-virtual\` |
| 2 | 滚动锚定必须用**"上滑意图检测 + followBottom 意图位"**，而不是"每次新内容就 scrollToBottom" | assistant-ui \`useThreadViewportAutoScroll.ts\`、Lobe Chat \`VirtualizedList.tsx\` |
| 3 | 中文输入法 Enter 提交必须**双重防护**：\`compositionstart/end\` 状态位 + \`e.nativeEvent.isComposing\`；**Safari 还要额外用时间戳兜底** | Open WebUI \`MessageInput.svelte\` L701-725；Vercel AI Elements \`prompt-input.tsx\` L977-996 |
| 4 | 发送按钮是**四态状态机**：idle(↑) / submitted(Spinner) / streaming(■) / error(×) | Vercel AI Elements \`prompt-input.tsx\` L1226-1236 |
| 5 | "极简输入框"的本质是 **一个 focus 点**：容器 \`cursor-text\` + \`onClick → textarea.focus()\`，而不是给 textarea 加边框 | prompt-kit \`prompt-input.tsx\` L85-93 |
| 6 | 移动端输入框**字号必须 ≥16px**，否则 iOS Safari 会自动放大页面 | assistant-ui \`mobile-composer.tsx\` 用 \`text-[16px]\` 并加注释说明 |
| 7 | 流式消息用 \`role="log"\`（隐式 \`aria-live="polite"\` + \`aria-atomic="false"\`），**不要**手写 \`aria-live="assertive"\` | W3C WCAG 2.2 技术 ARIA23；Vercel AI Elements / prompt-kit 均直接写在滚动容器上 |
| 8 | 对话 UI 显得廉价的主因是**工具栏外露 + 气泡尾巴 + 大圆角大阴影 + 每个 token 都触发 scrollIntoView** | 见第 9 节反模式 |

---

## 1. 标杆项目实测元数据（2026-09-28 实测）

查询命令（可复现）：

\`\`\`powershell
gh api repos/OWNER/REPO --jq '{full_name,html_url,stargazers_count,license:.license.spdx_id,pushed_at,archived}'
\`\`\`

| 项目 | 完整 URL | ★ Star | License | 最近 push | 与我们的相关性 |
|---|---|---|---|---|---|
| assistant-ui/assistant-ui | https://github.com/assistant-ui/assistant-ui | **12,331** | MIT | 2026-09-28 | ★★★★★ primitive 拆分范本 |
| vercel/chatbot（原 vercel/ai-chatbot，仓库已改名） | https://github.com/vercel/chatbot | **20,971** | NOASSERTION（LICENSE 文件为自定义，见 \`LICENSE\`） | 2026-07-08 | ★★★★ 工程实践 |
| vercel/ai（AI SDK） | https://github.com/vercel/ai | **27,001** | NOASSERTION（自定义 LICENSE） | 2026-09-28 | ★★★★ \`useChat\` 状态机 |
| vercel/ai-elements | https://github.com/vercel/ai-elements | **2,466** | NOASSERTION（自定义 LICENSE） | 2026-09-01 | ★★★★★ 输入框 / 滚动容器 |
| lobehub/lobehub（原 lobehub/lobe-chat，仓库已改名） | https://github.com/lobehub/lobehub | **82,866** | NOASSERTION（LICENSE 在 \`canary\` 分支） | 2026-09-28 | ★★★★★ 滚动锚定 |
| LibreChat-AI/LibreChat（原 danny-avila/LibreChat，已改名） | https://github.com/LibreChat-AI/LibreChat | **45,009** | MIT | 2026-09-28 | ★★★★ 消息渲染 / 错误态 |
| open-webui/open-webui | https://github.com/open-webui/open-webui | **153,393** | NOASSERTION（自定义 LICENSE） | 2026-09-28 | ★★★★★ IME 陷阱 |
| CopilotKit/CopilotKit | https://github.com/CopilotKit/CopilotKit | **37,568** | MIT | 2026-09-28 | ★★★ Generative UI |
| shadcn-ui/ui | https://github.com/shadcn-ui/ui | **124,720** | MIT | 2026-09-24 | ★★★ 组件底座 |
| ibelick/prompt-kit | https://github.com/ibelick/prompt-kit | **3,092** | MIT | 2026-03-12 | ★★★★★ 极简输入框 |
| stackblitz-labs/use-stick-to-bottom | https://github.com/stackblitz-labs/use-stick-to-bottom | **778** | MIT | 2026-06-04 | ★★★★★ 滚动锚定算法参考 |
| ChatGPTNextWeb/NextChat | https://github.com/ChatGPTNextWeb/NextChat | **88,821** | MIT | 2026-08-11 | ★★ 参考性一般 |
| mckaywrigley/chatbot-ui | https://github.com/mckaywrigley/chatbot-ui | **33,349** | MIT | **2024-08-03**（已停更 2 年） | ★ 反面教材 |
| continuedev/continue | https://github.com/continuedev/continue | **36,050** | Apache-2.0 | 2026-09-27 | ★★ IDE 内对话 |
| reworkd/AgentGPT | https://github.com/reworkd/AgentGPT | **36,297** | GPL-3.0 | **已归档 archived=true** | ✗ 不要参考 |

> **重要提醒（命名变更）**：\`vercel/ai-chatbot\` → \`vercel/chatbot\`；\`lobehub/lobe-chat\` → \`lobehub/lobehub\`；\`danny-avila/LibreChat\` → \`LibreChat-AI/LibreChat\`。用旧名 \`gh api\` 会 301 重定向，能拿到数据但 \`html_url\` 会是新名。

---

## 2. assistant-ui：primitive 拆分方式（最值得抄的架构）

### 2.1 拆分哲学：每个 UI 原子 = 一个 primitive，状态全部从 store 订阅

源文件树（\`gh api repos/assistant-ui/assistant-ui/git/trees/main?recursive=1\`）显示其 \`packages/react/src/primitives/\` 按**界面名词**切分，每个名词一个目录，目录内每个可视原子一个文件：

\`\`\`
packages/react/src/primitives/
├── composer/                        ← 输入区
│   ├── ComposerRoot.tsx             ← 容器（提供 context）
│   ├── ComposerInput.tsx            ← textarea（IME/autosize/快捷键全在这）
│   ├── ComposerSend.ts              ← 发送按钮（只暴露 useComposerSend 行为）
│   ├── ComposerCancel.ts
│   ├── ComposerAttachments.tsx
│   ├── ComposerQuote.tsx
│   └── trigger/                     ← 斜杠命令 / @提及
├── thread/                          ← 消息列表容器
│   ├── ThreadRoot.tsx
│   ├── ThreadViewport.tsx           ← 滚动视口
│   ├── ThreadMessages.tsx
│   ├── ThreadScrollToBottom.ts      ← 「回到底部」按钮
│   ├── ThreadEmpty.ts               ← 空状态
│   └── useThreadViewportAutoScroll.ts  ← ★ 滚动锚定核心
├── message/
│   ├── MessageRoot.tsx
│   ├── MessageParts.tsx             ← 按 part 渲染（text/reasoning/tool/source）
│   └── MessageError.ts
├── messagePart/
│   ├── MessagePartText.tsx
│   ├── MessagePartInProgress.ts    ← ★ 流式中的光标/加载态
│   └── useMessagePartText.ts
├── actionBar/                       ← 消息下方悬浮操作条
│   ├── ActionBarRoot.tsx
│   ├── ActionBarCopy.tsx
│   ├── ActionBarReload.ts           ← 重试
│   └── useActionBarFloatStatus.ts   ← ★ 悬浮显隐策略
├── branchPicker/                    ← 分支切换
└── error/                           ← ErrorRoot / ErrorMessage
\`\`\`

**该抄什么（针对我们的 4 个业务模块）：**

| assistant-ui primitive | 我们对应的东西 |
|---|---|
| \`ComposerPrimitive.Root/Input/Send\` | 底部输入条（单文件拆 3 个函数组件即可，不必拆文件） |
| \`MessagePrimitive.Parts\`（按 part 渲染） | **这是关键**：把"文本回复 / 转账确认卡 / 账单图表卡 / 订阅卡 / 卡片管理卡"统一成 \`part.type\` 分派，而不是在 message 里写 if-else |
| \`ActionBarPrimitive.Root\` + \`useActionBarFloatStatus\` | 消息 hover 时才出现的「复制 / 重试 / 说人话」小工具条 |
| \`ThreadPrimitive.Empty\` | 首屏欢迎页 |
| \`ErrorPrimitive.Root\` | 统一的错误重试卡 |

> **对我们的直接建议**：把 \`src/main.jsx\`（275 行单组件）按 \`composer / thread / message / messagePart\` 四个名词切开，但**不要拆成 40 个文件**（违反 ponytail ultra 的"文件数越少越好"）。建议：\`ChatBox.jsx\`（滚动+输入+编排）、\`MessageParts.jsx\`（part 分派 + 各业务卡）、\`useThreadScroll.js\`（滚动锚定 hook）。三个文件足够。

### 2.2 关键代码：\`ComposerSend\` 只导出"行为"，不导出 UI

\`packages/react/src/primitives/composer/ComposerSend.ts\` 全文核心：

\`\`\`ts
export const useComposerSend = () => {
  const { disabled, send } = useComposerSendBehavior();
  const callback = useCallback(() => send(), [send]);
  if (disabled) return null;   // ← 不可发送时返回 null，而不是返回 disabled=true
  return callback;
};

export const ComposerPrimitiveSend = createActionButton(
  "ComposerPrimitive.Send",
  useComposerSend,
);
\`\`\`

**为什么这么写**：把"能不能发"这件事收敛到一个 hook 的返回值（\`null\` = 不能发），UI 层不再需要判断 \`disabled\`、\`isRunning\`、\`isEmpty\` 三个条件。我们抄这个思路：写一个 \`useSendState()\` 返回 \`{ canSend, canStop, mode }\`，让按钮组件变成纯展示。

---

## 3. 滚动锚定：对话 UI 最容易做错的地方

### 3.1 assistant-ui 的实现（最严谨，值得逐行理解）

**文件**：\`packages/react/src/primitives/thread/useThreadViewportAutoScroll.ts\`
**URL**：https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/primitives/thread/useThreadViewportAutoScroll.ts

核心状态（3 个 ref，缺一不可）：

\`\`\`ts
const lastScrollTop = useRef<number>(0);
const lastScrollHeight = useRef<number>(0);

// Pending bottom-scroll intent. Planted by initialize/run-start/switch/button
// triggers, cleared when handleScroll confirms we reached bottom, or when the
// user actively scrolls up while content size is stable.
const scrollingToBottomBehaviorRef = useRef<ScrollBehavior | null>(null);
const followBottomRef = useRef(autoScroll);
\`\`\`

滚动事件处理（**注意"上滑意图"的判定条件**）：

\`\`\`ts
const handleScroll = () => {
  const div = divRef.current;
  if (!div) return;

  const isAtBottom = threadViewportStore.getState().isAtBottom;
  const newIsAtBottom = isViewportAtBottom(div);

  const isInFlightDownwardScroll =
    !newIsAtBottom && lastScrollTop.current < div.scrollTop;
  if (isInFlightDownwardScroll) {
    // no-op: a smooth scroll-to-bottom fires many midpoint scroll events
    // before landing, don't flicker isAtBottom or clear intent mid-animation
  } else {
    const userScrolledUp = isUserScrollUp(
      { scrollTop: lastScrollTop.current, scrollHeight: lastScrollHeight.current },
      div,
    );

    if (newIsAtBottom) {
      // newIsAtBottom is ambiguous when the viewport doesn't overflow —
      // keep intent alive until content can actually scroll
      if (viewportOverflows(div)) {
        scrollingToBottomBehaviorRef.current = null;
      }
      if (autoScroll) followBottomRef.current = true;
    } else if (userScrolledUp) {
      cancelScheduledFrame();
      scrollingToBottomBehaviorRef.current = null;
      followBottomRef.current = false;   // ★ 用户上滑 → 解除跟随
    }
    ...
  }

  lastScrollTop.current = div.scrollTop;
  lastScrollHeight.current = div.scrollHeight;
};
\`\`\`

内容变高时（\`useOnResizeContent\` 回调）：

\`\`\`ts
const resizeRef = useOnResizeContent(() => {
  const div = divRef.current;
  if (!div) return;
  const { scrollHeight, clientHeight } = div;
  // 尺寸没变就直接返回 —— 避免 streaming 每帧都触发滚动
  if (scrollHeight === lastObservedScrollHeight.current &&
      clientHeight === lastObservedClientHeight.current) return;
  ...
  } else if (autoScroll && followBottomRef.current) {
    scrollToBottom("instant");   // ★ 只在"跟随中"才滚
  }
  handleScroll();
});
\`\`\`

并且滚到底部是**按帧节流**的：

\`\`\`ts
const scheduleScrollToBottom = useCallback((behavior: ScrollBehavior) => {
  scrollingToBottomBehaviorRef.current = behavior;
  cancelScheduledFrame();
  scheduledFrameRef.current = requestAnimationFrame(() => {
    scheduledFrameRef.current = null;
    scrollToBottom(behavior);
  });
}, [cancelScheduledFrame, scrollToBottom]);
\`\`\`

**还有一个极其细节的处理**：键盘激活（Enter/Space）展开折叠面板也会让内容变高，如果没有 pointer 事件，光靠 scroll 事件检测不到"用户意图"，所以它额外监听 keydown：

\`\`\`ts
const ACTIVATION_KEYS = new Set(["Enter", " "]);
// The composer renders inside the viewport, so its keystrokes bubble here;
// only an activation key aimed at something other than a text field is a
// gesture on thread content.
const cancelOnKeyDown = (event: KeyboardEvent) => {
  if (!ACTIVATION_KEYS.has(event.key)) return;
  const target = event.target as Element | null;
  if (target?.closest?.(TEXT_ENTRY_SELECTOR)) return;
  cancelPendingScrollToBottom();
};
\`\`\`

### 3.2 Lobe Chat 的实现（最简洁，最容易照搬到我们的项目）

**文件**：\`src/features/Conversation/ChatList/components/AutoScroll/index.tsx\`
**URL**：https://github.com/lobehub/lobehub/blob/main/src/features/Conversation/ChatList/components/AutoScroll/index.tsx

全文（去注释后不足 30 行，这就是我们该抄的形态）：

\`\`\`tsx
const AutoScroll = memo(() => {
  const atBottom = useConversationStore(virtuaListSelectors.atBottom);
  const isScrolling = useConversationStore(virtuaListSelectors.isScrolling);
  const isGenerating = useConversationStore(messageStateSelectors.isAIGenerating);
  const scrollToBottom = useConversationStore((s) => s.scrollToBottom);
  const dbMessages = useConversationStore(dataSelectors.dbMessages);

  const shouldAutoScroll = atBottom && isGenerating && !isScrolling;

  // Get the content length of the last message to monitor streaming output
  const lastMessage = dbMessages.at(-1);
  const lastMessageContentLength =
    typeof lastMessage?.content === 'string' ? lastMessage.content.length : 0;

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom(false);
    }
  }, [shouldAutoScroll, scrollToBottom, dbMessages.length, lastMessageContentLength]);

  return null;   // No visual output - this component only handles auto-scroll logic
});
\`\`\`

**三个可抄的点**：

1. **\`shouldAutoScroll = atBottom && isGenerating && !isScrolling\`** —— 一个布尔表达式把三个条件收敛。其中 \`atBottom\` 是"用户当前贴底"，\`isScrolling\` 是"用户正在手动滚动"（这解决了"流式内容变高导致滚动位置变化 → 被误判为用户滚动"的问题）。
2. **依赖数组里放 \`lastMessageContentLength\`** —— 流式时 \`dbMessages.length\` 不变，只有内容长度在变。只订阅 length 会导致流式期间完全不滚动。这是最容易被漏掉的一行。
3. **\`AutoScroll\` 放在列表最后一个 item 内部**，只在它可见时才触发（注释原文：*"Should be placed inside the last item of VList so it only triggers when visible"*）。

**阈值常量**：\`src/features/Conversation/ChatList/components/AutoScroll/const.ts\`

\`\`\`ts
/**
 * Threshold for determining if at the bottom (unit: px)
 * When the distance to the bottom is less than or equal to this value, considered at the bottom
 */
export const AT_BOTTOM_THRESHOLD = 300;
\`\`\`

⚠️ **注意**：300px 是**宽松**阈值。assistant-ui 的虚拟列表示例用的是 \`AT_BOTTOM_THRESHOLD = 4\`（\`examples/with-virtualized-thread/app/VirtualizedThread.tsx\`）。**建议我们取 32px 左右**：太小会因为亚像素误差闪断，太大会在用户其实已经上滑时还错误跟随。

**用户滚动意图的显式标记**（\`src/features/Conversation/ChatList/components/VirtualizedList.tsx\`）：

\`\`\`tsx
const USER_SCROLL_INTENT_TTL_MS = 500;
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp', ' ']);

const markUserScrollIntent = useCallback(() => {
  lastUserScrollIntentAtRef.current = Date.now();
}, []);

const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
  if (event.buttons > 0) markUserScrollIntent();   // 按住鼠标拖动才算
}, [markUserScrollIntent]);

const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
  if (SCROLL_KEYS.has(event.key)) markUserScrollIntent();
}, [markUserScrollIntent]);
\`\`\`

**为什么需要 \`USER_SCROLL_INTENT_TTL_MS\`**：鼠标滚轮和触摸滚动结束后，浏览器还会惯性触发若干 scroll 事件。用"最近 500ms 内有过真实输入意图"来判断，比单纯比较 \`scrollTop\` 更稳。

### 3.3 「回到底部」悬浮胶囊

Lobe Chat：\`src/features/Conversation/ChatList/components/BackBottom/index.tsx\`
assistant-ui 演示：\`packages/ui/src/components/react/assistant-ui/elements/scroll-anchor.tsx\`

assistant-ui 的实现带有**新消息计数**（这个细节很提质感）：

\`\`\`tsx
const newCount = pinned ? 0 : count - seenCount;
...
{!pinned && newCount > 0 && (
  <button
    type="button"
    onClick={jump}
    className={cn(
      floating,
      "fade-in slide-in-from-bottom-2 animate-in absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-transform duration-200 hover:-translate-y-px",
    )}
  >
    <ArrowDownIcon className="size-3 opacity-60" />
    {newCount} new {newCount === 1 ? "message" : "messages"}
  </button>
)}
\`\`\`

并且在视口顶部有一条**渐隐遮罩**，暗示"上面还有内容"：

\`\`\`tsx
<div
  aria-hidden
  className="from-background dark:from-popover pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b to-transparent"
/>
\`\`\`

> 这条渐变遮罩是"苹果风"的关键小细节，成本一行 CSS，效果显著。

### 3.4 零依赖落地版（给我们项目用）

结合上面三家，最小可用形态（**不引入任何库**）：

\`\`\`js
// useThreadScroll.js —— 无依赖
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const AT_BOTTOM = 32;          // px
const INTENT_TTL = 500;        // ms

export function useThreadScroll(dep) {          // dep: 让内容变高的信号（消息数 + 尾条长度）
  const scrollRef = useRef(null);
  const followRef = useRef(true);               // 是否跟随底部
  const intentRef = useRef(0);                  // 最后一次用户滚动意图时间戳
  const lastTopRef = useRef(0);
  const rafRef = useRef(0);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    followRef.current = true;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM;
    const movedUp = el.scrollTop < lastTopRef.current;
    lastTopRef.current = el.scrollTop;

    if (atBottom) {
      followRef.current = true;
    } else if (movedUp && Date.now() - intentRef.current < INTENT_TTL) {
      followRef.current = false;                // ★ 用户主动上滑 → 停止跟随
    }
  }, []);

  // 记录"用户意图"：滚轮 / 触摸 / 键盘 / 拖拽
  const markIntent = useCallback(() => { intentRef.current = Date.now(); }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const opts = { passive: true };
    el.addEventListener('wheel', markIntent, opts);
    el.addEventListener('touchmove', markIntent, opts);
    el.addEventListener('keydown', markIntent);
    el.addEventListener('scroll', onScroll, opts);
    return () => {
      el.removeEventListener('wheel', markIntent);
      el.removeEventListener('touchmove', markIntent);
      el.removeEventListener('keydown', markIntent);
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [markIntent, onScroll]);

  // 内容变高 → 仅在跟随时贴底
  useEffect(() => {
    if (followRef.current) scrollToBottom('instant');
  }, [dep, scrollToBottom]);

  return { scrollRef, scrollToBottom, isFollowing: followRef };
}
\`\`\`

---

## 4. 输入框：autosize + IME + Enter 提交

### 4.1 自动增高（三种实现的取舍）

**prompt-kit**（\`components/prompt-kit/prompt-input.tsx\`）—— 最直白，推荐抄：

\`\`\`tsx
const adjustHeight = (el: HTMLTextAreaElement | null) => {
  if (!el || disableAutosize) return;
  el.style.height = "auto";                                        // ★ 必须先归零，否则只能增不能减
  if (typeof maxHeight === "number") {
    el.style.height = \`\${Math.min(el.scrollHeight, maxHeight)}px\`;
  } else {
    el.style.height = \`min(\${el.scrollHeight}px, \${maxHeight})\`;
  }
};

useLayoutEffect(() => {
  if (!textareaRef.current || disableAutosize) return;
  const el = textareaRef.current;
  el.style.height = "auto";
  if (typeof maxHeight === "number") {
    el.style.height = \`\${Math.min(el.scrollHeight, maxHeight)}px\`;
  } else {
    el.style.height = \`min(\${el.scrollHeight}px, \${maxHeight})\`;
  }
}, [value, maxHeight, disableAutosize]);
\`\`\`

默认 \`maxHeight = 240\`，配套 CSS：\`min-h-[44px] w-full resize-none\`。

**assistant-ui** 直接用 \`react-textarea-autosize\` 的 \`TextareaAutosize\`，并提供 \`onHeightChange\` 回调（\`ComposerInput.tsx\` L17-20、L435-439）。**我们不引库，抄 prompt-kit 的版本即可。**

**Open WebUI** 用的是 CSS-only 方案：\`h-fit max-h-96 overflow-auto\`（\`src/lib/components/chat/MessageInput.svelte\` L2041）。这是最省事的，但 \`contenteditable\`（RichTextInput）下才可靠，纯 textarea 不建议。

> ⚠️ **关键点**：把 autosize 逻辑放在 \`useLayoutEffect\` 而**不是** \`onChange\`。放在 onChange 里会在受控组件回填值（如"编辑历史消息"）时失效。

### 4.2 中文输入法 Enter 提交陷阱（★ 本节是重中之重）

#### 陷阱是什么

中文/日文输入法在**选字阶段**按 Enter 是"确认候选词"，不是"提交"。而浏览器的 keydown 事件**在选字阶段同样会触发**，且 \`e.key === 'Enter'\`。如果不做防护："你好"两个字的候选框里按 Enter → 消息被发出去了。

#### 三级防护（按可靠性递进）

**防护 1：\`e.nativeEvent.isComposing\`（现代浏览器，一行搞定）**

Vercel AI Elements \`packages/elements/src/prompt-input.tsx\` L977-996 原文：

\`\`\`tsx
if (e.key === "Enter") {
  if (isComposing || e.nativeEvent.isComposing) {
    return;
  }
  if (e.shiftKey) {
    return;
  }
  e.preventDefault();

  // Check if the submit button is disabled before submitting
  const { form } = e.currentTarget;
  const submitButton = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
  if (submitButton?.disabled) {
    return;
  }

  form?.requestSubmit();
}
\`\`\`

> 注意 \`form?.requestSubmit()\` —— 而不是直接调 onSubmit 回调。这样能自动触发原生表单校验，并且**按钮 disabled 时天然不会提交**（因为 requestSubmit 会找 submit 按钮）。这是个很聪明的写法。

**防护 2：React 状态位（\`compositionstart/end\`）**

assistant-ui \`ComposerInput.tsx\` L396-420 原文：

\`\`\`tsx
onCompositionStart: composeEventHandlers(
  (rest as { onCompositionStart?: React.CompositionEventHandler }).onCompositionStart,
  () => { compositionRef.current = true; },
),
onCompositionEnd: composeEventHandlers(
  (rest as { onCompositionEnd?: React.CompositionEventHandler }).onCompositionEnd,
  (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    compositionRef.current = false;
    if (!aui.composer.getState().isEditing) return;
    const target = e.target as HTMLTextAreaElement;
    flushTapSync(() => { aui.composer.setText(target.value); });
    ...
  },
),
\`\`\`

而在 onChange 里，它做了一件**额外的事**——防止浏览器丢 \`compositionend\` 导致状态卡死：

\`\`\`tsx
const nativeIsComposing =
  (e.nativeEvent as { isComposing?: boolean }).isComposing === true;
// recover stuck compositionRef when the browser drops compositionend
if (compositionRef.current && !nativeIsComposing) {
  compositionRef.current = false;
}
const isComposing = nativeIsComposing || compositionRef.current;
// keep controlled value in sync mid-IME so react does not reset the textarea to a stale value
flushTapSync(() => { aui.composer.setText(e.target.value); });
if (isComposing) return;    // ← 选字期间不做光标位置广播等副作用
\`\`\`

注释非常值得注意：**受控组件在 IME 选字期间也必须同步 value**，否则 React 会把 textarea 重置成旧值，导致选字框消失。这是纯 \`if (isComposing) return;\` 会踩的坑。

**防护 3：Safari 时间戳兜底（最硬核，Open WebUI 实测）**

Open WebUI \`src/lib/components/chat/MessageInput.svelte\` L701-725 原文：

\`\`\`js
let isComposing = false;
// Safari has a bug where compositionend is not triggered correctly #16615
// when using the virtual keyboard on iOS.
let compositionEndedAt = -2e8;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
function inOrNearComposition(event: Event) {
	if (isComposing) {
		return true;
	}
	// See https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/.
	// On Japanese input method editors (IMEs), the Enter key is used to confirm character
	// selection. On Safari, when Enter is pressed, compositionend and keydown events are
	// emitted. The keydown event triggers newline insertion, which we don't want.
	// This method returns true if the keydown event should be ignored.
	// We only ignore it once, as pressing Enter a second time *should* insert a newline.
	// Furthermore, the keydown event timestamp must be close to the compositionEndedAt timestamp.
	// This guards against the case where compositionend is triggered without the keyboard
	// (e.g. character confirmation may be done with the mouse), and keydown is triggered
	// afterwards- we wouldn't want to ignore the keydown event in this case.
	if (isSafari && Math.abs(event.timeStamp - compositionEndedAt) < 500) {
		compositionEndedAt = -2e8;
		return true;
	}
	return false;
}
\`\`\`

调用处（同一文件 L2105-2166）：

\`\`\`svelte
oncompositionstart={() => (isComposing = true)}
oncompositionend={(e) => {
	compositionEndedAt = e.timeStamp;
	isComposing = false;
}}
on:keydown={async (e) => {
	...
	if (inOrNearComposition(e)) { return; }

	// Uses keyCode '13' for Enter key for chinese/japanese keyboards.
	//
	// Depending on the user's settings, it will send the message
	// either when Enter is pressed or when Ctrl+Enter is pressed.
	const enterPressed =
		($settings?.ctrlEnterToSend ?? false)
			? (e.key === 'Enter' || e.keyCode === 13) && isCtrlPressed
			: (e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey;

	if (enterPressed) {
		e.preventDefault();
		if (prompt !== '' || files.length > 0) {
			dispatch('submit', prompt);
		}
	}
}}
\`\`\`

**为什么 Safari 需要额外防护**：Safari（尤其 iOS 虚拟键盘）在按 Enter 确认候选词时，**先发 \`compositionend\` 再发 \`keydown\`**。此时 \`isComposing\` 已经是 \`false\` 了，防护 1/2 全部失效，于是 keydown 被当作"提交"处理。Open WebUI 用"compositionend 与 keydown 时间戳相差 <500ms 则忽略这一次 keydown"来兜底——而且**只忽略一次**（第二次 Enter 是真的要换行/提交）。

**assistant-ui 等效做法**（\`ComposerInput.tsx\` L202-203、L224-225）：

\`\`\`ts
useEscapeKeydown((e) => {
  ...
  // ignore IME composition events
  if (e.isComposing) return;
  ...
});
// ...
// ignore IME composition events
if (e.nativeEvent.isComposing) return;
\`\`\`

> 注意这是 React 的合成事件——React 会给合成事件也补 \`isComposing\` 字段。

#### 给我们的最终实现（可直接用）

\`\`\`jsx
const compRef = useRef(false);
const compEndAtRef = useRef(-2e8);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const onKeyDown = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;

  // 防护 1 + 2
  if (compRef.current || e.nativeEvent.isComposing) return;
  // 防护 3：Safari 先 compositionend 后 keydown 的 bug
  if (isSafari && Math.abs(e.timeStamp - compEndAtRef.current) < 500) {
    compEndAtRef.current = -2e8;
    return;
  }
  e.preventDefault();
  send();
};

<textarea
  onCompositionStart={() => { compRef.current = true; }}
  onCompositionEnd={(e) => { compEndAtRef.current = e.timeStamp; compRef.current = false; }}
  onChange={(e) => {
    // 防止浏览器丢 compositionend 导致 compRef 卡在 true
    if (compRef.current && !e.nativeEvent.isComposing) compRef.current = false;
    setValue(e.target.value);              // ★ 选字期间也必须同步受控值
  }}
  onKeyDown={onKeyDown}
/>
\`\`\`

### 4.3 Enter 提交模式的三种选项

assistant-ui \`ComposerInput.tsx\` 提供了一个完整的 \`submitMode\` 设计（L88-108）：

\`\`\`ts
/**
 * Controls how the Enter key submits messages.
 * - "enter": Plain Enter submits (Shift+Enter for newline)
 * - "ctrlEnter": Ctrl/Cmd+Enter submits (plain Enter for newline)
 * - "none": Keyboard submission disabled
 * @default "enter"
 */
submitMode?: "enter" | "ctrlEnter" | "none" | undefined;
\`\`\`

还有一个对触屏很讲究的开关（L71-79）：

\`\`\`ts
/**
 * Whether plain Enter on a touch-primary device should insert a newline
 * instead of submitting, detected via
 * \`(pointer: coarse) and (not (any-pointer: fine))\`. Only takes effect
 * when \`submitMode\` resolves to \`"enter"\`.
 * @default false
 */
unstable_insertNewlineOnTouchEnter?: boolean | undefined;
\`\`\`

实现（L180-189）：

\`\`\`ts
const isTouchPrimary = useMediaQuery(
  unstable_insertNewlineOnTouchEnter ? TOUCH_PRIMARY_QUERY : null,
);
const effectiveSubmitMode =
  unstable_insertNewlineOnTouchEnter && isTouchPrimary && declaredSubmitMode === "enter"
    ? "none"
    : declaredSubmitMode;
\`\`\`

**`(pointer: coarse) and (not (any-pointer: fine))`** 这个媒体查询比 `max-width` 精确得多——它表达的是"主要输入方式是触摸，且没有精细指针"，能正确区分触屏笔记本和手机。

> **给银行 App 的建议**：默认 `submitMode="enter"`，但在设置里给一个"Ctrl+Enter 发送"的开关（对应 Open WebUI 的 `ctrlEnterToSend`）。老年用户误触 Enter 的成本很高。

### 4.4 移动端键盘与安全区

assistant-ui `packages/ui/src/components/react/assistant-ui/elements/mobile-composer.tsx`：

```tsx
<div
  data-slot="mobile-composer"
  className={cn(
    "bg-background border-foreground/[0.07] flex w-full max-w-[19rem] flex-col gap-2.5 rounded-t-[20px] border-t px-3 pt-3",
    keyboardOpen ? "pb-3" : "pb-6",     // ★ 键盘弹起时收紧底部 padding
    className,
  )}
>
  {!keyboardOpen && (
    <div className="fade-in animate-in -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 duration-200">
      {actions.map((action) => (<button ... className="... rounded-full px-3 py-1.5 text-xs whitespace-nowrap">{action}</button>))}
    </div>
  )}
  ...
  <input
    ...
    className="text-foreground/85 placeholder:text-foreground/30 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
  />
  ...
  {!keyboardOpen && (
    <span aria-hidden className="bg-foreground/15 mx-auto h-1 w-28 rounded-full" />   {/* iOS Home Indicator 占位 */}
  )}
  {keyboardOpen && (
    <span className={cn(mono, "text-foreground/25 text-center")}>return to send</span>
  )}
</div>
```

**三个可抄的点**：

1. **`text-[16px]`** —— iOS Safari 对 `font-size < 16px` 的输入框会在聚焦时**自动放大整个页面**（而且不会自动缩回）。这是移动端聊天最常见的"廉价感"来源。**我们的 tokens.css 必须保证输入框字号 ≥16px。**
2. **`keyboardOpen` 状态驱动布局** —— 键盘弹起时隐藏快捷操作 chip 行和 Home Indicator 占位条，把空间让给输入框。这个状态由外层 `onFocus` 设置（见 `aui-mobile-composer.tsx` 演示：`onFocus={() => setKeyboardOpen(true)}`）。
3. **`max-w-[19rem]`** —— 移动端预览按手机宽度约束，容器本身是 `rounded-t-[20px]`（只圆上面两个角），贴在屏幕底部。

**建议的 CSS（零依赖）**：

```css
.chat-shell {
  /* dvh 随键盘/地址栏收缩；不要用 100vh */
  height: 100dvh;
  /* 支持 dvh 的老浏览器降级 */
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.composer {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

.composer textarea {
  font-size: max(16px, 1rem);   /* 防 iOS 自动缩放 */
}
```

如果要做**键盘精确避让**（iOS 上 `dvh` 有时仍不跟手），用 `visualViewport`：

```js
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const onResize = () => {
    // 键盘高度 = 布局视口高 - 可视视口高
    const kb = window.innerHeight - vv.height;
    document.documentElement.style.setProperty('--kb-inset', `${Math.max(0, kb)}px`);
  };
  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
  onResize();
  return () => {
    vv.removeEventListener('resize', onResize);
    vv.removeEventListener('scroll', onResize);
  };
}, []);
```

---

## 5. 「极简」输入框的具体做法

### 5.1 单一 focus 点的实现（prompt-kit）

**文件**：`components/prompt-kit/prompt-input.tsx`
**URL**：https://github.com/ibelick/prompt-kit/blob/main/components/prompt-kit/prompt-input.tsx

核心（L85-93）——**点击容器任意位置都聚焦到 textarea**：

```tsx
const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
  if (!disabled) textareaRef.current?.focus();
  onClick?.(e);
};
...
<div
  onClick={handleClick}
  className={cn(
    "border-input bg-background cursor-text rounded-3xl border p-2 shadow-xs",
    disabled && "cursor-not-allowed opacity-60",
    className
  )}
  {...props}
>
```

**同时把 textarea 自身的所有装饰全部清零**：

```tsx
<Textarea
  className={cn(
    "text-primary min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
    className
  )}
  rows={1}
  ...
/>
```

**为什么这实现"极简"**：

| 传统写法（廉价感来源） | 极简写法 |
|---|---|
| textarea 自己有 border + focus ring | textarea 无边框无 outline |
| 容器是死板的 div | 容器 `cursor-text` + `onClick` 聚焦，整条都是热区 |
| 大圆角 `rounded-lg`（8px） | `rounded-3xl`（24px）—— 苹果风的关键是**圆角比直觉更大** |
| 明显阴影 | `shadow-xs`（几乎看不见） |
| 工具栏常驻 | 工具栏只在需要时出现（`PromptInputAction` 带 tooltip，默认收起） |

### 5.2 发送按钮四态状态机（Vercel AI Elements）

**文件**：`packages/elements/src/prompt-input.tsx` L1211-1263

```tsx
export const PromptInputSubmit = ({
  className, variant = "default", size = "icon-sm", status, onStop, onClick, children, ...props
}: PromptInputSubmitProps) => {
  const isGenerating = status === "submitted" || status === "streaming";

  let Icon = <CornerDownLeftIcon className="size-4" />;

  if (status === "submitted") {
    Icon = <Spinner />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (isGenerating && onStop) {
      e.preventDefault();
      onStop();
      return;
    }
    onClick?.(e);
  }, [isGenerating, onStop, onClick]);

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop" : "Submit"}
      className={cn(className)}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}   // ★ 关键：生成中退化成普通按钮，避免表单提交
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </InputGroupButton>
  );
};
```

**四个必须抄的点**：

1. **`status` 是单一真值来源**，不是 `isLoading` + `isStreaming` + `hasError` 三个布尔散落各处。
2. **同一个按钮承载"发送"和"停止"** —— 这是 ChatGPT/Claude 的共同做法，减少视觉元素。
3. **`type` 动态切换** —— 生成中必须变成 `type="button"`，否则点击会触发表单提交，导致重复发送（**幂等性**的第一道防线）。
4. **`aria-label` 随状态变** —— 屏幕阅读器用户能感知到按钮语义变了。

### 5.3 按钮的"墨色"渐变与微动效（assistant-ui surfaces）

**文件**：`packages/ui/src/components/react/assistant-ui/elements/surfaces.tsx`

```ts
export const pressable =
  "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] motion-reduce:transition-none";

export const inkButton =
  "bg-foreground text-background transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.96] motion-reduce:transition-none";

export const iconSwap =
  "[grid-area:1/1] transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

export const iconSwapIn = "scale-100 opacity-100 blur-none";

export const iconSwapOut = "scale-[0.25] opacity-0 blur-[4px]";
```

`ease-[cubic-bezier(0.23,1,0.32,1)]` 是苹果 HIG 里常用的"快出慢入"曲线；`active:scale-[0.96]` 是按压反馈；`iconSwapOut` 的 `blur(4px)` + `scale(0.25)` 让图标切换不是生硬替换而是**溶解**。

发送按钮（同文件 `Composer.tsx` L624-649）：

```tsx
className={cn(
  "grid size-8 place-items-center rounded-full",
  streaming || !idle
    ? inkButton
    : "bg-foreground/[0.06] text-foreground/30 dark:bg-foreground/[0.09] transition-colors",
  className,
)}
...
<ArrowUpIcon className={cn(iconSwap, "size-4", streaming ? iconSwapOut : iconSwapIn)} />
```

**注意 `!idle`（输入框为空）时按钮是"灰底灰字"，有内容时变成"墨色实心"。** 这是一个**不依赖位置变化**的启用态表达——比"按钮从灰变蓝"更克制。

输入容器（`Composer.tsx` L122-134）：

```tsx
className={cn(
  paper,   // = "bg-background border border-border/60 dark:bg-popover"
  "flex w-full flex-col gap-2 rounded-[24px] p-2.5 transition-colors",
  dragActive && "bg-blue-500/[0.04] dark:bg-blue-500/10",
  className,
)}
```

**`border-border/60`（60% 透明度的边框）而不是纯色边框** —— 这是"悬浮玻璃感"的核心：边框几乎看不见，但提供了边界。

### 5.4 渐变描边的零依赖实现（给"柔和浅蓝/淡紫渐变"用）

上面这些项目都用 Tailwind 的固定色。我们要做"渐变背景 + 磨砂玻璃 + 轻微 3D"，零依赖写法：

```css
:root {
  --glass-bg: color-mix(in oklab, white 72%, transparent);
  --glass-border: color-mix(in oklab, white 60%, transparent);
  --brand-a: oklch(0.72 0.12 240);   /* 柔和浅蓝 */
  --brand-b: oklch(0.74 0.10 290);   /* 淡紫 */
}

/* 1. 场景背景：柔和双色渐变（不要用纯色） */
.app-bg {
  background:
    radial-gradient(1200px 600px at 12% -10%, var(--brand-a) 0%, transparent 60%),
    radial-gradient(900px 500px at 88% 8%, var(--brand-b) 0%, transparent 55%),
    linear-gradient(180deg, #f7f9fc 0%, #eef2f8 100%);
}

/* 2. 悬浮磨砂玻璃卡片 */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  /* 轻微 3D：一层近距离高光 + 一层远距离扩散 */
  box-shadow:
    0 1px 0 0 rgba(255,255,255,.9) inset,
    0 1px 2px rgba(16,24,40,.04),
    0 12px 32px -8px rgba(16,24,40,.10);
}

/* 3. 输入框"单焦点"：只有 focus-within 时才出现渐变描边 */
.composer {
  position: relative;
  border-radius: 28px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid var(--glass-border);
  transition: box-shadow .18s cubic-bezier(.23,1,.32,1), border-color .18s;
}
.composer:focus-within {
  border-color: transparent;
  background:
    linear-gradient(var(--glass-bg), var(--glass-bg)) padding-box,
    linear-gradient(135deg, var(--brand-a), var(--brand-b)) border-box;
  border: 1.5px solid transparent;
  box-shadow: 0 0 0 4px color-mix(in oklab, var(--brand-a) 14%, transparent);
}
.composer textarea {
  border: 0; outline: 0; background: transparent; resize: none;
  font-size: max(16px, 1rem);       /* 防 iOS 缩放 */
  max-height: 240px; overflow-y: auto;
  field-sizing: content;            /* 现代浏览器：纯 CSS autosize */
}
```

**注意最后一个 `field-sizing: content`** —— 这是 2026 年已经很普及的 CSS 属性，**textarea 自动增高可以完全不用 JS**。建议用它作为主方案，JS 的 autosize 只作为旧浏览器降级（`@supports not (field-sizing: content)`）。

---

## 6. 消息状态机与流式渲染

### 6.1 AI SDK 的状态枚举（事实标准）

**文件**：`packages/react/src/use-chat.ts`（vercel/ai，已下载 6627 字节）
**URL**：https://github.com/vercel/ai/blob/main/packages/react/src/use-chat.ts

```ts
// L39-45
    | 'regenerate'
    | 'resumeStream'
    | 'status'
...
const status = useSyncExternalStore(...)   // L208
const error  = useSyncExternalStore(..., () => chat.error, () => chat.error)  // L214-217
...
if (resume) {                              // L233-236
  chat.resumeStream();
}
...
return { regenerate: chat.regenerate, error, resumeStream: chat.resumeStream, status, ... };
```

Vercel AI Elements 用的 `ChatStatus` 类型（从 `ai` 包导出）取值：**`"submitted" | "streaming" | "ready" | "error"`**。这是目前业界最简洁的四态模型。

**为什么不用五态（加 `pending`）**：`submitted` 已经涵盖"已发送、等首个 token"，UI 上表现为按钮转圈；再加一个 `pending` 会造成"什么时候该显示转圈"的二义性。

**给我们的映射**：

| AI SDK status | 我们的 UI |
|---|---|
| `submitted` | 用户消息立即上屏（乐观），助手位显示"正在思考"骨架 + 按钮 Spinner |
| `streaming` | 助手消息逐字追加 + 尾部光标 + 按钮变 ■ |
| `ready` | 尾部光标消失，操作条（复制/重试）出现，按钮变 ↑ |
| `error` | 该条消息下方内嵌错误卡（不是全局 toast）+ 按钮变 × |

### 6.2 乐观更新

Lobe Chat 的 `AutoScroll` 注释里有一句关键话：*"Second-to-last message is the user turn when sending (user + assistant pair)"*（`VirtualizedList.tsx` L82-85）。这揭示了标准做法：**发送时立刻把 [用户消息, 空助手消息] 成对插入 store**，助手消息先是个空壳，随后被流式填充。

这样做的三个好处：
1. 用户消息零延迟上屏（不需要等服务端确认）
2. 滚动锚点有确定的落点（助手气泡已经在 DOM 里，高度从 0 长起来）
3. 失败时只要把助手壳标记为 error，不用回滚用户消息

### 6.3 流式渲染与"为什么不用 EventSource"

**这是本节最重要的技术结论。**

`EventSource`（SSE 原生 API）有三个致命限制，决定了它**不能**用于对话 UI：

| 限制 | 后果 |
|---|---|
| **只能 GET** | 用户消息、system prompt、上下文、业务参数（转账金额、账单周期）都要塞进 URL query。URL 长度上限约 2000 字符，账单分析的历史消息一超就崩 |
| **不能自定义 header** | 无法带 `Authorization: Bearer`、`X-Request-Id`（幂等键）、`X-Trace-Id` |
| **不能中止请求体之外的取消语义** | 依赖 `source.close()`，且无法读取 HTTP 状态码（401/403/429 都只报 `onerror`，拿不到"额度用完"这种业务错误） |

**正确做法：`fetch` + `ReadableStream` + `TextDecoder` + 手写 SSE 行解析。**

assistant-ui / Vercel AI Elements / LibreChat / Open WebUI 全部走这条路。零依赖实现（可直接用于我们的 `api.js`）：

```js
export async function streamChat({ body, signal, onDelta, onDone, onError }) {
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-Request-Id': body.requestId,      // ★ 幂等键，EventSource 做不到
      },
      body: JSON.stringify(body),
      signal,                                 // ★ AbortController，停止生成
    });
  } catch (e) {
    if (e.name === 'AbortError') return;      // 用户主动停止，不算错误
    onError(e);
    return;
  }

  if (!res.ok) {
    // ★ EventSource 拿不到这里的状态码
    onError(new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });   // ★ stream:true 处理跨 chunk 的多字节字符

      // SSE 以空行分隔事件
      let idx;
      while ((idx = buf.indexOf('

')) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = 'message';
        const dataLines = [];
        for (const line of raw.split('
')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
          // 以 ':' 开头的是注释（心跳），忽略
        }
        const data = dataLines.join('
');
        if (data === '[DONE]') { onDone?.(); return; }
        try { onDelta(event, JSON.parse(data)); }
        catch { onDelta(event, data); }               // 非 JSON 原样透传
      }
    }
    onDone?.();
  } catch (e) {
    if (e.name === 'AbortError') return;
    onError(e);
  }
}
```

**三个容易踩的坑**：

1. **`decoder.decode(value, { stream: true })`** —— 不加 `stream: true`，UTF-8 的中文字符被切在 chunk 边界时会变成 `�`（乱码方块）。**银行 App 全中文，这个必踩。**
2. **必须自己缓冲 `buf`** —— 一个 SSE 事件可能跨多个 chunk，不能假设 `value` 是完整事件。
3. **`

` 才是事件分隔符**，不是单个 `
`。用 `split('\n')` 解析会漏掉多行 data。

**断线恢复（resumable stream）**：vercel/chatbot 有专门的实现路径 `app/(chat)/api/chat/[id]/stream/route.ts`（仓库树已确认存在），配合客户端 `hooks/use-auto-resume.ts`。核心思路是**服务端把流按 `chatId` 缓存（Redis stream），客户端刷新后用 GET 重新挂载并带上 `Last-Event-ID` 或已收到的消息 id**，服务端从断点续推。

**对我们（Vite SPA + 本地 mock 后端）的简化版**：给每个请求生成 `requestId`，服务端把已生成的完整文本存起来；客户端断线后带 `requestId` 重连，服务端直接返回剩余部分。**幂等键必须由客户端生成**（`crypto.randomUUID()`），因为重试会走同一个 key。

---

## 7. 无障碍（AGENTS.md 明确要求"底线不是加分项"）

### 7.1 流式消息播报：`role="log"`，不是 `aria-live`

**权威依据**：W3C WCAG 2.2 技术 **ARIA23: Using role=log to identify sequential information updates**
https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23.html
关联成功准则：**4.1.3 Status Messages（Level AA）**

原文摘录：

> The ARIA live region role of **log** has an implicit `aria-live` value of **polite** and `aria-atomic` value of **false**, which allows a user to be notified via AT (such as a screen reader) when log messages are added.
>
> Example 1: Updating the contents of a chat conversation — Comments that users type into a chat input field are appended to the end of the chat history region. The region is marked with `role="log"` so that new additions are announced by ATs.

**业界一致做法**（三家独立实现，全部把 `role="log"` 打在**滚动容器**上）：

| 项目 | 文件 | 代码 |
|---|---|---|
| Vercel AI Elements | `packages/elements/src/conversation.tsx` | `<StickToBottom ... role="log" ... />` |
| prompt-kit | `components/prompt-kit/chat-container.tsx` | `<StickToBottom className={cn("flex overflow-y-auto", className)} resize="smooth" initial="instant" role="log" {...props}>` |
| assistant-ui 虚拟列表示例 | `examples/with-virtualized-thread/app/VirtualizedThread.tsx` | README 表格中列出 "Sticky-bottom auto-follow with a user-scroll disarm guard" |

**为什么不用 `aria-live="assertive"`**：`assertive` 会**打断**屏幕阅读器正在读的内容。流式对话每几百毫秒就来一段，用 assertive 会让用户完全无法阅读（上一个永远被下一个打断）。`role="log"` 的 `polite` 是排队播报，`aria-atomic="false"` 保证只播报新增部分而不是整个容器。

**⚠️ 不要给每条消息单独加 `aria-live`** —— 会导致重复播报（容器一次 + 消息一次）。容器一处即可。

**⚠️ 不要给光标/骨架加 `aria-hidden` 遗漏** —— 流式光标（`MessagePartInProgress`）和 shimmer 加载动画必须加 `aria-hidden="true"`，否则屏幕阅读器会读出"竖线、竖线、竖线……"。assistant-ui `surfaces.tsx` 里 `ShimmerLabel` 的写法可参考：

```tsx
export function ShimmerLabel({ active = true, className, ...props }) {
  return <span className={cn(active && "shimmer motion-reduce:animate-none", className)} {...props} />;
}
```

### 7.2 `prefers-reduced-motion` 降级

assistant-ui `surfaces.tsx` 里**每一个动效类都带了 `motion-reduce:transition-none` 或 `motion-reduce:animate-none`**，这是它做得最规范的地方：

```ts
export const pressable = "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] motion-reduce:transition-none";
export const inkButton = "bg-foreground text-background transition-[opacity,scale] duration-150 ... motion-reduce:transition-none";
export const iconSwap  = "[grid-area:1/1] transition-[opacity,scale,filter] duration-200 ... motion-reduce:transition-none";
export const labelSwap = "... transition-[opacity,filter] duration-300 ... motion-reduce:transition-none";
export const collapsePanel = "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ... motion-reduce:transition-none";
```

Message 入场动画同样（`scroll-anchor.tsx` L110）：

```tsx
className={cn(
  "fade-in slide-in-from-bottom-1 animate-in max-w-[85%] text-xs leading-relaxed duration-300 motion-reduce:animate-none",
  ...
)}
```

**我们要写进 `base.css` 的全局兜底**：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
  /* 但"正在生成"的进度提示要保留一个静态替代 */
  .streaming-cursor { animation: none; opacity: .6; }
}
```

⚠️ **注意最后一条**：全删动画会让"正在生成"变成无反馈。必须保留一个**静态**的进行中指示（如常亮的光标块或 "生成中…" 文字），否则违反 WCAG 2.2.2（Pause, Stop, Hide 的对称要求：有反馈可停，但不能无反馈）。

### 7.3 焦点管理

| 场景 | 做法 | 依据 |
|---|---|---|
| 发送后 | **不要**抢焦点到消息区；焦点留在输入框（但清空值） | prompt-kit / assistant-ui 一致 |
| 新会话/切换会话 | 焦点回到输入框 | assistant-ui `unstable_focusOnThreadSwitched` 默认 `true` |
| 流式结束 | **不要**自动聚焦（会打断用户阅读/滚动） | assistant-ui `unstable_focusOnScrollToBottom` 仅在"滚到底部"时触发 |
| 点击输入框容器 | 聚焦 textarea + `cursor-text` | prompt-kit `handleClick` |
| 弹窗（如转账确认） | 打开时焦点进弹窗第一个可聚焦元素，关闭时归还触发元素 | 现有 `TransferDialog.jsx` 需检查 |
| 滚动到底部按钮 | `<button type="button">`，必须有 `aria-label` | assistant-ui `<Button type="button" variant="outline" size="icon" ...>` |

**assistant-ui 有一个很讲究的焦点开关集**（`ComposerInput.tsx` L55-70）：

```ts
/**
 * Whether to automatically focus the input when a new run starts.
 * @default true
 */
unstable_focusOnRunStart?: boolean | undefined;
/**
 * Whether to automatically focus the input when scrolling to bottom.
 * @default true
 */
unstable_focusOnScrollToBottom?: boolean | undefined;
/**
 * Whether to automatically focus the input when switching threads.
 * @default true
 */
unstable_focusOnThreadSwitched?: boolean | undefined;
```

三个开关分别对应三种"自动聚焦"的时机——**默认全开**，但把它们做成可关的，说明实践中真的需要区分。

另外所有图标按钮都要有 `aria-label`，assistant-ui `mobile-composer.tsx` 的示范：

```tsx
<button type="button" aria-label="Add an attachment" ...><PlusIcon className="size-4" /></button>
...
<button type="button" aria-label={running ? "Stop" : "Send"} ...>
```

---

## 8. 长列表性能：虚拟滚动什么时候才真的需要

### 8.1 结论先行：我们这个项目**不需要**虚拟滚动

**阈值证据**：

| 项目 | 是否虚拟滚动 | 规模 | 依据 |
|---|---|---|---|
| assistant-ui 官方示例 | 有（可选） | README 原文：*"Renders a **500-message** thread with `@tanstack/react-virtual`"* | https://github.com/assistant-ui/assistant-ui/blob/main/examples/with-virtualized-thread/README.md |
| Lobe Chat | 有 | 长期使用、单会话可能上千条 | `src/features/Conversation/ChatList/components/VirtualizedList.tsx`（422 行，用 `virtua` 的 `VList`） |
| Vercel AI Elements | **无** | 普通对话 | `conversation.tsx` 直接 `StickToBottom` + `children` |
| prompt-kit | **无** | 普通对话 | `chat-container.tsx` 同上 |
| Open WebUI | 未在 Messages.svelte 见到虚拟化 | 自托管长会话 | 依赖浏览器原生 |

**实际阈值建议**：

- **< 300 条消息**：绝对不要虚拟化。DOM 完全扛得住，虚拟化只会引入"高度测量不准 → 滚动跳动"这个新的 bug 源。
- **300 ~ 1000 条**：也不要虚拟化。用 `content-visibility: auto` + `contain-intrinsic-size` 就能白拿 80% 的收益，**零 JS、零依赖**：

```css
.msg {
  content-visibility: auto;
  contain-intrinsic-size: auto 120px;   /* 预估高度，命中后自动修正 */
}
```

- **> 1000 条 且 滚动明显掉帧**：才考虑虚拟化。而我们已经决定"单会话截断 + 分页加载"，所以永远到不了。

**assistant-ui 虚拟列表示例踩过的坑（我们如果不虚拟化就完全不用管）**：

```tsx
// examples/with-virtualized-thread/app/VirtualizedThread.tsx
const ESTIMATED_TURN_HEIGHT = 200;
const AT_BOTTOM_THRESHOLD = 4;

const virtualizer = useVirtualizer({
  count: turns.length,
  estimateSize: () => ESTIMATED_TURN_HEIGHT,
  getItemKey: (index) => turns[index]!.id,      // ★ 必须用稳定 key，不能用 index
  getScrollElement: () => scrollerRef.current,
  initialRect: { height: 800, width: 800 },
  overscan: 4,
  scrollToFn: (offset, _options, instance) => {
    const el = instance.scrollElement;
    if (!el) return;
    if (stickyRef.current) {
      const maxScroll = el.scrollHeight - el.clientHeight;
      // ★ 已经在底部时，忽略虚拟化库自己发的"滚到某 offset"指令，
      //   否则会把用户从底部拽走
      if (maxScroll - el.scrollTop <= AT_BOTTOM_THRESHOLD && offset < maxScroll) return;
    }
    el.scrollTo(0, offset);
  },
});
```

注意 **`buildTurns`**（把消息按"用户轮次"分组，而非按单条消息虚拟化）：

```tsx
const buildTurns = (messages: readonly MessageRow[]): Turn[] => {
  if (messages.length === 0) return [];
  const turns: Turn[] = [];
  for (const { id, role } of messages) {
    const last = turns.at(-1);
    if (role === "user" || !last) turns.push({ id, messageIds: [id] });
    else last.messageIds.push(id);
  }
  return turns;
};
```

**按"轮次"而不是"单条消息"虚拟化** —— 因为一轮内的高度变化是流式引起的，必须整体重测。

---

## 9. 空状态 / 欢迎页（First-run Experience）

### 9.1 Vercel AI Elements 的空状态 primitive

**文件**：`packages/elements/src/conversation.tsx`

```tsx
export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div className={cn("flex size-full flex-col items-center justify-center gap-3 p-8 text-center", className)} {...props}>
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </>
    )}
  </div>
);
```

**可抄的结构**：`icon + title + description + children（自定义区）`。`children` 优先于默认渲染 —— 这样业务方能塞入"建议提问"卡片而不需要改组件。

### 9.2 建议提问（Suggestion chips）

assistant-ui 有独立的 `ThreadPrimitive.Suggestions` / `SuggestionTrigger`（见 `packages/react/src/primitives/suggestion/`：`SuggestionTitle.tsx`、`SuggestionDescription.tsx`、`SuggestionTrigger.ts`），文档示例路径 `apps/docs/components/pages/docs/samples/thread/welcome-with-suggestions.tsx`。

prompt-kit 有 `components/prompt-kit/prompt-suggestion.tsx`，演示见 `app/docs/prompt-suggestion/prompt-suggestion-variants.tsx`。

**给我们的欢迎页建议**（对应 4 个业务模块）：

> 不用 4 张功能大卡片（那是"功能堆砌的银行后台"）。改成 **1 句问候 + 3~4 个圆角胶囊建议**，例如：
> 「帮我看看这个月账单」「转 500 块给妈妈」「这个订阅还要续吗」「我的卡额度还剩多少」
>
> 理由：胶囊点击后直接填入输入框（用户还能改），比卡片跳转更符合"对话式"心智。

---

## 10. 错误与重试

### 10.1 LibreChat 的连通性错误卡

**文件**：`client/src/components/Chat/Messages/Content/MessageContent.tsx`

```tsx
// L51
'rounded-xl border border-status-error-border bg-status-error-subtle p-3 text-sm text-text-secondary',
// L66-70
{/* `text-text-secondary` overrides the variant's `text-status-error`: this card sits in
    ordinary copy color. The red border and fill still mark it as an error. */}
<div ... variant="error">
  {localize('com_ui_error_connection')}
</div>
```

**两个可抄的细节**：

1. **错误正文用普通文字色，只有边框和底色是红色**。注释明确解释了理由。满屏红字是廉价感的重要来源。
2. **错误是内嵌在消息流里的卡片，不是全局 toast**。因为错误属于"这一轮对话"，脱离上下文就失去了重试的意义。

### 10.2 流式光标与"生成中"标识

LibreChat 同文件 L106、L130：

```tsx
// The word fade itself indicates streaming, so the trailing block cursor
showCursorState && text.length > 0 && 'result-streaming',
```

assistant-ui 有专门的 `packages/react/src/primitives/messagePart/MessagePartInProgress.ts` 组件承载这个语义。

### 10.3 重试 / 幂等

| 关注点 | 做法 | 证据 |
|---|---|---|
| 重试按钮 | assistant-ui `ActionBarReload.ts`（`packages/react/src/primitives/actionBar/ActionBarReload.ts`） | 确认路径存在 |
| 重新生成 | AI SDK `useChat` 暴露 `regenerate` | `packages/react/src/use-chat.ts` L39 |
| 断流恢复 | AI SDK `resumeStream` + `resume` 选项 | 同上 L41、L66-74、L233-236 |
| 幂等键 | 客户端生成 `requestId` 随每次"发送"事件固定（重试复用同一个） | 需我们自建，EventSource 无法带 header |
| 停止生成 | `AbortController` + `fetch signal`；`AbortError` **不算错误**，不显示错误卡 | AI SDK `useChat` `stop()`（L145）；Vercel AI Elements `PromptInputSubmit` 的 `onStop` |

**发送按钮的 `type` 切换本身也是幂等防线**（Vercel AI Elements L1256）：

```tsx
type={isGenerating && onStop ? "button" : "submit"}
```

生成中按钮退化为 `type="button"`，**即使外层是 `<form>`，点击也绝不会触发提交** —— 从 DOM 语义层面杜绝重复发送。

---

## 11. 反模式清单（导致对话 UI 显得廉价或难用）

> 每一条都对应上面某一家的真实代码/注释，不是我凭空总结。

| # | 反模式 | 为什么糟 | 正确做法 | 出处 |
|---|---|---|---|---|
| **A1** | 每次流式 token 都 `el.scrollIntoView()` | `scrollIntoView` 会**强制同步布局**，流式时每 50ms 一次 → 主线程卡顿 + 用户上滑被硬拽回底部 | 只在 `followBottom === true` 时滚，且用 `scrollTo({top: scrollHeight})` 而不是 `scrollIntoView`；按 `requestAnimationFrame` 节流 | assistant-ui `scheduleScrollToBottom` |
| **A2** | 自动滚动判断只看"是否滚到底"，不看"用户意图" | smooth scroll 动画途中的中间帧会被误判为"用户上滑"，导致跟随中断闪烁 | 用 `isInFlightDownwardScroll` 跳过下行中间帧；用"最近 500ms 内有过真实输入意图"判定上滑 | assistant-ui `handleScroll`；Lobe Chat `USER_SCROLL_INTENT_TTL_MS` |
| **A3** | 只订阅消息数量，不订阅"最后一条内容长度" | 流式期间 length 不变 → **完全不滚动**，用户必须手动拖 | 依赖数组里加 `lastMessageContentLength` | Lobe Chat `AutoScroll/index.tsx` L30-37 |
| **A4** | 视口未溢出（内容不足一屏）时也清空"待滚动意图" | 此时 `isAtBottom` 恒为 true，意图被清除后，一旦内容长高就不再跟随 | `if (viewportOverflows(div)) scrollingToBottomBehaviorRef.current = null;` | assistant-ui `useThreadViewportAutoScroll.ts` |
| **A5** | 输入框只判断 `e.key === 'Enter'` | 中文/日文选字按 Enter → 消息被误发 | `e.nativeEvent.isComposing` + `compositionRef` + Safari 时间戳兜底 | 三家一致；Open WebUI L701-725 |
| **A6** | IME 选字期间跳过受控 value 同步 | React 把 textarea 重置成旧值 → **候选框闪一下消失，无法输入中文** | 选字期间**仍然** `setText(e.target.value)`，只跳过"光标位置广播"等副作用 | assistant-ui `ComposerInput.tsx` L371-394 注释原文 |
| **A7** | 移动端输入框 `font-size < 16px` | iOS Safari 聚焦时**自动放大整页**且不缩回，用户永远在横向滚动 | `font-size: max(16px, 1rem)` | assistant-ui `mobile-composer.tsx` `text-[16px]` |
| **A8** | 用 `100vh` 做聊天容器高度 | 移动端地址栏/键盘导致 `100vh` 大于可视区 → 输入框被键盘顶出屏幕 | `100dvh` + `env(safe-area-inset-bottom)`；必要时 `visualViewport` 兜底 | 见 4.4 节 |
| **A9** | 给每条消息加 `aria-live` | 容器播一次 + 消息播一次 = **重复播报**，屏幕阅读器用户直接崩溃 | 只在**滚动容器**上 `role="log"`（隐式 polite + atomic=false） | W3C ARIA23；Vercel AI Elements / prompt-kit `role="log"` |
| **A10** | 流式光标/shimmers 不加 `aria-hidden` | 屏幕阅读器逐帧读"竖线、竖线、竖线" | 装饰性动画元素一律 `aria-hidden="true"` | assistant-ui `ScrollAnchor` 的 `aria-hidden` 用法 |
| **A11** | 动画不写 `prefers-reduced-motion` 降级 | 违反 AGENTS.md 的无障碍底线；前庭失调用户无法使用 | 每个 transition/animation 都配 `motion-reduce:*`；全局兜底 media query | assistant-ui `surfaces.tsx` 全部 6 个 token 都带 |
| **A12** | 生成中的"发送"按钮仍是 `type="submit"` | 外层 form 点击即提交 → **重复发送同一条消息** | `type={isGenerating ? "button" : "submit"}` | Vercel AI Elements `PromptInputSubmit` L1256 |
| **A13** | 工具栏（上传/模型/参数/快捷键）常驻输入框下方 | 这是"功能堆砌的银行后台"的直接来源，ChatGPT/Claude 都不这么做 | 工具栏塞进输入框**内部右侧**，且只在聚焦/悬停时淡入 | prompt-kit `PromptInputActions` 折叠在容器内 |
| **A14** | 消息气泡带"小尾巴"（triangle）、大圆角 + 大阴影 | 2010 年代 IM 风格，与"苹果风"直接冲突 | 用户消息 `rounded-2xl` 纯色块、助手消息**无气泡**直接排文字 | assistant-ui 虚拟列表示例：用户 `bg-muted ml-auto w-fit max-w-[80%] rounded-xl px-4 py-2`；助手 `text-foreground leading-relaxed`（无背景） |
| **A15** | 输入框自己有 border + focus ring，容器只是包装 | 出现"框里的框"，视觉噪点 | textarea 全部清零（`border-none bg-transparent outline-none focus-visible:ring-0`），焦点效果只在容器上用 `:focus-within` | prompt-kit `prompt-input.tsx` |
| **A16** | 用 `EventSource` 做流式 | 只能 GET（长上下文放不进 URL）、不能带 Authorization/幂等键、拿不到 HTTP 状态码 | `fetch` + `ReadableStream` + 手写 SSE 解析 | 第 6.3 节 |
| **A17** | `decoder.decode(value)` 不传 `{stream:true}` | 中文被切在 chunk 边界 → `�` 乱码方块 | `decoder.decode(value, { stream: true })` | 第 6.3 节 |
| **A18** | 错误用全局 toast，或用满屏红字 | 错误脱离消息上下文无法重试；满屏红字廉价 | 消息流内嵌错误卡，正文用普通文字色，只有边框/底色是红 | LibreChat `MessageContent.tsx` L66-70 注释 |
| **A19** | 300 条消息就上虚拟滚动 | 引入高度测量不准 → 滚动跳动，比不虚拟化更糟 | `content-visibility: auto` 优先；阈值 >1000 条且实测掉帧再上 | 第 8 节 |
| **A20** | 虚拟滚动用 `index` 作 key | 删除/插入消息时节点复用错位 | `getItemKey: (index) => turns[index].id` | assistant-ui 虚拟列表示例 |
| **A21** | 弹窗（转账确认）不管理焦点 | 键盘用户 Tab 到背后页面，屏幕阅读器读不到弹窗 | 打开时焦点入弹窗、关闭时归还触发元素（现有 `TransferDialog.jsx` 待检查） | AGENTS.md §3 |
| **A22** | 图标按钮无 `aria-label` | 屏幕阅读器只读"按钮" | 每个 `<button>` 带 `aria-label`，且随状态变化（`running ? "Stop" : "Send"`） | assistant-ui `mobile-composer.tsx` |
| **A23** | 每次发送后把焦点抢到消息区 | 打断用户；键盘用户需要重新 Tab 回输入框 | 焦点留在输入框，只清空值 | prompt-kit / assistant-ui |
| **A24** | 空状态放 4 张功能大卡片 | "功能堆砌"的直接体现，不像对话界面 | 1 句问候 + 3~4 个建议胶囊 | 第 9 节 |

---

## 12. 给「青禾」的具体改造清单（可执行）

> 严格遵守 `AGENTS.md`：**运行时依赖只允许 react / react-dom / lucide-react / vite / @playwright/test**。以下全部零新增依赖。

### 12.1 文件结构（ponytail ultra：3 个文件足够）

| 文件 | 职责 | 为什么不能更少 |
|---|---|---|
| `src/ChatBox.jsx` | 三栏折叠为单栏（顶栏 + 消息流 + 输入条）的编排 | 需要编排层 |
| `src/MessageParts.jsx` | 按 `part.type` 分派：text / transfer-card / bill-chart / subscription-card / card-mgmt | 业务卡各自独立，放一起会超 300 行 |
| `src/useThreadScroll.js` | 滚动锚定 hook（第 3.4 节代码） | 滚动逻辑与渲染无关，且是唯一有真实复杂度的部分 |

### 12.2 必做的 7 件事（按优先级）

1. **消息模型改成 `parts` 数组**（对齐 assistant-ui `MessagePrimitive.Parts`）。现在 `bank.js` 里的业务卡应该是 `{ type: 'transfer-card', payload }` 这样的 part，而不是在 JSX 里 if-else。**这一条决定了后面所有事是否能做干净。**
2. **`status` 单一状态机**：`ready | submitted | streaming | error`，替换现有所有 `isLoading`/`isThinking` 布尔。
3. **滚动锚定**按第 3.4 节实现；阈值 32px；必须监听 `wheel`/`touchmove`/`keydown` 记录意图。
4. **IME 三重防护**按第 4.2 节实现。**这是中文银行 App 的必修项。**
5. **输入框字号 ≥16px + `100dvh` + `env(safe-area-inset-bottom)`**。
6. **`role="log"` 打在滚动容器上**；全局 `prefers-reduced-motion` 兜底；所有图标按钮补 `aria-label`。
7. **`tokens.css` 增加玻璃质感令牌**：`--glass-bg` / `--glass-border` / `--brand-a` / `--brand-b` + 第 5.4 节的渐变描边 CSS。

### 12.3 明确不做的事（避免过度工程）

- ❌ 不引入 `use-stick-to-bottom`（★778 MIT，算法已抄进第 3.4 节）
- ❌ 不引入 `react-textarea-autosize`（用 `field-sizing: content` + 降级）
- ❌ 不引入 `@tanstack/react-virtual` / `virtua`（单会话截断即可）
- ❌ 不引入 `react-markdown` / `shiki`（银行对话不需要代码高亮）
- ❌ 不做分支切换（branch picker）、不做多模型切换、不做消息编辑重发
- ❌ 不做 token 计数、不做 @提及、不做斜杠命令

---

## 13. 证据索引（全部文件路径与 URL）

### assistant-ui/assistant-ui ★12,331 MIT
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/primitives/thread/useThreadViewportAutoScroll.ts ★核心滚动锚定
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/context/stores/ThreadViewport.ts （`turnAnchor: "top" | "bottom"`、`registerContentInset`、`isAtBottom`）
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/primitives/composer/ComposerInput.tsx （IME 三重防护、submitMode、focus 开关）
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/primitives/composer/ComposerSend.ts
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/utils/hooks/useOnScrollToBottom.ts
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/ui/src/components/react/assistant-ui/elements/surfaces.tsx （`motion-reduce` 全覆盖）
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/ui/src/components/react/assistant-ui/elements/scroll-anchor.tsx （新消息计数胶囊 + 顶部渐隐）
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/ui/src/components/react/assistant-ui/elements/mobile-composer.tsx （`text-[16px]`、`keyboardOpen`）
- https://github.com/assistant-ui/assistant-ui/blob/main/packages/ui/src/components/react/assistant-ui/elements/composer.tsx （ComposerBar/Input/Send 样式）
- https://github.com/assistant-ui/assistant-ui/blob/main/examples/with-virtualized-thread/app/VirtualizedThread.tsx
- https://github.com/assistant-ui/assistant-ui/blob/main/examples/with-virtualized-thread/README.md

### vercel/ai-elements ★2,466
- https://github.com/vercel/ai-elements/blob/main/packages/elements/src/prompt-input.tsx ★核心输入框
- https://github.com/vercel/ai-elements/blob/main/packages/elements/src/conversation.tsx ★`role="log"` + EmptyState + ScrollButton

### vercel/ai ★27,001
- https://github.com/vercel/ai/blob/main/packages/react/src/use-chat.ts （`status` / `regenerate` / `resumeStream` / `error`）

### vercel/chatbot ★20,971
- https://github.com/vercel/chatbot/blob/main/hooks/use-scroll-to-bottom.tsx
- https://github.com/vercel/chatbot/blob/main/hooks/use-auto-resume.ts
- https://github.com/vercel/chatbot/blob/main/components/ai-elements/conversation.tsx
- https://github.com/vercel/chatbot/blob/main/components/ai-elements/prompt-input.tsx
- https://github.com/vercel/chatbot/blob/main/app/(chat)/api/chat/%5Bid%5D/stream/route.ts （断流恢复）

### lobehub/lobehub ★82,866
- https://github.com/lobehub/lobehub/blob/main/src/features/Conversation/ChatList/components/AutoScroll/index.tsx ★核心（30 行）
- https://github.com/lobehub/lobehub/blob/main/src/features/Conversation/ChatList/components/AutoScroll/const.ts （`AT_BOTTOM_THRESHOLD = 300`）
- https://github.com/lobehub/lobehub/blob/main/src/features/Conversation/ChatList/components/AutoScroll/useAutoScrollEnabled.ts
- https://github.com/lobehub/lobehub/blob/main/src/features/Conversation/ChatList/components/VirtualizedList.tsx （`USER_SCROLL_INTENT_TTL_MS`、`SCROLL_KEYS`）
- https://github.com/lobehub/lobehub/blob/main/src/features/Conversation/ChatList/components/BackBottom/index.tsx

### open-webui/open-webui ★153,393
- https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/MessageInput.svelte ★Safari IME 兜底（L701-725、L2105-2166）、回到底部（L853-856、L1679-1688）

### LibreChat-AI/LibreChat ★45,009 MIT
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/components/Chat/Messages/Content/MessageContent.tsx （错误卡配色 L51-74、流式光标 L106/L130）

### ibelick/prompt-kit ★3,092 MIT
- https://github.com/ibelick/prompt-kit/blob/main/components/prompt-kit/prompt-input.tsx ★极简输入框
- https://github.com/ibelick/prompt-kit/blob/main/components/prompt-kit/chat-container.tsx （`role="log"`）
- https://github.com/ibelick/prompt-kit/blob/main/components/prompt-kit/scroll-button.tsx

### 其他权威参考
- W3C WCAG 2.2 技术 ARIA23（`role="log"`）https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23.html
- stackblitz-labs/use-stick-to-bottom ★778 MIT https://github.com/stackblitz-labs/use-stick-to-bottom
- IME 事件经典文章（Open WebUI 代码中引用）https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/

---

## 附：本地已下载的原始源码（供复核）

```
bk-agent/doc/research/_tmp/
├── aui-ComposerInput.tsx            14,594 B   assistant-ui 输入框原始码
├── aui-Composer.tsx                 17,916 B   assistant-ui Composer 样式
├── aui-ScrollAnchor.tsx              3,989 B
├── aui-MobileComposer.tsx            4,142 B
├── aui-surfaces.tsx                  4,321 B   动效/材质 token
├── aui-useOnScrollToBottom.ts          516 B
├── ai-elements-prompt-input.tsx     39,048 B   Vercel AI Elements 输入框原始码
├── aisdk-use-chat.ts                 6,627 B
├── lobe-AutoScroll.tsx               1,556 B   ★ 自动滚动核心
├── lobe-AutoScroll-const.ts            204 B
├── lobe-useAutoScrollEnabled.ts        973 B
├── lobe-VirtualizedList.tsx         16,484 B
├── lobe-BackBottom.tsx               1,683 B
├── lobe-ChatList.tsx                14,409 B
├── owui-MessageInput.svelte         90,071 B   Open WebUI 输入框原始码
└── libre-MessageContent.tsx          6,995 B
```

> 复核命令示例：
> ```powershell
> $c = gh api "repos/assistant-ui/assistant-ui/contents/packages/react/src/primitives/thread/useThreadViewportAutoScroll.ts" --jq '.content'
> [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(($c -replace 's','')))
> ```


---

# 附录 A：深度补充（三路并行子调研的实测发现）

> 本节由针对 **Open WebUI** / **LibreChat** / **Vercel AI SDK + chatbot** 的三路并行深挖补充，全部为**实际抓取源码后的摘录**（`gh api repos/{owner}/{repo}/contents/{path}` + base64 解码，未 clone）。
> 行号对应 **2026-09-28** 抓取时刻的 `main` 分支快照。

---

## A.1 Open WebUI 的自动滚动（与 Lobe Chat 完全不同的路子）

**结论：Open WebUI 走的是「单一布尔 + 距底阈值 + 早退」的朴素方案 —— 没有意图判定、没有 ResizeObserver、没有 overflow-anchor。**

### A.1.1 唯一写入点：滚动容器的 `on:scroll`

`src/lib/components/chat/Chat.svelte` L4381-4393（https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Chat.svelte）：

```svelte
<div
    id="messages-container"
    bind:this={messagesContainerElement}
    on:scroll={(e) => {
        autoScroll =
            messagesContainerElement.scrollHeight - messagesContainerElement.scrollTop <=
            messagesContainerElement.clientHeight + 5;
        isNearTop = messagesContainerElement.scrollTop <= 100;
    }}
>
```

状态定义（同文件 L157-160）：

```svelte
let autoScroll = true;
let isNearTop = true;
```

### A.1.2 「用户上滑即停」的机制：**早退写在第一行**

同文件 L2469-2483：

```svelte
const shouldAutoScrollResponse = () =>
    autoScroll && ($settings?.scrollOnResponseGeneration ?? true);

let scrollRAF = null;
const autoScrollToBottom = () => {
    if (!shouldAutoScrollResponse()) return;   // ★ 用户上滑后，连 rAF 都不排

    if (!scrollRAF) {
        scrollRAF = requestAnimationFrame(async () => {
            scrollRAF = null;
            await scrollToBottom();
        });
    }
};
```

**这就是最小可用形态**：一个布尔 + 一个 rAF 闸门 + 一次首行早退。整个「用户上滑不被打断」的需求，靠 `if (!autoScroll) return;` 一行解决。

### A.1.3 恢复跟随的两条路径

1. **滑回底部**：`on:scroll` 里 `distance <= 5` 自动把 `autoScroll` 写回 `true`。
2. **点 ↓ 按钮**（`src/lib/components/chat/MessageInput.svelte` L1679-1705）：

```svelte
{#if autoScroll === false && history?.currentId}
    <div class="absolute -top-12 left-0 right-0 flex justify-center z-30 pointer-events-none">
        <button
            aria-label={$i18n.t('Scroll to bottom')}
            class="bg-white border border-gray-100 dark:border-none dark:bg-white/20 p-1.5 rounded-full pointer-events-auto"
            on:click={() => {
                autoScroll = true;
                scrollToBottom();
            }}
        >
            <svg ...><path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638..." clip-rule="evenodd" /></svg>
        </button>
    </div>
{/if}
```

### A.1.4 Open WebUI 的**代价**（我们必须避免的部分）

| 问题 | 证据 |
|---|---|
| **同一个 `scrollToBottom` 有 3 份实现** | `Chat.svelte` L2432（`scrollTo` + **三重** rAF）；`Messages.svelte` L145（`scrollTop=` + **双重** rAF）；`MessageInput.svelte` L853（`scrollTo({behavior:'smooth'})`） |
| **两套阈值交替写入同一个布尔** | `on:scroll` 用 `+ 5`（L4390）；分支切换用 `+ 50`（`Messages.svelte` L226 / L261 / L300 / L465） |
| **魔法延时** | `setTimeout(..., 100)`（`Messages.svelte` L229 / L264 / L303 / L466）、`setTimeout(() => scrollToBottom(), 0)`（`Chat.svelte` L848） |
| **判定函数混用** | `shouldAutoScrollResponse()` 与裸 `if (autoScroll)` 并存 |
| **`bind:autoScroll` 双向穿透** | `Chat.svelte` L4401 / L4446 / L4538 / L4599 四处；子组件直接改父变量 |
| **跨组件 `document.getElementById`** | `'messages-container'`、`'chat-input-container'`、`'suggestions-container'`、`'.user-message'`、`${message.id}-embeds-container` |

> **抄它的「早退 + rAF 闸门」，但必须把 3 份实现合并成 1 份、2 套阈值统一成 1 个常量、去掉 `bind:` 双向绑定。** 本文第 3.4 节的 `useThreadScroll` 就是合并后的形态。

### A.1.5 Open WebUI 虚拟滚动的真相：**没有用虚拟列表库，用 CSS**

`src/lib/components/chat/Messages/Message.svelte` L52-65 与 L157-165（https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages/Message.svelte）：

```svelte
// WebKit's content-visibility implementation has paint bugs that leave
// on-screen messages blank (#26712), so skip virtualization there
// iOS WebViews and home screen apps carry no Safari token, hence the vendor check
const isWebKit =
    navigator.vendor === 'Apple Computer, Inc.' ||
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
```

```svelte
<div role="listitem" class="... message-listitem" class:message-virtualized={!isWebKit}>
```

```svelte
<style>
    /* Browser-native virtualization: skip rendering of off-screen messages
       without destroying their component trees. Replaces the JS-based
       culling that caused catastrophic mount/destroy thrashing. */
    .message-virtualized {
        content-visibility: auto;
        contain-intrinsic-size: auto 150px;
    }
</style>
```

**这段注释是全篇最有价值的一条性能情报**：

- `content-visibility: auto` + `contain-intrinsic-size: auto 150px` 就是「浏览器原生虚拟滚动」。
- 它**明确点名 JS culling 曾造成 "catastrophic mount/destroy thrashing"**，所以换成了 CSS。
- **代价必须一起承受**：`scrollHeight` 会随离屏元素解算真实高度而逐帧抖动，所以它才需要三重 rAF 补滚（注释原文：*"content-visibility: auto causes the initial scrollHeight to be based on estimated sizes... Re-layouts can cascade across frames, so we re-scroll across two animation frames to land at the true bottom."*）。
- **WebKit 必须关掉**（`isWebKit` 判定 + 注释说明 iOS WebView 不带 Safari token）。
- `package.json` 里装了 `@sveltejs/svelte-virtual-list`，但**消息列表一处没用**（只用在 EmojiPicker）。典型的「装了不用」。

**→ 给我们的结论**：第 8 节的建议得到强力支持 —— **用 `content-visibility`，不要引入虚拟列表库**；但如果用了，就要接受「必须多帧补滚」这个代价。

### A.1.6 历史分页的视口补偿（可直接抄）

`src/lib/components/chat/Messages.svelte` L68-84：

```ts
const loadMoreMessages = async () => {
    const element = getMessagesContainer();
    const previousScrollHeight = element?.scrollHeight ?? 0;

    messagesLoading = true;
    messagesCount += 8;
    buildMessages();
    await tick();

    if (element) {
        element.scrollTop += element.scrollHeight - previousScrollHeight;   // ★ 向上插入后保持视口不动
    }
    messagesLoading = false;
};
```

分页参数：初始 8 条（L59）、每次 +8（L73）、`IntersectionObserver threshold 0.1`（`common/Loader.svelte` L28）。

### A.1.7 Open WebUI 的无障碍（这部分做对了，可以抄）

`Messages.svelte` 模板：

```svelte
<ul role="log" aria-live="polite" aria-relevant="additions" aria-atomic="false">
    {#each messages as message, messageIdx (message.id)}
        <Message ... />
    {/each}
</ul>
```

**注意它显式写了 `aria-live="polite" aria-atomic="false"`** —— 与 `role="log"` 的隐式值一致（见 W3C ARIA23），属于冗余但无害的显式声明。用 `role="log"` 一个属性就够。

---

## A.2 LibreChat 的自动滚动：方向判定 + 非对称迟滞（**全篇最值得抄的一段**）

**文件**：`client/src/hooks/Messages/useMessageScrolling.ts`
**URL**：https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/hooks/Messages/useMessageScrolling.ts

这是全篇调研中滚动锚定做得**最正确**的实现。它和 Open WebUI 是两个极端。

### A.2.1 核心常量（注释本身就是答案）

```ts
const resizeFollowThreshold = 120;

/** How long a glide is given to land before per-frame following resumes. */
const glideTimeout = 700;

/** Arriving counts from further out than leaving does, because while an answer
 *  streams the end is a moving target: it recedes between the reader's last
 *  wheel tick and the frame that measures it, so someone scrolling all the way
 *  down still lands tens of pixels short. Judging arrival as tightly as
 *  departure means they can never quite catch it. */
const attachThreshold = 150;
const detachThreshold = 24;
```

**非对称迟滞**：离开（上滑）24px 就松手，回归（下滑）要真正到达 150px 以内才吸附。原因是**流式时底部是移动靶**——用户滚到底的那一刻，内容又长高了几十像素，用严格阈值永远吸附不上。

### A.2.2 权威状态：明确声明不用 IntersectionObserver

```ts
/** The single authority for whether the thread is riding the stream. Driven only
 *  by what the reader does, never by the observer, whose zero-height sentinel
 *  flickers as content grows and was the source of the attach/detach churn. */
const isStuckRef = useRef(true);

/** Seeded below zero rather than at 0 so the first event after mount is read as
 *  "no previous sample" instead of as a jump down from the top. */
const lastScrollTopRef = useRef(-1);
```

**三条关键洞察**：

1. **不用 IntersectionObserver 决定是否跟随**。注释直说哨兵元素零高度、阈值永远够不到、流式时 `isIntersecting` 抖动 → 「线程自己 attach/detach」。Observer 只用来控制「回到底部」按钮的显隐。
2. **`lastScrollTopRef` 初始化为 -1（而非 0）** —— 会话打开时已经滚到底，第一个 scroll 事件带着巨大的 `scrollTop` 而无基线，会被误判为「向下滚」，从而吞掉用户真正的上滑。用 -1 当「无样本」哨兵。
3. **方向决定，位置不决定**：

```ts
const debouncedHandleScroll = useCallback(() => {
  const scrollEl = scrollableRef.current;
  isNearBottomRef.current = getIsNearBottom();
  if (!scrollEl) return;

  const top = scrollEl.scrollTop;
  const previousTop = lastScrollTopRef.current;
  lastScrollTopRef.current = top;

  if (previousTop < 0) return;              // ★ 第一个事件当基线

  const movingDown = top >= previousTop;
  const distance = distanceFromEnd();

  /** Arriving is judged here rather than on the wheel tick that started it: the
   *  browser animates wheel scrolling, so at tick time the thread is still far
   *  short of where that tick is taking it. */
  if (movingDown) {
    if (distance <= attachThreshold) {      // ★ 下滑：只有真正到达才吸附
      isStuckRef.current = true;
      setAbortScroll(false);
    }
    return;
  }

  if (distance > detachThreshold) {         // ★ 上滑：超过 24px 立即脱离
    isStuckRef.current = false;
    glideInterruptedRef.current = true;
  }
}, [distanceFromEnd, getIsNearBottom, setAbortScroll]);
```

### A.2.3 每帧直写 `scrollTop`（不要节流 `scrollIntoView`）

```ts
/**
 * Ride the bottom of the thread.
 *
 * Written straight to scrollTop rather than routed through the throttled
 * scrollIntoView helper: an answer arrives a few pixels at a time, so
 * correcting on every frame reads as the text simply flowing upward, while
 * correcting every 145ms reads as a thread that lurches.
 */
const followBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
  const scrollEl = scrollableRef.current;
  if (!scrollEl) return;
  const target = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  if (Math.abs(scrollEl.scrollTop - target) < 1) return;

  if (behavior !== 'smooth' || prefersReducedMotion()) {
    scrollEl.scrollTop = target;
    isNearBottomRef.current = true;
    isStuckRef.current = true;
    lastScrollTopRef.current = target;
    return;
  }
  // glide 分支：scrollend + 700ms 兜底定时器，落地后再补一次差
  ...
}, []);
```

注释原文极有价值：**「每帧直写读起来是文字向上流动，145ms 节流读起来是线程在抽搐」**。这是「观感」层面的工程判断。

### A.2.4 wheel 事件的 rAF 陷阱（React 事件委托）

```ts
const onWheel = (event: WheelEvent) => {
  if (event.deltaY < 0) {
    isStuckRef.current = false;
    glideInterruptedRef.current = true;
    return;
  }
  /** Next frame, not now: React binds Message's handler at the root, above
   *  this container, so it runs after this one and would put the flag straight
   *  back. Clearing once the event has finished dispatching is what makes it
   *  stick. */
  window.requestAnimationFrame(() => setAbortScroll(false));
};

scrollEl.addEventListener('wheel', onWheel, { passive: true });
```

**这是一个 React 特有的坑**：React 把事件委托挂在 root 上，层级**高于**容器。同步清除 flag 会被 React 的 handler 立刻重新置位。必须延到 `requestAnimationFrame`。

### A.2.5 `abortScroll` 为什么不能作权威

注释解释了 `reconcileContentResize` 刻意**不** gate 在 `abortScroll` 上：`useMessageProcess` 用 500ms throttle 在**任何** wheel（包括向下）时置位，其 trailing 调用在手势结束后才落地，任何「跟着手势清 flag」的代码都活不过它 → 向下滚动永远无法恢复跟随。最终改成「由用户实际位置 + 方向」回答。

### A.2.6 LibreChat 的流式 Markdown：按顶层块切分 + 逐块 memo

**文件**：`client/src/components/Chat/Messages/Content/MarkdownBlocks.tsx` + `splitMarkdown.ts`
**URL**：https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/components/Chat/Messages/Content/MarkdownBlocks.tsx

```tsx
const MarkdownBlock = memo(function MarkdownBlock({ content, codeBaseIndex, artifactBaseIndex, mermaidBaseIndex, ... }) {
  ...
  return (
    <ArtifactProvider baseIndex={artifactBaseIndex}>
      <CodeBlockProvider baseIndex={codeBaseIndex} mermaidBaseIndex={mermaidBaseIndex}>
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={blockRehypePlugins} components={components}>
          {content}
        </ReactMarkdown>
      </CodeBlockProvider>
    </ArtifactProvider>
  );
}, (prev, next) => prev.content === next.content && ... );
```

策略切换（重要：**不总是分块**）：

```tsx
const [hasChanged, setHasChanged] = useState(streaming);
const changing = streaming || content !== mountedContent;
const blocks = useMemo(
  () => (hasChanged || changing ? toBlockEntries(content, splitMarkdown) : toWholeMessage(content)),
  [content, hasChanged, changing, splitMarkdown],
);
```

```ts
// 只增长时复用上次切分
if (prev != null && content.length > prev.content.length && content.startsWith(prev.content)) {
  const tail = splitBlocks(content.slice(prev.reparseStart));
  ...
}
// 最后两块算「不稳定」
const stableBlockCount = Math.max(0, children.length - 2);
// 不能切的两种情况
if (node.type === 'html' || containsDefinition(node)) { return { children }; }
```

**三条可直接搬的规则**：

1. **挂载时是完成态就整体渲染**（分块要额外一次全量 parse 定位边界，对长会话几乎等于全部成本）；**一旦流式就永久切到分块**（`hasChanged` 只升不降）。
2. **`stableBlockCount = children.length - 2`** —— 最后两块可能因为未闭合的 `***` 或 `#` 被后续文本吞掉，必须从倒数第二块开始重解析。
3. **`html` 块和含引用/脚注定义的节点直接放弃切分**（引用定义是文档作用域的，切开后引用退化成纯文本）。

### A.2.7 代码高亮节流：窗口内降级为纯文本

**文件**：`client/src/components/Chat/Messages/Content/Parts/useLazyHighlight.ts`

```ts
export const HIGHLIGHT_THROTTLE_MS = 300;
...
/**
 * Highlighting runs when the input changes, and once per input: ... While the input keeps
 * changing, as it does for a streaming tool call, highlights are throttled to one per
 * CodeHighlightThrottleContext interval and the caller is handed its raw text in between,
 * so a long code block stays readable without tokenizing every delta.
 */
if (highlighted && highlighted.key === currentKey) { return highlighted.nodes; }
return code ? [code] : null;   // ★ 节流窗口内先给纯文本，不是 null，不是 loading
```

**「降级为纯文本」而不是「显示 loading」** —— 这个决策很关键。抄到我们项目就是：账单图表还在算的时候，先显示数字表，而不是骨架屏。

### A.2.8 LibreChat 的错误处理：错误是**追加的 content part**，不是替换

**文件**：`client/src/hooks/SSE/useEventHandlers.ts` 的 `createErrorMessage`

```ts
const streamedContent = getStreamedContent(latestMessage);
if (latestMessage?.conversationId && latestMessage.messageId && streamedContent.length > 0) {
  /** The row keeps the envelope it streamed under — author, model, icon, creation time — and
   *  takes from the failure only what describes the failure ... */
  const errorMessage: TMessage = {
    ...latestMessage,
    error: undefined,
    text: '',
    content: appendErrorPart(streamedContent, errorText),   // ★ 保留已生成内容
  };
  ...
}
return tMessageSchema.parse({
  ...submission, ...submission.initialResponse,
  text: errorText,
  unfinished: !!text.length,
  error: true,
}) as TMessage;
```

**语义**：失败时用户应该看到「已经生成出来的半截 + 失败原因」，而不是整条消息消失。**这对银行场景尤其重要**（转账确认卡生成到一半失败，用户必须看到已经解析出的部分）。

另外 `unfinished` 用**延迟渲染**避免抖动：

```ts
const UNFINISHED_DELAY = 250;   // MessageContent.tsx
// 连接失败文案的延迟更长
<DelayedRender delay={5500}>
```

**5500ms 才显示「连接失败」** —— 因为网络抖动 2 秒自己就好了，闪红框比不显示更糟。

### A.2.9 LibreChat 的 Enter 决策表（纯函数，可单测）

**文件**：`client/src/utils/shortcuts.ts` 的 `resolveComposerKeyDown`

```ts
export type ComposerKeyAction = ComposerEnterAction | 'block' | 'interrupt' | 'preempt' | 'other';

/**
 * The composer's entire Enter decision table. Every verdict is terminal — no
 * interpretation falls through into another, which is what previously let a
 * chord that one branch declined reach a branch it never should have.
 */
export function resolveComposerKeyDown(e: KeyChordSource, ctx: ComposerKeyContext): ComposerKeyAction {
  if (e.key !== 'Enter') { return 'none'; }
  if (ctx.isSubmitting && !ctx.allowSubmitWhileGenerating) { return 'none'; }
  ...
  const isCtrlEnter = e.ctrlKey || e.metaKey;
  if (!ctx.enterToSend && !isCtrlEnter && !ctx.isComposing) { return 'newline'; }
  if ((!e.shiftKey || isCtrlEnter) && !ctx.isComposing) { return 'submit'; }
  if (!e.shiftKey) { return 'block'; }     // ★ block = preventDefault 但不发送
  return 'none';
}
```

**`'block'` 是一个独立动作**：对应「`enterToSend=false` 且用户按了裸 Enter」—— 要阻止换行又不发送。

**IME 三重判定**（`client/src/hooks/Input/useTextarea.ts`）：

```ts
const isComposing = useRef(false);   // ★ 必须是 ref：state 在同帧 keydown 会读到旧值

// NOTE: isComposing and e.key behave differently in Safari compared to other browsers,
// forcing us to use e.keyCode instead
const isComposingInput = isComposing.current || e.key === 'Process' || e.keyCode === 229;

const action = resolveComposerKeyDown(e.nativeEvent, { isComposing: isComposingInput, ... });
if (action === 'none') { return; }   // ★ 'none' 时放行浏览器默认行为，否则候选框会异常
e.preventDefault();
```

**`e.keyCode === 229` 是 Safari 的兼容口子** —— Safari 在 composition 期间可能既不发 `compositionstart` 也不给 `'Process'`，只有 `keyCode 229` 能识别。这与 Open WebUI 的 `compositionEndedAt` 时间戳兜底是**两种不同的缓解方案，可以叠加使用**。

### A.2.10 LibreChat 的长列表：渐进挂载而非虚拟列表

**文件**：`client/src/hooks/Messages/useProgressiveRowMount.tsx`

```ts
/** Below this path length every row mounts in one commit, exactly as before. */
const MIN_PROGRESSIVE_ROWS = 40;
/** Rows in the first anchored commit — about one viewport plus overscan. */
const INITIAL_ROWS = 16;
/** Rows added per expansion step until the window covers the whole path. */
const CHUNK_ROWS = 32;
```

```ts
/** Document-space offset (viewport top + scrollTop): the widening commit
 *  is transition-deferred, so the user may scroll between capture and
 *  commit. User scrolling moves viewport coordinates but not document
 *  ones, so measuring here isolates the inserted-row shift and never
 *  folds the user's own movement into the correction. */
anchorRef.current = element
  ? { element, documentOffset: element.getBoundingClientRect().top + container.scrollTop }
  : null;
```

```ts
useLayoutEffect(() => {
  const captured = anchorRef.current;
  anchorRef.current = null;
  const container = scrollableRef.current;
  if (!captured || !container || !captured.element.isConnected) return;
  const shift = captured.element.getBoundingClientRect().top + container.scrollTop - captured.documentOffset;
  if (shift !== 0) container.scrollTop += shift;
}, [mountWindow, scrollableRef]);
```

并且显式关掉浏览器原生锚定（`MessagesView.tsx`）：

```tsx
/** The mount hook pins the anchor row itself (document-space
 *  measurement); native scroll anchoring reacting to the same
 *  insertions would double-correct. */
overflowAnchor: mountWindow != null ? 'none' : undefined,
```

**为什么「文档坐标系」这么重要**：捕获和提交之间用户可能滚动，用**视口坐标**测量会把用户自己的位移算进修正量；用 `getBoundingClientRect().top + scrollTop`（文档坐标）就只隔离出「插入行导致的位移」。**这是「向上插入内容保持视口不动」的教科书解法，比 Open WebUI 的 `scrollTop += (new - old)` 更严谨（后者在用户滚动期间会算错）。**

> **给我们的建议**：单会话如果做「加载更早的消息」，抄 LibreChat 的文档坐标补偿 + `overflow-anchor: none`，而不是 Open WebUI 的简化版。

---

## A.3 Vercel AI SDK / chatbot 的补充发现

### A.3.1 ⚠️ 重大发现：`main` 分支的断流恢复已被砍成 stub

`app/(chat)/api/chat/[id]/stream/route.ts` 当前 `main` 全文只有 3 行：

```ts
export function GET() {
  return new Response(null, { status: 204 });
}
```

- 完整实现（113 行）存在于历史提交 **`947ed094a`**（2025-09-21）。
- 在 **`9d5d8a3ea`**（2026-01-15，"fix: title generation + ai sdk upgrade (#1392)"）被删除，**+2 / −112 行**。
- 客户端 `reconnectToStream` 对 204 的处理是返回 `null` → `makeRequest` 收到 null → `setStatus({ status: 'ready' })` → 直接返回，**不 resume**。

**所以今天 `main` 上的「断线恢复」实际是一条死路径。** 要抄的是历史版本，不是当前 main。这也解释了为什么 `use-auto-resume` 仍然存在却不再起作用。

> **教训**：`vercel/ai-chatbot` 作为「参考实现」的可信度要打折 —— 它的 demo 特性是会被临时关掉的。**引用时务必核对文件当前内容，而不是文档或博客里的描述。**

### A.3.2 autosize：CSS `field-sizing: content`，不是 JS（重要修正）

`components/ai-elements/prompt-input.tsx` 的 `PromptInputTextarea` 全文核心：

```tsx
<InputGroupTextarea
  className={cn("field-sizing-content max-h-48 min-h-16", className)}
  name="message"
  onCompositionEnd={handleCompositionEnd}
  onCompositionStart={handleCompositionStart}
  onKeyDown={handleKeyDown}
  onPaste={handlePaste}
  placeholder={placeholder}
  {...props}
  {...controlledProps}
/>;
```

**`className="field-sizing-content max-h-48 min-h-16"` 就是全部的高度控制逻辑。** 没有 `scrollHeight`、没有 `onInput` 里改 `style.height`、没有 `rows={1}` + `resize: none`。

| 方案 | 优点 | 缺点 |
|---|---|---|
| **CSS `field-sizing: content`**（推荐主方案） | 零 JS、无重排抖动、不闪 | Chromium 123+ 才支持；**Firefox / Safari 尚未支持**（降级为固定高度，不坏但不变高） |
| JS `scrollHeight` | 全浏览器支持、能精确控行数 | 每次输入强制同步布局；`height:auto` 瞬间可能引起滚动跳动 |

> 这修正了本文第 5.4 节的说法：`field-sizing: content` 不只是「建议」，而是**业界正在实际使用的主方案**（Vercel AI Elements 就是这么做的）。给我们的落地形态：**`field-sizing: content` 为主 + `CSS.supports()` 检测 + JS 兜底**。

### A.3.3 `useChat` 状态机的完整语义（补强第 6.1 节）

**定义**（`packages/ai/src/ui/chat.ts` 第 133 行）：

```ts
export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';

export interface ChatState<UI_MESSAGE extends UIMessage> {
  status: ChatStatus;
  messages: UI_MESSAGE[];
  error: Error | undefined;
}
```

**源码 JSDoc 原文**（第 296-306 行）—— 这是四态的权威定义：

```ts
/**
 * Hook status:
 *
 * - `submitted`: The message has been sent to the API and we're awaiting the start of the response stream.
 * - `streaming`: The response is actively streaming in from the API, receiving chunks of data.
 * - `ready`: The full response has been received and processed; a new user message can be submitted.
 * - `error`: An error occurred during the API request, preventing successful completion.
 */
get status(): ChatStatus { return this.state.status; }

protected setStatus({ status, error }: { status: ChatStatus; error?: Error }) {
  if (this.status === status) return;   // ← 同状态直接 return，防止无谓重渲染
  this.state.status = status;
  this.state.error = error;
}
```

**三条关键语义**：

1. **`submitted → streaming` 的切换发生在第一个 chunk 真正写出时**（`write({ updateStatus = true })`）。所以 UI 上「转圈」和「正在输出」是两个可以精确区分的阶段 —— 这正是我们需要的「正在思考」vs「正在回答」。
2. **`abort` 不进入 `error`，而是回到 `ready`**：

```ts
if (isAbort) {
  if (isCurrentRequest()) { this.setStatus({ status: 'ready' }); }
  return null;
}
```

用户点「停止」是正常的期望操作，不该在 UI 上留错误态。

3. **`error` 是终态但可恢复**：

```ts
clearError = () => {
  if (this.status === 'error') {
    this.state.error = undefined;
    this.setStatus({ status: 'ready' });
  }
};
```

### A.3.4 乐观更新：**失败不回滚**（这是刻意的设计决策）

`sendMessage` 的顺序（`packages/ai/src/ui/chat.ts` L343-478）：

```ts
if (message.messageId != null) {
  this.state.messages = this.state.messages.slice(0, messageIndex + 1);
  this.state.replaceMessage(messageIndex, { id: message.messageId, ...uiMessage, role: uiMessage.role ?? 'user', metadata: message.metadata });
} else {
  this.state.pushMessage({ ...uiMessage, id: uiMessage.id ?? this.generateId(), role: uiMessage.role ?? 'user', metadata: message.metadata });
}

await this.makeRequest({               // ← 注意：push 之后才发请求
  trigger: 'submit-message',
  messageId: message.messageId,
  ...options,
});
```

**顺序严格是**：① 写入 `state.messages`（乐观插入，id 本地生成）→ ② `setStatus({status:'submitted'})` → ③ `fetch POST`。**UI 在第 ① 步就看到用户消息了，早于任何一个字节离开浏览器。**

**失败时：不回滚。** `makeRequest` 的 catch 块（L926-955）里**没有任何 `this.state.messages = ...` 赋值**：

```ts
} catch (err) {
  if (isAbort || (err as any).name === 'AbortError') {
    isAbort = true;
    if (isCurrentRequest()) { this.setStatus({ status: 'ready' }); }
    return null;
  }
  if (!isCurrentRequest()) { return null; }
  isError = true;
  // Network errors such as disconnected, timeout, etc.
  if (err instanceof TypeError && (err.message.toLowerCase().includes('fetch') || err.message.toLowerCase().includes('network'))) {
    isDisconnect = true;
  }
  if (this.onError && err instanceof Error) { this.onError(err); }
  this.setStatus({ status: 'error', error: err as Error });
}
```

**语义**：用户消息已经本地确认，只是服务端响应失败。SDK 把它交给应用层决定 —— 重试按钮 = 再调 `regenerate()`，或 `clearError()` 后重发。

> **给我们的建议**：**不要自作聪明地「失败后把消息从列表里删掉」** —— 用户会觉得「我刚打的字没了」。正确做法是保留消息 + 内嵌错误卡 + 重试按钮。这与第 10.1 节 LibreChat 的做法一致。

### A.3.5 编辑消息的截断式回滚（三步顺序不能变）

`components/chat/message-editor.tsx`（全文只有 787 字节）：

```ts
export async function submitEditedMessage({ message, text, setMessages, regenerate }) {
  await deleteTrailingMessages({ id: message.id });   // ① 先服务端删尾

  setMessages((messages) => {                          // ② 再本地截断 + 替换文本
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) { return messages; }
    return [
      ...messages.slice(0, index),
      { ...message, parts: [{ text, type: "text" as const }] },
    ];
  });

  regenerate();                                        // ③ 最后重新生成
}
```

**先 `await` 服务端删除**，否则重新生成后历史会重复。这三步顺序直接影响数据正确性。

### A.3.6 `regenerate` 的 slice 三元式（一行表达精确语义）

```ts
// set the messages to the message before the assistant message
this.state.messages = this.state.messages.slice(
  0,
  // if the message is a user message, we need to include it in the request:
  this.messages[messageIndex].role === 'assistant'
    ? messageIndex
    : messageIndex + 1,
);
```

**如果目标是 assistant 消息，就把它自己也切掉；如果目标是 user 消息，就保留它。** 一行决定了「重生成时上一条用户消息还在不在请求体里」。

### A.3.7 `use-scroll-to-bottom.tsx`：另一套滚动实现（含一个真实 bug）

**完整源码骨架**（https://github.com/vercel/chatbot/blob/main/hooks/use-scroll-to-bottom.tsx）：

```tsx
const checkIfAtBottom = useCallback(() => {
  if (!containerRef.current) return true;
  const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
  return scrollTop + clientHeight >= scrollHeight - 100;   // ★ 100px 容差
}, []);

const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
  if (!containerRef.current) return;
  containerRef.current.scrollTo({ behavior, top: containerRef.current.scrollHeight });
}, []);

// effect 1：scroll 监听 —— 「用户在滚」的状态机
const handleScroll = () => {
  isUserScrollingRef.current = true;
  clearTimeout(scrollTimeout);
  const atBottom = checkIfAtBottom();
  setIsAtBottom(atBottom);
  isAtBottomRef.current = atBottom;
  scrollTimeout = setTimeout(() => { isUserScrollingRef.current = false; }, 150);  // ★ 150ms 去抖
};
container.addEventListener("scroll", handleScroll, { passive: true });

// effect 2：MutationObserver + ResizeObserver —— 真正的「自动跟随」引擎
const scrollIfNeeded = () => {
  if (isAtBottomRef.current && !isUserScrollingRef.current) {
    requestAnimationFrame(() => {
      container.scrollTo({ behavior: "instant", top: container.scrollHeight });
      setIsAtBottom(true);
      isAtBottomRef.current = true;
    });
  }
};

const mutationObserver = new MutationObserver(scrollIfNeeded);
mutationObserver.observe(container, { characterData: true, childList: true, subtree: true });

const resizeObserver = new ResizeObserver(scrollIfNeeded);
resizeObserver.observe(container);

for (const child of container.children) { resizeObserver.observe(child); }   // ⚠️ 见下方 bug
```

**为什么需要两个 Observer**：它们覆盖的「高度变化来源」不同 ——

| 变化来源 | 谁捕获 |
|---|---|
| 文本 token 追加（改 textContent） | MutationObserver `characterData: true` |
| 新消息节点插入 | MutationObserver `childList: true` |
| 子树内任意变更 | MutationObserver `subtree: true` |
| **纯 CSS 导致的尺寸变化**（字体加载、`<img>` 解码完成、`<pre>` 重排） | ResizeObserver（**不产生 DOM 变更，MutationObserver 抓不到**） |

**为什么需要 `requestAnimationFrame`**：① 同帧内多个 MutationRecord 只执行最后一次滚动；② DOM 变更后 `scrollHeight` 可能还是旧值，rAF 在下一帧绘制前执行，布局已更新；③ 避免 "ResizeObserver loop completed with undelivered notifications" 警告。

**两个必须注意的细节**：

1. **自动跟随用 `behavior: "instant"`，手动点击用 `"smooth"`**。如果自动跟随也用 smooth，每个 token 都启动一次平滑动画、互相打断，视口永远追不上内容，看起来像抖动/滞后。
2. **用 `top: scrollHeight` 而不是 `endRef.current.scrollIntoView()`**。`scrollHeight` 一定合法（浏览器自动 clamp 到 `scrollHeight - clientHeight`）；而 `scrollIntoView()` 会连带滚动**所有祖先滚动容器**，有嵌套滚动区时会把整页也滚走。

#### ⚠️ 这段代码有一个真实 bug（抄的时候必须修）

```ts
for (const child of container.children) { resizeObserver.observe(child); }
```

这段只在 `useEffect(..., [])` 执行的那一刻遍历**当时存在的 children**。由于依赖是 `[]`，**此后新增的消息节点永远不会被 ResizeObserver 观察**。

**后果场景**：第一条消息里有一张图片，图片在挂载 2 秒后才解码完成导致高度突变 —— MutationObserver 不触发（没有 DOM 变更），ResizeObserver 也没观察这个节点，**自动滚动失效**，视口停在原处而内容已经长高。

**修法**：在 MutationObserver 回调里对新节点补 `observe`，或直接观察一个始终存在的内层 wrapper。

#### 那段 150ms 去抖实际上是**隐式节流**（源码没写出来）

推演：`scrollIfNeeded` 滚动 → 派发 scroll 事件 → `handleScroll` 把 `isUserScrollingRef` 置 `true` 并启动 150ms 计时 → 150ms 内新 chunk 到达时 `scrollIfNeeded` 因 `isUserScrollingRef === true` 而**跳过** → 150ms 后复位 → 下一批再滚。

**即自动跟随实际是「每 150ms 滚一次」的节流**，而不是每帧跟随。对 LLM 流式（10~50 token/s）完全够用，还省掉大量无意义重排。**理解这一点才能理解为什么它不需要额外的 throttle 代码。**

#### 其他死代码（抄的时候删掉）

- `endRef` + `onViewportEnter` + `onViewportLeave`：为 IntersectionObserver 准备的，**当前代码里没有任何 IntersectionObserver**，`messages.tsx` 也没用这三个 API。
- `hooks/use-messages.tsx` **净负价值**：只做透传，还带了一个完全没人用的 `hasSentMessage`（下游 `requiresScrollPadding` 被 `_` 前缀丢弃）。**直接 `useScrollToBottom()` 即可。**
- `components/chat/message.tsx` 里 `requiresScrollPadding: _requiresScrollPadding` —— 声明了但不用。

### A.3.8 一个真实缺陷：`streaming` 期间看不到「停止」按钮

`components/chat/multimodal-input.tsx`：

```tsx
{status === "submitted" ? (
  <StopButton setMessages={setMessages} stop={stop} />
) : (
  <PromptInputSubmit ... status={status} ... >
    <ArrowUpIcon className="size-4" />
  </PromptInputSubmit>
)}
```

**实际行为**：`submitted`（已发出、首 chunk 未到）显示停止按钮；一旦第一个 token 到达切到 `streaming`，按钮就**变回上传箭头**，用户想中止只能等。

正确条件应是 `status === "submitted" || status === "streaming"`。这看起来是一个把三元写反的 bug。

另外底层 `PromptInputSubmit` 设计了 status 驱动图标（Spinner / Square / X / CornerDownLeft）与 `type={isGenerating && onStop ? "button" : "submit"}` 的动态切换，但 chatbot 因为**传了 `children`（`<ArrowUpIcon />`）**，`{children ?? Icon}` 恒渲染箭头，**status 驱动的图标永远不会出现**。

> **抄的时候**：条件用 `submitted || streaming`；**不要传 `children`**，让 status 驱动图标生效。

### A.3.9 `PromptInputSubmit` 的 `type` 切换仍是精髓（第 5.2 节的强化）

```tsx
<InputGroupButton
  aria-label={isGenerating ? "Stop" : "Submit"}
  onClick={handleClick}
  size={size}
  type={isGenerating && onStop ? "button" : "submit"}
  variant={variant}
  {...props}
>
```

**生成中必须变成 `type="button"`，否则点击会触发表单提交导致重复发送。这是从 DOM 语义层面杜绝重复发送，比任何 JS 守卫都可靠。**

### A.3.10 Enter 处理的六层结构（最完整的版本）

```tsx
const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback((e) => {
  // ① 先调外部 onKeyDown，允许外部优先处理（如斜杠命令菜单抢 ArrowUp/Down/Enter/Tab/Escape）
  onKeyDown?.(e);

  // ② 外部已处理就完全让路
  if (e.defaultPrevented) { return; }

  if (e.key === "Enter") {
    // ③ 中文/日文输入法保护（两个都要查）
    if (isComposing || e.nativeEvent.isComposing) { return; }
    // ④ Shift+Enter 走浏览器默认行为（插入换行）
    if (e.shiftKey) { return; }
    // ⑤ 先确认要提交才阻止默认换行
    e.preventDefault();

    // ⑥ 「按钮可点性」作为唯一提交门禁
    const { form } = e.currentTarget;
    const submitButton = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (submitButton?.disabled) { return; }
    form?.requestSubmit();
  }

  // 文本框为空时按 Backspace 删除最后一张附件
  if (e.key === "Backspace" && e.currentTarget.value === "" && attachments.files.length > 0) {
    e.preventDefault();
    const lastAttachment = attachments.files.at(-1);
    if (lastAttachment) { attachments.remove(lastAttachment.id); }
  }
}, [onKeyDown, isComposing, attachments]);
```

**第 ⑥ 层是全篇最值得抄的一个小技巧**：不直接调 `onSubmit`，而是**通过 DOM 找到提交按钮、读它的 `disabled`、再调 `requestSubmit()`**。这样「按钮是否可点」成为**唯一的提交门禁（single source of truth）** —— 业务层只需在按钮上表达 `disabled`，键盘和鼠标两条路径自动一致，**不会出现「按钮灰了但回车还能发」**。

而 `requestSubmit()` 会触发 `submit` 事件（走原生校验 + `onSubmit` 处理器），`form.submit()` 会**绕过**所有这些 —— 必须用 `requestSubmit`。

### A.3.11 提交门禁：用 toast 而不是 disable

```tsx
const handlePromptSubmit = useCallback(() => {
  if (!input.trim() && attachments.length === 0) { return; }
  if (status === "ready" || status === "error") {
    submitForm();
  } else {
    toast.error("Please wait for the model to finish its response!");
  }
}, [attachments.length, handleSlashSelect, input, status, submitForm]);
```

**状态门禁是 `status === "ready" || status === "error"`** —— 即「空闲或出错时才允许发送」。**允许在 error 状态下继续发送**，正好配合「不回滚用户消息」的语义：出错后用户可以直接重发。

反馈方式是 `toast.error` 而非 disable 按钮 —— **按钮被 disable 时用户不知道为什么点不动，toast 能说明原因。**

### A.3.12 `pushState` 而不是路由导航（首条消息）

```tsx
const submitForm = useCallback(() => {
  window.history.pushState({}, "", `/chat/${chatId}`);   // ★ 补 URL 但不触发组件树重建
  sendMessage({ parts: [...], role: "user" });
  setAttachments([]);
  setLocalStorageInput("");
  setInput("");                                          // ★ 乐观清空
  if (width && width > 768) { textareaRef.current?.focus(); }   // ★ 移动端不聚焦，避免弹键盘
}, [...]);
```

**在 Vite SPA 里对应 `history.pushState` 而不是 `navigate()`**，理由完全一样：路由导航会重建组件树，把正在流的消息全丢掉。

第三个细节也值得抄：**移动端发完不重新聚焦**（避免弹出软键盘遮挡内容）。

### A.3.13 服务端不变量：「最后一条是 user」= 上次生成被打断

这是 `use-auto-resume.ts` 判定依据的全部来源（全文关键部分）：

```ts
useEffect(() => {
  if (!autoResume) { return; }
  const mostRecentMessage = initialMessages.at(-1);
  if (mostRecentMessage?.role === "user") { resumeStream(); }
}, [autoResume, initialMessages.at, resumeStream]);
```

**为什么这一行就够**？看服务端的持久化时序（`app/(chat)/api/chat/route.ts`）：

- **用户消息在流开始之前就落库**：

```ts
if (message?.role === "user") {
  await saveMessages({ messages: [{ attachments: [], chatId: id, createdAt: new Date(), id: message.id, parts: message.parts, role: "user" }] });
}
```

- **assistant 消息只在流真正结束时（`onEnd`）才落库**。

**于是得到一条不变量**：

> 数据库里最后一个消息是 `user` ⟺ 上一次生成没有跑完（用户刷新/断网/关标签/服务器超时）。

**它不需要任何额外的「中断标记」字段，直接用消息表的状态表达。** 如果你的后端也持久化消息，直接复用这个判定 —— 非常省事。

另外 `useAutoResume` 的依赖数组 `[autoResume, initialMessages.at, resumeStream]` 用了 `initialMessages.at`（稳定方法引用）来避免数组引用变化导致的无限重跑。**能用但脆弱** —— 更稳的写法是把判定结果算成原始值：

```tsx
const lastRole = initialMessages.at(-1)?.role ?? null;
useEffect(() => {
  if (autoResume && lastRole === "user") resumeStream();
}, [autoResume, lastRole, resumeStream]);
```

### A.3.14 `resumeStream` 的先探测后置状态（避免闪 submitted）

```ts
// For resume-stream, check if there's an active stream before
// changing status. This avoids a brief flash of 'submitted' status
// when there is no stream to resume (e.g. on page load).
let resumeStream: ReadableStream<UIMessageChunk> | undefined;
if (trigger === 'resume-stream') {
  const reconnect = await this.transport.reconnectToStream({ ... });
  if (reconnect == null) {
    this.setStatus({ status: 'ready' });
    clearActiveResumeRequest();
    return;   // no active stream found, so we do not resume
  }
  resumeStream = reconnect;
}

this.setStatus({ status: 'submitted', error: undefined });   // ← resume 成功才切 submitted
```

**注释原文就是动机**：如果先切成 `submitted` 再去探测，那么每次打开一个已完成的历史会话（绝大多数情况！）都会闪一下「提交中」，非常难受。所以顺序被刻意反转成**先探测、后置状态**。

规范依据（`packages/ai/src/ui/chat-transport.ts` 的 JSDoc 原文）—— 这是我们自己实现 transport 时的契约：

> `reconnectToStream` returns:
> - `ReadableStream<UIMessageChunk>`: If an active stream is found and can be resumed
> - `null`: If no active stream exists for the specified chat session (e.g., response already completed)

**自定义 transport 时返回 `null` 而不是抛错，是让「打开历史会话不闪 submitted」这一行为成立的前提。**

### A.3.15 服务端 resumable stream 的 key 机制（三层）

来自 commit `947ed094a` 的完整实现（113 行）。写入侧：

```ts
return createUIMessageStreamResponse({
  async consumeSseStream({ stream: sseStream }) {
    if (!process.env.REDIS_URL) { return; }
    const streamContext = getStreamContext();
    if (streamContext) {
      const streamId = generateId();
      await createStreamId({ chatId: id, streamId });
      await streamContext.createNewResumableStream(streamId, () => sseStream);
    }
  },
  stream,
});
```

读取侧核心：

```ts
const streamIds = await getStreamIdsByChatId({ chatId });
const recentStreamId = streamIds.at(-1);

const stream = await streamContext.resumableStream(recentStreamId, () =>
  emptyDataStream.pipeThrough(new JsonToSseTransformStream())
);
```

**三个层次要分清**：

| 层 | 值 | 作用 |
|---|---|---|
| 业务层 | `chatId`（UUID，来自前端 URL） | 一次对话 |
| 映射层 | `Stream` 表 `(id=streamId, chatId, createdAt)` | 一次对话 → N 次生成 |
| 传输层 | `streamId` | Redis pub/sub 的频道 key，**一次生成一个** |

**为什么用「chatId → streamId 列表 → 取最后一个」而不是「chatId 直接当 key」**：一个 chat 可以有很多次生成（每次发送、每次 regenerate 都是新的 streamId）。直接用 chatId 当 key 会导致 regenerate 时新旧两个流撞 key 互相污染、并发生成无法区分、恢复时无法确定该恢复哪一次。

`resumable-stream` 官方 README 的原理说明（外部依赖，注意我们**不引入**）：

> - The first time a resumable stream is invoked for a given `streamId`, a standard stream is created. This is now the **producer**.
> - The producer will always complete the stream, **even if the reader of the original stream goes away**.
> - When a second resumable stream is invoked for a given `streamId`, it **publishes a message to alert the producer** that it would like to receive the stream.
> - The producer receives the request, and **starts publishing the buffered messages and then publishes additional chunks** of the stream.

**关键**：producer 缓存已产生的 chunk，新 consumer 加入时**先回放 buffer 再转直播** —— 所以恢复是**从头完整重放**，不是「从断点续传」。

**三层兜底**：

| 层 | 条件 | 结果 |
|---|---|---|
| 1. 正常恢复 | Redis 里有活跃 producer | 从头重放 + 继续直播 |
| 2. 消息兜底 | producer 已结束（返回 null），且 DB 最后一条是 assistant 且创建于 **15 秒内** | 发 `data-appendMessage` data part，客户端整条追加 |
| 3. 放弃 | 无 REDIS_URL / 无 streamId / 最后一条是 user / 消息太旧 | 返回空流或 204 |

### A.3.16 ⚠️ 这套恢复架构**抄不动**（对纯 Vite SPA）

它依赖两个 Next.js / serverless 专属能力：

1. `import { after } from "next/server"` + `createResumableStreamContext({ waitUntil: after })` —— 让 producer 在 HTTP 响应结束后仍能继续跑完并把结果推给 Redis 消费者。**这是 serverless 运行时钩子，纯 Vite SPA 的后端（除非也用 Vercel Functions）没有这个语义。**
2. `consumeSseStream` 由 AI SDK 的 `createUIMessageStreamResponse` 注入，需要服务端控制 SSE 的 tee。

**如果你的后端是长连接进程，你根本不需要这一层** —— 进程只要不主动断开，SSE 就一直活着。核心思想可以抄（**缓冲 + 重放 + 以 streamId 为 key**），具体实现不能抄。最小等价版本：

```
服务端：Map<streamId, { chunks: string[], done: boolean, subscribers: Set<Controller> }>
  POST /chat            → 新 streamId，边写边 push 进 chunks
  GET  /chat/:id/stream → 用 streamId 取 buffer，先回放 chunks，再订阅后续
  （客户端断开不清 buffer，只移除 subscriber）
```

这约 60 行，零依赖，且完全覆盖「刷新页面能续上」的需求。

### A.3.17 其他可直接抄的小项

| 项 | 出处 | 说明 |
|---|---|---|
| **`useSyncExternalStore` 三 store 分离** | `packages/react/src/use-chat.ts` | messages / status / error 各自订阅，避免消息流式更新导致 status 订阅者重渲染 |
| **终态渲染前先补 messages 快照** | 同上 `subscribeToStatus` | 解决「最后一个 chunk 写入 messages 与 status 变 ready 同帧发生，React 可能先渲染 ready 但 messages 还是旧的」的竞态 |
| **`latestRef` 转发回调** | 同上 | Chat 实例只创建一次，回调通过 ref 读取最新值，避免闭包过期 |
| **`setMessages((messages) => messages)`** | chatbot `StopButton` | 返回同一引用让 React bail out，但**强制触发一次 store 的 setter 调用**，作为 `stop()` 后的廉价保险 |
| **`DataStream` 分流的 Context Pattern** | `components/chat/data-stream-provider.tsx` | 把 `data-*` 带外事件（等待状态、标题更新、附加消息）从消息数组里分出来走独立 Context，避免 props 层层传递。**银行场景可用于「转账审批状态」这类带外事件** |
| **输入草稿持久化** | `useLocalStorage("input", "")` | 刷新不丢草稿。⚠️ 但它用一个全局 key，跨会话共享草稿是瑕疵；应改成 `chat:{id}:draft` 并防抖写入 |
| **`reconnectToStream` 的 URL 拼接** | `packages/ai/src/ui/http-chat-transport.ts` | 字符串拼接 + 手写 query/fragment 保护（不是 `new URL()`），保证 `?token=xxx` 被保留 |

---

## A.4 补充「该抄什么」清单（三路深挖的高价值项，每条带真实出处）

| # | 该抄什么 | 出处 | 为什么 |
|---|---|---|---|
| **S1** | **非对称迟滞阈值**（离开 24px / 回归 150px） | LibreChat `useMessageScrolling.ts` | 流式时底部是移动靶，对称阈值永远吸附不上 |
| **S2** | **每帧直写 `scrollTop`**，不用节流 `scrollIntoView` | LibreChat 同上（注释：*每帧直写读起来是文字向上流动，145ms 节流读起来是线程在抽搐*） | 观感差异巨大 |
| **S3** | **`abortScroll` 只是旁路，权威是「位置 + 方向」** | LibreChat 同上 | 避免「跟着手势清 flag」被 trailing throttle 反杀 |
| **S4** | **向下滚清 flag 延到 rAF** | LibreChat 同上（React root 事件委托层级问题） | 同步清会被 React handler 立刻置回 |
| **S5** | **错误作为追加的 content part，保留已生成内容** | LibreChat `useEventHandlers.ts` 的 `createErrorMessage` | 用户必须看到「半截 + 失败原因」 |
| **S6** | **延迟渲染错误**（`unfinished` 250ms / 连接失败 5500ms） | LibreChat `MessageContent.tsx` | 网络抖动 2 秒自己就好了，闪红框比不显示更糟 |
| **S7** | **节流窗口内降级为纯文本**（不是 loading、不是 null） | LibreChat `useLazyHighlight.ts` | 长内容保持可读 |
| **S8** | **Enter 决策抽成纯函数决策表** | LibreChat `resolveComposerKeyDown` | 唯一能给 Enter 行为写单测的方式 |
| **S9** | **`isComposing` 必须用 `useRef` 而非 state** | LibreChat `useTextarea.ts` | state 在同一帧的 keydown 里会读到旧值 |
| **S10** | **`e.keyCode === 229` + `e.key === 'Process'` 兜底** | LibreChat 同上（注释点名 Safari） | 与 Open WebUI 的时间戳方案互补 |
| **S11** | **`action === 'none'` 时不 preventDefault** | LibreChat 同上 | 否则输入法候选框异常 |
| **S12** | **移动端切后台 ≠ 用户停止**（`closedByUs` 判定） | LibreChat `useResumableSSE.ts` | 否则 UI 停在半截显示「完成」 |
| **S13** | **重连期间保持「生成中」状态** | LibreChat 同上 | 否则用户以为答完了 |
| **S14** | **空 resume 快照不当权威** | LibreChat `useResumableSSE.ts` | 服务端未聚合时返回空，不能清本地已加载内容 |
| **S15** | **两段式流协议**（先 `startGeneration` 拿 `streamId`，再订阅） | LibreChat `useResumableSSE.ts` | 可恢复的前提 |
| **S16** | **`interactive-widget=resizes-content`** | Open WebUI `src/app.html` L31-34 | 一行 meta 解决键盘遮挡，无需 JS |
| **S17** | **`overscroll-behavior-y: none`** | Open WebUI `src/app.html` L205-209 | 关掉 iOS 橡皮筋，避免滚到底带动整页 |
| **S18** | **`content-visibility: auto` 替代虚拟列表** | Open WebUI `Message.svelte`（注释点名 JS culling 曾造成 catastrophic mount/destroy thrashing） | 便宜一个数量级 |
| **S19** | **向上插入用文档坐标补偿**（比 `scrollTop += Δ` 更严谨） | LibreChat `useProgressiveRowMount.tsx` | 用户滚动期间也不会算错 |
| **S20** | **显式 `overflow-anchor: none`** | LibreChat `MessagesView.tsx` | 避免自己的补偿与浏览器原生锚定**双重修正** |
| **S21** | **滚动显隐按钮自己独占 observer** | LibreChat `ScrollButton.tsx` | 滚动状态翻转只 re-render 按钮，不 re-render 消息树 |
| **S22** | **错误形状容错器**（一个函数吃三种错误格式） | Open WebUI `Error.svelte` | FastAPI / OpenAI / 自定义全覆盖 |
| **S23** | **流式光标就是一个 `w-0.5 h-3.5 animate-pulse` 方块** | Open WebUI `ResponseMessage.svelte` | 不需要组件 |
| **S24** | **CSS `field-sizing: content` 做 autosize** | Vercel AI Elements `prompt-input.tsx` | 零 JS，无重排抖动 |
| **S25** | **`form.requestSubmit()` + 读 `submitButton.disabled` 作唯一门禁** | Vercel AI Elements `prompt-input.tsx` | 键盘与鼠标行为天然一致 |
| **S26** | **`if (e.defaultPrevented) return` 的委托优先协议** | 同上 | 外部（斜杠菜单）优先，避免双重处理 |
| **S27** | **提交失败不回滚用户消息** | `packages/ai/src/ui/chat.ts` catch 块无 messages 赋值 | 用户不会觉得「刚打的字没了」 |
| **S28** | **`abort` 回到 `ready` 而不是 `error`** | 同上 | 用户点「停止」是期望操作，不该留错误态 |
| **S29** | **`pushState` 补 URL 而不触发路由导航** | chatbot `multimodal-input.tsx` | 避免重建组件树丢掉正在流的消息 |
| **S30** | **「最后一条是 user」= 上次生成被打断** | chatbot `use-auto-resume.ts` + 服务端持久化时序 | 免费的中断标记，不需要额外字段 |
| **S31** | **resume 先探测再置 `submitted`** | `packages/ai/src/ui/chat.ts` | 避免打开历史会话闪一下「提交中」 |
| **S32** | **`reconnectToStream` 返回 `null` 而非抛错** | `packages/ai/src/ui/chat-transport.ts` JSDoc | 「无可恢复流」是正常情况不是错误 |
| **S33** | **批量挂载用文档坐标补偿 + `overflow-anchor: none`** | LibreChat `useProgressiveRowMount.tsx` | 渐进挂载优于虚拟列表（不破坏 Ctrl+F、截图、锚点） |
| **S34** | **虚拟列表按「轮次」而非「单条消息」** | assistant-ui `VirtualizedThread.tsx` 的 `buildTurns` | 一轮内的高度变化是流式引起的，必须整体重测 |
| **S35** | **`getItemKey` 用稳定业务 id，绝不用 index** | assistant-ui 同上 | 删除/插入时节点复用错位 |

---

## A.5 补充「该避免什么」清单（三路深挖发现的真实反模式）

| # | 反模式 | 证据（真实文件与规模） |
|---|---|---|
| **B1** | **单个 hook 4780 行 / 193KB** | LibreChat `client/src/hooks/SSE/useResumableSSE.ts` —— 同时管传输、重连、resume 重放、steer 排队、批准暂停、用量归因、标题事件、活跃 job、协议协商、并发订阅身份 |
| **B2** | **单个 `.svelte` 组件 4685 行** | Open WebUI `src/lib/components/chat/Chat.svelte`；`MessageInput.svelte` 2787 行；`ResponseMessage.svelte` 1665 行 |
| **B3** | **同一功能 3 份实现 + 2 套阈值 + 魔法延时** | Open WebUI 的 `scrollToBottom` 三份（`Chat.svelte` L2432 / `Messages.svelte` L145 / `MessageInput.svelte` L853），阈值 `+5` vs `+50`，`setTimeout(…,100)` 四处 |
| **B4** | **巨型 switch 硬编码工具名** | LibreChat `Content/Part.tsx` 589 行，20+ 个 `else if (toolCall.name === '...')`；`ContentParts.tsx` 1251 行。新增工具必须改 switch，无法插件化 |
| **B5** | **类型定义形同虚设** | Open WebUI `src/lib/types/index.ts` **只有 15 行**（仅一个 `Banner`）；消息结构内联在 `ResponseMessage.svelte` 里且**未导出** |
| **B6** | **跨组件 `document.getElementById` 耦合** | Open WebUI：`'messages-container'`、`'chat-input-container'`、`'suggestions-container'`、`'.user-message'`、`${message.id}-embeds-container`。组件边界形同虚设，多实例/嵌入模式必撞车 |
| **B7** | **双向绑定穿透改父状态** | Open WebUI `Chat.svelte` 四处 `bind:autoScroll`；子组件直接写父变量 |
| **B8** | **三份几乎逐字重复的分支导航** | Open WebUI `Messages.svelte` 的 `gotoMessage` / `showPreviousMessage` / `showNextMessage` 三份都在算 siblings + clamp + 重判 autoScroll + `setTimeout(100)` |
| **B9** | **每帧 `structuredClone` 整条消息** | Open WebUI `ResponseMessage.svelte` L129 / L137 / L143 / L146 —— 8000 字回答每次 delta 深拷贝整条消息（含 sources / code_executions）。**这就是它需要一堆节流补丁的根因** |
| **B10** | **`new Function` 执行服务端下发的代码** | Open WebUI `Chat.svelte` L1376-1389：`new Function(\`return (async () => { ${data.code} })()\`)`，注释写 "in a safer way" —— **注释是错的，`new Function` 就是 eval**。任何能控制后端事件流的一方都能在前端执行任意 JS。**绝对不要抄。** |
| **B11** | **`history = history` / `editor = editor` 骗编译器** | LibreChat + Open WebUI 多处 —— 有效但语义是「我在骗编译器」，与 `structuredClone` 混用易漏更新 |
| **B12** | **输入框引入完整富文本编辑器** | Open WebUI `RichTextInput.svelte` **1430 行**，依赖 `@tiptap/*` + `prosemirror-*` + `turndown` + `lowlight` + `marked` + `DOMPurify` + katex 扩展。**同时仓库里还留着一个 95 行的 `Textarea.svelte`** —— 两套输入方案并存，全部只为了「聊天输入框」 |
| **B13** | **错误文案硬编码成常量做 UI 分支** | LibreChat：`'Error connecting to server, try refreshing the page.'` 在客户端定义，并与 `localize('com_ui_error_connection')` 比较来切 UI —— **i18n 一改就断** |
| **B14** | **双状态库并存** | LibreChat：Recoil（`isSubmittingFamily`）+ Jotai（`smoothStreamingAtom` / `siblingIdxFamily` / `pendingApprovalActionFamily`）混用 |
| **B15** | **靠「没有 key」来正确工作** | LibreChat `MultiMessage.tsx` 注释明说加 key 会破坏一切。依赖「该位置恒渲染一行」的隐含前提，任何人出于「最佳实践」加 key 都会静默引入抖动 |
| **B16** | **强制重渲染 hack** | LibreChat `packages/client/src/components/TextareaAutosize.tsx`：`const [, setIsRerendered] = useState(false); useLayoutEffect(() => setIsRerendered(true), []);` —— 丢弃 state 强制多一次渲染拿正确 `dir`，无注释无解释 |
| **B17** | **定义了就没人用** | Open WebUI `tailwind.config.js` 定义了 `pb-safe-bottom`，chat UI 里**一处都没用**；`@sveltejs/svelte-virtual-list` 装了但消息列表一处没用 |
| **B18** | **「随机切片假装流式」** | Open WebUI `streaming/index.ts` 的 `streamLargeDeltasAsRandomChunks` —— 把大 chunk 切成 1-3 字符 + `sleep(5)` 模拟流式。**让到达速度与实际生成速度脱钩，用户以为在生成其实早就好了，且拖长总时长** |
| **B19** | **组件内 `setInterval` 轮询** | Open WebUI `Loader.svelte` `setInterval(dispatch('visible'), 100)` 且注释掉了 `unobserve`；`getChatEventEmitter` 每 1s `emit('usage')` 做计费心跳（网络抖动会丢/重复计）；`Textarea.svelte` `onMount` 里 `setInterval(100)` 轮询等 `bind:this` 赋值 |
| **B20** | **生产代码残留 `console.log`** | LibreChat `useSSE.ts` 裸 `console.log('final', data)`；Open WebUI `streaming/index.ts` L63 每个 SSE 帧都 `console.log(parsedData)`、`Chat.svelte` L1204 `console.log(event)` |
| **B21** | **注释过载 = 抽象层次没找对** | LibreChat `ContentParts.tsx` 有 20+ 行注释论证一个 `key` 的选择。需要 20 行注释才能解释清楚的 key 选择，通常是设计问题而非注释问题 |
| **B22** | **死代码不清理** | Vercel chatbot `use-scroll-to-bottom.tsx` 的 `endRef` / `onViewportEnter` / `onViewportLeave` 全部无人使用；`use-messages.tsx` 的 `hasSentMessage` → `requiresScrollPadding` 整条管线失效（下游 `_requiresScrollPadding` 丢弃） |
| **B23** | **三元写反导致功能缺失** | Vercel chatbot `multimodal-input.tsx`：`status === "submitted" ? <StopButton/> : <PromptInputSubmit/>` —— `streaming` 期间看不到「停止」按钮，用户无法中止 |
| **B24** | **组件设计了能力但外层没用** | Vercel chatbot `PromptInputSubmit` 有 status 驱动的四态图标 + `type` 动态切换，但 `multimodal-input.tsx` 传了 `children`，`{children ?? Icon}` 恒渲染箭头，**status 驱动的图标永远不会出现** |
| **B25** | **`Math.random()` 生成 UUID** | Vercel chatbot `generateUUID()` 手写正则替换 + `Math.random()`。应直接用 `crypto.randomUUID()`（安全随机），只保留 RFC 4122 格式（服务端 `z.uuid()` 会校验） |
| **B26** | **全局单 key 的草稿存储** | Vercel chatbot `useLocalStorage("input", "")` —— 所有会话共用一个草稿，且每次输入都同步写 localStorage。应按 `chat:{id}:draft` 分 key 并防抖 |
| **B27** | **数组无上限增长** | Vercel chatbot `dataStream` 只加不清，而 `useAutoResume` 只看 `dataStream[0]` |
| **B28** | **同一份逻辑两处并行实现** | Vercel chatbot：`PromptInputTextarea` 和 `PureMultimodalInput` 各有一份 paste 逻辑和一份 attachments state（因为 MultimodalInput 没用 `PromptInputProvider`） |
| **B29** | **参考实现可能已失效** | Vercel chatbot `main` 分支的 `app/(chat)/api/chat/[id]/stream/route.ts` 已被砍成 **3 行 stub**（commit `9d5d8a3ea`，+2/−112）。**断线恢复在 main 上是死路径**，完整实现在 `947ed094a` |
| **B30** | **手写 `memo` 比较函数** | Vercel chatbot `MultimodalInput` 的 8 个 if。漏一个字段就是一个「输入框不更新」的诡异 bug。**先不写，等 profiler 指出瓶颈再写** |

---

## A.6 四家自动滚动方案横向对比（选型表）

| 维度 | assistant-ui | Lobe Chat | LibreChat | Open WebUI | Vercel chatbot |
|---|---|---|---|---|---|
| 权威状态 | `followBottomRef` + `scrollingToBottomBehaviorRef` | `atBottom && isGenerating && !isScrolling` | `isStuckRef`（**方向驱动**） | `autoScroll`（位置驱动） | `isAtBottomRef` + `isUserScrollingRef` |
| 是否检测用户意图 | ✅ wheel/keydown/pointer | ✅ `USER_SCROLL_INTENT_TTL_MS=500` | ✅ wheel + 方向 | ❌ 纯几何量 | ✅ 150ms 去抖窗口 |
| 阈值 | `viewportOverflows` + 内部判定 | `AT_BOTTOM_THRESHOLD = 300` | **非对称** `detach 24 / attach 150` | `+5`（分支切换时 `+50`） | `-100`（距底 100px 内算贴底） |
| 阈值严格度 | 严 | 宽 | **最优** | 极严 + 不一致 | 宽 |
| 滚动写入方式 | rAF 调度 + `scrollTo` | `scrollToBottom(false)` | **每帧直写 `scrollTop`** | `scrollTo` + 三重 rAF 补丁 | rAF + `behavior:'instant'` |
| 内容变高驱动 | `ResizeObserver` | 依赖 `lastMessageContentLength` | `ResizeObserver` | 无（靠流式回调主动调） | **`MutationObserver` + `ResizeObserver` 双观察** |
| 实现复杂度 | 高 | **低（~30 行）** | 中高 | 低但重复 3 份 | 中（80 行，含 1 个真 bug） |
| 零依赖可移植 | 需 radix + zustand | **可** | 可 | 可 | 可 |
| 推荐度 | 参考实现 | ★★★★★ 抄结构 | ★★★★★ 抄细节 | ★★☆ 抄「早退 + rAF 闸门」 | ★★★★ 抄「双 Observer」思路 |

> **给「青禾」的最终选型建议**：
>
> **结构抄 Lobe Chat**（三个条件收敛成一个布尔），**细节抄 LibreChat**（非对称迟滞 + 每帧直写 + 方向判定），**早退抄 Open WebUI**（`if (!follow) return` 放第一行），**内容变高检测抄 Vercel**（MutationObserver + ResizeObserver 双观察，比只靠 ResizeObserver 更稳）。
>
> 四者合并后就是本文第 3.4 节的 `useThreadScroll`（约 60~80 行，零依赖）。**不要引入 `use-stick-to-bottom` 等库**（AGENTS.md 依赖白名单）。

---

## A.7 附录证据索引

### LibreChat-AI/LibreChat ★45,009 MIT
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/hooks/Messages/useMessageScrolling.ts ★★ 自动滚动最佳实现
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/hooks/SSE/useResumableSSE.ts （4780 行，重连 / 断流恢复）
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/hooks/SSE/useSSE.ts （sse.js POST-SSE）
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/hooks/SSE/useEventHandlers.ts （`createErrorMessage`）
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/hooks/Input/useTextarea.ts （IME 三重判定）
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/utils/shortcuts.ts （`resolveComposerKeyDown`）
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/components/Chat/Messages/Content/MarkdownBlocks.tsx （分块 memo）
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/components/Chat/Messages/Content/splitMarkdown.ts
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/components/Chat/Messages/Content/Parts/useLazyHighlight.ts
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/hooks/Messages/useProgressiveRowMount.tsx
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/components/Chat/Messages/MultiMessage.tsx
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/components/Chat/Messages/Thread/state.ts
- https://github.com/LibreChat-AI/LibreChat/blob/main/packages/data-provider/src/schemas.ts （`tMessageSchema`）
- https://github.com/LibreChat-AI/LibreChat/blob/main/client/src/utils/textarea.ts （`forceResize`）

### open-webui/open-webui ★153,393（自定义 License，注意品牌条款）
- https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Chat.svelte （L4381-4393 滚动、L2469-2483 早退、L2432 三重 rAF）
- https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages/Message.svelte （`content-visibility`）
- https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages.svelte （`role="log"`、分页补偿）
- https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages/ResponseMessage.svelte （状态字段、流式光标）
- https://github.com/open-webui/open-webui/blob/main/src/lib/components/chat/Messages/Error.svelte （错误容错器）
- https://github.com/open-webui/open-webui/blob/main/src/app.html （viewport meta、overscroll）
- https://github.com/open-webui/open-webui/blob/main/src/lib/components/common/Textarea.svelte （`field-sizing` + 祖先 scrollTop 还原）
- https://github.com/open-webui/open-webui/blob/main/LICENSE

### vercel/chatbot ★20,971（**注意 main 分支的 stream route 已是 stub**）
- https://github.com/vercel/chatbot/blob/main/hooks/use-scroll-to-bottom.tsx ★
- https://github.com/vercel/chatbot/blob/main/hooks/use-auto-resume.ts ★（「最后一条是 user」不变量）
- https://github.com/vercel/chatbot/blob/main/components/ai-elements/prompt-input.tsx ★（field-sizing + Enter 六层 + requestSubmit）
- https://github.com/vercel/chatbot/blob/main/components/chat/multimodal-input.tsx （提交门禁、pushState、StopButton 缺陷）
- https://github.com/vercel/chatbot/blob/main/components/chat/message-editor.tsx （三步截断式回滚）
- https://github.com/vercel/chatbot/blob/main/components/chat/data-stream-provider.tsx
- https://github.com/vercel/chatbot/blob/main/app/(chat)/api/chat/%5Bid%5D/stream/route.ts （**当前是 3 行 stub**）
- https://github.com/vercel/chatbot/blob/947ed094a/app/(chat)/api/chat/%5Bid%5D/stream/route.ts （**完整 113 行实现**）

### vercel/ai ★27,001
- https://github.com/vercel/ai/blob/main/packages/ai/src/ui/chat.ts （`ChatStatus` 定义 L133、四态 JSDoc、`setStatus` 早返回、`regenerate` slice、catch 无回滚）
- https://github.com/vercel/ai/blob/main/packages/react/src/use-chat.ts （`useSyncExternalStore` 三 store、`subscribeToStatus` 补快照、`latestRef`）
- https://github.com/vercel/ai/blob/main/packages/ai/src/ui/chat-transport.ts （`reconnectToStream` 返回 `null` 的契约）
- https://github.com/vercel/ai/blob/main/packages/ai/src/ui/http-chat-transport.ts （URL 拼接）

### 版本基线（vercel/chatbot `package.json` 实测）

```json
{
  "@ai-sdk/react": "4.0.16",
  "ai": "7.0.15",
  "next": "16.2.10",
  "react": "19.2.7",
  "resumable-stream": "^2.2.12",
  "use-stick-to-bottom": "^1.1.6",
  "streamdown": "^2.3.0",
  "redis": "^6.1.0"
}
```

### 复核命令（本节所有源码均可用此复现）

```powershell
$c = gh api "repos/LibreChat-AI/LibreChat/contents/client/src/hooks/Messages/useMessageScrolling.ts" --jq '.content'
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(($c -replace '\s','')))
```

> 注意 `-replace` 的 pattern 是**反斜杠 + s**（匹配所有空白字符），不要写成双反斜杠。
