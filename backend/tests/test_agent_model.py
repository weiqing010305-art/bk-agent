import json
import pytest
import httpx
from fastapi import HTTPException
from backend import agent_model


def provider(monkeypatch, output):
    monkeypatch.setenv("AGENT_BASE_URL", "https://model.example/v1")
    monkeypatch.setenv("AGENT_MODEL", "test-model")
    monkeypatch.setenv("AGENT_API_KEY", "test-secret")
    captured = {}
    def post(self, url, **kwargs):
        captured.update(kwargs)
        return httpx.Response(200, request=httpx.Request("POST", url),
            json={"choices": [{"message": {"content": json.dumps(output, ensure_ascii=False)}}]})
    monkeypatch.setattr(httpx.Client, "post", post)
    return captured


def test_model_card_redaction_and_no_authorization_tools(monkeypatch):
    captured = provider(monkeypatch, {"recipient": "CARD_1", "amount": "100元", "intent": "transfer"})
    result = agent_model.extract("给9900000000003821转100元", {})
    assert result.recipient == "9900000000003821"
    payload = json.dumps(captured["json"])
    assert "9900000000003821" not in payload
    assert "test-secret" not in payload
    assert "tools" not in captured["json"]


def test_phone_extraction_redacts_number_and_restores_valid_slot(monkeypatch):
    captured = provider(monkeypatch, {"intent": "phone", "phone": "PHONE_1", "amount": "50元"})
    result = agent_model.extract("给13800000000充50元话费", {"kind": "phone"})
    assert result.phone == "13800000000"
    assert result.intent == "phone"
    payload = json.dumps(captured['json'])
    assert '13800000000' not in payload
    assert 'PHONE_1' in payload


@pytest.mark.parametrize("output", [
    {"amount": "500"},  # Cannot extract 500 from 5000.
    {"amount": "10", "recipient": "不存在"},
    {"amount": "5000", "verified": True},
    {"amount": 5000},
    {"intent": "execute"},
])
def test_ungrounded_and_extra_fields_fail_closed(monkeypatch, output):
    provider(monkeypatch, output)
    with pytest.raises(HTTPException) as exc:
        agent_model.extract("转5000元", {})
    assert exc.value.detail["code"] == "AGENT_MODEL_ERROR"


def test_missing_config_and_secrets(monkeypatch):
    monkeypatch.delenv("AGENT_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        agent_model.extract("转账", {})
    assert exc.value.detail["code"] == "AGENT_NOT_CONFIGURED"
    provider(monkeypatch, {})
    with pytest.raises(HTTPException) as exc:
        agent_model.extract("支付密码123456", {})
    assert exc.value.detail["code"] == "SECRET_IN_CHAT"
