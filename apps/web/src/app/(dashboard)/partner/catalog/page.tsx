'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Title, Text, SimpleGrid, Card, Image, Badge, Group, Button, 
  TextInput, Stack, Loader, Pagination, NavLink, ScrollArea, Divider,
  Breadcrumbs, Anchor, ActionIcon, Menu, Select
} from '@mantine/core';
import { 
  IconSearch, 
  IconShoppingCartPlus, 
  IconChevronRight, 
  IconFilter, 
  IconLayoutGrid, 
  IconList 
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Product {
  id: number;
  name: string;
  article: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
  images: { fileUrl: string }[];
  groupId: number | null;
}

interface Group {
  id: number;
  name1c: string;
  parentId: number | null;
}

export default function PartnerCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchCatalog();
  }, [page, selectedGroupId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchCatalog();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  async function fetchCatalog() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        search,
        ...(selectedGroupId && { groupId: String(selectedGroupId) }),
      });
      const res = await fetch(`/api/catalog?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setGroups(data.groups || []);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  const addToCart = async (product: Product) => {
    try {
      const res = await fetch('/api/partner/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });

      if (res.ok) {
        notifications.show({
          title: 'Добавлено в корзину',
          message: `${product.name} добавлен в вашу заявку`,
          color: 'green',
        });
        // Dispatch custom event to update cart badge in layout
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        throw new Error();
      }
    } catch (e) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось добавить товар в корзину',
        color: 'red',
      });
    }
  };

  const getBreadcrumbs = () => {
    const items: { title: string; id: number | null }[] = [{ title: 'Каталог', id: null }];
    if (selectedGroupId) {
      let current = groups.find(g => g.id === selectedGroupId);
      const path: { title: string; id: number | null }[] = [];
      while (current) {
        path.unshift({ title: current.name1c, id: current.id });
        current = groups.find(g => g.id === current?.parentId);
      }
      items.push(...path);
    }
    return items.map((item, index) => (
      <Anchor 
        key={index} 
        onClick={() => setSelectedGroupId(item.id)}
        style={{ cursor: 'pointer' }}
      >
        {item.title}
      </Anchor>
    ));
  };

  const renderGroupTree = (parentId: number | null = null, depth = 0) => {
    return groups
      .filter(g => g.parentId === parentId)
      .map(group => {
        const hasChildren = groups.some(g => g.parentId === group.id);
        const isActive = selectedGroupId === group.id;
        
        return (
          <Box key={group.id}>
            <NavLink
              label={group.name1c}
              active={isActive}
              onClick={() => setSelectedGroupId(group.id)}
              leftSection={depth === 0 ? null : <IconChevronRight size={12} />}
              childrenOffset={16}
              defaultOpened={isActive || groups.some(g => g.parentId === group.id && g.id === selectedGroupId)}
            >
              {hasChildren && renderGroupTree(group.id, depth + 1)}
            </NavLink>
          </Box>
        );
      });
  };

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Каталог товаров</Title>
        <Group>
          <ActionIcon.Group>
            <ActionIcon 
              variant={viewMode === 'grid' ? 'filled' : 'outline'} 
              onClick={() => setViewViewMode('grid')}
              size="lg"
            >
              <IconLayoutGrid size={20} />
            </ActionIcon>
            <ActionIcon 
              variant={viewMode === 'list' ? 'filled' : 'outline'} 
              onClick={() => setViewViewMode('list')}
              size="lg"
            >
              <IconList size={20} />
            </ActionIcon>
          </ActionIcon.Group>
        </Group>
      </Group>

      <Group grow mb="xl">
        <TextInput
          placeholder="Поиск по названию или артикулу..."
          leftSection={<IconSearch size={18} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="md"
        />
      </Group>

      <Breadcrumbs mb="xl">{getBreadcrumbs()}</Breadcrumbs>

      <Group align="flex-start" gap="xl">
        {/* Sidebar Categories */}
        <Box style={{ width: 280 }} visibleFrom="sm">
          <Card withBorder padding="sm" radius="md">
            <Text fw={700} mb="xs" px="sm">Категории</Text>
            <Divider mb="sm" />
            <ScrollArea h={600} offsetScrollbars>
              <NavLink 
                label="Все товары" 
                active={selectedGroupId === null} 
                onClick={() => setSelectedGroupId(null)} 
                mb={4}
              />
              {renderGroupTree(null)}
            </ScrollArea>
          </Card>
        </Box>

        {/* Product List */}
        <Box style={{ flex: 1 }}>
          {loading ? (
            <Group justify="center" py="xl">
              <Loader size="xl" />
            </Group>
          ) : products.length === 0 ? (
            <Card withBorder py="xl" ta="center">
              <Text c="dimmed">Товары не найдены</Text>
            </Card>
          ) : (
            <Stack>
              {viewMode === 'grid' ? (
                <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="lg">
                  {products.map((product) => (
                    <Card key={product.id} shadow="sm" padding="md" radius="md" withBorder>
                      <Card.Section>
                        <Image
                          src={product.images[0]?.fileUrl || '/images/no-image.svg'}
                          height={160}
                          alt={product.name}
                          fallbackSrc="/images/no-image.svg"
                        />
                      </Card.Section>

                      <Stack justify="space-between" mt="md" style={{ height: '100%' }}>
                        <Box>
                          <Text size="xs" c="dimmed" mb={4}>{product.article || 'Нет артикула'}</Text>
                          <Text fw={500} lineClamp={2} size="sm" h={40}>
                            {product.name}
                          </Text>
                        </Box>

                        <Box mt="md">
                          <Group justify="space-between" align="flex-end">
                            <Box>
                              <Text size="xs" c="dimmed">Цена за ед.</Text>
                              <Text fw={700} size="lg">
                                {Number(product.retailPrice || 0).toLocaleString('ru-RU')} ₽
                              </Text>
                            </Box>
                            <ActionIcon 
                              color="blue" 
                              size="lg" 
                              radius="xl" 
                              variant="filled"
                              onClick={() => addToCart(product)}
                            >
                              <IconShoppingCartPlus size={20} />
                            </ActionIcon>
                          </Group>
                        </Box>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              ) : (
                <Stack gap="xs">
                  {products.map((product) => (
                    <Card key={product.id} withBorder padding="xs" radius="md">
                      <Group wrap="nowrap">
                        <Image
                          src={product.images[0]?.fileUrl || '/images/no-image.svg'}
                          width={80}
                          height={80}
                          radius="md"
                          fallbackSrc="/images/no-image.svg"
                        />
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Text size="xs" c="dimmed">{product.article}</Text>
                          <Text fw={500} size="sm">{product.name}</Text>
                        </Stack>
                        <Group gap="xl">
                          <Box ta="right">
                            <Text size="xs" c="dimmed">Цена</Text>
                            <Text fw={700}>{Number(product.retailPrice || 0).toLocaleString('ru-RU')} ₽</Text>
                          </Box>
                          <Button 
                            leftSection={<IconShoppingCartPlus size={16} />}
                            variant="light"
                            onClick={() => addToCart(product)}
                          >
                            В корзину
                          </Button>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}

              <Group justify="center" mt="xl">
                <Pagination 
                  total={totalPages} 
                  value={page} 
                  onChange={setPage} 
                  withEdges 
                />
              </Group>
            </Stack>
          )}
        </Box>
      </Group>
    </Box>
  );
}
