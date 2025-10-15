import { ConsumeMessage } from 'amqplib';
import { connectRabbitMQ, getChannel, QUEUES, closeRabbitMQ } from './rabbitmq';
import { syncProducts, syncCategories, initialSync } from './syncService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const WORKER_COUNT = 5; // Número de workers paralelos
const PREFETCH_COUNT = 1; // Cada worker processa 1 mensagem por vez

interface ProductsSyncMessage {
  type: 'products';
  merchantId: string;
  categoryId: string;
}

interface CategoriesSyncMessage {
  type: 'categories';
  merchantId: string;
}

interface InitialSyncMessage {
  type: 'initial';
  merchantId: string;
}

type SyncMessage = ProductsSyncMessage | CategoriesSyncMessage | InitialSyncMessage;

/**
 * Busca qualquer access_token válido da tabela ifood_tokens
 */
async function getAccessToken(merchantId: string): Promise<string> {
  // Pegar qualquer token válido da tabela ifood_tokens
  const { data: token } = await supabase
    .from('ifood_tokens')
    .select('access_token')
    .not('access_token', 'is', null)
    .limit(1)
    .single();

  if (!token?.access_token) {
    throw new Error(`No access token found in ifood_tokens table`);
  }

  return token.access_token;
}

/**
 * Processa mensagem de sincronização de produtos
 */
async function processProductsSync(message: ProductsSyncMessage): Promise<void> {
  const { merchantId, categoryId } = message;
  console.log(`🔄 [WORKER] Processing products sync: ${merchantId}/${categoryId}`);

  const accessToken = await getAccessToken(merchantId);
  await syncProducts(merchantId, categoryId, accessToken);

  console.log(`✅ [WORKER] Products sync completed: ${merchantId}/${categoryId}`);
}

/**
 * Processa mensagem de sincronização de categorias
 */
async function processCategoriesSync(message: CategoriesSyncMessage): Promise<void> {
  const { merchantId } = message;
  console.log(`🔄 [WORKER] Processing categories sync: ${merchantId}`);

  const accessToken = await getAccessToken(merchantId);
  await syncCategories(merchantId, accessToken);

  console.log(`✅ [WORKER] Categories sync completed: ${merchantId}`);
}

/**
 * Processa mensagem de sincronização inicial
 */
async function processInitialSync(message: InitialSyncMessage): Promise<void> {
  const { merchantId } = message;
  console.log(`🔄 [WORKER] Processing initial sync: ${merchantId}`);

  const accessToken = await getAccessToken(merchantId);
  await initialSync(merchantId, accessToken);

  console.log(`✅ [WORKER] Initial sync completed: ${merchantId}`);
}

/**
 * Handler principal de mensagens
 */
async function handleMessage(msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return;

  const channel = getChannel();

  try {
    const messageContent = msg.content.toString();
    const message: SyncMessage = JSON.parse(messageContent);

    console.log(`📥 [WORKER] Received message:`, message);

    // Processar de acordo com o tipo
    switch (message.type) {
      case 'products':
        await processProductsSync(message);
        break;

      case 'categories':
        await processCategoriesSync(message);
        break;

      case 'initial':
        await processInitialSync(message);
        break;

      default:
        console.warn(`⚠️ [WORKER] Unknown message type:`, (message as any).type);
    }

    // ACK: mensagem processada com sucesso
    channel.ack(msg);
    console.log(`✅ [WORKER] Message acknowledged`);

  } catch (error: any) {
    console.error(`❌ [WORKER] Error processing message:`, error.message);

    // NACK: rejeitar mensagem e reenviar para fila
    // Se falhar 3 vezes, vai para dead letter queue (se configurado)
    channel.nack(msg, false, true);
    console.warn(`⚠️ [WORKER] Message rejected and requeued`);
  }
}

/**
 * Inicia um worker para consumir mensagens de uma fila
 */
async function startWorker(queueName: string, workerId: number): Promise<void> {
  const channel = getChannel();

  // Configurar prefetch: cada worker processa 1 mensagem por vez
  channel.prefetch(PREFETCH_COUNT);

  // Começar a consumir mensagens
  await channel.consume(queueName, handleMessage, { noAck: false });

  console.log(`👷 [WORKER ${workerId}] Started consuming from ${queueName}`);
}

/**
 * Inicializa todos os workers
 */
export async function initializeWorkers(): Promise<void> {
  try {
    // Conectar ao RabbitMQ
    await connectRabbitMQ();

    // Iniciar workers para cada fila
    const queues = [QUEUES.PRODUCTS_SYNC, QUEUES.CATEGORIES_SYNC, QUEUES.INITIAL_SYNC];

    for (const queue of queues) {
      // Criar múltiplos workers para cada fila
      for (let i = 1; i <= WORKER_COUNT; i++) {
        await startWorker(queue, i);
      }
    }

    console.log(`✅ [WORKERS] All workers initialized (${WORKER_COUNT} workers per queue)`);

  } catch (error) {
    console.error(`❌ [WORKERS] Failed to initialize workers:`, error);
    throw error;
  }
}

/**
 * Para todos os workers
 */
export async function stopWorkers(): Promise<void> {
  await closeRabbitMQ();
  console.log(`✅ [WORKERS] All workers stopped`);
}
