@echo off
title MineVest Bitcoin Investment Platform
echo ========================================================
echo       Starting MineVest Bitcoin Investment Platform
echo ========================================================
echo.
set "PATH=%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%PATH%"

python -c "import fastapi" 2>nul
if %errorlevel% neq 0 (
    echo Installing missing dependencies...
    python -m pip install -r requirements.txt
)

echo Starting FastAPI server at http://127.0.0.1:8000 ...
echo Press Ctrl+C to stop the server.
echo.
python minevest.py
pause
