'use client';

import { useState } from 'react';
import { Box, Title, Card, Text, Button, Group, Progress, Timeline, Badge, Notification, Modal, Stack } from '@mantine/core';
import { IconRefresh, IconCheck, IconX, IconClock, IconTrash, IconDatabase } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

interface SyncSession {
  id: number;
  sessionUuid: string;
  syncType: string;
  status: string;
  itemsProcessed: number;
  itemsTotal: number;
  itemsFailed: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export default function AdminSync() {
  const [syncing, setSyncing] = useState(false);
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [currentSession, setCurrentSession] = useState<SyncSession | null>(null);

  async function startSync(syncType: string) {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/sync/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка синхронизации');
      }

      notifications.show({
        title: 'Синхронизация запущена',
        message: `Запущена синхронизация: ${syncType}`,
        color: 'blue',
      });

      setCurrentSession(data);
      fetchSessions();
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось запустить синхронизацию',
        color: 'red',
      });
    } finally {
      setSyncing(false);
    }
  }

  async function fetchSessions() {
    try {
      const res = await fetch('/api/admin/sync/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  }

  async function clearDatabase() {
    modals.openConfirmModal({
      title: 'Очистка базы данных',
      children: (
        <Stack>
          <Text>
            Вы уверены, что хотите очистить базу данных? Это действие нельзя отменить!
          </Text>
          <Text c="red" fw={700}>
            Будут удалены: товары, партнеры, заказы, остатки, история синхронизаций
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Очистить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await fetch('/api/admin/sync/clear', {
            method: 'POST',
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Ошибка очистки');
          }

          notifications.show({
            title: 'База очищена',
            message: `Удалено записей: ${data.deleted}`,
            color: 'green',
          });

          fetchSessions();
        } catch (error) {
          notifications.show({
            title: 'Ошибка',
            message: error instanceof Error ? error.message : 'Не удалось очистить базу',
            color: 'red',
          });
        }
      },
    });
  }

  useState(() => {
    fetchSessions();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'failed': return 'red';
      case 'in_progress': return 'blue';
      case 'partial': return 'yellow';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <IconCheck size={18} />;
      case 'failed': return <IconX size={18} />;
      case 'in_progress': return <IconClock size={18} />;
      default: return null;
    }
  };

  return (
    <Box>
      <Title order={2} mb="xl">Синхронизация с 1С</Title>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Group justify="space-between" mb="md">
          <Title order={3}>Запустить синхронизацию</Title>
          <Button
            color="red"
            variant="outline"
            leftSection={<IconTrash size={18} />}
            onClick={clearDatabase}
          >
            Очистить БД
          </Button>
        </Group>
        <Text c="dimmed" mb="md">
          Выберите тип синхронизации для запуска
        </Text>

        <Group gap="sm" wrap="wrap">
          <Button
            leftSection={<IconRefresh size={18} />}
            loading={syncing}
            onClick={() => startSync('full')}
          >
            Полная синхронизация
          </Button>

          <Button
            variant="outline"
            leftSection={<IconRefresh size={18} />}
            loading={syncing}
            onClick={() => startSync('products')}
          >
            Товары
          </Button>

          <Button
            variant="outline"
            leftSection={<IconRefresh size={18} />}
            loading={syncing}
            onClick={() => startSync('partners')}
          >
            Партнёры
          </Button>

          <Button
            variant="outline"
            leftSection={<IconRefresh size={18} />}
            loading={syncing}
            onClick={() => startSync('stocks')}
          >
            Остатки
          </Button>

          <Button
            variant="outline"
            leftSection={<IconRefresh size={18} />}
            loading={syncing}
            onClick={() => startSync('images')}
          >
            Изображения
          </Button>

          <Button
            variant="outline"
            leftSection={<IconRefresh size={18} />}
            loading={syncing}
            onClick={() => startSync('orders')}
          >
            Заказы
          </Button>
        </Group>
      </Card>

      {currentSession && (
        <Card shadow="sm" padding="lg" withBorder mb="lg">
          <Group justify="space-between" mb="md">
            <Title order={4}>Текущая сессия</Title>
            <Badge color={getStatusColor(currentSession.status)}>
              {currentSession.status === 'completed' ? 'Завершено' :
               currentSession.status === 'failed' ? 'Ошибка' :
               currentSession.status === 'in_progress' ? 'В процессе' : currentSession.status}
            </Badge>
          </Group>

          <Progress
            value={currentSession.itemsTotal > 0 
              ? (currentSession.itemsProcessed / currentSession.itemsTotal) * 100 
              : 0}
            size="lg"
            mb="md"
          />

          <Group justify="space-between">
            <Text size="sm">
              Обработано: {currentSession.itemsProcessed} / {currentSession.itemsTotal}
            </Text>
            {currentSession.itemsFailed > 0 && (
              <Text size="sm" c="red">
                Ошибок: {currentSession.itemsFailed}
              </Text>
            )}
          </Group>
        </Card>
      )}

      <Card shadow="sm" padding="lg" withBorder>
        <Title order={4} mb="md">История синхронизаций</Title>

        {sessions.length === 0 ? (
          <Text c="dimmed">История пуста</Text>
        ) : (
          <Timeline active={sessions.length - 1} bulletSize={24} lineWidth={2}>
            {sessions.slice(0, 10).map((session) => (
              <Timeline.Item
                key={session.sessionUuid}
                title={`${session.syncType} - ${new Date(session.startedAt || '').toLocaleString('ru-RU')}`}
                bullet={getStatusIcon(session.status)}
              >
                <Group gap="xs" mb="xs">
                  <Badge color={getStatusColor(session.status)} size="sm">
                    {session.status}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {session.itemsProcessed} обработано
                    {session.itemsFailed > 0 && ` • ${session.itemsFailed} ошибок`}
                  </Text>
                </Group>
                {session.errorMessage && (
                  <Text size="sm" c="red">
                    {session.errorMessage}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>
    </Box>
  );
}
