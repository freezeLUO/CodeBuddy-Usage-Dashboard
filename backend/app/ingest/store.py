import time
from sqlite3 import Connection

from .parser import ParsedConversation
from .scanner import ConvRef


def upsert_workspaces(con: Connection, rows: list[tuple[str, str, str, str]]) -> None:
    con.executemany(
        """INSERT INTO workspace(workspace_hash, path, display_name, source)
           VALUES(?,?,?,?)
           ON CONFLICT(workspace_hash) DO UPDATE SET
             path=excluded.path,
             display_name=excluded.display_name,
             source=excluded.source""",
        rows,
    )


def delete_conversation(con: Connection, conversation_id: str) -> None:
    con.execute("DELETE FROM conversation WHERE conversation_id = ?", (conversation_id,))


def write_conversation(con: Connection, parsed: ParsedConversation) -> None:
    delete_conversation(con, parsed.conversation_id)
    con.execute(
        """INSERT INTO conversation(conversation_id, workspace_hash, title,
                                   started_at_ms, ended_at_ms, request_count, message_count)
           VALUES(?,?,?,?,?,?,?)""",
        (
            parsed.conversation_id,
            parsed.workspace_hash,
            parsed.title,
            parsed.started_at_ms,
            parsed.ended_at_ms,
            len(parsed.requests),
            parsed.message_count,
        ),
    )
    con.executemany(
        """INSERT INTO request(request_id, conversation_id, state, started_at_ms,
                               model_id, model_name, input_tokens, output_tokens, total_tokens,
                               cache_tokens, cached_write_tokens, cached_miss_tokens,
                               last_tokens, credit)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [
            (
                r.request_id,
                parsed.conversation_id,
                "complete",
                r.started_at_ms,
                r.model_id,
                r.model_name,
                r.input_tokens,
                r.output_tokens,
                r.total_tokens,
                r.cache_tokens,
                r.cached_write_tokens,
                r.cached_miss_tokens,
                r.last_tokens,
                r.credit,
            )
            for r in parsed.requests
        ],
    )
    con.executemany(
        """INSERT INTO message_stat(request_id, message_id, stat_input_tokens, stat_output_tokens,
                                   stat_cached_input_tokens, thinking_tokens, elapsed_ms,
                                   last_output_tokens, agent_message_count, credit)
           VALUES(?,?,?,?,?,?,?,?,?,?)""",
        [
            (
                r.request_id,
                (r.stat or {}).get("message_id") or r.message_id,
                (r.stat or {}).get("stat_input_tokens"),
                (r.stat or {}).get("stat_output_tokens"),
                (r.stat or {}).get("stat_cached_input_tokens"),
                (r.stat or {}).get("thinking_tokens"),
                (r.stat or {}).get("elapsed_ms"),
                (r.stat or {}).get("last_output_tokens"),
                (r.stat or {}).get("agent_message_count"),
                (r.stat or {}).get("credit"),
            )
            for r in parsed.requests
            if r.stat
        ],
    )


def record_scan_files(
    con: Connection,
    conv: ConvRef,
    message_files: dict[str, tuple[str, int, int]],
    status: str,
) -> None:
    now = int(time.time() * 1000)
    rows = [(conv.key, "index", conv.conversation_id, conv.mtime_ns, conv.size, now, status)]
    for path, (message_id, mtime_ns, size) in message_files.items():
        rows.append((path, "message", message_id, mtime_ns, size, now, status))
    con.executemany(
        """INSERT INTO scan_file(path, kind, conversation_id, mtime_ns, size, parsed_at_ms, status)
           VALUES(?,?,?,?,?,?,?)
           ON CONFLICT(path) DO UPDATE SET
             kind=excluded.kind, conversation_id=excluded.conversation_id,
             mtime_ns=excluded.mtime_ns, size=excluded.size,
             parsed_at_ms=excluded.parsed_at_ms, status=excluded.status""",
        rows,
    )


def prune_scan_files(con: Connection, conversation_id: str) -> None:
    con.execute("DELETE FROM scan_file WHERE conversation_id = ?", (conversation_id,))


def set_meta(con: Connection, key: str, value: str) -> None:
    con.execute(
        "INSERT INTO sync_meta(key, value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
