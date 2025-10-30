# Docker Build & Push - Cheat Sheet ⚡

## 🚀 Comandos Essenciais (Copiar e Colar)

### Login Docker Hub
```bash
docker login
```

### Build Backend
```bash
cd backend/ifood-token-service/
docker build -t paxley/plano-certo-backend:1.0.8 .
docker build -t paxley/plano-certo-backend:latest .
```

### Push Backend
```bash
docker push paxley/plano-certo-backend:1.0.8
docker push paxley/plano-certo-backend:latest
```

### Build Frontend
```bash
cd ../../frontend/plano-certo-hub-insights/
docker build -t paxley/plano-certo-frontend:1.0.8 .
docker build -t paxley/plano-certo-frontend:latest .
```

### Push Frontend
```bash
docker push paxley/plano-certo-frontend:1.0.8
docker push paxley/plano-certo-frontend:latest
```

### Script Automatizado
```bash
./build-and-push.sh 1.0.8
```

---

## 📋 Template para Nova Aplicação

```bash
# 1. LOGIN
docker login

# 2. BUILD
cd caminho/para/servico/
docker build -t SEU_USER/SEU_APP:VERSAO .

# 3. TESTAR
docker run -d -p PORTA:PORTA --name test SEU_USER/SEU_APP:VERSAO
docker logs test -f
curl http://localhost:PORTA
docker stop test && docker rm test

# 4. PUSH
docker push SEU_USER/SEU_APP:VERSAO
```

---

## 🔧 Comandos Úteis

```bash
# Ver imagens
docker images | grep plano-certo

# Ver containers
docker ps -a

# Logs
docker logs -f CONTAINER_NAME

# Entrar no container
docker exec -it CONTAINER_NAME sh

# Inspecionar imagem
docker inspect IMAGE_NAME

# Histórico de layers
docker history IMAGE_NAME

# Remover imagem
docker rmi IMAGE_NAME

# Limpar tudo não usado
docker system prune -a
```

---

## 📝 Estrutura Dockerfiles

### Backend (Node.js + TypeScript)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3010
CMD ["npm", "start"]
```

### Frontend (React + Vite)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

---

## 📂 .dockerignore Essencial

```
node_modules
npm-debug.log
.git
.env
.env.local
dist
build
*.log
.DS_Store
.vscode
README.md
docker-compose*.yml
```

---

## ✅ Checklist Rápido

**Antes de Build**:
- [ ] docker login
- [ ] .dockerignore criado
- [ ] Dockerfile validado

**Depois de Build**:
- [ ] Teste local passou
- [ ] Tamanho razoável (<200MB)
- [ ] Push realizado
- [ ] Verificado no Docker Hub

---

## 🎯 Versionamento (SemVer)

```
1.0.8 → 1.0.9  (bug fix)
1.0.9 → 1.1.0  (nova feature)
1.9.5 → 2.0.0  (breaking change)
```

---

## 🔗 Links Rápidos

**Docker Hub**:
- https://hub.docker.com/r/paxley/plano-certo-backend
- https://hub.docker.com/r/paxley/plano-certo-frontend

**Documentação Completa**:
- `claudedocs/GUIA_BUILD_PUSH_DOCKER.md` (guia completo)
- `claudedocs/RESUMO_BUILD_PUSH.md` (resumo)
- `claudedocs/EXEMPLOS_PRATICOS.md` (exemplos)
- `claudedocs/DIAGRAMA_FLUXO_DOCKER.md` (diagramas)

---

## 🚨 Troubleshooting Rápido

**Erro: "denied: requested access"**
→ `docker login` novamente

**Build muito lento**
→ Criar/melhorar `.dockerignore`

**Imagem muito grande**
→ Usar multi-stage build

**Container não inicia**
→ `docker logs CONTAINER_NAME`

---

## 📊 Info do Projeto Atual

```yaml
Backend:
  Imagem: paxley/plano-certo-backend:1.0.8
  Dir: backend/ifood-token-service/
  Porta: 3010
  Tamanho: ~150MB

Frontend:
  Imagem: paxley/plano-certo-frontend:1.0.8
  Dir: frontend/plano-certo-hub-insights/
  Porta: 3000
  Tamanho: ~120MB
```

---

**Para documentação completa, veja**: `claudedocs/README_DOCKER_DOCS.md` 📚
