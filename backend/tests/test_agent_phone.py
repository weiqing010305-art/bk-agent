from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from backend import agent_model


def turn(client, monkeypatch, task=None, **values):
    monkeypatch.setattr(agent_model, 'extract', lambda *args: agent_model.Extraction(**values))
    response = client.post('/api/agent/turn', json={
        'conversation_id': task['conversation_id'] if task else str(uuid4()),
        'request_id': str(uuid4()), 'version': task['version'] if task else 0, 'text': '本地测试消息'})
    assert response.status_code == 200, response.text
    return response.json()


def payload(task, **patch):
    return {'id': task['payment_id'], 'kind': 'phone', 'utility': 'water', 'cardId': 'debit',
            'target': task['phone'], 'amount': task['amount'], 'password': '123456',
            'agentTaskId': task['id'], 'agentVersion': task['version'], **patch}


def test_phone_collect_handoff_payment_and_retry(client, monkeypatch):
    task = turn(client, monkeypatch, intent='phone')
    assert task['kind'] == 'phone'
    assert task['missing'] == ['phone', 'amount']
    assert not task['can_open']
    task = turn(client, monkeypatch, task, intent='phone', phone='13800000000')
    assert task['missing'] == ['amount']
    task = turn(client, monkeypatch, task, intent='phone', amount='五十元')
    assert task['status'] == 'READY_FOR_REVIEW' and task['can_open'] and task['handoff']
    assert task['amount'] == 5000
    before = client.get('/api/state').json()
    assert client.post('/api/agent/tasks/' + task['id'] + '/prepare', json={'version':task['version']}).status_code == 422
    assert client.post('/api/payments', json=payload(task, password='000000')).status_code == 422
    assert client.get('/api/state').json()['balance'] == before['balance']
    result = client.post('/api/payments', json=payload(task))
    assert result.status_code == 200, result.text
    assert result.json()['status'] == 'SUCCEEDED'
    assert client.post('/api/payments', json=payload(task)).json()['id'] == task['payment_id']
    after = client.get('/api/state').json()
    assert after['balance'] == before['balance'] - 5000
    assert len(after['transactions']) == len(before['transactions']) + 1
    done = client.get('/api/agent/tasks/' + task['id']).json()
    assert done['status'] == 'SUCCEEDED' and done['kind'] == 'phone'


def test_phone_edits_bind_latest_fields_and_ownership(client, monkeypatch, app):
    task = turn(client, monkeypatch, intent='phone', phone='13800000000', amount='50')
    changed = client.post('/api/agent/tasks/' + task['id'] + '/edit', json={
        'version':task['version'], 'phone':'13900000000', 'amount':'30'}).json()
    assert changed['phone'] == '13900000000' and changed['amount'] == 3000
    assert changed['payment_id'] != task['payment_id']
    assert client.post('/api/payments', json=payload(task)).status_code == 409
    assert client.post('/api/payments', json=payload(changed, amount=1)).status_code == 409
    with TestClient(app, headers={'X-Demo-Request':'1'}) as other:
        other.post('/api/session')
        assert other.post('/api/payments', json=payload(changed)).status_code == 404
    assert client.post('/api/payments', json=payload(changed)).status_code == 200


def test_phone_invalid_cancel_and_switch(client, monkeypatch):
    task = turn(client, monkeypatch, intent='phone', phone='12345', amount='一千二')
    assert task['status'] == 'COLLECTING' and not task['can_open']
    task = turn(client, monkeypatch, task, intent='phone', phone='13800000000', amount='50')
    cancelled = turn(client, monkeypatch, task, intent='cancel')
    assert cancelled['status'] == 'CANCELLED'
    assert client.post('/api/payments', json=payload(task)).status_code == 409
    switched = turn(client, monkeypatch, cancelled, intent='transfer', recipient='王佩兰', amount='10')
    assert switched['kind'] == 'transfer'
    assert switched['recipient_name'] == '王佩兰' and switched['id'] != task['id']


def test_unrelated_message_has_no_transfer_action(client, monkeypatch):
    task = turn(client, monkeypatch, intent='other')
    assert task['kind'] is None and not task['can_open'] and not task['handoff']


def test_phone_new_task_keeps_completed_receipt(client, monkeypatch):
    task = turn(client, monkeypatch, intent='phone', phone='13800000000', amount='50')
    assert client.post('/api/payments', json=payload(task)).status_code == 200
    second = turn(client, monkeypatch, task, intent='new', phone='13900000000', amount='30')
    assert second['kind'] == 'phone' and second['id'] != task['id']
    old = client.get('/api/agent/tasks/' + task['id']).json()
    assert old['status'] == 'SUCCEEDED' and old['phone'] == '13800000000'
