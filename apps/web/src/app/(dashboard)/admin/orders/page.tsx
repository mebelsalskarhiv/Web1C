'use client';

import { useState, useEffect } from 'react';
import { Box, Title, Card, Text, Button, Group, Table, ScrollArea, Badge, Menu, Pagination, Loader } from '@mantine/core';
import { IconDots, IconFileText, IconEye } from '@tabler/icons-react';
import PrintInvoiceButton from '@/components/orders/PrintInvoiceButton';

interface Order {
  id: number;
  orderNumber1c: string | null;
  orderNumberWeb: string | null;
  status: string;
  totalAmount: number;
  orderDate: string;
  partner: {
    nameFull: string;
  } | null;
  items: {
    id: number;
  }[];
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchOrders();
  }, [page]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'blue';
      case 'confirmed': return 'green';
      case 'processing': return 'yellow';
      case 'shipped': return 'cyan';
      case 'completed': return 'green';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Новый',
      confirmed: 'Подтверждён',
      processing: 'В работе',
      shipped: 'Отгружен',
      completed: 'Завершён',
      cancelled: 'Отменён',
    };
    return labels[status] || status;
  };

  return (
    <Box>
      <Title order={2} mb="xl">Заказы</Title>

      <Card shadow="sm" padding="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Все заказы</Title>
          <Text c="dimmed" size="sm">
            {total > 0 ? `Показано ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} из ${total}` : 'Заказов пока нет'}
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
        ) : orders.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Заказов пока нет</Text>
        ) : (
          <>
            <ScrollArea>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Номер</Table.Th>
                    <Table.Th>Дата</Table.Th>
                    <Table.Th>Партнёр</Table.Th>
                    <Table.Th>Статус</Table.Th>
                    <Table.Th>Сумма</Table.Th>
                    <Table.Th>Позиций</Table.Th>
                    <Table.Th>Действия</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {orders.map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {order.orderNumber1c || order.orderNumberWeb || `#${order.id}`}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {new Date(order.orderDate).toLocaleDateString('ru-RU')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{order.partner?.nameFull || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(order.status)} size="sm">
                          {getStatusLabel(order.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {Number(order.totalAmount).toLocaleString('ru-RU')} ₽
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{order.items.length}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            size="compact-xs"
                            variant="outline"
                            leftSection={<IconEye size={14} />}
                          >
                            Просмотр
                          </Button>
                          <PrintInvoiceButton
                            orderId={order.id}
                            orderNumber={order.orderNumber1c}
                            size="xs"
                          />
                        </Group>
                      </Table.Td>
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
