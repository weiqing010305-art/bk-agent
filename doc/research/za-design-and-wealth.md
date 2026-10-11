# 众安银行（ZA Bank）设计逻辑 × 理财逻辑 · 深挖报告

> **项目**：bk-agent /「青禾 · 银行 AI 资金管家」
> **上游文档**：`doc/research/za-bank-product-layer.md`（96 KB，UI 层与设计令牌逐像素实测）、`doc/research/revolut-ai-and-za-deep-dive.md`（94 KB，业务对象层级 / 图标体系 / Revolut AIR）
> **本文定位**：**只写上游没写的**。
> **证据等级**：`【官方原文】`官方页面/官方 i18n 逐字引用 ｜ `【实测】`本次会话真实抓取或解析所得 ｜ `【媒体转述】`第三方报道转述官方口径 ｜ `【未能获取】`查不到，明确不编造
> **原始素材**：`doc/research/_raw/za-wealth-raw.md`（99 KB）、`doc/research/_raw/za-design-refs-raw.md`、`doc/research/_raw/_invest_i18n_hk.txt`（887 条 ZA 投资子站繁中 UI 字串）、`doc/research/_raw/za-web/*.txt`

---

## 0. 本文相对上游两份文档新增了什么

**一段话说清。**

上游两份文档把 ZA Bank 拆成了「**UI 长什么样**」（令牌数值、首页逐像素、tab 切法、开源仓库参数）和「**业务怎么分层**」（帮助中心 80 条分类路径、转账 13 子域、卡 8 子域、Revolut AIR）。本文补的是它们**都没有回答的三件事**：

1. **设计逻辑的「为什么」** —— 不是规范，是判据。一级/二级怎么分、**怎么用图标和数字顶掉一整句话**、一屏放几块、空/错/加载三态用什么文案、插画与动效的预算花在哪。这一节的**新证据是 `bank.za.group/invest/hk` 投资子站那份 887 条繁中 UI 字串表**（`__NEXT_DATA__.props.pageProps._nextI18Next.initialI18nStore`），它把 ZA **真实上线的错误文案、空状态文案、按钮文案**原样交出来了 —— 上游完全没有这个口径。
2. **理财逻辑的全链路** —— 上游只在「理财」上写了一小节（开投资户 → 认购 4 步 → 榜单是 IA 一级）。本文把它补成完整的**产品对象模型 + 风险测评位置 + 收益口径与公式 + 申购赎回的截止/到账规则 + 8 种榜单的精确定义 + 新手引导机制**。
3. **官方文档级的数据口径** —— 众安在线（6060.HK）年报/中报里的财富管理表述、ZA Bank 自己的「**基金服务报告**」11 页数据叙事（每 10 个基金用户 8 个在赚钱 / 累计赚取 HKD 2.19 亿 / 已为用户省下 HKD 7 亿认购费），以及 **ZA 官方设计方法论「ZA Fam 小绿卡」**。

**没有重复**：令牌色值、首页逐像素、4×2 八宫格两种图标语言、5 秒转账缓冲、開戶/转账/卡管理流程、Revolut AIR、图标与头像体系 —— 这些请回上游两份文档，本文只在需要时指回。

---

## A. 众安的设计逻辑 —— 不是规范，是判据

### A.1 信息架构遵循什么原则：一级给「钱的状态」，二级给「钱的动作」

ZA Bank 的 IA 判据可以从三条**官方自述**里读出来，互相咬合：

| # | 官方原文 | 出处 |
|---|---|---|
| ① | 「**將你最關心的、正在發生的、你最想做的，由上至下排序**，方便你快速查看。」 | `blog.za.group/article/ZABankApp2.0`（2022-01-22）【官方原文】 |
| ② | 「最關心的資產資訊都可以一目了然，全因**總資產數值和活期存款結餘將清晰展示在首頁的左面**」 | `blog.za.group/hk/article/za_bank_app_major_update`（2023-02-17）【官方原文】 |
| ③ | 「此番升級的核心理念，是將日益豐富的銀行基本功能與投資產品，**劃分成兩個主要界面**」 | 行政总裁吳忠豪，`stockfisher.com.hk/news/a139101a-...`【媒体转述】 |

**由此可推出的放置判据（三条，可当规则用）：**

1. **一级 = 一个「域」，不是一个「功能」。** 底部 5 个 tab 是 `首頁 / 優惠 / 存款 / 貸款 / 投資` —— 前四个是**钱在哪**（活期/定期/负债/投资），`優惠` 是**外部激励**。储蓄钱罌（Savings Pot）**不进 tab**，它挂在存款域下面，因为它是**活期储蓄的子账户**（官方原文：「錢罌是你的**專屬活期儲蓄子賬戶**，只可通過活期賬戶進行轉賬往來」）—— **一个新东西是旧东西的子类型时，它不配拥有自己的 tab。**
2. **二级 = 同一对象上的「动作」。** 卡域的二级全是动词短语（交易管理 / 一键锁卡 / 更换卡 / 海外旅游 / 消費分析）；挂失/补卡/停用被合并成一个子域，因为**它们共享同一个状态机上的三条边**（上游 deep-dive §B.4 已论证）。
3. **业务扩张时，改的是「界面数」不是「tab 数」。** App 3.0 的解法是把 App 劈成「银行主页 / 投资主页」两个主界面，投资主页下再挂 4 个选项（已知含「**市場資訊**」「**資產配置**」），而**不是**继续加 tab，也**不是**拆成两个 App。ZA 明确拒绝后者（「此舉亦有別於部分其他銀行將投資及銀行服務分拆成兩個獨立應用程式的做法，ZA Bank強調一站式服務的便捷性」）。

> **⚠️ 上游已记录的反面观察**：tab 从 3 涨到 5，导致「我这个月花了多少」这类跨产品任务没有归属页。**这是业务扩张侵蚀 IA 的症状** —— 上游 §D.2 决定按「用户任务」切 tab（概览/账单/订阅/助手），是对的。

> **⚠️ 改版的真实代价（本轮新增证据）**：App 3.0 上线后，Google Play / App Store 的真实评论出现「**冇啦啦改哂成個頁面…要係咁找係咁找**」「**吾比用返舊版**」这类反馈【实测，应用商店评论原文】。
> → **可迁移的规则**：**任何 IA 改动都必须保留旧位置的可发现性映射**（哪怕只是一次性提示、或在新位置沿用旧图标/旧措辞）。ZA 这样量级的设计团队都会在这个坑里丢分，我们改页面时必须显式处理。

---

### A.2 ★ 怎么用 UI 代替文字 —— 13 个可核验的实证案例

作者的要求是「**能用一个图标 + 一个数字说清的，不要写一句话**」。ZA 的做法可以归纳成 **5 种替代模式**，每种都有可验证样本。

> ★ **先给一条官方定调（唯一一次）**：ZA 官方影片《ZA Bank App 設計理念》的说明文字是
> 「**簡單清晰的字體、生動的圖標、每日變換的問候語**，銀行服務也可以很親切！💚」（`https://www.youtube.com/watch?v=O5cfvqC5h8U`，ZA 官方频道，2022-09-01，84 秒）【官方原文】
> 三条取向各自对应一个具体做法：**字體要簡單清晰** → 全库只用两个字重；**圖標要生動** → 4×2 两种图标语言；**問候語每日變換** → 首页顶部文案是一个**变量**，不是常量。
> → **最后一条最值得抄**：把首页唯一的一句话做成会变的，就同时消灭了「这句文案要写什么」和「用户每天看到同一句会麻木」两个问题。**文案预算不够时，"让它变"比"把它写好"更划算。**

#### 模式一：用「形状语言」代替「分组标题」

| 案例 | 省掉的文字 |
|---|---|
| 首页 4×2 八宫格：**第一行 4 个是实心绿圆 + 白色线性图标**（动作：轉賬/入錢/貨幣兌換/海外匯款），**第二行 4 个是彩色品牌图形**（产品：錢罌/ZA Card/基金/全部） | 省掉「常用操作」+「我的产品」两行分组标题；零额外高度完成一次语义分类 |

（上游 product-layer §A.2.2 逐像素实测；本文不重复展开。）

#### 模式二：用「一个控件两个动作」代替「两个按钮两条标签」

| 案例 | 官方原文 | 省掉的文字 |
|---|---|---|
| 首页**右侧黄色 ZA 图标**：向上滑 = 转账页，**轻点 = 进入另一种按钮模式** | 「你可能已經見過 ZA Bank App 首頁右側的黃色按鈕，也可能知道**向上滑動會立即進入轉賬頁面**。但你知道還可以**輕點它進入另一種按鈕模式**嗎？」`blog.za.group/article/app_shortcuts_with_a_human_touch`（2024-05-31）【官方原文】 | 省掉「转账 / 存入」两个并排按钮 + 各自一行说明 |
| App 2.0 手册：**長按首頁中的黃色 ZA 圖標 → 拉下存入，拉上轉賬** | `blog.za.group/article/ZABankApp2.0userguide`【官方原文】 | 同上；手势本身就是标签 |
| 卡面：**點擊或將卡面向右滑動**才显示 CVV/有效期 | 同上【官方原文】 | 省掉「点击查看」提示 —— 卡面自己会转 |

> **规律**：ZA 把「**一个高频动作的两种方向**」压进同一个控件，用**方向**（上/下/左/右）而不是**文字**来区分。代价是发现性下降，收益是主页永远只有 1–2 个主按钮。

#### 模式三：用「一个数字块」代替「一句描述」

ZA 投资落地页的「主要基金资产类别」区，用 **3 个数字 + 3 个量词** 表达整个产品卖点【官方原文，`_invest_i18n_hk.txt`】：

| key | 值 | 三者合起来表达的 |
|---|---|---|
| `topic_invest_section3_advantage1_v` / `_u` | `HKD 1 / USD 1` + `起` | 门槛极低 |
| `topic_invest_section3_advantage2_v` / `_u` | `0` + `%` | 零认购费 |
| `topic_invest_section3_advantage3_v` / `_u` | `24` + `X 7` | 随时申赎 |

→ **三句话（"门槛低至一元"、"我们不收认购费"、"二十四小时随时可以买卖"）被压成三个数字块**，块与块之间只靠留白分隔，**一个连接词都没有**。这就是作者要的「一个图标 + 一个数字」。

同类：货币基金页把优势列成三块，每块的标题都是**一个短句**而不是一段话【官方原文】：
- `monetary_fund_advantage_list_1_title` = **較低風險，穿越市場牛熊**
- `monetary_fund_advantage_list_2_title` = **更低門檻，更快到賬，申贖更自由**
- `monetary_fund_advantage_list_3_title` = **收費抵，慳更多—讓更多錢用於增值**

每块下面才挂 1–3 条一行解释（如 `贖回最快即日到賬`、`貨幣基金最低 HKD 1 / USD 1 起投`、`24 × 7 隨時申贖`）。

#### 模式四：用「对照表」代替「说服性文案」

ZA 不讲道理，它给你一张 **痛 ↔ 解** 的两栏表【官方原文，`_invest_i18n_hk.txt`】：

| 「你可能:」`topic_invest_section2_item1_*` | 「基金的優點」`topic_invest_section2_item2_*` |
|---|---|
| 見到機會但不懂投資 | **專業管理** —— 由專業基金經理管理你投資的資金，適合忙錄和投資新手的你 |
| 都市人日忙夜忙 | **專注自己** —— 基金經理和團隊會按市場走勢調整投資策略，讓你專注自己的生活 |
| 資金有限　投資太集中 | **分散風險** —— 投資超過 100 項股票及債券，最少只需 HKD 100 / USD 20 |

→ 左栏三项各 **8–10 字**，右栏小标题各 **4 字**。整张表没说一句「你应该买基金」，但读完就懂了。**这是「用结构代替论证」的标准样本。**

#### 模式五：用「状态/标签」代替「解释句」

| 场景 | ZA 原文 | 省掉的文字 |
|---|---|---|
| 余额隐私 | **一枚眼睛图标**（上游已记录） | 「点击可隐藏金额」 |
| 会员等级 | **头像右下角 `V2` 角标**（上游已记录） | 「查看你的会员等级与权益」 |
| 余额构成 | `活期存款 8,888.88 │ 投資 80,000.00`，中间一根**细竖分隔线** | 「其中投资占 XX%」 |
| 基金风险 | `monetary_fund_low_risk` = **屬較低風險投資產品**（一个标签） | 一段风险说明 |
| 基金费率 | `monetary_fund_positive_income` = **0 認購費**（一个标签） | 「本基金不收取认购费用」 |
| 基金门槛 | `monetary_fund_fund_desc_HKD` = **HKD100 起購 ｜ T+0 認購**（一行两段，竖线分隔） | 两句 |
| 待办交易 | 流水行内一枚**绿色胶囊按钮 `詳情`** | 「此交易需要你处理」 |
| 筛选 | **胶囊分段控件** `全部 / 待處理 / 已處理` | 「按状态筛选」 |

> **可复用的一句话**：**能做成「标签 / 徽标 / 数字块 / 形状差异」的，就不要做成句子。** 句子只留给三种地方：① 空状态（一句 + 一个按钮）② 错误提示（一句 + 一个动作）③ 风险与合规披露（必须写全，且放在脚注）。

---

### A.3 认知负荷控制：一屏几个信息块

**结论：ZA 的一屏 = 1 个「主问题」+ 2 个「次要块」，上限 3 块。**

证据链（全部可核验）：

| 页面 | 信息块 | 出处 |
|---|---|---|
| **首页** | ① 余额（含拆分）② 快捷入口 8 格 ③ 動態流水 | 上游 product-layer §A.2.2【实测】 |
| **投资落地页 / 货币基金页** | ① 优势三块 ② 资产类别三数字 ③ 榜单 | `_invest_i18n_hk.txt`【官方原文】 |
| **帮助中心** | ① 搜索框 ② 四宫格分类 ③ 交易疑问卡 ④ 常见问题卡 | 上游 §2.3【实测】 |

**它处理「信息很多 vs 看得懂」的四个手法：**

1. **把「多」拆成「平行的小块」，而不是「长的一页」。** 基金服务报告有 **11 页**数据，但每页只讲**一件事**（`annualReport_pageContent_pageNTxt`）；货币基金 FAQ 有 **7 条**，全部折在「常見問題」的一个折叠区里。
2. **把「解释成本」外置到脚注，标题只留结论。** 8 种榜单的标题都很短（「從事金融/保險/銀行業的人都在買*」），**定义全部放在一行脚注里**（见 §B.6）。→ 用户第一眼只看到「这个榜有意思」，想较真时往下看一行就有精确定义。
3. **用标签页把「同一件事的两个阶段」分开。** ZA Quest 官方改版的理由原文："**we've revamped the user interface for ZA Quest. You'll have to first claim your ZA Quests from the Quest Zone tab**, after which they will appear under the **My Quests** section." 官方给的理由是 "To help make things a little more organised"（`blog.za.group/en/article/ZA_Quest_upgrade`，2023-09-05）【官方原文】。
   → **「可领取」与「已领取」分成两个 tab**，而不是在一个列表里用状态色区分。**这是零文案的负荷控制：把「我要做决策」和「我在跟踪进度」物理隔离。**
4. **同一网格里分两套视觉权重，不做三套。** 八宫格只有「动作（实心圆）」和「产品（彩色图形）」两种语言，**没有第三种**。

---

### A.4 ★ 空状态 / 加载态 / 错误态 —— ZA 的真实上线文案

> **这是本文最硬的一块新证据。** 上游两份文档对这三态**完全没有覆盖**（只记录了 ZA Verify 页的一枚空状态插画）。本节取自 `bank.za.group/invest/hk` 投资子站的 i18n 字串表 —— **那是 ZA 自己写进 App/Web 的文案，不是分析，不是推测。**

#### 空状态

| key | 官方原文 | 结构 |
|---|---|---|
| `empty_text` | **頁面不見了** | 4 字，**不解释为什么** |
| `empty_btn_text` | **返回財富首頁** | 1 个动作 |
| `portal_page_404_back_to_home_btn` | **返回投資首頁** | 同上（另一代命名） |
| `info_sup_no_file_tips` | **檔案不存在** | 陈述事实，不加"请稍后重试" |
| `investDay0428_home_noTaskListHint` | **暫無任務，盡請期待** | 空 + 一个情绪词 |
| `investDay0528_CouponList_noCouponListHint` | **暫無可領取卡券** | 纯状态 |
| `investDay_myReward_emptyReward_txt` | **暫無獎勵** | 纯状态 |
| `investDay_myReward_emptyReward_bg` | `.../empty-reward_31889.png` | **专属空状态插画**（887 条字串里**唯一**一个空状态图） |

**空状态的三段式公式**：`[4 字状态] + [1 个插画（可选）] + [1 个按钮回主路径]`。**不写「你可以试试…」这类引导句。**

#### 加载态

**结论：ZA 在公开字串里没有「加载中…」文案。** 887 条 i18n 字串里检索 `載入 / 加載 / loading / 讀取` 只有 3 处命中，**全部与 PDF 文件有关**（`info_sup_no_data` = 加載PDF檔案失敗、`info_sup_pdf_open_error` = pdf檔案打開失敗）。
→ **未能获取**：ZA App 的骨架屏（skeleton）实现。**不做推测。** 但可确认的是：**加载态不占用文案预算** —— 这与 §A.5 的资产分布证据方向一致。

#### 错误态

| key | 官方原文 | 设计要点 |
|---|---|---|
| `investDay0428_systemErrorTxt` | **服務器開小差了** | **拟人化 + 不甩锅给用户** |
| `server_is_error` | **服務器開小猜了**（原文如此，疑为「開小差」笔误） | 同上，两个活动版本各自写了一遍 |
| `newPromotion_api_error_txt` | **服務器異常** | 同场景的"正式"版本 |
| `investDay0428_systemErrorCodeTxt` | **錯誤碼：{code}** | **错误码单独一行，不塞进句子** |
| `investDay0428_systemErrorRefreshTxt` | **刷新** | 动作 = 1 个词 |
| `investDay0528_CouponList_getAllCouponAllFailTxt` | **一鍵領取失敗，請稍後再試或逐張領取** | ★ **一句错误给两条出路** |
| `topic_fundJourney_activity_open_status_reject` | **你上傳的資料未能符合開戶要求，暫時無法開戶。重新上傳資料後，可重新審批你的申請。** | ★ **拒绝 = 原因 + 补救路径**，且明确"重新提交后可再审" |
| `investDay__modelContent_NoZACoinAcct` | **你獲得的任務獎勵需要開通za coin后才能領取。** | ★ **阻断态说清"缺什么、去哪补"** |
| `stock-landing-bottom-popup-result-title` / `-hint` | **抱歉** / **現時僅支持香港用戶開戶** | 资格不符：标题 2 字 + 原因 1 句 |

**错误态的公式**：`[拟人化的短标题] + [错误码独立一行] + [1–2 个动作按钮]`。
**关键规律：ZA 从不解释技术原因**（没有"网络请求超时""接口返回 500"），也**从不道歉超过一句**。

> **和上游 Monzo 写作系统的对照**：Monzo 的三原则（短 / 主动语态 / 一致）在 ZA 这里是**同构**的 —— 「服務器開小差了」就是主动语态 + 主语明确（"服务器"干的，不是"你的操作有问题"）。**上游建议把失败文案改主动语态，本节提供了 ZA 的真实样本可以直接抄语气。**

---

### A.5 动效与插画用在哪些地方、不用在哪些地方

**方法**：统计 `_invest_i18n_hk.txt`（887 条）里**所有指向图片资产的键**，按用途分组。共 **105 条**。

| 用途分组 | 键前缀 | 数量 | 说明 |
|---|---|---:|---|
| **营销活动 / 奖励 / 抽奖** | `investDay*`（含 0428 / 0528 / 0628 三个活动版本）、`newPromotion_*` | **70+** | 活动主视觉、任务卡背景、拼图、幸运袋弹窗、奖励金币、卡券图 |
| **数据报告长图** | `annualReport_pageContent_*` | **14** | 基金服务报告 11 页的每页配图（桌面版 + 移动版各一套） |
| **开户旅程** | `topic_fundJourney_*` | **5** | 开户进度/审核状态相关 |
| **货币基金介绍** | `monetary_fund_*` | **5** | 三块优势的配图 |
| **空状态** | `investDay_myReward_emptyReward_bg` | **1** | 全表唯一的空状态插画 |
| 其他 | `funds_topic_` / `stock-landing-navigationBar-iconPath` 等 | 少量 | 图标类 |

**由此可下的三条结论（有据）：**

1. **插画/动效的预算几乎全投在「情绪峰值」场景** —— 抽奖、集拼图、领奖励、完成任务。相关的文案也是全表情绪浓度最高的：`恭喜你抽中`、`恭喜點亮：「{rewardName}」`、`愉快收下`、`恭喜完成任務獲得拼圖 + {num}`、`立即抽大獎`、`我知道了`。
2. **常规态（加载/错误/空）几乎不用插画，只用一句文案 + 一个按钮**（§A.4 已证）。**唯一例外是"奖励为空"** —— 因为那个页面的用户**本来是带着期待来的**，落空需要被安抚。
3. **数据可以用"长图"承载。** 基金服务报告的 11 页全部是滚动长图 + 大数字（i18n 里有 `annualReport_scroll_more_tips` = **向上滑動查看更多**），并支持分享（`annualReport_share_title` / `annualReport_pageContent_page11ShareBtnTxt` = 分享）。
   → **「理财数据」在 ZA 的呈现形态不是表格，是"可滚动的、可分享的大数字海报"。** 这是本报告对理财 UI 最重要的一条形态判断。

> **⚠️ 边界（必须明说）**：**ZA App 的动效曲线、时长、弹簧参数没有任何公开数值**（上游 §A.3.9 已确认，本文复核后维持）。**本文不对 ZA 的动效数值做任何断言。** 上文说的是**资产用途分布**，不是**动效参数**。本项目现有的弹簧曲线保持不变。

---

## B. 众安银行的理财逻辑（作者点名）

### B.0 一句话结论

**ZA 的理财不是一个"页面"，是一个「前置状态机 + 榜单驱动 + 银行活期账户直连」的系统。**
「开投资户」是独立前置对象（必须先过风险问卷）；产品发现靠**8 种带精确定义的榜单**而不是搜索；买卖的**钱直接从活期储蓄账户扣/入**，没有投资钱包；收益用**可分享的大数字长图**讲，不用表格。

---

### B.1 从哪进：投资是一级 tab；App 3.0 起拆成「银行 / 投资」两个主界面

| 项 | 事实 | 来源 |
|---|---|---|
| 入口层级 | **底部 tab 一级**（`首頁 / 優惠 / 存款 / 貸款 / 投資`） | App Store 官方截图 + 上游 product-layer §A.2.1【实测】 |
| 历史沿革 | 2022 年上线时该 tab 叫「**財富**」（"在底部的分類選擇「財富」並點選「基金」"），后改称「投資」 | `blog.za.group/article/zafund`【官方原文】 |
| 现行叙事 | App Store 更新说明：「**理財、消費、投資三大服務**切換更直觀流暢，財務狀況一目了然」 | iTunes Lookup v3.9.27【实测】 |
| App 3.0 | 银行功能与投资产品**分成两个主界面**；投资主页下延伸 **4 个选项**（已知含「**市場資訊**」「**資產配置**」） | 行政总裁吳忠豪，`stockfisher.com.hk`【媒体转述】；明报同日标题「App升級 銀行投資功能分成兩界面」（2026-04-27，正文 403，**仅标题可引用**） |
| 架构旁证 | App 的 **首页 + 基金股票业务用 Flutter**，其余业务用 React Native；深链协议里投资主页的页名就是 `tabName=InvestTab` | `juejin.cn/post/7359416094564286515`（ZA 技术团队官方号）【官方原文】；`_invest_i18n_hk.txt` 的 `zabank://to_main_tab.flutter.action?tabName=InvestTab`【官方原文】 |

> **未能获取**：投资主页那 4 个选项的完整名单（媒体只点名了 2 个）。

---

### B.2 产品对象模型 —— 基金 / 定存 / 活期理财 各自的字段与状态

#### B.2.1 基金（Fund）

**列表项（榜单行）字段**【官方原文，`_invest_i18n_hk.txt` + `fundlists` 页 i18n】：

| 字段 | 繁中原文 | key |
|---|---|---|
| 名称 / 币种 / 代码 | **Name / Currency / Code**（三合一列头） | `wealth_connect_table_header_name` |
| 類型 | **類型** | `funds_topic_fundlist_item_fund_type` |
| 回报期间（**可切换的列**） | **近1月 / 近3月 / 近1年 / 近3年 / 近5年** 及 **到期收益率** | `funds_topic_fundlist_item_ratetype_0..5` |
| 长标签版 | 近1月回報 / 近3月回報 / 近1年回報 / 近3年回報 / 近5年回報 | `..._ratetype_tym_1..5` |
| 派息率（年化） | **Yield (p.a.)** | `wealth_connect_dividend_rate` |
| 其余期间列 | **1 W / 1 M / 3 M / 6 M / 1 Y / 3 Y / 5 Y / YTD / Since Inception** | `wealth_connect_1week…wealth_connect_since_inception` |
| 上架日期 | **上架日期: {year} 年 {month} 月 {day} 日** | `funds_topic_fundlist_gmtModified` |
| 动作 | **查看詳情** / **查看全部基金** | `funds_topic_fundlist_item_check_more` / `_check_more_funds` |

**资产类别枚举（4 类，每类一行定义）**【官方原文，`topic_invest_section3_desc`】：
> - **股票**: 投資於本地和/或環球股票
> - **平衡**: 投資於債券和股票
> - **債券**: 投資政府或公司所發行的債務證券
> - **貨幣**: 主要投資於優質的短期有息證券

**基金型别标签**【官方原文】：`topic_invest_fund_type_stock` = 股票型、`topic_invest_fund_type_alloc` = 平衡型、`topic_invest_fund_type_bond` = 債券型、`topic_invest_fund_type_currency` = 貨幣型。

**基金主题（官网 5 类）**【官方原文】：科技 / 消费 / 天然资源 / 健康 / ESG。

**基金详情页可见字段**（货币基金样本）：

| 字段 | 官方原文 |
|---|---|
| 门槛 + 回报 | `{currency} {minSubAmount} 起購｜1 年回報`（`monetary_fund_fund_desc_tym`）；具体值 `HKD100 起購 ｜ T+0 認購` / `USD20 起購 ｜ T+0 認購` |
| 风险等级 | **屬較低風險投資產品**（`monetary_fund_low_risk`） |
| 回报期间 | **6個月回報**（`monetary_fund_six_month`）、**七日年化回報**、**到期收益率（YTM）** |
| 同类对照 | **同類平均** 与基金值并排（`monetary_fund_hk_1year_class_average` = 2.72 等） |
| 交易规则 | 「更多內容請參閱**基金詳情內的交易規則**」 |
| 风险披露入口 | 「基金的主要風險、備註及 **Morningstar** 免責聲明」 |

> **未能获取**：基金详情页是否展示 ISIN/基金代码独立栏位、页面区块顺序、走势图类型。（官网 `/hk/fundlists` 与基金详情为客户端渲染/需登录，Google/Bing 未索引到 ZA 的基金详情页 URL 样本。）

#### B.2.2 定期存款（Time Deposit）

| 维度 | 事实 | 来源 |
|---|---|---|
| 币种 | **11 种**（港元/人民币/美元/新加坡币/英镑/欧元/加拿大币/澳币/日元/纽币/瑞士法郎） | `bank.za.group/hk/faqs/Individuals/Deposit_related/Time_deposit`【官方原文】 |
| 最低金额 | **1 个货币单位**（如 HKD 1） | 同上 |
| 期限 | **7 天 – 12 个月** | 同上 |
| 金额可否改 | **一经确认不可更改** | 同上 |
| 提前支取 | 有费用公式，最低 HKD 200 | 同上 |
| 到期处理（**3 个状态**） | ① 到期後**續存本金 + 利息** ② **僅續存本金** ③ 到期後**結算本息**（直接存入活期账户） | 同上 |
| 改到期安排 | 路徑「App → 選單列『賬戶』→『存款』→ 選定存 →『到期安排』」；**到期日當天無法更改** | 同上 |
| 币种切换位置 | 「在**開立定存的金額輸入頁面**中，你可以在**頂部**找到對應貨幣的箭頭」 | 同上 |
| 利息口径 | 官方 FAQ 有独立条目 `Time Deposit Interest Calculation Formula`；港元/英镑/新加坡元按 **365 天**计息，其余 **360 天** | 同上 + `bank.za.group/hk/deposit`【官方原文】 |

#### B.2.3 活期理财：储蓄账户 / 錢罌（Savings Pot）

| 对象 | 定义（官方原文） |
|---|---|
| **錢罌 = 活期储蓄子账户** | 「錢罌是你的**專屬活期儲蓄子賬戶**，只可通過活期賬戶進行轉賬往來」；**不可**用于 ZA Card 消费/缴费/还款/转第三方；**只支援港元**；**受存款保障计划保障**；无费用 |
| **High-Rate Pot（高息錢罌）** | 「完成高息錢罌嘅活動挑戰可以獲得**最高共 4.99% 獎勵年利率，加埋 0.01% 嘅港元活期基礎年利率，嗰個月你嘅高息錢罌就可以享受到高達 5% 活期年利率**」；奖赏有效期「由挑戰完成日去到嗰個月嘅最後一日」；**合資格存款上限 HKD 10,000** |
| **Chill Pot（懶人錢罌）** | 无挑战享 **0.5% p.a.**（Lv1，上限 HKD 1,000,000）；「**無最低存款門檻**」 |
| 挑战来源 | 「**日常交易和每日步數**」 |

> ★ **业务模型的区别（对我们的选择有直接影响）**：錢罌是**真实计息的子账户**，不是虚拟目标。Revolut 的 Pockets 是「short-term money management tools」= **心智容器**。**子账户模型的分类统计天然准确（钱本来就分开放），容器模型要靠打标签。** 上游 deep-dive §B.5 已记录这个区别，本文补上官方原文。
>
> ⚠️ **这一条本项目不该抄**（依赖真实资产与后端任务系统，上游 §D.6 已有结论）。

#### B.2.4 股票与加密货币（作为理财域的边界）

| 项 | 事实 |
|---|---|
| 港股 | 0 佣金；平台费 **交易金额 × 0.05%，每单最低 HKD 18**（上限交易金额 1.5%）；0 存仓费 |
| 美股 | 0 佣金；平台费 **每股 USD 0.0099，每单最低 USD 1.99** |
| 碎股 | **不支持买入**（港股碎股仅可在开市后整笔卖出；美股明确"暫不提供碎股交易"） |
| 结算 | 美股 **T+1**、港股 **T+2**；港股以港元储蓄账户、美股以美元储蓄账户结算 |
| 保证金 | **无孖展 / 无融资 / 无沽空**；美股**无盘前盘后** |
| **资金模型（★ 最重要的设计决策）** | 「**Direct trading, no need to deposit in advance** —— We'll **debit the transaction amount directly from your savings account** for buy order, and will **deposit the funds into your savings account after settlement** for sell order.」→ **没有投资钱包，买卖直连活期储蓄账户** |
| 加密货币 | 有；入口「**投資 › 加密貨幣**」；仅限持香港身份证且住址为香港者；需过风险问卷 + **虚拟资产知识测评**；**不受存款保障计划保障**。2024-11 成为「Asia's first licensed bank to provide cryptocurrency trading services for retail investors in Hong Kong」（AR2024 p.24） |

来源：`bank.za.group/hk/hkstock`、`bank.za.group/en/usstock`、`bank.za.group/hk/faqs/Individuals/Investment_Related/*`、2024 年报【均为官方原文】

---

### B.3 风险测评：在哪一步、不做会怎样

| 问题 | 答案 | 来源 |
|---|---|---|
| **在哪一步** | **开投资账户之前**。路徑原文：「登入 ZA Bank App，選擇「**賬戶**」，然後按「**開立基金賬戶**」，完成「**風險取向評估**」，再依照所需步驟進行開戶。」 | `bank.za.group/invest/hk/help-center`【官方原文】 |
| **性质** | 「客戶在開立投資賬戶前，**需要完成一份客戶風險分析問卷，以確定客戶風險取向**」 | 同上 |
| **不做能开户吗** | **不能**。基金服务条件明确要求「完成用戶風險分析問卷，以確定用戶風險取向」 | `bank.za.group/hk/faqs/Individuals/Investment_Related/Fund_trading`【官方原文】 |
| **不做能"看"产品吗** | **未能获取**。官网 `/hk/fundlists`、`/hk/fund-analysis` 为纯客户端渲染，HTML 内无基金数据；投资子站需登录态 | —— |
| **加密更严** | 除风险问卷外，还要「符合客戶風險等級要求／通過**虛擬資產知識測評**／開戶及交易時必須身處香港」 | `.../Cryptocurrency_Trading`【官方原文】 |
| **问卷几道题 / 几档等级 / 各档名称** | **未能获取**。已穷尽检索面：主站 125 条投资/存款/钱罂 Q&A、投资子站 27 条 Q&A、887 条 i18n 字串、官网全部投资落地页、blog 60 篇理财文章 —— **全部只出现名称，没有任何一处公布题数或等级档位与命名** | —— |

> ★ **对本项目可直接用的结论**：**「开投资账户」必须是一个独立的前置对象，不能是「买基金」按钮上的一个弹窗。** 上游 deep-dive §B.5 已从帮助中心分类树推出这一点（`Opening_an_investment_account` 是独立二级域），本文补上了**触发的确切位置（在做任何购买动作之前）**与**阻断的硬性**。

---

### B.4 收益怎么呈现：三种口径 + 真实公式

#### B.4.1 三个口径，各用在哪

| 口径 | 繁中原文 | 用在哪 |
|---|---|---|
| **持有期回报** | **近1月回報 / 近3月回報 / 近1年回報 / 近3年回報 / 近5年回報** | 基金榜单的可切换列；基金详情页 |
| **年化派息率** | **Yield (p.a.)** / 「年化派息率」；算法原文：「派息收益率以**過去 12 個月所派出的股息除以上一個月過去月結基金單位價格**計算。派息金額並不保證，過往紀錄不代表將來表現。」 | 派息基金榜单 |
| **七日年化回报** | **七日年化回報** | **只用于货币基金**；官方定义：「基於該貨幣基金過去七日的資產淨值變化並換算成年化回報率的計算方式。這是一種**假設性的計算結果，並不代表實際的一年回報率**。」 |
| **到期收益率** | **到期收益率（YTM）** | 货币/债券基金榜单列（`funds_topic_fundlist_item_ratetype_0`） |
| **同类对照** | **同類平均** | 货币基金页与基金自身数值并排 |

#### B.4.2 ★ 七日年化回报的**真实公式**（ZA 官方逐家基金公司列出）

这是全网少见的、把算法摊开写进 App 的样本【官方原文，`monetary_fund_common_problem_list_7day_earnings`】：

> - **泰康**：七日年化回報 = [(T8日淨值 / T1淨值) ^ (365 / T1日到T8日之間的自然日數) - 1] × 100%
> - **高騰**：七日年化回報 = [(T8日淨值 / T1淨值) ^ (365 / T8日至T1日之間的自然日數) - 1] × 100%
> - **南方東英**：同上，**包括股息再投資**
> - **平安**：七日年化回報 = (T8日淨值 − T1日淨值) / T1日淨值 / 7 × 365 × 100%
> - **華夏**：七日年化回報 = (最近 7 個自然日累計收益率 ^ (365 / 7) − 1) × 100%；若計算週期起始日為非交易日，當日基金淨值以該日前最近一個交易日之基金淨值替代
> - 官方风险提示：**「此處理可能導致恢復交易期間所顯示之七日年化收益率暫時偏高或偏低。本數據僅為基於替代淨值之數學年化結果，不代表實際的一年回報。」**

> ★ **可抄的一条设计原则**：**当一个"数字"在业内有多套算法时，ZA 把每套公式都写在同一个折叠条目里，而不是挑一套假装唯一。** 这直接回应作者对「不要写演示/模拟备注」的要求 —— **不是把不确定性藏起来，而是把不确定性的来源说清楚，并且放在用户主动点开才会看到的地方。**

#### B.4.3 ★ 图表形态：不是表格，是「可滚动、可分享的大数字长图」

ZA 官方出的《**基金服務報告**》共 **11 页**，每页配一张整图（桌面版 + 移动版两套资源），交互提示是 `annualReport_scroll_more_tips` = **向上滑動查看更多**，末页有 **分享** 按钮【官方原文】。逐页内容：

| 页 | 官方原文（节选） |
|---|---|
| 1 | **ZA Bank 基金服務報告** ｜ 備註：本報告内數據統計時間為 **2022-08-05 至 2025-06-30** |
| 2 | 「在 ZA Bank 基金用戶中，**每 10 個有 8 個在賺錢**」／「已累計賺取 **HKD 2.19 億+**」 |
| 3 | 「**74%** 的基金用戶在買 **貨幣基金**」／「人均持倉: **HKD 190,000+**」＋榜单「ZA Bank貨幣基金*」 |
| 4 | 「曾認購基金的用戶中，超過 **2 成**獲得**基金派息**」／「收到的現金派息累計達：**HKD 30,000,000+**」＋榜单「ZA Bank熱賣派息基金排行榜*」 |
| 5 | 「賺錢比例最高的基金用戶從事的行業是**金融/保險/銀行**，他們的基金平均收益是其它行業用戶的 **2 倍**」＋榜单「從事金融/保險/銀行業的人都在買*」 |
| 6 | 「資產越高的用戶投資基金的比例越高」／「總資產五百萬以上的用戶，比資產不足一萬的用戶，在基金產品配置的比例**高出近 40 倍**」 |
| 7 | 「用戶已獲得累計價值為 **HKD 2 億+** 的基金優惠券」；小贴士：每月 28 日推「**28 投資日**」 |
| 8 | 「已上架基金數量超過 **160 隻**，涵蓋美國、歐洲、印度、中國等地區，以及黃金、科技、生物醫療等不同板塊」 |
| 9 | 「ZA Bank 基金服務費用：所有基金認購費 **0%**」＋榜单「最受歡迎」 |
| 10 | 「已為用戶節省認購費共超過 **HKD 700,000,000**」＋榜单「投資者賺錢最多」 |
| 11 | 「**做壞規矩 做好銀行**」／「立即去 ZA Bank App 體驗！」／分享 |

> **每页都有 `理財小貼士`（DialogTips）指向 App 内的下一步动作**，例如：
> - 「想了解本平台最高派息的基金有哪些？可前往 ZA Bank App「**基金榜單**」查看。」
> - 「可前往 ZA Bank App **基金市場的「基金排行」**，發現更多優質基金」

→ ★ **这是「用 UI 代替文字」在理财域的终极形态**：**一页 = 一个大数字 + 一句结论 + 一行脚注 + 一个去 App 的动作**。整个报告没有一张数据表格。
→ ⚠️ **数据口径已过期**（统计截至 2025-06-30），引用时必须带时间戳。

#### B.4.4 首页余额的拆分

小字标题 `總餘額 (HKD 等值)` + 眼睛图标 → 超大金额 → 下方一行 **`活期存款 8,888.88 │ 投資 80,000.00`**（中间细竖分隔线）【上游 product-layer §2.1 逐像素实测】。

> **未能获取**：App 内**个人投资组合视图**的具体字段与图表类型（需登录态）；持仓收益/累计收益是否单列。上游已确认 ZA 有「資產配置」入口（App 3.0 投资主页四选项之一），但栏位未知。

---

### B.5 申购与赎回的完整交互

#### B.5.1 基金认购（Subscription）—— **4 步**【官方原文，`bank.za.group/hk/faqs/Individuals/Investment_Related/Fund_trading`】

> - 在「**基金排行**」中挑選你想認購的基金，點擊進入**基金詳情頁**
> - 點擊「**認購**」進入**下單頁面**
> - **填寫認購金額**並閲讀**基金銷售文件、交易規則及收費、交易相關資料披露、投資服務條款及細則**後
> - 點擊「**確認**」，**核對交易信息**後**進行身份認證**確認下單

| 参数 | 值 |
|---|---|
| 最低认购额 | 货币基金 **HKD 1 / USD 1**；一般基金 **HKD 100 / USD 20** |
| 扣款账户 | **与银行活期账户直接扣账**（「買賣自動與銀行活期賬戶扣賬／入賬」）；美元基金需先有美元余额，否则提示「**購買力不足**」并建议先手动兑换 |
| 认购费 | 货币基金 **0%**；债券基金 **0.5%**；其他 **1%**（2026-08-01～12-31）；ZA Perks Lv1/Lv2 全基金 **0%** |
| **截止时间** | **货币基金 09:00，非货币基金 14:00**（每只基金可在详情页「交易规则」查看） |
| 确认与分配 | 一般 **1–3 个工作日确认交易 + 3–5 个工作日分配单位**；货币基金**当天或下个工作日**分配 |
| 可否取消 | **「基金的認購或贖回指示一旦提交，即無法取消。」** |
| 是否需补仓 | **不需要**（「認購基金後不需要補倉」） |
| 报价口径 | 有独立 FAQ 条目「**基金報價是當日的交易價格嗎？**」（说明报价 ≠ 成交价） |

#### B.5.2 基金赎回（Redemption）—— **4 步**【官方原文】

> 在「**我的基金**」頁面選擇想要贖回的基金，點擊「**贖回**」進入下單頁面，**填寫贖回份額**並閲讀…後再點擊「**贖回**」，**核對交易信息按確認後進行身份認證**下單。

路径：「**賬戶 › 投資 › 我的基金**」。

| 参数 | 值 |
|---|---|
| 到账（一般基金） | **T+5 – 10 个工作日**发放赎回款项，ZA Bank 收到后存入结算账户 |
| 到账（货币基金） | **港元 T+0、美元 T+1**；截止统一 **上午 9 时** |
| 赎回费 | 现行优惠期内**豁免** |

#### B.5.3 港股 / 美股 / 加密货币的下单

- 股票：**填单 → 核对 → 身份认证**（与基金同构，末步都是身份认证）
- 加密：**3 步**——填金額 → 核對交易信息並閲讀銷售文件/交易規則及收費/交易相關資料披露/投資服務條款 → 「立即買入」/「繼續」+ **身份認證**

> ★ **ZA 的统一模式**：**所有理财下单的最后一步都是「身份认证」，无一例外。** 这是把「权限分级」落成**一个固定末步**、而不是给每个产品各写一套验证策略 —— 与赛题要求的「中风险展示详情并确认、高风险多因子」是同一思路的不同切法（ZA 用**产品类型**决定是否需要更强验证，我们用**风险等级**）。

---

### B.6 ★ 理财首页结构：榜单是一级结构（8 种，每种带精确定义）

上游 deep-dive §B.5(4) 已给出结论「榜单在 ZA 不是营销位，是理财页的一级信息架构」。**本文把榜单本身挖到底。**

#### B.6.1 官方口径：榜单与「资讯即时」「界面好用」并列为投资服务三大要件

> 「ZA Bank 一直致力做好投資服務，不單止產品要夠全面，**資訊要夠即時、榜單功能夠實用**，還有好用 App 介面，讓投資體驗更順暢、更易上手。」
> 「App 內備有**多元基金榜單**作參考，無論是「**最高派息**」或「**表現最佳基金**」等資訊都一應俱全，**多角度資訊幫助你更快找到合適的方向**。」
> —— `blog.za.group/article/investupgrade`（2026-07-30）【官方原文】

#### B.6.2 八种榜单及其**精确定义**（定义句全部是官方脚注原文）

| # | 榜单名 | 官方定义原文 | 出处 |
|---|---|---|---|
| 1 | **熱賣基金** | 「本平台在**過往 14 天內認購交易宗最多的首 3 隻基金**」 | `blog.za.group/article/zafund` 脚注 3 |
| 2 | **最高派息基金** | 「本平台上一個月 **3 隻年化派息率最高**的基金。派息收益率以**過去 12 個月所派出的股息除以上一個月過去月結基金單位價格**計算。」 | 同上 |
| 3 | **最佳表現基金** | 「該基金類別在本平台上 **3 隻最佳 3 年表現**的基金。」 | 同上 |
| 4 | **ZA Bank 貨幣基金** | （页面榜单，标题即分类） | `_invest_i18n_hk.txt` `annualReport_FundRankList_title_Page3` |
| 5 | **ZA Bank 熱賣派息基金排行榜** | 「ZA Bank 的基金用戶**認購金額最多的頭 4 隻派息基金**」 | 同上 `_Page4` + `page4RankHint` |
| 6 | **從事金融/保險/銀行業的人都在買** | 「金融/保險/銀行業的 ZA Bank 基金客戶**認購金額最多的頭 4 隻基金**」 | `annualReport_FundRankList_title_Page5` + `page5RankHint` |
| 7 | **最受歡迎** | 「ZA Bank 的基金客戶**認購筆數最多的頭 10 只基金，不包含貨幣基金**」 | `annualReport_pageContent_page9RankHint` |
| 8 | **投資者賺錢最多** | 「基金客戶**在單只基金上賺錢最多的頭 10 只基金，不包含貨幣基金**」 | `annualReport_pageContent_page10RankHint` |

**另有两种发现入口**【官方原文】：`funds_topic_fundlist_title_hint` = **新上架基金**（附「今次上架嘅基金來自大成國際資產管理有限公司」）；「基金排行榜 → 全部 → 按各資產類別分類查閱」（`topic_invest_section3_desc`）。

#### B.6.3 ★ 从这 8 条能读出的 4 条设计规则

1. **每个榜单只回答一个问题，且这个问题的措辞是「别人在干什么」而不是「这个产品好不好」。**
   「最热卖」「最多人买」「金融业的人都在买」「赚钱最多」——**全部是行为数据，没有一个是评级或推荐**。这既规避了投顾合规风险，又比"五星好评"更有说服力。
2. **每个榜单都带一句精确定义，且定义放在脚注而不是标题里。** 标题极短（「從事金融/保險/銀行業的人都在買*」），定义一行。**认知成本被推迟到用户主动较真的那一刻。**
3. **榜单的排序口径全部可复算**（宗数 / 金额 / 笔数 / 赚钱额 / 年化派息率 / 3 年表现），**没有一个"综合评分"**。→ **可复算 = 可信任。**
4. **榜单和「理财小贴士」成对出现。** 每页报告数据后面都跟一句「想了解…可前往 ZA Bank App『基金榜單』查看」——**榜单是数据的出口，数据是榜单的入口。**

---

### B.7 新手引导：ZA Quest —— 把引导做成「业务里程碑」而不是「教学步骤」

**结论：ZA 没有传统的"功能引导浮层"，它用一套游戏化任务系统（ZA Quest）代替。**

| 维度 | 事实 | 来源 |
|---|---|---|
| 入口 | **首页右上角的「每日签到」图标** —— "Just tap on the **Daily Check-in icon on the top right corner of the ZA Bank App homepage**" | `blog.za.group/en/article/ZA_Quest_upgrade`【官方原文】 |
| 二级入口 | 「更多」>「ZA Quest」 | `blog.za.group/article/za-bank-app-update-dec2020`【官方原文】 |
| IA | **两个 tab**：`Quest Zone`（可领取）与 `My Quests`（已领取） | `ZA_Quest_upgrade`【官方原文】 |
| 奖励单位 | **ZA Coin**：官方原文「100 ZA Coin = HKD 1」；亦可发 **ZA Bank 優惠券** | `blog.za.group/article/zafund` 脚注 4 |
| **理财新手引导的三个里程碑（★ 关键）** | ① **成功开通投资账户** → 最高 **8,800 ZA Coin**<br>② **首次成功认购基金**（最低认购门槛 HKD 100） → 最高 **80,000 ZA Coin**<br>③ **有效基金总额 ≥ HKD 10,000 并维持 20 个工作日** → 最高 **100,000 ZA Coin** | `blog.za.group/article/zafund` 脚注 4【官方原文】 |
| 视觉激励 | 集齐 **Zappy & Alfie 期間限定造型**；活动版是「集拼图」（`恭喜完成任務獲得拼圖 + {num}`、`你已集齊全部拼圖`） | `za-bank-app-update-dec2020`；`_invest_i18n_hk.txt`【官方原文】 |
| 活动版任务结构 | 「本活動共設**三個關卡**，參加者須於每個關卡中完成至少一項 ZA Quest 中的指定任務以獲得對應的「**拼圖**」」；集齐三款最高 **28,800 ZA Coin**；完成 ≥3 个指定任务得「額外獎賞」最高 **888 ZA Coin** | `_invest_i18n_hk.txt` `investDay0428_home_introduction_content2` / `investDay0528_home_introduction_content2`【官方原文】 |
| 状态文案 | `做任務，贏獎勵`、`去抽獎`、`查看獎勵`、`已完成`、`已鎖定`、`暫無任務，盡請期待` | `_invest_i18n_hk.txt`【官方原文】 |

> ★ **这是本节最重要的一条可迁移结论**：
> **ZA 的新手引导 = 三个业务里程碑（开户 → 首购 → 留存 20 个工作日），用奖励串起来。**
> 它**不解释界面怎么用**，它**定义"做到什么算入门"**，并把进度做成一枚首页图标。
> → **对 bk-agent 的直接映射**：我们的「新手引导」不该是"点这里看账单、点那里转账"的浮层教学，而应该是**一条里程碑清单**（如「完成第一次对话查询 → 完成第一笔带确认的转账 → 设置一个定时转账」），进度挂在首页。

---

## C. 可落地的设计手法清单

> 每条格式：**做法 → 解决什么问题 → 证据**。全部可在现有 `tokens.css` 体系与依赖白名单内完成。

### C.1 「UI 代替文字」的 8 条硬手法（直接服务于「单页 ≤150 字」）

| # | 做法 | 解决什么问题 | 证据 |
|---|---|---|---|
| 1 | **把并列的描述句改成「数字块 + 量词」**：不是"门槛低至一元"，而是 `HKD 1` 起 / `0` % / `24` ×7 三个块 | 一句话 ≈ 12–20 字；三个数字块 ≈ 6 字 | `topic_invest_section3_*`【官方原文】 |
| 2 | **同一网格内用两套形状语言代替两行分组标题**：实心圆=动作，彩色图形=对象 | 省掉两行分组标题（≈8–16 字）+ 一次语义分类 | 上游 §A.2.2【实测】 |
| 3 | **把状态做成标签而不是句子**：「較低風險」「0 認購費」「T+0」挂在数字旁 | 一段风险/费率说明 ≈ 30–50 字 → 3 个标签 ≈ 11 字 | `monetary_fund_low_risk` / `_positive_income` / `fund_desc_HKD`【官方原文】 |
| 4 | **一行内两段用细竖线分隔**，不写连接词：`活期存款 8,888.88 │ 投資 80,000.00` | 省掉"其中投资占…" | 上游 §2.1【实测】 |
| 5 | **一个控件两个方向代替两个按钮**：上滑/轻点、左滑/右滑 | 每省一个按钮 ≈ 省 2–4 字标签 + 一块面积 | `app_shortcuts_with_a_human_touch`【官方原文】 |
| 6 | **对照表代替说服文案**：左「你可能:」三项各 8–10 字，右「优点是」小标题各 4 字 | 一段"为什么要用 X"的文案 ≈ 60–100 字 → 一张 3×2 表 ≈ 40 字且更好读 | `topic_invest_section2_item1_*/item2_*`【官方原文】 |
| 7 | **待办浮出用行内一枚胶囊按钮**（如 `詳情`），不写"此条需要处理" | 省掉一句提示 + 一个独立待办区 | 上游 §A.4④【实测】 |
| 8 | **空/错误文案只留三段：状态 + 动作 +（可选）错误码** | 空态文案常写成 3 句 ≈ 40 字 → 压到 2 个词 + 1 个按钮 | §A.4 全部样本【官方原文】 |

### C.2 「一眼高级」的具体做法

| # | 做法 | 具体数值 / 做法 | 解决什么问题 | 证据 |
|---|---|---|---|---|
| 1 | **字号只靠「对比」拉开，不靠数量** | ZA 全 Web 库只用两个字重（400/700），靠字号 + 颜色分层；正文 16px / 行高 24px（1.5）；英雄数字 56px | 字重多 → 页面花；字重少 + 字号差大 → 干净且有层级 | 上游 §A.3.6 + 「484KB CSS 里 font-weight 400×50 / 700×45」【实测】 |
| 2 | **中性色 = 同一基色 + 变 alpha** | ZA 全部中性色来自基色 `#030516`（海军蓝黑，蓝通道是红的 7.3 倍）的不同 alpha（0.8/0.64/0.35/0.22/0.08） | 灰"不发死"；层级统一 | 上游 §A.3.2【实测】 |
| 3 | **删阴影，用「色差 + 圆角 + 间距」做层级** | ZA 全站 484,855 字节 CSS 里只有 **3 个 box-shadow 值 / 6 条声明** | 阴影多 → 廉价感；净删除还能提质感 | 上游 §A.3.7【实测】 |
| 4 | **红绿只做信号，不做品牌色** | 涨跌色只出现在数字与状态；图标底色、标题、按钮一律不用红绿 | 红绿滥用 → 视觉噪音 + 焦虑 | 上游 §C.1 Skins Factory 原文 |
| 5 | **图标必须"挣得自己的位置"** | 一屏内图标数量设上限；同网格内用**形状**区分语义 | 图标装饰化 → 认知负担 | 上游 §A.4③【实测】 |
| 6 | **留白给「唯一重要的东西」** | 首页第一屏只装一个数字（余额 40pt / 占屏 44%） | 第一屏回答 5 个问题 = 一个都记不住 | 上游 §A.4①【实测】 |
| 7 | **间距节奏用 4/8pt 网格，等级要少** | ZA 只有 **8 级间距**（2/4/8/12/16/20/24/32）、**5 级圆角**（2/4/8/14/20） | 间距等级多 → 节奏乱 | 上游 §A.3 令牌文件【实测】 |
| 8 | **正文不用负字距** | ZA 全库 **0 条 letter-spacing 声明** | 中文 + 数字密集界面，负字距伤可读性 | 上游 §A.3.5【实测】 |

### C.3 理财域专属的落地手法（本报告新增）

| # | 做法 | 解决什么问题 | 证据 |
|---|---|---|---|
| 1 | **先建「投资账户」对象，再谈买基金** | 直接给"买入"按钮 → 用户在第一笔交易时才撞上风险测评，挫败感最大 | §B.3【官方原文】 |
| 2 | **榜单做一级结构，且每条带一行精确定义脚注** | 用户不知道买什么；且"推荐"有合规风险 —— 行为数据榜单既解决问题又无风险 | §B.6【官方原文】 |
| 3 | **榜单标题写"别人在干什么"，不写"这个好不好"** | 规避评级语义；同时比评分更有说服力 | §B.6.3【官方原文】 |
| 4 | **买卖直连活期账户，不设投资钱包** | 少一个"充值"步骤、少一个余额概念、少一屏 | §B.2.4【官方原文】 |
| 5 | **下单末步统一是「身份认证」，不做产品各异的验证策略** | 一致性；用户形成肌肉记忆 | §B.5.3【官方原文】 |
| 6 | **把"截止时间"和"到账时间"做成详情页的固定字段，不在流程里解释** | 「什么时候能到账」是理财第一焦虑；放在固定位置比弹窗解释好 | §B.5.1–B.5.2【官方原文】 |
| 7 | **当一个数字有多套算法时，全部列出而不挑一套** | 隐藏不确定性 → 信任崩塌；摊开 → 专业感 | §B.4.2【官方原文】 |
| 8 | **收益用「大数字 + 一句结论 + 分享」的滚动长图，不用表格** | 表格让人算；大数字让人懂 | §B.4.3【官方原文】 |
| 9 | **新手引导 = 业务里程碑清单，不是浮层教学** | 教学浮层被跳过率极高；里程碑有奖励且可度量 | §B.7【官方原文】 |
| 10 | **插画/动效预算只投给「情绪峰值」场景** | 常规态加插画 → 页面变重、加载变慢、收益递减 | §A.5（105 条资产 key 的分布统计） |

---

## D. 参考资料

### D.1 一手：ZA 官方（全部本次实测可访问）

| 资源 | URL | 用途 |
|---|---|---|
| 官网 sitemap（3,358 条 URL，**投资/存款页的入口**） | `https://bank.za.group/sitemap.xml` | 定位所有投资页与 FAQ |
| 基金服务页 | `https://bank.za.group/en/fund`、`https://bank.za.group/fund` | 四大卖点、5 大基金主题、5 条 FAQ |
| 基金榜列表页 i18n（`wealth_connect_*` 表头） | `https://bank.za.group/en/fundlists` | 榜单表格列模型 |
| 港股页 | `https://bank.za.group/en/hkstock`、`/hk/hkstock` | 费率、榜单、iF 自述、Sia Partners 排名 |
| 美股页 | `https://bank.za.group/en/usstock` | 费率、资金模型、实时报价限制 |
| 存款页 | `https://bank.za.group/en/deposit`、`/hk/deposit` | 錢罌两类型、利率表、加息活动 |
| 收费表 | `https://bank.za.group/en/rates-list` | **投资服务收费简介.pdf**（PDF 直链为 JS 生成，**未能获取**） |
| **投资子站帮助中心**（27 题，4 分类） | `https://bank.za.group/invest/hk/help-center` | 开户 / 基金交易 / 基金收费 / 营销活动 |
| **投资子站 i18n 字串表**（887 条繁中，★ 本报告最硬的证据源） | `bank.za.group/invest/hk` 的 `__NEXT_DATA__.props.pageProps._nextI18Next.initialI18nStore` | 空/错状态文案、榜单定义、货币基金字段、7 日年化公式 |
| 基金服务报告（11 页数据） | `https://bank.za.group/invest/hk/annual-report` | 用户收益口径（**统计截至 2025-06-30**） |
| 主站帮助中心（投资/存款/钱罂 125 题） | `https://bank.za.group/hk/faqs/Individuals/Investment_Related/{Fund_trading,Opening_an_investment_account,HK_Stock_Trading,US_Stock_Trading,Cryptocurrency_Trading}`、`.../Deposit_related/{Time_deposit,Current_Savings}`、`.../Savings_Pot/{High_Rate_Pot,Money_Safe_Pot,Common_Questions_about_Savings_Pot}` | 全流程规则原文 |
| 官方 blog：基金上线 | `https://blog.za.group/article/zafund` | 开投资户→认购 5 分钟、三大榜单定义、ZA Quest 三里程碑 |
| 官方 blog：投资收费升级 | `https://blog.za.group/article/investupgrade` | 「榜單功能夠實用」+ 完整费率 |
| 官方 blog：App 2.0 | `https://blog.za.group/article/ZABankApp2.0` | ★ 首页排序原则 |
| 官方 blog：App 2.0 手册 | `https://blog.za.group/article/ZABankApp2.0userguide` | ★ 逐层点击路径（IA 实证） |
| 官方 blog：App 六大更新 | `https://blog.za.group/hk/article/za_bank_app_major_update` | 总资产放首页左面 |
| 官方 blog：首页快捷工具/手势 | `https://blog.za.group/article/app_shortcuts_with_a_human_touch` | ★ 黄色按钮双模式、小工具横滑 |
| 官方 blog：4 大新功能 | `https://blog.za.group/article/za-bank-app-update-dec2020` | ★ 用户反馈→版面修改闭环；ZA Quest 二级入口 |
| 官方 blog：ZA Quest 改版 | `https://blog.za.group/en/article/ZA_Quest_upgrade` | ★ Quest Zone / My Quests 两 tab 及官方理由 |
| 官方 blog：iF 获奖自述 | `https://blog.za.group/en/article/ZA-Bank-global-recognition` | 「our exceptional App design… iF Design Award 2025」 |
| 官方 blog：ZA Fam 小绿卡（★ 设计方法论） | `https://blog.za.group/hk/article/little-green-card` | 10+ 场活动 / 200+ 张意见卡 / 首个用户体验测试 / CEO+CTO 参与 |
| ★ **官方影片《ZA Bank App 設計理念》** | `https://www.youtube.com/watch?v=O5cfvqC5h8U`（ZA 官方频道，2022-09-01，84 秒） | 官方对设计取向的唯一自述（见下） |
| App 元数据（Apple iTunes Lookup） | `https://itunes.apple.com/lookup?id=1477150600&country=hk` | v3.9.27、评分 4.75856、更新说明 |
| ZA 技术团队：App 架构（★ 首页+基金股票=Flutter） | `https://juejin.cn/post/7359416094564286515` | 技术分层与路由降级 |
| 众安在线年报/中报（HKEXnews） | 2023 `.../2024/0424/2024042402440.pdf`；2024 `.../2025/0424/2025042402390.pdf`；**2025 `.../2026/0428/2026042803175.pdf`**；2026 中报 `.../2026/0907/2026090701085.pdf` | 财富管理业务表述与指标 |

**官方影片说明文字（逐字）**【官方原文，ZA 官方频道】：

> 簡單清晰的字體、生動的圖標、每日變換的問候語，銀行服務也可以很親切！💚

→ 这是 ZA 官方**唯一一次**以「設計理念」为题对外表述。三条取向各对应一个具体做法：**字體要簡單清晰**（只用两个字重）、**圖標要生動**（4×2 两种图标语言）、**問候語每日變換**（首页顶部文案是变量，不是常量）。
→ **未能获取**：影片口播字幕（`yt-dlp --write-auto-subs` 两次返回 `HTTP Error 429`，timedtext 直连正文长度 0）。

**App Store 官方版本说明（逐字）**【官方原文，iTunes API v3.9.27 / 2026-09-22】：

> 我們**全面優化介面設計與操作體驗，理財、消費、投資三大服務切換更直觀流暢**，財務狀況一目了然…
> **一個 App，理財、消費、投資，全面掌控。**

**年报里关于理财的关键原文（英文版，逐字）**：

- **2025 年报 p.22（印刷页 20）**：「ZA Bank continued to expand its **retail wealth management** business, striving to create a **one-stop investment and wealth management experience**, and the related investment business remains a **major driver of non-interest income growth**.」同页指标：用户破 100 万 / 首次盈利 net profit **HKD 17.27m** / 净收入 **HKD 892m（+62.7%）** / **非利息收入 HKD 223m（+277.9%）** / 客户存款 **HKD 22,245m**。
- **2024 年报 p.26**：「Following the launch of investment fund services in **August 2022**, ZA Bank officially introduced its **US stock trading services in February 2024**」；零售用户逾 80 万；存款 HKD 19,399m（+65.9%）。
- **2023 年报 p.26**：「successfully onboard **over 100 investment fund products**. As at December 31, 2023, retail users' **assets under management amounted to nearly HKD1 billion**.」
- **2026 中报 p.13–14**：净利润 **HKD 71m**；净收入 HKD 578m（+26.6%）；「In **January**, it officially launched **H-share IPO subscription services**…」
- ⚠️ **官方文件自相矛盾（原文照录，不做调和）**：2023 年报写取得第 1 类牌照为「**January 2021**」；2024/2025 年报与 2024 中报均写「**January 2022**」。

### D.2 获奖与第三方

| 资源 | URL | 可核验事实 |
|---|---|---|
| **iF Design Award 2025 获奖页** | `https://ifdesign.com/en/winner-ranking/project/za-hong-kongs-no1-digital-bank-800000-users/710648` | 编号 710648；类别 Branding & Communication Design → Apps/Software；类型 Mobile application - Fintech；设计方 **ZA Bank Limited UX Design Team**（in-house，10 位署名设计师：Zhendong Liu, Xinpu Jiang, Jingjing Dai, Ying Fang, Shipei Zhang, Huizi Sun, Zhonghan Zhu, Xiaoting Yi, Lifang Liu, Weiyu Jiang）；Date of Launch 2022；Development Time up to 6 Month。**该页无独立 jury statement**，唯一设计说明是报名方 description |
| ★ **抓取技巧（可复现）** | `curl.exe -sSL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"` | `web_fetch` 对该 URL 报 `TypeError: fetch failed`（工具层问题，**不是 403**），**curl 带 Chrome UA 拿到 HTTP 200 / 99,100 字节**；Wayback 反而**无快照** |
| iF 描述原文 | 同上 | 「…including the **smooth digital account opening process**, the **lai-see feature first to market**, **gamifying debit Card** and competitive products such as **Time deposits and Mutual funds**. With the help of **AI and Web3** technologies…」 |
| 智通财经（iF 获奖中文报道） | `https://www.zhitongcaijing.com/content/detail/1258425.html` | 80 万用户 / **占香港可使用银行人口 13%** / **Z 世代渗透率 25%**；银行公会调查：97% 个人用户、99% 中小企业满意 |
| Sia Partners 2023 International Mobile Banking Benchmark | `https://www.sia-partners.com/en/insights/publications/sia-partners-2023-international-mobile-banking-benchmark` | ZA 全球第 6、亚洲第 1（ZA 官网自述） |
| 香港经济日报「華田銀行」专栏：**Power Slider 设计分析** | 直连 `https://wealth.hket.com/article/2798913/`（CAPTCHA）；Wayback `https://web.archive.org/web/20220122134853/https://wealth.hket.com/article/2798913` | ★ 第三方设计分析：ZA 把 4 大 **Power Journey**（登录 / 余额查询 / 转出 / 转入）放在最高优先级；原文「這兩個頁面都清楚告訴客戶：**我們正在關注你的 Power Journey！你最關心最常用的指示在優先為你準備！**」 |
| 设计师署名（Dribbble） | `https://dribbble.com/shots/14237560-ZA-Bank-Virtual-bank`（Ben Zheng / `@aaaben`，for RaDesign） | 设计师自述「the **bank project I was in charge of at ZA**… **Users only need to spend five minutes on the phone to complete the account**」；配色 `#0DBB6B` 亮绿 / `#070D11` 近黑 |
| 设计师署名（Dribbble，借记卡） | `https://dribbble.com/shots/14670068-Virtual-bank-Debit-card-Website` | 「we also need to create an **entry point on the website that can guide users**」 |
| 明报（App 3.0 报道） | `https://finance.mingpao.com/fin/daily/20260427/1777221705602/` | ★ **仅标题可引用**：「App升級 銀行投資功能分成兩界面」（正文 403，Wayback 无快照） |
| stockfisher（App 3.0 全文） | `https://www.stockfisher.com.hk/news/a139101a-0c66-47e4-a3e4-7a7bd0f31e94` | 双主界面 + 投资主页 4 选项 + Claude Code 3 个月完成 2.0→3.0 |
| Euromoney 2026 | `https://www.euromoney.com/article/5pt1jr4jv74skg0s8ko88kccw/...` | Hong Kong's best digital bank 2026 |
| ZA 设计岗 JD（组织归属） | `https://hk.joblum.com/job/aigc-graphic-and-ui-designer-generative-ai/2919918` | 由 **ZA International** 统一招聘，与 Branding / Business / product designers 协作 |

### D.3 开源实现（理财域，全部经 GitHub API 实测 star/license）

> 完整清单（22 个仓库 + 源码原文摘录 + 文件树 + 许可证风险分组）在 `doc/research/_raw/za-design-refs-open-source.md`（67 KB / 1,318 行）。
> 上游 `za-bank-product-layer.md` §C 的 25 个仓库是「手机银行 UI 库」，本文这一组是**理财域专用**（定投 / 风险问卷 / 持仓收益 / 申赎记录），方向不重叠。

**9 个「零依赖可直接抄进 React 19 + 纯 JSX + 手写 CSS」的文件**（字段全部取自 `gh api` 原始返回）：

| 想要的东西 | 文件 | 许可证 | 依赖 |
|---|---|---|---|
| **风险问卷题库 + 分数→等级映射 + 目标资产配置** | `Jojour13/portfolio-tracker :: src/lib/risk.ts` | **MIT** | **零依赖纯函数** |
| **持仓收益 / 当日收益 / 收益率汇总** | `UlyssesLx/fund-app :: src/stores/holding.ts` | **MIT** | 逻辑零依赖 |
| **金额 / 百分比 / 净值格式化 + 红涨绿跌判定** | `UlyssesLx/fund-app :: src/utils/format.ts` | **MIT** | **零依赖纯函数** |
| **申购 / 赎回 / 分红 交易记录模型与成本摊薄** | `UlyssesLx/fund-app :: src/stores/trade.ts` | **MIT** | 逻辑零依赖 |
| **定投终值 FV 公式** | `UlyssesLx/fund-app :: src/views/Calculator.vue` | **MIT** | 公式零依赖 |
| **定投（SIP）未来值 + 逐年投影（★ 带单测）** | `MathewSachin/MathewSachin.GitHub.io :: src/scripts/tools/sip.ts` | MPL-2.0（文件级 copyleft） | **零依赖纯函数** |
| **持仓表 gain/loss 与 gain/loss% + 空状态文案** | `1Realmoe/Personal_finance_manager :: components/features/holdings-table.tsx` | **MIT** | 计算零依赖 |
| **组合汇总（★ 已是 React 19 + lucide-react）** | `1Realmoe/Personal_finance_manager :: components/features/portfolio-summary.tsx` | **MIT** | 计算零依赖 |
| **真 XIRR（牛顿迭代）** | `asrajavel/mf-analysis :: assets/js/libraries/xirr.js` | **MIT** | 依赖 moment（可换 3 行） |

**关键代码原文（可直接对照实现）**：

```js
// 风险评分（Jojour13, MIT）：5..20 分 → 4 档
if (total <= 8) return "conservative";
if (total <= 12) return "balanced";
if (total <= 16) return "growth";
return "aggressive";

// 持仓行收益（1Realmoe, MIT）
const currentValue = quantity * currentPrice;
const costBasis = quantity * avgPrice;
const gainLoss = currentValue - costBasis;
const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

// 申购/赎回换算（UlyssesLx, MIT）
shares = amount / netValue;   amount = shares * netValue;

// 定投终值（UlyssesLx, MIT）
totalValue = periodAmount * ((Math.pow(1 + periodRate, periods) - 1) / periodRate) * (1 + periodRate);
```

> ⚠️ **口径差异（选用前必须确认）**：`sip.ts` 用**期末投入**，`Calculator.vue` 用**期初年金**（末尾乘 `(1+r)`）—— 同一组参数结果不同。

⚠️ **许可证红线（务必先看）**：`akshayjethwa-dev/Aapa`、`hytan19/JominvestApp`、`Dhruv12Agarwal/Mutual_Fund_Analyzer`、`Vab31/finhunt_frontend`、`amruthpillai/MutualFund-Investment-Calculator`、`bu6030/stock-and-fund` 的 API 返回 `license.spdx_id = null` → **法律含义是「保留所有权利」，不可抄代码**。传染性许可证：`ghostfolio`(AGPL-3.0)、`GiuseppeDM98/net-worth-tracker`(AGPL-3.0)、`nbzz/converasset`(GPL-3.0)。MPL-2.0（可商用，复制文件须保留声明）：`MathewSachin/*`、`openMF/*`。

**中文市场结论**：**没有**活跃维护且匹配 React 19 栈的银行理财 App；唯一真正可抄的是 `UlyssesLx/fund-app`（MIT，36★，2026-01-30 最后 push）。
**未能获取**：KYC 前端流程（搜到的仓库 star 均 ≤3，全是证件 OCR/活体后端脚本）；SurveyJS 计分路径（`repo:surveyjs/survey-core calculateScore` 返回 0 命中）；`ghostfolio` 收益公式（ROI/TWR 子类是 40 行 stub，真算法在 1,931 行基类中，**未逐行核对故未摘录**）。

### D.4 可引用的规范原文（MD / Apple HIG / NN/g，全部一手逐字）

> 完整 22 条（含每条的中英原文与抓取方式）在 `doc/research/_raw/za-design-refs-ia-guidelines.md`（49 KB / 501 行）。
> ★ **可复现的抓取技巧**：`developer.apple.com` 的 HIG 是 SPA，直抓 HTML 只有 17 KB 空壳 —— 官方正文接口是 `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`，正文在 `text` 字段；`m3.material.io` 是 Angular SPA —— 官方正文接口是 `https://m3.material.io/_dsm/content/m3/2026-09-23_06-10-05/<id>`，正文在 `htmlValue` 字段。

与本项目最直接相关的 8 条：

| 规范 | 英文原句（逐字） | 对我们的意义 |
|---|---|---|
| **M3 — Tabular numbers**（`m3.material.io/styles/typography/applying-type`） | "Use **tabular figures** (also known as monospaced numbers) rather than proportional digits in **tables or places where values may change often**, such as clocks." | **金额一律用等宽数字**。这是「一眼高级」里成本最低、立竿见影的一条 |
| **MD M2 — Numerical alignment**（官方历史版本 `material.io/components/data-tables/`） | "**Align numbers to the right** for improved scannability." / "Numbers in the column are **right-aligned with the column header name**." | 流水/持仓数字右对齐，**表头也跟着右对齐** |
| **M3 — Information density**（`m3.material.io/foundations/layout/grids-spacing/density`） | "Density helps people **see and compare more information in data-heavy views**" / "**Dense components can be less accessible** because interactive elements are smaller, so **use caution when increasing information density**." | ★ **账目页允许高密度，但点按目标不能一起变小** —— 这是「信息密度」与「可点性」的分界 |
| **Apple HIG — Lists and tables**（`developer.apple.com/design/human-interface-guidelines/lists-and-tables`） | "Prefer displaying text in a list or table… the **row-based format is especially well suited to making text easy to scan and read**." | 流水用行式列表，不用卡片堆 |
| **NN/g — Progressive Disclosure**（`nngroup.com/articles/progressive-disclosure/`） | "In a system designed with progressive disclosure, **the very fact that something appears on the initial display tells users that it's important**." | ★ 反向约束：**首屏出现的东西会被理解为「重要的」** —— 所以首屏不能放次要信息，这与 §A.3「一屏最多 3 块」互为印证 |
| **NN/g — Choice Overload Impedes User Decision-Making** / **Simplicity Wins over Abundance of Choice** | 选择过载会阻碍决策 | 支撑「单页信息块上限 3」与 §B.6「每个榜单只回答一个问题」 |
| **NN/g — UX Guidelines for Recommended Content**（`nngroup.com/articles/recommendation-guidelines/`） | "…**segmenting suggestions into clear categories**… The higher these individualized recommendation areas appeared on the site's homepage, the more likely it was that users **noticed and used them**." | ★ **榜单必须按维度分区，且放在页面靠上位置** —— 这是 §B.6 八种榜单分维度的规范依据 |
| **NN/g — Web Form Design**（`nngroup.com/articles/web-form-design/`） | "…users are almost **twice as likely to submit the form with no errors from the first try** (78% one-try submissions in forms compliant with usability guidelines versus only 42%…)" | 风险测评分档的依据：**逐屏一问 + 就地校验**显著降低重填率 |

**「榜单」为什么能做一级结构的文章级理由**（7 篇中文 IA 文章的原文归纳，非推测）：

| 理由 | 原文 |
|---|---|
| **降低选择成本** | 「排行榜在帮助用户做决定的同时，引导用户购买目标产品，**极大降低了用户的选择成本**。」 |
| **锚定效应** | 「用户信任平台权威性对信息的筛选，由于**锚定效应**降低用户自己的选择成本…」 |
| **社会证明 / 羊群效应** | 「由于用户的**从众心理或者羊群效应**，也会对上榜主体产生强烈的品牌认可…」 |
| **平台权威背书** | 「排行榜秘密之一：**寻找权威的榜单**帮助自身减少选择成本。」 |
| **认知负荷约束** | 「让用户在恰当的时机、以**适宜的认知负荷**，高效获取对其投资决策真正有价值的专业信息。」 |
| **决策要素优先级** | 「**将最可能影响用户决策的要素放在最前面**，就可有效减少用户的决策成本。」 |
| 入口形态学 | 四类入口：页面 tab / 图标入口 / 商品详情页榜单入口 / 搜索-筛选；并区分「显性排行榜」与「隐性排行榜」 |

→ **与 ZA Bank 直接对应**：ZA 官方给榜单的理由是「**多角度資訊幫助你更快找到合適的方向**」，与「降低选择成本」同口径；且 ZA 用的是**多维度榜单**（最高派息 / 表现最佳 / 最热卖…），不是单一排行榜。

> **未能获取**：知乎两篇（HTTP 403 反爬）；`woshipm.com` 站内搜索（请求失败，改引网易号转载页并标注原发方）；Apple Style Guide「数字/货币」章节（588 KB SPA 壳，未找到内容接口）；`shanglala.net` 万字长文（TLS 失败）；`m2.material.io` 全部页面（SPA 壳）；`m3.material.io/components/data-tables`（该组件页已从 M3 下线，sitemap 375 条 URL 中命中 0 条）。**「one question per screen」的确切规范原文，三大规范中确实没有该表述 —— 未编造**，已改用 D4 的 NN/g Web Form Design 作替代依据。

### D.5 ★ 明确「未能获取」清单（含已穷尽的检索面）

| 目标 | 状态 | 已穷尽的检索面 / 原因 |
|---|---|---|
| 风险问卷**题数 / 等级档位与命名** | **未能获取** | 主站 125 题 + 投资子站 27 题 + 887 条 i18n + 官网全部投资页 + 60 篇 blog，**只出现名称，无题数无档位**；问卷在 App 登录态内 |
| 未做测评能否**浏览**基金 | **未能获取** | `/hk/fundlists`、`/hk/fund-analysis` 纯客户端渲染；投资子站需登录 |
| 基金详情页 **ISIN/代码栏位与区块顺序** | **未能获取** | 无公开基金详情页 URL；Google/Bing 未索引 |
| App 内**个人投资组合**字段与图表类型 | **未能获取** | 需登录态 |
| **定投计划**的入口/周期/金额/扣款日 | **未能获取** | 官方仅一行脚注证实存在（「定投計劃」/ `Regular Investment Scheme`）；主站 125 题 + 投资子站 27 题 + 60 篇 blog 对「月供/定期定額/每月」**0 命中** |
| **加载态（骨架屏）** 的实现 | **未能获取** | 887 条 i18n 里 `載入/加載/loading` 仅 3 处命中且均与 PDF 有关 |
| **ZA App 动效曲线/时长/弹簧参数** | **未能获取**（上游已确认，本文复核维持） | 无任何公开数值；官网 CSS 的 transition 属 Web 端 |
| 官方影片《設計理念》的**口播字幕** | **未能获取** | `yt-dlp --write-auto-subs` 两次 `HTTP 429`；timedtext 直连正文长度 0。**仅说明文字可引用** |
| iF **评审团评语** | **不存在** | 该 iF 条目页面上没有 jury statement 字段；唯一可抓的是报名方 description |
| iF 站内 ZA 全部获奖条目列表 | **未能获取** | `ifdesign.com/en/if-design-ranking?profileId=12918` → HTTP 403（Azure WAF）；sitemap/robots 亦 403；Wayback 无快照 |
| 投资服务**收费简介 PDF** 直链 | **未能获取** | `/hk/rates-list` 清单为 JS 动态生成 |
| 加密货币**币种/限额/费率** | **未能获取** | FAQ 只给条款链接 |
| Red Dot / Good Design / DFA / HKDA / 金点 的 ZA 获奖记录 | **未发现记录** | Red Dot `/api/search` 与 `/en/search` → 404；Good Design 3 个 API 端点 → 全 404；DFA `/en/winner/`、`/en/winner/2025`、`/en/search` → 全 404；HKDA → FETCH-FAILED；金点 → 无检索结果。多轮检索**只找到 iF 一条**。ZA 自己的 awards 回顾也只在 "Design Aesthetics" 下提了 iF |
| 中文自媒体设计拆解（Medium / 知乎 / 站酷 / UI 中国 / 人人都是产品经理） | **未能获取** | Medium 被 Cloudflare 拦；唯一命中的 `uied.cn/89206.html` —— 直连 `HTTP 000`、Wayback `archived_snapshots: {}`、r.jina.ai `HTTP/2 framing error`，**三条路全断，仅有 snippet，不引用** |
| 明报 App 3.0 正文 | **未能获取** | 直连 Cloudflare JS 挑战；Wayback 无快照。**仅标题可引用** |
| HKET《傑出市場策劃獎》正文 | **未能获取** | Wayback 快照（`/web/20230905030336/`）只存到站点导航骨架。**仅标题可引用** |
| 2026 中报 ZA Bank 段最后一句 | **未能获取** | 跨页截断（「In April, it introduced a feature enabling dire…」） |
| Google Play 的 ZA Bank 包名 | **未能确认** | `group.za.bank` 返回 404 |
| ZA 设计系统 / 组件库公开材料 | **未能获取** | 检索未返回任何设计系统公开页面（上游找到的 §--zad-*§ 令牌文件是官网 CSS，不是公开设计系统文档） |
| 中文 / 印度市场 KYC 前端流程 | **未能获取** | GitHub 上匹配的仓库 star 均 ≤3，全是证件 OCR / 活体检测的后端脚本 |

---

## 附录：本轮新增的原始素材

| 文件 | 内容 |
|---|---|
| `doc/research/_raw/za-wealth-raw.md`（99 KB / 879 行） | 理财业务逐字原文引用 + URL + PDF 页码对照 + 失败清单 |
| `doc/research/_raw/za-design-refs-raw.md`（83 KB / 1,054 行） | iF 一手字段、设计师署名材料、ZA 官方设计自述、ZA Fam 方法论、App 3.0 报道全文、IA 文章 |
| `doc/research/_raw/za-design-refs-open-source.md`（67 KB / 1,318 行） | 22 个仓库 star/license 实测 + 9 个零依赖可抄文件 + 源码原文 |
| `doc/research/_raw/za-design-refs-ia-guidelines.md`（49 KB / 501 行） | 22 条规范逐字英文原句 + 7 篇榜单 IA 文章 |
| `doc/research/_raw/_invest_i18n_hk.txt`（107 KB / 887 条） | ★ ZA 投资子站繁中 UI 字串全表（空/错状态文案、榜单定义、货币基金字段、7 日年化公式） |
| `doc/research/_raw/faq_hk.md` / `invest_help_hk.md` / `blog_hk.md` | 帮助中心 125 题、投资子站 27 题、官方 blog 60 篇原文 |
| `doc/research/_raw/ar2023_e.txt` / `ar2024_e.txt` / `ar2025_e.txt` / `ir2024_e.txt` / `ir2025_e.txt` / `ir2026_e.txt` | 众安在线年报/中报英文全文（PDF 抽取） |
| `doc/research/_raw/za-web/*.html` + `*.txt` | 官网投资/存款/费率页 SSR HTML 与提取文本；`extract.mjs` / `nextdata.mjs` / `i18n.mjs` 为可复现脚本 |

---

## 附录 Z：一页速查（若只读一段）

**设计逻辑**：一级放「钱的状态」、二级放「钱的动作」；首页纵向「最关心的 → 正在发生的 → 最想做的」；**能做成标签/数字块/形状差异的绝不写成句子**；一屏最多 3 块；空态 =「4 字状态 + 可选插画 + 1 个回主路径按钮」；错误态 =「拟人化短标题 + 独立错误码 + 1 个动作」；插画与动效预算只投给「抽奖/领奖/成就」这类情绪峰值。

**理财逻辑**：投资是**一级 tab**，App 3.0 起分「银行/投资」两个主界面；**开投资户是独立前置对象，必须先过风险问卷**；产品发现靠**8 种带精确定义的行为数据榜单**而不是搜索或评分；买卖**直连活期储蓄账户，没有投资钱包**；下单统一 4 步、**末步必是身份认证、提交后不可取消**；截止时间（货基 09:00 / 非货基 14:00）与到账时间（货基 T+0/T+1、一般基金 T+5–10 工作日）是详情页的固定字段；收益用**可滚动可分享的大数字长图**讲，不用表格；新手引导 = **ZA Quest 的三个业务里程碑**（开户 → 首购 → 留存 20 个工作日），不是浮层教学。
