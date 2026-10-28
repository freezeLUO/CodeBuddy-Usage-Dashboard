from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .api.routes import router
from .config import FRONTEND_DIST
from .db import init_db
from .refresh import refresh

DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def bootstrap() -> None:
    """建表后总是跑一次增量刷新，保证每次启动看到的都是磁盘最新数据。"""
    init_db()
    try:
        stats = refresh()
    except Exception as exc:  # 刷新失败不应阻止服务启动，继续用库里的旧数据
        print(f"[警告] 启动刷新失败，将沿用缓存数据：{exc}")
        return
    print(
        "[刷新] 更新 {updated} / 删除 {deleted} / 错误 {errors}，"
        "扫描 {scanned} 个会话，耗时 {duration_ms}ms".format(**stats)
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap()
    yield


app = FastAPI(title="CodeBuddy / WorkBuddy 用量看板", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


# 文件名带 hash 的产物可以长期缓存；index.html 必须每次回源校验，
# 否则重新构建后浏览器仍用旧 HTML，引用到已删除的 chunk 会让页面/路由打不开。
IMMUTABLE = {"Cache-Control": "public, max-age=31536000, immutable"}
NO_CACHE = {"Cache-Control": "no-cache, must-revalidate"}


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
            headers = IMMUTABLE if full_path.startswith("assets/") else NO_CACHE
            return FileResponse(target, headers=headers)
    return FileResponse(index, headers=NO_CACHE)
