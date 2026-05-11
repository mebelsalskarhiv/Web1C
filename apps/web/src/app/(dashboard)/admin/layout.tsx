'use client';

import { AppShell, Container, Title, Group, Button, Badge } from '@mantine/core';
import { IconPackages, IconUsers, IconShoppingCart, IconRefresh, IconSettings, IconLogout, IconDatabase, IconPackage, IconUserPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { refreshUser } = useAuth();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refreshUser();
    router.push('/login');
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Web1C Admin</Title>
          <Badge variant="light">Администратор</Badge>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Button component={Link} href="/admin" variant="subtle" fullWidth justify="start" leftSection={<IconPackages size={18} />}>
          Товары
        </Button>
        <Button component={Link} href="/admin/partners" variant="subtle" fullWidth justify="start" leftSection={<IconUsers size={18} />}>
          Партнёры
        </Button>
        <Button component={Link} href="/admin/users" variant="subtle" fullWidth justify="start" leftSection={<IconUserPlus size={18} />}>
          Пользователи
        </Button>
        <Button component={Link} href="/admin/orders" variant="subtle" fullWidth justify="start" leftSection={<IconShoppingCart size={18} />}>
          Заказы
        </Button>
        <Button component={Link} href="/admin/stocks" variant="subtle" fullWidth justify="start" leftSection={<IconPackage size={18} />}>
          Остатки
        </Button>
        <Button component={Link} href="/admin/sync" variant="subtle" fullWidth justify="start" leftSection={<IconRefresh size={18} />}>
          Синхронизация
        </Button>
        <Button component={Link} href="/admin/odata-logs" variant="subtle" fullWidth justify="start" leftSection={<IconDatabase size={18} />}>
          OData логи
        </Button>
        <Button component={Link} href="/admin/settings" variant="subtle" fullWidth justify="start" leftSection={<IconSettings size={18} />}>
          Настройки
        </Button>
        <Button mt="auto" variant="subtle" color="red" fullWidth justify="start" leftSection={<IconLogout size={18} />} onClick={handleLogout}>
          Выйти
        </Button>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl">{children}</Container>
      </AppShell.Main>
    </AppShell>
  );
}
