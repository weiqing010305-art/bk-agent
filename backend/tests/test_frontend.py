from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.frontend import mount_frontend


def test_built_frontend_and_preview_share_api_origin(tmp_path):
    build = tmp_path / "dist"
    (build / "assets").mkdir(parents=True)
    (build / "index.html").write_text('<div id="root">青禾</div>', encoding="utf-8")
    (build / "assets" / "app.js").write_text("console.log('qinghe');", encoding="utf-8")
    (tmp_path / ".env").write_text("PRIVATE_CONFIG=not-for-web", encoding="utf-8")
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"ok": True}

    assert mount_frontend(app, build)
    with TestClient(app) as client:
        root = client.get("/")
        assert root.status_code == 200
        assert "text/html" in root.headers["content-type"]
        assert client.get("/qinghe-ui-preview.html").text == root.text
        assert client.get("/assets/app.js").text == "console.log('qinghe');"
        assert client.get("/api/health").json() == {"ok": True}
        for path in ["/api/missing", "/.env", "/backend/app.py", "/%2e%2e/.env"]:
            assert client.get(path).status_code == 404


def test_api_still_runs_without_a_frontend_build(tmp_path):
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"ok": True}

    assert not mount_frontend(app, tmp_path / "not-built")
    with TestClient(app) as client:
        assert client.get("/").status_code == 404
        assert client.get("/api/health").json() == {"ok": True}
