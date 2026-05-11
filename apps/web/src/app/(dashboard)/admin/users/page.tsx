'use client';

import { useState, useEffect } from 'react';
import { Box, Title, Card, Text, Button, Group, Table, ScrollArea, TextInput, Badge, Modal, Stack, MultiSelect, PasswordInput, ActionIcon } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSearch, IconUserPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';

interface User {
  id: number;
  email: string;
  inn: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  managedPartners: {
    id: number;
    nameFull: string;
    inn: string | null;
  }[];
}

interface Partner {
  id: number;
  nameFull: string;
  inn: string | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const form = useForm({
    initialValues: {
      email: '',
      inn: '',
      password: '',
      role: 'partner',
      firstName: '',
      lastName: '',
      partnerIds: [] as string[],
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Некорректный email'),
      role: (value) => (value ? null : 'Выберите роль'),
    },
  });

  useEffect(() => {
    fetchUsers();
    fetchPartners();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPartners() {
    try {
      const res = await fetch('/api/admin/partners?pageSize=1000');
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners || []);
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    }
  }

  async function handleSubmit(values: typeof form.values) {
    const isEditing = !!editingUser;
    const url = '/api/admin/users';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          id: editingUser?.id,
          partnerIds: values.partnerIds.map(id => parseInt(id)),
        }),
      });

      if (res.ok) {
        notifications.show({
          title: 'Успешно',
          message: isEditing ? 'Пользователь обновлен' : 'Пользователь создан',
          color: 'green',
        });
        close();
        fetchUsers();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Ошибка при сохранении');
      }
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось сохранить пользователя',
        color: 'red',
      });
    }
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    form.setValues({
      email: user.email,
      inn: user.inn || '',
      password: '',
      role: user.role,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      partnerIds: user.managedPartners.map(p => String(p.id)),
    });
    open();
  }

  function handleAdd() {
    setEditingUser(null);
    form.reset();
    open();
  }

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Управление пользователями</Title>
        <Button leftSection={<IconUserPlus size={18} />} onClick={handleAdd}>
          Добавить пользователя
        </Button>
      </Group>

      <Card shadow="sm" padding="lg" withBorder>
        <ScrollArea>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Email / ИНН</Table.Th>
                <Table.Th>Имя</Table.Th>
                <Table.Th>Роль</Table.Th>
                <Table.Th>Точки продаж (Партнёры)</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Действия</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{user.email}</Text>
                    {user.inn && <Text size="xs" c="dimmed">ИНН: {user.inn}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{user.firstName} {user.lastName}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={user.role === 'admin' ? 'red' : 'blue'} size="sm">
                      {user.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      {user.managedPartners.map(p => (
                        <Badge key={p.id} variant="outline" size="xs">
                          {p.nameFull}
                        </Badge>
                      ))}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={user.isActive ? 'green' : 'gray'} size="sm">
                      {user.isActive ? 'Активен' : 'Заблокирован'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="blue" onClick={() => handleEdit(user)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Modal opened={opened} onClose={close} title={editingUser ? 'Редактировать пользователя' : 'Добавить пользователя'} size="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput label="Email" placeholder="user@example.com" required {...form.getInputProps('email')} />
            <TextInput label="ИНН (логин для партнёра)" placeholder="1234567890" {...form.getInputProps('inn')} />
            <PasswordInput label="Пароль" placeholder="••••••••" required={!editingUser} {...form.getInputProps('password')} />
            <TextInput label="Имя" {...form.getInputProps('firstName')} />
            <TextInput label="Фамилия" {...form.getInputProps('lastName')} />
            
            <MultiSelect
              label="Привязанные партнёры (точки продаж)"
              placeholder="Выберите партнёров"
              data={partners.map(p => ({ value: String(p.id), label: `${p.nameFull} (${p.inn || '-'})` }))}
              searchable
              {...form.getInputProps('partnerIds')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={close}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Box>
  );
}
