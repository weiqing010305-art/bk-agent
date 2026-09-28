# Revolut AI × 众安银行（ZA Bank）深挖 · 业务逻辑层级 / UI-UX / 情绪价值 / 开源参考

> **项目**：bk-agent /「青禾 · 银行 AI 资金管家」
> **上游文档**：`doc/research/za-bank-product-layer.md`（96 KB，已含 ZA Bank 设计令牌实测、首页/動態逐像素拆解、港澳新 8 家虚拟银行 IA 对比、25 个开源仓库 star/license 实测表）
> **本文定位**：**只补上游没覆盖的部分**，不重复任何已有结论。
> **证据等级**：`【实测】`= 本次会话真实抓取/解析所得；`【官方原文】`= 官方页面原文引用；`【仅标题】`= 只能证实条目存在、正文未抓到，**不引用其内容**；`【未能证实】`= 查不到，明确不编造。
> **抓取方式**：`web_fetch` / `web_search` / `gh` CLI 2.92.0 / `pwsh` + `Invoke-WebRequest`（本轮主力） / Wayback Machine 快照。
> **本轮关键限制（先说清楚）**：`revolut.com` 全站对 `web_fetch` 与 `pwsh` 直连**均返回 403**（Cloudflare），Revolut 官方正文**全部经 Wayback Machine 快照获取**，快照时间戳在附录逐条列出。`help.revolut.com` 403 且无 AIR 相关快照，**AIR 帮助中心正文未获取**。

---

## 0. 相对上游文档，本文新增了什么

上游 `za-bank-product-layer.md` 解决的是「**UI 层**」问题：ZA 的 tab 怎么切、首页怎么排、令牌是什么颜色、圆角和阴影多少、该抄哪个开源仓库的参数。

本文解决的是它**没有回答的三件事**：

1. **业务逻辑层级**。上游只写到「App 的 IA 有几层 tab」，本文给出的是 **ZA 官方的业务对象模型**——它不是猜的，是从 ZA 帮助中心 **80 条业务分类路径**（`bank.za.group/en/faqs/...`，实测 81 条含 1 条 `search`）**拉下来的真实分类树**，个体户与商业户两套并列，可以直接读出「账户/卡/交易/订阅/理财/保险之间的从属关系」。再配上 ZA App 3.0「银行/投资双主界面」的官方口径与逐步骤流程（转账、卡片管理、理财申购），构成完整的**业务层级**视图。
2. **Revolut AI（赛题指定对标）**。上游只把 Revolut 当作「5 秒转账缓冲」之外的一个名字提过。本文给出 AIR 的产品定义原文、**入口动线**、**能力清单**、**确认流程的安全边界原文**（哪些动作需要生物识别）、Revolut 的 Pockets/订阅/预算体系，以及 Klarna / Monzo / N26 三个替代对标的硬数据。
3. **情绪价值 UI 与「高级设计师的布局想法」**。上游给的是**令牌数值**，本文给的是**产业界真实在跑的图标/头像体系实现**（Plaid Enrich 的 `logo_url` + `personal_finance_category_icon_url` + 104 条类目 CSV、Monzo 的商户数据众包流程、simple-icons 的 3400+ 品牌色表），以及 Skins Factory / Monzo 写作系统 / Revolut 设计师公开履历 / iF Design 评委评语这四条**设计师视角**的原文。

另外，上游的开源章节搜的是「手机银行 UI 库」，本文换了一个方向搜：**交易图标集、商户 logo、品牌色、类别 taxonomy**——这是上游完全没碰的生态。

---

## A. Revolut AI（赛题指定对标）

### A.1 AIR 是什么 —— 官方原文

**产品名**：**AIR（AI by Revolut）**。2026 年 4 月 9 日发布，从英国开始灰度。
新闻稿：<https://www.revolut.com/news/revolut_enters_new_era_of_money_intelligence_with_launch_of_ai_assistant/>
本次实际读取的快照：<https://web.archive.org/web/20260422123436/https://www.revolut.com/news/revolut_enters_new_era_of_money_intelligence_with_launch_of_ai_assistant/>

【官方原文，逐句摘录】：

> "Revolut, the UK licenced bank, today announced the launch of **AIR (AI by Revolut)**, a sophisticated in-app AI assistant designed to transform how millions of users interact with their money, manage their lifestyle and elevate their money intelligence."

> "**AIR moves beyond the traditional chatbot.** It acts as an intelligent assistant, deeply embedded in Revolut's ecosystem. It represents a **fundamental shift in how customers can interact with their finances, ending the era of multi-step navigation** and empowering users to get a holistic view of their money."

> "Whether it's a **granular breakdown of last month's coffee spend**, sorting travel essentials or **setting card controls**, AIR can help instantly."

> Julia Ponomareva, **Partner and General Manager of CX and AI Products** at Revolut：
> "We believe the **era of navigating through endless tabs and menus is over**. With AIR, we're delivering a new level of money intelligence that's both powerful and effortless. It's not just an assistant; it's a **co-pilot** that elevates everyday life, making financial management as easy and natural as **sending a text**. Crucially, Revolut customers also remain firmly in the driver's seat, ensuring that money intelligence never comes at the cost of privacy."

博客《Ask, and AIR makes it happen》（2026-04-09）：
<https://www.revolut.com/blog/post/air-ai-by-revolut/>
本次实际读取的快照：<https://web.archive.org/web/20260621132731/https://www.revolut.com/blog/post/air-ai-by-revolut/>

【官方原文】："Your money now has a **24/7 personal assistant**. We're officially beginning the rollout of AIR (AI by Revolut) to our **13 million customers across the UK**. **One chat. Total control.**"

**ASR/入口动线**（两处原文一致，是全篇最可直接落地的一条）【官方原文】：

> "Start chatting in seconds — **Swipe down from the middle of the screen**, or go to **Profile → Chats → AIR**."

→ **AIR 不是一个独立 tab，而是一个「从屏幕中部下拉」的全局手势层。** 这与 ZA 把转账做成「首页右侧可上滑展开的按钮」（上游 §A.2.5）是同一思路的两种实现：**高频能力不占导航坑位，用直接手势唤起。**

### A.2 AIR 的能力清单 —— 官方逐条，可直接映射成我们的工具集

博客用「**Revolut's features, powered by AIR**」分了 6 组，每组都给了**用户会对 AIR 说的原话**（这是最值钱的部分——它就是 Revolut 自己写的意图样例集）：

| # | 官方分组 | 官方给的样例话术（原文） | 背后对应的业务能力 |
|---|---|---|---|
| 1 | **Budget better, save more** | "**Where's my money going?**" / "**How much can I save this month?**" | 消费洞察、预算 |
| 2 | **Informed investing, made simple** | "**Check Nvidia's stock price**" / "**What are my investment earnings this year?**" | 行情查询、持仓收益 |
| 3 | **Control your cash with a conversation** | "**Pause recurring payments**"、"**check your subscriptions**"、"manage monthly spend" | **订阅识别 / 代扣停用** |
| 4 | **Sort your travel essentials** | 要实时汇率、"**Buy a 3GB eSIM for my trip**" | 汇率、**在 App 内直接下单买商品** |
| 5 | **Set card controls at any time** | "**Freeze my card**" / "**I need to get a single-use virtual card**" | 卡片冻结、虚拟卡申请 |
| 6 | **Start chatting in seconds** | 下拉 或 Profile → Chats → AIR | 入口 |

新闻稿另外补了 "**manage subscriptions**"、"**freeze a lost card**"、"helping with **trip budgets**"。

> ★ **这张表就是赛题业务能力的英文原版**：智能转账/卡片管理/账单分析/代扣管理/理财操作——**Revolut 除了「转账」全都做成了对话入口**。注意第 3、5 组：**「停订阅」和「冻卡」是执行类动作（write operation），不是查询**。这说明 AIR 的权限模型里，**「暂停代扣」「冻结卡片」被划入了可执行档**。

### A.3 ★ 确认流程 —— AIR 到底哪些要二次确认，官方原文只有一句，但那一句是决定性的

博客「**Secure by design**」段落，全文只有三句【官方原文】：

> "We've built AIR on the same infrastructure that protects every Revolut transaction."
> "**Zero data retention**: your personal data is never stored by third-party AI partners or used for training."
> "**Biometric protection: AIR cannot perform sensitive actions without your biometric approval.**"
> "**Total transparency: AIR only accesses the data you can already see**, such as your transactions, investments, and cards."

**这三句就是 Revolut 的权限分级答案**，可以直接翻译成我们的 P0/P1/P2 三档：

| Revolut 的口径 | 含义 | 对应我们赛题的分级 |
|---|---|---|
| "only accesses the data you can already see" | 查询类动作**不需要任何额外授权** —— Agent 的可见范围 = 用户自己的可见范围 | **低风险：查询类自动执行** ✅ 完全一致 |
| "cannot perform sensitive actions without your biometric approval" | 执行类动作**一律**生物识别，没有「小额豁免」 | **高风险：人脸/短信/U盾**（但 Revolut 不给小额开口子） |
| （博客未提） | 中间档「展示详情后确认」在 AIR 的公开材料里**没有出现** | 赛题的**中风险档是本项目可以做出的差异化** |

**⚠️ 必须诚实标注的边界**：Revolut 官方**没有公开**「sensitive actions」的完整定义、也没有公开 AIR 内部是「先答后做」还是「先跳转原生流程」。我在 `help.revolut.com` 找到过一个疑似页面《Getting started with AIR》（`/help/profile-and-plan/getting-started-with-air/`，由 `web_search` 返回其标题【仅标题】），但：
- 直连 403（Chrome UA / Googlebot UA 均 403）
- Wayback CDX 查询无该路径快照
- `r.jina.ai` 代理返回 Cloudflare 挑战页
→ **该页正文未获取，本文不对 AIR 的帮助中心内容做任何断言。**

**参考对照：ZA Bank 的公开口径比 Revolut 更细。** ZA 官网每个页面的 meta description 固定挂着一句【官方原文，实测自 `bank.za.group` 多次抓取】：

> "ZA Savings Go, Easy Deposit, **5 seconds recall**, **facial authentication**, Create together, be different together"

—— **"5 seconds recall + facial authentication" 被写进了品牌 slogan 位**。即 ZA 的两级是：**可撤销（5 秒回溯）= 低摩擦档**；**人脸认证 = 高摩擦档**。这与 Revolut 的「生物识别闸门」是同一套风控哲学，但 ZA 多给了「撤销窗口」这一层。

### A.4 AIR 之前的 Revolut —— Pockets / Vaults、订阅与预算

AIR 是 2026 年的新东西，但 Revolut 的**记账与储蓄骨架**是 2023 年就定型并迭代至今的，这部分对我们的产品层更直接。

**(1) Vaults → Pockets 的更名与重构**（2023-10-09）
博客：<https://www.revolut.com/blog/post/meet-pockets-the-next-evolution-of-vaults/>
快照：<https://web.archive.org/web/20250717162125/https://www.revolut.com/blog/post/meet-pockets-the-next-evolution-of-vaults/>

【官方原文】：
> "With our latest update, we've **replaced Vaults with a dedicated space for all your budgeting needs**. Thanks to your feedback, your personal and group Vaults are now located under '**Pockets**'. We've also created a **new home for your Savings Vaults**."

> "From the home screen of your app, **tap the account selector below your balance** → See all your existing Vaults (now Pockets) under Pockets → To create a new one, simply tap **Add new**"

> "we've **combined all our existing budgeting features into one**, to help you set aside money for any purpose. So whether you're affording something as a group, or **settling recurring bills**, you'll be able to make payment planning a breeze."

可自定义项【官方原文】：Pick your Pocket's **name** / Pick your Pocket's **header image** / Add **spare change** / Set a **goal**。

**(2) Pockets 帮助中心页**（en-AU，快照 2025-08-04）
<https://web.archive.org/web/20250804000031/https://help.revolut.com/en-AU/help/app-features/vaults/what-are-revolut-vaults/>

【官方原文】：
> "**Pockets are short-term money management tools.**"
> 创建步骤："Go to '**Home**' on the bottom menu → **Below your balance, tap** → Select '**Add new**' and choose '**Pockets**' → Choose your Pocket type and follow the instructions"
> 类型只有两种："**Regular Pockets**: To save for a personal goal or expense... **Group Pockets**: You can save with family and friends for a common goal."

**(3) Revolut 帮助中心的 IA —— 又一个「按任务切」的实例**【实测，来自该页左侧主题列表原文】
> `Currency accounts / Revolut - Kids & Teens / Revolut Business / Joint accounts / **Pockets** / Is Revolut a bank? / **Budgeting and Analytics**`

→ Revolut 的帮助中心把 **Pockets** 和 **Budgeting and Analytics** 放在**一级**，而把具体产品（currency accounts、joint accounts）也放一级 —— 与上游 §B.3 的结论一致：**Monzo 是唯一按纯任务切 tab 的，Revolut 是混合切法。**

> ⚠️ **一处需要指出的不一致（对我们是重要信号）**：2023 年 Pockets 博客说「个人/群组 Pockets 都在 Pockets 下」，而 AIR 博客（2026）说入口是「**Profile → Chats → AIR**」。**Revolut 的 AI 被放在 Profile 里而不是底部导航** —— 说明连 Revolut 也不敢把 AI 助手放进主 tab。我们目前的移动 tab 定为「概览/账单/订阅/助手」（上游 §D.2），**第四项就是助手，这比 Revolut 更激进，也更符合赛题「统一入口」的定位**；但需要意识到这条没有对标背书，是我们**主动的差异化**。

### A.5 替代对标（Revolut 资料不足处的补位）

**Klarna AI Assistant**（2024-02-27 官方新闻稿，`web_fetch` 直接 200 成功）
<https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/>

【官方原文，全部为可核验数字】：
| 指标 | 数值 |
|---|---|
| 上线 1 个月对话数 | **2.3 million conversations** |
| 占客服会话比例 | **two-thirds（2/3）** |
| 等效人力 | **700 full-time agents** |
| 满意度 | "**on par with human agents** in regard to customer satisfaction score" |
| 重复咨询 | **25% drop in repeat inquiries** |
| 解决时长 | **< 2 mins（此前 11 mins）** |
| 覆盖 | **23 markets / 24-7 / 35+ languages** |
| 财务影响 | 估算 2024 年 **$40M USD profit improvement** |
| 兜底 | "customers can **still choose to interact with live agents** if they'd prefer" |

→ **对我们最有用的是最后一条**：Klarna 明确保留人工兜底。赛题要求「执行过程支持中断、回退、人工接管」——**这不是我们的额外设计，是行业标准动作**。

> ⚠️【仅标题，正文未抓取】2025 年出现「Klarna 部分回撤」的报道（the tenbound：「Klarna automated two thirds of its support, then its CEO said it went too far」；CMSWire：「No AI Retreat: Klarna's Bots Are Taking Over More Customer Service Tasks」）。两篇正文均未抓取，**本文不引用其中任何数字或结论**，仅提示「AI 替代客服」这一叙事在公开舆论中存在反复。

**Monzo —— 它的 AI 是「对内」的，不是「对客」的**（这点与直觉相反，值得写进报告）
博客《Building Agent Chip: Monzo's in-house agentic tool》，2026-08-13，`web_fetch` 直接 200：
<https://monzo.com/blog/building-agent-chip>

【官方原文】：
> "We built an **agent ecosystem**, which is now **authoring ~10% of all merged PRs** at Monzo, and is routinely running **more than 1800 tasks every day**."
> "**Owning the harness**: We're a bank, and **observability and control is paramount**. We need to know exactly what the agent can see, what it can do, and **constrain it as appropriate**."
> "**Remote agentic infrastructure**: the key infrastructure for us to spawn a **sandboxed container** that would run an agent, where we could safely run agents with a **strict subset of tools**."

→ **Monzo 的对客 AI 助手在公开材料里查不到**（【未能证实】）。但它给了一句比任何 UI 建议都重要的话，直接对应赛题的「沙箱隔离」：**"spawn a sandboxed container ... with a strict subset of tools"**。这就是「沙箱隔离」的工程级定义——**不是把 Agent 关起来，而是给它一个受限工具子集**。

**N26**：`web_search` 只找到 Anthropic 的客户案例页（`claude.com/customers/n26`）【仅标题】，正文未抓取，本文不引用。

**Chase / 其他**：本轮未检索到有价值的一手材料，不写。

### A.6 A 节抓取失败清单（诚实边界）

| 目标 | 结果 |
|---|---|
| `revolut.com` 全站（含 news / blog / help） | **403 Forbidden**（`web_fetch` 与 `pwsh` 直连均然）；改用 Wayback 快照成功 |
| `help.revolut.com/help/profile-and-plan/getting-started-with-air/` | 403；Wayback CDX 无快照；`r.jina.ai` 返回 CF 挑战页 → **正文未获取** |
| `cdn.revolut.com/.../*.pdf`（AI 助手条款，5 种语言） | `web_fetch`：`unsupported content type "application/pdf"` → **未获取** |
| `irishtechnews.ie` Revolut 报道 | 403（Cloudflare 挑战页） |
| `finextra.com` | 403 |
| AIR 的 UI 截图 / 动效参数 | 【未能证实】官方未公开 |

---

## B. 众安银行的「业务逻辑层级」（作者点名的重点）

> 本节**不写 UI**，只写业务怎么组织。

### B.0 一句话结论

**ZA Bank 的业务层级不是「页面层级」，而是「业务对象层级 + 双域镜像」。**
它把整个银行拆成 **13 个个人业务域** 和 **8 个商业业务域**，**两套域共享同一组业务对象**（账户/存款/转账/卡/贷款/投资/保险/对账单），差别只在包装与合规口径。UI 只是这套域模型的渲染结果。

### B.1 证据来源：ZA 帮助中心的 80 条业务分类路径【实测】

方法：抓 `https://bank.za.group/sitemap.xml`（实测成功），过滤出 `/en/faqs/` 下**不带问题 ID 的分类页**，去重后得到 **81 条路径**——其中 1 条是 `search` 伪路径，**实际业务分类 80 条**（21 个一级域 + 59 个二级域）。
实测命令（可复现）：
```powershell
$s = (Invoke-WebRequest 'https://bank.za.group/sitemap.xml' -UseBasicParsing).Content
$urls = [regex]::Matches($s,'<loc>(.*?)</loc>') | % { $_.Groups[1].Value }
$urls | ? { $_ -match '/en/faqs/' } | % { $_ -replace '\?$','' } |
  % { $_ -replace 'https://bank.za.group/en/faqs/','' } |
  ? { ($_ -split '/').Count -le 3 } | Sort-Object -Unique
```

**这不是我们的猜测，是 ZA 自己在官网上公开的分类树。**

### B.2 ★ 个人业务域（Individuals）—— 13 个一级域

| # | 一级域 | 二级域（原文） | 层级含义 |
|---|---|---|---|
| 1 | **Account_opening** | Open_an_account_for_a_Hong_Kong_resident / Open_an_account_for_a_visitor_in_HongKong | 开户按**居民身份**分叉 |
| 2 | **Account_opening_activity** | Customer_recommends_customer_activity | **拉新活动**是独立域，不属于产品 |
| 3 | **Account_Security** | Security | 安全独立成域 |
| 4 | **Bank_insurance** | ZA_Insure | 银行保险（银保）独立成域 |
| 5 | **Bank_services** | Account_use / **Mobile_app** / Money_exchange / open_Banking / ZAPerks_one | ★ **App 本身被建模成一个业务对象**；**Open Banking** 也是 |
| 6 | **Deposit_related** | **Current_Savings** / **Time_deposit** | 只有两类存款：活期储蓄 + 定期 |
| 7 | **Investment_Related** | **Opening_an_investment_account** / **HK_Stock_Trading** / **US_Stock_Trading** / **Fund_trading** / **Cryptocurrency_Trading** | ★ **投资域有 5 个对象**，其中「开投资户」是**独立前置步骤** |
| 8 | **Loan** | Instalment_Loan / Instalment_Loan_Top_up / **Lease_Cashout** / Salary_FastPass / **ZA_Credit** / Debt_Changer / Card_Statement_Instalment | 7 个贷款产品 |
| 9 | **Loan_Service** | 与 Loan **同名同构的 7 项 + 1 个变体**（`Debt_Changer_o`，合计 8 项【实测】） | ★ **同域两套视图**（产品视角 vs 服务视角） |
| 10 | **Savings_Pot** | **High_Rate_Pot** / **Money_Safe_Pot** / Common_Questions | ★ **钱罌是「域」不是「功能」**，且只有两种类型 |
| 11 | **Southbound_scheme** | Southbound_connectAccount / Southbound_schemeOpening / Southbound_schemeInvestment | **跨境理财通**是独立顶层域 |
| 12 | **Transfer** | **13 个二级域**（见 B.3） | ★ 全站最复杂的域 |
| 13 | **ZA_Card** | **8 个二级域**（见 B.4） | ★ 卡域里**混进了 ZA_Coin**（积分体系挂在卡下） |

### B.3 ★ 转账域（Transfer）的 13 个子域 —— 这是「业务逻辑层级」最好的样本【实测】

```
Individuals/Transfer/
  eDDA_Easy_Deposit          ← 代扣授权（Direct Debit mandate）
  QR_Code_related
  Local_transfer_out
  Local_transfer_in
  Anti_fraud_viewer          ← 防诈骗查看器
  Cross_border_transfer_out
  Cross_border_transfer_in
  Lai_See                    ← 利是（红包）是转账的一种类型
  Digital_Wallet             ← 电子钱包充值
  Limit_Related              ← 限额是独立子域，不是参数
  Default_transfer           ← 默认收款银行
  Transfer_App_Operation     ← App 操作步骤
  General_Knowledge_about_Transfer
```

**从这 13 项能读出的业务设计决策：**

1. **「限额」被提升为一个独立子域**（`Limit_Related`），而不是散落在各个转账页的参数里。实测到的官方问题包括：
   - "What is my daily transfer limit?"
   - "**What is the Small-value transfer limit?**"
   - "Does eDDA have transfer limits?"
   - "Why is the maximum transfer limit to an own-account transfer limit only HKD 2 million?"【实测问题原文】
   → **限额是「一类业务规则」，有独立的解释场所**。这正是赛题「权限分级机制」在真实银行里的落地形态。
2. **`eDDA_Easy_Deposit` 就是「代扣管理」的正规名字**。实测到的官方问题：
   - "What is eDDA?"
   - "If I want to set up eDDA with another bank, **what conditions must the payment account meet?**"
   - "**How do I cancel the eDDA mandate linked to another bank account?**"【实测问题原文】
   → **「一键取消订阅」在银行语境里叫「取消 eDDA 授权（mandate）」**，是一个有明确对手方（另一家银行/商户）的、可撤销的授权对象。**这直接给了我们订阅域的数据模型**：不要让「订阅」只是交易流水的聚合，它应该是一个**有授权状态（生效/已撤销）的实体**。
3. **`Lai_See`（利是）与 `Digital_Wallet` 是转账的兄弟域，不是「营销活动」** —— 说明 ZA 把「钱怎么流出去」抽象成统一的 Transfer 域，再按**渠道/场景**分子域。
4. **`Anti_fraud_viewer` 是独立子域**，实测问题原文：
   - "How would I know if my recipient's mobile number / email address / FPS Identifier / bank account / SVF account is **flagged for high risk alert**?"
   - "**If my recipient does not trigger any scam alerts, does that mean it is safe to transfer to him or her?**"
   → ★ **这是「异常交易识别」的官方产品形态**：不是给用户看一个风控分数，而是在**收款人对象**上挂一个**高危警示标记**，并且在警示里明确写「没告警 ≠ 安全」。**这一条对我们做「异常交易识别」的 UI 文案极其重要**——警示不能给出虚假的安全感。

### B.4 卡域（ZA_Card）的 8 个子域【实测】

```
Individuals/ZA_Card/
  About_ZA_Card
  ATM
  Card_Safety                    ← 安全
  Electronic_Wallet
  Lost_Replacement_Deactivation_of_ZA_Card   ← 挂失/补卡/停用 合为一个子域
  Refunds_and_transaction_disputes           ← 退款与争议（含「交易疑问」）
  ZA_Card_spending               ← 消费
  ZA_Coin                        ← ★ 积分体系挂在卡下
```

**关键决策：挂失 / 补卡 / 停用被合并成一个子域**（`Lost_Replacement_Deactivation_of_ZA_Card`）——因为它们**共享同一个状态机**：卡有「正常 / 遗失 / 已补发 / 已停用」几个状态，三种操作是同一状态机上的三条边。**这是「业务对象建模」优于「功能列表建模」的直接证据。**

### B.5 ★ 逐步骤流程（全部来自 ZA 官方博客/Blog 原文，非推测）

**(1) 转账 —— 三条独立动线**（上游已覆盖入口与 5 秒缓冲，此处只补**上游没有的交互结构**）

来源：`blog.za.group/article/upgraded_transfer_features`（2023-11-15）【官方原文】

| 新增能力 | 原文要点 |
|---|---|
| **对话式转账记录** | "只要你的朋友也是 ZA Bank 用户，ZA Bank App 就会**自动为你们建立专属转账记录页，以对话形式**清楚展示转账日期及时间等资讯"；页面里同时呈现"转账留言、交易状态及利是封面" |
| **给转账「畀 Like」** | "**6 款可爱表情**，令你的转账有温度，有态度！"；"收到好友过数的款项后，也能在纪录页**直接为转账「畀 Like」**，回覆对方已收妥款项" |
| **常用收款人** | "ZA Bank App 会根据你**过往的转账记录，优先展示与转账往来最密切的收款人**"；手动设置入口是"在**转账金额页面**点击右上角「**星形**」标志"；**上限 10 个** |
| **好友识别标识** | ZA Bank 好友在转账列表里带"**绿色的 ZA Bank 好友识别**"，用户可关闭（头像 → 设置 → ZA Bank 好友识别） |

→ ★ **「对话式转账记录」是本节最值得抄的一条**：它把 **转账从「一次性动作」变成了「一段关系的历史」**，而且和我们做的是同一个东西（对话界面）——**ZA 已经证明「转账 = 对话」这个隐喻在真实银行里成立且受用户欢迎**。同时它顺带解决了「这笔钱对方到底还没还」这个高频焦虑。**这段原文可以直接当我们的产品论证材料。**

**(2) 卡片管理 —— 五条独立流程**，来源 `blog.za.group/article/ZA_Card_app_spending_features` 与 `Christmas_ZA_Bank_App_features`【官方原文】

| 流程 | 官方步骤原文 |
|---|---|
| **限額調整** | "在 ZA Bank App 主页上，点击**账户 > ZA Card**" → "点选「**交易管理**」" → "调整你的 ZA Card 消费限额"；"你仲可以设置**每月或者每日**的限额，以至**每月无卡签账**的限额" |
| **本月消费分析** | "点击**账户 > ZA Card**" → "点选「**本月消费金额**」" → "详细检视你每月的支出"；官方补充："ZA Bank App 仲提供**明细消费类别**" |
| **一键锁卡** | "在 ZA Card 页面，点击「**一键锁卡**」 → **确认**"（两步，无第三级） |
| **海外旅游** | "在 ZA Bank App 主页，点击**账户 > ZA Card > 海外旅游**" → "点击「海外旅游」" → "选择「**ATM 提款**」和「**消费交易**」" → "输入你将要前往的**国家/地区以及旅行时间**" |
| **交易疑问** | "你只需前往 ZA Bank App **主页 > 动態 > 交易疑问**，即可查询"；官方定义："你可以透过这个功能**获取详细的交易信息和建议**，从而快速解决任何潜在的 ZA Card 交易问题" |

→ ★ 三条结论：
1. **卡管理的统一入口是 `账户 > ZA Card`，且所有子功能都在一个「交易管理」伞下** —— 与我们「卡片页」的结构一致，可直接对表。
2. **「本月消费金额」+「明细消费类别」是卡域里的常驻能力** —— **账单分析不是独立页面，是卡页的一部分**。我们目前是独立「账单」tab，**这是与 ZA 的一个明确分歧点**（上游 §D.2 已决定按任务切 tab，逻辑上更优，但要意识到这一点）。
3. **「交易疑问」入口埋在 `动態` 里**（不是卡页）—— 因为**它是从一条交易流水长出来的动作**，不是从卡长出来的。**这是「上下文入口」而非「功能入口」**，和我们 A2UI 里「行内按钮触发后续流程」的思路完全同源。

**(3) 理财 —— 从开户到认购的完整链路**，来源 `blog.za.group/article/zafund`（2022-04-08）【官方原文】

> "由**开投资账户到认购基金，最快只需 5 分钟**"

| 步 | 官方步骤原文 |
|---|---|
| 0 | "在 ZA Bank App，在底部的分类选择「**财富**」并点选「**基金**」" |
| 1 | **基金首页**："你可以在基金首页查看近期的「**热卖基金**」、「**最高派息基金**」同「**最佳表现基金**」" |
| 2 | **开立投资账户**："完成简单的**投资风险评估问卷**，并**了解自己的投资取向**。成功开户后，已经可以认购基金" |
| 3 | **认购**："选择心水基金后按「**认购**」→ **输入认购金额** → 然后按「**继续**」→ 就完成认购并**可以知道基金认购的状况**" |
| — | 最低认购门槛 **HKD 100** |

→ ★ **「开通投资账户」是理财动作的前置状态机**，与 B.2 表格里 `Opening_an_investment_account` 是独立二级域完全吻合。**这是「业务逻辑层级」里最容易被忽略的一层：账号类型前置。** 我们的理财域如果要做，必须先有「投资账户」这个对象，而不是直接给「买基金」按钮。

**(4) 投资服务的成本结构与榜单**，来源 `blog.za.group/article/investupgrade`（2026-07-30）【官方原文】

| 产品 | 佣金/认购费 | 平台费 | 平台费每单最低 |
|---|---|---|---|
| 美股 | **0%** | 每股 USD 0.0099 | USD 1.99 |
| 港股 | **0%** | 交易金额 × 0.05% | HKD 18 |
| 基金 | **0%** | / | / |

官方还提到开股票服务"**快至 3 分钟**"，以及 App 内提供"**多元基金榜单**「最高派息」或「表现最佳基金」"。
→ **榜单（热卖/最高派息/最佳表现）在 ZA 不是营销位，是理财页的**一级信息架构**。** 我们做理财页时的默认结构可以直接采用「榜单 + 持仓」双区。

**(5) 钱罌的类型学**，来源 `blog.za.group/article/savingpot05`【官方原文】
> "**钱罌是你的活期储蓄子账户**。储蓄子账户之活期存款是符合香港的存款保障计划保障资格的存款。"

→ ★ **一句定义把业务模型说清了：钱罌 = 活期账户的子账户（sub-account），不是虚拟目标。** 这与 Revolut 的 Pockets 定义（"short-term money management tools"）**完全不同**——Pockets 只是**心智容器**，钱罌是**真实计息的子账户**。**两种模型对我们都可选，但要知道这个区别**：子账户模型的「分类统计」天然准确（钱本来就分开放），容器模型的「分类统计」要靠打标签。

### B.6 ★ App 3.0 的「双主界面」—— ZA 自己承认了 IA 需要分流

来源：`stockfisher.com.hk/news/a139101a-...`（2026，实测成功抓取全文）【原文摘录】

> "行政总裁吴忠豪近日透露，ZA Bank 手机应用程式的「**App3.0**」升级版本，已定于今年 **5 月展开内部测试**，预计**年内将全面向客户开放**。此番升级的**核心理念，是将日益丰富的银行基本功能与投资产品，划分成两个主要界面**，旨在更清晰、高效地呈现服务内容。"

> "吴忠豪解释，随着 ZA Bank 平台上的投资产品种类不断增加，「App3.0」将巧妙地将银行服务与投资服务区隔开来。**用户在切换至投资主页面后，将能延伸出包括市场资讯及资产配置等共四个选项**，以容纳更丰富的投资内容，并让用户在单一 App 内，享受到更佳的**投资与银行服务整合体验**。此举**有别于部分其他银行将投资及银行服务分拆成两个独立应用程式**的做法，ZA Bank 强调**一站式服务**的便捷性。"

> "此升级版本主要由公司工程师团队运用「**Claude Code**」编写而成，**仅用了 3 个月时间**便完成了由「App2.0」至「App3.0」的程式码升级工作。"（原文提到使用了 LLM 技术，涉及「烧 Token」）

**这段材料的四层价值：**

1. **官方承认了「业务扩张会撑爆导航」**——上游 §A.2.6 从 3 tab → 5 tab 观察到的症状，CEO 本人给出了解法：**不是加 tab，而是把 App 劈成两个「主界面」，各自内部再长层级**。
2. **投资主界面下挂「4 个选项」**，已知至少两个是「**市场资讯**」和「**资产配置**」。
3. **反面参考明确**：ZA 主动拒绝了「拆成两个独立 App」（不少港银这么做），坚持**一站式 + 内部分界面**。**这直接支持我们「单一 App + 双外壳」的既有决策**（上游 §D.2）。
4. **一个事实性旁证**：ZA 用 Claude Code 3 个月完成 App 2.0→3.0 的代码升级 —— **说明 AI 编码在真实持牌银行的生产环境里已经发生**，这与 Monzo 的 Agent Chip（~10% merged PRs）互为印证。

**官网页脚的产品分类与 App 3.0 的「双界面」完全对应**【实测，`bank.za.group` 每页导航原文】：

| 银行服务侧 | 投资/保险侧 |
|---|---|
| Individual Account Opening | **Invest → Funds / Stocks** |
| Deposit | **Insurance → Generali / ZA Insure** |
| **ZA Card** | |
| **Transfer / Global Transfer / Foreign Exchange** | |

→ ★ **ZA 的顶部分类就是「银行业务」与「投资业务」两大块**。这就是 B.0 那句结论的证据：**业务层级的第一刀切在「钱放在哪（存款/卡/汇兑）」与「钱拿去投（基金/股票/保险）」之间。**

### B.7 对 bk-agent 的映射表（可直接施工）

| ZA 业务域 | 我们现在的对应 | 差距 / 建议 |
|---|---|---|
| Account_opening（按身份分叉） | 无 | 不做（演示项目无开户） |
| Deposit_related（活期/定期） | `accounts` 余额 | **可加「钱罌/子账户」对象**：让「攒钱」有真实容器，而不是只算数字 |
| Transfer（13 子域） | `transferFlow.js` + `payees` | **缺 `Limit_Related` 独立域** → 限额应是一等业务规则对象 |
| Transfer/eDDA | 无 | ★ **订阅域应有「授权 mandate」实体**（生效/已撤销），而不是只聚合流水 |
| Transfer/Anti_fraud_viewer | 无 | ★ **高危警示挂在「收款人」对象上**，文案必须避免虚假安全感 |
| ZA_Card（8 子域） | `cards.jsx` / `cardFreeze` / `cardProfile` / `cardData` | 结构基本对齐；**缺「本月消费金额 + 明细类别」常驻区** |
| ZA_Card/Refunds_and_transaction_disputes | 无 | **「交易疑问」= 从流水行内长出的动作**，契合 A2UI |
| Savings_Pot（2 类型） | 无 | 若要加，**明确选「子账户」模型还是「容器」模型** |
| Investment_Related（5 对象） | **无** | ★ **先建「投资账户」对象，再谈买基金** |
| Loan / Loan_Service（同构两套视图） | 无 | 演示可不做；但**「产品视角 vs 服务视角」是通用模式** |
| Bank_insurance（独立域） | 无 | 不做 |
| Southbound_scheme | 无 | 不做 |
| Business/*（8 域，与个人域同构） | 无 | **可做成「同一对象模型、不同外壳」的架构论证** |

---

## C. 高级设计师的布局想法

> 本节只采纳**可核验的设计师/设计机构原话**，不写「简洁优雅」类空话。

### C.1 可引用的设计方来源（四个，均实测抓到正文）

| # | 来源 | 身份 | 状态 |
|---|---|---|---|
| 1 | **ZA Bank UX Design Team**（iF Design 获奖条目） | ZA 自己的设计团队，**列名 10 位设计师** | ✅ 正文抓取成功 |
| 2 | **Felix Lebedinzew**（Senior Product Designer, Revolut Retail Banking App 2023–2024） | Revolut 首页/支付/卡片/本地化/资料流负责人 | ✅ 正文抓取成功 |
| 3 | **Monzo Writing / Design 团队** | Monzo 产品写作系统（Max White / Sam Branter 署名） | ✅ 正文抓取成功 |
| 4 | **The Skins Factory**（25 年金融界面设计机构） | 专业 fintech UI/UX 机构的方法论 | ✅ 正文抓取成功 |

**(1) ZA Bank 的获奖条目与具名设计师**【实测】
<https://ifdesign.com/en/winner-ranking/project/za-hong-kongs-no1-digital-bank-800000-users/710648>（2025 年，Branding & Communication Design → Apps/Software → Mobile application - Fintech）
【官方原文，评委评语全文】：
> "ZA Bank is the 1st and leading digital bank in Hong Kong. The ZA Bank App has provided an excellent banking experience for over **800k users**, including the **smooth digital account opening process**, the **lai-see feature first to market**, **gamifying debit Card** and competitive products such as **Time deposits and Mutual funds**. With the help of **AI and Web3** technologies, the bank is determined to become a '**future bank**'..."

具名设计团队（原文照录）：**UX Design Team, ZA Bank Limited** —— Zhendong Liu, Xinpu Jiang, Jingjing Dai, Ying Fang, Shipei Zhang, Huizi Sun, Zhonghan Zhu, Xiaoting Yi, Lifang Liu, Weiyu Jiang。
开发周期 **up to 6 Month**，2022 年上线，目标区域 Asia。

→ ★ 三条可落地判断：
- **评委点名的四个亮点里两个是「情绪/游戏化」**（利是首发、借记卡游戏化），一个是**流程**（开户顺滑），一个是**产品**。**没有一条是「视觉好看」**。这印证了赛题「情绪价值」要求的方向是对的。
- **开发周期 6 个月做一版 App**（对比 App 3.0 的 3 个月）—— 顶级数字银行的完整改版周期量级。
- **它 2022 年获奖，2026 年还在做 App 3.0** —— 上游 §A.2.6 讲的「IA 是迭代出来的」再得一证。

**(2) Revolut 内部设计师的一手描述**【实测】
<https://www.madebyfelix.com/project/revolut>
【原话】：
> "This department is responsible for **key features of the Revolut consumer app, including the home screen, payments, cards, localization, and profile flows**."
> "I also **laid the groundwork for a new approach to widget customization on the home screen and account screens**."
> "**Working within an established design system, I aimed to push the boundaries of simplicity and user engagement.** I was involved in major updates to the design system, particularly in the areas of **pattern and style consistency**."
> "My contributions ... resulted in the development of **customization flows** that provided Revolut's **45 million+ users** with easy and enjoyable ways to **personalize their home and account screens**, leveraging the new **widget infrastructure and framework**"

→ ★ 最有价值的一句是 **"Working within an established design system, I aimed to push the boundaries of simplicity"**：**顶级设计师的「高级感」不是靠自由发挥，是靠「在既定系统内做减法」**。以及 **widget 化首页** —— 与 ZA 的「自订小工具」是同一路线（上游 §A.2.4 已记录 ZA 的 widget）。
**结论：头部数字银行的首页都是「可定制的组件画布」，不是「固定版式」。**

**(3) Monzo 的产品写作系统 —— 三条原则**【实测】
<https://monzo.com/blog/weve-made-our-writing-system-available-to-all>（2025-02-19）
【官方原文，三条原则全文】：
> "**1. Keep your writing short** — You want to make sure that **every word on the screen earns its seat at the table**. Writing in apps often means stringing a sentence in cramped conditions and when **characters are at a premium**, you need to get thrifty."
> "**2. Write in the active voice** — Saying who did the thing is clearer, fairer and shorter than not saying who did the thing. So instead of saying '**the payment was blocked**', we say '**we blocked the payment**'."
> "**3. Be consistent** — Familiarity helps people do things faster. And **it builds trust, which is an especially important currency when you're a bank**."
另【官方原文】："every person who joins Monzo – **no matter how senior they are** ... – completes **writing training in their first two weeks**."
写作系统已**公开在 Figma**。

→ ★ **"we blocked the payment" 这条对本项目是零成本、高收益的改动**：我们所有失败/拦截提示都应该改成主动语态 + 明确主语（"我们拦截了这笔转账，因为 X"，而不是 "转账被拦截"）。**AI Agent 场景下这一点更重要**：用户必须知道**是 Agent 干的还是银行风控干的**。

**(4) Skins Factory：Fintech UI/UX 设计原则**【实测】
<https://www.theskinsfactory.com/uiux-design-blog/fintech-ui-ux-design>
【原话摘录，逐条】：
> "**Trust is a design decision, not a legal disclaimer.** ... That question gets answered in the **first three seconds** ... It gets answered by **layout density, typography weight, color precision, and the quality of every micro-interaction**."
> "**Trust signals in fintech UI are specific: consistent spacing systems, purposeful color palettes, iconography that earns its place, and zero visual noise in the transaction flow.**"
> "**Data density done right.** ... The benchmark for data-dense financial UI is not a consumer app. It is **Bloomberg Terminal**. Not the look, the principle: **every pixel is accountable**. Information is structured with precision. **Hierarchy is earned by importance, not decoration.**"
> "The wrong instinct: **Aggressive simplification** — Hiding numbers behind 'friendly' visuals. Prioritizing approachability over legibility."
> "**Friction is a feature when used correctly.** ... A wire transfer confirmation screen with **a one-second delay and a clear summary** isn't bad UX. It's a signal that the system is being appropriately careful with consequential actions."
> "**Friction on high-stakes actions, transfers, account changes, large purchases, is correct. Friction on routine tasks like checking a balance or logging in is a UX failure.**"
> "**Color carries more weight here than anywhere else.** A red notification badge in a social app is noise. **A red number in a portfolio dashboard is a signal, and often a stressful one.** ... **Green and red are not branding tools. They are signals, used sparingly, where meaning matters.**"
> "**No design for the emotional reality of money.** Money carries **anxiety, excitement, embarrassment, and privacy**. A failed payment, an overdraft alert, a flagged transaction: **these are moments of high user stress. Clinical, tone-deaf error messages in financial contexts don't just frustrate users. They damage trust.**"
> "**Mobile was an afterthought.** ... A task that takes three clicks on desktop should require **one tap on mobile, or it should not exist on mobile at all**."

→ ★ 第 6 条（friction 只加在高风险处）**和我们的赛题权限分级一字不差**；第 7 条（红绿是信号不是品牌色）**直接约束我们账单页的收支配色**；第 8 条（金钱的情绪现实）**就是作者要的「情绪价值」的方法论表述**。

### C.2 他们为什么这样排布 —— 三个「解决具体问题」的决策

| 决策 | 解决什么问题 | 代价 |
|---|---|---|
| **ZA：首页「最关心的 → 最想做的 → 正在发生的」** | 用户打开银行 App 只有一个问题：还剩多少钱 | 第一屏只装得下一个数字（上游 §A.4①） |
| **Revolut：AI 不占 tab，用「屏幕中部下拉」唤起** | 导航坑位是有限资源；AI 是**跨产品**能力，放进任何一个 tab 都是错的归属 | 功能可发现性下降——用户得先知道有 AIR |
| **ZA：App 3.0 劈成「银行 / 投资」两个主界面** | 投资产品线扩张后，投资内容会把银行基础功能挤出首页 | 一个 App 内两套层级，切换成本增加 |

**共性**：三者都在**「减少第一屏要回答的问题数量」**。
→ 对我们：**助手页的第一屏应该只回答一个问题**（"你的钱现在怎么样" / "你想做什么"），而不是把 7 个页面的入口都铺上去。

### C.3 「一眼高级」的具体手法 —— 可核验的来源 + 归因

| 手法 | 具体做法 | 证据 |
|---|---|---|
| **1. 统一间距系统** | 整站 4/8pt 网格；上游实测 ZA 令牌文件里同一基色 + 变 alpha 的中性色体系 | Skins Factory 原文 "consistent spacing systems"；上游 §A.3.2【实测】 |
| **2. 字号靠「对比」而非「数量」** | ZA 英雄金额约 40pt，比 Apple 最大 LargeTitle（34pt）还大一档；正文 16px | 上游 §A.3.6【实测】 |
| **3. 留白分配：把留白给「唯一重要的东西」** | 首页只留 3 段（总资产 / 8 快捷 / 动態） | 上游 §A.2.2【实测】 |
| **4. 色彩克制：把彩色留给「信号」** | ZA 的产品线分色是**9 级结构**、控制色按产品线分色；红绿不做品牌色 | 上游 §A.3.3【实测】+ Skins Factory 原文 |
| **5. 阴影几乎不用** | ZA 484,855 字节 CSS 里只有 **3 个不同 box-shadow 值 / 6 条声明**，靠色差 + 圆角 + 间距分层 | 上游 §A.3.7【实测】 |
| **6. 图标「挣得自己的位置」** | 同一个 4×2 网格里用两种图标语言（实心绿圆=动作 / 彩色品牌图标=产品）区分语义 | 上游 §A.2.2【实测】+ Skins Factory 原文 |
| **7. 微交互质量即信任信号** | ZA「5 秒转账缓冲」；Skins Factory「one-second delay and a clear summary」 | 上游 §A.4⑤【官方原文】+ Skins Factory 原文 |
| **8. 组件而非版式** | Revolut 的 widget 化首页；ZA 的自订小工具 | Felix 原文 + 上游 §A.2.4【官方原文】 |

### C.4 ★ 可直接落地的手法清单（按「改动成本 / 收益」排序，全部可在现有 tokens.css 体系内完成）

| # | 手法 | 具体做法 | 成本 |
|---|---|---|---|
| 1 | **失败文案改主动语态 + 明确主语** | 「转账被拦截」→「**我们拦截了这笔转账，因为收款人未在常用名单且金额超过 1000 元**」；Agent 执行的要写明「**助手**执行了 X」 | 改字符串 |
| 2 | **给「一秒可撤销」而非「二次确认」** | 已有 `UndoBar.jsx` + `useUndoWindow.js`——把它从转账扩展到**所有执行类动作**（含 Agent 自动执行的），文案沿用 ZA 的「N 秒内可撤销」 | 低 |
| 3 | **卡片层级只靠色差 + 圆角 + 间距，删阴影** | 上游已论证：ZA 全站 3 个阴影值。我们现在 6 个阴影令牌 + 玻璃阴影 → **净删除**，直接提「高级感」 | 删 CSS |
| 4 | **中性色基色换海军蓝黑** | ZA 基色 `#030516`（蓝通道是红的 7.3 倍），我们目前是中性黑 | 改 5 行令牌 |
| 5 | **正文字号 17px→16px、行高 1.29→1.5、去掉负字距** | 中文 + 数字密集的账目界面 ZA 那套更耐读（上游 §0 第 6 条已给结论） | 改令牌 |
| 6 | **红绿只做信号，不做品牌** | 支出/收入色只出现在金额与状态，不出现在图标底色、标题、按钮 | 审查 |
| 7 | **图标必须「挣得位置」** | 一屏内图标数量设上限；同一网格内用**形状语言**区分「动作 vs 对象」（ZA 的实心圆 vs 彩色品牌图形） | 中 |
| 8 | **首页第一屏只回答一个问题** | 对照 ZA 三段式，把概览页从 6 段继续砍 | 上游 §D.3.1 已规划 |
| 9 | **限额做成「一等业务对象」** | 独立页面/区块解释「每日限额 / 单笔限额 / 小额免验证额度」，而不是散落在转账页 | 中（对应 §B.3） |
| 10 | **执行类动作统一走「详情 → 确认 → 可撤销」三段** | 与 ZA 的「一键锁卡 → 确认」两步对齐，再补第 3 步撤销窗口 | 中 |
| 11 | **写一个「产品写作系统」文件** | 照 Monzo 三原则（短 / 主动 / 一致），落到 `doc/` 里，与 tokens.css 并列为「唯一来源」 | 低（纯文档） |
| 12 | **数据密集区允许高密度，别过度简化** | Skins Factory 的 Bloomberg 原则：**每一个像素都要能对账**；账目页不要为了「友好」隐藏数字 | 设计取向 |

---

## D. 「情绪价值」的 UI 设计 —— 交易类别图标 / 头像体系

> 作者要求：动態里的交易（工资、房租、餐饮、采购、地铁、打车、云空间、光影视频……）**都要有详细的 UI 头像或图标，以提供情绪价值**。
> 本节给的是**产业界真实在跑的实现**，不是创意建议。

### D.1 行业怎么做交易图标 —— 四个真实实现

**(1) ★ Plaid Enrich：交易富化的工业标准**【实测，官方文档原文 + 官方 CSV 原文】

文档：<https://plaid.com/docs/enrich/>
官方样例（原文照录，这是**一条真实交易的完整富化结果**）：
```json
// 输入：PURCHASE WM SUPERCENTER #1700 POWAY CAUS
{
  "counterparties": [{
    "name": "Walmart", "type": "merchant",
    "logo_url": "https://plaid-merchant-logos.plaid.com/walmart_1100.png",
    "website": "walmart.com",
    "entity_id": "O5W5j4dN9OR3E6ypQmjdkWZZRoXEzVMz2ByWM"
  }],
  "logo_url": "https://plaid-merchant-logos.plaid.com/walmart_1100.png",
  "merchant_name": "Walmart",
  "payment_channel": "in store",
  "personal_finance_category": {
    "primary": "GENERAL_MERCHANDISE",
    "detailed": "GENERAL_MERCHANDISE_SUPERSTORES"
  },
  "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
  "website": "walmart.com",
  "location": { "address": "...", "store_number": "1700", "lat": ..., "lon": ... }
}
```

**必须同时看到两件事**：

> ★ **产业界的答案不是「用商户 logo」或「用类别图标」二选一，而是两者都有，且分属两个字段**：
> - `logo_url` = **商户头像**（Walmart 的 logo）
> - `personal_finance_category_icon_url` = **类别图标**（GENERAL_MERCHANDISE 的类别图）
> 再配 `counterparties[].type = "merchant"` 区分对手方类型。**这正是「详细 UI 头像 + 类别图标」双轨制的官方出处。**

**(2) ★ Plaid 的 Personal Finance Category（PFC）taxonomy —— 免费可用的工业级分类表**【实测，官方 CSV 直接下载】
<https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv>（实测 HTTP 200，**9,903 字节**）

实测统计：**104 条 detailed 分类 / 16 条 primary 分类**（含表头共 105 行）。
16 个 primary（实测排序）：`BANK_FEES, ENTERTAINMENT, FOOD_AND_DRINK, GENERAL_MERCHANDISE, GENERAL_SERVICES, GOVERNMENT_AND_NON_PROFIT, HOME_IMPROVEMENT, INCOME, LOAN_PAYMENTS, MEDICAL, PERSONAL_CARE, RENT_AND_UTILITIES, TRANSFER_IN, TRANSFER_OUT, TRANSPORTATION, TRAVEL`

**★ 作者点名的那 8 类交易，在 PFC 里全都有对应条目**（原文照录）：

| 作者的交易 | PFC detailed | 官方描述原文 |
|---|---|---|
| **工资** | `INCOME_WAGES` | "Income from **salaries**, gig-economy work, and tips earned" |
| **房租** | `RENT_AND_UTILITIES_RENT` | "**Rent payment**" |
| **餐饮** | `FOOD_AND_DRINK_RESTAURANT` / `FOOD_AND_DRINK_COFFEE` / `FOOD_AND_DRINK_FAST_FOOD` | "Dining expenses for restaurants, bars, gastropubs, and diners" / "Purchases at **coffee shops or cafes**" |
| **采购** | `GENERAL_MERCHANDISE_GROCERIES`… 实际 groceries 在 FOOD_AND_DRINK；采购归 `GENERAL_MERCHANDISE_*`（13 条） | "Purchases for fresh produce and groceries, including farmers' markets" |
| **地铁** | `TRANSPORTATION_PUBLIC_TRANSIT` | "Public transportation, including **rail and train, buses, and metro**" |
| **打车** | `TRANSPORTATION_TAXIS_AND_RIDE_SHARES` | "**Taxi and ride share** services" |
| **云空间** | `GENERAL_SERVICES_OTHER_GENERAL_SERVICES` | "Other miscellaneous services, including advertising and **cloud storage**" ← 官方描述里**明写 cloud storage** |
| **光影视频** | `ENTERTAINMENT_TV_AND_MOVIES` | "In home **movie streaming services** and movie theaters" |

→ ★ **这张表可以直接当我们的分类字典用，而且是「工业标准」。** 建议我们的交易 category 字段直接采用 PFC 的 primary 命名（英文常量）+ 中文显示名映射，**理由**：将来接任何真实数据源（Plaid / 银行开放 API）都是零转换成本，且 104 条 detailed 给了我们足够的细分粒度做「详细图标」。

**(3) Monzo：商户数据是「众包 + 联网查找 + 跨用户共享」**【实测，官方博客原文】
<https://monzo.com/blog/2018/02/15/android-crowdsourcing-merchant-data>（2018-02-15）
【官方原文】：
> "We show you helpful information about your transaction, like the **name, location and logo** of the place you made a purchase. **Rather than an indecipherable string of letters and numbers!**"
> "our system **tries to find details for that retailer somewhere on the internet**, whenever you make a purchase. **We store each retailer's information, so we can show it to other Monzo users** who make purchases from the same place."
> "When that data is missing, we're forced to show you **incomplete information** about your transaction, which isn't ideal."
> 纠错入口原文："If you see something wrong, go into the transaction and tap '**Improve name, location or logo**.' You'll then be able to **enter in the right name, search Google Maps for the right location, and give us the merchant's Twitter handle so we can find their logo**."

→ ★ 四条可直接抄的工程决策：
1. **「原始串码」是敌人**："WM SUPERCENTER #1700 POWAY CAUS" → "Walmart"。**我们必须有这一层**，否则流水就是一堆乱码，追不上「情绪价值」。
2. **商户信息是共享的全局实体**（"we store ... so we can show it to other Monzo users"）——**我们 demo 里也应该把商户建成一张表，而不是每条交易内嵌一个名字**。
3. **数据缺失是常态，必须有兜底**（"we're forced to show you incomplete information"）→ **兜底就是「类别图标」，这正是为什么需要双轨制**。
4. **纠错入口在交易详情内**（"go into the transaction and tap 'Improve...'"）——**行内动作，不是设置页**。

**(4) ZA Bank 自己的做法**【实测，上游已记录 + 本次补证】
- 上游 §A.2.2 实测：ZA 的「动態」行结构是 `[彩色图标] 標題(粗) / 時間(小灰) …… 金額(右对齐, 粗)`，**每一条交易左边都有一个彩色图标**。
- 本次补证【官方原文，`ZA_Card_app_spending_features`】：ZA Card 页有「**本月消费金额**」，官方补充「**ZA Bank App 仲提供明细消费类别**」。
- 本次补证【官方原文，`zafund`】：基金认购完成后「**可以知道基金认购的状况**」。
- 【未能证实】ZA 动態里**具体用的是商户 logo 还是类别图标**，公开材料无法判定。**本文不对这一点做断言。**

### D.2 「用真实商户 logo」的做法与边界

**(1) 现成的品牌 logo 库：`simple-icons`**【实测】

| 项 | 值 |
|---|---|
| 仓库 | <https://github.com/simple-icons/simple-icons> |
| star | **25,921**（`gh api` 实测） |
| license | **CC0-1.0** |
| 最近 push | 2026-09-27T11:55:52Z |
| 规模 | 官方 README 原文："Over **3400 SVG icons** for popular brands" |

**★ 数据结构正是「图标 + 品牌色」双字段，可直接驱动我们的彩色头像**【实测，`data/simple-icons.json` 原文】：
```json
{ "title": "Netflix",   "hex": "E50914", "source": "...", "guidelines": "https://brand.netflix.com/en/assets/logos" },
{ "title": "Spotify",   "hex": "1ED760", "source": "...", "guidelines": "https://developer.spotify.com/documentation/general/design-and-branding/#using-our-logo" },
{ "title": "Starbucks", "hex": "006241", "source": "https://starbucks.com", "guidelines": "https://creative.starbucks.com" },
{ "title": "Deliveroo", "hex": "00CCBC", "source": "https://deliveroo.com" },
{ "title": "Airbnb",    "hex": "FF5A5F", "source": "https://www.airbnb.com" },
{ "title": "McDonald's","hex": "FBC817", "source": "https://www.mcdonalds.com/gb/en-gb/newsroom.html" },
{ "title": "Uber",      "hex": "000000", "source": "https://assets.uber.com/...", "guidelines": "..." },
{ "title": "Apple",     "hex": "000000", "source": "https://www.apple.com" }
```
→ ★ **`hex` 字段就是「让每个商户头像自带品牌的颜色」的现成答案**。我们只要维护一张 `merchantSlug → {title, hex}` 的小表（哪怕只手抄 20 个），就能让每条交易的头像**颜色来自真实品牌**，而不是我们随便配色。**这是成本最低、观感提升最大的一招。**

**⚠️ 法律边界（必须写进报告）**：`simple-icons` 的 README 明确写着：
> "We ask that all users read our **legal disclaimer** before using icons from Simple Icons."

许可证 CC0-1.0 覆盖的是**这个仓库的代码/数据组织**，**不覆盖商标本身**——每个品牌的 logo 是其所有者的商标，商用需要遵守各自的 brand guidelines（数据里的 `guidelines` 字段就是官方规范地址）。**演示项目内使用、标注来源即可；不要写成「可商用」。**

**(2) 真实项目里怎么做 —— `kharcha` 的 220 个商户 drawable**【实测】
<https://github.com/AkashPriyadarshii/kharcha>（1★ / **Apache-2.0** / push 2026-09-25 / Kotlin）
仓库描述原文："Kharcha, India-first UPI expense tracker for Android. ... **220 merchant logos**, budgets, reports, shareable cards."
实测文件树（`gh api .../git/trees/HEAD?recursive=1`）显示资源命名规则是 **`ic_brand_<slug>.png`**：
```
app/src/main/res/drawable-nodpi/ic_brand_amazon.png
app/src/main/res/drawable-nodpi/ic_brand_amazon_prime.png
app/src/main/res/drawable-nodpi/ic_brand_apple_music.png
app/src/main/res/drawable-nodpi/ic_brand_netflix... (同规则)
app/src/main/res/drawable-nodpi/ic_brand_airtel.png
app/src/main/res/drawable-nodpi/ic_brand_axis_bank.png
app/src/main/res/drawable-nodpi/ic_brand_bigbasket.png
app/src/main/res/drawable-nodpi/ic_brand_blinkit.png
...
```
→ ★ **落地形态：一个「品牌 slug → 图片资源」的扁平命名空间 + 一次查表**。这是最朴素也最有效的做法，**不依赖任何运行时 API**（我们的零依赖约束正好契合）。

**(3) 银行/卡组织 logo 库（对比参考）**【实测，`gh api` 逐个核验】

| 仓库 | star | license | 最近 push | 语言 | 归档 |
|---|---|---|---|---|---|
| `goodpont/binking`（按卡号取银行 logo/配色/品牌） | **513** | **NONE** | 2024-08-22 | JavaScript | false |
| `omise/banks-logo`（白色银行 logo 集） | **224** | MIT | 2024-06-23 | — | **true（已归档）** |
| `aaronfagan/svg-credit-card-payment-icons`（**6 种风格 / 80 个图标**） | **635** | **Apache-2.0** | 2026-04-28 | JavaScript | false |
| `muffinresearch/payment-icons`（支付/电商 SVG 图标包） | **706** | **MPL-2.0** | 2021-09-20 | JavaScript | **true（已归档）** |

→ **对我们有用的只有 `aaronfagan/svg-credit-card-payment-icons`**：**Apache-2.0 + 活跃 + 「6 种风格」**——「同一套图标提供 6 种视觉风格」正是我们做「卡片/支付方式」图标时要的**风格化参数**。另外两个已归档，不建议作为长期参考。

### D.3 头像 / 图标体系怎么建（形状系统 / 配色系统 / 动效）

把 D.1、D.2 的证据收敛成一套可施工的规则：

**① 形状系统 —— 用「形状」而不是「文字」区分交易性质**

上游实测到的 ZA 规则（§A.2.2）：**同一个 4 列网格里，动作 = 实心绿圆 + 白色线性图标；产品 = 彩色品牌图形（不是圆）**。
把它推广到交易流水：

| 交易性质 | 形状 | 依据 |
|---|---|---|
| **商户消费**（餐饮/采购/打车…） | **圆形**，内填商户品牌图形/品牌色 | Plaid 的 `logo_url` 是商户头像 |
| **类别兜底**（识别不出商户时） | **圆形**，内填类别图标，底色取类别色 | Plaid 的 `personal_finance_category_icon_url` |
| **收入**（工资） | **圆形** + 明确的正号 + 收入色 | PFC `INCOME_WAGES` |
| **周期性/订阅**（云空间、光影视频） | **圆角方形（squircle）** ← 与一次性消费区分 | 我们自己定义；ZA 用「胶囊按钮」标「需要行动」是同一思路 |
| **转账给人** | **人物头像位**（首字母/头像），不是图标 | ZA 的「常用收款人」是人的概念 |
| **账户内部动作**（钱罌存入、利息） | **圆形 + 品牌绿**，与商户区分 | ZA 动態实测样本："錢罌存入 / 今天 00:52 / HKD 120.00" |

**② 配色系统 —— 三级来源，优先级从高到低**

1. **商户品牌色**（来自 `simple-icons` 的 `hex`）—— 最高优先级，最能提供「情绪价值」（Netflix 红、Spotify 绿、Starbucks 深绿）
2. **类别色**（来自我们自己的 category → 色板映射，建议直接对齐 PFC 的 16 个 primary）
3. **中性兜底**（未知商户/未知类别）—— 用 tokens.css 里的中性灰阶，**不要随便配一个彩色**

**★ 关键约束（照 Skins Factory 的原则）**：**红/绿只做信号**。所以**类别色盘里必须不含"收入绿"和"支出红"这两个语义位**，否则会和金额颜色互相干扰。落地做法：把类别色盘限制在**冷暖中间调**（蓝/青/紫/橙/棕/靛），把纯红、纯绿留给金额。

**③ 动效 —— 只给「新事件」，不给「滚动」**

- 新增交易入场：**一次**缩放+淡入（200–260ms 量级），**只播一次**，不循环
- 待处理项（ZA 的「詳情」胶囊）：**可以用极轻的呼吸动效** —— 上游实测 ZA 的做法是**静态浅薄荷绿胶囊**，不用动效也成立 → **优先静态**
- 必须遵守项目既有约束：`prefers-reduced-motion` 降级（AGENTS.md §3）
- 【未能证实】ZA 与 Revolut 的 App 内动效数值均无公开来源，**本文不给任何具体弹簧参数**

**④ 数据缺失兜底（Monzo 教的那一条）**

三级降级必须实现，且**每一级都要好看**：
`商户名+logo` → `商户名` → `类别名 + 类别图标` → **绝不允许出现 "WM SUPERCENTER #1700 POWAY CAUS"**

### D.4 ★ 给本项目的具体方案（作者点名的那 8 类）

按 PFC 对齐，给出**头像形态 + 底色来源 + 中文显示名**：

| 作者的点名 | PFC 归类 | 头像形态 | 底色来源 | 备注 |
|---|---|---|---|---|
| **工资** | `INCOME_WAGES` | 圆 + 收入色 | 品牌/中性 | 金额用**收入绿**；头像**不要**也用绿（避免双重语义） |
| **房租** | `RENT_AND_UTILITIES_RENT` | 圆 + 房屋图标 | 类别色（低饱和） | 金额大、周期固定 → 与「订阅」共用周期徽标 |
| **餐饮** | `FOOD_AND_DRINK_*` | 圆 + 商户品牌 graphic | **商户品牌色** | 品类内可细分 coffee / restaurant / fast_food 三个子图标 |
| **采购** | `GENERAL_MERCHANDISE_*`（13 条） | 圆 + 商户品牌 graphic | 商户品牌色 | 兜底用购物袋类别图 |
| **地铁** | `TRANSPORTATION_PUBLIC_TRANSIT` | 圆 + 闸机/列车图标 | 类别色 | 高频小额 → 头像要**最简**，否则一天几十行会很吵 |
| **打车** | `TRANSPORTATION_TAXIS_AND_RIDE_SHARES` | 圆 + 商户品牌 graphic | 商户品牌色 | |
| **云空间** | `GENERAL_SERVICES_OTHER_GENERAL_SERVICES` | **圆角方形**（订阅态） | 商户品牌色 | 官方描述明写 "cloud storage"；**应识别为订阅** |
| **光影视频** | `ENTERTAINMENT_TV_AND_MOVIES` | **圆角方形**（订阅态） | 商户品牌色 | 同上；与「订阅」域联动 |

**「订阅态」用圆角方形是本方案的核心区分手法** —— 一次消费用圆、周期扣费用方。**不需要任何文字，一眼就能把「云空间/光影视频」从一堆消费里分出来**，这正是 ZA「两种图标语言」那一招的同构应用。

**当前代码基线对照**【实测，读代码所得】：`src/views/pages/bills.jsx` 现有分类映射为
`const CAT_KEY = { '转账','餐饮','购物','交通','订阅','收入' }` —— **6 类**。
作者的 8 个例子会落到这 6 类里的 5 类（工资→收入、房租→**新类**、餐饮→餐饮、采购→**新类/购物**、地铁→交通、打车→交通、云空间→订阅、光影视频→订阅）。
→ **建议扩充到 10–12 类**，并显式引入「**周期/订阅**」这一维度（不是类别，是**标签**：`recurring: true`），因为它跨越多个类别（房租/云空间/光影视频都是周期性的）。

### D.5 图标栅格与规格（可直接抄的数值）

本项目 tokens.css 已有 `--radius-thumb: 12px` 等语义圆角与 4/8pt 间距网格【实测】。交易头像规格建议：

| 场景 | 直径/边长 | 圆角 | 依据 |
|---|---|---|---|
| 桌面流水行头像 | **40px** | 圆形 / 圆角方 12px | 上游 §C.2 实测 `mikechiloane/Banking-App-UI` 的交易行就是 **40×40 圆头像** |
| 移动流水行头像 | **36–40px** | 同上 | ZA 首页快捷圆盘实测 **54.9pt** 是**快捷入口**不是流水头像，**不要照抄到流水** |
| 行内小徽标（订阅/周期） | **16px** | 圆形 | 与字号 `--text-caption-2`(11pt) 对齐 |
| 头像与文字间距 | **12px** | — | 落在 `--space-4` |

**图标内容占头像的比例建议 0.55–0.65**（品牌图形不要撑满，留出呼吸感）—— 这是通用设计经验值，**非实测**，标注清楚。

---

## E. 开源参考（`gh` CLI 实测）

> 上游 §C 已覆盖「手机银行 UI 库」方向（25 个仓库），本节**换方向**：交易图标集 / 商户 logo / 品牌色 / 类别 taxonomy / 记账面板。
> 全部数值来自 `gh api repos/OWNER/REPO` **逐仓实测**，非搜索结果二手值。

### E.1 实测表（16 个，按 star 降序）

| 仓库 | URL | star | license | 最近 push | 语言 | 归档 | 定位 |
|---|---|---|---|---|---|---|---|
| `FortAwesome/Font-Awesome` | <https://github.com/FortAwesome/Font-Awesome> | 76,947 | **Other（非标准）** | 2026-07-15 | JavaScript | false | 通用图标，**license 非 SPDX 标准，慎用** |
| `google/material-design-icons` | <https://github.com/google/material-design-icons> | 54,035 | Apache-2.0 | 2026-09-25 | — | false | Material Symbols |
| `feathericons/feather` | <https://github.com/feathericons/feather> | 26,005 | MIT | 2025-03-11 | JavaScript | false | lucide 的上游 |
| **`simple-icons/simple-icons`** | <https://github.com/simple-icons/simple-icons> | **25,921** | **CC0-1.0** | 2026-09-27 | JavaScript | false | ★ **3400+ 品牌 logo + 品牌色 hex** |
| `lucide-icons/lucide` | <https://github.com/lucide-icons/lucide> | 24,753 | Other | 2026-09-28 | TypeScript | false | **我们已在用的依赖** |
| `firefly-iii/firefly-iii` | <https://github.com/firefly-iii/firefly-iii> | **24,763** | AGPL-3.0 | 2026-09-28 | PHP | false | 个人财务记账（有完整分类体系） |
| `tabler/tabler-icons` | <https://github.com/tabler/tabler-icons> | 21,799 | MIT | 2026-09-22 | JavaScript | false | 6200+ MIT 图标 |
| `ionic-team/ionicons` | <https://github.com/ionic-team/ionicons> | 18,183 | MIT | 2026-07-28 | TypeScript | false | 移动端图标 |
| `ghostfolio/ghostfolio` | <https://github.com/ghostfolio/ghostfolio> | **9,368** | AGPL-3.0 | 2026-09-27 | TypeScript | false | 开源财富管理（理财域结构参考） |
| `beancount/beancount` | <https://github.com/beancount/beancount> | 6,038 | GPL-2.0 | 2026-08-23 | Python | false | 复式记账（**账户层级建模**参考） |
| `actualbudget/actual` | <https://github.com/actualbudget/actual> | 29,192 | MIT | 2026-09-28 | TypeScript | false | 上游已覆盖，此处仅更新 star |
| `Cloeille/picsou-finance` | <https://github.com/Cloeille/picsou-finance> | **516** | **NOASSERTION** | 2026-09-28 | Java | false | 自托管记账仪表盘（账户/券商/加密/净值） |
| `goodpont/binking` | <https://github.com/goodpont/binking> | 513 | **NONE** | 2024-08-22 | JavaScript | false | 按卡号取银行 logo/配色 |
| **`aaronfagan/svg-credit-card-payment-icons`** | <https://github.com/aaronfagan/svg-credit-card-payment-icons> | **635** | **Apache-2.0** | 2026-04-28 | JavaScript | false | ★ 支付图标，**6 风格 / 80 图标** |
| `muffinresearch/payment-icons` | <https://github.com/muffinresearch/payment-icons> | 706 | MPL-2.0 | 2021-09-20 | JavaScript | **true** | 已归档 |
| `omise/banks-logo` | <https://github.com/omise/banks-logo> | 224 | MIT | 2024-06-23 | — | **true** | 已归档 |
| **`AkashPriyadarshii/kharcha`** | <https://github.com/AkashPriyadarshii/kharcha> | 1 | **Apache-2.0** | 2026-09-25 | Kotlin | false | ★ **220 个商户 logo 的真实工程实现** |
| `cameronking4/shadcn-openai-plaid-dashboard` | <https://github.com/cameronking4/shadcn-openai-plaid-dashboard> | 64 | **NONE** | 2024-12-14 | TypeScript | false | Plaid + OpenAI 记账面板（**B 类**：需 shadcn） |
| `syllogic-ai/syllogic` | <https://github.com/syllogic-ai/syllogic> | 16 | AGPL-3.0 | 2026-08-24 | TypeScript | false | **AI 自动分类 + 周期消费识别** |

**搜索结果生态结论（与上游 §C.0 一致，方向不同）**：
- `gh search repos "transaction icons"` → **0 条**
- `gh search repos "category icons finance"` → **0 条**
- `gh search repos "merchant logo"` → 10 条，**最高 1★**（几乎全是个人 CDN 仓库）
- → ★ **「交易类别图标集」这个方向在 GitHub 上几乎是空的。** 这意味着：**没有现成的东西可以抄，但也没有现成的对手**——我们自己建一套（对齐 Plaid PFC）反而是差异化资产。

### E.2 重点仓库源码摘录（实际抓取）

**① `simple-icons/simple-icons` ⭐ A 类首选（25,921★ / CC0-1.0）**
数据格式见 §D.2(1)。**唯一同时提供「图形 + 品牌色」的库**，且 license 最干净（CC0）。
- **可抄**：`{title, hex, source, guidelines}` 四字段模型。
- **不可抄**：整个库（3400 个 SVG 有几百 KB；且大量与金融无关）。**只抄我们需要的 20–40 个**。

**② `AkashPriyadarshii/kharcha` ⭐ 商户 logo 工程的真实样板（1★ / Apache-2.0）**
自定义 View 的 drawable 命名规范 `ic_brand_<slug>.png`（见 §D.2(2) 的实测文件树，共 220 个）。
- **可抄**：**命名规范**与**扁平 slug 命名空间**。
- **不可抄**：Android drawable 与本项目无关；且 1★ 说明未经社区验证。

**③ `aaronfagan/svg-credit-card-payment-icons`（635★ / Apache-2.0 / 活跃）**
官方描述原文："SVG Credit Card & Payment Icons: **6 Styles, 80 Icons**"。
- **可抄**：**「同一套图标 × N 种视觉风格」的组织方式** —— 我们做卡片/支付方式图标时，应该把「风格」做成参数（描边/填充/单色/多彩），而不是每个风格做一套资产。

**④ `syllogic-ai/syllogic`（16★ / AGPL-3.0）**
官方描述原文："Self-hosted personal finance dashboard with **AI categorization, recurring spend tracking**, and a live demo."
- **值得看**：它是**唯一**在做「AI 分类 + 周期消费识别」的开源记账项目 —— 正好对应赛题的「异常交易识别 / 自动识别订阅扣费」。
- **不可抄代码**：**AGPL-3.0**，传染性强，**与本项目不可兼容**。只做方案参考。

**⑤ `beancount/beancount`（6,038★ / GPL-2.0）**
复式记账的**账户层级模型**（Assets/Liabilities/Equity/Income/Expenses + 冒号分隔的树）。
- **可抄**：**账户树的设计思想**——尤其 `Income:Salary` / `Expenses:Rent` 这种**用命名空间表达业务层级**的做法，与 §B 的 ZA 域树是同一种思维。
- **不可抄**：GPL-2.0 代码；且复式记账对学生/普通用户过重。

### E.3 对依赖白名单的结论

**结论：E 节没有一个仓库需要被引入。**

- `simple-icons` 我们可以**只抄 20–40 条 `{slug, hex}` 数据**（JSON 常量），**不装包** —— 装包会拉进 3400 个图标 + 构建链，违反 AGENTS.md §1 的 ultra 约束。
- `aaronfagan/...`、`kharcha` 同理：**抄组织方式与命名规范，不抄资产**。
- 图标本身继续用 **`lucide-react`**（已在白名单，24,753★，且是 `feather` 的社区分支）。
- **许可风险排序（从安全到危险）**：CC0-1.0（simple-icons）> MIT > Apache-2.0（**注意 NOTICE 义务**）> MPL-2.0 > **GPL-2.0 / AGPL-3.0（本项目一律不用）** > NONE / NOASSERTION（**默认保留全部权利，不可用**）。

---

## F. 落地清单（按优先级）

### P0 —— 直接抄原文结论，成本低
1. **失败/拦截文案改主动语态 + 明确主语**（Monzo 原文），AI 执行的动作必须写明「助手」。
2. **把「可撤销窗口」从转账扩展到所有执行类动作**（ZA 把 "5 seconds recall" 写进 slogan）。
3. **删掉多余阴影，卡片层级靠色差 + 圆角 + 间距**（ZA 全站 3 个阴影值）。
4. **交易分类对齐 Plaid PFC 的 16 primary**，中文显示名映射；类别色盘**不含**红/绿。
5. **商户头像的底色用真实品牌色**（抄 simple-icons 的 `{title, hex}` 20–40 条）。
6. **「订阅态」用圆角方形头像**，与一次性消费的圆形区分。

### P1 —— 需要一点结构改动
7. **订阅域加「授权 mandate」实体**（生效/已撤销），对齐 ZA 的 eDDA。
8. **限额提升为一等业务对象**（对齐 ZA 的 `Limit_Related` 独立子域）。
9. **高危警示挂在「收款人」对象上，且文案不给虚假安全感**（ZA 原文："没告警 ≠ 安全"）。
10. **理财域先建「投资账户」对象**，再谈买基金（ZA 的 `Opening_an_investment_account` 是独立子域）。
11. **写一份产品写作系统文档**（Monzo 三原则），与 tokens.css 并列为唯一来源。

### P2 —— 赛题差异化的加分项
12. **AI 助手的入口与权限模型显式对标 AIR**：入口用「全局手势/常驻」而非深埋；权限三级（查询自动 / 中风险展示确认 / 高风险多因子），并**在报告里明确写出：「Revolut 只给了两级（无额外授权 / 生物识别），我们的中风险档是相对 AIR 的增量」**。
13. **人工接管**：明确保留「转人工」，并引用 Klarna 原文 "customers can still choose to interact with live agents"。
14. **沙箱隔离**写成工程语言："spawn a sandboxed container ... with a strict subset of tools"（Monzo 原文）。
15. **数据缺失三级降级**必须实现且每一级都好看（Monzo 原文的兜底教训）。

---

## 附录 A：本轮实际抓取成功的资源

| # | 资源 | 方式 | 用途 |
|---|---|---|---|
| 1 | `web.archive.org/…/revolut_enters_new_era…ai_assistant/` | pwsh | ★ AIR 发布原文 |
| 2 | `web.archive.org/…/air-ai-by-revolut/` | pwsh | ★ AIR 能力清单 + **生物识别确认原文** + 入口动线 |
| 3 | `web.archive.org/…/revolut_reveals_2025_vision…` | pwsh | AI 助手 2024 首次预告原文 |
| 4 | `web.archive.org/…/meet-pockets-the-next-evolution-of-vaults/` | pwsh | Pockets 更名与结构原文 |
| 5 | `web.archive.org/…/help.revolut.com/en-AU/…/what-are-revolut-vaults/` | pwsh | ★ Pockets 定义与创建步骤 + 帮助中心 IA |
| 6 | `monzo.com/blog/2018/02/15/android-crowdsourcing-merchant-data` | pwsh | ★ 商户 logo/众包/纠错流程原文 |
| 7 | `monzo.com/blog/building-agent-chip` | pwsh | ★ 沙箱 + 工具子集 + 10% PR |
| 8 | `monzo.com/blog/weve-made-our-writing-system-available-to-all` | pwsh | ★ 产品写作三原则 |
| 9 | `klarna.com/…/klarna-ai-assistant-handles-two-thirds…` | **web_fetch 直接 200** | ★ Klarna AI 全部硬数据 |
| 10 | `plaid.com/docs/enrich/` | pwsh | ★ 交易富化 JSON 样例（logo + 类别图标双字段） |
| 11 | `plaid.com/documents/transactions-personal-finance-category-taxonomy.csv` | pwsh | ★ **104 detailed / 16 primary 分类字典** |
| 12 | `plaid.com/blog/transactional-data-personalization-update/` | pwsh | logo/website 字段上线公告 |
| 13 | `bank.za.group/sitemap.xml` | pwsh | ★ **80 条帮助中心业务分类路径（业务域模型）** |
| 14 | `bank.za.group/en/faqs/…`（6 个分类页） | pwsh | ★ 二级域与官方问题原文 |
| 15 | `bank.za.group/en/{hkstock,fund,za-card,transfer,savings,wealth}` | pwsh | 官网页脚产品分类（银行/投资双块） |
| 16 | `blog.za.group/article/{zafund,investupgrade,za-card-launch,ZA_Card_app_spending_features,upgraded_transfer_features,savingpot05,story-about-zappy-and-alfie,Christmas_ZA_Bank_App_features}` | pwsh | ★ 逐步骤流程 + Zappy/Alfie 品牌故事 |
| 17 | `stockfisher.com.hk/news/a139101a-…` | pwsh | ★ **App 3.0 双主界面 + 投资 4 选项 + Claude Code** |
| 18 | `ifdesign.com/…/za-hong-kongs-no1-digital-bank-800000-users/710648` | pwsh | ★ 评委评语 + **10 位具名设计师** |
| 19 | `madebyfelix.com/project/revolut` | pwsh | ★ Revolut 内部设计师一手描述 |
| 20 | `theskinsfactory.com/uiux-design-blog/fintech-ui-ux-design` | pwsh | ★ fintech 设计原则与失败模式 |
| 21 | `raw.githubusercontent.com/simple-icons/…/data/simple-icons.json` | pwsh | ★ 品牌色数据格式 |
| 22 | `gh api repos/*`（16 仓） | gh CLI | ★ star/license/push/archived 逐仓实测 |
| 23 | `gh api …/git/trees/HEAD?recursive=1`（2 仓） | gh CLI | ★ 真实资产命名规范 |

## 附录 B：抓取失败、已明确标注的资源

| 资源 | 状态 |
|---|---|
| `revolut.com` 全站（news / blog / help） | **403**（web_fetch 与 pwsh 直连均然）→ 全部改走 Wayback |
| `help.revolut.com/help/profile-and-plan/getting-started-with-air/` | **403 + CDX 无快照 + jina 代理返回 CF 挑战页** → **AIR 帮助中心正文未获取** |
| `cdn.revolut.com/.../ai_chat_assistent_*.pdf`（5 语言） | `web_fetch`：`unsupported content type "application/pdf"` |
| `archive.org/wayback/available` API | `fetch failed`（DNS/连接），改用 `web.archive.org/web/YYYY/` 路径式快照成功 |
| `irishtechnews.ie`、`finextra.com`、`privatebankerinternational.com`、`finance.mingpao.com`、`news.mingpao.com` | **403**（Cloudflare） |
| `help.revolut.com/sitemap.xml` | **403** |
| Klarna 回撤报道（tenbound / CMSWire） | 【仅标题】正文未抓取，**本文未引用其内容** |
| N26 / Chase 的 AI 一手材料 | 只找到 Anthropic 客户案例标题【仅标题】，正文未抓取 |
| ZA / Revolut **App 内动效数值** | 【未能证实】无公开来源，**本文未做任何数值断言** |
| ZA 动態**具体用商户 logo 还是类别图标** | 【未能证实】公开材料无法判定 |
| Revolut AIR 的 **UI 截图** | 【未能证实】官方未公开 |

## 附录 C：可复现的抓取脚本（本轮主力工具）

`revolut.com` 与多数新闻站被 Cloudflare 拦截，**`pwsh` + `Invoke-WebRequest` + Wayback 快照**是本轮唯一可行路径：

```powershell
$ProgressPreference='SilentlyContinue'
$ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
function Get-Text($u){
  $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 45 -Headers @{'User-Agent'=$ua}
  $h=$r.Content
  $h=[regex]::Replace($h,'(?s)<script.*?</script>',' ')
  $h=[regex]::Replace($h,'(?s)<style.*?</style>',' ')
  $h=[regex]::Replace($h,'(?s)<[^>]+>',' ')
  $h=[System.Net.WebUtility]::HtmlDecode($h)
  $h=[regex]::Replace($h,'[ \t\r\f\v]+',' ')
  $h=[regex]::Replace($h,'(\s*\n\s*){2,}',"`n")
  $h.Trim()
}
# 403 站点一律加 Wayback 前缀：https://web.archive.org/web/2026/<原 URL>
Get-Text 'https://web.archive.org/web/2026/https://www.revolut.com/blog/post/air-ai-by-revolut/'
```

---

## 附录 Z：≤80 行浓缩版

1. **Revolut 的 AI 叫 AIR（AI by Revolut）**，2026-04-09 起在英国灰度，官方定位是「**moves beyond the traditional chatbot**」「**ending the era of multi-step navigation**」。
2. **AIR 的入口不是 tab，是「从屏幕中部下拉」**，或 Profile → Chats → AIR。→ 我们没有 tab 坑位压力，但仍可借鉴「全局手势唤起」。
3. **AIR 的能力清单官方给了 6 组样例话术**：预算、投资、**订阅/周期付款**、旅行（含 App 内买 eSIM）、**卡片控制（冻卡 / 申请一次性虚拟卡）**、入口。→ 除转账外，赛题业务能力它全做成了对话。
4. ★ **AIR 的确认流程官方只有一句但决定性**：「**AIR cannot perform sensitive actions without your biometric approval**」+「**only accesses the data you can already see**」。
5. → 翻译成权限分级：**查询类零授权（= 我们的低风险自动执行）**；**执行类一律生物识别（= 我们的高风险）**。
6. ★ **Revolut 没有中风险档。我们的「小额转账展示详情后确认」是相对 AIR 的增量**，这一点应该主动写进答辩材料。
7. **AIR 的三条隐私承诺**：zero data retention、不进第三方训练、只能看到用户已可见的数据。
8. **ZA Bank 的两级风控被写进了 slogan**：「5 seconds recall, facial authentication」。→ **可撤销窗口是低摩擦档的正确解法**。
9. **Revolut 的 Pockets 是「短期资金管理工具」**（帮助中心原文），类型只有 Regular / Group 两种，可自定义名称 + 头图 + 目标 + 零钱。
10. ★ **Revolut 的 AI 在 Profile 里，不在底部导航** —— 连 Revolut 都不敢把 AI 放主 tab。**我们把「助手」放进 tab 是主动差异化**，不是照抄。
11. **Klarna 的硬数据**：上线 1 个月 230 万次对话、占客服 2/3、等效 700 名全职、满意度与人工持平、重复咨询降 25%、解决时长 2 分钟（原 11 分钟）、23 市场 35 语言。
12. ★ **Klarna 明确保留人工兜底** ——「中断/回退/人工接管」是行业标准动作，不是我们的加分设计。
13. **Monzo 的 AI 是对内的**（Agent Chip，~10% merged PR，1800+ 任务/天），不是对客助手【未能证实 Monzo 有对客 AI】。
14. ★ Monzo 给了一句「沙箱隔离」的工程定义：**"spawn a sandboxed container ... with a strict subset of tools"**。
15. ★ **ZA 的业务层级 = 业务对象层级，不是页面层级。** 实测其帮助中心 **80 条业务分类路径**（21 一级域 + 59 二级域）：个人 **13 个一级域**、商业 **8 个一级域**，两域同构。
16. **个人域 13 个**：开户、开户活动、账户安全、银保、银行服务、存款、投资、贷款、贷款服务、钱罌、南向通、转账、ZA Card。
17. **转账域有 13 个子域**，其中 **`Limit_Related`（限额）是独立子域**、**`eDDA_Easy_Deposit` = 代扣授权**、**`Anti_fraud_viewer` = 高危警示**、**`Lai_See`（利是）是转账的一种类型**。
18. ★ **「一键取消订阅」在银行里的正规名字是「取消 eDDA mandate」** —— 订阅是**有授权状态的实体**，不是流水聚合。
19. ★ **限额是一等业务规则对象**，不是转账页的参数。我们缺这一层。
20. ★ **高危警示挂在「收款人」对象上**，且 ZA 官方原文强调「**没告警 ≠ 安全**」——警示文案不能给虚假安全感。
21. **卡域 8 个子域**：挂失/补卡/停用**合并为一个子域**（共享同一状态机）、退款与争议、消费、电子钱包、ATM、卡安全、ZA Coin 挂在卡下。
22. **投资域 5 个对象**，其中 **「开立投资账户」是独立前置步骤**（要先做风险测评问卷）。
23. **理财流程 5 步**（ZA 官方原文）：财富 → 基金 → 榜单首页 → 开投资户 → 认购（选基金→输入金额→继续→查看认购状况），最低 HKD 100。
24. **ZA 的基金页一级结构是「榜单」**（热卖/最高派息/最佳表现），不是营销位。
25. ★ **钱罌 = 活期账户的子账户（真实计息）**，Revolut Pockets = 心智容器。**两种模型二选一，必须先定。**
26. **转账的三条 ZA 原创交互**：对话式转账记录（自动按好友建会话）、给转账「畀 Like」（6 表情）、常用收款人（最多 10 个，星形入口在金额页）。
27. ★ **「对话式转账记录」证明「转账 = 对话」这个隐喻在真实银行成立** —— 这段可以直接当我们的产品论证。
28. **卡片管理统一入口是 `账户 > ZA Card`**，子功能在「交易管理」伞下；限額可按日/月/无卡签账分别设置。
29. ★ **「本月消费金额 + 明细消费类别」是卡页常驻区，不是独立 tab** —— 我们独立「账单」tab 与 ZA 不同，是有意选择（按任务切 tab），但要自知。
30. ★ **「交易疑问」入口在 `动態` 而不是卡页** —— 因为它是**从一条流水长出来的上下文动作**，与 A2UI 行内动作同源。
31. **ZA 卡有「一键锁卡 → 确认」两步流程**，无第三级。
32. ★ **ZA 官方承认业务扩张撑爆了导航**：App 3.0 把 App **劈成「银行 / 投资」两个主界面**，投资主界面下挂 **4 个选项**（含市场资讯、资产配置）。
33. **ZA 明确拒绝「拆成两个 App」**，坚持一站式 + 内部分界面 —— 支持我们「单 App + 双外壳」。
34. **ZA 用 Claude Code 3 个月完成 App 2.0→3.0** —— 与 Monzo Agent Chip 互为印证：AI 编码已进真实银行生产环境。
35. **ZA 获 iF Design 2025**，评委点名四个亮点：开户顺滑、**利是首发**、**借记卡游戏化**、定存与基金。**两个是情绪/游戏化，零个是「视觉好看」。**
36. **ZA 的具名设计团队有 10 人**（UX Design Team, ZA Bank Limited），开发周期 up to 6 months。
37. **Revolut 内部设计师（Felix Lebedinzew）原话**：**"Working within an established design system, I aimed to push the boundaries of simplicity."** + 首页 widget 化（45M+ 用户）。
38. → **顶级设计的高级感来自「在既定系统内做减法」，不是自由发挥；头部数字银行的首页都是可定制组件画布。**
39. **Monzo 产品写作三原则**：**短**（每个字都要挣得位置）、**主动语态**（"we blocked the payment" 而非 "the payment was blocked"）、**一致**。写作系统已公开在 Figma。
40. → ★ **我们所有失败提示改成主动语态 + 明确主语，AI 执行的动作必须写明「助手」** —— 零成本、高收益。
41. **Skins Factory 的 fintech 设计原则**：信任是设计决策；**数据密集区的标杆是 Bloomberg Terminal——每一个像素都要能对账**；**别过度简化**。
42. ★ **摩擦要用在正确的地方**：「高风险动作（转账/改账户/大额）加摩擦是对的；查询余额和登录加摩擦是 UX 失败」——**与赛题权限分级一字不差**。
43. ★ **红绿是信号不是品牌色，要克制使用**；金钱自带**焦虑、兴奋、尴尬、隐私**，临床式的错误文案会**损坏信任**。
44. **「一眼高级」的 8 个可核验手法**：统一间距系统、字号靠对比不靠数量、留白给唯一重要的东西、彩色只给信号、**几乎不用阴影（ZA 全站仅 3 个 shadow 值）**、图标要挣得位置、微交互即信任、组件而非版式。
45. ★ **产业界交易图标的答案是双轨制**：**商户 logo**（`logo_url`）+ **类别图标**（`personal_finance_category_icon_url`），来自 Plaid Enrich 官方 JSON 样例。
46. ★ **Plaid PFC taxonomy 实测：104 条 detailed / 16 条 primary**，CSV 公开可下载（9,903 字节）。**作者点名的 8 类交易全都有官方对应条目**（云空间的官方描述里直接写着 "cloud storage"）。
47. → **我们的交易分类直接对齐 PFC 16 primary + 中文显示名映射**，未来接任何真实数据源零转换成本。
48. **Monzo 的商户数据处理**：联网查商户 → **跨用户共享同一商户实体** → 查不到时显示不完整信息 → 交易详情里有「**Improve name, location or logo**」纠错入口。
49. ★ **原始串码是敌人**（"WM SUPERCENTER #1700 POWAY CAUS" → "Walmart"）；**数据缺失是常态，必须有「类别图标」兜底**。
50. ★ **simple-icons**（25,921★ / **CC0-1.0**）的 `{title, hex}` 就是「让商户头像自带品牌色」的现成答案（Netflix `E50914` / Spotify `1ED760` / Starbucks `006241` / Deliveroo `00CCBC`）。
51. ⚠️ **CC0 只覆盖仓库数据，不覆盖商标**；商标商用须遵守各品牌 guidelines（数据里有该字段）。**不要写成「可商用」。**
52. **真实工程实现样板**：`kharcha` 用扁平命名空间 **`ic_brand_<slug>.png`** 存 220 个商户 logo（Apache-2.0）。
53. ★ **「交易类别图标集」在 GitHub 上几乎是空的**（`transaction icons` / `category icons finance` 搜索均 0 条；`merchant logo` 最高 1★）——**没有现成的抄，也没有现成的对手**。
54. **建议的头像形状系统**：商户消费=圆、类别兜底=圆、收入=圆+收入色、**周期性/订阅=圆角方形**、转账给人=人物头像位、账户内部动作=品牌绿圆。
55. ★ **「订阅态用圆角方形」是零文字的分类手法** —— 一眼把「云空间/光影视频」从一堆消费里分出来，同构于 ZA「两种图标语言」那一招。
56. **配色三级优先**：商户品牌色 > 类别色 > 中性兜底；★ **类别色盘里必须不含红/绿**，把红绿留给金额信号。
57. **数据缺失三级降级**：商户名+logo → 商户名 → 类别名+类别图标 → **绝不允许出现原始串码**。
58. **头像规格**：桌面流水行 **40px**（上游实测 `mikechiloane/Banking-App-UI` 的 40×40 圆头像），移动 36–40px，行内徽标 16px，头像与文字间距 12px。
59. ⚠️ **不要把 ZA 首页的 54.9pt 圆盘抄到流水头像上** —— 那是快捷入口的尺寸，不是流水。
60. **我们的分类要从 6 类扩到 10–12 类**，并显式引入「**周期/订阅**」**标签**（`recurring: true`）——它跨越类别（房租/云空间/光影视频都是周期性的）。
61. **开源生态实测 16 仓**：`simple-icons` 25,921★ CC0 / `firefly-iii` 24,763★ AGPL / `ghostfolio` 9,368★ AGPL / `beancount` 6,038★ GPL-2.0 / `aaronfagan/svg-credit-card-payment-icons` 635★ Apache-2.0 / `picsou-finance` 516★ NOASSERTION。
62. ★ **结论：一个包都不用引。** 只抄 `{slug, hex}` 数据常量（20–40 条）与**组织方式/命名规范**。
63. **许可风险排序**：CC0 > MIT > Apache-2.0（注意 NOTICE）> MPL-2.0 > **GPL/AGPL 一律不用** > **NONE/NOASSERTION 默认不可用**。
64. **已归档、不要参考**：`muffinresearch/payment-icons`（706★ / 2021）、`omise/banks-logo`（224★ / 2024 归档）。
65. **P0 五件事**：失败文案改主动语态 → 撤销窗口扩展到所有执行动作 → 删多余阴影 → 分类对齐 PFC + 类别色不含红绿 → 商户头像用真实品牌色。
66. **P1 四件事**：订阅加 mandate 实体 → 限额升为一等对象 → 高危警示挂收款人且不给虚假安全感 → 理财先建投资账户对象。
67. **P2 三件事**：AI 入口与权限三级显式对标 AIR（并写明中风险档是我们的增量）→ 明确人工接管 → 沙箱写成「受限工具子集」。
68. **全篇最重要的三条**：**① Revolut 只给了两级权限，中风险档是我们的增量；② 订阅要有授权实体，不是流水聚合；③ 交易图标用「品牌色 + 商户 logo + 类别兜底」双轨制，订阅态用圆角方形。**
69. **最大的数据缺口**：AIR 帮助中心正文、AIR UI 截图、ZA/Revolut App 内动效数值、ZA 动態具体用 logo 还是类别图标 —— **全部未获取，本文未对其做任何断言**。
70. **方法学提醒**：`revolut.com` 及多家新闻站对本环境返回 403，**Wayback 快照是本轮唯一可行路径**；附录 C 的脚本可复现。
