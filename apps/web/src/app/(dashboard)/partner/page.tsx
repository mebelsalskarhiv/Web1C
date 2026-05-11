'use client';

import { useState, useEffect } from 'react';
import { Box, Title, Card, Text, Group, SimpleGrid, Badge, Table, ScrollArea, Loader, Stack, ThemeIcon, Paper } from '@mantine/core';
import { 
  IconShoppingCart, 
  IconWallet, 
  IconBuildingStore, 
  IconCheck, 
  IconClock, 
  IconTruckDelivery 
} from '@tabler/icons-react';
import { useAuth } from '@/lib/auth/context';

interface DashboardData {
  partners: any[];
  stats: {
    totalOrders: number;
    activeOrders: number;
    totalDebt: number;
    totalCredit: number;
  };
}

export default function PartnerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const res = await fetch('/api/partner/dashboard');
      if (res.ok) {
        const data = await res.json();
        setData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="xl" />
      </Group>
    );
  }

  if (!data) return <Text>Нет данных для отображения</Text>;

  return (
    <Box>
      <Title order={2} mb="xl">Добро пожаловать, {user?.firstName || 'Партнёр'}!</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl">
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Активные заказы</Text>
            <ThemeIcon color="blue" variant="light" size="sm">
              <IconShoppingCart size={16} />
            </ThemeIcon>
          </Group>
          <Group align="flex-end" gap="xs" mt={25}>
            <Text fw={700} size="xl">{data.stats.activeOrders}</Text>
            <Text c="dimmed" size="sm" mb={2}>из {data.stats.totalOrders} всего</Text>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Задолженность</Text>
            <ThemeIcon color="red" variant="light" size="sm">
              <IconWallet size={16} />
            </ThemeIcon>
          </Group>
          <Group align="flex-end" gap="xs" mt={25}>
            <Text fw={700} size="xl" c="red">{data.stats.totalDebt.toLocaleString('ru-RU')} ₽</Text>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Авансы</Text>
            <ThemeIcon color="green" variant="light" size="sm">
              <IconCheck size={16} />
            </ThemeIcon>
          </Group>
          <Group align="flex-end" gap="xs" mt={25}>
            <Text fw={700} size="xl" c="green">{data.stats.totalCredit.toLocaleString('ru-RU')} ₽</Text>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Точки продаж</Text>
            <ThemeIcon color="orange" variant="light" size="sm">
              <IconBuildingStore size={16} />
            </ThemeIcon>
          </Group>
          <Group align="flex-end" gap="xs" mt={25}>
            <Text fw={700} size="xl">{data.partners.length}</Text>
          </Group>
        </Paper>
      </SimpleGrid>

      <Title order={3} mb="md">Ваши точки продаж</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
        {data.partners.map((partner) => (
          <Card key={partner.id} withBorder shadow="sm">
            <Group justify="space-between" mb="xs">
              <Text fw={500}>{partner.nameFull}</Text>
              <Badge variant="outline">{partner.inn}</Badge>
            </Group>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Баланс (Дебет):</Text>
                <Text size="sm" fw={500} c={Number(partner.balanceDebit) > 0 ? 'red' : 'gray'}>
                  {Number(partner.balanceDebit).toLocaleString('ru-RU')} ₽
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Баланс (Кредит):</Text>
                <Text size="sm" fw={500} c={Number(partner.balanceCredit) > 0 ? 'green' : 'gray'}>
                  {Number(partner.balanceCredit).toLocaleString('ru-RU')} ₽
                </Text>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Title order={3} mb="md">Последние заказы</Title>
      <Card withBorder shadow="sm" p={0}>
        <ScrollArea>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Номер</Table.Th>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Точка продаж</Table.Th>
                <Table.Th>Сумма</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.partners.flatMap(p => p.orders).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map((order) => (
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
                    <Text size="sm">
                      {data.partners.find(p => p.id === order.partnerId)?.nameFull}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {Number(order.totalAmount).toLocaleString('ru-RU')} ₽
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light">
                      {order.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.partners.every(p => p.orders.length === 0) && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" py="md" c="dimmed">У вас пока нет заказов</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
    </Box>
  );
}
