import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

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
    } = body;

    await prisma.$transaction([
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
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
