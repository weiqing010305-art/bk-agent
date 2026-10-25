from uuid import uuid4
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from backend import agent_model
from backend.agent_model import Extraction
from backend.agent_slots import parse_amount
from backend.models import AgentTask, Recipient, Operation
from backend.app import now


def chat(client, monkeypatch, task=None, **fields):
    monkeypatch.setattr(agent_model, "extract", lambda text, state: Extraction(**fields))
    body = {"conversation_id": task["conversation_id"] if task else str(uuid4()),
            "request_id": str(uuid4()), "version": task["version"] if task else 0,
            "text": "测试用户消息"}
    result = client.post("/api/agent/turn", json=body)
    assert result.status_code == 200, result.text
    return result.json()


def prepare(client, task):
    result = client.post(f"/api/agent/tasks/{task['id']}/prepare", json={"version": task["version"]})
    assert result.status_code == 200, result.text
    return result.json()["operation"]


def bind(op):
    return {"revision": op["revision"], "params_hash": op["params_hash"]}


def authorize(client, op):
    result = client.post(f"/api/operations/{op['id']}/confirm", json=bind(op))
    assert result.status_code == 200, result.text
    return result.json()


def pay(client, auth, password="123456", **extra):
    return client.post(f"/api/operations/{auth['id']}/verify-password", json={
        **bind(auth), "challenge_id": auth["challenge_id"], "password": password, **extra})


@pytest.mark.parametrize("text,value", [("500元", 50000), ("五百", 50000), ("一千零二", 100200),
    ("0.01", 1), ("1.25万", 1250000), ("三百点五", 30050), ("五万", 5000000)])
def test_money(text, value):
    assert parse_amount(text) == value


@pytest.mark.parametrize("text", ["一千二", "一二三", "0.001", "-5", "十几万", "50001", "0", "百百", "1,2", "1元2", "1 2", "一十一百"])
def test_ambiguous_money(text):
    with pytest.raises(ValueError):
        parse_amount(text)


def test_collect_prepare_password_and_retry(client, monkeypatch, app):
    t = chat(client, monkeypatch)
    assert t["missing"] == ["recipient", "amount"]
    t = chat(client, monkeypatch, t, recipient="王佩兰")
    assert t["missing"] == ["amount"]
    t = chat(client, monkeypatch, t, amount="五百", note="房租")
    assert t["status"] == "READY_FOR_REVIEW"
    assert t["amount"] == 50000
    op = prepare(client, t)
    assert prepare(client, t)["id"] == op["id"]
    assert client.get("/api/state").json()["balance"] == 1286050
    # Creating a draft doesn't authorize it; OTP endpoint cannot bypass a password.
    assert pay(client, {**op, "challenge_id": str(uuid4())}).status_code == 403
    auth = authorize(client, op)
    assert "demo_code" not in auth
    assert client.post(f"/api/operations/{op['id']}/verify", json={
        **bind(op), "challenge_id": auth["challenge_id"], "code": "123456"}).status_code == 403
    assert pay(client, auth).json()["status"] == "SUCCEEDED"
    with TestClient(app, cookies=client.cookies, headers={"X-Demo-Request": "1"}) as again:
        assert pay(again, auth).json()["receipt_id"] == op["id"]
    assert client.get("/api/state").json()["balance"] == 1236050


def test_revision_ownership_and_cancellation(client, monkeypatch, app):
    t = chat(client, monkeypatch, recipient="王佩兰", amount="100")
    auth = authorize(client, prepare(client, t))
    edited = client.post(f"/api/agent/tasks/{t['id']}/edit",
                         json={"version": t["version"], "amount": "200"}).json()
    assert pay(client, auth).json()["status"] == "EXPIRED"
    assert client.post(f"/api/agent/tasks/{t['id']}/prepare", json={"version": t["version"]}).status_code == 409
    with TestClient(app, headers={"X-Demo-Request": "1"}) as other:
        other.post("/api/session")
        assert other.get(f"/api/agent/tasks/{t['id']}").status_code == 404
        assert other.post(f"/api/agent/tasks/{t['id']}/prepare", json={"version": edited["version"]}).status_code == 404
    canceled = chat(client, monkeypatch, edited, intent="cancel")
    assert canceled["status"] == "CANCELLED"
    assert client.post(f"/api/agent/tasks/{t['id']}/prepare", json={"version": canceled["version"]}).status_code == 422
    assert client.get("/api/state").json()["balance"] == 1286050


def test_ambiguous_recipient_and_amount(client, monkeypatch, engine):
    t = chat(client, monkeypatch, recipient="远", amount="一千二")
    assert t["status"] == "COLLECTING"
    assert len(t["choices"]) >= 2
    picked = client.post(f"/api/agent/tasks/{t['id']}/edit", json={
        "version": t["version"], "recipient_id": "li", "amount": "1200"}).json()
    assert picked["status"] == "READY_FOR_REVIEW"
    assert picked["recipient_name"] == "李思远"
    ambiguous = chat(client, monkeypatch, picked, ambiguous=True)
    assert ambiguous["status"] == "COLLECTING"
    assert client.post(f"/api/agent/tasks/{t['id']}/prepare", json={"version": ambiguous["version"]}).status_code == 422


def test_password_account_lock_across_tasks(client, monkeypatch):
    first = chat(client, monkeypatch, recipient="王佩兰", amount="10")
    auth = authorize(client, prepare(client, first))
    for _ in range(3):
        assert pay(client, auth, password="000000").status_code == 422
    second = chat(client, monkeypatch, recipient="王佩兰", amount="20")
    second_auth = authorize(client, prepare(client, second))
    assert pay(client, second_auth).status_code == 429
    assert client.get("/api/state").json()["balance"] == 1286050


def test_cumulative_risk_rechecked(client, monkeypatch):
    t1 = chat(client, monkeypatch, recipient="王佩兰", amount="600")
    a1 = authorize(client, prepare(client, t1))
    t2 = chat(client, monkeypatch, recipient="王佩兰", amount="600")
    a2 = authorize(client, prepare(client, t2))
    assert pay(client, a1).status_code == 200
    assert pay(client, a2).json()["detail"]["code"] == "STEP_UP_REQUIRED"
    a2 = authorize(client, a2)
    assert a2["auth_method"] == "password_code"
    assert pay(client, a2, code=a2["demo_code"]).json()["status"] == "SUCCEEDED"


def test_turn_replay_expiry_and_secrets(client, monkeypatch, engine):
    monkeypatch.setattr(agent_model, "extract", lambda *args: Extraction(recipient="王佩兰", amount="100"))
    body = {"conversation_id": str(uuid4()), "request_id": str(uuid4()), "version": 0, "text": "转账"}
    t = client.post("/api/agent/turn", json=body).json()
    assert client.post("/api/agent/turn", json=body).json() == t
    assert client.post("/api/agent/turn", json={**body, "text": "改"}).status_code == 409
    assert client.post("/api/agent/turn", json={**body, "request_id": str(uuid4()),
        "version": t["version"], "text": "密码123456"}).status_code == 422
    with Session(engine) as db:
        db.get(AgentTask, t["id"]).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get(f"/api/agent/tasks/{t['id']}").json()["status"] == "EXPIRED"
    assert client.post(f"/api/agent/tasks/{t['id']}/prepare", json={"version": t["version"]}).status_code == 409


def test_new_task_keeps_old_receipt(client, monkeypatch):
    first = chat(client, monkeypatch, recipient="王佩兰", amount="1")
    auth = authorize(client, prepare(client, first))
    assert pay(client, auth).json()["status"] == "SUCCEEDED"
    second = chat(client, monkeypatch, first, intent="new", recipient="李思远", amount="2")
    assert second["id"] != first["id"]
    old = client.get(f"/api/agent/tasks/{first['id']}").json()
    assert old["status"] == "SUCCEEDED"
    assert old["recipient_name"] == "王佩兰"
    assert old["amount"] == 100
    assert client.get('/api/agent/conversations/' + first['conversation_id']).json()['id'] == second['id']


def test_concurrent_prepare_single_operation(client, monkeypatch, app):
    t = chat(client, monkeypatch, recipient="王佩兰", amount="1")
    def create(_):
        with TestClient(app, cookies=client.cookies, headers={"X-Demo-Request": "1"}) as parallel:
            return prepare(parallel, t)["id"]
    with ThreadPoolExecutor(max_workers=3) as pool:
        assert len(set(pool.map(create, range(3)))) == 1


def test_validation_does_not_echo_password(client, monkeypatch):
    task = chat(client, monkeypatch, recipient="王佩兰", amount="1")
    auth = authorize(client, prepare(client, task))
    result = pay(client, auth, password="private-invalid-password")
    assert result.status_code == 422
    assert "private-invalid-password" not in result.text
