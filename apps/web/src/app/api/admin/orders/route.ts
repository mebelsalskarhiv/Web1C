import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    // Get total count
    const total = await prisma.order.count();

    const orders = await prisma.order.findMany({
      orderBy: { orderDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        partner: {
          select: {
            nameFull: true,
          },
        },
        items: {
          select: {
            id: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      orders,
      total,
      totalPages: Math.ceil(total / pageSize),
      page,
      pageSize
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
