# Алгоритм обмена 1С-ODATA

## 1. Анализ текущей архитектуры

### 1.1. Компоненты системы

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web1C System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Next.js    │  │   Worker     │  │   PostgreSQL         │  │
│  │   API Routes │  │   BullMQ     │  │   Prisma ORM         │  │
│  │              │  │              │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └────────────┬────┴──────────────────────┘              │
│                      │                                          │
│         ┌────────────▼────────┐                                │
│         │   @web1c/onec-client │                                │
│         │   (OData Client)     │                                │
│         └────────────┬────────┘                                │
│                      │                                          │
└──────────────────────┼──────────────────────────────────────────┘
                       │ HTTPS + Basic Auth
                       ▼
         ┌─────────────────────────┐
         │   1С:УТ 11.5 OData      │
         │   /hs/odata             │
         └─────────────────────────┘
```

### 1.2. Существующие сущности OData

| Сущность | 1C EntitySet | Описание |
|----------|--------------|----------|
| Products | `Catalogs.Products` | Номенклатура (товары + группы) |
| ProductGroups | `Catalogs.ProductGroups` | Группы товаров |
| Prices | `InformationRegisters.Prices` | Цены номенклатуры |
| Stocks | `InformationRegisters.Stocks` | Остатки товаров |
| Partners | `Catalogs.Partners` | Контрагенты/Партнёры |
| Orders | `Documents.SalesOrder` | Заказы клиентов |
| Realizations | `Documents.Realization` | Реализации (отгрузки) |
| ProductImages | `InformationRegisters.ProductImages` | Изображения товаров |

### 1.3. Текущая реализация (onec-client/src/index.ts)

**Реализовано:**
- ✅ Подключение к 1С OData с Basic Auth
- ✅ Автоматическое определение EntitySet через метаданные
- ✅ Получение товаров, групп, цен, остатков, партнёров, заказов
- ✅ Health check подключения
- ✅ Пакетная обработка (batch operations)

**Проблемы текущей реализации:**
1. ❌ Нет обработки pagination ($top, $skip) для больших объёмов
2. ❌ Нет retry logic при временных ошибках сети
3. ❌ Нет кэширования метаданных
4. ❌ Нет поддержки $expand для связанных данных
5. ❌ Нет обработки специфичных ошибок 1С
6. ❌ Нет логгирования запросов для отладки

---

## 2. Алгоритм синхронизации

### 2.1. Общая схема процесса синхронизации

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESS: Full Sync                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                                               │
│  │  1. Init    │ ──── Создание сессии синхронизации            │
│  └──────┬──────┘       (SyncSession: pending)                  │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  2. Check   │ ──── Проверка подключения к 1С                │
│  │  Connection │       (healthCheck)                           │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  3. Groups  │ ──── Синхронизация групп товаров              │
│  │  Sync       │       (Catalogs.ProductGroups)                │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  4. Products│ ──── Синхронизация товаров                    │
│  │  Sync       │       (Catalogs.Products)                     │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  5. Prices  │ ──── Синхронизация цен                        │
│  │  Sync       │       (InformationRegisters.Prices)           │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  6. Stocks  │ ──── Синхронизация остатков                   │
│  │  Sync       │       (InformationRegisters.Stocks)           │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  7. Partners│ ──── Синхронизация партнёров                  │
│  │  Sync       │       (Catalogs.Partners)                     │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  8. Orders  │ ──── Синхронизация заказов                    │
│  │  Sync       │       (Documents.SalesOrder)                  │
│  └──────┬──────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │  9. Update  │ ──── Обновление статуса сессии               │
│  │  Session    │       (SyncSession: completed/failed)         │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2. Детальный алгоритм для каждой сущности

#### 2.2.1. Синхронизация групп товаров (ProductGroups)

```typescript
ALGORITHM SyncProductGroups(modifiedSince?: DateTime):
  INPUT:
    - modifiedSince: DateTime (опционально, для инкрементальной синхронизации)
  
  OUTPUT:
    - processed: Integer (количество обработанных)
    - failed: Integer (количество ошибок)
    - errors: Array<SyncError>
  
  STEPS:
  1. GET EntitySet для групп
     entitySet ← resolveEntitySet('productGroups')
  
  2. Формирование параметров запроса
     params ← new URLSearchParams()
     filters ← []
     
     IF modifiedSince IS SET:
       filters.ADD("ModifiedDateTime gt datetime'{modifiedSince}'")
     
     IF entitySet == productsEntitySet:
       filters.ADD("IsFolder eq true")
     
     IF filters NOT EMPTY:
       params.SET('$filter', JOIN(filters, ' and '))
     
     params.SET('$top', '1000')
  
  3. Выполнение запроса к 1С
     TRY:
       response ← GET /{entitySet}?{params}
       groups ← response.value
     CATCH error:
       IF error IS 400 AND entitySet == productsEntitySet:
         RETRY без фильтра IsFolder
         groups ← FILTER(response.value, item => item.IsFolder == true)
       ELSE:
         THROW error
  
  4. Обработка каждой группы
     FOR EACH group IN groups:
       TRY:
         parentGroup ← NULL
         IF group.Parent_Key IS SET:
           parentGroup ← FIND Group BY guid1c = group.Parent_Key
         
         UPSERT INTO product_groups:
           guid1c: group.Ref_Key
           name1c: group.Description
           parentId: parentGroup.id
           depth: CALCULATE_DEPTH(parentGroup)
           updatedAt: NOW()
         
         processed ← processed + 1
         LOG_SYNC(sessionId, 'product_groups', group.Ref_Key, 'completed')
       
       CATCH error:
         failed ← failed + 1
         errors.ADD({
           entity: 'product_group',
           guid: group.Ref_Key,
           error: error.message
         })
         LOG_SYNC(sessionId, 'product_groups', group.Ref_Key, 'failed', error.message)
  
  5. RETURN { processed, failed, errors }
```

#### 2.2.2. Синхронизация товаров (Products)

```typescript
ALGORITHM SyncProducts(modifiedSince?: DateTime):
  INPUT:
    - modifiedSince: DateTime (опционально)
  
  OUTPUT:
    - processed: Integer
    - failed: Integer
    - errors: Array<SyncError>
  
  STEPS:
  1. GET EntitySet для товаров
     entitySet ← resolveEntitySet('products')
  
  2. Формирование параметров запроса
     params ← new URLSearchParams()
     filters ← []
     
     IF modifiedSince IS SET:
       filters.ADD("ModifiedDateTime gt datetime'{modifiedSince}'")
     
     IF entitySet == groupsEntitySet:
       filters.ADD("IsFolder eq false")
     
     IF filters NOT EMPTY:
       params.SET('$filter', JOIN(filters, ' and '))
     
     params.SET('$top', '1000')
  
  3. Выполнение запроса к 1С
     TRY:
       response ← GET /{entitySet}?{params}
       products ← response.value
     CATCH error:
       IF error IS 400 AND entitySet == groupsEntitySet:
         RETRY без фильтра IsFolder
         products ← FILTER(response.value, item => item.IsFolder == false)
       ELSE:
         THROW error
  
  4. Обработка каждого товара
     FOR EACH product IN products:
       TRY:
         group ← NULL
         IF product.Parent_Key IS SET:
           group ← FIND Group BY guid1c = product.Parent_Key
         
         UPSERT INTO products:
           guid1c: product.Ref_Key
           article: product.Code
           name: product.Description
           groupId: group.id
           baseUnit1c: product.BaseUnit_Key
           isService: product.IsService OR false
           isMarked: product.IsMarked OR false
           isActive: NOT (product.IsMarked OR false)
           lastSyncAt: NOW()
         
         processed ← processed + 1
         LOG_SYNC(sessionId, 'products', product.Ref_Key, 'completed')
       
       CATCH error:
         failed ← failed + 1
         errors.ADD({
           entity: 'product',
           guid: product.Ref_Key,
           error: error.message
         })
         LOG_SYNC(sessionId, 'products', product.Ref_Key, 'failed', error.message)
  
  5. RETURN { processed, failed, errors }
```

#### 2.2.3. Синхронизация цен (Prices)

```typescript
ALGORITHM SyncPrices(modifiedSince?: DateTime, priceType?: String):
  INPUT:
    - modifiedSince: DateTime (опционально)
    - priceType: String (GUID типа цены, опционально)
  
  OUTPUT:
    - processed: Integer
    - failed: Integer
    - errors: Array<SyncError>
  
  STEPS:
  1. GET EntitySet для цен
     entitySet ← resolveEntitySet('prices')
  
  2. Формирование параметров запроса
     params ← new URLSearchParams()
     filters ← []
     
     IF priceType IS SET:
       filters.ADD("PriceType_Key eq guid'{priceType}'")
     
     IF modifiedSince IS SET:
       filters.ADD("ModifiedDateTime gt datetime'{modifiedSince}'")
     
     IF filters NOT EMPTY:
       params.SET('$filter', JOIN(filters, ' and '))
     
     params.SET('$top', '1000')
  
  3. Выполнение запроса к 1С
     response ← GET /{entitySet}?{params}
     prices ← response.value
  
  4. Обработка каждой цены
     FOR EACH price IN prices:
       TRY:
         product ← FIND Product BY guid1c = price.Product_Key
         
         IF product IS NOT NULL:
           UPSERT INTO product_stocks:
             productId: product.id
             warehouseGuid1c: 'default'
             priceType: price.PriceType_Key
             retailPrice: price.Price
             lastSyncAt: NOW()
           
           processed ← processed + 1
           LOG_SYNC(sessionId, 'prices', price.Product_Key, 'completed')
       
       CATCH error:
         failed ← failed + 1
         errors.ADD({
           entity: 'price',
           guid: price.Product_Key,
           error: error.message
         })
         LOG_SYNC(sessionId, 'prices', price.Product_Key, 'failed', error.message)
  
  5. RETURN { processed, failed, errors }
```

#### 2.2.4. Синхронизация остатков (Stocks)

```typescript
ALGORITHM SyncStocks(modifiedSince?: DateTime, warehouseGuid?: String):
  INPUT:
    - modifiedSince: DateTime (опционально)
    - warehouseGuid: String (опционально, фильтр по складу)
  
  OUTPUT:
    - processed: Integer
    - failed: Integer
    - errors: Array<SyncError>
  
  STEPS:
  1. GET EntitySet для остатков
     entitySet ← resolveEntitySet('stocks')
  
  2. Формирование параметров запроса
     params ← new URLSearchParams()
     filters ← []
     
     IF warehouseGuid IS SET:
       filters.ADD("Warehouse_Key eq guid'{warehouseGuid}'")
     
     IF modifiedSince IS SET:
       filters.ADD("ModifiedDateTime gt datetime'{modifiedSince}'")
     
     IF filters NOT EMPTY:
       params.SET('$filter', JOIN(filters, ' and '))
     
     params.SET('$top', '1000')
  
  3. Выполнение запроса к 1С
     response ← GET /{entitySet}?{params}
     stocks ← response.value
  
  4. Обработка каждой записи об остатках
     FOR EACH stock IN stocks:
       TRY:
         product ← FIND Product BY guid1c = stock.Product_Key
         
         IF product IS NOT NULL:
           UPSERT INTO product_stocks:
             productId: product.id
             warehouseGuid1c: stock.Warehouse_Key
             warehouseName: GET_WAREHOUSE_NAME(stock.Warehouse_Key)
             quantity: stock.Quantity
             reserved: 0
             available: stock.Quantity
             lastSyncAt: NOW()
           
           processed ← processed + 1
           LOG_SYNC(sessionId, 'stocks', stock.Product_Key, 'completed')
       
       CATCH error:
         failed ← failed + 1
         errors.ADD({
           entity: 'stock',
           guid: stock.Product_Key,
           error: error.message
         })
         LOG_SYNC(sessionId, 'stocks', stock.Product_Key, 'failed', error.message)
  
  5. RETURN { processed, failed, errors }
```

#### 2.2.5. Синхронизация партнёров (Partners)

```typescript
ALGORITHM SyncPartners(modifiedSince?: DateTime, inn?: String):
  INPUT:
    - modifiedSince: DateTime (опционально)
    - inn: String (опционально, для поиска по ИНН)
  
  OUTPUT:
    - processed: Integer
    - failed: Integer
    - errors: Array<SyncError>
  
  STEPS:
  1. GET EntitySet для партнёров
     entitySet ← resolveEntitySet('partners')
  
  2. Формирование параметров запроса
     params ← new URLSearchParams()
     filters ← []
     
     IF inn IS SET:
       filters.ADD("INN eq '{inn}'")
     
     IF modifiedSince IS SET:
       filters.ADD("ModifiedDateTime gt datetime'{modifiedSince}'")
     
     IF filters NOT EMPTY:
       params.SET('$filter', JOIN(filters, ' and '))
     
     params.SET('$top', '1000')
  
  3. Выполнение запроса к 1С
     response ← GET /{entitySet}?{params}
     partners ← response.value
  
  4. Обработка каждого партнёра
     FOR EACH partner IN partners:
       TRY:
         UPSERT INTO partners:
           guid1c: partner.Ref_Key
           inn: partner.INN
           kpp: partner.KPP
           nameFull: partner.Description
           nameShort: partner.FullName
           addressLegal: partner.Address
           addressPostal: partner.Address
           phoneMain: partner.Phone
           phoneMobile: partner.Phone
           email: partner.Email
           contactPerson: partner.ContactPerson_Key
           lastSyncAt: NOW()
         
         processed ← processed + 1
         LOG_SYNC(sessionId, 'partners', partner.Ref_Key, 'completed')
       
       CATCH error:
         failed ← failed + 1
         errors.ADD({
           entity: 'partner',
           guid: partner.Ref_Key,
           error: error.message
         })
         LOG_SYNC(sessionId, 'partners', partner.Ref_Key, 'failed', error.message)
  
  5. RETURN { processed, failed, errors }
```

#### 2.2.6. Синхронизация заказов (Orders)

```typescript
ALGORITHM SyncOrders(modifiedSince?: DateTime, partnerGuid?: String):
  INPUT:
    - modifiedSince: DateTime (опционально)
    - partnerGuid: String (опционально, фильтр по партнёру)
  
  OUTPUT:
    - processed: Integer
    - failed: Integer
    - errors: Array<SyncError>
  
  STEPS:
  1. GET EntitySet для заказов
     entitySet ← resolveEntitySet('orders')
  
  2. Формирование параметров запроса
     params ← new URLSearchParams()
     filters ← []
     
     IF partnerGuid IS SET:
       filters.ADD("Partner_Key eq guid'{partnerGuid}'")
     
     IF modifiedSince IS SET:
       filters.ADD("Date ge datetime'{modifiedSince}'")
     
     IF filters NOT EMPTY:
       params.SET('$filter', JOIN(filters, ' and '))
     
     params.SET('$orderby', 'Date desc')
     params.SET('$top', '1000')
  
  3. Выполнение запроса к 1С
     response ← GET /{entitySet}?{params}
     orders ← response.value
  
  4. Обработка каждого заказа
     FOR EACH order IN orders:
       TRY:
         partner ← FIND Partner BY guid1c = order.Partner_Key
         
         IF partner IS NOT NULL:
           UPSERT INTO orders:
             guid1c: order.Ref_Key
             orderNumber1c: order.Number
             partnerId: partner.id
             orderDate: PARSE_DATE(order.Date)
             totalAmount: order.TotalAmount
             status: MAP_STATUS(order.Status)
             salesOrderGuid1c: order.Ref_Key
             lastSyncAt: NOW()
           
           processed ← processed + 1
           LOG_SYNC(sessionId, 'orders', order.Ref_Key, 'completed')
       
       CATCH error:
         failed ← failed + 1
         errors.ADD({
           entity: 'order',
           guid: order.Ref_Key,
           error: error.message
         })
         LOG_SYNC(sessionId, 'orders', order.Ref_Key, 'failed', error.message)
  
  5. Синхронизация реализаций (для статусов)
     realizations ← GET Realizations(partnerGuid, modifiedSince)
     
     FOR EACH realization IN realizations:
       TRY:
         order ← FIND Order BY guid1c = realization.Order_Key
         
         IF order IS NOT NULL:
           UPDATE orders:
             realizationGuid1c: realization.Ref_Key
             realizationDate: PARSE_DATE(realization.Date)
             status: 'shipped'
             orderNumber1c: realization.Number
             lastSyncAt: NOW()
           
           processed ← processed + 1
       
       CATCH error:
         failed ← failed + 1
         errors.ADD({
           entity: 'realization',
           guid: realization.Ref_Key,
           error: error.message
         })
  
  6. RETURN { processed, failed, errors }
```

---

## 3. Алгоритм полной синхронизации (Full Sync)

```typescript
ALGORITHM FullSync():
  INPUT:
    - sessionId: Integer (ID сессии синхронизации)
  
  OUTPUT:
    - success: Boolean
    - processed: Integer
    - failed: Integer
    - errors: Array<SyncError>
  
  STEPS:
  1. Создание сессии синхронизации
     session ← CREATE SyncSession:
       syncType: 'full'
       status: 'pending'
       createdBy: currentUserId
       createdAt: NOW()
  
  2. Проверка подключения к 1С
     isHealthy ← OneCClient.healthCheck()
     
     IF NOT isHealthy:
       UPDATE SyncSession:
         status: 'failed'
         errorMessage: 'Не удалось подключиться к 1С'
         completedAt: NOW()
       RETURN { success: false, processed: 0, failed: 0, errors: [...] }
  
  3. Обновление статуса сессии
     UPDATE SyncSession:
       status: 'in_progress'
       startedAt: NOW()
  
  4. Последовательная синхронизация сущностей
     results ← {
       groups: SyncProductGroups(),
       products: SyncProducts(),
       prices: SyncPrices(),
       stocks: SyncStocks(),
       partners: SyncPartners(),
       orders: SyncOrders()
     }
  
  5. Подсчёт результатов
     totalProcessed ← SUM(results[*].processed)
     totalFailed ← SUM(results[*].failed)
     allErrors ← CONCAT(results[*].errors)
     hasErrors ← totalFailed > 0
  
  6. Обновление статуса сессии
     UPDATE SyncSession:
       status: hasErrors ? 'partial' : 'completed'
       completedAt: NOW()
       itemsProcessed: totalProcessed
       itemsTotal: totalProcessed + totalFailed
       itemsFailed: totalFailed
  
  7. RETURN {
       success: NOT hasErrors,
       processed: totalProcessed,
       failed: totalFailed,
       errors: allErrors
     }
```

---

## 4. Инкрементальная синхронизация

```typescript
ALGORITHM IncrementalSync(entityType: String):
  INPUT:
    - entityType: String (тип сущности для синхронизации)
  
  OUTPUT:
    - success: Boolean
    - processed: Integer
    - failed: Integer
  
  STEPS:
  1. GET последняя успешная синхронизация
     lastSync ← SELECT MAX(lastSyncAt) FROM SyncSession
       WHERE status = 'completed' AND syncType CONTAINS entityType
     
     IF lastSync IS NULL:
       RETURN FullSync()
  
  2. modifiedSince ← lastSync
  
  3. Выполнить синхронизацию с фильтром по дате
     result ← Sync{entityType}(modifiedSince)
  
  4. RETURN result
```

---

## 5. Обработка ошибок и retry logic

```typescript
ALGORITHM HandleRequestWithRetry(request: Function, maxRetries: Integer = 3):
  INPUT:
    - request: Function (функция выполнения запроса)
    - maxRetries: Integer (максимальное количество попыток)
  
  OUTPUT:
    - result: Any
  
  STEPS:
  1. attempts ← 0
     lastError ← NULL
  
  2. WHILE attempts < maxRetries:
       TRY:
         result ← EXECUTE request()
         RETURN result
       
       CATCH error:
         attempts ← attempts + 1
         lastError ← error
         
         IF error.status == 401:
           THROW error  // Auth error - не retry'им
         
         IF error.status == 404:
           THROW error  // Not found - не retry'им
         
         IF attempts < maxRetries:
           delay ← EXPONENTIAL_BACKOFF(attempts, baseDelay = 1000ms)
           WAIT delay
           LOG('Retry attempt {attempts}/{maxRetries} after {delay}ms')
  
  3. THROW lastError
```

---

## 6. Pagination для больших объёмов данных

```typescript
ALGORITHM SyncWithPagination(syncFunction: Function, batchSize: Integer = 1000):
  INPUT:
    - syncFunction: Function (функция синхронизации)
    - batchSize: Integer (размер пакета)
  
  OUTPUT:
    - totalProcessed: Integer
    - totalFailed: Integer
    - allErrors: Array<SyncError>
  
  STEPS:
  1. offset ← 0
     totalProcessed ← 0
     totalFailed ← 0
     allErrors ← []
  
  2. WHILE TRUE:
       result ← EXECUTE syncFunction(limit: batchSize, offset: offset)
       
       IF result.processed == 0:
         BREAK
       
       totalProcessed ← totalProcessed + result.processed
       totalFailed ← totalFailed + result.failed
       allErrors ← CONCAT(allErrors, result.errors)
       
       IF result.processed < batchSize:
         BREAK  // Больше данных нет
       
       offset ← offset + batchSize
  
  3. RETURN {
       totalProcessed,
       totalFailed,
       allErrors
     }
```

---

## 7. Схема базы данных для синхронизации

### 7.1. Таблицы

#### sync_sessions
```sql
CREATE TABLE sync_sessions (
  id SERIAL PRIMARY KEY,
  session_uuid UUID DEFAULT gen_random_uuid() UNIQUE,
  sync_type VARCHAR(50) NOT NULL,
  status sync_status DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  items_processed INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### sync_logs
```sql
CREATE TABLE sync_logs (
  id SERIAL PRIMARY KEY,
  sync_session_id VARCHAR(100) REFERENCES sync_sessions(session_uuid),
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  entity_guid_1c VARCHAR(50),
  operation sync_operation NOT NULL,
  status sync_status DEFAULT 'pending',
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  error_details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

### 7.2. Индексы

```sql
CREATE INDEX idx_sync_sessions_status ON sync_sessions(status);
CREATE INDEX idx_sync_sessions_created_at ON sync_sessions(created_at);
CREATE INDEX idx_sync_logs_session_id ON sync_logs(sync_session_id);
CREATE INDEX idx_sync_logs_entity ON sync_logs(entity_type, entity_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_created_at ON sync_logs(created_at);
```

---

## 8. API endpoints для управления синхронизацией

### 8.1. Запуск синхронизации

```http
POST /api/admin/sync/start
Content-Type: application/json
Authorization: Bearer <token>

{
  "syncType": "full" | "products" | "partners" | "orders" | "stocks"
}
```

**Ответ:**
```json
{
  "success": true,
  "sessionId": "uuid-сессии",
  "results": {
    "products": 1500,
    "partners": 50,
    "orders": 20,
    "stocks": 3000
  },
  "message": "Синхронизация успешно завершена"
}
```

### 8.2. Получение статуса сессий

```http
GET /api/admin/sync/sessions
Authorization: Bearer <token>
```

**Ответ:**
```json
{
  "sessions": [
    {
      "sessionUuid": "uuid-сессии",
      "syncType": "full",
      "status": "completed",
      "startedAt": "2026-03-02T10:00:00Z",
      "completedAt": "2026-03-02T10:05:00Z",
      "itemsProcessed": 4570,
      "itemsTotal": 4570,
      "itemsFailed": 0
    }
  ]
}
```

### 8.3. Проверка подключения к 1С

```http
POST /api/admin/settings/test
Content-Type: application/json
Authorization: Bearer <token>

{
  "url": "http://1c-server:8080/hs/odata",
  "username": "odata_user",
  "password": "password"
}
```

**Ответ:**
```json
{
  "success": true,
  "entitySets": {
    "products": "Catalogs.Products",
    "partners": "Catalogs.Partners",
    "orders": "Documents.SalesOrder",
    ...
  }
}
```

---

## 9. Рекомендации по улучшению

### 9.1. Критические (должны быть реализованы)

1. **Pagination**: Добавить поддержку `$top` и `$skip` для обработки больших объёмов
2. **Retry Logic**: Реализовать exponential backoff при временных ошибках
3. **Logging**: Добавить детальное логирование всех запросов и ответов
4. **Error Handling**: Обрабатывать специфичные ошибки 1С (таймауты, блокировки)

### 9.2. Важные (желательно реализовать)

1. **Delta Sync**: Использовать `ModifiedDateTime` для инкрементальной синхронизации
2. **Caching**: Кэшировать метаданные OData (1 час)
3. **Batch Updates**: Группировать SQL запросы в транзакции
4. **Progress Tracking**: Отслеживать прогресс в реальном времени

### 9.3. Опциональные (для будущего)

1. **Webhooks**: Подписка на изменения в 1С через webhooks
2. **Queue System**: Использовать BullMQ для асинхронной синхронизации
3. **Rate Limiting**: Ограничение частоты запросов к 1С
4. **Data Validation**: Валидация данных перед записью в БД

---

## 10. Диаграмма последовательности

```
┌──────┐         ┌──────────┐         ┌─────────┐         ┌────────┐         ┌──────┐
│Client│         │API Route │         │OneCClient│         │  1C    │         │  DB  │
└──┬───┘         └────┬─────┘         └────┬────┘         └───┬────┘         └──┬───┘
   │                  │                     │                  │                 │
   │ POST /sync/start │                     │                  │                 │
   │─────────────────>│                     │                  │                 │
   │                  │                     │                  │                 │
   │                  │ CREATE SyncSession  │                  │                 │
   │                  │─────────────────────────────────────────────────────────>│
   │                  │                     │                  │                 │
   │                  │ healthCheck()       │                  │                 │
   │                  │────────────────────>│                  │                 │
   │                  │                     │ GET /$metadata   │                 │
   │                  │                     │─────────────────>│                 │
   │                  │                     │                  │                 │
   │                  │                     │<─────────────────│                 │
   │                  │                     │                  │                 │
   │                  │                     │ OK               │                 │
   │                  │<────────────────────│                  │                 │
   │                  │                     │                  │                 │
   │                  │ getProductGroups()  │                  │                 │
   │                  │────────────────────>│                  │                 │
   │                  │                     │ GET /Catalogs.ProductGroups       │
   │                  │                     │─────────────────>│                 │
   │                  │                     │                  │                 │
   │                  │                     │<─────────────────│                 │
   │                  │                     │                  │                 │
   │                  │                     │ UPSERT Groups    │                 │
   │                  │─────────────────────────────────────────────────────────>│
   │                  │                     │                  │                 │
   │                  │ getProducts()       │                  │                 │
   │                  │────────────────────>│                  │                 │
   │                  │                     │ GET /Catalogs.Products            │
   │                  │                     │─────────────────>│                 │
   │                  │                     │                  │                 │
   │                  │                     │<─────────────────│                 │
   │                  │                     │                  │                 │
   │                  │                     │ UPSERT Products  │                 │
   │                  │─────────────────────────────────────────────────────────>│
   │                  │                     │                  │                 │
   │                  │ UPDATE SyncSession  │                  │                 │
   │                  │ (completed)         │                  │                 │
   │                  │─────────────────────────────────────────────────────────>│
   │                  │                     │                  │                 │
   │                  │ OK                  │                  │                 │
   │<─────────────────│                     │                  │                 │
   │                  │                     │                  │                 │
```

---

## 11. Примеры кода

### 11.1. Улучшенный OneCClient с retry и pagination

```typescript
export class OneCClient {
  private metadataCache: { data: string; timestamp: number } | null = null;
  private readonly METADATA_CACHE_TTL = 3600000; // 1 hour

  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;
        
        // Don't retry on auth/not found errors
        if ([401, 403, 404].includes(axiosError.response?.status || 0)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  async getProductsPaginated(
    options: { limit?: number; offset?: number; modifiedSince?: string } = {},
    batchSize: number = 1000
  ): Promise<OneCProduct[]> {
    const allProducts: OneCProduct[] = [];
    let offset = options.offset || 0;
    
    while (true) {
      const products = await this.requestWithRetry(() => 
        this.getProducts({ ...options, limit: batchSize, offset })
      );
      
      allProducts.push(...products);
      
      if (products.length < batchSize) break;
      offset += batchSize;
    }
    
    return allProducts;
  }

  private async getMetadata(): Promise<string> {
    const now = Date.now();
    
    if (this.metadataCache && (now - this.metadataCache.timestamp) < this.METADATA_CACHE_TTL) {
      return this.metadataCache.data;
    }
    
    const response = await this.requestWithRetry(() => 
      this.client.get<string>('/$metadata', {
        responseType: 'text',
        headers: { Accept: 'application/xml, text/xml, */*' },
      })
    );
    
    this.metadataCache = { data: response.data, timestamp: now };
    return response.data;
  }
}
```

### 11.2. Транзакционная обработка данных

```typescript
async function syncProductsWithTransaction(
  products: OneCProduct[],
  sessionId?: number
): Promise<SyncResult> {
  const result: SyncResult = { success: true, processed: 0, failed: 0, errors: [] };
  
  await prisma.$transaction(async (tx) => {
    for (const product of products) {
      try {
        const group = product.Parent_Key 
          ? await tx.productGroup.findUnique({
              where: { guid1c: product.Parent_Key },
            })
          : null;
        
        await tx.product.upsert({
          where: { guid1c: product.Ref_Key },
          create: {
            guid1c: product.Ref_Key,
            article: product.Code,
            name: product.Description,
            groupId: group?.id || null,
            baseUnit1c: product.BaseUnit_Key,
            isService: product.IsService || false,
            isMarked: product.IsMarked || false,
            isActive: !(product.IsMarked || false),
            lastSyncAt: new Date(),
          },
          update: {
            article: product.Code,
            name: product.Description,
            isMarked: product.IsMarked || false,
            isActive: !(product.IsMarked || false),
            lastSyncAt: new Date(),
          },
        });
        
        result.processed++;
        
        if (sessionId) {
          await tx.syncLog.create({
            data: {
              syncSessionId: String(sessionId),
              entityType: 'products',
              entityId: product.Ref_Key,
              entityGuid1c: product.Ref_Key,
              operation: 'update',
              status: 'completed',
              processedAt: new Date(),
            },
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          entity: 'product',
          guid: product.Ref_Key,
          error: (error as Error).message,
        });
      }
    }
  });
  
  return result;
}
```

---

## 12. Заключение

Данный алгоритм описывает полный процесс синхронизации между 1С:УТ 11.5 и PostgreSQL через OData протокол.

**Ключевые моменты:**
1. Последовательная синхронизация: группы → товары → цены → остатки → партнёры → заказы
2. Использование upsert для идемпотентности
3. Логирование всех операций в sync_logs
4. Поддержка полной и инкрементальной синхронизации
5. Обработка ошибок с retry logic

**Следующие шаги:**
1. Реализовать pagination для больших объёмов
2. Добавить retry logic в OneCClient
3. Реализовать кэширование метаданных
4. Добавить детальное логирование
5. Оптимизировать SQL запросы (batch insert)
