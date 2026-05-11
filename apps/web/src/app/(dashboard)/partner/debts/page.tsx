'use client';

import { useState, useEffect } from 'react';
import { Box, Title, Card, Text, Group, SimpleGrid, Badge, Table, ScrollArea, Loader, Stack, ThemeIcon, Paper, Progress } from '@mantine/core';
import { IconWallet, IconAlertCircle, IconCheck, IconReceipt2 } from '@tabler/icons-react';

interface DebtData {
  partners: any[];
  stats: {
    totalDebt: number;
    totalCredit: number;
  };
}

export default function PartnerDebts() {
  const [data, setData] = useState<DebtData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDebts();
  }, []);

  async function fetchDebts() {
    setLoading(true);
    try {
      const res = await fetch('/api/partner/dashboard'); // Reuse dashboard API for now
      if (res.ok) {
        const data = await res.json();
        setData(data);
      }
    } catch (error) {
      console.error('Failed to fetch debts:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Group justify="center" py="xl"><Loader /></Group>;
  if (!data) return <Text>Нет данных</Text>;

  return (
    <Box>
      <Title order={2} mb="xl">Взаиморасчеты и долги</Title>

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="xl">
        <Paper withBorder p="lg" radius="md" bg="red.0">
          <Group justify="space-between">
            <Stack gap={0}>
              <Text size="sm" c="red.9" fw={700} tt="uppercase">Общая задолженность</Text>
              <Text fw={700} size="xl" c="red.9">{data.stats.totalDebt.toLocaleString('ru-RU')} ₽</Text>
            </Stack>
            <ThemeIcon color="red" variant="light" size="xl" radius="md">
              <IconAlertCircle size={30} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper withBorder p="lg" radius="md" bg="green.0">
          <Group justify="space-between">
            <Stack gap={0}>
              <Text size="sm" c="green.9" fw={700} tt="uppercase">Ваши авансы</Text>
              <Text fw={700} size="xl" c="green.9">{data.stats.totalCredit.toLocaleString('ru-RU')} ₽</Text>
            </Stack>
            <ThemeIcon color="green" variant="light" size="xl" radius="md">
              <IconCheck size={30} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      <Card withBorder shadow="sm">
        <Title order={3} mb="md">Детализация по точкам продаж</Title>
        <ScrollArea>
          <Table verticalSpacing="md" withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Точка продаж</Table.Th>
                <Table.Th>ИНН</Table.Th>
                <Table.Th ta="right">Долг (Дебет)</Table.Th>
                <Table.Th ta="right">Аванс (Кредит)</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.partners.map((partner) => {
                const debt = Number(partner.balanceDebit);
                const credit = Number(partner.balanceCredit);
                return (
                  <Table.Tr key={partner.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{partner.nameFull}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{partner.inn}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c={debt > 0 ? 'red' : 'dimmed'}>
                        {debt.toLocaleString('ru-RU')} ₽
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c={credit > 0 ? 'green' : 'dimmed'}>
                        {credit.toLocaleString('ru-RU')} ₽
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {debt > 0 ? (
                        <Badge color="red" variant="light">Требует оплаты</Badge>
                      ) : (
                        <Badge color="green" variant="light">Оплачено</Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Card withBorder shadow="sm" mt="xl">
        <Group mb="md">
          <IconReceipt2 size={24} color="gray" />
          <Title order={3}>Реестр платежей (заглушка)</Title>
        </Group>
        <Text c="dimmed" ta="center" py="xl">
          История платежей будет доступна после настройки интеграции с банковскими выписками или 1С:Бухгалтерией.
        </Text>
      </Card>
    </Box>
  );
}
