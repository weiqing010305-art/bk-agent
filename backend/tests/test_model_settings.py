import httpx
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from backend import agent_model, model_config, model_settings


@pytest.fixture
def settings_client(app, monkeypatch, tmp_path):
    config_file = tmp_path / '.env'
    config_file.write_text('DATABASE_URL=keep-existing-database\nOTHER_VALUE=keep-me\n', encoding='utf-8')
    monkeypatch.setattr(model_config, 'ENV_FILE', config_file)
    monkeypatch.setenv('AGENT_BASE_URL', 'https://original.example/v1')
    monkeypatch.setenv('AGENT_MODEL', 'original-model')
    monkeypatch.setenv('AGENT_API_KEY', 'original-test-secret')
    with TestClient(app, client=('127.0.0.1', 51000), headers={'X-Demo-Request': '1'}) as client:
        client.post('/api/session')
        yield client


def config_body(client, **patch):
    current = client.get('/api/settings/model').json()
    return {'base_url': current['base_url'], 'model': current['model'],
            'api_key': '', 'revision': current['revision'], **patch}


def test_read_save_immediate_use_and_preserve_environment(settings_client, monkeypatch):
    client = settings_client
    public = client.get('/api/settings/model').json()
    assert public['has_key'] and public['configured']
    assert 'api_key' not in public and 'original-test-secret' not in str(public)
    saved = client.post('/api/settings/model', json=config_body(client,
        base_url='https://new.example/v1/chat/completions', model='new-model', api_key='new-test-secret'))
    assert saved.status_code == 200
    assert saved.json()['base_url'] == 'https://new.example/v1'
    assert 'new-test-secret' not in saved.text
    contents = model_config.ENV_FILE.read_text(encoding='utf-8')
    assert 'DATABASE_URL=keep-existing-database' in contents
    assert 'OTHER_VALUE=keep-me' in contents
    assert 'new-test-secret' in contents
    captured = {}
    def post(self, url, **kwargs):
        captured.update(url=url, **kwargs)
        return httpx.Response(200, request=httpx.Request('POST', url),
            json={'choices': [{'message': {'content': '{"intent":"other"}'}}]})
    monkeypatch.setattr(httpx.Client, 'post', post)
    agent_model.extract('测试连接', {})
    assert captured['url'] == 'https://new.example/v1/chat/completions'
    assert captured['json']['model'] == 'new-model'
    assert captured['headers']['Authorization'] == 'Bearer new-test-secret'


def test_keep_key_only_for_same_destination(settings_client):
    client = settings_client
    assert client.post('/api/settings/model', json=config_body(client, model='another-model')).status_code == 200
    assert agent_model.settings()[2] == 'original-test-secret'
    blocked = client.post('/api/settings/model', json=config_body(client, base_url='https://different.example/v1'))
    assert blocked.status_code == 422
    assert blocked.json()['detail']['code'] == 'MODEL_KEY_REQUIRED'
    assert agent_model.settings()[0] == 'https://original.example/v1'


@pytest.mark.parametrize('base', ['http://external.example/v1', 'https://user:pass@example.com/v1',
    'https://example.com/v1?api_key=hidden', 'https://example.com/#fragment',
    'file:///tmp/model', 'https://169.254.169.254', 'https://example.com:invalid', 'https://exa mple.com'])
def test_invalid_destinations(settings_client, base):
    assert settings_client.post('/api/settings/model', json=config_body(settings_client,
        base_url=base, api_key='new-test-secret')).status_code == 422


def test_local_compatible_endpoint(settings_client):
    result = settings_client.post('/api/settings/model', json=config_body(settings_client,
        base_url='http://localhost:11434/v1', model='local-model', api_key='local-placeholder'))
    assert result.status_code == 200
    assert agent_model.settings()[0] == 'http://localhost:11434/v1'


def test_probe_does_not_save_or_expose_provider_error(settings_client, monkeypatch):
    before = model_config.snapshot()
    seen = {}
    def probe(text, state, config=None):
        seen.update(text=text, config=config)
        return agent_model.Extraction(intent='other')
    monkeypatch.setattr(agent_model, 'extract', probe)
    body = config_body(settings_client, base_url='https://candidate.example/v1', api_key='candidate-secret')
    assert settings_client.post('/api/settings/model/test', json=body).json()['ok']
    assert seen['text'] == '测试连接'
    assert seen['config'][2] == 'candidate-secret'
    assert model_config.snapshot() == before
    def failed(*args, **kwargs):
        raise HTTPException(503, {'message': 'candidate-secret full-provider-body'})
    monkeypatch.setattr(agent_model, 'extract', failed)
    response = settings_client.post('/api/settings/model/test', json=body)
    assert response.status_code == 503
    assert 'candidate-secret' not in response.text
    assert 'full-provider-body' not in response.text
    assert model_config.snapshot() == before


def test_stale_revision_clear_and_save_failure(settings_client, monkeypatch):
    body = config_body(settings_client, model='updated-model')
    assert settings_client.post('/api/settings/model', json=body).status_code == 200
    assert settings_client.post('/api/settings/model', json=body).status_code == 409
    before = model_config.snapshot()
    def denied(*args):
        raise OSError('sensitive-path-and-value')
    with monkeypatch.context() as patch:
        patch.setattr(model_config.os, 'replace', denied)
        failed = settings_client.post('/api/settings/model', json=config_body(settings_client, model='not-saved'))
        assert failed.status_code == 503 and 'sensitive-path-and-value' not in failed.text
    assert model_config.snapshot() == before
    cleared = settings_client.post('/api/settings/model/clear', json={'revision': config_body(settings_client)['revision']})
    assert cleared.status_code == 200
    assert not cleared.json()['has_key']
    assert agent_model.settings() is None


def test_remote_access_and_csrf_denied(settings_client, app):
    with TestClient(app, client=('203.0.113.9', 51000), cookies=settings_client.cookies,
                    headers={'X-Demo-Request': '1'}) as remote:
        assert remote.get('/api/settings/model').status_code == 403
        assert remote.post('/api/settings/model', json=config_body(settings_client)).status_code == 403
    response = settings_client.post('/api/settings/model', json=config_body(settings_client),
                                    headers={'Origin': 'https://untrusted.example'})
    assert response.status_code == 403


def test_probe_concurrency_and_no_key_echo(settings_client):
    assert model_settings.PROBES.acquire(blocking=False)
    try:
        response = settings_client.post('/api/settings/model/test', json=config_body(settings_client))
        assert response.status_code == 429
    finally:
        model_settings.PROBES.release()
    response = settings_client.post('/api/settings/model', json=config_body(settings_client, api_key='secret\ninvalid'))
    assert response.status_code == 422 and 'secret' not in response.text
