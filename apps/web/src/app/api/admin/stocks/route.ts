import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import { OneCClient } from '@web1c/onec-client';

/**
 * GET /api/admin/stocks
 * Get stock levels with optional warehouse filter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const warehouseGuid = searchParams.get('warehouseGuid') || '';
    const search = searchParams.get('search') || '';
    const includeEmpty = searchParams.get('includeEmpty') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    // Build where clause
    const whereClause: any = {};
    if (warehouseGuid) {
      whereClause.warehouseGuid1c = warehouseGuid;
    }
    if (includeEmpty !== true) {
      whereClause.quantity = { gt: 0 };
    }

    // Get total count first
    const total = await prisma.productStock.count({
      where: whereClause,
    });

    // Get stocks from database with pagination
    const stocks = await prisma.productStock.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            guid1c: true,
            article: true,
            name: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get warehouse name mapping
    const warehouseNames = new Map<string, string>();
    stocks.forEach(s => {
      if (s.warehouseGuid1c && s.warehouseName) {
        warehouseNames.set(s.warehouseGuid1c, s.warehouseName);
      }
    });

    // Group by product
    const productStocks = new Map<number, any>();
    stocks.forEach(stock => {
      const productId = stock.product.id;
      if (!productStocks.has(productId)) {
        productStocks.set(productId, {
          product: stock.product,
          stocks: [],
          totalQuantity: 0,
          totalReserved: 0,
          totalAvailable: 0,
        });
      }
      const productData = productStocks.get(productId);
      const available = Number(stock.quantity) - Number(stock.reserved);
      productData.stocks.push({
        warehouseGuid: stock.warehouseGuid1c,
        warehouseName: stock.warehouseName,
        quantity: Number(stock.quantity),
        reserved: Number(stock.reserved),
        available: available,
      });
      productData.totalQuantity += Number(stock.quantity);
      productData.totalReserved += Number(stock.reserved);
      productData.totalAvailable += available;
    });

    // Get unique warehouses
    const warehouses = Array.from(warehouseNames.entries()).map(([guid, name]) => ({
      guid,
      name,
    }));

    return NextResponse.json({
      stocks: Array.from(productStocks.values()),
      warehouses,
      total,
      totalPages: Math.ceil(total / pageSize),
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Get stocks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
