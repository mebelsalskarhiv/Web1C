'use client';

import { useState } from 'react';
import { 
  Box, Title, Card, Text, Group, Stack, TextInput, Button, 
  Divider, Badge, Avatar, SimpleGrid, Paper, ActionIcon
} from '@mantine/core';
import { useAuth } from '@/lib/auth/context';
import { IconUser, IconMail, IconLock, IconBuildingSkyscraper, IconPhone } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function PartnerProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = () => {
    notifications.show({
      title: 'Профиль обновлен',
      message: 'Ваши настройки успешно сохранены',
      color: 'green',
    });
  };

  return (
    <Box>
      <Title order={2} mb="xl">Личный профиль</Title>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Stack>
          <Card withBorder shadow="sm" padding="xl" radius="md">
            <Group mb="lg">
              <Avatar size="xl" radius="xl" color="blue">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Avatar>
              <Stack gap={0}>
                <Text size="lg" fw={700}>{user?.firstName} {user?.lastName}</Text>
                <Badge variant="light">{user?.role === 'partner' ? 'Партнёр' : user?.role}</Badge>
              </Stack>
            </Group>

            <Divider my="md" />

            <Stack>
              <TextInput 
                label="Электронная почта" 
                value={user?.email || ''} 
                leftSection={<IconMail size={16} />}
                disabled 
              />
              <TextInput 
                label="ИНН (Логин)" 
                value={user?.inn || ''} 
                leftSection={<IconUser size={16} />}
                disabled 
              />
              <TextInput 
                label="Телефон" 
                placeholder="+7 (___) ___-__-__"
                leftSection={<IconPhone size={16} />}
              />
              
              <Group justify="flex-end" mt="md">
                <Button onClick={handleSaveProfile} loading={loading}>Сохранить изменения</Button>
              </Group>
            </Stack>
          </Card>

          <Card withBorder shadow="sm" padding="xl" radius="md">
            <Group mb="md">
              <IconLock size={20} color="gray" />
              <Text fw={700}>Безопасность</Text>
            </Group>
            <Stack>
              <Button variant="outline" fullWidth>Сменить пароль</Button>
              <Text size="xs" c="dimmed">
                Для смены пароля необходимо будет подтвердить текущий пароль.
              </Text>
            </Stack>
          </Card>
        </Stack>

        <Stack>
          <Title order={3}>Доступные точки продаж</Title>
          <Text size="sm" c="dimmed" mb="md">
            Вы авторизованы как менеджер для следующих объектов из 1С:
          </Text>
          
          {user?.managedPartners?.map((partner: any) => (
            <Paper key={partner.id} withBorder p="md" radius="md" shadow="xs">
              <Group justify="space-between">
                <Group>
                  <ThemeIcon color="blue" variant="light">
                    <IconBuildingSkyscraper size={18} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Text fw={500}>{partner.nameFull}</Text>
                    <Text size="xs" c="dimmed">ИНН: {partner.inn}</Text>
                  </Stack>
                </Group>
                <Badge variant="outline">Активна</Badge>
              </Group>
            </Paper>
          ))}

          {(!user?.managedPartners || user.managedPartners.length === 0) && (
            <Text c="dimmed" ta="center" py="xl">У вас нет привязанных точек продаж. Обратитесь к администратору.</Text>
          )}
        </Stack>
      </SimpleGrid>
    </Box>
  );
}

// Simple ThemeIcon wrapper for use in profile
function ThemeIcon({ children, color, variant }: { children: React.ReactNode, color: string, variant: string }) {
  return (
    <Box 
      style={{
        backgroundColor: variant === 'light' ? 'rgba(0, 123, 255, 0.1)' : '#007bff',
        padding: '8px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: variant === 'light' ? '#007bff' : 'white'
      }}
    >
      {children}
    </Box>
  );
}
