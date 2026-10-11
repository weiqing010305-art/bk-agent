from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor


def payload(**changes):
    return dict(id=str(uuid4()), kind="phone", utility="water", cardId="debit",
                target="13800138000", amount=10000, password="123456", **changes)


def test_payment_receipt_and_retry(client):
    body = payload()
    before = client.get('/api/state').json()['balance']
    assert client.post('/api/payments', json=body).json()['status'] == 'SUCCEEDED'
    assert client.post('/api/payments', json=body).status_code == 200
    state = client.get('/api/state').json()
    assert state['balance'] == before - body['amount']
    assert state['completed'].count(body['id']) == 1
    assert state['transactions'][0]['name'] == '手机充值'
    assert client.get('/api/operations/' + body['id']).json()['receipt_id'] == body['id']
    assert client.post('/api/payments', json={**body, 'amount': 20000}).status_code == 409


def test_rejections_do_not_debit(client):
    before = client.get('/api/state').json()['balance']
    for changes in [{'password': '111111'}, {'target': '123'}, {'amount': -1}, {'cardId': 'unknown'}, {'amount': before + 1}]:
        body = {**payload(), **changes}
        assert client.post('/api/payments', json=body).status_code in (409, 422)
    assert client.get('/api/state').json()['balance'] == before


def test_all_utility_types(client):
    for utility in ['water', 'electricity', 'gas']:
        body = {**payload(), 'kind': 'utility', 'utility': utility, 'target': '12345678', 'cardId': 'travel'}
        assert client.post('/api/payments', json=body).status_code == 200


def test_credit_repayment_and_overpayment(client):
    before = client.get('/api/state').json()['balance']
    body = {**payload(), 'kind': 'credit', 'target': '664266', 'amount': 100000}
    assert client.post('/api/payments', json=body).status_code == 200
    assert client.post('/api/payments', json=body).status_code == 200
    assert client.post('/api/payments', json={**body, 'id': str(uuid4()), 'amount': 352001}).status_code == 409
    assert client.post('/api/payments', json={**body, 'id': str(uuid4()), 'amount': 352000}).status_code == 200
    assert client.post('/api/payments', json={**body, 'id': str(uuid4()), 'amount': 1}).status_code == 409
    state = client.get('/api/state').json()
    assert state['balance'] == before - 452000
    assert state['transactions'][0]['category'] == '信用卡还款'


def test_concurrent_retry_debits_once(client):
    body = payload()
    before = client.get('/api/state').json()['balance']
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post('/api/payments', json=body), range(2)))
    assert all(r.status_code == 200 for r in responses)
    assert client.get('/api/state').json()['balance'] == before - body['amount']


def test_traffic_and_savings_conservation(client):
    traffic = {**payload(), 'kind': 'traffic', 'target': '123456789012'}
    assert client.post('/api/payments', json=traffic).status_code == 200
    assert client.post('/api/payments', json={**traffic, 'id': str(uuid4()), 'target': '1234567'}).status_code == 422
    before = client.get('/api/state').json()['balance']
    goal = str(uuid4())
    deposit = dict(id=str(uuid4()), goalId=goal, direction='deposit', cardId='debit', amount=10000, password='123456')
    assert client.post('/api/savings', json=deposit).status_code == 200
    assert client.post('/api/savings', json=deposit).status_code == 200
    state = client.get('/api/state').json()
    assert state['balance'] + state['savings'][goal] == before
    over = {**deposit, 'id': str(uuid4()), 'direction': 'withdraw', 'amount': 10001}
    assert client.post('/api/savings', json=over).status_code == 409
    assert client.post('/api/savings', json={**deposit, 'id': str(uuid4()), 'password': '111111'}).status_code == 422
    withdraw = {**deposit, 'id': str(uuid4()), 'direction': 'withdraw'}
    assert client.post('/api/savings', json=withdraw).status_code == 200
    assert client.post('/api/savings', json=withdraw).status_code == 200
    state = client.get('/api/state').json()
    assert state['balance'] == before
    assert state['savings'][goal] == 0
