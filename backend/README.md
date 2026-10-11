# PostgreSQL 模拟转账后端

## 交通卡与储蓄 API

`POST /api/payments` 新增 `kind: traffic`，target 为 8–20 位数字交通卡号，生成交通充值流水。

`POST /api/savings` 接收 id、goalId（UUID）、direction（deposit/withdraw）、cardId（debit/travel）、amount（分）与 password。演示密码 123456；同一编号和参数重复提交不重复划转。按账户行锁串行处理资金，取回限于该用户该目标的已有留存；余额与流水一并提交。`GET /api/state` 返回 savings 字典，值为各目标留存分数。目标名称和日期为浏览器元数据；无利息和后台自动扣款。


### 信用卡还款扩展

`POST /api/payments` 新增 `kind: "credit"`，`target: "664266"`（卡包已有尾号 6642），其他支付字段与充值相同。使用一期 ¥4,520.00 虚构账单；账户锁内按已入账还款计算待还，拒绝超额，同一编号重试返回原结果。交易分类为“信用卡还款”，密码不保存。网点预约和流水文件导出由浏览器完成，不向真实网点或信用卡系统提交。

仅限本机、虚构数据的开发演示。无真实银行、支付通道、短信、AI 模型或真实身份认证。

## Windows 启动

在仓库根目录执行。需要 Python 3.12、Node.js 和已启动的 Docker Desktop。

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

访问 http://127.0.0.1:5173/ ，顶部应显示“数据库演示已连接”。Vite 将 `/api` 代理至 8000；后端接口说明在 http://127.0.0.1:8000/docs 。所有写接口需要 `X-Demo-Request: 1` 请求头与有效会话 Cookie（创建会话除外）。

`.env` 的 `VITE_API_MODE=backend` 启用后端；改为 `local` 并重启 Vite 则回到原有纯浏览器 mock。后端断开**不会自动切回本地账本**。生产静态构建时此变量被编译进入代码；自行部署需要另配同源 `/api` 反向代理，不能只上传 dist 就获得数据库能力。

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

卡片/订阅仍是浏览器 localStorage 中的展示操作，不读取真实扣款协议，也不影响数据库账户转账。聊天仍按关键词选择表单，不从自然语言自动执行。

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm test
npm run test:e2e:backend
npm run build
```

API 测试使用真实 PostgreSQL，连接取 `TEST_DATABASE_URL` 或 `.env` 中的 DATABASE_URL；每次创建随机 `test_qinghe_<uuid>` schema，结束仅删除该测试 schema，绝不清空应用数据。需要建 schema 权限。涵盖非法输入、跨用户访问、伪造授权、确认绑定、验证码过期/锁定、并发重试与余额竞争。浏览器测试默认使用已安装的 Edge，可用 `BROWSER_PATH` 指定其他 Chromium 路径。

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
