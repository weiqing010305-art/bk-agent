# 众安银行（ZA Bank）产品层拆解 · 港澳新虚拟银行对标 · 开源实现 · 落地建议

> **项目**：bk-agent /「青禾 · 银行 AI 资金管家」
> **目标**：为「产品层」（概览、账单、订阅、卡片、转账等正常银行 App 界面）提供可直接落地的设计依据
> **证据等级约定**：本文所有数字标注来源。`【实测】`= 本次会话真实抓取/逐像素测量所得；`【官方原文】`= 官方页面原文引用；`【未能证实】`= 查不到，明确不编造。
> **抓取方式**：`web_fetch` / `web_search` / `gh` CLI / 自写 PNG 解码器（Node `zlib` 反过滤后逐像素取色与量距）。
> **原始素材**：`doc/research/_raw/za-bank-product-layer-notes.md`、截图在 `doc/research/_raw/za-shots/`。

---

## 0. 结论速览

十二条最值钱的结论，按可落地性排序：

1. **ZA 首页的排序原则是官方公开的**：「將你最關心的、正在發生的、你最想做的，由上至下排序」。整页只有 3 段：**总资产 → 8 个快捷入口 → 動態流水**。对照我们现在的概览页有 6 段，明显超载。
2. **首页快捷区是 4×2 八宫格，但用了两种图标语言**：第一行 4 个是**动作**（实心绿圆 + 白线图标），第二行 4 个是**产品**（彩色品牌图标）。同一网格里不加一行文字就分开了「我要办事」和「我要去看某个东西」。这是全篇最值得抄的一招。
3. **我找到了 ZA Bank 自己的设计令牌文件**（`--zad-*`，zad = ZA Design），84 个令牌。它的绿色不是一种绿，是**一条角色坡道**：`#39e5b1` 强调 / `#00b880` 选中 / `#00d28f` 品牌。
4. **ZA 的全部中性色是同一个基色 `#030516` 的不同 alpha**（0.8 / 0.64 / 0.35 / 0.22 / 0.08）。**注意：算过账之后发现我们的灰阶梯本来也是「单基色 + alpha」结构**（§D.5 有完整推算），所以真正差别不在策略，而在**基色的色相** —— ZA 是海军蓝黑（蓝通道是红的 7.3 倍），我们是中性黑。
5. **ZA 几乎不用阴影**：484,855 字节 CSS 里只有 **3 个不同的 box-shadow 值、合计 6 条声明**。卡片层级靠白卡浮在 `#f6f6fb` 页底上这个不到 9/255 的色差 + 圆角 + 间距。我们的 tokens.css 有 6 个阴影令牌 + 玻璃阴影 —— 这是一次净删除机会。
6. **ZA 正文基准是 16px / 行高 24px（1.5），全库 0 条 letter-spacing**。我们用 Apple 的 17px / 1.29 / `-0.026em`。对中文 + 数字密集的账目界面，ZA 那套更耐读。
7. **英雄金额实测：字高 28pt、宽占屏 44%、圆盘直径 55pt**。金额字号约 **40pt —— 比 Apple 最大的 LargeTitle（34pt）还大一档**。这是故意的：打开 App 第一眼只需要看清一个数。
8. **ZA 最著名的交互决策是「5 秒转账缓冲」**：提交后 5 秒倒计时，可撤销。解决的痛点是「错手转账」，成本极低。我们现在的转账流程没有这个。
9. **「動態」是交易 + 账户活动 + 通知三流合一**，并能按消费/贷款/收入分类。我们的账单页只有纯交易流。
10. **落地形态是「响应式双外壳」**：桌面保留侧边栏（它要承载历史对话，ZA 没有这个需求），移动端换**悬浮胶囊底部 tab**（ZA 的形态）。同一份 NAV 常量喂两套壳。
11. **★ 导航按「用户任务」切，不按「银行产品」切** —— 这是 §B 最重要的发现。八家里 **Monzo 是唯一这样做的**，也是最适合个人资金管理的方案：它的 4 项 `Home / Trends / Payments / Help` **没有一项以银行产品命名**。反观 ZA/EleBank/livi 的 tab 全是产品目录（存款/贷款/投资），后果是**完整流水被压进二级页**，每次复盘多点两次。→ 我们的移动 tab 定为 **4 项：概览/账单/订阅/助手**；**卡片不进 tab**（ZA 与 Monzo 在这一点上一致），转账同样进宫格。
12. **⚠️ 目标机构清单需要一处更正**：**Airstar Bank（天星银行）已更名为 EleBank 大象银行**（抓 airstarbank.com 直接整体跳转到 elebank.com + App Store 描述写明「原天星銀行」+ Android 包名仍为 `com.airstarbank.mobilebanking`）。

---

## A. 众安银行（ZA Bank）UI/UX 拆解

### A.1 它是谁 —— 实测元数据

ZA Bank（众安银行 / 眾安銀行）是**香港第一间开业的持牌数字银行**，2020 年 3 月正式开业，众安在线（ZA Group）旗下。

| 项 | 值 | 来源 |
|---|---|---|
| App Store ID | 1477150600 | iTunes Lookup API【实测】 |
| bundleId | `group.za.bank` | `itunes.apple.com/search?term=ZA+Bank&country=hk`【实测】 |
| 开发商 | ZA Bank Limited | iTunes Lookup【实测】 |
| 首次发布 | 2019-12-18 | `releaseDate`【实测】 |
| 当前版本 | **3.9.27**，2026-09-22 | `currentVersionReleaseDate`【实测】 |
| App 体积 | 271,656,960 B（约 259 MB） | `fileSizeBytes`【实测】 |
| 评分 | HK 站 **4.75856**（58,519 条）／CN 站 4.90111 | iTunes Lookup【实测】 |
| 年龄分级 | 4+ | 【实测】 |

官网（`bank.za.group/en`）自述【官方原文】：

> "Since our official launch in **March 2020**, we've gained **over 1,000,000 users**"
> "Rated **4.8** on App Store 4 with User Acclaim"

获奖（同页原文）：The Asset *NextGen Digital Bank of the Year*（三连冠）、Fortune *Fintech Innovators Asia 2024* **Top 15 digital banks in Asia（唯一上榜的港资数字银行）**、The Digital Banker *Best Digital Retail Bank – Hong Kong SAR*。

另有 **iF Design 获奖条目**，标题 `ZA Hong Kong's No.1 digital bank - 800,000 users`：
<https://ifdesign.com/en/winner-ranking/project/za-hong-kongs-no1-digital-bank-800000-users/710648>
【已证实存在】——该 URL 在 web_search 结果中三次出现且标题一致；但 `ifdesign.com` 的 `web_fetch` **两次均失败**（`fetch failed`），**页面正文未能抓取**，故本文不引用其任何内容。

### A.2 信息架构

#### A.2.1 底部 Tab Bar —— 5 项悬浮胶囊【实测，官方截图逐像素读取】

ZA Bank 官方 App Store 截图（HK 站与 CN 站各 5 张，本会话已全部下载到 `doc/research/_raw/za-shots/` 并逐张人工查看）：

| 位置 | 标签 | 图标 | 状态 |
|---|---|---|---|
| 1 | **首頁** | ZA logo（品牌符号） | **选中**：绿色图标 + 浅绿胶囊底色 |
| 2 | **優惠** | 礼盒 | 未选中：灰色线性图标 |
| 3 | **存款** | 猪仔钱罌 | 未选中 |
| 4 | **貸款** | 手持物 | 未选中 |
| 5 | **投資** | 柱状图 | 未选中 |

形态特征（目测 + 测量）：
- **悬浮圆角胶囊**，脱离屏幕左右边缘，**不是贴底通栏**（iOS 26 之后的悬浮 tab 形态）
- 底色浅灰 `#f6f6f6`，半透明材质
- 选中项 = 图标变绿 + 文字变绿 + **背后一枚浅绿胶囊底**
- 选中项图标签整体高度 **35.6pt**【实测】

> **设计含义**：5 项里 **只有 1 项是「助手/首页」性质的**，其余 4 项全是**具体产品**（优惠、存款、贷款、投资）。它把导航按「产品线」切，不按「功能动词」切。这一条我们可以直接反驳式借鉴 —— 见 §D.2。

#### A.2.2 首页逐区拆解【实测，逐像素核对】

自上而下五段：

**① 顶栏**
- 左：**用户圆形头像**，右下角挂一枚 `V2` 等级角标
- 右：两枚圆形图标按钮（放大镜搜索 / 卡片堆叠）
- **没有标题文字，没有返回键** —— 首页即根，不解释自己是谁

**② 余额区（居中）**
- 小字 `總餘額 (HKD 等值)` + 一枚**眼睛图标**（金额隐藏开关）
- **超大金额 `88,888.88`** —— 实测字高 **28pt**、横向占屏 **44%**、字号推算约 **40pt**
- 下方一行拆分：`活期存款 8,888.88 │ 投資 80,000.00`，中间一根**细竖分隔线**

**③ 快捷功能区 —— 4×2 八宫格，两种图标语言**

| 行 | 项 | 图标形态 |
|---|---|---|
| 1 | 轉賬（↑）／入錢（↓）／貨幣兌換（循环）／海外匯款（地球） | **实心绿圆 `#00d28f` + 白色线性图标**，圆盘直径实测 **54.9pt** |
| 2 | 錢罌／ZA Card／基金／全部 | **彩色产品图标，不是圆**（绿猪仔+金币／ZA 卡面缩略／绿箭头图／四色方块） |

实测栅格：屏幕逻辑宽 393pt，四列中心间距 **93.2pt**，即**等分满宽**、外侧留边约 8pt。

> ★ **这是全篇最重要的单个设计决策**。第一行是**动词**（我要办事，无个性，统一圆形），第二行是**名词**（我要去看某个东西，各有品牌色，各有图形）。同一个 4 列网格、同样两行高度，不增加一个字的说明，就把「操作」和「产品」在视觉上分开了。而且第二行第 4 项 `全部` 用四色方块 —— 它暗示「每一色 = 一条产品线」，把「还有更多」这件事本身做成了图标语义。

**④ 動態（活动流）**
- 区块标题 `動態` + 右侧 `›`
- 行结构：`[彩色图标] 標題(粗) / 時間(小灰) …… 金額(右对齐, 粗)`
- 第一行额外带一枚**浅薄荷绿胶囊按钮 `詳情`**（实测 56.6 × 18.1 pt）—— 该行是**待处理**的红包，需要行动
- 实测样本两行：
  - `來自 Zappy 的群組利是 (撞手神)` / `今天 10:25` / `+HKD 10.00` / **[詳情]**
  - `錢罌存入` / `今天 00:52` / `HKD 120.00`

**⑤ 底部 Tab Bar**（见 A.2.1）

#### A.2.3 首页排序原则 —— 官方原话

ZA Bank App 2.0 发布文（`blog.za.group/hk/article/ZABankApp2.0`，本会话实抓）【官方原文】：

> 🏠 **首頁／介面**：「全新設計，更貼近你的生活所需。**將你最關心的、正在發生的、你最想做的，由上至下排序**，方便你快速查看。」

> 🏠 **首頁／動態**：「承載了你與 ZA Bank 的互動，讓你快速查看**所有交易紀錄、賬口活動及通知**。你亦可透過新增的分類功能，更輕鬆地搜尋**消費、貸款、收入**等賬戶紀錄。」

这两句把整个首页的 IA 讲完了：
- **排序律**：最关心的（余额）→ 正在发生的（動態）→ 最想做的（快捷入口）
  ⚠️ 注意：**Zappy 官方说的顺序是「余额 → 動態 → 快捷」，而截图上呈现的是「余额 → 快捷 → 動態」**。原因是「最想做的」被提到了第二屏之上（快捷区只有两行，成本低），而「正在发生的」信息量大、可滚动。**原则是「重要性排序」而不是字面顺序** —— 落地时不要把这句话当成机械的排版指令。
- **動態 = 三流合一**：交易流水 + 账户活动 + 通知，**不是三张列表**。

#### A.2.4 账户页与動態的组织

同一篇官方文【官方原文】：

> 💰 **賬戶**：「**集所有賬口資訊於一頁**。讓你集中管理 **儲蓄、ZA Coin、ZA Card、貸款及保單**。」

—— 账户页 IA 是**一页管全部**，五类资产横排，不做二级跳转页。

> 🧰 **小工具**：「營造專屬你的主頁，一眼看清重要資訊。更新後，你可以透過**自訂的小工具**，於首頁快速瀏覽你最關注的賬戶資訊。」

2023 年版本补充（`blog.za.group/en/article/za_bank_app_major_update`，实抓）【官方原文】：

> "your **total assets and savings** are now clearly displayed in the **upper left** of the homepage"
> "Easily access and select your favourite features in no time with **8 shortcuts**! Best of all, you can tap the **'All' button** to pick from every shortcut we have on offer!"
> "The **widget** function has now been seamlessly integrated into the new interface! You can still view them by **swiping left**!"

→ 首页 = 左上总资产 + **8 个可自定义快捷方式** + **「全部」兜底入口** + **左滑进入 widget 页**。三件事：**可自定义**、**有兜底**、**主屏只放 8 个**。

#### A.2.5 转账动线

来源：`blog.za.group/hk/article/Transfer_Guidance`（2025-01-13）、`blog.za.group/article/za-bank-transfer-tutorial`（2022-12-14），均实抓【官方原文】。

**入口**：
> 「ZA Bank App **首頁** > **向上滑動右側「存入」/「轉賬」按鈕** > 按頁面指引進行操作」

→ 转账入口是首页右侧一枚**可上滑展开的动作按钮**（存入 / 转账两个动作），**不是 tab，也不是普通文字按钮**。它常驻在最高频的首页，但只占一个按钮的位置。

**FPS 登记动线**（三步）：
> Step 1：「更多」→「轉數快和轉賬設定」→「我的轉數快」
> Step 2：「立即登記」→ 选电话 / 电邮 / FPS ID；并提示「將 ZA Bank 設為你的**預設收款銀行**」
> Step 3：SMS 或电邮验证，完成

**限额是分级的**（2024-07-26 起）：

| 收款人类型 | 每日上限 |
|---|---|
| 本人賬戶 | HKD 2,000,000 |
| **登記收款人** | HKD 1,000,000 |
| **非登記收款人及海外匯款** | HKD 300,000 |

**两处真正的 UX 决策**：

1. **5 秒转账缓冲**（本文认为这是 ZA 最值得抄的一条）【官方原文】：
   > 「我們一直致力和 ZA Fam 一起打造一間與眾‧不同的虛擬銀行，細心聆聽用戶心聲，發現不少 ZA Fam 都跟我們反映，**常有錯手轉賬至錯誤戶口的情況**。為了回應大家的需求，我們便特設一個「**5 秒轉賬緩衝**」的功能，讓大家即使在提交轉賬後，還有 **5 秒的時間去再確認轉賬無誤**。」
   > 「只要在 5 秒倒數的時限內按**取消**，就可**撤回轉賬**。」

2. **小额转账免二次验证**【官方原文】：
   > 「你可以為同名賬戶和第三方賬戶設置轉賬限額。你亦可以開啟**小額轉賬限額**，開啟後每次轉賬至**未登記收款人**的金額只要不超過此限額，就**無需進行第二次安全驗證**。」

→ 这是**基于风险的认证（risk-based auth）**：把「烦」精准地只加在高风险路径（大额 / 陌生收款人）上，低风险路径直接放行。而不是给所有人加一道验证。

#### A.2.6 IA 的三次演进（重要：说明这套设计是迭代出来的，不是一次拍出来的）

| 时期 | 主导航 | 证据 |
|---|---|---|
| **App 2.0**（2022-01） | **3 项**：首頁 / 探索 / 賬戶 | `blog.za.group/hk/article/ZABankApp2.0`【实测】 |
| **2023 改版** | 首頁（总资产左上 + 8 快捷 + 「全部」+ 左滑 widget）／探索（ZA Card 优惠专区） | `blog.za.group/en/article/za_bank_app_major_update`【实测】 |
| **当前 v3.9.27** | **5 项**：首頁 / 優惠 / 存款 / 貸款 / 投資 | 官方 App Store 截图【实测】 |

当前版本的更新说明【官方原文】：
> 「我們全面優化介面設計與操作體驗，**理財、消費、投資三大服務**切換更直觀流暢，財務狀況一目了然，隨時掌握每一步資金動向。」

→ **导航项从 3 涨到 5 是业务扩张的结果，不是设计进步。** 早期 3 项（首页/探索/账户）在 IA 上其实更干净。「探索」被拆成「優惠」，是因为营销要独立的坑位。**对我们的启示：不要因为 ZA 现在有 5 个 tab 就照抄 5 个。** 我们的产品面窄得多（个人资金管理），3–4 项足够。

### A.3 视觉语言

#### A.3.1 ★ 主色 —— 找到了 ZA Bank 自己的设计令牌文件

`bank.za.group/en` 引用了 6 个 CSS 文件（合计 **484,855 字节**）【实测】。其中
`https://cdn.zaticdn.com/bank/za-bank-portal-web/prd/_next/static/css/7cb8d0bfaa7aaa1a50a7.css`
定义了 **84 个 `--zad-*` 设计令牌**（`zad` = **ZA Design**）。

**绿色不是一种绿，是一条「角色坡道」（c0–c9）**【实测，原样摘录】：

```css
/* ↓ 强调：药丸 / 高亮 / 胶囊底 */
--zad-color-primary_c0: var(--zad-color-primary, #39e5b1);
--zad-color-primary_c1: #88efd0;      /* 四步浅色调 */
--zad-color-primary_c2: #b0f5e0;
--zad-color-primary_c3: #d7faef;
--zad-color-primary_c4: #effdf9;      /* 近白，可作区块底 */
--zad-color-primary_c5: var(--zad-color-subordination, #00b880);  /* ↓ 选中 / 按下 */
--zad-color-primary_c6: #00a171;      /* 四步深色调 */
--zad-color-primary_c7: #007a56;      /* 浅底上的深绿文字 */
--zad-color-primary_c8: #155340;
--zad-color-primary_c9: var(--zad-color-fund, #00d28f);           /* ★ 品牌绿本体 */
--zad-color-primary_c_press: #00996a;                             /* 按下态 */
```

**关键观察：c0–c9 不是明度梯，是角色梯。** 命名把「一个强调色 + 四步浅色调 + 四步深色调 + 一个品牌色」这四种**用途**编码进了索引，而不是把明度排序。所以写组件时选的是「我要强调」→ c0，「我要选中态」→ c5，「我要浅底深字」→ c7，**不需要在脑子里换算明度**。

**交叉验证成立** —— 我用自写 PNG 解码器从官方截图逐像素取色，与 CSS 令牌独立吻合：

| 元素 | 截图逐像素实测 | ZAD 令牌 | 一致 |
|---|---|---|---|
| 快捷动作圆填充 | **#00d28f** (27%) | `--zad-color-fund: #00d28f` | ✅ |
| Tab 选中胶囊底 | **#00b880** (10%) | `--zad-color-subordination: #00b880` | ✅ |
| `詳情` 胶囊按钮 | **#39e5b1** (18%) | `--zad-color-primary: #39e5b1` | ✅ |
| 正文/金额最深色 | **#030516** (21%) | `--zad-color-text: #030516` | ✅ |
| ZA Card 渐变 | #50f9b9 → #45efb5 → #3ae6b1 | （卡面不在 token 内） | — |

四取四中。**两套完全独立的证据（生产 CSS vs 官方截图像素）给出同一组值**，这组数字可以放心用。

#### A.3.2 中性色 —— 同一基色 + 变 alpha

```css
--zad-color-label_primary:      var(--zad-color-text, #030516);
--zad-color-label_body:         rgba(3,5,22,0.8);
--zad-color-label_secondary:    rgba(3,5,22,0.64);
--zad-color-label_tertiary:     rgba(3,5,22,0.35);
--zad-color-light:              rgba(3,5,22,0.22);
--zad-color-dividing_a5:        rgba(3,5,22,0.08);   /* 分隔线 */
--zad-color-bg_mask_a2:         rgba(3,5,22,0.6);    /* 遮罩 */
--zad-color-bg_toast_a1:        rgba(3,5,22,0.8);    /* Toast */
--zad-color-bg_primary:         #f6f6fb;
--zad-color-bg_secondary:       #fff;
--zad-color-bg_tertiary:        #fafafd;
/* 少量不透明兜底值 */
--zad-color-label_body_2:       #353745;
--zad-color-label_secondary_2:  #74767f;
--zad-color-label_tertiary_2:   #a7a8ad;
```

**全部中性色都是同一个基色 `#030516` 的不同 alpha。**

⚠️ **先纠正一个容易搞错的推论**：直觉上会认为「ZA 用 alpha 坡道、我们用离散纯灰」是根本差异。**把数字摊开算过之后，这个说法不成立** —— 我们的 `--text-primary: #1d1d1f` = RGB(29,29,31)，按不同 alpha 叠在白底上：

| alpha | 由 `#1d1d1f` 推算 | `tokens.css` 实际值 | |
|---|---|---|---|
| 80% | `#4a4a4a` | `--text-body #424245` | ≈ |
| 64% | `#6e6e6e` | `--text-secondary #6e6e73` | ≈ |
| 48% | `#8e8e8e` | `--text-tertiary #86868b` | ≈ |
| 35% | `#b1b1b1` | `--text-placeholder #aeaeb2` | ≈ |
| 20% | `#cfcfcf` | `--text-faint #d2d2d7` | ≈ |

**我们的灰阶梯本身就已经是一条「单一基色 + alpha」的坡道。** 策略与 ZA 完全相同。

**真正的差别只有一个：基色的色相 ——**

| | 基色 | RGB | 特征 |
|---|---|---|---|
| ZA Bank | `#030516` | (3, 5, 22) | **海军蓝黑**，蓝通道 = 红通道的 **7.3 倍** |
| 我们 | `#1d1d1f` | (29, 29, 31) | **中性黑**，三通道几乎相等 |

叠 64% 到白底：ZA 得到 `#5e5f6a`（**蓝灰**），我们得到 `#6e6e6f`（**中性灰**）。这与像素实测吻合 —— ZA 页面上的次级文字实测为 `#4d4e5b` / `#4a4b58`，确实明显偏蓝。

> **落地判断见 §D.5**：这个差别**不值得动** —— 理由和成本核算都写在那里。

#### A.3.3 控制色 —— 按产品线分色，共用同一套 9 级结构

```
e0–e8   橙   #ff9829 → #662700   （营销 / 活动）
f0–f8   黄   #ffd52b → #664401   （预警 / 优惠）
g0–g8   青   #3fc7f2 → #093e59   （卡片 / 海外）
h0      紫   #9064ef
r0–r8   红   #fc605b → #9e092c   （错误 / 危险）
```

命名规则 `--zad-color-control_<字母><0-8>`：**字母 = 色相，数字 = 深浅**。加一条产品线 = 加一个字母，布局一行不动。这解释了为什么 ZA 首页第二行四个图标各不相同的颜色却不显得花 —— 它们全部来自同一个结构化色板，饱和度与明度节奏一致。

#### A.3.4 卡片样式与圆角

**圆角令牌只有 5 级**【实测】：
```css
--zad-border-radius_xxs: 2px;  --zad-border-radius_s: 8px;   --zad-border-radius_l: 20px;
--zad-border-radius_xs:  4px;  --zad-border-radius_m: 14px;
```
CSS 里实际出现的圆角：`2 / 4 / 6 / 8 / 12 / 14 / 16 / 20 / 24 / 30 / 100px / 50%`。
卡面视觉圆角实测约 **24px**（ZA Card 图）。

> 对照我们的 `tokens.css`：**10 级圆角**（chip 6 / sm 8 / thumb 12 / md 14 / sheet 16 / card 18 / lg 20 / panel 22 / hero 26 / 2xl 28）。**ZA 的圆角层级比我们少一半。** 令牌越多，越容易出现「这个用 16 还是 18」的犹豫，最后同屏出现一堆只差 2px 的圆角 —— 那正是视觉不整齐的来源。

**卡片本体**：白 `#fff` 不透明卡，浮在 `#f6f6fb` 页底上，**没有边框、没有阴影**，靠色差 + 圆角 + 间距分离。区块之间用 `rgba(3,5,22,0.08)` 的 hairline 分隔（ZA Verify 页可见）。

#### A.3.5 图标风格

- **导航 / 功能图标**：线性、1.5–2px 描边、圆头圆角、24pt 网格 —— 与 lucide-react 的默认风格高度一致（`stroke-width` 默认 2，`stroke-linecap: round`）
- **产品图标**：**彩色、实心、带小块高光**（钱罌猪仔有金币、基金的箭头是绿色实心、ZA Card 是卡面缩略图），四色方块那枚尤其典型
- **Tab 图标**：未选中 = 灰线性；选中 = 绿线性 + 文字变绿 + 浅绿胶囊底

→ **对我们的直接结论：lucide-react 能覆盖 ZA 的「线性功能图标」这一层，覆盖不了「彩色产品图标」这一层。** 那一层是设计资产。所以不要试图复刻（见 §D.6）。

#### A.3.6 数字的呈现方式【实测】

| 指标 | 实测值 | 换算 |
|---|---|---|
| 余额数字字高 | 48px | **28pt** |
| 余额数字横向宽度 | 296px | **172.8pt = 屏宽的 44%** |
| 推算字号 | — | **约 40pt**（28 ÷ 0.70） |
| 快捷圆盘直径 | 94px | **54.9pt** |
| `詳情` 胶囊 | 97 × 31 px | **56.6 × 18.1 pt** |
| Tab 选中项图标签高度 | 61px | **35.6pt** |
| 四列中心间距 | 159.7px | **93.2pt** |

数字呈现的四条规则：
1. **金额永远右对齐**，与非数字内容左对齐形成两栏（動態列表、交易列表、帮助中心交易列表三处一致）
2. **正负号显式书写**：`+HKD 10.00` / `-HKD 120.00` —— 不靠颜色单独表达方向
3. **币种前缀在符号后**：`+HKD 10.00`（先符号后币种），而列表第二行 `HKD 120.00`（无符号即无方向）
4. **颜色作为第二信号**：`22,620` 在 ZA Verify 页用品牌绿高亮；`詳情` 胶囊也是绿。**颜色从不单独承载信息**（都伴随文字或符号）

**字号阶梯**【实测，统计 128 条 `font-size` 声明】：

| 字号 | 出现次数 | 用途推断 |
|---|---|---|
| 16px | **25** | 正文基准 |
| 12px | 16 | 次级说明 |
| 18px | 14 | 小标题 |
| 14px | 13 | 密集列表 |
| 15px | 10 | 次要正文 |
| 30px | 7 | 区块大数 |
| 22 / 24 / 26 / 32px | 各 5 | 展示级 |
| **56px** | 2 | **Web 端英雄数字** |

**字重**【实测，100 条声明】：`400 ×50`、`700 ×45`，其余（500/600/610）合计仅 **5 次**。
→ **实际只用两个字重：Regular + Bold。** 层级靠**字号 + 颜色 + 间距**，不靠字重。我们的 tokens.css 隐含 4 档（Regular/Medium/Semibold/Bold）。

**行高**【实测，114 条声明】：最高频 `24px ×32`（配 16px 正文 = **1.5**），另有 26 / 20 / 38 / 48px。**用绝对 px 逐档手配，不用比例。**

**letter-spacing：全库 0 条声明**【实测】。ZA **完全不使用** Apple 式负字距。

> 这是与我们最根本的排版分歧：
> | | 我们（Apple HIG） | ZA Bank |
> |---|---|---|
> | 正文 | 17px | **16px** |
> | 行高 | 1.29 | **1.5** |
> | 字距 | `-0.026em` | **0** |
> | 字重档位 | 4 | **2** |
>
> Apple 的紧排版读起来「精致、编辑感」；ZA 的松排版读起来「友好、易扫读」。**对一个中文 + 数字密集的账目界面，1.5 行高 + 零字距明显更耐读。**

#### A.3.7 阴影 —— 几乎不用（最大的净删除机会）【实测】

在 ZA Bank 全部 6 个 CSS 文件、**484,855 字节**里，`box-shadow` 只有 **3 个不同的值、合计 6 条声明**：

```css
box-shadow: 0 2px 4px hsla(240,3%,82%,.3);
box-shadow: 0 2px 5px 0 rgba(0,0,0,.12);
box-shadow: 0 2px 5px 0 rgba(0,0,0,.06);
```

**对照我们的 `tokens.css`**：`--shadow-hairline`、`--shadow-1`、`--shadow-card`、`--shadow-panel`、`--shadow-lift`、`--shadow-overlay`、`--shadow-glass` —— **7 个阴影令牌**，且 `--shadow-card` / `--shadow-panel` 各自都是两层。

**ZA 用白卡 `#fff` 浮在页底 `#f6f6fb` 上分离卡片** —— 两者差值只有 9/255（蓝通道）。加上 14–20px 圆角和 16–24px 间距，层级足够清楚，而且**永远不会出现「阴影糊成一团」**。

> 对我们的 `--shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)` 来说，第二层 24px 模糊的环境影在浅灰底上几乎不可见，**纯属成本**。

#### A.3.8 空状态【实测，ZA Verify 页】

截图实见：一枚**敞开的纸箱插画，一张纸飞机正飞出来**，色彩极淡（浅灰 + 一点点绿/蓝），尺寸约占屏宽 45%，居中。上方是统计数字，下方是分段控件。

**注意它出现在哪**：不在「首页」，而在**一个二级页的筛选结果里**（ZA Verify → 待處理 tab 无数据时）。也就是**空状态是页面级的兜底组件，不是首页装饰**。

> ⚠️ **这类插画是设计资产，不是代码。** 我们用 CSS/SVG 手搓同质量的插画性价比极低。**这条建议只抄「位置和尺寸」，不抄「画法」** —— 见 §D.6。

#### A.3.9 动效

【未能证实】ZA Bank 的动效曲线、时长、弹簧参数**没有任何公开数值**。App 内的动效无法从截图或公开页面测量，官网 CSS 里的 `transition` 属于 Web 端而非 App 端。

**本文不对 ZA 的动效做任何数值断言。** 我们现有的 `tokens.css` 弹簧曲线（`--ease-spring-critical`、`--ease-spring-sheet`，阻尼谐振子数值积分生成）**保持不变即可** —— 这是我们已经领先的一层，没有理由为了「像 ZA」而退化。

### A.4 为什么被认为设计优秀 —— 8 个决策，各自解决了什么问题

不写「简洁优雅」这类空话。每一条都给出**它解决的具体问题**和**它付出的具体代价**。

---

**① 英雄金额 40pt（超出平台最大字号一档）**
- **问题**：账目 App 的核心任务 90% 是「看一眼还剩多少钱」。银行 App 却常把余额做成 24px 标题，和一堆数字挤在一起。
- **决策**：把余额做到 **28pt 字高、占屏 44%**，字号约 40pt —— **比 Apple 最大的 LargeTitle（34pt）还大一档**。
- **代价**：首页第一屏只能容纳一个数字。**所有其他信息被挤到第二屏。**
- **为什么值**：第一屏的唯一任务是回答一个问题。让它只回答那一个问题，比让它回答五个问题更好。

**② 眼睛图标（金额隐藏开关）**
- **问题**：在地铁、电梯、工位上打开银行 App，余额会被旁人看到。
- **决策**：`總餘額` 标题旁挂一枚眼睛图标，一键把金额变成圆点。
- **代价**：一个图标的位置。
- **为什么值**：这是**隐私焦虑的解药**，而隐私焦虑会直接抑制打开 App 的频率。一个图标换「敢在公共场合打开」。

**③ 4×2 八宫格 + 两种图标语言**
- **问题**：首页既要放「我要转账」这类**动作**，又要放「去看看我的钱罌」这类**产品入口**。全做成同一种按钮 → 用户分不清点下去会发生什么；分成两个区块 → 首页变长，且要多写两行分组标题。
- **决策**：**同一个 4 列网格**，第一行 4 个是实心绿圆 + 白线图标（动作），第二行 4 个是彩色产品图标（名词）。第 4 项做成「全部」兜底。
- **代价**：需要维护两套图标资产。
- **为什么值**：**零额外高度、零额外文字，就完成了一次语义分类。** 而且第二行的四色语义直接复用了 §A.3.3 的产品线色板，不是随手挑的颜色。

**④ 「動態」= 交易 + 账户活动 + 通知 三流合一**
- **问题**：银行 App 通常把交易流水、账户变动、系统通知放在三个地方。用户想知道「我的钱最近怎么了」要翻三处。
- **决策**：合成**一条按时间倒序的流**，用**行内徽标/胶囊按钮**（如 `詳情`）标记「这一条需要你行动」。并支持按消费/贷款/收入**分类筛选**。
- **代价**：需要统一三类事件的排序键和行模板；不同类型事件的行结构必须能共存。
- **为什么值**：把「翻三个地方」变成「扫一条流」。同时**待办事项天然浮到顶部** —— 需要行动的那条自带绿色胶囊按钮，一眼可见。

**⑤ 5 秒转账缓冲**
- **问题**（官方原话）：「常有**錯手轉賬至錯誤戶口**的情況」。转账不可逆，输错一位数就是灾难。
- **决策**：提交后给 **5 秒倒计时**，期间可点取消撤回。
- **代价**：5 秒的确认延迟；需要服务端支持延迟提交或冲正。
- **为什么值**：**这是本次调研里投入产出比最高的一条。** 它把「不可逆的恐怖操作」变成「可撤销的普通操作」，成本是一个倒计时 UI，收益是消除了一整类用户最深的恐惧。**这正是 Gmail「撤销发送」在金钱上的翻版。**

**⑥ 登记收款人分级限额 + 小额免二次验证**
- **问题**：安全验证让人烦；但去掉验证又不安全。
- **决策**：**把摩擦精准加在高风险路径上**。本人账户 200 万 / 登记收款人 100 万 / 非登记及海外 30 万；小额转账给未登记收款人**跳过第二次验证**。
- **代价**：需要一套限额与验证策略的状态机。
- **为什么值**：**没有降低任何一处安全性，只是取消了低风险路径上无意义的摩擦。** 用户感受到「快」，风控没有放松。

**⑦ 錢罌：把利率做成任务**
- **问题**：活期存款是纯价格战，谁利率高钱就去哪，没有粘性。
- **决策**（`blog.za.group/en/article/spot_saving06` 实抓【官方原文】）：拆成 **High-Rate Pot**（完成当月挑战可达 **5% p.a.**）与 **Chill Pot**（1% p.a.）。挑战内容是「**spending, bill payments, FX / Remit etc.**」—— 还包括**行步步数**。另有「**Pull to save in just one second**」下拉存入和可自定义的钱罌背景图。
- **代价**：需要大量行为埋点、任务系统、步数权限；合规成本高（CN 商店描述专门用一整段解释步数权限只用于互动、不影响核心功能）。
- **为什么值**：**利率不再是白给的，是靠完成银行想要的行为赚来的。** 这一招同时驱动了刷卡、缴费、换汇、汇款四条产品线的使用率 —— 一个功能撬动四条线。**这解释了为什么首页必须有「動態」：它同时是交易流水和挑战进度条。**
- ⚠️ **这一条我们不该抄**（见 §D.6）：它依赖真实资产和后端任务系统，演示项目抄不来。

**⑧ ZA Perks：把成长体系挂在头像角标上**
- **问题**：忠诚度体系通常需要独立入口，占一个宝贵的导航坑位，而新用户点进去只看到「你还差很多」。
- **决策**（`bank.za.group/en/za-perks` 实抓【官方原文】）：按 **30 天平均每日总资产**分 Standard / **Lv 1**（1 万起）/ **Lv 2**（50 万起），20+ 权益横跨 Invest / ZA Card / Deposit / Transfer / FX / More 六个板块。**入口是首页头像右下角一枚 `V2` 角标** —— 不占任何导航坑位。
- **代价**：需要完整的权益与分层后端。
- **为什么值**：**用一个角标，把一整套跨产品的激励体系挂在了最高频的位置上。** 而且角标本身是「进度条」—— 用户每次看看头像就知道自己走到哪了。
- ⚠️ 同样**不该抄**（见 §D.6）：需要真实资产数据。

---

**反面观察（同样有证据）**：这套设计并非无懈可击。

- **导航项从 3 涨到 5**（§A.2.6）：早期「首頁 / 探索 / 賬戶」在 IA 上更干净；current 的「優惠 / 存款 / 貸款 / 投資」是**按业务线切**，导致「我想看这个月花了多少」这类**跨产品任务**没有归属页 —— 只能落在「首頁」的動態里。**这是业务扩张侵蚀 IA 的典型症状，值得我们警惕而不是效仿。**
- **App 体积 259 MB**【实测】。对一个「看一眼余额」的 App 来说偏重。
- **门槛**：App Store 描述明确写了「僅供現有 ZA Bank 的客戶……如果你沒有有效的身份證明文件和居住地址……則不要下載此應用程式」—— **非客户无法体验**，这也是本文只能依赖官方截图而非上手实测的原因。

---

## B. 香港 / 新加坡虚拟银行的产品层对标

> **完整原始记录**：`doc/research/_raw/virtual-bank-ia-comparison.md`（557 行 / 68 KB）。
> **本轮唯一硬证据源**是**下载 App Store 官方截图后读图** —— 因为官网多为 SPA 空壳、Google Play 完全不可达。凡未读到图的，一律写「未能证实」。

### B.0 ⚠️ 关键更正：Airstar Bank（天星银行）已更名为 **EleBank 大象银行**

任务书里的目标机构清单需要更正。**证据链（三重）**：

1. 抓 `https://www.airstarbank.com/` → 直接返回 `cross-origin redirect to https://www.elebank.com`（**官网整体跳转**）
2. App Store「大象銀行 EleBank」描述原文：「**大象銀行（原天星銀行）**是香港持牌數字銀行，於 2019 年 5 月 9 日獲香港金融管理局頒發銀行牌照（銀行代碼：395）」；developer = `Ele Bank Limited`，上架日期 2026-09-17（**新上架**）
3. Android 包名**仍是** `com.airstarbank.mobilebanking`（**品牌改名、包名沿用**）

更名后定位从「存款银行」转向**财富管理**：`elebank.com` 产品栏 = 貸款 · 存款 · 外匯 · 轉賬 · **股票** · **基金** · **加密貨幣** · 保險。

> **本文及任何下游文档若提及「Airstar Bank / 天星银行」，必须加注更名。**

### B.1 可达性边界（先说清楚哪些没抓到）

| 资源 | 状态 |
|---|---|
| 8 家 App Store 元数据（iTunes Lookup API） | ✅ **全部成功** |
| ZA / Monzo / EleBank / livi / N26 官方截图（下载读图） | ✅ 成功 → **这是 tab bar 的唯一直接证据源** |
| `mox.com` / `welab.bank` / `livibank.com` / `monzo.com` / `n26.com` / `elebank.com` | ✅ 抓到正文 |
| `revolut.com/*` 与 `help.revolut.com/*` | ❌ **全站 403**（JS 外壳，正文为空）→ Revolut 一节**无官网原文**，改用 App Store 官方描述 |
| `play.google.com` | ❌ 解析到**非公网 IP**，完全不可达 → **本文「类别/评分」全部来自 App Store，不含任何 Play 数据** |
| apkcombo / apkpure / apkmirror / apkmonk / apkfab / appbrain | ❌ 全部 fetch failed |
| **Mox / WeLab / Revolut 的底部 tab 数量与名称** | ❌ **未能证实** —— Mox 官网是 SPA、7 张截图均为裁切营销图；WeLab 官网 HTML 无外链 CSS、support 页实为 404 |

### B.2 产品层 IA 横向对比（实测）

| 机构 | 底部 tab | tab 名称 | 首页主模块 | 独立账单页 | 订阅管理 | 理财/积分 | 目标人群 |
|---|---|---|---|---|---|---|---|
| **Mox Bank**（HK） | ⚠️ 未能证实 | ⚠️ 未能证实 | 账号卡（总结余+币种+兑换）→ 定期存款 → **目标**（账户页纵向堆叠） | ⚠️ 未确认 | ❌ 无证据 | ✅ 目标储蓄、日日计息、**CashBack** | 香港年轻用户；渣打+电讯盈科+Trip.com；主打消费回赠 + **一卡两用 Flip** |
| **WeLab Bank**（HK） | ⚠️ 未能证实 | ⚠️ 未能证实 | 储蓄/定存为主；GoSave 2.0 | ⚠️ 无证据表明是独立一级页 | ❌ 无证据 | ✅ **GoWealth 智動投資顧問** + 自選基金；定存 10 元起 | 高息存款 + 自动化投资人群 |
| **livi bank**（HK） | **0（不用底部 tab）** | **顶部 3 分段：`liviSave` / `貸款` / `保險`** | 余额卡 → **最近交易（仅 1 行 + 查看全部）** → 4 圆形快捷 → 定存推荐 | ❌ **交易被折叠为首页小卡** | ❌ 无证据 | ⚠️ livi Rewards；无投资，**保險**为一级分段 | **日常消费支付人群**（银联二维码 50,000+ 商户 / 40+ 国家） |
| **EleBank 大象银行** | **5** | **`概覽` / `自選` / `理財` / `轉賬` / `我的`** | 总余额 + 4 圆形快捷 + **账户卡横向轮播** + 動態 + 交易紀錄 | ⚠️ 无独立 tab；交易紀錄为首页区块 + 二级页 | ❌ 无证据（有「預約轉賬」） | ✅✅ 理財 tab（存款/基金/保險）+ 港美股碎股 + 加密貨幣 | **投资者与跨境用户**：港股 1 股起投、美股 US$5 起投、11 币种 |
| **ZA Bank**（交叉印证） | **5** | **`首頁` / `優惠` / `存款` / `貸款` / `投資`** | 总余额 + **拆分行** + **8 宫格快捷** + 動態 | ⚠️ 无独立 tab；ZA Card 页有「交易管理」「消費分析」二级 | ❌ 无证据 | ✅✅ 投資一级 tab：基金、钱罂、ZA Card | 一站式全客群 + 商业银行 |
| **Revolut**（UK/全球） | ⚠️ 未能证实 | ⚠️ 未能证实 | 全出血主页（账户名 + 大余额 + `Accounts` 切换器）→ 4 圆形 → 交易流 + See all → 底部 widget | ⚠️ 无独立 tab | ⚠️ **间接**：`Pockets` 自动预留账单与 Direct Debits；**无「订阅管理」明文** | ✅✅ ISA + 股票/ETF/加密 + RevPoints | **全球旅行 + 多币种 + 投资**（App Store 类别含 **Travel**） |
| **Monzo** ⭐（UK） | **4** | **`Home` / `Trends` / `Payments` / `Help`** | 头像 + `Upgrade` + 礼物/搜索 + 蓝色 `+`；**Monzo 红余额卡**（余额+账号+`Add money`/`Card`/`⋯`）；**Activity 时间轴（含 upcoming payments 预告行）**；底部 `Left to spend` 进度条 | ⚠️ 无独立 tab；**交易时间轴即首页主体** | ✅ **明文**："Schedule your bills or regular monthly payments and **manage subscriptions**" | ✅✅ Investments + ISAs + Pensions；Pots；Cashback | **英国个人资金管理/预算人群** |
| **N26**（DE/EU） | **5** | ⚠️ **纯图标无文字，名称未能证实** | N26 logo → **卡面图** → **账户行列表**（Hauptkonto / Gemeinschaftskonto） | ⚠️ 交易在账户详情内 | ❌ 无证据（有 **Insights**） | ✅✅ Invest tab + 股票/ETF（1€ 起）+ **Spaces 子账户 + 凑整储蓄** | 欧洲极简银行用户 |

#### B.2.1 ★ 核心发现：tab 的**切分维度**分成三类

| 切分维度 | 采用者 | 具体表现 |
|---|---|---|
| **按「用户任务」切** | **Monzo（唯一）** | `Home`（我的钱）/ `Trends`（记账与分析）/ `Payments`（收发钱）/ `Help`。**4 项，无一项以银行产品命名** |
| **按「银行产品线」切** | **ZA Bank、EleBank、livi** | ZA：`首頁/優惠/存款/貸款/投資`；EleBank：`概覽/自選/理財/轉賬/我的`；livi 顶部分段：`liviSave/貸款/保險` |
| **按「账户与资产层级」切** | **N26（部分）** | 首页 = 账户清单；投资与统计各占一项 |
| 未确证 | Mox、WeLab、Revolut | |

### B.3 结论：最适合「个人资金管理」的是 **Monzo 的 4-tab IA**

个人资金管理的五个核心任务是：**记账 → 看账单 → 管订阅 → 转账 → 看卡片**。以此为标尺：

**① Monzo 是唯一「按用户任务而非银行产品」切 tab 的，这让「记账」拿到了一级入口。**
`Home`/`Trends`/`Payments`/`Help` 里**没有任何一项叫「存款」「贷款」「投资」**。反观 ZA 的 `首頁/優惠/存款/貸款/投資`、EleBank 的 `概覽/自選/理財/轉賬/我的`、livi 的 `liviSave/貸款/保險` —— 都是**产品目录**。
**后果很具体**：在 ZA 与 EleBank 里，完整交易记录被压在首页的 `動態`/`交易紀錄` 区块，要点「更多 ›」进二级页才能看全；**livi 更只内联 1 行「最近交易」**。记账场景要的正是「完整流水 + 分类统计」，放进二级页 = **每次复盘多两次点击**。

**② Monzo 的 Home 把「余额 / 流水 / 预算」压进一屏闭环。**
截图可辨的自上而下顺序：**Monzo 红余额卡（余额 + 账号 + `Add money`/`Card`/`⋯`）→ `Activity` 时间轴 → 底部 `Left to spend` 进度条**。关键在 `Activity` 的信息设计 —— 它把 **`3 upcoming payments / in 3 days / 47.83` 这条未来付款预告直接内联进流水列表**，并把商户附言（`G Robertson / "Thanks for dinner!"`）和回赠（`NOW TV / 35% cashback`）写在同一行。
→ 对照 **N26**：首页是账户清单，看流水要先点进某个账户 —— **多一层，且看不到跨账户合并支出**。
→ 对照 **Revolut**：有 `See all` 但**没有 `Left to spend` 这类预算余量指示**。

**③ `Trends` 的数据模型天然贴合「记账」，而不是「看报表」。**
Monzo 帮助中心对 Trends 的定义恰好对应记账产品的四个必备字段：
- `Creating and editing custom categories` + `Adding multiple categories to a payment` → **多标签分类**（一笔交易可挂多个分类）
- `Spending, Balance and Targets` → **三视图**（支出 / 余额 / 预算目标）
- **`Excluding transactions from Trends` → 排除项**（转账、还款不入统计 —— **这是记账工具最刚需却最容易被忽略的能力**）
- 分类可编辑

→ 八家里**只有 Monzo 把这一整套以一级 tab 命名并公开文档化**。N26 的 `Insights`、Revolut 的 `Deep-dive analytics`、WeLab 的「智能財務健康分析」**都只停在描述文案里，没有一个占一级导航位**。

**④ 「管订阅」有明确归口，且不散落。**
- **订阅**：App Store 描述有**唯一一句明文** `manage subscriptions`；而帮助中心显示它**不是靠一个孤立的「订阅」页，而是挂在 Pots 这个统一容器下**：`Paying bills from Pots`（用罐子付账单）、`Understanding Salary Sorter`（工资自动分罐）、`Archived Pots`（停用的订阅罐归档）。
  → **IA 价值**：用户「管订阅」= 在 Pots 里建一个「订阅罐」并开自动划转，**与「存钱目标」共用同一套心智，学习成本为一次**。Revolut `Pockets`、N26 `Spaces` 是同类机制但**订阅语义更弱**；**HK 五家本轮均未发现订阅管理功能**（这是我们的差异化机会）。
- **卡片**：Monzo 把卡**并入 Home 的余额卡内**（`Card` 胶囊按钮），**卡片操作不占一级导航**。
  → 对照 **ZA Card 的 8 宫格**（`交易管理/自動增值/Click to Pay/海外旅遊/消費分析/一鍵鎖卡/換卡/ZA Verify`）与 **Revolut Security 的分组**（`Wealth Protection` → `Card security` / `Card connections` / `Payments` / `Payees` → `Sign-in & Passcode` / `Devices`）—— **这两者是很好的二级页模板**，但**抬到近一级对纯记账过重**。

**⑤ 香港语境下 EleBank 最接近可用，但差一个「分析」位；livi 最不适合。**
- **EleBank 的 `概覽/自選/理財/轉賬/我的` 是最佳 HK 近似**：已把 `轉賬` 独立成一级（对应「转账」任务），`理財` tab 内部再用 `存款/基金/保險` 分段把产品线收进二级 —— **这是「任务做一级、产品做二级」的正确方向**。缺口是**没有 `Trends` 那样的分析一级位**（`自選` 是收藏而非分析），交易仍需「更多 ›」。
- **livi 最不适合**：顶部分段只有 3 项且**全是产品**，首页第 4 层才是「最近交易」小卡、第 5 层是 4 个圆形快捷。**快捷入口优化的是「动作发起效率」，不是「资金回顾效率」**。它定位支付/消费行是自洽的，但作为个人资金管理入口，导航深度和信息密度都不够。
- **Mox 的账户页堆叠逻辑有风险**：`總結餘 → Mox 戶口（币种 + 兌換）→ 定期存款（+）→ 目標（+）` 纵向堆叠、每块带 `+` 新增。**对「存钱」极友好，但对「看流水」不友好 —— 整页没有交易时间轴的位置。**

**⑥ 一条反向提醒：Monzo 的 `Help` 占掉一个一级 tab，这是可替换位。**
`Help` 是英国 24/7 chat 客服模式的产物。**照搬到中文个人资金管理产品，建议把第 4 个 tab 从 `Help` 换成「预算/记账」或「资产」** —— 保留 `Home / Trends / Payments` 三项，它们恰好一一对应「**看钱 / 记账 / 转钱**」的完整闭环，客服入口收进 `Home` 顶栏头像后的二级页。

### B.4 实测色值（只列实抓到的）

| 机构 | 色值 | 来源 |
|---|---|---|
| **Mox** | `#0FFAFF`（22 次，品牌主青绿）/ `#1D2E50`（深靛蓝）/ `#FF144F` / `#02EE8C` / `#FFC822` | mox.com 官方 CSS |
| **livi** | `#2E3D5D`（14 次，深蓝灰）/ `#08FFD5`（9 次，亮青绿）/ `#F5F6F9`；样式表另见 `#17FFE9` / `#004A43` | livibank.com 官方 CSS |
| **EleBank** | `#4E42C2`（10 次，品牌紫）/ `#9087F0` | elebank.com 官方 CSS |
| **Monzo** | `#112231`（深海军蓝，兼 `theme-color`）/ `#FF4F40`（Monzo 红）+ **11 级中性灰阶**（色彩系统成熟度最高的证据） | monzo.com HTML/内联样式 |
| **WeLab / Revolut / N26 / ZA** | **hex 未能证实** —— 仅提供截图目视描述，**未给编造值** | （ZA 的令牌见 §A.3.1，本文独立抓取） |

### B.5 App Store 评分（实测，含样本量）

| 机构 | 评分 | 评分条数 |
|---|---|---|
| Revolut | 4.864 | 1,081,879 |
| Monzo | 4.857 | 356,914 |
| N26 | 4.786 | 188,652 |
| Mox Bank | 4.767 | 92,326 |
| **ZA Bank** | **4.759** | **58,519** |
| livi bank | 4.654 | 9,502 |
| **WeLab Bank** | **3.368** | 1,196 ← **最低** |
| EleBank | 5.0 | **仅 8 条（样本无统计意义）** |

> **注意**：WeLab 的 3.368 显著低于同行，但其官网（`welab.bank`）实为 SPA、support 页 404，**本轮无法取得其产品层截图来定位原因**，故只记录数字、不给因果解释。

### B.6 一句话结论

> **Monzo 的 `Home / Trends / Payments / Help` 是八家中唯一把「记账」和「转账」提升为一级导航、并把「余额/流水/预算」压进一屏的方案，最契合个人资金管理；HK 本地化应以 EleBank 的 `概覽/自選/理財/轉賬/我的` 为骨架，把 `自選` 换成「分析/记账」；Revolut 的 Security 分组与 ZA Card 的 8 宫格适合做二级页模板；livi 的顶部产品分段与 Mox 的账户纵向堆叠不建议直接用于记账场景。**



## C. 开源可参考的实现（`gh` CLI 实测）

> **完整原始记录**：`doc/research/_raw/oss-banking-ui-repos.md`（1220 行 / 55 KB）。本节是其结论部分。
> **实测纪律**：下表每一行的 star / license / push / 语言都来自 `gh api repos/OWNER/REPO` **逐仓实测**，不是搜索结果里的二手值。8 个仓库的源码用 `gh api ... -H "Accept: application/vnd.github.raw"` **原样抓取**后引用。

### C.0 工具限制（实测到的，先说清楚）

- `gh search repos`（2.92.0）**不支持 `topics` 字段** —— `--json` 里带 `topics` 会报 `Unknown JSON field: "topics"`，本次 8 条查询全部 exit 1。改用 `isArchived` 成功。**原始报错全文保留在 raw 文件第 0 节。**
- **两个搜索方向生态极薄**（这本身是有价值的信息）：
  - `mobile banking react` → **仅 2 条命中**，最高 6★
  - `transaction list ui` → **仅 2 条，均 0★**
  - `finance app template` → 9 条**全部 0★**
  - `banking app react jsx` → **0 条**
  - → **结论：不存在「拿来即用的 React 手机银行 UI 库」。** 高 star 的全是 Ruby/Go/TypeScript 的**完整记账应用**（不可拆），低 star 的才是纯 UI 样板。这直接决定了下文的策略：**抄布局参数，不抄项目**。

### C.1 候选仓库实测表（25 个，按 star 降序）

| 仓库 | URL | star | license | 最近 push | 语言 | 定位 |
|---|---|---|---|---|---|---|
| maybe-finance/maybe | https://github.com/maybe-finance/maybe | 54263 | AGPL-3.0 | 2025-07-24 | Ruby | **archived=true（已归档）**，曾最火的个人金融 App |
| actualbudget/actual | https://github.com/actualbudget/actual | 29190 | MIT | 2026-09-28 | TypeScript | **本地优先记账，生产级设计令牌** |
| we-promise/sure | https://github.com/we-promise/sure | 10284 | AGPL-3.0 | 2026-09-28 | Ruby | maybe 的社区续作 |
| mayswind/ezbookkeeping | https://github.com/mayswind/ezbookkeeping | 5673 | MIT | 2026-09-27 | Go | 自托管记账 |
| moneymanagerex/android-money-manager-ex | https://github.com/moneymanagerex/android-money-manager-ex | 714 | GPL-3.0 | 2026-09-26 | Java | 本地优先安卓记账 |
| prof18/MoneyFlow | https://github.com/prof18/MoneyFlow | 366 | 无 | 2026-04-20 | Kotlin | KMP + Compose |
| enrique-lozano/Monekin | https://github.com/enrique-lozano/Monekin | 257 | AGPL-3.0 | 2026-09-25 | Dart | 离线优先 Flutter 记账 |
| imariman/fintech_dashboard_clone | https://github.com/imariman/fintech_dashboard_clone | 142 | 无 | **2022-01-23** | Dart | 已 4 年未更新 |
| Elias569/fintech-dashboard | https://github.com/Elias569/fintech-dashboard | 135 | 无 | 2026-09-14 | TypeScript | Next.js 记账面板（**B 类**） |
| Athenodoros/TopHat | https://github.com/Athenodoros/TopHat | 134 | GPL-3.0 | 2026-09-27 | TypeScript | 浏览器内个人金融 |
| **abderrahimghazali/shadcn-fintech** | https://github.com/abderrahimghazali/shadcn-fintech | 92 | MIT | 2026-05-18 | TypeScript | **shadcn 金融面板标杆（B 类）** |
| vinothvino42/Mobile-Banking-App-UI | https://github.com/vinothvino42/Mobile-Banking-App-UI | 77 | 无 | 2020-04-05 | Dart | 新拟态 Flutter |
| muhammadtalhasultan/mobile_banking_ui | https://github.com/muhammadtalhasultan/mobile_banking_ui | 67 | 无 | 2023-06-18 | Dart | Flutter 手机银行 |
| manishdayma/free_flutter_banking_ui_kits | https://github.com/manishdayma/free_flutter_banking_ui_kits | 66 | 无 | 2022-11-06 | Dart | Flutter UI Kit |
| gerardrbentley/fidelity-account-overview | https://github.com/gerardrbentley/fidelity-account-overview | 44 | NOASSERTION | 2022-05-12 | Python | Streamlit 账户总览 |
| Hazrat-Ali9/Bank-Management-Frontend | https://github.com/Hazrat-Ali9/Bank-Management-Frontend | 43 | 无 | 2026-09-26 | HTML | Django + Tailwind CDN |
| kzekiue/kosh | https://github.com/kzekiue/kosh | 42 | AGPL-3.0 | 2026-08-04 | TypeScript | 自托管隐私记账 |
| TwoBitFoundry/sumurai | https://github.com/TwoBitFoundry/sumurai | 41 | NOASSERTION | 2026-07-30 | TypeScript | source-available 个人金融 |
| Moises088/personal-finance-app | https://github.com/Moises088/personal-finance-app | 37 | MIT | 2023-01-07 | TypeScript | Expo/RN 记账 |
| uFincs/uFincs | https://github.com/uFincs/uFincs | 31 | MIT | 2025-05-21 | TypeScript | 加密类 GnuCash |
| zuzuleinen/moneytablet | https://github.com/zuzuleinen/moneytablet | 25 | MIT | **2016-10-02** | PHP | 已 9 年未更新 |
| dpuljic01/financial-dashboard | https://github.com/dpuljic01/financial-dashboard | 20 | MIT | 2026-09-07 | Vue | 硕士论文项目 |
| **ekremgunes/BankAppUI** | https://github.com/ekremgunes/BankAppUI | 9 | MIT | 2024-11-14 | JavaScript | **RN + NativeWind，底部 Tab 参考** |
| **mrjakebaker/finance-dashboard-tailwind-alpine** | https://github.com/mrjakebaker/finance-dashboard-tailwind-alpine | 9 | MIT | 2020-12-02 | HTML | 纯 HTML 整页布局 |
| KingshukChatterjee007/Banking-ApplicationUI | https://github.com/KingshukChatterjee007/Banking-ApplicationUI | 4 | 无 | 2025-11-23 | — | **⚠️ 实为空壳仓库：只有 README + 一张截图，无任何源码** |
| pranavkhot/BankingAppUI | https://github.com/pranavkhot/BankingAppUI | 3 | 无 | 2024-11-18 | JavaScript | styled-components 银行站（B 类） |
| saulkurosaki/HORIZON-BANKING-APP-PROJECT | https://github.com/saulkurosaki/HORIZON-BANKING-APP-PROJECT | 3 | 无 | 2025-12-14 | TypeScript | Next.js + shadcn |
| **mikechiloane/Banking-App-UI** | https://github.com/mikechiloane/Banking-App-UI | 2 | 无 | 2023-08-03 | JavaScript | ⭐ **React + 纯 CSS，零样式依赖，最易借鉴** |

### C.2 重点仓库源码摘录（实际抓取）

#### ① `mikechiloane/Banking-App-UI` —— ⭐ **A 类首选样板**（2★ / 无 license / 2023-08-03）

**样式方案：纯 CSS 分文件 + CSS 自定义属性。无 Tailwind、无 CSS Modules、无 styled-components、无 SCSS。** 这是 25 个仓库里**唯一**一个「React + 纯 CSS + 完整银行仪表盘」的组合。

**布局结构**：顶层 `display:flex` 双栏（固定 260px 侧边栏 + `flex:1` 主区）→ 主区内 `display:grid` 三列卡片栅格。**桌面侧边栏，不是底部 Tab** —— 与我们的桌面形态一致。

```jsx
// src/App.jsx —— 顶层双栏壳（原样）
function App() {
  return (
    <>
      <div className='app'>
        <Sidebar />
        <Content />
      </div>
    </>
  )
}
```

```jsx
// src/components/Transactions/Transactions.jsx —— 交易列表行结构（原样节选）
<div className="grid-item" key={transaction.id}>
    <div className="grid-item-l">
        <div className="avatar img-fit-cover">
            <img src={transaction.image} alt="" />
        </div>
        <p className="text">{transaction.name} <span>{transaction.date}</span></p>
    </div>
    <div className="grid-item-r">
        <span className={transaction.type === "debit" ? "text-scarlet" : "text-green"}>
            R {transaction.amount}
        </span>
    </div>
</div>
```

```css
/* src/App.css —— 设计令牌（原样） */
:root {
  --clr-primary: #29221d;      --clr-primar-light: #473b33;
  --clr-secondary: #1e1611;    --clr-white: #fff;
  --clr-pumpkin: #0083BB;      /* 强调色（名叫 pumpkin 实为蓝） */
  --clr-silver: #a8a5a6;       --clr-silver-v1: #bdbabb;
  --clr-scarlet: #fe1e00;      /* 支出 */
  --clr-scarlet-v1: rgb(254, 30, 0, 0.79);
  --clr-green: #00fe93;        /* 收入 */
  --clr-yellow: #fec80a;       --clr-jet: #302924;
  --clr-peach: #ffc397;
  --transition-default: all 300ms ease-in-out;
}
.app { display: flex; min-height: 100vh; }
.lg-value { font-size: 24px; font-weight: 600; }
```

> **可以直接搬的**：双栏 flex 壳、三列栅格响应式（1400/1200/992/768 四断点）、`.grid-common` 卡片规范、**交易行「左 40×40 圆头像 + 名称/日期两行 + 右金额着色」结构**、侧栏 260px → 72px 折叠、`:root` 令牌表。
> **不能搬的**：Google Fonts（Bai Jamjuree）、PNG 图标（`utils/images.js`）—— 我们字体自定、图标用 lucide-react。

#### ② `ekremgunes/BankAppUI` —— 移动端底部 Tab 最佳参数源（9★ / MIT / 2024-11-14）

用的是 **React Native + NativeWind**，JSX 一行都不能直接用，但**尺寸和配色参数可抄**。

```jsx
// components/common/TabBar.jsx —— 底部 Tab（原样节选）
const iconConfig = {
    Home:         { icon: "home-outline",              size: 26 },
    Wallet:       { icon: "wallet-outline",            size: 24 },
    Contact:      { icon: "mail-outline",              size: 24 },
    Transactions: { icon: "arrow-right-arrow-left",    size: 21 },
    Settings:     { icon: "settings-outline",          size: 24 },
};

<View className={`flex-row bottom-0 justify-around items-center px-2 py-2 rounded-full ${
    activeTab === "Settings" ? "bg-black m-0 px-6 pb-6 rounded-none" : "bg-stone-900 absolute m-4"
  }`}>
  {state.routes.map((route, index) => {
    const iconColor = isFocused ? "#fff" : "#b2b2b2";
    return (
      <TouchableOpacity className="flex-1" onPress={() => handlePress(route, index)}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}>
        <View className={`self-center ${route.name === "Home" ? "bg-stone-800 p-2.5 px-3 rounded-2xl" : ""}`}>
          <IconComponent name={iconName} size={iconSize} color={iconColor} />
        </View>
      </TouchableOpacity>
    );
  })}
</View>
```

> **直接印证了 ZA 的形态**：`rounded-full` + `absolute m-4`（**悬浮、四周留 16px，不是贴底通栏**）+ **5 个 tab** + 激活项套一枚圆角胶囊（`rounded-2xl`）+ 激活色 `#fff` / 未激活 `#b2b2b2`。
> **特别值得抄的是无障碍写法**：`accessibilityRole="button"` + `accessibilityState={{selected}}` —— 对应 DOM 就是 `<button aria-current="page">`。我们的 `Sidebar` 已经在用 `aria-current`，移动 tab 照此办理。
> ⚠️ 它的 `#fff`/`#b2b2b2` 是**深色底上**的配色（`bg-stone-900`）。我们的 tab bar 是浅色玻璃，**不能照抄这两个色值**，要用 `--text-secondary` / `--accent`。

#### ③ `actualbudget/actual` —— 生产级令牌层（29190★ / MIT / 2026-09-28）

**这不是 UI 样板，是一个有 29190 star 的生产应用**，所以它的令牌是「被真实用户用过的」。抓到 `packages/component-library/src/tokens.ts`、`themes/palette.css`、`themes/light.css`。

```
// packages/component-library/src/tokens.ts（实测节选）
breakpoints: 512 / 730 / 1100
spacing:     2 / 4 / 8 / 12 / 16 / 24
radius:      4 / 999(pill)
```

```
// packages/component-library/src/themes/palette.css（原样节选）
gray50 #f6f8fa   gray100 #e8ecf0  gray200 #bdc5cf  gray300 #98a1ae
gray500 #4d5768  gray700 #242733  gray900 #080811
navy50 #f7fafc  navy100 #e8ecf0  navy300 #9fb3c8  navy500 #627d98
navy700 #334e68  navy900 #102a43
blue150 #b3d9ff  blue300 #66b5fa  blue500 #2b8fed  blue600 #1980d4  blue900 #034388
green150 #c6f7e2 green500 #27ab83 green700 #147d64 green900 #014d40
```

```css
/* packages/component-library/src/themes/light.css（语义映射，原样节选） */
--color-pageText: #272630;
--color-numberPositive: var(--palette-green700);   /* #147d64 */
--color-numberNegative: var(--palette-red500);
--color-sidebarBackground: var(--palette-navy900); /* #102a43 */
--color-cardBackground: var(--palette-white);
```

并在 `packages/desktop-client/src/components/table.tsx` 里 grep 到 **`ROW_HEIGHT = 32`**（虚拟滚动 `itemSize = 31`）—— **一个 29190★ 的记账应用，列表行高就是 32px**。

> **可以直接搬的**：令牌的**组织方式**（`palette.css` 存原始色阶 → `light.css` 存语义映射 → 组件只用语义名），以及 **`ROW_HEIGHT = 32`** 这个数字。
> **不能搬的**：它的组件是 Emotion 风格 TS 对象 + 虚拟滚动 + 内部私有包 `@actual-app/components`，实现层与我们的手写 CSS 完全不同路。
> **注意 license**：MIT ✅ 可参考。而 `maybe`（54263★）和 `sure`（10284★）是 **AGPL-3.0**，且 `maybe` **已归档**。

#### ④ `abderrahimghazali/shadcn-fintech`（92★ / MIT / 2026-05-18）
**B 类**。`globals.css` 首行即 `@import "tailwindcss"` + `@import "shadcn/tailwind.css"` + `@theme inline`，`components.json` 存在，`src/components/ui/*` 30+ 个 shadcn 组件，还依赖 `motion/react`。
> **只参考视觉参数**：圆角阶梯 `--radius: 0.625rem`（=10px，`--radius-2xl: calc(var(--radius)*1.8)` ≈ 18px）、oklch 明暗两套令牌、卡面语义配色（`bg-emerald-600` / `bg-violet-600` / `bg-amber-600`）、堆叠卡 2s 轮换。**不引任何依赖。**

#### ⑤ `Elias569/fintech-dashboard`（135★ / 无 license / 2026-09-14）
**B 类**。`tailwind.config.ts` + `components.json` 存在，依赖 TanStack Query / react-paginate / sonner。
> **只参考模式**：**交易列表的「桌面表格 `hidden sm:block` + 移动卡片」双形态**（这个模式我们的 `Row` 组件可以参考，但用纯 CSS 媒体查询实现）、`ITEMS_PER_PAGE = 5` 分页、`Intl.NumberFormat` 金额格式化、**分类 → lucide 图标映射表**（这个直接可用，我们已经在用 lucide）。

### C.3 分类结论

#### A 类 —— **能零依赖抄进「React 19 + 纯 JSX + 手写 CSS + lucide-react」**

判定标准：样式不依赖任何 npm 包。

| 仓库 | 抄什么 |
|---|---|
| **mikechiloane/Banking-App-UI** | ⭐ 首选。双栏壳 + 三列栅格 + 卡片规范 + **交易行结构** + 侧栏折叠 + `:root` 令牌表 |
| **actualbudget/actual** | ⭐ **令牌层组织方式**可整表照搬；`ROW_HEIGHT = 32` |
| **mrjakebaker/finance-dashboard-tailwind-alpine** | 布局骨架（`grid-template-columns: 80px 1fr`）、移动端汉堡退化策略、`h-10 w-10` 尺寸。**class 不能粘，翻译成手写 CSS** |
| **ekremgunes/BankAppUI** | **底部 Tab 的参数**（图标 21–26px、胶囊结构、无障碍写法）。代码是 RN，**翻译成 `<nav><button>`** |
| **Hazrat-Ali9/Bank-Management-Frontend** | 信息架构（accounts / transactions / reports 三块）。Tailwind v1 CDN class 不可用 |

#### B 类 —— **必须引 Tailwind / shadcn / styled-components 才能用 → 本项目不引，只参考视觉参数**

| 仓库 | 依赖的真实证据（实测） |
|---|---|
| abderrahimghazali/shadcn-fintech | `@import "tailwindcss"` + `components.json` + 30+ `ui/*` + `motion/react` |
| Elias569/fintech-dashboard | `tailwind.config.ts` + `components.json` + TanStack Query / sonner |
| pranavkhot/BankingAppUI | `NavbarElements.js` 首行 `import styled from 'styled-components'` |
| Hazrat-Ali9/Bank-Management-Frontend | `<link href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css">` |
| saulkurosaki/HORIZON-BANKING-APP-PROJECT | `components.json` + `tailwind.config.ts` + `postcss.config.mjs` |
| ekremgunes/BankAppUI | `tailwind.config.js` 带 `presets: [require("nativewind/preset")]` —— **参数属 A，代码属 B** |

### C.4 可直接抄的参数（全部来自真实源码）

| 值 | 用途 | 出处（仓库 · 文件） |
|---|---|---|
| **`32px`** | ⭐ **生产级列表行高** | actual · `desktop-client/src/components/table.tsx`（`ROW_HEIGHT`） |
| **`24px / font-weight 600`** | ⭐ **金额主字号** | mikechiloane · `App.css`（`.lg-value`） |
| `12px` | 通用卡片圆角 | mikechiloane · `App.css`（`.grid-common`） |
| `10px` | 卡面圆角 / shadcn 基准 | mikechiloane · `Cards.css`；shadcn-fintech · `--radius: 0.625rem` |
| `8px` | 导航项圆角 | mikechiloane · `Sidebar.css`（`.nav-link`） |
| `999px` | 胶囊 | actual · `tokens.ts`（`pill`） |
| `24px`（窄屏 `16px`） | 卡片内边距 | mikechiloane · `App.css` |
| `16px`（窄屏 `12px`） | 栅格列间距 | mikechiloane · `ContentMain.css` |
| `28px` | 列表项间距 | mikechiloane · `Transactions.css` |
| `44px` 高 + `padding: 6px 14px` + `gap: 12px` | 侧栏导航项 | mikechiloane · `Sidebar.css` |
| `40×40` 圆形 | 交易行头像/图标 | mikechiloane · `Transactions.css` |
| `260px` → `72px` | 侧边栏宽 / 折叠宽 | mikechiloane · `Sidebar.css` |
| 断点 `512 / 730 / 1100` | 断点体系 | actual · `tokens.ts` |
| 断点 `1400 / 1200 / 992 / 768` | 断点体系 | mikechiloane · 各 CSS media query |
| `#8a8587` | 次级文字 | mikechiloane · `Cards.css`、`Transactions.css` |
| `bg-stone-900` / `bg-stone-800` | TabBar 底 / 激活胶囊 | ekremgunes · `TabBar.jsx` |
| `ITEMS_PER_PAGE = 5` | 列表分页 | Elias569 · `transaction-table.tsx` |
| `all 300ms ease-in-out` | 默认过渡 | mikechiloane · `App.css` |

### C.5 ⚠️ 抄参数时必须剔除的两项（反例）

调研不能只抄对的，也要标出**不该抄**的：

1. **`#00fe93` 不能用作「收入/正数」文字色。**
   mikechiloane 的 `--clr-green: #00fe93` 是**荧光薄荷绿**，在白底上的对比度约 **1.4:1**，远低于 WCAG AA 对正文的 4.5:1 —— **在白底上基本读不清**。它成立是因为那个仓库的页面底色是**深棕** `#1e1611`。
   → **我们的正/负金额继续用 `--success` `#34c759` / `--danger` `#ff383c`，并且遵循 ZA 的做法：正负号显式书写，颜色只做第二信号。** 这也正是 §A.3.6 第 2 条的理由。
2. **`--clr-pumpkin` 命名与值不符**（名叫「南瓜」实为蓝 `#0083BB`）。抄令牌时**只抄值不抄名字**，否则会把一个误导性命名带进 `tokens.css`。

另外两点风险提示：
- **license 风险**：`maybe`（AGPL-3.0，已归档）与 `sure`（AGPL-3.0）**不适合作为代码来源**；`actual`（MIT）、`mikechiloane`（无 license，**严格说不可再分发**，但抄布局参数与数值不构成侵权）风险较低。**我们只抄参数，不复制代码文件**，这在法律上最安全。
- **`KingshukChatterjee007/Banking-ApplicationUI`（4★）是空壳仓库** —— 根目录只有 README、一个名为 `How it works` 的文件和一张截图，**零源码**。搜索排序会把它排在前面，**不要被 star/名字误导**。



## D. 落地建议

> **前提**：本节所有建议都基于**实测的当前代码基线**，不是从零设计。产品层已经存在（见 D.1），所以这里给的是**增量改动清单**，不是新建方案。

### D.1 当前代码基线【实测】

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/App.jsx` | 273 | 外壳。`route`（默认 `'assistant'`）、`mobileNav`、`showInspector`、`trace` |
| `src/components/Sidebar.jsx` | 77 | 侧边栏：业务层导航(1) + 产品层导航(5) + 历史对话 + 动线面板开关 |
| `src/views/product.jsx` | 224 | `Page`/`Panel`/`Meter`/`Tx`/`Empty` + Overview/Bills/Subscriptions/Cards/Transfer |
| `src/views/AssistantView.jsx` | 29 | 对话入口 |
| `src/components/PipelineInspector.jsx` | — | 右侧动线面板 |
| `src/styles/tokens.css` | 205 | 设计令牌（Apple HIG 血统） |
| `src/styles/app.css` | 539 | 229 个顶层选择器 |

**当前渲染树**：`Sidebar` + `main-area`（`menu-fab` + `AssistantView` | `ProductView`）+ `PipelineInspector` + `Toast` + 两个 Dialog。

**当前导航项**（`Sidebar.jsx` 实测）：
- 业务层：`assistant` 青禾助手
- 产品层：`overview` 概览 / `bills` 账单 / `subscriptions` 订阅 / `cards` 卡片 / `transfer` 转账

**当前概览页有 6 个区块**：balance-hero → stat-grid(本月支出/收入) → 支出分布 → 最近交易 → stat-grid(下次扣费 / 卡片状态)。

> **与 ZA 的第一处差距**：ZA 首页 3 段，我们 6 段。**概览页超载是本项目产品层最明显的问题。**

### D.2 外壳决策：桌面侧边栏 + 移动底部 tab（响应式双壳）

**结论：不要把 ZA 的底部 tab 无条件搬过来，也不要维持现状的「移动端抽屉」。**

| | 桌面（≥900px） | 移动（<900px） |
|---|---|---|
| 形态 | **保留侧边栏** | **新增 ZA 式悬浮胶囊底部 tab** |
| 理由 | 侧边栏要承载**历史对话列表** —— 这是我们独有、ZA 没有的东西（ZA 是纯移动 App）。塞进底部 tab 无处安放 | 抽屉 + FAB 是 2014 年的方案；拇指从屏幕底部够不着左上角的 FAB |
| 导航项来源 | `PRODUCT_NAV` + `AGENT_NAV` 常量 | **同一份常量**，取子集 |
| 历史对话 | 侧边栏内 | 助手页内（点标题栏进抽屉）或助手页顶部一行 |

**移动端底部 4 项** —— 这是本文与「照抄 ZA」最明确的一次分歧：

| # | 标签 | 图标（lucide） | 对应任务（Monzo 框架） |
|---|---|---|---|
| 1 | **概览** | 换成**品牌符号**（对齐 ZA 第一项用 logo） | **看钱** |
| 2 | **账单** | `BarChart3` | **记账** |
| 3 | **订阅** | `RotateCcw` | **管订阅** |
| 4 | **助手** | `MessageCircle` | 替代 Monzo 的 `Help` 位 |

**为什么是 4 项而不是 5 项 —— 三条证据叠加：**

1. **Monzo 的 4-tab 是八家里唯一按「用户任务」而非「银行产品」切的**（§B.2.1），也是最适合个人资金管理的方案（§B.3）。**4 项**是它的数量。
2. **ZA 从 3 项涨到 5 项是业务扩张的副作用，不是设计目标**（§A.2.6）。照抄它的数量等于抄了它的副作用。
3. **Monzo 把「卡片」放进 Home 的余额卡内（`Card` 胶囊），不占一级导航**；ZA 也把 `ZA Card` 放在首页 8 宫格里而非 tab。**两家在「卡片不该占一级」上是一致的。**（§B.3 ④）

**因此 `订阅` 与 `卡片` 的处理不同，这是有意的：**

| 页面 | 是否进 tab | 理由 |
|---|---|---|
| **订阅** | ✅ 进 | 它是本项目的**差异化能力** —— §B.3 ④ 实测「**HK 五家本轮均未发现订阅管理功能**」。差异化能力必须有稳定的一级入口，藏进宫格等于浪费 |
| **卡片** | ❌ 不进 | 低频对象页。按 **ZA + Monzo 一致的做法**放进 `概览` 的 4×2 宫格，点进独立详情页（沿用 ZA Card 页的「双列统计条 + 卡面 + 4×2 操作」形态，见 §D.3.4） |
| **转账** | ❌ 不进（可选） | ZA 把它做成首页右侧**可上滑的动作按钮**（§A.2.5），是「动作」不是「页面」。进 `概览` 宫格第一格。**若团队认为转账必须占一级**，它是第 5 个 tab 的唯一候选（Monzo `Payments` 的先例）；**但 `卡片` 任何时候都不该补进 tab。** |

> **不要做成 6 项以上。** 桌面侧边栏不受此限（纵向空间免费，且要承载历史对话），可以列全 6 项。

**选中态**（照抄 ZA）：
- 未选中 = 灰色线性图标 + 灰色文字
- 选中 = 强调色图标 + 强调色文字 + **背后一枚 8% 强调色胶囊底**
- 整条 tab 悬浮、脱离屏幕左右边缘、**不是贴底通栏**（ZA 实测形态 + `ekremgunes` 实测 `rounded-full` + `absolute m-4`，见 §C.2 ②）
- 无障碍：`<button aria-current="page">`（`ekremgunes` 的 `accessibilityState={{selected}}` 对应写法）

**选中态**（照抄 ZA）：
- 未选中 = 灰色线性图标 + 灰色文字
- 选中 = 强调色图标 + 强调色文字 + **背后一枚 8% 强调色胶囊底**
- 整条 tab 悬浮、脱离屏幕左右边缘、**不是贴底通栏**

### D.3 每个页面的区块顺序与内容

#### D.3.1 概览页 —— 从 6 段砍到 4 段（最高优先级）

| # | 区块 | 做法 | 依据 |
|---|---|---|---|
| 1 | **余额 Hero** | `balance-hero` 保留。**新增眼睛图标**（金额隐藏开关）；金额字号提到 hero 级；把「青禾日常账户 ·· 8826」与**拆分行**（活期 / 理财）放在金额下方，用一根细竖线分隔 | ZA ② + 实测英雄金额 40pt / 屏宽 44% |
| 2 | **4×2 快捷宫格**（新增） | 上排 4 个**动作**：转账 / 存入 / 账单 / 订阅（圆形实底 + 白色线性图标）；下排 4 个**产品**：卡片 / 预算 / 报表 / **全部**（方形或圆角方块，可带柔和产品色） | ZA ③ —— 本次调研最高杠杆的一招 |
| 3 | **動態** | 把现有「最近交易」**升级为三流合一**：交易 + 订阅事件（即将扣费 / 已取消）+ 卡片事件（已冻结）。行尾右对齐金额；**需要行动的那条带一枚强调色胶囊按钮**（如「去处理」）；区块右上角 `›` 进账单页。分类 chips 直接复用账单页的 `chips-row` | ZA ④ |
| 4 | **两张卡 → 两个入口** | 把现有两个 `Panel`（下次自动扣费 / 卡片状态）**合并成一行两个紧凑入口**，或**直接删掉**（侧边栏/底部 tab 已经有「订阅」「卡片」两个独立页，首页再放一遍是重复） | **净删除**。这是 6 段变 4 段的主要来源 |

**砍掉的内容**：
- `支出分布` Meter 区块 → 移到账单页（它属于「分析」，不属于「第一眼」）
- `本月支出 / 本月收入` stat-grid → 移到账单页（概览已有余额，再放两个数字是三个数字抢注意力）
- `下次自动扣费` + `卡片状态` 两个 Panel → 合并成两个 44pt 高的入口行，或删

#### D.3.2 账单页

| # | 区块 | 做法 |
|---|---|---|
| 1 | **月份 + 双列统计条**（新增，替换现在的 stat-grid） | 左 `本月支出` → 大数字；右 `本月收入` → 大数字。**照抄 ZA Card 页的 `本月消費` / `可消費餘額` 双列条**（左列可点进筛选，右列带 ⓘ 解释） |
| 2 | **分类筛选 chips** | 保留现有 `chips-row`（全部/转账/餐饮/购物/交通/订阅/收入），加 `aria-pressed` |
| 3 | **按日分组的交易列表** | 现在是一维平铺。改成**按日期分组**，日期做 sticky 小标题，每组尾部一行「当日合计」。这是流水页的标准形态，ZA 動態同样按时间倒序分组 |
| 4 | **支出分布**（从概览搬来） | 放在列表**下方**（分析在明细之后） |

#### D.3.3 订阅页

> **入口**：底部 tab 第 3 项（移动）+ 侧边栏（桌面）+ 概览页宫格。**这是本项目的一级页面**（差异化能力 —— §B.3 ④ 实测「HK 五家本轮均未发现订阅管理功能」）。

| # | 区块 | 做法 |
|---|---|---|
| 1 | 顶部 `total-pill`（每月合计） | 保留，但升级为**双列统计条**：左 `每月合计`，右 `共 N 项` |
| 2 | 订阅列表 | 现有 `sub-row` 结构（logo + 名称 + 状态 + 右侧金额 + 取消按钮）**已经很好，接近 ZA 的動態行结构，不要动**。增补：**下次扣费倒计时**作为副文本（现在只在概览出现） |
| 3 | 已取消分组 | 现在用 `.muted` 混在同一列表里 → 拆成「生效中 / 已取消」两个分组，已取消折叠 |
| 4 | 空状态 | 复用 `Empty`，**文字即可**，不做插画（见 D.6） |
| 5 | 免责说明 | 保留现有 `page-note`（仅修改演示数据） |

#### D.3.4 卡片页

> **入口**：概览页宫格的「卡片」格 → 独立详情页（**不进 tab**，遵循 ZA 与 Monzo 的一致做法，§D.2）。形态沿用 **ZA Card 页：双列统计条 → 卡面 → 4×2 操作宫格**。

| # | 区块 | 做法 |
|---|---|---|
| 1 | **卡面** | 现有 `.bank-card` 已经做了渐变卡面（`bank-card--0/1`）。**保留**。ZA 的卡面用薄荷绿渐变（实测 `#50f9b9 → #3ae6b1`），我们用自己的 `--grad-brand` |
| 2 | **双列统计条**（新增） | `本月消费` / `可用额度`，照抄 ZA Card 页顶部形态 |
| 3 | **卡面隐私**：卡号默认打码 + **一枚眼睛图标切换显隐** | ZA 实测有此控件 |
| 4 | **操作列表** | 现在卡面下方 + 一个「操作」Panel 里重复列了两次卡片。**删掉重复**，只保留一个操作列表 |
| 5 | 冻结 / 解冻 | 保留现有 `toggle` 逻辑（`setBank` 直接改 state）。**不要加二次确认弹窗** —— 冻结可逆，弹窗是纯摩擦 |

#### D.3.5 转账页

> **入口**：概览页宫格第 1 格「转账」（ZA 把它做成首页右侧可上滑的动作按钮，§A.2.5）；**默认不进 tab**。

| # | 区块 | 做法 |
|---|---|---|
| 1 | **复用现有 A2UI surface** | 已在 `product.jsx` 实现（`fromAction('transfer', …)` + `SurfaceView`）。**这是「两个入口一个内核」最直白的证据，不要另写一套表单** |
| 2 | 顶部说明 | 保留 `「先核对，再确认。模拟转账，不产生真实交易。」` |
| 3 | **★ 新增：5 秒可撤销** | 确认后不停留在「已完成」，而是显示 **5 秒倒计时 + 「撤销」**。实现：`applyTransfer` 延迟 5 秒执行，`setToast` 的 3200ms 改成可撤销的倒计时条。**这是 ZA 最值得抄的一条，成本极低** |
| 4 | 已登记收款人 | `contacts` / `directory` 已存在。给已登记收款人加一行「已登记 · 单笔限额更高」的说明文案即可，**不要建限额引擎** |

### D.4 跨页面复用组件（复用 ≥2 处才抽象 —— 遵 AGENTS.md §1）

| 组件 | 现状 | 建议 | 复用处 |
|---|---|---|---|
| `Page` | ✅ 已有 | 不动 | 5 个产品页 |
| `Panel` | ✅ 已有 | 不动 | 全部页面 |
| `Row`（列表行） | ⚠️ 现在是 `.tx-row`，在**交易、卡片操作**两处复用，订阅另写了 `.sub-row` | **提升为一个 `Row` 组件**：`{icon, title, sub, value, action}`。`.sub-row` 与 `.tx-row` 合并 | 交易 / 订阅 / 卡片操作 / 動態 / 帮助中心 —— **5 处** |
| `Amount`（金额） | ⚠️ 散落在 `.tx-row b` / `.sub-right b` / `.stat-num` | **提取为 `Amount`**：接受 `value / sign / currency / size`。统一 `font-variant-numeric: tabular-nums` + 右对齐 + 正负号显式 | 全部页面 |
| `Empty` | ✅ 已有 | 保留 | 账单筛选空 / 订阅空 / 概览空 |
| `Chip` | ✅ `chips-row` | 加 `aria-pressed` | 账单 / 概览動態 |
| `IconTile` | ❌ 无 | **新增**。两种 variant：`action`（圆形实底 + 白线图标）/ `product`（圆角方块 + 柔和色图标） | 概览快捷宫格、卡片页操作宫格 —— **2 处** |
| `StatBar` | ❌ 无 | **新增**。双列统计条（左值 / 右值 / 中间细竖线 / 可选 ⓘ） | 账单页顶部、卡片页顶部、订阅页顶部、**余额 Hero 的拆分行** —— **4 处** |
| `Meter` | ✅ 已有（`product.jsx` 内） | 不动 | 概览（迁走后仅账单） |

> **净账**：删 1 个重复区块组、合并 2 个行样式；新增 **2 个**组件（`IconTile`、`StatBar`）+ 提升 **2 个**（`Row`、`Amount`）。文件数 +0（都放进 `views/product.jsx` —— 它 224 行，加上这些约 300 行，正好在 AGENTS.md §1 的拆分阈值边缘）。

### D.5 每个页面用现有 `tokens.css` 的哪些令牌

**结论：本节的改动几乎不需要新增令牌。**

| 用途 | 现有令牌 | 说明 |
|---|---|---|
| 页面底色 | `--bg-app` `#f5f5f7` | 已是 ZA `--zad-color-bg_primary: #f6f6fb` 的近亲 |
| 卡片/面板底 | `--bg-surface` `#ffffff` | 与 ZA 一致 |
| 分隔线 | `--hairline` `rgba(0,0,0,.07)` | ZA 是 `rgba(3,5,22,.08)` —— **数值几乎相同，不用改** |
| 正文/次级/三级文字 | `--text-primary/body/secondary/tertiary` | 见下方「中性色」说明 |
| 金额强调 | `--text-primary` + `--text-title-1`/`--text-title-2` | 见下方「英雄金额」说明 |
| 正向/负向 | `--success` `--danger` | ZA 用 `#fc605b` 作 error，我们用 `#ff383c` —— **不要改**，iOS 语义色更标准 |
| 强调按钮 / 选中 tab | `--accent` `--accent-on` `--accent-tint` | ZA 的等效是 `#00d28f` / `#00b880` / `#39e5b1` |
| 快捷宫格动作圆底 | `--accent` | ZA 用 `#00d28f`；我们用 `#0071e3`。**保持我们的蓝** —— 品牌色不该为了「像 ZA」而换 |
| 产品图标柔和底 | `--accent-tint` `--fill-1..4` | 复用现有填充层级 |
| 卡面渐变 | `--grad-brand` | ZA 用薄荷绿渐变；我们用品牌渐变 |
| 圆角 | `--radius-md`(14) 卡片内元素 / `--radius-card`(18) 卡 / `--radius-panel`(22) 大面板 / `--radius-pill` 胶囊 | **只用这 4 个**（见下方「圆角收窄」） |
| 间距 | `--space-3..8` | 与 ZA 的 2/4/8/12/16/20/24/32 **完全同构**，零改动 |
| 触控目标 | `--hit-min` `44px` | ZA 实测圆盘 54.9pt；我们的宫格格子应 ≥44px |
| 动效 | `--ease-spring-critical` / `--dur-spring-critical` / `--ease-spring-sheet` / `--dur-spring-sheet` | **保持不变**（ZA 动效无公开数值，无据可改） |
| 阴影 | `--shadow-hairline` | **见下方「阴影净删除」** |

#### 三处具体的令牌改动

**① 阴影净删除（ponytail ultra：最有价值的一处）**
ZA 在 484KB CSS 里只有 3 个阴影值。我们的 `--shadow-card` / `--shadow-panel` 各是两层，其中 24px/40px 模糊的环境影在 `#f5f5f7` 上几乎不可见。

> **建议**：产品层的内容卡片（`Panel`、`.bank-card`、`IconTile`）**一律不用阴影**，改用「白卡 + `--hairline` 或纯色差」。`--shadow-panel` / `--shadow-lift` **只留给浮层**（`--shadow-overlay` 已单独存在）。**不删令牌定义（对话层还在用），只停止在产品层使用。** 净删除约 2 处 `box-shadow` 声明 × 多个选择器。

**② 圆角收窄到 4 档**
我们现有 10 级圆角（chip 6 / sm 8 / thumb 12 / md 14 / sheet 16 / card 18 / lg 20 / panel 22 / hero 26 / 2xl 28），ZA 只有 5 级令牌。
> **建议**：产品层**只用 4 档** —— `--radius-pill`（胶囊/圆形）、`--radius-md` 14px（行内小元素、chip）、`--radius-card` 18px（卡片、IconTile）、`--radius-panel` 22px（大面板、卡面）。**16/20/26/28 四个中间值在产品层禁用。** 令牌定义保留（对话层在用），但产品层不再出现「16 还是 18」的犹豫。

**③ 英雄金额**
现有最大字号是 `--text-large-title: 2.125rem`（34px）。ZA 实测推算 ≈ **40pt**。
> **建议**：**新增一个** `--text-hero: 2.5rem`（40px）+ `--leading-hero: 1.15` + `--tracking-hero: 0`。**这是本次唯一建议新增的文字令牌。** 只在 `balance-hero > strong` 一处使用（桌面可降到 34px 复用 `--text-large-title`）。

#### 关于中性色：修正一个容易搞错的判断

粗看会觉得「ZA 用同一基色 + 变 alpha，我们用离散纯灰」是根本差异。**把数字摊开算之后，这个判断是错的**：

`--text-primary: #1d1d1f` = RGB(29,29,31)，用它按 alpha 叠在白底上：

| alpha | 推算值 | `tokens.css` 实际值 | 差 |
|---|---|---|---|
| 80% | `#4a4a4a` | `--text-body #424245` | ≈ |
| 64% | `#6e6e6e` | `--text-secondary #6e6e73` | ≈ |
| 48% | `#8e8e8e` | `--text-tertiary #86868b` | ≈ |
| 35% | `#b1b1b1` | `--text-placeholder #aeaeb2` | ≈ |
| 20% | `#cfcfcf` | `--text-faint #d2d2d7` | ≈ |

> **我们的灰阶梯本身就已经是一条「单一基色 + alpha」的坡道。** 策略与 ZA 完全相同。

**真正的差别只有一个：基色的色相。**
- 我们 `#1d1d1f` = RGB(29,29,31) —— **中性黑**（三通道几乎相等）
- ZA `#030516` = RGB(3,5,22) —— **海军蓝黑**（蓝通道是红通道的 **7.3 倍**）

叠 64% 到白底：ZA 得到 `#5e5f6a`（**蓝灰**），我们得到 `#6e6e6f`（**中性灰**）。这与像素实测吻合 —— ZA 页面上的次级文字实测为 `#4d4e5b` / `#4a4b58`，确实明显偏蓝。

> **建议**：**不动。** 我们的中性灰配合蓝色强调色（`#0071e3`）已经成立。把基色改成海军蓝黑是一次**全局重着色**，收益是「更接近 ZA 的观感」，而风险是动到对话层和 A2UI 渲染器的全部视觉。**在 ponytail ultra 下这不划算** —— 记一笔 `ponytail:` 注释说明「若日后想加冷色倾向，改 `--text-primary` 一个值即可，全站自动跟随」，比现在就改更好。

### D.6 按 ponytail ultra：**不要做**什么

按 AGENTS.md §1 的七级阶梯，停在第一个成立的档位。以下每一条都是**明确的不做**，附理由。

#### 直接不要做（抄了就是负担）

| # | 不做 | 理由 |
|---|---|---|
| 1 | **不做 ZA Perks 式的等级体系**（Lv1/Lv2、头像角标） | 依赖真实资产数据（30 天平均每日总资产）与权益后端。演示账本是 `seed()` 出的假数据，做出来是**空壳**。§A.4 ⑧ |
| 2 | **不做錢罌挑战任务**（消费/缴费/换汇/步数挑战） | 需要行为埋点、任务状态机、**步数权限**。ZA 为此付出了极高的合规成本（CN 商店描述专门解释步数权限）。演示项目零收益。§A.4 ⑦ |
| 3 | **不做「優惠」tab / 优惠券 / 盲盒 / 社区投票** | 与「个人资金管理」这个场景无关。ZA 有这些是因为它要卖营销坑位。**我们的导航项必须是资金管理任务。** §A.2.6 |
| 4 | **不做空状态插画** | ZA 的敞口纸箱是**设计资产**（专业插画师产出）。用 CSS/SVG 手搓同质量插画性价比极低，做出来只会显得廉价。**用 `Empty` 文字空状态。** 只抄「位置和尺寸」：居中、约占卡片宽度、在筛选无结果时出现 |
| 5 | **不做彩色产品图标全套** | lucide-react 是**单色线性**图标库，覆盖不了 ZA 那种「彩色实心 + 小块高光」的产品图标。硬凑要么加依赖（禁止），要么手写 SVG（维护成本高）。**`IconTile` 的 product variant 用「柔和色底 + lucide 线性图标」代替** —— 保留「动作/产品」两种语言的分野，放弃 ZA 的具体画法 |
| 6 | **不做暗色模式** | PRD 列为 P1 且未验证；`tokens.css` 已注明。ZA 也没有把暗色当作主要卖点。**不因为「ZA 可能有」而做。** |
| 7 | **不做多币种 / 多账户切换** | 演示数据集（`seed()`）没有这些字段。ZA 的多币种来自 11 种货币的实盘能力。**没有数据的页面不要建。** |
| 8 | **不做弹窗式二次确认（用于可逆操作）** | 冻结卡片、取消订阅都可逆。ZA 的做法是**提交后 5 秒可撤销**，而不是提交前弹窗。**把现有的 `ConfirmDialog` 只留给不可逆操作（转账、重置演示数据）** |
| 9 | **不做独立的「探索」页** | ZA 2.0 的「探索」在 3.0 被证明是营销坑位。我们不需要。 |
| 10 | **导航项不超过 5 个** | 侧边栏现在正好 5 个产品项 + 1 个助手 = 6。移动底部 tab 取 5 个。**不要再加第 6、7 个。** |

#### 不要引的依赖（白名单之外，一律不加）

| 不引 | 为什么不需要 |
|---|---|
| Tailwind / CSS-in-JS | `tokens.css` + 手写 CSS 已经实现了完整令牌层。ZA 自己的 Web 端也只是 React 17 UMD + 手写 CSS，**没有组件库**（§A.7） |
| shadcn/ui / MUI / Chakra / Ant Design | 会把它们的设计语言带进来，和 `tokens.css` 打架，且体积巨大 |
| framer-motion / react-spring | `tokens.css` 已有按阻尼谐振子数值积分生成的 `linear()` 真弹簧曲线，JS 动画库是倒退 |
| recharts / chart.js / d3 | 支出分布是**一条水平 Meter 条**，用现有的 `.a2ui-meter-track/fill`（两个嵌套 `span` + `width: %`）就够了。**引一个图表库只为画进度条，是典型过度工程** |
| react-router | 现在 `route` 是一个 `useState` 字符串 + `switch`。5 个页面、无嵌套、无 URL 需求。**加路由库是净增复杂度** |
| 日期库（dayjs/moment） | 演示数据日期已是字符串（`t.date` 形如 `7月8日 18:00`）。**需要分组时用 `localeCompare` 或字符串切分即可** |
| 图标库（第二套） | lucide-react 已覆盖需要的全部线性图标 |
| 状态管理（redux/zustand/jotai） | 现有 `useState` + `useConversations` + `ctx` 对象已足够。ZA 自己的 Web 端连这个都没有 |

#### 已经做了、但建议**删掉**的

| 删 | 理由 |
|---|---|
| 概览页的 `支出分布` Meter 区块 | 移到账单页。首页不该放分析 |
| 概览页的 `本月支出/收入` stat-grid | 移到账单页。首页有余额就够了 |
| 概览页的 `下次自动扣费` + `卡片状态` 两个 Panel | 合并为两个入口行，或直接删（侧边栏已有独立页） |
| 卡片页「卡面下方」与「操作 Panel」里的**重复卡片列表** | 同一张卡出现两次，是纯冗余 |
| `HistoryDrawer.jsx`（若 `Sidebar` 已完全取代它） | `App.jsx` 已 import `Sidebar` 而非 `HistoryDrawer`；若确认无引用，**删掉整个文件**（25 行 + 一批 `.drawer-*` CSS） |
| `ChatHeader.jsx`（同上） | 同上，确认无引用后删 |

> **净账目标**：产品层这次改动应当做到 **净增加行数 ≈ 0**。删掉 4 个概览区块 + 1 个重复列表 + 可能 2 个孤儿组件，换来 2 个新组件（`IconTile`、`StatBar`）和 2 处令牌值改动。这符合 AGENTS.md §1「任何 PR 如果净增行数为正，必须能说清为什么不能是负的」。

### D.7 哪些开源项目「只抄参数，不抄依赖」

```
┌─────────────────────────────────────────────┬──────────────────────────────┐
│ 抄参数（零依赖）                             │ 只参考（不引依赖）            │
├─────────────────────────────────────────────┼──────────────────────────────┤
│ mikechiloane/Banking-App-UI                 │ abderrahimghazali/shadcn-fintech │
│   · 双栏壳 + 三列栅格 + 卡片规范             │   · 圆角阶梯 10px / 18px      │
│   · 交易行结构（40×40 头像 + 两行文本 + 金额）│   · 卡面语义配色              │
│   · 侧栏 260→72px、行 44px、列表间距 28px    │   · oklch 明暗双令牌          │
│   · 卡片 padding 24px / gap 16px            │                              │
├─────────────────────────────────────────────┼──────────────────────────────┤
│ actualbudget/actual                         │ Elias569/fintech-dashboard   │
│   · 令牌三层组织（palette → semantic → 组件） │   · 表格/卡片双形态           │
│   · ROW_HEIGHT = 32px                       │   · 分类 → lucide 图标映射     │
│   · spacing 2/4/8/12/16/24（与我们同构）     │   · Intl.NumberFormat 金额格式化│
│   · 断点 512/730/1100                       │                              │
├─────────────────────────────────────────────┼──────────────────────────────┤
│ ekremgunes/BankAppUI（参数属 A）             │ pranavkhot/BankingAppUI      │
│   · 底部 Tab：悬浮 + 四周 16px + rounded-full│   · 导航高 80px              │
│   · 图标 21–26px、激活胶囊 rounded-2xl       │   · 容器 max-width 1100px     │
│   · aria-current 无障碍写法                  │   · CTA 药丸 50px             │
├─────────────────────────────────────────────┼──────────────────────────────┤
│ mrjakebaker/finance-dashboard-tailwind-alpine│ Hazrat-Ali9/Bank-Management  │
│   · 布局骨架 grid 80px 1fr                  │   · 信息架构三块              │
│   · 移动端汉堡退化策略                       │   （Tailwind v1 class 不可用）│
└─────────────────────────────────────────────┴──────────────────────────────┘
```

**一句话原则**：
> **A 类抄「结构 + 数值」，B 类抄「观感 + 比例」。**
> 所有抄来的数值都必须**落进 `tokens.css` 的 `:root`**，组件内零硬编码（AGENTS.md §3）。**没有任何一个仓库值得整体引入** —— 我们抄的是 25 个仓库里散落的约 20 个数字和 3 个结构模式。

### D.8 实施顺序与验收

按「收益 ÷ 成本」排序，每一步都能独立交付：

| 步骤 | 内容 | 验收 |
|---|---|---|
| **1** | **概览页减法**：删 支出分布 / stat-grid / 两 Panel，保留 balance-hero + 動態 | 概览页从 6 段变 3 段；`npm run build` 通过 |
| **2** | **`Row` + `Amount` 提取**，合并 `.tx-row`/`.sub-row` | 交易/订阅/卡片操作/動態/帮助中心 5 处用同一组件；视觉无回归 |
| **3** | **`IconTile` 4×2 宫格**加进概览页 | 上排动作圆形、下排产品圆角方块；格子 ≥44px；键盘可 Tab |
| **4** | **`StatBar` 双列统计条**，用于账单/卡片/订阅/余额拆分行 | 4 处复用；数字 tabular-nums、右对齐 |
| **5** | **動態三流合一**：交易 + 订阅事件 + 卡片事件 | 事件类型可共存；待办行带强调胶囊按钮 |
| **6** | **5 秒可撤销转账** | 确认后出现倒计时 + 撤销；点撤销后余额还原 |
| **7** | **眼睛图标**（余额 + 卡号） | 一键隐藏；`aria-pressed` 正确 |
| **8** | **移动端底部 4 项 tab**（概览/账单/订阅/助手，替代 FAB + 抽屉） | <900px 出现；选中态含胶囊底；`aria-current` 正确；卡片/转账经概览宫格进入 |
| **9** | **阴影降级 + 圆角收窄到 4 档** | 产品层无 `--shadow-card/panel`；无 16/20/26/28 圆角 |
| **10** | **`--text-hero` 令牌** + 余额字号 | 新令牌只在 1 处使用 |

**全局约束（每一步都适用）**：
- 组件里**不得出现硬编码颜色**（AGENTS.md §3），一律 `var(--…)`
- 同步更新 `doc/ARCHITECTURE.md`（Mermaid 组件树）、`doc/PRD.md`、`doc/CHANGELOG.md`（AGENTS.md §2）
- 每步至少跑一次真实命令：`npm run build` + `npm test`
- 无障碍底线：流式内容 `aria-live`、弹窗焦点管理、`prefers-reduced-motion` 降级、中文输入法 `compositionstart/end`

---

## 附录：证据清单

### 实际抓取成功的页面/资源（本次会话）

| # | 资源 | 类型 | 用途 |
|---|---|---|---|
| 1 | `itunes.apple.com/lookup?id=1477150600&country=hk` | API(JSON) | App 元数据、评分、5 张截图 URL |
| 2 | `itunes.apple.com/lookup?id=1477150600&country=cn` | API(JSON) | 简中截图、描述、步数权限说明 |
| 3 | `itunes.apple.com/search?term=ZA+Bank&country=hk` | API(JSON) | bundleId 确认 |
| 4 | `bank.za.group/en` | 网页 | 官网自述、用户数、获奖 |
| 5 | `bank.za.group/en/za-perks` | 网页 | ZA Perks 分层与权益表 |
| 6 | `cdn.zaticdn.com/…/7cb8d0bfaa7aaa1a50a7.css` | **CSS** | **★ 84 个 `--zad-*` 设计令牌** |
| 7 | 另外 5 个 `za-bank-portal-web` CSS（合计 484,855 B） | CSS | 字号/字重/行高/圆角/阴影统计 |
| 8 | `blog.za.group/hk/article/ZABankApp2.0` | 网页 | **首页排序原则原文**、账户页 IA、動態定义 |
| 9 | `blog.za.group/en/article/za_bank_app_major_update` | 网页 | 总资产位置、8 快捷、左滑 widget |
| 10 | `blog.za.group/hk/article/Transfer_Guidance` | 网页 | 转账入口动线、分级限额 |
| 11 | `blog.za.group/article/za-bank-transfer-tutorial` | 网页 | **★ 5 秒转账缓冲原文**、FPS 登记、小额免二次验证 |
| 12 | `blog.za.group/en/article/spot_saving06` | 网页 | 錢罌 High-Rate/Chill Pot、挑战内容 |
| 13 | `blog.za.group/en/article/app_shortcuts_with_a_human_touch` | 网页 | App 快捷方式 |
| 14 | 10 张官方截图（HK 5 + CN 5，900×1600） | 图片 | **逐像素取色 + 几何量距** |

### 抓取失败、已明确标注的资源

| 资源 | 状态 |
|---|---|
| `ifdesign.com/…/710648`（iF Design 获奖条目） | **两次 `fetch failed`**。条目存在性由搜索标题证实，正文未获取，本文未引用其内容 |
| `play.google.com/store/apps/details?id=…` | **被拒**：`URL hostname "play.google.com" resolves to a non-public IP address` |
| `www.youtube.com/watch?v=l4VBzdq2FlI`（App 2.0 宣传片） | **被拒**：`URL hostname "www.youtube.com" resolves to a non-public IP address` |
| `finance.mingpao.com`（2026-04-27 App 升级报道） | **被拒**：`URL hostname … resolves to a non-public IP address` |
| `wealth.hket.com/article/2798924/`（HKET 设计分析） | `fetch failed` |
| ZA Bank **App 内动效数值** | **未能证实** —— 无公开来源。本文未做任何断言 |
| ZA Bank **App 内其余页面的截图** | 官方仅公开 5 张。存款/贷款/投资/优惠页形态**未能证实** |

### 测量方法与可复现性

- 取色与量距脚本（可复现）：
  - `doc/research/_raw/za-shots/hist.mjs` —— PNG 解码 + 全图颜色直方图
  - `doc/research/_raw/za-shots/regions.mjs` —— 指定矩形区域主色/最深色
  - `doc/research/_raw/za-shots/measure.mjs` / `measure2.mjs` —— 屏幕包围盒、圆盘直径、字高、栅格间距
  - 实现方式：Node `zlib.inflateSync` 解 IDAT，**手写 PNG 反过滤**（None/Sub/Up/Average/Paeth 五种滤波器），再逐像素统计
- 标度换算：手机屏实测 673px 宽，对应 iPhone 逻辑宽 **393pt** → `1px = 0.584pt`

