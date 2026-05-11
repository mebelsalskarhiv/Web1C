import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/token';
import prisma from '@/lib/db';
import { OneCClient } from '@web1c/onec-client';

/**
 * GET /api/admin/odata/entities
 * Get available OData entity sets from 1C
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

    const baseUrl = settingsMap['onec_url'];
    const username = settingsMap['onec_user'];
    const password = settingsMap['onec_password'];

    if (!baseUrl || !username) {
      return NextResponse.json(
        { error: 'Настройки 1C не настроены' },
        { status: 400 }
      );
    }

    // Create client and get entity sets
    const client = new OneCClient({
      baseUrl,
      username,
      password: password || '',
      timeout: 10000,
    });

    const entitySets = await client.getResolvedEntitySets();
    
    // Get all available collections from metadata
    const allEntitySets = Object.values(entitySets);

    return NextResponse.json({
      entitySets: allEntitySets,
      entities: entitySets,
    });
  } catch (error) {
    console.error('Get OData entities error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения сущностей: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
