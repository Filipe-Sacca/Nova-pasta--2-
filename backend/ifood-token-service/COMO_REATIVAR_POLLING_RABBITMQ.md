# Como Reativar Polling e RabbitMQ

**Data da desativação:** 13 de Outubro de 2025
**Motivo:** Desativação temporária para desenvolvimento local sem dependências externas

---

## 📋 O que foi desativado

### 1. **Merchant Polling Service**
Sistema de polling de eventos iFood a cada 30 segundos
- Arquivo: `src/merchantPollingService.ts`
- Precisão: 99.5%
- Eventos processados: PLC, CFM, CAN, etc.

### 2. **Product Sync Scheduler**
Sincronização automática de produtos
- Arquivo: `src/productSyncScheduler.ts`
- Frequência: a cada 5 minutos

### 3. **RabbitMQ Workers**
Sistema de workers para processamento assíncrono
- Arquivos: `src/sync/workers.ts`, `src/sync/scheduler.ts`
- 5 workers ativos
- Filas: product_sync_queue, category_sync_queue

---

## 🔄 Como Reativar

### Passo 1: Descomente os Imports

Abra `src/server.ts` e descomente as linhas **16-26**:

```typescript
// Import schedulers for initialization
import { tokenScheduler } from './tokenScheduler';
import { productSyncScheduler } from './productSyncScheduler'; // ✅ DESCOMENTAR
import { logCleanupScheduler } from './logCleanupScheduler';
import { MerchantPollingService } from './merchantPollingService'; // ✅ DESCOMENTAR

// Import sync workers and scheduler
// ✅ DESCOMENTAR AS 2 LINHAS ABAIXO
import { initializeWorkers, stopWorkers } from './sync/workers';
import { startSyncScheduler, stopSyncScheduler } from './sync/scheduler';
```

### Passo 2: Descomente a Inicialização do Merchant Polling

Linha **207-208**:

```typescript
// Initialize merchant polling service
// ✅ DESCOMENTAR A LINHA ABAIXO
const merchantPolling = new MerchantPollingService();
```

### Passo 3: Descomente o Startup do Polling e RabbitMQ

Linhas **226-252**:

```typescript
console.log('   🔄 Merchant Polling (30s intervals)'); // ✅ DESCOMENTAR
console.log('🎯 ============================================\n');

// ✅ DESCOMENTAR TODO O BLOCO ABAIXO
// Start merchant polling service
try {
  await merchantPolling.start();
  console.log('✅ Merchant polling service started successfully');
} catch (error) {
  console.error('❌ Failed to start merchant polling service:', error);
}

// Start sync workers and scheduler
try {
  await initializeWorkers();
  console.log('✅ Sync workers initialized successfully (5 workers ready)');

  await startSyncScheduler();
  console.log('✅ Sync scheduler started successfully');
  console.log('   📦 Products sync: every 5 minutes');
  console.log('   📂 Categories sync: every 30 minutes');
} catch (error) {
  console.error('❌ Failed to start sync system:', error);
}
```

### Passo 4: Descomente o Graceful Shutdown

Linhas **260-268** e **282-290**:

```typescript
// Graceful shutdown - SIGTERM
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  // Stop all schedulers and polling
  tokenScheduler.stop();
  productSyncScheduler.stop(); // ✅ DESCOMENTAR
  logCleanupScheduler.stop();
  merchantPolling.stop(); // ✅ DESCOMENTAR

  // Stop sync system
  // ✅ DESCOMENTAR AS 2 LINHAS ABAIXO
  stopSyncScheduler();
  stopWorkers();
  console.log('✅ Sync system stopped');

  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

// Graceful shutdown - SIGINT
process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');

  // Stop all schedulers and polling
  tokenScheduler.stop();
  productSyncScheduler.stop(); // ✅ DESCOMENTAR
  logCleanupScheduler.stop();
  merchantPolling.stop(); // ✅ DESCOMENTAR

  // Stop sync system
  // ✅ DESCOMENTAR AS 2 LINHAS ABAIXO
  stopSyncScheduler();
  stopWorkers();
  console.log('✅ Sync system stopped');

  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});
```

### Passo 5: Remova o Aviso de Desativação

Linhas **227-229**:

```typescript
// ❌ REMOVER ESTAS 3 LINHAS
console.log('🎯 ============================================');
console.log('⚠️  POLLING E RABBITMQ DESATIVADOS TEMPORARIAMENTE');
console.log('🎯 ============================================\n');
```

---

## 📦 Dependências Necessárias

Antes de reativar, certifique-se de que você tem:

### 1. RabbitMQ Rodando

**Opção A: Docker (Recomendado)**
```bash
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin \
  rabbitmq:3-management

# Acesse: http://localhost:15672
# User: admin / Pass: admin
```

**Opção B: Instalação Local**
```bash
# Ubuntu/Debian
sudo apt-get install rabbitmq-server
sudo systemctl start rabbitmq-server

# macOS
brew install rabbitmq
brew services start rabbitmq
```

### 2. Variáveis de Ambiente

Configure no `.env`:

```env
# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# iFood API (necessário para polling)
IFOOD_CLIENT_ID=seu-client-id
IFOOD_CLIENT_SECRET=seu-client-secret

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_KEY=sua-chave-service
```

### 3. Merchants Cadastrados

O polling precisa de merchants ativos:

```sql
-- Verificar merchants na tabela
SELECT merchant_id, user_id FROM ifood_merchants;
```

---

## ✅ Verificando se Reativou Corretamente

### 1. Inicie o Servidor

```bash
npm run dev
```

### 2. Verifique os Logs de Startup

Você deve ver:

```
🎯 ============================================
🚀 iFood Token Service - Modular Architecture
🎯 ============================================
🌐 Server running on port 8093
📁 Active modules:
   🔐 Token Management (tokenRoutes)
   ...
   🔄 Merchant Polling (30s intervals)  ✅ DEVE APARECER
🎯 ============================================

✅ Merchant polling service started successfully  ✅ DEVE APARECER
✅ Sync workers initialized successfully (5 workers ready)  ✅ DEVE APARECER
✅ Sync scheduler started successfully  ✅ DEVE APARECER
   📦 Products sync: every 5 minutes
   📂 Categories sync: every 30 minutes
```

### 3. Verifique o RabbitMQ

Acesse: http://localhost:15672

Você deve ver as filas:
- `product_sync_queue`
- `category_sync_queue`

### 4. Verifique o Polling

Após 30 segundos, você deve ver nos logs:

```
⏰ [POLLING-SERVICE] ========== POLLING EXECUTION START ==========
🎯 [POLLING-SERVICE] Polling ID: ...
👤 [POLLING-SERVICE] User: ...
📊 [POLLING-SERVICE] Events received: X
✅ [POLLING-SERVICE] ========== POLLING EXECUTION SUCCESS ==========
```

---

## 🔍 Troubleshooting

### Problema: RabbitMQ Connection Failed

```
❌ Failed to start sync system: connect ECONNREFUSED 127.0.0.1:5672
```

**Solução:**
```bash
# Verifique se RabbitMQ está rodando
docker ps | grep rabbitmq
# ou
sudo systemctl status rabbitmq-server

# Se não estiver, inicie
docker start rabbitmq
# ou
sudo systemctl start rabbitmq-server
```

### Problema: No Merchants Found

```
❌ [POLLING-SERVICE] No merchants found for user
```

**Solução:**
```bash
# Cadastre um merchant no Supabase
# Ou use a rota: POST /merchants
```

### Problema: iFood API Authentication Failed

```
❌ iFood API error: 401 - Unauthorized
```

**Solução:**
- Verifique IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET no `.env`
- Regenere token OAuth2 pelo painel iFood

---

## 🎯 Resumo Rápido

**Busque por:** `🔴 DESATIVADO` no arquivo `src/server.ts`

**Descomente:**
1. Imports (linhas 16-26)
2. Inicialização do polling (linha 208)
3. Startup do polling e RabbitMQ (linhas 226-252)
4. Shutdown handlers (linhas 260-268 e 282-290)

**Remova:**
- Aviso de desativação (linhas 227-229)

**Inicie:**
```bash
# 1. Certifique-se que RabbitMQ está rodando
docker start rabbitmq

# 2. Compile e inicie
npm run build
npm run dev

# 3. Verifique os logs
```

---

## 📞 Suporte

Se tiver problemas ao reativar:

1. Verifique os logs completos: `npm run dev | tee startup.log`
2. Verifique status RabbitMQ: http://localhost:15672
3. Verifique conectividade Supabase
4. Verifique credenciais iFood API

**Documento criado por:** Claude (Anthropic)
**Data:** 13 de Outubro de 2025
**Arquivo modificado:** `backend/ifood-token-service/src/server.ts`
