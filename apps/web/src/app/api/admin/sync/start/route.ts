import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';
import { Queue } from 'bullmq';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { syncType, modifiedSince } = await request.json();

    if (!syncType) {
      return NextResponse.json({ error: 'syncType is required' }, { status: 400 });
    }

    const typeMap: Record<string, string> = {
      full: 'full-sync',
      products: 'sync-products',
      partners: 'sync-partners',
      orders: 'sync-orders',
      stocks: 'sync-stocks',
      prices: 'sync-prices',
      images: 'sync-images',
    };

    const jobType = typeMap[syncType];
    if (!jobType) {
      return NextResponse.json({ error: `Unknown syncType: ${syncType}` }, { status: 400 });
    }

    const syncSession = await prisma.syncSession.create({
      data: {
        syncType,
        status: 'pending',
        createdBy: session.userId,
      },
    });

    const queue = new Queue('sync-queue', {
      connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 1000 },
    });

    await queue.add('sync-job', {
      type: jobType,
      sessionId: syncSession.id,
      modifiedSince,
    });

    return NextResponse.json({
      success: true,
      sessionId: syncSession.sessionUuid,
      message: `Задание на синхронизацию (${syncType}) добавлено в очередь.`,
    });
  } catch (error) {
    console.error('Sync start error:', error);
    return NextResponse.json(
      { error: 'Ошибка запуска синхронизации: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
