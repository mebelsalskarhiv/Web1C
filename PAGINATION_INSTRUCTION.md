# Инструкция по добавлению пагинации

## Для всех страниц: /admin/partners, /admin/orders, /admin/products

### 1. Добавить импорт Pagination
```typescript
import { Pagination } from '@mantine/core';
```

### 2. Добавить state переменные (после остальных useState)
```typescript
// Pagination
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const [totalPages, setTotalPages] = useState(0);
const pageSize = 50; // или 10 для orders/partners
```

### 3. Обновить fetch функцию
```typescript
// Fetch with pagination
useEffect(() => {
  fetchData();
}, [page]);

async function fetchData() {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      // ... другие параметры (search и т.д.)
    });
    
    const res = await fetch(`/api/admin/...?${params}`);
    if (res.ok) {
      const data = await res.json();
      setData(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLoading(false);
  }
}
```

### 4. Добавить Pagination UI в начало списка
```typescript
<Card shadow="sm" padding="lg" withBorder>
  <Group justify="space-between" mb="md">
    <Title order={3}>Название</Title>
    <Text c="dimmed" size="sm">
      {total > 0 ? `Показано ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} из ${total}` : 'Нет данных'}
    </Text>
  </Group>
  
  {totalPages > 1 && (
    <Group justify="center" mb="md" gap="md">
      <Pagination
        value={page}
        onChange={setPage}
        total={totalPages}
        siblings={2}
        boundaries={1}
      />
      <Text size="sm" c="dimmed">
        Страница {page} из {totalPages}
      </Text>
    </Group>
  )}
  
  {/* ... остальной контент (фильтры, таблица) ... */}
```

### 5. Добавить Pagination UI в конец списка
```typescript
  </ScrollArea>
  
  {totalPages > 1 && (
    <Group justify="center" mt="md" gap="md">
      <Pagination
        value={page}
        onChange={setPage}
        total={totalPages}
        siblings={2}
        boundaries={1}
      />
      <Text size="sm" c="dimmed">
        Страница {page} из {totalPages}
      </Text>
    </Group>
  )}
)}
</Card>
```

### 6. Обновить API endpoint
В соответствующий `/api/admin/.../route.ts` добавить:

```typescript
const page = parseInt(searchParams.get('page') || '1');
const pageSize = parseInt(searchParams.get('pageSize') || '50');

// Получить общее количество
const total = await prisma.model.count({ where: whereClause });

// Получить данные с пагинацией
const items = await prisma.model.findMany({
  where: whereClause,
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { name: 'asc' }, // или другое поле
});

return NextResponse.json({
  items,
  total,
  totalPages: Math.ceil(total / pageSize),
  page,
  pageSize,
});
```

---

## Готовые файлы для проверки:
- ✅ `/admin/stocks` - пагинация добавлена
- ⏳ `/admin/partners` - добавить по инструкции
- ⏳ `/admin/orders` - добавить по инструкции  
- ⏳ `/admin/products` - добавить по инструкции
