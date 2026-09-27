import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.schema import CreateSchema, DropSchema
from dotenv import load_dotenv

from backend.app import create_app
from alembic import command
from alembic.config import Config


@pytest.fixture(scope="session")
def engine():
    load_dotenv()
    url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url or not url.startswith("postgresql"):
        pytest.fail("PostgreSQL required: set TEST_DATABASE_URL or DATABASE_URL; no SQLite fallback")
    admin = create_engine(url)
    schema = "test_qinghe_" + uuid4().hex
    with admin.begin() as conn:
        conn.execute(CreateSchema(schema))
    engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"}, pool_size=10)
    # Validate real migration up/down/up in this newly-created, empty test schema only.
    config = Config("alembic.ini")
    with engine.begin() as conn:
        config.attributes["connection"] = conn
        command.upgrade(config, "60a9f0ae31d4")
        conn.execute(text("INSERT INTO users (id, name) VALUES ('migration-fixture', '旧演示用户')"))
        conn.execute(text("INSERT INTO accounts (user_id, balance, currency) VALUES ('migration-fixture', 12345, 'CNY')"))
        conn.execute(text("INSERT INTO recipients (user_id, id, name, number) VALUES ('migration-fixture', 'zhang', '张三', '6217 •••• 9062')"))
        command.upgrade(config, "head")
        assert conn.scalar(text("SELECT count(*) FROM recipients WHERE user_id='migration-fixture'")) == 10
        assert conn.scalar(text("SELECT number FROM recipients WHERE user_id='migration-fixture' AND id='zhang'")) == '9900000000009062'
        assert conn.scalar(text("SELECT balance FROM accounts WHERE user_id='migration-fixture'")) == 12345
        command.downgrade(config, "base")
        command.upgrade(config, "head")
    yield engine
    engine.dispose()
    # Only the unique schema created by this fixture is deleted, never application tables.
    with admin.begin() as conn:
        conn.execute(DropSchema(schema, cascade=True))
    admin.dispose()


@pytest.fixture
def app(engine):
    return create_app(engine)


@pytest.fixture
def client(app):
    with TestClient(app, headers={"X-Demo-Request": "1"}) as client:
        assert client.post("/api/session").status_code == 200
        yield client
