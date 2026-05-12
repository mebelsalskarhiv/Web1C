'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Text, Group, ActionIcon, Badge, Stack, Card, Button, 
  RingProgress, ThemeIcon, Tooltip, Divider, ScrollArea, SimpleGrid, Title
} from '@mantine/core';
import { 
  IconWallet, IconCreditCard, IconClock, IconCheck, 
  IconAlertTriangle, IconTrendingUp, IconDownload, IconInfoCircle
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Debt {
  id: number;
  amount: number;
  currency: string;
  dueDate: string | Date;
  status: 'overdue' | 'upcoming' | 'paid';
  invoiceNumber?: string;
  orderIds?: number[];
}

interface FinancialStats {
  totalDebt: number;
  overdueAmount: number;
  availableCredit: number;
  creditLimit: number;
  lastPaymentDate?: string | Date;
  lastPaymentAmount?: number;
}

export function DebtCard({ debt }: { debt: Debt }) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      overdue: 'red',
      upcoming: 'yellow',
      paid: 'green',
    };
    return colors[status] || 'gray';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      overdue: 'Просрочено',
      upcoming: 'Предстоит оплата',
      paid: 'Оплачено',
    };
    return labels[status] || status;
  };

  const getDaysUntilDue = () => {
    const due = new Date(debt.dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue();

  return (
    <Card withBorder radius="md" padding="lg" mb="md">
      <Group justify="space-between" mb="md">
        <Box>
          <Text size="xs" c="dimmed">
            {debt.invoiceNumber ? `Счёт №${debt.invoiceNumber}` : 'Задолженность'}
          </Text>
          <Text fw={700} size="lg">{debt.amount.toLocaleString('ru-RU')} {debt.currency}</Text>
        </Box>
        
        <Badge 
          color={getStatusColor(debt.status)} 
          variant="filled"
          leftSection={
            debt.status === 'overdue' ? <IconAlertTriangle size={14} /> :
            debt.status === 'paid' ? <IconCheck size={14} /> :
            <IconClock size={14} />
          }
        >
          {getStatusLabel(debt.status)}
        </Badge>
      </Group>

      <Group justify="space-between" mb="md">
        <Box>
          <Text size="xs" c="dimmed">Дата оплаты</Text>
          <Text size="sm" fw={500}>
            {new Date(debt.dueDate).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </Box>

        <Box ta="right">
          <Text size="xs" c="dimmed">До оплаты</Text>
          <Text 
            size="sm" 
            fw={600} 
            c={daysUntilDue < 0 ? 'red' : daysUntilDue <= 3 ? 'orange' : 'green'}
          >
            {daysUntilDue < 0 
              ? `Просрочено на ${Math.abs(daysUntilDue)} дн.`
              : daysUntilDue === 0 
                ? 'Сегодня'
                : daysUntilDue === 1 
                  ? 'Завтра' 
                  : `${daysUntilDue} дн.`
            }
          </Text>
        </Box>
      </Group>

      {debt.orderIds && debt.orderIds.length > 0 && (
        <>
          <Divider my="xs" />
          <Box>
            <Text size="xs" c="dimmed" mb={4}>Заказы:</Text>
            <Group gap="xs">
              {debt.orderIds.slice(0, 5).map(orderId => (
                <Badge key={orderId} variant="light" size="sm">
                  №{orderId}
                </Badge>
              ))}
              {debt.orderIds.length > 5 && (
                <Badge variant="light" size="sm">+{debt.orderIds.length - 5}</Badge>
              )}
            </Group>
          </Box>
        </>
      )}

      {debt.status !== 'paid' && (
        <Group mt="md">
          <Button flex={1} variant="filled" onClick={() => {
            notifications.show({
              title: 'Оплата',
              message: 'Переход к оплате...',
              color: 'blue',
            });
          }}>
            Оплатить
          </Button>
          <Button variant="outline" onClick={() => {
            notifications.show({
              title: 'Счёт',
              message: 'Скачивание счёта...',
              color: 'blue',
            });
          }}>
            <IconDownload size={16} style={{ marginRight: 8 }} />
            Счёт
          </Button>
        </Group>
      )}
    </Card>
  );
}

export function FinancialOverview({ stats }: { stats: FinancialStats }) {
  const creditUsagePercent = Math.round((stats.totalDebt / stats.creditLimit) * 100);
  const isOverLimit = stats.totalDebt > stats.creditLimit;

  return (
    <Card withBorder radius="md" padding="lg" mb="xl">
      <Group justify="space-between" mb="lg">
        <Title order={3}>Финансовый обзор</Title>
        <Tooltip label="Кредитный лимит">
          <ActionIcon variant="subtle" color="gray">
            <IconInfoCircle size={20} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack gap="lg">
        {/* Credit Usage */}
        <Group align="center">
          <RingProgress
            size={120}
            thickness={12}
            roundCaps
            sections={[{ 
              value: creditUsagePercent, 
              color: isOverLimit ? 'red' : creditUsagePercent > 80 ? 'orange' : 'green' 
            }]}
            label={
              <Box ta="center">
                <Text size="xs" c="dimmed">Использовано</Text>
                <Text fw={700} size="lg">{creditUsagePercent}%</Text>
              </Box>
            }
          />
          
          <Stack gap="xs" style={{ flex: 1 }}>
            <Box>
              <Text size="xs" c="dimmed">Кредитный лимит</Text>
              <Text fw={600}>{stats.creditLimit.toLocaleString('ru-RU')} ₽</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Использовано</Text>
              <Text fw={600} c={isOverLimit ? 'red' : undefined}>
                {stats.totalDebt.toLocaleString('ru-RU')} ₽
              </Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Доступно</Text>
              <Text fw={600} c={stats.availableCredit < 0 ? 'red' : 'green'}>
                {Math.max(0, stats.availableCredit).toLocaleString('ru-RU')} ₽
              </Text>
            </Box>
          </Stack>
        </Group>

        {/* Quick Stats */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder padding="sm" radius="md">
            <Group>
              <ThemeIcon variant="light" color="red" size="lg" radius="md">
                <IconAlertTriangle size={20} />
              </ThemeIcon>
              <Box>
                <Text size="xs" c="dimmed">Просрочено</Text>
                <Text fw={700} c="red">{stats.overdueAmount.toLocaleString('ru-RU')} ₽</Text>
              </Box>
            </Group>
          </Card>

          <Card withBorder padding="sm" radius="md">
            <Group>
              <ThemeIcon variant="light" color="green" size="lg" radius="md">
                <IconCheck size={20} />
              </ThemeIcon>
              <Box>
                <Text size="xs" c="dimmed">Последняя оплата</Text>
                <Text fw={700}>
                  {stats.lastPaymentAmount?.toLocaleString('ru-RU') || 0} ₽
                </Text>
                {stats.lastPaymentDate && (
                  <Text size="xs" c="dimmed">
                    {new Date(stats.lastPaymentDate).toLocaleDateString('ru-RU')}
                  </Text>
                )}
              </Box>
            </Group>
          </Card>
        </SimpleGrid>

        {/* Actions */}
        <Group mt="md">
          <Button flex={1} leftSection={<IconCreditCard size={18} />} variant="filled">
            Пополнить счёт
          </Button>
          <Button 
            flex={1} 
            leftSection={<IconDownload size={18} />} 
            variant="outline"
            onClick={() => {
              notifications.show({
                title: 'Отчёт',
                message: 'Генерация финансового отчёта...',
                color: 'blue',
              });
            }}
          >
            Скачать отчёт
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

