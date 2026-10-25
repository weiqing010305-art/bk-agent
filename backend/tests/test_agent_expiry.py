from datetime import timedelta
from uuid import uuid4
from sqlalchemy.orm import Session
from backend import agent_model
from backend.app import now
from backend.models import AgentTask, Operation
from backend.tests.test_agent import prepare, authorize, pay


def send(client, monkeypatch, task=None, **fields):
    monkeypatch.setattr(agent_model, 'extract', lambda *args: agent_model.Extraction(**fields))
    body = {'conversation_id': task['conversation_id'] if task else str(uuid4()),
            'request_id': str(uuid4()), 'version': task['version'] if task else 0, 'text': '本地过期测试'}
    response = client.post('/api/agent/turn', json=body)
    assert response.status_code == 200, response.text
    return response.json(), body


def expire(engine, task, operation=None):
    with Session(engine) as db:
        db.get(AgentTask, task['id']).expires_at = now() - timedelta(seconds=1)
        # Keep operation TTL live to prove task restart itself invalidates authorization.
        if operation:
            db.get(Operation, operation['id']).expires_at = now() + timedelta(minutes=5)
        db.commit()


def test_expired_chat_restarts_without_inheriting_slots(client, monkeypatch, engine):
    old, body = send(client, monkeypatch, intent='phone', phone='13800000000', amount='50')
    before = client.get('/api/state').json()['balance']
    expire(engine, old)
    new, _ = send(client, monkeypatch, old, intent='transfer', amount='20')
    assert new['id'] != old['id'] and new['conversation_id'] == old['conversation_id']
    assert new['missing'] == ['recipient'] and new['amount'] == 2000
    assert new['phone'] is None and new['payment_id'] is None
    assert new['recipient_id'] is None and new['operation'] is None
    assert '已重新开始' in new['message'] and not new['can_open']
    old_view = client.get('/api/agent/tasks/' + old['id']).json()
    assert old_view['status'] == 'EXPIRED' and not old_view['can_open']
    assert client.post('/api/payments', json={'id': old['payment_id'], 'kind': 'phone',
        'target': old['phone'], 'amount': old['amount'], 'utility': 'water', 'cardId': 'debit', 'password': '123456',
        'agentTaskId': old['id'], 'agentVersion': old['version']}).status_code == 409
    assert client.get('/api/state').json()['balance'] == before


def test_restart_invalidates_old_transfer_authorization(client, monkeypatch, engine):
    old, _ = send(client, monkeypatch, recipient='王佩兰', amount='10')
    auth = authorize(client, prepare(client, old))
    expire(engine, old, auth)
    new, _ = send(client, monkeypatch, old, intent='phone')
    assert new['kind'] == 'phone' and new['missing'] == ['phone', 'amount']
    assert pay(client, auth).json()['status'] == 'EXPIRED'


def test_restart_preserves_completed_receipt_and_checks_version(client, monkeypatch, engine):
    old, body = send(client, monkeypatch, recipient='王佩兰', amount='10')
    auth = authorize(client, prepare(client, old))
    assert pay(client, auth).json()['status'] == 'SUCCEEDED'
    expire(engine, old)
    stale = {**body, 'request_id': str(uuid4()), 'version': old['version'] - 1}
    assert client.post('/api/agent/turn', json=stale).status_code == 409
    before = client.get('/api/state').json()['balance']
    new, _ = send(client, monkeypatch, old, intent='transfer')
    assert new['missing'] == ['recipient', 'amount']
    receipt = client.get('/api/agent/tasks/' + old['id']).json()
    assert receipt['status'] == 'SUCCEEDED' and receipt['operation']['id'] == auth['id']
    assert client.get('/api/state').json()['balance'] == before


def test_retry_expired_request_returns_original_task_without_revival(client, monkeypatch, engine):
    old, body = send(client, monkeypatch, recipient='王佩兰', amount='10')
    expire(engine, old)
    monkeypatch.setattr(agent_model, 'extract', lambda *a: (_ for _ in ()).throw(AssertionError('No model retry')))
    retry = client.post('/api/agent/turn', json=body)
    assert retry.status_code == 200
    assert retry.json()['id'] == old['id']
    assert retry.json()['status'] == 'EXPIRED' and not retry.json()['can_open']
