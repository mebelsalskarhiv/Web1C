#!/bin/bash
# Web1C Shop - Quick Start Script for Linux/Mac

echo "========================================"
echo "Web1C Shop - Internet store with 1C integration"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker is not running. Please start Docker."
    exit 1
fi

echo "[INFO] Docker is running"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "[INFO] Creating .env from .env.example..."
    cp .env.example .env
    echo "[WARNING] Please edit .env file with your 1C connection settings!"
    echo ""
fi

# Ask user for action
echo "Select action:"
echo "1. Start (production)"
echo "2. Start (development)"
echo "3. Stop"
echo "4. Rebuild"
echo "5. View logs"
echo "6. Open database studio"
echo ""
read -p "Enter choice (1-6): " action

case $action in
    1)
        echo ""
        echo "[INFO] Starting containers (production mode)..."
        docker compose up -d
        echo "[SUCCESS] Containers started!"
        echo ""
        echo "Application URL: http://localhost"
        echo "Admin login: admin@web1c.local"
        echo "Admin password: admin123"
        echo ""
        ;;
    2)
        echo ""
        echo "[INFO] Starting containers (development mode)..."
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up
        echo ""
        ;;
    3)
        echo ""
        echo "[INFO] Stopping containers..."
        docker compose down
        echo "[SUCCESS] Containers stopped!"
        echo ""
        ;;
    4)
        echo ""
        echo "[INFO] Rebuilding containers..."
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        echo "[SUCCESS] Containers rebuilt!"
        echo ""
        ;;
    5)
        echo ""
        echo "[INFO] Viewing logs (press Ctrl+C to exit)..."
        docker compose logs -f
        ;;
    6)
        echo ""
        echo "[INFO] Opening Prisma Studio..."
        docker compose exec app npx prisma studio
        echo ""
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac
