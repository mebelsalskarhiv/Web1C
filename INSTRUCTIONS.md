# Web1C Shop - Итоговая инструкция

## ✅ Созданные файлы

### Конфигурация Docker
- `docker-compose.yml` - Основная конфигурация
- `docker-compose.dev.yml` - Development режим
- `apps/web/Dockerfile` - Production Dockerfile для web
- `apps/web/Dockerfile.dev` - Dev Dockerfile для web
- `apps/worker/Dockerfile` - Production Dockerfile для worker
- `apps/worker/Dockerfile.dev` - Dev Dockerfile для worker
- `caddy/Caddyfile` - Конфигурация reverse proxy

### База данных
- `scripts/init-db.sql` - SQL инициализация PostgreSQL
- `packages/database/schema.prisma` - Prisma схема
- `packages/database/prisma/seed.ts` - Seed данные

### Приложение
- `apps/web/src/` - Next.js приложение с Mantine UI
- `apps/worker/src/` - Background worker для синхронизации
- `packages/onec-client/src/` - 1C OData клиент

### Документация
- `README.md` - Главная документация
- `DOCS.md` - Полная документация
- `QUICKSTART.md` - Быстрый старт
- `TROUBLESHOOTING.md` - Решение проблем

### Скрипты
- `start.bat` - Скрипт запуска для Windows
- `start.sh` - Скрипт запуска для Linux/Mac
- `.env.example` - Шаблон переменных окружения

## 🚀 Запуск

### 1. Настроить окружение
```cmd
copy .env.example .env
```

Отредактировать `.env`:
```ini
ONEC_URL=http://your-1c-server:8080/hs/odata
ONEC_USER=odata_user
ONEC_PASSWORD=ваш_пароль
POSTGRES_PASSWORD=web1c_secret
JWT_SECRET=произвольная_строка
```

### 2. Собрать контейнеры
```cmd
docker compose build --no-cache
```

### 3. Запустить
```cmd
docker compose up -d
```

### 4. Инициализировать БД
```cmd
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

### 5. Войти
- URL: http://localhost
- Логин: admin@web1c.local
- Пароль: admin123

## 🔧 Если сборка не работает

### Очистить кэш
```cmd
docker builder prune -f
docker compose build --no-cache
```

### Проверить образы
```cmd
docker images | findstr "node web1c"
```

### Пересобрать заново
```cmd
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## 📁 Структура проекта

```
D:\Work\Web1C\
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
├── DOCS.md
├── QUICKSTART.md
├── TROUBLESHOOTING.md
├── start.bat
├── start.sh
├── caddy/Caddyfile
├── scripts/
│   ├── init-db.sql
│   └── init-prisma.sh
├── apps/
│   ├── web/
│   │   ├── Dockerfile
│   │   ├── Dockerfile.dev
│   │   ├── package.json
│   │   └── src/
│   └── worker/
│       ├── Dockerfile
│       ├── Dockerfile.dev
│       ├── package.json
│       └── src/
└── packages/
    ├── database/
    │   ├── schema.prisma
    │   └── prisma/
    └── onec-client/
        └── src/
```

## 🎯 Возможности

- ✅ Next.js 14 + React 18
- ✅ Mantine v7 UI
- ✅ PostgreSQL 16 + Prisma
- ✅ Redis 7 + BullMQ
- ✅ 1C OData синхронизация
- ✅ Роли: Admin, Partner, Customer
- ✅ Печать PDF с штрих-кодом
- ✅ Excel выгрузка
- ✅ Поиск партнёров по ИНН
- ✅ Склеивание контрагентов

## 📞 Поддержка

При проблемах:
1. См. TROUBLESHOOTING.md
2. Проверьте логи: `docker compose logs -f`
3. Проверьте статус: `docker compose ps`
