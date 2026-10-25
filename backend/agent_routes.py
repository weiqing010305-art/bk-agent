"""User-scoped task APIs. None can authorize or execute a transfer."""
import hashlib
import json
import re
from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import Depends, Request
from pydantic import BaseModel, ConfigDict, Field, StrictInt
from sqlalchemy import select
from . import agent_model
from .agent_slots import parse_amount, validate_state
from .agent_phone import update_phone, validate_phone
from .agent_stream import stream_reply
from .models import AgentTask, DemoSession, Operation, Recipient


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    conversation_id: UUID
    request_id: UUID
    version: StrictInt = Field(ge=0)
    text: str = Field(min_length=1, max_length=1200)


class Edit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: StrictInt = Field(ge=0)
    recipient_id: str | None = Field(default=None, max_length=36)
    amount: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=30)


class Version(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: StrictInt = Field(ge=0)


def mount_agent(app, get_db, get_session, lock_account, now, expired, fail, audit, operation_view):
    def own(db, session, task_id, read=False):
        task = db.scalar(select(AgentTask).where(
            AgentTask.id == task_id, AgentTask.user_id == session.user_id,
            AgentTask.session_id == session.id).with_for_update())
        if not task:
            fail("TASK_NOT_FOUND", "未找到这笔任务，请回到原聊天。", 404)
        if not read and (expired(task.expires_at) or not task.is_current):
            fail("TASK_EXPIRED", "这笔办理信息已过期，请在当前聊天重新说明需求。")
        return task

    def check(task, version):
        if task.version != version:
            fail("TASK_VERSION", "任务已更新，请重新打开查看最新信息。")

    def view(task, db):
        s = task.state
        op = db.get(Operation, s.get("operation_id")) if s.get("operation_id") else None
        status = op.status if op else s.get("status", "COLLECTING")
        if status not in {"SUCCEEDED", "CANCELLED", "FAILED"} and (expired(task.expires_at) or not task.is_current):
            status = "EXPIRED"
        return {"id": task.id, "version": task.version, "conversation_id": task.conversation_id,
                "kind": s.get("kind", "transfer" if s.get("recipient_id") or op else None),
                "can_open": status in {"READY_FOR_REVIEW", "AWAITING_CONFIRMATION", "AWAITING_VERIFICATION", "SUCCEEDED"}
                    and bool(s.get("handoff") or op),
                "phone": s.get("phone"), "payment_id": s.get("payment_id"),
                "status": status, "handoff": s.get("handoff", False),
                "message": s.get("message", ""), "missing": s.get("missing", []),
                "choices": s.get("choices", []), "recipient_name": s.get("recipient_name"),
                "recipient_id": s.get("recipient_id"), "tail": s.get("tail"),
                "amount": s.get("amount"), "note": s.get("note", ""),
                "operation": operation_view(op) if op else None}

    def invalidate(db, session, task):
        if not task.state.get("operation_id"):
            return
        lock_account(db, session)
        op = db.get(Operation, task.state["operation_id"])
        if op:
            db.refresh(op)  # A concurrent verification may have committed while we waited for the account lock.
        if op and op.status == "SUCCEEDED":
            fail("TASK_COMPLETED", "这笔已完成，如需再次办理，请说“再办一笔”。")
        if op:
            op.status, op.failure = "EXPIRED", "DRAFT_CHANGED"
            audit(db, session, "AGENT_DRAFT_CHANGED", op)

    def store(db, session, task, state):
        task.state = state
        task.version += 1
        audit(db, session, "AGENT_TASK_UPDATED")
        db.commit()
        return view(task, db)

    @app.get("/api/agent/status")
    def status(session=Depends(get_session)):
        return {"configured": bool(agent_model.settings()), "capabilities": ["transfer", "phone"]}

    @app.get("/api/agent/tasks/{task_id}")
    def get_task(task_id: str, session=Depends(get_session), db=Depends(get_db)):
        task = own(db, session, task_id, read=True)
        result = view(task, db)
        db.commit()
        return result

    @app.get("/api/agent/conversations/{conversation_id}")
    def get_conversation(conversation_id: UUID, session=Depends(get_session), db=Depends(get_db)):
        task = db.scalar(select(AgentTask).where(AgentTask.session_id == session.id,
                         AgentTask.conversation_id == str(conversation_id), AgentTask.is_current.is_(True)))
        return view(own(db, session, task.id, read=True), db) if task else None

    @app.post("/api/agent/turn")
    def turn(body: Turn, request: Request, session=Depends(get_session), db=Depends(get_db)):
        if 'text/event-stream' in request.headers.get('accept', ''):
            return stream_reply(lambda: process_turn(body, session, db))
        return process_turn(body, session, db)

    def process_turn(body, session, db):
        # Serialize creation/turns per session, including concurrent browser tabs.
        db.scalar(select(DemoSession).where(DemoSession.id == session.id).with_for_update())
        task = db.scalar(select(AgentTask).where(AgentTask.session_id == session.id,
                         AgentTask.conversation_id == str(body.conversation_id), AgentTask.is_current.is_(True)).with_for_update())
        digest = hashlib.sha256(body.model_dump_json().encode()).hexdigest()
        if task and task.last_request == str(body.request_id):
            if task.last_digest != digest:
                fail("TURN_CONFLICT", "同一请求不能修改消息内容。")
            return view(own(db, session, task.id, read=True), db)
        restarted = False
        if task:
            own(db, session, task.id, read=True)
            check(task, body.version)
            if expired(task.expires_at):
                # Expired authorization stays unusable. A new message starts a blank
                # draft in the same conversation without inheriting old payment fields.
                if task.state.get("operation_id"):
                    lock_account(db, session)
                    op = db.get(Operation, task.state["operation_id"])
                    if op:
                        db.refresh(op)
                        if op.status not in {"SUCCEEDED", "CANCELLED", "FAILED"}:
                            op.status, op.failure = "EXPIRED", "TASK_EXPIRED"
                task.is_current = False
                db.flush()
                audit(db, session, "AGENT_TASK_RESTARTED")
                task = None
                restarted = True
        elif body.version:
            fail("TASK_VERSION", "任务不存在，请重新开始。")
        if task is None:
            task = AgentTask(id=str(uuid4()), user_id=session.user_id, session_id=session.id,
                             conversation_id=str(body.conversation_id), version=0, state={},
                             expires_at=now() + timedelta(minutes=30))
            db.add(task)
        s = dict(task.state)
        if re.search(r"密码|验证码|口令|密钥|api.?key", body.text, re.I):
            fail("SECRET_IN_CHAT", "密码与验证码只在安全验证窗口输入。", 422)
        if body.text.strip() in {"取消", "取消转账", "不转了"}:
            parsed = agent_model.Extraction(intent="cancel")
        else:
            parsed = agent_model.extract(body.text, s)
        switch = parsed.intent in {"transfer", "phone"} and s.get("kind") and parsed.intent != s["kind"]
        if parsed.intent == "new" or switch:
            next_kind = parsed.intent if switch else s.get("kind", "transfer")
            # A new draft may follow a completed task; any pending one is invalidated.
            op = db.get(Operation, s.get("operation_id")) if s.get("operation_id") else None
            if not op or op.status != "SUCCEEDED":
                invalidate(db, session, task)
            task.is_current = False
            db.flush()
            task = AgentTask(id=str(uuid4()), user_id=session.user_id, session_id=session.id,
                             conversation_id=str(body.conversation_id), version=0, state={},
                             expires_at=now() + timedelta(minutes=30))
            db.add(task)
            s = {"kind": next_kind}
        elif parsed.intent != "other":
            invalidate(db, session, task)
        s.pop("operation_id", None)
        if parsed.intent == "cancel":
            s = {"kind": s.get("kind"), "status": "CANCELLED", "message": "已取消，这笔没有执行。", "missing": []}
        elif parsed.intent == "other" or re.search(r"预约|定时|明天|后天|美元|港币|欧元|AA|本人账户", body.text, re.I):
            # Preserve current state; an unsupported request must not silently become an immediate payment.
            s = {**task.state, "handoff": False, "message": "可以帮你转账或充值话费，也可从首页选择其他服务。"}
        elif parsed.intent == "phone" or s.get("kind") == "phone":
            s = update_phone(db, session.user_id, s, parsed)
        else:
            if s.get("status") == "CANCELLED":
                s = {}
            s.pop("clarify", None)
            s["kind"] = "transfer"
            if parsed.ambiguous:
                s["clarify"] = "请明确本笔收款账户和金额，我会保留已填写的信息。"
            else:
                if parsed.recipient is not None:
                    s["recipient_hint"] = parsed.recipient
                    s.pop("recipient_id", None)
                if parsed.amount is not None:
                    try:
                        s["amount"] = parse_amount(parsed.amount)
                    except ValueError as exc:
                        s.pop("amount", None)
                        s["clarify"] = str(exc)
                if parsed.note is not None:
                    s["note"] = parsed.note
            s = validate_state(db, session.user_id, s)
            s["handoff"] = s["status"] == "READY_FOR_REVIEW"
        if restarted:
            s["message"] = "上一笔办理信息已过期，已重新开始。" + s["message"]
        task.last_request, task.last_digest = str(body.request_id), digest
        return store(db, session, task, s)

    @app.post("/api/agent/tasks/{task_id}/edit")
    def edit(task_id: str, body: Edit, session=Depends(get_session), db=Depends(get_db)):
        task = own(db, session, task_id)
        check(task, body.version)
        invalidate(db, session, task)
        s = {k: v for k, v in task.state.items() if k not in {"operation_id", "clarify"}}
        if s.get("kind") == "phone":
            if body.recipient_id is not None or body.note is not None:
                fail("PHONE_FIELDS_INVALID", "充值任务只接受手机号和金额。", 422)
            parsed = agent_model.Extraction(intent="phone", phone=body.phone, amount=body.amount)
            return store(db, session, task, update_phone(db, session.user_id, s, parsed))
        if body.recipient_id is not None:
            recipient = db.get(Recipient, (session.user_id, body.recipient_id))
            if not recipient:
                fail("RECIPIENT_NOT_FOUND", "未找到该收款人。", 422)
            s.update(recipient_id=recipient.id, recipient_hint=recipient.name)
        if body.amount is not None:
            try:
                s["amount"] = parse_amount(body.amount)
            except ValueError as exc:
                fail("AMOUNT_INVALID", str(exc), 422)
        if body.note is not None:
            s["note"] = body.note
        s = validate_state(db, session.user_id, s)
        return store(db, session, task, {**s, "handoff": s["status"] == "READY_FOR_REVIEW"})

    @app.post("/api/agent/tasks/{task_id}/prepare")
    def prepare(task_id: str, body: Version, session=Depends(get_session), db=Depends(get_db)):
        task = own(db, session, task_id)
        check(task, body.version)
        if task.state.get("kind") == "phone":
            fail("WRONG_TASK_KIND", "请在手机充值核对页确认支付。", 422)
        account = lock_account(db, session)
        if task.state.get("operation_id"):
            return view(task, db)
        s = validate_state(db, session.user_id, task.state)
        if task.state.get("status") == "CANCELLED" or s["status"] != "READY_FOR_REVIEW":
            fail("TASK_INCOMPLETE", s["message"], 422)
        recipient = db.get(Recipient, (session.user_id, s["recipient_id"]))
        params = {"contactId": recipient.id, "amount": s["amount"], "note": s.get("note", "")}
        op = Operation(id=str(uuid4()), user_id=session.user_id, session_id=session.id,
                       idempotency_key=f"agent:{task.id}:{task.version}",
                       params_hash=hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest(),
                       contact_id=recipient.id, recipient_name=recipient.name, recipient_number=recipient.number,
                       amount=params["amount"], note=params["note"], revision=task.version,
                       auth_method="password", status="AWAITING_CONFIRMATION",
                       expires_at=now() + timedelta(minutes=5))
        db.add(op)
        db.flush()
        task.state = {**s, "operation_id": op.id}
        audit(db, session, "AGENT_REVIEW_PREPARED", op)
        db.commit()
        return view(task, db)
