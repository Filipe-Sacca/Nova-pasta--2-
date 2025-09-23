# 🍔 Plano Certo Hub - iFood Integration Platform

## 📋 Visão Geral

**Plano Certo Hub** é uma plataforma completa de gerenciamento e integração com o iFood, oferecendo controle total sobre pedidos, entregas, avaliações e análise de dados em tempo real. O sistema utiliza arquitetura moderna com React, TypeScript, Node.js e Supabase.

### ✨ Principais Funcionalidades

- **🏪 Gestão Completa de Merchants** - Controle de estabelecimentos e horários de funcionamento
- **📚 Gerenciamento de Catálogo** - Sincronização de produtos, preços e imagens
- **🔄 Sistema de Eventos** - Polling de alta precisão (30s) com o iFood
- **🔐 Autenticação Segura** - Gestão automática de tokens OAuth2
- **📊 Analytics Integrado** - Monitoramento de sincronização e status
- **⚡ API Modular** - Arquitetura limpa com rotas especializadas

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/TypeScript)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Merchants │ │ Catalog  │ │ Events   │ │Analytics │      │
│  │ Manager  │ │ Manager  │ │ Manager  │ │  Module  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
┌─────────────────────────┴───────────────────────────────────┐
│                   Backend Services Layer                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Express API  │ │Token Service │ │Polling Engine│       │
│  │   Port 8080  │ │  Port 8081   │ │  30s cycle   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────┬───────────────────────────────────┘
                          │ SQL/RPC
┌─────────────────────────┴───────────────────────────────────┐
│                        Supabase                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Merchants │ │ Products │ │ Events   │ │Analytics │      │
│  │  Tables  │ │  Tables  │ │  Tables  │ │  Tables  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────┬───────────────────────────────────┘
                          │ OAuth2/API
┌─────────────────────────┴───────────────────────────────────┐
│                        iFood API                             │
│  Events • Merchants • Products • Catalog • Token Management │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Módulos Core Implementados

### 🔐 Token Management
- Renovação automática de tokens OAuth2
- Cache inteligente e retry automático
- Scheduler robusto para manutenção

### 🏪 Merchant Management
- Gestão de estabelecimentos
- Controle de horários de funcionamento
- Status e configurações

### 📚 Catalog Management
- Sincronização de produtos e preços
- Upload e gestão de imagens
- Categorias e modificadores

### 🔄 Events System
- Polling de eventos em tempo real (30s)
- Processamento e deduplicação
- Sistema de acknowledgment

### Frontend Modules

| Módulo | Status | Funcionalidades |
|--------|--------|-----------------|
| **IfoodOrdersManager** | ✅ 100% | Gestão completa do ciclo de pedidos, confirmação, cancelamento, status em tempo real |
| **IfoodShippingManager** | ✅ 100% | Rastreamento de entregas, mapas interativos, gestão de motoristas, Safe Delivery |
| **IfoodReviewsManager** | ✅ 100% | Respostas a avaliações, análise de sentimento, métricas de satisfação |
| **IfoodApiConfig** | ✅ 100% | Configuração de credenciais, gestão de tokens OAuth2, health check |
| **ShippingMap** | ✅ 100% | Visualização geográfica de entregas, heatmaps, análise por região |

### Backend Services

| Serviço | Porta | Responsabilidade |
|---------|-------|------------------|
| **Express API** | 8080 | API principal, roteamento, autenticação |
| **Token Service** | 8081 | Gestão de tokens OAuth2, renovação automática |
| **Polling Engine** | - | Sincronização em tempo real com iFood (30s) |

### Integrações iFood API

| API | Status | Uso |
|-----|--------|-----|
| **Events API** | ✅ Ativo | Recebimento de eventos de pedidos em tempo real |
| **Orders API** | ✅ Ativo | Detalhes completos e gestão de pedidos |
| **Virtual Bag** | ✅ Ativo | Importação de pedidos com itens detalhados |
| **Reviews API** | ✅ Ativo | Sincronização e resposta a avaliações |
| **Shipping API** | ✅ Ativo | Rastreamento e gestão de entregas |
| **Safe Delivery** | ✅ Ativo | Avaliação de risco e segurança |

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

```sql
-- Pedidos
ifood_orders          -- Armazenamento completo de pedidos
ifood_events          -- Log de eventos com status de confirmação
ifood_polling_log     -- Histórico e métricas de polling

-- Entregas
ifood_shipping_status -- Status de entrega em tempo real
ifood_shipping_events -- Eventos relacionados a entregas
ifood_address_changes -- Solicitações de mudança de endereço
ifood_safe_delivery   -- Scoring de segurança e risco
ifood_delivery_persons -- Informações de entregadores

-- Avaliações
ifood_reviews         -- Avaliações de clientes
ifood_review_replies  -- Respostas do estabelecimento
ifood_review_summary  -- Estatísticas agregadas

-- Analytics
delivery_history      -- Histórico completo para heatmaps
delivery_regions      -- Gestão de zonas de entrega
delivery_grid_analytics -- Analytics baseado em grid
neighborhood_trends   -- Métricas por bairro
customer_location_analytics -- Insights geográficos
```

## 🔧 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ e npm/yarn
- Conta Supabase configurada
- Credenciais iFood API (client_id, client_secret)
- Git para versionamento

### Instalação Rápida

```bash
# 1. Clone o repositório
git clone [seu-repositorio]
cd plano-certo-hub

# 2. Instale dependências do Frontend
cd frontend/plano-certo-hub-insights
npm install

# 3. Instale dependências do Backend
cd ../../backend
npm install

# 4. Instale dependências do Token Service
cd ../services/ifood-token-service
npm install

# 5. Configure variáveis de ambiente (veja seção abaixo)

# 6. Execute as migrações do banco
cd services/ifood-token-service
node executeMigration.js

# 7. Inicie os serviços (em terminais separados)
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Token Service
cd services/ifood-token-service && npm run dev

# Terminal 3 - Frontend
cd frontend/plano-certo-hub-insights && npm run dev
```

### Variáveis de Ambiente

#### Backend (.env)
```env
PORT=8080
SUPABASE_URL=sua_url_supabase
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_KEY=sua_chave_servico
```

#### Token Service (.env)
```env
PORT=8081
SUPABASE_URL=sua_url_supabase
SUPABASE_SERVICE_KEY=sua_chave_servico
IFOOD_CLIENT_ID=seu_client_id
IFOOD_CLIENT_SECRET=seu_client_secret
```

#### Frontend (.env)
```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_API_URL=http://localhost:8080
VITE_TOKEN_SERVICE_URL=http://localhost:8081
```

## 🎯 Uso do Sistema

### 1. Configuração Inicial
1. Acesse o sistema em `http://localhost:5173`
2. Faça login com suas credenciais
3. Navegue até **Configurações → API iFood**
4. Insira suas credenciais do iFood
5. Teste a conexão

### 2. Gerenciamento de Pedidos
1. Acesse **Pedidos → Gestão de Pedidos**
2. O sistema iniciará polling automático
3. Novos pedidos aparecerão em tempo real
4. Use os botões de ação para gerenciar o ciclo

### 3. Acompanhamento de Entregas
1. Acesse **Entregas → Rastreamento**
2. Visualize entregas ativas no mapa
3. Monitore status e localização dos entregadores
4. Gerencie solicitações de mudança de endereço

### 4. Resposta a Avaliações
1. Acesse **Avaliações → Gerenciar**
2. Veja novas avaliações em tempo real
3. Responda diretamente pelo sistema
4. Acompanhe métricas de satisfação

## 📈 Funcionalidades Avançadas

### Heatmap de Vendas
```javascript
// Implementação disponível em ShippingMap.tsx
// Visualização automática de densidade de pedidos por região
// Dados agregados em grid de 500m para análise
```

### Analytics Geográfico
- **Top Regiões**: Identificação de áreas mais lucrativas
- **Tendências**: Análise temporal por bairro
- **Horários de Pico**: Padrões de demanda por localização
- **Otimização de Entrega**: Cálculo de rotas e tempos médios

### Sistema de Polling Inteligente
- **Alta Precisão**: Correção automática de drift
- **Deduplicação**: Prevenção de eventos duplicados
- **Cache Otimizado**: Token (5min) e Merchant (10min)
- **Monitoramento**: Métricas de performance em tempo real

## 🛠️ Desenvolvimento

### Estrutura de Pastas
```
plano-certo-hub/
├── frontend/
│   └── plano-certo-hub-insights/
│       ├── src/
│       │   ├── components/
│       │   │   └── modules/      # Módulos principais
│       │   ├── pages/            # Páginas e rotas
│       │   └── lib/              # Utilitários
│       └── public/
├── backend/
│   ├── server.js                 # API Express principal
│   └── routes/                   # Rotas da API
├── services/
│   └── ifood-token-service/
│       ├── src/
│       │   ├── server.ts         # Servidor do serviço
│       │   ├── ifoodOrderService.ts
│       │   └── ifoodPollingService.ts
│       └── migrations/           # Scripts SQL
└── docs/
    └── [esta documentação]
```

### Comandos Úteis

```bash
# Frontend
npm run dev          # Desenvolvimento com hot-reload
npm run build        # Build de produção
npm run preview      # Preview do build

# Backend/Services
npm run dev          # Desenvolvimento com nodemon
npm start            # Produção
npm test             # Executar testes

# Database
node executeMigration.js  # Rodar migrações
```

### Padrões de Código
- **TypeScript** para type safety
- **ESLint** para linting
- **Prettier** para formatação
- **Conventional Commits** para mensagens de commit

## 🔒 Segurança

### Implementações de Segurança
- ✅ Autenticação via Supabase Auth
- ✅ Row Level Security (RLS) no banco
- ✅ Validação de merchant_id em todas operações
- ✅ Tokens OAuth2 com renovação automática
- ✅ CORS configurado para domínios específicos
- ✅ Rate limiting em APIs críticas
- ✅ Sanitização de inputs do usuário

### Boas Práticas
- Nunca commitar arquivos `.env`
- Rotacionar tokens regularmente
- Usar HTTPS em produção
- Monitorar logs de acesso
- Implementar backup regular do banco

## 📞 Suporte e Troubleshooting

### Problemas Comuns

| Problema | Solução |
|----------|---------|
| Polling não inicia | Verifique credenciais iFood e tokens |
| Pedidos não aparecem | Confirme merchant_id correto |
| Erro de CORS | Verifique configuração de domínios |
| Token expirado | Sistema renova automaticamente em 5min |

### Logs e Monitoramento
```bash
# Ver logs do Token Service
tail -f services/ifood-token-service/logs/app.log

# Monitorar polling
SELECT * FROM ifood_polling_log ORDER BY created_at DESC LIMIT 10;

# Verificar eventos
SELECT * FROM ifood_events WHERE acknowledged = false;
```

## 🚀 Deploy em Produção

### Recomendações
1. **Frontend**: Deploy via Vercel/Netlify
2. **Backend**: Deploy em Railway/Render
3. **Database**: Supabase (já em cloud)
4. **Monitoring**: Sentry para error tracking

### Checklist de Deploy
- [ ] Variáveis de ambiente configuradas
- [ ] SSL/HTTPS habilitado
- [ ] Backup automático configurado
- [ ] Monitoring ativo
- [ ] Rate limiting configurado
- [ ] Logs centralizados

## 📚 Documentação Adicional

- [Critérios de Homologação iFood](./Criterios_homologação_Ifood.md)
- [Especificação da API de Reviews](./IFOOD_REVIEW_API_SPECIFICATION.md)
- [Guia de Analytics de Entregas](./DELIVERY_ANALYTICS_GUIDE.md)
- [Implementação Virtual Bag](./VIRTUAL_BAG_IMPLEMENTATION.md)
- [Status de Endpoints Pendentes](./IFOOD_ENDPOINTS_PENDENTES.md)

## 📄 Licença

Proprietary - Todos os direitos reservados

---

**Última atualização**: Setembro 2024
**Versão**: 2.0.0
**Status**: Production Ready 🚀