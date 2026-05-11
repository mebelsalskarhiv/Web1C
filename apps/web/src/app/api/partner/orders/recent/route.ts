import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || !session.partnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: { partnerId: session.partnerId },
      orderBy: { orderDate: 'desc' },
      take: 10,
      select: {
        id: true,
        orderNumber1c: true,
        orderNumberWeb: true,
        status: true,
        totalAmount: true,
        orderDate: true,
        items: {
          select: {
            id: true,
          },
        },
      },
    });

    const ordersWithItems = orders.map((order: (typeof orders)[number]) => ({
      ...order,
      itemsCount: order.items.length,
    }));

    return NextResponse.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('Partner recent orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
