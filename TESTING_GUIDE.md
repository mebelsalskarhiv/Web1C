# Руководство по тестированию OData интеграции

## Что было реализовано

### 1. Улучшения в @web1c/onec-client

#### Pagination (поддержка больших объёмов)
- Добавлен параметр `offset` во все методы получения данных
- Методы `getAll*` для автоматической загрузки всех данных
- Пример:
```typescript
// Загрузка товаров с pagination
const products = await client.getProducts({ limit: 500, offset: 0 });

// Загрузка всех товаров автоматически
const allProducts = await client.getAllProducts({ batchSize: 1000 });
```

#### Retry Logic с exponential backoff
- Автоматические повторные попытки при временных ошибках
- Exponential backoff с jitter (1s, 2s, 4s, 8s...)
- Не retry'им ошибки 401, 403, 404
- Настройка через `maxRetries` и `retryDelay`

#### Кэширование метаданных
- Кэширование `$metadata` на 1 час
- Уменьшение нагрузки на 1С
- Автоматическая инвалидация по TTL

#### Детальное логирование
- Логирование всех запросов и ответов
- Информация о времени выполнения, статусах, ошибках
- Console logging с emoji для наглядности

#### Мониторинг
- Встроенный `ODataMonitoringService`
- Статистика запросов в реальном времени
- Health status с рекомендациями

### 2. API Endpoints для мониторинга

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/admin/odata/log` | POST | Логгирование запроса |
| `/api/admin/odata/log` | GET | Получение логов с фильтрацией |
| `/api/admin/odata/stats` | GET | Статистика мониторинга |
| `/api/admin/odata/stats/reset` | POST | Сброс статистики |
| `/api/admin/odata/test` | POST | Тестирование подключения |
| `/api/admin/odata/test` | GET | Получение текущих настроек |

### 3. Обновлённый worker

- Pagination в синхронизации товаров и партнёров
- Консольное логирование прогресса
- Интеграция с monitoring service

---

## План тестирования

### Этап 1: Проверка сборки

```bash
# 1. Остановить контейнеры с очисткой
docker compose down -v

# 2. Запустить сборку
docker compose build --progress=plain

# 3. Проверить логи сборки
# Ошибок компиляции TypeScript быть не должно
```

### Этап 2: Запуск и проверка подключения

```bash
# 1. Запустить контейнеры
docker compose up -d

# 2. Проверить логи
docker compose logs -f app
docker compose logs -f worker

# 3. Проверить доступность
curl http://localhost/api/health
```

### Этап 3: Тестирование подключения к 1С

```bash
# 1. Войти как администратор
# Email: admin@web1c.local, Password: admin123

# 2. Перейти в настройки 1С
# URL: http://localhost/admin/settings

# 3. Нажать "Проверить соединение"
# Или через API:
curl -X POST http://localhost/api/admin/odata/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "http://1c-server:8080/hs/odata",
    "username": "odata_user",
    "password": "password"
  }'
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "totalDuration": 1234,
  "logs": [...],
  "results": {
    "health": { "success": true, "duration": 100 },
    "metadata": { "success": true, "duration": 200 },
    "products": { "success": true, "count": 5, "duration": 300 },
    "partners": { "success": true, "count": 5, "duration": 250 },
    "stocks": { "success": true, "count": 5, "duration": 150 }
  }
}
```

### Этап 4: Мониторинг запросов

```bash
# 1. Получить статистику
curl http://localhost/api/admin/odata/stats

# 2. Получить логи
curl "http://localhost/api/admin/odata/logs?limit=50&status=success"

# 3. Получить только ошибки
curl "http://localhost/api/admin/odata/logs?errors=true"

# 4. Поиск по логам
curl "http://localhost/api/admin/odata/logs?search=products"
```

**Ожидаемая структура ответа:**
```json
{
  "stats": {
    "totalRequests": 150,
    "successfulRequests": 145,
    "failedRequests": 5,
    "retriedRequests": 3,
    "averageDurationMs": 234,
    "requestsPerMinute": 12.5,
    "successRate": 96.7
  },
  "health": {
    "status": "healthy",
    "recommendations": []
  },
  "breakdown": {
    "byEntity": [
      { "entity": "products", "count": 50 },
      { "entity": "partners", "count": 30 }
    ],
    "byError": [
      { "type": "HTTP_503", "count": 3 }
    ]
  }
}
```

### Этап 5: Тестирование синхронизации

```bash
# 1. Запустить синхронизацию товаров
curl -X POST http://localhost/api/admin/sync/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{ "syncType": "products" }'

# 2. Проверить статус сессий
curl http://localhost/api/admin/sync/sessions

# 3. Проверить логи worker
docker compose logs -f worker
```

**Ожидаемые логи worker:**
```
[Sync] Starting products sync (batch size: 500)
[Sync] Processed 500 groups (offset: 0)
[Sync] Processed 500 products (offset: 0)
[Sync] Processed 500 products (offset: 500)
[Sync] Products sync completed: 1500 processed, 0 failed
```

### Этап 6: Проверка pagination

```bash
# 1. Проверить загрузку больших объёмов
# В логах должно быть видно несколько итераций

# 2. Проверить параметр offset в запросах
# В логах OData должны быть URL с $skip=0, $skip=500, $skip=1000 и т.д.
```

### Этап 7: Проверка retry logic

```bash
# 1. Искусственно создать ошибку сети (отключить 1С)
# 2. Запустить тест подключения
# 3. Проверить логи на наличие retry попыток
```

**Ожидаемые логи:**
```
[🔄 1C OData] Retry 1/3 after 1500ms - URL: /Catalogs.Products, Status: 503
[🔄 1C OData] Retry 2/3 after 3200ms - URL: /Catalogs.Products, Status: 503
[✅ 1C OData] GET /Catalogs.Products HTTP 200 234ms
```

---

## Диагностика проблем

### Ошибка компиляции TypeScript

**Симптомы:**
```
error TS2339: Property 'value' does not exist on type 'T'.
```

**Решение:**
Проверить типы в методах API. Убедиться, что используются правильные интерфейсы.

### Ошибка подключения к 1С

**Симптомы:**
```
Error: connect ECONNREFUSED 192.168.1.100:8080
```

**Решение:**
1. Проверить доступность 1С: `curl http://1c-server:8080/hs/odata/$metadata`
2. Проверить учётные данные
3. Проверить права пользователя OData

### Таймауты запросов

**Симптомы:**
```
Error: Timeout of 30000ms exceeded
```

**Решение:**
1. Увеличить `timeout` в конфигурации клиента
2. Оптимизировать запросы в 1С
3. Использовать pagination с меньшим batch size

### Проблемы с Prisma generate

**Симптомы:**
```
Error: request to https://binaries.prisma.sh/... failed
```

**Решение:**
1. Проверить доступ к интернету из контейнера
2. Использовать `--no-cache` при сборке
3. Задать proxy при необходимости

---

## Метрики для мониторинга

### Ключевые показатели

| Метрика | Норма | Критично |
|---------|-------|----------|
| Success Rate | > 95% | < 80% |
| Average Duration | < 3000ms | > 10000ms |
| Retry Rate | < 5% | > 20% |
| Error Rate | < 5% | > 20% |

### Рекомендации при проблемах

| Проблема | Решение |
|----------|---------|
| Высокий процент ошибок | Проверить подключение к 1С, права доступа |
| Большое время ответа | Увеличить timeout, оптимизировать 1С |
| Частые retry | Проверить стабильность сети |
| Pagination не работает | Проверить параметр `$skip` в URL |

---

## Чек-лист готовности

- [ ] Сборка проходит без ошибок
- [ ] Контейнеры запускаются
- [ ] Health check возвращает OK
- [ ] Подключение к 1С работает
- [ ] Метаданные кэшируются
- [ ] Pagination работает (видно в логах)
- [ ] Retry logic работает (проверяется при отключении 1С)
- [ ] Логи записываются в БД
- [ ] API мониторинга возвращает данные
- [ ] Worker обрабатывает задачи синхронизации

---

## Следующие шаги

После успешного тестирования:
1. Проверить работу с реальными данными 1С
2. Замерить производительность синхронизации
3. Настроить алерты по метрикам
4. Документировать выявленные ограничения
