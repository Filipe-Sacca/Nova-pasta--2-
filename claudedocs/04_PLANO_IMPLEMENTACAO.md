# 🚀 PLANO DE IMPLEMENTAÇÃO - Sincronização Automática iFood

**Data:** 12/10/2025
**Objetivo:** Roadmap completo de implementação da sincronização automática

---

## 📋 ORDEM DE EXECUÇÃO

### **FASE 1: Preparação do Ambiente** (1-2 horas)
### **FASE 2: Migrations do Banco** (30 min)
### **FASE 3: Setup RabbitMQ** (1 hora)
### **FASE 4: Criar Endpoint Faltante** (30 min)
### **FASE 5: Implementar Workers** (2-3 horas)
### **FASE 6: Implementar Schedulers** (1 hora)
### **FASE 7: Testes e Validação** (1-2 horas)

**Tempo total estimado:** 7-11 horas

---

## 🎯 FASE 1: PREPARAÇÃO DO AMBIENTE

### **1.1 Instalar Dependências**

```bash
cd /root/Filipe/Plano-Certo/Nova-pasta--2-/backend/ifood-token-service

npm install amqplib
npm install @types/amqplib --save-dev
```

### **1.2 Atualizar .env**

```env
# Adicionar ao final do arquivo .env:

# RabbitMQ Configuration
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
RABBITMQ_MANAGEMENT_URL=http://localhost:15672

# Sync Configuration
SYNC_PRODUCTS_INTERVAL=5      # minutos
SYNC_CATEGORIES_INTERVAL=30   # minutos
BATCH_SIZE=30                  # merchants por batch
MAX_WORKERS=5                  # workers paralelos
```

---

## 🗄️ FASE 2: MIGRATIONS DO BANCO

### **2.1 Executar SQL de Migração**

```bash
# Opção 1: Via psql (se tiver instalado)
psql postgresql://postgres.fqnbqrgmijbpduwllsly:CharlieCharlotte27@aws-0-sa-east-1.pooler.supabase.com:6543/postgres \
  -f claudedocs/02_SCRIPT_SQL_MIGRATION.sql

# Opção 2: Via Supabase SQL Editor
# Copiar conteúdo de claudedocs/02_SCRIPT_SQL_MIGRATION.sql
# Colar no SQL Editor do Supabase e executar
```

### **2.2 Validar Migrations**

```sql
-- Verificar colunas adicionadas:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'original_price';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'complement_groups';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ifood_complements';
```

---

## 🐰 FASE 3: SETUP RABBITMQ

### **3.1 Iniciar RabbitMQ Local**

```bash
docker run -d \
  --name rabbitmq-dev \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3-management
```

### **3.2 Verificar**

```bash
# Testar se está rodando
docker ps | grep rabbitmq

# Acessar Management UI
# http://localhost:15672 (admin/admin123)
```

---

## 📡 FASE 4: CRIAR ENDPOINT FALTANTE

### **4.1 Adicionar endpoint em menuRoutes.ts**

**Localização:** `src/routes/menuRoutes.ts`

**Adicionar após linha 605 (após smart-sync-working):**

```typescript
// Get items from category (needed for sync)
router.get('/merchants/:merchantId/categories/:categoryId/items', async (req, res) => {
  try {
    const { merchantId, categoryId } = req.params;

    console.log(`📦 Getting items for category: ${categoryId}`);

    // Get token
    const { data: tokenData } = await supabase
      .from('ifood_tokens')
      .select('access_token')
      .eq('client_secret', TARGET_CLIENT_SECRET)
      .single();

    if (!tokenData?.access_token) {
      return res.status(401).json({ error: 'Token not found' });
    }

    // Get catalog_id
    const { data: catalogData } = await supabase
      .from('ifood_categories')
      .select('catalog_id')
      .eq('merchant_id', merchantId)
      .limit(1)
      .single();

    if (!catalogData?.catalog_id) {
      return res.status(404).json({ error: 'Catalog not found' });
    }

    // Call iFood API
    const ifoodUrl = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogData.catalog_id}/categories/${categoryId}`;

    const response = await fetch(ifoodUrl, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: await response.text()
      });
    }

    const data = await response.json();

    return res.json({
      success: true,
      data: data || [],
      total: {
        items: data?.items?.length || 0,
        products: data?.products?.length || 0,
        optionGroups: data?.optionGroups?.length || 0,
        options: data?.options?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ Error getting items:', error);
    return res.status(500).json({ error: error.message });
  }
});
```

---

## ⚙️ FASE 5: IMPLEMENTAR WORKERS

### **5.1 Criar estrutura de arquivos**

```bash
mkdir -p src/sync
touch src/sync/rabbitmq.ts
touch src/sync/workers.ts
touch src/sync/syncService.ts
```

### **5.2 Implementação resumida (arquivos completos no próximo passo)**

**Arquivos a criar:**
1. `src/sync/rabbitmq.ts` - Conexão e configuração RabbitMQ
2. `src/sync/workers.ts` - Workers de processamento
3. `src/sync/syncService.ts` - Lógica de sincronização
4. `src/sync/scheduler.ts` - Schedulers de polling

---

## 📅 FASE 6: IMPLEMENTAR SCHEDULERS

### **6.1 Criar scheduler de polling**

**Arquivo:** `src/sync/scheduler.ts`

Implementar dois cron jobs:
- **A cada 5 min:** Publicar mensagens para sync de produtos
- **A cada 30 min:** Publicar mensagens para sync de categorias

---

## ✅ FASE 7: TESTES E VALIDAÇÃO

### **7.1 Testes Unitários**

```bash
# Testar RabbitMQ
tsx src/test-rabbitmq.ts

# Testar endpoint de items
curl http://localhost:8093/merchants/MERCHANT_ID/categories/CATEGORY_ID/items
```

### **7.2 Teste de Sincronização**

1. Adicionar 1 merchant de teste
2. Conectar na aplicação
3. Aguardar polling (5 min)
4. Verificar produtos sincronizados
5. Alterar produto no iFood
6. Aguardar próximo polling
7. Verificar alteração refletida

### **7.3 Monitoramento**

```bash
# RabbitMQ Management UI
http://localhost:15672

# Verificar:
- Queues criadas
- Messages processando
- Workers ativos
- Taxa de erro
```

---

## 📊 CHECKLIST COMPLETO

### **Preparação**
- [ ] Dependências instaladas
- [ ] .env atualizado
- [ ] RabbitMQ rodando

### **Banco de Dados**
- [ ] Migrations executadas
- [ ] Colunas validadas
- [ ] Índices criados
- [ ] Views funcionando

### **Código**
- [ ] Endpoint /items criado
- [ ] RabbitMQ connection implementada
- [ ] Workers implementados
- [ ] Schedulers configurados
- [ ] Código integrado no server.ts

### **Testes**
- [ ] RabbitMQ conectando
- [ ] Endpoint /items funcionando
- [ ] Sincronização inicial OK
- [ ] Polling de 5 min OK
- [ ] Polling de 30 min OK
- [ ] Detecção de mudanças OK

### **Produção**
- [ ] docker-compose configurado
- [ ] Build da imagem OK
- [ ] Deploy no Portainer
- [ ] RabbitMQ em produção
- [ ] Monitoring ativo

---

## 🎯 PRÓXIMOS PASSOS

**Após essa análise, vou criar:**
1. Código completo dos workers
2. Código completo dos schedulers
3. Integração com server.ts
4. Scripts de teste

**Quando estiver pronto para começar, me avise e começamos pela FASE 1!** 🚀
