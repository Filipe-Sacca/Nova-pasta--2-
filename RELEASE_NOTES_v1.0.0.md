

# 🎉 Release Notes - Versão 1.0.0

**Data de Release**: 04 de Outubro de 2025
**Versão**: 1.0.0
**Tipo**: Production Release

---

## 📦 Imagens Docker

### Backend
- **Nome**: `paxley/plano-certo-backend:1.0.0`
- **Latest**: `paxley/plano-certo-backend:latest`
- **Tamanho**: 155 MB
- **Porta**: 3010
- **Tecnologias**: Node.js 20 Alpine, Express, TypeScript

### Frontend
- **Nome**: `paxley/plano-certo-frontend:1.0.0`
- **Latest**: `paxley/plano-certo-frontend:latest`
- **Tamanho**: 150 MB (com build de produção)
- **Porta**: 3000
- **Tecnologias**: React, Vite, Serve

---

## ✨ Principais Mudanças

### 🌐 Endpoints de Produção

Frontend agora configurado para produção:

**Antes (Desenvolvimento)**:
```env
VITE_API_URL=http://localhost:8080
VITE_TOKEN_SERVICE_URL=http://localhost:8092
VITE_BACKEND_URL=http://localhost:8093
```

**Agora (Produção)**:
```env
VITE_API_URL=https://api.planocertodelivery.com
VITE_TOKEN_SERVICE_URL=https://api.planocertodelivery.com
VITE_BACKEND_URL=https://api.planocertodelivery.com
```

### 🔧 Arquitetura Traefik Puro

- ✅ Removido Nginx do frontend
- ✅ Frontend usa `serve` (npm) diretamente
- ✅ Traefik gerencia todo roteamento, SSL e headers
- ✅ Menos camadas, mais eficiente

### 🔄 Alta Disponibilidade

- ✅ 2 réplicas por serviço (backend e frontend)
- ✅ Load balancing automático via Traefik
- ✅ Health checks configurados
- ✅ Auto-restart em caso de falha

### 🛡️ Segurança

- ✅ HTTPS obrigatório (Let's Encrypt)
- ✅ Security headers (HSTS, XSS, Frame Options)
- ✅ Rate limiting no backend (100 req/s)
- ✅ CORS configurado
- ✅ GZIP compression

---

## 🔨 Correções de Bugs

### Problemas de Replicação Corrigidos

1. **Traefik Rules sem backticks**
   - ❌ Antes: `Host(api.planocertodelivery.com)`
   - ✅ Agora: `Host(\`api.planocertodelivery.com\`)`

2. **Porta Frontend Incorreta**
   - ❌ Antes: Porta 80 (Nginx)
   - ✅ Agora: Porta 3000 (Serve)

3. **Réplica Única**
   - ❌ Antes: 1 réplica (sem HA)
   - ✅ Agora: 2 réplicas (com HA)

4. **Placement Constraint Restritivo**
   - ❌ Antes: Somente managers
   - ✅ Agora: Workers (escalável)

---

## 📋 Funcionalidades

### Backend (API)

- ✅ Token management iFood
- ✅ Merchant operations
- ✅ Product/Menu management
- ✅ Status monitoring
- ✅ Interruptions management
- ✅ Opening hours management
- ✅ Image upload/sync
- ✅ Health check endpoint (`/health`)
- ✅ Supabase integration

### Frontend (Dashboard)

- ✅ Login/Authentication
- ✅ Dashboard principal
- ✅ Gestão de produtos
- ✅ Gestão de categorias
- ✅ Gestão de merchants
- ✅ Upload de imagens
- ✅ Configuração iFood
- ✅ Horários de funcionamento
- ✅ Status em tempo real

---

## 🚀 Deploy

### Pull das Imagens

```bash
docker pull paxley/plano-certo-backend:1.0.0
docker pull paxley/plano-certo-frontend:1.0.0
```

### Docker Compose

Use o arquivo `docker-compose-fixed.yml` incluído no release:

```bash
docker stack deploy -c docker-compose-fixed.yml plano-certo
```

### Portainer

1. Acesse Portainer
2. Stacks → Add stack
3. Nome: `plano-certo`
4. Cole o conteúdo de `docker-compose-fixed.yml`
5. Deploy

---

## ✅ Verificação Pós-Deploy

### Verificar Serviços

```bash
docker stack services plano-certo
```

**Esperado**:
- `plano-certo_backend`: 2/2 réplicas
- `plano-certo_frontend`: 2/2 réplicas

### Testar Endpoints

```bash
# Backend health
curl https://api.planocertodelivery.com/health

# Frontend
curl https://app.planocertodelivery.com/
```

### Verificar SSL

```bash
curl -I https://api.planocertodelivery.com/health | grep -i strict
curl -I https://app.planocertodelivery.com/ | grep -i strict
```

---

## 📊 Métricas e Recursos

### Requisitos Mínimos

- **CPU**: 1.6 cores total
- **RAM**: 1.5 GB total
- **Disco**: 500 MB para imagens
- **Network**: Acesso externo para Traefik

### Limites por Réplica

**Backend**:
- CPU: 0.25-0.5 cores
- RAM: 256-512 MB

**Frontend**:
- CPU: 0.1-0.3 cores
- RAM: 128-256 MB

---

## 🔧 Configuração

### Variáveis de Ambiente

**Backend**:
- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_ANON_KEY`: Chave anônima Supabase
- `SUPABASE_SERVICE_KEY`: Chave de serviço Supabase
- `PORT`: 3010
- `NODE_ENV`: production

**Frontend**:
- Endpoints embutidos no build (não requer variáveis runtime)

### Domínios

- **Backend**: `api.planocertodelivery.com`
- **Frontend**: `app.planocertodelivery.com`

---

## 🐛 Problemas Conhecidos

Nenhum problema conhecido nesta versão.

---

## 📚 Documentação

### Arquivos Incluídos

- `docker-compose-fixed.yml` - Stack corrigido para produção
- `REPLICATION_FIXES.md` - Documentação dos problemas corrigidos
- `TRAEFIK_MIGRATION.md` - Migração Nginx → Traefik
- `DEPLOY_CHECKLIST.md` - Checklist de deploy
- `diagnose-replication.sh` - Script de diagnóstico

### Links Úteis

- **DockerHub Backend**: https://hub.docker.com/r/paxley/plano-certo-backend
- **DockerHub Frontend**: https://hub.docker.com/r/paxley/plano-certo-frontend

---

## 🔄 Upgrade de Versões Anteriores

Se você está vindo de uma versão anterior:

1. **Backup**: Faça backup do banco de dados Supabase
2. **Remove**: `docker stack rm plano-certo`
3. **Aguarde**: `sleep 30`
4. **Deploy**: `docker stack deploy -c docker-compose-fixed.yml plano-certo`
5. **Verifique**: Endpoints e funcionalidades

---

## 👥 Contribuidores

- Build e deployment automatizado
- Documentação completa
- Correções de bugs de replicação
- Migração para Traefik puro

---

## 📝 Changelog Completo

### [1.0.0] - 2025-10-04

#### Added
- ✅ Versão de produção com endpoints configurados
- ✅ Alta disponibilidade com 2 réplicas
- ✅ Health checks completos
- ✅ Scripts de diagnóstico
- ✅ Documentação completa

#### Changed
- 🔄 Frontend migrado de Nginx para Serve
- 🔄 Endpoints de desenvolvimento → produção
- 🔄 Placement constraints: managers → workers
- 🔄 Traefik rules corrigidas (com backticks)

#### Fixed
- 🐛 Porta frontend corrigida (80 → 3000)
- 🐛 Problemas de replicação
- 🐛 Health checks falhando
- 🐛 Traefik não roteando

#### Removed
- ❌ Nginx do frontend
- ❌ Configuração nginx.conf
- ❌ Camada extra de proxy

---

## 🎯 Próximos Passos

Para futuras versões:

- [ ] Monitoring e alertas
- [ ] Métricas Prometheus
- [ ] Dashboard Grafana
- [ ] Backup automatizado
- [ ] CI/CD pipeline
- [ ] Testes automatizados

---

## 🆘 Suporte

Para problemas ou dúvidas:

1. Consulte `REPLICATION_FIXES.md`
2. Execute `./diagnose-replication.sh`
3. Verifique logs: `docker service logs plano-certo_backend`
4. Verifique Traefik: `docker service logs traefik`

---

**Versão**: 1.0.0
**Status**: ✅ Production Ready
**Data**: 04/10/2025
