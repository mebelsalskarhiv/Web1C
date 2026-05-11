# Web1C Shop - Инструкция по запуску

## Быстрый старт (Windows)

### Шаг 1: Проверка требований
```cmd
docker --version
docker compose version
```

### Шаг 2: Настройка окружения
```cmd
copy .env.example .env
```

Откройте `.env` и укажите:
```ini
ONEC_URL=http://your-1c-server:8080/hs/odata
ONEC_USER=odata_user
ONEC_PASSWORD=ваш_пароль
POSTGRES_PASSWORD=web1c_secret
JWT_SECRET=произвольная_секретная_строка
```

### Шаг 3: Запуск (варианты)

#### Вариант A - Использование скрипта:
```cmd
start.bat
```

#### Вариант B - Ручной запуск:

1. Сборка и запуск:
```cmd
docker compose up -d --build
```

2. Для разработки с hot-reload:
```cmd
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Шаг 4: Инициализация БД
```cmd
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate
docker compose exec app npx prisma db seed
```

### Шаг 5: Вход в систему
- URL: http://localhost
- Логин: `admin@web1c.local`
- Пароль: `admin123`

## Решение проблем

### Ошибка сети при сборке (ECONNRESET)
```cmd
# Очистить кэш Docker
docker builder prune -f

# Пересобрать без кэша
docker compose build --no-cache
```

### Ошибка Prisma generate
```cmd
# Запустить вручную внутри контейнера
docker compose exec app npx prisma generate
```

### Контейнер не запускается
```cmd
# Проверить логи
docker compose logs app

# Перезапустить
docker compose restart app
```

### Проверка статуса
```cmd
docker compose ps
docker compose logs -f
```

## Остановка
```cmd
docker compose down
```

## Полная переустановка
```cmd
docker compose down -v
docker compose build --no-cache
docker compose up -d
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```
