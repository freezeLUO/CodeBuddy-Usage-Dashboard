import sqlite3
from contextlib import contextmanager

from .config import DB_PATH, SCHEMA_SQL


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=30.0)
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
