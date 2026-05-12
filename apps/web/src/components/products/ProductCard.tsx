import { useState, useEffect } from 'react';
import { Box, Text, Group, ActionIcon, Badge, Stack, Card, Image, Button, Modal, Rating, Divider, ScrollArea, Chip } from '@mantine/core';
import { IconHeart, IconHeartFilled, IconBalance, IconBell, IconBellRinging, IconStar, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

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

interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
  onAddToCart?: (product: Product) => void;
  showQuickView?: boolean;
}

export function ProductCard({ product, viewMode = 'grid', onAddToCart, showQuickView = true }: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if product is in favorites from localStorage
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    setIsFavorite(favorites.includes(product.id));
    
    // Check subscription status
    const subscriptions = JSON.parse(localStorage.getItem('stockSubscriptions') || '[]');
    setIsSubscribed(subscriptions.includes(product.id));
  }, [product.id]);

  const toggleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    if (isFavorite) {
      const updated = favorites.filter((id: number) => id !== product.id);
      localStorage.setItem('favorites', JSON.stringify(updated));
      notifications.show({
        title: 'Удалено из избранного',
        message: product.name,
        color: 'blue',
      });
    } else {
      localStorage.setItem('favorites', JSON.stringify([...favorites, product.id]));
      notifications.show({
        title: 'Добавлено в избранное',
        message: product.name,
        color: 'green',
      });
    }
    setIsFavorite(!isFavorite);
  };

  const toggleStockSubscription = () => {
    const subscriptions = JSON.parse(localStorage.getItem('stockSubscriptions') || '[]');
    if (isSubscribed) {
      const updated = subscriptions.filter((id: number) => id !== product.id);
      localStorage.setItem('stockSubscriptions', JSON.stringify(updated));
      notifications.show({
        title: 'Подписка отменена',
        message: `Вы больше не получите уведомление о "${product.name}"`,
        color: 'blue',
      });
    } else {
      localStorage.setItem('stockSubscriptions', JSON.stringify([...subscriptions, product.id]));
      notifications.show({
        title: 'Подписка оформлена',
        message: `Мы уведомим вас, когда "${product.name}" появится в наличии`,
        color: 'green',
      });
    }
    setIsSubscribed(!isSubscribed);
  };

  const openQuickView = () => {
    modals.openModal({
      title: product.name,
      size: 'xl',
      children: <ProductQuickView product={product} />,
    });
  };

  const price = Number(product.retailPrice || 0);
  const wholesalePrice = Number(product.wholesalePrice || 0);
  const hasDiscount = wholesalePrice > 0 && price > wholesalePrice;
  const discount = hasDiscount ? Math.round(((price - wholesalePrice) / price) * 100) : 0;

  if (viewMode === 'list') {
    return (
      <Card withBorder padding="sm" radius="md">
        <Group wrap="nowrap">
          <Image
            src={product.images[0]?.fileUrl || '/images/no-image.svg'}
            width={100}
            height={100}
            radius="md"
            fallbackSrc="/images/no-image.svg"
            style={{ objectFit: 'cover' }}
          />
          
          <Stack gap={4} style={{ flex: 1 }}>
            <Group justify="space-between">
              <Box>
                <Text size="xs" c="dimmed">{product.article || 'Нет артикула'}</Text>
                <Text fw={600} size="sm" lineClamp={1}>{product.name}</Text>
              </Box>
              <ActionIcon 
                variant={isFavorite ? 'filled' : 'outline'} 
                color={isFavorite ? 'red' : 'gray'}
                onClick={toggleFavorite}
                size="lg"
              >
                {isFavorite ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
              </ActionIcon>
            </Group>

            {product.rating !== undefined && (
              <Group gap="xs">
                <Rating value={product.rating} readOnly size="xs" />
                <Text size="xs" c="dimmed">({product.reviewCount || 0})</Text>
              </Group>
            )}

            <Group justify="space-between" align="flex-end">
              <Box>
                {hasDiscount && (
                  <Badge color="red" size="sm" mb={4}>-{discount}%</Badge>
                )}
                <Group gap="sm" align="flex-end">
                  <Text fw={700} size="lg">{price.toLocaleString('ru-RU')} ₽</Text>
                  {wholesalePrice > 0 && wholesalePrice < price && (
                    <Text size="xs" c="dimmed" style={{ textDecoration: 'line-through' }}>
                      {wholesalePrice.toLocaleString('ru-RU')} ₽ (опт)
                    </Text>
                  )}
                </Group>
              </Box>

              <Group gap="xs">
                {showQuickView && (
                  <Button variant="outline" size="sm" onClick={openQuickView}>
                    Быстрый просмотр
                  </Button>
                )}
                {!product.inStock ? (
                  <ActionIcon 
                    variant={isSubscribed ? 'filled' : 'outline'} 
                    color={isSubscribed ? 'orange' : 'gray'}
                    onClick={toggleStockSubscription}
                    size="lg"
                    title="Сообщить о наличии"
                  >
                    {isSubscribed ? <IconBellRinging size={18} /> : <IconBell size={18} />}
                  </ActionIcon>
                ) : (
                  <Button 
                    leftSection={<IconHeart size={16} />}
                    variant="light"
                    size="sm"
                    onClick={() => onAddToCart?.(product)}
                  >
                    В корзину
                  </Button>
                )}
              </Group>
            </Group>
          </Stack>
        </Group>
      </Card>
    );
  }

  // Grid view
  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Card.Section pos="relative">
        <Image
          src={product.images[0]?.fileUrl || '/images/no-image.svg'}
          height={180}
          alt={product.name}
          fallbackSrc="/images/no-image.svg"
          style={{ objectFit: 'cover' }}
        />
        
        {/* Badges */}
        <Box pos="absolute" top="sm" left="sm">
          {hasDiscount && (
            <Badge color="red" size="sm" mb={4}>-{discount}%</Badge>
          )}
          {!product.inStock && (
            <Badge color="gray" size="sm">Нет в наличии</Badge>
          )}
        </Box>

        {/* Favorite button */}
        <ActionIcon 
          pos="absolute" 
          top="sm" 
          right="sm" 
          variant={isFavorite ? 'filled' : 'outline'} 
          color={isFavorite ? 'red' : 'white'}
          size="lg"
          onClick={toggleFavorite}
        >
          {isFavorite ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
        </ActionIcon>
      </Card.Section>

      <Stack justify="space-between" mt="md" style={{ height: 'calc(100% - 180px)' }}>
        <Box>
          <Text size="xs" c="dimmed" mb={4}>{product.article || 'Нет артикула'}</Text>
          <Text fw={600} lineClamp={2} size="sm" h={40}>
            {product.name}
          </Text>
          
          {product.rating !== undefined && (
            <Group gap="xs" mt="xs">
              <Rating value={product.rating} readOnly size="xs" />
              <Text size="xs" c="dimmed">({product.reviewCount || 0})</Text>
            </Group>
          )}
        </Box>

        <Box mt="md">
          <Group justify="space-between" align="flex-end">
            <Box>
              <Text size="xs" c="dimmed">Цена за ед.</Text>
              <Group gap="xs" align="flex-end">
                <Text fw={700} size="lg">{price.toLocaleString('ru-RU')} ₽</Text>
                {wholesalePrice > 0 && wholesalePrice < price && (
                  <Text size="xs" c="dimmed" style={{ textDecoration: 'line-through' }}>
                    {wholesalePrice.toLocaleString('ru-RU')} ₽
                  </Text>
                )}
              </Group>
            </Box>
            
            <Group gap="xs">
              {!product.inStock ? (
                <ActionIcon 
                  variant={isSubscribed ? 'filled' : 'outline'} 
                  color={isSubscribed ? 'orange' : 'gray'}
                  onClick={toggleStockSubscription}
                  size="lg"
                  title="Сообщить о наличии"
                >
                  {isSubscribed ? <IconBellRinging size={18} /> : <IconBell size={18} />}
                </ActionIcon>
              ) : (
                <ActionIcon 
                  color="blue" 
                  size="lg" 
                  radius="xl" 
                  variant="filled"
                  onClick={() => onAddToCart?.(product)}
                >
                  <IconHeart size={20} />
                </ActionIcon>
              )}
            </Group>
          </Group>

          {showQuickView && (
            <Button fullWidth mt="md" variant="outline" size="xs" onClick={openQuickView}>
              Быстрый просмотр
            </Button>
          )}
        </Box>
      </Stack>
    </Card>
  );
}

function ProductQuickView({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);

  return (
    <ScrollArea.Autosize mah={400}>
      <Group align="flex-start" gap="xl">
        <Image
          src={product.images[0]?.fileUrl || '/images/no-image.svg'}
          width={300}
          height={300}
          radius="md"
          fallbackSrc="/images/no-image.svg"
          style={{ objectFit: 'cover' }}
        />
        
        <Stack style={{ flex: 1 }}>
          <Box>
            <Text size="sm" c="dimmed">Артикул: {product.article || 'Не указан'}</Text>
            <Text fw={700} size="xl" mt="xs">{product.name}</Text>
          </Box>

          {product.rating !== undefined && (
            <Group gap="xs">
              <Rating value={product.rating} readOnly />
              <Text size="sm" c="dimmed">({product.reviewCount || 0} отзывов)</Text>
            </Group>
          )}

          <Divider my="sm" />

          <Box>
            <Text fw={700} size="xl">{Number(product.retailPrice || 0).toLocaleString('ru-RU')} ₽</Text>
            {product.wholesalePrice && (
              <Text size="sm" c="dimmed">Оптовая цена: {Number(product.wholesalePrice).toLocaleString('ru-RU')} ₽</Text>
            )}
          </Box>

          {product.inStock ? (
            <Badge color="green" variant="light">В наличии: {product.stockQuantity || 0} шт.</Badge>
          ) : (
            <Badge color="red" variant="light">Нет в наличии</Badge>
          )}

          <Stack gap="sm">
            <Text size="sm" fw={600}>Характеристики:</Text>
            {product.inStock && (
              <Group>
                <Text size="sm">Количество:</Text>
                <Chip.Group multiple={false}>
                  {[1, 5, 10, 50].map(qty => (
                    <Chip 
                      key={qty} 
                      value={qty} 
                      checked={quantity === qty}
                      onChange={() => setQuantity(qty)}
                      size="sm"
                    >
                      {qty}
                    </Chip>
                  ))}
                </Chip.Group>
              </Group>
            )}
          </Stack>

          <Group mt="auto">
            <Button flex={1} size="lg">
              Добавить в корзину
            </Button>
            <ActionIcon variant="outline" size="lg">
              <IconBalance size={20} />
            </ActionIcon>
          </Group>
        </Stack>
      </Group>
    </ScrollArea.Autosize>
  );
}
