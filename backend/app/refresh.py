"""增量刷新编排：以 conversation 为失效单元。"""
import threading
import time
from pathlib import Path

from .config import DB_PATH
from .db import tx
from .ingest import scanner, store
from .ingest.parser import (
    ParsedConversation,
    build_conversation,
    message_read_plan,
    read_index,
    read_message,
)
from .ingest.scanner import ConvRef, fingerprint, message_path
from .ingest.workspace_resolver import resolve

_lock = threading.Lock()


def _parse_one(conv: ConvRef) -> tuple[ParsedConversation | None, dict, str]:
    """子进程/串行共用的单会话解析。"""
    result = read_index(conv.index_path)
    if result is None:
        return None, {}, "index-unreadable"
    messages, requests = result
    plan = message_read_plan(messages, requests)

    loaded: dict[str, dict] = {}
    files: dict[str, tuple[str, int, int]] = {}
    for message_id in plan:
        path = message_path(conv, message_id)
        fp = fingerprint(path)
        if fp is None:
            continue
        info = read_message(path)
        if info is None:
            continue
        loaded[message_id] = info
        files[str(path)] = (message_id, fp[0], fp[1])

    return build_conversation(conv, messages, requests, loaded), files, "ok"


def _parse_many(refs: list[ConvRef]) -> list[tuple[ConvRef, ParsedConversation | None, dict, str]]:
    # 全量约 1100 个小文件、冷启动 <1s，串行即可；进程池在 uvicorn --reload
    # 与 stdin 脚本下会因 Windows spawn 语义出错，不值得。
    return [(c, *_parse_one(c)) for c in refs]


def _load_scan_state(con) -> tuple[dict[str, tuple[int, int]], dict[str, list[tuple[str, int, int]]]]:
    indexes: dict[str, tuple[int, int]] = {}
    messages: dict[str, list[tuple[str, int, int]]] = {}
    for row in con.execute(
        "SELECT path, kind, conversation_id, mtime_ns, size FROM scan_file"
    ):
        if row["kind"] == "index":
            indexes[row["conversation_id"]] = (row["mtime_ns"], row["size"])
        elif row["conversation_id"]:
            messages.setdefault(row["conversation_id"], []).append(
                (row["path"], row["mtime_ns"], row["size"])
            )
    return indexes, messages


def refresh() -> dict:
    started = time.time()
    with _lock:
        return _refresh_locked(started)


def _refresh_locked(started: float) -> dict:
    found = scanner.discover()

    with tx() as con:
        recorded_indexes, recorded_messages = _load_scan_state(con)

    deleted_ids = [cid for cid in recorded_indexes if cid not in found]
    to_parse: list[ConvRef] = []
    for cid, ref in found.items():
        record = recorded_indexes.get(cid)
        if record is None or record != (ref.mtime_ns, ref.size):
            to_parse.append(ref)
            continue
        for path, mtime_ns, size in recorded_messages.get(cid, []):
            fp = fingerprint(Path(path))
            if fp != (mtime_ns, size):
                to_parse.append(ref)
                break

    results = _parse_many(to_parse)
    errors = 0

    with tx() as con:
        needed = {ref.workspace_hash for ref in found.values()}
        store.upsert_workspaces(con, resolve(needed))

        for cid in deleted_ids:
            store.delete_conversation(con, cid)
            store.prune_scan_files(con, cid)

        for conv, parsed, files, status in results:
            if parsed is None:
                errors += 1
                # 保留已有数据，仅记录本轮失败，下轮重试
                continue
            store.write_conversation(con, parsed)
            store.prune_scan_files(con, conv.conversation_id)
            store.record_scan_files(con, conv, files, status)

        now = int(time.time() * 1000)
        store.set_meta(con, "last_refresh", str(now))
        if not con.execute("SELECT 1 FROM sync_meta WHERE key='last_full_scan'").fetchone():
            store.set_meta(con, "last_full_scan", str(now))

    updated = sum(1 for _, parsed, _, _ in results if parsed is not None)
    return {
        "added": 0,
        "updated": updated,
        "deleted": len(deleted_ids),
        "errors": errors,
        "scanned": len(found),
        "duration_ms": int((time.time() - started) * 1000),
        "db_path": str(DB_PATH),
    }
