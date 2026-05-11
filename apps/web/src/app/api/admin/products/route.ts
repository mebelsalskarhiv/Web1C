import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active') === 'true';
    const search = searchParams.get('search') || '';
    const withGroups = searchParams.get('withGroups') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    // Build where clause for products
    const whereClause: any = {};
    
    if (active) {
      whereClause.isActive = true;
      whereClause.isMarked = false;
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { article: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.product.count({ where: whereClause });

    // Fetch products with filtering and pagination
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        group: {
          select: {
            id: true,
            name1c: true,
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: 'asc' },
    });

    // If withGroups is requested, also fetch groups hierarchy
    if (withGroups) {
      const groups = await prisma.productGroup.findMany({
        orderBy: { name1c: 'asc' },
      });

      return NextResponse.json({
        products,
        groups,
        total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize
      });
    }

    return NextResponse.json({ 
      products,
      total,
      totalPages: Math.ceil(total / pageSize),
      page,
      pageSize
    });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
