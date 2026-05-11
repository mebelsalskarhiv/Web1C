'use client';

import { Box, Title, Card, Text, Group, Stack, ThemeIcon } from '@mantine/core';
import { IconChartBar, IconTools } from '@tabler/icons-react';

export default function PartnerReports() {
  return (
    <Box>
      <Title order={2} mb="xl">Аналитические отчеты</Title>

      <Card withBorder shadow="sm" padding="xl" radius="md">
        <Stack align="center" py="xl">
          <ThemeIcon color="orange" size={80} radius={100} variant="light">
            <IconTools size={50} />
          </ThemeIcon>
          <Title order={3}>Раздел находится в разработке</Title>
          <Text c="dimmed" ta="center" style={{ maxWidth: 400 }}>
            Мы работаем над созданием удобных отчетов по вашим покупкам, динамике цен и оборачиваемости товаров.
          </Text>
          <Group mt="md">
            <Card withBorder p="sm" radius="md">
              <Group gap="xs">
                <IconChartBar size={20} color="blue" />
                <Text size="sm">Анализ закупок</Text>
              </Group>
            </Card>
            <Card withBorder p="sm" radius="md">
              <Group gap="xs">
                <IconChartBar size={20} color="green" />
                <Text size="sm">История цен</Text>
              </Group>
            </Card>
            <Card withBorder p="sm" radius="md">
              <Group gap="xs">
                <IconChartBar size={20} color="red" />
                <Text size="sm">Дебиторская задолженность</Text>
              </Group>
            </Card>
          </Group>
        </Stack>
      </Card>
    </Box>
  );
}
