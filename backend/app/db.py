import sqlite3
from contextlib import contextmanager

from .config import SCHEMA_SQL
from .provider import db_path


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=30.0)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA synchronous = NORMAL")
    return con


def init_db() -> None:
    con = connect()
    try:
        con.executescript(SCHEMA_SQL.read_text(encoding="utf-8"))
        con.commit()
    finally:
        con.close()


@contextmanager
def tx():
    con = connect()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
