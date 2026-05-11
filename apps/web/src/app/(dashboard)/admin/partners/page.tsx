'use client';

import { useState, useEffect } from 'react';
import { Box, Title, Card, Text, Button, Group, Table, ScrollArea, TextInput, Badge, Modal, Stack, Select, Pagination, Loader } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSearch, IconUserPlus, IconLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';

interface Partner {
  id: number;
  guid1c: string | null;
  inn: string | null;
  kpp: string | null;
  nameFull: string;
  nameShort: string | null;
  addressLegal: string | null;
  phoneMain: string | null;
  email: string | null;
  balanceDebit: number;
  balanceCredit: number;
  isMerged: boolean;
  mergedIntoId: number | null;
}

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundPartner, setFoundPartner] = useState<Partner | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [mergeModalOpened, { open: openMerge, close: closeMerge }] = useDisclosure(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 50;

  const createForm = useForm({
    initialValues: {
      inn: '',
      kpp: '',
      nameFull: '',
      nameShort: '',
      addressLegal: '',
      phoneMain: '',
      email: '',
      createLogin: false,
      loginEmail: '',
      loginPassword: '',
    },
  });

  // Initial fetch and page change
  useEffect(() => {
    fetchPartners(page);
  }, [page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchPartners(1);
      } else {
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  async function fetchPartners(currentPage: number = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
        search: search,
      });
      
      const res = await fetch(`/api/admin/partners?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    } finally {
      setLoading(false);
    }
  }

  async function searchByInn(inn: string) {
    if (!inn.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/admin/partners/search?inn=${inn}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Партнёр не найден');
      }

      setFoundPartner(data.partner);
      open();
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось найти партнёра',
        color: 'red',
      });
    } finally {
      setSearching(false);
    }
  }

  async function createPartner() {
    if (!foundPartner) return;

    try {
      const res = await fetch('/api/admin/partners/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inn: foundPartner.inn,
          kpp: foundPartner.kpp,
          nameFull: foundPartner.nameFull,
          nameShort: foundPartner.nameShort,
          addressLegal: foundPartner.addressLegal,
          phoneMain: foundPartner.phoneMain,
          email: foundPartner.email,
          guid1c: foundPartner.guid1c,
          createLogin: createForm.values.createLogin,
          loginEmail: createForm.values.loginEmail,
          loginPassword: createForm.values.loginPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка создания');
      }

      notifications.show({
        title: 'Успешно',
        message: data.user 
          ? 'Партнёр создан с учётной записью' 
          : 'Партнёр успешно создан',
        color: 'green',
      });

      close();
      setFoundPartner(null);
      fetchPartners();
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось создать партнёра',
        color: 'red',
      });
    }
  }

  async function mergePartners() {
    if (!selectedPartner || !mergeTargetId) return;

    try {
      const res = await fetch('/api/admin/partners/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePartnerId: selectedPartner.id,
          targetPartnerId: parseInt(mergeTargetId),
          reason: 'Объединение дубликатов',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка объединения');
      }

      notifications.show({
        title: 'Успешно',
        message: 'Партнёры объединены',
        color: 'green',
      });

      closeMerge();
      setSelectedPartner(null);
      fetchPartners();
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось объединить партнёров',
        color: 'red',
      });
    }
  }

  const openMergeModal = (partner: Partner) => {
    setSelectedPartner(partner);
    openMerge();
  };

  return (
    <Box>
      <Title order={2} mb="xl">Партнёры</Title>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Group mb="md">
          <TextInput
            placeholder="Поиск по наименованию или ИНН"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={18} />}
            style={{ flex: 1 }}
          />
          <Button
            variant="outline"
            leftSection={<IconUserPlus size={18} />}
            onClick={() => {
              const inn = prompt('Введите ИНН для поиска в 1С');
              if (inn) searchByInn(inn);
            }}
            loading={searching}
          >
            Добавить из 1С
          </Button>
        </Group>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Все партнёры</Title>
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

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : partners.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Партнёров пока нет</Text>
        ) : (
          <>
            <ScrollArea>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Наименование</Table.Th>
                    <Table.Th>ИНН/КПП</Table.Th>
                    <Table.Th>Телефон</Table.Th>
                    <Table.Th>Баланс</Table.Th>
                    <Table.Th>Статус</Table.Th>
                    <Table.Th>Действия</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {partners.map((partner) => (
                    <Table.Tr key={partner.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{partner.nameFull}</Text>
                        {partner.nameShort && (
                          <Text size="xs" c="dimmed">{partner.nameShort}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{partner.inn || '-'}</Text>
                        {partner.kpp && (
                          <Text size="xs" c="dimmed">КПП: {partner.kpp}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{partner.phoneMain || '-'}</Text>
                        {partner.email && (
                          <Text size="xs" c="dimmed">{partner.email}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {partner.balanceDebit > 0 && (
                          <Badge color="orange" size="sm">
                            Дебитор: {partner.balanceDebit.toLocaleString('ru-RU')} ₽
                          </Badge>
                        )}
                        {partner.balanceCredit > 0 && (
                          <Badge color="blue" size="sm">
                            Кредитор: {partner.balanceCredit.toLocaleString('ru-RU')} ₽
                          </Badge>
                        )}
                        {partner.balanceDebit === 0 && partner.balanceCredit === 0 && (
                          <Text size="sm" c="dimmed">0 ₽</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {partner.isMerged ? (
                          <Badge color="gray" size="sm">Объединён</Badge>
                        ) : (
                          <Badge color="green" size="sm">Активен</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {!partner.isMerged && (
                            <Button
                              size="compact-xs"
                              variant="outline"
                              leftSection={<IconLink size={14} />}
                              onClick={() => openMergeModal(partner)}
                            >
                              Объединить
                            </Button>
                          )}
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

      {/* Create Partner Modal */}
      <Modal opened={opened} onClose={close} title="Создание партнёра" size="lg">
        {foundPartner && (
          <Stack>
            <Card withBorder bg="gray.0">
              <Text fw={500} mb="xs">Найдено в 1С:</Text>
              <Text size="sm"><b>Наименование:</b> {foundPartner.nameFull}</Text>
              <Text size="sm"><b>ИНН:</b> {foundPartner.inn}</Text>
              {foundPartner.kpp && <Text size="sm"><b>КПП:</b> {foundPartner.kpp}</Text>}
              {foundPartner.addressLegal && <Text size="sm"><b>Адрес:</b> {foundPartner.addressLegal}</Text>}
              {foundPartner.phoneMain && <Text size="sm"><b>Телефон:</b> {foundPartner.phoneMain}</Text>}
              {foundPartner.email && <Text size="sm"><b>Email:</b> {foundPartner.email}</Text>}
            </Card>

            <TextInput
              label="Email для входа"
              placeholder="partner@example.com"
              {...createForm.getInputProps('loginEmail')}
              disabled={!createForm.values.createLogin}
            />

            <TextInput
              label="Пароль"
              type="password"
              placeholder="••••••••"
              {...createForm.getInputProps('loginPassword')}
              disabled={!createForm.values.createLogin}
            />

            <Group justify="space-between" mt="md">
              <Button
                variant={createForm.values.createLogin ? 'filled' : 'outline'}
                onClick={() => createForm.setFieldValue('createLogin', !createForm.values.createLogin)}
              >
                {createForm.values.createLogin ? 'Создать учётную запись' : 'Без учётной записи'}
              </Button>
              <Group>
                <Button variant="outline" onClick={close}>Отмена</Button>
                <Button onClick={createPartner}>Создать</Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Merge Partners Modal */}
      <Modal opened={mergeModalOpened} onClose={closeMerge} title="Объединение партнёров">
        {selectedPartner && (
          <Stack>
            <Text>
              Партнёр <b>{selectedPartner.nameFull}</b> будет объединён с другим партнёром.
              Все заказы и пользователи будут перенесены.
            </Text>

            <Select
              label="Целевой партнёр (к которому объединяем)"
              data={partners
                .filter(p => p.id !== selectedPartner.id && !p.isMerged)
                .map(p => ({
                  value: String(p.id),
                  label: `${p.nameFull} (ИНН: ${p.inn || '-'})`,
                }))
              }
              value={mergeTargetId}
              onChange={(value) => setMergeTargetId(value || '')}
              searchable
              nothingFoundMessage="Нет других партнёров"
            />

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={closeMerge}>Отмена</Button>
              <Button 
                color="red" 
                onClick={mergePartners}
                disabled={!mergeTargetId}
              >
                Объединить
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
