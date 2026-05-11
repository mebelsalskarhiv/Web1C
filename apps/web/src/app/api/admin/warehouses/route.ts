import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import { OneCClient } from '@web1c/onec-client';

/**
 * GET /api/admin/warehouses
 * Get warehouses list from 1C
 */
export async function GET(request: NextRequest) {
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
      timeout: 10000,
    });

    // Try to get warehouses from 1C
    // In 1C UT 11.5, warehouses are in Catalog_Склады
    try {
      const entitySets = await client.getResolvedEntitySets();
      const warehouseEntitySet = entitySets.warehouses || 'Catalog_Склады';
      
      // Try to fetch warehouses
      const response = await (client as any).client.get(`/${warehouseEntitySet}?$top=1000`);
      const warehouses = response.data.value || [];

      return NextResponse.json({
        warehouses: warehouses.map((w: any) => ({
          guid: w.Ref_Key || w['Ссылка_Key'],
          name: w.Description || w['Наименование'],
          code: w.Code || w['Код'],
        })),
        source: '1C',
      });
    } catch (error) {
      console.error('Failed to fetch warehouses from 1C:', error);
      
      // Fallback: get warehouses from database (previously synced)
      const stocks = await prisma.productStock.findMany({
        select: {
          warehouseGuid1c: true,
          warehouseName: true,
        },
        distinct: ['warehouseGuid1c'],
      });

      const warehouses = stocks
        .filter(s => s.warehouseGuid1c)
        .map(s => ({
          guid: s.warehouseGuid1c!,
          name: s.warehouseName || `Склад ${s.warehouseGuid1c!.substring(0, 8)}`,
        }));

      return NextResponse.json({
        warehouses,
        source: 'database',
      });
    }
  } catch (error) {
    console.error('Get warehouses error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения складов: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
