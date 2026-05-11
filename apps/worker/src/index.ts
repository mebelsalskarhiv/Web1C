/**
 * Web1C Background Worker
 *
 * Handles background synchronization tasks with 1C:UT 11.5
 * Uses BullMQ for job queue management
 * 
 * Enhanced with:
 * - Pagination support
 * - Retry logic
 * - Detailed logging
 * - Monitoring integration
 */

import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { OneCClient } from '@web1c/onec-client';
import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.join(__dirname, '../../web/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = { url: redisUrl };
const prisma = new PrismaClient();

// Job types
type JobType = 
  | 'sync-products'
  | 'sync-partners'
  | 'sync-orders'
  | 'sync-stocks'
  | 'sync-prices'
  | 'sync-images'
  | 'full-sync';

interface JobData {
  type: JobType;
  sessionId?: number;
  modifiedSince?: string;
  batch?: number;
}

// Create queues
const syncQueue = new Queue('sync-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Sync worker
const syncWorker = new Worker('sync-queue', async (job: Job<JobData>) => {
  const { type, sessionId, modifiedSince } = job.data;
  
  console.log(`[${job.id}] Starting job: ${type}`, { sessionId, modifiedSince });

  try {
    // Update session status
    if (sessionId) {
      await prisma.syncSession.update({
        where: { id: sessionId },
        data: { status: 'in_progress', startedAt: new Date() },
      });
    }

    // Get 1C settings
    const settings = await get1CSettings();
    const oneCClient = new OneCClient({
      baseUrl: settings.onecUrl,
      username: settings.onecUser,
      password: settings.onecPassword,
    });

    let result: SyncResult;

    switch (type) {
      case 'sync-products':
        result = await syncProducts(oneCClient, sessionId, modifiedSince);
        break;
      case 'sync-partners':
        result = await syncPartners(oneCClient, sessionId, modifiedSince);
        break;
      case 'sync-orders':
        result = await syncOrders(oneCClient, sessionId, modifiedSince);
        break;
      case 'sync-stocks':
        result = await syncStocks(oneCClient, sessionId, modifiedSince);
        break;
      case 'sync-prices':
        result = await syncPrices(oneCClient, sessionId, modifiedSince);
        break;
      case 'sync-images':
        result = await syncImages(oneCClient, sessionId);
        break;
      case 'full-sync':
        result = await fullSync(oneCClient, sessionId);
        break;
      default:
        throw new Error(`Unknown job type: ${type}`);
    }

    // Update session as completed
    if (sessionId) {
      await prisma.syncSession.update({
        where: { id: sessionId },
        data: {
          status: result.success ? 'completed' : 'partial',
          completedAt: new Date(),
          itemsProcessed: result.processed,
          itemsFailed: result.failed,
        },
      });
    }

    console.log(`[${job.id}] Job completed: ${type}`, result);
    return result;

  } catch (error) {
    console.error(`[${job.id}] Job failed: ${type}`, error);

    if (sessionId) {
      await prisma.syncSession.update({
        where: { id: sessionId },
        data: {
          status: 'failed',
          errorMessage: (error as Error).message,
          completedAt: new Date(),
        },
      });
    }

    throw error;
  }
}, {
  connection: redisConnection,
  concurrency: 2, // Process 2 jobs concurrently
});

// Sync products with pagination support
async function syncProducts(
  client: OneCClient,
  sessionId?: number,
  modifiedSince?: string
): Promise<SyncResult> {
  const lastSync = await prisma.syncSession.findFirst({
    where: { syncType: 'sync-products', status: 'completed' },
    orderBy: { completedAt: 'desc' },
  });

  const effectiveModifiedSince = modifiedSince || lastSync?.completedAt?.toISOString();

  const result: SyncResult = { success: true, processed: 0, failed: 0, errors: [] };
  const batchSize = 500;

  console.log(`[Sync] Starting products sync (batch size: ${batchSize})`);

  // Sync product groups first with pagination
  let groupOffset = 0;
  while (true) {
    const groups = await client.getProductGroups({ 
      limit: batchSize, 
      offset: groupOffset,
      modifiedSince: effectiveModifiedSince 
    });

    if (groups.length === 0) break;

    for (const group of groups) {
      try {
        await prisma.productGroup.upsert({
          where: { guid1c: group.Ref_Key },
          create: {
            guid1c: group.Ref_Key,
            name1c: group.Description,
            parentId: group.Parent_Key ? await findGroupIdByGuid(group.Parent_Key) : null,
            depth: 0,
          },
          update: {
            name1c: group.Description,
          },
        });

        await logSync(sessionId, 'product_groups', group.Ref_Key, 'update', 'completed');
        result.processed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          entity: 'product_group',
          guid: group.Ref_Key,
          error: (error as Error).message,
        });
        await logSync(sessionId, 'product_groups', group.Ref_Key, 'update', 'failed', (error as Error).message);
      }
    }

    console.log(`[Sync] Processed ${groups.length} groups (offset: ${groupOffset})`);
    
    if (groups.length < batchSize) break;
    groupOffset += batchSize;
  }

  // Sync products with pagination
  let productOffset = 0;
  while (true) {
    const products = await client.getProducts({ 
      limit: batchSize, 
      offset: productOffset,
      modifiedSince: effectiveModifiedSince 
    });

    if (products.length === 0) break;

    for (const product of products) {
      try {
        await prisma.product.upsert({
          where: { guid1c: product.Ref_Key },
          create: {
            guid1c: product.Ref_Key,
            article: product.Code,
            name: product.Description,
            groupId: product.Parent_Key ? await findGroupIdByGuid(product.Parent_Key) : null,
            baseUnit1c: product.BaseUnit_Key,
            isService: product.IsService || false,
            isMarked: product.IsMarked || false,
            isActive: !(product.IsMarked || false),
            lastSyncAt: new Date(),
          },
          update: {
            article: product.Code,
            name: product.Description,
            isMarked: product.IsMarked || false,
            isActive: !(product.IsMarked || false),
            lastSyncAt: new Date(),
          },
        });

        await logSync(sessionId, 'products', product.Ref_Key, 'update', 'completed');
        result.processed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          entity: 'product',
          guid: product.Ref_Key,
          error: (error as Error).message,
        });
        await logSync(sessionId, 'products', product.Ref_Key, 'update', 'failed', (error as Error).message);
      }
    }

    console.log(`[Sync] Processed ${products.length} products (offset: ${productOffset})`);
    
    if (products.length < batchSize) break;
    productOffset += batchSize;
  }

  console.log(`[Sync] Products sync completed: ${result.processed} processed, ${result.failed} failed`);
  return result;
}

// Sync partners with pagination support
async function syncPartners(
  client: OneCClient,
  sessionId?: number,
  modifiedSince?: string
): Promise<SyncResult> {
  const result: SyncResult = { success: true, processed: 0, failed: 0, errors: [] };
  const batchSize = 500;

  console.log(`[Sync] Starting partners sync (batch size: ${batchSize})`);

  let offset = 0;
  while (true) {
    const partners = await client.getPartners({ 
      limit: batchSize, 
      offset,
      modifiedSince 
    });

    if (partners.length === 0) break;

    for (const partner of partners) {
      try {
        await prisma.partner.upsert({
          where: { guid1c: partner.Ref_Key },
          create: {
            guid1c: partner.Ref_Key,
            inn: partner.INN,
            kpp: partner.KPP,
            nameFull: partner.Description,
            nameShort: partner.FullName,
            addressLegal: partner.Address,
            phoneMain: partner.Phone,
            email: partner.Email,
            lastSyncAt: new Date(),
          },
          update: {
            inn: partner.INN,
            kpp: partner.KPP,
            nameFull: partner.Description,
            lastSyncAt: new Date(),
          },
        });

        await logSync(sessionId, 'partners', partner.Ref_Key, 'update', 'completed');
        result.processed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          entity: 'partner',
          guid: partner.Ref_Key,
          error: (error as Error).message,
        });
        await logSync(sessionId, 'partners', partner.Ref_Key, 'update', 'failed', (error as Error).message);
      }
    }

    console.log(`[Sync] Processed ${partners.length} partners (offset: ${offset})`);
    
    if (partners.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`[Sync] Partners sync completed: ${result.processed} processed, ${result.failed} failed`);
  return result;
}

// Sync stocks
async function syncStocks(
  client: OneCClient,
  sessionId?: number,
  modifiedSince?: string
): Promise<SyncResult> {
  const result: SyncResult = { success: true, processed: 0, failed: 0, errors: [] };

  const stocks = await client.getStocks({ modifiedSince });

  for (const stock of stocks) {
    try {
      const product = await prisma.product.findUnique({
        where: { guid1c: stock.Product_Key },
      });

      if (product) {
        await prisma.productStock.upsert({
          where: {
            productId_warehouseGuid1c_priceType: {
              productId: product.id,
              warehouseGuid1c: stock.Warehouse_Key,
              priceType: 'default',
            },
          },
          create: {
            productId: product.id,
            warehouseGuid1c: stock.Warehouse_Key || 'unknown',
            quantity: stock.Quantity || 0,
            reserved: 0,
            // available вычисляется автоматически
          },
          update: {
            quantity: stock.Quantity || 0,
            // available вычисляется автоматически
            lastSyncAt: new Date(),
          },
        });

        await logSync(sessionId, 'stocks', `${product.id}-${stock.Warehouse_Key}`, 'update', 'completed');
        result.processed++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entity: 'stock',
        guid: stock.Product_Key,
        error: (error as Error).message,
      });
      await logSync(sessionId, 'stocks', stock.Product_Key, 'update', 'failed', (error as Error).message);
    }
  }

  return result;
}

// Sync prices
async function syncPrices(
  client: OneCClient,
  sessionId?: number,
  modifiedSince?: string
): Promise<SyncResult> {
  const result: SyncResult = { success: true, processed: 0, failed: 0, errors: [] };

  console.log('[Sync] Starting prices sync');

  // Get price types from settings
  const settings = await get1CSettings();
  const retailPriceType = settings.retailPriceTypeId;
  const wholesalePriceType = settings.wholesalePriceTypeId;

  const prices = await client.getPrices({ modifiedSince });
  console.log(`[Sync] Received ${prices.length} price records from 1C`);

  for (const price of prices) {
    try {
      const product = await prisma.product.findUnique({
        where: { guid1c: price.Product_Key },
      });

      if (product) {
        const updateData: any = { lastSyncAt: new Date() };
        
        if (retailPriceType && price.PriceType_Key === retailPriceType) {
          updateData.retailPrice = price.Price;
        } else if (wholesalePriceType && price.PriceType_Key === wholesalePriceType) {
          updateData.wholesalePrice = price.Price;
        } else if (!retailPriceType && !wholesalePriceType) {
          // If no types configured, update retail by default (just an example)
          updateData.retailPrice = price.Price;
        } else {
          // Skip unknown price types
          continue;
        }

        await prisma.product.update({
          where: { id: product.id },
          data: updateData,
        });

        await logSync(sessionId, 'prices', `${product.id}-${price.PriceType_Key}`, 'update', 'completed');
        result.processed++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entity: 'price',
        guid: price.Product_Key,
        error: (error as Error).message,
      });
      await logSync(sessionId, 'prices', price.Product_Key, 'update', 'failed', (error as Error).message);
    }
  }

  console.log(`[Sync] Prices sync completed: ${result.processed} processed, ${result.failed} failed`);
  return result;
}

// Sync orders
async function syncOrders(
  client: OneCClient,
  sessionId?: number,
  modifiedSince?: string
): Promise<SyncResult> {
  const result: SyncResult = { success: true, processed: 0, failed: 0, errors: [] };

  // Get orders from 1C
  const orders1C = await client.getOrders({ fromDate: modifiedSince, top: 100 });

  for (const order1C of orders1C) {
    try {
      // Find partner by GUID
      const partner = await prisma.partner.findFirst({
        where: { guid1c: order1C.Partner_Key },
      });

      if (partner) {
        const total = Number((order1C as any).TotalAmount ?? 0);
        await prisma.order.upsert({
          where: { guid1c: order1C.Ref_Key },
          create: {
            guid1c: order1C.Ref_Key,
            orderNumber1c: order1C.Number,
            partnerId: partner.id,
            orderDate: new Date(order1C.Date),
            totalAmount: total,
            status: 'confirmed',
            salesOrderGuid1c: order1C.Ref_Key,
            lastSyncAt: new Date(),
          },
          update: {
            orderNumber1c: order1C.Number,
            totalAmount: total,
            lastSyncAt: new Date(),
          },
        });

        await logSync(sessionId, 'orders', order1C.Ref_Key, 'update', 'completed');
        result.processed++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entity: 'order',
        guid: order1C.Ref_Key,
        error: (error as Error).message,
      });
      await logSync(sessionId, 'orders', order1C.Ref_Key, 'update', 'failed', (error as Error).message);
    }
  }

  // Sync realizations (for status updates)
  const realizations = await client.getRealizations({ fromDate: modifiedSince, top: 100 });

  for (const realization of realizations) {
    try {
      const order = await prisma.order.findFirst({
        where: { guid1c: realization.Order_Key },
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            realizationGuid1c: realization.Ref_Key,
            realizationDate: new Date(realization.Date),
            status: 'shipped',
            orderNumber1c: realization.Number,
            lastSyncAt: new Date(),
          },
        });

        await logSync(sessionId, 'realizations', realization.Ref_Key, 'update', 'completed');
        result.processed++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entity: 'realization',
        guid: realization.Ref_Key,
        error: (error as Error).message,
      });
    }
  }

  return result;
}

// Sync images
async function syncImages(
  client: OneCClient,
  sessionId?: number
): Promise<SyncResult> {
  const result: SyncResult = { success: true, processed: 0, failed: 0, errors: [] };
  const products = await prisma.product.findMany({
    where: { images: { none: {} } },
    select: { id: true, guid1c: true },
  });

  // Fetch all attachments once to avoid per-product failing filters
  let allImages: any[] = [];
  try {
    allImages = await client.getProductImages();
  } catch (e) {
    // If even unfiltered fetch fails, report and stop
    result.failed += products.length;
    result.errors.push({
      entity: 'image',
      guid: 'batch',
      error: (e as Error).message,
    });
    return result;
  }

  const getProductGuidFromImage = (img: any): string | undefined => {
    return (
      img.Product_Key ||
      img['Номенклатура_Key'] ||
      img.Owner_Key ||
      img['Владелец_Key'] ||
      img['Объект_Key'] ||
      img['Object_Key']
    );
  };

  // Build index by product guid
  const attachmentsByProduct: Record<string, any[]> = {};
  for (const img of allImages) {
    const pg = getProductGuidFromImage(img);
    if (typeof pg === 'string' && pg.length > 0) {
      (attachmentsByProduct[pg] ||= []).push(img);
    }
  }

  for (const product of products) {
    try {
      const imagesForProduct = attachmentsByProduct[product.guid1c] || [];
      if (imagesForProduct.length === 0) {
        continue;
      }
      for (const image1C of imagesForProduct) {
        const downloaded = await client.downloadImage(image1C.Ref_Key || image1C['Ссылка_Key'] || image1C['Ref_Key']);
        const buffer = downloaded.data;
        const filename = `${product.guid1c}_${downloaded.filename}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);

        await prisma.productImage.create({
          data: {
            productId: product.id,
            guid1c: image1C.Ref_Key || image1C['Ссылка_Key'],
            filename,
            originalFilename: downloaded.filename,
            filePath,
            fileUrl: `/uploads/${filename}`,
            mimeType: downloaded.contentType || 'image/jpeg',
            fileSize: buffer.length,
          },
        });
        result.processed++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        entity: 'image',
        guid: product.guid1c,
        error: (error as Error).message,
      });
      await logSync(sessionId, 'images', product.guid1c, 'update', 'failed', (error as Error).message);
    }
  }

  return result;
}

// Full sync
async function fullSync(
  client: OneCClient,
  sessionId?: number
): Promise<SyncResult> {
  const results = {
    products: await syncProducts(client, sessionId),
    partners: await syncPartners(client, sessionId),
    prices: await syncPrices(client, sessionId),
    stocks: await syncStocks(client, sessionId),
    orders: await syncOrders(client, sessionId),
  };

  return {
    success: Object.values(results).every(r => r.success),
    processed: Object.values(results).reduce((sum, r) => sum + r.processed, 0),
    failed: Object.values(results).reduce((sum, r) => sum + r.failed, 0),
    errors: Object.values(results).flatMap(r => r.errors),
  };
}

// Helper functions
async function get1CSettings() {
  const settings = await prisma.setting.findMany({
    where: {
      key: { in: ['onec_url', 'onec_user', 'onec_password', 'retail_price_type_guid', 'wholesale_price_type_guid'] },
    },
  });

  return {
    onecUrl: settings.find(s => s.key === 'onec_url')?.value || 'http://localhost:8080/hs/odata',
    onecUser: settings.find(s => s.key === 'onec_user')?.value || 'odata_user',
    onecPassword: settings.find(s => s.key === 'onec_password')?.value || '',
    retailPriceTypeId: settings.find(s => s.key === 'retail_price_type_guid')?.value,
    wholesalePriceTypeId: settings.find(s => s.key === 'wholesale_price_type_guid')?.value,
  };
}

async function findGroupIdByGuid(guid: string): Promise<number | null> {
  const group = await prisma.productGroup.findUnique({
    where: { guid1c: guid },
    select: { id: true },
  });
  return group?.id || null;
}

async function logSync(
  sessionId: number | undefined,
  entityType: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete' | 'full_sync',
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial',
  errorMessage?: string
) {
  if (!sessionId) return;

  await prisma.syncLog.create({
    data: {
      syncSessionId: String(sessionId),
      entityType,
      entityId,
      entityGuid1c: entityId,
      operation,
      status,
      errorMessage,
      processedAt: new Date(),
    },
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Worker shutting down...');
  await syncWorker.close();
  await syncQueue.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('Worker started. Waiting for jobs...');

// Types
interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{
    entity: string;
    guid: string;
    error: string;
  }>;
}

export { syncQueue };
