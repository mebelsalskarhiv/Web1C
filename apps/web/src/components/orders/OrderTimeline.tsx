'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Title, Text, Card, Group, Badge, Button, Stack, Divider, 
  Progress, ScrollArea, ActionIcon, Tooltip, SimpleGrid
} from '@mantine/core';
import { 
  IconTrendingUp, IconTrendingDown, IconClock, IconCalendar, 
  IconPackage, IconTruck, IconCheck, IconX, IconInfoCircle 
} from '@tabler/icons-react';

interface OrderTimelineProps {
  order: {
    id: number;
    status: string;
    createdAt: string | Date;
    updatedAt?: string | Date;
    items?: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    trackingNumber?: string;
    expectedDelivery?: string | Date;
  };
}

export function OrderTimeline({ order }: OrderTimelineProps) {
  const getStatusProgress = (status: string) => {
    const statusOrder = ['new', 'confirmed', 'processing', 'shipped', 'completed'];
    const currentIndex = statusOrder.indexOf(status);
    return ((currentIndex + 1) / statusOrder.length) * 100;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Новый',
      confirmed: 'Подтверждён',
      processing: 'В обработке',
      shipped: 'Отправлен',
      completed: 'Выполнен',
      cancelled: 'Отменён',
      reserved: 'Зарезервирован',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'blue',
      confirmed: 'cyan',
      processing: 'yellow',
      shipped: 'orange',
      completed: 'green',
      cancelled: 'red',
      reserved: 'violet',
    };
    return colors[status] || 'gray';
  };

  const timeline = [
    { status: 'new', label: 'Заказ создан', date: order.createdAt, icon: IconCalendar },
    { status: 'confirmed', label: 'Подтверждён', date: null, icon: IconCheck },
    { status: 'processing', label: 'Комплектация', date: null, icon: IconPackage },
    { status: 'shipped', label: 'Отправлен', date: null, icon: IconTruck },
    { status: 'completed', label: 'Получен', date: null, icon: IconCheck },
  ];

  const currentStatusIndex = timeline.findIndex(t => t.status === order.status);

  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" mb="lg">
        <Box>
          <Text size="xs" c="dimmed">Заказ №{order.id}</Text>
          <Title order={4}>Статус заказа</Title>
        </Box>
        <Badge 
          color={getStatusColor(order.status)} 
          variant="filled" 
          size="lg"
          leftSection={
            order.status === 'completed' ? <IconCheck size={16} /> :
            order.status === 'cancelled' ? <IconX size={16} /> :
            <IconClock size={16} />
          }
        >
          {getStatusLabel(order.status)}
        </Badge>
      </Group>

      {/* Progress Bar */}
      <Progress 
        value={getStatusProgress(order.status)} 
        size="xl" 
        radius="xl"
        color={getStatusColor(order.status)}
        mb="xl"
      />

      {/* Timeline */}
      <Stack gap="md">
        {timeline.map((step, index) => {
          const isCompleted = index <= currentStatusIndex;
          const isCurrent = index === currentStatusIndex;
          const Icon = step.icon;

          return (
            <Group key={step.status} gap="md" align="flex-start">
              <ActionIcon
                variant={isCompleted ? 'filled' : 'outline'}
                color={isCompleted ? getStatusColor(step.status) : 'gray'}
                size="lg"
                radius="xl"
              >
                <Icon size={18} />
              </ActionIcon>
              
              <Box style={{ flex: 1 }}>
                <Group justify="space-between">
                  <Text fw={isCurrent ? 700 : 500} c={isCompleted ? undefined : 'dimmed'}>
                    {step.label}
                  </Text>
                  {step.date && (
                    <Text size="xs" c="dimmed">
                      {new Date(step.date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </Group>
                
                {isCurrent && order.status === 'shipped' && order.trackingNumber && (
                  <Box mt="xs">
                    <Text size="sm" c="dimmed">Трекинг-номер:</Text>
                    <Text fw={600}>{order.trackingNumber}</Text>
                  </Box>
                )}
                
                {isCurrent && order.expectedDelivery && (
                  <Box mt="xs">
                    <Text size="sm" c="dimmed">Ожидаемая доставка:</Text>
                    <Text fw={600}>
                      {new Date(order.expectedDelivery).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </Text>
                  </Box>
                )}
              </Box>

              {isCompleted && index < currentStatusIndex && (
                <Badge color="green" variant="light" size="xs">
                  ✓
                </Badge>
              )}
            </Group>
          );
        })}
      </Stack>

      {order.trackingNumber && (
        <>
          <Divider my="lg" />
          <Group justify="space-between">
            <Box>
              <Text size="sm" c="dimmed">Отслеживание</Text>
              <Text fw={600}>{order.trackingNumber}</Text>
            </Box>
            <Button variant="outline" size="sm">
              Отследить на сайте перевозчика
            </Button>
          </Group>
        </>
      )}
    </Card>
  );
}

interface OrderStatsProps {
  stats: {
    totalOrders: number;
    totalAmount: number;
    averageOrderValue: number;
    lastOrderDate?: string | Date;
    completionRate: number;
  };
}

export function OrderStats({ stats }: OrderStatsProps) {
  const statCards = [
    {
      title: 'Всего заказов',
      value: stats.totalOrders,
      icon: IconPackage,
      color: 'blue',
      trend: null,
    },
    {
      title: 'Общая сумма',
      value: `${stats.totalAmount.toLocaleString('ru-RU')} ₽`,
      icon: IconTrendingUp,
      color: 'green',
      trend: null,
    },
    {
      title: 'Средний чек',
      value: `${Math.round(stats.averageOrderValue).toLocaleString('ru-RU')} ₽`,
      icon: IconTrendingDown,
      color: 'cyan',
      trend: null,
    },
    {
      title: 'Выполнено',
      value: `${stats.completionRate}%`,
      icon: IconCheck,
      color: 'green',
      trend: stats.completionRate >= 90 ? 'up' : stats.completionRate >= 70 ? 'stable' : 'down',
    },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} withBorder radius="md" padding="lg">
            <Group justify="space-between">
              <Box>
                <Text size="xs" c="dimmed">{stat.title}</Text>
                <Text fw={700} size="xl" mt={4}>{stat.value}</Text>
              </Box>
              <ActionIcon variant="light" color={stat.color} size="lg" radius="md">
                <Icon size={24} />
              </ActionIcon>
            </Group>
            
            {stat.trend && (
              <Group gap="xs" mt="sm">
                {stat.trend === 'up' && <IconTrendingUp size={16} color="green" />}
                {stat.trend === 'down' && <IconTrendingDown size={16} color="red" />}
                <Text size="xs" c="dimmed">
                  {stat.trend === 'up' ? 'Отлично' : stat.trend === 'down' ? 'Нужно улучшить' : 'Нормально'}
                </Text>
              </Group>
            )}
          </Card>
        );
      })}
    </SimpleGrid>
  );
}

