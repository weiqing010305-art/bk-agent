# PostgreSQL 模拟转账后端

## 本机模型配置 API

`GET /api/settings/model` 只返回地址、模型名、has_key、configured 与 revision；不返回密钥。`POST /api/settings/model` 接收 base_url、model、api_key、revision；相同地址可留空沿用密钥，更换地址必须新密钥。原子更新本机 .env 并即时生效，保留其他环境变量。

`POST /api/settings/model/test` 使用同一配置请求体，只发送固定测试文本验证结构化结果，不保存。`POST /api/settings/model/clear` 仅接收 revision，清除配置。版本冲突返回 409，设置仅允许真实 loopback 来源、有效会话和原 CSRF 检查，不使用转发头判本机。模型配置为本机服务共用；仍需管理员认证才能用于多用户或公开部署。

## 交通卡与储蓄 API

`POST /api/payments` 新增 `kind: traffic`，target 为 8–20 位数字交通卡号，生成交通充值流水。

`POST /api/savings` 接收 id、goalId（UUID）、direction（deposit/withdraw）、cardId（debit/travel）、amount（分）与 password。演示密码 123456；同一编号和参数重复提交不重复划转。按账户行锁串行处理资金，取回限于该用户该目标的已有留存；余额与流水一并提交。`GET /api/state` 返回 savings 字典，值为各目标留存分数。目标名称和日期为浏览器元数据；无利息和后台自动扣款。


### 信用卡还款扩展

`POST /api/payments` 新增 `kind: "credit"`，`target: "664266"`（卡包已有尾号 6642），其他支付字段与充值相同。使用一期 ¥4,520.00 虚构账单；账户锁内按已入账还款计算待还，拒绝超额，同一编号重试返回原结果。交易分类为“信用卡还款”，密码不保存。网点预约和流水文件导出由浏览器完成，不向真实网点或信用卡系统提交。

仅限本机、虚构数据的开发演示。无真实银行、支付通道、短信、AI 模型或真实身份认证。

## Windows 启动

在仓库根目录执行。需要 Python 3.12、Node.js，以及本机 PostgreSQL 或 Docker Desktop。

### 页面与 API 合并运行

安装根目录 Node 依赖和 Python 锁定依赖后执行 `npm start`。启动器会准备项目数据库、升级迁移、强制按 backend 模式构建前端，再启动 FastAPI，默认地址 `http://127.0.0.1:8080/`；API 仍为 `/api`，旧 `/qinghe-ui-preview.html` 读取同一份首页。可用 `.env` 的 `QINGHE_PORT` 修改端口，启动器仅增加当前本机来源到既有允许来源中，不开放通配跨域。

`backend/frontend.py` 在业务路由注册完成后托管 dist，只公开编译产物。没有 dist 时 API 仍可单独运行。实现沿用 [FastAPI 官方静态文件机制](https://fastapi.tiangolo.com/tutorial/static-files/)，不另装前端服务器或反向代理。Ctrl+C 停止应用，数据库不删除。

### 保留开发热更新

本机已配置 `.env` 和 `.venv` 时执行 `npm run dev:full`。启动器复用现有服务、升级 migration，在没有数据库监听时使用已安装的 PostgreSQL 初始化项目专属 `.local/postgres`。默认查找 `D:/PostgreSQL18/bin` 或 `C:/Program Files/PostgreSQL/18/bin`，其他位置用 `POSTGRES_BIN` 指定。只监听回环地址，不改变系统 PostgreSQL 服务或已有 Docker 卷。数据库端口来自 `.env`，当前为 54329。

首次安装：复制 `.env.example`（不覆盖已有配置），创建 `.venv` 并安装下面的 Python 依赖，然后 `npm install`、`npm run dev:full`。日志在 `.local/backend-err.log`、`.local/frontend-err.log` 和 `.local/postgres.log`；该目录不提交到 Git。

使用 Docker 时可按以下分步启动；本机数据库与 Docker 数据库选择一种，不要同时占用相同端口：

1. 把 `.env.example` 复制为 `.env`（不要覆盖已有配置）。其中密码只是本地演示默认值，不可用于公开部署。修改密码时同时修改 DATABASE_URL。
2. 启动数据库并安装依赖：

```powershell
docker compose up -d db
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn backend.app:create_app --factory --host 127.0.0.1 --port 8000
```

另一个终端：

`requirements-lock.txt` 固定本次验证版本；`requirements.txt` 记录可升级的依赖范围。

```powershell
npm install
npm run dev
```

访问 http://127.0.0.1:5173/ ，首页显示当前数据库账户余额；旧 `qinghe-ui-preview.html` 地址使用同一前端。Vite 将 `/api` 代理至 8000；后端接口说明在 http://127.0.0.1:8000/docs 。所有写接口需要 `X-Demo-Request: 1` 请求头与有效会话 Cookie（创建会话除外）。

`.env` 的 `VITE_API_MODE=backend` 启用后端；改为 `local` 并重启 Vite 则回到原有纯浏览器 mock。后端断开**不会自动切回本地账本**。构建时此变量编译进入代码；`npm start` 固定使用 backend 模式并由同一服务托管。单独上传 dist 到静态托管仍不会获得数据库能力。

## 数据与流程

概览生活服务通过 `POST /api/payments` 完成虚构充值或缴费：请求包含 UUID `id`、`kind`（phone / utility）、`utility`（water / electricity / gas）、`target`（手机号或户号）、`cardId`（debit / travel）、整数分 `amount` 和演示密码 `password`（123456）。服务端锁账户，验证密码、对象及余额；同一编号和参数返回原支付回执，不重复扣款，密码不写入账本和参数摘要。卡片冻结状态仍为浏览器展示状态，银行卡在后端共享同一演示账户余额。兑换预约只保存在浏览器，不对接真实网点，不扣款。

每个新浏览器会话自动生成一个独立虚构用户（不是共享同一个账户）。24 小时会话用随机 Cookie 标识；数据库只存 token 摘要。相同浏览器标签页共享会话，不同浏览器隔离。每个新场景初始余额 ¥12,860.50，开账余额 ¥2,602.50 + 样例收入 − 样例支出 = 当前余额。

| 表 | 内容 |
|---|---|
| users / sessions | 虚构用户、会话摘要、过期/撤销状态 |
| accounts | 人民币余额，整数分且非负 |
| recipients | 当前用户的 10 位虚构收款人及完整 16 位演示卡号，同用户卡号唯一 |
| transactions | 样例流水与新转账流水，operation_id 唯一 |
| operations | 不可变转账参数、请求幂等键、摘要、状态、过期时间 |
| authorizations | 绑定本操作/参数/会话的模拟验证、有效期、错误次数、消费时间 |
| audit_events | 创建草稿、确认、验证失败、记账、重置等事件；不记录 Cookie |

浏览器先请求 `/api/session` 和 `/api/state`；填表时 `POST /api/operations` 创建 5 分钟有效草稿，`Idempotency-Key` 必填。相同键和参数返回相同草稿，不同参数返回 409。

收款人支持选名单（`contactId`）或手动输入（`cardNumber`），只能提交其中一个字段。卡号按字符串保存，允许输入 16–19 位数字和粘贴带空格号码；服务端去除空白、按当前用户查找名单，未登记的卡号拒绝转账。前端展示匹配姓名与完整号码，核对弹窗以服务端快照为准。不能向任意真实银行卡转账。

常用联系人与银行演示名录不同：数据库保留全部 10 位人物，`is_favorite` 仅将王女士、张三、李四标记为常用。`GET /api/state` 只返回这 3 位联系人，不下发其他人物名单。手动输入完整卡号后，页面通过 `POST /api/recipients/lookup`（请求体 `cardNumber`）查询当前场景的银行名录并显示匹配姓名；陈晨等其余 7 人无需成为常用联系人即可转账。查询或转账不会自动添加常用联系人。查号复用 `(user_id, number)` 唯一索引并要求有效会话；仍为隔离演示，不提供真实银行查号。

`data/demo-recipients.json` 是后端新场景与纯前端模式共用样例，含王女士、张三、李四、陈晨、林悦、赵宇、周宁、吴桐、孙萌、徐远。所有号码以 9900 开头，仅作虚构演示标识，不是银行签发的测试支付凭证，也不做真实银行卡校验。示例：陈晨 `9900000000002601`、林悦 `9900000000002602`。勿输入真实卡号。

已有数据库执行 `alembic upgrade head` 即补齐名单与完整号码，不需要重置场景；余额、流水和历史转账快照不变。名单 migration 降级只移除唯一约束，保留人物数据以免破坏历史引用。

用户核对**服务器返回的数据**，`POST /api/operations/{id}/confirm` 携带 revision 和 params_hash，生成 2 分钟有效的模拟验证码。页面显示验证码仅用于演示，不是安全因子或真实短信；错误 3 次锁定本操作。`POST /api/operations/{id}/verify` 校验后，在一个数据库事务中消费授权、扣余额、生成流水、写成功回执。单笔演示上限为 100,000,000 分（不是监管限额）。

重复验证返回原回执。金额、收款人、备注不可在原草稿上修改，返回修改后创建另一草稿。所有扣款先锁账户，防止并发透支。余额与流水同事务回滚。`GET /api/operations/{id}` 可核查结果；前端对网络异常保留原操作，不用新键重发。转账模拟日期固定为 2026-09-25；会话和验证码有效期使用服务器真实 UTC 时间。

“重置演示数据”撤销旧会话并创建新的独立场景，**不清空数据库或其他用户数据**。旧场景保留以便审计。当前未实现自动清理过期场景；长期开发要留意容器卷增长。

转账草稿的原编号保存在 sessionStorage：刷新恢复未完成核对；响应丢失时查询同一操作，不重新创建转账。两个转账入口共用后端核对弹窗，验证成功后刷新余额和流水，助手表单恢复完成状态。

### 当前保存边界

| 能力 | 保存方式 |
|---|---|
| 可用余额、流水、收款人 | PostgreSQL；概览、账单和表单共用服务端快照 |
| 转账、手机充值、水电燃气、交通充值、信用卡还款 | PostgreSQL 原子记账及原操作幂等回执 |
| 储蓄存入与取回 | PostgreSQL 资金及留存；目标名称、日期为浏览器元数据 |
| 卡片冻结、渠道和限额、订阅取消与恢复 | 原有浏览器 localStorage；不调用真实卡片/扣款协议 |
| 聊天、网点与兑换预约、出行计划 | 原有浏览器 localStorage；不自动执行预约或兑换 |
| 理财申购、挂失手续费 | 原有本地流程，未接入服务器记账；账户刷新覆盖本地余额和流水变化，理财持仓尚未持久化至后端 |

卡片本地状态不构成服务端授权约束，所有借记卡目前共享一个虚构账户余额。聊天仍按关键词选择表单，不从自然语言自动执行；本次只连接现有后端，不新增 Agent。

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm test
npm run test:e2e:backend
npm run build
```

API 测试使用真实 PostgreSQL，连接取 `TEST_DATABASE_URL` 或 `.env` 中的 DATABASE_URL；每次创建随机 `test_qinghe_<uuid>` schema，结束仅删除该测试 schema，绝不清空应用数据。需要建 schema 权限。涵盖非法输入、跨用户访问、伪造授权、确认绑定、验证码过期/锁定、并发重试与余额竞争。浏览器测试可用 `BROWSER_PATH` 指定已安装的 Chromium/Edge 路径；默认使用当前环境的 Playwright Chromium。

原纯前端回归需另外启动 local 模式，例如：

```powershell
$env:VITE_API_MODE='local'
npm run dev -- --port 5174
# 另一个终端
$env:BASE_URL='http://127.0.0.1:5174'
npm run test:e2e
```

## 边界与 GitHub

当前是首条同库闭环，不是历史 v2.0 的完整架构：尚无独立 bank-sim、worker、外部银行 UNKNOWN 对账、可编辑 revision、真实登录、完整会话风控、限流、配额、会话清理或真实 AI。由于没有外部记账调用，不模拟分布式事务；未来拆分服务时必须增加持久任务与对账状态机。

请勿公开暴露这个匿名演示 API。若部署到网络，需要先补真实认证、HTTPS、Secure Cookie、限流、最小权限数据库角色、运维监控等，并配置明确的 `ALLOWED_ORIGINS`。默认只允许 5173 的本机来源；无通配 CORS。

Git 提交迁移、模型、种子生成代码、Compose 和 `.env.example`，不提交 `.env`、数据库文件/备份、Cookie、真实账户资料。数据库在项目专用 Docker 卷 `qinghe_pgdata` 内。`docker compose stop` 可停止服务且保留数据；不要执行带 `-v` 的删除命令，除非确实要永久清空演示数据库。
