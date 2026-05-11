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
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';

    const whereClause: any = { isMerged: false };
    
    if (search) {
      whereClause.OR = [
        { nameFull: { contains: search, mode: 'insensitive' } },
        { nameShort: { contains: search, mode: 'insensitive' } },
        { inn: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.partner.count({ where: whereClause });

    const partners = await prisma.partner.findMany({
      where: whereClause,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { nameFull: 'asc' },
      select: {
        id: true,
        guid1c: true,
        inn: true,
        kpp: true,
        nameFull: true,
        nameShort: true,
        phoneMain: true,
        email: true,
        addressLegal: true,
        balanceDebit: true,
        balanceCredit: true,
        isMerged: true,
        mergedIntoId: true,
        _count: {
          select: {
            orders: true,
            users: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      partners,
      total,
      totalPages: Math.ceil(total / pageSize),
      page,
      pageSize
    });
  } catch (error) {
    console.error('Get partners error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
