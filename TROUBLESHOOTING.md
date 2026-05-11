# Web1C Shop - Решение проблем сборки

## Проблема: Контейнеры не собираются

### Причина 1: Отсутствуют lock файлы
**Симптомы:** Ошибки при копировании package-lock.json или pnpm-lock.yaml

**Решение:**
Dockerfile обновлены - теперь они работают без lock файлов.

### Причина 2: Отсутствует базовый образ Node.js
**Симптомы:** Ошибка "manifest for node:20-alpine not found"

**Решение:**
```cmd
docker pull node:20-alpine
```

### Причина 3: Проблемы с сетью (ECONNRESET)
**Симптомы:** 
```
npm error code ECONNRESET
npm error network request to https://registry.npmjs.org failed
```

**Решение:**
```cmd
# Очистить кэш Docker
docker builder prune -f

# Собрать без кэша
docker compose build --no-cache
```

### Причина 4: Нехватка памяти
**Симптомы:** Сборка прерывается на npm install

**Решение:**
1. Увеличьте память Docker Desktop (Settings → Resources → Memory)
2. Закройте лишние приложения
3. Попробуйте собрать по одному сервису:
```cmd
docker compose build app
docker compose build worker
```

## Проверка статуса сборки

```cmd
# Проверить образы
docker images | findstr "web1c"

# Проверить контейнеры
docker compose ps

# Логи сборки
docker compose logs
```

## Быстрая сборка

```cmd
# 1. Остановить старое
docker compose down

# 2. Очистить кэш
docker builder prune -f

# 3. Собрать
docker compose build --no-cache

# 4. Запустить
docker compose up -d

# 5. Инициализировать БД
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

## Если сборка зависла

1. Подождите 5-10 минут (npm install может быть долгим)
2. Проверьте логи в другом терминале:
   ```cmd
   docker compose logs -f
   ```
3. Если видите повторы ошибок - очистите кэш и попробуйте снова

## Успешная сборка

После успешной сборки вы увидите:
```
✔ Built 4 services
```

Проверьте:
```cmd
docker images | findstr "web1c"
```

Должны быть образы:
- web1c-shop-app
- web1c-shop-worker
- web1c-shop-db (postgres)
- web1c-shop-redis
- web1c-shop-caddy
