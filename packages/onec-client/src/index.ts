/**
 * 1C:UT 11.5 OData Client (Enhanced)
 *
 * Client for working with 1C:Trade Management 11.5 OData service
 * Supports both OData standard and custom ODATA module
 * 
 * Enhancements:
 * - Pagination support for large datasets
 * - Retry logic with exponential backoff
 * - Metadata caching
 * - Detailed request/response logging
 * - Request monitoring
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse
} from 'axios';

// Export monitoring service and types
export {
  ODataMonitoringService,
  monitoringService,
  type MonitoringConfig,
  type MonitoringEvent,
  type MonitoringCallback,
} from './monitoring';

// ===========================================
// Types
// ===========================================

export interface OneCConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout?: number;
  entitySets?: Partial<Record<OneCEntityName, string>>;
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  enableMonitoring?: boolean;
  onLog?: (logEntry: ODataLogEntry) => void;
}

export type OneCEntityName =
  | 'products'
  | 'productGroups'
  | 'prices'
  | 'stocks'
  | 'partners'
  | 'orders'
  | 'realizations'
  | 'productImages'
  | 'warehouses';

// Add offset to all option interfaces
interface GetProductsOptions {
  limit?: number;
  offset?: number;
  modifiedSince?: string;
  select?: string[];
}

interface GetProductGroupsOptions {
  limit?: number;
  offset?: number;
  modifiedSince?: string;
}

export interface OneCProduct {
  Ref_Key: string;
  Code: string;
  Description: string;
  Parent_Key?: string;
  BaseUnit_Key?: string;
  IsService?: boolean;
  IsMarked?: boolean;
  Weight?: number;
  Length?: number;
  Width?: number;
  Height?: number;
}

export interface OneCProductGroup {
  Ref_Key: string;
  Code?: string;
  Description: string;
  Parent_Key?: string;
}

export interface OneCPrice {
  PriceType_Key: string;
  Currency_Key: string;
  Price: number;
  Product_Key: string;
}

export interface OneCStock {
  Warehouse_Key: string;
  Product_Key: string;
  Quantity: number;
  Reserved?: number;
  Unit_Key?: string;
  // Дополнительные поля из 1С УТ 11.5
  Номенклатура_Key?: string;
  Склад_Key?: string;
  ВНаличии?: number;
  ВНаличииClosingBalance?: number;
  ВНаличииOpeningBalance?: number;
  КОтгрузке?: number;
  КОтгрузкеClosingBalance?: number;
  КОтгрузкеOpeningBalance?: number;
  Серия_Key?: string;
}

export interface OneCPartner {
  Ref_Key: string;
  Code?: string;
  Description: string;
  INN?: string; // 1С: ИНН
  KPP?: string; // 1С: КПП
  IsIndividual?: boolean;
  FullName?: string;
  Address?: string;
  Phone?: string; // 1С: НомерТелефона
  Email?: string;
  ContactPerson_Key?: string;
  // Дополнительные поля из 1С
  НаименованиеПолное?: string;
  НаименованиеСокращенное?: string;
  НомерТелефона?: string;
  АдресЮр?: string;
  АдресПочт?: string;
  Сайт?: string;
  КонтактноеЛицо?: string;
  Должность?: string;
}

export interface OneCWarehouse {
  Ref_Key: string;
  Code?: string;
  Description: string;
  Parent_Key?: string;
}

export interface OneCOrder {
  Ref_Key: string;
  Number: string;
  Date: string;
  Partner_Key: string;
  TotalAmount: number;
  Status?: string;
  Items?: OneCOrderItem[];
}

export interface OneCOrderItem {
  Product_Key: string;
  Quantity: number;
  Price: number;
  Total: number;
  Unit_Key?: string;
}

export interface OneCRealization {
  Ref_Key: string;
  Number: string;
  Date: string;
  Partner_Key: string;
  Order_Key?: string;
  TotalAmount: number;
  Status?: string;
}

export interface OneCProductImage {
  Ref_Key: string;
  Product_Key: string;
  FileName: string;
  Data?: string;
  ContentType?: string;
}

export interface ODataResponse<T> {
  value: T[];
  'odata.count'?: number;
  'odata.nextLink'?: string;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: SyncError[];
}

export interface SyncError {
  entity: string;
  guid: string;
  error: string;
  details?: unknown;
}

// ===========================================
// Monitoring & Logging Types
// ===========================================

export type RequestStatus = 'pending' | 'success' | 'error' | 'retry';

export interface ODataLogEntry {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  entitySet?: string;
  entityType?: OneCEntityName;
  status: RequestStatus;
  httpStatus?: number;
  requestHeaders?: Record<string, string>;
  requestData?: unknown;
  responseHeaders?: Record<string, string>;
  responseData?: unknown;
  errorMessage?: string;
  errorDetails?: string;
  durationMs: number;
  retryCount?: number;
  isCached?: boolean;
}

export interface ODataMonitoringStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retriedRequests: number;
  cachedResponses: number;
  averageDurationMs: number;
  totalDataTransferred: number;
  requestsByEntity: Record<string, number>;
  errorsByType: Record<string, number>;
  recentLogs: ODataLogEntry[];
}

// ===========================================
// Constants
// ===========================================

const DEFAULT_ENTITY_SETS: Record<OneCEntityName, string> = {
  products: 'Catalog_Номенклатура',
  productGroups: 'Catalog_Номенклатура', // Groups are filtered by IsFolder
  prices: 'InformationRegister_ЦеныНоменклатуры',
  stocks: 'AccumulationRegister_ТоварыНаСкладах',
  partners: 'Catalog_Контрагенты',
  orders: 'Document_ЗаказКлиента',
  realizations: 'Document_РеализацияТоваровУслуг',
  productImages: 'Catalog_НоменклатураПрисоединенныеФайлы',
  warehouses: 'Catalog_Склады',
};

const ENTITY_DISCOVERY_PATTERNS: Record<OneCEntityName, RegExp[]> = {
  products: [/catalog.*номенклатур/i, /catalog_номенклатура(?!.*груп|.*файл|.*контрагент)/i],
  productGroups: [/catalog.*номенклатур.*груп/i, /catalog.*груп.*номенклатур/i],
  prices: [/цены?номенклатуры/i, /prices?/i, /price/i, /цены?/i, /прайс/i],
  stocks: [/товарынаскладах/i, /accumulationregister.*товары.*склад/i, /остатк/i, /stocks?/i, /stock/i],
  partners: [/catalog_контрагенты/i, /catalog.*контрагент/i, /catalog.*партнер/i, /catalog.*клиент/i],
  orders: [/document_заказклиента/i, /document.*заказ.*клиент/i, /salesorders?/i, /orders?/i, /заказ/i],
  realizations: [/document_реализация/i, /document.*реализац/i, /realizations?/i, /realization/i],
  productImages: [/catalog_номенклатура.*файл/i, /productimages?/i, /image/i, /изображ/i, /картин/i],
  warehouses: [/catalog_склады/i, /catalog.*склад/i, /warehouses?/i],
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const METADATA_CACHE_TTL = 3600000; // 1 hour
const MAX_LOGS = 1000; // Keep last 1000 logs in memory

// ===========================================
// Helper Functions
// ===========================================

function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function calculateExponentialBackoff(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

function sanitizeForLogging(data: unknown): unknown {
  if (typeof data === 'string' && data.length > 10000) {
    return data.substring(0, 10000) + '... [truncated]';
  }
  return data;
}

// ===========================================
// 1C OData Client Class
// ===========================================

export class OneCClient {
  private client: AxiosInstance;
  private config: OneCConfig;
  private discoveredEntitySets: Partial<Record<OneCEntityName, string>> | null = null;
  private entityDiscoveryPromise: Promise<void> | null = null;
  
  // Caching
  private metadataCache: { data: string; timestamp: number } | null = null;
  
  // Monitoring
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

  constructor(config: OneCConfig) {
    this.config = {
      maxRetries: DEFAULT_MAX_RETRIES,
      retryDelay: DEFAULT_RETRY_DELAY,
      enableLogging: true,
      enableMonitoring: true,
      ...config,
    };
    this.client = this.createClient();
  }

  private createClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add basic auth to every request
    client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      config.headers.Authorization = `Basic ${auth}`;
      return config;
    });

    // Response interceptor for monitoring
    client.interceptors.response.use(
      (response) => {
        const config = response.config as InternalAxiosRequestConfig & { _logEntry?: ODataLogEntry };
        if (config._logEntry) {
          this.completeLogEntry(config._logEntry, response, 'success');
        }
        return response;
      },
      (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { _logEntry?: ODataLogEntry };
        if (config?._logEntry) {
          this.completeLogEntry(config._logEntry, error.response, 'error', error);
        }
        throw error;
      }
    );

    return client;
  }

  // ===========================================
  // Logging & Monitoring
  // ===========================================

  private createLogEntry(
    method: string,
    url: string,
    entitySet?: string,
    entityType?: OneCEntityName,
    requestData?: unknown
  ): ODataLogEntry {
    const entry: ODataLogEntry = {
      id: generateLogId(),
      timestamp: new Date(),
      method,
      url,
      entitySet,
      entityType,
      status: 'pending',
      requestHeaders: {},
      requestData: sanitizeForLogging(requestData),
      durationMs: 0,
    };
    
    if (this.config.enableLogging && this.config.enableMonitoring) {
      this.logs.push(entry);
      if (this.logs.length > MAX_LOGS) {
        this.logs.shift();
      }
      this.stats.recentLogs = this.logs.slice(-50);
    }
    
    return entry;
  }

  private completeLogEntry(
    entry: ODataLogEntry,
    response: AxiosResponse | undefined,
    status: RequestStatus,
    error?: AxiosError
  ): void {
    entry.status = status;
    entry.httpStatus = response?.status;
    entry.responseHeaders = response?.headers as Record<string, string> | undefined;
    entry.responseData = response?.data ? sanitizeForLogging(response.data) : undefined;
    entry.durationMs = Date.now() - entry.timestamp.getTime();
    
    if (error) {
      entry.errorMessage = error.message;
      entry.errorDetails = JSON.stringify({
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
      });
    }
    
    // Update stats
    this.stats.totalRequests++;
    if (status === 'success') {
      this.stats.successfulRequests++;
      if (response?.data) {
        this.stats.totalDataTransferred += JSON.stringify(response.data).length;
      }
    } else {
      this.stats.failedRequests++;
      const errorType = error?.response?.status ? `HTTP_${error.response.status}` : 'NETWORK_ERROR';
      this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
    }
    
    if (entry.entityType) {
      this.stats.requestsByEntity[entry.entityType] = 
        (this.stats.requestsByEntity[entry.entityType] || 0) + 1;
    }
    
    // Update average duration
    this.stats.averageDurationMs = 
      (this.stats.averageDurationMs * (this.stats.totalRequests - 1) + entry.durationMs) / 
      this.stats.totalRequests;
    
    this.stats.recentLogs = this.logs.slice(-50);
    
    // Callback
    if (this.config.onLog) {
      this.config.onLog(entry);
    }
    
    // Console logging
    if (this.config.enableLogging) {
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: ODataLogEntry): void {
    const statusIcon = entry.status === 'success' ? '✅' : entry.status === 'error' ? '❌' : '⏳';
    const duration = entry.durationMs > 0 ? `${entry.durationMs}ms` : '...';
    const status = entry.httpStatus ? `HTTP ${entry.httpStatus}` : '';
    
    console.log(
      `[${statusIcon} 1C OData] ${entry.method} ${entry.url.substring(0, 80)}${entry.url.length > 80 ? '...' : ''} ` +
      `${status} ${duration}`
    );
    
    if (entry.status === 'error' && entry.errorMessage) {
      console.error(`  Error: ${entry.errorMessage}`);
    }
  }

  getMonitoringStats(): ODataMonitoringStats {
    return { ...this.stats };
  }

  getRecentLogs(limit: number = 50): ODataLogEntry[] {
    return this.logs.slice(-limit);
  }

  clearLogs(): void {
    this.logs = [];
    this.stats.recentLogs = [];
  }

  // ===========================================
  // Retry Logic
  // ===========================================

  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    logEntry: ODataLogEntry,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.config.maxRetries ?? DEFAULT_MAX_RETRIES;
    let lastError: Error;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logEntry.retryCount = attempt - 1;
        const result = await requestFn();
        
        if (attempt > 1 && this.config.enableMonitoring) {
          this.stats.retriedRequests++;
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;
        
        // Don't retry on certain errors
        if ([401, 403, 404].includes(axiosError.response?.status || 0)) {
          logEntry.status = 'error';
          throw error;
        }
        
        if (attempt < retries) {
          const delay = calculateExponentialBackoff(attempt, this.config.retryDelay ?? DEFAULT_RETRY_DELAY);
          
          if (this.config.enableLogging) {
            console.log(
              `[🔄 1C OData] Retry ${attempt}/${retries} after ${Math.round(delay)}ms - ` +
              `URL: ${logEntry.url}, Status: ${axiosError.response?.status}`
            );
          }
          
          logEntry.status = 'retry';
          logEntry.retryCount = attempt;
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logEntry.status = 'error';
    throw lastError!;
  }

  // ===========================================
  // Metadata & EntitySet Discovery
  // ===========================================

  private buildCollectionPath(entitySet: string, params?: URLSearchParams): string {
    const query = params?.toString() || '';
    return query ? `/${entitySet}?${query}` : `/${entitySet}`;
  }

  private buildEntityPath(entitySet: string, guid: string): string {
    return `/${entitySet}(guid'${guid}')`;
  }

  private normalizeComparableName(input: string): string {
    return input.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').toLowerCase();
  }

  private async getMetadata(): Promise<string> {
    const now = Date.now();
    
    // Check cache
    if (this.metadataCache && (now - this.metadataCache.timestamp) < METADATA_CACHE_TTL) {
      return this.metadataCache.data;
    }
    
    const logEntry = this.createLogEntry('GET', '/$metadata');
    
    try {
      const response = await this.client.get<string>('/$metadata', {
        responseType: 'text',
        headers: {
          Accept: 'application/xml, text/xml, */*',
        },
      });
      
      this.metadataCache = { data: response.data, timestamp: now };
      this.completeLogEntry(logEntry, response, 'success');
      if (this.config.enableMonitoring) {
        this.stats.cachedResponses++;
      }
      
      return response.data;
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  private async discoverEntitySets(): Promise<void> {
    if (this.discoveredEntitySets) {
      return;
    }

    if (this.entityDiscoveryPromise) {
      await this.entityDiscoveryPromise;
      return;
    }

    this.entityDiscoveryPromise = (async () => {
      try {
        const metadata = await this.getMetadata();
        const entitySetRegex = /<EntitySet\b[^>]*\bName="([^"]+)"[^>]*\bEntityType="([^"]+)"/g;
        const entitySets: Array<{ name: string; entityType: string; comparable: string }> = [];
        let match: RegExpExecArray | null = entitySetRegex.exec(metadata);

        while (match) {
          const name = match[1];
          const entityType = match[2];
          entitySets.push({
            name,
            entityType,
            comparable: this.normalizeComparableName(`${name} ${entityType}`),
          });
          match = entitySetRegex.exec(metadata);
        }

        const discovered: Partial<Record<OneCEntityName, string>> = {};
        for (const entityName of Object.keys(DEFAULT_ENTITY_SETS) as OneCEntityName[]) {
          const patterns = ENTITY_DISCOVERY_PATTERNS[entityName];
          const found = entitySets.find((candidate) => {
            if (entityName === 'products') {
              const hasCatalogOrProducts = /catalog/i.test(candidate.comparable) || /products?/i.test(candidate.comparable);
              const hasProductCore = /номенклатур/i.test(candidate.comparable) || /products?/i.test(candidate.comparable);
              const hasWrongMarkers = /image|изображ|картин|group|груп|price|цен|stock|остат|резерв|accumulationregister|informationregister|document/.test(candidate.comparable);
              if (hasCatalogOrProducts && hasProductCore && !hasWrongMarkers) {
                return true;
              }
            }

            if (entityName === 'productGroups') {
              const hasGroupMarker = /group|груп/.test(candidate.comparable);
              const hasProductMarker = /product|номенклатур/.test(candidate.comparable);
              if (hasGroupMarker && hasProductMarker) {
                return true;
              }
            }

            return patterns.some((pattern) => pattern.test(candidate.comparable));
          });
          if (found) {
            discovered[entityName] = found.name;
          }
        }

        this.discoveredEntitySets = discovered;
      } catch {
        this.discoveredEntitySets = {};
      }
    })();

    await this.entityDiscoveryPromise;
  }

  private async resolveEntitySet(entityName: OneCEntityName): Promise<string> {
    const explicit = this.config.entitySets?.[entityName];
    if (explicit && explicit.trim().length > 0) {
      return explicit.trim();
    }

    // If no explicit entitySets provided in config, use defaults directly
    // without auto-discovery to avoid incorrect matches
    if (!this.config.entitySets || Object.keys(this.config.entitySets).length === 0) {
      return DEFAULT_ENTITY_SETS[entityName];
    }

    // Only try auto-discovery if some entitySets are provided but not this one
    await this.discoverEntitySets();
    const discovered = this.discoveredEntitySets?.[entityName];
    if (discovered && discovered.trim().length > 0) {
      return discovered.trim();
    }

    if (entityName === 'productGroups') {
      return this.resolveEntitySet('products');
    }

    return DEFAULT_ENTITY_SETS[entityName];
  }

  async getResolvedEntitySets(): Promise<Record<OneCEntityName, string>> {
    await this.discoverEntitySets();

    const resolved: Partial<Record<OneCEntityName, string>> = {};
    for (const entityName of Object.keys(DEFAULT_ENTITY_SETS) as OneCEntityName[]) {
      resolved[entityName] = await this.resolveEntitySet(entityName);
    }

    return resolved as Record<OneCEntityName, string>;
  }

  // ===========================================
  // Products
  // ===========================================

  async getProducts(options?: GetProductsOptions): Promise<OneCProduct[]> {
    const params = new URLSearchParams();
    const filters: string[] = [];
    const productsEntitySet = await this.resolveEntitySet('products');
    const groupsEntitySet = await this.resolveEntitySet('productGroups');

    if (options?.limit) {
      params.set('$top', options.limit.toString());
    }
    if (options?.offset) {
      params.set('$skip', options.offset.toString());
    }
    if (options?.modifiedSince) {
      filters.push(`ModifiedDateTime gt datetime'${options.modifiedSince}'`);
    }
    if (options?.select?.length) {
      params.set('$select', options.select.join(','));
    }
    if (productsEntitySet === groupsEntitySet) {
      // Используем русское имя поля ЭтоПапка для 1С
      filters.push('ЭтоПапка eq false');
    }
    if (filters.length > 0) {
      params.set('$filter', filters.join(' and '));
    }

    const url = this.buildCollectionPath(productsEntitySet, params);
    const logEntry = this.createLogEntry('GET', url, productsEntitySet, 'products');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCProduct>>(url),
        logEntry
      );

      // Маппинг русских полей в английские для товаров
      return response.data.value.map(product => ({
        ...product,
        Ref_Key: product.Ref_Key || (product as any)['Код'] || (product as any)['Ссылка_Key'],
        Code: product.Code || (product as any)['Артикул'] || (product as any)['Код'],
        Description: product.Description || (product as any)['Наименование'] || (product as any)['Описание'],
        Parent_Key: product.Parent_Key || (product as any)['Родитель_Key'],
        BaseUnit_Key: product.BaseUnit_Key || (product as any)['БазоваяЕдиница_Key'],
      }));
    } catch (error) {
      if (
        productsEntitySet === groupsEntitySet &&
        (error as AxiosError).response?.status === 400
      ) {
        const retryParams = new URLSearchParams(params);
        const currentFilter = retryParams.get('$filter');
        if (currentFilter) {
          // Исправляем русские имена полей
          const nextFilter = currentFilter
            .replace(/\s*and\s*ЭтоПапка\s*eq\s*false/i, '')
            .replace(/ЭтоПапка\s*eq\s*false\s*and\s*/i, '')
            .replace(/ЭтоПапка\s*eq\s*false/i, '')
            .replace(/\s*and\s*IsFolder\s*eq\s*false/i, '')
            .replace(/IsFolder\s*eq\s*false\s*and\s*/i, '')
            .replace(/IsFolder\s*eq\s*false/i, '')
            .trim();
          if (nextFilter) {
            retryParams.set('$filter', nextFilter);
          } else {
            retryParams.delete('$filter');
          }
        }

        const retryResponse = await this.requestWithRetry(
          () => this.client.get<ODataResponse<OneCProduct>>(
            this.buildCollectionPath(productsEntitySet, retryParams)
          ),
          logEntry
        );

        const items = retryResponse.data.value as Array<OneCProduct & { ЭтоПапка?: boolean; IsFolder?: boolean }>;
        // Фильтруем папки по русскому или английскому полю
        return items.filter((item) => (item.ЭтоПапка !== true && item.IsFolder !== true));
      }
      throw error;
    }
  }

  async getProduct(guid: string): Promise<OneCProduct | null> {
    try {
      const entitySet = await this.resolveEntitySet('products');
      const url = this.buildEntityPath(entitySet, guid);
      const logEntry = this.createLogEntry('GET', url, entitySet, 'products');
      
      const response = await this.requestWithRetry(
        () => this.client.get<OneCProduct>(url),
        logEntry
      );
      
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getProductByArticle(article: string): Promise<OneCProduct | null> {
    try {
      const entitySet = await this.resolveEntitySet('products');
      const url = `/${entitySet}?$filter=Code eq '${article}'`;
      const logEntry = this.createLogEntry('GET', url, entitySet, 'products');
      
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCProduct>>(url),
        logEntry
      );
      
      return response.data.value[0] || null;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ===========================================
  // Product Groups
  // ===========================================

  async getProductGroups(options?: GetProductGroupsOptions): Promise<OneCProductGroup[]> {
    const params = new URLSearchParams();
    const filters: string[] = [];
    const productsEntitySet = await this.resolveEntitySet('products');

    if (options?.limit) {
      params.set('$top', options.limit.toString());
    }
    if (options?.offset) {
      params.set('$skip', options.offset.toString());
    }
    if (options?.modifiedSince) {
      filters.push(`ModifiedDateTime gt datetime'${options.modifiedSince}'`);
    }

    const entitySet = await this.resolveEntitySet('productGroups');
    if (entitySet === productsEntitySet) {
      // Используем русское имя поля ЭтоПапка для 1С
      filters.push('ЭтоПапка eq true');
    }
    if (filters.length > 0) {
      params.set('$filter', filters.join(' and '));
    }

    const url = this.buildCollectionPath(entitySet, params);
    const logEntry = this.createLogEntry('GET', url, entitySet, 'productGroups');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCProductGroup>>(url),
        logEntry
      );

      // Маппинг русских полей в английские для групп товаров
      return response.data.value.map(group => ({
        ...group,
        Ref_Key: group.Ref_Key || (group as any)['Код'] || (group as any)['Ссылка_Key'],
        Code: group.Code || (group as any)['Артикул'] || (group as any)['Код'],
        Description: group.Description || (group as any)['Наименование'] || (group as any)['Описание'],
        Parent_Key: group.Parent_Key || (group as any)['Родитель_Key'],
      }));
    } catch (error) {
      if (
        entitySet === productsEntitySet &&
        (error as AxiosError).response?.status === 400
      ) {
        const retryParams = new URLSearchParams(params);
        const currentFilter = retryParams.get('$filter');
        if (currentFilter) {
          // Исправляем русские имена полей
          const nextFilter = currentFilter
            .replace(/\s*and\s*ЭтоПапка\s*eq\s*true/i, '')
            .replace(/ЭтоПапка\s*eq\s*true\s*and\s*/i, '')
            .replace(/ЭтоПапка\s*eq\s*true/i, '')
            .replace(/\s*and\s*IsFolder\s*eq\s*true/i, '')
            .replace(/IsFolder\s*eq\s*true\s*and\s*/i, '')
            .replace(/IsFolder\s*eq\s*true/i, '')
            .trim();
          if (nextFilter) {
            retryParams.set('$filter', nextFilter);
          } else {
            retryParams.delete('$filter');
          }
        }

        const retryResponse = await this.requestWithRetry(
          () => this.client.get<ODataResponse<OneCProductGroup>>(
            this.buildCollectionPath(entitySet, retryParams),

          ),
          logEntry
        );

        this.completeLogEntry(logEntry, retryResponse, 'success');
        const items = retryResponse.data.value as Array<OneCProductGroup & { ЭтоПапка?: boolean; IsFolder?: boolean }>;
        // Фильтруем только папки по русскому или английскому полю
        if (items.some((item) => typeof item.ЭтоПапка === 'boolean' || typeof item.IsFolder === 'boolean')) {
          return items.filter((item) => (item.ЭтоПапка === true || item.IsFolder === true));
        }
        return [];
      }
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  // ===========================================
  // Warehouses
  // ===========================================

  async getWarehouses(options?: {
    limit?: number;
    offset?: number;
  }): Promise<OneCWarehouse[]> {
    const params = new URLSearchParams();

    if (options?.limit) {
      params.set('$top', options.limit.toString());
    }
    if (options?.offset) {
      params.set('$skip', options.offset.toString());
    }

    const entitySet = await this.resolveEntitySet('warehouses');
    const url = this.buildCollectionPath(entitySet, params);
    const logEntry = this.createLogEntry('GET', url, entitySet, 'warehouses');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCWarehouse>>(url),
        logEntry
      );

      this.completeLogEntry(logEntry, response, 'success');

      // Маппинг русских полей
      return response.data.value.map(warehouse => ({
        ...warehouse,
        Ref_Key: warehouse.Ref_Key || (warehouse as any)['Ссылка_Key'],
        Code: warehouse.Code || (warehouse as any)['Код'],
        Description: warehouse.Description || (warehouse as any)['Наименование'],
        Parent_Key: warehouse.Parent_Key || (warehouse as any)['Родитель_Key'],
      }));
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  // ===========================================
  // Prices
  // ===========================================

  async getPrices(options?: {
    priceType?: string;
    productGuid?: string;
    modifiedSince?: string;
    top?: number;
  }): Promise<OneCPrice[]> {
    const params = new URLSearchParams();
    const filters: string[] = [];

    if (options?.priceType) {
      filters.push(`ВидЦены_Key eq guid'${options.priceType}'`);
    }
    if (options?.productGuid) {
      filters.push(`Номенклатура_Key eq guid'${options.productGuid}'`);
    }
    if (options?.modifiedSince) {
      filters.push(`Period gt datetime'${options.modifiedSince}'`);
    }

    if (filters.length > 0) {
      params.set('$filter', filters.join(' and '));
    }
    
    if (options?.top) {
      params.set('$top', options.top.toString());
    }

    params.set('$format', 'json');

    const entitySet = await this.resolveEntitySet('prices');
    const url = this.buildCollectionPath(entitySet, params);
    const logEntry = this.createLogEntry('GET', url, entitySet, 'prices');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<any>>(url),
        logEntry
      );
      
      this.completeLogEntry(logEntry, response, 'success');
      
      const rawValues = response.data.value || [];
      const allPrices: OneCPrice[] = [];
      
      for (const item of rawValues) {
        // Handle nested RecordSet if present (as in user's example)
        if (item.RecordSet && Array.isArray(item.RecordSet)) {
          for (const record of item.RecordSet) {
            allPrices.push({
              PriceType_Key: record.ВидЦены_Key || record.PriceType_Key,
              Currency_Key: record.Валюта_Key || record.Currency_Key,
              Price: Number(record.Цена || record.Price || 0),
              Product_Key: record.Номенклатура_Key || record.Product_Key,
            });
          }
        } else {
          // Handle direct records
          allPrices.push({
            PriceType_Key: item.ВидЦены_Key || item.PriceType_Key,
            Currency_Key: item.Валюта_Key || item.Currency_Key,
            Price: Number(item.Цена || item.Price || 0),
            Product_Key: item.Номенклатура_Key || item.Product_Key,
          });
        }
      }
      
      return allPrices;
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  // ===========================================
  // Stock Levels
  // ===========================================

  async getStocks(options?: {
    warehouseGuid?: string;
    productGuid?: string;
    modifiedSince?: string;
  }): Promise<OneCStock[]> {
    const params = new URLSearchParams();
    const filters: string[] = [];

    // Используем виртуальную таблицу остатков для 1С УТ 11.5
    // BalanceAndTurnovers возвращает ВНаличииClosingBalance, КОтгрузкеClosingBalance и т.д.
    const entitySet = await this.resolveEntitySet('stocks');
    
    // Для виртуальной таблицы BalanceAndTurnovers используем специальный формат
    // Dimensions='Номенклатура,Склад' - группировка по товарам и складам
    const virtualTableUrl = `${entitySet}/BalanceAndTurnovers(Dimensions='Номенклатура,Склад')`;
    
    if (options?.warehouseGuid) {
      filters.push(`Склад_Key eq guid'${options.warehouseGuid}'`);
    }
    if (options?.productGuid) {
      filters.push(`Номенклатура_Key eq guid'${options.productGuid}'`);
    }
    if (options?.modifiedSince) {
      filters.push(`ModifiedDateTime gt datetime'${options.modifiedSince}'`);
    }

    if (filters.length > 0) {
      params.set('$filter', filters.join(' and '));
    }
    params.set('$format', 'json');

    const queryString = params.toString();
    const url = queryString ? `${virtualTableUrl}?${queryString}` : virtualTableUrl;
    
    const logEntry = this.createLogEntry('GET', url, entitySet, 'stocks');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCStock>>(url),
        logEntry
      );

      this.completeLogEntry(logEntry, response, 'success');

      // Маппинг полей из виртуальной таблицы BalanceAndTurnovers
      // 1С УТ 11.5: Номенклатура_Key, Склад_Key, ВНаличииClosingBalance
      return (response.data.value || []).map(stock => ({
        ...stock,
        Warehouse_Key: (stock as any)['Склад_Key'] || stock.Warehouse_Key,
        Product_Key: (stock as any)['Номенклатура_Key'] || stock.Product_Key,
        Quantity: (stock as any)['ВНаличииClosingBalance'] || (stock as any)['ВНаличии'] || stock.Quantity || 0,
        Reserved: (stock as any)['КОтгрузкеClosingBalance'] || (stock as any)['КОтгрузке'] || 0,
        Unit_Key: stock.Unit_Key || (stock as any)['Единица_Key'],
      }));
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  // ===========================================
  // Partners
  // ===========================================

  async getPartners(options?: {
    limit?: number;
    offset?: number;
    inn?: string;
    modifiedSince?: string;
  }): Promise<OneCPartner[]> {
    const buildParams = (orderbyField: string) => {
      const params = new URLSearchParams();
      const filters: string[] = [];

      if (options?.inn) {
        // Используем русское имя поля ИНН для 1С
        filters.push(`ИНН eq '${options.inn}'`);
      }
      if (options?.modifiedSince) {
        filters.push(`ModifiedDateTime gt datetime'${options.modifiedSince}'`);
      }

      if (filters.length > 0) {
        params.set('$filter', filters.join(' and '));
      }
      if (options?.limit) {
        params.set('$top', options.limit.toString());
      }
      if (typeof options?.offset === 'number' && options.offset > 0) {
        params.set('$skip', options.offset.toString());
      }
      params.set('$orderby', orderbyField);
      params.set('$format', 'json');
      return params;
    };

    const entitySet = await this.resolveEntitySet('partners');
    const urlPrimary = this.buildCollectionPath(entitySet, buildParams('Ref_Key'));
    const urlFallback = this.buildCollectionPath(entitySet, buildParams('Ссылка_Key'));
    const logEntry = this.createLogEntry('GET', urlPrimary, entitySet, 'partners');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCPartner>>(urlPrimary),
        logEntry
      );

      this.completeLogEntry(logEntry, response, 'success');
      
      // Маппинг русских полей в английские
      return response.data.value.map(partner => ({
        ...partner,
        INN: partner.INN || (partner as any)['ИНН'],
        KPP: partner.KPP || (partner as any)['КПП'],
        Phone: partner.Phone || (partner as any)['НомерТелефона'],
        FullName: partner.FullName || (partner as any)['НаименованиеСокращенное'] || (partner as any)['НаименованиеПолное'],
        Address: partner.Address || (partner as any)['АдресЮр'] || (partner as any)['АдресПочт'],
        Email: partner.Email || (partner as any)['Email'] || (partner as any)['АдресЭП'],
        ContactPerson_Key: partner.ContactPerson_Key || (partner as any)['КонтактноеЛицо'],
      }));
    } catch (error) {
      // Fallback with Russian order field
      const logEntryFallback = this.createLogEntry('GET', urlFallback, entitySet, 'partners');
      try {
        const response = await this.requestWithRetry(
          () => this.client.get<ODataResponse<OneCPartner>>(urlFallback),
          logEntryFallback
        );
        this.completeLogEntry(logEntryFallback, response, 'success');
        return response.data.value.map(partner => ({
          ...partner,
          INN: partner.INN || (partner as any)['ИНН'],
          KPP: partner.KPP || (partner as any)['КПП'],
          Phone: partner.Phone || (partner as any)['НомерТелефона'],
          FullName: partner.FullName || (partner as any)['НаименованиеСокращенное'] || (partner as any)['НаименованиеПолное'],
          Address: partner.Address || (partner as any)['АдресЮр'] || (partner as any)['АдресПочт'],
          Email: partner.Email || (partner as any)['Email'] || (partner as any)['АдресЭП'],
          ContactPerson_Key: partner.ContactPerson_Key || (partner as any)['КонтактноеЛицо'],
        }));
      } catch (err2) {
        this.completeLogEntry(logEntryFallback, (err2 as AxiosError).response, 'error', err2 as AxiosError);
        throw err2;
      }
    }
  }

  async getPartnerByInn(inn: string): Promise<OneCPartner | null> {
    const partners = await this.getPartners({ inn, limit: 1 });
    return partners[0] || null;
  }

  async getPartner(guid: string): Promise<OneCPartner | null> {
    try {
      const entitySet = await this.resolveEntitySet('partners');
      const url = this.buildEntityPath(entitySet, guid);
      const logEntry = this.createLogEntry('GET', url, entitySet, 'partners');
      
      const response = await this.requestWithRetry(
        () => this.client.get<OneCPartner>(url),
        logEntry
      );
      
      this.completeLogEntry(logEntry, response, 'success');
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ===========================================
  // Orders (Sales Orders)
  // ===========================================

  async createOrder(order: {
    partnerGuid: string;
    items: Array<{
      productGuid: string;
      quantity: number;
      price: number;
    }>;
    deliveryAddress?: string;
    deliveryDate?: string;
    comment?: string;
  }): Promise<OneCOrder> {
    const payload = {
      Partner_Key: `guid'${order.partnerGuid}'`,
      OrderDate: order.deliveryDate || new Date().toISOString(),
      DeliveryAddress: order.deliveryAddress,
      Comment: order.comment,
      TotalAmount: order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      Items: order.items.map(item => ({
        Product_Key: `guid'${item.productGuid}'`,
        Quantity: item.quantity,
        Price: item.price,
        Total: item.price * item.quantity,
      })),
    };

    const entitySet = await this.resolveEntitySet('orders');
    const url = `/${entitySet}`;
    const logEntry = this.createLogEntry('POST', url, entitySet, 'orders', payload);

    try {
      const response = await this.requestWithRetry(
        () => this.client.post<OneCOrder>(url, payload),
        logEntry
      );
      
      this.completeLogEntry(logEntry, response, 'success');
      return response.data;
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  async getOrders(options?: {
    partnerGuid?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    top?: number;
  }): Promise<OneCOrder[]> {
    const params = new URLSearchParams();
    const filters: string[] = [];

    if (options?.partnerGuid) {
      filters.push(`Partner_Key eq guid'${options.partnerGuid}'`);
    }
    if (options?.status) {
      filters.push(`Status eq '${options.status}'`);
    }
    if (options?.fromDate) {
      filters.push(`Date ge datetime'${options.fromDate}'`);
    }
    if (options?.toDate) {
      filters.push(`Date le datetime'${options.toDate}'`);
    }

    if (filters.length > 0) {
      params.set('$filter', filters.join(' and '));
    }
    params.set('$orderby', 'Date desc');
    if (options?.top) {
      params.set('$top', options.top.toString());
    }
    params.set('$format', 'json');

    const entitySet = await this.resolveEntitySet('orders');
    const url = this.buildCollectionPath(entitySet, params);
    const logEntry = this.createLogEntry('GET', url, entitySet, 'orders');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCOrder>>(url),
        logEntry
      );
      
      this.completeLogEntry(logEntry, response, 'success');
      return response.data.value;
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  async getOrder(guid: string): Promise<OneCOrder | null> {
    try {
      const entitySet = await this.resolveEntitySet('orders');
      const url = this.buildEntityPath(entitySet, guid);
      const logEntry = this.createLogEntry('GET', url, entitySet, 'orders');
      
      const response = await this.requestWithRetry(
        () => this.client.get<OneCOrder>(url),
        logEntry
      );
      
      this.completeLogEntry(logEntry, response, 'success');
      return response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ===========================================
  // Realizations (Shipments)
  // ===========================================

  async getRealizations(options?: {
    partnerGuid?: string;
    orderGuid?: string;
    fromDate?: string;
    toDate?: string;
    top?: number;
  }): Promise<OneCRealization[]> {
    const params = new URLSearchParams();
    const filters: string[] = [];

    if (options?.partnerGuid) {
      filters.push(`Partner_Key eq guid'${options.partnerGuid}'`);
    }
    if (options?.orderGuid) {
      filters.push(`Order_Key eq guid'${options.orderGuid}'`);
    }
    if (options?.fromDate) {
      filters.push(`Date ge datetime'${options.fromDate}'`);
    }
    if (options?.toDate) {
      filters.push(`Date le datetime'${options.toDate}'`);
    }

    if (filters.length > 0) {
      params.set('$filter', filters.join(' and '));
    }
    params.set('$orderby', 'Date desc');
    if (options?.top) {
      params.set('$top', options.top.toString());
    }
    params.set('$format', 'json');

    const entitySet = await this.resolveEntitySet('realizations');
    const url = this.buildCollectionPath(entitySet, params);
    const logEntry = this.createLogEntry('GET', url, entitySet, 'realizations');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCRealization>>(url),
        logEntry
      );
      
      this.completeLogEntry(logEntry, response, 'success');
      return response.data.value;
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      throw error;
    }
  }

  // ===========================================
  // Product Images
  // ===========================================

  async getProductImages(productGuid?: string): Promise<OneCProductImage[]> {
    const entitySet = await this.resolveEntitySet('productImages');
    const buildUrlWithFilter = (field: string) => {
      const p = new URLSearchParams();
      if (productGuid) {
        p.set('$filter', `${field} eq guid'${productGuid}'`);
      }
      return this.buildCollectionPath(entitySet, p);
    };
    // Try English field first, then Russian fallback
    const urlPrimary = buildUrlWithFilter('Product_Key');
    const urlFallback = buildUrlWithFilter('Номенклатура_Key');
    const logEntry = this.createLogEntry('GET', urlPrimary, entitySet, 'productImages');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get<ODataResponse<OneCProductImage>>(urlPrimary),
        logEntry
      );
      this.completeLogEntry(logEntry, response, 'success');
      return response.data.value;
    } catch (error) {
      // Fallback attempt with Russian field name
      const logEntryFallback = this.createLogEntry('GET', urlFallback, entitySet, 'productImages');
      try {
        const response = await this.requestWithRetry(
          () => this.client.get<ODataResponse<OneCProductImage>>(urlFallback),
          logEntryFallback
        );
        this.completeLogEntry(logEntryFallback, response, 'success');
        return response.data.value;
      } catch (err2) {
        this.completeLogEntry(logEntryFallback, (err2 as AxiosError).response, 'error', err2 as AxiosError);
        throw err2;
      }
    }
  }

  async downloadImage(imageGuid: string): Promise<{
    data: Buffer;
    contentType: string;
    filename: string;
  }> {
    const entitySet = await this.resolveEntitySet('productImages');
    const url = `${this.buildEntityPath(entitySet, imageGuid)}/Data`;
    const logEntry = this.createLogEntry('GET', url, entitySet, 'productImages');

    try {
      const response = await this.requestWithRetry(
        () => this.client.get(url, {
          responseType: 'arraybuffer',
        }),
        logEntry
      );

      return {
        data: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'image/jpeg',
        filename: response.headers['content-disposition']?.split('filename=')[1] || `${imageGuid}.jpg`,
      };
    } catch (error) {
      throw error;
    }
  }

  // ===========================================
  // Health Check
  // ===========================================

  async healthCheck(): Promise<boolean> {
    const logEntry = this.createLogEntry('GET', '/$metadata');
    
    try {
      await this.client.get('/$metadata');
      this.completeLogEntry(logEntry, undefined, 'success');
      return true;
    } catch (error) {
      this.completeLogEntry(logEntry, (error as AxiosError).response, 'error', error as AxiosError);
      return false;
    }
  }

  // ===========================================
  // Batch Operations with Pagination
  // ===========================================

  async syncProducts(
    callback: (products: OneCProduct[]) => Promise<void>,
    batchSize: number = 100
  ): Promise<SyncResult> {
    const errors: SyncError[] = [];
    let processed = 0;
    let failed = 0;
    let offset = 0;

    try {
      while (true) {
        const products = await this.getProducts({
          limit: batchSize,
          offset,
        });

        if (products.length === 0) break;

        try {
          await callback(products);
          processed += products.length;
        } catch (error) {
          failed += products.length;
          errors.push({
            entity: 'products',
            guid: 'batch',
            error: (error as Error).message,
          });
        }

        offset += batchSize;
        
        // Stop if we got fewer items than requested (last page)
        if (products.length < batchSize) break;
      }

      return { success: failed === 0, processed, failed, errors };
    } catch (error) {
      return { 
        success: false, 
        processed, 
        failed: failed + 1, 
        errors: [...errors, { entity: 'products', guid: 'sync', error: (error as Error).message }] 
      };
    }
  }

  async syncPartners(
    callback: (partners: OneCPartner[]) => Promise<void>,
    batchSize: number = 100
  ): Promise<SyncResult> {
    const errors: SyncError[] = [];
    let processed = 0;
    let failed = 0;
    let offset = 0;

    try {
      while (true) {
        const partners = await this.getPartners({
          limit: batchSize,
          offset,
        });

        if (partners.length === 0) break;

        try {
          await callback(partners);
          processed += partners.length;
        } catch (error) {
          failed += partners.length;
          errors.push({
            entity: 'partners',
            guid: 'batch',
            error: (error as Error).message,
          });
        }

        offset += batchSize;
        if (partners.length < batchSize) break;
      }

      return { success: failed === 0, processed, failed, errors };
    } catch (error) {
      return { 
        success: false, 
        processed, 
        failed: failed + 1, 
        errors: [...errors, { entity: 'partners', guid: 'sync', error: (error as Error).message }] 
      };
    }
  }

  // ===========================================
  // Pagination Helpers
  // ===========================================

  async getAllProducts(options?: {
    modifiedSince?: string;
    select?: string[];
    batchSize?: number;
  }): Promise<OneCProduct[]> {
    const batchSize = options?.batchSize || 1000;
    const allProducts: OneCProduct[] = [];
    let offset = 0;

    while (true) {
      const products = await this.getProducts({
        limit: batchSize,
        offset,
        modifiedSince: options?.modifiedSince,
        select: options?.select,
      });

      allProducts.push(...products);

      if (products.length < batchSize) break;
      offset += batchSize;
    }

    return allProducts;
  }

  async getAllProductGroups(options?: {
    modifiedSince?: string;
    batchSize?: number;
  }): Promise<OneCProductGroup[]> {
    const batchSize = options?.batchSize || 1000;
    const allGroups: OneCProductGroup[] = [];
    let offset = 0;

    while (true) {
      const groups = await this.getProductGroups({
        limit: batchSize,
        offset,
        modifiedSince: options?.modifiedSince,
      });

      allGroups.push(...groups);

      if (groups.length < batchSize) break;
      offset += batchSize;
    }

    return allGroups;
  }

  async getAllPartners(options?: {
    modifiedSince?: string;
    batchSize?: number;
  }): Promise<OneCPartner[]> {
    const batchSize = options?.batchSize || 1000;
    const allPartners: OneCPartner[] = [];
    let offset = 0;

    while (true) {
      const partners = await this.getPartners({
        limit: batchSize,
        offset,
        modifiedSince: options?.modifiedSince,
      });

      allPartners.push(...partners);

      if (partners.length < batchSize) break;
      offset += batchSize;
    }

    return allPartners;
  }

  async getAllStocks(options?: {
    warehouseGuid?: string;
    modifiedSince?: string;
    batchSize?: number;
  }): Promise<OneCStock[]> {
    const batchSize = options?.batchSize || 1000;
    const allStocks: OneCStock[] = [];
    let offset = 0;

    while (true) {
      const stocks = await this.getStocks({
        warehouseGuid: options?.warehouseGuid,
        modifiedSince: options?.modifiedSince,
      });

      allStocks.push(...stocks);

      if (stocks.length < batchSize) break;
      offset += batchSize;
    }

    return allStocks;
  }
}
