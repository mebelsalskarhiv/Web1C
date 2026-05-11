import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import { OneCClient } from '@web1c/onec-client';

/**
 * POST /api/admin/stocks/sync
 * Sync stocks from 1C
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get 1C settings
    const settings = await prisma.setting.findMany({
      where: {
        key: { in: ['onec_url', 'onec_user', 'onec_password'] },
      },
    });

    const settingsMap = Object.fromEntries(
      settings.map((s: { key: string; value: string | null }) => [s.key, s.value])
    );

    const client = new OneCClient({
      baseUrl: settingsMap['onec_url'] || 'http://localhost:8080/hs/odata',
      username: settingsMap['onec_user'] || 'odata_user',
      password: settingsMap['onec_password'] || '',
    });

    // First, get warehouses and build a map
    const warehouseMap = new Map<string, string>();
    try {
      const warehouses1C = await client.getWarehouses();
      console.log(`[Sync] Received ${warehouses1C.length} warehouses from 1C`);
      
      for (const wh of warehouses1C) {
        const whGuid = wh.Ref_Key || (wh as any)['Ссылка_Key'];
        const whName = wh.Description || (wh as any)['Наименование'] || wh.Code || (wh as any)['Код'];
        if (whGuid) {
          warehouseMap.set(whGuid, whName || `Склад ${whGuid.substring(0, 8)}`);
          console.log(`[Sync] Warehouse: ${whName} (${whGuid})`);
        }
      }
    } catch (err) {
      console.error('[Sync] Error fetching warehouses:', err);
    }

    // Get stocks from 1C using virtual table BalanceAndTurnovers
    const stocks1C = await client.getStocks();
    console.log(`[Sync] Received ${stocks1C.length} stock records from 1C`);
    
    // Debug first stock
    if (stocks1C.length > 0) {
      const firstStock = stocks1C[0];
      console.log('[Sync] First stock debug:', {
        Product_Key: firstStock.Product_Key,
        Warehouse_Key: firstStock.Warehouse_Key,
        Quantity: firstStock.Quantity,
        Raw_Номенклатура_Key: (firstStock as any)['Номенклатура_Key'],
        Raw_Склад_Key: (firstStock as any)['Склад_Key'],
        Raw_ВНаличииClosingBalance: (firstStock as any)['ВНаличииClosingBalance'],
      });
    }

    let updated = 0;
    for (const stock of stocks1C) {
      // Use mapped fields from Russian API response
      const productGuid = stock.Product_Key || (stock as any)['Номенклатура_Key'];
      const warehouseGuid = stock.Warehouse_Key || (stock as any)['Склад_Key'];
      const quantity = (stock as any)['ВНаличииClosingBalance'] || stock.Quantity || 0;
      const reserved = (stock as any)['КОтгрузкеClosingBalance'] || stock.Reserved || 0;
      
      console.log(`[Sync] Processing stock: Product=${productGuid?.substring(0, 8)}, Warehouse=${warehouseGuid?.substring(0, 8)}, Qty=${quantity}`);
      
      if (!productGuid) {
        console.warn('[Sync] Skipping stock without Product_Key:', stock);
        continue;
      }

      const product = await prisma.product.findUnique({
        where: { guid1c: productGuid },
      });

      if (product) {
        // Get warehouse name from map or use default
        let warehouseName = 'Неизвестно';
        if (warehouseGuid) {
          warehouseName = warehouseMap.get(warehouseGuid) || `Склад ${warehouseGuid.substring(0, 8)}`;
        }

        await prisma.productStock.upsert({
          where: {
            productId_warehouseGuid1c_priceType: {
              productId: product.id,
              warehouseGuid1c: warehouseGuid || 'unknown',
              priceType: 'default',
            },
          },
          create: {
            productId: product.id,
            warehouseGuid1c: warehouseGuid || 'unknown',
            warehouseName: warehouseName,
            quantity: quantity,
            reserved: reserved,
          },
          update: {
            quantity: quantity,
            reserved: reserved,
            warehouseName: warehouseName,
            lastSyncAt: new Date(),
          },
        });
        updated++;
      } else {
        console.warn('[Sync] Product not found for stock:', productGuid);
      }
    }

    console.log(`[Sync] Stocks sync completed: ${updated} records updated`);

    return NextResponse.json({
      success: true,
      updated,
      message: `Обновлено ${updated} остатков`,
    });
  } catch (error) {
    console.error('Sync stocks error:', error);
    return NextResponse.json(
      { error: 'Ошибка синхронизации: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
