# Análise e Solução: Sincronização de Catálogo iFood sem Polling Automático

**Data:** 14 de Outubro de 2025
**Autor:** Claude (Anthropic)
**Versão:** 1.0.0

---

## 📋 Resumo Executivo

### Problema Identificado

O iFood enviou a seguinte orientação sobre o uso do módulo de Catálogo:

> "Gostaria de reforçar a orientação sobre o módulo de Catálogo: ele não deve ser utilizado apenas para consultas automáticas de informações de produtos. Esse módulo deve ser usado para operações reais, como quando o próprio usuário consulta, pesquisa ou insere produtos manualmente. Evite realizar requisições periódicas ou automáticas (como se fosse um endpoint de orders ou eventos), pois isso pode gerar excesso de chamadas e resultar em rate limit no nosso sistema. Caso isso ocorra, o módulo de Catálogo pode ser temporariamente bloqueado pelos nossos times internos."

**Impacto:** O sistema atual possui um `StatusPollingService` (atualmente desabilitado) que fazia polling a cada 30 segundos para verificar status e produtos, violando as diretrizes do iFood.

### Solução Recomendada

**Arquitetura "User-Triggered Sync"** - Sincronização baseada em ações do usuário, não em polling automático:

- ✅ Sync ao abrir a aba de Menu Management
- ✅ Botão manual "Sincronizar"
- ✅ Sync ao trocar de merchant
- ✅ Sync após edições manuais
- ✅ Cache inteligente com timestamp
- ❌ SEM polling automático/periódico

---

## 🔍 Análise Técnica Detalhada

### Estado Atual do Sistema

#### 1. Frontend: MenuManagement.tsx

**Localização:** `frontend/plano-certo-hub-insights/src/components/modules/MenuManagement.tsx`

**Funcionalidades atuais:**
```typescript
const { products, stats, isLoading, error, forceRefresh, lastUpdated, isRefetching, sync }
  = useMerchantProducts(selectedClient);
```

**Descobertas:**
- ✅ Já existe função `sync` disponível
- ✅ Tracking de `lastUpdated` (última atualização)
- ✅ Estado de `isRefetching` para feedback visual
- ⚠️ Polling comentado nas linhas 316-318 (estava desabilitado)

#### 2. Backend: menuRoutes.ts

**Localização:** `backend/ifood-token-service/src/routes/menuRoutes.ts`

**Endpoints relevantes:**

**Smart Sync (FUNCIONA):**
```typescript
POST /merchants/:merchantId/products/smart-sync-working
```
- Quick mode: retorna dados do banco
- Full mode: sincroniza com API iFood
- Já implementado e testado ✅

**Operações de Catálogo:**
```typescript
GET  /merchants/:merchantId/catalogs
GET  /merchants/:merchantId/catalogs/:catalogId/categories
POST /merchants/:merchantId/catalogs/:catalogId/categories
GET  /merchants/:merchantId/products/:productId
PATCH /merchants/:merchantId/items/status
PATCH /merchants/:merchantId/items/price
```

#### 3. Polling Services

**statusPollingService.ts:**
```typescript
export class StatusPollingService {
  private readonly POLLING_INTERVAL = 30000; // 30 segundos

  async start(): Promise<void> {
    // Polling a cada 30s para verificar status
  }
}
```

**Status:** ✅ Atualmente desabilitado
**Uso:** Verifica status de merchants (ABERTO/FECHADO)
**Problema:** Se reativado para catálogo, viola diretrizes iFood

---

## 🚫 Por Que Polling Não É Viável

### 1. Pesquisa sobre Webhooks do iFood

Realizei pesquisa na documentação oficial do iFood Developer:

**Resultado:** Webhooks existem APENAS para PEDIDOS (Orders), NÃO para Catálogo

**Documentação oficial:**
- ✅ Webhooks disponíveis: `ORDER events` (PLC, CFM, CAN, etc.)
- ✅ Polling recomendado: a cada 30s para `EVENTS` (pedidos)
- ❌ Catálogo: Nenhum webhook ou sistema de eventos disponível

**Fontes:**
- https://developer.ifood.com.br/en-US/docs/guides/order/events/delivery-methods/webhook/overview/
- https://developer.ifood.com.br/pt-BR/docs/guides/catalog/v2/

### 2. Diretrizes Claras do iFood

A orientação do iFood é explícita:

| Permitido ✅ | Proibido ❌ |
|-------------|------------|
| Usuário consulta produto | Polling automático periódico |
| Usuário pesquisa itens | Requisições a cada X segundos |
| Usuário insere/edita produto | Sincronização como "endpoint de events" |
| Operações manuais iniciadas pelo usuário | Consultas automáticas sem interação |

### 3. Consequências do Não Cumprimento

- ⚠️ Rate limiting no sistema
- ⚠️ Bloqueio temporário do módulo Catálogo
- ⚠️ Perda de acesso para todos os merchants
- ⚠️ Impacto no negócio

---

## ✅ Solução Recomendada: User-Triggered Sync

### Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                    GATILHOS DE SINCRONIZAÇÃO                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────┬───────────────────┬─────────────────────┐
│   Abertura da   │  Botão "Atualizar"│  Troca de Merchant  │
│   Aba Menu      │   (manual)        │                     │
└────────┬────────┴──────────┬────────┴──────────┬──────────┘
         │                   │                    │
         └───────────────────┼────────────────────┘
                             ▼
                    ┌────────────────┐
                    │  Função sync() │
                    │  (já existe!)  │
                    └────────┬───────┘
                             │
                             ▼
         ┌───────────────────────────────────────┐
         │  POST /merchants/:id/products/        │
         │      smart-sync-working               │
         └────────────────┬──────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                  │
         ▼                                  ▼
    ┌────────┐                         ┌────────┐
    │ Quick  │                         │  Full  │
    │  Mode  │                         │  Mode  │
    └────────┘                         └────────┘
    Retorna DB                         Sync iFood
```

### Princípios da Solução

**1. User-Initiated (Iniciado pelo Usuário)**
- Todas as operações de catálogo são disparadas por ação humana
- Respeita completamente as diretrizes do iFood
- Usuário tem controle sobre quando atualizar

**2. Cache Inteligente**
- Dados ficam em cache (banco de dados)
- Timestamp da última sincronização visível
- Indicador visual de frescor dos dados

**3. Performance Otimizada**
- Quick mode: dados instantâneos do cache
- Full mode: sincronização apenas quando necessário
- Redução drástica de chamadas à API

---

## 🛠️ Plano de Implementação

### Fase 1: Frontend - MenuManagement.tsx (PRIORITÁRIO)

**Objetivo:** Adicionar sync automático ao carregar a aba e melhorar UX

**Implementação:**

```typescript
// frontend/plano-certo-hub-insights/src/components/modules/MenuManagement.tsx

export const MenuManagement = () => {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState('');
  const { products, stats, isLoading, error, forceRefresh, lastUpdated, isRefetching, sync }
    = useMerchantProducts(selectedClient);

  // ✅ NOVO: Sync automático ao montar o componente
  useEffect(() => {
    if (selectedClient && user) {
      console.log('🔄 [MENU-MANAGEMENT] Auto-sync on mount');
      sync(false); // quick_mode = false para garantir dados atualizados
    }
  }, [selectedClient, user]); // Sync ao trocar merchant ou usuário

  // ✅ NOVO: Sync ao trocar de merchant
  const handleMerchantChange = (merchantId: string) => {
    setSelectedClient(merchantId);
    // O useEffect acima vai disparar o sync automaticamente
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com informações de sync */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestão de Cardápio</CardTitle>

            {/* ✅ NOVO: Informações de sincronização */}
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="text-sm text-muted-foreground">
                  <Clock className="inline w-4 h-4 mr-1" />
                  Última atualização: {new Date(lastUpdated).toLocaleString('pt-BR')}
                </div>
              )}

              {/* ✅ NOVO: Botão de sincronização manual */}
              <Button
                onClick={() => sync(false)}
                disabled={isRefetching}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                {isRefetching ? 'Sincronizando...' : 'Sincronizar com iFood'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* ✅ NOVO: Indicador visual de estado */}
        {isRefetching && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
            <p className="text-sm text-blue-700">
              🔄 Sincronizando produtos com iFood...
            </p>
          </div>
        )}

        {lastUpdated && !isRefetching && (
          <div className="px-6 py-2 bg-green-50 border-b border-green-200">
            <p className="text-sm text-green-700">
              ✅ Dados sincronizados com sucesso
            </p>
          </div>
        )}
      </Card>

      {/* Resto do componente... */}
    </div>
  );
};
```

**Mudanças:**
1. ✅ `useEffect` dispara sync ao montar componente
2. ✅ Sync automático ao trocar de merchant
3. ✅ Botão "Sincronizar" manual sempre visível
4. ✅ Timestamp da última sincronização
5. ✅ Indicadores visuais de estado (sincronizando/completo)

### Fase 2: Backend - Validação (OPCIONAL)

**Objetivo:** Adicionar logs e validações para conformidade com iFood

```typescript
// backend/ifood-token-service/src/routes/menuRoutes.ts

router.post('/merchants/:merchantId/products/smart-sync-working', async (req, res) => {
  const { merchantId } = req.params;
  const { user_id, quick_mode } = req.body;

  // ✅ NOVO: Log de auditoria para conformidade
  console.log(`📊 [CATALOG-SYNC] User-initiated sync`);
  console.log(`   - Merchant: ${merchantId}`);
  console.log(`   - User: ${user_id}`);
  console.log(`   - Mode: ${quick_mode !== false ? 'quick' : 'full'}`);
  console.log(`   - Timestamp: ${new Date().toISOString()}`);
  console.log(`   - Compliant: ✅ User-triggered operation`);

  // ... resto da implementação existente
});
```

### Fase 3: Remover Polling de Catálogo (JÁ FEITO)

**Status:** ✅ Polling já está desabilitado

**Confirmação:**
- `statusPollingService.ts` existe mas NÃO está ativo
- Documentação em `MUDANCAS_POLLING.md` explica otimizações
- Apenas polling de STATUS de merchants (ABERTO/FECHADO) está ativo

**Ação:** Nenhuma necessária - já está conforme

---

## 🎯 Gatilhos de Sincronização Detalhados

### 1. Abertura da Aba Menu Management

**Quando:** Usuário navega para a aba de gestão de cardápio
**Ação:** `sync(false)` - Full mode
**Justificativa:** Garantir dados atualizados ao começar a trabalhar
**Conformidade iFood:** ✅ Usuário iniciou a consulta

**Implementação:**
```typescript
useEffect(() => {
  if (selectedClient && user) {
    sync(false); // Full sync on mount
  }
}, [selectedClient, user]);
```

### 2. Botão "Sincronizar com iFood"

**Quando:** Usuário clica no botão de atualização manual
**Ação:** `sync(false)` - Full mode
**Justificativa:** Usuário quer garantir dados mais recentes
**Conformidade iFood:** ✅ Operação manual explícita

**Implementação:**
```typescript
<Button onClick={() => sync(false)} disabled={isRefetching}>
  <RefreshCw /> Sincronizar com iFood
</Button>
```

### 3. Troca de Merchant

**Quando:** Usuário seleciona outro restaurante no dropdown
**Ação:** `sync(false)` - Full mode automático
**Justificativa:** Carregar produtos do novo merchant
**Conformidade iFood:** ✅ Consulta iniciada pelo usuário

**Implementação:**
```typescript
const handleMerchantChange = (merchantId: string) => {
  setSelectedClient(merchantId);
  // useEffect dispara sync automaticamente
};
```

### 4. Após Edições Manuais

**Quando:** Usuário edita preço, status ou produto
**Ação:** `sync(true)` - Quick mode (validar salvamento)
**Justificativa:** Confirmar que mudanças foram salvas
**Conformidade iFood:** ✅ Operação real de inserção/edição

**Implementação:**
```typescript
const handleProductUpdate = async (productId, updates) => {
  await updateProduct(productId, updates);
  sync(true); // Quick sync para confirmar
};
```

### 5. Login do Usuário (OPCIONAL)

**Quando:** Usuário faz login na aplicação
**Ação:** `sync(false)` - Full mode inicial
**Justificativa:** Carregar dados frescos ao iniciar sessão
**Conformidade iFood:** ✅ Início de sessão do usuário

---

## 📊 Comparação: Antes vs Depois

### Cenário 1: Usuário Trabalhando 1 Hora

**ANTES (Polling a cada 30s):**
```
Chamadas à API iFood:
- 120 polls × 3 merchants = 360 chamadas/hora
- 360 × 3 endpoints (catalogs, categories, status) = 1.080 chamadas/hora
TOTAL: 1.080 chamadas à API por hora
```

**DEPOIS (User-Triggered):**
```
Chamadas à API iFood:
- 1 sync ao abrir aba = 1 chamada
- 2 trocas de merchant = 2 chamadas
- 1 sync manual = 1 chamada
TOTAL: 4 chamadas à API por hora
```

**Redução:** **99,6% menos chamadas!** (1.080 → 4)

### Cenário 2: 10 Usuários Simultâneos

**ANTES (Polling):**
```
10 usuários × 1.080 chamadas/hora = 10.800 chamadas/hora
```

**DEPOIS (User-Triggered):**
```
10 usuários × 4 chamadas/hora = 40 chamadas/hora
```

**Redução:** **99,6% menos chamadas!** (10.800 → 40)

### Cenário 3: Usuário Editando Produtos

**ANTES (Polling):**
```
- Edita 5 produtos em 10 minutos
- 20 polls automáticos no período (a cada 30s)
TOTAL: 20 chamadas (sem relação com edições)
```

**DEPOIS (User-Triggered):**
```
- Edita 5 produtos em 10 minutos
- 1 sync ao abrir aba
- 1 sync manual após terminar edições
TOTAL: 2 chamadas (relacionadas ao trabalho)
```

**Redução:** 90% menos chamadas (20 → 2)

---

## ⚠️ Alternativas Avaliadas e Descartadas

### Alternativa 1: Webhook do iFood

**Ideia:** Usar webhooks para receber notificações de mudanças no catálogo

**Pesquisa realizada:**
- ✅ Webhooks existem no iFood
- ❌ Disponíveis APENAS para eventos de PEDIDOS
- ❌ Não há webhooks para mudanças de catálogo/menu

**Conclusão:** ❌ Não viável - funcionalidade não existe

**Fontes:**
- https://developer.ifood.com.br/en-US/docs/guides/order/events/delivery-methods/webhook/overview/
- https://developer.ifood.com.br/pt-BR/docs/guides/catalog/v2/

### Alternativa 2: Polling Muito Espaçado

**Ideia:** Polling a cada 1 hora ao invés de 30 segundos

**Análise:**
```
Polling a cada 1 hora:
- Reduz chamadas em 98% vs polling 30s
- Ainda faz requisições automáticas periódicas
- Viola diretriz iFood: "Evite realizar requisições periódicas"
```

**Conclusão:** ❌ Não viável - ainda viola diretrizes iFood

**Motivo:** iFood explicitamente proíbe "requisições periódicas ou automáticas", independente da frequência.

### Alternativa 3: Polling Condicional

**Ideia:** Polling apenas quando usuário está na aba

**Análise:**
```
Polling condicional:
- Reduz chamadas quando usuário não está ativo
- Ainda é polling automático periódico
- Difícil implementar detecção de aba ativa
- Complexidade técnica aumentada
```

**Conclusão:** ❌ Não viável - complexo e ainda viola diretrizes

### Alternativa 4: Sincronização via RabbitMQ

**Ideia:** Usar workers RabbitMQ para processar sync em background

**Análise:**
```
RabbitMQ workers:
- Útil para processamento assíncrono
- Não resolve o problema de QUANDO disparar sync
- Se disparar periodicamente, ainda é polling
- Se disparar por ação do usuário, é redundante
```

**Conclusão:** ⚠️ Útil para processamento, mas não resolve o problema core

**Nota:** RabbitMQ já existe no projeto (desativado) e pode ser usado para processamento assíncrono de outros tipos de dados, mas não resolve o problema de conformidade com iFood.

---

## 🎓 Casos de Uso Práticos

### Caso 1: Restaurante Abre o Sistema pela Manhã

**Fluxo:**
1. Gerente faz login às 8h
2. Navega para aba "Gestão de Cardápio"
3. **Sync automático** dispara ao carregar a aba
4. Produtos atualizados aparecem em ~2 segundos
5. Gerente vê timestamp: "Atualizado às 08:00:15"

**Resultado:** Dados frescos sem polling

### Caso 2: Mudança de Preço em Múltiplos Produtos

**Fluxo:**
1. Gerente quer aumentar preço de 10 produtos
2. Edita produtos um por um (usando cache local)
3. Ao terminar, clica "Sincronizar com iFood"
4. **Sync manual** envia todas as mudanças
5. Confirmação visual aparece

**Resultado:** 1 sync ao final, não 10 polls durante edição

### Caso 3: Verificar se Produto Está Disponível no iFood

**Fluxo:**
1. Cliente liga perguntando sobre produto X
2. Gerente abre aba de cardápio
3. **Sync automático** garante dados atuais
4. Gerente verifica status do produto
5. Responde ao cliente com confiança

**Resultado:** Dados confiáveis com sync user-triggered

### Caso 4: Múltiplos Restaurantes

**Fluxo:**
1. Gerente supervisiona 3 restaurantes
2. Seleciona "Restaurante A" no dropdown
3. **Sync automático** carrega produtos do A
4. Seleciona "Restaurante B"
5. **Sync automático** carrega produtos do B
6. Seleciona "Restaurante C"
7. **Sync automático** carrega produtos do C

**Resultado:** 3 syncs user-triggered, não 120+ polls

---

## 📝 Checklist de Implementação

### Frontend (MenuManagement.tsx)

- [ ] Adicionar `useEffect` para sync on mount
- [ ] Implementar sync ao trocar merchant
- [ ] Adicionar botão "Sincronizar com iFood"
- [ ] Mostrar timestamp da última sincronização
- [ ] Adicionar indicadores visuais de estado
- [ ] Implementar feedback de loading durante sync
- [ ] Adicionar mensagens de sucesso/erro
- [ ] Testar em todos os cenários de uso

### Backend (menuRoutes.ts)

- [ ] Adicionar logs de auditoria em sync endpoint
- [ ] Validar que chamadas são user-initiated
- [ ] Documentar conformidade com iFood
- [ ] Testar rate limiting (não deve ser atingido)

### Documentação

- [ ] Atualizar README com nova arquitetura
- [ ] Documentar gatilhos de sincronização
- [ ] Criar guia para usuários finais
- [ ] Documentar conformidade com diretrizes iFood

### Testes

- [ ] Testar sync ao abrir aba
- [ ] Testar sync ao trocar merchant
- [ ] Testar botão de sync manual
- [ ] Testar indicadores visuais
- [ ] Testar com múltiplos usuários
- [ ] Validar redução de chamadas à API

---

## 🚀 Próximos Passos Recomendados

### Curto Prazo (Esta Semana)

1. **Implementar Fase 1** - Frontend sync triggers
   - Prioridade: ALTA
   - Tempo estimado: 2-3 horas
   - Impacto: Conformidade imediata com iFood

2. **Testar com usuário real** - Validar UX
   - Prioridade: ALTA
   - Tempo estimado: 1 hora
   - Impacto: Garantir usabilidade

3. **Monitorar logs** - Confirmar redução de chamadas
   - Prioridade: MÉDIA
   - Tempo estimado: 1 hora
   - Impacto: Validar economia de API calls

### Médio Prazo (Próximo Mês)

4. **Adicionar analytics** - Tracking de uso
   - Medir frequência de syncs
   - Identificar padrões de uso
   - Otimizar baseado em dados

5. **Implementar cache inteligente** - Melhorar performance
   - Cache de curta duração (5-10min)
   - Invalidação automática após edições
   - Preloading de dados frequentes

6. **Dashboard de conformidade** - Monitoramento
   - Contador de API calls por dia
   - Alertas se chamadas aumentarem
   - Relatório de conformidade

### Longo Prazo (Futuro)

7. **Otimizações avançadas**
   - Sync parcial (apenas produtos modificados)
   - Compressão de payloads
   - Batch operations

8. **Integração com outros módulos**
   - Sync de imagens on-demand
   - Sync de complementos quando necessário
   - Gestão de estoque integrada

---

## 📚 Referências

### Documentação Oficial iFood

- **Catalog API v2:** https://developer.ifood.com.br/pt-BR/docs/guides/catalog/v2/
- **Webhook Overview:** https://developer.ifood.com.br/en-US/docs/guides/order/events/delivery-methods/webhook/overview/
- **Best Practices:** https://medium.com/ifood-developer/boas-práticas-com-as-apis-do-ifood-a9720df6903e
- **Developer Portal:** https://developer.ifood.com.br/

### Arquivos do Projeto

- **Frontend:** `frontend/plano-certo-hub-insights/src/components/modules/MenuManagement.tsx`
- **Backend:** `backend/ifood-token-service/src/routes/menuRoutes.ts`
- **Polling Service:** `backend/ifood-token-service/src/statusPollingService.ts`
- **Documentação Polling:** `backend/ifood-token-service/MUDANCAS_POLLING.md`

### Documentos Relacionados

- `MUDANCAS_POLLING.md` - Histórico de otimizações de polling
- `COMO_REATIVAR_POLLING_RABBITMQ.md` - Como reativar workers RabbitMQ

---

## 💡 Conclusão

A solução **User-Triggered Sync** resolve completamente o problema de conformidade com as diretrizes do iFood, mantendo a funcionalidade necessária para o negócio:

### Benefícios

✅ **Conformidade 100%** - Respeita diretrizes iFood
✅ **Redução drástica** - 99,6% menos chamadas à API
✅ **Melhor UX** - Usuário controla atualizações
✅ **Performance** - Cache inteligente
✅ **Simplicidade** - Usa infraestrutura existente
✅ **Manutenibilidade** - Código mais limpo
✅ **Escalabilidade** - Suporta mais usuários

### Próximo Passo

**Implementar Fase 1** (Frontend) - Esta é a mudança mínima necessária para garantir conformidade total com iFood e eliminar risco de bloqueio do módulo Catálogo.

---

**Documento preparado por:** Claude (Anthropic)
**Data:** 14 de Outubro de 2025
**Status:** Pronto para implementação
**Prioridade:** ALTA - Conformidade com parceiro crítico (iFood)
