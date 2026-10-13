@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PY=backend\.venv\Scripts\python.exe"

if not exist "%PY%" (
    echo [ERROR] Virtualenv not found. Please run:
    echo     cd backend
    echo     python -m venv .venv
    echo     uv pip install --python .venv\Scripts\python.exe -e .
    pause
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo [INFO] Frontend build missing, building...
    pushd frontend
    call pnpm install
    call pnpm build
    popd
)

"%PY%" run.py %*
pause
