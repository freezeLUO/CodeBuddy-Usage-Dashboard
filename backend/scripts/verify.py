"""端到端对账脚本：用 ground truth 常量与独立 JSON 遍历交叉验证 SQLite 缓存。

用法：
    backend/.venv/Scripts/python.exe backend/scripts/verify.py

退出码非 0 表示校验失败。
"""
import hashlib
import json
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import DATA_ROOT  # noqa: E402
from app.db import connect, init_db  # noqa: E402
from app.refresh import refresh  # noqa: E402

EXPECTED = {
    "input_tokens": 913_734_087,
    "output_tokens": 5_119_598,
    "total_tokens": 918_853_685,
    "credit": 4027.63,
    "requests": 544,
    "conversations": 97,
    "workspaces": 12,
    "message_stat": 542,
    "models": 9,
}

EXPECTED_MODELS = {
    "deepseek-v4-flash": 248,
    "deepseek-v4.1-flash": 207,
    "glm-5.3-flash": 27,
    "hy3": 20,
    "hy4-preview": 17,
    "deepseek-v4-pro": 13,
    "glm-5.3": 6,
    "auto": 5,
    "glm-5.2": 1,
}

failures: list[str] = []
checks = 0


def check(label: str, actual, expected, tolerance: float | None = None) -> None:
    global checks
    checks += 1
    ok = (
        abs(actual - expected) <= tolerance
        if tolerance is not None and isinstance(actual, (int, float))
        else actual == expected
    )
    status = "OK  " if ok else "FAIL"
    print(f"[{status}] {label}: {actual}" + ("" if ok else f"  (期望 {expected})"))
    if not ok:
        failures.append(label)


def db_aggregates() -> dict:
    con = connect()
    try:
        row = con.execute(
            """SELECT COUNT(*) AS requests,
                      COALESCE(SUM(input_tokens), 0)  AS input_tokens,
                      COALESCE(SUM(output_tokens), 0) AS output_tokens,
                      COALESCE(SUM(total_tokens), 0)  AS total_tokens,
                      COALESCE(SUM(cache_tokens), 0)  AS cache_tokens,
                      COALESCE(SUM(credit), 0)        AS credit
               FROM request"""
        ).fetchone()
        return {
            "requests": row["requests"],
            "input_tokens": row["input_tokens"],
            "output_tokens": row["output_tokens"],
            "total_tokens": row["total_tokens"],
            "cache_tokens": row["cache_tokens"],
            "credit": round(row["credit"], 2),
            "conversations": con.execute("SELECT COUNT(*) FROM conversation").fetchone()[0],
            "workspaces": con.execute(
                "SELECT COUNT(DISTINCT workspace_hash) FROM conversation"
            ).fetchone()[0],
            "message_stat": con.execute("SELECT COUNT(*) FROM message_stat").fetchone()[0],
            "models": con.execute("SELECT COUNT(DISTINCT model_id) FROM request").fetchone()[0],
            "identity_violations": con.execute(
                """SELECT COUNT(*) FROM request
                   WHERE total_tokens != input_tokens + output_tokens
                      OR input_tokens != cache_tokens + cached_miss_tokens"""
            ).fetchone()[0],
            "orphan_requests": con.execute(
                """SELECT COUNT(*) FROM request r
                   LEFT JOIN conversation c ON c.conversation_id = r.conversation_id
                   WHERE c.conversation_id IS NULL"""
            ).fetchone()[0],
            "unresolved_workspace": con.execute(
                """SELECT COUNT(*) FROM conversation c
                   LEFT JOIN workspace w ON w.workspace_hash = c.workspace_hash
                   WHERE w.workspace_hash IS NULL"""
            ).fetchone()[0],
        }
    finally:
        con.close()


def independent_walk() -> dict:
    """不复用 app 代码，独立重走一遍 index.json，按 workspace 汇总 token。"""
    per_workspace: dict[str, int] = {}
    totals = {"input": 0, "output": 0, "requests": 0}
    for index_path in DATA_ROOT.glob("*/VSCode/*/history/*/*/index.json"):
        ws_hash = index_path.parent.parent.name
        if len(ws_hash) != 32:
            continue
        try:
            data = json.loads(index_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for req in data.get("requests") or []:
            usage = req.get("usage")
            if req.get("state") != "complete" or not isinstance(usage, dict):
                continue
            totals["input"] += int(usage.get("inputTokens") or 0)
            totals["output"] += int(usage.get("outputTokens") or 0)
            totals["requests"] += 1
            per_workspace[ws_hash] = per_workspace.get(ws_hash, 0) + int(
                usage.get("totalTokens") or 0
            )
    return {"totals": totals, "per_workspace": per_workspace}


def db_per_workspace() -> dict[str, int]:
    con = connect()
    try:
        return {
            row[0]: row[1]
            for row in con.execute(
                """SELECT c.workspace_hash, COALESCE(SUM(r.total_tokens), 0)
                   FROM request r JOIN conversation c ON c.conversation_id = r.conversation_id
                   GROUP BY c.workspace_hash"""
            )
        }
    finally:
        con.close()


def workspace_hash_formula() -> None:
    """校验 md5 公式：对每个 workspace 的 path 反推 hash 必须自洽。"""
    con = connect()
    try:
        rows = con.execute("SELECT workspace_hash, path FROM workspace WHERE path != ''").fetchall()
    finally:
        con.close()
    mismatched = []
    for row in rows:
        q = row["path"].replace("/", "\\")
        if len(q) > 1 and q[1] == ":":
            q = q[0].lower() + q[1:]
        if hashlib.md5(q.encode("utf-8")).hexdigest() != row["workspace_hash"]:
            mismatched.append((row["workspace_hash"], row["path"]))
    check("md5 公式自洽的工作区数量", len(rows) - len(mismatched), len(rows))
    for item in mismatched:
        print(f"       不一致：{item}")


def main() -> int:
    print(f"数据根目录：{DATA_ROOT}")
    if not DATA_ROOT.is_dir():
        print("数据根目录不存在，无法校验。")
        return 2

    init_db()
    print("\n— 增量刷新（第 1 次）—")
    first = refresh()
    print(
        f"  扫描 {first['scanned']} 个会话，更新 {first['updated']}，"
        f"删除 {first['deleted']}，错误 {first['errors']}，耗时 {first['duration_ms']} ms"
    )
    check("刷新错误数", first["errors"], 0)

    print("\n— 增量刷新（第 2 次，应完全无变更）—")
    second = refresh()
    check("幂等：updated", second["updated"], 0)
    check("幂等：deleted", second["deleted"], 0)
    check("幂等：errors", second["errors"], 0)

    print("\n— SQLite 聚合 vs ground truth —")
    agg = db_aggregates()
    for key in ("input_tokens", "output_tokens", "total_tokens", "requests",
                "conversations", "workspaces", "message_stat", "models"):
        check(key, agg[key], EXPECTED[key])
    check("credit", agg["credit"], EXPECTED["credit"], tolerance=0.01)
    check("恒等式违例数", agg["identity_violations"], 0)
    check("孤立 request 数", agg["orphan_requests"], 0)
    check("未解析工作区数", agg["unresolved_workspace"], 0)

    con = connect()
    try:
        cache_ratio = con.execute(
            "SELECT SUM(cache_tokens) * 1.0 / SUM(input_tokens) FROM request"
        ).fetchone()[0]
        model_rows = {
            row[0]: row[1]
            for row in con.execute(
                "SELECT model_id, COUNT(*) FROM request GROUP BY model_id"
            )
        }
    finally:
        con.close()
    check("缓存命中率", round(cache_ratio, 4), 0.9698, tolerance=0.0002)
    for model_id, expected in EXPECTED_MODELS.items():
        check(f"模型请求数 {model_id}", model_rows.get(model_id, 0), expected)

    print("\n— 独立 JSON 遍历交叉核对 —")
    walked = independent_walk()
    check("独立遍历 requests", walked["totals"]["requests"], EXPECTED["requests"])
    check("独立遍历 input", walked["totals"]["input"], EXPECTED["input_tokens"])
    check("独立遍历 output", walked["totals"]["output"], EXPECTED["output_tokens"])

    db_ws = db_per_workspace()
    diff = [
        (hash_, walked["per_workspace"].get(hash_, 0), db_ws.get(hash_, 0))
        for hash_ in set(walked["per_workspace"]) | set(db_ws)
        if walked["per_workspace"].get(hash_, 0) != db_ws.get(hash_, 0)
    ]
    check("按工作区 token 小计一致", len(diff), 0)
    for item in diff:
        print(f"       差异：{item}")
    print(f"  （比对 {len(db_ws)} 个工作区）")

    print("\n— workspaceHash = md5(路径) 公式 —")
    workspace_hash_formula()

    print(f"\n共 {checks} 项检查，失败 {len(failures)} 项。")
    if failures:
        print("失败项：" + "，".join(failures))
        return 1
    print("全部通过。")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    raise SystemExit(main())
