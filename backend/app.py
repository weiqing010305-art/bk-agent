"""Local fictional demo API. Never expose this anonymous demo to the public internet."""
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from .db import make_engine, session_factory
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


def operation_view(op):
    return {"id": op.id, "contactId": op.contact_id, "recipient_name": op.recipient_name,
            "recipient_number": op.recipient_number, "amount": op.amount, "note": op.note,
            "revision": op.revision, "params_hash": op.params_hash, "status": op.status,
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
        return {"balance": account.balance, "currency": "CNY", "mock": True,
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

    @app.get("/api/operations/{op_id}")
    def operation(op_id: str, session=Depends(get_session), db=Depends(get_db)):
        lock_account(db, session)
        op = own_operation(db, session, op_id)
        finish_if_expired(db, session, op)
        return operation_view(op)

    @app.post("/api/operations/{op_id}/confirm")
    def confirm(op_id: str, body: Confirmation, session=Depends(get_session), db=Depends(get_db)):
        lock_account(db, session)
        op = own_operation(db, session, op_id)
        validate_version(op, body)
        finish_if_expired(db, session, op)
        if op.status in {"SUCCEEDED", "FAILED", "EXPIRED"}:
            return operation_view(op)
        auth = db.get(Authorization, op.id)
        if not auth:
            auth = Authorization(operation_id=op.id, session_id=session.id, params_hash=op.params_hash,
                                 challenge_id=str(uuid4()), demo_code=f"{secrets.randbelow(1000000):06d}",
                                 expires_at=min(op.expires_at, now() + timedelta(minutes=2)), attempts=0)
            db.add(auth)
            op.status = "AWAITING_VERIFICATION"
            audit(db, session, "USER_CONFIRMED", op)
            db.commit()
        if expired(auth.expires_at):
            op.status = "EXPIRED"
            db.commit()
            return operation_view(op)
        return {**operation_view(op), "challenge_id": auth.challenge_id, "demo_code": auth.demo_code,
                "verification_expires_at": auth.expires_at}

    @app.post("/api/operations/{op_id}/verify")
    def verify(op_id: str, body: Verification, session=Depends(get_session), db=Depends(get_db)):
        account = lock_account(db, session)
        op = own_operation(db, session, op_id)
        validate_version(op, body)
        if op.status == "SUCCEEDED":
            return operation_view(op)  # Same receipt, no second debit.
        finish_if_expired(db, session, op)
        if op.status in {"FAILED", "EXPIRED"}:
            return operation_view(op)
        auth = db.get(Authorization, op.id)
        if (not auth or op.status != "AWAITING_VERIFICATION" or auth.session_id != session.id
                or auth.params_hash != op.params_hash or auth.challenge_id != body.challenge_id):
            fail("VERIFICATION_REQUIRED", "请先核对并确认本笔转账", 403)
        if expired(auth.expires_at):
            op.status = "EXPIRED"
            audit(db, session, "VERIFICATION_EXPIRED", op)
            db.commit()
            return operation_view(op)
        if not secrets.compare_digest(auth.demo_code, body.code):
            auth.attempts += 1
            if auth.attempts >= 3:
                op.status, op.failure = "FAILED", "VERIFICATION_LOCKED"
            audit(db, session, "VERIFICATION_REJECTED", op)
            db.commit()  # Persist failed attempts, even though HTTP response is an error.
            fail("INVALID_CODE", "模拟验证码不正确，最多允许 3 次尝试", 422)
        if account.balance < op.amount:
            op.status, op.failure = "FAILED", "INSUFFICIENT_FUNDS"
            audit(db, session, "TRANSFER_REJECTED", op)
        else:
            account.balance -= op.amount
            op.status = "SUCCEEDED"
            auth.consumed_at = now()
            db.add(Transaction(id=op.id, user_id=session.user_id, operation_id=op.id,
                               name=f"转给{op.recipient_name}", category="转账", amount=-op.amount,
                               date="2026-09-25", note=op.note, created_at=now()))
            audit(db, session, "TRANSFER_POSTED", op)
        db.commit()  # Atomic simulated-bank posting + authorization + receipt.
        return operation_view(op)

    return app
