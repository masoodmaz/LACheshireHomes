@echo off
setlocal

cd /d "%~dp0"

echo === LA Cheshire Homes ===

if not exist ".env" (
    echo No .env file found - creating one from .env.example.
    copy /y ".env.example" ".env" >nul
    echo Edit .env to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ADMIN_EMAILS before using admin login.
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed. Aborting.
        exit /b 1
    )
)

echo Starting server...
call npm start

endlocal
