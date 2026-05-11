'use client';

import { useState, useEffect } from 'react';
import { Title, SimpleGrid, Card, Group, Text, Badge, Button, Box, Progress, Notification } from '@mantine/core';
import { IconPackages, IconUsers, IconShoppingCart, IconRefresh, IconDatabase, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface DashboardStats {
  productsCount: number;
  partnersCount: number;
  ordersCount: number;
  lastSyncAt: string | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Обзор системы</Title>
        <Button leftSection={<IconRefresh size={18} />} onClick={fetchStats}>
          Обновить
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="space-between">
            <Box>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Товары
              </Text>
              <Text fw={700} size="xl" mt="xs">
                {stats?.productsCount ?? '-'}
              </Text>
            </Box>
            <IconPackages size={48} stroke={1.5} />
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="space-between">
            <Box>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Партнёры
              </Text>
              <Text fw={700} size="xl" mt="xs">
                {stats?.partnersCount ?? '-'}
              </Text>
            </Box>
            <IconUsers size={48} stroke={1.5} />
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="space-between">
            <Box>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Заказы
              </Text>
              <Text fw={700} size="xl" mt="xs">
                {stats?.ordersCount ?? '-'}
              </Text>
            </Box>
            <IconShoppingCart size={48} stroke={1.5} />
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="space-between">
            <Box>
              <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
                Последняя синхронизация
              </Text>
              <Text fw={500} size="sm" mt="xs">
                {stats?.lastSyncAt 
                  ? new Date(stats.lastSyncAt).toLocaleString('ru-RU')
                  : 'Не проводилась'}
              </Text>
            </Box>
            <IconDatabase size={48} stroke={1.5} />
          </Group>
        </Card>
      </SimpleGrid>

      <Card shadow="sm" padding="lg" withBorder>
        <Title order={3} mb="md">Быстрые действия</Title>
        <Group gap="sm">
          <Button leftSection={<IconRefresh size={18} />} component="a" href="/admin/sync">
            Запустить синхронизацию
          </Button>
          <Button leftSection={<IconUsers size={18} />} variant="outline" component="a" href="/admin/partners">
            Добавить партнёра
          </Button>
          <Button leftSection={<IconPackages size={18} />} variant="outline" component="a" href="/admin/products">
            Управление товарами
          </Button>
        </Group>
      </Card>
    </Box>
  );
}
