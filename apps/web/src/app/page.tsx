import { Container, Title, Text, Card, Group, Button, SimpleGrid, Badge, Stack, Box } from '@mantine/core';
import { 
  IconUsers, IconPackage, IconShoppingCart, IconFileText, 
  IconHeart, IconBell, IconCompare, IconFilter, IconClock,
  IconCreditCard, IconTrendingUp, IconStar
} from '@tabler/icons-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} ta="center" mb="lg">
        Web1C Shop - Интернет-магазин с интеграцией 1С
      </Title>
      
      <Text c="dimmed" ta="center" mb="xl" size="lg">
        Многопользовательская платформа с синхронизацией товаров, заказов и партнёров с 1С:УТ 11.5
      </Text>

      {/* Основные возможности */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg" mb="xl">
        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="center" mb="md">
            <IconUsers size={48} stroke={1.5} />
          </Group>
          <Title order={3} ta="center" mb="sm">3 Роли</Title>
          <Text size="sm" c="dimmed" ta="center">
            Администратор, Партнёр, Покупатель
          </Text>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="center" mb="md">
            <IconPackage size={48} stroke={1.5} />
          </Group>
          <Title order={3} ta="center" mb="sm">Товары</Title>
          <Text size="sm" c="dimmed" ta="center">
            Синхронизация номенклатуры, цен и остатков
          </Text>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="center" mb="md">
            <IconShoppingCart size={48} stroke={1.5} />
          </Group>
          <Title order={3} ta="center" mb="sm">Заказы</Title>
          <Text size="sm" c="dimmed" ta="center">
            Создание заказов и отслеживание статусов
          </Text>
        </Card>

        <Card shadow="sm" padding="lg" withBorder>
          <Group justify="center" mb="md">
            <IconFileText size={48} stroke={1.5} />
          </Group>
          <Title order={3} ta="center" mb="sm">OData</Title>
          <Text size="sm" c="dimmed" ta="center">
            Двусторонняя синхронизация с 1С
          </Text>
        </Card>
      </SimpleGrid>

      {/* Новые улучшения UX */}
      <Card shadow="md" padding="xl" withBorder mb="xl">
        <Title order={2} mb="md">🎉 Новые возможности пользовательского интерфейса</Title>
        
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mb="lg">
          {/* Товары */}
          <Box>
            <Title order={3} mb="sm">🛍️ Улучшенный каталог</Title>
            <Stack gap="xs">
              <Badge leftSection={<IconHeart size={14} />} variant="light" size="lg">Избранное</Badge>
              <Badge leftSection={<IconBell size={14} />} variant="light" size="lg">Подписка на наличие</Badge>
              <Badge leftSection={<IconCompare size={14} />} variant="light" size="lg">Сравнение товаров</Badge>
              <Badge leftSection={<IconFilter size={14} />} variant="light" size="lg">Расширенные фильтры</Badge>
              <Badge leftSection={<IconStar size={14} />} variant="light" size="lg">Рейтинги и отзывы</Badge>
            </Stack>
          </Box>

          {/* Заказы */}
          <Box>
            <Title order={3} mb="sm">📦 Управление заказами</Title>
            <Stack gap="xs">
              <Badge leftSection={<IconClock size={14} />} variant="light" size="lg">Временная шкала</Badge>
              <Badge leftSection={<IconTrendingUp size={14} />} variant="light" size="lg">Статистика заказов</Badge>
              <Badge leftSection={<IconCreditCard size={14} />} variant="light" size="lg">Финансовый обзор</Badge>
            </Stack>
          </Box>
        </SimpleGrid>

        <Text c="dimmed" mt="lg" size="sm">
          Все новые компоненты доступны в директории <code>src/components/</code> с подробной документацией
        </Text>
      </Card>

      {/* Возможности системы */}
      <Card shadow="md" padding="xl" withBorder mb="xl">
        <Title order={2} mb="md">Возможности системы</Title>
        
        <Group gap="sm" mb="lg">
          <Badge variant="light" size="lg">✓ Синхронизация товаров и групп</Badge>
          <Badge variant="light" size="lg">✓ Загрузка изображений товаров</Badge>
          <Badge variant="light" size="lg">✓ Обновление остатков и цен</Badge>
        </Group>
        <Group gap="sm" mb="lg">
          <Badge variant="light" size="lg">✓ Поиск партнёров по ИНН</Badge>
          <Badge variant="light" size="lg">✓ История заказов из 1С</Badge>
          <Badge variant="light" size="lg">✓ Резервирование товаров</Badge>
        </Group>
        <Group gap="sm" mb="lg">
          <Badge variant="light" size="lg">✓ Печать накладных с штрих-кодом</Badge>
          <Badge variant="light" size="lg">✓ Статусы заказов в реальном времени</Badge>
          <Badge variant="light" size="lg">✓ Склеивание контрагентов</Badge>
        </Group>
      </Card>

      <Group justify="center" mt="xl" gap="md">
        <Button component={Link} href="/login" variant="filled" size="lg">
          Войти
        </Button>
        <Button component={Link} href="/register" variant="outline" size="lg">
          Регистрация
        </Button>
      </Group>
    </Container>
  );
}
