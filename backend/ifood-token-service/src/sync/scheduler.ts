import cron from 'node-cron';
import { publishToQueue, QUEUES } from './rabbitmq';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

let productsSyncJob: cron.ScheduledTask | null = null;
let categoriesSyncJob: cron.ScheduledTask | null = null;

const BATCH_SIZE = 30; // Processar 30 merchants por vez

/**
 * Busca todos os merchants (independente do status aberto/fechado)
 */
async function getAllMerchants(): Promise<string[]> {
  const { data: merchants } = await supabase
    .from('ifood_merchants')
    .select('merchant_id');

  return merchants?.map(m => m.merchant_id) || [];
}

/**
 * Busca todas as categorias de um merchant
 */
async function getMerchantCategories(merchantId: string): Promise<string[]> {
  const { data: categories } = await supabase
    .from('ifood_categories')
    .select('category_id')
    .eq('merchant_id', merchantId);

  return categories?.map(c => c.category_id) || [];
}

/**
 * Divide array em batches
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Job de sincronização de produtos (a cada 5 minutos)
 * Publica mensagens de sincronização de produtos para cada categoria de cada merchant
 */
async function productsSync(): Promise<void> {
  console.log('📦 [SCHEDULER] Starting products sync job');

  try {
    const merchants = await getAllMerchants();
    console.log(`📊 [SCHEDULER] Found ${merchants.length} merchants to sync`);

    if (merchants.length === 0) {
      console.log('⚠️ [SCHEDULER] No merchants to sync');
      return;
    }

    // Dividir em batches
    const batches = chunkArray(merchants, BATCH_SIZE);
    console.log(`📦 [SCHEDULER] Processing ${batches.length} batches of ${BATCH_SIZE} merchants`);

    for (const batch of batches) {
      // Processar cada merchant do batch
      for (const merchantId of batch) {
        // Buscar categorias do merchant (do cache no banco)
        const categories = await getMerchantCategories(merchantId);

        if (categories.length === 0) {
          console.log(`⚠️ [SCHEDULER] No categories found for merchant ${merchantId}`);
          continue;
        }

        // Publicar mensagem para cada categoria
        for (const categoryId of categories) {
          await publishToQueue(QUEUES.PRODUCTS_SYNC, {
            type: 'products',
            merchantId,
            categoryId
          });
        }

        console.log(`✅ [SCHEDULER] Published ${categories.length} product sync messages for merchant ${merchantId}`);
      }
    }

    console.log('✅ [SCHEDULER] Products sync job completed');

  } catch (error) {
    console.error('❌ [SCHEDULER] Products sync job failed:', error);
  }
}

/**
 * Job de sincronização de categorias (a cada 30 minutos)
 * Publica mensagens de sincronização de categorias para cada merchant
 */
async function categoriesSync(): Promise<void> {
  console.log('📂 [SCHEDULER] Starting categories sync job');

  try {
    const merchants = await getAllMerchants();
    console.log(`📊 [SCHEDULER] Found ${merchants.length} merchants to sync`);

    if (merchants.length === 0) {
      console.log('⚠️ [SCHEDULER] No merchants to sync');
      return;
    }

    // Dividir em batches
    const batches = chunkArray(merchants, BATCH_SIZE);
    console.log(`📦 [SCHEDULER] Processing ${batches.length} batches of ${BATCH_SIZE} merchants`);

    for (const batch of batches) {
      // Processar cada merchant do batch
      for (const merchantId of batch) {
        await publishToQueue(QUEUES.CATEGORIES_SYNC, {
          type: 'categories',
          merchantId
        });
      }

      console.log(`✅ [SCHEDULER] Published ${batch.length} categories sync messages`);
    }

    console.log('✅ [SCHEDULER] Categories sync job completed');

  } catch (error) {
    console.error('❌ [SCHEDULER] Categories sync job failed:', error);
  }
}

/**
 * Inicia os schedulers
 */
export async function startSyncScheduler(): Promise<void> {
  try {
    // Scheduler de produtos: a cada 5 minutos
    productsSyncJob = cron.schedule('*/5 * * * *', async () => {
      await productsSync();
    });

    // Scheduler de categorias: a cada 30 minutos
    categoriesSyncJob = cron.schedule('*/30 * * * *', async () => {
      await categoriesSync();
    });

    console.log('✅ [SCHEDULER] Sync schedulers started');
    console.log('   📦 Products sync: every 5 minutes (*/5 * * * *)');
    console.log('   📂 Categories sync: every 30 minutes (*/30 * * * *)');

    // Executar primeira sincronização imediatamente
    console.log('🚀 [SCHEDULER] Running initial sync...');
    await categoriesSync(); // Primeiro categorias
    setTimeout(() => productsSync(), 10000); // Depois produtos (10s depois)

  } catch (error) {
    console.error('❌ [SCHEDULER] Failed to start sync schedulers:', error);
    throw error;
  }
}

/**
 * Para os schedulers
 */
export function stopSyncScheduler(): void {
  if (productsSyncJob) {
    productsSyncJob.stop();
    productsSyncJob = null;
  }

  if (categoriesSyncJob) {
    categoriesSyncJob.stop();
    categoriesSyncJob = null;
  }

  console.log('✅ [SCHEDULER] Sync schedulers stopped');
}

/**
 * Função auxiliar para triggerar sincronização inicial de um merchant
 * (útil para quando um merchant é adicionado)
 */
export async function triggerInitialSync(merchantId: string): Promise<void> {
  console.log(`🚀 [SCHEDULER] Triggering initial sync for merchant ${merchantId}`);

  await publishToQueue(QUEUES.INITIAL_SYNC, {
    type: 'initial',
    merchantId
  });

  console.log(`✅ [SCHEDULER] Initial sync message published for merchant ${merchantId}`);
}
