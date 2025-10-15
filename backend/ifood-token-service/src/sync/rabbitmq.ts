import amqp, { Channel, Connection } from 'amqplib';

let connection: Connection | null = null;
let channel: Channel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

// Nomes das filas
export const QUEUES = {
  PRODUCTS_SYNC: 'ifood.sync.products',
  CATEGORIES_SYNC: 'ifood.sync.categories',
  INITIAL_SYNC: 'ifood.sync.initial'
};

/**
 * Conecta ao RabbitMQ e cria o canal
 */
export async function connectRabbitMQ(): Promise<void> {
  try {
    console.log('🔌 [RabbitMQ] Connecting to:', RABBITMQ_URL);

    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // Criar as filas com durabilidade
    await channel.assertQueue(QUEUES.PRODUCTS_SYNC, { durable: true });
    await channel.assertQueue(QUEUES.CATEGORIES_SYNC, { durable: true });
    await channel.assertQueue(QUEUES.INITIAL_SYNC, { durable: true });

    console.log('✅ [RabbitMQ] Connected and queues created');

    // Handlers para reconexão
    connection.on('error', (err) => {
      console.error('❌ [RabbitMQ] Connection error:', err);
    });

    connection.on('close', () => {
      console.warn('⚠️ [RabbitMQ] Connection closed. Reconnecting in 5s...');
      setTimeout(() => {
        connectRabbitMQ().catch(console.error);
      }, 5000);
    });

  } catch (error) {
    console.error('❌ [RabbitMQ] Connection failed:', error);
    throw error;
  }
}

/**
 * Retorna o canal RabbitMQ
 */
export function getChannel(): Channel {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized. Call connectRabbitMQ() first.');
  }
  return channel;
}

/**
 * Publica mensagem em uma fila
 */
export async function publishToQueue(queueName: string, message: any): Promise<void> {
  const ch = getChannel();
  const messageBuffer = Buffer.from(JSON.stringify(message));

  ch.sendToQueue(queueName, messageBuffer, {
    persistent: true // Mensagens persistem em disco
  });

  console.log(`📤 [RabbitMQ] Message published to ${queueName}`);
}

/**
 * Fecha conexão com RabbitMQ
 */
export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    console.log('✅ [RabbitMQ] Connection closed');
  } catch (error) {
    console.error('❌ [RabbitMQ] Error closing connection:', error);
  }
}
