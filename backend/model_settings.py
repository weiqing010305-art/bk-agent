"""Local-machine settings only; no endpoint returns stored API credentials."""
from threading import BoundedSemaphore

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from . import agent_model, model_config

PROBES = BoundedSemaphore(1)


class ModelSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    base_url: str = Field(min_length=1, max_length=500)
    model: str = Field(min_length=1, max_length=160)
    api_key: str = Field(default="", max_length=512, repr=False)
    revision: str = Field(pattern=r"^[a-f0-9]{64}$")


class ClearSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    revision: str = Field(pattern=r"^[a-f0-9]{64}$")


def mount_model_settings(app, get_session):
    def local_only(request: Request, session=Depends(get_session)):
        # Do not treat forwarded headers as proof of local access.
        if not request.client or request.client.host not in {"127.0.0.1", "::1"}:
            model_config.fail("LOCAL_SETTINGS_ONLY", "模型设置仅允许在运行服务的本机访问。", 403)
        return session

    @app.get("/api/settings/model")
    def read(session=Depends(local_only)):
        return model_config.public()

    @app.post("/api/settings/model")
    def save(body: ModelSettings, session=Depends(local_only)):
        with model_config.LOCK:
            config = model_config.candidate(body)
            return model_config.persist(config, body.revision)

    @app.post("/api/settings/model/clear")
    def clear(body: ClearSettings, session=Depends(local_only)):
        return model_config.persist(("", "", ""), body.revision)

    @app.post("/api/settings/model/test")
    def test(body: ModelSettings, session=Depends(local_only)):
        config = model_config.candidate(body)
        if not PROBES.acquire(blocking=False):
            model_config.fail("MODEL_TEST_BUSY", "已有连接测试正在进行，请稍后重试。", 429)
        try:
            # Uses the actual extraction contract with synthetic text, never banking data.
            agent_model.extract("测试连接", {}, config=config)
            return {"ok": True, "message": "连接成功，模型可以正常返回结构化结果。"}
        except HTTPException:
            model_config.fail("MODEL_TEST_FAILED", "连接未通过，请核对接口地址、模型名和 API Key，或稍后重试。", 503)
        finally:
            PROBES.release()
