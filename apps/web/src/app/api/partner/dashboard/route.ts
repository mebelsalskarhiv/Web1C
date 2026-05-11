import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || (session.role !== 'partner' && session.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with managed partners
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        managedPartners: {
          include: {
            partner: {
              include: {
                orders: {
                  take: 5,
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const managedPartners = user.managedPartners.map(mp => mp.partner);
    const partnerIds = managedPartners.map(p => p.id);

    // Summary data
    const totalOrders = await prisma.order.count({
      where: { partnerId: { in: partnerIds } },
    });

    const activeOrders = await prisma.order.count({
      where: { 
        partnerId: { in: partnerIds },
        status: { in: ['new', 'confirmed', 'processing', 'shipped'] }
      },
    });

    const totalDebt = managedPartners.reduce((sum, p) => sum + Number(p.balanceDebit), 0);
    const totalCredit = managedPartners.reduce((sum, p) => sum + Number(p.balanceCredit), 0);

    return NextResponse.json({
      partners: managedPartners,
      stats: {
        totalOrders,
        activeOrders,
        totalDebt,
        totalCredit,
      },
    });
  } catch (error) {
    console.error('Partner dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
