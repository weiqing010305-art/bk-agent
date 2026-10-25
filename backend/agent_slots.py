"""Deterministic money parsing and server-owned draft facts."""
import re
from decimal import Decimal, InvalidOperation
from sqlalchemy import select
from .models import Recipient, Account

DIGITS = {c: i for i, c in enumerate("零一二三四五六七八九")}
DIGITS.update({"两": 2, "〇": 0})
UNITS = {"十": 10, "百": 100, "千": 1000, "万": 10000}


def parse_amount(raw):
    try:
        text = (raw or "").strip()
        if re.search(r"\d\s+\d", text):
            raise ValueError()
        text = re.sub(r"^(?:人民币|[¥￥])\s*", "", text)
        text = re.sub(r"\s*(?:元|圆|块钱|块)$", "", text)
        text = re.sub(r"\s+(?=[万千百]$)", "", text)
        if "," in text:
            if not re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?[万千百]?", text):
                raise ValueError()
            text = text.replace(",", "")
        if re.fullmatch(r"\d+(\.\d{1,2})?[万千百]?", text):
            scale = UNITS.get(text[-1], 1)
            value = Decimal(text[:-1] if scale != 1 else text) * scale * 100
        elif re.fullmatch(r"[零〇一二两三四五六七八九十百千万]+(点[零一二三四五六七八九]{1,2})?", text):
            integer, *fraction = text.split("点")
            if re.search(r"[一二两三四五六七八九]{2}|[十百千万]{2}", integer):
                raise ValueError()
            # Colloquial 一千二 / 两万五 is ambiguous; ask for a precise amount.
            if len(integer) >= 3 and integer[-2] in "百千万" and integer[-1] in DIGITS:
                raise ValueError()
            total = section = number = 0
            last_unit = 10000
            for char in integer:
                if char in DIGITS:
                    number = DIGITS[char]
                elif char == "万":
                    if total:
                        raise ValueError()
                    total += (section + number) * 10000
                    section = number = 0
                    last_unit = 10000
                else:
                    if UNITS[char] >= last_unit:
                        raise ValueError()
                    last_unit = UNITS[char]
                    section += (number or 1) * UNITS[char]
                    number = 0
            value = Decimal(total + section + number) * 100
            if fraction:
                value += int("".join(str(DIGITS[c]) for c in fraction[0]).ljust(2, "0"))
        else:
            raise ValueError()
        if value != value.to_integral_value() or not 0 < value <= 5000000:
            raise ValueError()
        return int(value)
    except (InvalidOperation, ValueError, IndexError):
        raise ValueError("请输入明确的人民币金额，最多两位小数，单笔不超过 50,000 元。")


def validate_state(db, user_id, state):
    state = {**state, "missing": [], "choices": [], "status": "COLLECTING"}
    recipients = db.scalars(select(Recipient).where(Recipient.user_id == user_id)).all()
    hint = state.get("recipient_hint", "")
    chosen = next((r for r in recipients if r.id == state.get("recipient_id")), None)
    if not chosen:
        matches = [r for r in recipients if r.number == hint or r.name == hint]
        if not matches and hint and not hint.isdigit():
            matches = [r for r in recipients if hint in r.name]
        if len(matches) == 1:
            chosen = matches[0]
        else:
            state["missing"].append("recipient")
            state["choices"] = [{"id": r.id, "name": r.name, "tail": r.number[-4:]} for r in matches]
    if chosen:
        state.update(recipient_id=chosen.id, recipient_name=chosen.name, tail=chosen.number[-4:])
    else:
        for key in ("recipient_id", "recipient_name", "tail"):
            state.pop(key, None)
    if not state.get("amount"):
        state["missing"].append("amount")
    balance = db.get(Account, user_id).balance
    if state.get("amount", 0) > balance:
        state["missing"].append("amount")
        state["message"] = "余额不足，请修改转账金额。"
    elif state.get("clarify"):
        state["message"] = state["clarify"]
    elif "recipient" in state["missing"]:
        state["message"] = ("找到多个收款账户，请选择一个。" if state["choices"] else
                            "转给谁？请提供收款人姓名或完整卡号。" if not hint else
                            "未找到匹配的收款账户，请核对姓名或完整卡号。")
    elif "amount" in state["missing"]:
        state["message"] = "转多少钱？"
    else:
        state.update(status="READY_FOR_REVIEW", message="已填写好，请核对转账信息后确认。")
    if state.get("clarify"):
        state["status"] = "COLLECTING"
    return state
