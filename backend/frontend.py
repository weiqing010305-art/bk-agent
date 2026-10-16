"""Serve only the compiled frontend after all API routes have been registered."""
import os
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_frontend(app, directory=None):
    build = Path(directory or os.environ.get("FRONTEND_DIST") or
                 Path(__file__).resolve().parents[1] / "dist").resolve()
    index = build / "index.html"
    if not index.is_file():
        return False

    @app.get("/qinghe-ui-preview.html", include_in_schema=False)
    def preview_alias():
        return FileResponse(index)

    app.mount("/", StaticFiles(directory=build, html=True), name="frontend")
    return True
