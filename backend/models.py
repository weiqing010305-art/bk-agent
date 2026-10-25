from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, JSON, Index, text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))


class DemoSession(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # SHA256 token only
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(default=False)


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (CheckConstraint("balance >= 0", name="positive_balance"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    balance: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="CNY")


class Recipient(Base):
    __tablename__ = "recipients"
    __table_args__ = (UniqueConstraint("user_id", "number", name="recipient_number_per_user"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    number: Mapped[str] = mapped_column(String(40))  # full fictional demo number, never real PAN
    is_favorite: Mapped[bool] = mapped_column(default=False, server_default="false")


class Operation(Base):
    __tablename__ = "operations"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="operation_idempotency"),
        CheckConstraint("amount > 0 AND amount <= 100000000", name="transfer_amount"),
        CheckConstraint("status IN ('AWAITING_CONFIRMATION','AWAITING_VERIFICATION','SUCCEEDED','FAILED','EXPIRED')", name="operation_status"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(80))
    params_hash: Mapped[str] = mapped_column(String(64))
    contact_id: Mapped[str] = mapped_column(String(36))
    recipient_name: Mapped[str] = mapped_column(String(40))
    recipient_number: Mapped[str] = mapped_column(String(40))
    amount: Mapped[int] = mapped_column(BigInteger)
    note: Mapped[str] = mapped_column(String(30))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    auth_method: Mapped[str] = mapped_column(String(24), default="code", server_default="code")
    status: Mapped[str] = mapped_column(String(32), default="AWAITING_CONFIRMATION")
    failure: Mapped[str | None] = mapped_column(String(80))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Authorization(Base):
    __tablename__ = "authorizations"
    operation_id: Mapped[str] = mapped_column(ForeignKey("operations.id"), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    params_hash: Mapped[str] = mapped_column(String(64))
    challenge_id: Mapped[str] = mapped_column(String(36), unique=True)
    demo_code: Mapped[str] = mapped_column(String(6))  # intentionally displayed, NOT real OTP
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    operation_id: Mapped[str | None] = mapped_column(ForeignKey("operations.id"), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(20))
    amount: Mapped[int] = mapped_column(BigInteger)
    date: Mapped[str] = mapped_column(String(10))
    note: Mapped[str] = mapped_column(String(30), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    operation_id: Mapped[str | None] = mapped_column(ForeignKey("operations.id"), index=True)
    event: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AgentTask(Base):
    __tablename__ = "agent_tasks"
    __table_args__ = (Index("agent_current_conversation", "session_id", "conversation_id", unique=True,
                           postgresql_where=text("is_current")),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    conversation_id: Mapped[str] = mapped_column(String(36))
    is_current: Mapped[bool] = mapped_column(default=True, server_default="true")
    version: Mapped[int] = mapped_column(Integer, default=0)
    state: Mapped[dict] = mapped_column(JSON, default=dict)
    last_request: Mapped[str | None] = mapped_column(String(36))
    last_digest: Mapped[str | None] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PaymentCredential(Base):
    __tablename__ = "payment_credentials"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    salt: Mapped[str] = mapped_column(String(64))
    digest: Mapped[str] = mapped_column(String(128))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
