import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import React from 'react';
import type { Metadata } from 'next';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';

import { theme } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth/context';

export const metadata: Metadata = {
  title: 'Web1C Shop - Интернет-магазин с интеграцией 1С',
  description: 'Многопользовательский веб-магазин с синхронизацией товаров, заказов и партнеров с 1С:УТ 11.5',
  keywords: ['1С', 'интернет-магазин', 'УТ 11.5', 'OData', 'B2B', 'опт'],
  authors: [{ name: 'Web1C Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="top-right" />
          <ModalsProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
