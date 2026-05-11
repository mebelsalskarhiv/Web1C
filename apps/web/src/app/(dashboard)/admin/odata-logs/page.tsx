'use client';

import { useEffect, useState } from 'react';
import {
  Box, Title, Card, Table, Badge, Group, Text, Button, TextInput, Select,
  LoadingOverlay, Stack, Switch, Pagination, ScrollArea,
} from '@mantine/core';
import { IconRefresh, IconSearch, IconClock, IconServer } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface ODataLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  entitySet?: string;
  entityType?: string;
  status: string;
  httpStatus?: number;
  durationMs: number;
  retryCount?: number;
  errorMessage?: string;
  isCached?: boolean;
}

interface ODataStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retriedRequests: number;
  averageDurationMs: number;
  requestsByEntity: Record<string, number>;
  errorsByType: Record<string, number>;
}

export default function ODataLogsPage() {
  const [logs, setLogs] = useState<ODataLog[]>([]);
  const [stats, setStats] = useState<ODataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filters
  const [entityType, setEntityType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);

  useEffect(() => {
    void fetchLogs();
  }, [page, entityType, status, method, search, onlyErrors]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String((page - 1) * limit),
        ...(entityType && { entityType }),
        ...(status && { status }),
        ...(method && { method }),
        ...(search && { search }),
        ...(onlyErrors && { errors: 'true' }),
      });

      const res = await fetch(`/api/admin/odata/log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.pagination?.total || 0);
        setStats(data.stats || null);
      } else {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось загрузить логи',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Fetch logs error:', error);
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось загрузить логи',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU');
  }

  function getStatusColor(httpStatus?: number) {
    if (!httpStatus) return 'gray';
    if (httpStatus >= 200 && httpStatus < 300) return 'green';
    if (httpStatus >= 400 && httpStatus < 500) return 'orange';
    if (httpStatus >= 500) return 'red';
    return 'gray';
  }

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Журнал OData запросов</Title>
        <Button
          leftSection={<IconRefresh size={18} />}
          onClick={() => fetchLogs()}
          loading={loading}
        >
          Обновить
        </Button>
      </Group>

      {/* Stats */}
      {stats && (
        <Card shadow="sm" padding="lg" withBorder mb="lg">
          <Group gap="xl">
            <Stack gap={0}>
              <Text size="sm" c="dimmed">Всего запросов</Text>
              <Text size="xl" fw={700}>{stats.totalRequests}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="sm" c="dimmed">Успешно</Text>
              <Text size="xl" fw={700} c="green">{stats.successfulRequests}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="sm" c="dimmed">Ошибки</Text>
              <Text size="xl" fw={700} c="red">{stats.failedRequests}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="sm" c="dimmed">Повторы</Text>
              <Text size="xl" fw={700} c="orange">{stats.retriedRequests}</Text>
            </Stack>
            <Stack gap={0}>
              <Text size="sm" c="dimmed">Ср. время</Text>
              <Text size="xl" fw={700}>{formatDuration(stats.averageDurationMs)}</Text>
            </Stack>
          </Group>
        </Card>
      )}

      {/* Filters */}
      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Group gap="md" wrap="wrap">
          <TextInput
            placeholder="Поиск по URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={16} />}
            style={{ width: 250 }}
          />
          <Select
            placeholder="Сущность"
            value={entityType}
            onChange={setEntityType}
            clearable
            data={[
              { value: 'products', label: 'Товары' },
              { value: 'partners', label: 'Партнеры' },
              { value: 'orders', label: 'Заказы' },
              { value: 'stocks', label: 'Остатки' },
              { value: 'prices', label: 'Цены' },
            ]}
            style={{ width: 180 }}
          />
          <Select
            placeholder="Статус"
            value={status}
            onChange={setStatus}
            clearable
            data={[
              { value: 'success', label: 'Успех' },
              { value: 'error', label: 'Ошибка' },
            ]}
            style={{ width: 150 }}
          />
          <Select
            placeholder="Метод"
            value={method}
            onChange={setMethod}
            clearable
            data={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
            ]}
            style={{ width: 120 }}
          />
          <Switch
            label="Только ошибки"
            checked={onlyErrors}
            onChange={(e) => setOnlyErrors(e.target.checked)}
          />
        </Group>
      </Card>

      {/* Logs Table */}
      <Card shadow="sm" padding="lg" withBorder>
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Время</Table.Th>
                <Table.Th>Метод</Table.Th>
                <Table.Th>Сущность</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Время</Table.Th>
                <Table.Th>Повторы</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {logs.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <IconClock size={14} />
                      <Text size="sm">{formatTimestamp(log.timestamp)}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={log.method === 'GET' ? 'blue' : 'green'}
                      variant="light"
                    >
                      {log.method}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {log.entityType ? (
                      <Badge variant="outline" color="gray">
                        {log.entityType}
                      </Badge>
                    ) : (
                      <Text c="dimmed" size="sm">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge color={getStatusColor(log.httpStatus)}>
                        {log.httpStatus || 'N/A'}
                      </Badge>
                      {log.isCached && (
                        <Badge variant="outline" color="gray" leftSection={<IconServer size={12} />}>
                          Кэш
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={500}
                      c={log.durationMs > 5000 ? 'red' : log.durationMs > 1000 ? 'orange' : 'inherit'}
                    >
                      {formatDuration(log.durationMs)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {log.retryCount && log.retryCount > 0 ? (
                      <Badge color="orange">{log.retryCount}</Badge>
                    ) : (
                      <Text c="dimmed" size="sm">-</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {logs.length === 0 && !loading && (
          <Text c="dimmed" ta="center" py="xl">
            Записей не найдено
          </Text>
        )}

        {/* Pagination */}
        {total > limit && (
          <Group justify="center" mt="lg">
            <Pagination
              value={page}
              onChange={setPage}
              total={Math.ceil(total / limit)}
              siblings={2}
            />
          </Group>
        )}
      </Card>
    </Box>
  );
}
