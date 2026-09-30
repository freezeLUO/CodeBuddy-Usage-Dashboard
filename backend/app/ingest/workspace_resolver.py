"""workspaceHash -> 项目路径映射。

hash = md5(utf8(path))，其中 path 为工作区完整路径，把 "/" 换成 "\\"、盘符小写、
去掉前导反斜杠。无工作区窗口（没有打开文件夹）时 hash = md5("\\")。
"""
import hashlib
import json
import re
import urllib.parse
from pathlib import Path

from ..config import WORKSPACE_STORAGE

NO_WORKSPACE_HASH = hashlib.md5("\\".encode("utf-8")).hexdigest()
NO_WORKSPACE_PATH = ""
NO_WORKSPACE_NAME = "未打开工作区"

# 首次运行时磁盘上已存在的工作区（workspaceStorage 只覆盖其中 12 个），作为兜底
SEED_WORKSPACES: dict[str, str] = {
    "145290e66bdce338a41347fdb773ef6a": "c:/Users/freeze/Desktop/xuqiu/re-1",
    "30afc478f522ad65c30b730032f17ba5": "c:/Users/freeze/Desktop/xuqiu/re-web-2/re-web-2",
    "44ef7dc06abefedfc46c2ad391bd704f": "c:/Users/freeze/Desktop/xuqiu/打包/re-web-打包",
    "56701f7ce0248e73e303d378be596ee5": "c:/Users/freeze/Desktop/xuqiu/re-backend",
    "5b5befddbb77703107721d7877aac74e": "d:/REV2/re-backend",
    "5f7adcd81eb70aeee3f3a5e43e735b6e": "d:/办公/github收集/github_matlab_simulink_collector",
    "6d8585222dfb544ffcce392f349468fb": "d:/xuqiu/re-web",
    "7f4fad2e8c9f3f78e10a9af2ed0b8652": "c:/Users/freeze/Desktop/xuqiu/AI汇报",
    "95df0e7437ce4fc9e1e95db68f67ff5a": "c:/Users/freeze/Desktop/xuqiu/re-web",
    "b3c35bc6b8a28dd063fef0fb036e82d7": "d:/jishang/integration-service",
    "d3eacff9a0b2ae60836e0e3c46362caa": "c:/Users/freeze/Desktop/xuqiu/需求组件项目开发AI使用情况",
    "f7c2e14efcbf883c02f9f48b716b71c5": "d:/REV2/re-web",
    "28d397e87306b8631f3ed80d858d35f0": "",
}


def hash_for_path(path: str) -> str:
    q = path.replace("/", "\\")
    if len(q) > 1 and q[1] == ":":
        q = q[0].lower() + q[1:]
    if q.startswith("\\") and not (len(q) > 1 and q[1] == ":"):
        q = q.lstrip("\\") or "\\"
    return hashlib.md5(q.encode("utf-8")).hexdigest()


def _display_name(path: str) -> str:
    if not path:
        return NO_WORKSPACE_NAME
    p = Path(path)
    return p.name or str(p)


def _from_workspace_storage() -> dict[str, str]:
    found: dict[str, str] = {}
    if not WORKSPACE_STORAGE.is_dir():
        return found
    for wj in WORKSPACE_STORAGE.glob("*/workspace.json"):
        try:
            data = json.loads(wj.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        folder = data.get("folder")
        if not folder:
            continue
        path = urllib.parse.unquote(re.sub(r"^file:///", "", folder))
        found[hash_for_path(path)] = path
    return found


def resolve(needed_hashes: set[str]) -> list[tuple[str, str, str, str]]:
    """返回 [(hash, path, display_name, source)]，包含 needed_hashes 中所有能解析的项。"""
    paths = dict(SEED_WORKSPACES)
    sources = {h: "seed" for h in SEED_WORKSPACES}
    for h, p in _from_workspace_storage().items():
        paths[h] = p
        sources[h] = "storage"

    for h in needed_hashes:
        if h not in paths:
            if h == NO_WORKSPACE_HASH:
                paths[h] = NO_WORKSPACE_PATH
            else:
                paths[h] = f"unknown/{h}"
            sources[h] = "unknown"

    names: dict[str, str] = {h: _display_name(p) for h, p in paths.items()}
    counts: dict[str, int] = {}
    for name in names.values():
        counts[name] = counts.get(name, 0) + 1
    for h, name in names.items():
        if counts[name] > 1:
            parent = Path(paths[h]).parent.name if paths[h] else ""
            names[h] = f"{name} ({parent})" if parent else name

    return [(h, paths[h], names[h], sources[h]) for h in sorted(paths)]
