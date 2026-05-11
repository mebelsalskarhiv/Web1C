'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Title, Text, SimpleGrid, Card, Group, ActionIcon, Badge, Stack, 
  Button, Pagination, ScrollArea, Divider, Select, Slider, Rating, Chip
} from '@mantine/core';
import { 
  IconFilter, IconX, IconArrowUpDown, IconArrowDown, IconArrowUp,
  IconHeart, IconCompare, IconTrash
} from '@tabler/icons-react';
import { ProductCard } from './ProductCard';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

interface Product {
  id: number;
  name: string;
  article: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
  images: { fileUrl: string }[];
  groupId: number | null;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  stockQuantity?: number;
}

interface ProductFilters {
  search?: string;
  groupId?: number | null;
  priceRange?: [number, number];
  rating?: number;
  inStockOnly?: boolean;
  sortBy?: 'name' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

interface EnhancedCatalogProps {
  products: Product[];
  groups?: { id: number; name1c: string; parentId?: number | null }[];
  loading?: boolean;
  onPageChange?: (page: number) => void;
  onFilterChange?: (filters: ProductFilters) => void;
  currentPage?: number;
  totalPages?: number;
  onAddToCart?: (product: Product) => void;
}

export function EnhancedCatalog({ 
  products, 
  groups = [], 
  loading = false, 
  onPageChange,
  onFilterChange,
  currentPage = 1,
  totalPages = 1,
  onAddToCart 
}: EnhancedCatalogProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc' | 'rating' | 'newest'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [compareList, setCompareList] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const applyFilters = () => {
    onFilterChange?.({
      search: search || undefined,
      groupId: selectedGroupId,
      priceRange: priceRange[1] < 100000 ? priceRange : undefined,
      rating: minRating || undefined,
      inStockOnly,
      sortBy,
    });
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedGroupId(null);
    setPriceRange([0, 100000]);
    setMinRating(null);
    setInStockOnly(false);
    setSortBy('name');
    applyFilters();
  };

  const toggleCompare = (productId: number) => {
    if (compareList.includes(productId)) {
      setCompareList(compareList.filter(id => id !== productId));
    } else {
      if (compareList.length >= 4) {
        notifications.show({
          title: 'Лимит сравнения',
          message: 'Можно сравнивать не более 4 товаров',
          color: 'red',
        });
        return;
      }
      setCompareList([...compareList, productId]);
    }
  };

  const openCompareModal = () => {
    const productsToCompare = products.filter(p => compareList.includes(p.id));
    
    modals.openModal({
      title: `Сравнение товаров (${productsToCompare.length})`,
      size: 'xl',
      children: (
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: productsToCompare.length }}>
            {productsToCompare.map(product => (
              <Card key={product.id} withBorder padding="sm">
                <Group justify="space-between" mb="sm">
                  <Text fw={600} size="sm" lineClamp={2}>{product.name}</Text>
                  <ActionIcon 
                    variant="subtle" 
                    color="red" 
                    onClick={() => toggleCompare(product.id)}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
                <Image 
                  src={product.images[0]?.fileUrl || '/images/no-image.svg'} 
                  height={120} 
                  fallbackSrc="/images/no-image.svg"
                />
                <Divider my="xs" />
                <Box>
                  <Text size="xs" c="dimmed">Артикул</Text>
                  <Text size="sm">{product.article || 'Не указан'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Цена</Text>
                  <Text fw={700}>{Number(product.retailPrice || 0).toLocaleString('ru-RU')} ₽</Text>
                </Box>
                {product.rating && (
                  <Box>
                    <Text size="xs" c="dimmed">Рейтинг</Text>
                    <Rating value={product.rating} readOnly size="xs" />
                  </Box>
                )}
                <Button 
                  fullWidth 
                  mt="sm" 
                  variant="light"
                  onClick={() => onAddToCart?.(product)}
                >
                  В корзину
                </Button>
              </Card>
            ))}
          </SimpleGrid>
          
          {productsToCompare.length > 0 && (
            <Group justify="center" mt="lg">
              <Button 
                variant="filled"
                onClick={() => {
                  notifications.show({
                    title: 'Товары добавлены',
                    message: `${productsToCompare.length} товаров добавлено в корзину`,
                    color: 'green',
                  });
                  productsToCompare.forEach(p => onAddToCart?.(p));
                  modals.closeAll();
                }}
              >
                Добавить все в корзину
              </Button>
            </Group>
          )}
        </Stack>
      ),
    });
  };

  const hasActiveFilters = search || selectedGroupId !== null || minRating !== null || inStockOnly || sortBy !== 'name';

  return (
    <Box>
      {/* Filters Bar */}
      <Card withBorder mb="lg" radius="md">
        <Group justify="space-between" mb="sm">
          <Group>
            <ActionIcon 
              variant={showFilters ? 'filled' : 'outline'} 
              onClick={() => setShowFilters(!showFilters)}
            >
              <IconFilter size={18} />
            </ActionIcon>
            <Title order={3} size="h4">Фильтры</Title>
            {hasActiveFilters && (
              <Badge color="blue" variant="light">Активны</Badge>
            )}
          </Group>
          
          <Group>
            {compareList.length > 0 && (
              <Button 
                leftSection={<IconCompare size={18} />}
                variant="light"
                onClick={openCompareModal}
              >
                Сравнить ({compareList.length})
              </Button>
            )}
            
            <Select
              value={sortBy}
              onChange={(value) => {
                setSortBy(value as typeof sortBy);
                setTimeout(applyFilters, 0);
              }}
              data={[
                { value: 'name', label: 'По названию' },
                { value: 'price_asc', label: 'Сначала дешёвые' },
                { value: 'price_desc', label: 'Сначала дорогие' },
                { value: 'rating', label: 'По рейтингу' },
                { value: 'newest', label: 'Сначала новые' },
              ]}
              allowDeselect={false}
              size="sm"
            />
          </Group>
        </Group>

        {showFilters && (
          <>
            <Divider my="sm" />
            
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {/* Price Range */}
              <Box>
                <Text size="sm" fw={600} mb="xs">Цена, ₽</Text>
                <Slider
                  range
                  min={0}
                  max={100000}
                  step={1000}
                  value={priceRange}
                  onChange={setPriceRange}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 50000, label: '50k' },
                    { value: 100000, label: '100k' },
                  ]}
                />
                <Group justify="space-between" mt="xs">
                  <Text size="xs">{priceRange[0].toLocaleString()} ₽</Text>
                  <Text size="xs">{priceRange[1].toLocaleString()} ₽</Text>
                </Group>
              </Box>

              {/* Rating */}
              <Box>
                <Text size="sm" fw={600} mb="xs">Рейтинг</Text>
                <Rating 
                  value={minRating || 0} 
                  onChange={setMinRating}
                  fractions={1}
                />
                {minRating !== null && (
                  <Text size="xs" c="dimmed" mt="xs">От {minRating} звёзд</Text>
                )}
              </Box>

              {/* Stock */}
              <Box>
                <Text size="sm" fw={600} mb="xs">Наличие</Text>
                <Chip
                  checked={inStockOnly}
                  onChange={() => {
                    setInStockOnly(!inStockOnly);
                    setTimeout(applyFilters, 0);
                  }}
                >
                  Только в наличии
                </Chip>
              </Box>

              {/* Categories Quick Select */}
              <Box>
                <Text size="sm" fw={600} mb="xs">Категория</Text>
                <Select
                  value={selectedGroupId?.toString() || ''}
                  onChange={(value) => {
                    setSelectedGroupId(value ? parseInt(value) : null);
                    setTimeout(applyFilters, 0);
                  }}
                  data={groups.map(g => ({ value: g.id.toString(), label: g.name1c }))}
                  placeholder="Все категории"
                  clearable
                  searchable
                />
              </Box>
            </SimpleGrid>

            {hasActiveFilters && (
              <Group justify="flex-end" mt="lg">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <IconX size={16} style={{ marginRight: 8 }} />
                  Сбросить фильтры
                </Button>
                <Button size="sm" onClick={applyFilters}>
                  Применить
                </Button>
              </Group>
            )}
          </>
        )}
      </Card>

      {/* Products Grid/List */}
      {loading ? (
        <Group justify="center" py="xl">
          <Text c="dimmed">Загрузка товаров...</Text>
        </Group>
      ) : products.length === 0 ? (
        <Card withBorder py="xl" ta="center">
          <Text c="dimmed" size="lg">Товары не найдены</Text>
          {hasActiveFilters && (
            <Button variant="outline" mt="md" onClick={clearFilters}>
              Сбросить фильтры
            </Button>
          )}
        </Card>
      ) : (
        <>
          <Text size="sm" c="dimmed" mb="md">
            Найдено товаров: {products.length}
          </Text>
          
          <SimpleGrid cols={{ base: 1, sm: viewMode === 'grid' ? 2 : 1, lg: viewMode === 'grid' ? 3 : 1, xl: viewMode === 'grid' ? 4 : 1 }} spacing="lg">
            {products.map((product) => (
              <Box key={product.id} pos="relative">
                <ProductCard 
                  product={product} 
                  viewMode={viewMode}
                  onAddToCart={onAddToCart}
                />
                <ActionIcon
                  pos="absolute"
                  bottom="md"
                  right="md"
                  variant={compareList.includes(product.id) ? 'filled' : 'outline'}
                  color={compareList.includes(product.id) ? 'blue' : 'gray'}
                  size="lg"
                  onClick={() => toggleCompare(product.id)}
                >
                  <IconCompare size={18} />
                </ActionIcon>
              </Box>
            ))}
          </SimpleGrid>

          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination 
                total={totalPages} 
                value={currentPage} 
                onChange={onPageChange} 
                withEdges 
                size="lg"
              />
            </Group>
          )}
        </>
      )}
    </Box>
  );
}
