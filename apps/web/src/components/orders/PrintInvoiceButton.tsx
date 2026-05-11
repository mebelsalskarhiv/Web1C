'use client';

import { Button, Menu, Group } from '@mantine/core';
import { IconFileText, IconDownload, IconPrinter } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface PrintInvoiceButtonProps {
  orderId: number;
  orderNumber?: string | null;
  variant?: 'filled' | 'outline' | 'light' | 'default';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function PrintInvoiceButton({
  orderId,
  orderNumber,
  variant = 'outline',
  size = 'sm',
}: PrintInvoiceButtonProps) {
  const handlePrint = (format: 'pdf' | 'xlsx') => {
    const url = format === 'pdf' 
      ? `/api/orders/${orderId}/invoice`
      : `/api/orders/${orderId}/invoice-xlsx`;
    
    // Open in new tab for download
    window.open(url, '_blank');
    
    notifications.show({
      title: 'Документ генерируется',
      message: `Накладная будет загружена в формате ${format.toUpperCase()}`,
      color: 'blue',
    });
  };

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Button
          variant={variant}
          size={size}
          leftSection={<IconFileText size={18} />}
        >
          Накладная
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconDownload size={18} />}
          onClick={() => handlePrint('pdf')}
        >
          Скачать PDF
        </Menu.Item>
        <Menu.Item
          leftSection={<IconDownload size={18} />}
          onClick={() => handlePrint('xlsx')}
        >
          Скачать Excel
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconPrinter size={18} />}
          onClick={() => handlePrint('pdf')}
        >
          Печать
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
