# Resumo Executivo: Build e Push Docker

## 🎯 Processo em 6 Passos

### 1. Login Docker Hub
```bash
docker login
```

### 2. Build Backend
```bash
cd backend/ifood-token-service/
docker build -t paxley/plano-certo-backend:1.0.8 .
docker build -t paxley/plano-certo-backend:latest .
```

### 3. Push Backend
```bash
docker push paxley/plano-certo-backend:1.0.8
docker push paxley/plano-certo-backend:latest
```

### 4. Build Frontend
```bash
cd ../../frontend/plano-certo-hub-insights/
docker build -t paxley/plano-certo-frontend:1.0.8 .
docker build -t paxley/plano-certo-frontend:latest .
```

### 5. Push Frontend
```bash
docker push paxley/plano-certo-frontend:1.0.8
docker push paxley/plano-certo-frontend:latest
```

### 6. Verificar Docker Hub
- https://hub.docker.com/r/paxley/plano-certo-backend
- https://hub.docker.com/r/paxley/plano-certo-frontend

---

## 📋 Estrutura da Stack

```
Aplicação: Plano Certo
├── Backend
│   ├── Localização: backend/ifood-token-service/
│   ├── Dockerfile: Multi-stage (builder + production)
│   ├── Base: node:20-alpine
│   ├── Porta: 3010
│   └── Imagem: paxley/plano-certo-backend:1.0.8
│
└── Frontend
    ├── Localização: frontend/plano-certo-hub-insights/
    ├── Dockerfile: Multi-stage (builder + serve)
    ├── Base: node:20-alpine
    ├── Porta: 3000
    └── Imagem: paxley/plano-certo-frontend:1.0.8
```

---

## 🔑 Informações-Chave

### Docker Hub
- **Registry**: docker.io
- **Namespace**: paxley
- **Versão**: 1.0.8 (SemVer: MAJOR.MINOR.PATCH)

### Dockerfiles
**Backend**: Multi-stage build com TypeScript
```dockerfile
Stage 1 (builder): npm ci + npm run build
Stage 2 (production): npm ci --only=production + dist/
```

**Frontend**: Multi-stage build com React/Vite
```dockerfile
Stage 1 (builder): npm ci + npm run build
Stage 2 (production): serve -s dist -l 3000
```

### Características
- ✅ Multi-stage builds (otimização de tamanho)
- ✅ Alpine Linux (imagens ~50MB menores)
- ✅ Cache eficiente (package.json copiado antes do código)
- ✅ Production-only deps na imagem final

---

## 🚀 Template para Nova Aplicação

```bash
# SUBSTITUIR:
# - paxley           → SEU_DOCKER_USERNAME
# - plano-certo      → SEU_APP_NAME
# - 1.0.8            → SUA_VERSAO
# - 3010/3000        → SUAS_PORTAS

# 1. LOGIN
docker login

# 2. BUILD
cd caminho/para/seu/servico/
docker build -t SEU_USER/SEU_APP:VERSAO .

# 3. TESTAR (IMPORTANTE!)
docker run -d -p PORTA:PORTA --name test SEU_USER/SEU_APP:VERSAO
docker logs test -f
curl http://localhost:PORTA
docker stop test && docker rm test

# 4. PUSH
docker push SEU_USER/SEU_APP:VERSAO

# 5. ATUALIZAR docker-compose.yml
services:
  seu-servico:
    image: SEU_USER/SEU_APP:VERSAO
```

---

## ✅ Checklist Mínimo

Antes de fazer build:
- [ ] Dockerfile existe e está validado
- [ ] package.json tem scripts `build` e `start`
- [ ] .dockerignore criado (node_modules, .git, .env)
- [ ] Logado no Docker Hub

Antes de fazer push:
- [ ] Build executou sem erros
- [ ] Teste local passou
- [ ] Versão está correta no nome da tag

---

## 🎓 Padrões Importantes

### Naming Convention
```
NAMESPACE/NOME-DO-APP-SERVICO:VERSAO
└─paxley──┘└plano-certo-backend┘└1.0.8┘
```

### Versioning (SemVer)
```
1.0.8 → 1.0.9: Bug fix
1.0.9 → 1.1.0: Nova feature
1.9.5 → 2.0.0: Breaking change
```

### Tags Recomendadas
```bash
# Sempre: Versão específica
-t paxley/app:1.0.8

# Opcional: Latest (última versão)
-t paxley/app:latest

# Staging: Branch name
-t paxley/app:develop
```

---

## 🔧 Comandos Úteis

```bash
# Ver imagens locais
docker images | grep seu-app

# Remover imagem
docker rmi paxley/app:1.0.8

# Inspecionar imagem
docker inspect paxley/app:1.0.8

# Ver histórico de layers
docker history paxley/app:1.0.8

# Limpar cache
docker builder prune
```

---

## 📚 Arquivos de Referência

- **Guia Completo**: `claudedocs/GUIA_BUILD_PUSH_DOCKER.md`
- **Backend Dockerfile**: `backend/ifood-token-service/Dockerfile`
- **Frontend Dockerfile**: `frontend/plano-certo-hub-insights/Dockerfile`
- **Docker Compose**: `docker-compose-original.yml`

---

**Para Claude que vai fazer build de outra aplicação**:
Leia o GUIA_BUILD_PUSH_DOCKER.md completo para entender todos os detalhes, edge cases e troubleshooting. Este resumo é apenas para referência rápida.
