'use client';

import { useState, useEffect } from 'react';
import { 
  Box, Title, Text, Card, Group, Button, Stack, Table, 
  Image, ActionIcon, NumberInput, Checkbox, Divider, 
  Select, Paper, Loader, Alert, ScrollArea
} from '@mantine/core';
import { 
  IconTrash, 
  IconShoppingCart, 
  IconAlertCircle, 
  IconCheck,
  IconArrowLeft
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  isSelected: boolean;
  product: {
    id: number;
    name: string;
    article: string | null;
    retailPrice: number | null;
    images: { fileUrl: string }[];
  };
}

export default function PartnerCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partners, setPartners] = useState<Array<{ id: number; nameFull: string }>>([]);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchCart();
  }, []);

  useEffect(() => {
    fetchPartners();
  }, []);

  async function fetchPartners() {
    try {
      const res = await fetch('/api/partner/dashboard');
      if (res.ok) {
        const data = await res.json();
        const list = (data.partners || []).map((p: any) => ({ id: p.id, nameFull: p.nameFull }));
        setPartners(list);
        if (!selectedPartnerId && list.length > 0) {
          setSelectedPartnerId(String(list[0].id));
        }
      }
    } catch (e) {
      // ignore
    }
  }

  async function fetchCart() {
    setLoading(true);
    try {
      const res = await fetch('/api/partner/cart');
      if (res.ok) {
        const data = await res.json();
        setCartItems(data.cartItems || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const updateQuantity = async (productId: number, quantity: number) => {
    if (quantity < 0.001) return;
    try {
      const res = await fetch('/api/partner/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      if (res.ok) {
        setCartItems(items => items.map(item => 
          item.productId === productId ? { ...item, quantity } : item
        ));
      }
    } catch (e) {}
  };

  const toggleSelection = async (productId: number, isSelected: boolean) => {
    try {
      const res = await fetch('/api/partner/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, isSelected }),
      });
      if (res.ok) {
        setCartItems(items => items.map(item => 
          item.productId === productId ? { ...item, isSelected } : item
        ));
      }
    } catch (e) {}
  };

  const removeItem = async (productId: number) => {
    try {
      const res = await fetch(`/api/partner/cart?productId=${productId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCartItems(items => items.filter(item => item.productId !== productId));
        window.dispatchEvent(new Event('cartUpdated'));
      }
    } catch (e) {}
  };

  const createOrder = async () => {
    if (!selectedPartnerId) {
      notifications.show({
        title: 'Внимание',
        message: 'Выберите торговую точку для оформления заявки',
        color: 'orange',
      });
      return;
    }

    const selectedItems = cartItems.filter(item => item.isSelected);
    if (selectedItems.length === 0) {
      notifications.show({
        title: 'Внимание',
        message: 'Выберите хотя бы один товар',
        color: 'orange',
      });
      return;
    }

    setCreating(true);
    try {
      // In a real app, this would call /api/partner/orders POST
      // and then clear the cart
      const res = await fetch('/api/partner/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: parseInt(selectedPartnerId),
          items: selectedItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.retailPrice,
          })),
        }),
      });

      if (res.ok) {
        notifications.show({
          title: 'Успешно',
          message: 'Заявка успешно создана и отправлена в 1С',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        
        // Clear cart
        await fetch('/api/partner/cart', { method: 'DELETE' });
        window.dispatchEvent(new Event('cartUpdated'));
        router.push('/partner/orders');
      } else {
        throw new Error();
      }
    } catch (e) {
      notifications.show({
        title: 'Ошибка',
        message: 'Не удалось создать заявку. Попробуйте позже.',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const totalAmount = cartItems
    .filter(item => item.isSelected)
    .reduce((sum, item) => sum + (Number(item.product.retailPrice || 0) * Number(item.quantity)), 0);

  if (loading) return <Group justify="center" py="xl"><Loader /></Group>;

  if (cartItems.length === 0) {
    return (
      <Stack align="center" py={100}>
        <IconShoppingCart size={80} color="gray" opacity={0.5} />
        <Title order={2} c="dimmed">Ваша корзина пуста</Title>
        <Button component={Link} href="/partner/catalog" variant="light">
          Перейти в каталог
        </Button>
      </Stack>
    );
  }

  return (
    <Box>
      <Group mb="xl">
        <Button 
          component={Link} 
          href="/partner/catalog" 
          variant="subtle" 
          leftSection={<IconArrowLeft size={16} />}
        >
          Вернуться в каталог
        </Button>
        <Title order={2}>Корзина товаров</Title>
      </Group>

   <Group align="flex-start" wrap="nowrap" gap="xl">
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Card withBorder padding="md" radius="md">
            <ScrollArea>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40}></Table.Th>
                    <Table.Th>Товар</Table.Th>
                    <Table.Th ta="right">Цена</Table.Th>
                    <Table.Th ta="center" w={150}>Количество</Table.Th>
                    <Table.Th ta="right">Сумма</Table.Th>
                    <Table.Th w={50}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {cartItems.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Checkbox 
                          checked={item.isSelected} 
                          onChange={(e) => toggleSelection(item.productId, e.currentTarget.checked)} 
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group wrap="nowrap">
                          <Image 
                            src={item.product.images[0]?.fileUrl || '/images/no-image.svg'} 
                            width={50} 
                            height={50} 
                            radius="sm" 
                          />
                          <Box>
                            <Text size="sm" fw={500}>{item.product.name}</Text>
                            <Text size="xs" c="dimmed">{item.product.article}</Text>
                          </Box>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{Number(item.product.retailPrice || 0).toLocaleString('ru-RU')} ₽</Text>
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={Number(item.quantity)}
                          onChange={(val) => updateQuantity(item.productId, Number(val))}
                          min={0.001}
                          step={1}
                          size="sm"
                          decimalScale={3}
                        />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fw={700}>
                          {(Number(item.product.retailPrice || 0) * Number(item.quantity)).toLocaleString('ru-RU')} ₽
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon color="red" variant="subtle" onClick={() => removeItem(item.productId)}>
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        </Box>

        <Box style={{ width: 400, flexShrink: 0 }}>
          <Paper withBorder p="xl" radius="md" shadow="sm">
            <Title order={3} mb="md">Оформление заявки</Title>
            
            <Stack>
              <Select
                label="Торговая точка (из 1С)"
                placeholder="Выберите объект"
                data={partners.map(p => ({ value: String(p.id), label: p.nameFull })) || []}
                value={selectedPartnerId}
                onChange={setSelectedPartnerId}
                required
              />

              <Divider my="sm" />

              <Group justify="space-between">
                <Text size="sm" c="dimmed">Выбрано товаров:</Text>
                <Text fw={500}>{cartItems.filter(i => i.isSelected).length}</Text>
              </Group>

              <Group justify="space-between">
                <Text size="lg" fw={700}>Итого к оплате:</Text>
                <Text size="xl" fw={700} c="blue">
                  {totalAmount.toLocaleString('ru-RU')} ₽
                </Text>
              </Group>
              <Alert color="blue" icon={<IconAlertCircle size={16} />} mt="sm">
                <Text size="xs">
                  После нажатия кнопки «Оформить», заявка будет автоматически создана в 1С:Управление торговлей.
                </Text>
              </Alert>

              <Button 
                size="lg" 
                fullWidth 
                mt="md" 
                onClick={createOrder} 
                loading={creating}
                disabled={cartItems.filter(i => i.isSelected).length === 0}
              >
                Оформить заявку
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Group>
    </Box>
  );
}
