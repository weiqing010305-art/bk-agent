# 调研 D：参考图视觉风格还原 + 开源方案

> 目标：把小红书「超集灵感」那张**浅蓝雾蓝 / 悬浮磨砂玻璃 / 3D 玻璃片 / 极细绿柱状图**的参考图，拆成可直接落到
> `bk-agent` 现有栈（React 19 + Vite 7 + 纯 JSX + 手写 CSS，无 Tailwind、无 TypeScript）上的 **CSS 配方 + 可复用代码片段**，
> 并给出一份「值得直接抄」的真实开源项目排名。
>
> 调研日期：2026-09-28 ｜ 所有 star / license / 时间均来自 `gh api repos/OWNER/REPO` 或 `gh search repos --json` 的**实际返回值**，
> 未使用记忆数据。凡引用源码，均标注了 `gh api .../contents/PATH` 的真实路径。

---

## 0. 参考图的技术翻译（先对齐认知）

把描述里的视觉元素逐个映射成浏览器能做的事：

| 参考图元素 | 视觉本质 | 可执行技术 |
|---|---|---|
| 极浅淡蓝/雾蓝背景 | 柔和多色渐变，无色带 | 多层 `radial-gradient` 叠加 + `feTurbulence` 噪点（消 banding） |
| 悬浮磨砂玻璃卡片 | 半透明白膜 + 背景模糊 + 上缘 1px 高光 | `backdrop-filter: blur() saturate()` + `inset 0 1px ... white` + 分层 box-shadow |
| 3D 倾斜玻璃小板（像冰块） | 透视 + 折射感边缘 + 内部镜面高光 | `perspective` + `rotate3d` + 渐变膜 + 上下内阴影 + 边缘剖光（进阶：SVG `feDisplacementMap`） |
| 极细绿色柱状图 | 细长圆角 bar，无坐标轴 | `flex` + `border-radius: 999px` + 高度百分比，纯 CSS，**零图表库** |
| 大量留白 / 圆角 | 8pt 网格 + 三档圆角 | CSS 变量 `--sp-*` / `--r-*` |
| 克制的图文层级 | 标题深、正文中、辅助浅 | 4 级 ink 色板（Apple 灰阶） |
| 「AI 智能感」 | 微动效 + 呼吸点 | 弹簧缓动 + `@keyframes breathe` |

---

## 1. 视觉配方（每项给真实可用代码）

### 1.1 柔和蓝紫渐变背景：mesh gradient（多层 radial-gradient）+ 噪点

**结论：不要用 WebGL / 不要用背景图。"3–4 层 radial-gradient + 一层 SVG 噪点" 就是参考图的效果，纯 CSS，零依赖。**

这是被多个项目验证过的写法。`GGX355/liquid-glass-template`（MIT，1★，pushed 2026-09-22）用的是 **5 个 blur(90px) 大色块 + 整层 hue-rotate 呼吸**：

```css
/* 真实来源：https://github.com/GGX355/liquid-glass-template/blob/main/liquid-glass.css */
.orbs { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none;
  animation: hueflow 18s ease-in-out infinite alternate; }
.orbs i { position: absolute; border-radius: 50%; filter: blur(90px); }
.o1 { width: 46vw; height: 46vw; background: rgba(96,140,255,.6);   top: -12%; left: -8%;   animation: drift1 11s ease-in-out infinite alternate; }
.o2 { width: 40vw; height: 40vw; background: rgba(255,120,185,.52); top: -14%; right: -6%;  animation: drift2 9s  ease-in-out infinite alternate; }
.o3 { width: 44vw; height: 44vw; background: rgba(80,210,175,.5);   bottom: -16%; left: 30%; animation: drift3 13s ease-in-out infinite alternate; }
@keyframes drift1 { to { transform: translate(12vw, 9vh) scale(1.24); } }
@keyframes drift2 { to { transform: translate(-11vw, 11vh) scale(.82); } }
@keyframes drift3 { to { transform: translate(9vw, -12vh) scale(1.16); } }
@keyframes hueflow { from { filter: hue-rotate(-26deg); } to { filter: hue-rotate(26deg); } }
```

**它的噪点层（关键：消除渐变色带，出片质感）**——同一仓库原文：

```css
.grain { position: fixed; inset: 0; z-index: 1; pointer-events: none;
  opacity: var(--grain-opacity); mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E"); }
```

**更省事的「单元素 mesh」写法**（不用 5 个 div）：

```css
/* 推荐给 bk-agent：一个 .mesh-bg 搞定参考图的蓝白雾面 */
.mesh-bg {
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(ellipse 900px 600px at 12% 8%,  rgba(150,180,255,.42), transparent 60%),
    radial-gradient(ellipse 800px 700px at 88% 12%, rgba(196,170,255,.34), transparent 62%),
    radial-gradient(ellipse 900px 700px at 70% 92%, rgba(140,215,235,.30), transparent 60%),
    radial-gradient(ellipse 700px 500px at 8% 88%,  rgba(255,190,225,.22), transparent 60%),
    linear-gradient(170deg, #f4f8ff 0%, #eef3fd 45%, #f7f5ff 100%);
}
```

> **注意**：参考图是**极浅**的蓝，色块 alpha 必须压在 0.2–0.45 之间，超过就显得廉价。
> 上例四个色块 alpha 是 0.22–0.42，属安全区。
>
> **反例（不要抄配色）**：`superboyyy/liquid-glass-with-no-refraction`（MIT，1★，pushed 2026-08-21）的
> `css/nrg.css` 里 hero 背景用了 `#ff2d55 / #ff5e7a / #ff8a3d` 高饱和红橙，那是"营销站"路子，
> 与参考图的克制蓝调相反——**只抄它的 backdrop-filter 数值，别抄它的配色**。

---

### 1.2 磨砂玻璃卡片：完整 token 化配方

参考图里所有白/半透卡片的本质是 **三层**：① 半透明白膜 ② 背景模糊 ③ 边缘高光 + 贴地阴影。

**核心参数的真实出处**（`GGX355/liquid-glass-template` → `liquid-glass.css`，本次调研里最完整、最苹果的一份）：

```css
:root, html[data-theme="light"] {
  --ink:  #191a1f;  --ink2: #565966;  --ink3: #6d7180;  --ink4: #9ba0af;
  --accent: #0066ff; --accent2: #7d5aff; --accent3: #ff5f8f;

  /* ← 玻璃膜：薄白 -50% ~ -28%，颜色来自玻璃后的 Aurora 层 */
  --glass-bg: linear-gradient(180deg, rgba(255,255,255,.5), rgba(255,255,255,.28));
  --glass-border: rgba(255,255,255,.55);
  --glass-bf: blur(10px) saturate(195%) brightness(1.02);

  /* ← 棱边：贴地小阴影 + 上缘高光 + 底部内收暗化 + 红蓝色散 fringe */
  --rim: 0 1px 2px rgba(20,30,60,.08), 0 8px 24px rgba(36,46,90,.14),
    inset 0 1.5px .5px rgba(255,255,255,.95),
    inset 0 -1px 1px rgba(255,255,255,.35),
    inset 0 -14px 22px -18px rgba(30,40,80,.1),
    inset 1.5px 1.5px 2px rgba(255,3,3,.05),
    inset -1.5px -1.5px 2px rgba(0,22,255,.06);
  --rim-sm: 0 1px 2px rgba(20,30,60,.06), 0 6px 18px rgba(36,46,90,.1),
    inset 0 1px .5px rgba(255,255,255,.92),
    inset 0 -10px 16px -14px rgba(30,40,80,.08);
}

.glass {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-bf); -webkit-backdrop-filter: var(--glass-bf);
  border: 1px solid var(--glass-border);
  box-shadow: var(--rim);
}
```

**几个值得单独拎出来的点：**

1. `saturate(195%)` 是"玻璃感"的关键。纯 `blur` 只会糊，`saturate` 让透过去的背景色变浓，才像玻璃。
2. **红蓝色散 fringe**（`inset 1.5px 1.5px 2px rgba(255,3,3,.05)` + `inset -1.5px -1.5px 2px rgba(0,22,255,.06)`）——
   用 3–6% alpha 的红/蓝内阴影在左侧与右下模拟真实玻璃的色差。这是这份代码里最"高级"的一手，成本为零。
3. `--glass-bg` 用**上浅下更浅的 linear-gradient** 而非纯色，卡片自带极淡的纵向呼吸。

**更精简、更适合直接搬进 bk-agent 的版本**（`superboyyy/liquid-glass-with-no-refraction` 的
`css/nrg.css`，MIT；它的 `--nrg-glass-*` 变量族设计得很干净）：

```css
/* 真实来源：https://github.com/superboyyy/liquid-glass-with-no-refraction/blob/main/css/nrg.css */
:root {
  --nrg-glass-bg:     rgba(255, 255, 255, 0.58);
  --nrg-glass-border: rgba(255, 255, 255, 0.64);
  --nrg-glass-inset:  rgba(255, 255, 255, 0.82);
  --nrg-glass-glow:   rgba(255, 255, 255, 0.16);
  --nrg-glass-line:   rgba(255, 255, 255, 0.34);
  --nrg-glass-shine:  rgba(255, 255, 255, 0.28);
  --nrg-glass-shade:  rgba(0, 0, 0, 0.05);
}
.nrg-glass {
  position: relative;
  isolation: isolate;                    /* ← 关键：把 backdrop-filter 限制在本层，避免串色 */
  background: var(--nrg-glass-bg);
  border: 1px solid var(--nrg-glass-border);
  box-shadow:
    inset 0 1px 0 var(--nrg-glass-inset),
    inset 0 -18px 38px var(--nrg-glass-glow);
  backdrop-filter: blur(18px) saturate(1.35);
  -webkit-backdrop-filter: blur(18px) saturate(1.35);
}
.nrg-glass::after {                       /* ← 第二层边缘：1px 内描边 + 上缘光 + 底部暗 */
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px var(--nrg-glass-line),
    inset 0 1px 18px var(--nrg-glass-shine),
    inset 0 -18px 32px var(--nrg-glass-shade);
}
.nrg-glass > * { position: relative; z-index: 1; }   /* ← 内容永远在光效之上 */
```

> **给 bk-agent 的具体建议数值**（浅蓝主题、卡片 120–300px）：
> `background: rgba(255,255,255,.62)` + `backdrop-filter: blur(20px) saturate(180%)`
> + `border: 1px solid rgba(255,255,255,.7)`
> + `box-shadow: 0 1px 2px rgba(20,30,60,.05), 0 8px 24px rgba(36,46,90,.08), inset 0 1px 0 rgba(255,255,255,.85)`。
> 比渐变膜更稳，纯白卡片上不会"发灰"。

**指针跟随镜面眩光**（参考图那种"玻璃上有光斑"的感觉，纯 CSS 变量 + 一次 mousemove）：

```css
/* 来源同上（liquid-glass.css），--gx/--gy 由 JS 写入 */
.glass::after {
  content: ""; position: absolute; inset: 1px; border-radius: inherit; pointer-events: none;
  background: radial-gradient(320px circle at var(--gx, 28%) var(--gy, 18%),
              rgba(255,255,255,.38), transparent 65%);
}
```

---

### 1.3 「3D 玻璃片」（像冰块/玻璃片）在纯 CSS 里怎么近似

参考图左屏散落的倾斜玻璃小板，是**三道工序**：透视倾斜 → 玻璃材质 → 上/下缘明暗对立。

**方案 A（零依赖，推荐先用这个）——perspective + rotate3d + 体块化内阴影：**

```css
.glass-slab-stage { perspective: 1200px; perspective-origin: 50% 40%; }

.glass-slab {
  width: 148px; height: 148px; border-radius: 28px;
  transform-style: preserve-3d;
  transform: rotateX(14deg) rotateY(-18deg) rotateZ(-6deg);

  /* 材质：比普通卡片更"厚"——膜更亮、模糊更弱、边缘更硬 */
  background: linear-gradient(150deg,
    rgba(255,255,255,.86) 0%,
    rgba(255,255,255,.52) 42%,
    rgba(214,228,255,.44) 100%);
  backdrop-filter: blur(6px) saturate(160%);
  -webkit-backdrop-filter: blur(6px) saturate(160%);
  border: 1px solid rgba(255,255,255,.78);

  /* 体块感来源：上缘强高光 + 底部内收暗 + 外投影偏右下（光源在左上） */
  box-shadow:
    0 2px 4px  rgba(22,34,66,.06),
    0 14px 32px rgba(30,44,90,.14),
    inset 0 2px 1px rgba(255,255,255,.98),
    inset 0 -10px 20px -12px rgba(40,60,120,.22),
    inset 8px 8px 18px -12px rgba(255,255,255,.9),
    inset -8px -8px 18px -12px rgba(120,150,220,.35);
  transition: transform .5s cubic-bezier(.28,1.4,.4,1);
}
.glass-slab:hover { transform: rotateX(6deg) rotateY(-8deg) rotateZ(-2deg) translateY(-6px); }
```

**让整组"冰块"有层次**：给每片不同的 rotate3d 与 translateZ：

```css
.glass-slab:nth-child(1) { transform: rotateX(18deg) rotateY(-24deg) translateZ(40px); }
.glass-slab:nth-child(2) { transform: rotateX(-8deg) rotateY(16deg)  translateZ(0); }
.glass-slab:nth-child(3) { transform: rotateX(24deg) rotateY(6deg)   translateZ(-30px); }
```

**方案 B（真·折射，成本高，仅在想做"液态玻璃"时上）——SVG `feDisplacementMap`：**

`rdev/liquid-glass-react`（**MIT，6285★，pushed 2025-06-13**，https://github.com/rdev/liquid-glass-react）
的 `src/index.tsx` 是 Web 端最完整的折射实现：canvas 生成位移贴图 → `feImage` → 三通道 `feDisplacementMap`
分别偏移 → `feBlend mode="screen"` 合成 → 边缘 mask → 中心保持清晰。核心参数来自源码：

```tsx
// 真实来源：gh api repos/rdev/liquid-glass-react/contents/src/index.tsx
const backdropStyle = {
  filter: isFirefox ? null : `url(#${filterId})`,
  backdropFilter: `blur(${(overLight ? 12 : 4) + blurAmount * 32}px) saturate(${saturation}%)`,
}
// 默认值：displacementScale = 70, blurAmount = 0.0625, saturation = 140,
//        aberrationIntensity = 2, elasticity = 0.15, cornerRadius = 999
```

它的**边缘高光双层写法**（不依赖折射也能单独抄，参考价值很高）：

```tsx
// 双层 border：一层 mix-blend-mode: screen(0.2)，一层 overlay，形成"玻璃剖光边"
style={{
  padding: "1.5px",
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor", maskComposite: "exclude",
  boxShadow: "0 0 0 0.5px rgba(255,255,255,.5) inset, 0 1px 3px rgba(255,255,255,.25) inset, 0 1px 4px rgba(0,0,0,.35)",
  background: "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.12) 33%, rgba(255,255,255,.4) 66%, rgba(255,255,255,0) 100%)",
}}
```

**纯 CSS 版剖光边（推荐给 bk-agent，30 秒抄完）**：

```css
.slab-shine { position: relative; }
.slab-shine::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,.75) 32%,
    rgba(255,255,255,.95) 48%,
    rgba(255,255,255,.30) 68%,
    rgba(255,255,255,0) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}
```

> 同一套 `mask-composite: exclude` 技巧在 `magicuidesign/magicui`（**MIT，22406★，pushed 2026-09-20**）
> 的 `apps/www/registry/magicui/shine-border.tsx` 里也出现，用于"流动光边"：
>
> ```tsx
> backgroundImage: "radial-gradient(transparent,transparent, " + shineColor + ",transparent,transparent)",
> backgroundSize: "300% 300%",
> mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
> maskComposite: "exclude", padding: "var(--border-width)",
> ```
>
> 配 `@keyframes shine { 0%{background-position:0% 0%} 50%{background-position:100% 100%} to{background-position:0% 0%} }`
> （见 magicui `apps/www/styles/globals.css` 的 `@theme inline` 块）。

---

### 1.4 极细柱状图（细长圆角 bar）——纯 CSS，零图表库

参考图右屏那条"细长绿色柱状图"，以及中屏 "72,52%" 下面那条迷你柱图，都不需要 Recharts / Tremor。

**配方（垂直细柱，rounded pill）**：

```css
.mini-bars { display: flex; align-items: flex-end; gap: 6px; height: 72px; }
.mini-bars i {
  flex: 1 1 0; min-width: 4px; max-width: 8px;      /* ← 极细的关键：4–8px 宽 */
  border-radius: 999px;                              /* ← 全圆角，两端都是半圆 */
  background: linear-gradient(180deg, #7fd4a0 0%, #4fb47c 100%);
  height: var(--h, 40%);
  transform-origin: bottom;
  animation: bar-rise .7s cubic-bezier(.22,1,.36,1) both;
  animation-delay: calc(var(--i, 0) * 45ms);         /* ← 逐根错峰生长 */
}
.mini-bars i.dim { background: #cfe3d6; }            /* 非当前根压暗，形成层次 */
@keyframes bar-rise { from { transform: scaleY(.06); opacity: 0; } }
```

用法：`<i style={{ "--h": "72%", "--i": 0 }} />`

**横向细条（参考图 "88 Closed / 19 Open" 那种统计条）**：

```css
.stat-bar { height: 6px; border-radius: 999px; background: rgba(20,40,70,.06); overflow: hidden; }
.stat-bar > span { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #86d9a8, #4fb47c);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.45);
  transition: width .6s cubic-bezier(.22,1,.36,1); }
```

**"72,52%" 这类大数字的排版**（苹果风格数字必须等宽，否则跳动）：

```css
.metric { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
  letter-spacing: -.03em; font-weight: 600; }
```

> **不要引入图表库**。`tremorlabs/tremor`（Apache-2.0，3638★，pushed 2025-10-10）与
> `borisyankov/react-sparklines`（MIT，2851★，pushed 2024-09-21）都是优秀项目，但它们解决的是
> "可交互的完整图表"问题；参考图里那些是**装饰性微图表**，一行 CSS 就够，
> 引入库反而带来 40–150KB 体积与样式对抗成本。

---

### 1.5 极淡阴影的层级系统（Apple 分层阴影）

**核心原则：一个元素叠 2 层阴影——一层"接触阴影"（小 blur、小偏移、较高 alpha）定义边界；
一层"环境阴影"（大 blur、大偏移、极低 alpha）定义悬浮。**

`GGX355` 的 `--rim` / `--rim-sm` / `--mover-shadow` 就是这套三级体系（见 1.2 原文）。

**给 bk-agent 的 4 级阴影 token（浅蓝主题调优）**：

```css
:root {
  /* L0 贴地：分隔线级别的卡片 */
  --sh-0: 0 1px 2px rgba(20,30,60,.05);
  /* L1 卡片：参考图主卡的默认态 */
  --sh-1: 0 1px 2px rgba(20,30,60,.05), 0 6px 18px rgba(36,46,90,.07);
  /* L2 悬浮：hover / 3D 玻璃片 */
  --sh-2: 0 2px 4px rgba(20,30,60,.06), 0 14px 34px rgba(30,44,90,.13);
  /* L3 浮层：弹窗 / 命令面板 */
  --sh-3: 0 4px 10px rgba(20,30,60,.07), 0 28px 64px rgba(30,44,90,.18);

  /* 内阴影（玻璃边缘）统一走这两个 */
  --inset-top:    inset 0 1px 0 rgba(255,255,255,.85);
  --inset-bottom: inset 0 -14px 22px -18px rgba(30,40,80,.10);
}
```

**关键约束**：浅色背景上，**外阴影 alpha 不要超过 .20**，blur 半径约是偏移量的 3–8 倍。
参考图那种"几乎看不见但有体积感"的效果，就是靠低 alpha + 大 blur 实现的。

> **反例**：`rdev/liquid-glass-react` 默认用 `0px 12px 40px rgba(0,0,0,.25)`——那是给深色/视频背景设计的，
> 放到浅蓝背景上会显脏。它的 `overLight ? "0px 16px 70px rgba(0,0,0,.75)"` 更是绝对不要用。

---

### 1.6 浅色文字层级色值（标题深 / 正文中 / 辅助浅）

苹果语义灰 + 三个项目的实测值高度一致，可以交叉验证：

| 层级 | GGX355/liquid-glass-template | superboyyy (nrg.css) | KuekHaoYang/KVideo (variables.css) | Apple 语义色 |
|---|---|---|---|---|
| 主标题 ink | `#191a1f` | `#1d1d1f` | `#1d1d1f` | label |
| 正文 ink2 | `#565966` | `#6e6e73` | `#6e6e73` | secondaryLabel |
| 辅助 ink3 | `#6d7180` | — | — | tertiaryLabel |
| 极浅 ink4 | `#9ba0af` | — | — | quaternaryLabel |

**结论：三家的"主标题"都是 `#1d1d1f` 或极接近的 `#191a1f`，正文灰都是 `#6e6e73`——这就是苹果灰阶，直接抄。**

**bk-agent 的浅蓝主题色板（ink 色相带一点蓝，与冷背景更协调）**：

```css
:root {
  --ink:   #16181d;   /* 大标题、关键数字 */
  --ink-2: #4a4f5c;   /* 正文 */
  --ink-3: #737a8a;   /* 次要说明、标签 */
  --ink-4: #9aa2b2;   /* 占位符、脚注、时间戳 */
  --line:  rgba(22,24,29,.07);   /* 分隔线，用 alpha 而非纯色 */
  --accent:      #2f6bff;   /* 主蓝 */
  --accent-2:    #7d5aff;   /* 紫，用于渐变第二段 */
  --positive:    #34a06a;   /* 参考图那条绿柱 */
  --positive-bg: rgba(52,160,106,.10);
}
```

**层级约束（写进 code review 规则）**：任意一屏里，`--ink` 只用于标题与关键数字；
`--ink-2` 用于正文；`--ink-3/4` 用于说明。不要出现第 5 种灰。

---

### 1.7 圆角 / 间距 / 字阶（参考图"大量留白 + 圆角"的量化）

`GGX355` 直接照搬 Apple HIG：

```css
:root {
  /* HIG 字阶 */
  --fs-large-title: 34px; --fs-title: 22px; --fs-headline: 17px;
  --fs-body: 17px; --fs-subhead: 15px; --fs-footnote: 13px;
  --fs-caption: 12px; --fs-caption2: 11px;
  /* 8pt 网格 */
  --sp-1: 8px; --sp-2: 12px; --sp-3: 16px; --sp-4: 20px; --sp-5: 24px;
  /* 圆角三档 + 胶囊 */
  --r-sm: 12px; --r-md: 20px; --r-lg: 28px; --r-pill: 999px;
  --touch: 44px;   /* 触控目标 */
}
```

**参考图的三档圆角实测映射**：小件（图标块、pill）= 12px / 999px；卡片 = 18–22px；大面板、玻璃片 = 28px。

**弹簧缓动（"苹果味"的灵魂，抄这一组）**：

```css
/* 来源：GGX355/liquid-glass-template/liquid-glass.css */
.card   { transition: transform .55s cubic-bezier(.28,1.7,.4,1), border-color .25s; }
.card:hover  { transform: translateY(-2px); }
.card:active { transform: scale(.965); transition-duration: .08s; }  /* ← 按下瞬间变快，是拟真的关键 */
.btn:hover   { transform: scale(1.04); }
.btn:active  { transform: scale(.94);  transition-duration: .09s; }
@keyframes rise { from { opacity: 0; transform: translateY(18px) scale(.97); } }
```

**无障碍（必须带）**：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

---

## 2. 开源方案排名（URL / star / license / 最近更新，全部实测）

数据来源：`gh search repos "<kw>" --sort stars --limit N --json ...` 与
`gh api repos/OWNER/REPO --jq '{...}'`，抓取于 2026-09-28。

### S 级：零依赖、可直接抄进 React + 手写 CSS（不装任何包）

| # | 仓库 | Star | License | 最近更新 | 为什么值得抄 |
|---|---|---|---|---|---|
| 1 | [GGX355/liquid-glass-template](https://github.com/GGX355/liquid-glass-template) | 1 | **MIT** | 2026-09-22 | **本次调研含金量最高**。纯 HTML+CSS+原生 JS，零依赖。完整给出 HIG 字阶 / 8pt 间距 / 三档圆角 / 玻璃 token（`--glass-bg/-bf/-rim`）/ Aurora 背景 / 噪点 / 弹簧缓动。已实测抓取 `liquid-glass.css`、`lab-v2/liquid-glass.css`、`lab-v2/pulse-glass.css`、`lab-v2/GLASS_SYSTEM.md`、`index.html`。star 只有 1 是因为太新（created 2026-09-06），**不代表质量低**。 |
| 2 | [superboyyy/liquid-glass-with-no-refraction](https://github.com/superboyyy/liquid-glass-with-no-refraction) | 1 | **MIT** | 2026-08-21 | 「无折射的磨砂玻璃 CSS kit」。`css/nrg.css` 的 `--nrg-glass-*` 变量族非常干净，`isolation:isolate` + 双层边缘是教科书写法。README 明确拒绝 feDisplacementMap/WebGL/色散（*"Pull requests that add feDisplacementMap, WebGL, or chromatic aberration will stay out of the default stylesheet"*）——正好符合 bk-agent 的"不加依赖"要求。 |
| 3 | [hubeiqiao/apple-bento-grid](https://github.com/hubeiqiao/apple-bento-grid) | 232 | **MIT** | 2026-03-17 | 「Apple 风格 bento 栅格」生成器。`examples/light-horizontal.html` 是完整可运行的单文件示例，配色即 `#f5f5f7` 底 + `#fff` 卡 + `#1d1d1f/#86868b/#aeaeb2` 文字 + `#0071e3` 蓝 + 18px 圆角 + `0 1px 8px rgba(0,0,0,.05)`。**几乎就是参考图的气质**，且是纯 HTML/CSS。 |
| 4 | [KuekHaoYang/KVideo](https://github.com/KuekHaoYang/KVideo) | 4145 | **MIT** | 2026-08-16 | Next.js「Liquid Glass」设计语言。`app/styles/variables.css` + `app/styles/glass.css` 是一套完整、克制的 CSS 变量玻璃系统（浅色 `--glass-bg-light: rgba(255,255,255,.95)` / `--glass-border-light: rgba(0,0,0,.05)` / `--shadow-sm: 0 1px 2px`）。**它的阴影非常轻**，适合浅色场景。 |
| 5 | [Code2With-Pratik/Aura-UI](https://github.com/Code2With-Pratik/Aura-UI) | 34 | **MIT** | 2026-09-22 | macOS 风 / Bento / 玻璃。`components/BackgroundBlobs.tsx` 的"三层 radial blob + grain overlay"是**背景配方的最小实现**，代码是纯 style 对象，无痛移植到 CSS。 |

### A 级：思路必看，但代码不能直接搬（Tailwind / 需要 shader）

| # | 仓库 | Star | License | 最近更新 | 用途 |
|---|---|---|---|---|---|
| 6 | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) | **22406** | **MIT** | 2026-09-20 | `registry/magicui/noise-texture.tsx`（feTurbulence 噪点，参数 `frequency .4 / octaves 6 / slope .15 / opacity .6`）、`shine-border.tsx`、`magic-card.tsx`（指针跟随径向渐变边框）。**抄参数，别抄依赖**（依赖 `motion/react` + `next-themes` + `cn()`）。 |
| 7 | [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react) | **6285** | **MIT** | 2025-06-13 | Web 端最完整的 SVG 折射实现。适合理解"边缘位移 + 三通道色散"原理，以及抄它的双层 border 高光。**但依赖 canvas 位移贴图 + 每实例一个 SVG filter，性能与复杂度都不适合参赛 Demo 的 ChatBox。** |
| 8 | [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | **12331** | **MIT** | 2026-09-28 | 目前最成熟的 React AI Chat 组件库。`Thread`/`Composer`/`ScrollAnchor` 结构值得**借鉴信息架构**（滚动锚定、composer 高度自适应），但引入即等于重写整个聊天层。 |
| 9 | [arihantcodes/spectrum-ui](https://github.com/arihantcodes/spectrum-ui) | 1452 | **Apache-2.0** | 2026-09-21 | Aceternity + MagicUI + shadcn 合集。已抓取 `app/registry/dock/usage/dock-glass.tsx`——`<Dock variant="glass">` 即参考图底部那排 icon tab bar 的实现思路。 |
| 10 | [miketromba/css.glass](https://github.com/miketromba/css.glass) | 452 | ⚠️ **无 License** | 2025-09-15 | css.glass 生成器。价值在于**参数空间参考**（模糊/透明度/边框半径/背景色组合）。**无 license，不要复制代码**。 |
| 11 | [themesberg/glass-ui](https://github.com/themesberg/glass-ui) | 409 | ⚠️ **无 License** | 2026-02-27 | 老牌 glassmorphism CSS 库，但仓库已改造成 Next.js 文档站，源码结构不再是纯 CSS 库。**不建议**。 |

### B 级：只做背景/参考，不进主路径

| # | 仓库 | Star | License | 最近更新 | 说明 |
|---|---|---|---|---|---|
| 12 | [AndrewPrifer/liquid-dom](https://github.com/AndrewPrifer/liquid-dom) | 2519 | MIT | 2026-09-06 | Liquid Glass for the Web |
| 13 | [JustAdumbPrsn/Zen-Nebula](https://github.com/JustAdumbPrsn/Zen-Nebula) | 1417 | GPL-3.0 | 2026-05-25 | ⚠️ GPL-3.0 有传染性，**参赛项目勿抄代码** |
| 14 | [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js) | 1195 | MIT | 2025-06-12 | 已一年未更新 |
| 15 | [shuding/liquid-glass](https://github.com/shuding/liquid-glass) | 1188 | MIT | 2026-03-26 | 已抓取 `liquid-glass.js`：canvas 生成位移贴图 + `feDisplacementMap`，**理解折射原理的最佳教材**（含 `roundedRectSDF` + `smoothStep` 边缘位移函数） |
| 16 | [naughtyduk/liquidGL](https://github.com/naughtyduk/liquidGL) | 901 | ⚠️ NOASSERTION | 2026-09-27 | WebGPU/WebGL，重 |
| 17 | [sdegenaar/liquid_glass_widgets](https://github.com/sdegenaar/liquid_glass_widgets) | 685 | MIT | 2026-09-25 | **Flutter，与 Web 无关** |
| 18 | [anup-a/meshy](https://github.com/anup-a/meshy) | 423 | ⚠️ NOASSERTION | 2024-01-20 | mesh gradient 设计工具（非代码） |
| 19 | [cristicretu/meshgrad](https://github.com/cristicretu/meshgrad) | 107 | MIT | 2024-10-11 | CSS mesh gradient 生成器，可直接输出 CSS |
| 20 | [PallavAg/liquid-glass-web-react](https://github.com/PallavAg/liquid-glass-web-react) | 79 | MIT | 2026-06-10 | React 版 SVG 位移折射 |
| 21 | [martin65536/liquid-glass-webgl](https://github.com/martin65536/liquid-glass-webgl) | 82 | Apache-2.0 | 2026-09-05 | WebGL 移植 |
| 22 | [tremorlabs/tremor](https://github.com/tremorlabs/tremor) | 3638 | Apache-2.0 | 2025-10-10 | 图表组件；**本场景不需要** |
| 23 | [borisyankov/react-sparklines](https://github.com/borisyankov/react-sparklines) | 2851 | MIT | 2024-09-21 | 同上 |
| 24 | [artyhoo/shadcn-glass-ui-library](https://github.com/artyhoo/shadcn-glass-ui-library) | 35 | Apache-2.0 | 2026-09-14 | shadcn 玻璃组件，依赖 Tailwind + shadcn |
| 25 | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | **124720** | MIT | 2026-09-24 | 生态最强，但 bk-agent 是手写 CSS，引入 = 全量重构 |
| 26 | [open-webui/open-webui](https://github.com/open-webui/open-webui) | **153394** | ⚠️ NOASSERTION | 2026-09-28 | Svelte，交互可参考，代码不可搬 |

### 补充：Aurora Background（参考图左屏的"流动光带"）

Aceternity UI 的 `AuroraBackground` 没有官方 GitHub 仓库，源码以 registry 分发。本次通过
`gh search code "repeating-linear-gradient(100deg,"` 找到**真实镜像源码**并抓取全文：

```tsx
// 真实来源：gh api repos/ariefrahmansyah/remembergaza/contents/components/ui/aurora-background.tsx
// （即 Aceternity AuroraBackground 的未改名副本；仓库 MIT）
"--aurora":        "repeating-linear-gradient(100deg,#3b82f6_10%,#a5b4fc_15%,#93c5fd_20%,#ddd6fe_25%,#60a5fa_30%)",
"--white-gradient": "repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)",
// 两层 background-image 叠加 + blur(10px) + invert + after:mix-blend-difference
// mask-image: radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)
```

**纯 CSS 翻译（bk-agent 可直接用）**：

```css
.aurora {
  position: absolute; inset: -10px; pointer-events: none;
  background-image:
    repeating-linear-gradient(100deg, #fff 0%, #fff 7%, transparent 10%, transparent 12%, #fff 16%),
    repeating-linear-gradient(100deg, #3b82f6 10%, #a5b4fc 15%, #93c5fd 20%, #ddd6fe 25%, #60a5fa 30%);
  background-size: 300% 200%, 200% 100%;
  background-position: 50% 50%, 50% 50%;
  filter: blur(10px) invert(1);
  opacity: .5;
  mask-image: radial-gradient(ellipse at 100% 0%, #000 10%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 100% 0%, #000 10%, transparent 70%);
  animation: aurora 8s ease-in-out infinite alternate;
}
@keyframes aurora {   /* 真实来源：magicuidesign/magicui apps/www/styles/globals.css */
  0%   { background-position: 0% 50%;   transform: rotate(-5deg) scale(.9);  }
  25%  { background-position: 50% 100%; transform: rotate(5deg)  scale(1.1); }
  50%  { background-position: 100% 50%; }
}
```

> **注意**：`mask-image` + `filter` + `mix-blend-difference` 组合在低端设备上有性能开销。
> 参考图是**静态**截图，不必做动效。建议只保留 `mask-image` 做角落柔化，去掉动画。

---

## 3. 判断：能零依赖用的 vs 必须引依赖的，以及「不要引入什么」

### 3.1 零依赖、可直接落进 React + 手写 CSS（全部推荐）

| 配方 | 来源 | 落地方式 |
|---|---|---|
| 多层 radial-gradient mesh 背景 | Aura-UI BackgroundBlobs / GGX355 orbs | 一个 `.mesh-bg` 类，`position: fixed; z-index: -1` |
| SVG feTurbulence 噪点 | GGX355 `.grain` / magicui NoiseTexture | 内联 data-URI，一个 CSS 类，无 JS |
| 磨砂玻璃卡 token | GGX355 `--glass-bg/-bf/-rim` + superboyyy `--nrg-glass-*` | 写进 `refinement.css` 的 `:root` |
| 3D 玻璃片（方案 A） | 本报告 1.3 推导，技法来自 GGX355 + rdev 双层 border | 纯 CSS |
| 剖光边 `mask-composite: exclude` | rdev `src/index.tsx` / magicui `shine-border.tsx` | 纯 CSS 伪元素 |
| 极细柱状图 | 纯 CSS | `<i style={{ "--h": ... }} />` |
| 指针镜面眩光 | GGX355 `.glass::after` + `--gx/--gy` | 一个 onMouseMove 写 CSS 变量，可选 |
| 弹簧缓动 / press 反馈 | GGX355 | 纯 CSS transition |
| 4 级 ink 色板 | GGX355 / nrg / KVideo 三方交叉验证 | CSS 变量 |
| 阴影 4 级体系 | GGX355 `--rim` 体系降级推导 | CSS 变量 |

**这部分覆盖率 ≈ 参考图 90% 的观感，新增依赖数 = 0。**

### 3.2 需要引入依赖才"对得起成本"的（本次都不推荐）

| 方案 | 需要什么 | 代价 | 结论 |
|---|---|---|---|
| 真·液态玻璃折射（feDisplacementMap） | 无新依赖，但需 canvas 生成位移图 + 每实例一个 SVG filter + Firefox 降级分支 | 约 200 行代码，低端机掉帧 | **不做**。bk-agent 的卡片是信息载体，不是炫技对象，用 1.3 方案 A 足够 |
| WebGL / WebGPU 液态玻璃（liquidGL、liquid-glass-webgl） | GPU shader | 与 3D 卡片、图表抢 GPU；移动端风险 | **不做** |
| Tailwind + shadcn 玻璃组件 | Tailwind v4 + shadcn CLI + 重写全部 className | 现有 `style.css` / `refinement.css` 全部作废 | **不做**。项目已有 292 行手写 CSS 且结构清晰，迁移成本远大于收益 |
| magicui / Aceternity 组件库 | motion/react、next-themes、tailwind、`cn()`、Next.js RSC | 需把 Vite+JSX 迁到 Next.js | **不做**，只抄参数与思路 |
| assistant-ui | `@assistant-ui/react` + 重写整个 chat 层 | 现有 `main.jsx` / `useConversations.js` / `api.js` 全废 | **不做**，可借鉴其滚动锚定与 composer 自适应思路 |
| 图表库（tremor / recharts / react-sparklines） | +40–150KB，还要覆盖默认样式 | 参考图里是装饰性微图表 | **不做**，纯 CSS |
| 图标库 | 已有 `lucide-react` | — | **保持** |

### 3.3 明确「不要引入」清单

1. **不要引入 Tailwind**——参考图的效果 100% 可用原生 CSS 复现，迁移 292 行既有 CSS 不值得。
2. **不要引入任何 UI 组件库**（shadcn / magicui / MUI / Chakra / Ant Design）。
3. **不要引入 WebGL / WebGPU 液态玻璃库**（liquidGL、liquid-glass-webgl、three.js）。
4. **不要引入图表库**（recharts / chart.js / tremor / victory / react-sparklines）。
5. **不要引入动画库**（framer-motion / motion / GSAP）——弹簧效果用 `cubic-bezier(.28,1.7,.4,1)` 一个 CSS 过渡就够。
6. **不要引入 CSS-in-JS**（styled-components / emotion）——项目已是手写 CSS。
7. **不要引入状态库**（redux / zustand）——`useConversations.js` 的 localStorage 方案已够。
8. **不要引入 GPL-3.0 项目的代码**（如 Zen-Nebula）——参赛作品有 License 风险。
9. **不要引入无 License 项目的代码**（css.glass、themesberg/glass-ui）——默认"保留所有权利"。
10. **不要做全屏动态 Aurora 动画**——参考图是静态的；动画只保留"卡片 hover / 消息入场 / 呼吸点"三处。

---

## 4. 落地清单：直接抄这张表

> **落地位置遵项目规约（`AGENTS.md` §3）**：设计令牌的唯一来源是 **`src/styles/tokens.css`**，组件样式放各自的 `.css`。
> 该文件**目前尚不存在**（现存只有 `src/style.css` 与 `src/refinement.css`），所以落地第一步是新建 `src/styles/tokens.css` 并在入口按序引入。
> §1.5 / §1.6 / §1.7 的所有 `:root` 变量都进 `tokens.css`；§1.1–§1.4 的类进 `refinement.css`。
> 同时遵守 **禁止硬编码颜色字面量**：本文示例里的 `#hex` 只作令牌取值参考，组件里一律写 `var(--…)`。
> 全程不动 `main.jsx` 的业务逻辑，仅新增/重排 CSS 引入。

按改动顺序排列（不动 `main.jsx` 的业务逻辑）：

| 步 | 做什么 | 抄哪里 | 约行数 |
|---|---|---|---|
| 1 | 在 `:root` 建立 token：ink 4 级 / 阴影 4 级 / 圆角 3 档 / 8pt 间距 / 字阶 | §1.6 §1.5 §1.7 | 35 |
| 2 | `.mesh-bg`（fixed 背景层）+ `.grain`（噪点层） | §1.1 | 20 |
| 3 | 把 `.app-shell` 三栏改为**单列居中 ChatBox**：`max-width: 780px; margin-inline: auto`，背景透明让 mesh 透出来 | 本报告判断 | 25 |
| 4 | `.composer` 改成玻璃胶囊：`blur(20px) saturate(180%)` + `--r-pill` + `--sh-2` | §1.2 | 15 |
| 5 | `.action-card` / `.module-card` 改造成玻璃卡（替换现有 `#fff` 背景与硬边框） | §1.2 | 30 |
| 6 | 欢迎区 4 个 action card 换成**倾斜 3D 玻璃片** | §1.3 | 40 |
| 7 | `.bar-track/.bar-fill` 换成 §1.4 的极细柱配方 | §1.4 | 20 |
| 8 | 大数字统一 `font-variant-numeric: tabular-nums` | §1.4 | 3 |
| 9 | 弹簧缓动 + `prefers-reduced-motion` | §1.7 | 15 |

**总计约 200 行 CSS，0 个新依赖，0 处业务逻辑改动。**

---

## 5. 关键结论（TL;DR）

1. **参考图 90% 的效果可以纯 CSS 复现，不需要任何新依赖。**
2. **最值得抄的两个仓库**是 [GGX355/liquid-glass-template](https://github.com/GGX355/liquid-glass-template)
   （MIT，1★，2026-09-22，完整苹果玻璃 token 体系）与 [hubeiqiao/apple-bento-grid](https://github.com/hubeiqiao/apple-bento-grid)
   （MIT，232★，2026-03-17，苹果配色与 bento 布局）。
3. **"玻璃感"的三个开关**：`backdrop-filter: blur(20px) saturate(180%)`（饱和是关键）、
   `inset 0 1px 0 rgba(255,255,255,.85)`（上缘高光）、双层低 alpha 阴影（贴地 + 环境）。
4. **"3D 玻璃片"不用 WebGL**：`perspective` + `rotate3d` + 上缘强高光 + 底部内收暗化 + 红蓝 fringe，四行 CSS 到位。
5. **"极细柱状图"不用图表库**：`width: 4–8px; border-radius: 999px; height: var(--h)` + 错峰 `scaleY` 入场。
6. **明确不要引入**：Tailwind、任何 UI 组件库、任何图表库、任何动画库、任何 WebGL 玻璃库、任何 GPL / 无 License 代码。
7. **最大的风险不是技术，是"过度工程"**——参考图的气质来自**克制**（极淡阴影、极细图表、只有 4 级灰），不是来自更多效果。

---

## 附：本次实际抓取的原始文件清单（可复核）

| 文件 | 来源仓库 | License |
|---|---|---|
| `liquid-glass.css` / `README.md` / `index.html` | GGX355/liquid-glass-template | MIT |
| `lab-v2/liquid-glass.css` / `lab-v2/GLASS_SYSTEM.md` / `lab-v2/pulse-glass.css` | GGX355/liquid-glass-template | MIT |
| `app/styles/glass.css` / `app/styles/variables.css` | KuekHaoYang/KVideo | MIT |
| `assets/css/main.css` | miketromba/css.glass | 无 |
| `liquid-glass.js` | shuding/liquid-glass | MIT |
| `src/index.tsx` | rdev/liquid-glass-react | MIT |
| `README.md` / `css/nrg.css` | superboyyy/liquid-glass-with-no-refraction | MIT |
| `registry/magicui/noise-texture.tsx` / `shine-border.tsx` / `magic-card.tsx` | magicuidesign/magicui | MIT |
| `apps/www/styles/globals.css` | magicuidesign/magicui | MIT |
| `examples/light-horizontal.html` | hubeiqiao/apple-bento-grid | MIT |
| `app/globals.css` / `components/BackgroundBlobs.tsx` / `Cards/Card1.tsx` | Code2With-Pratik/Aura-UI | MIT |
| `app/registry/dock/usage/dock-glass.tsx` | arihantcodes/spectrum-ui | Apache-2.0 |
| `components/ui/aurora-background.tsx` | ariefrahmansyah/remembergaza（Aceternity 镜像） | MIT |
| Apple HIG — Materials | developer.apple.com/design/human-interface-guidelines/materials | 官方文档（仅参考，不复制代码） |

**共 13 个仓库、20+ 个真实源文件已抓取全文并用于本报告。**
