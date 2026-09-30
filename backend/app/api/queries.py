"""聚合查询与过滤器组合，所有端点的数据来源。"""
from datetime import date, datetime, time
from sqlite3 import Connection

from ..config import DB_PATH
from ..db import connect


class Filters:
    def __init__(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        workspaces: list[str] | None = None,
        models: list[str] | None = None,
    ) -> None:
        self.start_date = start_date
        self.end_date = end_date
        self.workspaces = [w for w in (workspaces or []) if w]
        self.models = [m for m in (models or []) if m]

    @property
    def active(self) -> bool:
        return bool(self.start_date or self.end_date or self.workspaces or self.models)

    def clauses(self, alias: str = "r") -> tuple[list[str], list]:
        sql: list[str] = []
        params: list = []
        if self.start_date:
            sql.append(f"{alias}.started_at_ms >= ?")
            params.append(_day_start_ms(self.start_date))
        if self.end_date:
            sql.append(f"{alias}.started_at_ms <= ?")
            params.append(_day_end_ms(self.end_date))
        if self.models:
            sql.append(f"{alias}.model_id IN ({','.join('?' * len(self.models))})")
            params.extend(self.models)
        if self.workspaces:
            sub = (
                "SELECT conversation_id FROM conversation WHERE workspace_hash IN "
                f"({','.join('?' * len(self.workspaces))})"
            )
            sql.append(f"{alias}.conversation_id IN ({sub})")
            params.extend(self.workspaces)
        return sql, params

    def where(self, alias: str = "r", prefix: str = "WHERE") -> tuple[str, list]:
        sql, params = self.clauses(alias)
        if not sql:
            return "", []
        return f" {prefix} " + " AND ".join(sql), params


def _day_start_ms(day: date) -> int:
    return int(datetime.combine(day, time.min).timestamp() * 1000)


def _day_end_ms(day: date) -> int:
    return int(datetime.combine(day, time.max).timestamp() * 1000)


def _filters_query(filters: Filters) -> Filters:
    return filters


def overview(filters: Filters) -> dict:
    where, params = filters.where()
    con = connect()
    try:
        row = con.execute(
            f"""SELECT COUNT(*)                                  AS request_count,
                       COUNT(DISTINCT r.conversation_id)           AS conversation_count,
                       COALESCE(SUM(r.input_tokens), 0)            AS input_tokens,
                       COALESCE(SUM(r.output_tokens), 0)           AS output_tokens,
                       COALESCE(SUM(r.total_tokens), 0)            AS total_tokens,
                       COALESCE(SUM(r.cache_tokens), 0)            AS cache_tokens,
                       COALESCE(SUM(r.cached_miss_tokens), 0)      AS miss_tokens,
                       COALESCE(SUM(r.credit), 0)                  AS credit,
                       MIN(r.started_at_ms)                        AS date_min,
                       MAX(r.started_at_ms)                        AS date_max
                FROM request r {where}""",
            params,
        ).fetchone()

        ws_where, ws_params = filters.where(prefix="AND")
        if filters.active:
            workspace_count = con.execute(
                f"""SELECT COUNT(DISTINCT c.workspace_hash)
                    FROM request r JOIN conversation c ON c.conversation_id = r.conversation_id
                    WHERE 1=1 {ws_where}""",
                ws_params,
            ).fetchone()[0]
        else:
            workspace_count = con.execute(
                "SELECT COUNT(DISTINCT workspace_hash) FROM conversation"
            ).fetchone()[0]

        stat_where, stat_params = filters.where(prefix="AND")
        stat = con.execute(
            f"""SELECT COALESCE(SUM(s.thinking_tokens), 0) AS thinking,
                       AVG(s.elapsed_ms)                  AS avg_elapsed
                FROM message_stat s JOIN request r ON r.request_id = s.request_id
                WHERE 1=1 {stat_where}""",
            stat_params,
        ).fetchone()

        input_tokens = row["input_tokens"] or 0
        if filters.active:
            conversation_count = row["conversation_count"] or 0
        else:
            conversation_count = con.execute(
                "SELECT COUNT(*) FROM conversation"
            ).fetchone()[0]
        return {
            "total_input_tokens": input_tokens,
            "total_output_tokens": row["output_tokens"] or 0,
            "total_tokens": row["total_tokens"] or 0,
            "total_credit": round(row["credit"] or 0.0, 2),
            "request_count": row["request_count"] or 0,
            "conversation_count": conversation_count,
            "workspace_count": workspace_count or 0,
            "cache_hit_ratio": round((row["cache_tokens"] or 0) / input_tokens, 4)
            if input_tokens
            else 0.0,
            "thinking_tokens": stat["thinking"] or 0,
            "avg_elapsed_ms": round(stat["avg_elapsed"] or 0.0, 1),
            "date_min": row["date_min"],
            "date_max": row["date_max"],
        }
    finally:
        con.close()


def timeseries(filters: Filters, granularity: str = "day") -> list[dict]:
    fmt = "%Y-%m-%d" if granularity != "week" else "%Y-W%W"
    where, params = filters.where()
    con = connect()
    try:
        rows = con.execute(
            f"""SELECT strftime('{fmt}', r.started_at_ms / 1000, 'unixepoch', 'localtime') AS bucket,
                       COALESCE(SUM(r.input_tokens), 0)  AS input_tokens,
                       COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(r.total_tokens), 0)  AS total_tokens,
                       COALESCE(SUM(r.credit), 0)        AS credit,
                       COUNT(*)                          AS requests
                FROM request r {where}
                GROUP BY bucket ORDER BY bucket""",
            params,
        ).fetchall()
        return [
            {
                "bucket": r["bucket"],
                "input_tokens": r["input_tokens"],
                "output_tokens": r["output_tokens"],
                "total_tokens": r["total_tokens"],
                "credit": round(r["credit"], 2),
                "requests": r["requests"],
            }
            for r in rows
        ]
    finally:
        con.close()


def projects(filters: Filters) -> list[dict]:
    where, params = filters.where()
    con = connect()
    try:
        rows = con.execute(
            f"""SELECT w.workspace_hash, w.display_name, w.path,
                       COALESCE(SUM(r.input_tokens), 0)  AS input_tokens,
                       COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(r.total_tokens), 0)  AS total_tokens,
                       COALESCE(SUM(r.credit), 0)        AS credit,
                       COUNT(r.request_id)               AS requests,
                       COUNT(DISTINCT r.conversation_id) AS conversations
                FROM request r
                JOIN conversation c ON c.conversation_id = r.conversation_id
                JOIN workspace w ON w.workspace_hash = c.workspace_hash
                {where}
                GROUP BY w.workspace_hash
                ORDER BY total_tokens DESC""",
            params,
        ).fetchall()
        return [
            {
                "workspace_hash": r["workspace_hash"],
                "display_name": r["display_name"],
                "path": r["path"],
                "input_tokens": r["input_tokens"],
                "output_tokens": r["output_tokens"],
                "total_tokens": r["total_tokens"],
                "credit": round(r["credit"], 2),
                "requests": r["requests"],
                "conversations": r["conversations"],
            }
            for r in rows
        ]
    finally:
        con.close()


def models(filters: Filters) -> list[dict]:
    where, params = filters.where()
    con = connect()
    try:
        rows = con.execute(
            f"""SELECT COALESCE(r.model_id, 'unknown') AS model_id,
                       MAX(COALESCE(r.model_name, r.model_id, 'unknown')) AS model_name,
                       COALESCE(SUM(r.input_tokens), 0)  AS input_tokens,
                       COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(r.total_tokens), 0)  AS total_tokens,
                       COALESCE(SUM(r.cache_tokens), 0)  AS cache_tokens,
                       COALESCE(SUM(r.credit), 0)        AS credit,
                       COUNT(*)                          AS requests
                FROM request r {where}
                GROUP BY r.model_id
                ORDER BY total_tokens DESC""",
            params,
        ).fetchall()
        out = []
        for r in rows:
            inp = r["input_tokens"] or 0
            out.append(
                {
                    "model_id": r["model_id"],
                    "model_name": r["model_name"],
                    "input_tokens": inp,
                    "output_tokens": r["output_tokens"],
                    "total_tokens": r["total_tokens"],
                    "credit": round(r["credit"], 2),
                    "requests": r["requests"],
                    "cache_hit_ratio": round(r["cache_tokens"] / inp, 4) if inp else 0.0,
                }
            )
        return out
    finally:
        con.close()


SORT_FIELDS = {
    "ended_at_ms": "c.ended_at_ms",
    "started_at_ms": "c.started_at_ms",
    "total_tokens": "total_tokens",
    "credit": "credit",
    "request_count": "c.request_count",
}


def conversations(
    filters: Filters,
    page: int = 1,
    size: int = 20,
    q: str | None = None,
    sort: str = "ended_at_ms",
    order: str = "desc",
) -> dict:
    order_sql = "DESC" if (order or "desc").lower() != "asc" else "ASC"
    sort_sql = SORT_FIELDS.get(sort, SORT_FIELDS["ended_at_ms"])

    req_clauses, req_params = filters.clauses("r")
    join_filter = (" AND " + " AND ".join(req_clauses)) if req_clauses else ""

    where: list[str] = []
    params: list = list(req_params)
    if q:
        where.append("(c.title LIKE ? OR c.conversation_id LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    having_sql = "HAVING COUNT(r.request_id) > 0" if filters.active else ""

    con = connect()
    try:
        total = con.execute(
            f"""SELECT COUNT(*) FROM (
                    SELECT c.conversation_id
                    FROM conversation c
                    LEFT JOIN request r ON r.conversation_id = c.conversation_id {join_filter}
                    {where_sql}
                    GROUP BY c.conversation_id
                    {having_sql})""",
            params,
        ).fetchone()[0]

        rows = con.execute(
            f"""SELECT c.conversation_id, c.title, c.started_at_ms, c.ended_at_ms,
                       c.request_count, c.message_count,
                       w.workspace_hash, w.display_name, w.path,
                       COALESCE(SUM(r.total_tokens), 0) AS total_tokens,
                       COALESCE(SUM(r.input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(r.output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(r.credit), 0)       AS credit,
                       GROUP_CONCAT(DISTINCT r.model_id) AS models
                FROM conversation c
                JOIN workspace w ON w.workspace_hash = c.workspace_hash
                LEFT JOIN request r ON r.conversation_id = c.conversation_id {join_filter}
                {where_sql}
                GROUP BY c.conversation_id
                {having_sql}
                ORDER BY {sort_sql} {order_sql}
                LIMIT ? OFFSET ?""",
            [*params, size, max(0, (page - 1) * size)],
        ).fetchall()

        items = []
        for r in rows:
            model_ids = sorted({m for m in (r["models"] or "").split(",") if m})
            items.append(
                {
                    "conversation_id": r["conversation_id"],
                    "title": r["title"],
                    "workspace_hash": r["workspace_hash"],
                    "display_name": r["display_name"],
                    "path": r["path"],
                    "started_at_ms": r["started_at_ms"],
                    "ended_at_ms": r["ended_at_ms"],
                    "request_count": r["request_count"],
                    "message_count": r["message_count"],
                    "total_tokens": r["total_tokens"],
                    "input_tokens": r["input_tokens"],
                    "output_tokens": r["output_tokens"],
                    "credit": round(r["credit"], 2),
                    "models": model_ids,
                }
            )
        return {"total": total, "page": page, "size": size, "items": items}
    finally:
        con.close()


def conversation_detail(filters: Filters, conversation_id: str) -> dict | None:
    req_clauses, req_params = filters.clauses("r")
    join_filter = (" AND " + " AND ".join(req_clauses)) if req_clauses else ""
    con = connect()
    try:
        head = con.execute(
            """SELECT c.conversation_id, c.title, c.started_at_ms, c.ended_at_ms,
                      c.request_count, c.message_count,
                      w.workspace_hash, w.display_name, w.path
               FROM conversation c
               JOIN workspace w ON w.workspace_hash = c.workspace_hash
               WHERE c.conversation_id = ?""",
            (conversation_id,),
        ).fetchone()
        if head is None:
            return None

        rows = con.execute(
            f"""SELECT r.request_id, r.started_at_ms, r.model_id, r.model_name,
                       r.input_tokens, r.output_tokens, r.total_tokens,
                       r.cache_tokens, r.cached_miss_tokens, r.last_tokens, r.credit,
                       s.thinking_tokens, s.elapsed_ms, s.agent_message_count
                FROM request r
                LEFT JOIN message_stat s ON s.request_id = r.request_id
                WHERE r.conversation_id = ? {join_filter}
                ORDER BY r.started_at_ms""",
            [conversation_id, *req_params],
        ).fetchall()

        agg = con.execute(
            f"""SELECT COALESCE(SUM(r.total_tokens), 0) AS total_tokens,
                       COALESCE(SUM(r.credit), 0)       AS credit
                FROM request r
                WHERE r.conversation_id = ? {join_filter}""",
            [conversation_id, *req_params],
        ).fetchone()

        requests = [
            {
                "request_id": r["request_id"],
                "started_at_ms": r["started_at_ms"],
                "model_id": r["model_id"],
                "model_name": r["model_name"],
                "input_tokens": r["input_tokens"],
                "output_tokens": r["output_tokens"],
                "total_tokens": r["total_tokens"],
                "cache_tokens": r["cache_tokens"],
                "cached_miss_tokens": r["cached_miss_tokens"],
                "last_tokens": r["last_tokens"],
                "credit": round(r["credit"], 2),
                "thinking_tokens": r["thinking_tokens"] or 0,
                "elapsed_ms": r["elapsed_ms"],
                "agent_message_count": r["agent_message_count"] or 0,
                "cache_hit_ratio": round(r["cache_tokens"] / r["input_tokens"], 4)
                if r["input_tokens"]
                else 0.0,
            }
            for r in rows
        ]

        return {
            "conversation_id": head["conversation_id"],
            "title": head["title"],
            "workspace_hash": head["workspace_hash"],
            "display_name": head["display_name"],
            "path": head["path"],
            "started_at_ms": head["started_at_ms"],
            "ended_at_ms": head["ended_at_ms"],
            "request_count": head["request_count"],
            "message_count": head["message_count"],
            "total_tokens": agg["total_tokens"],
            "credit": round(agg["credit"], 2),
            "requests": requests,
        }
    finally:
        con.close()


def meta(conversation_count_only: bool = False) -> dict:
    con = connect()
    try:
        last = con.execute("SELECT value FROM sync_meta WHERE key='last_refresh'").fetchone()
        workspaces = con.execute(
            "SELECT COUNT(DISTINCT workspace_hash) FROM conversation"
        ).fetchone()[0]
        return {
            "last_refresh_ms": int(last[0]) if last else None,
            "db_path": str(DB_PATH),
            "workspace_count": workspaces,
            "conversation_count": con.execute("SELECT COUNT(*) FROM conversation").fetchone()[0],
        }
    finally:
        con.close()
