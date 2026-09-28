# 调研主题 C：Apple Design / Human Interface Guidelines 的网页化落地

> 目标读者：bk-agent /「青禾 · 银行 AI 资金管家」前端重构负责人
> 产出定位：**可直接复制进 :root{} 的设计令牌表**，不是设计随笔。
> 调研日期：2026-09-28 ｜ 全部数值均来自实际抓取的官方文档镜像或开源仓库源码，逐条标注出处。

---

## 0. 方法论与证据来源清单

Apple 官方文档站（developer.apple.com/design/...）是纯 JS 渲染页面，直接 web_fetch 只能拿到 17KB 的空壳。
本次调研走了两条可用通路：

1. **Apple 官方文档 JSON API**：`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`（实测 HTTP 200，返回结构化 primaryContentSections）。用于获取 HIG 正文与原则。
2. **完整 HIG Markdown 镜像**：`github.com/dickwu/apple-design-skill`（840★，无 SPDX license）的 `references/hig/*.md`，共 132 个文件，逐页镜像 HIG 全文（含各页 "Last change on Apple's site" 日期），并已通过 JSON API 抽样交叉验证一致。

原始素材已落盘到 `doc/research/_raw/`（17 个文件），可复查。

### 引用到的仓库（star / license / 最后 push 时间均为 gh api repos/... 实查）

| 仓库 | URL | Star | License | 最后 push | 用途 |
|---|---|---|---|---|---|
| dickwu/apple-design-skill | https://github.com/dickwu/apple-design-skill | 840 | 无 SPDX | 2026-09-22 | **HIG 全文镜像**（主要一手来源） |
| naughtyduk/liquidGL | https://github.com/naughtyduk/liquidGL | 901 | NOASSERTION | 2026-09-27 | WebGPU/WebGL Liquid Glass 实现 |
| ybouane/liquidglass | https://github.com/ybouane/liquidglass | 511 | 无 | 2026-09-06 | WebGL 折射版 Liquid Glass |
| PavelLaptev/css-houdini-squircle | https://github.com/PavelLaptev/css-houdini-squircle | 439 | MIT | 2023-06-24 | Houdini 超椭圆 |
| themesberg/glass-ui | https://github.com/themesberg/glass-ui | 409 | 无 | 2026-02-27 | Glassmorphism CSS 库 |
| conorluddy/LiquidGlassReference | https://github.com/conorluddy/LiquidGlassReference | 340 | 无 | 2026-03-08 | iOS 26 Liquid Glass Swift/SwiftUI 参考 |
| bring-shrubbery/squircle-js | https://github.com/bring-shrubbery/squircle-js | 319 | MIT | 2026-06-15 | 前端 squircle 元素 |
| naplesblue/apple-design-skill | https://github.com/naplesblue/apple-design-skill | 262 | NOASSERTION | 2026-07-20 | **tokens.css + motion.md**（CSS 变量直接可用） |
| wopian/smooth-corners | https://github.com/wopian/smooth-corners | 257 | MIT | 2026-09-26 | Houdini mask-image: paint(smooth-corners) |
| sanalabs/corner-smoothing | https://github.com/sanalabs/corner-smoothing | 146 | MIT | 2023-09-11 | clip-path squircle（Figma 算法） |
| Oliverrr2424/webgl-apple-liquid-glass | https://github.com/Oliverrr2424/webgl-apple-liquid-glass | 137 | MIT | 2026-09-17 | WebGL2 + squircle SDF 折射 |
| nikdelvin/liquid-glass | https://github.com/nikdelvin/liquid-glass | 108 | MIT | 2025-12-24 | 纯 CSS + SVG filter 复刻 iOS 26 |
| KevinGrajeda/tailwindcss-spring | https://github.com/KevinGrajeda/tailwindcss-spring | 92 | MIT | 2025-12-13 | linear() 弹簧插件 |
| aka-kika/hig-mcp | https://github.com/aka-kika/hig-mcp | 35 | MIT | 2026-08-04 | **HIG 结构化令牌 JSON（含 2025-06-09 刷新后色值）** |
| rukkiecodes/claude-apple-design-system | https://github.com/rukkiecodes/claude-apple-design-system | 9 | MIT | 2026-07-11 | apple.com 网页色板语义化 |
| bowen31337/apple-design | https://github.com/bowen31337/apple-design | 5 | 无 | 2026-07-13 | **assets/tokens.css 全量 CSS 令牌 + Liquid Glass CSS+SVG 配方** |

---

## 1. Apple 官方原则：Clarity / Deference / Depth 的现状与网页化翻译

### 1.1 重要事实更正：三大支柱已被 Apple 官方替换

任务描述里的 Clarity / Deference / Depth 是 **iOS 7 ~ iOS 18 时代**的 HIG 框架。
抓取 `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/design-principles.json` 得到的当前正文，已经把设计原则重写为 **8 组、每组带 2–3 条子原则** 的新结构，页面里**不再出现 Clarity / Deference / Depth 这三个词**（这三个词在该 JSON 中检索不到）。

当前官方 8 组原则（原文标题，摘自 `doc/research/_raw/apple-hig-design-principles.md`）：

1. **Create value.** — "The best designs reflect a constant orientation toward what makes a product genuinely useful."（子条：Keep focused / Find new ways to solve the problem）
2. **Stay out of the way.** — "People use your product to get things done. Often the best way to help people do this is to get them directly to the task or content at hand."
3. **Be fully transparent about what your product does and why.**
4. **Use concepts that people know.**
5. **Design for everyone.**
6. **Include just what's necessary.** — 关键原句：**"Simplicity isn't minimalism. Aim for a focused, useful experience that keeps the important things close by and lets the others fall away."**
7. **Quality sets the tone.** — "Every element of your design shows people how much you care. Be deliberate with each decision, and strive for stunning visuals, smooth animations, precise wording, and thoughtful audio."
8. **Identify the emotion you want to inspire.**

> **对 bk-agent 的直接含义**：第 6 条明确否定了「极简 = 少放东西」。用户要的「极简优雅」应该是 **focused**，而不是把资金面板砍成空白。业务卡片该留，但要靠层级而不是靠数量。

### 1.2 三大支柱仍然可用的「翻译表」

虽然官方已改版，Clarity / Deference / Depth 作为**决策检查表**依然有效。结合抓到的 layout.md / materials.md / color.md 正文，翻译成具体 CSS 决策：

| 支柱 | 官方正文里的证据 | 网页 CSS 落地决策 |
|---|---|---|
| **Clarity（清晰）** | Layout 页："**Align elements to make them easier to scan, and use indentation to convey hierarchy.**"；"**Group related items to clearly express related information or functions.** For example, you might use negative space, container shapes, or separator lines" | 用**对齐 + 缩进**代替色块分隔；同组信息共用一个容器 + hairline 分隔线，而不是每张卡换一个背景色 |
| **Deference（退让）** | Design principles："**Stay out of the way.** ... The best designs are unobtrusive and present when people need them."；Layout 页："**Use progressive disclosure to make layouts cleaner and easier to interact with.**" | Chrome 用玻璃、内容不加重描边；次要功能收进 disclosure / overflow，不要一次全铺 |
| **Depth（层次）** | Materials 页："A material is a visual effect that creates a sense of depth, layering, and hierarchy between foreground and background elements."；Layout 页："**Differentiate controls from content.** ... Instead of applying a solid or semi-opaque background color beneath controls, use a scroll edge effect to visually elevate controls above content." | 层次靠**材质（模糊+透明度）**和**滚动边缘渐隐**，不靠 border + 重阴影堆叠 |

**Layout 页的另外两条硬规则（原文）**：
- "**Order content by relative importance.** ... place the most important items near the top and leading side" → 卡片内部的金额/结论要在标题行之上或紧邻。
- "Extend full-screen background content underneath sidebars, toolbars, and tab bars" → 若保留三栏布局，**左侧边栏必须是玻璃浮在内容之上**，而不是一条不透明竖线。

### 1.3 Liquid Glass 引入的「两层模型」（2025 年最重要的结构变化）

摘自 `_raw/apple-hig-liquid-glass.md`（该文由 Materials 2025-09-09、Color 2025-12-16、Layout 2026-09-09、Branding 2026-09-09 四页合成）：

> Apple's model has exactly two layers:
> 1. **Content layer.** Text, images, lists, media, and app backgrounds. When this layer needs depth it uses standard materials, **never Liquid Glass**.
> 2. **Functional layer.** Tab bars, toolbars, sidebars, navigation bars, sheets, popovers, alerts, and other controls that float above the content. **This is the only place Liquid Glass belongs.**

原文规则："**Don't use Liquid Glass in the content layer.** ... The one exception is a control in the content layer with a transient interactive element, such as a slider or toggle, which takes on a glass appearance only while a person is manipulating it."

> ⚠️ **这是 bk-agent 最容易踩的坑**：把每张业务卡片都做成毛玻璃 = 违反 Apple 的核心规则，视觉上也会变成「一堆糊在一起的半透明矩形」。正确做法是 **聊天区/资金面板用不透明白底 + hairline，只有顶栏、输入框、浮层、以及浮在渐变背景上的少数 CTA 用玻璃**。

---

## 2. 字体与排版

### 2.1 光学尺寸（optical size）

Typography 页原文（`_raw/apple-hig-typography.md`，该页 Apple 最后修改 2025-12-16）：

> The system provides the SF and NY fonts in the *variable* font format... Variable fonts support *optical sizing*... On all platforms, the system fonts support *dynamic optical sizes*, which merge discrete optical sizes (like Text and Display) and weights into a single, continuous design, letting the system interpolate each glyph or letterform to produce a structure that's precisely adapted to the point size. **With dynamic optical sizes, you don't need to use discrete optical sizes** unless you're working with a design tool that doesn't support all the features of the variable font format.

> **结论**：SF Pro Text / SF Pro Display 是**旧时代的离散光学尺寸**。现代 SF Pro 是可变字体，**网页上不要再手动切 Text/Display 字体名**，只要一行 `font-optical-sizing: auto`（naplesblue 与 bowen 的 tokens.css 都这么写）。

### 2.2 Tracking（字距）—— 官方完整数值表

Typography 页 `### Tracking values → #### iOS, iPadOS, visionOS tracking values → ##### SF Pro` 表格（原文摘录，1/1000 em）：

| Size (pt) | Tracking (1/1000 em) | Tracking (pt) |
|---|---|---|
| 6 | +41 | +0.24 |
| 8 | +26 | +0.21 |
| 10 | +12 | +0.12 |
| 11 | +6 | +0.06 |
| **12** | **0** | **0.0** |
| 13 | −6 | −0.08 |
| 14 | −11 | −0.15 |
| 15 | −16 | −0.23 |
| 16 | −20 | −0.31 |
| **17** | **−26** | **−0.43** |
| 18 | −25 | −0.44 |
| 20 | −23 | −0.45 |
| 22 | −12 | −0.26 |
| 24 | +3 | +0.07 |
| 26 | +8 | +0.22 |
| 28 | +14 | +0.38 |
| 30 | +14 | +0.40 |
| 34 | +12 | +0.40 |
| 40 | +10 | +0.37 |
| 48 | +8 | +0.35 |
| 60 | +4 | +0.26 |
| 80 | 0 | 0 |

**规律（可以直接写进 CSS 注释）**：12pt 是零点；**12–22pt 为负字距（17pt 最紧，−26/1000em ≈ −0.026em）**；24pt 以上转为正字距并稳定在 +10~+14/1000em（≈ +0.01em）。
注意这跟很多网页教程说的「大标题用负字距」**相反**——那是 apple.com **营销页**的做法（naplesblue 用 H1 −0.03em），不是 iOS App 界面的做法。**App 界面照官方表来**。

### 2.3 Dynamic Type 阶梯（iOS/iPadOS，Large 默认档）—— 官方完整表

| Style | Weight | Size (pt) | Leading (pt) | Emphasized weight |
|---|---|---|---|---|
| Large Title | Regular | 34 | 41 | Bold |
| Title 1 | Regular | 28 | 34 | Bold |
| Title 2 | Regular | 22 | 28 | Bold |
| Title 3 | Regular | 20 | 25 | Semibold |
| Headline | Semibold | 17 | 22 | Semibold |
| Body | Regular | 17 | 22 | Semibold |
| Callout | Regular | 16 | 21 | Semibold |
| Subhead | Regular | 15 | 20 | Semibold |
| Footnote | Regular | 13 | 18 | Semibold |
| Caption 1 | Regular | 12 | 16 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

其它档位（同页）：xSmall / Small / Medium / xLarge / xxLarge / xxxLarge + 5 档 accessibility 尺寸。以 Body 为例：**xSmall 14 → Small 15 → Medium 16 → Large 17 → xLarge 19 → xxLarge 21 → xxxLarge 23**。
macOS 默认 13pt、最小 10pt；iOS 默认 17pt、最小 11pt。**macOS 不支持 Dynamic Type**（原文："macOS doesn't support Dynamic Type."）。

官方明确禁止的字重：*"In general, avoid light font weights... prefer Regular, Medium, Semibold, or Bold... avoid Ultralight, Thin, and Light."*

### 2.4 网页 font stack（实测可用的三条）

**推荐（主用）** —— 来自 naplesblue tokens.css，并补上中文回退：

```css
--font-sans:
  -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
  "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
  "Segoe UI Variable Text", "Segoe UI", Roboto, Inter, system-ui, sans-serif;
--font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
--font-rounded: "SF Pro Rounded", -apple-system, "Nunito", system-ui, sans-serif;
```

- **不要把 Inter 放主位**：`-apple-system` 在 macOS/iOS 上直接命中真正的 SF Pro，Inter 只在非 Apple 平台兜底才排前面。
- `font-optical-sizing: auto` + `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale`（bowen tokens.css 的 body 规则原文）。
- 数字必须 `font-variant-numeric: tabular-nums`（naplesblue design-system.md 的 "Iron rules" 之一）—— 资金类 UI 尤其重要，否则金额跳动。

---

## 3. 色彩

### 3.1 System Colors（2025-06-09 WWDC25 刷新后的新值）

来源：`aka-kika/hig-mcp`（MIT，35★）的 `src/hig_mcp/data/color.json`，其 _meta 原文：

> "Vivid system color values were REFRESHED by Apple on **2025-06-09** (WWDC25 / Liquid Glass). The values below are the current HIG Default-appearance spec table... They remain ADAPTIVE tokens: reference by name in code, never hardcode hex... Hex is reference-only."

| Token | Light (2025 刷新) | Dark (2025 刷新) | 旧值（iOS 13–18，仍被大量项目使用） |
|---|---|---|---|
| systemBlue | #0088FF | #0091FF | #007AFF / #0A84FF |
| systemGreen | #34C759 | #30D158 | 同 |
| systemIndigo | #6155F5 | #6D7CFF | #5856D6 / #5E5CE6 |
| systemOrange | #FF8D28 | #FF9230 | #FF9500 / #FF9F0A |
| systemPink | #FF2D55 | #FF375F | 同 |
| systemPurple | #CB30E0 | #DB34F2 | #AF52DE / #BF5AF2 |
| systemRed | #FF383C | #FF4245 | #FF3B30 / #FF453A |
| systemTeal | #00C3D0 | #00D2E0 | #30B0C7 / #40C8E0 |
| systemYellow | #FFCC00 | #FFD600 | 同 |
| systemGray | #8E8E93 | #8E8E93 | 同 |

灰色梯度（system_gray_ramp）：

| Token | Light | Dark |
|---|---|---|
| systemGray2 | #AEAEB2 | #636366 |
| systemGray3 | #C7C7CC | #48484A |
| systemGray4 | #D1D1D6 | #3A3A3C |
| systemGray5 | #E5E5EA | #2C2C2E |
| systemGray6 | #F2F2F7 | #1C1C1E |

旧值来自 `bowen31337/apple-design` 的 `assets/tokens.css`（同文件还给出 cyan #32ADE6/#64D2FF、mint #00C7BE/#63E6E2、brown #A2845E/#AC8E68）。

> **给 bk-agent 的建议**：品牌主色直接用 **apple.com 网页蓝 #0071e3**（`--accent`），交互态 #0066cc（来自 `_raw/naplesblue-tokens.css` 与 `_raw/rukki-colors.md` 两处独立确认）。系统色 #0088FF 偏艳，更适合做状态色而不是主按钮。

### 3.2 语义色层级（label / separator / background）

`bowen31337/apple-design` 的 `assets/tokens.css` 是本次抓到的最完整语义层实现（原文摘录）：

| 语义 token | Light | Dark |
|---|---|---|
| --label | rgba(0,0,0,1) | rgba(255,255,255,1) |
| --label-secondary | rgba(60,60,67,0.60) | rgba(235,235,245,0.60) |
| --label-tertiary | rgba(60,60,67,0.30) | rgba(235,235,245,0.30) |
| --label-quaternary | rgba(60,60,67,0.18) | rgba(235,235,245,0.16) |
| --separator | rgba(60,60,67,0.29) | rgba(84,84,88,0.60) |
| --separator-opaque | #C6C6C8 | #38383A |
| --fill-1（controls） | rgba(120,120,128,0.20) | rgba(120,120,128,0.36) |
| --fill-2 | rgba(120,120,128,0.16) | rgba(120,120,128,0.32) |
| --fill-3 | rgba(120,120,128,0.12) | rgba(120,120,128,0.24) |
| --fill-4 | rgba(120,120,128,0.08) | rgba(120,120,128,0.18) |
| --bg | #FFFFFF | #000000 |
| --bg-secondary | #F2F2F7 | #1C1C1E |
| --bg-tertiary | #FFFFFF | #2C2C2E |
| --bg-grouped | #F2F2F7 | #000000 |

**Apple 官方对这套语义色的硬约束**（`_raw/apple-hig-color.md` 原文）：

> "**Avoid redefining the semantic meanings of dynamic system colors.** ... don't use the separator color as a text color, or secondary text label color as a background color."

> "**Make sure all your app's colors work well in light, dark, and increased contrast contexts.** ... **Even if your app ships in a single appearance mode, provide both light and dark colors to support Liquid Glass adaptivity in these contexts.**"

**Color 页关于 accent 的规则（原文）**：
> "**To emphasize a primary action, apply color to the background rather than to symbols or text.** For example, the system applies the app accent color to the background in prominent buttons — such as the Done button." / "**Refrain from adding color to the background of multiple controls.**"

→ 聊天界面里，**每屏最多 1–2 个填充色按钮**。快速回复 chip、业务卡片按钮全部走 ghost/描边样式。

### 3.3 apple.com 网页色板（最适合直接抄进 bk-agent 的一套）

来源 `_raw/naplesblue-tokens.css` 与 `_raw/rukki-colors.md`（两个独立仓库互相印证）：

| 用途 | 值 |
|---|---|
| 页面底色（冷灰白，**绝不能偏暖**） | #f5f5f7 |
| 卡片/面板 | #ffffff |
| 行 hover | #fbfbfd |
| 主文字 | #1d1d1f（近黑，**不是纯黑**） |
| 正文 | #424245 |
| 次要/摘要 | #6e6e73 |
| 三级/说明 | #86868b |
| 占位符 | #aeaeb2 |
| 极淡（序号/箭头） | #d2d2d7 |
| 分隔线（hairline） | rgba(0,0,0,0.07) |
| 品牌蓝（链接/主按钮） | #0071e3 |
| 链接文字（浅底上） | #0066cc |
| 强调紫（渐变第二停靠点） | #5e5ce6 |
| 成功/在线 | #30d158 |
| 危险/删除 | #ff3b30 |
| 警示 | #ff9500 |

naplesblue design-system.md 明确列为 **Forbidden** 的：全屏渐变铺底、自创色相、**暖色奶油/米色底**、同屏多个强调色。

> **对用户「柔和浅蓝/淡紫渐变背景」诉求的回应**：Apple 体系里渐变**只允许出现在 hero / CTA / 占位插画**。如果一定要给 ChatBox 做浅蓝紫渐变底，正确姿势是：**渐变只铺在 body 最底层，所有业务卡片仍是纯白不透明**，玻璃只用在顶栏/输入框/浮层上。这样既满足氛围需求，又不违反 §1.3 的两层模型。

---

## 4. 材质与层次

### 4.1 Liquid Glass（iOS 26 / macOS 26，WWDC25 发布）

Materials 页（Apple 最后修改 2025-09-09）原文要点：

- 两个变体：**regular**（"blurs and adjusts the luminosity of background content to maintain legibility"，用于大多数组件、文字多的组件如 alerts/sidebars/popovers）与 **clear**（"highly translucent, which is ideal for prioritizing the visibility of the underlying content"，用于浮在照片/视频之上的控件）。
- **Apple 唯一公布的数字**：clear variant 若底层内容明亮，加 **35% opacity 的暗化层**（原文："If the underlying content is bright, consider adding a dark dimming layer of 35% opacity."）。
- 系统设置里用户可以改 Liquid Glass 的偏好外观，也可以开 Reduce Transparency / Increase Contrast；**所有变体在这些状态下外观都会变**，设计必须仍成立。

**标准材质四档 + Vibrancy**（iOS/iPadOS 原文）：

> "In addition to Liquid Glass, iOS and iPadOS continue to provide four standard materials — **ultra-thin, thin, regular (default), and thick**."

Vibrancy 级别：labels 有 default / secondaryLabel / tertiaryLabel / quaternaryLabel（**quaternary 不要在 thin 和 ultraThin 上用，对比度太低**）；fills 有 default / secondaryFill / tertiaryFill；separator 只有一档。

Liquid Glass 的颜色规则（Color 页原文）：
> "By default, Liquid Glass has **no inherent color**, and instead takes on colors from the content directly behind it."
> "**Apply color sparingly** to the Liquid Glass material, and to symbols or text on the material."

### 4.2 backdrop-filter 等价实现（含参数、性能陷阱、fallback）

**四层光学模型**（来自 `_raw/bowen-liquid-glass.md`，本次抓到唯一把「为什么看着像 Apple」讲清楚的资料）：

> A real Apple material is **four stacked optical effects**, not one backdrop-filter:
> 1. **Translucency** — a tint color you can see through.
> 2. **Backdrop blur + saturation boost** — **The saturation boost is what makes glass feel lit rather than frosted.**
> 3. **Specular highlight** — a bright inset rim on the top edge where light "catches" the material.
> 4. **Depth shadow** — a soft outer drop shadow, plus a hairline rim.

**厚度 → 参数对照表**：

| 角色 | tint 不透明度 | blur | saturate |
|---|---|---|---|
| Ultra-thin（极轻浮层 / hover） | 0.44 | 10–12px | 160% |
| Thin（小 chip、控件） | 0.60 | 12–16px | 170% |
| **Regular（导航/工具条，默认）** | 0.72 | 20px | 180% |
| Thick（sheet / 侧边栏 / 菜单） | 0.84 | 30–40px | 180% |

**可直接用的生产配方**（bowen-liquid-glass.md Recipe 1 原文）：

```css
.glass {
  background: var(--material-regular-tint);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
          backdrop-filter: blur(20px) saturate(180%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),     /* 顶边高光 —— 最高杠杆的一行 */
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.18), /* 内发光 */
    0 0 0 0.5px rgba(0, 0, 0, 0.06),             /* hairline 边缘 */
    var(--shadow-glass);
  border-radius: var(--radius-lg);
}
```

原文对第 3 层的评价：*"**Why the inset top highlight matters:** Apple's materials always render a bright edge where the surface meets light from above. Without it, translucent panels look like flat semi-transparent rectangles. **This one line is the highest-leverage detail in the whole file.**"*

**性能陷阱**：
- `-webkit-backdrop-filter` 前缀**必须同时写**（Safari 长期只认前缀版本）。
- *"backdrop-filter over animating content is expensive. Keep glass regions few and small, which is also Apple's rule."*
- 玻璃元素**只在动画期间**加 `will-change: backdrop-filter`，结束后移除。
- **绝对不要玻璃叠玻璃**（原文："Never stack two translucent surfaces directly on top of each other — the double-blur muddies both. Put an opaque layer between them."）
- 玻璃元素会创建 containing block，其内部 `position: fixed` 子元素会失效。

**Fallback 策略**：

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: var(--bg-surface); }        /* 不支持就退回不透明 */
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: var(--bg-surface); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .glass { background: var(--bg-surface); box-shadow: inset 0 0 0 1px var(--separator-opaque); }
}
```

> `prefers-reduced-transparency` **只有 Chromium 系支持**（Chromium/Electron 全平台可用；Safari/WebKit 不支持）。所以 `-webkit-backdrop-filter` 那条 fallback 不能省。

**滚动边缘效果（scroll edge effect）**——Apple 不用 1px 分割线，用的是一条渐隐带：

```css
.nav-scrim {
  position: sticky; top: 0;
  height: 12px;
  background: linear-gradient(var(--bg-app), transparent);
  -webkit-mask-image: linear-gradient(black, transparent);
          mask-image: linear-gradient(black, transparent);
}
```

**折射（refraction）—— 可选进阶**：iOS 26 的「湿玻璃」感靠 SVG displacement filter 喂给 backdrop-filter。bowen 给的参数是 `feTurbulence baseFrequency="0.008 0.012"` + `feDisplacementMap scale="18"`，并提醒 *"Keep scale restrained (12–20). Above ~25 it stops looking like glass and starts looking like a funhouse mirror."* 且**仅 Chromium 支持 url() 作为 backdrop 输入**。**bk-agent 参赛项目建议不做**——投入产出比低，且会让滚动掉帧。

---

## 5. 圆角与间距

### 5.1 连续圆角（squircle / 超椭圆）

CSS `border-radius` 画的是**正圆角（circular arc）**；Apple 用的是**连续圆角（continuous corner）**，即超椭圆（superellipse）。视觉差异：正圆角在与直边相接处有一条**可见的「折痕」**，连续圆角过渡更平滑。

**网页上三种近似方案（全部实查）：**

**方案 A —— 纯 CSS，把半径调大约 1.2–1.3 倍（最简单，零依赖）**
这是 bowen tokens.css 的注释原文建议：
> "iOS uses 'continuous' curvature (a squircle), not a plain arc. **On the web you approximate it with a slightly larger border-radius**"

即：设计稿上量到 16px 连续圆角 → CSS 写 `border-radius: 20px`。

**方案 B —— Houdini paint() 真正的超椭圆 mask（wopian/smooth-corners，257★，MIT）**
README 用法：
`mask-image: paint(smooth-corners); -webkit-mask-image: paint(smooth-corners);`
并注册 worklet：`CSS.paintWorklet.addModule('https://unpkg.com/smooth-corners')`

README 里的形状参数表（**最实用的一张表**）：
> - `= 2` — Circle
> - `> 2` — Rounded rectangles
> - `2.6` — KakaoTalk profile icon
> - **`4.0` — Squircle**
> - **`5.0` — iOS app icon**

已知限制（README 原文）：Chromium 出于隐私考虑，**禁止对带 `href` 的 `<a>` 及其子元素使用 CSS Paint API**，需要把 `mask-image: paint(smooth-corners)` 加在父元素上。**Safari/Firefox 不支持 Houdini paint**，所以这只是渐进增强。

**方案 C —— clip-path + Figma 算法（sanalabs/corner-smoothing，146★，MIT）**
README 原文："The corner smoothing is the same as the **Figma corner smoothing** through the use of figma-squircle... The implementation uses clip-path, so user interactions such as hover follows the smooth corners."
API：`<Squircle cornerRadius={20} borderWidth={1} />`（React）或 `squircleObserver(element, options)`（vanilla，零依赖）。代价：clip-path 会裁掉外阴影。

> **给 bk-agent 的结论**：**用方案 A**。卡片 `border-radius: 18–22px`，按钮/输入框 12–16px，chip `999px`。参赛 demo 上多引一个 worklet 只增加风险，视觉收益肉眼几乎不可辨。

### 5.2 间距网格

**没有官方「8pt 网格」文档**——HIG 的 Layout 页通篇讲的是 alignment / grouping / progressive disclosure / size classes / safe areas，**没有给出间距数值表**。8pt/4pt 是社区约定。

但抓到的两个仓库都收敛到同一套（bowen tokens.css 与 naplesblue tokens.css）：

bowen 的 4/8pt 网格：
```css
--space-1: 0.125rem; /* 2  */   --space-2: 0.25rem;  /* 4  */
--space-3: 0.5rem;   /* 8  */   --space-4: 0.75rem;  /* 12 */
--space-5: 1rem;     /* 16 */   --space-6: 1.25rem;  /* 20 */
--space-7: 1.5rem;   /* 24 */   --space-8: 2rem;     /* 32 */
--space-9: 2.5rem;   /* 40 */   --space-10: 3rem;    /* 48 */
--space-12: 4rem;    /* 64 */
```

naplesblue 的布局常量：阅读列 `max-width: 720px`；网格/密集列 1080px；容器左右 padding 22px；section 间距 `clamp(34px, 6vw, 56px)`；**"Always flex/grid + gap (never inline + margin)"**。

**触控目标**：`_raw/apple-hig-liquid-glass.md` 的 review checklist 第 7 条 —— *"Glass never shrinks hit regions below the platform minimum: **44 by 44 pt default and 28 by 28 pt minimum on mobile, 28 by 28 pt default and 20 by 20 pt minimum on desktop**"*。naplesblue 的做法：*"an iOS-style toggle is ~26px tall but its clickable box should reach 44px; pad the control or make the whole row the target."*

---

## 6. 动效

### 6.1 Apple 的两个弹簧参数

HIG 的 motion 页本身**不给弹簧数值**（原文只有原则："Add motion purposefully" / "Aim for brevity and precision in feedback animations" / "Let people cancel motion"）。数值来自 **WWDC 2018《Designing Fluid Interfaces》** 与 SwiftUI 的 `Animation.spring(response:dampingFraction:blendDuration:)` API。

Apple 文档对该 API 参数的定义（实抓 `https://developer.apple.com/tutorials/data/documentation/swiftui/animation/spring(response:dampingfraction:blendduration:).json`）：
- response：*"The stiffness of the spring, defined as an **approximate duration in seconds**."*
- dampingFraction：*"The amount of drag applied to the value being animated, **as a fraction of an estimate of amount needed to produce critical damping**."*

**Apple 实际出货的 damping/response 配对**（`_raw/bowen-motion-physics.md`，声称来自 WWDC 2018；同一组数字在 `_raw/naplesblue-motion.md` 独立出现，互相印证）：

| 交互 | Damping | Response |
|---|---|---|
| Move / reposition（如 PiP 窗口） | 1.0 | 0.4 |
| Rotation | 0.8 | 0.4 |
| **Drawer / sheet** | **0.8** | **0.3** |
| 默认 UI（菜单、对话框出现） | 1.0（临界阻尼，无过冲） | 0.3–0.4 |

**最重要的行为规则（原文）**：
> "**House rule: overshoot only when the gesture carried momentum** (a flick, a throw). Bounce on a menu that merely faded in feels wrong."

### 6.2 CSS 曲线（可直接用）

**cubic-bezier（临界阻尼弹簧的强 ease-out 近似）**——naplesblue 与 bowen 两处一致：

```css
--ease-spring:    cubic-bezier(0.32, 0.72, 0, 1);  /* 进场：sheet/dialog/popover */
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);   /* 小位移：hover、分段控件滑动 */
--ease-out:       cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out:    cubic-bezier(0.77, 0, 0.175, 1);
```

bowen 的警告原文：*"**NEVER use ease-in on UI**: it starts slow and feels laggy."*

**linear() 真弹簧曲线**——cubic-bezier 无法表达过冲。下面 3 条按 Apple 的 response/dampingFraction 语义**数值积分**生成（阻尼简谐振子）：

> 公式：`x(t) = 1 − e^(−ζωt) · [cos(ω_d·t) + (ζω/ω_d)·sin(ω_d·t)]`，其中 `ω = 2π/response`、`ω_d = ω√(1−ζ²)`；ζ=1 时退化为 `x(t) = 1 − e^(−ωt)(1 + ωt)`。
> **配合约定**：linear() 的百分比是**时间占比**，所以播放时长要显式写 `transition-duration`（见每条注释）。曲线形状只取决于阻尼比 ζ，response 只映射到「时长」。

```css
/* A. 临界阻尼（ζ=1，response 0.35）—— 无过冲，绝大多数 UI 用这条 */
--ease-spring-critical: linear(
  0 0%, 0.019 3%, 0.067 7%, 0.131 10%, 0.205 13%, 0.282 17%, 0.358 20%,
  0.431 23%, 0.499 27%, 0.562 30%, 0.619 33%, 0.670 37%, 0.715 40%, 0.755 43%,
  0.790 47%, 0.821 50%, 0.848 53%, 0.870 57%, 0.890 60%, 0.907 63%, 0.921 67%,
  0.934 70%, 0.944 73%, 0.953 77%, 0.960 80%, 0.967 83%, 0.972 87%, 0.977 90%,
  0.981 93%, 0.984 97%, 0.986);
--dur-spring-critical: 350ms;

/* B. 微过冲（ζ=0.8，response 0.30）—— sheet / 卡片浮层出现，最大过冲 +1.5% */
--ease-spring-sheet: linear(
  0 0%, 0.034 3%, 0.115 7%, 0.223 10%, 0.340 13%, 0.457 17%, 0.565 20%,
  0.662 23%, 0.744 27%, 0.813 30%, 0.869 33%, 0.913 37%, 0.947 40%, 0.971 43%,
  0.989 47%, 1.001 50%, 1.008 53%, 1.013 57%, 1.015 60%, 1.015 63%, 1.014 67%,
  1.013 70%, 1.011 73%, 1.010 77%, 1.008 80%, 1.006 83%, 1.005 87%, 1.004 90%,
  1.003 93%, 1.002 97%, 1.001);
--dur-spring-sheet: 400ms;

/* C. 明显回弹（ζ=0.65，response 0.40）—— 仅用于「手势带速度」的场景，最大过冲 +6.8% */
--ease-spring-bouncy: linear(
  0 0%, 0.036 3%, 0.128 7%, 0.250 10%, 0.386 13%, 0.522 17%, 0.648 20%,
  0.759 23%, 0.852 27%, 0.926 30%, 0.982 33%, 1.022 37%, 1.047 40%, 1.062 43%,
  1.068 47%, 1.067 50%, 1.062 53%, 1.054 57%, 1.045 60%, 1.036 63%, 1.027 67%,
  1.019 70%, 1.012 73%, 1.007 77%, 1.002 80%, 0.999 83%, 0.997 87%, 0.996 90%,
  0.995 93%, 0.995 97%, 0.996);
--dur-spring-bouncy: 550ms;
```

**时长令牌**（bowen tokens.css）：
```css
--duration-instant: 100ms;  /* 按压反馈 */
--duration-fast:    200ms;  /* tooltip、小 popover */
--duration-base:    300ms;  /* 下拉、多数 UI */
--duration-slow:    450ms;  /* modal、sheet、抽屉 */
```
naplesblue 的补充规则：**进场 350–450ms，退场 250–300ms（走同一条路径）**；scrim 比面板快一点点淡出。

### 6.3 关键交互规则（这些比曲线更重要）

摘自 `_raw/naplesblue-motion.md` 与 `_raw/bowen-motion-physics.md`：

1. **指针按下就反馈，不要等 click**：`.button:active { transform: scale(0.97); }`，`transition: transform 100ms ease-out`。原文：*"A button highlights the instant it's pressed; waiting for click feels dead."*
2. **入场和出场走同一条路径**，`transform-origin` 锚定触发它的元素。
3. **CSS transition 可中断，keyframes 不可中断** —— 原文：*"CSS transitions on transform/opacity **are** interruptible (they retarget from the current value) — CSS @keyframes **are not**; avoid keyframes for anything the user can re-trigger mid-flight."*
4. **只动画 transform 和 opacity**（合成器层）。
5. **玻璃面板要「materialize」而不是 fade**：blur + scale + opacity 一起动。
6. **Momentum projection**（Apple 官方投影函数，非教科书公式）：
   `projected = current + (v/1000) · d/(1−d)`，`d ≈ 0.998`。原文强调：*"Apple's actual projection — NOT the textbook v²/(2·decel), which overshoots."*
7. **Rubber-band**: `(overshoot · dim · 0.55) / (dim + 0.55·|overshoot|)`。
8. **swipe-to-dismiss 速度阈值** ≈ `0.11 px/ms`；**方向判定滞后** ≈ 10px。

### 6.4 prefers-reduced-motion

naplesblue 明确了**三个独立信号**（很多项目只做第一个）：

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; } /* 交叉淡入，不位移 */
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: #fff; backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .glass { background: #fff; border: 1px solid rgba(0,0,0,.35); }
}
```
原文：*"reduced motion means **gentler, not none**"*（降级为交叉淡入，而不是全禁）。

---

## 7. ★ 核心交付物：可直接复制进 :root{} 的完整设计令牌表

> 下面这一整块是自包含的：整段贴进 `src/style.css` 顶部即可。
> 设计取舍：**基底用 apple.com 网页色板（#f5f5f7 / #1d1d1f / #0071e3），状态色用 iOS System Colors（2025 刷新值），暗色模式用 Apple 语义色层级。**

```css
/* ============================================================================
   bk-agent · 青禾 · Apple Design Token Layer
   ----------------------------------------------------------------------------
   来源：
   · HIG Foundations（Typography 2025-12-16 / Color 2025-12-16 /
     Materials 2025-09-09 / Layout 2026-09-09）—— 见 doc/research/_raw/apple-hig-*.md
   · iOS System Colors（WWDC25 / 2025-06-09 刷新值）—— aka-kika/hig-mcp (MIT)
   · apple.com 网页色板 —— naplesblue/apple-design-skill, rukkiecodes/claude-apple-design-system
   · CSS 令牌结构 —— bowen31337/apple-design assets/tokens.css
   规则：组件里只允许引用 var(--…)，禁止硬编码 hex。
   ============================================================================ */

:root {
  color-scheme: light dark;

  /* ── 1. 字体 ─────────────────────────────────────────────────────────── */
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
               "Helvetica Neue", "PingFang SC", "Hiragino Sans GB",
               "Microsoft YaHei", "Segoe UI Variable Text", "Segoe UI",
               Roboto, Inter, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --font-rounded: "SF Pro Rounded", -apple-system, "Nunito", system-ui, sans-serif;

  --fw-regular: 400;  --fw-medium: 500;  --fw-semibold: 600;  --fw-bold: 700;

  /* ── 2. 字号阶梯（HIG Dynamic Type，Large 默认档，1rem = 16px）───────── */
  --text-large-title: 2.125rem;   /* 34pt · 41pt leading · Bold     */
  --text-title-1:     1.75rem;    /* 28pt · 34pt leading · Bold     */
  --text-title-2:     1.375rem;   /* 22pt · 28pt leading · Bold     */
  --text-title-3:     1.25rem;    /* 20pt · 25pt leading · Semibold */
  --text-headline:    1.0625rem;  /* 17pt · 22pt leading · Semibold */
  --text-body:        1.0625rem;  /* 17pt · 22pt leading · Regular  */
  --text-callout:     1rem;       /* 16pt · 21pt leading            */
  --text-subhead:     0.9375rem;  /* 15pt · 20pt leading            */
  --text-footnote:    0.8125rem;  /* 13pt · 18pt leading            */
  --text-caption-1:   0.75rem;    /* 12pt · 16pt leading            */
  --text-caption-2:   0.6875rem;  /* 11pt · 13pt leading            */

  /* 行高 = HIG leading / size 换算后的比例 */
  --leading-large-title: 1.21;  /* 41/34 */
  --leading-title-1:     1.21;  /* 34/28 */
  --leading-title-2:     1.27;  /* 28/22 */
  --leading-title-3:     1.25;  /* 25/20 */
  --leading-headline:    1.29;  /* 22/17 */
  --leading-body:        1.29;  /* 22/17 */
  --leading-callout:     1.31;  /* 21/16 */
  --leading-subhead:     1.33;  /* 20/15 */
  --leading-footnote:    1.38;  /* 18/13 */
  --leading-caption-1:   1.33;  /* 16/12 */
  --leading-caption-2:   1.18;  /* 13/11 */
  --leading-relaxed:     1.6;   /* 长正文（中文阅读建议） */

  /* Tracking：HIG SF Pro 官方表（1/1000em → em）；12pt 为 0，17pt 最紧 */
  --tracking-caption-2: 0.005em;   /* 11pt: +6  */
  --tracking-caption-1: 0em;       /* 12pt:  0  */
  --tracking-footnote: -0.006em;   /* 13pt: -6  */
  --tracking-subhead:  -0.016em;   /* 15pt: -16 */
  --tracking-callout:  -0.020em;   /* 16pt: -20 */
  --tracking-body:     -0.026em;   /* 17pt: -26 ← 正文基准 */
  --tracking-title-3:  -0.023em;   /* 20pt: -23 */
  --tracking-title-2:  -0.012em;   /* 22pt: -12 */
  --tracking-title-1:   0.014em;   /* 28pt: +14 */
  --tracking-large-title: 0.012em; /* 34pt: +12 */
  --tracking-display:  -0.03em;    /* apple.com 营销级大标题（>40pt）专用 */

  /* ── 3. 间距（4/8pt 网格）────────────────────────────────────────────── */
  --space-0:  0;
  --space-1:  0.125rem;  /*  2px */
  --space-2:  0.25rem;   /*  4px */
  --space-3:  0.5rem;    /*  8px */
  --space-4:  0.75rem;   /* 12px */
  --space-5:  1rem;      /* 16px */
  --space-6:  1.25rem;   /* 20px */
  --space-7:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-9:  2.5rem;    /* 40px */
  --space-10: 3rem;      /* 48px */
  --space-12: 4rem;      /* 64px */

  --pad-container: 22px;                   /* 容器左右内边距 */
  --gap-section: clamp(34px, 6vw, 56px);   /* 区块间距 */
  --max-read: 720px;                       /* 阅读列宽 */
  --max-grid: 1080px;                      /* 网格/密集列宽 */
  --hit-min: 44px;                         /* HIG 触控目标最小命中区 */

  /* ── 4. 圆角（语义分层，不要自创中间值）────────────────────────────── */
  --radius-chip:    6px;    /* 极小标记 / 品牌字母 */
  --radius-sm:      8px;
  --radius-thumb:  12px;    /* 缩略图、小方块、输入框 */
  --radius-md:     14px;
  --radius-sheet:  16px;    /* 浮层里的全宽堆叠按钮 */
  --radius-card:   18px;    /* 标准业务卡片 */
  --radius-lg:     20px;
  --radius-panel:  22px;    /* 大面板 / section 容器 */
  --radius-hero:   26px;    /* hero / CTA / 焦点卡片 */
  --radius-2xl:    28px;
  --radius-pill:  999px;    /* 胶囊 / 分段控件 / tag / 主按钮 */
  /* 连续圆角近似：CSS 正圆角与超椭圆视觉差 ~20%，故 CSS 半径 = 设计半径 × 1.2 */

  /* ── 5. 阴影（永远两层：紧贴接触影 + 柔和环境影；禁止单层硬阴影）───── */
  --shadow-hairline: 0 0 0 0.5px rgba(0,0,0,0.06);
  --shadow-1:   0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.06);
  --shadow-card:0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05);
  --shadow-2:   0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.08);
  --shadow-panel:0 1px 3px rgba(0,0,0,0.05), 0 14px 40px rgba(0,0,0,0.05);
  --shadow-lift: 0 12px 32px rgba(0,0,0,0.10);          /* 配 translateY(-3px) */
  --shadow-3:   0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.08);
  --shadow-4:   0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.10);
  --shadow-overlay: 0 2px 8px rgba(0,0,0,0.10), 0 30px 80px rgba(0,0,0,0.24);
  --shadow-cta: 0 20px 54px rgba(0,113,227,0.24);        /* 品牌色染色的 CTA 阴影 */
  --shadow-glass: 0 8px 32px rgba(0,0,0,0.18);

  /* ── 6. 材质 / 模糊（Liquid Glass 网页等价）────────────────────────── */
  --material-ultrathin-tint: rgba(255,255,255,0.44);
  --material-thin-tint:      rgba(255,255,255,0.60);
  --material-regular-tint:   rgba(255,255,255,0.72);
  --material-thick-tint:     rgba(255,255,255,0.84);
  --blur-ultrathin: 10px;
  --blur-thin:      14px;
  --blur-regular:   20px;
  --blur-thick:     34px;
  --glass-saturate: 180%;
  --glass-dim: 0.35;   /* Apple 唯一公布的 Liquid Glass 数值：clear 变体暗化层 35% */

  /* 玻璃四层模型的 box-shadow 组合 */
  --glass-rim-light:
    inset 0 1px 0 rgba(255,255,255,0.55),
    inset 0 0 0 0.5px rgba(255,255,255,0.18),
    0 0 0 0.5px rgba(0,0,0,0.06);
  --glass-shadow: var(--glass-rim-light), var(--shadow-glass);

  /* ── 7. 动效 ─────────────────────────────────────────────────────────── */
  --duration-instant: 100ms;   /* 按压反馈 */
  --duration-fast:    200ms;   /* tooltip / 小 popover */
  --duration-base:    300ms;   /* 下拉 / 多数 UI */
  --duration-slow:    450ms;   /* modal / sheet / 抽屉 */
  --duration-exit:    260ms;   /* 退场（比进场快，走同一条路径） */

  --ease-spring:    cubic-bezier(0.32, 0.72, 0, 1);   /* 进场主力（iOS sheet 曲线） */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);    /* 小位移：hover、分段滑动 */
  --ease-out:       cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out:    cubic-bezier(0.77, 0, 0.175, 1);
  --ease-snappy:    cubic-bezier(0.4, 0, 0.2, 1);

  /* linear() 真弹簧（数值积分生成，见 §6.2）。时间百分比 → 必须配 duration */
  --ease-spring-critical: linear(
    0 0%, 0.019 3%, 0.067 7%, 0.131 10%, 0.205 13%, 0.282 17%, 0.358 20%,
    0.431 23%, 0.499 27%, 0.562 30%, 0.619 33%, 0.670 37%, 0.715 40%, 0.755 43%,
    0.790 47%, 0.821 50%, 0.848 53%, 0.870 57%, 0.890 60%, 0.907 63%, 0.921 67%,
    0.934 70%, 0.944 73%, 0.953 77%, 0.960 80%, 0.967 83%, 0.972 87%, 0.977 90%,
    0.981 93%, 0.984 97%, 0.986);
  --ease-spring-sheet: linear(
    0 0%, 0.034 3%, 0.115 7%, 0.223 10%, 0.340 13%, 0.457 17%, 0.565 20%,
    0.662 23%, 0.744 27%, 0.813 30%, 0.869 33%, 0.913 37%, 0.947 40%, 0.971 43%,
    0.989 47%, 1.001 50%, 1.008 53%, 1.013 57%, 1.015 60%, 1.015 63%, 1.014 67%,
    1.013 70%, 1.011 73%, 1.010 77%, 1.008 80%, 1.006 83%, 1.005 87%, 1.004 90%,
    1.003 93%, 1.002 97%, 1.001);
  --ease-spring-bouncy: linear(
    0 0%, 0.036 3%, 0.128 7%, 0.250 10%, 0.386 13%, 0.522 17%, 0.648 20%,
    0.759 23%, 0.852 27%, 0.926 30%, 0.982 33%, 1.022 37%, 1.047 40%, 1.062 43%,
    1.068 47%, 1.067 50%, 1.062 53%, 1.054 57%, 1.045 60%, 1.036 63%, 1.027 67%,
    1.019 70%, 1.012 73%, 1.007 77%, 1.002 80%, 0.999 83%, 0.997 87%, 0.996 90%,
    0.995 93%, 0.995 97%, 0.996);
  --dur-spring-critical: 350ms;
  --dur-spring-sheet:    400ms;
  --dur-spring-bouncy:   550ms;

  /* ── 8. 色彩 · Light（默认）─────────────────────────────────────────── */
  /* 8.1 apple.com 网页骨架 */
  --bg-app:        #f5f5f7;   /* 页面底 · 冷灰白，绝不偏暖 */
  --bg-surface:    #ffffff;   /* 卡片 / 面板 */
  --bg-surface-alt:#fafafc;   /* 次级面板 */
  --bg-hover:      #fbfbfd;   /* 行 hover */
  --bg-track:      #e8e8ed;   /* 进度条/开关关闭态轨道 */
  --bg-gradient:   linear-gradient(160deg, #f3f7ff 0%, #f5f5f7 42%, #f4f2fb 100%);

  --text-primary:    #1d1d1f;  /* 近黑，不是纯黑 */
  --text-body:       #424245;
  --text-secondary:  #6e6e73;
  --text-tertiary:   #86868b;
  --text-placeholder:#aeaeb2;
  --text-faint:      #d2d2d7;

  --hairline:     rgba(0,0,0,0.07);
  --divider-soft: #f0f0f0;
  --divider:      #e0e0e0;

  /* 8.2 Apple 语义色（UIKit 角色，light） */
  --label:            rgba(0,0,0,1);
  --label-secondary:  rgba(60,60,67,0.60);
  --label-tertiary:   rgba(60,60,67,0.30);
  --label-quaternary: rgba(60,60,67,0.18);
  --separator:        rgba(60,60,67,0.29);
  --separator-opaque: #C6C6C8;
  --fill-1: rgba(120,120,128,0.20);
  --fill-2: rgba(120,120,128,0.16);
  --fill-3: rgba(120,120,128,0.12);
  --fill-4: rgba(120,120,128,0.08);
  --ios-bg:            #FFFFFF;
  --ios-bg-secondary:  #F2F2F7;
  --ios-bg-tertiary:   #FFFFFF;
  --ios-bg-grouped:    #F2F2F7;

  /* 8.3 强调色（每屏最多 1–2 个填充色按钮） */
  --accent:        #0071e3;   /* 主按钮 / 链接 / 焦点环 */
  --accent-hover:  #0077ED;
  --accent-press:  #006EDB;
  --accent-link:   #0066cc;   /* 浅底上的链接文字 */
  --accent-on:     #ffffff;
  --accent-tint:   rgba(0,113,227,0.10);
  --accent-2:      #5e5ce6;   /* 渐变第二停靠点 / 强调紫 */

  /* 8.4 状态色（iOS System Colors，2025-06-09 刷新值；只表达状态，不做装饰） */
  --success: #34C759;  --success-tint: rgba(52,199,89,0.12);
  --warning: #FF8D28;  --warning-tint: rgba(255,141,40,0.12);
  --danger:  #FF383C;  --danger-tint:  rgba(255,56,60,0.10);
  --info:    #0088FF;  --info-tint:    rgba(0,136,255,0.10);
  --live:    #30d158;
  --indigo:  #6155F5;
  --teal:    #00C3D0;
  --purple:  #CB30E0;
  --pink:    #FF2D55;
  --yellow:  #FFCC00;
  --orange:  #FF8D28;

  /* 8.5 灰色梯度 */
  --gray-1:#8E8E93; --gray-2:#AEAEB2; --gray-3:#C7C7CC;
  --gray-4:#D1D1D6; --gray-5:#E5E5EA; --gray-6:#F2F2F7;

  /* 8.6 品牌渐变（仅 hero / CTA / 占位插画） */
  --grad-brand: linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%);
  --grad-cta:   linear-gradient(135deg, #0071e3 0%, #5e5ce6 100%);
  --grad-warm:  linear-gradient(135deg, #ff9f0a 0%, #ff375f 100%);

  --scrim: rgba(0,0,0,0.45);   /* 浮层后面的遮罩 —— 深度靠它，不靠阴影 */
}

/* ══ Dark Mode（自动 + 可强制）══════════════════════════════════════════ */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg-app:        #000000;
    --bg-surface:    #1c1c1e;
    --bg-surface-alt:#2c2c2e;
    --bg-hover:      #2c2c2e;
    --bg-track:      #3a3a3c;
    --bg-gradient:   linear-gradient(160deg, #0a1020 0%, #000000 45%, #120e1e 100%);

    --text-primary:    #f5f5f7;
    --text-body:       #d1d1d6;
    --text-secondary:  #98989d;
    --text-tertiary:   #8e8e93;
    --text-placeholder:#636366;
    --text-faint:      #48484a;

    --hairline:     rgba(255,255,255,0.10);
    --divider-soft: rgba(255,255,255,0.06);
    --divider:      rgba(255,255,255,0.12);

    --label:            rgba(255,255,255,1);
    --label-secondary:  rgba(235,235,245,0.60);
    --label-tertiary:   rgba(235,235,245,0.30);
    --label-quaternary: rgba(235,235,245,0.16);
    --separator:        rgba(84,84,88,0.60);
    --separator-opaque: #38383A;
    --fill-1: rgba(120,120,128,0.36);
    --fill-2: rgba(120,120,128,0.32);
    --fill-3: rgba(120,120,128,0.24);
    --fill-4: rgba(120,120,128,0.18);
    --ios-bg:           #000000;
    --ios-bg-secondary: #1C1C1E;
    --ios-bg-tertiary:  #2C2C2E;
    --ios-bg-grouped:   #000000;

    --accent:       #0A84FF;
    --accent-hover: #3395FF;
    --accent-press: #0071E3;
    --accent-link:  #2997ff;
    --accent-tint:  rgba(10,132,255,0.18);
    --accent-2:     #5e5ce6;

    --success:#30D158; --warning:#FF9230; --danger:#FF4245; --info:#0091FF;
    --success-tint: rgba(48,209,88,0.18);
    --warning-tint: rgba(255,146,48,0.18);
    --danger-tint:  rgba(255,66,69,0.18);
    --info-tint:    rgba(0,145,255,0.18);
    --indigo:#6D7CFF; --teal:#00D2E0; --purple:#DB34F2; --pink:#FF375F;
    --yellow:#FFD600; --orange:#FF9230;

    --gray-1:#8E8E93; --gray-2:#636366; --gray-3:#48484A;
    --gray-4:#3A3A3C; --gray-5:#2C2C2E; --gray-6:#1C1C1E;

    --material-ultrathin-tint: rgba(30,30,32,0.44);
    --material-thin-tint:      rgba(30,30,32,0.62);
    --material-regular-tint:   rgba(30,30,32,0.74);
    --material-thick-tint:     rgba(30,30,32,0.86);

    --glass-rim-light:
      inset 0 1px 0 rgba(255,255,255,0.12),
      inset 0 0 0 0.5px rgba(255,255,255,0.06),
      0 0 0 0.5px rgba(0,0,0,0.40);

    --shadow-card:   0 1px 2px rgba(0,0,0,0.30);
    --shadow-panel:  0 2px 8px rgba(0,0,0,0.36);
    --shadow-3:      0 8px 24px rgba(0,0,0,0.44);
    --shadow-4:      0 16px 48px rgba(0,0,0,0.52);
    --shadow-overlay:0 2px 8px rgba(0,0,0,0.40), 0 30px 80px rgba(0,0,0,0.60);
    --shadow-glass:  0 8px 32px rgba(0,0,0,0.50);
    --shadow-hairline: 0 0 0 0.5px rgba(255,255,255,0.10);
    --scrim: rgba(0,0,0,0.60);
  }
}

/* 强制暗色（与系统设置无关）：把上面 @media 块里的声明再写一遍到该选择器即可，
   或改用 :root[data-theme="dark"], :root:not([data-theme="light"]) 作为选择器。 */
```

### 7.1 配套的底座规则（同样可直接复制）

```css
html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  font-family: var(--font-sans);
  font-optical-sizing: auto;             /* SF Pro 可变字体自动切换光学尺寸 */
  -webkit-font-smoothing: antialiased;   /* 更接近 Apple 渲染 */
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-size: var(--text-body);
  line-height: var(--leading-body);
  letter-spacing: var(--tracking-body);
  color: var(--text-primary);
  background: var(--bg-app);
  background-image: var(--bg-gradient);  /* 浅蓝紫氛围 —— 只铺在最底层 */
  background-attachment: fixed;
}

/* 金额、时间、序号一律等宽数字，避免跳动 */
.tabular, .amount, time { font-variant-numeric: tabular-nums; }

/* 玻璃：只用在顶栏 / 输入框 / 浮层 / CTA，不要用在内容卡片上 */
.glass {
  background: var(--material-regular-tint);
  -webkit-backdrop-filter: blur(var(--blur-regular)) saturate(var(--glass-saturate));
          backdrop-filter: blur(var(--blur-regular)) saturate(var(--glass-saturate));
  box-shadow: var(--glass-shadow);
}

/* 卡片：纯白不透明 —— 与玻璃形成层级对比 */
.card {
  background: var(--bg-surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

/* 滚动边缘渐隐，替代 1px 分割线 */
.scroll-edge {
  position: sticky; top: 0; height: 12px; pointer-events: none;
  background: linear-gradient(var(--bg-app), transparent);
  -webkit-mask-image: linear-gradient(black, transparent);
          mask-image: linear-gradient(black, transparent);
}

/* ── 降级与无障碍 ─────────────────────────────────────────────────── */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: var(--bg-surface); }
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: var(--bg-surface); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .glass, .card { background: var(--bg-surface); box-shadow: inset 0 0 0 1px var(--separator-opaque); }
  :root { --text-secondary: var(--text-primary); --hairline: rgba(0,0,0,0.30); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .sheet, .dialog { transform: none !important; transition: opacity 200ms ease !important; }
}
```

---

## 8. 给 bk-agent 的落地建议（按优先级）

1. **先改 token，不要先改结构。** 把 §7 整块贴进 `src/style.css` 顶部，然后把现有 `src/style.css` / `src/refinement.css` 里的硬编码色值逐个换成 `var(--…)`。这一步不需要动 `src/main.jsx`，风险最低、见效最快。
2. **执行「两层模型」。** 聊天区、资金面板、业务卡片 → 纯白 + `--shadow-card` + hairline。顶栏、输入框、TransferDialog、DeleteConversationDialog → 玻璃。**这是把「功能堆砌的后台」变成「精致对话界面」的核心动作**，比换配色重要得多。
3. **渐变只铺一层。** `--bg-gradient` 放 body，所有卡片不透明。这样既有「柔和浅蓝/淡紫」氛围，又不会糊成一团。
4. **收敛强调色。** 全站一个 `--accent`。四个业务模块不要再各自不同色；状态用 `--success/--warning/--danger` 且只出现在 badge 上。
5. **排版按 HIG 表来。** 对话正文 = `--text-body` / `--leading-body` / `--tracking-body`；卡片标题 = `--text-headline`；金额数字 = `--text-title-2` + `tabular-nums`。
6. **动效只加三处**：按钮 `:active` 缩放（100ms）、浮层进出场（`--ease-spring-sheet` 400ms / 出场 260ms 同路径）、列表项 hover 上浮 3px。其它一律不加。HIG Motion 页原文：*"In apps, generally avoid adding motion to UI interactions that occur frequently."*
7. **squircle 不值得做。** 用「设计半径 × 1.2」的近似即可，别引 Houdini worklet。
8. **性能红线**：玻璃元素同屏 ≤ 3 个；不要给玻璃元素加 `position: fixed` 的子孙（会创建 containing block）；滚动容器里不要放玻璃。

---

## 9. 原始素材索引（doc/research/_raw/）

| 文件 | 内容 | 来源 |
|---|---|---|
| apple-hig-design-principles.md | HIG 设计原则全文（8 组新框架） | dickwu/apple-design-skill 镜像 |
| apple-hig-typography.md | 含 Dynamic Type 全档位表 + Tracking 官方表 | 同上（Apple 侧 2025-12-16） |
| apple-hig-color.md | 色彩原则 + Liquid Glass color | 同上（2025-12-16） |
| apple-hig-materials.md | Liquid Glass / Standard materials / Vibrancy | 同上（2025-09-09） |
| apple-hig-motion.md | 动效原则 | 同上（2025-09-09） |
| apple-hig-layout.md | 视觉层级 / 自适应 / safe area | 同上（2026-09-09） |
| apple-hig-liquid-glass.md | Liquid Glass 跨平台落地指南 + review checklist | 同上（策展） |
| apple-hig-accessibility.md | 无障碍原则 | 同上 |
| apple-hig-dark-mode.md | 暗色模式 | 同上 |
| hig-mcp-color.json | System Colors 2025-06-09 刷新值（light/dark） | aka-kika/hig-mcp (MIT) |
| bowen-tokens.css | 全量 CSS 令牌（色/字/距/圆角/影/动效） | bowen31337/apple-design |
| bowen-liquid-glass.md | 玻璃四层模型 + CSS/SVG 配方 + fallback | 同上 |
| bowen-motion-physics.md | Apple 弹簧参数表 + 动量投影 + rubber-band | 同上 |
| naplesblue-tokens.css | apple.com 色板 + 玻璃配方 + 缓动 | naplesblue/apple-design-skill |
| naplesblue-design-system.md | 排版/间距/圆角/阴影/触控目标规范 | 同上 |
| naplesblue-motion.md | 三个 reduced-* 媒体查询 + 可中断性规则 | 同上 |
| rukki-colors.md | apple.com 单强调色语义色板（互印证） | rukkiecodes/claude-apple-design-system (MIT) |
