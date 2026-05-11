'use client';

import { useState, useEffect } from 'react';
import {
  Box, Title, Card, Text, Button, Group, Table, ScrollArea, Badge, TextInput, Switch,
  Accordion, Stack, ActionIcon, Tooltip, Loader, Pagination, Container
} from '@mantine/core';
import { IconSearch, IconUpload, IconFolder, IconPackage, IconChevronRight, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Product {
  id: number;
  guid1c: string;
  article: string | null;
  name: string;
  retailPrice: number | null;
  wholesalePrice: number | null;
  isActive: boolean;
  isMarked: boolean;
  groupId: number | null;
}

interface ProductGroup {
  id: number;
  guid1c: string;
  name1c: string;
  parentId: number | null;
  depth: number;
  products: Product[];
  children: ProductGroup[];
}

export default function AdminProducts() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [ungroupedProducts, setUngroupedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [hideEmptyGroups, setHideEmptyGroups] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    fetchProducts();
  }, [page]);

  // Debounced search and filter (reset to page 1)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts();
    }, 400);

    return () => clearTimeout(timer);
  }, [onlyActive, search]);

  async function fetchProducts() {
    setLoading(true);
    try {
      // Передаем параметры фильтрации на сервер
      const params = new URLSearchParams({
        withGroups: 'true',
        active: onlyActive ? 'true' : 'false',
        page: String(page),
        pageSize: String(pageSize),
        ...(search && { search }),
      });

      const res = await fetch(`/api/admin/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        
        let products: Product[] = data.products || [];
        let groupsData = data.groups || [];
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        
        // Build group hierarchy
        const groupMap = new Map<number, ProductGroup>();
        const rootGroups: ProductGroup[] = [];

        // First pass: create all groups
        groupsData.forEach((group: any) => {
          groupMap.set(group.id, {
            ...group,
            products: [],
            children: [],
          });
        });

        // Second pass: build hierarchy
        groupsData.forEach((group: any) => {
          const currentGroup = groupMap.get(group.id);
          if (currentGroup) {
            if (group.parentId === null) {
              rootGroups.push(currentGroup);
            } else {
              const parentGroup = groupMap.get(group.parentId);
              if (parentGroup) {
                parentGroup.children.push(currentGroup);
              } else {
                rootGroups.push(currentGroup);
              }
            }
          }
        });

        // Assign products to groups
        const ungrouped: Product[] = [];
        products.forEach((product: any) => {
          if (product.groupId) {
            const group = groupMap.get(product.groupId);
            if (group) {
              group.products.push(product);
            } else {
              ungrouped.push(product);
            }
          } else {
            ungrouped.push(product);
          }
        });

        setGroups(rootGroups);
        setUngroupedProducts(ungrouped);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось загрузить товары',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }

  async function syncProducts() {
    notifications.show({
      title: 'Синхронизация',
      message: 'Запущена синхронизация товаров',
      color: 'blue',
      loading: true,
    });

    try {
      const res = await fetch('/api/admin/sync/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'products' }),
      });

      if (!res.ok) throw new Error('Ошибка синхронизации');

      notifications.show({
        title: 'Успешно',
        message: 'Синхронизация товаров запущена',
        color: 'green',
      });
      
      // Refresh after sync
      setTimeout(fetchProducts, 3000);
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось синхронизировать товары',
        color: 'red',
      });
    }
  }

  async function syncPrices() {
    notifications.show({
      title: 'Синхронизация',
      message: 'Запущена синхронизация цен',
      color: 'blue',
      loading: true,
    });

    try {
      const res = await fetch('/api/admin/sync/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'prices' }),
      });

      if (!res.ok) throw new Error('Ошибка синхронизации');

      notifications.show({
        title: 'Успешно',
        message: 'Синхронизация цен запущена',
        color: 'green',
      });
      
      // Refresh after sync
      setTimeout(fetchProducts, 3000);
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось синхронизировать цены',
        color: 'red',
      });
    }
  }

  function toggleGroup(groupId: string) {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  }

  function expandAll() {
    const allGroupIds = new Set<string>();
    const collectIds = (groupsToCollect: ProductGroup[]) => {
      groupsToCollect.forEach(g => {
        allGroupIds.add(String(g.id));
        collectIds(g.children);
      });
    };
    collectIds(groups);
    setExpandedGroups(allGroupIds);
  }

  function collapseAll() {
    setExpandedGroups(new Set());
  }

  // Filter out empty groups (recursively)
  function filterEmptyGroups(groupsToFilter: ProductGroup[]): ProductGroup[] {
    return groupsToFilter
      .map(group => ({
        ...group,
        children: filterEmptyGroups(group.children),
      }))
      .filter(group => {
        const hasProducts = group.products.length > 0;
        const hasChildren = group.children.length > 0;
        return hasProducts || hasChildren;
      });
  }

  const displayedGroups = hideEmptyGroups ? filterEmptyGroups(groups) : groups;

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Товары</Title>
        <Group>
          <Button
            variant="outline"
            leftSection={<IconRefresh size={18} />}
            onClick={syncPrices}
          >
            Синхронизировать цены
          </Button>
          <Button
            variant="outline"
            leftSection={<IconUpload size={18} />}
            onClick={syncProducts}
          >
            Синхронизировать товары
          </Button>
        </Group>
      </Group>

      <Card shadow="sm" padding="lg" withBorder mb="lg">
        <Group>
          <TextInput
            placeholder="Поиск по названию или артикулу"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftSection={<IconSearch size={18} />}
            style={{ flex: 1 }}
          />
          <Switch
            label="Только активные"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.currentTarget.checked)}
          />
          <Switch
            label="Скрыть пустые группы"
            checked={hideEmptyGroups}
            onChange={(e) => setHideEmptyGroups(e.currentTarget.checked)}
          />
          <Button variant="outline" size="sm" onClick={expandAll}>
            Развернуть все
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Свернуть все
          </Button>
        </Group>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Каталог товаров</Title>
          <Text c="dimmed" size="sm">
            {total > 0 ? `Показано ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} из ${total}` : 'Нет товаров'}
            {hideEmptyGroups && ' (пустые скрыты)'}
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
        ) : groups.length === 0 && ungroupedProducts.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            Товары не найдены. Запустите синхронизацию с 1С.
          </Text>
        ) : (
          <Stack gap="md">
            {/* Groups */}
            {displayedGroups.map((group) => (
              <GroupTree
                key={group.id}
                group={group}
                expandedGroups={expandedGroups}
                onToggleGroup={toggleGroup}
              />
            ))}

            {/* Ungrouped products */}
            {ungroupedProducts.length > 0 && (
              <Card withBorder padding="md">
                <Group mb="md">
                  <IconPackage size={20} />
                  <Title order={4}>Без группы ({ungroupedProducts.length})</Title>
                </Group>
                <ProductTable products={ungroupedProducts} />
              </Card>
            )}

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
          </Stack>
        )}
      </Card>
    </Box>
  );
}

// Recursive component for group tree
function GroupTree({
  group,
  expandedGroups,
  onToggleGroup,
  depth = 0,
}: {
  group: ProductGroup;
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  depth?: number;
}) {
  const isExpanded = expandedGroups.has(String(group.id));
  const hasChildren = group.children.length > 0;
  const hasProducts = group.products.length > 0;

  return (
    <Card withBorder padding="md" style={{ marginLeft: depth > 0 ? `${depth * 20}px` : 0 }}>
      <Group justify="space-between" onClick={() => onToggleGroup(String(group.id))} style={{ cursor: 'pointer' }}>
        <Group>
          <ActionIcon variant="subtle" color="gray">
            {isExpanded ? (
              <IconChevronRight size={18} style={{ transform: 'rotate(90deg)' }} />
            ) : (
              <IconChevronRight size={18} />
            )}
          </ActionIcon>
          <IconFolder size={20} color="#4dabf7" />
          <Stack gap={0}>
            <Text fw={500}>{group.name1c}</Text>
            <Text size="xs" c="dimmed">
              {group.products.length} товаров
              {hasChildren && ` + ${group.children.length} подгрупп`}
            </Text>
          </Stack>
        </Group>
        <Badge variant="outline" size="sm">
          {group.products.length} тов.
        </Badge>
      </Group>

      {isExpanded && (
        <Stack gap="md" mt="md">
          {/* Child groups */}
          {group.children.map((childGroup) => (
            <GroupTree
              key={childGroup.id}
              group={childGroup}
              expandedGroups={expandedGroups}
              onToggleGroup={onToggleGroup}
              depth={depth + 1}
            />
          ))}

          {/* Products in this group */}
          {hasProducts && <ProductTable products={group.products} />}
        </Stack>
      )}
    </Card>
  );
}

function ProductTable({ products }: { products: Product[] }) {
  return (
    <ScrollArea>
      <Table mt="md" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Артикул</Table.Th>
            <Table.Th>Наименование</Table.Th>
            <Table.Th>Цена</Table.Th>
            <Table.Th>Статус</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {products.map((product) => (
            <Table.Tr key={product.id}>
              <Table.Td>
                <Text size="sm" c="dimmed">{product.article || '-'}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>{product.name}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {product.retailPrice ? `${Number(product.retailPrice).toLocaleString('ru-RU')} ₽` : '-'}
                </Text>
              </Table.Td>
              <Table.Td>
                {product.isMarked ? (
                  <Badge color="red" size="sm">Удалён</Badge>
                ) : product.isActive ? (
                  <Badge color="green" size="sm">Активен</Badge>
                ) : (
                  <Badge color="gray" size="sm">Неактивен</Badge>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
