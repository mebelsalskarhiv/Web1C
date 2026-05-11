import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import * as XLSX from 'xlsx';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = parseInt(params.id);
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        partner: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check permissions
    if (session.role !== 'admin' && order.partnerId !== session.partnerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Order info
    const orderData = [
      ['ТОВАРНАЯ НАКЛАДНАЯ'],
      [`№ ${order.orderNumber1c || order.id} от ${order.orderDate ? new Date(order.orderDate).toLocaleDateString('ru-RU') : ''}`],
      [],
      ['Заказчик:', order.partner?.nameFull || ''],
      ['ИНН:', order.partner?.inn || ''],
      ['КПП:', order.partner?.kpp || ''],
      ['Адрес:', order.partner?.addressLegal || ''],
      [],
      ['УИД:', order.invoiceUid || `ORD-${order.id}`],
      [],
    ];

    const wsInfo = XLSX.utils.aoa_to_sheet(orderData);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Информация');

    // Items table
    const itemsData = [
      ['№', 'Артикул', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма'],
      ...order.items.map((item: (typeof order.items)[number], index: number) => [
        index + 1,
        item.productArticle || '-',
        item.productName,
        Number(item.quantity),
        item.unit || 'шт',
        Number(item.price),
        Number(item.total),
      ]),
      [],
      ['Итого:', '', '', '', '', '', Number(order.totalAmount)],
    ];

    const wsItems = XLSX.utils.aoa_to_sheet(itemsData);
    
    // Set column widths
    wsItems['!cols'] = [
      { wch: 5 },  // №
      { wch: 15 }, // Артикул
      { wch: 40 }, // Наименование
      { wch: 10 }, // Кол-во
      { wch: 8 },  // Ед.
      { wch: 12 }, // Цена
      { wch: 14 }, // Сумма
    ];

    XLSX.utils.book_append_sheet(wb, wsItems, 'Товары');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="invoice_${order.orderNumber1c || order.id}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Invoice XLSX error:', error);
    return NextResponse.json(
      { error: 'Failed to generate XLSX' },
      { status: 500 }
    );
  }
}
