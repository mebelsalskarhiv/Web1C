import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/token';
import { OneCClient } from '@web1c/onec-client';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, username, password } = body;

    if (!url || !username) {
      return NextResponse.json(
        { error: 'URL и пользователь обязательны' },
        { status: 400 }
      );
    }

    const client = new OneCClient({
      baseUrl: url,
      username,
      password: password || '',
      timeout: 10000,
    });

    const isHealthy = await client.healthCheck();

    if (!isHealthy) {
      return NextResponse.json(
        { error: 'Не удалось подключиться к 1С' },
        { status: 503 }
      );
    }

    const entitySets = await client.getResolvedEntitySets();
    return NextResponse.json({ success: true, entitySets });
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { error: 'Ошибка подключения: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
