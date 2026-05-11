import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [productsCount, partnersCount, ordersCount, lastSync] = await Promise.all([
      prisma.product.count({
        where: { isActive: true, isMarked: false },
      }),
      prisma.partner.count({
        where: { isMerged: false },
      }),
      prisma.order.count(),
      prisma.syncSession.findFirst({
        where: { status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }),
    ]);

    return NextResponse.json({
      productsCount,
      partnersCount,
      ordersCount,
      lastSyncAt: lastSync?.completedAt ?? null,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
