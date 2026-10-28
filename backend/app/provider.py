"""数据源（CodeBuddy / WorkBuddy）选择与持久化。

两个产品的本地结构完全不同，采集器分别实现；会话主键也各自独立，
因此缓存分库存放，切换数据源时不会互相覆盖。
"""
import json
from pathlib import Path

from .config import DATA_ROOT, DB_PATH, SETTINGS_PATH, WORKBUDDY_DB_PATH, WORKBUDDY_ROOT

PROVIDERS = ("codebuddy", "workbuddy")
DEFAULT_PROVIDER = "codebuddy"
LABELS = {"codebuddy": "CodeBuddy", "workbuddy": "WorkBuddy"}


def normalize(value: object) -> str:
    return value if value in PROVIDERS else DEFAULT_PROVIDER


def current() -> str:
    """读取当前数据源，配置缺失或损坏时回落到 CodeBuddy。"""
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return DEFAULT_PROVIDER
    if not isinstance(data, dict):
        return DEFAULT_PROVIDER
    return normalize(data.get("provider"))


def set_current(value: str) -> str:
    provider = normalize(value)
    payload: dict = {}
    try:
        existing = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        if isinstance(existing, dict):
            payload = existing
    except (OSError, ValueError):
        payload = {}
    payload["provider"] = provider
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return provider


def db_path(value: str | None = None) -> Path:
    return WORKBUDDY_DB_PATH if normalize(value or current()) == "workbuddy" else DB_PATH


def data_root(value: str | None = None) -> Path:
    return WORKBUDDY_ROOT if normalize(value or current()) == "workbuddy" else DATA_ROOT


def label(value: str | None = None) -> str:
    return LABELS[normalize(value or current())]
