"""Local model configuration. Secrets never appear in public views or error bodies."""
import hashlib
import hmac
import ipaddress
import os
import secrets
import tempfile
from pathlib import Path
from threading import RLock
from urllib.parse import urlparse, urlunparse

from dotenv import set_key
from fastapi import HTTPException

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
LOCK = RLock()
REVISION_KEY = secrets.token_bytes(32)
NAMES = ("AGENT_BASE_URL", "AGENT_MODEL", "AGENT_API_KEY")


def fail(code, message, status=422):
    raise HTTPException(status, {"code": code, "message": message})


def normalize_base(value):
    value = value.strip().rstrip("/")
    try:
        parsed = urlparse(value)
        port = parsed.port
        host = parsed.hostname
        local = host in {"localhost", "127.0.0.1", "::1"}
        if (not host or parsed.username is not None or parsed.password is not None
                or parsed.query or parsed.fragment or parsed.params or re_control(value)
                or (parsed.scheme != "https" and not (parsed.scheme == "http" and local))):
            raise ValueError()
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None and not address.is_global and not local:
            raise ValueError()
        if parsed.path.endswith("/chat/completions"):
            parsed = parsed._replace(path=parsed.path[:-len("/chat/completions")])
        # Equivalent host spellings must not accidentally retain a key for a different destination.
        authority = f"[{host.lower()}]" if ":" in host else host.lower()
        if port and port != (443 if parsed.scheme == "https" else 80):
            authority += ":" + str(port)
        return urlunparse((parsed.scheme, authority, parsed.path.rstrip("/"), "", "", ""))
    except (ValueError, TypeError):
        fail("MODEL_URL_INVALID", "请填写 HTTPS 接口地址；本机服务可使用 http://localhost。")


def re_control(value):
    return any(ord(char) < 33 or ord(char) == 127 for char in value)


def snapshot():
    with LOCK:
        return tuple(os.environ.get(name, "").strip() for name in NAMES)


def revision(config):
    return hmac.new(REVISION_KEY, "\0".join(config).encode(), hashlib.sha256).hexdigest()


def public(config=None):
    config = snapshot() if config is None else config
    base, model, key = config
    try:
        base = normalize_base(base) if base else ""
    except HTTPException:
        base = ""
    return {"base_url": base, "model": model, "has_key": bool(key),
            "configured": bool(base and model and key), "revision": revision(config)}


def candidate(body):
    current = snapshot()
    if not secrets.compare_digest(body.revision, revision(current)):
        fail("MODEL_CONFIG_CHANGED", "配置已被更新，请重新打开设置。", 409)
    base = normalize_base(body.base_url)
    model = body.model.strip()
    key = body.api_key.strip()
    if not model or re_control(model):
        fail("MODEL_NAME_INVALID", "请填写有效的模型名称。")
    if key and re_control(key):
        fail("MODEL_KEY_INVALID", "API Key 中不能包含空格或换行。")
    if not key:
        try:
            same_destination = base == normalize_base(current[0])
        except HTTPException:
            same_destination = False
        if not same_destination or not current[2]:
            fail("MODEL_KEY_REQUIRED", "请填写该接口的 API Key；更换地址不能沿用原密钥。")
        key = current[2]
    return base, model, key


def persist(config, expected_revision):
    with LOCK:
        if not secrets.compare_digest(expected_revision, revision(snapshot())):
            fail("MODEL_CONFIG_CHANGED", "配置已被更新，请重新打开设置。", 409)
        temp_name = None
        try:
            source = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=ENV_FILE.parent,
                                             prefix=".env.model-", delete=False) as temp:
                temp_name = temp.name
                temp.write(source)
            for name, value in zip(NAMES, config):
                set_key(temp_name, name, value)
            os.replace(temp_name, ENV_FILE)
            for name, value in zip(NAMES, config):
                os.environ[name] = value
        except OSError:
            fail("MODEL_CONFIG_SAVE_FAILED", "配置未保存，请检查本机配置文件权限后重试。", 503)
        finally:
            if temp_name and Path(temp_name).exists():
                Path(temp_name).unlink(missing_ok=True)
        return public(config)
