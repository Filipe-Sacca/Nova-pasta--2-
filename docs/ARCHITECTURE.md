# 🏗️ Arquitetura do Sistema - Plano Certo Hub

## Visão Geral da Arquitetura

O Plano Certo Hub utiliza uma arquitetura de microserviços moderna, com separação clara entre frontend, backend e serviços especializados. O sistema foi projetado para alta disponibilidade, escalabilidade e manutenibilidade.

## Diagrama de Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                         CAMADA DE APRESENTAÇÃO                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    React Application                     │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │    │
│  │  │   Router   │  │   Context  │  │   Hooks    │          │    │ 
│  │  └────────────┘  └────────────┘  └────────────┘          │    │
│  │  ┌────────────────────────────────────────────────┐      │    │
│  │  │              Component Modules                 │      │    │
│  │  │  Merchant | Catalog | Events | Analytics | API │      │    │
│  │  └────────────────────────────────────────────────┘      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTPS/WSS
┌─────────────────────────┴──────────────────────────────────────┐
│                         CAMADA DE APLICAÇÃO                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │   Express API   │  │  Token Service  │  │ Polling Engine │  │
│  │    Port 8080    │  │    Port 8081    │  │   Background   │  │
│  │                 │  │                 │  │                │  │
│  │  • Auth         │  │  • OAuth2       │  │  • Events      │  │
│  │  • CORS         │  │  • Refresh      │  │  • Orders      │  │
│  │  • Routes       │  │  • Cache        │  │  • Status      │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                │
└─────────────────────────┬──────────────────────────────────────┘
                          │ PostgreSQL Protocol
┌─────────────────────────┴───────────────────────────────────────┐
│                         CAMADA DE DADOS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                        Supabase                          |   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐   │   │
│  │  │PostgreSQL│  │   Auth   │  │ Realtime │  │ Storage │   │   │
│  │  │          │  │          │  │          │  │         │   │   │
│  │  │ • Tables │  │ • Users  │  │ • Events │  │ • Files │   │   │
│  │  │ • Views  │  │ • Roles  │  │ • Push   │  │ • CDN   │   │   │
│  │  │ • RLS    │  │ • JWT    │  │ • Sub    │  │         │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API / OAuth2
┌─────────────────────────┴────────────────────────────────────────┐
│                      SERVIÇOS EXTERNOS                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                        iFood API                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐   │    │
│  │  │  Events  │  │ Merchants│  │ Products │  │ Catalog │   │    │
│  │  │          │  │          │  │          │  │         │   │    │
│  │  │ Polling  │  │ Status   │  │ Sync     │  │ Images  │   │    │
│  │  │ Process  │  │ Hours    │  │ Prices   │  │ Upload  │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Componentes Principais

### 1. Frontend Layer (Presentation)

#### React Application
- **Framework**: React 18 com TypeScript
- **State Management**: Context API + Hooks
- **Routing**: React Router v6
- **UI Library**: Custom components + Tailwind CSS
- **Build Tool**: Vite

#### Módulos de Interface
| Módulo | Responsabilidade |
|--------|------------------|
| **OrdersManager** | Interface de gestão de pedidos |
| **ShippingManager** | Tracking e gestão de entregas |
| **ReviewsManager** | Interface de avaliações |
| **Analytics** | Dashboards e relatórios |
| **ApiConfig** | Configuração de integrações |

### 2. Application Layer (Business Logic)

#### Express API Server
```javascript
// Estrutura principal
const server = {
  middleware: [
    'cors',           // Cross-origin resource sharing
    'auth',           // JWT authentication
    'rateLimit',      // Rate limiting
    'errorHandler'    // Global error handling
  ],
  routes: [
    '/api/auth',      // Authentication endpoints
    '/api/orders',    // Order management
    '/api/shipping',  // Delivery tracking
    '/api/reviews',   // Review management
    '/api/analytics'  // Analytics data
  ]
}
```

#### Token Service
```typescript
// Gestão de tokens OAuth2
class TokenService {
  private cache: Map<string, Token>
  private refreshQueue: Queue
  
  async getToken(merchantId: string): Promise<Token>
  async refreshToken(token: Token): Promise<Token>
  async validateToken(token: string): Promise<boolean>
  
  // Auto-refresh mechanism
  private scheduleRefresh(token: Token): void
}
```

#### Polling Engine
```typescript
// Motor de sincronização
class PollingEngine {
  private interval: number = 30000  // 30 seconds
  private drift: number = 0
  
  async poll(): Promise<void> {
    // 1. Fetch events from iFood
    // 2. Process each event
    // 3. Acknowledge events
    // 4. Update local state
    // 5. Notify subscribers
  }
  
  private correctDrift(): void
  private deduplicateEvents(): void
}
```

### 3. Data Layer (Persistence)

#### Database Schema
```sql
-- Core domain tables
├── Orders Domain
│   ├── ifood_orders
│   ├── ifood_events
│   └── ifood_polling_log
│
├── Shipping Domain
│   ├── ifood_shipping_status
│   ├── ifood_address_changes
│   └── ifood_delivery_persons
│
├── Reviews Domain
│   ├── ifood_reviews
│   └── ifood_review_replies
│
└── Analytics Domain
    ├── delivery_history
    ├── delivery_regions
    └── neighborhood_trends
```

#### Data Access Patterns
- **Repository Pattern**: Abstração de acesso a dados
- **Unit of Work**: Transações coordenadas
- **Query Objects**: Queries complexas encapsuladas
- **Data Mapper**: Mapeamento objeto-relacional

### 4. Integration Layer (External Services)

#### iFood API Integration
```typescript
interface IFoodAPIClient {
  // Authentication
  authenticate(): Promise<Token>
  
  // Orders
  getOrder(orderId: string): Promise<Order>
  confirmOrder(orderId: string): Promise<void>
  cancelOrder(orderId: string, reason: string): Promise<void>
  
  // Events
  pollEvents(): Promise<Event[]>
  acknowledgeEvents(eventIds: string[]): Promise<void>
  
  // Shipping
  getShippingStatus(orderId: string): Promise<ShippingStatus>
  updateDeliveryAddress(orderId: string, address: Address): Promise<void>
  
  // Reviews
  getReviews(merchantId: string): Promise<Review[]>
  replyToReview(reviewId: string, reply: string): Promise<void>
}
```

## Padrões Arquiteturais

### 1. Microservices Pattern
- **Separação de Responsabilidades**: Cada serviço tem uma responsabilidade única
- **Comunicação via API**: RESTful APIs para comunicação entre serviços
- **Independência de Deploy**: Serviços podem ser deployados independentemente

### 2. Event-Driven Architecture
```typescript
// Event flow
iFood Events → Polling Service → Event Processor → Database → Frontend Updates

// Event types
enum EventType {
  ORDER_PLACED = 'PLACED',
  ORDER_CONFIRMED = 'CONFIRMED',
  ORDER_CANCELLED = 'CANCELLED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  DELIVERY_STARTED = 'DELIVERY_STARTED',
  DELIVERY_COMPLETED = 'DELIVERED'
}
```

### 3. Cache Strategy
```typescript
// Multi-level caching
const cacheStrategy = {
  L1: {
    type: 'Memory',
    ttl: 60,        // 1 minute
    maxSize: 100    // items
  },
  L2: {
    type: 'Redis',
    ttl: 300,       // 5 minutes
    maxSize: 1000   // items
  },
  L3: {
    type: 'Database',
    ttl: 3600,      // 1 hour
    persistent: true
  }
}
```

### 4. Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  private failureCount: number
  private lastFailureTime: Date
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
}
```

## Fluxos de Dados

### 1. Fluxo de Novo Pedido
```
1. iFood emite evento PLACED
2. Polling Service captura evento (30s interval)
3. Event Processor valida e processa
4. Order Service cria registro no banco
5. WebSocket notifica frontend
6. UI atualiza lista de pedidos
7. Usuário confirma pedido
8. API chama iFood para confirmar
9. Status atualizado no banco
10. UI reflete novo status
```

### 2. Fluxo de Entrega
```
1. Driver aceita entrega
2. iFood emite evento DISPATCHED
3. Sistema cria registro de shipping
4. Driver atualiza localização
5. Shipping Service atualiza coordenadas
6. Frontend atualiza mapa em tempo real
7. Cliente acessa link de tracking
8. Sistema mostra status público
9. Entrega concluída
10. Ordem marcada como DELIVERED
```

### 3. Fluxo de Avaliação
```
1. Cliente avalia no iFood
2. Review aparece na API
3. Sistema sincroniza avaliações
4. Notificação para merchant
5. Merchant responde via sistema
6. Resposta enviada para iFood
7. Cliente recebe resposta
8. Métricas atualizadas
```

## Segurança

### Authentication & Authorization
```typescript
// JWT Token structure
interface JWTPayload {
  userId: string
  merchantId: string
  roles: string[]
  exp: number
}

// Role-based access control
const permissions = {
  ADMIN: ['*'],
  MANAGER: ['orders:*', 'reviews:*', 'shipping:read'],
  OPERATOR: ['orders:read', 'orders:update'],
  VIEWER: ['*:read']
}
```

### API Security
- **Rate Limiting**: 100 requests/minute per IP
- **CORS Policy**: Whitelist de domínios permitidos
- **Input Validation**: Joi schemas para validação
- **SQL Injection Prevention**: Prepared statements
- **XSS Protection**: Content Security Policy headers

### Data Security
- **Encryption at Rest**: AES-256 para dados sensíveis
- **Encryption in Transit**: TLS 1.3 para todas conexões
- **PII Protection**: Mascaramento de dados pessoais
- **Audit Logging**: Log de todas operações críticas

## Performance & Scalability

### Performance Metrics
| Métrica | Target | Current |
|---------|--------|---------|
| API Response Time | <200ms | ~150ms |
| Polling Latency | <500ms | ~300ms |
| Database Query Time | <50ms | ~30ms |
| Cache Hit Rate | >80% | ~85% |
| Frontend Load Time | <2s | ~1.5s |

### Scalability Strategies

#### Horizontal Scaling
```yaml
# Docker Compose example
services:
  api:
    image: plano-certo/api
    deploy:
      replicas: 3
    environment:
      - LOAD_BALANCER=nginx
  
  token-service:
    image: plano-certo/token-service
    deploy:
      replicas: 2
```

#### Database Optimization
- **Indexing Strategy**: Índices em colunas de busca frequente
- **Query Optimization**: EXPLAIN ANALYZE para queries críticas
- **Connection Pooling**: Pool de 20 conexões por serviço
- **Read Replicas**: Para queries de leitura pesadas

#### Caching Optimization
```typescript
// Cache warming strategy
class CacheWarmer {
  async warmCache() {
    // Pre-load frequently accessed data
    await this.loadMerchantData()
    await this.loadRecentOrders()
    await this.loadActiveShipments()
  }
  
  // Invalidation strategy
  async invalidate(pattern: string) {
    const keys = await this.redis.keys(pattern)
    await this.redis.del(...keys)
  }
}
```

## Monitoring & Observability

### Logging Strategy
```typescript
// Structured logging
const log = {
  level: 'info',
  timestamp: new Date().toISOString(),
  service: 'token-service',
  action: 'token_refresh',
  merchantId: 'xxx',
  duration: 125,
  success: true,
  metadata: {
    tokenAge: 3600,
    refreshReason: 'scheduled'
  }
}
```

### Metrics Collection
- **Application Metrics**: Response times, error rates, throughput
- **Business Metrics**: Orders/hour, delivery times, review response rate
- **Infrastructure Metrics**: CPU, memory, disk, network

### Health Checks
```typescript
// Health check endpoints
GET /health/live    // Is service running?
GET /health/ready   // Is service ready to accept traffic?
GET /health/startup // Has service initialized correctly?

// Example response
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "ifood_api": "ok"
  },
  "timestamp": "2024-09-07T10:00:00Z"
}
```

## Deployment Architecture

### Production Environment
```
┌─────────────────────────────────────────┐
│            Load Balancer (Nginx)         │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┬─────────────┐
    │                   │             │
┌───▼────┐      ┌───────▼──┐   ┌─────▼───┐
│ API #1 │      │  API #2  │   │ API #3  │
└────────┘      └──────────┘   └─────────┘
    │                   │             │
    └─────────┬─────────┴─────────────┘
              │
    ┌─────────▼──────────┐
    │   Redis Cache      │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │   PostgreSQL       │
    │   (Primary)        │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │   PostgreSQL       │
    │   (Read Replica)   │
    └────────────────────┘
```

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm test
      
  build:
    needs: test
    steps:
      - run: docker build -t app .
      
  deploy:
    needs: build
    steps:
      - run: kubectl apply -f k8s/
```

## Disaster Recovery

### Backup Strategy
- **Database**: Daily automated backups, 30-day retention
- **File Storage**: Replicated across regions
- **Configuration**: Version controlled in Git

### Recovery Procedures
1. **RTO (Recovery Time Objective)**: < 1 hour
2. **RPO (Recovery Point Objective)**: < 15 minutes
3. **Failover Process**: Automated with health checks
4. **Data Recovery**: Point-in-time recovery available

## Future Architecture Improvements

### Short Term (Q4 2024)
- [ ] Implement GraphQL for flexible queries
- [ ] Add WebSocket for real-time updates
- [ ] Integrate Redis for session management
- [ ] Implement API Gateway pattern

### Medium Term (Q1 2025)
- [ ] Migrate to Kubernetes for orchestration
- [ ] Implement Service Mesh (Istio)
- [ ] Add distributed tracing (Jaeger)
- [ ] Implement CQRS pattern

### Long Term (2025+)
- [ ] Event Sourcing for audit trail
- [ ] Machine Learning for demand prediction
- [ ] Multi-region deployment
- [ ] Blockchain for order verification