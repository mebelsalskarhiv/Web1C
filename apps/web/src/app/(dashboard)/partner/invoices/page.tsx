'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Title, Card, Text, Group, Table, ScrollArea, Badge, 
  Loader, Pagination, Stack, Button, Modal, ActionIcon, Tooltip
} from '@mantine/core';
import { IconEye, IconPrinter, IconDownload, IconFileCheck } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

export default function PartnerInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [opened, { open, close }] = useDisclosure(false);

  useEffect(() => {
    fetchInvoices();
  }, [page]);

  async function fetchInvoices() {
    setLoading(true);
    try {
      // Invoices are orders with 'shipped' or 'completed' status
      const params = new URLSearchParams({
        page: String(page),
        status: 'shipped', // or completed, for demo we just fetch all and filter
      });
      const res = await fetch(`/api/partner/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.orders || []);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = (invoice: any) => {
    window.print();
  };

  return (
    <Box>
      <Title order={2} mb="xl">Мои накладные</Title>

      <Card withBorder shadow="sm" p={0}>
        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : invoices.length === 0 ? (
          <Box py="xl" ta="center">
            <Text c="dimmed">Накладные не найдены. Они появятся после отгрузки ваших заказов.</Text>
          </Box>
        ) : (
          <>
            <ScrollArea>
              <Table verticalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Номер накладной</Table.Th>
                    <Table.Th>Дата отгрузки</Table.Th>
                    <Table.Th>Заказ</Table.Th>
                    <Table.Th>Получатель</Table.Th>
                    <Table.Th>Сумма</Table.Th>
                    <Table.Th>Статус</Table.Th>
                    <Table.Th>Действия</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invoices.map((invoice) => (
                    <Table.Tr key={invoice.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <IconFileCheck size={16} color="green" />
                          <Text size="sm" fw={500}>{invoice.realizationGuid1c?.substring(0, 12) || `РЕ-${invoice.id}`}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(invoice.realizationDate || invoice.updatedAt).toLocaleDateString('ru-RU')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="blue">{invoice.orderNumber1c || invoice.orderNumberWeb}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{invoice.partner?.nameFull}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {Number(invoice.totalAmount).toLocaleString('ru-RU')} ₽
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="green" variant="light">Отгружено</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Просмотр">
                            <ActionIcon variant="subtle" color="blue" onClick={() => { setSelectedInvoice(invoice); open(); }}>
                              <IconEye size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Печать">
                            <ActionIcon variant="subtle" color="gray" onClick={() => handlePrint(invoice)}>
                              <IconPrinter size={18} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Скачать PDF">
                            <ActionIcon variant="subtle" color="gray">
                              <IconDownload size={18} />
                            </ActionIcon>
                          </Tooltip>
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

      <Modal opened={opened} onClose={close} title="Просмотр накладной" size="xl">
        {selectedInvoice && (
          <Stack>
            <Group justify="space-between">
              <Box>
                <Title order={4}>Товарная накладная № {selectedInvoice.realizationGuid1c?.substring(0, 12) || `РЕ-${selectedInvoice.id}`}</Title>
                <Text size="sm" c="dimmed">от {new Date(selectedInvoice.realizationDate || selectedInvoice.updatedAt).toLocaleDateString('ru-RU')}</Text>
              </Box>
              <Badge size="lg" color="green">Оплачено</Badge>
            </Group>

            <Box mt="md">
              <Text size="sm"><b>Поставщик:</b> ООО "Торговый Дом Web1C"</Text>
              <Text size="sm"><b>Грузополучатель:</b> {selectedInvoice.partner?.nameFull}</Text>
              <Text size="sm"><b>Основание:</b> Заказ покупателя № {selectedInvoice.orderNumber1c || selectedInvoice.orderNumberWeb}</Text>
            </Box>

            <Table withColumnBorders withTableBorder mt="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>№</Table.Th>
                  <Table.Th>Товар</Table.Th>
                  <Table.Th ta="center">Кол-во</Table.Th>
                  <Table.Th ta="right">Цена</Table.Th>
                  <Table.Th ta="right">Сумма</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedInvoice.items.map((item: any, idx: number) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{idx + 1}</Table.Td>
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
                  <Table.Th colSpan={4} ta="right">Всего к оплате:</Table.Th>
                  <Table.Th ta="right">{Number(selectedInvoice.totalAmount).toLocaleString('ru-RU')} ₽</Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>

            <Group justify="flex-end" mt="xl" className="no-print">
              <Button variant="outline" leftSection={<IconPrinter size={18} />} onClick={() => handlePrint(selectedInvoice)}>
                Печать
              </Button>
              <Button onClick={close}>Закрыть</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}
