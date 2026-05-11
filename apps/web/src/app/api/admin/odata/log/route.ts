import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getSession } from '@/lib/auth/token';

// In-memory storage for OData logs (shared across requests via module cache)
interface ODataLogStorage {
  logs: Array<{
    id: string;
    timestamp: string;
    method: string;
    url: string;
    entitySet?: string;
    entityType?: string;
    status: string;
    httpStatus?: number;
    durationMs: number;
    retryCount?: number;
    errorMessage?: string;
    errorDetails?: string;
    isCached?: boolean;
  }>;
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    retriedRequests: number;
    averageDurationMs: number;
    requestsByEntity: Record<string, number>;
    errorsByType: Record<string, number>;
  };
}

// Global storage (in production, use Redis or database)
const storage: ODataLogStorage = {
  logs: [],
  stats: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0,
    averageDurationMs: 0,
    requestsByEntity: {},
    errorsByType: {},
  },
};

const MAX_LOGS = 5000;

/**
 * POST /api/admin/odata/log
 * Log an OData request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      timestamp,
      method,
      url,
      entitySet,
      entityType,
      status,
      httpStatus,
      durationMs,
      retryCount,
      errorMessage,
      errorDetails,
      isCached,
    } = body;

    // Add to logs
    storage.logs.push({
      id: id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: timestamp || new Date().toISOString(),
      method,
      url,
      entitySet,
      entityType,
      status,
      httpStatus,
      durationMs,
      retryCount,
      errorMessage,
      errorDetails,
      isCached,
    });

    // Trim if needed
    if (storage.logs.length > MAX_LOGS) {
      storage.logs = storage.logs.slice(-MAX_LOGS);
    }

    // Update stats
    storage.stats.totalRequests++;
    
    if (status === 'success') {
      storage.stats.successfulRequests++;
    } else if (status === 'error') {
      storage.stats.failedRequests++;
      const errorType = httpStatus ? `HTTP_${httpStatus}` : 'NETWORK_ERROR';
      storage.stats.errorsByType[errorType] = 
        (storage.stats.errorsByType[errorType] || 0) + 1;
    }

    if (retryCount && retryCount > 0) {
      storage.stats.retriedRequests++;
    }

    if (entityType) {
      storage.stats.requestsByEntity[entityType] = 
        (storage.stats.requestsByEntity[entityType] || 0) + 1;
    }

    // Update average duration
    if (durationMs > 0) {
      storage.stats.averageDurationMs = 
        (storage.stats.averageDurationMs * (storage.stats.totalRequests - 1) + durationMs) / 
        storage.stats.totalRequests;
    }

    // Also save to database for persistence
    try {
      await prisma.syncLog.create({
        data: {
          syncSessionId: null,
          entityType: entityType || 'odata_request',
          entityId: id || 'unknown',
          entityGuid1c: entitySet,
          operation: 'update',
          status: status === 'success' ? 'completed' : 'failed',
          requestData: { method, url },
          responseData: { httpStatus, durationMs },
          errorMessage: errorMessage,
          errorDetails: errorDetails ? JSON.parse(errorDetails) : null,
          durationMs,
          processedAt: new Date(timestamp || Date.now()),
        },
      });
    } catch (dbError) {
      // Ignore DB errors for logging
      console.error('[OData Log] Failed to save to database:', dbError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log OData request error:', error);
    return NextResponse.json(
      { error: 'Ошибка логгирования' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/odata/log
 * Get OData logs from database
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const entityType = searchParams.get('entityType') || undefined;
    const status = searchParams.get('status') || undefined;
    const onlyErrors = searchParams.get('errors') === 'true';
    const search = searchParams.get('search') || undefined;

    // Build where clause
    const whereClause: any = {};
    
    if (entityType) {
      whereClause.entityType = entityType;
    }
    
    if (status) {
      whereClause.status = status;
    }
    
    if (onlyErrors) {
      whereClause.status = 'failed';
    }
    
    if (search) {
      whereClause.OR = [
        { entityId: { contains: search, mode: 'insensitive' } },
        { entityGuid1c: { contains: search, mode: 'insensitive' } },
        { errorMessage: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get logs from database
    const [logs, total] = await Promise.all([
      prisma.syncLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.syncLog.count({ where: whereClause }),
    ]);

    // Transform to OData log format
    const transformedLogs = logs.map(log => ({
      id: String(log.id),
      timestamp: log.createdAt.toISOString(),
      method: log.operation || 'update',
      url: log.entityGuid1c || '',
      entitySet: log.entityGuid1c,
      entityType: log.entityType,
      status: log.status === 'completed' ? 'success' : log.status,
      httpStatus: log.status === 'completed' ? 200 : log.status === 'failed' ? 500 : undefined,
      durationMs: log.durationMs || 0,
      errorMessage: log.errorMessage || undefined,
    }));

    // Get stats from in-memory storage
    return NextResponse.json({
      logs: transformedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: storage.stats,
    });
  } catch (error) {
    console.error('Get OData logs error:', error);
    return NextResponse.json(
      { error: 'Ошибка получения логов' },
      { status: 500 }
    );
  }
}
