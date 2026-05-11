'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Title, Card, Text, Group, Table, ScrollArea, Badge, 
  Tabs, Loader, Pagination, Stack, Button, Modal, Divider 
} from '@mantine/core';
import { IconEye, IconFileText, IconCircleCheck, IconClock, IconX } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

export default function PartnerOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [opened, { open, close }] = useDisclosure(false);

  useEffect(() => {
    fetchOrders();
  }, [page, activeTab]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        status: activeTab || 'all',
      });
      const res = await fetch(`/api/partner/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge color="green" leftSection={<IconCircleCheck size={14} />}>Исполнен</Badge>;
      case 'cancelled': return <Badge color="red" leftSection={<IconX size={14} />}>Отменен</Badge>;
      case 'processing': return <Badge color="blue" leftSection={<IconClock size={14} />}>В работе</Badge>;
      default: return <Badge color="gray">{status}</Badge>;
    }
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    open();
  };

  return (
    <Box>
      <Title order={2} mb="xl">Мои заявки</Title>

      <Tabs value={activeTab} onChange={(value) => { setActiveTab(value); setPage(1); }} mb="lg">
        <Tabs.List>
          <Tabs.Tab value="all">Все</Tabs.Tab>
          <Tabs.Tab value="new" color="blue">Новые</Tabs.Tab>
          <Tabs.Tab value="processing" color="orange">В работе</Tabs.Tab>
          <Tabs.Tab value="completed" color="green">Исполненные</Tabs.Tab>
          <Tabs.Tab value="cancelled" color="red">Отмененные</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Card withBorder shadow="sm" p={0}>
        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : orders.length === 0 ? (
          <Box py="xl" ta="center">
            <Text c="dimmed">Заявки не найдены</Text>
          </Box>
        ) : (
          <>
            <ScrollArea>
              <Table verticalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Номер</Table.Th>
                    <Table.Th>Дата</Table.Th>
                    <Table.Th>Точка продаж</Table.Th>
                    <Table.Th>Сумма</Table.Th>
                    <Table.Th>Статус</Table.Th>
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
                        <Text size="sm">
                          {new Date(order.orderDate || order.createdAt).toLocaleDateString('ru-RU')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{order.partner?.nameFull}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {Number(order.totalAmount).toLocaleString('ru-RU')} ₽
                        </Text>
                      </Table.Td>
                      <Table.Td>{getStatusBadge(order.status)}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button 
                            variant="subtle" 
                            size="compact-xs" 
                            leftSection={<IconEye size={14} />}
                            onClick={() => handleViewOrder(order)}
                          >
                            Детали
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            <Group justify="center" py="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          </>
        )}
      </Card>

      <Modal opened={opened} onClose={close} title="Детали заказа" size="lg">
        {selectedOrder && (
          <Stack>
            <Group justify="space-between">
              <Text fw={700}>Заказ {selectedOrder.orderNumber1c || selectedOrder.orderNumberWeb}</Text>
              {getStatusBadge(selectedOrder.status)}
            </Group>
            <Text size="sm"><b>Точка продаж:</b> {selectedOrder.partner?.nameFull}</Text>
            <Text size="sm"><b>Дата:</b> {new Date(selectedOrder.orderDate || selectedOrder.createdAt).toLocaleDateString('ru-RU')}</Text>
            
            <Divider my="sm" />
            
            <Text fw={500}>Товары в заказе:</Text>
            <Table withColumnBorders withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Товар</Table.Th>
                  <Table.Th ta="center">Кол-во</Table.Th>
                  <Table.Th ta="right">Цена</Table.Th>
                  <Table.Th ta="right">Сумма</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedOrder.items.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text size="sm">{item.productName || item.product?.name}</Text>
                      <Text size="xs" c="dimmed">{item.productArticle || item.product?.article}</Text>
                    </Table.Td>
                    <Table.Td ta="center">{Number(item.quantity)}</Table.Td>
                    <Table.Td ta="right">{Number(item.price).toLocaleString('ru-RU')} ₽</Table.Td>
                    <Table.Td ta="right">{Number(item.total).toLocaleString('ru-RU')} ₽</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={3} ta="right">Итого:</Table.Th>
                  <Table.Th ta="right">{Number(selectedOrder.totalAmount).toLocaleString('ru-RU')} ₽</Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>

            <Group justify="flex-end" mt="md">
              <Button onClick={close}>Закрыть</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
