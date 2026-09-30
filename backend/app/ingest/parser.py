"""会话解析：index.json + 最小读取集的 message 文件。"""
import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from .scanner import ConvRef, message_path

USER_QUERY_RE = re.compile(r"<user_query>(.*?)</user_query>", re.S)
_USAGE_KEYS = (
    "inputTokens",
    "outputTokens",
    "totalTokens",
    "cacheTokens",
    "cachedWriteTokens",
    "cachedMissTokens",
    "lastTokens",
    "credit",
)


@dataclass
class ParsedRequest:
    request_id: str
    started_at_ms: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cache_tokens: int
    cached_write_tokens: int
    cached_miss_tokens: int
    last_tokens: int
    credit: float
    model_id: str | None = None
    model_name: str | None = None
    message_id: str | None = None
    stat: dict[str, Any] | None = None


@dataclass
class ParsedConversation:
    conversation_id: str
    workspace_hash: str
    title: str | None
    started_at_ms: int | None
    ended_at_ms: int | None
    message_count: int
    requests: list[ParsedRequest] = field(default_factory=list)


def _read_json(path: Path, retries: int = 2) -> Any | None:
    """容错读取：VSCode 运行中会原地重写文件，失败就本轮跳过、下轮重试。"""
    for attempt in range(retries + 1):
        try:
            with open(path, "rb") as fh:
                return json.loads(fh.read().decode("utf-8"))
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            if attempt == retries:
                return None
            time.sleep(0.05)
    return None


def iso_to_ms(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


def parse_extra(raw: Any) -> dict:
    """extra 永远是 JSON 字符串，需要二次 loads。"""
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _collect_text(node: Any, out: list[str], depth: int = 0) -> None:
    if depth > 8:
        return
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, dict):
        for key in ("text", "content", "value"):
            if key in node:
                _collect_text(node[key], out, depth + 1)
    elif isinstance(node, list):
        for item in node:
            _collect_text(item, out, depth + 1)


def extract_title(message_raw: Any) -> str | None:
    text = ""
    if isinstance(message_raw, str):
        try:
            parsed = json.loads(message_raw)
        except json.JSONDecodeError:
            parsed = message_raw
        parts: list[str] = []
        _collect_text(parsed, parts)
        text = "\n".join(parts)
    elif isinstance(message_raw, dict):
        parts = []
        _collect_text(message_raw, parts)
        text = "\n".join(parts)

    match = USER_QUERY_RE.search(text)
    if match:
        title = " ".join(match.group(1).split())
        if title:
            return title[:200]
    return None


def read_message(path: Path) -> dict | None:
    """读取单个 message 文件，返回模型/用量/标题所需的最小信息。"""
    data = _read_json(path)
    if not isinstance(data, dict):
        return None
    extra = parse_extra(data.get("extra"))
    snapshot = extra.get("statsSnapshot")
    if not isinstance(snapshot, dict):
        snapshot = None
    return {
        "message_id": data.get("id") or path.stem,
        "role": data.get("role"),
        "created_at_ms": iso_to_ms(data.get("createdAt")),
        "request_id": extra.get("requestId"),
        "model_id": extra.get("modelId"),
        "model_name": extra.get("modelName"),
        "agent_message_count": extra.get("agentMessageCount"),
        "last_step_input_tokens": extra.get("lastStepInputTokens"),
        "last_step_output_tokens": extra.get("lastStepOutputTokens"),
        "last_step_cached_input_tokens": extra.get("lastStepCachedInputTokens"),
        "snapshot": snapshot,
        "title": extract_title(data.get("message")),
        "input_phrase": _normal_phrase(extra),
    }


def _normal_phrase(extra: dict) -> str | None:
    phrases = extra.get("inputPhrase")
    if isinstance(phrases, list):
        for item in phrases:
            if isinstance(item, dict) and item.get("type") == "normal":
                text = item.get("content") or item.get("text")
                if isinstance(text, str) and text.strip():
                    return " ".join(text.split())[:200]
    return None


def read_index(path: Path) -> tuple[list[dict], list[dict]] | None:
    data = _read_json(path)
    if not isinstance(data, dict):
        return None
    messages = data.get("messages")
    requests = data.get("requests")
    return (
        messages if isinstance(messages, list) else [],
        requests if isinstance(requests, list) else [],
    )


def _roles(messages: list[dict]) -> dict[str, str]:
    roles: dict[str, str] = {}
    for msg in messages:
        if isinstance(msg, dict) and isinstance(msg.get("id"), str):
            roles[msg["id"]] = msg.get("role") or ""
    return roles


def _snapshot_message_id(ids: list[str], roles: dict[str, str]) -> str | None:
    """statsSnapshot 挂在请求内最后一个 assistant 消息上（末位常是 tool 结果）。"""
    for mid in reversed(ids):
        if roles.get(mid) == "assistant":
            return mid
    return ids[-1] if ids else None


def message_read_plan(messages: list[dict], requests: list[dict]) -> dict[str, str]:
    """最小读取集：{message_id: 用途}。用途为 'title' 或 'usage'。"""
    plan: dict[str, str] = {}

    for msg in messages:
        if isinstance(msg, dict) and msg.get("role") == "user" and msg.get("id"):
            plan[msg["id"]] = "title"
            break

    roles = _roles(messages)
    for req in requests:
        if not isinstance(req, dict):
            continue
        if req.get("state") != "complete" or not isinstance(req.get("usage"), dict):
            continue
        ids = [mid for mid in req.get("messages") or [] if isinstance(mid, str)]
        target = _snapshot_message_id(ids, roles)
        if target:
            plan[target] = "usage"
    return plan


def build_conversation(
    conv: ConvRef,
    messages: list[dict],
    requests: list[dict],
    loaded: dict[str, dict],
) -> ParsedConversation:
    parsed = ParsedConversation(
        conversation_id=conv.conversation_id,
        workspace_hash=conv.workspace_hash,
        title=None,
        started_at_ms=None,
        ended_at_ms=None,
        message_count=len(messages),
    )

    title_candidates: list[tuple[int, str]] = []
    created_times: list[int] = []
    for mid, info in loaded.items():
        if info.get("title"):
            title_candidates.append((info.get("created_at_ms") or 0, info["title"]))
        elif info.get("input_phrase"):
            title_candidates.append((info.get("created_at_ms") or 0, info["input_phrase"]))
        if info.get("created_at_ms"):
            created_times.append(info["created_at_ms"])

    if title_candidates:
        parsed.title = min(title_candidates, key=lambda x: x[0])[1]

    roles = _roles(messages)
    for req in requests:
        if not isinstance(req, dict):
            continue
        if req.get("state") != "complete":
            continue
        usage = req.get("usage")
        if not isinstance(usage, dict) or not usage:
            continue
        started = req.get("startedAt")
        if not isinstance(started, (int, float)):
            continue
        ids = [mid for mid in req.get("messages") or [] if isinstance(mid, str)]
        last_id = _snapshot_message_id(ids, roles)
        info = loaded.get(last_id) if last_id else None

        snapshot = info.get("snapshot") if info else None
        stat = None
        if info and snapshot:
            stat = {
                "message_id": info.get("message_id") or last_id,
                "stat_input_tokens": (snapshot or {}).get("inputTokens"),
                "stat_output_tokens": (snapshot or {}).get("outputTokens"),
                "stat_cached_input_tokens": (snapshot or {}).get("cachedInputTokens"),
                "thinking_tokens": (snapshot or {}).get("thinkingTokens"),
                "elapsed_ms": (snapshot or {}).get("elapsedMs"),
                "last_output_tokens": (snapshot or {}).get("lastOutputTokens"),
                "agent_message_count": info.get("agent_message_count"),
                "credit": (snapshot or {}).get("credit"),
            }
        if info and info.get("created_at_ms"):
            created_times.append(info["created_at_ms"])

        parsed.requests.append(
            ParsedRequest(
                request_id=str(req.get("id")),
                started_at_ms=int(started),
                input_tokens=int(usage.get("inputTokens") or 0),
                output_tokens=int(usage.get("outputTokens") or 0),
                total_tokens=int(usage.get("totalTokens") or 0),
                cache_tokens=int(usage.get("cacheTokens") or 0),
                cached_write_tokens=int(usage.get("cachedWriteTokens") or 0),
                cached_miss_tokens=int(usage.get("cachedMissTokens") or 0),
                last_tokens=int(usage.get("lastTokens") or 0),
                credit=float(usage.get("credit") or 0.0),
                model_id=info.get("model_id") if info else None,
                model_name=info.get("model_name") if info else None,
                message_id=last_id,
                stat=stat,
            )
        )

    starts = [r.started_at_ms for r in parsed.requests]
    ends = [r.started_at_ms for r in parsed.requests]
    if created_times:
        starts.append(min(created_times))
        ends.append(max(created_times))
    parsed.started_at_ms = min(starts) if starts else None
    parsed.ended_at_ms = max(ends) if ends else None
    return parsed


def usage_keys() -> tuple[str, ...]:
    return _USAGE_KEYS
