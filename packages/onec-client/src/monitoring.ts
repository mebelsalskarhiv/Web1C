/**
 * OData Monitoring Service
 * 
 * Provides centralized monitoring and logging for 1C OData requests.
 * Can be used to track requests across multiple client instances.
 */

import { ODataLogEntry, ODataMonitoringStats, RequestStatus } from './index';

// ===========================================
// Types
// ===========================================

export interface MonitoringConfig {
  maxLogs: number;
  enableConsoleLogging: boolean;
  enableStats: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  filterEntityTypes?: string[];
}

export interface MonitoringEvent {
  type: 'request_started' | 'request_completed' | 'request_retry' | 'request_error';
  logEntry: ODataLogEntry;
  timestamp: Date;
}

export type MonitoringCallback = (event: MonitoringEvent) => void;

// ===========================================
// Constants
// ===========================================

const DEFAULT_CONFIG: MonitoringConfig = {
  maxLogs: 5000,
  enableConsoleLogging: true,
  enableStats: true,
  logLevel: 'info',
};

// ===========================================
// Monitoring Service Class
// ===========================================

export class ODataMonitoringService {
  private static instance: ODataMonitoringService;
  
  private config: MonitoringConfig;
  private logs: ODataLogEntry[] = [];
  private stats: ODataMonitoringStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0,
    cachedResponses: 0,
    averageDurationMs: 0,
    totalDataTransferred: 0,
    requestsByEntity: {},
    errorsByType: {},
    recentLogs: [],
  };
  private callbacks: Set<MonitoringCallback> = new Set();
  private startTime: Date;

  private constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
  }

  static getInstance(config?: Partial<MonitoringConfig>): ODataMonitoringService {
    if (!ODataMonitoringService.instance) {
      ODataMonitoringService.instance = new ODataMonitoringService(config);
    }
    return ODataMonitoringService.instance;
  }

  // ===========================================
  // Configuration
  // ===========================================

  configure(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // ===========================================
  // Event Subscription
  // ===========================================

  subscribe(callback: MonitoringCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private emitEvent(event: MonitoringEvent): void {
    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[OData Monitoring] Callback error:', error);
      }
    });
  }

  // ===========================================
  // Logging
  // ===========================================

  logRequest(logEntry: ODataLogEntry): void {
    // Filter by entity type if configured
    if (
      this.config.filterEntityTypes && 
      logEntry.entityType && 
      !this.config.filterEntityTypes.includes(logEntry.entityType)
    ) {
      return;
    }

    // Add to logs
    this.logs.push(logEntry);
    
    // Trim if needed
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs);
    }

    // Update stats
    if (this.config.enableStats) {
      this.updateStats(logEntry);
    }

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }

    // Emit event
    const eventType = this.getEventType(logEntry);
    this.emitEvent({
      type: eventType,
      logEntry,
      timestamp: new Date(),
    });
  }

  private getEventType(logEntry: ODataLogEntry): MonitoringEvent['type'] {
    if (logEntry.status === 'pending') return 'request_started';
    if (logEntry.status === 'retry') return 'request_retry';
    if (logEntry.status === 'success') return 'request_completed';
    if (logEntry.status === 'error') return 'request_error';
    return 'request_completed';
  }

  private updateStats(logEntry: ODataLogEntry): void {
    this.stats.totalRequests++;

    if (logEntry.status === 'success') {
      this.stats.successfulRequests++;
      if (logEntry.responseData) {
        this.stats.totalDataTransferred += JSON.stringify(logEntry.responseData).length;
      }
      if (logEntry.isCached) {
        this.stats.cachedResponses++;
      }
    } else if (logEntry.status === 'error') {
      this.stats.failedRequests++;
      const errorType = logEntry.httpStatus 
        ? `HTTP_${logEntry.httpStatus}` 
        : logEntry.errorDetails || 'UNKNOWN_ERROR';
      this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
    }

    if (logEntry.retryCount && logEntry.retryCount > 0) {
      this.stats.retriedRequests++;
    }

    if (logEntry.entityType) {
      this.stats.requestsByEntity[logEntry.entityType] = 
        (this.stats.requestsByEntity[logEntry.entityType] || 0) + 1;
    }

    // Update average duration
    if (logEntry.durationMs > 0) {
      this.stats.averageDurationMs = 
        (this.stats.averageDurationMs * (this.stats.totalRequests - 1) + logEntry.durationMs) / 
        this.stats.totalRequests;
    }

    // Update recent logs
    this.stats.recentLogs = this.logs.slice(-50);
  }

  private logToConsole(logEntry: ODataLogEntry): void {
    if (this.config.logLevel === 'error' && logEntry.status !== 'error') return;
    if (this.config.logLevel === 'warn' && logEntry.status === 'pending') return;

    const statusIcon = this.getStatusIcon(logEntry.status);
    const duration = logEntry.durationMs > 0 ? `${logEntry.durationMs}ms` : '...';
    const status = logEntry.httpStatus ? `HTTP ${logEntry.httpStatus}` : '';
    const retryInfo = logEntry.retryCount ? `(retry ${logEntry.retryCount})` : '';
    
    const logFn = logEntry.status === 'error' ? console.error : console.log;
    
    logFn(
      `[${statusIcon} 1C OData] ${logEntry.method} ${this.truncateUrl(logEntry.url)} ` +
      `${status} ${duration} ${retryInfo}`
    );

    if (logEntry.status === 'error' && logEntry.errorMessage) {
      console.error(`  └─ Error: ${logEntry.errorMessage}`);
      if (logEntry.errorDetails) {
        console.error(`  └─ Details: ${logEntry.errorDetails}`);
      }
    }
  }

  private getStatusIcon(status: RequestStatus): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'retry': return '🔄';
      default: return '📝';
    }
  }

  private truncateUrl(url: string, maxLength: number = 80): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }

  // ===========================================
  // Query Methods
  // ===========================================

  getStats(): ODataMonitoringStats {
    return { ...this.stats };
  }

  getLogs(options?: {
    limit?: number;
    offset?: number;
    entityType?: string;
    status?: RequestStatus;
    method?: string;
    search?: string;
  }): ODataLogEntry[] {
    let filtered = [...this.logs];

    // Apply filters
    if (options?.entityType) {
      filtered = filtered.filter(log => log.entityType === options.entityType);
    }

    if (options?.status) {
      filtered = filtered.filter(log => log.status === options.status);
    }

    if (options?.method) {
      filtered = filtered.filter(log => log.method === options.method);
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.url.toLowerCase().includes(searchLower) ||
        log.entitySet?.toLowerCase().includes(searchLower) ||
        log.errorMessage?.toLowerCase().includes(searchLower)
      );
    }

    // Apply offset
    const offset = options?.offset || 0;
    filtered = filtered.slice(offset);

    // Apply limit
    const limit = options?.limit || 100;
    filtered = filtered.slice(0, limit);

    return filtered;
  }

  getLogById(id: string): ODataLogEntry | undefined {
    return this.logs.find(log => log.id === id);
  }

  getRecentLogs(limit: number = 50): ODataLogEntry[] {
    return this.logs.slice(-limit);
  }

  getErrorLogs(limit: number = 100): ODataLogEntry[] {
    return this.logs
      .filter(log => log.status === 'error')
      .slice(-limit);
  }

  getSlowRequests(thresholdMs: number = 5000, limit: number = 50): ODataLogEntry[] {
    return this.logs
      .filter(log => log.durationMs >= thresholdMs)
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, limit);
  }

  getRequestsByEntity(entityType: string, limit: number = 100): ODataLogEntry[] {
    return this.logs
      .filter(log => log.entityType === entityType)
      .slice(-limit);
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  getRequestsPerMinute(): number {
    const uptimeMinutes = this.getUptime() / 60000;
    if (uptimeMinutes === 0) return 0;
    return this.stats.totalRequests / uptimeMinutes;
  }

  getSuccessRate(): number {
    if (this.stats.totalRequests === 0) return 100;
    return (this.stats.successfulRequests / this.stats.totalRequests) * 100;
  }

  // ===========================================
  // Export/Import
  // ===========================================

  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    // CSV format
    const headers = [
      'id', 'timestamp', 'method', 'url', 'entityType', 'entitySet',
      'status', 'httpStatus', 'durationMs', 'retryCount', 'errorMessage'
    ];

    const rows = this.logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.method,
      log.url,
      log.entityType || '',
      log.entitySet || '',
      log.status,
      log.httpStatus || '',
      log.durationMs,
      log.retryCount || 0,
      log.errorMessage || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  clearLogs(): void {
    this.logs = [];
    this.stats.recentLogs = [];
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      cachedResponses: 0,
      averageDurationMs: 0,
      totalDataTransferred: 0,
      requestsByEntity: {},
      errorsByType: {},
      recentLogs: [],
    };
    this.startTime = new Date();
  }

  // ===========================================
  // Health & Diagnostics
  // ===========================================

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    successRate: number;
    avgResponseTime: number;
    errorRate: number;
    recommendations: string[];
  } {
    const successRate = this.getSuccessRate();
    const avgResponseTime = this.stats.averageDurationMs;
    const errorRate = this.stats.totalRequests > 0 
      ? (this.stats.failedRequests / this.stats.totalRequests) * 100 
      : 0;

    const recommendations: string[] = [];

    if (successRate < 90) {
      recommendations.push('Высокий процент ошибок. Проверьте подключение к 1С.');
    }

    if (avgResponseTime > 5000) {
      recommendations.push('Среднее время ответа > 5с. Рассмотрите увеличение таймаута или оптимизацию запросов.');
    }

    if (this.stats.retriedRequests > this.stats.totalRequests * 0.1) {
      recommendations.push('Более 10% запросов требуют повторных попыток. Проверьте стабильность сети.');
    }

    const status: 'healthy' | 'degraded' | 'unhealthy' = 
      successRate >= 95 && avgResponseTime < 3000 ? 'healthy' :
      successRate >= 80 && avgResponseTime < 10000 ? 'degraded' :
      'unhealthy';

    return {
      status,
      successRate,
      avgResponseTime,
      errorRate,
      recommendations,
    };
  }
}

// ===========================================
// Singleton Export
// ===========================================

export const monitoringService = ODataMonitoringService.getInstance();
