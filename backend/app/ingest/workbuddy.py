"""WorkBuddy 采集器。

把 `~/.workbuddy/projects/<工作区>/<会话>.jsonl` 里逐次模型调用写成与 CodeBuddy
完全相同的 conversation / request / message_stat 表结构，从而复用全部聚合查询。

口径：
- 一次模型调用 = 一条 request（带 ``providerData.rawUsage`` 的 jsonl 行）
- token 取 ``rawUsage.prompt_tokens / completion_tokens / prompt_cache_hit_tokens``
- 积分取 ``rawUsage.credit``，按该次调用真正发生的时间归日
- 思考 token 取 ``rawUsage.completion_thinking_tokens``
- 会话标题取 ``aiTitle``，缺失时回退到首条用户提问
- 项目路径取行内 ``cwd``，没有 cwd 时归入「未打开工作区」
"""
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .. import provider as provider_module
from ..db import tx
from . import store
from .parser import ParsedConversation, ParsedRequest
from .scanner import fingerprint
from .workspace_resolver import NO_WORKSPACE_HASH, NO_WORKSPACE_NAME, hash_for_path

SYSTEM_REMINDER_RE = re.compile(r"<system-reminder[\s\S]*?</system-reminder>", re.I)
TAG_RE = re.compile(r"<[^>]+>")
TITLE_MAX = 48


@dataclass
class SessionParse:
    conversation: ParsedConversation
    workspace_path: str
    workspace_name: str


def _num(value: Any) -> float:
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return 0.0
    return 0.0


def _int(value: Any) -> int:
    return int(_num(value))


def _text_from_content(node: Any, depth: int = 0) -> str:
    if depth > 4 or node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, list):
        parts = [_text_from_content(item, depth + 1) for item in node]
        return "\n".join(part for part in parts if part)
    if isinstance(node, dict):
        text = node.get("text")
        if isinstance(text, str):
            return text
        if "content" in node:
            return _text_from_content(node["content"], depth + 1)
    return ""


def _clean_title(text: str) -> str | None:
    value = SYSTEM_REMINDER_RE.sub(" ", text)
    value = TAG_RE.sub(" ", value)
    value = re.sub(r"\s+", " ", value).strip()
    if not value:
        return None
    return value[:TITLE_MAX] + "…" if len(value) > TITLE_MAX else value


def _display_name(path: str) -> str:
    parts = [part for part in path.replace("\\", "/").split("/") if part]
    return parts[-1] if parts else NO_WORKSPACE_NAME


def parse_session(path: Path) -> SessionParse | None:
    """没有任何模型调用的文件返回 None（纯工具调用 / 空会话）。"""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    session_id = path.stem
    ai_title: str | None = None
    user_title: str | None = None
    cwd: str | None = None
    message_count = 0
    started_at: int | None = None
    ended_at: int | None = None
    sequence = 0
    seen: set[str] = set()
    requests: list[ParsedRequest] = []

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if not isinstance(row, dict):
            continue

        row_session = row.get("sessionId")
        if isinstance(row_session, str) and row_session:
            session_id = row_session

        row_cwd = row.get("cwd")
        if isinstance(row_cwd, str) and row_cwd and not cwd:
            cwd = row_cwd

        title = row.get("aiTitle")
        if isinstance(title, str) and title.strip():
            ai_title = title.strip()

        if row.get("type") == "message":
            message_count += 1
            if not user_title and row.get("role") == "user":
                user_title = _clean_title(_text_from_content(row.get("content")))

        provider = row.get("providerData")
        usage = provider.get("rawUsage") if isinstance(provider, dict) else None
        if not isinstance(provider, dict) or not isinstance(usage, dict):
            continue

        started_at_ms = _int(row.get("timestamp"))
        if not started_at_ms:
            continue

        sequence += 1
        base_id = row.get("id") if isinstance(row.get("id"), str) else None
        request_id = base_id or f"{session_id}-{sequence}"
        if request_id in seen:
            request_id = f"{request_id}-{sequence}"
        seen.add(request_id)

        input_tokens = _int(usage.get("prompt_tokens"))
        output_tokens = _int(usage.get("completion_tokens"))
        total_tokens = _int(usage.get("total_tokens")) or input_tokens + output_tokens
        cache_tokens = _int(usage.get("prompt_cache_hit_tokens"))
        cached_miss = _int(usage.get("prompt_cache_miss_tokens"))
        cached_write = _int(usage.get("prompt_cache_write_tokens"))
        credit = _num(usage.get("credit"))
        thinking = _int(usage.get("completion_thinking_tokens"))

        model_id = provider.get("model") or provider.get("requestModelId")
        # `requestModelName` 为 "Auto" 时是路由策略而非模型名，回退到实际模型 id
        raw_name = provider.get("requestModelName")
        if isinstance(raw_name, str) and raw_name and raw_name.lower() != "auto":
            model_name = raw_name
        else:
            model_name = model_id
        message_id = provider.get("messageId") or request_id

        requests.append(
            ParsedRequest(
                request_id=request_id,
                started_at_ms=started_at_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                cache_tokens=cache_tokens,
                cached_write_tokens=cached_write,
                cached_miss_tokens=cached_miss,
                last_tokens=input_tokens,
                credit=credit,
                model_id=model_id if isinstance(model_id, str) else None,
                model_name=model_name if isinstance(model_name, str) else None,
                message_id=str(message_id),
                stat={
                    "message_id": str(message_id),
                    "stat_input_tokens": input_tokens,
                    "stat_output_tokens": output_tokens,
                    "stat_cached_input_tokens": cache_tokens,
                    "thinking_tokens": thinking,
                    "elapsed_ms": None,
                    "last_output_tokens": None,
                    "agent_message_count": None,
                    "credit": credit,
                },
            )
        )

        started_at = started_at_ms if started_at is None else min(started_at, started_at_ms)
        ended_at = started_at_ms if ended_at is None else max(ended_at, started_at_ms)

    if not requests:
        return None

    workspace_path = cwd or ""
    workspace_hash = hash_for_path(cwd) if cwd else NO_WORKSPACE_HASH
    workspace_name = _display_name(workspace_path) if workspace_path else NO_WORKSPACE_NAME

    return SessionParse(
        conversation=ParsedConversation(
            conversation_id=session_id,
            workspace_hash=workspace_hash,
            title=ai_title or user_title,
            started_at_ms=started_at,
            ended_at_ms=ended_at,
            message_count=message_count,
            requests=requests,
        ),
        workspace_path=workspace_path,
        workspace_name=workspace_name,
    )


def discover(root: Path) -> dict[Path, tuple[int, int]]:
    found: dict[Path, tuple[int, int]] = {}
    if not root.is_dir():
        return found
    for file in root.glob("projects/*/*.jsonl"):
        fp = fingerprint(file)
        if fp is not None:
            found[file] = fp
    return found


def refresh(started: float, db_file: Path) -> dict:
    root = provider_module.WORKBUDDY_ROOT
    found = discover(root)

    with tx() as con:
        recorded = {
            row["path"]: (row["conversation_id"], row["mtime_ns"], row["size"])
            for row in con.execute(
                "SELECT path, conversation_id, mtime_ns, size FROM scan_file WHERE kind = 'workbuddy'"
            )
        }

    to_parse: list[Path] = []
    added = 0
    updated = 0
    for path, fp in found.items():
        record = recorded.get(str(path))
        if record is None:
            added += 1
            to_parse.append(path)
        elif record[1] != fp[0] or record[2] != fp[1]:
            updated += 1
            to_parse.append(path)

    removed = [
        (path, record[0])
        for path, record in recorded.items()
        if Path(path) not in found and record[0]
    ]

    parsed: list[tuple[Path, SessionParse]] = []
    errors = 0
    for path in to_parse:
        outcome = parse_session(path)
        if outcome is None:
            errors += 1
            continue
        parsed.append((path, outcome))

    now = int(time.time() * 1000)
    with tx() as con:
        for path, conversation_id in removed:
            store.delete_conversation(con, conversation_id)
            con.execute("DELETE FROM scan_file WHERE path = ?", (path,))

        store.upsert_workspaces(
            con,
            [
                (item.conversation.workspace_hash, item.workspace_path, item.workspace_name, "workbuddy")
                for _, item in parsed
            ],
        )

        for path, item in parsed:
            conversation_id = item.conversation.conversation_id
            store.write_conversation(con, item.conversation)
            con.execute("DELETE FROM scan_file WHERE conversation_id = ?", (conversation_id,))
            fp = found[path]
            con.execute(
                """INSERT INTO scan_file(path, kind, conversation_id, mtime_ns, size, parsed_at_ms, status)
                   VALUES(?,?,?,?,?,?,?)
                   ON CONFLICT(path) DO UPDATE SET
                     kind=excluded.kind, conversation_id=excluded.conversation_id,
                     mtime_ns=excluded.mtime_ns, size=excluded.size,
                     parsed_at_ms=excluded.parsed_at_ms, status=excluded.status""",
                (str(path), "workbuddy", conversation_id, fp[0], fp[1], now, "ok"),
            )

        con.execute(
            "DELETE FROM workspace WHERE workspace_hash NOT IN "
            "(SELECT DISTINCT workspace_hash FROM conversation)"
        )
        store.set_meta(con, "last_refresh", str(now))
        if not con.execute("SELECT 1 FROM sync_meta WHERE key='last_full_scan'").fetchone():
            store.set_meta(con, "last_full_scan", str(now))

    return {
        "added": added,
        "updated": updated,
        "deleted": len(removed),
        "errors": errors,
        "scanned": len(found),
        "duration_ms": int((time.time() - started) * 1000),
        "db_path": str(db_file),
    }
