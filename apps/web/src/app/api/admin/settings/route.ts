import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['onec_url', 'onec_user', 'onec_password', 'sync_interval', 'auto_sync_enabled', 'reserve_on_order', 'odata_endpoints', 'retail_price_type_guid', 'wholesale_price_type_guid'],
        },
      },
    });

    const settingsMap = Object.fromEntries(
      settings.map((s: { key: string; value: string | null }) => [s.key, s.value])
    );

    let endpoints = {};
    try {
      endpoints = settingsMap['odata_endpoints'] ? JSON.parse(settingsMap['odata_endpoints']) : {};
    } catch {
      endpoints = {};
    }

    return NextResponse.json({
      settings: {
        onecUrl: settingsMap['onec_url'],
        onecUser: settingsMap['onec_user'],
        onecPassword: settingsMap['onec_password'],
        syncInterval: parseInt(settingsMap['sync_interval'] || '300'),
        autoSyncEnabled: settingsMap['auto_sync_enabled'] === 'true',
        reserveOnOrder: settingsMap['reserve_on_order'] === 'true',
        retailPriceTypeGuid: settingsMap['retail_price_type_guid'],
        wholesalePriceTypeGuid: settingsMap['wholesale_price_type_guid'],
        endpoints,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      onecUrl,
      onecUser,
      onecPassword,
      syncInterval,
      autoSyncEnabled,
      reserveOnOrder,
      retailPriceTypeGuid,
      wholesalePriceTypeGuid,
      endpoints,
    } = body;

    const upserts: any[] = [
      prisma.setting.upsert({
        where: { key: 'onec_url' },
        create: { key: 'onec_url', value: onecUrl, description: '1C OData URL' },
        update: { value: onecUrl },
      }),
      prisma.setting.upsert({
        where: { key: 'onec_user' },
        create: { key: 'onec_user', value: onecUser, description: '1C OData User' },
        update: { value: onecUser },
      }),
      prisma.setting.upsert({
        where: { key: 'onec_password' },
        create: { key: 'onec_password', value: onecPassword, description: '1C OData Password', isEncrypted: true },
        update: { value: onecPassword },
      }),
      prisma.setting.upsert({
        where: { key: 'sync_interval' },
        create: { key: 'sync_interval', value: String(syncInterval), description: 'Sync interval in seconds' },
        update: { value: String(syncInterval) },
      }),
      prisma.setting.upsert({
        where: { key: 'auto_sync_enabled' },
        create: { key: 'auto_sync_enabled', value: String(autoSyncEnabled), description: 'Auto sync enabled' },
        update: { value: String(autoSyncEnabled) },
      }),
      prisma.setting.upsert({
        where: { key: 'reserve_on_order' },
        create: { key: 'reserve_on_order', value: String(reserveOnOrder), description: 'Reserve on order' },
        update: { value: String(reserveOnOrder) },
      }),
      prisma.setting.upsert({
        where: { key: 'retail_price_type_guid' },
        create: { key: 'retail_price_type_guid', value: retailPriceTypeGuid, description: 'Retail Price Type GUID' },
        update: { value: retailPriceTypeGuid },
      }),
      prisma.setting.upsert({
        where: { key: 'wholesale_price_type_guid' },
        create: { key: 'wholesale_price_type_guid', value: wholesalePriceTypeGuid, description: 'Wholesale Price Type GUID' },
        update: { value: wholesalePriceTypeGuid },
      }),
    ];

    // Save endpoints if provided
    if (endpoints && typeof endpoints === 'object') {
      upserts.push(
        prisma.setting.upsert({
          where: { key: 'odata_endpoints' },
          create: { key: 'odata_endpoints', value: JSON.stringify(endpoints), description: 'OData entity endpoints' },
          update: { value: JSON.stringify(endpoints) },
        })
      );
    }

    await prisma.$transaction(upserts);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
