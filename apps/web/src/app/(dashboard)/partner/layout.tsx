'use client';

import { AppShell, Container, Title, Group, Button, Badge, Box, NavLink, Burger, Stack, ScrollArea, Indicator } from '@mantine/core';
import { 
  IconShoppingCart, 
  IconUser, 
  IconLogout, 
  IconHome, 
  IconLayoutDashboard, 
  IconPackages, 
  IconFileText, 
  IconWallet, 
  IconChartBar,
  IconShoppingBag
} from '@tabler/icons-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, refreshUser } = useAuth();
  const [opened, { toggle }] = useDisclosure();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    fetchCartCount();
    // Refresh cart count on order creation or addition
    window.addEventListener('cartUpdated', fetchCartCount);
    return () => window.removeEventListener('cartUpdated', fetchCartCount);
  }, []);

  async function fetchCartCount() {
    try {
      const res = await fetch('/api/partner/cart');
      if (res.ok) {
        const data = await res.json();
        setCartCount(data.cartItems.length);
      }
    } catch (e) {}
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refreshUser();
    router.push('/login');
  }

  const navItems = [
    { href: '/partner', label: 'Рабочий стол', icon: IconLayoutDashboard },
    { href: '/partner/catalog', label: 'Каталог товаров', icon: IconPackages },
    { href: '/partner/cart', label: 'Корзина', icon: IconShoppingBag, badge: cartCount },
    { href: '/partner/orders', label: 'Мои заявки', icon: IconShoppingCart },
    { href: '/partner/invoices', label: 'Мои накладные', icon: IconFileText },
    { href: '/partner/debts', label: 'Долги', icon: IconWallet },
    { href: '/partner/reports', label: 'Отчеты', icon: IconChartBar },
    { href: '/partner/profile', label: 'Профиль', icon: IconUser },
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>Web1C Partner</Title>
          </Group>
          <Group visibleFrom="sm">
            <Link href="/partner/cart" style={{ textDecoration: 'none' }}>
              <Indicator label={cartCount} size={20} offset={2} disabled={cartCount === 0}>
                <Button variant="subtle" p={5}>
                  <IconShoppingBag size={24} />
                </Button>
              </Indicator>
            </Link>
            <Badge variant="light" size="lg" color="blue">
              {user?.managedPartners?.[0]?.nameFull || user?.email}
            </Badge>
            <Button
              variant="subtle"
              color="red"
              size="compact-sm"
              leftSection={<IconLogout size={18} />}
              onClick={handleLogout}
            >
              Выйти
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap="xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  leftSection={<Icon size={18} />}
                  rightSection={item.badge ? <Badge size="xs" color="blue" circle>{item.badge}</Badge> : null}
                  active={isActive}
                  variant="filled"
                />
              );
            })}
          </Stack>
        </AppShell.Section>
        
        <AppShell.Section hiddenFrom="sm">
          <Button
            variant="subtle"
            color="red"
            fullWidth
            justify="start"
            leftSection={<IconLogout size={18} />}
            onClick={handleLogout}
            mt="md"
          >
            Выйти
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
