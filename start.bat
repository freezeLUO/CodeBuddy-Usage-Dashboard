@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PY=backend\.venv\Scripts\python.exe
if not exist "%PY%" (
    echo [错误] 未找到虚拟环境，请先执行:
    echo     cd backend
    echo     python -m venv .venv
    echo     uv pip install --python .venv\Scripts\python.exe -e .
    pause
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo [提示] 未找到前端产物，正在尝试构建...
    pushd frontend
    call pnpm install
    call pnpm build
    popd
)

"%PY%" run.py %*
pause
