'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container, Paper, Title, Text, TextInput, PasswordInput, Button, Group, Anchor, Divider, Box, Notification } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMail, IconLock, IconExclamationCircle } from '@tabler/icons-react';
import { useAuth } from '@/lib/auth/context';
import { notifications } from '@mantine/notifications';

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      login: '',
      password: '',
    },
    validate: {
      login: (value) => (value.length > 0 ? null : 'Введите email или ИНН'),
      password: (value) => (value ? null : 'Введите пароль'),
    },
  });

  const handleSubmit = async (values: { login: string; password: string }) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка входа');
      }

      notifications.show({
        title: 'Успешно',
        message: 'Вы успешно вошли в систему',
        color: 'green',
      });

      await refreshUser();

      // Redirect based on role
      const role = data.user.role;
      if (role === 'admin') {
        router.push('/admin');
      } else if (role === 'partner') {
        router.push('/partner');
      } else {
        router.push('/customer');
      }
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось войти',
        color: 'red',
        icon: <IconExclamationCircle />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" mb="lg">
        Вход в систему
      </Title>

      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Войдите для доступа к личному кабинету
      </Text>

      <Paper withBorder shadow="md" p={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Email или ИНН"
            placeholder="you@example.com или 1234567890"
            leftSection={<IconMail size={16} />}
            {...form.getInputProps('login')}
            mb="md"
          />

          <PasswordInput
            label="Пароль"
            placeholder="Ваш пароль"
            leftSection={<IconLock size={16} />}
            {...form.getInputProps('password')}
            mb="lg"
          />

          <Button type="submit" fullWidth loading={loading} mb="md">
            Войти
          </Button>
        </form>

        <Divider label="или" labelPosition="center" my="lg" />

        <Group justify="space-between">
          <Anchor component={Link} href="/register" size="sm">
            Нет аккаунта? Зарегистрироваться
          </Anchor>
          <Anchor component={Link} href="/" size="sm">
            На главную
          </Anchor>
        </Group>
      </Paper>
    </Container>
  );
}
