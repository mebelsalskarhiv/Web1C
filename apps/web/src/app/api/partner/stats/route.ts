import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || !session.partnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [totalOrders, activeOrders, completedOrders, partner] = await Promise.all([
      prisma.order.count({
        where: { partnerId: session.partnerId },
      }),
      prisma.order.count({
        where: {
          partnerId: session.partnerId,
          status: { in: ['new', 'confirmed', 'processing', 'shipped'] },
        },
      }),
      prisma.order.count({
        where: {
          partnerId: session.partnerId,
          status: { in: ['completed', 'cancelled'] },
        },
      }),
      prisma.partner.findUnique({
        where: { id: session.partnerId },
        select: {
          balanceDebit: true,
          balanceCredit: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalOrders,
      activeOrders,
      completedOrders,
      balanceDebit: Number(partner?.balanceDebit || 0),
      balanceCredit: Number(partner?.balanceCredit || 0),
    });
  } catch (error) {
    console.error('Partner stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
