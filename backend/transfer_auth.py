"""Transfer authorization: legacy demo OTP and password-bound agent operations."""
import hashlib
import os
import re
import secrets
from datetime import timedelta, timezone
from uuid import uuid4

from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field, StrictInt
from sqlalchemy import select, func
from .models import Authorization, PaymentCredential, Transaction


class PasswordVerification(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=1)
    params_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    challenge_id: str = Field(min_length=36, max_length=36)
    password: str = Field(pattern=r"^\d{6}$")
    code: str = Field(default="", pattern=r"^(\d{6})?$")


def password_digest(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200000).hex()


def high_risk(db, session, amount, now):
    local = now().astimezone(timezone(timedelta(hours=8)))
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    spent = db.scalar(select(func.coalesce(func.sum(-Transaction.amount), 0)).where(
        Transaction.user_id == session.user_id, Transaction.category == "转账",
        Transaction.amount < 0, Transaction.created_at >= start)) or 0
    return amount + spent > 100000


def mount_transfer_auth(app, get_db, get_session, lock_account, own_operation,
                        validate_version, finish_if_expired, now, expired, fail,
                        audit, operation_view, Confirmation, Verification):
    def bound(db, session, op_id, body):
        account = lock_account(db, session)
        op = own_operation(db, session, op_id)
        validate_version(op, body)
        finish_if_expired(db, session, op)
        return account, op

    @app.post("/api/operations/{op_id}/confirm")
    def confirm(op_id: str, body: Confirmation, session=Depends(get_session), db=Depends(get_db)):
        _, op = bound(db, session, op_id, body)
        if op.status in {"SUCCEEDED", "FAILED", "EXPIRED"}:
            return operation_view(op)
        if op.auth_method.startswith("password") and high_risk(db, session, op.amount, now):
            op.auth_method = "password_code"
        auth = db.get(Authorization, op.id)
        if not auth:
            auth = Authorization(operation_id=op.id, session_id=session.id, params_hash=op.params_hash,
                                 challenge_id=str(uuid4()), demo_code=f"{secrets.randbelow(1000000):06d}",
                                 expires_at=min(op.expires_at, now() + timedelta(minutes=2)), attempts=0)
            db.add(auth)
            op.status = "AWAITING_VERIFICATION"
            audit(db, session, "USER_CONFIRMED", op)
        if expired(auth.expires_at):
            op.status = "EXPIRED"
        db.commit()
        result = {**operation_view(op), "challenge_id": auth.challenge_id,
                  "verification_expires_at": auth.expires_at}
        if op.auth_method != "password":
            result["demo_code"] = auth.demo_code
        return result

    def authorization(db, session, op, body):
        auth = db.get(Authorization, op.id)
        if (not auth or op.status != "AWAITING_VERIFICATION" or auth.session_id != session.id
                or auth.params_hash != op.params_hash or auth.challenge_id != body.challenge_id):
            fail("VERIFICATION_REQUIRED", "请先核对并确认本笔转账", 403)
        if expired(auth.expires_at):
            op.status = "EXPIRED"
            audit(db, session, "VERIFICATION_EXPIRED", op)
            db.commit()
            return None
        return auth

    def code_check(db, session, op, auth, code):
        if not secrets.compare_digest(auth.demo_code, code):
            auth.attempts += 1
            if auth.attempts >= 3:
                op.status, op.failure = "FAILED", "VERIFICATION_LOCKED"
            audit(db, session, "VERIFICATION_REJECTED", op)
            db.commit()
            fail("INVALID_CODE", "验证码不正确，最多允许 3 次尝试", 422)

    def post(db, session, account, op, auth):
        if account.balance < op.amount:
            op.status, op.failure = "FAILED", "INSUFFICIENT_FUNDS"
            audit(db, session, "TRANSFER_REJECTED", op)
        else:
            account.balance -= op.amount
            op.status = "SUCCEEDED"
            auth.consumed_at = now()
            db.add(Transaction(id=op.id, user_id=session.user_id, operation_id=op.id,
                               name=f"转给{op.recipient_name}", category="转账", amount=-op.amount,
                               date=now().astimezone(timezone(timedelta(hours=8))).date().isoformat(),
                               note=op.note, created_at=now()))
            audit(db, session, "TRANSFER_POSTED", op)
        db.commit()
        return operation_view(op)

    @app.post("/api/operations/{op_id}/verify")
    def verify(op_id: str, body: Verification, session=Depends(get_session), db=Depends(get_db)):
        account, op = bound(db, session, op_id, body)
        if op.auth_method != "code":
            fail("PASSWORD_REQUIRED", "本笔转账需要支付密码验证。", 403)
        if op.status in {"SUCCEEDED", "FAILED", "EXPIRED"}:
            return operation_view(op)
        auth = authorization(db, session, op, body)
        if not auth:
            return operation_view(op)
        code_check(db, session, op, auth, body.code)
        return post(db, session, account, op, auth)

    @app.post("/api/operations/{op_id}/verify-password")
    def verify_password(op_id: str, body: PasswordVerification, session=Depends(get_session), db=Depends(get_db)):
        account, op = bound(db, session, op_id, body)
        if not op.auth_method.startswith("password"):
            fail("WRONG_AUTH_METHOD", "请使用本笔转账的验证方式。", 403)
        if op.status in {"SUCCEEDED", "FAILED", "EXPIRED"}:
            return operation_view(op)
        auth = authorization(db, session, op, body)
        if not auth:
            return operation_view(op)
        credential = db.get(PaymentCredential, session.user_id)
        if not credential:
            password = os.environ.get("DEMO_PAYMENT_PASSWORD", "123456")
            if not re.fullmatch(r"\d{6}", password):
                fail("AUTH_CONFIGURATION", "支付验证暂不可用。", 503)
            salt = secrets.token_hex(32)
            credential = PaymentCredential(user_id=session.user_id, salt=salt,
                                           digest=password_digest(password, salt), attempts=0)
            db.add(credential)
        if credential.locked_until and not expired(credential.locked_until):
            fail("PASSWORD_LOCKED", "支付验证已锁定，请 15 分钟后再试。", 429)
        if credential.locked_until:
            credential.locked_until, credential.attempts = None, 0
        if not secrets.compare_digest(credential.digest, password_digest(body.password, credential.salt)):
            credential.attempts += 1
            if credential.attempts >= 3:
                credential.locked_until = now() + timedelta(minutes=15)
            audit(db, session, "PAYMENT_PASSWORD_REJECTED", op)
            db.commit()
            fail("INVALID_PASSWORD", "支付密码不正确，连续 3 次错误将锁定 15 分钟。", 422)
        # Re-evaluate under the account lock; concurrent split transfers cannot downgrade risk.
        if high_risk(db, session, op.amount, now) and op.auth_method == "password":
            op.auth_method = "password_code"
            db.commit()
            fail("STEP_UP_REQUIRED", "累计金额变化，需要补充验证码，请重新打开验证。")
        if op.auth_method == "password_code":
            code_check(db, session, op, auth, body.code)
        credential.attempts, credential.locked_until = 0, None
        return post(db, session, account, op, auth)
