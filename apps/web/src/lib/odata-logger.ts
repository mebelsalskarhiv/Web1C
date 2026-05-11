/**
 * OData Logger Utility
 * 
 * Utility for logging OData requests to the monitoring API
 */

const MONITORING_API_URL = process.env.MONITORING_API_URL || '/api/admin/odata/log';

export interface ODataLogEntry {
  id?: string;
  timestamp?: string;
  method: string;
  url: string;
  entitySet?: string;
  entityType?: string;
  status: 'pending' | 'success' | 'error' | 'retry';
  httpStatus?: number;
  durationMs: number;
  retryCount?: number;
  errorMessage?: string;
  errorDetails?: string;
  isCached?: boolean;
}

/**
 * Send log entry to monitoring API
 */
export async function logODataRequest(entry: ODataLogEntry): Promise<void> {
  try {
    // Skip if not in server environment
    if (typeof window !== 'undefined') {
      return;
    }

    const response = await fetch(MONITORING_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      console.error('[OData Logger] Failed to send log:', response.status);
    }
  } catch (error) {
    // Silently fail - logging should not break the app
    console.debug('[OData Logger] Log failed:', (error as Error).message);
  }
}

/**
 * Create a log entry helper
 */
export function createLogEntry(
  method: string,
  url: string,
  options?: Partial<Omit<ODataLogEntry, 'method' | 'url'>>
): ODataLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    method,
    url,
    status: 'pending',
    durationMs: 0,
    ...options,
  };
}

/**
 * Timing helper for logging
 */
export class ODataLogTimer {
  private startTime: number;
  private entry: ODataLogEntry;

  constructor(method: string, url: string, options?: Partial<Omit<ODataLogEntry, 'method' | 'url' | 'durationMs'>>) {
    this.startTime = Date.now();
    this.entry = createLogEntry(method, url, options);
  }

  success(httpStatus?: number, responseData?: unknown): void {
    const duration = Date.now() - this.startTime;
    this.entry.status = 'success';
    this.entry.httpStatus = httpStatus;
    this.entry.durationMs = duration;
    
    logODataRequest(this.entry);
  }

  error(httpStatus?: number, errorMessage?: string, errorDetails?: string): void {
    const duration = Date.now() - this.startTime;
    this.entry.status = 'error';
    this.entry.httpStatus = httpStatus;
    this.entry.durationMs = duration;
    this.entry.errorMessage = errorMessage;
    this.entry.errorDetails = errorDetails;
    
    logODataRequest(this.entry);
  }

  retry(retryCount: number): void {
    this.entry.status = 'retry';
    this.entry.retryCount = retryCount;
    this.entry.durationMs = Date.now() - this.startTime;
    
    logODataRequest(this.entry);
  }
}
