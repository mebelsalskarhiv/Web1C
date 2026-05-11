'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container, Paper, Title, Text, TextInput, PasswordInput, Button, Group, Anchor, Divider, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMail, IconLock, IconUser, IconPhone } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      phone: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Некорректный email'),
      password: (value) => (value.length >= 6 ? null : 'Минимум 6 символов'),
      confirmPassword: (value, values) =>
        value === values.password ? null : 'Пароли не совпадают',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      const { confirmPassword, ...data } = values;
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Ошибка регистрации');
      }

      notifications.show({
        title: 'Успешно',
        message: 'Вы успешно зарегистрированы',
        color: 'green',
      });

      router.push('/login');
    } catch (error) {
      notifications.show({
        title: 'Ошибка',
        message: error instanceof Error ? error.message : 'Не удалось зарегистрироваться',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={500} my={40}>
      <Title ta="center" mb="lg">
        Регистрация
      </Title>

      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Создайте аккаунт для доступа к личному кабинету
      </Text>

      <Paper withBorder shadow="md" p={30} radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Group grow mb="md">
            <TextInput
              label="Имя"
              placeholder="Иван"
              leftSection={<IconUser size={16} />}
              {...form.getInputProps('firstName')}
            />
            <TextInput
              label="Фамилия"
              placeholder="Иванов"
              leftSection={<IconUser size={16} />}
              {...form.getInputProps('lastName')}
            />
          </Group>

          <TextInput
            label="Email"
            placeholder="you@example.com"
            leftSection={<IconMail size={16} />}
            {...form.getInputProps('email')}
            mb="md"
          />

          <TextInput
            label="Телефон"
            placeholder="+7 (999) 000-00-00"
            leftSection={<IconPhone size={16} />}
            {...form.getInputProps('phone')}
            mb="md"
          />

          <PasswordInput
            label="Пароль"
            placeholder="Ваш пароль"
            leftSection={<IconLock size={16} />}
            {...form.getInputProps('password')}
            mb="md"
          />

          <PasswordInput
            label="Подтверждение пароля"
            placeholder="Повторите пароль"
            leftSection={<IconLock size={16} />}
            {...form.getInputProps('confirmPassword')}
            mb="lg"
          />

          <Button type="submit" fullWidth loading={loading} mb="md">
            Зарегистрироваться
          </Button>
        </form>

        <Divider label="или" labelPosition="center" my="lg" />

        <Group justify="center">
          <Anchor component={Link} href="/login" size="sm">
            Уже есть аккаунт? Войти
          </Anchor>
        </Group>
      </Paper>
    </Container>
  );
}
