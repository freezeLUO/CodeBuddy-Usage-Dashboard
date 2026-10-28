import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent

DB_PATH = Path(os.environ.get("CODEBUDDY_DB", PROJECT_DIR / "data" / "codebuddy_cache.db"))
DATA_ROOT = Path(
    os.environ.get(
        "CODEBUDDY_DATA_ROOT",
        Path(os.environ.get("LOCALAPPDATA", "")) / "CodeBuddyExtension" / "Data",
    )
)
WORKSPACE_STORAGE = Path(
    os.environ.get(
        "CODEBUDDY_WORKSPACE_STORAGE",
        Path(os.environ.get("APPDATA", "")) / "Code" / "User" / "workspaceStorage",
    )
)
FRONTEND_DIST = Path(os.environ.get("CODEBUDDY_DIST", PROJECT_DIR / "frontend" / "dist"))

# WorkBuddy 的本地数据根目录：默认 ~/.workbuddy，内含 projects/<工作区>/<会话>.jsonl
WORKBUDDY_ROOT = Path(os.environ.get("WORKBUDDY_HOME", Path.home() / ".workbuddy"))
# 两个产品的会话主键体系不同，缓存分库存放，切换数据源时互不覆盖
WORKBUDDY_DB_PATH = Path(
    os.environ.get("WORKBUDDY_DB", PROJECT_DIR / "data" / "workbuddy_cache.db")
)
# 数据源开关的持久化位置
SETTINGS_PATH = Path(
    os.environ.get("CODEBUDDY_SETTINGS", PROJECT_DIR / "data" / "settings.json")
)

SCHEMA_SQL = APP_DIR / "schema.sql"

HEX_ID_RE = r"^[0-9a-f]{32}$"
