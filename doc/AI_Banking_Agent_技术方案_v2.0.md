# 银行 AI 资金管家 技术方案 v2.0

> 日期：2026-09-19  
> 状态：开工设计候选，可用于接口评审和任务拆分，尚未实现或测试通过。  
> 需求依据：[PRD v2.0](PRD_银行AI资金管家_v2.0.md)；架构依据：[设计框架 v2.0](Agent设计框架_v2.0.md)。  
> 配套交互：[Web 原型与页面流程](Web低保真原型与页面流程_v2.0.md)；交付顺序：[开发任务与验收清单](开发任务与验收清单_v2.0.md)。

## 1 范围与本次技术决策

本版承接 Web、智能转账、订阅管理、账单分析、卡片管理、未来现金流预警、目标资金计划。交易运行在自建模拟银行中。旧 v1.3 中的 IM、理财快照、商城下单、所有调用统一塞入聊天接口的设计不再用于新实现。

采用一个主 Agent、模块化业务后端、持久化任务处理器和独立模拟银行服务。业务页面可以直接调用业务 API，AI 通过工具调用同一应用服务；二者均经过相同的数据访问控制和操作授权。

本次明确技术方案、对象及接口语义，不生成应用代码、安装依赖或部署服务。库的精确补丁版本在初始化时通过兼容性冒烟检查后写入锁文件；本文指定选型和主要版本约束，不冒称已经完成依赖解析。

### 1.1 技术栈

| 部分 | 选型 | 用途与取舍 |
|---|---|---|
| Web | React 19 + TypeScript + Vite | 客户端工作台；没有搜索引擎收录需求，首版不增加服务端页面渲染 |
| 前端构建运行时 | Node.js 22，最低 22.12 | 初始化时选择该版本线的适用补丁版本并锁定 |
| UI 与图表 | Ant Design、ECharts | 表格、表单、抽屉、确认弹窗与曲线；版本以 React 19 兼容检查为准 |
| 后端 | Python 3.12、FastAPI、Pydantic 2 | 类型校验、业务 API、OpenAPI；请求和响应模型独立 |
| 数据访问 | SQLAlchemy 2 + Alembic + psycopg 3 | 关系模型、事务和迁移；不依赖模型生成 SQL |
| 数据库 | PostgreSQL 16 | 业务状态、银行账本、任务、额度与并发控制；同一实例中隔离数据库角色及 schema |
| Agent 编排 | LangGraph + PostgreSQL checkpointer | 多轮理解、草稿规划、澄清恢复；银行交易状态由应用数据库负责 |
| 模型接入 | 服务端统一模型适配器 | 支持结构化工具调用的文本模型，具体供应商及模型 ID 用配置注入 |
| 长期任务 | 单独 worker 进程 + PostgreSQL 任务及 outbox 表 | 复用后端代码，扫描可执行任务和待发送事件；首版不增加 Redis、Kafka、Celery |
| 前后端同步 | HTTP 查询与写入 + 任务详情轮询 | 先完成可靠状态更新；消息流式输出为后续体验增强 |
| 测试 | pytest、Vitest、Playwright | 业务规则、组件和关键浏览器流程 |
| 本地交付 | Docker Compose | web、api、worker、bank-sim、postgres 五个服务；模型 API 可在外部 |

Vite 官方指南列出了 Node.js 20.19+、22.12+ 的运行要求，因此本方案采用 Node 22 的对应基线。[Vite 官方指南](https://vite.dev/guide/)

FastAPI 支持以 Pydantic 模型声明请求体及生成接口文档；本项目据此维护接口契约，联调时导出 OpenAPI 快照。[FastAPI 请求体文档](https://fastapi.tiangolo.com/tutorial/body/)

### 1.2 关键取舍记录

| 编号 | 决策 | 备选及原因 | 代价 |
|---|---|---|---|
| T01 | PostgreSQL 替换旧方案 SQLite | 需要跨会话额度锁、worker 抢占和并发分配验证；避免另维护两套并发语义 | 本地增加数据库容器 |
| T02 | 继续采用 LangGraph，但仅管理 Agent 流程 | 完全自写图执行器会增加对话恢复开发；把一切交给图状态会混淆授权与业务事实 | 维护图检查点和业务状态两种职责 |
| T03 | 独立 bank-sim 进程 | 同进程函数模拟难以充分覆盖请求超时和跨服务恢复 | 多一个内部服务与服务凭据 |
| T04 | 轮询任务状态 | P0 的吞吐有限，避免同时维护 WebSocket 重连和事件恢复 | 少量轮询开销；流式体验稍后增强 |
| T05 | HTTP 接口与 Agent 工具共用应用服务 | 分别写两套业务逻辑会造成权限和状态不一致 | 应用服务边界需要严格维护 |
| T06 | 模型 ID 为配置项 | 用户尚未指定可用账号及模型；不编造访问权限 | 实时 AI 验收需配置模型；可先用显式回放模式联调 |

以上决策为本版建议基线。变更时记录原因，并同步本文、接口契约和验收样例。

## 2 服务边界与目录

```text
浏览器 ──同源 /api── API 应用 ──内部 HTTP── bank-sim
                         │                       │
                         ├── 主 Agent → 模型 API │
                         ├── 业务/授权/预测/目标   └── bank schema
                         └── app + agent schemas
                                      ↑
                                  worker
                          到期检查、执行、核查、通知
```

建议目录为后续待创建的结构，本次不创建这些代码文件：

```text
apps/web/src/
  pages/                 七个主页面及演示视图
  features/              transfer、subscription、bill、card、cashflow、goal
  components/            AiPanel、OperationReview、VerificationDialog、TaskStatus
  api/                   OpenAPI 生成类型、统一请求、查询缓存
services/api/app/
  api/                   HTTP 路由；不在路由内实现记账和权限规则
  contracts/             请求、响应、工具、事件的数据模型
  application/           共用查询、草稿、确认、执行及结果查询服务
  agent/                 graph、nodes、model_adapter、context、tools
  security/              身份、对象归属、策略、确认、验证、额度、幂等
  domains/               bills、subscriptions、cards、cashflow、goals
  integrations/          bank_client；仅此处持有模拟银行调用能力
  persistence/           模型、事务、仓储
  jobs/                  worker、执行、定时器、对账、outbox
services/bank_sim/
  accounts、ledger、cards、mandates、idempotency、faults
fixtures/                固定场景、历史流水、预期结果
tests/                   unit、integration、contract、e2e、security
docs/                    接口快照、变更记录、部署说明
```

浏览器不访问模拟银行；模型不访问数据库，也不调用内部 bank-sim HTTP 接口。数据库角色限制 api/worker 写 app schema、bank-sim 写 bank schema；agent 检查点使用独立命名空间。

## 3 通用数据契约

### 3.1 金额、日期与标识

- 仅人民币，金额统一为整数分：`amount_minor=200000` 表示 2000.00 元，币种为 `CNY`。数据库用 BIGINT，不用浮点数记账。
- 写入金额限制为正整数，单笔上限设为演示策略 `100000000` 分；负数用于预测内部差额与账本方向，不用于转账请求。所有汇总限制在 JavaScript 安全整数范围内。
- 时间点使用带时区的 ISO 8601；存储 UTC。业务日期和日累计使用 Asia/Shanghai。
- `business_now` 来自场景演示时钟；登录有效期、验证失效和 worker 租约使用真实服务端时间，避免快进演示时钟破坏安全状态。
- ID 为服务端生成的不透明字符串；本文可读 ID 仅为样例。所有业务对象具有 `scenario_id`、`user_id`，身份从会话推导，不采信客户端或模型传入的用户归属。
- 可编辑对象包含递增的 `revision`；PATCH 和确认请求必须携带预期版本。参数改变后生成新版本并使旧授权失效。

### 3.2 响应格式

成功响应外层为 `request_id、data、meta`。`meta` 至少含 `mock=true、business_now、real_server_time、scenario_id`；读银行数据时还包含 `snapshot_version、as_of`。列表统一返回 `items、next_cursor`，默认 20 条、最多 100 条。

失败响应为 `request_id、error、meta`；`error` 包含 `code、message、retryable、field_errors、related_operation_id`。不向用户显示堆栈或模型提示词。

| HTTP | 业务码示例 | 处理规则 |
|---|---|---|
| 401 | SESSION_EXPIRED | 恢复登录，不重放写操作 |
| 403 | ACTION_FORBIDDEN、CSRF_FAILED | 显示无权限，停止请求 |
| 404 | RESOURCE_NOT_FOUND | 未找到或不属于当前用户的业务对象统一返回 404 |
| 409 | REVISION_CONFLICT、IDEMPOTENCY_CONFLICT、ALLOCATION_CONFLICT | 拉取最新版本；同幂等键不同载荷不得重用 |
| 422 | VALIDATION_ERROR、RECIPIENT_AMBIGUOUS、INVALID_STATE | 标出问题字段或可执行动作 |
| 429 | RATE_LIMITED | 显示等待时间，禁止客户端循环重试 |
| 503 | MODEL_UNAVAILABLE、BANK_UNAVAILABLE、STORAGE_UNAVAILABLE | 给出降级入口；是否已提交银行须另看 operation 状态 |

转账被银行明确拒绝是 operation 的 `FAILED` 状态；请求超时后是否扣款未知是 `UNKNOWN` 状态。查询这类已存在对象返回 200，不把 HTTP 200 解读为转账成功。

### 3.3 核心对象

| 对象 | 必需字段及语义 |
|---|---|
| AccountView | id、name、masked_number、available_minor、currency、state、snapshot_version、as_of |
| FieldEvidence | value、source(USER/CONTEXT/HISTORY/TOOL)、resolution(EXACT/AMBIGUOUS/MISSING)、confirmed_revision、evidence_ref |
| Operation | id、type、revision、params、params_hash、status、risk_level、risk_reason、required_fields、next_actions、confirmation_expires_at、execution_key、result、error |
| Confirmation | operation_id、revision、params_hash、policy_version、confirmed_at、expires_at；全部由服务端核对并保存 |
| Task | id、plan_id、plan_revision、type、state、depends_on、trigger、due_at、deadline_at、operation_id、next_actions、pause_reason |
| Forecast | id、scenario_mode、account_scope、source_version、assumptions_revision、generated_at、days、minimum、missing_inputs、evidence、stale |
| Goal | id、revision、title、target_minor、target_date、priority、buffer_minor、funding_account_ids、state、allocated_minor、funded_minor、tasks |
| ChatResult | conversation_id、message_id、run_status、reply、cards、suggested_actions、linked_resources、mode(LIVE/REPLAY) |

`reply` 可以解释事实；确认卡和金额卡必须由结构化字段渲染。`next_actions` 为服务端提供的有限动作枚举，前端不根据一句模型话术猜测是否能执行。

## 4 关系数据模型

以下表为待实现模型，PK 默认 UUID。所有用户业务表以 `(scenario_id,user_id)` 隔离；外键及唯一约束需同时保证场景归属，不允许只凭另一个用户的 ID 建立关联。创建和更新时间用真实服务端时间，业务发生时间另列。

### 4.1 模拟银行 bank schema

| 表 | 主要字段 | 约束与索引 |
|---|---|---|
| customers | id、scenario_id、app_user_ref | 每场景用户映射唯一 |
| accounts | id、customer_id、type、available_minor、state、version | 余额不得负值；并发借贷锁账户；系统清算账户独立标记 |
| ledger_entries | id、transaction_id、account_id、signed_minor、entry_type、posted_at、linked_event_id | 不可修改已入账流水；同一交易借贷合计为零 |
| transactions | id、execution_key、payload_hash、source_account_id、destination_ref、amount_minor、state、business_at、receipt | execution_key 唯一；交易、账本、余额更新同一数据库事务提交 |
| cards | id、account_id、masked_number、state、capabilities、version | 卡号展示脱敏；状态操作锁行 |
| mandates | id、account_id、merchant_ref、amount_minor、next_due_date、state、effective_at、cancel_mode、version | capability 明确 BANK_MANDATE/MERCHANT_SERVICE/NONE |
| obligations | id、account_id、kind、amount_minor、due_date、status、origin_ref、settled_transaction_id | source 去重；还款已入账后不能继续预测同一应付款 |
| requests | execution_key、type、payload_hash、state、result、accepted_at、completed_at | 所有写入类型均幂等，不只转账；存在终态则返回原结果 |

外部收款用系统清算账户承接对方分录，当前用户不可读取其余额或其他交易。本人互转两端属于同一用户；房租付款的收款人可以是外部模拟联系人。

### 4.2 应用 app schema

| 表 | 主要字段 | 约束与索引 |
|---|---|---|
| users / sessions | demo_profile、role；session_token_hash、user_id、scenario_id、expires_at、csrf_hash | 会话 token 不以明文落日志；场景成员关系由服务端确定 |
| scenarios | id、owner_user_id、fixture_name、business_now、epoch、version | 重置仅作用当前场景；epoch 防止旧事件重放 |
| contacts | id、name、alias、phone_masked、bank_recipient_ref、verified | 同名允许，账户解析必须唯一 |
| conversations / messages | conversation_id、role、content_redacted、resource_refs、client_message_id | 每会话 client_message_id 唯一；对话不保存验证码 |
| operations | type、revision、params_json、params_hash、status、risk、policy_version、execution_key、result_json、real_expires_at | operation 与 execution_key 唯一关联；状态变更锁行 |
| confirmations | operation_id、revision、params_hash、scope、actor_session_id、expires_at、consumed_at | 同版本有效批准唯一；旧版本批准不能挪用；注销未消费会话授权可定位 |
| verification_challenges | operation_id、revision、challenge_hash、expires_at、attempts、status | 验证单次使用，3 次失败锁定当前挑战 |
| idempotency_requests | user_scope、route、key、payload_hash、resource_id | 联合唯一；同键不同参数返回冲突 |
| quota_days | user_scope、business_date、spent_minor、reserved_minor | 用户日期唯一；执行前锁行 |
| execution_reservations | operation_id、source_account_id、amount_minor、quota_date、state | 每操作唯一；未知结果保持占用；记录真实创建时间 |
| transaction_annotations | bank_transaction_id、category、user_corrected、revision | 只改分析标签，不改银行原交易 |
| subscription_candidates | merchant_ref、transaction_refs、cadence、estimated_amount_minor、estimated_due、state | evidence_refs 必须存在；匹配协议后统一 origin_ref |
| subscription_snapshots | bank_mandate_id、authorized_query_operation_id、facts_json、as_of、source_version | 仅经过确认的协议查询填充；权限撤销或场景重置后失效 |
| reminder_preferences | target_type、target_id、lead_days、enabled、revision | 用户对象唯一；P0 lead_days 允许 0/1/3/7 |
| assumptions | type、account_id、amount_minor、date_rule、source、evidence_refs、revision | 工资预期、日常预算等与银行事实分表 |
| forecasts | input_fingerprint、source_version、assumption_revision、mode、payload_json、stale | 同输入可复用；所有金额附来源 |
| goals / plan_versions | 目标字段；goal_id、revision、constraints_json、steps_json、status | 活跃计划版本唯一；批准后内容不可原地覆盖 |
| allocation_pools / allocations | account_id、version；goal_id、account_id、amount_minor、kind、transfer_id、state | 同账户分配锁池；计划分配和已存入不可重复计额 |
| tasks / task_dependencies | revision、plan_revision、trigger_json、deadline、state、operation_id、lease_owner、lease_until；task_id、depends_on | 依赖无环；任务与当前操作关联；租约可回收 |
| outbox / consumed_events | event_id、type、entity_ref、payload、attempts、next_at；consumer、event_id | 写状态与 outbox 同事务；消费者事件唯一 |
| notifications | event_key、severity、title、resource_ref、read_at | 当前用户 event_key 唯一，状态未变不重复提醒 |
| audit_records | request_id、operation_id、actor、action、before_hash、after_hash、decision、result、timestamp | 应用账号仅追加和查询，展示脱敏；不宣称物理不可篡改 |

LangGraph 检查点使用其 PostgreSQL saver 管理的 agent schema，不自行复刻框架内部表。会话归属先由 app 检查，再使用服务器映射出的图 thread_id。检查点只用于流程恢复，不是银行余额和授权事实来源。

## 5 HTTP API 契约

公共前缀 `/api/v1`。以下 `{id}` 均指服务端对象 ID；写请求需 CSRF 校验，创建与动作 POST 需 `Idempotency-Key`，修改需 revision。未声明字段禁止额外传入，避免偷偷传 `verified=true` 或其他用户标识。

### 5.1 身份、首页与对话

| 方法与路径 | 输入 | 输出及行为 |
|---|---|---|
| POST /demo/sessions | profile_key、fixture_name | 服务端生成独立场景与会话 Cookie；仅 demo 开关开启时可用，profiles 不由请求自选管理员角色 |
| DELETE /session | 无 | 注销会话、失效该会话未消费确认，保留业务历史 |
| GET /session | 无 | 当前用户、角色、场景、CSRF token、时钟 |
| GET /dashboard | 无 | accounts、cashflow_summary 或未生成状态、upcoming、pending_tasks、goal_summaries |
| POST /conversations | 无 | conversation_id |
| POST /conversations/{id}/messages | client_message_id、text、context_refs | ChatResult；异步时返回 202 和 message_id |
| GET /conversations/{id}/messages | cursor | 消息列表及每条 run_status，供中断和轮询恢复 |

会话 Cookie 使用 HttpOnly、SameSite=Lax；正式非本机访问启用 HTTPS 与 Secure。浏览器与 API 同源；写入检查 Origin 和 CSRF token。演示 profile 只能访问新建或所属场景，不暴露全局“切换成另一真实用户”能力。

### 5.2 查询和轻量设置

| 方法与路径 | 输入 | 输出及行为 |
|---|---|---|
| GET /accounts | 无 | AccountView 列表 |
| GET /contacts | query | 脱敏候选及绑定状态，不做公众手机号反查 |
| GET /transactions | account_id、from、to、category、cursor | 交易明细、关联退款和转账标识 |
| PATCH /transactions/{id}/annotation | revision、category | 更新分类标签；显式用户动作即为本次设置授权，不产生银行写入 |
| GET /bills/summary | from、to、compare_from、compare_to | 总额、分类、差异、异常候选、数据覆盖范围 |
| GET /subscription-candidates | 无 | 仅历史流水推测，不越过黄色权限读取新协议 |
| GET /subscriptions | 无 | 之前授权查询的有效协议快照及 as_of；没有快照则需确认查询，不能后台自动代查 |
| PATCH /subscription-candidates/{id} | revision、state、cadence、amount_minor、due_date | 用户确认或纠正候选，不终止任何协议 |
| PATCH /reminders/{target_type}/{target_id} | revision、enabled、lead_days | 保存站内提醒偏好，记录操作；不承诺短信送达 |
| GET /cards | 无 | 状态、可用操作和关联账户 |
| GET /cards/{id}/impact | action | 操作影响及已知关联任务；只读试算 |
| GET /notifications | cursor、unread_only | 站内通知 |
| PATCH /notifications/{id} | read=true | 标记已读 |

协议明细实际刷新使用 `subscription.inspect` 操作，由用户确认。预测可复用已合法读取的协议快照，但必须显示时间；没有快照则只使用账单候选并标明不确定，不能通过预测接口绕过查询权限。

### 5.3 统一操作接口

| 方法与路径 | 输入 | 输出及行为 |
|---|---|---|
| POST /operations | type、params、context_refs | Operation 草稿，解析字段及预判风险；不扣款 |
| GET /operations/{id} | 无 | 当前 Operation；所有状态以此为准 |
| PATCH /operations/{id} | revision、params | 仅未提交银行时允许；更新版本，清除确认和挑战 |
| POST /operations/{id}/preview | revision | 可确认摘要、风险原因、最新影响试算；不创建交易 |
| POST /operations/{id}/confirm | revision、params_hash | 记录批准；黄色进入 READY，红色进入 AWAITING_VERIFICATION；随后由 worker 执行 |
| POST /operations/{id}/verification | revision | 返回 challenge_id、过期时间及显式模拟验证码显示区；不发送短信 |
| POST /operations/{id}/verify | revision、challenge_id、code | 校验成功后 READY；凭证不进入模型或普通日志 |
| POST /operations/{id}/cancel | revision | 仅未提交状态可取消；EXECUTING/UNKNOWN 返回冲突，保持核查 |
| POST /operations/{id}/reconcile | 无 | 为原操作触发结果查询任务，不提交新的银行操作 |

`params_hash` 来自服务端规范化字段摘要，客户端只回传；服务端重算并与当前版本比较。确认后风险升级时返回需要新确认/验证的状态；不会把预判风险当作永久许可。

| type | 必填 params | 可选 params | 操作含义 |
|---|---|---|---|
| transfer.create | source_account_id、recipient_ref、amount_minor | memo、goal_id、task_id | 立即模拟转账；本人账户以 recipient_ref 指向经校验账户 |
| schedule.create | source_account_id、recipient_ref、amount_minor、due_at、deadline_at | memo、goal_id | 保存到期确认式任务；黄色元数据操作，不提前批准未来扣款 |
| subscription.inspect | scope=owned_accounts | account_ids | 确认后读取模拟协议并建立快照 |
| subscription.cancel | subscription_id、cancel_mode | 无 | 按实际能力终止银行代扣或取消商户服务，二者不能互换 |
| card.freeze / card.unfreeze / card.report_lost | card_id | reason | 处理具体卡片状态 |
| goal.activate | goal_id、goal_revision、proposal_id | 无 | 保存选定方案、分配与任务，不自动执行其中转账 |

### 5.4 预测、目标和任务

| 方法与路径 | 输入 | 输出及行为 |
|---|---|---|
| GET /assumptions | 无 | 当前假设及 revision |
| PUT /assumptions | revision、income_events、daily_budgets、buffer_minor | 用户显式保存假设；重算相关计划，不代表收入到账 |
| POST /forecasts | account_ids、start_date、horizon_days=30、mode、assumptions_revision、hypothetical_events | Forecast；假设操作只保存在试算中 |
| GET /forecasts/{id} | 无 | 原结果及 stale 标志 |
| POST /goals | title、target_minor、target_date、funding_account_ids、buffer_minor、priority | Goal 草稿，不分配资金、不创建执行任务 |
| GET /goals | state、cursor | 目标摘要 |
| GET /goals/{id} | 无 | 目标、当前计划、资金分配、任务 |
| PATCH /goals/{id} | revision、允许修改的目标字段 | 草稿直接更新；活跃目标生成新候选版本，暂停受影响未执行任务，旧已执行回执保留 |
| POST /goals/{id}/proposals | revision、forecast_id | 两种候选方案或不可行说明；proposal_id 与输入版本绑定 |
| POST /goals/{id}/pause | revision | 暂停未执行任务，已提交部分继续核查；目标资金分配保留 |
| POST /goals/{id}/resume | revision | 重新计算，条件变化则 NEEDS_REPLAN，不自动动钱 |
| POST /goals/{id}/close | revision、reason | 释放剩余计划分配，取消未提交任务；已存资金仍在银行账户 |
| GET /tasks | state、goal_id、cursor | Task 列表 |
| GET /tasks/{id} | 无 | 依赖、触发条件、当前 operation 及历史记录 |
| POST /tasks/{id}/cancel | revision | 仅可取消未提交步骤，目标与任务状态一起校验 |
| GET /audit | resource_type、resource_id、cursor | 仅当前用户脱敏记录；演示管理员范围由权限明确限定 |

有效修改更新 `revision` 并使相关缓存过期。重算方案不会直接覆盖用户已批准的参数，必须通过新的 goal.activate 和逐笔操作授权。

请求中几个嵌套结构统一如下，禁止前后端各自起字段名：

| 结构 | 字段定义 |
|---|---|
| income_events[] | id、account_id、expected_at、amount_minor、label、source(USER/HISTORY)、evidence_refs；新增 id 由服务端生成 |
| daily_budgets[] | account_id、from_date、to_date、total_minor、distribution=UNIFORM；日期不可与同账户同类预算重叠 |
| hypothetical_events[] | kind=PAYMENT/OWN_TRANSFER、at、amount_minor、source_account_id、destination_account_id（互转必需）；不允许原始 SQL 或工具指令 |
| Forecast.days[] | date、account_balances、combined_balance_minor、unallocated_minor、conservative_intraday_low_minor、event_refs |
| Forecast.evidence[] | ref、source_type、resource_id、label、amount_minor、at、certainty=KNOWN/ESTIMATED、as_of |
| Proposal | id、goal_id、goal_revision、forecast_id、input_fingerprint、strategy=KEEP_AMOUNT/KEEP_DATE、feasible、target_minor、target_date、shortfall_minor、conditions、steps |
| Proposal.steps[] | step_id、kind=TRANSFER/REMINDER、params、depends_on、trigger、deadline_at；依赖节点必须存在且无环 |
| Task.trigger | kind=AT_TIME/BANK_CREDIT_POSTED、not_before、account_id（入账条件必需）、minimum_credit_minor、expected_origin；只由规则服务解析 |

工资到账条件不能简单匹配“账户有一笔收入”：需由模拟银行事实满足账户、来源、日期窗口和最小金额条件，再复核余额及计划约束。未能核实来源时暂停并请求用户重新规划，不将假设本身当触发事件。

首次创建分类标签或提醒设置允许 `revision=0`，只有对象确实不存在时成功；随后按返回版本修改。用户纠正候选周期支出后，仍需合法协议查询才能获得“已核实协议”身份。

### 5.5 演示控制

`POST /demo/clock/advance` 接收目标业务时间，`POST /demo/faults` 设置下一次指定操作的故障，`POST /demo/reset` 接收当前场景版本与明确重置确认。均要求 demo 开关和当前场景拥有者的演示权限，不注册到模型工具集。

时钟只可前进；存在 EXECUTING/UNKNOWN 交易时拒绝快进和重置，先核查，防止跨日累计混乱。重置新建场景 epoch、失效旧会话授权及事件。历史原始 fixture 保留，实际运行副本可重新生成。

## 6 API 完整样例

以下 JSON 为接口契约样例，不是应用实现。省略外层 meta 时沿用第 3 节；创建请求头附带新 Idempotency-Key。

创建转账草稿：

```json
{
  "type": "transfer.create",
  "params": {
    "source_account_id": "acc_salary",
    "recipient_ref": "own:acc_savings",
    "amount_minor": 200000,
    "memo": "电脑目标首笔"
  },
  "context_refs": []
}
```

服务端返回的关键对象：

```json
{
  "id": "op_01",
  "type": "transfer.create",
  "revision": 1,
  "status": "AWAITING_CONFIRMATION",
  "risk_level": "RED",
  "risk_reason": "本笔2000元，当日累计将超过1000元",
  "params_hash": "server-generated-hash",
  "required_fields": [],
  "next_actions": ["CONFIRM", "EDIT", "CANCEL"],
  "result": null
}
```

确认体为 `{"revision":1,"params_hash":"server-generated-hash"}`。服务端返回 AWAITING_VERIFICATION；创建模拟挑战并核验后进入 READY，由 worker 提交。成功对象的 `result` 包含 `bank_transaction_id、receipt_no、amount_minor、completed_at、source_balance_minor=700000、destination_balance_minor=200000`。

若银行已扣款但返回链路中断，Operation 为 UNKNOWN、result 为空，next_actions 只提供 VIEW/RECONCILE。状态核查得到原回执后改为 SUCCEEDED，不能凭成功话术补造回执。

现金流输出片段：

```json
{
  "id": "forecast_01",
  "scenario_mode": "EXPECTED",
  "account_scope": ["acc_salary", "acc_savings"],
  "source_version": "fixture-A:epoch-1:v1",
  "assumptions_revision": 1,
  "minimum": {"date": "2026-10-09", "balance_minor": 280000},
  "hypothetical_minimum": {"date": "2026-10-09", "balance_minor": -320000},
  "missing_inputs": [],
  "stale": false
}
```

此样例只表示既定未来事件下的结果，完整 API 还需返回 days 和 evidence。以银行真实快照为起点，假设支出不得写入银行表。

## 7 Agent 运行时与工具契约

### 7.1 图节点

```text
身份及上下文校验 → understand → resolve_fields
                                 ├─ 关键歧义 → clarify → 保存检查点
                                 └─ 完整 → route
                                            ├─ 查询 → 受控查询工具
                                            ├─ 单笔操作 → 创建 operation 草稿
                                            └─ 目标 → 生成候选 → 引擎校验 → 计划草稿
                                                         ↓
                                            结构化卡片 + 说明 → 保存检查点
```

用户确认走操作接口，不由模型识别一句“确认”就直接动钱。对话收到用户“确认”时，返回对应确认卡；前端按钮发送绑定对象版本的确认请求。业务服务改变状态后，Agent 如需说明进度，仅读取该状态。

AgentState 保存 conversation_id、message_id、intent、field_evidence、resource_refs、draft_operation_ids、goal_id、plan_revision、needs 和 step_count。会话的用户归属保存在可信执行上下文；模型生成字段中不接受 user_id、risk_level、verified 或银行执行状态。

LangGraph 支持检查点保存和中断恢复，本版使用 PostgreSQL 持久化，不用内存 saver 承担重启恢复。[LangGraph 持久化文档](https://docs.langchain.com/oss/python/langgraph/persistence)

恢复中断会重新运行中断所在节点之前的部分逻辑，因此不在中断节点前放无幂等保护的银行写入。本设计将银行执行移到 operation worker，图内草稿创建也使用稳定幂等键。[LangGraph 中断文档](https://docs.langchain.com/oss/python/langgraph/interrupts)

### 7.2 工具注册清单

每个工具声明名称、参数模型、访问范围、是否有业务副作用、超时、结果模型。LLM 只看到按权限筛选后的清单。模型传入未知名称、未知字段或不归属用户的对象时，应用服务拒绝。

| 工具 | 输入 | 输出 | 副作用及限制 |
|---|---|---|---|
| account.list | 无 | AccountView[] | 只读本人范围 |
| contact.search | query | 候选联系人 | 只读，最多 10 项脱敏结果 |
| bill.analyze | 日期区间、账户、对比范围 | 统计与 evidence_refs | 只读，不直接生成银行数字 |
| bill.transactions | 筛选条件、cursor | 交易列表 | 只读，限制返回条数 |
| subscription.candidates | 无 | 候选和已合法查询快照摘要 | 不刷新受确认保护的协议 |
| card.list / card.impact | card_id、action（impact 用） | 状态或影响 | 只读 |
| cashflow.simulate | 账户、假设版本、情景、假设事件 | Forecast | 仅保存可追溯试算，不改账本 |
| goal.propose | 目标草稿、forecast_id | 带 goal_id 的草稿、方案及不可行原因 | 可以幂等保存 DRAFT 目标；激活分配与任务须用户显式操作 |
| operation.prepare | type、params、context_refs | Operation | 只创建或修订未执行草稿，不能批准或验证 |
| goal.get / task.get | 对象 ID | 当前状态 | 只读，不能直接修改执行状态 |

没有 `bank.transfer`、`verify`、`confirm`、`clock.advance` 等直接执行工具。模型的工具列表即使被恶意诱导，也只能请求应用服务允许的能力。

统一 ToolResult 为 `ok、data、error、evidence_refs、as_of、mock`。数据结构校验和数据权限校验都要执行；schema 合法不等于内容可信或已经授权。

### 7.3 限制与模型可替换

单轮最多 4 次模型调用、12 个工具调用，目标方案最多 12 个步骤；超限返回可以继续编辑的当前草稿，不无限递归。单次模型调用默认 30 秒超时，schema 修复重试最多 1 次，整体请求超过 60 秒改为可查询的后台状态或明确失败。

模型适配器实现结构化请求、结果校验、用量和错误记录。未知模型能力需在首阶段验证；不能通过解析任意长文本直接获得转账授权。

`LIVE` 模式使用用户配置的模型账号；`REPLAY` 模式返回固定场景的已标注意图和工具计划，页面醒目标注“回放模式”，用于无外网联调。回放通过不能替代实时模型的意图测试，最终演示材料需说明实际模式。

## 8 状态机与授权协议

### 8.1 Operation 状态

| 当前状态 | 触发 | 目标状态 | 关键限制 |
|---|---|---|---|
| DRAFT | 服务端解析 | NEEDS_INPUT / AWAITING_CONFIRMATION | 缺少唯一收款对象不能确认 |
| NEEDS_INPUT | 补齐参数 | AWAITING_CONFIRMATION | 生成新 revision |
| AWAITING_CONFIRMATION | 用户确认当前版本 | READY / AWAITING_VERIFICATION | 红色必须强验证，确认绑定 hash 和有效期 |
| AWAITING_VERIFICATION | 挑战验证成功 | READY | 错误不转 READY；挑战过期需重新创建 |
| READY | worker 完成最终校验并取得执行权 | EXECUTING | 风险升级回待确认/待验证；余额或对象状态不允许则 FAILED |
| EXECUTING | 明确结果 | SUCCEEDED / FAILED | 银行回执为准 |
| EXECUTING | 超时或进程中断后无法确定结果 | UNKNOWN | 不开放新参数修改，不直接重转 |
| UNKNOWN | 查询原执行键 | SUCCEEDED / FAILED / UNKNOWN | 原请求缺失也不立刻换键重发，遵循第 9 节协议 |
| 未提交状态 | 用户取消、授权过期 | CANCELLED / EXPIRED | 释放尚未提交的占用；已提交交易不能用本地取消终止 |

状态是操作事实，revision 是业务参数版本。重复相同确认事件返回现状，不增加 revision。修改参数只在未提交状态允许，会使旧确认、验证及预判结果失效。

P0 确认有效期 5 分钟、验证挑战 2 分钟、验证码错误最多 3 次。均按真实服务端时间计算。这些是演示默认值，可由策略配置，不能冒称监管规定。最终提交前再次核对有效期、账户状态和累计金额。

### 8.2 长期 Task 与 Goal 状态

Task 状态为 DRAFT、WAITING_TRIGGER、WAITING_USER、RUNNING、UNKNOWN、SUCCEEDED、FAILED、PAUSED、CANCELLED、EXPIRED。其关联 operation 是交易事实来源：operation READY/EXECUTING 对应任务 RUNNING，UNKNOWN 对应 UNKNOWN，终态同步到任务。

WAITING_TRIGGER 只表示时间或条件未满足，无有效资金执行授权。条件满足后创建当前参数版本的 operation，任务进入 WAITING_USER。用户未确认则继续等待，超过 deadline_at 变 EXPIRED。

Goal 状态为 DRAFT、ACTIVE、NEEDS_REPLAN、PAUSED、FUNDED、CLOSED。目标数值改变创建新计划版本；已成功任务保留为历史，新计划必须扣除已有资金。暂停保留资金分配，关闭释放计划分配但不转回已存资金。

### 8.3 权限矩阵

| 动作 | 级别 | 额外条件 |
|---|---|---|
| 本人余额、账单、卡片查询及试算 | GREEN | 用户范围和对象归属检查 |
| 分类、提醒、假设、目标草稿编辑 | 显式设置写入 | 已登录、CSRF、revision；按钮提交即授权本次设置，不是银行操作 |
| transfer.create | YELLOW 或 RED | 预计当日累计不超过 100000 分为黄色，超过则红色；本人互转也纳入 |
| subscription.inspect / cancel | YELLOW | 查询或取消范围明确；取消检查 capability |
| card.freeze | YELLOW | 卡片为 ACTIVE |
| card.unfreeze / report_lost | RED | 解冻仅接受 FROZEN；挂失规则见 bank-sim 定义 |
| schedule.create / goal.activate | YELLOW | 只保存任务或计划；未来转账独立授权 |
| 演示时钟、重置、故障注入 | 演示管理权限 | 只作用当前独立场景；不给 Agent 授权能力 |

## 9 幂等、额度与异常恢复

### 9.1 转账提交协议

1. 草稿取得稳定 operation_id；execution_key 由操作及参数版本确定，提交银行后不允许换键。
2. 用户批准及验证完成后，worker 用短事务锁 operation、用户当天额度行和资金占用记录，重新检查版本、有效期、风险及已用额度。
3. 额度计算包含当日成功金额和已提交占用；超过 1000 元而没有适用强验证时返回待验证，不进行银行调用。
4. 原子写入额度占用、执行意图及审计/outbox，提交事务。短事务内不等待模型或银行网络响应。
5. 调用 bank-sim，带 execution_key、规范化载荷 hash 和可信用户映射。bank-sim 锁定请求记录及账户，核对余额，在同一事务中完成记账、余额和终态回执。
6. 应用收到成功回执后，用事务更新 Operation、将占用改为已用、写入事件及审计。明确失败则释放占用；网络不明则 UNKNOWN，保留占用。
7. 如果应用在第 5 步之后崩溃，恢复后先查 bank-sim 原 execution_key，再补齐第 6 步。不得把客户端再次点击转换成第二个 bank-sim 请求键。

多个 worker 按固定的用户、operation、账户 ID 排序获取相关锁，避免锁顺序混乱。额度行首次创建用唯一约束处理竞争，不能用“先查没有再各自插入”规避并发检查。具体事务必须在 PostgreSQL 环境下测试；官方文档说明了行锁的阻塞和释放语义。[PostgreSQL 显式锁文档](https://www.postgresql.org/docs/current/explicit-locking.html)

### 9.2 未知结果与跨日

bank-sim 提供 `GET /internal/requests/{execution_key}`。有明确终态就同步；仍处理中继续轮询。响应“没有该请求”只说明本次查询时未见已提交记录，不能保证旧 HTTP 请求永远不会到达。

模拟服务额外提供幂等的 `POST /internal/requests/{execution_key}/resolve`：以该键串行化，与原请求互斥；若尚未接受则写入永久 CANCELLED 墓碑，后续迟到提交返回拒绝；若已接受则返回原状态。应用收到明确取消或失败后才释放占用，用户若仍需办理，创建新的已确认操作。

UNKNOWN 期间阻止同一付款账户继续发起新转账，并明确说明需要先核查。该策略牺牲短期可用性，简化比赛版本的资金重复占用风险。跨日后，旧占用仍附原 quota_date，不通过“清零计数器”消失；按原日期结算，未核实账户继续阻断。

### 9.3 worker 与事件

worker 每秒检查 READY 操作、到期任务和 outbox。使用 `FOR UPDATE SKIP LOCKED` 获取一批可处理记录，记录真实时间租约；短事务抢占后再执行外部请求。租约建议 30 秒，长操作续租，失联可回收；回收银行提交任务先核查结果。SKIP LOCKED 仅用于队列抢占，不用于资金余额计算。[PostgreSQL SELECT 文档](https://www.postgresql.org/docs/16/sql-select.html)

业务状态及 outbox 同事务提交；消费者以 `(consumer,event_id)` 去重。事件只包含必要标识与版本：TransactionSettled、MandateChanged、CardStateChanged、ForecastInvalidated、GoalChanged、TaskDue。重算时检查源版本，新结果不能被迟到旧事件覆盖。

只读调用可按 1、2、4 秒退避重试，默认最多 3 次。银行写入不使用通用 HTTP 自动重试；由执行键协议处理。回执核查可退避至 30 秒，仍无结果时保留 UNKNOWN 并提示演示管理员检查；管理员不得直接把未知改为成功。

## 10 六个模块的实现规则

### 10.1 账单分析与订阅识别

分类先用明确商户规则与用户标签，无法识别归“待分类”，模型可以给出候选解释，不能修改原流水。比较未结束月份时默认对齐已过天数。相同样例应产出相同金额，文字说明允许不同。

异常候选 P0 使用可解释规则：同商户历史有效样本至少 3 笔，金额达到历史中位数 2 倍且绝对增加至少 100 元，或 10 分钟内同账户、商户、金额出现至少 2 笔，分别标为“金额变化”“疑似重复”。不据此认定诈骗。

周期扣费候选 P0：同商户至少 3 次已入账支出；连续间隔 25–35 天且金额在中位数 ±10% 内，提出月度候选。用户可纠正。房租和还款可被识别为周期支出，但只有核实服务或协议关系后才被呈现为可取消订阅。

已核实协议、周期候选和实际银行账单通过 origin_ref 去重；优先使用更明确来源。取消成功按 effective_at 移除未来扣费；退款、合同欠费、已完成扣款均不因取消自动消失。

### 10.2 卡片规则

bank-sim 状态采用 ACTIVE、FROZEN、LOST。ACTIVE 可冻结或挂失；FROZEN 可强验证解冻或挂失；LOST 不提供一键解挂，申请解挂返回 UNSUPPORTED_ACTION。

明确模拟业务限制：卡级消费要求 ACTIVE；账户级网银转账不因卡冻结自动失败；卡绑定的模拟订阅扣费在 FROZEN/LOST 时失败，纯账户代扣不受卡片状态影响。卡片影响接口据此列出任务，不把冻结表述为账户全停。

### 10.3 未来现金流

预测范围为 start_date 起 30 天。输入以同一银行快照时点为起点，仅纳入时点之后、尚未结算的事件。实际交易已经包含在余额中，不能再作为未来事件重复扣减。

逐日逻辑：期初可用余额 + 截至当日的纳入流入 − 截至当日的纳入流出。除日终余额外返回日内保守低点：同日顺序未知时先扣已知支出再加预计流入，UI 标注此为保守假设。

EXPECTED 纳入用户确认的预计收入；CONSERVATIVE 排除尚未到账收入。两者均包含已知支出及用户日常预算，均不输出概率置信度。人工收入在到账前仍是 estimated。

生活预算按日期分配整数分，分配后余额由最后一天补齐舍入差。缺失日期的预算不静默当作零，返回 missing_inputs；主演示 fixture 为所有 30 天明确给定预算。自动生成预算候选须剔除已单独建事件的房租、还款和订阅，避免双算。

个人账户互转在单账户分别计算，在合并账户净额为零。预测的 bank_balance 与 unallocated_balance 分开：前者不扣虚拟分配，后者扣仍有效且未重复反映的目标归属。同一目标同一笔资金从“软分配”迁移到“已转入分配”，不得两条同时相加。

对拟议支出进行 what-if 时，返回原预测和新预测。计划约束不足会阻止该目标方案被批准；一般转账的未来缺口属于提示，用户可以明确接受后继续，但当前银行余额不足是硬拒绝。

### 10.4 目标方案与资金池

目标方案输入为目标金额、日期、账户、缓冲、优先级、已有分配和现金流。先预留必要支出及缓冲，再确定可用金额；不得假设收入增长或自动借贷。

方案 A 固定目标金额，在 30 天窗口逐日寻找满足约束的最早备齐日期；方案 B 固定目标日期，计算在该日期前可备齐的最大金额。如果日期超出 30 天，允许保存目标但不输出未覆盖区间的可行性保证，提示需要补充后续数据。

goal.activate 在短事务内锁相关 allocation_pool 行，核对 forecast 输入版本与账户快照，验证目标间合计分配不超可分配池。两个请求同时争用资金，只允许符合余额约束的一方成功，另一个返回 ALLOCATION_CONFLICT。

将资金实际转入目标账户时，银行成功回执驱动分配迁移；应用异常恢复时依据 transaction_id 唯一关联去重。新增计划优先引用已存入金额，不能再把这部分列为待转金额。

资金从目标账户被转出或用于其他用途时，重新验证目标实际可归属金额，不保留虚假的“资金已备齐”。目标修改、收入未到账或新增义务使约束不成立时，目标 NEEDS_REPLAN，未提交的受影响操作失效；已提交操作只核查不伪装撤销。

## 11 固定模拟数据与预期结果

### 11.1 场景隔离

fixture A 用于现金流和目标主流程，B 用于订阅，C 用于异常交易与卡片，D 用于权限、并发和未知结果。各场景独立重置，不把 B 的订阅新增支出混入 A 后仍引用 A 的金额结论。

每场景至少包含一个当前用户和一个不可访问的测试用户。测试用户用于对象越权用例，不在普通 UI 暴露其余额或账户明细。

### 11.2 Fixture A

起点为 2026-10-01 09:00 +08:00，工资账户 900000 分、储蓄账户 0 分，生活缓冲 80000 分。必要未来支出：10-05 房租 300000 分，10-08 信用卡还款 200000 分。10-10 09:00 预计工资 1000000 分，只有演示入账事件成功后才是事实。

10-01 至 10-08 每天日常预算 13333 分，10-09 为 13336 分，总计 120000 分；10-10 至 10-30 每天 10000 分。主展示覆盖 10-01 至 10-30，其后的房租不在 30 天范围内，并在页面说明。

| 检查点 | 工资账户 | 储蓄账户 | 合并 | 说明 |
|---|---:|---:|---:|---|
| 起点 | 900000 | 0 | 900000 | 初始实际可用余额 |
| 首笔向本人储蓄账户转入 2000 元 | 700000 | 200000 | 900000 | 实际交易，资金总额不变 |
| 10-09 支出均按样例发生 | 80000 | 200000 | 280000 | 预期低点；未发生时只显示预测 |
| 10-10 工资入账后、当日生活费前 | 1080000 | 200000 | 1280000 | 原 800 元加 10000 元 |
| 第二笔转入 4000 元后、当日生活费前 | 680000 | 600000 | 1280000 | 目标资金备齐 |

如果没有首笔转账，工资前原预测低点为 280000 分；假设立即支付 600000 分则为 -320000 分。两阶段储蓄只改变资金归属，不生成“消费 6000 元”。

已登记银行代扣账单和样例卡消费由模拟银行的事件日程入账；Agent 创建的转账任务到期必须等待用户确认。演示时钟推进时逐项处理已授权的既有模拟银行事件，每个事件有唯一 ID，二者不能混同。

### 11.3 Fixture B 与 C

B：账户初始 500000 分，三个示例服务分别为月费 2900 分的银行代扣、月费 1900 分的商户订阅、月费 3500 分的未接入服务；未来日期为 10-15、10-18、10-20；日常预算每天 5000 分。另有一项只出现两笔的记录，不应自动满足三次周期候选规则。取消第一项若即刻生效，预测未来支出减少 2900 分，服务合同状态仍未知；未接入服务不能被报取消成功。

C：卡片尾号 1234 为 ACTIVE，近期一笔 88000 分消费显著高于同商户至少三笔 10000 分基线，产生异常候选。卡绑定订阅和账户级代扣各一项，用于验证冻结影响不同；另有同名联系人两位，触发收款人澄清。

所有这些商户、人名、流水均为虚构演示数据，不使用真实手机号和银行卡号码。

### 11.4 Fixture D 故障注入

提供 ACCEPT_THEN_TIMEOUT、REJECT_INSUFFICIENT_FUNDS、DELAY_RESPONSE、WORKER_RESTART、MODEL_UNAVAILABLE、SALARY_DELAY、VERSION_CONFLICT。故障作用于明确指定操作一次，记录管理员动作，默认关闭。原请求迟到测试需验证 resolve 墓碑能拒绝迟到扣款。

## 12 验证、监控与部署

### 12.1 测试层次

规则单测覆盖金额、口径、日期、两种情景和目标冲突；数据库集成测试覆盖并发额度、资金池和任务抢占；API 契约测试覆盖全部请求模型、状态响应及错误码；浏览器端到端测试覆盖页面—确认—验证—回执；实时模型用例单独评价意图和字段识别。

安全测试至少包括跨用户 ID、伪造 verified、修改确认参数、重复确认、三个 400 元、两个并发 600 元、交易备注恶意指令和验证过期。字段及工具 schema 校验不能替代这些用例。

外部网络断开时 REPLAY 场景与银行规则仍可验证，但报告中注明实时模型测试未运行。完整测试清单见配套开发任务文件。

### 12.2 目标性能与运行边界

建议初始基线：10 个并发演示会话、每用户 1000 条模拟交易，普通查询 p95 小于 1 秒，30 天预测 p95 小于 2 秒，页面点击 200 毫秒内给出进行中反馈。模型请求独立统计延迟，不混入数据库查询指标。这些是待测目标，须记录测试机器及数据规模。

应用日志关联 request_id、conversation_id、operation_id、task_id、bank_transaction_id。统计模型耗时与调用次数、UNKNOWN 数量与持续时间、worker 租约超时、任务逾期和预测失败。不输出完整账户号、验证码或内部推理。

### 12.3 环境与启动要求

环境变量建议包括 APP_ENV、DATABASE_URL、BANK_INTERNAL_URL、BANK_SERVICE_TOKEN、SESSION_SIGNING_SECRET、MODEL_PROVIDER、MODEL_ID、MODEL_API_KEY、DEMO_ENABLED。仅列变量名；真实值在本地配置或部署注入，不能写入 PRD、fixture、前端包或仓库。

API 和 worker 使用相同版本镜像及迁移版本；数据库迁移由单次初始化任务完成，不让每个 worker 启动时并发迁移。部署先检查数据库就绪，再初始化 schema、种子和角色，再启动服务。

Compose 内 bank-sim 和数据库仅暴露内部端口，浏览器通过 web 同源代理访问 api。P0 bank-sim 属于银行依赖模拟，不是新的自治 Agent 或微服务拆分策略。

在新环境验收启动、注销重登、模型离线降级、服务重启及样例恢复。部署说明只能在实际跑通后写“可一键启动”，本设计文档不声称已完成。

## 13 文档冻结与开工条件

本设计已足够用于评审、角色拆分和搭建第一条转账闭环。正式联调以接口路径、字段、枚举、金额单位和 fixture 金额共同为基线，变更须同步前后端类型与用例。

初始化时仍需落实模型凭据、准确依赖锁文件和实际开发成员映射；这些不阻挡页面原型评审和确定性业务开发，但实时 Agent 验收依赖可用模型服务。

本轮交付是技术文档、静态原型和任务清单。实际编码、数据库迁移、容器部署、测试执行尚未进行。
