# Mudanças no Sistema de Polling - iFood Integration Hub

**Data:** 13 de Outubro de 2025
**Autor:** Claude (Anthropic)
**Versão:** 2.2.0

---

## 📋 Resumo das Mudanças

Este documento descreve as otimizações implementadas no sistema de polling do backend para eliminar chamadas repetidas desnecessárias à API do iFood.

---

## ❌ Problemas Identificados

### 1. **Opening Hours sendo buscado repetidamente**
- **Onde:** `ifoodMerchantStatusService.ts:checkAllMerchantStatuses()` linhas 1162-1184
- **Problema:** Horários de funcionamento eram buscados da API iFood TODA VEZ que o polling rodava
- **Impacto:**
  - Chamadas desnecessárias à API
  - Lentidão no polling
  - Risco de rate limiting
  - Horários não mudam frequentemente (não precisam ser buscados toda hora)

### 2. **Merchant list sendo buscado repetidamente**
- **Onde:** `merchantPollingService.ts` (já estava desativado)
- **Status:** ✅ Já estava desativado anteriormente

### 3. **Falta de polling otimizado para status**
- **Problema:** Não havia um serviço dedicado APENAS para verificar status
- **Impacto:** Polling estava fazendo muitas coisas ao mesmo tempo (status + opening hours + merchants)

---

## ✅ Soluções Implementadas

### 1. **Removida busca repetida de Opening Hours**

**Arquivo:** `src/ifoodMerchantStatusService.ts`

**Antes (linhas 1162-1184):**
```typescript
// ❌ PROBLEMA: Buscava opening hours toda vez
const { success, hours } = await this.fetchOpeningHours(
  merchantId,
  tokenData.access_token
);

// Salvava no banco toda vez
const saveResult = await this.saveOpeningHoursToDatabase(merchantId, hours);
```

**Depois:**
```typescript
// ✅ SOLUÇÃO: Usa opening hours do CACHE (banco de dados)
const { data: merchantData, error: merchantError } = await supabase
  .from('ifood_merchants')
  .select('operating_hours')
  .eq('merchant_id', merchantId)
  .single();

if (!merchantData || !merchantData.operating_hours || !merchantData.operating_hours.shifts) {
  console.warn(`⚠️ No cached opening hours found for merchant ${merchantId}`);
  console.warn(`💡 TIP: Call GET /merchants/${merchantId}/opening-hours to fetch and cache hours`);
  return; // Pula este merchant
}

const hours = merchantData.operating_hours.shifts;
console.log(`📋 Using cached opening hours for ${merchantId}: ${hours.length} shifts`);
```

**Benefícios:**
- ✅ Não busca opening hours repetidamente
- ✅ Usa dados do cache (banco de dados)
- ✅ Reduz DRASTICAMENTE as chamadas à API iFood
- ✅ Polling fica muito mais rápido

### 2. **Criado novo serviço de polling otimizado**

**Arquivo:** `src/statusPollingService.ts` (NOVO)

**Características:**
- ✅ **Focado**: Apenas verifica STATUS dos merchants
- ✅ **Otimizado**: Usa opening hours do CACHE
- ✅ **Preciso**: Polling a cada 30 segundos EXATO
- ✅ **Limpo**: Não busca merchants da API
- ✅ **Eficiente**: Apenas 1 chamada à API por merchant (apenas status)

**Fluxo:**
```
1. Buscar merchants do BANCO LOCAL (não da API)
   ↓
2. Para cada merchant:
   - Verificar se tem opening hours em cache
   - Se não tem: PULAR (avisar no log)
   - Se tem: CONTINUAR
   ↓
3. Buscar TOKEN do usuário
   ↓
4. Chamar API iFood: GET /merchants/{id}/status (ÚNICA chamada)
   ↓
5. Atualizar status no banco SOMENTE se mudou
```

**Código principal:**
```typescript
export class StatusPollingService {
  private readonly POLLING_INTERVAL = 30000; // 30 segundos EXATO

  async start(): Promise<void> {
    // Executa imediatamente
    await this.executePollCycle();

    // Configura intervalo de 30s
    this.intervalId = setInterval(async () => {
      await this.executePollCycle();
    }, this.POLLING_INTERVAL);
  }

  private async executePollCycle(): Promise<void> {
    // 1. Buscar merchants do BANCO
    const { data: merchants } = await supabase
      .from('ifood_merchants')
      .select('merchant_id, user_id, operating_hours');

    for (const merchant of merchants) {
      // 2. Verificar cache de opening hours
      if (!merchant.operating_hours) {
        console.warn(`⚠️ No cached opening hours - skipping ${merchant.merchant_id}`);
        continue;
      }

      // 3. Buscar STATUS (única chamada à API)
      const { success, data } = await IFoodMerchantStatusService.fetchMerchantStatus(
        merchant.merchant_id,
        tokenData.access_token
      );

      // 4. Atualizar SOMENTE se mudou
      if (merchant.status !== isOpen) {
        await IFoodMerchantStatusService.updateMerchantStatus(merchant.merchant_id, isOpen);
      }
    }
  }
}
```

### 3. **Integrado no server.ts**

**Arquivo:** `src/server.ts`

**Mudanças:**
```typescript
// Import do novo serviço
import { getStatusPollingService } from './statusPollingService';

// Inicialização
const statusPolling = getStatusPollingService();

// Startup
try {
  await statusPolling.start();
  console.log('✅ Status Polling Service started (30s interval)');
  console.log('   🔄 Monitors merchant status every 30 seconds');
  console.log('   📋 Uses cached opening hours (no repeated API calls)');
} catch (error) {
  console.error('❌ Failed to start Status Polling Service:', error);
}

// Shutdown
process.on('SIGTERM', () => {
  statusPolling.stop();
});

process.on('SIGINT', () => {
  statusPolling.stop();
});
```

---

## 📊 Comparação: Antes vs Depois

### Chamadas à API iFood (por ciclo de polling)

**Antes (Sistema Antigo):**
```
Para 3 merchants:
- GET /merchants (lista) → 1 chamada
- GET /merchants/{id}/opening-hours → 3 chamadas (uma por merchant)
- GET /merchants/{id}/status → 3 chamadas
TOTAL: 7 chamadas à API por ciclo (a cada 30s)
```

**Depois (Sistema Novo):**
```
Para 3 merchants:
- GET /merchants/{id}/status → 3 chamadas
TOTAL: 3 chamadas à API por ciclo (a cada 30s)
```

**Redução:** **~57% menos chamadas à API!** (7 → 3 chamadas)

### Tempo de execução estimado

**Antes:**
- 7 chamadas × 500ms média = ~3.5 segundos por ciclo

**Depois:**
- 3 chamadas × 500ms média = ~1.5 segundos por ciclo

**Melhoria:** **~57% mais rápido!**

---

## 🎯 Como Usar o Novo Sistema

### 1. **Primeiro uso: Buscar Opening Hours**

Os merchants precisam ter opening hours em cache. Para buscar pela primeira vez:

```bash
# Para cada merchant, chamar endpoint manual:
GET /merchants/{merchantId}/opening-hours
```

Este endpoint:
- Busca opening hours da API iFood
- Salva no campo `operating_hours` da tabela `ifood_merchants`
- Retorna os horários

**Frequência recomendada:** 1x por dia ou quando mudar horário

### 2. **Polling automático de status**

O novo `StatusPollingService`:
- Inicia automaticamente com o servidor
- Roda a cada 30 segundos
- Verifica status de TODOS os merchants que têm opening hours em cache
- Atualiza o banco SOMENTE quando o status muda

### 3. **Verificar logs**

**Logs do polling:**
```
🔄 ========== STATUS POLLING CYCLE START ==========
⏰ [STATUS-POLLING] Timestamp: 2025-10-13T...
🏪 [STATUS-POLLING] Encontrados 3 merchants no banco
📋 Using cached opening hours for merchant_123: 7 shifts
🔄 [STATUS-POLLING] Status atualizado: Restaurante X → 🟢 ABERTO
✅ [STATUS-POLLING] Status mantido: Restaurante Y → 🟢
⚠️ [STATUS-POLLING] Merchant merchant_456 sem opening hours em cache - pulando
💡 [STATUS-POLLING] TIP: Chame GET /merchants/merchant_456/opening-hours
✅ ========== STATUS POLLING CYCLE END ==========
⏰ [STATUS-POLLING] Duração: 1234ms
📊 [STATUS-POLLING] Resultados:
   - Merchants processados: 3
   - Atualizados: 1
   - Erros: 0
   - Pulados: 1
✅ ========== NEXT CYCLE IN 30s ==========
```

---

## 📝 Endpoints Afetados

### **GET /merchants/:merchantId/opening-hours**
- ✅ **Continua funcionando**
- **Função:** Busca opening hours da API iFood e salva no cache
- **Uso:** Chamar quando:
  - Merchant é cadastrado pela primeira vez
  - Horários mudaram
  - Uma vez por dia (opcional)

### **POST /merchant-status/check**
- ✅ **Continua funcionando**
- **Função:** Verifica status de um merchant específico
- **Uso:** Verificação manual

### **Polling automático**
- ✅ **Novo serviço otimizado**
- **Função:** Verifica status de TODOS os merchants a cada 30s
- **Uso:** Automático, não requer intervenção

---

## ⚠️ Avisos Importantes

### 1. **Opening Hours em cache são obrigatórios**

Se um merchant NÃO tem opening hours em cache:
- O polling vai **PULAR** este merchant
- Será exibido um aviso no log
- Para resolver: Chamar `GET /merchants/{merchantId}/opening-hours`

### 2. **Opening Hours não se atualizam automaticamente**

Por design, opening hours NÃO são mais buscados automaticamente. Para atualizar:

**Opção 1: Manual**
```bash
GET /merchants/{merchantId}/opening-hours
```

**Opção 2: Scheduler diário** (recomendado para produção)
```typescript
// Adicionar em algum scheduler (cron)
// Uma vez por dia às 3h da manhã
schedule.scheduleJob('0 3 * * *', async () => {
  const merchants = await getAllMerchants();
  for (const merchant of merchants) {
    await IFoodMerchantStatusService.fetchOpeningHours(...);
  }
});
```

### 3. **Polling antigo desativado**

Os seguintes serviços estão **DESATIVADOS**:
- ❌ `MerchantPollingService` (busca merchants + opening hours + status)
- ❌ RabbitMQ workers (sync de produtos/categorias)
- ❌ `productSyncScheduler`

Apenas o **novo `StatusPollingService`** está ativo.

---

## 🔧 Troubleshooting

### Problema: "No cached opening hours found"

**Sintoma:**
```
⚠️ [STATUS-POLLING] Merchant abc123 sem opening hours em cache - pulando
💡 [STATUS-POLLING] TIP: Call GET /merchants/abc123/opening-hours
```

**Solução:**
```bash
# Buscar opening hours pela primeira vez
curl -X GET https://app.planocertodelivery.com/api/merchants/abc123/opening-hours
```

### Problema: Status não está atualizando

**Verificações:**
1. Checar se o polling está rodando:
   ```bash
   # Logs devem mostrar ciclos a cada 30s
   grep "STATUS POLLING CYCLE" logs.txt
   ```

2. Verificar se merchant tem opening hours:
   ```sql
   SELECT merchant_id, operating_hours FROM ifood_merchants WHERE merchant_id = 'abc123';
   ```

3. Verificar token válido:
   ```sql
   SELECT user_id, expires_at FROM ifood_tokens WHERE user_id = 'user123';
   ```

### Problema: Polling muito lento

**Possível causa:** Muitos merchants sem opening hours em cache

**Solução:** Buscar opening hours para todos os merchants:
```bash
# Para cada merchant
for merchant_id in $(cat merchants.txt); do
  curl -X GET https://app.planocertodelivery.com/api/merchants/$merchant_id/opening-hours
  sleep 1
done
```

---

## 🚀 Melhorias Futuras (Opcionais)

### 1. **Scheduler automático de opening hours**
Atualizar opening hours 1x por dia automaticamente:
```typescript
// src/openingHoursScheduler.ts
schedule.scheduleJob('0 3 * * *', async () => {
  // Buscar opening hours de todos os merchants
});
```

### 2. **Cache com TTL**
Adicionar timestamp de última atualização:
```sql
ALTER TABLE ifood_merchants
ADD COLUMN operating_hours_updated_at TIMESTAMP;

-- Auto-refresh se > 24h
```

### 3. **Webhooks do iFood** (se disponível)
Se o iFood oferecer webhooks para mudanças de status:
```typescript
app.post('/webhooks/ifood/status-change', async (req, res) => {
  const { merchant_id, status } = req.body;
  await updateMerchantStatus(merchant_id, status);
  res.sendStatus(200);
});
```

---

## 📚 Arquivos Modificados

| Arquivo | Tipo de Mudança | Descrição |
|---------|-----------------|-----------|
| `src/ifoodMerchantStatusService.ts` | ✏️ Modificado | Removida busca repetida de opening hours |
| `src/statusPollingService.ts` | ✨ Novo | Novo serviço de polling otimizado |
| `src/server.ts` | ✏️ Modificado | Integração do novo serviço |
| `MUDANCAS_POLLING.md` | ✨ Novo | Esta documentação |

---

## ✅ Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Buscar opening hours de TODOS os merchants em produção
- [ ] Verificar que polling está rodando (logs a cada 30s)
- [ ] Monitorar primeiras 24h para erros
- [ ] Configurar alerta se muitos merchants sem opening hours
- [ ] Considerar implementar scheduler diário de opening hours
- [ ] Atualizar documentação da API se necessário

---

## 📞 Suporte

Se tiver problemas com as mudanças:

1. Verificar logs do servidor
2. Verificar se opening hours estão em cache (banco de dados)
3. Testar endpoint manual: `GET /merchants/:id/opening-hours`
4. Verificar tokens válidos

---

**Documento criado por:** Claude (Anthropic)
**Data:** 13 de Outubro de 2025
**Versão do sistema:** 2.2.0
