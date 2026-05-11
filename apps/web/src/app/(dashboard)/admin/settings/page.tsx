'use client';

import { useEffect, useState } from 'react';
import { Box, Title, Card, TextInput, Button, Group, Text, Notification, Divider, PasswordInput, Switch, NumberInput, Accordion, Table, Badge, Tooltip, Stack, ActionIcon } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconX, IconRefresh, IconDatabase, IconListSearch, IconEdit, IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Settings {
  onecUrl: string;
  onecUser: string;
  onecPassword: string;
  syncInterval: number;
  autoSyncEnabled: boolean;
  reserveOnOrder: boolean;
  retailPriceTypeGuid: string;
  wholesalePriceTypeGuid: string;
}

interface EntityEndpoint {
  entity: string;
  endpoint: string;
  description: string;
}

const DEFAULT_ENTITY_ENDPOINTS: EntityEndpoint[] = [
  { entity: 'products', endpoint: 'Catalog_Номенклатура', description: 'Товары (номенклатура)' },
  { entity: 'productGroups', endpoint: 'Catalog_Номенклатура', description: 'Группы товаров' },
  { entity: 'prices', endpoint: 'InformationRegister_ЦеныНоменклатуры', description: 'Цены' },
  { entity: 'stocks', endpoint: 'AccumulationRegister_ТоварыНаСкладах', description: 'Остатки товаров' },
  { entity: 'partners', endpoint: 'Catalog_Контрагенты', description: 'Партнеры (контрагенты)' },
  { entity: 'orders', endpoint: 'Document_ЗаказКлиента', description: 'Заказы клиентов' },
  { entity: 'realizations', endpoint: 'Document_РеализацияТоваровУслуг', description: 'Реализация' },
  { entity: 'reservations', endpoint: 'AccumulationRegister_РезервыТоваровОрганизаций', description: 'Резервы товаров' },
  { entity: 'booking', endpoint: 'Document_Бронирование', description: 'Бронирование' },
];

export default function AdminSettings() {
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [endpoints, setEndpoints] = useState<Record<string, string>>({});
  const [editingEndpoint, setEditingEndpoint] = useState<string | null>(null);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const form = useForm({
    initialValues: {
      onecUrl: '',
      onecUser: '',
      onecPassword: '',
      syncInterval: 300,
      autoSyncEnabled: true,
      reserveOnOrder: true,
      retailPriceTypeGuid: '',
      wholesalePriceTypeGuid: '',
    },
  });

  useEffect(() => {
    void fetchSettings();
    void fetchAvailableEntities();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        form.setValues({
          onecUrl: data.settings.onecUrl || '',
          onecUser: data.settings.onecUser || '',
          onecPassword: data.settings.onecPassword || '',
          syncInterval: data.settings.syncInterval || 300,
          autoSyncEnabled: data.settings.autoSyncEnabled ?? true,
          reserveOnOrder: data.settings.reserveOnOrder ?? true,
          retailPriceTypeGuid: data.settings.retailPriceTypeGuid || '',
          wholesalePriceTypeGuid: data.settings.wholesalePriceTypeGuid || '',
        });
        // Load custom endpoints if available
        if (data.settings.endpoints) {
          setEndpoints(data.settings.endpoints);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAvailableEntities() {
    setLoadingEntities(true);
    try {
      const res = await fetch('/api/admin/odata/entities');
      if (res.ok) {
        const data = await res.json();
        setAvailableEntities(data.entitySets || []);
      }
    } catch (error) {
      console.error('Failed to fetch available entities:', error);
    } finally {
      setLoadingEntities(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setConnectionOk(null);

    try {
      const response = await fetch('/api/admin/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.values.onecUrl,
          username: form.values.onecUser,
          password: form.values.onecPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setConnectionOk(true);
        // After successful connection, fetch available entities
        await fetchAvailableEntities();
        notifications.show({
          title: 'Успешно',
          message: 'Соединение с 1С установлено',
          color: 'green',
        });
      } else {
        setConnectionOk(false);
        notifications.show({
          title: 'Ошибка',
          message: data.error || 'Не удалось подключиться к 1С',
          color: 'red',
        });
      }
    } catch (error) {
      setConnectionOk(false);
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось подключиться к 1С',
        color: 'red',
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(values: typeof form.values) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, endpoints }),
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения');
      }

      notifications.show({
        title: 'Успешно',
        message: 'Настройки сохранены',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось сохранить настройки',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleEndpointChange(entity: string, value: string) {
    setEndpoints(prev => ({ ...prev, [entity]: value }));
  }

  function handleResetEndpoints() {
    const defaults: Record<string, string> = {};
    DEFAULT_ENTITY_ENDPOINTS.forEach(e => {
      defaults[e.entity] = e.endpoint;
    });
    setEndpoints(defaults);
    notifications.show({
      title: 'Сброшено',
      message: 'Эндпоинты сброшены к значениям по умолчанию',
      color: 'blue',
    });
  }

  function getEndpointForEntity(entity: string) {
    return endpoints[entity] || DEFAULT_ENTITY_ENDPOINTS.find(e => e.entity === entity)?.endpoint || '';
  }

  function isEndpointAvailable(endpoint: string) {
    return availableEntities.includes(endpoint);
  }

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
      <Title order={2} mb="xl">Настройки системы</Title>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Title order={3} mb="md">Подключение к 1С</Title>

        <TextInput
          label="URL OData публикации"
          placeholder="http://1c-server:8080/hs/odata"
          mb="md"
          {...form.getInputProps('onecUrl')}
        />

        <Group grow mb="md">
          <TextInput
            label="Пользователь"
            placeholder="odata_user"
            {...form.getInputProps('onecUser')}
          />
          <PasswordInput
            label="Пароль"
            placeholder="••••••••"
            {...form.getInputProps('onecPassword')}
          />
        </Group>

        <Group gap="sm" mb="lg">
          <Button
            leftSection={<IconRefresh size={18} />}
            loading={testing}
            onClick={testConnection}
            disabled={!form.values.onecUrl || !form.values.onecUser}
          >
            Проверить соединение
          </Button>

          {connectionOk === true && (
            <Notification icon={<IconCheck size={18} />} color="green">
              Соединение установлено
            </Notification>
          )}

          {connectionOk === false && (
            <Notification icon={<IconX size={18} />} color="red">
              Ошибка подключения
            </Notification>
          )}
        </Group>
      </Card>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Group justify="space-between" mb="md">
          <Title order={3}>Эндпоинты OData сущностей</Title>
          <Group gap="xs">
            <Button
              variant="outline"
              size="xs"
              leftSection={<IconListSearch size={16} />}
              onClick={fetchAvailableEntities}
              loading={loadingEntities}
            >
              Обновить список
            </Button>
            <Button
              variant="outline"
              color="gray"
              size="xs"
              leftSection={<IconRefresh size={16} />}
              onClick={handleResetEndpoints}
            >
              Сбросить
            </Button>
          </Group>
        </Group>

        <Text c="dimmed" size="sm" mb="md">
          Настройте соответствие сущностей и эндпоинтов 1С. Доступные эндпоинты: {availableEntities.length}
        </Text>

        <Table striped highlightOnHover mb="lg">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Сущность</Table.Th>
              <Table.Th>Описание</Table.Th>
              <Table.Th>Эндпоинт</Table.Th>
              <Table.Th>Статус</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {DEFAULT_ENTITY_ENDPOINTS.map((item) => {
              const currentEndpoint = getEndpointForEntity(item.entity);
              const isAvailable = isEndpointAvailable(currentEndpoint);
              const isEditing = editingEndpoint === item.entity;

              return (
                <Table.Tr key={item.entity}>
                  <Table.Td>
                    <Badge variant="light" color="blue">
                      {item.entity}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{item.description}</Table.Td>
                  <Table.Td>
                    {isEditing ? (
                      <TextInput
                        value={currentEndpoint}
                        onChange={(e) => handleEndpointChange(item.entity, e.target.value)}
                        size="xs"
                        style={{ width: 300 }}
                        list={`entity-${item.entity}`}
                        onBlur={() => setEditingEndpoint(null)}
                        autoFocus
                      />
                    ) : (
                      <Group gap="xs">
                        <Text size="sm" fw={500}>{currentEndpoint}</Text>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => setEditingEndpoint(item.entity)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {availableEntities.length > 0 && (
                      isAvailable ? (
                        <Badge color="green" leftSection={<IconCheck size={12} />}>
                          Доступен
                        </Badge>
                      ) : (
                        <Badge color="orange" variant="outline">
                          Не найден
                        </Badge>
                      )
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {/* Datalist for autocomplete */}
        {availableEntities.length > 0 && (
          <datalist id={`entity-all`}>
            {availableEntities.map(entity => (
              <option key={entity} value={entity} />
            ))}
          </datalist>
        )}
      </Card>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Title order={3} mb="md">Настройки цен</Title>
        <Group grow mb="md">
          <TextInput
            label="GUID типа розничной цены"
            placeholder="00000000-0000-0000-0000-000000000000"
            {...form.getInputProps('retailPriceTypeGuid')}
          />
          <TextInput
            label="GUID типа оптовой цены"
            placeholder="00000000-0000-0000-0000-000000000000"
            {...form.getInputProps('wholesalePriceTypeGuid')}
          />
        </Group>
        <Text size="xs" c="dimmed">
          Эти GUID используются для сопоставления цен из 1С с полями розничной и оптовой цены в базе данных.
        </Text>
      </Card>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Title order={3} mb="md">Синхронизация</Title>

        <NumberInput
          label="Интервал автоматической синхронизации (секунды)"
          min={60}
          step={60}
          mb="md"
          {...form.getInputProps('syncInterval')}
        />

        <Switch
          label="Автоматическая синхронизация"
          mb="md"
          {...form.getInputProps('autoSyncEnabled')}
        />

        <Switch
          label="Резервировать товары при создании заказа"
          {...form.getInputProps('reserveOnOrder')}
        />
      </Card>

      <Group justify="flex-end" mt="lg">
        <Button
          variant="outline"
          component="a"
          href="/admin/odata-logs"
          leftSection={<IconDatabase size={18} />}
        >
          Журнал OData запросов
        </Button>
        <Button type="submit" loading={saving} leftSection={<IconDeviceFloppy size={18} />}>
          Сохранить настройки
        </Button>
      </Group>
    </Box>
  );
}
