# 前端技能库与动效方法论调研

> **调研对象**：作者口述的三个「前端技能」（**花shushu 的 design** / **impeccable** / **taste skill**，2026-09-28 经作者更正后的名字）+ GSAP + 界面动效设计方法论
> **调研日期**：2026-09-28（含一次按更正名的重搜）
> **调研方式**：`gh api` / `gh search` 实测 + 官网原文抓取 + 源码逐行阅读
> **交付物**：本文档 + `bk-agent/vendor/` 下 6 个参考仓库（`git clone --depth 1`）
> **名字更正记录**：首轮口述为「画书的 design / impossible」；作者随后更正为「**花shushu 的 design / impeccable**」。第二轮已按更正名全套重搜，结论与候选表见 §1.0b、§1.1、§1.2。
> **硬性约束**：所有 star / license / push 时间均为 `gh api` **实时实测值**，不采信记忆；本文档未改动 `bk-agent/src/` 任何一行，未改动 `package.json`。

---

## 0. TL;DR

| 口述名（更正后） | 判定结果 | repo | ★ | License | 本地路径 |
|---|---|---|---|---|---|
| **「花shushu 的 design」** | ✅ **= 花叔 / huashu** | `alchaincyf/huashu-design` | 24,505 | MIT | `vendor/skills/huashu-design/` |
| **「impeccable」** | ✅ 无歧义（榜首，领先第 2 名 240 倍） | `pbakaus/impeccable` | 71,873 | Apache-2.0 | `vendor/skills/impeccable/` |
| **「taste skill」** | ✅ 无歧义（榜首，领先第 2 名 245 倍） | `Leonxlnx/taste-skill` | 90,693 | MIT | `vendor/skills/taste-skill/` |
| （配套目录） | 花叔全部 53 个 skill 的总目录 | `alchaincyf/huashu-skills` | 1,618 | MIT | `vendor/skills/huashu-skills/` |
| （备选，动画向） | 一并拉取 | `emilkowalski/skills` | 41,539 | MIT | `vendor/skills/emilkowalski-skills/` |
| **GSAP** | ✅ | `greensock/GSAP` | 28,671 | **非 OSI 开源**，Webflow「Standard No Charge License」 | `vendor/gsap/` |

> ★ 数在两次抓取之间有 +1 ~ +2 的自然增长，说明取的是实时值。

**三条最重要结论**：

1. **「花shushu」= 花叔（huashu），没有第二个人**。GitHub 上不存在任何叫 `huashushu` / `花书书` / `花叔叔` 的设计技能作者——三个同名账号 `huashushu`、`huashushu1`、`huashushu56-hub` **全部是 0 仓库的空号**。而 `alchaincyf` 的 GitHub **显示名就是「花叔」**，bio 写着 *"Author of nuwa-skill · **huashu-design** · darwin-skill"*，其 20 个仓库一律以 `huashu-` 开头。「花shushu」是把「花叔」两个字念了两遍 `huā shū` 的口语记法。详见 §1.0b / §1.1。
2. **「impeccable」经第二轮重搜确认无歧义**——`pbakaus/impeccable` 以 71,873★ 排第一，第二名 `h3nryprod01/design-taste`（三者合成版）只有 59★，量级差 1200 倍。见 §1.2 的候选对照表。
3. **GSAP 现在 100% 免费（含全部原 Club 插件），可以在参赛项目里直接用**——但它是「免费但专有」的许可，**不是** MIT/Apache。见 §2.2 / §2.3。
4. **本项目不需要 GSAP。** 现有 `src/styles/tokens.css` 里已经有一套带 `linear()` 真弹簧的动效令牌体系，GSAP 的编排语义（timeline / stagger / position 参数）全部可以用 CSS + WAAPI 等价表达。对照表见 §2.6。

---

# 第 1 部分 · 三个「前端技能」的考证与拉取

## 1.0 调查方法与检索路径

| 路径 | 命令 | 结果 |
|---|---|---|
| repo 名模糊检索 | `gh search repos 'huashu' / 'impeccable' / 'impossible skill' / 'design taste'` | 大量命中 |
| topic 检索 + 正则过滤 | `gh search repos --topic claude-skill --limit 100 ... --jq '[.[] \| select(... test("imposs";"i"))]'` | **空**（agent-skills topic 同为空） |
| 代码检索 | `gh search code 'impossible' --filename SKILL.md` | 命中全是无关仓库，**无设计/动画技能** |
| 克隆后 grep | `grep 'impossible' vendor/skills/**/*.md` | 全库仅 4 处正文用词（如 "nearly impossible"），**无 skill 命名** |
| 生态目录 | `wilwaldon/Claude-Code-Frontend-Design-Toolkit` README、`anthropics/skills`、`obra/superpowers`、`alchaincyf/huashu-skills` 全目录 | 无 impossible |
| web 检索 | 见附录 C | 无 impossible |

**关键旁证**：社区合成仓库 `h3nryprod01/design-taste` 的自述是

> "Elite frontend design taste for Claude Code / Cowork — **a merged synthesis of `emilkowalski/skill`, `pbakaus/impeccable`, and `leonxlnx/taste-skill`**"

也就是说，"impeccable + taste-skill" 是这个生态里公认的**成对出现**的设计技能组合。

---

## 1.0b 按更正名的第二轮重搜（2026-09-28）

作者更正后，对「**花shushu**」「**impeccable**」「**taste skill**」三个名字做了独立的全套重搜。**检索到的东西全部记录如下，没有对应物的就写"没有"，不做任何推测性编造。**

### 「花shushu」的穷举检索（6 条路径）

| # | 检索 | 命令 / API | 结果 |
|---|---|---|---|
| 1 | GitHub 用户名精确检索 | `gh api 'search/users?q=huashushu'` | 命中 **3 个账号**，**全部是空号**：`huashushu`（2017 注册，0 仓库，无姓名无 bio）、`huashushu1`（0 仓库）、`huashushu56-hub`（0 仓库） |
| 2 | 中文名检索 | `search/users?q=花叔` / `花书书` / `花叔叔` | **全部 total_count = 0** |
| 3 | 仓库名检索 | `gh search repos 'huashushu'` / `'hua-shushu'` / `'shushu design'` / `'shushu skill'` | **全部返回 `[]`** |
| 4 | 代码检索 | `search/code?q="花shushu"` | **total_count = 0** |
| 5 | SKILL.md 内检索 | `search/code?q=shushu+filename:SKILL.md` | 16 条命中，逐条查看：`shushu-internship-tool`、`shushu-novelty-finder`、`c5-mushushu-0`、`bluecat-deploy` 等——**全部与设计技能无关** |
| 6 | 全网检索 | `web_search "花shushu"` / `"huashushu 设计 skill"` | **无相关结果**（只返回满文词典、SHUSHU/TONG 服装品牌等同名噪音） |

### 结论：**「花shushu」= 花叔（huashu），不是另一个人**

决定性证据（`gh api users/alchaincyf`）：

```json
{
  "login": "alchaincyf",
  "name": "花叔",
  "bio": "AI Native Coder. Ship products without writing code. Author of nuwa-skill · huashu-design · darwin-skill.",
  "followers": 10228,
  "public_repos": 87,
  "created_at": "2023-03-13T04:44:42Z"
}
```

- **显示名就是「花叔」**，两个字的拼音是 `huā shū`。「花shushu」= 把「花叔」念成 `huā` + `shū shū`（第二次是拖音/重复）。
- 该作者名下 **20 个仓库一律以 `huashu-` 开头**（见下方候选表），命名体系完全自洽。
- `huashu-skills` 总目录 README 第 11 行自我介绍：**「花叔 | AI Native Coder · 独立开发者 · 全网50万+读者」**。

### 「花shushu 的 design」候选对照表（供作者裁决）

| 排序 | repo | ★ | License | 最近 push | 是什么 | 为什么可能是它 |
|---|---|---|---|---|---|---|
| **① 最匹配** | `alchaincyf/huashu-design` | **24,505** | MIT | 2026-09-22T15:52:07Z | 花叔的 HTML 原生设计技能（高保真原型 / 幻灯片 / 动画 / 20 种设计哲学 / 5 维评审） | 作者显示名 =「花叔」；同名技能；star 最高；生态里唯一的中文万级设计技能 |
| ② 配套 | `alchaincyf/huashu-skills` | 1,618 | MIT | 2026-09-22T15:52:24Z | 花叔全部 **53 个** skill 的总目录（16 旗舰 + 14 人物视角 + 22 内置） | 是 ① 的官方索引，可用来确认"花叔系"全貌 |
| ③ 镜像 | `pc-software-org/huashu-design-en` | 25 | MIT | 2026-08-31T10:22:14Z | `huashu-design` 的英文自动同步镜像 | 如果你看到的是英文版 |
| ④ 存疑 | `ZeroxZhang/huashu-bookwriter` | 160 | MIT | 2026-04-12T11:30:45Z | 第三方作者的"书稿写作"技能，复用 `huashu-` 前缀 | **若作者原意真的是「画书」（画/写书）而不是「花叔」**，这个才是候选；但它不是设计技能，且非花叔本人 |

> **建议**：默认取 **①**（已克隆）。若你确认当时想到的是「画书 = bookwriter」，告诉我，我再把 ④ 拉下来。

---

## 1.1 「花shushu 的 design」→ `alchaincyf/huashu-design`

| 字段 | 实测值 |
|---|---|
| repo 全名 | `alchaincyf/huashu-design` |
| URL | https://github.com/alchaincyf/huashu-design |
| Star | **24,505**（第二轮重搜实测；首轮 24,504） |
| Fork | 2,797 |
| License | **MIT** |
| 最近 push | **2026-09-22T15:52:07Z** |
| 创建时间 | 2026-04-19T14:42:06Z |
| 默认分支 | `master` |
| 本地克隆 commit | `0830494ecb1c117e25b313a8114fe55a6bf2b125`（2026-09-22 23:51:56 +0800） |

**判定理由**：作者原话「画书的 design」——`画书 huàshū ` 对 `花叔 huāshū`（作者**花叔**，账号 `alchaincyf`，中文 AI 圈知名作者）。repo 描述直接写着 **"Huashu Design · HTML-native design skill for Claude Code"**，且是全生态里唯一一个 star 数达到万级的**中文**设计技能。同时其姊妹总目录 `alchaincyf/huashu-skills`（1,617★）里也就只有 `huashu-design` 这一个 design 技能。**基本可确认。**

### SKILL.md 核心内容摘要（582 行）

```yaml
name: huashu-design
description: 花叔Design——用HTML做高保真原型、幻灯片、动画、可视化与专家评审。
             任何新设计100%先出三个方向初稿给用户选（指定风格/品牌也不豁免），选定后才执行。
             触发词：做原型、PPT、幻灯片、动画、设计风格、评审、做个HTML页面、UI mockup、导出MP4/GIF、做个好看的。
             生产级Web App/需后端的系统不适用。
```

它到底教了什么：

1. **身份先行**：开篇第一句是「**你是设计师，不是写HTML的程序员**」，交付标准是「**产出要让人认不出是AI做的**」。规定要依次扮演 6 个角色：艺术总监 / 品牌研究员 / 视觉设计师 / **动效设计师** / 前端工程师 / 文案。
2. **核心原则 #0 —— 事实验证先于假设**（优先级凌驾一切）：任何涉及具体产品/技术/版本号的断言，第一步必须 WebSearch 验证，并列出了「禁止句式」（"我记得 X 还没发布"…）与成本对比（搜索 10 秒 vs 返工 2 小时）。
3. **三方向硬门**：任何会产出新视觉设计的任务，**100% 必须先出三版真实初稿**让用户选，指定了风格也不豁免。
4. **核心资产协议**：设计里只要出现能认出的品牌，就必须取齐官方 logo / 产品图，固化成 `brand-spec.md`。「资产 > 规范」。
5. **任务路由表**：按信号分流到原型 / 幻灯片 / 动画 / UI demo / 长视频 / launch film / App 原型 / 评审共 8 条产线。
6. **弱 runtime 降级模式**：无 subagent 时怎么退化执行。

### 参考文件里与本项目最相关的三份

| 文件 | 内容 | 对本项目的价值 |
|---|---|---|
| `references/animation-best-practices.md`（520 行） | Anthropic 三支产品动画的拆解：Slow-Fast-Boom-Stop 五段节奏、Easing 哲学、运动语言 | **直接可用**，见 §3.4 |
| `references/gsap-recipes.md`（801 行） | 自研 easing 与 GSAP 的一一对应表、五段叙事 timeline 骨架、运动语言 8 条的逐条翻译 | **本文 §2.6 的重要交叉印证** |
| `references/animation-pitfalls.md` | 24 条 HTML 动画踩坑清单（叠层、CORS、seek 不确定性、字体加载前测量…） | 做动画 demo 时避坑 |

---

## 1.2 「impeccable」→ `pbakaus/impeccable`（第二轮按更正名重搜，无歧义）

| 字段 | 实测值 |
|---|---|
| repo 全名 | `pbakaus/impeccable` |
| URL | https://github.com/pbakaus/impeccable |
| Star | **71,873**（第二轮实测；首轮 71,872） |
| Fork | 4,348 |
| License | **Apache-2.0** |
| 最近 push | **2026-09-28T02:07:58Z**（就是今天，极活跃） |
| 创建时间 | 2025-11-16T01:52:04Z |
| 默认分支 | `main` |
| 本地克隆 commit | `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`（2026-09-24） |

**判定理由（第二轮 `gh search repos 'impeccable'` 全量重搜，按 star 排序）**：

| 排序 | repo | ★ | License | 最近 push | 是什么 |
|---|---|---|---|---|---|
| **①** | **`pbakaus/impeccable`** | **71,873** | Apache-2.0 | 2026-09-28T02:07:58Z | 原版：一条技能 + 24 个设计子命令的完整设计语言 |
| ② | `h3nryprod01/design-taste` | 59 | MIT | 2026-09-25 | **合成版**：emilkowalski/skill + pbakaus/impeccable + leonxlnx/taste-skill 三者合并 |
| ③ | `peterhadorn/webdesign-agency-skills` | 39 | 未查 | 2026-04-11 | 基于 Impeccable 的两个网站审计技能 |
| ④ | `ilindaniel/impeccable-lite` | 27 | Apache-2.0 | 2026-08-01 | 去掉插件机制的极简版，只有 **9 KB** / 一个 SKILL.md |
| ⑤ | `DevvGwardo/impeccable` | 12 | **NONE** | 2026-05-19 | Hermes Agent 的移植版，23 命令 |

① 领先第二名 **1218 倍**，无歧义。

- 附：第一轮时作者口述为「impossible」，全网**不存在**任何叫 impossible 的设计/动画技能（§1.0 四条路径均为空）。当时即已推断为 `impeccable` 的音近误听（`/ɪmˈpekəbl/` 对 `/ɪmˈpɒsəbl/`），**第二轮更正直接证实了这个推断**。
- 作者把它描述为「前端/**动画**相关技能」——impeccable 有 24 个子命令，其中 `animate` / `delight` / `overdrive` / `bolder` / `quieter` 五个直接就是动效与表现力命令，`reference/animate.md` 是一份完整的动效规范（见 §3.3）。
- 与已确认命中的 `taste-skill`（90.7k）成对出现在所有社区综述里（见 ② 的自述）。

### 附带拉取（动画向）：`emilkowalski/skills`

| 字段 | 实测值 |
|---|---|
| Star | **41,539**（第二轮实测；首轮 41,537） |
| License | MIT |
| 最近 push | 2026-09-23T23:18:27Z |
| 描述 | "Skills for Designers and Engineers." |
| commit | `d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128` |

这是 Emil Kowalski（Vercel / Linear 出身，`sonner`、`vaul`、animations.dev 作者）的技能包，**13 个技能里 9 个是动画向**：`animate`、`animate-expo`、`review-animations`、`improve-animations`、`find-animation-opportunities`、`animation-vocabulary`、`apple-design`、`emil-design-eng`。

**注意**：更正后的名字是 impeccable，不是这一个。保留它是因为它**纯动画向**、MIT、且体积仅 0.4 MB——是本报告 §3（动效方法论）最主要的引用来源之一。

### SKILL.md 核心内容摘要（87 行主文件 + 24 个 reference）

```yaml
name: impeccable
version: 4.4.0
license: Apache 2.0
description: Use when the user wants to design, redesign, shape, critique, audit, polish,
  clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise
  improve a frontend interface. ... Also use for bland designs that need to become
  bolder or more delightful ... Not for backend-only or non-UI tasks.
```

它到底教了什么：

1. **一条技能 + 24 个子命令**（`/impeccable animate`、`/impeccable polish`…），刻意**不做成 24 个独立 skill**（避免污染 `/` 菜单）——这个取舍本身值得学。
2. **四个 Mode**：Persuade（说服：落地页/营销）/ Operate（操作：App UI/仪表盘）/ Read（阅读：文档）/ Experience（体验：作品集）。**Mode 按"面"定，不按"产品"定**——一个工具的落地页仍是 Persuade。
3. **三条顶级原则**：Go all out / Dream big and bold / **Verify in bounded passes, not a loop**（限额轮次验证，不许无限自我打磨烧钱）。
4. **The brief wins**：用户钉死的审美/年代/材质/字体/配色优先于模型的品味判断，把需求掰向自己的品味 = 失败。
5. **Refinement preserves; redesign replaces**：微调保留既有身份，重设计把旧外观当"反参考"，**绝不折中**。
6. **craft-floor.md**：在任何 UI 编辑前必读的"质量地板 + 绝对禁令 + 检测器抓不到的反射动作"。
7. v4 明确删除了 `typography.md / color-and-contrast.md / motion-design.md / interaction-design.md` 等按域拆分的 reference，把内容并进命令 reference 和 craft-floor —— 理由是"只在适用时才加载"。

---

## 1.3 「taste skill」→ `Leonxlnx/taste-skill`

| 字段 | 实测值 |
|---|---|
| repo 全名 | `Leonxlnx/taste-skill` |
| URL | https://github.com/Leonxlnx/taste-skill |
| Star | **90,693**（第二轮实测；首轮 90,692）← 本次调研中 star 最高的技能仓库 |
| Fork | 6,175 |
| License | **MIT** |
| 最近 push | **2026-09-26T09:01:50Z** |
| 创建时间 | 2026-02-19T21:44:05Z |
| 默认分支 | `main` |
| 本地克隆 commit | `ce26fc25c0e5e8cab638f883de62d9a86ee5e45b`（2026-09-26） |

**判定理由（第二轮 `gh search repos 'taste skill'` 全量重搜，按 star 排序）**：

| 排序 | repo | ★ | License | 最近 push | 是什么 |
|---|---|---|---|---|---|
| **①** | **`Leonxlnx/taste-skill`** | **90,693** | MIT | 2026-09-26T09:01:50Z | 原版：三个旋钮 + Anti-Slop 的完整技能包（15 个子技能） |
| ② | `senlindesign/taste-skill` | 369 | **无 license** | 2026-07-07 | 逆向工程网站设计品味的技能，**同名但无关** |
| ③ | `jaytel0/taste` | 303 | **无 license** | 2026-08-23 | "Taste skill creation pipeline"，造 taste skill 的流水线 |
| ④ | `Hayatelin/taste-skill-zh-CN` | 7 | NOASSERTION | 2026-09-23 | **Taste Skill 简体中文版** —— 中文项目可参考 |
| ⑤ | `gtmvalley/Leonxlnx-taste-skill` | 7 | 未查 | — | `Leonxlnx/taste-skill` 的镜像 |
| ⑥ | `Leonxlnx/taste-blocks` | 7 | 未查 | — | 同作者的 V2 组件注册表 |

① 领先第二名 **245 倍**，无歧义。

补充判定：名字直译就是「Taste Skill」，与作者口述**完全一致**；描述是 "gives your AI good taste. stops the AI from generating boring, generic slop"，正是「设计品味/审美」；官方站点 `tasteskill.dev`；是 `wilwaldon/Claude-Code-Frontend-Design-Toolkit` 里 Design Skills 章节正式收录的 "Taste Skill" 条目。**无歧义。**

### SKILL.md 核心内容摘要（1,206 行）

```yaml
name: design-taste-frontend
description: Anti-slop frontend skill for landing pages, portfolios, and redesigns.
  The agent reads the brief, infers the right design direction, and ships interfaces
  that do not look templated. Real design systems when applicable, audit-first on
  redesigns, strict pre-flight check.
```

它到底教了什么：

1. **§0 BRIEF INFERENCE —— 先读空气**：动代码前先读 6 类信号（页面类型 / 气质词 / 参考信号 / 受众 / 已有品牌资产 / 隐性约束），产出**一行 Design Read**：

   > *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Tailwind utilities + Geist + restrained motion."*

   模糊时**只准问一个问题**，绝不一次抛一堆问题。

2. **Anti-Default Discipline**：明确点名 LLM 默认审美是垃圾——**AI 紫渐变、深色 mesh 上的居中 hero、三张等宽卡片、到处 glassmorphism、无限循环微动效、Inter + slate-900**。要有意识地绕开。
3. **§1 THE THREE DIALS（三个旋钮）**——这是它最有辨识度的设计：
   - `DESIGN_VARIANCE: 8`（1 完美对称 → 10 艺术混沌）
   - `MOTION_INTENSITY: 6`（1 静止 → 10 电影级/物理）
   - `VISUAL_DENSITY: 4`（1 画廊 → 10 座舱）

   基线 `8 / 6 / 4`，并给出「设计读数 → 旋钮值」的推断表和 10 个 use-case 预设表。**"trust-first / public-sector / regulated / accessibility-critical" 对应 `3 / 2 / 5`——低方差、极低动效、高密度。本项目（银行）正落在这个格子里。**
4. **§2 BRIEF → DESIGN SYSTEM MAP**：不自己造轮子 —— Microsoft 系上 Fluent，Google 系上 `material/web`，IBM 系上 Carbon，Shopify 上 Polaris。
5. 子技能 15 个：`brandkit` / `brutalist-skill` / `minimalist-skill` / `soft-skill` / `redesign-skill` / `stitch-skill` / `image-to-code-skill` / 三个 imagegen 前端参考板生成。

---

## 1.4 落选候选对照表（同样是实测值）

| repo | ★ | License | push | 为什么不是它 |
|---|---|---|---|---|
| `senlindesign/taste-skill` | 369 | **无 license** | 2026-07-07 | 同名但量级差 245 倍，无许可证 |
| `nextlevelbuilder/ui-ux-pro-max-skill` | 131,072 | MIT | 2026-09-27 | 名字对不上（作者说的是 taste，不是 ui-ux-pro-max） |
| `kylezantos/design-motion-principles` | 1,148 | MIT | 2026-05-30 | 动效审计向，但名字对不上 |
| `freshtechbro/claudedesignskills` | 942 | MIT | 2025-11-20 | 23 个动画库技能合集，名字对不上 |
| `anthropics/skills` | 178,700 | **无 license** | 2026-09-24 | 官方技能库，但里面没有叫这几个名字的 |
| `obra/superpowers` | 292,239 | MIT | 2026-09-27 | 软件工程方法论框架，与设计无关 |
| `h3nryprod01/design-taste` | 59 | 未查 | 2026-09-25 | **是上面三个的合成版**——反过来印证了三者同族 |

---

## 1.5 拉取结果

全部用 `git -c http.sslBackend=openssl clone --depth 1`（绕开本机 schannel 问题），**6/6 成功**。（`huashu-skills` 第一次 clone 遇到一次 TLS 网络抖动，重试后成功。）

```
bk-agent/vendor/
├── gsap/                          # greensock/GSAP @ 13e2b79  (v3.15.0)   7.6 MB
└── skills/
    ├── huashu-design/             # alchaincyf/huashu-design @ 0830494   62.0 MB  ← 「花shushu 的 design」
    ├── huashu-skills/             # alchaincyf/huashu-skills @ 2efea35   34.9 MB  ← 花叔 53 个 skill 的总目录
    ├── impeccable/                # pbakaus/impeccable      @ 9d715cc   71.7 MB
    ├── taste-skill/               # Leonxlnx/taste-skill    @ ce26fc2    9.1 MB
    └── emilkowalski-skills/       # emilkowalski/skills     @ d16ebe6    0.4 MB
```

| 仓库 | 总大小 | 其中 .git | commit |
|---|---|---|---|
| impeccable | 71.7 MB | 6.6 MB | `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` |
| huashu-design | 62.0 MB | 30.2 MB | `0830494ecb1c117e25b313a8114fe55a6bf2b125` |
| huashu-skills | 34.9 MB | 17.2 MB | `2efea35738efa06abbfa9acaee923fcef0732a14` |
| taste-skill | 9.1 MB | 4.4 MB | `ce26fc25c0e5e8cab638f883de62d9a86ee5e45b` |
| gsap | 7.6 MB | 1.6 MB | `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2` |
| emilkowalski-skills | 0.4 MB | 0.1 MB | `d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128` |
| **合计** | **约 186 MB** | **约 60 MB** | |

> ⚠️ **三个运维提醒（本次未擅自改动，请作者决策）**
>
> 1. `bk-agent/.gitignore` 目前**没有** `vendor/` 这一条。若直接提交，这 186 MB 会全部进仓库。建议加一行 `vendor/`（或在确实要留档时加 `vendor/**/.git/` 只剔掉嵌套仓库）。
> 2. 嵌套的 `.git/` 目录会让 git 把每个 vendor 子目录视为内嵌仓库；若只想要"可读的参考资料"而不要版本历史，删掉 6 个 `.git/` 可直接省下 60 MB。
> 3. **如果嫌大**：`huashu-skills`（34.9 MB，其中 30 MB 是 `assets/hero.gif` 等演示图）和 `impeccable`（71.7 MB，绝大部分是 Rust crate 与测试夹具）都可以只保留关键 `.md`。真正需要通读的是 `huashu-design`、`taste-skill`、`emilkowalski-skills` 三个纯 markdown 库（合计 71.5 MB，其中 `.git` 占 34.7 MB）。

---

## 1.6 License 与使用边界（**重要**）

| 仓库 | License | 能否把代码复制进 `src/`？ | 说明 |
|---|---|---|---|
| `alchaincyf/huashu-design` | **MIT** | ✅ 可以（保留版权与许可声明） | 但它是**中文 markdown 技能文档**，本质是"设计方法论"，没有前端代码可抄 |
| `pbakaus/impeccable` | **Apache-2.0** | ✅ 可以（保留 NOTICE） | 它自带 Rust 引擎和 CLI，是**工具链**；我们只把它当方法论参考，不装 |
| `Leonxlnx/taste-skill` | **MIT** | ✅ 可以 | 纯 markdown 技能，无运行时代码 |
| `alchaincyf/huashu-skills` | **MIT** | ✅ 可以 | 花叔系 skill 总目录 |
| `emilkowalski/skills` | **MIT** | ✅ 可以 | 纯 markdown 技能 |
| `Hayatelin/taste-skill-zh-CN`（未克隆） | NOASSERTION | ⚠️ license 字段未识别，用前先看仓库里的 LICENSE | Taste Skill 中文版，**未拉取**，仅登记 |
| `greensock/GSAP` | **「Standard No Charge License」（专有，非 OSI）** | ⚠️ 见 §2.3 | 免费，但**不是开源许可证** |

**统一口径（写进团队共识）**：

> `vendor/` 下的所有内容都是**参考素材，不是依赖**，不进构建、不进 `src/`。
> 我们**只借鉴思路**（设计判断、时长/缓动取值、决策门、避坑清单），**不整段搬运代码**。
> 若将来确实要复制某个 MIT/Apache 片段，必须在该文件头注明来源 repo + commit + license。

---

# 第 2 部分 · GSAP

## 2.1 拉取与版本

| 字段 | 实测值 |
|---|---|
| repo 全名 | `greensock/GSAP` |
| URL | https://github.com/greensock/GSAP |
| Star | **28,671** |
| Fork | 2,218 |
| 创建时间 | 2012-09-21T18:03:25Z |
| 最近 push | **2026-04-13T13:08:58Z** |
| 默认分支 | `master` |
| 本地克隆 commit | `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2`（2026-04-13，tag message = `3.15.0`） |
| `package.json` version | **3.15.0** |
| 位置 | `bk-agent/vendor/gsap/` |

---

## 2.2 License 到底是什么（**实测，非记忆**）

### 2.2.1 仓库里**没有** LICENSE.md 文件

`gh api repos/greensock/GSAP/contents --jq '.[].name'` 返回的根目录完整清单：

```
.gitignore
README.md
SECURITY.md
dist
esm
package.json
src
types
```

**没有 LICENSE / LICENSE.md / COPYING。** 因此 `gh api repos/greensock/GSAP` 的 `license` 字段返回 **`null`**（GitHub 无法识别 SPDX），仓库的 license 元数据是空的。

### 2.2.2 许可证声明在 `package.json` 与官网

`vendor/gsap/package.json`：

```json
"license": "Standard 'no charge' license: https://gsap.com/standard-license."
```

### 2.2.3 官网 https://gsap.com/standard-license/ 原文要点（实测抓取）

页面顶部横幅：**"GSAP is now free for everyone, thanks to Webflow's support!"**

Plain English Summary（原文）：

- 你可以在商业或非商业的应用、网站、游戏、组件和其他软件中**免费使用**这些代码，**只要终端用户不被收取任何形式的费用**来使用你的产品，或获取产品的任何部分。
- **如果客户付你一次性费用来做这个站点/产品，完全没问题**，符合 "no charge" 许可。
- **如果终端用户被收取使用/访问/许可费**，需要订阅 "Business" Club GSAP 会员（含完整商业许可）。
- 风险自负，不提供任何担保。请尊重版权。

正式条款（I–VI）要点：

- **II. 授权**：Webflow 授予你**非独占、全球范围**的许可，用于 **Permitted Uses**。
- **III. 限制**：不得用于 **Prohibited Uses**（做那种让用户**无代码搭建可视化动画**、与 Webflow 的可视化动效能力竞争的工具）；不得为制造 Competitive Product 而反向工程；不得移除或修改专有声明/品牌标识。
- **IV. 所有权**：所有 IP（版权、专利、商标、商业秘密）归 **Webflow** 所有，本许可**不转让任何所有权**。
- **V. 终止**：Webflow 可自行决定终止许可并撤销访问权。
- **VI. 修改权**：Webflow 保留随时更新许可条款的权利。

### 2.2.4 2025 年的授权变更（实测）

`https://gsap.com/blog/3-13/`（2025-04-29，Jack Doyle & Cassie Evans 署名）：

> **GSAP is now 100% FREE!** Thanks to Webflow, GSAP is now 100% FREE including **ALL of the bonus plugins like SplitText, MorphSVG, and all the others** that were exclusively available to Club GSAP members. That's right – **the entire GSAP toolset is FREE, even for commercial use!**

同文说明：所有 bonus 插件已并入主 GitHub 仓库与公共 npm 包；Club GSAP 会员制取消；私有 npm registry 于 2025-06-01 停用。

---

## 2.3 参赛项目能不能直接用？—— **可以，但必须标注为专有许可**

| 问题 | 结论 |
|---|---|
| 能不能在参赛项目里直接用？ | **能。** 参赛作品不向终端用户收取使用费/访问费/许可费，符合 "no charge" 条款的字面要求 |
| 需要付钱吗？ | 不需要 |
| 是不是开源许可证？ | **不是。** 是 Webflow 的免费但专有许可（freeware / source-available），**不是 OSI 认可的开源许可** |
| 有没有版税 / 分成要求？ | 没有 |
| 有什么红线？ | ① 终端用户不得被收费；② 不得做与 Webflow 竞争的可视化动效搭建工具；③ 不得移除版权声明；④ 权利人为 Webflow，可单方面终止；⑤ 无担保 |
| 参赛材料的写法建议 | 若比赛要求列"开源依赖清单"，应写：`GSAP 3.15 (Webflow Standard No Charge License, 非 OSI 开源，免费商用)`，**不要写成 MIT** |

> **本项目最终决策：不引入 GSAP。** 理由见 §2.8。以上结论仅作为"如果非要用"的合规依据存档。

---

## 2.4 免费版覆盖哪些插件？—— **全部**

实测 `vendor/gsap/dist/` 目录，官方发布的插件共 **24 个**（全部包含在免费许可内）：

| 类别 | 插件 |
|---|---|
| 滚动 | `ScrollTrigger`、`ScrollSmoother`、`ScrollTo` |
| SVG | `DrawSVGPlugin`、`MorphSVGPlugin`、`MotionPathPlugin`、`MotionPathHelper` |
| UI / 交互 | `Flip`、`Draggable`、`InertiaPlugin`、`Observer` |
| 文字 | `SplitText`、`ScrambleTextPlugin`、`TextPlugin` |
| 缓动 | `CustomEase`、`EasePack`（RoughEase/SlowMo/ExpoScaleEase）、`CustomWiggle`、`CustomBounce` |
| 物理 | `Physics2DPlugin`、`PhysicsPropsPlugin` |
| 渲染器 / 工具 | `CSSRulePlugin`、`PixiPlugin`、`EaselPlugin`、`GSDevTools` |

**关键点**：`SplitText`（文字逐字/逐词/逐行拆分，做 stagger 文本动画的核心）和 `MorphSVGPlugin`（路径变形）过去是 Club 会员专属（年费 99 美元起），2025-04-29 起免费。这一点必须写清楚，因为"GSAP 的免费版不含高级插件"是 2025 年之前的旧知识。

---

## 2.5 从源码读出的「动效编排」方法论

以下全部来自 `vendor/gsap/src/gsap-core.js` 逐行阅读，标注了行号。

### 2.5.1 默认值体系（L14–21, L1092）

```js
_defaults = { duration: .5, overwrite: false, delay: 0 }
_defaults.ease = _easeMap["quad.out"];   // ← 全局默认缓动 = power1.out
```

- **默认 duration = 0.5s**（比 UI 该有的 150–300ms 长一倍——GSAP 的默认值是给"展示型动画"的，UI 里必须显式覆盖）。
- **默认 ease = `power1.out`（即 quad.out，`1-(1-p)²`）**——注意"默认就是 out"，这与 §3.3 的 UI 缓动原则一致。
- `defaults` 沿父链继承（L158–167：`while (parent) { func(vars, parent.vars.defaults); parent = parent.parent }`）——**嵌套 timeline 的默认值会逐层向下传递**，这是"一次声明，全场生效"的实现机制。

### 2.5.2 position 参数 —— timeline 编排的语法核心（L390–414）

`_parsePosition(animation, position, percentAnimation)` 的完整语义：

| 写法 | 源码行为 | 含义 |
|---|---|---|
| 省略 | `return clippedDuration`（= `animation._dur`） | 追加到**当前 timeline 末尾**（不是"最后一个子动画的末尾"，是整条 timeline 的时长） |
| `1.5` | `return +position` | 绝对时间 1.5s |
| `+=0.2` | `i = indexOf("=")`，`offset = parseFloat(charAt(i-1) + substr(i+1))` → `clippedDuration + 0.2` | timeline 末尾 **+0.2s** |
| `-=0.2` | 同上，offset = −0.2 | timeline 末尾 **−0.2s**（制造重叠） |
| `<` | `(offset === "<" ? recent._start : ...) + 0` | **与上一个子动画同时开始**（recent = 最近添加的那个） |
| `>` | `recent.endTime(...)` | 上一个子动画**结束时**开始 |
| `<0.5` | `recent._start + 0.5` | 上一个开始后 0.5s |
| `label` | `labels[position]` | 跳到 label |
| `label+=0.3` | `_parsePosition(animation, "label") + 0.3` | label 偏移 |
| `50%` | `isPercent → * totalDuration() / 100` | 按百分比定位 |

**方法论提炼**：GSAP 的编排能力全部来自「**每个子动画有一个相对于父时间轴的绝对起点，而起点可以用 6 种相对语法表达**」。没有 timeline 对象，你只是在手算这些数字。

### 2.5.3 stagger —— 内部其实被展开成嵌套 timeline（L2121–2122）

源码注释原文：

> *"when a stagger (or function-based duration/delay) is on a Tween instance, we create a nested timeline"*

即 `stagger` 不是一种特殊动画，而是**语法糖：把一次 tween 展开成 N 个子 tween，每个有自己的 delay**。

### 2.5.4 stagger 的分布算法 `distribute()`（L452–506）

配置对象：`{ each, amount, from, ease, grid, axis, base, length }`

```js
// 1) 算出每个元素到 from 原点的距离
x = (j % wrapAt) - originX;  y = originY - ((j / wrapAt) | 0);
distances[j] = !axis ? sqrt(x*x + y*y)              // 默认：欧氏距离（二维扩散）
             : Math.abs(axis === "y" ? y : x);      // axis: "x" / "y" 只按单轴

// 2) 归一化到 [0,1]
l = (distances[i] - distances.min) / distances.max

// 3) 映射成时长
return base + (ease ? ease(l) : l) * distances.v
```

- `from` 可以是 `0`（默认，从第一个）、数字索引、`center`（=0.5）、`edges`（=0.5 且 v 取负，从两端向中间）、`end`（=1）、`random`，或 `[x, y]` 比例坐标。
- `each: 0.05` → 相邻元素间隔 0.05s，总跨度 `0.05 × (n-1)`；`amount: 0.5` → **总跨度恒为 0.5s**（人多时会自动变密）。
- `grid: [列数, 行数]` 打开二维网格扩散；`grid: "auto"` 用 `getBoundingClientRect().left` 自动判断换行点（L477–482）。
- `ease` 作用在**归一化距离**上，所以 `ease: "power2.in"` 会让靠近原点的元素几乎同时启动、外侧元素拉开。

### 2.5.5 ease 体系（L1066–1092）

```js
_forEachName("Linear,Quad,Cubic,Quart,Quint,Strong", (name, i) => {
  let power = i < 5 ? i + 1 : i;
  _insertEase(name + ",Power" + (power - 1),
    i ? p => p ** power : p => p,                            // easeIn
    p => 1 - (1 - p) ** power,                               // easeOut
    p => p < .5 ? (p*2)**power/2 : 1 - ((1-p)*2)**power/2);  // easeInOut
});
```

**命名对照（重要）**：

| GSAP 别名 | 数学名 | 幂次 |
|---|---|---|
| `Linear` = `Power0` = `none` | Linear | 1 |
| `Quad` = `Power1` | Quadratic | 2 ← **默认** |
| `Cubic` = `Power2` | Cubic | 3 |
| `Quart` = `Power3` | Quartic | 4 |
| `Quint` = `Power4` = `Strong` | Quintic | 5 |

其他缓动的源码公式（可 1:1 复刻）：

| ease | 源码（easeIn 形式） |
|---|---|
| `sine` | `p => p === 1 ? 1 : -cos(p * PI/2) + 1` |
| `expo` | `p => 2**(10*(p-1)) * p + p**6 * (1-p)`（blended，保证精确落到 1） |
| `circ` | `p => -(sqrt(1 - p*p) - 1)` |
| `back` | `overshoot = 1.70158`；out: `p => p ? ((--p)*p*((s+1)*p + s) + 1) : 0` |
| `elastic` | `p1 = max(amplitude,1)`；`p2 = (period ?? .3)/(amplitude<1?amplitude:1)`；`p3 = p2/(2PI)*asin(1/p1)`；out: `p => p===1 ? 1 : p1 * 2**(-10p) * sin((p - p3) * (2PI/p2)) + 1` |
| `bounce` | `n=7.5625, c=2.75`，标准四段抛体公式（L1072–1078） |
| `steps(n)` | `p => ((steps+1) * clamp(0, 1-ε, p) \| 0) * (1/steps)` |

**加权缓动**（`EasePack` L18–23）：`power2.inOut(0.8)` 这种写法会把曲线整体推向 out：

```js
ease.config = ratio => { const y = 0.5 + ratio / 2; return p => ease(2*(1-p)*p*y + p*p); };
```

### 2.5.6 反向播放与嵌套

| 能力 | GSAP | 源码位置 |
|---|---|---|
| 反向 | `tl.reverse()` / `tl.timeScale(-1)` / `tween.reversed(true)` | `_ts`（timeScale）驱动，`_parentToChildTotalTime` 里 `child._ts >= 0 ? 0 : totalDuration()` 做镜像（L245） |
| 往复 | `repeat: -1, yoyo: true, yoyoEase` | `_elapsedCycleDuration` / `_animationCycle`（L239–244） |
| 嵌套 | `tl.add(childTl, position)` | `_addToTimeline`（L287）；子 timeline 的 defaults 向下继承（L158） |
| 变速 | `tl.timeScale(2)` | 全局播放速率 |
| 跳转 | `tl.seek(t)` / `tl.tweenTo(label)` / `tl.tweenFromTo(a,b)` | L1841–1865 |

---

## 2.6 对照表：**用原生 CSS / WAAPI 实现 GSAP 那套编排逻辑**

> 本表是本次调研的**核心产出**。左列是 GSAP 写法，右列是等价的原生实现。

### 2.6.1 编排层（结构）

| GSAP | 原生 CSS | 原生 WAAPI | 说明 |
|---|---|---|---|
| `gsap.timeline()` | 一组共享 `animation-delay` 的 `\@keyframes`；或给父元素一个 `--t0` 基准变量 | `const anims = els.map(el => el.animate(kf, opt))` 一次性全部创建，靠各自的 `delay` 对齐时间轴 | 两者都是**声明式时间轴**：所有动画同时注册，起点用 delay 表达 |
| `tl.to(el, {...})`（默认位置） | 追加到**当前累计时长**末尾 | `delay = cursor; cursor += duration` | 需要一个"游标"变量 |
| `position: "+=0.2"` | `delay: calc(var(--cursor) + 200ms)` | `delay = cursor + 200` | 相对 timeline 末尾 |
| `position: "-=0.2"` | 同上，减 200ms | `delay = cursor - 200` | 制造重叠 |
| `position: "<"` | 与上一个**同一 `animation-delay`** | `delay = prevDelay` | 同时开始 |
| `position: ">"` | 上一个的 delay + duration | `delay = prevDelay + prevDuration` | 顺次衔接 |
| `position: "label"` | 定义一个 `--l-s2: 3000ms` 令牌，多处引用 | `const L = { s1: 0, s2: 3000 }` | 命名锚点 |
| `tl.add(nestedTl, pos)` | 嵌套无关：CSS 没有时间轴层级，**全部拉平成一个绝对时间** | `delay = parentOffset + childOffset` | 嵌套只是"加一次偏移" |
| `defaults: { duration, ease }` | `animation-duration` / `animation-timing-function` 写在共享选择器上 | `const DEFAULTS = { duration: 300, easing: EASE_OUT }` 再 spread | 项目已用此法（见 `tokens.css`） |
| `tl.timeScale(2)` | 无直接等价；改 `animation-duration` | `anims.forEach(a => a.playbackRate = 2)` | |
| `tl.reverse()` | `animation-direction: reverse` | `a.reverse()` 或 `a.playbackRate = -1` | |
| `repeat: -1, yoyo: true` | `animation-iteration-count: infinite; animation-direction: alternate` | `{ iterations: Infinity, direction: 'alternate' }` | |
| `tl.seek(t)` / `paused: true` | `animation-play-state: paused; animation-delay: -<t>`（负 delay = 从中途开始） | `a.pause(); a.currentTime = t*1000` | **负 delay 是 CSS 的 seek 技巧** |
| `tl.progress(0.5)` | `animation-delay: calc(var(--total) * -0.5)` | `a.currentTime = a.effect.getTiming().duration * 0.5` | |
| `onComplete` / `onStart` | `animationend` / `animationstart` 事件 | `a.finished.then(...)` 或 `a.onfinish` | |

### 2.6.2 缓动层（**最常被问的一张表**）

GSAP 的 easing 是解析函数，CSS `cubic-bezier()` 是三次贝塞尔参数式——**两者数学形式不同，除线性外都无法严格相等**。下表给出行业标准近似（easings.net 的规范取值），以及**精确复刻方案**。

| GSAP ease | 数学定义 | CSS cubic-bezier() 近似 | 精确复刻 |
|---|---|---|---|
| `none` / `linear` / `Power0` | `p` | `linear` | ✅ 严格相等 |
| `power1.out`（Quad，**GSAP 默认**） | `1-(1-p)²` | `cubic-bezier(.5, 1, .89, 1)` | 近似 |
| `power1.inOut` | quad inOut | `cubic-bezier(.45, 0, .55, 1)` | 近似 |
| `power2.out`（Cubic） | `1-(1-p)³` | `cubic-bezier(.33, 1, .68, 1)` | 近似 |
| `power2.inOut` | cubic inOut | `cubic-bezier(.65, 0, .35, 1)` | 近似 |
| `power3.out`（Quart） | `1-(1-p)⁴` | `cubic-bezier(.25, 1, .5, 1)` ← **本项目已有 `--ease-out-quart`** | 近似 |
| `power3.inOut` | quart inOut | `cubic-bezier(.76, 0, .24, 1)` | 近似 |
| `power4.out`（Quint/Strong） | `1-(1-p)⁵` | `cubic-bezier(.22, 1, .36, 1)` | 近似 |
| `power4.inOut` | quint inOut | `cubic-bezier(.83, 0, .17, 1)` | 近似 |
| `sine.out` | `1-cos(pπ/2)` | `cubic-bezier(.61, 1, .88, 1)` | 近似 |
| `sine.inOut` | sine inOut | `cubic-bezier(.37, 0, .63, 1)` | 近似 |
| `expo.out` | `1-(2^(10(p-1))·p + p⁶(1-p))` | `cubic-bezier(.16, 1, .3, 1)` | ✅ 见下方 linear() |
| `expo.inOut` | expo inOut | `cubic-bezier(.87, 0, .13, 1)` | 近似 |
| `circ.out` | `√(1-(1-p)²)` | `cubic-bezier(0, .55, .45, 1)` | 近似 |
| `circ.inOut` | circ inOut | `cubic-bezier(.85, 0, .15, 1)` | 近似 |
| `back.out` / `back.out(1.7)` | `easeOutBack, s=1.70158` | `cubic-bezier(.34, 1.56, .64, 1)` | ✅ 见下方 linear() |
| `back.inOut` | | `cubic-bezier(.68, -.6, .32, 1.6)` | 近似 |
| `elastic.out(1, .3)` | 见 §2.5.5 | ❌ **cubic-bezier 无法表达**（多次穿越 1） | ✅ 只能用 linear() |
| `bounce.out` | 四段抛体 | ❌ **cubic-bezier 无法表达** | ✅ 只能用 linear() 或 keyframes |
| `steps(n, immediateStart)` | 阶梯 | `steps(n, start \| end)` | ✅ 一一对应（GSAP 的 `immediateStart: true` 对 CSS 的 `start`） |
| `ease: (p) => ...`（函数 ease） | 任意 | ❌ CSS 不支持 | ✅ 采样后转 linear() |

**`linear()` 是"精确复刻"的关键**：CSS Easing Level 2 的 `linear()` 函数在若干采样点之间线性插值，采样够密时可以逼近任意曲线（含过冲）。

**本项目 `tokens.css` 已经在用这个技巧**（L165–178）：

```css
--ease-spring-critical: linear(0 0%, .019 3%, .067 7%, ...);
--ease-spring-sheet:    linear(0 0%, .034 3%, .115 7%, ...);
```

**下面是我按 GSAP 源码公式现场算出的、可直接粘贴的 `linear()` 值**（20/32 段采样）：

```css
/* GSAP expo.out —— 20 段采样，最大误差 < 0.005 */
--ease-expo-out: linear(0 0%, 0.291 5%, 0.497 10%, 0.643 15%, 0.748 20%, 0.823 25%,
  0.877 30%, 0.916 35%, 0.944 40%, 0.963 45%, 0.977 50%, 0.985 55%, 0.991 60%,
  0.995 65%, 0.997 70%, 0.998 75%, 0.999 80%, 1 85%, 1 90%, 1 95%, 1 100%);

/* GSAP back.out(1.70158) —— 20 段采样，峰值 1.099 在 ~58% 处 */
--ease-back-out: linear(0 0%, 0.219 5%, 0.409 10%, 0.57 15%, 0.706 20%, 0.817 25%,
  0.907 30%, 0.977 35%, 1.029 40%, 1.065 45%, 1.088 50%, 1.098 55%, 1.099 60%,
  1.093 65%, 1.08 70%, 1.064 75%, 1.046 80%, 1.029 85%, 1.014 90%, 1.004 95%, 1 100%);

/* GSAP elastic.out(1, 0.3) —— 32 段采样，过冲到 1.364 后收敛 */
--ease-elastic-out: linear(0 0%, 0.361 3.125%, 0.832 6.25%, 1.2 9.375%, 1.364 12.5%,
  1.336 15.625%, 1.193 18.75%, 1.029 21.875%, 0.912 25%, 0.868 28.125%, 0.889 31.25%,
  0.944 34.375%, 1 37.5%, 1.036 40.625%, 1.047 43.75%, 1.036 46.875%, 1.016 50%,
  0.997 53.125%, 0.986 56.25%, 0.984 59.375%, 0.989 62.5%, 0.996 65.625%, 1.002 68.75%,
  1.005 71.875%, 1.006 75%, 1.004 78.125%, 1.001 81.25%, 0.999 84.375%, 0.998 87.5%,
  0.998 90.625%, 0.999 93.75%, 1 96.875%, 1 100%);
```

需要别的曲线时用这个生成器（直接跑在浏览器 console 或 node 里）：

```js
const toLinear = (f, n = 24) =>
  'linear(' + Array.from({ length: n + 1 }, (_, i) => {
    const p = i / n;
    const v = Math.round(f(p) * 1000) / 1000;
    const pct = Math.round(p * 100000) / 1000;
    return v + ' ' + pct + '%';
  }).join(', ') + ')';

toLinear(p => 1 - (1 - p) ** 3, 24);   // power2.out
```

### 2.6.3 stagger 层

| GSAP | 原生 CSS | 原生 WAAPI |
|---|---|---|
| `stagger: 0.05` | `animation-delay: calc(var(--i) * 50ms)`（在 JSX 里给每个元素 `style={{'--i': i}}`）；**或**列 n 条 `nth-child` 规则（本项目现有做法，见 `app.css` L567–574） | `el.animate(kf, { delay: i * 50 })` |
| `stagger: { amount: 0.5 }` | `animation-delay: calc(var(--i) / var(--n) * 500ms)` | `delay: (i / (n - 1)) * 500` |
| `stagger: { from: "center" }` | 需要按 `--d`（到中心的归一化距离）算：JS 里设 `--d`，CSS 里 `calc(var(--d) * 50ms)` | `delay: Math.abs(i - (n - 1) / 2) * 50` |
| `stagger: { from: "edges" }` | 同上，距离 = `min(i, n-1-i)` | `delay: Math.min(i, n - 1 - i) * 50` |
| `stagger: { grid: [4,3], from: "center" }` | 二维欧氏距离，必须 JS 预计算成 `--d`（CSS 无法读元素位置） | `d = Math.hypot(i % 4 - 1.5, Math.floor(i / 4) - 1)` |
| `stagger: { ease: "power2.in" }` | `animation-delay: calc(50ms * var(--d))`，其中 `--d` 已在 JS 里过一遍 ease | `delay: ease(l) * 50` |
| `stagger` 总跨度 | ⚠️ **本项目已有 house rule：`nth-child(n+8)` 封顶 360ms**（`app.css` L574）——与 impeccable `animate.md` 的 "Cap the total delay" 完全一致 | 同样要封顶 |
| `repeatRefresh` / `yoyoEase` | 无直接等价；`animation-direction: alternate` + 单独一条 `\@keyframes` | `direction: 'alternate'` |

### 2.6.4 属性层

| GSAP 写法 | CSS 原生 | 说明 |
|---|---|---|
| `{ autoAlpha: 1 }` | `opacity: 1; visibility: visible`（配 `transition: opacity .3s, visibility 0s`） | autoAlpha = opacity + visibility 的组合糖 |
| `{ y: 20 }` | `transform: translateY(20px)` | GSAP 的 x/y/scale/rotation 都是 transform 简写 |
| `{ xPercent: 50 }` | `transform: translateX(50%)` | 百分比相对**元素自身尺寸** |
| `{ scale: 0.95, transformOrigin: "top left" }` | `transform: scale(.95); transform-origin: top left` | |
| `{ duration: .4, ease: "power2.out" }` | `transition: transform 400ms cubic-bezier(.33,1,.68,1)` | |
| `{ backgroundColor: "#fff" }` | `transition: background-color` | ⚠️ 颜色动画**不走 GPU**，慎用 |
| `{ clipPath: "inset(0 100% 0 0)" }` | `transition: clip-path` | 合规的第 4 个属性（Emil Kowalski 明确认可） |
| `SplitText`（拆字） | CSS 做不到，必须 JS 拆 `span` | 但**中文按字拆分 + 逐字 stagger 通常过密**，本项目不建议 |

---

## 2.7 可粘贴的原生实现样板

### 2.7.1 WAAPI 版 timeline（含 position 语义）

```js
/**
 * 用 WAAPI 复刻 GSAP timeline 的 position 语义。
 * 只需要一个"游标"，其余全是算术。
 */
export function timeline(steps, { playbackRate = 1 } = {}) {
  const animes = new Map();          // name -> Animation
  const labels = new Map();          // label -> ms(绝对)
  let cursor = 0, prev = null;       // prev = 上一个步骤的 { start, dur }

  const resolve = (pos) => {
    if (pos == null)          return cursor;                 // 默认：追加到末尾
    if (typeof pos === 'number') return pos * 1000;          // 绝对秒
    if (pos === '<')          return prev ? prev.start : 0;  // 与上一个同时开始
    if (pos === '>')          return prev ? prev.start + prev.dur : cursor; // 上一个结束后
    if (pos.startsWith('<'))  return (prev ? prev.start : 0) + parseFloat(pos.slice(1)) * 1000;
    if (pos.startsWith('>'))  return (prev ? prev.start + prev.dur : cursor) + parseFloat(pos.slice(1)) * 1000;
    if (pos.startsWith('+=')) return cursor + parseFloat(pos.slice(2)) * 1000;
    if (pos.startsWith('-=')) return cursor - parseFloat(pos.slice(2)) * 1000;
    if (labels.has(pos))      return labels.get(pos);
    return cursor;
  };

  for (const s of steps) {
    if (s.label) { labels.set(s.label, resolve(s.at)); continue; }
    const start = resolve(s.at);
    const a = s.el.animate(s.keyframes, {
      duration: s.duration ?? 300,
      delay: Math.max(0, start),
      easing: s.ease ?? 'cubic-bezier(.32,.72,0,1)',
      fill: 'both',
    });
    a.playbackRate = playbackRate;
    if (s.name) animes.set(s.name, a);
    prev = { start, dur: s.duration ?? 300 };
    cursor = Math.max(cursor, start + prev.dur);
  }
  return { animes, seek: (t) => animes.forEach(a => { a.pause(); a.currentTime = t * 1000; }) };
}
```

用法（对齐 GSAP 的 `<` / `+=0.2`）：

```js
timeline([
  { el: card,   duration: 350, at: 0, label: 's1',
    keyframes: [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }] },
  { el: title,  duration: 200, at: 's1+=0.08',
    keyframes: [{ opacity: 0 }, { opacity: 1 }] },
  { el: rows,   duration: 250, at: '<',          // 与 title 同时开始
    keyframes: [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }] },
  { el: footer, duration: 200, at: '+=0.1',
    keyframes: [{ opacity: 0 }, { opacity: 1 }] },
]);
```

### 2.7.2 纯 CSS 版（**本项目首选**，零 JS）

```css
/* timeline 的"绝对时间轴"用 animation-delay 表达 */
.stack > * { animation: rise var(--dur-spring-critical) var(--ease-spring-critical) both; }

/* stagger：nth-child，总跨度封顶（house rule） */
.stack > *:nth-child(1)   { animation-delay:  50ms; }
.stack > *:nth-child(2)   { animation-delay:  95ms; }
.stack > *:nth-child(3)   { animation-delay: 140ms; }
.stack > *:nth-child(n+4) { animation-delay: 185ms; }   /* ← 封顶，不随 n 线性增长 */

@keyframes rise { from { opacity: 0; transform: translateY(12px) scale(.99); } }

/* seek / 反向：负 delay + reverse direction */
.seekable { animation-play-state: paused; animation-delay: -300ms; }
.reverse  { animation-direction: reverse; }
```

### 2.7.3 数字滚动（WAAPI / rAF，无需库）

```js
export function countUp(el, to, { ms = 600 } = {}) {
  const t0 = performance.now();
  const easeFn = (t) => 1 - Math.pow(1 - t, 4);   // power3.out
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = (to * easeFn(p)).toFixed(2);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
```

> ⚠️ **注意**：数字滚动必须走 `requestAnimationFrame` + `textContent`，这是唯一不能用纯 CSS 表达的一条（CSS `\@property` + `counter-reset` 方案在 Safari 上仍不稳）。
> **银行场景下建议：余额静止时数字不动，明细行的数字才滚动**——用户正在读的金额不该动（见 §3.2 决策门第 4 条）。

---

## 2.8 本项目**不引入 GSAP** 的理由（对照 AGENTS.md §1 ponytail ultra）

| 阶梯 | 判断 |
|---|---|
| 1. 这东西需要存在吗？ | ❌ 不需要。GSAP 解决的是"复杂的、数据驱动的、可 seek 的动画编排"，本项目是**对话式银行 UI**，动效需求是入场 / 错峰 / hover / 加载态，全部是**声明式状态变化** |
| 4. 原生平台能力覆盖了吗？ | ✅ CSS transition + `\@keyframes` + `linear()` + WAAPI 完全覆盖。§2.6 对照表逐条给出等价写法 |
| 5. 已装依赖能解决吗？ | ✅ 现有 `tokens.css` 已有 5 档时长 + 4 条缓动（含 2 条 `linear()` 真弹簧） |
| 6. 能一行写完吗？ | ✅ 入场动画现已是 `animation: rise var(--dur-spring-critical) var(--ease-spring-critical) both` 一行 |
| 额外理由 | ① GSAP 是**专有许可**，参赛材料列依赖时不好看；② 打进 bundle 约 70 KB（min+gzip 约 28 KB），与"轻量"目标冲突；③ 引进后要额外处理 `prefers-reduced-motion`、React 19 StrictMode 双调用、卸载时 `tl.kill()` |

**结论**：`vendor/gsap/` 是**方法论教材**，不是待引入的依赖。把 §2.6 的对照表当参考手册用。

---

# 第 3 部分 · 界面动效设计方法论

## 3.1 权威来源与硬数据（全部实测抓取）

### 3.1.1 Nielsen 响应时间三阈值（1993，原文）

来源：https://www.nngroup.com/articles/response-times-3-important-limits/
出处：Jakob Nielsen《Usability Engineering》第 5 章

| 阈值 | 原文含义 | 对动效的含义 |
|---|---|---|
| **0.1 秒** | 用户感觉系统**即时**响应，除显示结果外无需任何特殊反馈 | **100ms 以内的反馈不需要动画**——它已经"瞬间"了 |
| **1.0 秒** | 用户的**思路不被打断**，但已能察觉延迟；用户会失去"直接操作数据"的感觉 | **所有 UI 动效必须在 1s 内结束**；理想 < 300ms |
| **10 秒** | 保持用户**注意力**在对话上的极限；更久用户会去干别的 | 超过 10s 必须有确定性进度反馈（百分比），不能只有转圈 |

原文还有一条常被忽略的洞见：

> *"it is also possible for the computer to react so fast that the user cannot keep up with the feedback"*

并因此指出 **UI 动效应当按真实时间（real-time clock）计时，而不是按机器的执行速度计时**。这正是 `prefers-reduced-motion` 和固定 duration 令牌存在的理由。

### 3.1.2 Material Design 3 动效令牌（源码实测值）

来源：`androidx/androidx` 仓库 `compose/material3/.../tokens/MotionTokens.kt`（v0_103，GENERATED CODE）

**时长令牌（毫秒）**

| 令牌 | 值 | 令牌 | 值 |
|---|---|---|---|
| `DurationExtraLong1` | 700 | `DurationMedium1` | 250 |
| `DurationExtraLong2` | 800 | `DurationMedium2` | 300 |
| `DurationExtraLong3` | 900 | `DurationMedium3` | 350 |
| `DurationExtraLong4` | 1000 | `DurationMedium4` | 400 |
| `DurationLong1` | 450 | `DurationShort1` | 50 |
| `DurationLong2` | 500 | `DurationShort2` | 100 |
| `DurationLong3` | 550 | `DurationShort3` | 150 |
| `DurationLong4` | 600 | `DurationShort4` | 200 |

**缓动令牌**

| 令牌 | cubic-bezier | 用途 |
|---|---|---|
| `EasingLinear` | `cubic-bezier(0, 0, 1, 1)` | 匀速（进度、循环） |
| `EasingStandard` | `cubic-bezier(0.2, 0, 0, 1)` | **默认**。元素在屏幕内移动/形变 |
| `EasingStandardDecelerate` | `cubic-bezier(0, 0, 0, 1)` | **入场** |
| `EasingStandardAccelerate` | `cubic-bezier(0.3, 0, 1, 1)` | **出场** |
| `EasingEmphasized` | `cubic-bezier(0.2, 0, 0, 1)` | **重点动效**（大范围、需要"有意图"感） |
| `EasingEmphasizedDecelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | 重点入场 |
| `EasingEmphasizedAccelerate` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | 重点出场 |
| `EasingLegacy` | `cubic-bezier(0.4, 0, 0.2, 1)` | M2 遗留 |

**M3 的用法规则**：短时长配小位移、长时长配大位移（`Short4` 200ms 用于小范围状态变化，`Long2` 500ms 用于全屏转场）；**Emphasized 只给需要"被看见"的动效**。

### 3.1.3 Apple HIG Motion（要点）

来源：https://developer.apple.com/design/human-interface-guidelines/motion（页面需 JS 渲染，要点据公开指南与 WWDC 设计讲座整理）

- **动效的目的**：传达状态变化、提供反馈、帮助人们**理解空间关系**（东西从哪来、到哪去）。**不是装饰**。
- **熟悉与可预测**：动效应与人们对物理世界的直觉一致；不要让用户对一个"每天看 20 次"的转场感到意外。
- **可中断（interruptible）**：手势驱动的动效必须能被用户中途改变方向，并从**当前状态**接管，而不是跳回起点。
- **减少动态（Reduce Motion）**：系统设置开启时，用**交叉溶解 / 淡入淡出**替代位移与缩放——**是"更温和"，不是"全部关掉"**。
- **Apple 的做法**：转场多用**弹簧（spring）**而非固定曲线；带速度的手势交接（如拖拽关闭 sheet）必须**继承手指速度**。

### 3.1.4 Disney 12 原则在 UI 里的映射

| 原原则（1930s 动画） | UI 里的对应 | 本项目是否采用 |
|---|---|---|
| **Squash & Stretch** 挤压拉伸 | 几乎不用（UI 元素不该变形）；**仅**用于"活的"元素（按钮按下 `scale(.96)`） | ✅ 极克制地用 |
| **Anticipation** 预备动作 | 下拉菜单展开前的轻微反向位移；hold-to-confirm 的填充 | ⚠️ 只在破坏性操作上 |
| **Staging** 舞台调度 | 一次只让一个东西动；用 `--scrim` 压暗背景突出浮层 | ✅ **高频使用** |
| **Straight ahead / Pose to pose** | CSS `transition`（连 pose-to-pose，中断可接管）对 `\@keyframes`（straight ahead，不可中断） | ✅ 见 §3.2 |
| **Follow through & Overlapping** 跟随与重叠 | **列表错峰（stagger）**；父子元素先后到达 | ✅ **高频使用** |
| **Slow in slow out** 缓入缓出 | `cubic-bezier` / `linear()` | ✅ 每处都用 |
| **Arc** 弧线 | 元素沿直线移动在 UI 里是**对的**（网格对齐）；弧线留给光标 / 浮动装饰 | ❌ 本项目不用（银行要"稳"） |
| **Secondary action** 次要动作 | 主操作发生时，旁边的小元素做微弱响应 | ⚠️ 慎用，容易变噪音 |
| **Timing** 时间节奏 | §3.3 的时长表 | ✅ **核心** |
| **Exaggeration** 夸张 | 只在营销页；产品 UI 里 = 过冲 / 弹跳 | ❌ 本项目禁用 |
| **Solid drawing** 立体感 | `transform` 的 3D 空间一致性；`transform-origin` 必须在触发点上 | ✅ 使用 |
| **Appeal** 魅力 | 整体手感；一次"被作者精心设计过的时刻" | ✅ 每屏最多一个 |

### 3.1.5 四份技能文档的交叉印证

| 结论 | huashu-design | impeccable | emilkowalski/skills | taste-skill |
|---|---|---|---|---|
| **"不该动就不动"是首要输出** | §0.3「克制」：全片只有一处 120% 精致 | "Decoration without purpose is animation debt" | "The gate exists to produce zero lines of code sometimes. That's a success" | §0.D 反对"到处无限循环的微动效" |
| **入场用 ease-out，禁止 ease-in** | 默认 `expo.out`（等价 ease-out） | "Use natural deceleration such as `cubic-bezier(0.16, 1, 0.3, 1)` for confident arrivals" | **"Never `ease-in` on UI"**……"`ease-out` at 200ms *feels* faster than `ease-in` at 200ms" | §1 motion dial 越高越要克制 |
| **时长上限** | 五段结构总时长按叙事定 | 100–150 / 150–300 / 300–500 / 500–800 四档 | **"UI animations stay under 300ms"** | — |
| **列表错峰** | `stagger: 0.03`（S3 过程段） | "Sibling stagger is appropriate when a list appears as a list. **Cap the total delay**" | "Everything entering at once → 30–80ms stagger" | — |
| **per-element 时长表** | — | ✅ 见 §3.3 | ✅ 见 §3.3 | — |
| **reduced motion 是交付物的一部分** | — | "Every web animation needs a `prefers-reduced-motion` path… Reduced motion means fewer and gentler animations, not disabling all motion" | "Reduced motion and hover gating **ship with the animation**, not as a follow-up" | — |
| **高频操作不配动效** | — | "Keep routine transitions fast and do not make users wait through page-load choreography" | "100+ times/day → **No animation. Ever.** Keyboard-initiated actions are a disqualifier, not a judgment call" | — |
| **`scale(0)` 是错的** | — | — | "**Never `scale(0)`.** Start from `scale(0.9–0.97)` + `opacity: 0`. Nothing in the real world appears from nothing" | — |
| **transform-origin 在触发点** | — | — | "Popovers/dropdowns/tooltips scale from their trigger... **Modals are exempt**" | — |

---

## 3.2 决策门：**什么该动、什么不该动**

这是本次调研里**最该抄下来贴墙上**的一张表。四道门，**顺序不可颠倒**，任何一条不通过就**不写代码**。

### 门 1 · 频率 —— 用户一天会看到几次？

| 频率 | 判决 |
|---|---|
| **100+ 次/天**（键盘快捷键、命令面板开合、核心导航切换） | ❌ **永不动效。到此为止。** 键盘触发的操作是**取消资格**，不是判断题 |
| **几十次/天**（hover、列表导航、频繁开关） | ❌ 拒绝，或只允许**几乎不可感知**的快速微动效 |
| **偶尔**（弹窗、抽屉、Toast、设置项） | ✅ 标准动效 |
| **罕见 / 首次**（引导、空状态、成功、庆祝） | ✅ **"惊喜预算"只花在这里** |

> 本项目映射：**发送按钮 hover、侧栏项切换、Tab 切换 → 门 1 拒绝或极弱；转账成功、首次进入、余额刷新 → 门 1 通过。**

### 门 2 · 目的 —— 用这六个词之一命名，说不出就拒绝

| 目的 | 定义 | 本项目例子 |
|---|---|---|
| **Feedback** 反馈 | 确认界面听到了用户 | 按钮 `:active { scale(.96) }` |
| **Spatial consistency** 空间一致性 | 表明东西从哪来、到哪去 | Toast 从底部进、从底部出 |
| **State indication** 状态指示 | 让状态变化可读 | 输入框聚焦描边、余额数字更新 |
| **Preventing a jarring change** 防跳变 | 桥接本来会"瞬移"的内容 | 新消息入场、抽屉展开 |
| **Explanation** 解释 | 演示功能怎么用（**仅**营销/引导） | — |
| **Delight** 愉悦 | **仅在门 1 的"罕见/首次"档** | 首次开通成功 |

**"看起来酷"不在这个列表上。** 一个高频元素上的"看起来酷"= 阻断。

### 门 3 · 速度 —— 能不能待在预算内？

如果这个动效**只有做慢了才好看**，直接拒绝。预算表见 §3.3。

### 门 4 · 功能 —— 这里是帮忙还是添乱？

> **用户正在"读"或"操作"的数据，不应该为了风格而移动。**
> ——`find-animation-opportunities` 原文：*"A decorative mouse-tracking effect is fine on a marketing page; on a functional graph in a banking app, no animation is better."*

**对银行产品的直接推论**：

- ❌ **余额主数字不做持续动效**（用户盯着它算钱）
- ❌ **不做鼠标跟随光晕 / 视差**（营销页专属）
- ❌ **不做自动轮播的图表**（用户在读数据）
- ⚠️ 金额**变化时**可以滚动一次（600ms，`--ease-out-quart`），但**静止时绝不呼吸/脉冲**
- ✅ 加载/生成中的状态指示必须保留（`prefers-reduced-motion` 下也保留——"reduced motion means gentler, not none"）

### 额外：明确**不该动**的清单

| 不该动 | 为什么 |
|---|---|
| 键盘快捷键 / 命令面板开合 | 门 1：100+ 次/天 |
| 页面首次加载的全屏编排 | "do not make users wait through page-load choreography" |
| 高频列表的新增/删除（逐条） | 用 CSS transition 做位置过渡，不要每条都播动画 |
| 用户正在阅读的正文、图表、金额 | 门 4 |
| `transition: all` | 会动画到意料之外的属性，且常掉出 GPU |
| `transform: scale(0)` 的入场 | "Nothing in the real world appears from nothing" |
| 任何 `ease-in` 的 UI 交互 | 延迟了用户最关注的那一刻 |
| 自动播放的循环动效（未离屏暂停） | 持续消耗 CPU/电量，且是噪音 |
| hover 动效（未包 `\@media (hover: hover)`） | 触屏点按会触发假 hover |

---

## 3.3 时长与缓动怎么选

### 3.3.1 时长——三份权威来源的对照（取交集即安全区）

| 元素 | emilkowalski/skills | impeccable `animate.md` | M3 令牌 | **本项目建议** |
|---|---|---|---|---|
| 按压反馈 | 100–160ms | 100–150ms | `Short2` = 100ms | **100ms**（`--duration-instant`） |
| Tooltip / 小浮层 | 125–200ms | 150–300ms | `Short3/4` = 150/200ms | **150–200ms** |
| 下拉 / 选择器 | 150–250ms | 150–300ms | `Short4` = 200ms | **200ms**（`--duration-fast`） |
| 常规状态变化 | ≤300ms | 150–300ms | `Medium1` = 250ms | **200–300ms** |
| 弹窗 / 抽屉 | 200–500ms | 300–500ms | `Long1/2` = 450/500ms | **350–450ms**（`--dur-spring-sheet` 400ms / `--duration-slow` 450ms） |
| 布局 / 视图转场 | — | 300–500ms | `Long2/3` = 500/550ms | **300–450ms** |
| 特意设计的焦点入场 | — | 500–800ms | `ExtraLong1/2` = 700/800ms | **≤600ms，一屏最多用一次** |
| 退场 | **比进场快** | Exit faster than entrance | — | **`--duration-exit` = 260ms**（项目已有） |

> **硬规则（三源一致）**：**UI 动效一律 < 300ms**，超过 300ms 必须能说出理由。

### 3.3.2 缓动——决策顺序表

| 场景 | 用什么 | 理由 |
|---|---|---|
| **入场 / 出场** | `ease-out` 类 | 快速起步、柔和停住 = "落得稳" |
| **屏幕内移动 / 形变** | `ease-in-out` 类 | 对称运动 |
| **hover / 颜色变化** | `ease`（默认） | 幅度小，曲线不重要 |
| **持续运动**（进度条、循环） | `linear` | 有节奏的匀速才不像"卡" |
| **手势驱动 / 可中断** | 弹簧，或 `cubic-bezier(.32,.72,0,1)` | 要能从中途接管 |
| **❌ 永远不要** | `ease-in` 用在 UI 交互上 | 起步慢，恰好延迟了用户最关注的那一刻 |

**内置 CSS 缓动太弱**，必须用自定义曲线。四份来源给出的"strong ease-out"几乎一致：

| 来源 | 曲线 |
|---|---|
| emilkowalski | `cubic-bezier(0.23, 1, 0.32, 1)`（UI 强 ease-out） |
| emilkowalski | `cubic-bezier(0.77, 0, 0.175, 1)`（屏幕内移动的强 ease-in-out） |
| emilkowalski | `cubic-bezier(0.32, 0.72, 0, 1)`（iOS 抽屉曲线） |
| impeccable | `cubic-bezier(0.16, 1, 0.3, 1)`（自信的到达） |
| M3 | `cubic-bezier(0.05, 0.7, 0.1, 1)`（emphasized decelerate） |

> **本项目现状**：`--ease-out: cubic-bezier(.23,1,.32,1)` 与 emilkowalski 的推荐**逐位相同**；`--ease-spring: cubic-bezier(.32,.72,0,1)` 就是 iOS 抽屉曲线。**已经是对的了。**

### 3.3.3 弹簧 / 过冲的使用边界

| 允许过冲 | 不允许过冲 |
|---|---|
| 拖拽释放、手势带速度 | 无速度来源的自动动效 |
| 元素"归位"（物理在起作用） | 数据更新、状态切换 |
| 首次引导 / 成功庆祝 | 高频交互 |
| 拖拽关闭 sheet | 银行的核心操作流程 |

**本项目 `tokens.css` 的 house rule 已经完全正确**：

> *"house rule：只在手势带速度时才允许过冲。"*

且项目里有两条按阻尼谐振子数值积分生成的 `linear()` 弹簧：

- `--ease-spring-critical`（350ms）：**不过冲**，收敛干净 → 用于常规入场
- `--ease-spring-sheet`（400ms）：**轻微过冲到 1.015** → 用于 sheet / 面板

---

## 3.4 如何避免「为了动而动」

### 3.4.1 huashu-design 的"品味识别法"（最有操作性）

不看规则，看**观众的第一反应**：

| 观众反应 | 评级 | 诊断 |
|---|---|---|
| "看起来挺流畅的" | good | 合格但无特色，你在做 PowerPoint |
| "这个动画真顺" | good+ | 技术对了，但没惊艳 |
| "这个东西看起来真的像**从桌面上浮起来的**" | great | 触到了物理重量感 |
| "这不像是 AI 做的" | great+ | 触到了 Anthropic 的门槛 |
| "我想**截图**发朋友圈" | great++ | 观众主动传播 |

> *"great 和 good 的区别，不在于技术正确度，在于品味判断。技术正确 + 品味对 = great。技术正确 + 品味空 = good。"*

### 3.4.2 五条可执行的戒律

1. **"这个动画删掉会怎样？"** —— 答不出"会变差"就删。埃米尔技能包的 `Remedial Preference Hierarchy` 第 1 条就是 **Delete the animation**；不确定时最强的动作往往是删掉。
2. **一屏只花一次惊喜预算。** huashu §0.3：「全片只有一处 120% 精致，其余 80% 恰到好处——**到处炫技是廉价的信号**」。
3. **先写"动作目的"再写代码。** 说不出门 2 的六个词之一，就不写。
4. **必须有"静止帧"。** 均匀节奏 = 技术演示；有节奏才是叙事。huashu 的 Slow-Fast-Boom-Stop（15/15/40/20/10%）本质是"允许不动"。
5. **`prefers-reduced-motion` 的降级路径要和动画一起交付**，不是"以后补"。降级 = 去掉位移与缩放、保留透明度与颜色。

### 3.4.3 交付前的自检表

| # | 卡点 |
|---|---|
| 1 | 每个动效都能说出**门 2 的六个目的之一** |
| 2 | 高频（100+/天、键盘触发）元素**没有**动效 |
| 3 | **没有一处** `ease-in` 用在 UI 交互上 |
| 4 | 每个 UI 动效 **< 300ms**（超过的能说出理由） |
| 5 | **没有** `scale(0)` 入场；浮层的 `transform-origin` 在触发点上（弹窗除外） |
| 6 | 只动 `transform` / `opacity`（+ 认可的 `clip-path`）；无 `width/height/top/left/margin` |
| 7 | 高频触发的（Toast/开关）用 **transition 而非 keyframes**（可中断、可重定向） |
| 8 | `prefers-reduced-motion` 有降级；`:hover` 动效包在 `\@media (hover: hover) and (pointer: fine)` 里 |
| 9 | 进场/退场**走同一条路径**；退场**比进场快** |
| 10 | 整屏一起入场 → 改成 **30–80ms 错峰**，且**总延迟封顶** |

---

## 3.5 本项目动效清单

> ⏱ **时效性说明**：本节的行号引用基于 2026-09-28 02:0x 时点的 `src/styles/app.css`（约 600 行）。该文件在本报告撰写期间正被其他工作并行修改（已成文时约 800 行），**行号可能漂移，请按选择器名而非行号定位**。令牌名与结论不受影响。

> 下表**全部复用 `src/styles/tokens.css` 已有令牌**，不新增依赖、不新增令牌（ponytail 阶梯 2：仓库里已经有了吗 → 复用）。
> 现有令牌：`--duration-instant 100ms` / `--duration-fast 200ms` / `--duration-base 300ms` / `--duration-slow 450ms` / `--duration-exit 260ms`；
> `--ease-spring cubic-bezier(.32,.72,0,1)` / `--ease-out-quart cubic-bezier(.25,1,.5,1)` / `--ease-out cubic-bezier(.23,1,.32,1)`；
> `--ease-spring-critical`（linear()，350ms）/ `--ease-spring-sheet`（linear()，400ms）。

### 3.5.1 入场（Enter）

| 场景 | 时长 | 缓动 | 触发条件 | 实现现状 |
|---|---|---|---|---|
| **消息 / 对话轮入场** | 350ms | `--ease-spring-critical` | 新一轮 `role` 渲染进列表 | **已有**（`app.css` L106） |
| **A2UI 卡片面（surface）入场** | 400ms | `--ease-spring-sheet` | agent 推送的新 surface 渲染完成 | **已有**（L560） |
| **页面主面板入场** | 350ms | `--ease-spring-critical` | 切换顶栏 Tab 后 | **已有**（L595–599） |
| **余额 Hero 卡片入场** | 400ms | `--ease-spring-sheet` | 视图首次挂载 | **已有**（L600） |
| **Toast 入场** | 200ms | `--ease-out` | 操作产生结果通知 | 🔧 **待做**：`translateY(8px) → 0` + opacity；**用 transition 不用 keyframes**（可被连续触发重定向） |
| **浮层 / 弹窗出现** | 300ms | `--ease-out` | `<dialog>` / ConfirmDialog / TransferDialog 打开 | 🔧 **待做**：`scale(.96) + opacity 0 → none + 1`；**`transform-origin: center`（弹窗是豁免项）** |
| **抽屉展开（HistoryDrawer）** | 400ms | `--ease-spring-sheet` | 点击历史按钮 | **已有**（L529） |
| **数字滚动（余额/金额变化）** | 600ms | `cubic-bezier(.25,1,.5,1)`（= `--ease-out-quart`） | **仅当金额数值发生变化时**；首次挂载不滚 | 🔧 **待做**（见 §3.5.4） |

### 3.5.2 列表错峰（Stagger）

| 场景 | 步长 | 上限 | 缓动 | 触发条件 | 现状 |
|---|---|---|---|---|---|
| **A2UI 卡片列 / 行** | **45ms** | **≤360ms 总延迟** | `--ease-spring-critical` | surface 的 `children` 首次渲染 | **已有**（`app.css` L567–574，n+8 封顶 360ms） |
| **页面面板组** | **50ms** | **≤190ms 总延迟** | `--ease-spring-critical` | 视图挂载 | **已有**（L596–599，4 个封顶） |
| **银行目录 / 收件人列表** | **30ms** | **≤240ms** | `--ease-out-quart` | 列表**首次**渲染（**不是**每次筛选；筛选走位置过渡） | 🔧 **待做** |
| **通用原则** | 30–80ms | 总延迟封顶 | — | — | 三源一致 |

> ⚠️ **本项目已有的两处错峰都符合规范**（45ms 步长 + n+8 封顶 360ms；50ms 步长 + 4 个封顶 190ms）。**不要改**，只需在新增列表时沿用同一模式。

### 3.5.3 hover 微交互（Micro-interaction）

| 场景 | 时长 | 缓动 | 触发条件 | 现状 |
|---|---|---|---|---|
| **图标按钮 hover** | 200ms | `--ease-spring` 位移 + `--ease-out` 背景 | hover 能力设备 | **已有**（L90） |
| **图标按钮按下** | **100ms** | 继承 | `:active` | **已有** `scale(.94)`（L93） |
| **交互卡片 hover 抬升** | 300ms | `--ease-spring` | 同上 | **已有**（L166） |
| **交互卡片按下** | **100ms** | 继承 | `:active` | **已有** `scale(.97)`（L169） |
| **按钮 hover / active** | 300 / **100ms** | `--ease-spring` / 继承 | 同上 | **已有**（L187–189） |
| **发送按钮按下** | **100ms** | 继承 | `:active:not(:disabled)` | **已有** `scale(.92)`（L234） |
| **Tab / 分段控件指示器滑动** | 200ms | `--ease-out-quart` | 切换选中项 | 🔧 **待做**：对指示器做 `transform: translateX(...)`（位置过渡，**不是**淡出淡入） |
| **输入框聚焦** | 200ms | `--ease-out` | `:focus-visible` | **已有**（L178） |

> ⚠️ **提醒**：所有 `:hover` 触发的位移/缩放必须包在 `\@media (hover: hover) and (pointer: fine)` 内——触屏设备在点按时会触发假 hover，导致"点一下闪一下"。**当前 `app.css` 尚未加这层包裹，是本次调研识别出的可改进项之一。**

### 3.5.4 数字滚动（Number Roll）

| 项 | 建议 |
|---|---|
| **触发条件** | **仅当数值发生变化时**（余额刷新、转账后）。首次挂载不滚——用户需要立刻读到准确数字 |
| **时长** | **600ms**（首次挂载若必须滚，用 400ms） |
| **缓动** | `cubic-bezier(.25,1,.5,1)` = `--ease-out-quart`（强 ease-out，末段几乎不动，便于读数） |
| **位移方向** | 只做**淡入 + 数字插值**，**不做**数字上下位移（银行场景要稳） |
| **实现** | `requestAnimationFrame` 写 `textContent`（见 §2.7.3）；**不要**用 CSS `\@property` + `counter-reset`（Safari 不稳） |
| **禁止** | 静止时的呼吸 / 脉冲 / 每秒闪烁；对**正在被阅读的**余额主数字做持续动效 |
| **无障碍** | `prefers-reduced-motion: reduce` 时直接跳到终值（不做插值）；数字容器用 `aria-live="polite"`（AGENTS.md §3 已要求流式内容用 aria-live） |

### 3.5.5 页面 / 视图转场（Page Transition）

| 场景 | 时长 | 缓动 | 触发条件 | 实现建议 |
|---|---|---|---|---|
| **顶栏 Tab 切换（助手 / 产品视图）** | 出 260ms → 入 300ms | `--ease-spring` | 点击 Tab | **内容淡入 + 6px 上移**；用 `\@starting-style` 或重挂载 key。**不做左右滑动**（银行界面应"稳"，滑动 = 嬉闹） |
| **会话切换** | 300ms | `--ease-spring` | 从历史抽屉选一条会话 | 线程区整体淡入；**滚动位置立刻复位**，不要动画滚动 |
| **弹窗 / 抽屉背后的页面** | 300ms | `--ease-out` | 浮层打开 | 只改 `--scrim` 的 opacity，**页面本体不动**（防晕，也省性能） |
| **滚动锚定** | ❌ **不要动画** | — | 新消息到达时 | **已有** `useThreadScroll.js`：`requestAnimationFrame` 直接设 `scrollTop`，**此处不该动画，现状正确** |
| **View Transitions API** | — | — | — | ⚠️ **本项目不采用**：跨浏览器支持仍不稳，且与"轻量、无依赖"目标冲突 |

### 3.5.6 加载态（Loading）

| 场景 | 时长 / 周期 | 缓动 | 触发条件 | 实现 |
|---|---|---|---|---|
| **"生成中"指示（agent 思考）** | 1200ms 周期，`infinite` | `ease-in-out` | 请求发出 → 首个 token 到达 | 🔧 **待做**：三点脉冲 / 文字呼吸。**`prefers-reduced-motion` 下保留静态指示（不能消失）** |
| **按钮内联 loading** | 转圈 800ms `linear` `infinite` | `linear` | 提交后、结果回来前 | 🔧 **待做**：按钮 `disabled` + 转圈；**宽度不跳变**（避免布局抖动） |
| **骨架屏（skeleton）** | 1500ms 周期 `linear` `infinite` | `linear` | 数据源已知结构、>400ms 才返回 | 🔧 **待做**：微光扫过。**比转圈好**（保留布局，减少跳动） |
| **长任务进度（>10s）** | — | — | 超过 **10 秒**（Nielsen 上限） | **必须换成确定性进度条/百分比**，不能只有转圈 |
| **离屏 / 后台标签页** | — | — | 页面不可见 | **暂停所有非必要循环**（`document.hidden` / IntersectionObserver）——"Any nonessential loop must stop when offscreen or hidden" |

### 3.5.7 无障碍降级（随动画一起交付）

```css
/* 项目现状（tokens.css L184–190）—— .01ms 是"全关"式降级，建议细化为"更温和" */
@media (prefers-reduced-motion: reduce) {
  /* 保留：透明度、颜色、状态指示（它们承载语义） */
  /* 去掉：位移、缩放、旋转、过冲 */
  .turn, .a2ui-surface, .a2ui-card, .panel, .balance-hero {
    animation: fade-only 200ms ease both;   /* 只淡入，不动位置 */
  }
  .icon-btn:active, .a2ui-btn:active, .send:active { transform: none; }
}
```

> 三源一致的原则：**"reduced motion means fewer and gentler animations, not disabling all motion"**（impeccable）+ **"keep opacity/color, drop movement"**（emilkowalski）。
> 当前 `tokens.css` 用 `animation-duration: .01ms !important` 把一切都压平，**会把"生成中"指示也一起杀掉**，与 huashu / impeccable 的要求不符。建议后续细化为上面的"只去位移"版本。

---

## 3.6 现状盘点

> ⏱ 同 §3.5 的时效性说明：本节基于报告撰写时读到的 `app.css`。撰写期间该项目正被并行修改，**"缺口"清单请在动手前重新核对一遍当前文件**——其中至少 hover gating 一项可能已被他人补上。

| 类别 | 现状 | 结论 |
|---|---|---|
| 时长令牌 | 5 档（100/200/300/450/260ms） | ✅ 对齐 M3 `Short2 / Short4 / Medium1 / Long1` |
| 缓动令牌 | `--ease-spring` / `--ease-out-quart` / `--ease-out` + 2 条 `linear()` 弹簧 | ✅ **与 emilkowalski 推荐曲线逐位一致**，且已经用上 `linear()` 这个高级技巧 |
| 入场动画 | `rise` / `surface-in` / `item-in` / `sheen` 四个 keyframes | ✅ 齐备 |
| 列表错峰 | 2 处 `nth-child` 延迟，步长 45/50ms，均有封顶 | ✅ 完全符合规范 |
| hover / 按下微交互 | 全覆盖，按下统一 100ms | ✅ 齐备 |
| 滚动锚定 | `requestAnimationFrame` 直设 `scrollTop`，无动画 | ✅ **正确**（此处不该动画） |
| **数字滚动** | ❌ 无 | 🔧 **缺口 1** |
| **页面 / Tab 转场** | ❌ 无（直接切换） | 🔧 **缺口 2** |
| **加载态骨架屏 / "生成中"指示** | ❌ 无 | 🔧 **缺口 3** |
| `\@media (hover: hover)` 包裹 | ❌ 未加 | 🔧 **缺口 4**（触屏假 hover） |
| `prefers-reduced-motion` 粒度 | ⚠️ 全局 `.01ms` 一刀切 | 🔧 **缺口 5**（会误杀"生成中"指示） |
| `vendor/` 是否进 git | ⚠️ `.gitignore` 无此条 | 🔧 **缺口 6**（151 MB，属于仓库运维而非代码） |

---

# 附录

## A. 全部实测数据（`gh api` 原始返回值）

```json
{"archived":false,"created_at":"2026-04-19T14:42:06Z","default_branch":"master","description":"Huashu Design · HTML-native design skill for Claude Code · 高保真原型 / 幻灯片 / 动画 + 20 设计哲学 + 5 维评审 + MP4 导出 · Agent-agnostic","forks_count":2797,"full_name":"alchaincyf/huashu-design","html_url":"https://github.com/alchaincyf/huashu-design","license":"MIT","pushed_at":"2026-09-22T15:52:07Z","size":222671,"stargazers_count":24504}

{"archived":false,"created_at":"2025-11-16T01:52:04Z","default_branch":"main","description":"The design language that makes your AI harness better at design.","forks_count":4348,"full_name":"pbakaus/impeccable","html_url":"https://github.com/pbakaus/impeccable","license":"Apache-2.0","pushed_at":"2026-09-28T02:07:58Z","size":378067,"stargazers_count":71872}

{"archived":false,"created_at":"2026-02-19T21:44:05Z","default_branch":"main","description":"Taste-Skill - gives your AI good taste. stops the AI from generating boring, generic slop","forks_count":6175,"full_name":"Leonxlnx/taste-skill","html_url":"https://github.com/Leonxlnx/taste-skill","license":"MIT","pushed_at":"2026-09-26T09:01:50Z","size":36833,"stargazers_count":90692}

{"archived":false,"created_at":"2026-03-16T13:52:31Z","default_branch":"main","description":"Skills for Designers and Engineers.","forks_count":2368,"full_name":"emilkowalski/skills","html_url":"https://github.com/emilkowalski/skills","license":"MIT","pushed_at":"2026-09-23T23:18:27Z","size":141,"stargazers_count":41537}

{"archived":false,"created_at":"2012-09-21T18:03:25Z","default_branch":"master","description":"GSAP (GreenSock Animation Platform), a JavaScript animation library for the modern web","forks_count":2218,"full_name":"greensock/GSAP","html_url":"https://github.com/greensock/GSAP","license":null,"pushed_at":"2026-04-13T13:08:58Z","size":14456,"stargazers_count":28671}

// 落选候选
{"full_name":"senlindesign/taste-skill","stargazers_count":369,"license":null,"pushed_at":"2026-07-07T08:33:04Z"}
{"full_name":"nextlevelbuilder/ui-ux-pro-max-skill","stargazers_count":131072,"license":"MIT","pushed_at":"2026-09-27T11:30:41Z"}
{"full_name":"kylezantos/design-motion-principles","stargazers_count":1148,"license":"MIT","pushed_at":"2026-05-30T23:17:35Z"}
{"full_name":"freshtechbro/claudedesignskills","stargazers_count":942,"license":"MIT","pushed_at":"2025-11-20T01:58:04Z"}
{"full_name":"anthropics/skills","stargazers_count":178700,"license":null,"pushed_at":"2026-09-24T16:20:39Z"}
{"full_name":"obra/superpowers","stargazers_count":292239,"license":"MIT","pushed_at":"2026-09-27T02:37:47Z"}

// ── 第二轮（更正名重搜，2026-09-28）实测值 ─────────────────────────
// 「花shushu」证据：profile 显示名就是「花叔」
{"login":"alchaincyf","name":"花叔","bio":"AI Native Coder. Ship products without writing code. Author of nuwa-skill · huashu-design · darwin-skill.","followers":10228,"public_repos":87,"created_at":"2023-03-13T04:44:42Z"}
// 「huashushu」三个同名账号，全部 0 仓库空号
{"login":"huashushu","name":null,"bio":null,"public_repos":0,"created_at":"2017-05-24T03:59:36Z"}
{"login":"huashushu1","name":null,"bio":null,"public_repos":0,"created_at":"2019-12-10T13:52:22Z"}
{"login":"huashushu56-hub","name":null,"bio":null,"public_repos":0,"created_at":"2026-01-31T10:12:43Z"}
// search/users?q=花叔 / 花书书 / 花叔叔 → total_count 全部为 0
// search/repositories?q=huashushu → total_count 0
// search/code?q="花shushu" → total_count 0

// 花shushu 候选
{"full_name":"alchaincyf/huashu-design","stargazers_count":24505,"license":"MIT","pushed_at":"2026-09-22T15:52:07Z","created_at":"2026-04-19","size":222671}
{"full_name":"alchaincyf/huashu-skills","stargazers_count":1618,"license":"MIT","pushed_at":"2026-09-22T15:52:24Z","created_at":"2026-01-24","size":17639}
{"full_name":"pc-software-org/huashu-design-en","stargazers_count":25,"license":"MIT","pushed_at":"2026-08-31T10:22:14Z","created_at":"2026-04-27","size":31190}
{"full_name":"ZeroxZhang/huashu-bookwriter","stargazers_count":160,"license":"MIT","pushed_at":"2026-04-12T11:30:45Z","created_at":"2026-04-10","size":4094}

// impeccable 候选（按 star 排序）
{"full_name":"pbakaus/impeccable","stargazers_count":71873,"license":"Apache-2.0","pushed_at":"2026-09-28T02:07:58Z","size":378067}
{"full_name":"ilindaniel/impeccable-lite","stargazers_count":27,"license":"Apache-2.0","pushed_at":"2026-08-01T15:41:27Z","size":9}
{"full_name":"DevvGwardo/impeccable","stargazers_count":12,"license":null,"pushed_at":"2026-05-19T14:18:37Z","size":289}
{"full_name":"h3nryprod01/design-taste","stargazers_count":59,"license":"MIT","pushed_at":"2026-09-25T03:52:28Z","size":119}

// taste skill 候选（按 star 排序）
{"full_name":"Leonxlnx/taste-skill","stargazers_count":90693,"license":"MIT","pushed_at":"2026-09-26T09:01:50Z","size":36833}
{"full_name":"senlindesign/taste-skill","stargazers_count":369,"license":null,"pushed_at":"2026-07-07T08:33:04Z","created_at":"2026-05-24"}
{"full_name":"jaytel0/taste","stargazers_count":303,"license":null,"pushed_at":"2026-08-23T14:06:02Z","created_at":"2026-05-21"}
{"full_name":"Hayatelin/taste-skill-zh-CN","stargazers_count":7,"license":"NOASSERTION","pushed_at":"2026-09-23T04:06:49Z","created_at":"2026-07-30"}

// 其它实测（未克隆，登记备查）
{"full_name":"emilkowalski/skills","stargazers_count":41539,"license":"MIT","pushed_at":"2026-09-23T23:18:27Z"}
{"full_name":"kylezantos/design-motion-principles","stargazers_count":1148,"license":"MIT","pushed_at":"2026-05-30T23:17:35Z"}
```

## B. 复现命令

```powershell
# 元数据
gh api repos/alchaincyf/huashu-design  --jq '{full_name,stargazers_count,license:.license.spdx_id,pushed_at}'
gh api repos/pbakaus/impeccable       --jq '{full_name,stargazers_count,license:.license.spdx_id,pushed_at}'
gh api repos/Leonxlnx/taste-skill     --jq '{full_name,stargazers_count,license:.license.spdx_id,pushed_at}'
gh api repos/emilkowalski/skills      --jq '{full_name,stargazers_count,license:.license.spdx_id,pushed_at}'
gh api repos/greensock/GSAP           --jq '{full_name,stargazers_count,license:.license.spdx_id,pushed_at}'

# 排除 impossible（三条路径，均为空）
gh search repos 'impossible skill'    --limit 20 --json fullName,description,stargazersCount
gh search repos --topic claude-skill --limit 100 --json fullName,description --jq '[.[] | select((.fullName + " " + (.description // "")) | test("imposs"; "i"))]'
gh search code 'impossible' --filename SKILL.md --limit 20 --json repository,path

# 克隆（本机 schannel 有问题，必须带 -c http.sslBackend=openssl）
$B = "C:\Users\Administrator\Desktop\AI\dsh_Try\dsh-try-of-financial\bk-agent\vendor"
git -c http.sslBackend=openssl clone --depth 1 https://github.com/alchaincyf/huashu-design.git "$B\skills\huashu-design"
git -c http.sslBackend=openssl clone --depth 1 https://github.com/pbakaus/impeccable.git      "$B\skills\impeccable"
git -c http.sslBackend=openssl clone --depth 1 https://github.com/Leonxlnx/taste-skill.git    "$B\skills\taste-skill"
git -c http.sslBackend=openssl clone --depth 1 https://github.com/emilkowalski/skills.git     "$B\skills\emilkowalski-skills"
git -c http.sslBackend=openssl clone --depth 1 https://github.com/greensock/GSAP.git          "$B\gsap"
```

## C. 参考链接

| 主题 | 链接 |
|---|---|
| GSAP 标准许可全文 | https://gsap.com/standard-license/ |
| GSAP 3.13「100% 免费」公告 | https://gsap.com/blog/3-13/ |
| GSAP 定价页 | https://gsap.com/pricing/ |
| Webflow 收购与免费公告 | https://webflow.com/blog/gsap-becomes-free |
| CSS-Tricks 报道 | https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/ |
| Material 3 动效令牌规范 | https://m3.material.io/styles/motion/easing-and-duration/tokens-specs |
| M3 令牌源码（本次取值来源） | https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionTokens.kt |
| Apple HIG — Motion | https://developer.apple.com/design/human-interface-guidelines/motion |
| Nielsen 响应时间三阈值 | https://www.nngroup.com/articles/response-times-3-important-limits/ |
| CSS linear() 缓动函数 | https://developer.chrome.com/docs/css-ui/css-linear-easing-function |
| linear() 支持度 | https://caniuse.com/wf-linear-easing |
| Claude Code 前端设计工具全景（本次检索地图） | https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit |

## D. 本次交付的 vendor 清单

| 路径 | 来源 | commit | License |
|---|---|---|---|
| `vendor/gsap/` | greensock/GSAP | `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2` | Webflow Standard No Charge（非开源） |
| `vendor/skills/huashu-skills/` | alchaincyf/huashu-skills | `2efea35738efa06abbfa9acaee923fcef0732a14` | MIT |
| `vendor/skills/huashu-design/` | alchaincyf/huashu-design | `0830494ecb1c117e25b313a8114fe55a6bf2b125` | MIT |
| `vendor/skills/impeccable/` | pbakaus/impeccable | `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` | Apache-2.0 |
| `vendor/skills/taste-skill/` | Leonxlnx/taste-skill | `ce26fc25c0e5e8cab638f883de62d9a86ee5e45b` | MIT |
| `vendor/skills/emilkowalski-skills/` | emilkowalski/skills | `d16ebe60d09a5ba2afcb7054ede9d0a10c9f6128` | MIT |

> **再次重申**：`vendor/` 下全部内容为**参考素材，不是依赖**。未修改 `package.json`，未修改 `src/` 任何文件。
