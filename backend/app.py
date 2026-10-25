"""Local fictional demo API. Never expose this anonymous demo to the public internet."""
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from .db import make_engine, session_factory
from .frontend import mount_frontend
from .models import Account, AuditEvent, Authorization, DemoSession, Operation, Recipient, Transaction
from .seed import seed_user


def now():
    return datetime.now(timezone.utc)


def expired(value):
    return value.replace(tzinfo=timezone.utc) <= now() if value.tzinfo is None else value <= now()


def fail(code, message, status=409):
    raise HTTPException(status, {"code": code, "message": message})


class StrictBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Draft(StrictBody):
    contactId: str | None = Field(default=None, min_length=1, max_length=36)
    cardNumber: str | None = Field(default=None, pattern=r"^[0-9]{16,19}$")
    amount: StrictInt = Field(gt=0, le=100000000)
    note: str = Field(default="", max_length=30)

    @field_validator("cardNumber", mode="before")
    @classmethod
    def normalize_card(cls, value):
        return "".join(value.split()) if isinstance(value, str) else value

    @model_validator(mode="after")
    def exactly_one_recipient(self):
        if (self.contactId is None) == (self.cardNumber is None):
            raise ValueError("请仅提供收款人或完整演示卡号其中一种")
        return self


class Confirmation(StrictBody):
    revision: StrictInt = Field(ge=1)
    params_hash: str = Field(pattern=r"^[a-f0-9]{64}$")


class CardLookup(StrictBody):
    cardNumber: str = Field(pattern=r"^[0-9]{16,19}$")

    @field_validator("cardNumber", mode="before")
    @classmethod
    def normalize_card(cls, value):
        return "".join(value.split()) if isinstance(value, str) else value


class Verification(Confirmation):
    challenge_id: str = Field(min_length=36, max_length=36)
    code: str = Field(pattern=r"^\d{6}$")


class Payment(StrictBody):
    id: str = Field(pattern=r"^[a-f0-9-]{36}$")
    kind: Literal["phone", "utility", "credit", "traffic"]
    utility: Literal["water", "electricity", "gas"]
    cardId: Literal["debit", "travel"]
    target: str = Field(min_length=6, max_length=20)
    amount: StrictInt = Field(gt=0, le=10000000)
    password: str = Field(pattern=r"^\d{6}$")
    agentTaskId: str | None = Field(default=None, pattern=r"^[a-f0-9-]{36}$")
    agentVersion: StrictInt | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def valid_target(self):
        import re
        pattern = r"1[3-9]\d{9}" if self.kind == "phone" else r"\d{6,20}"
        if not re.fullmatch(pattern, self.target):
            raise ValueError("手机号或缴费户号格式不正确")
        if self.kind == "credit" and self.target != "664266":
            raise ValueError("请选择有效的演示信用卡")
        if self.kind == "traffic" and not re.fullmatch(r"\d{8,20}", self.target):
            raise ValueError("请输入 8–20 位交通卡号")
        return self


class SavingsTransfer(StrictBody):
    id: str = Field(pattern=r"^[a-f0-9-]{36}$")
    goalId: str = Field(pattern=r"^[a-f0-9-]{36}$")
    direction: Literal["deposit", "withdraw"]
    cardId: Literal["debit", "travel"]
    amount: StrictInt = Field(gt=0, le=10000000)
    password: str = Field(pattern=r"^\d{6}$")


def operation_view(op):
    return {"id": op.id, "contactId": op.contact_id, "recipient_name": op.recipient_name,
            "recipient_number": op.recipient_number, "amount": op.amount, "note": op.note,
            "revision": op.revision, "params_hash": op.params_hash, "status": op.status, "auth_method": op.auth_method,
            "expires_at": op.expires_at, "failure": op.failure,
            "receipt_id": op.id if op.status == "SUCCEEDED" else None, "mock": True}


def audit(db, session, event, op=None):
    db.add(AuditEvent(id=str(uuid4()), user_id=session.user_id, operation_id=op.id if op else None,
                      event=event, created_at=now()))


def create_app(engine=None):
    engine = engine or make_engine()
    factory = session_factory(engine)
    app = FastAPI(title="青禾 · 虚构银行演示 API", version="0.2.0")
    app.state.engine = engine
    origins = set(os.environ.get("ALLOWED_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(","))

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if request.headers.get("x-demo-request") != "1" or (origin and origin not in origins):
                return JSONResponse(status_code=403, content={"detail": {"code": "CSRF_REJECTED", "message": "请求来源不允许"}})
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        # No connection strings or raw DB exception text in client responses.
        return JSONResponse(status_code=503, content={"detail": {"code": "DATABASE_UNAVAILABLE", "message": "数据库暂不可用，请保留原操作并查询结果"}})

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        # Pydantic's default error body includes rejected inputs, including credentials.
        return JSONResponse(status_code=422, content={"detail": {
            "code": "INVALID_REQUEST", "message": "请求内容不符合要求，请检查填写信息。"}})

    def get_db():
        with factory() as db:
            yield db

    def get_session(request: Request, db=Depends(get_db)):
        token = request.cookies.get("qinghe_session", "")
        digest = hashlib.sha256(token.encode()).hexdigest()
        session = db.get(DemoSession, digest)
        if not session or session.revoked or expired(session.expires_at):
            fail("SESSION_REQUIRED", "演示会话已过期，请刷新页面创建新演示", 401)
        return session

    def lock_account(db, session):
        account = db.scalar(select(Account).where(Account.user_id == session.user_id).with_for_update())
        db.refresh(session)
        if session.revoked or expired(session.expires_at):
            fail("SESSION_REQUIRED", "演示会话已过期，请刷新页面", 401)
        return account

    def own_operation(db, session, op_id):
        op = db.scalar(select(Operation).where(Operation.id == op_id, Operation.user_id == session.user_id,
                                              Operation.session_id == session.id))
        if not op:
            fail("NOT_FOUND", "未找到此演示操作", 404)
        return op

    def validate_version(op, body):
        if op.revision != body.revision or not secrets.compare_digest(op.params_hash, body.params_hash):
            fail("CONFIRMATION_MISMATCH", "确认参数不一致，请重新核对")

    def finish_if_expired(db, session, op):
        if op.status not in {"SUCCEEDED", "FAILED", "EXPIRED"} and expired(op.expires_at):
            op.status = "EXPIRED"
            audit(db, session, "EXPIRED", op)
            db.commit()

    def new_session(db, response):
        token = secrets.token_urlsafe(32)
        user_id = seed_user(db)
        session = DemoSession(id=hashlib.sha256(token.encode()).hexdigest(), user_id=user_id,
                              expires_at=now() + timedelta(hours=24), revoked=False)
        db.add(session)
        db.flush()
        audit(db, session, "DEMO_SESSION_CREATED")
        db.commit()
        response.set_cookie("qinghe_session", token, httponly=True, samesite="strict", max_age=86400,
                            secure=os.environ.get("COOKIE_SECURE") == "1", path="/api")
        return {"mock": True, "expires_at": session.expires_at}

    @app.get("/api/health")
    def health(db=Depends(get_db)):
        db.execute(text("SELECT 1"))
        return {"ok": True, "mock": True}

    @app.post("/api/session")
    def session_start(request: Request, response: Response, db=Depends(get_db)):
        token = request.cookies.get("qinghe_session", "")
        old = db.get(DemoSession, hashlib.sha256(token.encode()).hexdigest())
        if old and not old.revoked and not expired(old.expires_at):
            return {"mock": True, "expires_at": old.expires_at}
        return new_session(db, response)

    @app.post("/api/session/reset")
    def reset(response: Response, session=Depends(get_session), db=Depends(get_db)):
        lock_account(db, session)
        session.revoked = True
        audit(db, session, "DEMO_SESSION_RESET")
        return new_session(db, response)

    @app.get("/api/state")
    def state(session=Depends(get_session), db=Depends(get_db)):
        # Shared account lock gives a consistent balance + ledger snapshot at READ COMMITTED.
        account = lock_account(db, session)
        recipients = db.scalars(select(Recipient).where(Recipient.user_id == session.user_id, Recipient.is_favorite.is_(True)).order_by(Recipient.id)).all()
        transactions = db.scalars(select(Transaction).where(Transaction.user_id == session.user_id)
                                  .order_by(Transaction.created_at.desc(), Transaction.id)).all()
        positions = {}
        moves = db.execute(select(Operation.recipient_number, Transaction.amount).join(
            Transaction, Transaction.operation_id == Operation.id).where(
            Operation.user_id == session.user_id, Operation.contact_id.in_(["saving:deposit", "saving:withdraw"]))).all()
        for goal_id, amount in moves:
            positions[goal_id] = positions.get(goal_id, 0) - amount
        return {"savings": positions, "balance": account.balance, "currency": "CNY", "mock": True,
                "contacts": [{"id": r.id, "name": r.name, "number": r.number} for r in recipients],
                "completed": [t.operation_id for t in transactions if t.operation_id],
                "transactions": [{"id": t.id, "name": t.name, "category": t.category, "amount": t.amount,
                                  "date": t.date, "note": t.note} for t in transactions]}

    @app.post("/api/recipients/lookup")
    def lookup_recipient(body: CardLookup, session=Depends(get_session), db=Depends(get_db)):
        recipient = db.scalar(select(Recipient).where(Recipient.user_id == session.user_id, Recipient.number == body.cardNumber))
        if not recipient:
            fail("RECIPIENT_NOT_FOUND", "数据库中未找到该演示卡号，请核对号码", 404)
        return {"id": recipient.id, "name": recipient.name, "number": recipient.number,
                "is_favorite": recipient.is_favorite, "mock": True}

    @app.post("/api/operations")
    def create_operation(body: Draft, idempotency_key: str = Header(min_length=8, max_length=80),
                         session=Depends(get_session), db=Depends(get_db)):
        account = lock_account(db, session)
        digest = hashlib.sha256(json.dumps(body.model_dump(exclude_none=True), sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        existing = db.scalar(select(Operation).where(Operation.user_id == session.user_id,
                                                     Operation.idempotency_key == idempotency_key))
        if existing:
            if not secrets.compare_digest(existing.params_hash, digest):
                fail("IDEMPOTENCY_CONFLICT", "同一个请求编号不能用于不同转账")
            return operation_view(existing)
        recipient = (db.get(Recipient, (session.user_id, body.contactId)) if body.contactId else
                     db.scalar(select(Recipient).where(Recipient.user_id == session.user_id, Recipient.number == body.cardNumber)))
        if not recipient:
            fail("RECIPIENT_NOT_FOUND", "数据库中未找到该演示卡号，请核对号码", 422)
        if body.amount > account.balance:
            fail("INSUFFICIENT_FUNDS", "账户余额不足，请修改金额")
        op = Operation(id=str(uuid4()), user_id=session.user_id, session_id=session.id,
                       idempotency_key=idempotency_key, params_hash=digest, contact_id=recipient.id,
                       recipient_name=recipient.name, recipient_number=recipient.number,
                       amount=body.amount, note=body.note, revision=1, status="AWAITING_CONFIRMATION",
                       expires_at=now() + timedelta(minutes=5))
        db.add(op)
        db.flush()
        audit(db, session, "DRAFT_CREATED", op)
        db.commit()
        return operation_view(op)

    @app.post("/api/payments")
    def payment(body: Payment, session=Depends(get_session), db=Depends(get_db)):
        from .agent_phone import payment_task
        task = payment_task(db, session, body, expired, fail)
        account = lock_account(db, session)
        if not secrets.compare_digest(body.password, "123456"):
            fail("INVALID_PASSWORD", "支付密码不正确，请重新输入。", 422)
        params = body.model_dump(exclude={"password", "agentTaskId", "agentVersion"})
        digest = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()
        existing = db.get(Operation, body.id)
        if existing:
            if existing.user_id != session.user_id or existing.session_id != session.id:
                fail("NOT_FOUND", "未找到此演示支付", 404)
            if existing.params_hash != digest:
                fail("IDEMPOTENCY_CONFLICT", "请求编号已用于不同支付，请重新核对。")
            return operation_view(existing)
        if body.amount > account.balance:
            fail("INSUFFICIENT_FUNDS", "账户余额不足，请调整金额。")
        name = "手机充值" if body.kind == "phone" else {"water": "水费缴费", "electricity": "电费缴费", "gas": "燃气费缴费"}[body.utility]
        if body.kind == "credit":
            name = "信用卡还款 · 6642"
            repayments = db.scalars(select(Transaction).where(Transaction.user_id == session.user_id,
                                   Transaction.name == name, Transaction.category == "信用卡还款")).all()
            due = max(0, 452000 + sum(t.amount for t in repayments))
            if body.amount > due:
                fail("OVERPAYMENT", "还款金额不能超过本期待还金额。")
        if body.kind == "traffic":
            name = "交通卡充值"
        note = body.target + " · 尾号" + {"debit": "8826", "travel": "3901"}[body.cardId]
        op = Operation(id=body.id, user_id=session.user_id, session_id=session.id,
                       idempotency_key=body.id, params_hash=digest, contact_id="payment:" + body.cardId,
                       recipient_name=name, recipient_number=body.target, amount=body.amount, note=note,
                       revision=1, status="SUCCEEDED", expires_at=now() + timedelta(minutes=5))
        db.add(op)
        db.flush()
        account.balance -= body.amount
        db.add(Transaction(id=body.id, user_id=session.user_id, operation_id=body.id, name=name,
                           category="交通" if body.kind == "traffic" else "信用卡还款" if body.kind == "credit" else "通信" if body.kind == "phone" else "生活缴费", amount=-body.amount,
                           date=now().date().isoformat(), note=note, created_at=now()))
        audit(db, session, "SERVICE_PAYMENT_POSTED", op)
        if task:
            task.state = {**task.state, "operation_id": op.id, "status": "SUCCEEDED", "handoff": False,
                          "message": "手机充值已完成，可查看这笔充值回执。"}
        db.commit()
        return operation_view(op)

    @app.post("/api/savings")
    def savings_transfer(body: SavingsTransfer, session=Depends(get_session), db=Depends(get_db)):
        account = lock_account(db, session)
        if not secrets.compare_digest(body.password, "123456"):
            fail("INVALID_PASSWORD", "支付密码不正确，请重新输入。", 422)
        digest = hashlib.sha256(json.dumps(body.model_dump(exclude={"password"}), sort_keys=True).encode()).hexdigest()
        existing = db.get(Operation, body.id)
        if existing:
            if existing.user_id != session.user_id or existing.session_id != session.id:
                fail("NOT_FOUND", "未找到此资金划转", 404)
            if existing.params_hash != digest:
                fail("IDEMPOTENCY_CONFLICT", "编号已用于另一笔资金划转。")
            return operation_view(existing)
        amounts = db.scalars(select(Transaction.amount).join(Operation, Transaction.operation_id == Operation.id).where(
            Operation.user_id == session.user_id, Operation.recipient_number == body.goalId,
            Operation.contact_id.in_(["saving:deposit", "saving:withdraw"]))).all()
        held = -sum(amounts)
        if body.direction == "deposit" and body.amount > account.balance:
            fail("INSUFFICIENT_FUNDS", "可用余额不足。")
        if body.direction == "withdraw" and body.amount > held:
            fail("INSUFFICIENT_SAVINGS", "取回金额不能超过已存金额。")
        delta = -body.amount if body.direction == "deposit" else body.amount
        name = "存入储蓄计划" if delta < 0 else "取回储蓄资金"
        note = "计划 " + body.goalId[:8]
        op = Operation(id=body.id, user_id=session.user_id, session_id=session.id,
                       idempotency_key=body.id, params_hash=digest, contact_id="saving:" + body.direction,
                       recipient_name=name, recipient_number=body.goalId, amount=body.amount, note=note,
                       revision=1, status="SUCCEEDED", expires_at=now() + timedelta(minutes=5))
        db.add(op)
        db.flush()
        account.balance += delta
        db.add(Transaction(id=body.id, user_id=session.user_id, operation_id=body.id, name=name,
                           category="储蓄划转", amount=delta, date=now().date().isoformat(), note=note, created_at=now()))
        audit(db, session, "SAVINGS_TRANSFER_POSTED", op)
        db.commit()
        return operation_view(op)

    @app.get("/api/operations/{op_id}")
    def operation(op_id: str, session=Depends(get_session), db=Depends(get_db)):
        lock_account(db, session)
        op = own_operation(db, session, op_id)
        finish_if_expired(db, session, op)
        return operation_view(op)

    from .transfer_auth import mount_transfer_auth
    from .agent_routes import mount_agent
    from .model_settings import mount_model_settings
    mount_transfer_auth(app, get_db, get_session, lock_account, own_operation,
                        validate_version, finish_if_expired, now, expired, fail,
                        audit, operation_view, Confirmation, Verification)
    mount_agent(app, get_db, get_session, lock_account, now, expired, fail, audit, operation_view)
    mount_model_settings(app, get_session)

    mount_frontend(app)
    return app
