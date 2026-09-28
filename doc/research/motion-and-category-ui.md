# 交易分类视觉语言 + 动效落地方案 · 卡片改版（参 ZA Bank）

> **项目**：bk-agent /「青禾 · 银行 AI 资金管家」
> **回应**：作者反馈「UI 设计得太丑了，要动效没动效」
> **证据等级**：`【实测】` = 本会话真实抓取 / 逐像素测量；`【仓库实测】` = 本会话读取仓库源码所得；`【官方原文】` = 官方页面原文；`【未能证实】` = 查不到，明确不编造。
> **测量工具**：本会话自写 Node PNG 解码器（`zlib` 反滤波 → 逐像素），临时脚本已删除，结论与参数全部落在本文。
> **素材**：`doc/research/_raw/za-shots/shot3.png`（ZA Card 详情页，900×1600，App Store HK 站原始截图）
> **前提**：本文**不改任何 `src/` 代码**。所有 CSS 片段遵守 `AGENTS.md §3` —— **组件样式里零颜色字面量**，新增的 hex **只出现在 `tokens.css`**。

---

## 0. 结论速览

1. **「丑」的根因不是缺动效，是六个分类共用一个灰色图标底。** 现在 `.tx-icon` 对转账/餐饮/购物/交通/订阅/收入只有 `--fill-3` 一种底色 + `ArrowUpRight/ArrowDownLeft` 两个图标（`src/views/product.jsx:46`【仓库实测】），所以整张账单看起来是一条灰色的流水线。**先建分类色，再谈动效** —— 动效只是把已经建立的区别「演示」出来。
2. **分类语言用「两种底座形状」分家**，直接借用现有研究里 ZA Bank 最值钱的那一招（`doc/research/za-bank-product-layer.md` §A.2.2）：**动作类（转账、收入）= 圆形底座**，**消费对象类（餐饮、购物、交通、订阅）= 圆角方形底座**。同一个网格里，不加一个字，就能看出「谁在动钱 / 谁在花钱」。
3. **餐饮的「不同餐厅不同呈现」用「图标靠关键词、配色靠哈希」，一共 12 行，零依赖。** 别建「商户 → 品牌色」映射表 —— 那是永不收敛的运营数据，而真正被用户感知的性质是**稳定性**（同一家店永远同一套视觉），哈希天然满足。
4. **三条动效全部只用 `transform` + `opacity`**，无一例外。云漂浮用 `translate3d + scale` + 一枚同步的「云影」伪元素；光影扫过用 `overflow:hidden` + 伪元素 `translate3d + skewX` 横穿（动 `background-position` 会掉到主线程重绘）；音乐律动用 `scaleY` 而不是 `height`（改 `height` 每帧布局）。
5. **`tokens.css` 已有的全局 `prefers-reduced-motion` 规则有一个缺口：它没有重置 `animation-delay`。** 错峰入场在降级模式下会「先隐形 `--i×40ms`，再瞬间弹出」。`@media` 块里必须补一条显式的 `animation: none` 覆盖（`tokens.css:184`【仓库实测】）。
6. **ZA Card 卡面是「一抹纯线性渐变，零高光、零纹理」。** 我拟合了 90,342 个平坦像素，**最大残差 1.37/255，超过 2/255 的样本占比 0.00%**【实测】。任何「加一层玻璃高光」的做法都是**超出 ZA 的**，可以做，但要清楚它是加法不是还原。
7. **ZA 卡面的渐变方向不是 `135deg`，是「角对角」。** 拟合出梯度在像素空间的斜率比 dy/dx = 0.597（三通道一致），换算 CSS 角度 **≈121°**，等价于 `to bottom right`（CSS 的 `to <corner>` 语法本身就是角对角，且**自适应任意宽高比**）。我们现在的 `.bank-card { background: var(--grad-brand) }` 用的是 `--grad-brand = linear-gradient(135deg, …)`，**方向是错的**【仓库实测 `tokens.css:142`】。
8. **卡面实测参数**（截图 900px 宽，手机内容区 674px = 393pt，比例 1.715 px/pt）：卡面 **631×378 px = 367.9×220.4 pt，宽高比 1.6693**；圆角 **≈34px = 19.8pt = 5.39% 卡宽**；左内边距 **21.0pt**；白圆 logo 直径 **12.4% 卡宽**；VISA 字号块 **68.2×21.6 pt**，右/下内边距各 **≈22.5pt**。
9. **金额滚动增长用 JS（rAF + `textContent`），不要用 CSS `@property` + `counter()`。** 理由只有一条但决定性：`counter()` 输出的是裸整数，**加不了千分位分隔符、加不了 ¥、控制不了小数位**，而这是账目界面。JS 版 14 行、零依赖、可降级。
10. **扩餐饮样例数据会打断两条现有测试。** `tests/bank.test.js:10` 断言 `transactions.length === 8`，`:21` 断言 `totals(state).spending === 474200`【仓库实测】。要展示「不同餐厅不同呈现」就必须加 3–4 条餐饮流水，**必须同一次改动里更新这两条断言**。

---

# A. 交易分类的视觉语言体系

## A.0 三条硬约束

| 约束 | 出处 | 后果 |
|---|---|---|
| 组件 CSS 里**零颜色字面量**，`#hex` 只允许出现在 `tokens.css` | `AGENTS.md §3` | 本文所有片段用 `var(--…)`；**新增的 14 个 token 必须先写进 `tokens.css`** |
| 允许的依赖只有 `react` / `react-dom` / `lucide-react` / `vite` / `@playwright/test` | `AGENTS.md §1` | 不引入任何动画库；不引入 `crypto`/`lodash`（哈希自己写 1 行） |
| lucide 图标名必须真实存在 | 任务约束 | 本文出现的图标名**全部在 `lucide-react@0.468.0` 里用 `import * as L` 实测过**，见 §A.6 |

## A.1 先把令牌写进 `tokens.css`

一次性追加到 `tokens.css` 的 `:root` 里。**这是唯一允许出现 hex 的地方。**

```css
/* ── 交易分类色（iOS System Colors 2025 同族；只表达分类，不表达状态）──────
   与文件里已有的 --success #34c759 / --warning #ff8d28 / --accent-2 #5e5ce6
   是同一次 WWDC25 刷新的同一支色板，所以放在一起不会打架。 */
--cat-transfer:  #0088ff;   /* 蓝   · 资金流动 */
--cat-dining:    #ff8d28;   /* 橙   · 食欲 */
--cat-shopping:  #ff2d92;   /* 粉   · 消费冲动 */
--cat-transport: #30b0c7;   /* 青   · 移动 */
--cat-subscribe: #5e5ce6;   /* 靛   · 长期扣费 */
--cat-income:    #34c759;   /* 绿   · 入账 */

/* 12% 淡底：用 color-mix 派生，不新增一堆 rgba 字面量。
   （tokens.css 原有注释里已经用过 color-mix 这个手法） */
--cat-transfer-tint:  color-mix(in srgb, var(--cat-transfer)  12%, transparent);
--cat-dining-tint:    color-mix(in srgb, var(--cat-dining)    12%, transparent);
--cat-shopping-tint:  color-mix(in srgb, var(--cat-shopping)  12%, transparent);
--cat-transport-tint: color-mix(in srgb, var(--cat-transport) 12%, transparent);
--cat-subscribe-tint: color-mix(in srgb, var(--cat-subscribe) 12%, transparent);
--cat-income-tint:    color-mix(in srgb, var(--cat-income)    12%, transparent);

/* 餐饮的 6 个变体（见 §A.4），全部取自同一支 iOS 色板 */
--cat-dining-a: #ff8d28;   /* 橙   · 中餐 / 默认 */
--cat-dining-b: #a2845e;   /* 棕   · 咖啡 / 烘焙 */
--cat-dining-c: #ff383c;   /* 红   · 披萨 / 火锅 */
--cat-dining-d: #ffcc00;   /* 黄   · 面食 / 汤 */
--cat-dining-e: #ff6482;   /* 粉红 · 甜品 / 奶茶 */
--cat-dining-f: #30b0c7;   /* 青   · 海鲜 / 日料 */

/* ── 动效补充令牌 ─────────────────────────────────────────────────── */
--ease-in-out: cubic-bezier(.37, 0, .63, 1);   /* 循环类动效（呼吸/律动/扫光）用 */
--dur-float:   2800ms;   /* 云漂浮一整个来回 */
--dur-eq:       720ms;   /* 均衡器一格 */
--dur-sheen:    880ms;   /* 一道扫光 */
--stagger-step:  40ms;   /* 列表错峰步长 */
--stagger-max:      8;   /* 错峰封顶：第 9 项之后不再累加 */

/* ── 光影 / 卡面材质 ─────────────────────────────────────────────── */
/* 订阅行「视频」的扫光带：纯白半透明斜向渐变，不引入新色相 */
--sheen-video: linear-gradient(100deg,
  transparent 32%, rgba(255,255,255,.62) 50%, transparent 68%);
/* 卡面高光（ZA 实测没有，这是我们主动加的一层，见 §D.5） */
--card-gloss:
  linear-gradient(to bottom, rgba(255,255,255,.34), rgba(255,255,255,0) 26%),
  linear-gradient(115deg, rgba(255,255,255,.26) 0%, rgba(255,255,255,0) 44%);

/* ── 卡面配色（内容层，不透明）────────────────────────────────────── */
/* 卡 0 = ZA Card 实测值原样复刻：左上 #51FAB9 → 右下 #39E5B1 */
--card-0-a: #51fab9;  --card-0-b: #39e5b1;
/* 卡 1 = 现有品牌渐变（--grad-brand 的两个停靠点，去掉了方向） */
--card-1-a: #0a84ff;  --card-1-b: #5e5ce6;
/* 卡 2 = 墨黑（冻结 / 停用态） */
--card-2-a: #24243a;  --card-2-b: #0b0b16;
--card-frost: rgba(255,255,255,.10);   /* 冻结态的斜纹 */
```

## A.2 六个分类总表

| 分类 | lucide 图标（**已实测存在**） | 色 token | hex | **底座形状** | 列表行里的样子 | 网格 box 里的样子 | hover 签名动作 |
|---|---|---|---|---|---|---|---|
| 转账 | `ArrowLeftRight` | `--cat-transfer` | `#0088ff` | **圆** | 36px 圆 + 白箭头，金额中性色 | 56px 圆形 tile + 「转账」标签 | **对流**：箭头 ±2px 往复 |
| 餐饮 | `UtensilsCrossed`（+5 变体） | `--cat-dining` | `#ff8d28` | 圆角方 | 36px 方 + 刀叉，副标题带餐厅名 | 56px 方 tile + 变体色 | **抬盘**：上浮 3px + 倾斜 −8° |
| 购物 | `ShoppingBag` | `--cat-shopping` | `#ff2d92` | 圆角方 | 36px 方 + 购物袋 | 56px 方 tile | **提袋轻晃**：±9° 摆动 |
| 交通 | `CarFront` | `--cat-transport` | `#30b0c7` | 圆角方 | 36px 方 + 车头 | 56px 方 tile | **前行**：右移 4px（一次性） |
| 订阅 | `Repeat`（行内换细分图标） | `--cat-subscribe` | `#5e5ce6` | 圆角方 | 36px 方 + 细分图标 | 56px 方 tile | **细分项专属**：云浮 / 光扫 / 律动（§B） |
| 收入 | `TrendingUp` | `--cat-income` | `#34c759` | **圆** | 36px 圆 + 上行折线，金额绿色 + 加号 | 56px 圆形 tile | **生长**：上浮 3px 淡入 |

> **为什么「转账 / 收入」用圆、其余用方**
> 圆形 = 动作（钱在动，没有「物」），方形 = 产品（有具体的消费对象）。
> 这条规则直接来自 ZA Bank 首页 4×2 宫格的双图标语言（`doc/research/za-bank-product-layer.md` §A.2.2 ③，原文标注为「全篇最重要的单个设计决策」）。
> 我们的账单页只有两种「动作」分类（转账、收入）和四种「对象」分类，映射天然成立。

## A.3 列表行的基座 CSS

替换 `app.css:410-414` 的 `.tx-icon` 与 `app.css:432-436` 的 `.sub-logo`，并新增分类着色。**共用一个基座，形状靠 modifier 切。**

```css
/* ── 图标底座：两种语言（动作=圆，对象=方）────────────────────────── */
.tx-icon, .sub-logo {
  width: 36px; height: 36px; flex: 0 0 auto;
  display: grid; place-items: center;
  border-radius: var(--radius-thumb);              /* 12px · 方形语言（默认）*/
  background: var(--fill-3); color: var(--text-secondary);
  transition: transform var(--duration-fast) var(--ease-out-quart),
              background-color var(--duration-fast) var(--ease-out);
}
.tx-icon--round, .sub-logo--round { border-radius: var(--radius-pill); }   /* 圆形语言 */

/* ── 分类着色（一类一行）────────────────────────────────────────── */
.tx-icon--transfer,  .sub-logo--transfer  { background: var(--cat-transfer-tint);  color: var(--cat-transfer); }
.tx-icon--dining,    .sub-logo--dining    { background: var(--cat-dining-tint);    color: var(--cat-dining); }
.tx-icon--shopping,  .sub-logo--shopping  { background: var(--cat-shopping-tint);  color: var(--cat-shopping); }
.tx-icon--transport, .sub-logo--transport { background: var(--cat-transport-tint); color: var(--cat-transport); }
.tx-icon--subscribe, .sub-logo--subscribe { background: var(--cat-subscribe-tint); color: var(--cat-subscribe); }
.tx-icon--income,    .sub-logo--income    { background: var(--cat-income-tint);    color: var(--cat-income); }
/* 餐饮变体：由 JS 给出一个下标，落到下面 5 条之一（data-look="0" 沿用上面的 --cat-dining）*/
.tx-icon--dining[data-look="1"], .sub-logo--dining[data-look="1"] { background: color-mix(in srgb, var(--cat-dining-b) 12%, transparent); color: var(--cat-dining-b); }
.tx-icon--dining[data-look="2"], .sub-logo--dining[data-look="2"] { background: color-mix(in srgb, var(--cat-dining-c) 12%, transparent); color: var(--cat-dining-c); }
.tx-icon--dining[data-look="3"], .sub-logo--dining[data-look="3"] { background: color-mix(in srgb, var(--cat-dining-d) 12%, transparent); color: var(--cat-dining-d); }
.tx-icon--dining[data-look="4"], .sub-logo--dining[data-look="4"] { background: color-mix(in srgb, var(--cat-dining-e) 12%, transparent); color: var(--cat-dining-e); }
.tx-icon--dining[data-look="5"], .sub-logo--dining[data-look="5"] { background: color-mix(in srgb, var(--cat-dining-f) 12%, transparent); color: var(--cat-dining-f); }

/* ── 行：hover 底色 + 图标放大（所有分类共有）────────────────────── */
.tx-row, .sub-row { border-radius: var(--radius-thumb); transition: background-color var(--duration-fast) var(--ease-out); }
@media (hover: hover) {
  .tx-row:hover, .sub-row:hover { background: var(--bg-hover); }
  .tx-row:hover .tx-icon, .sub-row:hover .sub-logo { transform: scale(1.06); }
}
/* 键盘等价物：只用 :hover 会让键盘用户完全看不到这套语言 */
.tx-row:focus-within, .sub-row:focus-within { background: var(--bg-hover); }
```

### 每类的签名动作 CSS（6 段，全部 `@media (hover: hover)` 限定）

```css
/* ① 转账 · 对流：两个箭头来回，像钱在两个账户之间走 */
@keyframes flow-x { 0%, 100% { transform: translateX(-2px); } 50% { transform: translateX(2px); } }
@media (hover: hover) {
  .tx-row:hover .tx-icon--transfer svg { animation: flow-x 1400ms var(--ease-in-out) infinite; }
}

/* ② 餐饮 · 抬盘：上浮 + 轻倾，像把盘子端起来看 */
@keyframes plate-lift {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-3px) rotate(-8deg); }
}
@media (hover: hover) {
  .tx-row:hover .tx-icon--dining svg { animation: plate-lift 1600ms var(--ease-in-out) infinite; }
}

/* ③ 购物 · 提袋轻晃：从袋口（顶部中点）摆，不是从中心转 */
@keyframes bag-swing {
  0%, 100% { transform: rotate(0deg); }
  30%      { transform: rotate(-9deg); }
  65%      { transform: rotate(7deg); }
}
.tx-icon--shopping svg { transform-origin: 50% 12%; }
@media (hover: hover) {
  .tx-row:hover .tx-icon--shopping svg { animation: bag-swing 900ms var(--ease-in-out) 1; }
}

/* ④ 交通 · 前行：一次性右移并停住（用 forwards 保持位移，移出 hover 自动复位） */
@keyframes go-forward { from { transform: translateX(0); } to { transform: translateX(4px); } }
@media (hover: hover) {
  .tx-row:hover .tx-icon--transport svg {
    animation: go-forward var(--duration-fast) var(--ease-out-quart) forwards;
  }
}

/* ⑤ 订阅 · 兜底（细分项走 §B 的三条专属动效）*/
@keyframes tick-quarter { from { transform: rotate(0deg); } to { transform: rotate(90deg); } }
@media (hover: hover) {
  .sub-row:hover .sub-logo--subscribe svg { animation: tick-quarter 600ms var(--ease-out-quart) 1; }
}

/* ⑥ 收入 · 生长：淡入 + 上浮，配金额的绿色 */
@keyframes rise-in {
  from { transform: translateY(3px); opacity: .35; }
  to   { transform: translateY(0);   opacity: 1; }
}
@media (hover: hover) {
  .tx-row:hover .tx-icon--income svg { animation: rise-in 520ms var(--ease-out-quart) 1 both; }
}
```

**性能注意点（这一段对 6 条全部适用）**

- 动效**只碰 `transform`**。上面每一段都没有出现 `width` / `height` / `top` / `left` / `box-shadow` / `background-position`。
- **`will-change` 一个都不加。** 图标 hover 动效是「鼠标进来才创建合成层」，生命周期极短；加了 `will-change` 反而让浏览器**常驻**合成层，一份 `.tx-row` 类会被复制到整张账单（最多 25 条），层数乘以 25 是纯浪费。
- `transform-origin` 要显式写。购物袋默认绕中心转，看起来像袋子在「翻跟头」；写 `50% 12%` 才是「从提手甩」。
- 6 条里有多条用了 `infinite`。**同时运动的元素数量上限在 §E 里定死为「一屏 ≤ 3 组」**，所以实际落地时账单页不要给每一行都挂无限动效 —— 无限动效只给**订阅细分项**（§B，用户明确要求）和**当前 hover 的那一行**（天然只有一行，因为 `:hover` 是单元素）。
  ⚠️ 上面 6 条都是 `:hover` 作用域，所以**任意时刻最多只有 1 条在跑**，不违反上限。这是刻意的设计，不要改成「常驻循环」。

## A.4 餐饮：不同餐厅不同呈现（零依赖机制）

**结论：图标靠关键词，配色靠哈希。**

```jsx
/* 12 行，零依赖。放在 src/domain/bank.js 旁边，或 src/views/product.jsx 顶部。 */
const hash = s => [...s].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);

/* 语义部分：用户看得懂，才值得人工维护 */
const DINING_ICON = [
  [/咖啡|星巴克|瑞幸|Costa|Manner/i, Coffee],
  [/披萨|pizza/i,                    Pizza],
  [/火锅|烧烤|串|海底捞/,             CookingPot],
  [/日料|寿司|刺身|鱼|海鲜/,          Fish],
  [/面|拉面|米线|粉|汤/,              Soup],
  [/汉堡|炸鸡|麦当劳|肯德基/,         Beef],
  [/甜|蛋糕|冰淇淋|奶茶/,             IceCreamBowl],
  [/酒|酒吧|啤|清酒/,                 Beer],
  [/沙律|沙拉|轻食|健康餐/,           Salad],
];
const diningIcon = name => (DINING_ICON.find(([re]) => re.test(name)) || [0, UtensilsCrossed])[1];

/* 识别度部分：不需要维护，且「同一家店永远同一套色」这个性质自动成立 */
const diningLook = name => hash(name) % 6;
```

用：

```jsx
const look = t.category === '餐饮' ? diningLook(t.name) : 0;
const Icon = t.category === '餐饮' ? diningIcon(t.name) : CAT_ICON[t.category];
<span className={'tx-icon tx-icon--' + CAT_KEY[t.category] + (CAT_ROUND[t.category] ? ' --round' : '')}
      data-look={look} aria-hidden="true"><Icon size={18}/></span>
```

**为什么不做「商户 → 品牌色」映射表**

| 方案 | 行数 | 新增商户时 | 被感知的性质 |
|---|---|---|---|
| 品牌色映射表 | N 条，**永不收敛** | 必须人工补一行 | 品牌正确 ✅ / 稳定性 ✅ |
| 哈希取模 | **1 行** | 自动 | 品牌正确 ❌ / 稳定性 ✅ |

真正被用户感知的性质是**稳定性**（同一家店每次打开都是同一个颜色、同一个图标），而不是「星巴克必须是绿的」。哈希在 1 行的成本下就拿到了稳定性；图标那一半用 9 行关键词规则补回语义正确性。**合计 12 行**，比映射表的维护负担低一个数量级。

> ⚠️ **要展示这个机制，样例数据必须扩容。** `src/domain/bank.js:10` 现在只有一条餐饮记录「日常餐饮」【仓库实测】，哈希只会有一种结果。
> 建议加 4 条：`星巴克咖啡 −4200`、`海底捞火锅 −23600`、`麦当劳 −3800`、`沪上阿姨 −1900`。
> **这会打断 `tests/bank.test.js:10`（`transactions.length === 8`）和 `:21`（`spending === 474200`），必须同一次改动里同步更新。** 同时 `doc/CHANGELOG.md` 按 `AGENTS.md §2` 也要改。

## A.5 网格 / box 形态

需求里的「购物：小图标呈现，展示在栏目或白色 box 里」——这套 tile 同时服务 6 个分类，不止购物。

```css
/* ── 分类宫格：自适应列宽，白卡 box ─────────────────────────────── */
.cat-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: var(--space-3);
}
.cat-tile {
  min-height: var(--hit-min);                 /* HIG 触控最小 44px，不简化 */
  display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
  padding: var(--space-4) var(--space-2);
  border: 1px solid var(--hairline); border-radius: var(--radius-card);
  background: var(--bg-surface);              /* 内容层，禁止玻璃 */
  font: inherit; color: var(--text-primary); text-align: center;
  transition: transform var(--duration-fast) var(--ease-out-quart),
              background-color var(--duration-fast) var(--ease-out);
}
.cat-tile-icon {
  width: 44px; height: 44px; display: grid; place-items: center;
  border-radius: var(--radius-thumb);         /* 方形语言 */
  transition: transform var(--duration-fast) var(--ease-out-quart);
}
.cat-tile-icon--round { border-radius: var(--radius-pill); }   /* 转账 / 收入 */
.cat-tile-name { font-size: var(--text-caption); color: var(--text-secondary); }
.cat-tile-num  { font-size: var(--text-footnote); font-weight: 600; font-variant-numeric: tabular-nums; }

@media (hover: hover) {
  .cat-tile:hover { transform: translateY(-2px); background: var(--bg-hover); }
  .cat-tile:hover .cat-tile-icon { transform: scale(1.08) rotate(-4deg); }
}
/* 键盘等价物 + 可见轮廓 */
.cat-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

> `.cat-tile-icon` 的分类底色与前景色，落地时**复用 §A.3 的那一批 `.tx-icon--*` 声明**（CSS 不支持通配变量名，直接把同一批选择器并列写上即可），不要另起一套。

## A.6 图标名核对（`lucide-react@0.468.0` 实测）

本会话执行 `import * as L from 'lucide-react'`，**包共导出 5234 个符号**，下列候选逐个用 `in` 判定【实测】：

- **核对通过（161 个，本文只用其中一部分）**：
  `ArrowLeftRight` `ArrowUpRight` `ArrowDownLeft` `Send` `Banknote` `Landmark` `Users` `Repeat` `RefreshCw` `HandCoins` `ReceiptText` `CircleDollarSign` `Shuffle` `ArrowRightLeft` `Utensils` `UtensilsCrossed` `Coffee` `Pizza` `Soup` `Sandwich` `Salad` `Beef` `IceCreamBowl` `IceCreamCone` `Wine` `Beer` `CakeSlice` `Cake` `ChefHat` `CupSoda` `Croissant` `Cookie` `Dessert` `Donut` `EggFried` `HandPlatter` `CookingPot` `Martini` `Milk` `Fish` `Drumstick` `Wheat` `Candy` `Popcorn` `GlassWater` `Vegan` `ShoppingBag` `ShoppingCart` `ShoppingBasket` `Shirt` `Footprints` `Gem` `Tag` `Tags` `Gift` `Store` `Package` `PackageOpen` `Watch` `Glasses` `Smartphone` `Laptop` `Sofa` `Lamp` `Bed` `Armchair` `KeyRound` `Backpack` `Briefcase` `Boxes` `Box` `ScanBarcode` `BadgePercent` `Car` `CarTaxiFront` `CarFront` `Bus` `BusFront` `TrainFront` `TramFront` `Bike` `Plane` `Fuel` `MapPin` `Navigation` `Ship` `Truck` `TrainTrack` `Route` `Gauge` `ParkingMeter` `Milestone` `CircleParking` `Baby` `CableCar` `PlaneTakeoff` `Cloud` `Cloudy` `CloudUpload` `CloudDownload` `CloudCog` `CloudDrizzle` `Video` `VideoIcon` `Music` `Music2` `Music3` `Music4` `Tv` `TvMinimal` `TvMinimalPlay` `MonitorPlay` `Clapperboard` `Film` `Podcast` `Radio` `Rss` `AudioLines` `Waves` `Headphones` `HardDrive` `MonitorSmartphone` `Youtube` `CirclePlay` `Play` `Disc3` `RadioTower` `Satellite` `TrendingUp` `Wallet` `WalletMinimal` `PiggyBank` `Coins` `BadgeDollarSign` `CircleCheck` `BadgeCheck` `ChartLine` `ChartNoAxesColumn` `Sparkles` `Star` `Sun` `CalendarClock` `Clock` `Bell` `Bookmark` `Heart` `Flame` `Layers` `Grid2x2` `LayoutGrid` `ListFilter` `Filter` `ArrowDownToLine` `Undo2` `CircleArrowDown` `Handshake` `FileText`
- **核对失败（4 个，本文已剔除，不要使用）**：`Hamburger`、`Bottle`、`CookingPan`、`BanknoteArrowDown`【实测】
- 参考：<https://lucide.dev> · <https://github.com/lucide-icons/lucide>（★24,750 · `gh api` 返回 `license.spdx_id = NOASSERTION`，但仓库内 `LICENSE` 文件正文首行实测为 `ISC License`【实测】）

---

# B. 三条具体动效的实现（零依赖，纯 CSS）

> 三条的共同前提：**只动 `transform` 和 `opacity`**。这三条都不产生布局，都在合成器上跑。

## B.1 云漂浮（订阅 · 云空间）

**目标**：hover 时云图标缓缓上浮 + 轻微呼吸。加一枚**同步的云影**——没有影子的上浮看起来像贴纸被拽走，有影子才像「飘」。

```css
/* 底座先建立定位上下文（.sub-logo 现在没有 position）*/
.sub-logo--cloud { position: relative; overflow: visible; }

/* ① 云：上浮 + 呼吸。translate3d 而不是 translateY，强制走合成层 */
@keyframes cloud-float {
  0%, 100% { transform: translate3d(0, 0, 0)     scale(1); }
  50%      { transform: translate3d(0, -4px, 0)  scale(1.07); }
}
/* ② 云影：云升高 → 影缩小变淡。周期必须与 ① 完全相同，两者才同相 */
@keyframes cloud-shadow {
  0%, 100% { transform: scale(1);   opacity: .38; }
  50%      { transform: scale(.72); opacity: .16; }
}
/* ③ 云影本体：5px 高的小椭圆，颜色就取分类色，不新增令牌 */
.sub-logo--cloud::after {
  content: ''; position: absolute; left: 50%; bottom: 1px;
  width: 18px; height: 5px; margin-left: -9px;
  border-radius: var(--radius-pill);
  background: var(--cat-subscribe);
  opacity: .38; transform-origin: 50% 50%;
  pointer-events: none;
}
@media (hover: hover) {
  .sub-row--cloud:hover .sub-logo--cloud svg {
    animation: cloud-float var(--dur-float) var(--ease-in-out) infinite;
    will-change: transform;
  }
  .sub-row--cloud:hover .sub-logo--cloud::after {
    animation: cloud-shadow var(--dur-float) var(--ease-in-out) infinite;
  }
}
/* 降级：不飘了，但保留「抬高」这个静态语义，不是回到没有状态的平面 */
@media (prefers-reduced-motion: reduce) {
  .sub-logo--cloud svg { transform: translate3d(0, -2px, 0); }
  .sub-logo--cloud::after { transform: scale(.82); opacity: .22; }
  .sub-row--cloud:hover .sub-logo--cloud svg,
  .sub-row--cloud:hover .sub-logo--cloud::after { animation: none; }
}
```

**参数**：周期 `--dur-float: 2800ms`，`--ease-in-out`（`cubic-bezier(.37,0,.63,1)`），上浮 4px，缩放 +7%。
4px 是「看得见但不跳」的量：36px 的底座上，4px ≈ 11% 的高度；超过 6px 就开始像弹跳玩具。

**性能注意点**

- 只有 `transform` 与 `opacity`。影子用的是**独立伪元素**而不是 `box-shadow` —— 动画化 `box-shadow` 会每帧重绘整个元素的阴影。
- `will-change: transform` **只写在 `:hover` 里**，且目标只有 1 个 `svg`。写到 `.sub-logo` 基类上会让订阅列表的每一行都常驻一个合成层。
- 上浮 4px 要求祖先**没有 `overflow: hidden`**。`.sub-row` 现在没有（`app.css:405-408`【仓库实测】），但如果后续给行加了 `overflow: hidden`（比如用了 §B.2 的扫光），云会在顶部被切掉 4px —— 所以扫光的 `overflow: hidden` 只加在 `.sub-row--video` 上，不要加到基类。
- 长列表里 `infinite` 会脱离 hover 一直跑吗？不会：`animation` 挂在 `:hover` 上，鼠标移开就整个销毁，零常驻开销。
- 若列表很长（>30 行），给 `.sub-list > li` 加 `content-visibility: auto`，让屏幕外的行不参与动画调度。

## B.2 光影扫过（订阅 · 视频）

**目标**：hover 时一道柔光从左扫到右。

```css
.sub-row--video {
  position: relative;
  overflow: hidden;          /* ← 必须。见下面「性能注意点」第 1 条 */
  isolation: isolate;        /* 隔离混色，防伪元素的光溢出到相邻元素 */
  border-radius: var(--radius-thumb);
}
.sub-row--video::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background: var(--sheen-video);
  transform: translate3d(-130%, 0, 0) skewX(-14deg);
  opacity: 0;
}
@keyframes sheen-sweep {
  0%   { transform: translate3d(-130%, 0, 0) skewX(-14deg); opacity: 0; }
  12%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { transform: translate3d(130%, 0, 0) skewX(-14deg);  opacity: 0; }
}
@media (hover: hover) {
  .sub-row--video:hover::after {
    animation: sheen-sweep var(--dur-sheen) var(--ease-out) 60ms 1 both;
  }
}
/* 键盘等价物 */
.sub-row--video:focus-within::after {
  animation: sheen-sweep var(--dur-sheen) var(--ease-out) 60ms 1 both;
}
@media (prefers-reduced-motion: reduce) {
  /* 扫光 = 纯装饰，直接去掉，不留静态替身 */
  .sub-row--video:hover::after,
  .sub-row--video:focus-within::after { animation: none; opacity: 0; }
}
```

**参数**：`--dur-sheen: 880ms`，`--ease-out`，迟到 60ms 再出发，`skewX(-14deg)` 给斜向感，`z-index: 1` 让光**盖过文字**（这才是「光影」而不是「背景动了一下」）。

**性能注意点**

1. **必须有 `overflow: hidden`。** 伪元素从 `translate3d(-130%)` 出发，没裁剪的话它会画到左边相邻的行上面。这也是**唯一**被允许在行上加 `overflow: hidden` 的场景，所以只加在 `--video` 这一行，不要加到基类（会切掉 B.1 里云的 4px 上浮）。
2. **不要用 `background-position` 做扫光。** 那是主流教程给的做法，但它**每帧都要重新光栅化渐变**，跑在主线程；`transform` 版本由合成器处理，零重绘。同理不要用 `background-size` 或 `mask-position` 动画。
3. `.sub-row` 是 `<li>`，`overflow: hidden` 会裁掉子元素的 `outline`。把行内可交互元素的焦点环改成内缩：`.sub-row--video :focus-visible { outline-offset: -3px; }`。
4. 渐变两端写 `transparent` 在极少数浏览器上会因「透明色按 `rgba(0,0,0,0)` 插值」而出现灰边。要绝对干净就写成 `rgba(255,255,255,0)`；本方案里白色渐变在浅底上肉眼无差，可以保留 `transparent`。
5. `both` 填充模式是必要的：这样扫光在 60ms 延迟期间保持在 `translate3d(-130%)` 且 `opacity: 0`，不会闪一下。

## B.3 音乐律动（订阅 · 音乐）

**目标**：hover 时 4 根小竖条错峰起伏。

**HTML 结构**（替换现在 `.sub-logo` 里的首字，`product.jsx:142`）：

```jsx
<span className="sub-logo sub-logo--subscribe sub-logo--music" aria-hidden="true">
  <span className="eq"><i/><i/><i/><i/></span>
</span>
```

> `aria-hidden="true"` 是必须的：这是一个纯装饰图形，行的语义已经由 `.tx-main strong` 的文字提供了。**不要**加 `role="img"` 或 `aria-label`。

**CSS**：

```css
.sub-logo--music { color: var(--cat-subscribe); background: var(--cat-subscribe-tint); }

.eq { display: flex; align-items: flex-end; gap: 2.5px; height: 15px; }
.eq i {
  display: block; width: 2.5px; height: 100%;
  border-radius: var(--radius-pill);
  background: currentColor;
  transform-origin: 50% 100%;      /* ← 从基线往上长，不是从中心往两头涨 */
}

/* 静态态 = 一段「冻住的波形」。未 hover 时、以及 reduced-motion 降级时都用它。 */
.eq i:nth-child(1) { transform: scaleY(.42); }
.eq i:nth-child(2) { transform: scaleY(.86); }
.eq i:nth-child(3) { transform: scaleY(.58); }
.eq i:nth-child(4) { transform: scaleY(.74); }

@keyframes eq-bounce {
  0%, 100% { transform: scaleY(.30); }
  50%      { transform: scaleY(1); }
}
@media (hover: hover) {
  /* ⚠️ 绝对不要写 animation-fill-mode: both —— 见下面「性能注意点」第 3 条 */
  .sub-row--music:hover .eq i { animation: eq-bounce var(--dur-eq) var(--ease-in-out) infinite; }
  .sub-row--music:hover .eq i:nth-child(1) { animation-delay:   0ms; }
  .sub-row--music:hover .eq i:nth-child(2) { animation-delay: 110ms; }
  .sub-row--music:hover .eq i:nth-child(3) { animation-delay: 220ms; }
  .sub-row--music:hover .eq i:nth-child(4) { animation-delay: 330ms; }
}
```

**参数**：`--dur-eq: 720ms`，错峰 110ms，4 根；`110×3 = 330ms`，正好是 720ms 周期的 ~46% —— 相位铺满半圈，看起来才「一直在动」而不是「整排一起闪」。要做 5 根就把周期提到 900ms 并加 `:nth-child(5) { animation-delay: 440ms; }`。

**性能注意点**

1. **`scaleY` 而不是 `height`。** 改 `height` 每一帧都要重新布局整行（文字会跟着上下抖），改 `transform: scaleY()` 只走合成器。这是这套动效唯一的正确实现方式。
2. `transform-origin: 50% 100%` 不能省。默认的 `50% 50%` 会让竖条从中间向两头涨，看起来像「膨胀」，不是「律动」。
3. **不能加 `animation-fill-mode: both`。** 因为 `tokens.css:184-190` 有一条全局降级规则 `animation-duration: .01ms !important; animation-iteration-count: 1 !important;`，配 `both` 会让动画结束在 `100%` 那一帧（`scaleY(.30)`）—— 四根条全部塌成一条平线，降级态看起来像坏了。用默认的 `fill-mode: none`，动画结束后元素回落到上面写好的**静态波形**，降级态依然好看。
4. `gap: 2.5px` + 2.5px 宽度，4 根总宽 `4×2.5 + 3×2.5 = 17.5px`，放进 36px 底座左右各留 9px，视觉居中。**用小数 px 是刻意的**：整数 3px 会让总宽变成 21px，在 36px 底座里显得挤。
5. 无限循环的 `will-change`：这 4 个 `i` 元素生命周期同样只在 hover 期间。可以加 `will-change: transform`，但收益极小（元素太小，合成层开销 > 重绘开销），**建议不加**。

## B.4 订阅细分项的路由

按 `name` 关键词决定用哪条动效（与 §A.4 的餐饮同一个手法）：

```jsx
const SUB_KIND = [
  [/云|空间|网盘|iCloud|Drive|存储/i, 'cloud', Cloud],
  [/视频|影|剧|影视|Netflix/i,        'video', Clapperboard],
  [/音乐|听|歌|乐|Music/i,            'music', Music2],
  [/读书|阅|电子书|杂志/i,            'read',  FileText],   /* 兜底走 tick-quarter */
];
const subKind = name => SUB_KIND.find(([re]) => re.test(name)) ?? [null, 'other', Repeat];
```

行上挂 `.sub-row--cloud` / `--video` / `--music`，图标用返回的组件。

> 现有三条数据（`bank.js:7`【仓库实测】）：`云空间`→cloud ✓、`光影视频`→video ✓、`随听音乐`→music ✓。**三条正则都能命中，不需要改样例数据。**

---

# C. 卡片滑入 / 列表错峰的通用配方

## C.1 surface 从下方滑入

**落点**：`.page-head`（页头）+ `.page .a2ui-surface`（转账卡片本体）。
`Transfer()` 渲染的正是 `<SurfaceView>`，其根节点是 `.a2ui-surface`（`src/a2ui/render.jsx:129`【仓库实测】）。路由切换时 `ProductView` 换的是组件类型，React 会卸载重建，所以 **CSS 动画会自动重放，不需要任何 JS**。

```css
@keyframes surface-in {
  from { opacity: 0; transform: translate3d(0, 16px, 0) scale(.985); }
  to   { opacity: 1; transform: none; }
}

/* 页面骨架：页头先进 */
.page-head { animation: surface-in var(--duration-base) var(--ease-spring) both; }

/* 转账卡片：晚 90ms 进、位移更大，形成「页头 → 卡片」的层次 */
.page .a2ui-surface { animation: surface-in var(--duration-slow) var(--ease-spring) 90ms both; }

/* 页面其余分块：每块 60ms 递进（用 §C.2 的同一个 --i） */
.page-body > * {
  animation: surface-in var(--duration-base) var(--ease-spring) both;
  animation-delay: calc(90ms + min(var(--i, 0), 6) * 60ms);
}
```

**参数**

| 量 | 值 | 理由 |
|---|---|---|
| 位移 | 16px | 卡片高度约 300px+，16px ≈ 5%，是「从下面来」的最小可辨识量；8px 看不出来，32px 像从屏幕外扔进来 |
| 缩放 | .985 | 只做 1.5%，用于暗示「纵深靠近」；超过 .96 就变成廉价的「弹出来」 |
| 时长 | `--duration-base` 300ms（页头）/ `--duration-slow` 450ms（卡片） | 卡片位移更大、面积更大，必须更慢，否则感觉在闪 |
| 缓动 | `--ease-spring` = `cubic-bezier(.32,.72,0,1)` | 现有令牌，**不过冲**。house rule：过冲（`--ease-spring-sheet`）只留给手势带速度的场景，点击导航不属于 |
| 延迟 | 90ms / 每块 +60ms | 层次感；超过 150ms 用户会感觉到「卡」 |

**注意点**

- `transform` 会让元素成为**包含块**。如果未来转账 surface 里出现 `position: fixed` 的元素（比如全屏 loading），会被这个 `transform` 困住。当前 surface 全是静态布局，安全。
- **不写 `will-change`**。一次性入场动画浏览器会在动画期间自动提升合成层，动画结束后自动回收；手写 `will-change` 会让层常驻。
- `both` 是必要的：延迟的 90ms 里卡片保持在 `opacity: 0`，否则会先闪一下再滑。

## C.2 列表错峰入场（`--i` + `calc()`，零 JS 循环）

**JSX 侧只加一个内联自定义属性**（React 支持在 `style` 对象里写 CSS 自定义属性）：

```jsx
// product.jsx — Tx 组件
const Tx = ({ t, i }) => (
  <li className="tx-row tx-row--enter" style={{ '--i': i }}> … </li>
);
// 调用处
{rows.map((t, i) => <Tx key={t.id} t={t} i={i} />)}
/* 订阅同理：{d.subscriptions.map((s, i) => <li style={{ '--i': i }} …>)} */
```

**CSS 侧**：

```css
@keyframes row-in {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to   { opacity: 1; transform: none; }
}
.tx-row--enter, .sub-list > .sub-row {
  animation: row-in 320ms var(--ease-spring) both;
  /* var(--i, 0)：--i 缺失时 calc 会整条失效（custom property 的 guaranteed-invalid 规则），
     所以必须给兜底值。min(…, 8)：第 9 项起不再累加，25 行的列表总尾巴也只有 320ms。 */
  animation-delay: calc(min(var(--i, 0), var(--stagger-max)) * var(--stagger-step));
}
```

**为什么这样写是对的**

- **`--i` 必须是无单位纯数字**（`style={{'--i': i}}` 传数字，React 不会加单位），`calc(var(--i) * 40ms)` 才是合法乘法。
- **`min(var(--i,0), 8)` 是关键的一行。** 不封顶的话，账单页 25 行 × 40ms = 最后一行 1 秒后才出现，用户会觉得「页面卡住了」。
- **重渲染行为**：React 按 `key` 复用 DOM 节点，CSS 动画绑在元素创建上而不是渲染上。所以筛选分类时，已存在的行**不会重播**，只有真正新增的行会动画。这正是想要的行为 —— 不要为了「筛选也重播」去改 `key`，那会让整张列表销毁重建，丢失焦点和滚动位置。
- **路由切换时整页重挂**，所有行会一起错峰入场，所以概览 → 账单的切换自带节奏感，不需要额外代码。
- **不要**用 `nth-child` 写 8 条 `animation-delay` 规则：那是 8 行 CSS 做 1 行 CSS 的事，而且第 9 行之后就没有了。

## C.3 数字滚动增长（金额从 0 涨到目标值）

### 结论：**用 JS（rAF + 直接写 DOM），不用 CSS。**

| | JS · `requestAnimationFrame` | CSS · `@property` + `counter()` |
|---|---|---|
| 千分位 / ¥ / 小数位 | ✅ 任意格式（走现成的 `money()`，`bank.js:3`） | ❌ `counter()` 只能输出**裸整数**，插不了分隔符 |
| 依赖 | 0 | 0 |
| 浏览器支持 | 全部 | `@property` Chrome 85+ / Safari 16.4+ / FF 128+ |
| 目标值动态 | ✅ 任意 | ❌ 关键帧里的 `--n: 128000` 是写死的，一笔一转就要重建一个 keyframes |
| 与 React 集成 | 需要 `ref` | 纯 CSS |
| 降级 | 直接落终值，1 行 | 需额外 `@media` 覆盖 |
| **裁决** | **采用** | 只在「纯装饰、无格式需求」的进度数字上考虑 |

### 实现（14 行）

```js
/**
 * 金额滚动增长。零依赖。
 * 关键决策：直接写 textContent，不走 setState —— 每帧 setState 会重建整棵子树。
 * 降级：prefers-reduced-motion 时直接落终值，不滚。
 */
export function useCountUp(ref, target, format, ms = 700) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = format(target); return; }
    const from = Number(el.dataset.v || 0);
    let raf, t0 = 0;
    const tick = now => {
      t0 ||= now;
      const t = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - t) ** 3;                 // easeOutCubic
      el.textContent = format(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick); else el.dataset.v = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, target, ms, format]);                      // format 必须 useCallback 稳定，否则每帧重启
}
```

用法（余额主卡）：

```jsx
const ref = useRef(null);
const fmt = useCallback(n => '¥' + money(Math.round(n)), []);
useCountUp(ref, ctx.dataModel.balance, fmt);
<strong ref={ref}>¥0.00</strong>
```

**注意点**

1. **`format` 必须是稳定引用**（`useCallback` / 模块级常量）。写内联箭头函数会让 `useEffect` 每帧重跑，动画永远停在第一帧。
2. **必须保留 `font-variant-numeric: tabular-nums`。** 现有 CSS 已经在 `.balance-hero > strong`（`app.css:375`）、`.stat-num`（`:399`）、`.tx-row b`（`:418`）、`.bank-card-num`（`:463`）四处写了【仓库实测】—— 这是对的，**滚动时不能去掉**，否则数字宽度每帧变化，整行文字左右抖。
3. **无障碍**：滚动中的数字对屏幕阅读器是连续的 DOM 变更噪音。给容器显式加 `aria-live="off"`，并在滚动结束后把最终值放到一个 `aria-live="polite"` 的隐藏节点里播报一次。
4. 起始值取上一次的值（`el.dataset.v`）而不是 0：转账后余额从 12860.50 涨到 9860.50，比从 0 涨上去更有信息量。
5. 时长 600–800ms。超过 1s 用户会盯着数字等它停，那是负体验。

## C.4 全局补丁：修 `tokens.css` 降级规则的缺口

`tokens.css:184-190` 的全局规则**没有重置 `animation-delay`**【仓库实测】。后果：错峰入场在降级模式下，第 9 行仍然要先隐形 `8 × 40ms = 320ms` 再瞬间弹出。

补在 `tokens.css` 的 `@media (prefers-reduced-motion: reduce)` 块里：

```css
@media (prefers-reduced-motion: reduce) {
  /* 位移/缩放入场在降级下应「直接到位」，不是「先隐形再弹出」 */
  .page-head, .page-body > *, .page .a2ui-surface,
  .tx-row--enter, .sub-list > .sub-row, .surface-enter {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

原则（原文见 `tokens.css` 注释：「reduced motion means gentler, not none」）：**降级不是删掉动效，是换成一个不动的、但语义等价的版本**。所以云保留「抬高 2px + 小影子」的静态态、均衡器保留「冻住的波形」，而扫光是纯装饰，直接消失。

---

# D. ZA Bank 卡面拆解

## D.0 素材与量法

- 素材：`doc/research/_raw/za-shots/shot3.png`（App Store HK 站官方截图第 3 张，900×1600，PNG）【实测】
- 量法：本会话自写 Node PNG 解码器（`zlib.inflateSync` + 逐行反滤波：None/Sub/Up/Average/Paeth 全实现），逐像素读取；不是目测。
- 标尺：截图中手机内容区宽 **674px**，对应 393pt（iPhone 15/16 逻辑宽），即 **1.715 px/pt**【实测】
- 卡面外接框：**x 135–765，y 760–1137**【实测】

## D.1 几何（全部实测）

| 项 | px | pt | 占比 |
|---|---|---|---|
| 卡面尺寸 | **631 × 378** | **367.9 × 220.4** | — |
| **宽高比** | **1.6693** | | （ISO ID-1 实体卡是 1.5858；**ZA 比实体卡更宽**） |
| 圆角半径 | **≈34**（拟合 4 个角，圆的 R=34 与实测内缩量吻合到 ±1px） | **19.8** | **5.39% 卡宽** / 9.0% 卡高 |
| 左边距（文字） | 36 | **21.0** | 5.71% 卡宽 |
| 左边距（logo 圆） | 29 | 16.9 | 4.60% 卡宽 |
| 上边距（logo 圆） | 31 | 18.1 | 8.20% 卡高 |

**圆角拟合过程**（用来证明 34 这个数不是拍的）：取底部左侧角，逐行测「绿色起点相对卡片左缘的内缩量」：

| dy(px) | 0 | 4 | 8 | 12 | 16 | 24 | 32 |
|---|---|---|---|---|---|---|---|
| 实测内缩 | 32 | 19 | 13 | 9 | 6 | 2 | 0 |
| 圆 R=30 预测 | 30 | 15.0 | 9.6 | 4.5 | 3.5 | — | 0.06 |
| **圆 R=34 预测** | 34 | **18.0** | **12.1** | 7.0 | **5.2** | **1.5** | **0.06** |

R=34 在 5 个采样点上全部吻合（±1px），R=30 明显偏小。【实测】

## D.2 渐变（实测 + 最小二乘拟合）

对卡片内部**排除文字/边缘后剩下的 90,342 个平坦像素**做最小二乘拟合 `v = a + b·u + c·v`（u、v 为 0–1 归一化坐标）【实测】：

| 通道 | a（左上角） | b（横向全宽变化） | c（纵向全高变化） |
|---|---|---|---|
| R | 81.34 | −17.88 | −6.40 |
| G | 249.74 | −15.41 | −5.51 |
| B | 185.09 | −6.08 | −2.18 |

**四角外推值**：

| | 左上 | 右上 | 左下 | 右下 |
|---|---|---|---|---|
| 拟合值 | **#51FAB9** | #3FEAB3 | #4BF4B7 | **#39E5B1** |
| 本会话对 `shot3.png` 的直接像素采样 | #4CF5B7 @(50,50) | #40EBB3 @(50,−50) | #4AF4B7 @(−50,50) | **#3CE8B2** @(−50,−50) |
| 前次研究 `za-bank-product-layer.md:225` 独立测得 | **#50f9b9** | — | — | **#3ae6b1** |

**三组独立测量在 ±2/255 内吻合。** 这组数字可以放心用。

**方向**：拟合出的 `c/b` 在三通道上**完全一致**（R 0.358、G 0.358、B 0.359），说明这确实是一条**严格线性**的渐变，没有第二个叠加层。

- 归一化坐标下的斜率 → 像素空间斜率 `dy/dx = (5.95/378) ÷ (16.64/631) = 0.597`
- 换 CSS 角度：`90° + atan(0.597) = 120.8°`
- 而 631×378 的**角对角**角度 = `180° − atan(631/378) = 120.94°` —— **完全吻合**

**结论：ZA 卡面用的是 `to bottom right`（角对角），不是 `135deg`。**
`to bottom right` 是 CSS 里唯一**自适应任意宽高比**角对角的写法。写死 `135deg` 在宽卡上会让渐变提前跑完，在窄卡上跑不满。

## D.3 高光 / 纹理（实测：**没有**）

这是本次测量最反直觉、也最该记住的一条。

对上述 90,342 个平坦像素算「实测值 − 线性模型预测值」的残差：

| 指标 | 实测 |
|---|---|
| **最大 \|残差\|** | **1.37 / 255** |
| 残差 > 2/255 的样本占比 | **0.00%** |
| G 通道灰度极差 | 230 – 249（模型预测 229 – 250） |

**ZA Card 卡面 = 一层两停靠线性渐变，零高光、零纹理、零噪点、零内阴影、零描边。** 残差 1.37/255 完全在 PNG 量化误差范围内。

> **这条推翻了「高级卡面 = 高光 + 玻璃感」的直觉。** 网上大量「信用卡 CSS」教程都在加 `::before` 白色斜光、`repeating-linear-gradient` 纹理、碳纤维底纹 —— ZA 一个都没用，而它是港区第一数字银行、iF Design 获奖产品。
> **质感来自「干净 + 比例对 + 排版克制」，不是来自叠层。**

## D.4 排版与品牌元素（实测）

| 元素 | 位置（相对卡片） | 尺寸 | 颜色实测 |
|---|---|---|---|
| **白圆 logo** | 左 4.6% / 上 8.2% | 直径 78px = **45.5pt = 12.4% 卡宽** | 圆内 #E6FEF5（近白偏薄荷），内嵌深色 ZA 标记 |
| **持卡人行** `*** Zappy` | y 36.8% – 42.3%；x 从 5.7% 起 | 行高 21px ≈ 12.2pt | 最深像素 #194F48 |
| **卡号** `4480 6060 **** ****` | y 46.3% – 54.2% | 字高（数字 cap height）**30px ≈ 17.5pt** → 字号推算 **≈43px = 25pt = 6.8% 卡宽** | 最深像素 #0C252C |
| **底部标签** `有效期` / `CVV` | y 73.0% – 80.4% | 21px ≈ 12.2pt | 最深 #184E48 |
| **底部数值** `***` / `***` | y 82.0% – 89.7% | — | — |
| **VISA 字标** | 右内边距 **22.7pt** / 下内边距 **22.2pt** | **117 × 37px = 68.2 × 21.6 pt = 18.5% 卡宽** | 最亮 #CDFAEB（薄荷底上约 72% 不透明的白） |

**垂直节奏**（占卡高）：logo 顶 8.2% → 持卡人 37–42% → 卡号 46–54% → 底部标签 73–80% → 数值 82–90% → 底部留白 10%。
读法：**上半张卡（0–55%）放身份，下半张卡（73–90%）放凭证，中间 55–73% 是刻意的空档。** 这个空档就是「贵」的来源 —— 换任何一版教程式的卡片设计，都会把中间填满。

**底部左右分栏**：左侧 `有效期 | CVV` 两列并排，**右侧 VISA 独占**，与左侧同一条基线上。

## D.5 纯 CSS 复刻方案

### 令牌（写进 `tokens.css`）

已在 §A.1 给出：`--card-0-a/-b`（ZA 实测薄荷）、`--card-1-a/-b`（品牌蓝紫）、`--card-2-a/-b`（墨黑）、`--card-gloss`、`--card-frost`。

### 结构（改 `product.jsx:169-174` 的 `Cards`）

```jsx
<div className={'bank-card bank-card--' + i + (c.status === 'frozen' ? ' frozen' : '')} key={c.id}>
  <div className="bank-card-top">
    <span className="bank-card-logo" aria-hidden="true">青</span>
    <span className="bank-card-brand">青禾<em> BANK</em></span>
  </div>
  <strong className="bank-card-num">
    ••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;{c.tail}
  </strong>
  <div className="bank-card-foot">
    <span className="bank-card-field"><i>持卡人</i><b>CARD HOLDER</b></span>
    <span className="bank-card-field"><i>有效期</i><b>••/••</b></span>
    <span className="bank-card-mark" aria-label="Visa">VISA</span>
  </div>
</div>
```

### CSS（可直接替换 `app.css:451-464`）

```css
/* ══ 卡面 ══════════════════════════════════════════════════════════════
   尺寸/圆角/内边距/渐变方向全部来自 shot3.png 逐像素实测，见 §D.1–D.4 */
.bank-card {
  position: relative; overflow: hidden; isolation: isolate;
  aspect-ratio: 1.669;                       /* 实测 631×378，不是 ISO 的 1.586 */
  border-radius: 20px;                       /* 实测 5.39% × 368pt ≈ 19.8pt */
  padding: 18px 21px 20px;                   /* 实测左内边距 21pt */
  display: flex; flex-direction: column; justify-content: space-between;
  color: var(--accent-on);
  font-variant-numeric: tabular-nums;
  /* ↑ 角对角渐变。CSS 的 to <corner> 本身就是角对角，且自适应任意宽高比，
     等价于在 1.669 比例下的 121°。不要写 135deg。 */
  background: linear-gradient(to bottom right, var(--card-0-a), var(--card-0-b));
  box-shadow: var(--shadow-card);            /* 内容层，不用 --shadow-panel */
  transition: transform var(--duration-base) var(--ease-out-quart),
              box-shadow var(--duration-base) var(--ease-out);
}

/* ── 高光层（ZA 实测没有这一层，这是我们主动加的一层；不需要时删掉这条即可）── */
.bank-card::before {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: var(--card-gloss);
  mix-blend-mode: soft-light;                /* 只加光，不改变基底色相 */
}
.bank-card > * { position: relative; z-index: 1; }

/* ── 上半：身份区 ─────────────────────────────────────────────────── */
.bank-card-top { display: flex; flex-direction: column; gap: 6px; }
.bank-card-logo {
  width: 44px; height: 44px;                 /* 实测 12.4% × 368pt ≈ 45.6pt */
  display: grid; place-items: center; margin-bottom: 6px;
  border-radius: 50%;
  background: var(--accent-on); color: var(--card-0-b);
  font-size: 20px; font-weight: 600; line-height: 1;
}
.bank-card-brand { font-size: var(--text-footnote); font-weight: 600; opacity: .95; }
.bank-card-brand em { font-style: normal; font-weight: 400; opacity: .8; }

/* 持卡人行：实测 y 36.8%–42.3% */
.bank-card-holder { font-size: var(--text-caption-1); opacity: .92; letter-spacing: .01em; }

/* 卡号：实测字号 ≈25pt = 6.8% 卡宽 → 368pt 宽时约 25px */
.bank-card-num {
  font-size: 22px; font-weight: 600; letter-spacing: .045em; line-height: 1.15;
}

/* ── 下半：凭证区（实测 y 73%–90%）──────────────────────────────── */
.bank-card-foot { display: flex; align-items: flex-end; gap: var(--space-7); }
.bank-card-field { display: flex; flex-direction: column; gap: 1px; }
.bank-card-field i { font-style: normal; font-size: var(--text-caption-2); opacity: .82; }
.bank-card-field b { font-size: var(--text-footnote); font-weight: 600; letter-spacing: .06em; }
/* VISA：实测右/下内边距 22.5pt、宽度 18.5% 卡宽 */
.bank-card-mark {
  margin-left: auto;
  font-size: 17px; font-weight: 800; font-style: italic; letter-spacing: -.02em;
  opacity: .78;
}

/* ── 卡 1 / 卡 2 配色 ─────────────────────────────────────────────── */
.bank-card--1 { background: linear-gradient(to bottom right, var(--card-1-a), var(--card-1-b)); }
.bank-card--2 { background: linear-gradient(to bottom right, var(--card-2-a), var(--card-2-b)); }

/* ── 冻结：换墨黑 + 斜纹，不用 filter: grayscale ─────────────────────
   原来的 filter: grayscale(.85) 会把整张卡（含文字）压成灰，看起来像 bug */
.bank-card.frozen { background: linear-gradient(to bottom right, var(--card-2-a), var(--card-2-b)); }
.bank-card.frozen .bank-card-num,
.bank-card.frozen .bank-card-logo { opacity: .35; }
.bank-card.frozen::after {
  content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: repeating-linear-gradient(115deg, transparent 0 10px, var(--card-frost) 10px 11px);
}

/* ── hover：抬起 + 高光层扫过（复用 §B.2 的 sheen-sweep）──────────── */
@media (hover: hover) {
  .bank-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lift); }
  .bank-card:hover::before { animation: sheen-sweep 1100ms var(--ease-out) 1 both; }
}
/* 键盘/触屏无法 hover 时也要有静态态 */
.bank-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  .bank-card { transition: none; }
  .bank-card:hover { transform: none; }
  .bank-card:hover::before { animation: none; }
}
```

### 自适应与「放大/缩小都不崩」的注意点

1. **`aspect-ratio: 1.669` 是唯一驱动尺寸的量**，配 `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`（现有 `.bank-card-grid`，`app.css:450`），卡宽在 **260–410px** 之间浮动。
2. **尺寸用固定 px 是可以的**，因为渲染宽度天然落在 260–410px，而 ZA 的卡是 368pt —— 两者量级重合，1px ≈ 1pt。上面的圆角 20 / 内边距 21 / logo 44 / 卡号 22 就是按 368px 换算的实测值。
3. **要真正按比例缩放（比如将来做全屏卡片详情）**，用容器查询单位。⚠️ **有一个容易踩的坑**：`cqi` 在元素**自身**上不解析自己的尺寸，只解析**最近的祖先容器**。所以不能写 `.bank-card { container-type: inline-size; border-radius: 5.4cqi }` —— 那样 `5.4cqi` 会落到视口宽度上，卡会变成圆角 20+ px 的怪物。正确写法是**套一层壳**：

   ```css
   .bank-card-shell { container-type: inline-size; }
   .bank-card-shell .bank-card      { border-radius: 5.4cqi; padding: 4.9cqi 5.7cqi 5.4cqi; }
   .bank-card-shell .bank-card-logo { width: 12.4cqi; height: 12.4cqi; }
   .bank-card-shell .bank-card-num  { font-size: 6.8cqi; }
   .bank-card-shell .bank-card-mark { font-size: 4.6cqi; }
   ```
4. **卡号排版**：等宽数字 + `letter-spacing: .045em`。ZA 实测卡号四组之间是**空格**而非点或横线（`4480 6060 **** ****`）。用 `&nbsp;` 保持现有结构即可，别改成 `-` 或 `/`。
5. **不要在卡上加 `.a2ui-btn` 那种 `:active { transform: scale(.96) }`** —— 卡不是按钮。要可点就在外层包 `<button>`，并把 `transition` 提到外层。

---

# E. 动效设计原则（速查表）

## E.1 什么该动、什么不该动

| 该动 | 不该动 |
|---|---|
| 状态**变化**的瞬间（进场、切换、出现新东西） | 静止内容（正文、标题、导航栏、面板底色） |
| 用户的**主动动作**的反馈（hover、按压、拖拽） | 用户没碰的东西 |
| 需要**解释关系**的场合（从哪来、到哪去、和谁一类） | 纯装饰的常驻循环 |
| 需要**引起注意**的极少数场合（新交易、错误） | 任何会改变布局的东西（width/height/top/left/margin/font-size） |
| 帮助理解**数量/进度**（数字滚动、进度条） | 会遮挡内容的位移 |

## E.2 时长 / 缓动 / 属性 速查

| 场景 | 时长 | 缓动 | 属性 | 允许无限循环 | 参考实现 |
|---|---|---|---|---|---|
| 按压反馈 | 100ms（`--duration-instant`） | `--ease-out` | `transform: scale(.96)` | 否 | `app.css:189` 已有 |
| hover 微动 | 150–220ms（`--duration-fast`） | `--ease-out-quart` | transform / opacity | 否 | §A.3 |
| 行错峰入场 | 320ms + `i×40ms`（封顶 8） | `--ease-spring` | transform + opacity | 否 | §C.2 |
| 卡片 / 页面滑入 | 300–450ms | `--ease-spring` | transform + opacity | 否 | §C.1 |
| 浮层 / 抽屉 | 450ms 进 / 260ms 出 | `--ease-spring` | transform + opacity | 否 | `tokens.css` 已有令牌 |
| 分类签名动效 | 900–1600ms | `--ease-in-out` | transform | **仅 `:hover` 期间** | §A.3 |
| 云漂浮 | 2800ms | `--ease-in-out` | transform + opacity | **仅 `:hover` 期间** | §B.1 |
| 光影扫过 | 880ms（一次性） | `--ease-out` | transform + opacity | 否 | §B.2 |
| 音乐律动 | 720ms / 错峰 110ms | `--ease-in-out` | **`scaleY`** | **仅 `:hover` 期间** | §B.3 |
| 数字滚动 | 600–800ms | easeOutCubic | `textContent` | 否 | §C.3 |

## E.3 八条硬规则

1. **只动 `transform` 和 `opacity`。** 其它属性（`width`/`height`/`top`/`left`/`margin`/`box-shadow`/`background-position`/`filter`）要么触发布局、要么触发重绘。本方案里**没有一处违反**。
2. **时长上限**：一次性动效 **≤ 450ms**；hover 微动 **≤ 220ms**；循环动效周期 **≥ 700ms**（再快就像故障灯）。
3. **缓动上限**：进场统一 `--ease-spring`。**过冲只在手势带速度时允许**（house rule，见 `tokens.css` 注释）。永远不要用浏览器默认的 `ease` —— 那条曲线是「塑料感」的第一来源。
4. **数量上限**：一屏同时运动的元素 **≤ 3 组**；常驻无限循环 **≤ 1 处**，且**必须**被 `:hover` / `:focus-visible` / `:focus-within` 限定。
5. **`will-change` 的取舍**：只在「动画马上要发生、且元素数量可控（≤3）」时写，并且**写在状态选择器里而不是基类里**。写在 `.tx-icon` 这种会被复制 25 份的基类上 = 25 个常驻合成层 = 纯内存浪费。
6. **`prefers-reduced-motion` 是换版本，不是删掉。** 保留静态等价的语义（云抬高 2px、波形冻住），去掉纯装饰（扫光）。**并且要给 `animation-delay` 显式兜底** —— `tokens.css` 现有的全局规则没有覆盖它（§C.4）。
7. **`:hover` 不是唯一的触发面。** 每一条 hover 动效都要配一个 `:focus-within` / `:focus-visible` 等价物，否则键盘用户完全看不到这套视觉语言。
8. **永不动的**：金额数字（除滚动增长的那一次）、正文文本、滚动容器的背景、导航栏、任何会改变阅读位置的东西。

## E.4 廉价感的四个来源（照着删）

| 廉价信号 | 为什么廉价 | 本方案里的对应 |
|---|---|---|
| ① hover 动效时长 > 500ms | 鼠标已经移开了动画还没走完，像卡顿 | 全部 ≤ 220ms（除了刻意的循环动效） |
| ② 同屏 > 3 处循环 | 眼睛不知道该看哪里，像圣诞树 | 循环动效全部 `:hover` 限定，任意时刻 ≤ 1 处 |
| ③ 缓动是默认 `ease` 或 `linear` | 默认贝塞尔起步太慢、收尾太软 | 全部走 `--ease-spring` / `--ease-out-quart` |
| ④ 「阴影 + 缩放 + 旋转」三件套糊在同一个元素上 | 元素在同时做三件事，视觉上在「挣扎」 | 每个 hover 只做**一件事**：要么位移、要么缩放、要么旋转 |

**第五条（本方案新增）**：**给卡片叠高光/纹理/玻璃。** ZA Card 实测残差 1.37/255，证明「干净的纯渐变 + 正确的比例 + 克制的排版」就足够。叠层是加分项，不是及格线。

## E.5 验收清单（做完对着打勾）

- [ ] `tokens.css` 里新增了 §A.1 的全部令牌，**组件 CSS 里 grep 不到 `#` 开头的颜色**
- [ ] 六个分类在**列表行**里颜色/图标/底座形状三者都不同
- [ ] 餐饮至少 4 家不同餐厅能看出不同的图标 + 不同的颜色
- [ ] 云 / 视频 / 音乐三行的 hover 动效各自成立，且**鼠标移开就停**
- [ ] 从「概览」点「转账」，卡片是**滑入**的，页头和卡片有 90ms 层次差
- [ ] 账单列表入场是**错峰**的，且第 9 行之后不再累加延迟
- [ ] 卡片改为 `aspect-ratio: 1.669` + `linear-gradient(to bottom right, …)`
- [ ] 冻结态是墨黑 + 斜纹，**不再用 `filter: grayscale()`**
- [ ] `matchMedia('(prefers-reduced-motion: reduce)')` 下手动跑一遍：无隐形等待、无塌成一条线的均衡器、扫光消失
- [ ] `npm run build` 通过；`npm test` 通过（注意 §A.4 的两条断言）
- [ ] `npm run test:e2e` 通过（`tests/e2e.mjs:29` 断言欢迎页 4 张建议卡，没动就别动）

---

# 附：开源引用（`gh api` 本会话实测）

| 项目 | URL | ★ | License（`gh api` 返回值） | 本报告的用法 |
|---|---|---|---|---|
| **lucide-icons/lucide** | <https://github.com/lucide-icons/lucide> | **24,750** | `NOASSERTION`（仓库 `LICENSE` 正文首行实测为 `ISC License`【实测】） | 唯一图标来源。项目已装 `lucide-react@0.468.0`，共 **5234** 个导出符号，本文图标名逐个实测 |
| IanLunn/Hover | <https://github.com/IanLunn/Hover> | 29,403 | `NOASSERTION`（未逐字核对 LICENSE 正文） | hover 动效的**命名与参数**参考；未复制代码 |
| animate-css/animate.css | <https://github.com/animate-css/animate.css> | 82,835 | `NOASSERTION`（未逐字核对） | keyframes 时长档位参考；未复制代码 |
| michalsnik/aos | <https://github.com/michalsnik/aos> | 28,053 | `MIT` | 「错峰 delay」的语义参考；未复制代码 |
| argyleink/open-props | <https://github.com/argyleink/open-props> | 5,528 | `MIT` | 缓动/时长令牌的命名风格参考；未复制代码 |

> 本报告**不新增任何依赖**，不复制上述项目的代码。引用仅为参数与命名提供外部依据。
> ZA Bank 的卡面数据来自官方 App Store 截图（`doc/research/_raw/za-shots/shot3.png`）的逐像素测量，属于事实性参数提取，不涉及素材再分发。

---
---

# 浓缩版（≤80 行）

```
【A · 分类视觉语言】
1. 根因：6 个分类共用 --fill-3 灰底 + 2 个箭头图标 → 账单像一条灰色流水线。先建色，再谈动效。
2. 两类底座形状（借 ZA「动作 vs 产品」双语言）：
   圆 形 = 动作 → 转账 ArrowLeftRight / 收入 TrendingUp
   圆角方 = 对象 → 餐饮 UtensilsCrossed / 购物 ShoppingBag / 交通 CarFront / 订阅 Repeat
3. 新增 tokens.css 令牌（唯一允许出现 hex 的地方）：
   --cat-transfer #0088ff  --cat-dining #ff8d28  --cat-shopping #ff2d92
   --cat-transport #30b0c7 --cat-subscribe #5e5ce6 --cat-income #34c759
   + 各自 12% 淡底用 color-mix(in srgb, var(…) 12%, transparent) 派生
4. 餐饮「不同餐厅不同呈现」= 图标靠关键词(9 行正则) + 配色靠哈希(1 行)：
   const hash = s => [...s].reduce((h,c)=>(h*31+c.codePointAt(0))>>>0, 7);
   diningLook = n => hash(n) % 6        // 同一家店永远同色 = 被感知的性质
   不建「商户→品牌色」映射表：那是永不收敛的运营数据。
5. hover 签名动作（全部 @media (hover:hover) + 只动 transform）：
   转账 对流 ±2px 往复 / 餐饮 抬盘 上浮3px+倾斜−8° / 购物 提袋晃 ±9°（origin 50% 12%）
   交通 前行 右移4px 一次性 / 订阅 走 B 的三条 / 收入 生长 上浮3px 淡入
6. 图标名全部实测存在于 lucide-react@0.468.0（5234 个导出）。
   核对失败 4 个不要用：Hamburger / Bottle / CookingPan / BanknoteArrowDown

【B · 三条动效】
1. 云漂浮：@keyframes cloud-float 0/100% translate3d(0,0,0) scale(1) → 50% translate3d(0,-4px,0) scale(1.07)
   周期 --dur-float 2800ms / --ease-in-out / infinite，挂 :hover。
   加一枚 ::after 云影（scale 1→.72, opacity .38→.16，同周期）—— 没影子像贴纸。
   降级：静止版（云抬高 2px + 影缩到 .82），animation: none。
2. 光影扫过：.sub-row--video { position:relative; overflow:hidden; isolation:isolate }
   ::after { inset:0; background: var(--sheen-video); transform: translate3d(-130%,0,0) skewX(-14deg); opacity:0 }
   @keyframes sheen-sweep → translate3d(130%,0,0)，880ms / --ease-out / 延迟 60ms / both。
   绝不用 background-position 动画（每帧重新光栅化，跑主线程）。
3. 音乐律动：<span class="eq"><i/><i/><i/><i/></span>，i 宽 2.5px 高 100%，transform-origin 50% 100%
   @keyframes eq-bounce: scaleY(.30) → scaleY(1)，720ms，错峰 0/110/220/330ms，infinite，挂 :hover。
   用 scaleY 不用 height（height 每帧布局）。静态态写成冻住的波形（.42/.86/.58/.74）。
   ⚠️ 绝不能加 fill-mode: both —— tokens.css 的全局降级会把 duration 压到 .01ms，both 会让四条全塌平。

【C · 通用配方】
1. surface 滑入：@keyframes surface-in from{opacity:0; translate3d(0,16px,0) scale(.985)} to{none}
   .page-head 300ms --ease-spring；.page .a2ui-surface 450ms 延迟 90ms（转账卡片）
   路由切换自动重挂 → CSS 自动重放，零 JS。
2. 列表错峰：<li style={{'--i': i}}>（React 支持内联自定义属性，无需 JS 循环）
   animation-delay: calc(min(var(--i, 0), 8) * 40ms);
   var(--i,0) 的兜底必需；min(…,8) 封顶必需，否则 25 行要等 1 秒。
3. 数字滚动：用 JS（rAF 直接写 el.textContent），不用 CSS @property + counter()
   决定性理由：counter() 输出裸整数，加不了千分位、加不了 ¥、控不了小数位。
   14 行；format 必须 useCallback 稳定；必须保留 tabular-nums，否则宽度每帧抖。
   无障碍：滚动结束把终值放进 aria-live="polite" 播报一次。
4. 补 tokens.css 缺口：全局 reduced-motion 规则没有重置 animation-delay，
   错峰列表会「先隐形 320ms 再瞬间弹出」。需显式 animation: none !important 覆盖。

【D · ZA Card 卡面（shot3.png 逐像素实测，1.715 px/pt）】
尺寸 631×378px = 367.9×220.4pt → 宽高比 1.6693（不是 ISO 的 1.586）
圆角 ≈34px = 19.8pt = 5.39% 卡宽（圆 R=34 拟合 5 个采样点全中，R=30 明显偏小）
渐变 左上 #51FAB9 → 右下 #39E5B1，三组独立测量 ±2/255 内吻合
方向 像素斜率 dy/dx = 0.597 → CSS 120.8°，正好等于 631×378 的角对角 120.94°
     ⇒ 用 linear-gradient(to bottom right, …)，自适应任意宽高比。现有 135deg 是错的。
高光 ZA 卡面残差最大 1.37/255，>2/255 占比 0.00% ⇒ 零高光零纹理零噪点。
     质感来自「干净 + 比例对 + 排版克制」，不来自叠层。
排版 白圆 logo 直径 12.4% 卡宽 / 内边距左 21pt 上 18pt
     持卡人 y 37–42% · 卡号 y 46–54%（字号 ≈25pt = 6.8% 卡宽）
     底部标签 y 73–80% · 数值 y 82–90% · 中间 55–73% 是刻意的空档
     VISA 68.2×21.6pt，右/下内边距各 22.5pt ≈ 18.5% 卡宽
复刻 .bank-card { aspect-ratio:1.669; border-radius:20px; padding:18px 21px 20px;
       background: linear-gradient(to bottom right, var(--card-0-a), var(--card-0-b)) }
     高光层 ::before 用 var(--card-gloss) + mix-blend-mode: soft-light（ZA 没有这一层，是我们加的）
     冻结态改墨黑 + 斜纹，别再用 filter: grayscale(.85)
     ⚠️ cqi 不解析元素自身尺寸，要按比例缩放必须套一层 container-type: inline-size 的壳

【E · 原则】
1 只动 transform / opacity        2 一次性 ≤450ms、hover ≤220ms、循环周期 ≥700ms
3 进场一律 --ease-spring，禁用默认 ease  4 同屏运动 ≤3 组、常驻循环 ≤1 处且必须 hover 限定
5 will-change 只写在状态选择器里，不写在会被复制 N 份的基类上
6 reduced-motion 是换版本不是删：保留语义（云抬高、波形冻住），去掉装饰（扫光）
7 每条 hover 都要配 :focus-within 等价物      8 永不动的：金额、正文、导航、滚动背景
廉价感四源：hover >500ms / 同屏 >3 处循环 / 缓动是 ease / 阴影+缩放+旋转三件套糊一个元素

【约束提醒】
· 零新增依赖（只用已装的 react/react-dom/lucide-react/vite/@playwright/test）
· 组件 CSS 零颜色字面量，新增 hex 只进 tokens.css
· 扩餐饮样例数据会打断 tests/bank.test.js:10（length===8）与 :21（spending===474200），必须同步更新
· 不修改 src/ 下任何代码 —— 本文只给方案
```
