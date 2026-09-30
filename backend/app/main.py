from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .api.routes import router
from .config import FRONTEND_DIST
from .db import connect, init_db
from .refresh import refresh

DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def bootstrap() -> None:
    init_db()
    con = connect()
    try:
        seen = con.execute("SELECT 1 FROM sync_meta WHERE key='last_full_scan'").fetchone()
    finally:
        con.close()
    if not seen:
        refresh()


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap()
    yield


app = FastAPI(title="CodeBuddy Token 看板", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise HTTPException(
            status_code=404,
            detail="前端尚未构建：请在 frontend 目录执行 pnpm build",
        )
    root = FRONTEND_DIST.resolve()
    if full_path:
        target = (root / full_path).resolve()
        if target.is_file() and root in target.parents:
            return FileResponse(target)
    return FileResponse(index)
