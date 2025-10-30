# Análise Completa do Módulo de Merchants - iFood Integration Hub

**Data**: 2025-10-15
**Versão**: 1.0.0
**Objetivo**: Documentação completa para replicação exata em outra aplicação

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Endpoints da API](#endpoints-da-api)
4. [Modelos de Dados](#modelos-de-dados)
5. [Serviços Backend](#serviços-backend)
6. [Integração Frontend](#integração-frontend)
7. [Autenticação e Tokens](#autenticação-e-tokens)
8. [Guia de Implementação Passo a Passo](#guia-de-implementação-passo-a-passo)

---

## 🎯 Visão Geral

O módulo de **Merchants** gerencia toda a interação com lojas (restaurantes) do iFood, incluindo:
- Listagem de lojas
- Detalhes individuais de lojas
- Status de funcionamento (aberto/fechado)
- Horários de funcionamento
- Interrupções/pausas programadas

### Stack Tecnológica

**Backend:**
- TypeScript/Node.js com Express
- Supabase (PostgreSQL)
- Axios para chamadas HTTP
- iFood Merchant API v1.0

**Frontend:**
- React/TypeScript
- TanStack Query (React Query)
- Supabase Client

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │
         │ HTTP Requests
         ▼
┌─────────────────────────────────┐
│   Backend API                   │
│   (Express + TypeScript)        │
│                                 │
│   Routes:                       │
│   - merchantRoutes.ts           │
│   - interruptionRoutes.ts       │
│   - openingHoursRoutes.ts       │
│                                 │
│   Services:                     │
│   - ifoodMerchantService.ts     │
│   - ifoodMerchantStatusService  │
│   - ifoodTokenService.ts        │
└──────────┬─────────┬────────────┘
           │         │
           │         │ Supabase Client
           │         ▼
           │   ┌────────────────┐
           │   │   PostgreSQL   │
           │   │   (Supabase)   │
           │   │                │
           │   │ Tables:        │
           │   │ - ifood_merchants
           │   │ - ifood_tokens │
           │   │ - ifood_interruptions
           │   └────────────────┘
           │
           │ iFood API
           ▼
    ┌──────────────────┐
    │   iFood API      │
    │   Merchant v1.0  │
    └──────────────────┘
```

---

## 🔌 Endpoints da API

### 1. **GET /merchants** - Listar Lojas

**Descrição**: Retorna todas as lojas armazenadas no banco de dados.

**Arquivo**: `backend/ifood-token-service/src/routes/merchantRoutes.ts:253`

**Request**:
```http
GET http://localhost:8085/merchants
```

**Response Success (200)**:
```json
{
  "success": true,
  "merchants": [
    {
      "merchant_id": "e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d",
      "name": "Restaurante Exemplo",
      "corporate_name": "Restaurante Exemplo LTDA",
      "status": true,
      "phone": "+5511999999999",
      "address_city": "São Paulo",
      "address_state": "SP",
      "last_sync_at": "2025-10-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

**Implementação Backend**:
```typescript
router.get('/merchants', async (req, res) => {
  const merchantService = new IFoodMerchantService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const result = await merchantService.getAllMerchantsFromDB();

  if (result.success) {
    res.json({
      success: true,
      merchants: result.merchants || [],
      total: result.merchants?.length || 0
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || 'Erro ao obter lista de merchants'
    });
  }
});
```

**Serviço Backend** (`ifoodMerchantService.ts:957`):
```typescript
async getAllMerchantsFromDB(): Promise<{
  success: boolean;
  merchants?: any[];
  error?: string
}> {
  const { data, error } = await this.supabase
    .from('ifood_merchants')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return { success: false, error: `Erro: ${error.message}` };
  }

  return { success: true, merchants: data || [] };
}
```

---

### 2. **GET /merchants/:merchantId** - Detalhes da Loja

**Descrição**: Retorna detalhes de uma loja específica. Primeiro busca no banco; se não encontrar, busca na API iFood e salva.

**Arquivo**: `backend/ifood-token-service/src/routes/merchantRoutes.ts:287`

**Request**:
```http
GET http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d
```

**Query Parameters (Opcional)**:
- `user_id`: ID do usuário (opcional, usa token disponível se não fornecido)

**Response Success (200)**:
```json
{
  "success": true,
  "merchant": {
    "id": "e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d",
    "name": "Restaurante Exemplo",
    "corporateName": "Restaurante Exemplo LTDA",
    "phone": "+5511999999999",
    "description": "Descrição do restaurante",
    "address": {
      "street": "Rua Exemplo",
      "number": "123",
      "complement": "Apto 45",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01234-567",
      "country": "BR"
    },
    "status": true,
    "lastSyncAt": "2025-10-15T10:30:00Z"
  },
  "action": "found_in_db"
}
```

**Possíveis Actions**:
- `found_in_db`: Merchant já existia no banco de dados
- `added_from_api`: Merchant foi buscado da API iFood e salvo no banco

**Implementação Backend**:
```typescript
router.get('/merchants/:merchantId', async (req, res) => {
  const { merchantId } = req.params;
  const { user_id } = req.query;

  // Usa qualquer token disponível
  const tokenInfo = await getAnyAvailableToken();

  if (!tokenInfo) {
    return res.status(401).json({
      error: 'Nenhum token encontrado no banco de dados'
    });
  }

  const merchantService = new IFoodMerchantService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const effectiveUserId = (user_id as string) || tokenInfo.user_id;
  const result = await merchantService.getMerchantDetail(
    merchantId,
    tokenInfo.access_token,
    effectiveUserId
  );

  if (result.success) {
    res.json({
      success: true,
      merchant: result.merchant,
      action: result.action || 'fetched_from_api'
    });
  } else {
    res.status(404).json({
      success: false,
      error: result.error || 'Erro ao obter detalhes do merchant'
    });
  }
});
```

**Lógica do Serviço** (`ifoodMerchantService.ts:394-647`):

1. **Verificar Banco de Dados**:
```typescript
const existsInDb = await this.checkMerchantExists(merchantId);

if (existsInDb) {
  // Buscar dados existentes
  const { data: existingMerchant } = await this.supabase
    .from('ifood_merchants')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('user_id', userId)
    .single();

  return {
    success: true,
    merchant: mapToMerchantFormat(existingMerchant),
    action: 'found_in_db'
  };
}
```

2. **Buscar da API iFood**:
```typescript
const individualUrl = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}`;

const response = await axios.get(individualUrl, {
  headers: {
    'accept': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  }
});

apiMerchant = response.data;
```

3. **Salvar no Banco**:
```typescript
const merchantForDb: MerchantData = {
  merchant_id: apiMerchant.id,
  name: apiMerchant.name,
  corporate_name: apiMerchant.corporateName || '',
  user_id: userId,
  client_id: clientId,
  status: true,
  phone: apiMerchant.phone || null,
  description: apiMerchant.description || null,
  // ... address fields
  last_sync_at: new Date().toISOString()
};

await this.storeMerchant(merchantForDb);
```

---

### 3. **GET /merchants/:merchantId/status** - Status da Loja

**Descrição**: Retorna o status atual do merchant no iFood (aberto/fechado).

**Arquivo**: `backend/ifood-token-service/src/routes/merchantRoutes.ts:338`

**Request**:
```http
GET http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/status
```

**Response Success (200)**:
```json
{
  "success": true,
  "merchant_id": "e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d",
  "status": {
    "state": "OPEN",
    "available": true,
    "acceptingOrders": true
  },
  "timestamp": "2025-10-15T10:30:00Z"
}
```

**Implementação Backend**:
```typescript
router.get('/merchants/:merchantId/status', async (req, res) => {
  const { merchantId } = req.params;

  const tokenInfo = await getAnyAvailableToken();

  if (!tokenInfo) {
    return res.status(401).json({
      error: 'Nenhum token encontrado no banco de dados'
    });
  }

  const { IFoodMerchantStatusService } = await import('../ifoodMerchantStatusService');
  const result = await IFoodMerchantStatusService.fetchMerchantStatus(
    merchantId,
    tokenInfo.access_token
  );

  if (result.success) {
    res.json({
      success: true,
      merchant_id: merchantId,
      status: result.data,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.data?.error || 'Erro ao obter status'
    });
  }
});
```

**Serviço Status** (`ifoodMerchantStatusService.ts:95-115`):
```typescript
static async fetchMerchantStatus(
  merchantId: string,
  accessToken: string
): Promise<{ success: boolean; data: any }> {
  try {
    const response = await axios.get(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/status`,
      {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, data: { error: error.message } };
  }
}
```

---

### 4. **POST /merchants/:merchantId/interruptions** - Criar Interrupção

**Descrição**: Cria uma pausa programada para o merchant.

**Arquivo**: `backend/ifood-token-service/src/routes/interruptionRoutes.ts:46`

**Request**:
```http
POST http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/interruptions
Content-Type: application/json

{
  "startDate": "2025-10-15T14:00:00Z",
  "endDate": "2025-10-15T18:00:00Z",
  "description": "Pausa para manutenção",
  "reason": "MAINTENANCE",
  "userId": "user-uuid-here"
}
```

**Campos Obrigatórios**:
- `startDate` (string, ISO format): Data/hora de início
- `endDate` (string, ISO format): Data/hora de término
- `description` (string): Descrição da interrupção
- `userId` (string, UUID): ID do usuário

**Campos Opcionais**:
- `reason` (string): Motivo da pausa

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Interrupção criada com sucesso",
  "data": {
    "id": "interruption-id-from-ifood",
    "startDate": "2025-10-15T14:00:00Z",
    "endDate": "2025-10-15T18:00:00Z",
    "description": "Pausa para manutenção",
    "isActive": true
  }
}
```

**Implementação Backend**:
```typescript
router.post('/merchants/:merchantId/interruptions', async (req, res) => {
  const { merchantId } = req.params;
  const { reason, startDate, endDate, description, userId } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: 'startDate e endDate são obrigatórios'
    });
  }

  const tokenInfo = await getAnyAvailableToken();

  if (!tokenInfo) {
    return res.status(404).json({
      error: 'Nenhum token iFood disponível'
    });
  }

  const result = await IFoodMerchantStatusService.createScheduledPause(
    merchantId,
    startDate,
    endDate,
    description || reason || 'Pausa programada',
    tokenInfo.access_token,
    userId,
    reason
  );

  if (result.success) {
    res.json({
      success: true,
      message: 'Interrupção criada com sucesso',
      data: result.data
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || 'Erro ao criar interrupção'
    });
  }
});
```

**Serviço Interruption** (`ifoodMerchantStatusService.ts:491-593`):
```typescript
static async createScheduledPause(
  merchantId: string,
  startDate: string,
  endDate: string,
  description: string,
  accessToken: string,
  userId: string,
  reason?: string
): Promise<{success: boolean; message: string; interruptionId?: string}> {

  // Ajustar timezone para horário do Brasil (UTC-3)
  const startUTC = new Date(startDate);
  const endUTC = new Date(endDate);
  const startBrazil = new Date(startUTC.getTime() - 3 * 60 * 60 * 1000);
  const endBrazil = new Date(endUTC.getTime() - 3 * 60 * 60 * 1000);

  const requestBody = {
    start: startBrazil.toISOString(),
    end: endBrazil.toISOString(),
    description: description,
    ...(reason && { reason })
  };

  // POST para iFood API
  const response = await axios.post(
    `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/interruptions`,
    requestBody,
    {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  const interruptionId = response.data?.id || response.data?.interruptionId;

  // Salvar no banco local
  await supabase
    .from('ifood_interruptions')
    .insert({
      user_id: userId,
      merchant_id: merchantId,
      ifood_interruption_id: interruptionId,
      start_date: startBrazil.toISOString(),
      end_date: endBrazil.toISOString(),
      description: description,
      reason: reason || null,
      is_active: true
    });

  return {
    success: true,
    message: `Pausa programada criada com sucesso`,
    interruptionId: interruptionId
  };
}
```

---

### 5. **GET /merchants/:merchantId/interruptions** - Listar Interrupções

**Descrição**: Lista todas as interrupções de um merchant.

**Arquivo**: `backend/ifood-token-service/src/routes/interruptionRoutes.ts:9`

**Request**:
```http
GET http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/interruptions
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Interrupções listadas com sucesso",
  "interruptions": [
    {
      "id": "interruption-ifood-id",
      "startDate": "2025-10-15T14:00:00Z",
      "endDate": "2025-10-15T18:00:00Z",
      "description": "Pausa para manutenção",
      "reason": "MAINTENANCE",
      "isActive": true
    }
  ]
}
```

**Implementação**:
```typescript
router.get('/merchants/:merchantId/interruptions', async (req, res) => {
  const { merchantId } = req.params;

  const result = await IFoodMerchantStatusService.listScheduledPauses(merchantId);

  if (result.success) {
    res.json({
      success: true,
      message: 'Interrupções listadas com sucesso',
      interruptions: result.data || []
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || 'Erro ao listar interrupções'
    });
  }
});
```

**Serviço** (`ifoodMerchantStatusService.ts:597-663`):
```typescript
static async listScheduledPauses(
  merchantId: string
): Promise<{success: boolean; data: any[]; message?: string}> {

  // Buscar do banco local
  const { data: localPauses, error: dbError } = await supabase
    .from('ifood_interruptions')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (dbError) {
    return {
      success: false,
      data: [],
      message: `Database error: ${dbError.message}`
    };
  }

  // Transformar dados
  const transformedData = (localPauses || []).map(pause => {
    const endDate = new Date(pause.end_date);
    const now = new Date();
    const isActive = pause.is_active && endDate > now;

    return {
      id: pause.ifood_interruption_id || pause.id,
      startDate: pause.start_date,
      endDate: pause.end_date,
      description: pause.description,
      reason: pause.reason,
      isActive: isActive
    };
  });

  return {
    success: true,
    data: transformedData
  };
}
```

---

### 6. **DELETE /merchants/:merchantId/interruptions/:interruptionId** - Remover Interrupção

**Descrição**: Remove uma interrupção específica.

**Arquivo**: `backend/ifood-token-service/src/routes/interruptionRoutes.ts:98`

**Request**:
```http
DELETE http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/interruptions/interruption-id
```

**Response Success (200)**:
```json
{
  "success": true,
  "message": "Interrupção deletada com sucesso",
  "data": {}
}
```

**Implementação**:
```typescript
router.delete('/merchants/:merchantId/interruptions/:interruptionId', async (req, res) => {
  const { merchantId, interruptionId } = req.params;

  if (!merchantId || !interruptionId) {
    return res.status(400).json({
      success: false,
      error: 'Parameters merchantId and interruptionId are required'
    });
  }

  const tokenInfo = await getAnyAvailableToken();

  if (!tokenInfo) {
    return res.status(404).json({
      error: 'Nenhum token iFood disponível'
    });
  }

  const result = await IFoodMerchantStatusService.removeScheduledPause(
    merchantId,
    interruptionId,
    tokenInfo.access_token
  );

  if (result.success) {
    res.json({
      success: true,
      message: 'Interrupção deletada com sucesso',
      data: result.data
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || 'Erro ao deletar interrupção'
    });
  }
});
```

**Serviço** (`ifoodMerchantStatusService.ts:667-721`):
```typescript
static async removeScheduledPause(
  merchantId: string,
  interruptionId: string,
  accessToken: string
): Promise<{success: boolean; message: string}> {

  // Remover da API iFood
  try {
    await axios.delete(
      `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/interruptions/${interruptionId}`,
      {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
  } catch (apiError: any) {
    console.warn(`Failed to remove from iFood API (will still remove locally)`);
  }

  // Remover do banco local
  const { error: dbError } = await supabase
    .from('ifood_interruptions')
    .delete()
    .eq('merchant_id', merchantId)
    .or(`ifood_interruption_id.eq.${interruptionId},id.eq.${interruptionId}`);

  if (dbError) {
    return {
      success: false,
      message: `Erro ao remover: ${dbError.message}`
    };
  }

  return {
    success: true,
    message: 'Pausa programada removida com sucesso'
  };
}
```

---

### 7. **GET /merchants/:merchantId/opening-hours** - Listar Horários

**Descrição**: Busca os horários de funcionamento do merchant da API iFood e salva automaticamente no banco.

**Arquivo**: `backend/ifood-token-service/src/routes/openingHoursRoutes.ts:9`

**Request**:
```http
GET http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/opening-hours
```

**Response Success (200)**:
```json
{
  "message": "Horários de funcionamento listados e salvos com sucesso",
  "data": [
    {
      "id": "shift-id-from-ifood",
      "dayOfWeek": "MONDAY",
      "start": "08:00:00",
      "end": "18:00:00",
      "duration": 600
    },
    {
      "dayOfWeek": "TUESDAY",
      "start": "08:00:00",
      "duration": 600
    }
  ],
  "saved_to_database": true
}
```

**Formato dos Dias da Semana**:
- `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY`

**Implementação**:
```typescript
router.get('/merchants/:merchantId/opening-hours', async (req, res) => {
  const { merchantId } = req.params;

  const tokenInfo = await getAnyAvailableToken();

  if (!tokenInfo) {
    return res.status(404).json({
      error: 'Nenhum token iFood disponível'
    });
  }

  const result = await IFoodMerchantStatusService.fetchOpeningHours(
    merchantId,
    tokenInfo.access_token
  );

  if (result.success) {
    // AUTO-SAVE: Salvar no banco automaticamente
    const saveResult = await IFoodMerchantStatusService.saveOpeningHoursToDatabase(
      merchantId,
      result.hours
    );

    res.json({
      message: 'Horários listados e salvos com sucesso',
      data: result.hours,
      saved_to_database: saveResult
    });
  } else {
    res.status(500).json({
      error: 'Erro ao listar horários'
    });
  }
});
```

**Serviço** (`ifoodMerchantStatusService.ts:119-161`):
```typescript
static async fetchOpeningHours(
  merchantId: string,
  accessToken: string
): Promise<{ success: boolean; hours: OpeningHours[] }> {

  const response = await axios.get(
    `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/opening-hours`,
    {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  const data = response.data;
  let hours: OpeningHours[] = [];

  // Extrair shifts/periods
  if (data.shifts) {
    hours = data.shifts;
  } else if (data.periods) {
    hours = data.periods;
  } else if (Array.isArray(data)) {
    hours = data;
  }

  return { success: true, hours };
}
```

**Salvamento Automático** (`ifoodMerchantStatusService.ts:291-337`):
```typescript
static async saveOpeningHoursToDatabase(
  merchantId: string,
  shifts: OpeningHours[]
): Promise<boolean> {

  // Criar mapeamento por dia
  const byDay: { [key: string]: string } = {};
  shifts.forEach(shift => {
    if (shift.id) {
      byDay[shift.dayOfWeek] = shift.id;
    }
  });

  const operatingHours = {
    shifts: shifts,
    by_day: byDay,
    last_updated: new Date().toISOString()
  };

  // Atualizar no banco
  const { error } = await supabase
    .from('ifood_merchants')
    .update({ operating_hours: operatingHours })
    .eq('merchant_id', merchantId);

  if (error) {
    console.error(`Error saving opening hours: ${error.message}`);
    return false;
  }

  return true;
}
```

---

### 8. **PUT /merchants/:merchantId/opening-hours** - Criar/Atualizar Horário

**Descrição**: Cria ou atualiza horário de funcionamento para um dia específico.

**Arquivo**: `backend/ifood-token-service/src/routes/openingHoursRoutes.ts:56`

**Request**:
```http
PUT http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/opening-hours
Content-Type: application/json

{
  "dayOfWeek": "MONDAY",
  "startTime": "08:00:00",
  "endTime": "18:00:00"
}
```

**Campos Obrigatórios**:
- `dayOfWeek` (string): Dia da semana (`MONDAY`, `TUESDAY`, etc.)
- `startTime` (string): Horário de abertura (formato `HH:MM:SS` ou `HH:MM`)
- `endTime` (string): Horário de fechamento (formato `HH:MM:SS` ou `HH:MM`)

**Response Success (200)**:
```json
{
  "message": "Horários de funcionamento atualizados com sucesso",
  "data": {
    "merchantId": "e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d",
    "dayOfWeek": "MONDAY",
    "startTime": "08:00:00",
    "endTime": "18:00:00"
  }
}
```

**Implementação**:
```typescript
router.put('/merchants/:merchantId/opening-hours', async (req, res) => {
  const { merchantId } = req.params;
  const { dayOfWeek, startTime, endTime } = req.body;

  // Validações
  if (!dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({
      error: 'dayOfWeek, startTime e endTime são obrigatórios'
    });
  }

  const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  if (!validDays.includes(dayOfWeek)) {
    return res.status(400).json({
      error: 'dayOfWeek deve ser: ' + validDays.join(', ')
    });
  }

  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return res.status(400).json({
      error: 'Horários devem estar no formato HH:MM ou HH:MM:SS'
    });
  }

  const tokenInfo = await getAnyAvailableToken();

  if (!tokenInfo) {
    return res.status(404).json({
      error: 'Nenhum token iFood disponível'
    });
  }

  // Garantir formato HH:MM:SS
  const formatTime = (time: string) => {
    return time.includes(':') && time.split(':').length === 2 ? `${time}:00` : time;
  };

  const result = await IFoodMerchantStatusService.updateOpeningHours(
    merchantId,
    dayOfWeek,
    formatTime(startTime),
    formatTime(endTime),
    tokenInfo.access_token
  );

  if (result.success) {
    res.json({
      message: result.message || 'Horários atualizados com sucesso',
      data: {
        merchantId,
        dayOfWeek,
        startTime: formatTime(startTime),
        endTime: formatTime(endTime)
      }
    });
  } else {
    res.status(500).json({
      error: result.message || 'Erro ao atualizar horários'
    });
  }
});
```

**Serviço** (`ifoodMerchantStatusService.ts:341-467`):
```typescript
static async updateOpeningHours(
  merchantId: string,
  dayOfWeek: string,
  startTime: string,
  endTime: string,
  accessToken: string
): Promise<{success: boolean; message: string}> {

  // 1. Buscar horários existentes do banco
  const { data: merchant } = await supabase
    .from('ifood_merchants')
    .select('operating_hours')
    .eq('merchant_id', merchantId)
    .single();

  if (!merchant) {
    return {
      success: false,
      message: 'Merchant not found'
    };
  }

  // 2. Calcular duração em minutos
  const duration = this.calculateDuration(startTime, endTime);

  if (duration <= 0) {
    return {
      success: false,
      message: 'Invalid time range'
    };
  }

  // 3. Pegar horários existentes
  let existingShifts: any[] = [];
  if (merchant.operating_hours?.shifts) {
    existingShifts = [...merchant.operating_hours.shifts];
  }

  // 4. Verificar se já existe para este dia
  const existingDayIndex = existingShifts.findIndex(
    shift => shift.dayOfWeek === dayOfWeek
  );

  if (existingDayIndex >= 0) {
    // Atualizar existente
    existingShifts[existingDayIndex] = {
      dayOfWeek: dayOfWeek,
      start: startTime,
      duration: duration
    };
  } else {
    // Adicionar novo
    existingShifts.push({
      dayOfWeek: dayOfWeek,
      start: startTime,
      duration: duration
    });
  }

  // 5. Preparar body com TODOS os horários
  const putBody = {
    storeId: merchantId,
    shifts: existingShifts
  };

  // 6. PUT para iFood API
  await axios.put(
    `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/opening-hours`,
    putBody,
    {
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  // 7. Atualizar banco local
  await supabase
    .from('ifood_merchants')
    .update({
      operating_hours: { shifts: existingShifts },
      updated_at: new Date().toISOString()
    })
    .eq('merchant_id', merchantId);

  return {
    success: true,
    message: `Opening hours updated successfully for ${dayOfWeek}`
  };
}
```

---

## 📊 Modelos de Dados

### Tabela: `ifood_merchants`

**Arquivo Schema**: `frontend/plano-certo-hub-insights/supabase/migrations/20250715000000-create-ifood-merchants-table.sql`

```sql
CREATE TABLE ifood_merchants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  corporate_name TEXT,
  description TEXT,
  status BOOLEAN NOT NULL DEFAULT false,  -- true = aberto, false = fechado
  cuisine_types TEXT[],
  phone TEXT,

  -- Endereço
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip_code TEXT,
  address_country TEXT,

  -- Horários de funcionamento (JSONB)
  operating_hours JSONB,

  -- Métodos
  delivery_methods TEXT[],
  payment_methods TEXT[],

  -- Métricas
  average_delivery_time INTEGER,
  minimum_order_value DECIMAL(10,2),
  delivery_fee DECIMAL(10,2),

  -- Relacionamentos
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_merchant_per_user UNIQUE (merchant_id, user_id)
);

-- Índices
CREATE INDEX idx_ifood_merchants_user_id ON ifood_merchants(user_id);
CREATE INDEX idx_ifood_merchants_client_id ON ifood_merchants(client_id);
CREATE INDEX idx_ifood_merchants_merchant_id ON ifood_merchants(merchant_id);
CREATE INDEX idx_ifood_merchants_status ON ifood_merchants(status);
```

**Formato do Campo `operating_hours` (JSONB)**:
```json
{
  "shifts": [
    {
      "id": "shift-id-from-ifood",
      "dayOfWeek": "MONDAY",
      "start": "08:00:00",
      "end": "18:00:00",
      "duration": 600
    }
  ],
  "by_day": {
    "MONDAY": "shift-id-monday",
    "TUESDAY": "shift-id-tuesday"
  },
  "last_updated": "2025-10-15T10:30:00Z"
}
```

---

### Tabela: `ifood_tokens`

**Schema** (em `ifoodTokenService.ts`):

```sql
CREATE TABLE ifood_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  access_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,  -- Unix timestamp em segundos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ifood_tokens_expires_at ON ifood_tokens(expires_at);
```

---

### Tabela: `ifood_interruptions`

**Schema** (inferido de `ifoodMerchantStatusService.ts:544-556`):

```sql
CREATE TABLE ifood_interruptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id TEXT NOT NULL,
  ifood_interruption_id TEXT,  -- ID da interrupção no iFood
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_merchant
    FOREIGN KEY (merchant_id)
    REFERENCES ifood_merchants(merchant_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_ifood_interruptions_merchant_id ON ifood_interruptions(merchant_id);
CREATE INDEX idx_ifood_interruptions_user_id ON ifood_interruptions(user_id);
CREATE INDEX idx_ifood_interruptions_is_active ON ifood_interruptions(is_active);
```

---

### TypeScript Interfaces

**Arquivo**: `backend/ifood-token-service/src/ifoodMerchantService.ts`

```typescript
export interface MerchantData {
  merchant_id: string;
  name: string;
  corporate_name: string;
  user_id: string;
  client_id: string;
  status: boolean;
  phone?: string;
  description?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  postalCode?: string;
  address_country?: string;
  operating_hours?: any; // jsonb
  type?: string[];
  latitude?: string;
  longitude?: string;
  last_sync_at?: string;
}

export interface IFoodMerchant {
  id: string;
  name: string;
  corporateName?: string;
  [key: string]: any;
}
```

**Arquivo**: `backend/ifood-token-service/src/ifoodMerchantStatusService.ts`

```typescript
interface OpeningHours {
  id?: string;
  dayOfWeek: string;
  start: string; // HH:MM:SS
  end?: string;
  duration?: number; // minutes
}

interface Interruption {
  id?: string;
  startDate: string;
  endDate?: string;
  reason?: string;
  description?: string;
}
```

---

## 🔧 Serviços Backend

### 1. `IFoodMerchantService`

**Arquivo**: `backend/ifood-token-service/src/ifoodMerchantService.ts`

**Responsabilidades**:
- Gestão de merchants (CRUD)
- Sincronização com API iFood
- Interação com banco de dados

**Métodos Principais**:

```typescript
class IFoodMerchantService {
  private supabase;
  private readonly IFOOD_MERCHANT_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants';

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Buscar merchants da API iFood
  async fetchMerchantsFromIFood(accessToken: string): Promise<{
    success: boolean;
    merchants: IFoodMerchant[] | {error: string}[]
  }> {
    const response = await axios.get(this.IFOOD_MERCHANT_URL, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return { success: true, merchants: response.data };
  }

  // Verificar se merchant existe
  async checkMerchantExists(merchantId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('ifood_merchants')
      .select('merchant_id')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    return !!data;
  }

  // Armazenar merchant no banco
  async storeMerchant(merchant: MerchantData): Promise<{
    success: boolean;
    response: any
  }> {
    const { data, error } = await this.supabase
      .from('ifood_merchants')
      .insert(merchant)
      .select()
      .single();

    if (error) {
      return { success: false, response: { error: error.message } };
    }

    return { success: true, response: { merchant_id: merchant.merchant_id, data } };
  }

  // Obter detalhes de merchant (banco ou API)
  async getMerchantDetail(
    merchantId: string,
    accessToken: string,
    userId: string
  ): Promise<{
    success: boolean;
    merchant?: IFoodMerchant;
    error?: string;
    action?: 'found_in_db' | 'added_from_api';
  }> {
    // 1. Verificar banco
    const existsInDb = await this.checkMerchantExists(merchantId);

    if (existsInDb) {
      const { data } = await this.supabase
        .from('ifood_merchants')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('user_id', userId)
        .single();

      return {
        success: true,
        merchant: mapToApiFormat(data),
        action: 'found_in_db'
      };
    }

    // 2. Buscar da API e salvar
    const response = await axios.get(
      `${this.IFOOD_MERCHANT_URL}/${merchantId}`,
      {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const apiMerchant = response.data;

    // 3. Salvar no banco
    await this.storeMerchant(mapToDbFormat(apiMerchant, userId));

    return {
      success: true,
      merchant: apiMerchant,
      action: 'added_from_api'
    };
  }

  // Obter todos os merchants do banco
  async getAllMerchantsFromDB(): Promise<{
    success: boolean;
    merchants?: any[];
    error?: string
  }> {
    const { data, error } = await this.supabase
      .from('ifood_merchants')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, merchants: data || [] };
  }
}
```

---

### 2. `IFoodMerchantStatusService`

**Arquivo**: `backend/ifood-token-service/src/ifoodMerchantStatusService.ts`

**Responsabilidades**:
- Gestão de status (aberto/fechado)
- Horários de funcionamento
- Interrupções/pausas programadas

**Métodos Principais**:

```typescript
class IFoodMerchantStatusService {
  private static IFOOD_STATUS_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/status';
  private static IFOOD_HOURS_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/opening-hours';
  private static IFOOD_INTERRUPTIONS_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0/merchants/{merchantId}/interruptions';

  // Buscar status do merchant
  static async fetchMerchantStatus(
    merchantId: string,
    accessToken: string
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(
      this.IFOOD_STATUS_URL.replace('{merchantId}', merchantId),
      {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    return { success: true, data: response.data };
  }

  // Buscar horários de funcionamento
  static async fetchOpeningHours(
    merchantId: string,
    accessToken: string
  ): Promise<{ success: boolean; hours: OpeningHours[] }> {
    const response = await axios.get(
      this.IFOOD_HOURS_URL.replace('{merchantId}', merchantId),
      {
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const data = response.data;
    const hours = data.shifts || data.periods || data;

    return { success: true, hours };
  }

  // Salvar horários no banco
  static async saveOpeningHoursToDatabase(
    merchantId: string,
    shifts: OpeningHours[]
  ): Promise<boolean> {
    const operatingHours = {
      shifts: shifts,
      by_day: buildDayMapping(shifts),
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase
      .from('ifood_merchants')
      .update({ operating_hours: operatingHours })
      .eq('merchant_id', merchantId);

    return !error;
  }

  // Atualizar horários
  static async updateOpeningHours(
    merchantId: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    accessToken: string
  ): Promise<{success: boolean; message: string}> {
    // 1. Buscar horários existentes
    const { data: merchant } = await supabase
      .from('ifood_merchants')
      .select('operating_hours')
      .eq('merchant_id', merchantId)
      .single();

    // 2. Atualizar/adicionar novo horário
    let shifts = merchant.operating_hours?.shifts || [];
    const existingIndex = shifts.findIndex(s => s.dayOfWeek === dayOfWeek);

    const newShift = {
      dayOfWeek,
      start: startTime,
      duration: calculateDuration(startTime, endTime)
    };

    if (existingIndex >= 0) {
      shifts[existingIndex] = newShift;
    } else {
      shifts.push(newShift);
    }

    // 3. Enviar para iFood
    await axios.put(
      this.IFOOD_HOURS_URL.replace('{merchantId}', merchantId),
      { storeId: merchantId, shifts },
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    // 4. Atualizar banco
    await supabase
      .from('ifood_merchants')
      .update({ operating_hours: { shifts } })
      .eq('merchant_id', merchantId);

    return { success: true, message: 'Updated successfully' };
  }

  // Criar interrupção
  static async createScheduledPause(
    merchantId: string,
    startDate: string,
    endDate: string,
    description: string,
    accessToken: string,
    userId: string,
    reason?: string
  ): Promise<{success: boolean; message: string; interruptionId?: string}> {
    // 1. Ajustar timezone (UTC → Brazil)
    const startBrazil = adjustToBrazilTime(startDate);
    const endBrazil = adjustToBrazilTime(endDate);

    // 2. POST para iFood
    const response = await axios.post(
      this.IFOOD_INTERRUPTIONS_URL.replace('{merchantId}', merchantId),
      {
        start: startBrazil,
        end: endBrazil,
        description,
        ...(reason && { reason })
      },
      {
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const interruptionId = response.data.id;

    // 3. Salvar no banco local
    await supabase
      .from('ifood_interruptions')
      .insert({
        user_id: userId,
        merchant_id: merchantId,
        ifood_interruption_id: interruptionId,
        start_date: startBrazil,
        end_date: endBrazil,
        description,
        reason,
        is_active: true
      });

    return {
      success: true,
      message: 'Pausa criada com sucesso',
      interruptionId
    };
  }

  // Listar interrupções
  static async listScheduledPauses(
    merchantId: string
  ): Promise<{success: boolean; data: any[]}> {
    const { data, error } = await supabase
      .from('ifood_interruptions')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, data: [] };
    }

    return {
      success: true,
      data: data.map(mapToInterruptionFormat)
    };
  }

  // Remover interrupção
  static async removeScheduledPause(
    merchantId: string,
    interruptionId: string,
    accessToken: string
  ): Promise<{success: boolean; message: string}> {
    // 1. Remover da API iFood
    try {
      await axios.delete(
        `${this.IFOOD_INTERRUPTIONS_URL.replace('{merchantId}', merchantId)}/${interruptionId}`,
        {
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
    } catch (apiError) {
      console.warn('Failed to remove from iFood');
    }

    // 2. Remover do banco
    await supabase
      .from('ifood_interruptions')
      .delete()
      .eq('merchant_id', merchantId)
      .or(`ifood_interruption_id.eq.${interruptionId},id.eq.${interruptionId}`);

    return {
      success: true,
      message: 'Removido com sucesso'
    };
  }
}
```

---

### 3. `IFoodTokenService`

**Arquivo**: `backend/ifood-token-service/src/ifoodTokenService.ts`

**Responsabilidades**:
- Geração de tokens OAuth2 do iFood
- Armazenamento e renovação de tokens
- Validação de expiração

**Métodos Auxiliares Importantes**:

```typescript
// Obter token para usuário específico
export async function getTokenForUser(userId: string): Promise<StoredToken | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ifood_tokens')
    .select('user_id, client_id, client_secret, access_token, expires_at, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

// Obter qualquer token disponível (usado pelos endpoints de merchants)
export async function getAnyAvailableToken(): Promise<StoredToken | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ifood_tokens')
    .select('user_id, client_id, client_secret, access_token, expires_at, created_at, updated_at')
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
```

**Fluxo de Token**:
1. Frontend solicita token (POST /token)
2. Backend gera token OAuth2 com iFood API
3. Token é armazenado no banco (expires_at)
4. Endpoints de merchants usam `getAnyAvailableToken()` para operações
5. Token é renovado automaticamente antes de expirar (scheduler)

---

## 🖥️ Integração Frontend

### Service: `ifoodMerchantsService.ts`

**Arquivo**: `frontend/plano-certo-hub-insights/src/services/ifoodMerchantsService.ts`

**Configuração da API**:
```typescript
const LOCAL_SERVICE_URL = 'http://localhost:8085';
```

**Funções Principais**:

```typescript
// Listar detalhes de um merchant (busca banco primeiro, depois API)
export async function getMerchantDetail(
  merchantId: string,
  userId: string
): Promise<{
  success: boolean;
  merchant?: any;
  error?: string;
  action?: 'found_in_db' | 'added_from_api';
}> {
  // 1. Verificar banco local primeiro
  const { data: dbMerchant } = await supabase
    .from('ifood_merchants')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (dbMerchant) {
    return {
      success: true,
      merchant: mapToFrontendFormat(dbMerchant),
      action: 'found_in_db'
    };
  }

  // 2. Buscar do backend (que busca da API e salva)
  const response = await fetch(`${LOCAL_SERVICE_URL}/merchants/${merchantId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to fetch merchant'
    };
  }

  // 3. AUTO-FETCH OPENING HOURS após salvar merchant
  try {
    await fetch(`${LOCAL_SERVICE_URL}/merchants/${merchantId}/opening-hours`, {
      method: 'GET',
    });
  } catch (error) {
    console.warn('Failed to auto-sync opening hours');
  }

  return {
    success: true,
    merchant: data.merchant,
    action: 'added_from_api'
  };
}
```

---

### Hook: `useIfoodMerchants.ts`

**Arquivo**: `frontend/plano-certo-hub-insights/src/hooks/useIfoodMerchants.ts`

**React Query Hook para Listar Merchants**:

```typescript
export const useIfoodMerchants = (userId?: string) => {
  return useQuery({
    queryKey: ['ifood-merchants', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const { data, error } = await supabase
        .from('ifood_merchants')
        .select(`
          merchant_id,
          name,
          corporate_name,
          status,
          phone,
          address_city,
          address_state,
          address_neighborhood,
          last_sync_at,
          client_id,
          clients:client_id (
            name
          )
        `)
        .eq('user_id', userId)
        .order('last_sync_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Deduplica por merchant_id
      const merchantsMap = new Map();
      (data || []).forEach((merchant: any) => {
        const existing = merchantsMap.get(merchant.merchant_id);
        if (!existing || new Date(merchant.last_sync_at) > new Date(existing.last_sync_at)) {
          merchantsMap.set(merchant.merchant_id, merchant);
        }
      });

      return Array.from(merchantsMap.values());
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutos
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // 30 segundos
  });
};

// Hook para buscar merchant específico
export const useIfoodMerchant = (merchantId?: string) => {
  return useQuery<IfoodMerchantFromDB | null>({
    queryKey: ['ifood_merchant', merchantId],
    queryFn: async () => {
      if (!merchantId) return null;

      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('*')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
```

**Uso em Componente**:
```tsx
import { useIfoodMerchants } from '@/hooks/useIfoodMerchants';

function MerchantsList() {
  const { data: merchants, isLoading, error } = useIfoodMerchants(userId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {merchants?.map(merchant => (
        <div key={merchant.merchant_id}>
          <h3>{merchant.name}</h3>
          <p>Status: {merchant.status ? 'Aberto' : 'Fechado'}</p>
          <p>Cidade: {merchant.address_city}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔐 Autenticação e Tokens

### Fluxo de Autenticação

```
1. Usuário fornece credenciais iFood
   ↓
2. POST /token {clientId, clientSecret, userId}
   ↓
3. Backend → iFood OAuth2 Token API
   ↓
4. Token salvo na tabela ifood_tokens
   ↓
5. Endpoints de merchants usam getAnyAvailableToken()
   ↓
6. Scheduler renova tokens automaticamente (a cada 30min)
```

### Estrutura do Token

**Tabela `ifood_tokens`**:
```typescript
interface StoredToken {
  user_id: string;
  client_id: string;
  client_secret: string;
  access_token: string;
  expires_at: number; // Unix timestamp em segundos
  created_at: string;
  updated_at: string;
}
```

### Headers HTTP

Todas as chamadas à API iFood requerem:
```http
Authorization: Bearer {access_token}
Accept: application/json
Content-Type: application/json
```

### Renovação Automática

**Scheduler** (`backend/ifood-token-service/src/tokenScheduler.ts`):
```typescript
// Renovar tokens a cada 30 minutos
schedule.scheduleJob('*/30 * * * *', async () => {
  const tokenService = new IFoodTokenService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  await tokenService.updateExpiringTokens(30); // 30 min threshold
});
```

---

## 🚀 Guia de Implementação Passo a Passo

### Pré-requisitos

1. **Node.js**: v18+
2. **PostgreSQL**: via Supabase ou local
3. **Credenciais iFood**: `clientId` e `clientSecret`
4. **Variáveis de Ambiente**:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
PORT=8085
```

---

### Passo 1: Configurar Banco de Dados

**1.1. Criar Tabela `ifood_merchants`**

```sql
-- Execute o script completo em:
-- frontend/plano-certo-hub-insights/supabase/migrations/20250715000000-create-ifood-merchants-table.sql

CREATE TABLE IF NOT EXISTS ifood_merchants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  corporate_name TEXT,
  description TEXT,
  status BOOLEAN NOT NULL DEFAULT false,
  -- ... (ver seção Modelos de Dados para schema completo)
);
```

**1.2. Alterar Status para Boolean**

```sql
-- Execute:
-- frontend/plano-certo-hub-insights/supabase/migrations/20250116000002-alter-ifood-merchants-status-to-boolean.sql

ALTER TABLE ifood_merchants ADD COLUMN status_boolean BOOLEAN;
UPDATE ifood_merchants
SET status_boolean = CASE
  WHEN status = 'AVAILABLE' THEN true
  ELSE false
END;
ALTER TABLE ifood_merchants DROP COLUMN status;
ALTER TABLE ifood_merchants RENAME COLUMN status_boolean TO status;
```

**1.3. Criar Tabela `ifood_tokens`**

```sql
CREATE TABLE ifood_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  access_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ifood_tokens_expires_at ON ifood_tokens(expires_at);
```

**1.4. Criar Tabela `ifood_interruptions`**

```sql
CREATE TABLE ifood_interruptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id TEXT NOT NULL,
  ifood_interruption_id TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  description TEXT,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_merchant
    FOREIGN KEY (merchant_id)
    REFERENCES ifood_merchants(merchant_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_ifood_interruptions_merchant_id ON ifood_interruptions(merchant_id);
```

---

### Passo 2: Implementar Backend

**2.1. Instalar Dependências**

```bash
cd backend/ifood-token-service
npm install express @supabase/supabase-js axios dotenv typescript ts-node
npm install --save-dev @types/express @types/node
```

**2.2. Estrutura de Pastas**

```
backend/ifood-token-service/
├── src/
│   ├── server.ts                      # Servidor Express
│   ├── ifoodTokenService.ts           # Serviço de tokens
│   ├── ifoodMerchantService.ts        # Serviço de merchants
│   ├── ifoodMerchantStatusService.ts  # Serviço de status
│   ├── routes/
│   │   ├── merchantRoutes.ts          # Rotas de merchants
│   │   ├── interruptionRoutes.ts      # Rotas de interrupções
│   │   └── openingHoursRoutes.ts      # Rotas de horários
│   └── types.ts                       # Interfaces TypeScript
├── package.json
├── tsconfig.json
└── .env
```

**2.3. Configurar `server.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import merchantRoutes from './routes/merchantRoutes';
import interruptionRoutes from './routes/interruptionRoutes';
import openingHoursRoutes from './routes/openingHoursRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8085;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', merchantRoutes);
app.use('/api', interruptionRoutes);
app.use('/api', openingHoursRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 iFood Token Service running on port ${PORT}`);
});
```

**2.4. Copiar Serviços**

Copie os 3 arquivos de serviços do projeto original:
- `ifoodTokenService.ts`
- `ifoodMerchantService.ts`
- `ifoodMerchantStatusService.ts`

**2.5. Copiar Rotas**

Copie os 3 arquivos de rotas:
- `merchantRoutes.ts`
- `interruptionRoutes.ts`
- `openingHoursRoutes.ts`

---

### Passo 3: Implementar Frontend

**3.1. Instalar Dependências**

```bash
cd frontend
npm install @supabase/supabase-js @tanstack/react-query axios
```

**3.2. Configurar Supabase Client**

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**3.3. Criar Service**

```typescript
// src/services/ifoodMerchantsService.ts
import { supabase } from '../integrations/supabase/client';

const API_BASE_URL = 'http://localhost:8085';

export async function getMerchantDetail(merchantId: string, userId: string) {
  // 1. Check database
  const { data: dbMerchant } = await supabase
    .from('ifood_merchants')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (dbMerchant) {
    return {
      success: true,
      merchant: dbMerchant,
      action: 'found_in_db'
    };
  }

  // 2. Fetch from backend
  const response = await fetch(`${API_BASE_URL}/merchants/${merchantId}`);
  const data = await response.json();

  return {
    success: true,
    merchant: data.merchant,
    action: 'added_from_api'
  };
}
```

**3.4. Criar Hooks**

```typescript
// src/hooks/useIfoodMerchants.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';

export const useIfoodMerchants = (userId?: string) => {
  return useQuery({
    queryKey: ['ifood-merchants', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('*')
        .eq('user_id', userId)
        .order('last_sync_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
};
```

**3.5. Usar em Componentes**

```tsx
import { useIfoodMerchants } from './hooks/useIfoodMerchants';
import { getMerchantDetail } from './services/ifoodMerchantsService';

function MerchantsPage() {
  const userId = 'user-uuid-here';
  const { data: merchants, isLoading } = useIfoodMerchants(userId);

  const handleViewDetails = async (merchantId: string) => {
    const result = await getMerchantDetail(merchantId, userId);

    if (result.success) {
      console.log('Merchant:', result.merchant);
      console.log('Action:', result.action);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {merchants?.map(merchant => (
        <div key={merchant.merchant_id}>
          <h3>{merchant.name}</h3>
          <button onClick={() => handleViewDetails(merchant.merchant_id)}>
            Ver Detalhes
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

### Passo 4: Testar Endpoints

**4.1. Criar Token iFood**

```bash
curl -X POST http://localhost:8085/token \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "user_id": "user-uuid"
  }'
```

**4.2. Listar Merchants**

```bash
curl http://localhost:8085/merchants
```

**4.3. Obter Detalhes de Merchant**

```bash
curl http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d
```

**4.4. Obter Status**

```bash
curl http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/status
```

**4.5. Criar Interrupção**

```bash
curl -X POST http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/interruptions \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-10-15T14:00:00Z",
    "endDate": "2025-10-15T18:00:00Z",
    "description": "Manutenção",
    "userId": "user-uuid"
  }'
```

**4.6. Listar Horários**

```bash
curl http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/opening-hours
```

**4.7. Atualizar Horário**

```bash
curl -X PUT http://localhost:8085/merchants/e5cce6a9-53c9-4f4c-b3e6-39eb6f5f6f3d/opening-hours \
  -H "Content-Type: application/json" \
  -d '{
    "dayOfWeek": "MONDAY",
    "startTime": "08:00:00",
    "endTime": "18:00:00"
  }'
```

---

### Passo 5: Implementar Funcionalidades Extras (Opcional)

**5.1. Polling de Status**

Implementar serviço que verifica status periodicamente:

```typescript
// backend/src/statusPollingService.ts
import * as schedule from 'node-schedule';
import { IFoodMerchantStatusService } from './ifoodMerchantStatusService';

export function startStatusPolling() {
  // Rodar a cada 1 minuto
  schedule.scheduleJob('*/1 * * * *', async () => {
    console.log('🔄 Polling merchant statuses...');
    await IFoodMerchantStatusService.checkAllMerchantStatuses();
  });

  console.log('✅ Status polling started');
}
```

**5.2. Auto-Sync de Horários**

Adicionar chamada automática para sincronizar horários após salvar merchant:

```typescript
// Em getMerchantDetail, após salvar merchant:
try {
  await fetch(`${API_BASE_URL}/merchants/${merchantId}/opening-hours`);
  console.log('✅ Opening hours auto-synced');
} catch (error) {
  console.warn('⚠️ Failed to auto-sync opening hours');
}
```

---

## 📝 Resumo dos Critérios Implementados

✅ **Critério 1**: GET /merchants - Lista todas as lojas
✅ **Critério 2**: GET /merchants/:merchantId - Detalhes da loja
✅ **Critério 3**: GET /merchants/:merchantId/status - Status da loja
✅ **Critério 4**: POST /merchants/:merchantId/interruptions - Criar interrupção
✅ **Critério 5**: GET /merchants/:merchantId/interruptions - Listar interrupções
✅ **Critério 6**: DELETE /merchants/:merchantId/interruptions/:interruptionId - Remover interrupção
✅ **Critério 7**: GET /merchants/:merchantId/opening-hours - Listar horários
✅ **Critério 8**: PUT /merchants/:merchantId/opening-hours - Criar/atualizar horário

---

## 🔗 Links Úteis

- **iFood Merchant API Docs**: https://developer.ifood.com.br/docs/merchant-api
- **Supabase Docs**: https://supabase.com/docs
- **Express.js Docs**: https://expressjs.com/
- **React Query Docs**: https://tanstack.com/query/latest

---

## ⚠️ Pontos Importantes para Replicação

1. **Timezone**: As interrupções usam ajuste de UTC para horário do Brasil (UTC-3)
2. **Auto-Save**: Horários são salvos automaticamente ao buscar do iFood
3. **Token Management**: Usar `getAnyAvailableToken()` para operações não específicas de usuário
4. **Deduplicação**: Frontend deduplica merchants por `merchant_id` mantendo o mais recente
5. **Validações**: Validar formatos de horário (HH:MM ou HH:MM:SS) e dias da semana
6. **Error Handling**: Sempre verificar `success` nas respostas e tratar erros adequadamente
7. **Database First**: Sempre verificar banco antes de buscar da API para evitar chamadas desnecessárias

---

**FIM DA DOCUMENTAÇÃO**
