# Sessão: Correção do Sistema de Sincronização iFood

**Data**: 2025-10-12
**Projeto**: ifood-token-service
**Objetivo**: Garantir sincronização de produtos/categorias/complementos independente do status (aberto/fechado) do merchant

---

## 🎯 Problema Inicial

O usuário reportou que o merchant estava fechado e queria que a sincronização de produtos, categorias e complementos funcionasse mesmo com lojas fechadas, independente do status operacional.

**Requisitos**:
- Sincronização completa dos produtos deve ocorrer independente do status do merchant
- Sistema deve usar RabbitMQ para processamento assíncrono
- Verificar se o sync dos produtos está funcionando corretamente

---

## 🏗️ Arquitetura do Sistema de Sincronização

### Componentes Principais

1. **RabbitMQ** (amqp://admin:admin123@localhost:5672)
   - Container: `ifood-rabbitmq`
   - Portas: 5672 (AMQP), 15672 (Management UI)
   - 3 Filas principais:
     - `ifood.sync.products` - Sincronização de produtos por categoria
     - `ifood.sync.categories` - Sincronização de categorias por merchant
     - `ifood.sync.initial` - Sincronização inicial completa

2. **Scheduler** (`src/sync/scheduler.ts`)
   - Cron de produtos: `*/5 * * * *` (a cada 5 minutos)
   - Cron de categorias: `*/30 * * * *` (a cada 30 minutos)
   - Função: Publicar mensagens nas filas para processamento

3. **Workers** (`src/sync/workers.ts`)
   - 5 workers paralelos por fila (total: 15 workers)
   - Prefetch: 1 mensagem por vez por worker
   - Função: Consumir mensagens e executar sincronização

4. **Sync Service** (`src/sync/syncService.ts`)
   - Lógica core de sincronização com iFood API
   - Funções principais:
     - `syncCategories()` - Sincroniza categorias de um merchant
     - `syncProducts()` - Sincroniza produtos de uma categoria
     - `initialSync()` - Sincronização inicial completa

### Fluxo de Sincronização

```
Scheduler (Cron Job)
  ↓
Publica mensagem no RabbitMQ
  ↓
Worker consome mensagem
  ↓
Busca access_token do Supabase (ifood_tokens)
  ↓
Chama iFood API
  ↓
Salva dados no Supabase
  ↓
ACK/NACK mensagem
```

---

## 🐛 Erros Encontrados e Correções

### ❌ ERRO 1: Tentativa de buscar access_token da tabela errada

**Localização**: `src/sync/scheduler.ts:17-23`

**Código Original**:
```typescript
async function getAllMerchants(): Promise<string[]> {
  const { data: merchants } = await supabase
    .from('ifood_merchants')
    .select('merchant_id, access_token')
    .not('access_token', 'is', null);
  return merchants?.map(m => m.merchant_id) || [];
}
```

**Problema**:
- Tabela `ifood_merchants` não possui coluna `access_token`
- Token deve ser buscado da tabela `ifood_tokens`
- Erro: "column ifood_merchants.access_token does not exist"

**Correção Aplicada**:
```typescript
async function getAllMerchants(): Promise<string[]> {
  const { data: merchants } = await supabase
    .from('ifood_merchants')
    .select('merchant_id');
  return merchants?.map(m => m.merchant_id) || [];
}
```

---

### ❌ ERRO 2: Função getAccessToken usando tabela e coluna erradas

**Localização**: `src/sync/workers.ts:34-46`

**Código Original**:
```typescript
async function getAccessToken(merchantId: string): Promise<string> {
  const { data: merchant } = await supabase
    .from('ifood_merchants')
    .select('access_token')
    .eq('id', merchantId)
    .single();

  if (!merchant?.access_token) {
    throw new Error(`No access token found for merchant ${merchantId}`);
  }

  return merchant.access_token;
}
```

**Problemas**:
- Buscando de `ifood_merchants` ao invés de `ifood_tokens`
- Usando `.eq('id', merchantId)` - coluna errada

**Correção Aplicada**:
```typescript
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
```

**Observação**: Conforme solicitado pelo usuário, busca QUALQUER token válido da tabela `ifood_tokens`, não específico por merchant.

---

### ❌ ERRO 3: Uso incorreto de nome de coluna em múltiplos locais

**Localizações**:
- `src/sync/syncService.ts:50`
- `src/sync/syncService.ts:71`
- `src/sync/syncService.ts:131`
- `src/sync/syncService.ts:145`

**Código Original**:
```typescript
.eq('id', merchantId)
```

**Problema**:
- Coluna primária é `merchant_id`, não `id`
- Estrutura da tabela `ifood_merchants`:
  - merchant_id (text, PK)
  - user_id (uuid)
  - name (text)
  - status (text)
  - catalog_id (text)
  - catalog_synced_at (timestamp)
  - categories_synced_at (timestamp)
  - last_sync_at (timestamp)
  - sync_status (text)

**Correção Aplicada** (5 localizações):
```typescript
.eq('merchant_id', merchantId)
```

---

### ❌ ERRO 4: Falta de logging para debugging

**Problema**: Difícil diagnosticar problemas de API sem ver URLs e tokens sendo usados

**Correção Aplicada**: Adicionado logging detalhado em `src/sync/syncService.ts`

```typescript
// Linha 57-65: Log de busca de catalogs
const catalogsUrl = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/catalogs`;
console.log(`🌐 [SYNC] Fetching catalogs from: ${catalogsUrl}`);

const catalogsResponse = await axios.get(catalogsUrl, {
  headers: { Authorization: `Bearer ${accessToken}` }
});

catalogId = catalogsResponse.data[0]?.catalogId;
console.log(`📋 [SYNC] Found catalog_id: ${catalogId}`);

// Linha 80-86: Log de busca de categories
const categoriesUrl = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/catalogs/${catalogId}/categories`;
console.log(`🌐 [SYNC] Fetching categories from: ${categoriesUrl}`);
console.log(`🔑 [SYNC] Using access_token: ${accessToken.substring(0, 20)}...`);

const categoriesResponse = await axios.get(categoriesUrl, {
  headers: { Authorization: `Bearer ${accessToken}` }
});

// Linha 165-170: Log de busca de products
const productsUrl = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/categories/${categoryId}/items`;
console.log(`🌐 [SYNC] Fetching products from: ${productsUrl}`);

const productsResponse = await axios.get(productsUrl, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

---

## ✅ Verificações de Status do Merchant

### Confirmação: Sistema NÃO verifica status do merchant

**Localização**: `src/sync/scheduler.ts:17`

```typescript
async function getAllMerchants(): Promise<string[]> {
  const { data: merchants } = await supabase
    .from('ifood_merchants')
    .select('merchant_id');
  // ⚠️ SEM FILTRO DE STATUS - sincroniza todos os merchants
  return merchants?.map(m => m.merchant_id) || [];
}
```

**Conclusão**: ✅ O código JÁ sincroniza independente do status (aberto/fechado), conforme requisito do usuário.

---

## 🔧 Estrutura de Dados

### Tabela: ifood_merchants
```sql
merchant_id         TEXT PRIMARY KEY
user_id             UUID
name                TEXT
status              TEXT         -- 'OPEN' ou 'CLOSED'
catalog_id          TEXT
catalog_synced_at   TIMESTAMP
categories_synced_at TIMESTAMP
last_sync_at        TIMESTAMP
sync_status         TEXT         -- 'success' ou 'error'
```

### Tabela: ifood_tokens
```sql
id                  UUID PRIMARY KEY
access_token        TEXT
refresh_token       TEXT
expires_at          TIMESTAMP
-- outras colunas...
```

### Tabela: ifood_categories
```sql
merchant_id         TEXT
category_id         TEXT
name                TEXT
synced_at           TIMESTAMP
PRIMARY KEY (merchant_id, category_id)
```

### Tabela: products
```sql
merchant_id         TEXT
product_id          TEXT
category_id         TEXT
name                TEXT
description         TEXT
price               NUMERIC
original_price      NUMERIC
status              TEXT
shifts              JSONB
synced_at           TIMESTAMP
PRIMARY KEY (merchant_id, product_id)
```

---

## 🌐 iFood API Endpoints Utilizados

### 1. Buscar Catálogos
```
GET https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/catalogs
Headers: Authorization: Bearer {access_token}
Response: [{ catalogId: "..." }]
```

### 2. Buscar Categorias
```
GET https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/catalogs/{catalogId}/categories
Headers: Authorization: Bearer {access_token}
Response: [{ id: "...", name: "..." }]
```

### 3. Buscar Produtos
```
GET https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/categories/{categoryId}/items
Headers: Authorization: Bearer {access_token}
Response: [{ id: "...", name: "...", price: {...}, optionGroups: [...] }]
```

---

## 🚨 Problema Atual (Não Resolvido)

### ❌ API iFood retorna 404 para todas as requisições

**Status**: INVESTIGAÇÃO EM ANDAMENTO

**Sintomas**:
```
❌ [SYNC] Categories sync failed for merchant 577cb3b1-5845-4fbc-a219-8cd3939cb9ea:
Request failed with status code 404
```

**URLs sendo chamadas** (confirmadas corretas):
```
GET https://merchant-api.ifood.com.br/merchant/v1.0/merchants/577cb3b1-5845-4fbc-a219-8cd3939cb9ea/catalogs
GET https://merchant-api.ifood.com.br/merchant/v1.0/merchants/577cb3b1-5845-4fbc-a219-8cd3939cb9ea/categories/{categoryId}/items
```

**Possíveis Causas**:
1. **merchant_id inválido**: ID pode ser de teste/sandbox que não existe no ambiente de produção
2. **Permissões do token**: Token pode não ter permissões para acessar este merchant
3. **Ambiente incorreto**: Token de sandbox sendo usado em produção ou vice-versa
4. **Dados de teste**: merchant_id e category_ids podem ser dados fictícios

**Próximo Passo Necessário**:
- ⏳ Aguardando usuário confirmar se merchant_id `577cb3b1-5845-4fbc-a219-8cd3939cb9ea` é real ou de teste
- ⏳ Verificar se token tem permissões corretas para este merchant
- ⏳ Confirmar ambiente (sandbox vs produção) do token e merchant

---

## 📝 Comandos Úteis

### Verificar status do RabbitMQ
```bash
docker ps | grep rabbitmq
docker logs ifood-rabbitmq
```

### Acessar Management UI
```
http://localhost:15672
Usuário: admin
Senha: admin123
```

### Reiniciar servidor
```bash
# Matar todos os processos npm
pkill -f "npm run dev"

# Iniciar servidor
cd /root/Filipe/Plano-Certo/Nova-pasta--2-/backend/ifood-token-service
npm run dev
```

### Ver logs em tempo real
```bash
# Logs do servidor
npm run dev

# Logs do RabbitMQ
docker logs -f ifood-rabbitmq
```

### Verificar filas do RabbitMQ
```bash
# Via Management UI ou:
docker exec ifood-rabbitmq rabbitmqctl list_queues
```

---

## 🎯 Estado Atual do Sistema

### ✅ Funcionando Corretamente
- RabbitMQ container rodando e acessível
- 15 workers ativos (5 por fila) consumindo mensagens
- Schedulers configurados e executando (5min produtos, 30min categorias)
- Tokens sendo buscados corretamente da tabela `ifood_tokens`
- Merchants sendo buscados corretamente da tabela `ifood_merchants`
- Sincronização independe do status do merchant (conforme requisito)
- Logging detalhado habilitado para debugging

### ❌ Necessita Investigação
- API iFood retornando 404 para todas as requisições
- Validar se merchant_id e category_ids são reais ou de teste
- Verificar permissões do token para o merchant específico
- Confirmar ambiente correto (sandbox vs produção)

---

## 🔄 Fluxo de Sincronização Detalhado

### Sincronização de Categorias (a cada 30 minutos)

1. **Scheduler** publica mensagem na fila `ifood.sync.categories`:
   ```json
   {
     "type": "categories",
     "merchantId": "577cb3b1-5845-4fbc-a219-8cd3939cb9ea"
   }
   ```

2. **Worker** consome mensagem e chama `processCategoriesSync()`

3. **getAccessToken()** busca token da tabela `ifood_tokens`

4. **syncCategories()** executa:
   - Busca `catalog_id` (cache ou API)
   - GET `/merchants/{merchantId}/catalogs` se não estiver em cache
   - Salva `catalog_id` em `ifood_merchants.catalog_id`
   - GET `/merchants/{merchantId}/catalogs/{catalogId}/categories`
   - Compara categorias retornadas com banco de dados
   - Remove categorias deletadas
   - Upsert categorias novas/atualizadas
   - Atualiza timestamps de sincronização

5. **Worker** envia ACK se sucesso ou NACK se erro

### Sincronização de Produtos (a cada 5 minutos)

1. **Scheduler** busca todos os merchants e suas categorias

2. Para cada categoria, publica mensagem na fila `ifood.sync.products`:
   ```json
   {
     "type": "products",
     "merchantId": "577cb3b1-5845-4fbc-a219-8cd3939cb9ea",
     "categoryId": "categoria-id-123"
   }
   ```

3. **Worker** consome mensagem e chama `processProductsSync()`

4. **syncProducts()** executa:
   - GET `/merchants/{merchantId}/categories/{categoryId}/items`
   - Compara produtos retornados com banco de dados
   - Remove produtos deletados
   - Para cada produto:
     - Upsert produto em `products`
     - Upsert grupos de complementos em `complement_groups`
     - Upsert complementos individuais em `ifood_complements`
     - Reconstrói arrays de relacionamento

5. **Worker** envia ACK/NACK

---

## 📊 Arquivos Modificados

### 1. `/backend/ifood-token-service/src/sync/scheduler.ts`
**Mudanças**:
- Removido `access_token` do SELECT de `getAllMerchants()`
- Mantido apenas `merchant_id`

**Linhas alteradas**: 17-23

---

### 2. `/backend/ifood-token-service/src/sync/workers.ts`
**Mudanças**:
- Função `getAccessToken()` completamente reescrita
- Mudado de buscar em `ifood_merchants` para `ifood_tokens`
- Busca qualquer token válido disponível (não específico por merchant)

**Linhas alteradas**: 34-48

---

### 3. `/backend/ifood-token-service/src/sync/syncService.ts`
**Mudanças**:
- Corrigido `.eq('id', merchantId)` → `.eq('merchant_id', merchantId)` em 5 localizações
- Adicionado logging detalhado de URLs e tokens em 3 pontos críticos

**Linhas alteradas**: 50, 57-65, 71, 80-86, 131, 145, 165-170

---

### 4. `/backend/ifood-token-service/docker-compose.yml`
**Status**: Arquivo já existia e está correto
**Conteúdo**:
```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3.12-management
    container_name: ifood-rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped

volumes:
  rabbitmq_data:
```

---

## 🎓 Lições Aprendidas

### 1. Arquitetura de Banco de Dados
- **Problema**: Assumi que `access_token` estava em `ifood_merchants`
- **Realidade**: Tokens são armazenados separadamente em `ifood_tokens`
- **Lição**: Sempre verificar estrutura real do banco antes de assumir

### 2. Nomenclatura de Colunas
- **Problema**: Usei `.eq('id', ...)` assumindo padrão genérico
- **Realidade**: Coluna se chama `merchant_id` (nome específico do domínio)
- **Lição**: Verificar nomes exatos de colunas via Supabase ou documentação

### 3. Debugging Proativo
- **Problema**: Difícil diagnosticar erros de API sem visibilidade
- **Solução**: Adicionar logging detalhado de URLs, tokens (parciais) e responses
- **Lição**: Investir tempo em logging antecipadamente economiza tempo depois

### 4. RabbitMQ Workers
- **Descoberta**: Workers não estavam consumindo por causa de crash do servidor
- **Causa**: Erros de banco de dados faziam servidor crashar antes de inicializar workers
- **Lição**: Validar health do servidor inteiro, não apenas componentes isolados

---

## 🔮 Próximos Passos

### Imediatos (Bloqueadores)
1. ⏳ **Aguardar confirmação do usuário**: Validar se merchant_id é real ou de teste
2. ⏳ **Validar token**: Confirmar que token tem permissões para este merchant
3. ⏳ **Confirmar ambiente**: Verificar se estamos usando sandbox ou produção

### Após Desbloqueio
1. 🔍 **Testar com merchant válido**: Executar sync completo com dados reais
2. 📊 **Monitorar performance**: Verificar se 5 workers por fila é suficiente
3. 🎯 **Otimizar batch size**: Avaliar se 30 merchants por batch é ideal
4. 🔄 **Implementar retry strategy**: Adicionar backoff exponencial para erros temporários
5. 📝 **Documentar API**: Criar documentação dos endpoints iFood usados

### Melhorias Futuras
1. 🔒 **Health checks**: Endpoint para verificar status do sistema de sync
2. 📈 **Métricas**: Implementar tracking de sucessos/falhas por merchant
3. 🚨 **Alertas**: Notificações quando sync falha por período prolongado
4. 💾 **Cache**: Implementar cache de catalog_id e categories para reduzir chamadas API
5. 🧪 **Testes**: Criar testes unitários e de integração para sync logic

---

## 📞 Contato e Contexto

**Usuário**: Desenvolvedor do sistema Plano Certo Delivery
**Idioma de Preferência**: Português (BR)
**Timezone**: Aparentemente UTC-3 (Brasil)
**Ambiente de Desenvolvimento**: Linux (6.12.48+deb13-cloud-amd64)

---

## 🎯 Como Usar Este Documento

### Para Retomar o Trabalho
1. Ler seção "Estado Atual do Sistema"
2. Verificar "Próximos Passos" > "Imediatos"
3. Consultar "Comandos Úteis" para operações necessárias

### Para Debugging
1. Consultar "Erros Encontrados e Correções" para padrões de erro
2. Usar "Comandos Úteis" para investigação
3. Referir "iFood API Endpoints" para validar chamadas

### Para Novos Desenvolvedores
1. Ler "Arquitetura do Sistema" primeiro
2. Entender "Fluxo de Sincronização Detalhado"
3. Estudar "Estrutura de Dados" para contexto de banco

---

**Fim do Documento**
**Última Atualização**: 2025-10-12
**Status**: Aguardando validação de dados de teste vs produção
