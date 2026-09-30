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

SCHEMA_SQL = APP_DIR / "schema.sql"

HEX_ID_RE = r"^[0-9a-f]{32}$"
