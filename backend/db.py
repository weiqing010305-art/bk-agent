import os
from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(url=None):
    load_dotenv()
    url = url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is required; see .env.example")
    return create_engine(url, pool_pre_ping=True, connect_args={
        "connect_timeout": 5, "options": "-c statement_timeout=10000 -c lock_timeout=5000",
    })


def session_factory(engine):
    return sessionmaker(engine, expire_on_commit=False)
