"""Start a project-owned local PostgreSQL cluster using an existing installation.

Does not stop, reset, or alter the system PostgreSQL service or Docker volumes.
"""
import os
import socket
import subprocess
from pathlib import Path

from sqlalchemy.engine import make_url
from dotenv import load_dotenv


def main():
    root = Path(__file__).resolve().parents[1]
    load_dotenv(root / ".env")
    url = make_url(os.environ["DATABASE_URL"])
    if url.host not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Local startup requires a loopback DATABASE_URL")
    port = url.port or 5432
    with socket.socket() as probe:
        probe.settimeout(2)
        if probe.connect_ex(("127.0.0.1", port)) == 0:
            print(f"PostgreSQL already listening on {port}; reusing without modifications.")
            return
    candidates = [Path(os.environ.get("POSTGRES_BIN", "D:/PostgreSQL18/bin")),
                  Path("C:/Program Files/PostgreSQL/18/bin")]
    binaries = next((p for p in candidates if (p / "pg_ctl.exe").is_file()), None)
    if binaries is None:
        raise RuntimeError("Set POSTGRES_BIN to an existing PostgreSQL bin directory")
    local = root / ".local"
    data = local / "postgres"
    local.mkdir(exist_ok=True)
    env = {**os.environ, "PGPASSWORD": url.password or ""}

    def run(name, *args):
        subprocess.run([str(binaries / (name + ".exe")), *map(str, args)],
                       check=True, env=env, creationflags=subprocess.CREATE_NO_WINDOW)

    if not (data / "PG_VERSION").is_file():
        password_file = local / "initdb-password.txt"
        try:
            password_file.write_text(url.password or "", encoding="utf-8")
            run("initdb", "-D", data, "-U", url.username, "--encoding=UTF8", "--locale=C",
                "--auth=scram-sha-256", "--pwfile", password_file)
        finally:
            password_file.unlink(missing_ok=True)
    run("pg_ctl", "-D", data, "-l", local / "postgres.log", "-o",
        f"-h 127.0.0.1 -p {port}", "-w", "start")
    # New clusters have no application database. An existing one is never dropped.
    import psycopg
    from psycopg import sql
    with psycopg.connect(host="127.0.0.1", port=port, user=url.username,
                         password=url.password, dbname="postgres", autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname=%s", (url.database,)).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(url.database)))
    print(f"Project PostgreSQL ready on {port}.")


if __name__ == "__main__":
    main()
