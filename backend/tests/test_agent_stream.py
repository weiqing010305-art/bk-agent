import json
from uuid import uuid4
from fastapi import HTTPException
from backend import agent_model


def events(response):
    frames = response.text.strip().split('\n\n')
    return [(f.split('\n')[0][7:], json.loads(f.split('\ndata: ')[1])) for f in frames]


def test_stream_validated_reply_and_idempotency(client, monkeypatch):
    calls = []
    def extract(*args):
        calls.append(1)
        return agent_model.Extraction(intent='phone', phone='13800000000', amount='50')
    monkeypatch.setattr(agent_model, 'extract', extract)
    body = {'conversation_id': str(uuid4()), 'request_id': str(uuid4()), 'version': 0,
            'text': '给13800000000充50元话费'}
    before = client.get('/api/state').json()['balance']
    response = client.post('/api/agent/turn', json=body, headers={'Accept': 'text/event-stream'})
    assert response.status_code == 200
    assert 'text/event-stream' in response.headers['content-type']
    assert response.headers['x-accel-buffering'] == 'no'
    frames = events(response)
    assert frames[0] == ('thinking', {})
    assert frames[-1][0] == 'complete'
    task = frames[-1][1]
    assert task['kind'] == 'phone' and task['amount'] == 5000
    assert task['status'] == 'READY_FOR_REVIEW'
    assert ''.join(v['text'] for k, v in frames if k == 'delta') == task['message']
    assert all(k != 'delta' or 'phone' not in v for k, v in frames)
    # Stream replay returns the same committed task without another model call or debit.
    retry = client.post('/api/agent/turn', json=body, headers={'Accept': 'text/event-stream'})
    assert events(retry)[-1][1]['id'] == task['id']
    assert len(calls) == 1
    assert client.get('/api/state').json()['balance'] == before
    assert client.get('/api/agent/tasks/' + task['id']).json()['amount'] == 5000


def test_stream_error_and_version_conflict(client, monkeypatch):
    monkeypatch.setattr(agent_model, 'extract', lambda *a: agent_model.Extraction(intent='transfer'))
    body = {'conversation_id': str(uuid4()), 'request_id': str(uuid4()), 'version': 0, 'text': '我要转账'}
    task = client.post('/api/agent/turn', json=body).json()
    body['request_id'] = str(uuid4())
    response = client.post('/api/agent/turn', json=body, headers={'Accept': 'text/event-stream'})
    assert events(response)[-1] == ('error', {'status': 409, 'code': 'TASK_VERSION',
        'message': '任务已更新，请重新打开查看最新信息。'})
    assert not any(k == 'complete' for k, _ in events(response))
    body['version'] = task['version']
    def unavailable(*args):
        raise HTTPException(503, {'code': 'AGENT_MODEL_ERROR', 'message': '助手暂时不可用。'})
    monkeypatch.setattr(agent_model, 'extract', unavailable)
    response = client.post('/api/agent/turn', json=body, headers={'Accept': 'text/event-stream'})
    assert events(response)[-1][0] == 'error'
    assert events(response)[-1][1]['code'] == 'AGENT_MODEL_ERROR'


def test_stream_input_validation_still_precedes_stream(client):
    response = client.post('/api/agent/turn', json={'text': ''}, headers={'Accept': 'text/event-stream'})
    assert response.status_code == 422
    assert 'text/event-stream' not in response.headers['content-type']
