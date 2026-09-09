@echo off
setlocal

rem Always run from the folder containing this file.
set "ROOT=%~dp0"
set "PYTHON=%ROOT%.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo [ERROR] Python virtual environment not found:
    echo         %ROOT%.venv
    echo.
    echo Create it first with:
    echo         python -m venv .venv
    echo         See README.md for the Python dependency install command.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
    echo [ERROR] Frontend dependencies are not installed.
    echo Run this once from the project folder:
    echo         cd frontend
    echo         npm install
    pause
    exit /b 1
)

echo Preparing the local database...
call "%PYTHON%" -m backend.migrate
if errorlevel 1 (
    echo [ERROR] Database migration failed.
    pause
    exit /b 1
)

call "%PYTHON%" data\seed_villages.py
if errorlevel 1 (
    echo [ERROR] Village seeding failed.
    pause
    exit /b 1
)

echo Starting DRAIN-GUARD AI...
start "DRAIN-GUARD Backend" /D "%ROOT%" cmd /k ""%PYTHON%" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
start "DRAIN-GUARD Frontend" /D "%ROOT%frontend" cmd /k "npm run dev -- --open"

echo.
echo Backend:  http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo Sensor simulator: run .venv\Scripts\python simulate_sensors.py when needed
exit /b 0
