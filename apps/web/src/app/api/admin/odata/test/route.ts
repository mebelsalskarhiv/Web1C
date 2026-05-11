import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/token';
import { OneCClient } from '@web1c/onec-client';
import prisma from '@/lib/db';

/**
 * POST /api/admin/odata/test
 * Test 1C OData connection with detailed logging
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, username, password, timeout } = body;

    if (!url || !username) {
      return NextResponse.json(
        { error: 'URL и пользователь обязательны' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const logs: Array<{ type: string; message: string; duration?: number }> = [];

    // Create client with logging
    const client = new OneCClient({
      baseUrl: url,
      username,
      password: password || '',
      timeout: timeout || 10000,
      maxRetries: 1,
      enableLogging: true,
      onLog: (logEntry) => {
        logs.push({
          type: logEntry.status,
          message: `${logEntry.method} ${logEntry.url}`,
          duration: logEntry.durationMs,
        });
      },
    });

    const results: Record<string, { success: boolean; count?: number; error?: string; duration?: number; data?: unknown }> = {};

    // Test 1: Health check
    try {
      const healthStart = Date.now();
      const isHealthy = await client.healthCheck();
      results.health = {
        success: isHealthy,
        duration: Date.now() - healthStart,
      };
      if (!isHealthy) {
        return NextResponse.json({
          success: false,
          error: 'Не удалось подключиться к 1С',
          logs,
          results,
        }, { status: 503 });
      }
    } catch (error) {
      results.health = {
        success: false,
        error: (error as Error).message,
      };
      return NextResponse.json({
        success: false,
        error: 'Ошибка подключения: ' + (error as Error).message,
        logs,
        results,
      }, { status: 503 });
    }

    // Test 2: Get metadata
    try {
      const metadataStart = Date.now();
      const entitySets = await client.getResolvedEntitySets();
      results.metadata = {
        success: true,
        duration: Date.now() - metadataStart,
      };
      results.entitySets = { success: true, data: entitySets };
    } catch (error) {
      results.metadata = {
        success: false,
        error: (error as Error).message,
      };
    }

    // Test 3: Get products (sample)
    try {
      const productsStart = Date.now();
      const products = await client.getProducts({ limit: 5 });
      results.products = {
        success: true,
        count: products.length,
        duration: Date.now() - productsStart,
      };
    } catch (error) {
      results.products = {
        success: false,
        error: (error as Error).message,
      };
    }

    // Test 4: Get partners (sample)
    try {
      const partnersStart = Date.now();
      const partners = await client.getPartners({ limit: 5 });
      results.partners = {
        success: true,
        count: partners.length,
        duration: Date.now() - partnersStart,
      };
    } catch (error) {
      results.partners = {
        success: false,
        error: (error as Error).message,
      };
    }

    // Test 5: Get stocks (sample)
    try {
      const stocksStart = Date.now();
      const stocks = await client.getStocks();
      results.stocks = {
        success: true,
        count: stocks.length,
        duration: Date.now() - stocksStart,
      };
    } catch (error) {
      results.stocks = {
        success: false,
        error: (error as Error).message,
      };
    }

    const allSuccess = Object.values(results).every(r => r.success);
    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: allSuccess,
      totalDuration,
      logs,
      results,
      message: allSuccess 
        ? 'Все тесты пройдены успешно' 
        : 'Некоторые тесты не пройдены',
    });
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      { error: 'Ошибка тестирования: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/odata/test
 * Get current 1C settings and test status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current settings
    const settings = await prisma.setting.findMany({
      where: {
        key: { in: ['onec_url', 'onec_user', 'onec_password'] },
      },
    });

    const settingsMap = Object.fromEntries(
      settings.map((s: { key: string; value: string | null }) => [s.key, s.value])
    );

    return NextResponse.json({
      settings: {
        url: settingsMap['onec_url'] || '',
        username: settingsMap['onec_user'] || '',
        passwordSet: !!settingsMap['onec_password'],
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения настроек' },
      { status: 500 }
    );
  }
}
