# Análise de Rate Limits e Estratégia de Polling - iFood API

  

**Data:** 2025-10-22

**Contexto:** Análise completa de viabilidade de full sync automático e sistema de polling para 200 merchants

  

---

  

## 📋 Índice

  

1. [Contexto Inicial](#contexto-inicial)

2. [Rate Limits da API iFood](#rate-limits-da-api-ifood)

3. [Análise do Full Sync Automático](#análise-do-full-sync-automático)

4. [Análise do Sistema de Polling](#análise-do-sistema-de-polling)

5. [Recomendações Finais](#recomendações-finais)

6. [Implementação Sugerida](#implementação-sugerida)

  

---

  

## 🎯 Contexto Inicial

  

### Questão Principal:

**"O botão de Categorias está enviando muitas requisições ao iFood?"**

  

### Descoberta:

- O botão "Categorias" em si NÃO dispara requisições diretamente

- O problema estava no **full sync automático** ao trocar de merchant

- Análise revelou que o full sync é SEGURO e VIÁVEL dentro dos rate limits

  

### Sistema Atual:

- 150-200 merchants planejados

- ~50 produtos por merchant (~8 categorias)

- Full sync dispara ao trocar de merchant (useEffect)

- Endpoint: `/merchants/{merchantId}/products/smart-sync-working`

  

---

  

## 📊 Rate Limits da API iFood

  

### Endpoints Relevantes para Catalog Sync:

  

| Endpoint | Rate Limit | Uso no Sync |

|----------|-----------|-------------|

| `GET /merchants/{merchantId}/catalogs` | 3000 req/min | 1 req/merchant |

| `GET /merchants/{merchantId}/catalogs/{catalogId}/categories` | 3000 req/min | 1 req/merchant |

| `GET /merchants/{merchantId}/categories/{categoryId}/items` | 3000 req/min | ~8 req/merchant |

| `PATCH /merchants/{merchantId}/items/status` | 5000 req/min | N/A (operações manuais) |

| `PATCH /merchants/{merchantId}/items/price` | 5000 req/min | N/A (operações manuais) |

| `PATCH /merchants/{merchantId}/options/price` | 5000 req/min | N/A (complementos) |

| `PATCH /merchants/{merchantId}/options/status` | 5000 req/min | N/A (complementos) |

  

### Requisições por Full Sync (1 merchant):

  

```

1 req  → GET /catalogs

1 req  → GET /categories

8 reqs → GET /items (uma por categoria)

───────────────────────────

10 reqs TOTAL por merchant

```

  

---

  

## ✅ Análise do Full Sync Automático

  

### Cenários de Uso Real:

  

#### 1. Navegação Normal (30s por merchant):

```

→ 2 merchants/min × 10 reqs = 20 req/min

→ Uso: 20/3000 = 0.67% do rate limit

→ Status: ✅ ULTRA SEGURO

```

  

#### 2. Navegação Rápida (10s por merchant):

```

→ 6 merchants/min × 10 reqs = 60 req/min

→ Uso: 60/3000 = 2% do rate limit

→ Status: ✅ MUITO SEGURO

```

  

#### 3. Navegação Muito Rápida (5s por merchant):

```

→ 12 merchants/min × 10 reqs = 120 req/min

→ Uso: 120/3000 = 4% do rate limit

→ Status: ✅ SEGURO

```

  

### Múltiplos Usuários Simultâneos:

  

#### 10 usuários ativos (navegação rápida):

```

→ 10 usuários × 6 merchants/min = 60 merchants/min

→ 60 × 10 reqs = 600 req/min

→ Uso: 600/3000 = 20% do rate limit

→ Status: ✅ SEGURO

```

  

#### 20 usuários muito ativos (pior caso):

```

→ 20 usuários × 6 merchants/min = 120 merchants/min

→ 120 × 10 reqs = 1200 req/min

→ Uso: 1200/3000 = 40% do rate limit

→ Status: ✅ AINDA SEGURO

```

  

### Conclusão Full Sync Automático:

  

✅ **MANTER O FULL SYNC AUTOMÁTICO**

  

**Motivos:**

1. Rate limits são muito generosos (3000 req/min)

2. Uso real é baixo (1-7% em navegação normal)

3. Tempo natural de navegação distribui requisições

4. Margem de segurança grande (60-99% disponível)

5. UX superior - dados sempre atualizados

  

**Implementação Atual (CORRETA):**

```typescript

// MenuManagement.tsx - Linha 258-267

useEffect(() => {

  if (selectedClient && user) {

    console.log('🔄 [MENU-MANAGEMENT] Auto-sync on merchant change');

    sync(false);  // ✅ Full sync mantido

  }

}, [selectedClient, user]);

```

  

**❌ Debounce NÃO é necessário:**

- Select/Dropdown muda valor UMA vez apenas

- useEffect já dispara apenas uma vez por mudança

- Debounce só adicionaria delay desnecessário

  

---

  

## 🚀 Análise do Sistema de Polling

  

### Proposta Inicial:

- 200 merchants

- 6 merchants/min

- Polling em background para manter dados sempre atualizados

  

### Cenários de Polling Analisados:

  

#### 1. Ultra Conservador (6 merchants/min):

```

→ 6 merchants/min × 10 reqs = 60 req/min

→ Uso: 60/3000 = 2% do rate limit

→ Ciclo completo: 200 ÷ 6 = 33 minutos

→ Margem: 98% disponível

→ Status: ✅ ULTRA SEGURO

```

  

#### 2. Conservador (30 merchants/min):

```

→ 30 merchants/min × 10 reqs = 300 req/min

→ Uso: 300/3000 = 10% do rate limit

→ Ciclo completo: 200 ÷ 30 = 6.7 minutos

→ Margem: 90% disponível

→ Status: ✅ CONSERVADOR E EFICIENTE

```

  

#### 3. RECOMENDADO (50 merchants/min):

```

→ 50 merchants/min × 10 reqs = 500 req/min

→ Uso: 500/3000 = 16.7% do rate limit

→ Ciclo completo: 200 ÷ 50 = 4 minutos

→ Margem: 83% disponível

→ Status: ✅ EQUILIBRADO - IDEAL

```

  

#### 4. Agressivo (100 merchants/min):

```

→ 100 merchants/min × 10 reqs = 1000 req/min

→ Uso: 1000/3000 = 33% do rate limit

→ Ciclo completo: 200 ÷ 100 = 2 minutos

→ Margem: 67% disponível

→ Status: ✅ AINDA SEGURO

```

  

### Uso Combinado (Polling + Navegação):

  

#### Cenário Realista:

```

Polling: 50 merchants/min      = 500 req/min (16.7%)

Usuários navegando (5 ativos)  = 50 req/min (1.7%)

─────────────────────────────────────────────

TOTAL:                         = 550 req/min (18.4%)

Margem de segurança:           = 81.6% ✅ MUITO SEGURO

```

  

#### Pico Máximo:

```

Polling: 100 merchants/min     = 1000 req/min (33%)

Usuários navegando (10 ativos) = 100 req/min (3.3%)

─────────────────────────────────────────────

TOTAL:                         = 1100 req/min (36.7%)

Margem de segurança:           = 63.3% ✅ AINDA SEGURO

```

  

### Conclusão Sistema de Polling:

  

✅ **POLLING É TOTALMENTE VIÁVEL E SEGURO**

  

**Configuração Recomendada:**

```yaml

polling_config:

  merchants_per_minute: 50

  batch_delay: 1.2s  # 50/min = 1 merchant a cada 1.2s

  retry_attempts: 3

  retry_backoff: exponential

  

rate_usage:

  expected: 16.7%

  peak: 25%

  safety_margin: 75%

  

cycle_time:

  full_sync_all: 4 minutos

  freshness: "Dados atualizados a cada 4min"

```

  

**Benefícios do Polling:**

- 🔄 Dados sempre atualizados automaticamente em background

- ⚡ Usuário vê dados frescos instantaneamente

- 🎯 Detecta mudanças do iFood em tempo real

- 📊 Melhor experiência - não depende de ação manual

- 🚀 Performance - dados pré-carregados no banco

  

---

  

## 💡 Recomendações Finais

  

### 1. Full Sync Automático (Implementação Atual):

  

✅ **MANTER como está**

- Funciona perfeitamente

- Uso baixo de rate limit (1-7%)

- Não precisa de debounce

- UX excelente

  

```typescript

// MenuManagement.tsx

useEffect(() => {

  if (selectedClient && user) {

    sync(false);  // Full sync

  }

}, [selectedClient, user]);

```

  

### 2. Sistema de Polling (Implementação Futura):

  

✅ **IMPLEMENTAR com configuração de 50 merchants/min**

  

**Vantagens:**

- Dados sempre frescos (ciclo de 4 minutos)

- Uso de apenas 16.7% do rate limit

- Margem de 83% para crescimento

- Melhor UX possível

  

**Quando Implementar:**

- Quando tiver >50 merchants ativos

- Quando precisar de dados em tempo real

- Para reduzir latência ao trocar merchants

  

### 3. Melhorias Sugeridas:

  

#### A. Feedback Visual:

```typescript

{syncStatus === 'syncing' && (

  <Badge variant="outline" className="animate-pulse">

    🔄 Sincronizando com iFood...

  </Badge>

)}

```

  

#### B. Indicador de Última Sincronização:

```typescript

<span className="text-xs text-gray-500">

  Última sync: {formatDistanceToNow(lastUpdated, { locale: ptBR })}

</span>

```

  

#### C. Priorização Inteligente (para polling):

```sql

-- Merchants com pedidos recentes = maior prioridade

SELECT merchant_id, name,

  CASE

    WHEN last_order_at > NOW() - INTERVAL '1 hour' THEN 1   -- Alta

    WHEN last_order_at > NOW() - INTERVAL '24 hours' THEN 2 -- Média

    ELSE 3                                                   -- Baixa

  END as priority

FROM ifood_merchants

ORDER BY priority ASC, last_sync_at ASC NULLS FIRST

LIMIT 50;

```

  

---

  

## 🏗️ Implementação Sugerida

  

### Backend - Polling Service

  

```typescript

// backend/ifood-token-service/src/pollingService.ts

import cron from 'node-cron';

import { createClient } from '@supabase/supabase-js';

  

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

const API_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  

class PollingService {

  private isRunning = false;

  private merchantsPerMinute = 50;

  

  async syncBatch() {

    if (this.isRunning) {

      console.log('⏭️ [POLLING] Sync anterior ainda rodando, pulando...');

      return;

    }

  

    this.isRunning = true;

  

    try {

      // Buscar próximos N merchants (prioridade por última sync)

      const { data: merchants, error } = await supabase

        .from('ifood_merchants')

        .select('merchant_id, name, last_sync_at')

        .order('last_sync_at', { ascending: true, nullsFirst: true })

        .limit(this.merchantsPerMinute);

  

      if (error) {

        console.error('❌ [POLLING] Erro ao buscar merchants:', error);

        return;

      }

  

      console.log(`🔄 [POLLING] Sincronizando ${merchants?.length || 0} merchants...`);

  

      const delayBetweenMerchants = (60 / this.merchantsPerMinute) * 1000; // ms

  

      for (const merchant of merchants || []) {

        try {

          const startTime = Date.now();

  

          // Chamar endpoint smart-sync-working

          const response = await fetch(

            `${API_URL}/merchants/${merchant.merchant_id}/products/smart-sync-working`,

            {

              method: 'POST',

              headers: { 'Content-Type': 'application/json' },

              body: JSON.stringify({

                quick_mode: false,  // Full sync

                source: 'polling',  // Identificar origem

                user_id: 'system'   // User system para polling

              })

            }

          );

  

          const result = await response.json();

  

          if (response.ok && result.success) {

            // Atualizar timestamp de última sincronização

            await supabase

              .from('ifood_merchants')

              .update({

                last_sync_at: new Date().toISOString(),

                last_sync_status: 'success',

                total_products: result.total_products || 0

              })

              .eq('merchant_id', merchant.merchant_id);

  

            const duration = Date.now() - startTime;

            console.log(`✅ [POLLING] ${merchant.name} sincronizado (${duration}ms, ${result.total_products || 0} produtos)`);

          } else {

            throw new Error(result.error || 'Sync failed');

          }

  

          // Delay antes do próximo merchant

          await this.delay(delayBetweenMerchants);

  

        } catch (error: any) {

          console.error(`❌ [POLLING] Erro em ${merchant.name}:`, error.message);

  

          // Registrar erro no banco

          await supabase

            .from('ifood_merchants')

            .update({

              last_sync_at: new Date().toISOString(),

              last_sync_status: 'error',

              last_sync_error: error.message

            })

            .eq('merchant_id', merchant.merchant_id);

  

          // Continuar com próximo merchant mesmo em erro

        }

      }

  

      console.log(`🎉 [POLLING] Batch completo! ${merchants?.length || 0} merchants processados`);

  

    } catch (error: any) {

      console.error('❌ [POLLING] Erro fatal:', error);

    } finally {

      this.isRunning = false;

    }

  }

  

  private delay(ms: number): Promise<void> {

    return new Promise(resolve => setTimeout(resolve, ms));

  }

  

  start() {

    console.log('🚀 [POLLING] Iniciando polling service...');

    console.log(`   - Merchants por minuto: ${this.merchantsPerMinute}`);

    console.log(`   - Delay entre merchants: ${(60 / this.merchantsPerMinute).toFixed(1)}s`);

  

    // Executar a cada 1 minuto

    cron.schedule('* * * * *', () => {

      const now = new Date().toISOString();

      console.log(`⏰ [POLLING] Iniciando ciclo às ${now}...`);

      this.syncBatch();

    });

  

    console.log('✅ [POLLING] Polling service ativo!');

  }

  

  stop() {

    console.log('🛑 [POLLING] Parando polling service...');

    // Implementar lógica de parada se necessário

  }

}

  

export const pollingService = new PollingService();

```

  

### Inicialização no Server

  

```typescript

// backend/ifood-token-service/src/server.ts

import express from 'express';

import { pollingService } from './pollingService';

  

const app = express();

const PORT = process.env.PORT || 3001;

  

// ... outras configurações ...

  

app.listen(PORT, () => {

  console.log(`✅ Server running on port ${PORT}`);

  

  // Iniciar polling em background (apenas em produção)

  if (process.env.ENABLE_POLLING === 'true') {

    pollingService.start();

  } else {

    console.log('⏸️ Polling desabilitado (ENABLE_POLLING=false)');

  }

});

```

  

### Migration - Adicionar Colunas de Controle

  

```sql

-- Adicionar colunas para controle de polling

ALTER TABLE ifood_merchants

ADD COLUMN last_sync_at TIMESTAMPTZ,

ADD COLUMN last_sync_status VARCHAR(20),

ADD COLUMN last_sync_error TEXT,

ADD COLUMN total_products INTEGER DEFAULT 0;

  

-- Criar índice para otimizar query de priorização

CREATE INDEX idx_merchants_last_sync

ON ifood_merchants(last_sync_at ASC NULLS FIRST);

```

  

### Dashboard de Monitoramento

  

```typescript

// Endpoint para status do polling

router.get('/api/polling/status', async (req, res) => {

  try {

    const { data: merchants, error } = await supabase

      .from('ifood_merchants')

      .select('merchant_id, name, last_sync_at, last_sync_status, total_products');

  

    if (error) throw error;

  

    const now = new Date();

    const stats = {

      total_merchants: merchants?.length || 0,

      fresh_data: 0,      // Sincronizado nos últimos 5 minutos

      moderate_data: 0,   // Sincronizado entre 5-15 minutos

      stale_data: 0,      // Sincronizado há mais de 15 minutos

      never_synced: 0,    // Nunca sincronizado

      errors: 0,          // Última sync com erro

      total_products: 0

    };

  

    merchants?.forEach(m => {

      stats.total_products += m.total_products || 0;

  

      if (m.last_sync_status === 'error') {

        stats.errors++;

        return;

      }

  

      if (!m.last_sync_at) {

        stats.never_synced++;

        return;

      }

  

      const minutesAgo = (now.getTime() - new Date(m.last_sync_at).getTime()) / 1000 / 60;

  

      if (minutesAgo < 5) {

        stats.fresh_data++;

      } else if (minutesAgo < 15) {

        stats.moderate_data++;

      } else {

        stats.stale_data++;

      }

    });

  

    res.json({

      success: true,

      stats,

      percentage_fresh: ((stats.fresh_data / stats.total_merchants) * 100).toFixed(1),

      average_products_per_merchant: (stats.total_products / stats.total_merchants).toFixed(0)

    });

  

  } catch (error: any) {

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});

```

  

---

  

## 📈 Métricas de Sucesso

  

### Rate Limit Usage (Recomendado):

```

✅ Normal:    10-20% do rate limit

⚠️ Alerta:    50-70% do rate limit

❌ Crítico:   >80% do rate limit

```

  

### Freshness de Dados:

```

✅ Excelente: >80% dos merchants com dados <5min

⚠️ Bom:       50-80% dos merchants com dados <5min

❌ Ruim:      <50% dos merchants com dados <5min

```

  

### Performance:

```

✅ Sync/merchant: <3 segundos

⚠️ Sync/merchant: 3-10 segundos

❌ Sync/merchant: >10 segundos

```

  

---

  

## 🎯 Roadmap de Implementação

  

### Fase 1 - Atual (COMPLETO):

- ✅ Full sync automático ao trocar merchant

- ✅ Análise de rate limits

- ✅ Validação de viabilidade

  

### Fase 2 - Melhorias UX (PRÓXIMO):

- [ ] Feedback visual "Sincronizando..."

- [ ] Indicador de última sincronização

- [ ] Loading states melhorados

  

### Fase 3 - Polling Background (FUTURO):

- [ ] Implementar polling service

- [ ] Migration de banco de dados

- [ ] Priorização inteligente

- [ ] Dashboard de monitoramento

  

### Fase 4 - Otimizações (LONGO PRAZO):

- [ ] Cache estratégico

- [ ] Delta sync (sync incremental)

- [ ] Webhooks do iFood (se disponível)

- [ ] Rate limit automático adaptativo

  

---

  

## 📝 Notas Importantes

  

### Decisões Tomadas:

  

1. ✅ **MANTER full sync automático** - É seguro e melhora UX

2. ❌ **NÃO adicionar debounce** - Não é necessário para Select/Dropdown

3. ✅ **IMPLEMENTAR polling** - Viável com 50 merchants/min

4. ✅ **Margem de segurança** - Sempre manter >60% do rate limit disponível

  

### Considerações Futuras:

  

- **Webhooks:** Verificar se iFood oferece webhooks para mudanças de catálogo

- **Delta Sync:** Implementar sync incremental para reduzir requisições

- **Cache Inteligente:** Cache de imagens e dados estáticos

- **Monitoramento:** Implementar alertas para uso >70% do rate limit

  

---

  

## 📚 Referências

  

- **Arquivos Relacionados:**

  - `frontend/plano-certo-hub-insights/src/components/modules/MenuManagement.tsx:258-267`

  - `frontend/plano-certo-hub-insights/src/hooks/useMerchantProducts.ts:99-137`

  - `backend/ifood-token-service/src/routes/menuRoutes.ts:497-954`

  - `ratelimit_catalog.md` - Rate limits oficiais do iFood

  

- **Endpoints Críticos:**

  - `GET /merchants/{merchantId}/catalogs`

  - `GET /merchants/{merchantId}/catalogs/{catalogId}/categories`

  - `GET /merchants/{merchantId}/categories/{categoryId}/items`

  

---

  

## ✅ Checklist de Implementação

  

### Full Sync Automático (Atual):

- [x] useEffect disparando sync ao trocar merchant

- [x] Validação de rate limits

- [ ] Feedback visual durante sync

- [ ] Timestamp de última sincronização

  

### Sistema de Polling (Futuro):

- [ ] Criar pollingService.ts

- [ ] Adicionar colunas no banco (migration)

- [ ] Integrar com server.ts

- [ ] Implementar priorização

- [ ] Dashboard de monitoramento

- [ ] Testes de carga

- [ ] Documentação de operação

  

---

  

**Última Atualização:** 2025-10-22

**Status:** Análise completa ✅ | Implementação de melhorias pendente ⏳