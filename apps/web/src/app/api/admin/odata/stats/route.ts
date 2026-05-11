import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/token';

// In-memory storage (shared via module cache)
interface ODataStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retriedRequests: number;
  cachedResponses: number;
  averageDurationMs: number;
  totalDataTransferred: number;
  requestsByEntity: Record<string, number>;
  errorsByType: Record<string, number>;
  startTime: number;
}

const stats: ODataStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retriedRequests: 0,
  cachedResponses: 0,
  averageDurationMs: 0,
  totalDataTransferred: 0,
  requestsByEntity: {},
  errorsByType: {},
  startTime: Date.now(),
};

/**
 * GET /api/admin/odata/stats
 * Get OData monitoring statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uptime = Date.now() - stats.startTime;
    const uptimeMinutes = uptime / 60000;
    const requestsPerMinute = uptimeMinutes > 0 ? stats.totalRequests / uptimeMinutes : 0;
    const successRate = stats.totalRequests > 0 
      ? (stats.successfulRequests / stats.totalRequests) * 100 
      : 100;

    // Calculate health status
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];

    if (successRate < 90) {
      healthStatus = 'unhealthy';
      recommendations.push('Высокий процент ошибок. Проверьте подключение к 1С.');
    } else if (successRate < 95) {
      healthStatus = 'degraded';
      recommendations.push('Процент ошибок выше нормы. Рекомендуется проверка.');
    }

    if (stats.averageDurationMs > 5000) {
      if (healthStatus === 'healthy') healthStatus = 'degraded';
      if (stats.averageDurationMs > 10000) healthStatus = 'unhealthy';
      recommendations.push('Среднее время ответа > 5с. Проверьте производительность 1С.');
    }

    if (stats.retriedRequests > stats.totalRequests * 0.1 && stats.totalRequests > 0) {
      recommendations.push('Более 10% запросов требуют повторных попыток. Проверьте стабильность сети.');
    }

    // Top errors
    const topErrors = Object.entries(stats.errorsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Top entities
    const topEntities = Object.entries(stats.requestsByEntity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([entity, count]) => ({ entity, count }));

    return NextResponse.json({
      stats: {
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        failedRequests: stats.failedRequests,
        retriedRequests: stats.retriedRequests,
        cachedResponses: stats.cachedResponses,
        averageDurationMs: Math.round(stats.averageDurationMs),
        totalDataTransferred: stats.totalDataTransferred,
        requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
      },
      health: {
        status: healthStatus,
        recommendations,
      },
      breakdown: {
        byEntity: topEntities,
        byError: topErrors,
      },
      uptime: {
        ms: uptime,
        formatted: formatUptime(uptime),
      },
    });
  } catch (error) {
    console.error('Get OData stats error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения статистики' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/odata/stats/reset
 * Reset statistics
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    stats.totalRequests = 0;
    stats.successfulRequests = 0;
    stats.failedRequests = 0;
    stats.retriedRequests = 0;
    stats.cachedResponses = 0;
    stats.averageDurationMs = 0;
    stats.totalDataTransferred = 0;
    stats.requestsByEntity = {};
    stats.errorsByType = {};
    stats.startTime = Date.now();

    return NextResponse.json({ success: true, message: 'Статистика сброшена' });
  } catch (error) {
    console.error('Reset OData stats error:', error);
    return NextResponse.json(
      { error: 'Ошибка сброса статистики' },
      { status: 500 }
    );
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}д ${hours % 24}ч ${minutes % 60}м`;
  }
  if (hours > 0) {
    return `${hours}ч ${minutes % 60}м ${seconds % 60}с`;
  }
  if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  }
  return `${seconds}с`;
}
