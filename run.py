"""CodeBuddy Token 看板启动入口。

用法：
    python run.py [--port 9000] [--reload] [--no-browser]

前端产物缺失时会提示先构建，但 API 仍可访问（/docs）。
"""
import argparse
import sys
import threading
import time
import webbrowser
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

DIST = PROJECT_DIR / "frontend" / "dist"


def browser_url(host: str, port: int) -> str:
    if host in ("0.0.0.0", "::", ""):
        host = "127.0.0.1"
    return f"http://{host}:{port}"


def open_browser_later(url: str, delay: float = 1.2) -> None:
    """等 uvicorn 起来再开浏览器（reload 模式下父进程只开一次）。"""
    def worker() -> None:
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception as exc:  # 打不开浏览器不影响服务本身
            print(f"[提示] 未能自动打开浏览器（{exc}），请手动访问 {url}")

    threading.Thread(target=worker, daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser(description="CodeBuddy Token 看板")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9000)
    parser.add_argument("--reload", action="store_true", help="开发模式：代码改动自动重启")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    if not (DIST / "index.html").is_file():
        print("[提示] 未找到前端产物 frontend/dist，页面将返回 404。")
        print("       请先执行：cd frontend && pnpm install && pnpm build")

    url = browser_url(args.host, args.port)
    print(f"[启动] {url}   （接口文档 {url}/docs）")
    if not args.no_browser:
        open_browser_later(url)

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        reload_dirs=[str(BACKEND_DIR / "app")] if args.reload else None,
    )


if __name__ == "__main__":
    main()
