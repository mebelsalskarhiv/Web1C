@echo off
REM Web1C Shop - Quick Start Script for Windows

echo ========================================
echo Web1C Shop - Internet store with 1C integration
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

echo [INFO] Docker is running
echo.

REM Check if .env exists
if not exist .env (
    echo [INFO] Creating .env from .env.example...
    copy .env.example .env
    echo [WARNING] Please edit .env file with your 1C connection settings!
    echo.
)

REM Ask user for action
echo Select action:
echo 1. Start (production)
echo 2. Start (development)
echo 3. Stop
echo 4. Rebuild
echo 5. View logs
echo 6. Open database studio
echo.
set /p action="Enter choice (1-6): "

if "%action%"=="1" goto start
if "%action%"=="2" goto dev
if "%action%"=="3" goto stop
if "%action%"=="4" goto rebuild
if "%action%"=="5" goto logs
if "%action%"=="6" goto studio

echo Invalid choice!
pause
exit /b 1

:start
echo.
echo [INFO] Starting containers (production mode)...
docker compose up -d
echo [SUCCESS] Containers started!
echo.
echo Application URL: http://localhost
echo Admin login: admin@web1c.local
echo Admin password: admin123
echo.
pause
exit /b 0

:dev
echo.
echo [INFO] Starting containers (development mode)...
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
echo.
pause
exit /b 0

:stop
echo.
echo [INFO] Stopping containers...
docker compose down
echo [SUCCESS] Containers stopped!
echo.
pause
exit /b 0

:rebuild
echo.
echo [INFO] Rebuilding containers...
docker compose down
docker compose build --no-cache
docker compose up -d
echo [SUCCESS] Containers rebuilt!
echo.
pause
exit /b 0

:logs
echo.
echo [INFO] Viewing logs (press Ctrl+C to exit)...
docker compose logs -f
pause
exit /b 0

:studio
echo.
echo [INFO] Opening Prisma Studio...
docker compose exec app npx prisma studio
echo.
pause
exit /b 0
