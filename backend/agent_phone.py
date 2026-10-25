"""Phone top-up fields and task binding; never executes payments itself."""
import re
from uuid import uuid4
from sqlalchemy import select
from .agent_slots import parse_amount
from .models import Account, AgentTask


def validate_phone(db, user_id, state):
    s = {**state, "kind": "phone", "missing": [], "choices": [], "status": "COLLECTING"}
    if not re.fullmatch(r"1[3-9]\d{9}", s.get("phone", "")):
        s["missing"].append("phone")
    if not s.get("amount"):
        s["missing"].append("amount")
    if s.get("amount", 0) > db.get(Account, user_id).balance:
        s["missing"].append("amount")
        s["message"] = "余额不足，请修改充值金额。"
    elif s.get("clarify"):
        s["message"] = s["clarify"]
    elif "phone" in s["missing"]:
        s["message"] = "要充值哪个手机号？请提供 11 位手机号。"
    elif "amount" in s["missing"]:
        s["message"] = "充值多少钱？"
    else:
        s.update(status="READY_FOR_REVIEW", message="已填写好，请核对手机号和金额后确认支付。")
        s.setdefault("payment_id", str(uuid4()))
    if s.get("clarify"):
        s["status"] = "COLLECTING"
    s["handoff"] = s["status"] == "READY_FOR_REVIEW"
    return s


def update_phone(db, user_id, state, parsed):
    s = {**state, "kind": "phone"}
    for key in ("clarify", "payment_id", "operation_id"):
        s.pop(key, None)
    if parsed.ambiguous:
        s["clarify"] = "请明确本笔充值的手机号和金额。"
    else:
        if parsed.phone is not None:
            s["phone"] = parsed.phone
        if parsed.amount is not None:
            try:
                s["amount"] = parse_amount(parsed.amount)
            except ValueError:
                s.pop("amount", None)
                s["clarify"] = "充值金额需大于 0，最多两位小数且不超过 50,000 元。"
    return validate_phone(db, user_id, s)


def payment_task(db, session, body, expired, fail):
    if body.agentTaskId is None and body.agentVersion is None:
        return None
    task = db.scalar(select(AgentTask).where(AgentTask.id == body.agentTaskId,
        AgentTask.user_id == session.user_id, AgentTask.session_id == session.id).with_for_update())
    if not task:
        fail("TASK_NOT_FOUND", "未找到这笔充值任务。", 404)
    s = task.state
    if (not task.is_current or expired(task.expires_at) or task.version != body.agentVersion
            or s.get("kind") != "phone" or s.get("status") not in {"READY_FOR_REVIEW", "SUCCEEDED"}
            or s.get("payment_id") != body.id or body.kind != "phone"
            or s.get("phone") != body.target or s.get("amount") != body.amount):
        fail("PHONE_TASK_MISMATCH", "充值信息已变化，请返回核对最新任务。")
    return task
