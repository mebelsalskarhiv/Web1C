'use client';

import { useState, useEffect } from 'react';
import {
  Box, Title, Card, Text, Button, Group, Table, ScrollArea, Badge, TextInput,
  Select, Switch, Loader, Notification, Pagination
} from '@mantine/core';
import { IconSearch, IconRefresh, IconBuildingWarehouse } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface ProductStock {
  product: {
    id: number;
    guid1c: string;
    article: string | null;
    name: string;
  };
  stocks: Array<{
    warehouseGuid: string | null;
    warehouseName: string | null;
    quantity: number;
    reserved: number;
    available: number;
  }>;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
}

interface Warehouse {
  guid: string;
  name: string;
}

export default function AdminStocks() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stocks, setStocks] = useState<ProductStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 50;

  // Initial fetch for warehouses
  useEffect(() => {
    fetchWarehouses();
  }, []);

  // Fetch stocks when page or filters change
  useEffect(() => {
    fetchStocks(page);
  }, [page, selectedWarehouse, includeEmpty]);

  // Debounced search (reset to page 1)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchStocks(1);
      } else {
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  async function fetchStocks(currentPage: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(selectedWarehouse && { warehouseGuid: selectedWarehouse }),
        ...(search && { search }),
        includeEmpty: includeEmpty ? 'true' : 'false',
        page: String(currentPage),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/admin/stocks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data.stocks || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        if (data.warehouses) {
          setWarehouses(data.warehouses);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stocks:', error);
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось загрузить остатки',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchWarehouses() {
    try {
      const res = await fetch('/api/admin/warehouses');
      if (res.ok) {
        const data = await res.json();
        if (data.warehouses) {
          setWarehouses(data.warehouses);
        }
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
    }
  }

  async function syncStocks() {
    setSyncing(true);
    notifications.show({
      title: 'Синхронизация',
      message: 'Запущена синхронизация остатков',
      color: 'blue',
      loading: true,
    });

    try {
      const res = await fetch('/api/admin/stocks/sync', {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        notifications.show({
          title: 'Успешно',
          message: data.message || 'Остатки синхронизированы',
          color: 'green',
        });
        fetchStocks(page);
      } else {
        throw new Error('Ошибка синхронизации');
      }
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось синхронизировать остатки',
        color: 'red',
      });
    } finally {
      setSyncing(false);
    }
  }

  const warehouseOptions = [
    { value: '', label: 'Все склады' },
    ...warehouses.map(w => ({ value: w.guid, label: w.name })),
  ];

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Остатки товаров</Title>
        <Group>
          <Button
            variant="outline"
            leftSection={<IconRefresh size={18} />}
            onClick={syncStocks}
            loading={syncing}
          >
            Синхронизировать
          </Button>
        </Group>
      </Group>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Group>
          <TextInput
            placeholder="Поиск по названию или артикулу"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={18} />}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Склад"
            value={selectedWarehouse}
            onChange={setSelectedWarehouse}
            data={warehouseOptions}
            style={{ width: 250 }}
            clearable
          />
          <Switch
            label="Показывать без остатка"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.currentTarget.checked)}
          />
        </Group>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Остатки на складах</Title>
          <Text c="dimmed" size="sm">
            {total > 0 ? `Показано ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} из ${total}` : `${stocks.length} товаров`}
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

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : stocks.length === 0 ? (
          <Notification icon={<IconBuildingWarehouse size={18} />} color="gray">
            Остатки не найдены. Запустите синхронизацию с 1С.
          </Notification>
        ) : (
          <>
            <ScrollArea>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Артикул</Table.Th>
                    <Table.Th>Наименование</Table.Th>
                    {selectedWarehouse ? (
                      <>
                        <Table.Th>Количество</Table.Th>
                        <Table.Th>Резерв</Table.Th>
                        <Table.Th>Доступно</Table.Th>
                      </>
                    ) : (
                      <>
                        <Table.Th>Всего</Table.Th>
                        <Table.Th>Резерв</Table.Th>
                        <Table.Th>Доступно</Table.Th>
                        <Table.Th>Склады</Table.Th>
                      </>
                    )}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stocks.map((item) => (
                    <Table.Tr key={item.product.id}>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{item.product.article || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{item.product.name}</Text>
                      </Table.Td>
                      {selectedWarehouse ? (
                        <>
                          <Table.Td>
                            <Badge color={item.stocks[0]?.quantity > 0 ? "green" : "gray"} size="sm">
                              {item.stocks[0]?.quantity.toLocaleString('ru-RU')}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {item.stocks[0]?.reserved.toLocaleString('ru-RU') || '0'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500} c={item.stocks[0]?.available > 0 ? "blue" : "red"}>
                              {item.stocks[0]?.available.toLocaleString('ru-RU')}
                            </Text>
                          </Table.Td>
                        </>
                      ) : (
                        <>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {item.totalQuantity.toLocaleString('ru-RU')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {item.totalReserved.toLocaleString('ru-RU')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500} c={item.totalAvailable > 0 ? "blue" : "red"}>
                              {item.totalAvailable.toLocaleString('ru-RU')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" wrap="wrap">
                              {item.stocks
                                .filter(s => s.quantity > 0)
                                .slice(0, 3)
                                .map((s, idx) => (
                                  <Badge key={idx} variant="outline" size="xs">
                                    {s.warehouseName || 'Склад'}: {s.quantity}
                                  </Badge>
                                ))}
                              {item.stocks.filter(s => s.quantity > 0).length > 3 && (
                                <Badge variant="outline" size="xs">
                                  +{item.stocks.filter(s => s.quantity > 0).length - 3}
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                        </>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
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
          </>
        )}
      </Card>
    </Box>
  );
}
