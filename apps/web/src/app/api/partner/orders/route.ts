import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with managed partners to filter orders
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        managedPartners: { select: { partnerId: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const partnerIds = user.managedPartners.map(p => p.partnerId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const whereClause: any = {
      partnerId: { in: partnerIds },
    };

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          partner: { select: { nameFull: true } },
          items: {
            include: {
              product: { select: { name: true, article: true } },
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Partner orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { partnerId, items, comment } = await request.json();

    if (!partnerId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify partner belongs to user
    const userPartner = await prisma.userManagedPartner.findUnique({
      where: {
        userId_partnerId: {
          userId: session.userId,
          partnerId,
        },
      },
    });

    if (!userPartner) {
      return NextResponse.json({ error: 'Invalid partner' }, { status: 403 });
    }

    const productIds = items.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, retailPrice: true, name: true },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    const orderItems = items.map((item: any) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      
      const price = product.retailPrice ?? 0;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price,
        total: Number(price) * Number(item.quantity),
        productName: product.name,
      };
    });

    const totalAmount = orderItems.reduce((sum: number, item: any) => sum + item.total, 0);

    const order = await prisma.order.create({
      data: {
        userId: session.userId,
        partnerId,
        totalAmount,
        status: 'new',
        commentUser: comment,
        orderNumberWeb: `WEB-${Date.now()}`,
        items: {
          create: orderItems,
        },
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
