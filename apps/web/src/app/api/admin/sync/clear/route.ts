import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

/**
 * POST /api/admin/sync/clear
 * Clear all data from database (dangerous operation!)
 */
export async function POST() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let deleted = 0;

    // Delete in correct order (respecting foreign keys)
    // 1. Delete sync logs
    const logsDeleted = await prisma.syncLog.deleteMany({});
    deleted += logsDeleted.count;

    // 2. Delete sync sessions
    const sessionsDeleted = await prisma.syncSession.deleteMany({});
    deleted += sessionsDeleted.count;

    // 3. Delete order items and history
    const orderItemsDeleted = await prisma.orderItem.deleteMany({});
    deleted += orderItemsDeleted.count;

    const orderHistoryDeleted = await prisma.orderHistory.deleteMany({});
    deleted += orderHistoryDeleted.count;

    // 4. Delete orders
    const ordersDeleted = await prisma.order.deleteMany({});
    deleted += ordersDeleted.count;

    // 5. Delete product reservations
    const reservationsDeleted = await prisma.productReservation.deleteMany({});
    deleted += reservationsDeleted.count;

    // 6. Delete product stocks
    const stocksDeleted = await prisma.productStock.deleteMany({});
    deleted += stocksDeleted.count;

    // 7. Delete products
    const productsDeleted = await prisma.product.deleteMany({});
    deleted += productsDeleted.count;

    // 8. Delete product groups
    const groupsDeleted = await prisma.productGroup.deleteMany({});
    deleted += groupsDeleted.count;

    // 9. Delete partners (but keep users)
    const partnersDeleted = await prisma.partner.deleteMany({});
    deleted += partnersDeleted.count;

    // 10. Delete API keys
    const apiKeysDeleted = await prisma.apiKey.deleteMany({});
    deleted += apiKeysDeleted.count;

    // 11. Reset settings (keep 1C connection)
    const settingsDeleted = await prisma.setting.deleteMany({
      where: {
        key: {
          notIn: ['onec_url', 'onec_user', 'onec_password', 'odata_endpoints'],
        },
      },
    });
    deleted += settingsDeleted.count;

    return NextResponse.json({
      success: true,
      deleted,
      message: `Удалено ${deleted} записей`,
    });
  } catch (error) {
    console.error('Clear database error:', error);
    return NextResponse.json(
      { error: 'Ошибка очистки базы: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
