import { Container, Title, Text, Card, Group, Button, SimpleGrid, Badge } from '@mantine/core';
import { IconUsers, IconPackage, IconShoppingCart, IconFileText } from '@tabler/icons-react';
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

      <Card shadow="md" padding="xl" withBorder>
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
