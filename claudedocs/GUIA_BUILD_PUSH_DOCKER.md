# Guia Completo: Build e Push de Imagens Docker para Produção

## 📋 Visão Geral da Arquitetura

Esta aplicação (Plano Certo) possui **2 serviços principais** em produção:

```yaml
1. Backend (Node.js/TypeScript)
   - Imagem: paxley/plano-certo-backend:1.0.8
   - Porta: 3010
   - Dockerfile: backend/ifood-token-service/Dockerfile

2. Frontend (React/Vite)
   - Imagem: paxley/plano-certo-frontend:1.0.8
   - Porta: 3000
   - Dockerfile: frontend/plano-certo-hub-insights/Dockerfile
```

**Registry usado**: Docker Hub (docker.io)
**Namespace**: paxley
**Estratégia**: Multi-stage builds para otimização

---

## 🏗️ Análise dos Dockerfiles

### Backend Dockerfile (Multi-stage Build)

**Localização**: `backend/ifood-token-service/Dockerfile`

```dockerfile
# STAGE 1: Builder - Compila o código TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                    # Instala TODAS as dependências (dev + prod)
COPY . .
RUN npm run build             # Compila TypeScript → JavaScript (dist/)

# STAGE 2: Production - Imagem final otimizada
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production  # Instala APENAS dependências de produção
COPY --from=builder /app/dist ./dist  # Copia código compilado do stage anterior
COPY .env* ./                 # Copia arquivos de ambiente (se existirem)
EXPOSE 3010
CMD ["npm", "start"]          # Executa: node dist/index.js
```

**Características**:
- ✅ Multi-stage: Reduz tamanho final (não inclui devDependencies)
- ✅ Alpine Linux: Imagem base menor (~50MB vs ~900MB)
- ✅ Cache otimizado: package.json copiado antes do código fonte
- ✅ Build separado: TypeScript compilado em stage isolado

---

### Frontend Dockerfile (Multi-stage Build)

**Localização**: `frontend/plano-certo-hub-insights/Dockerfile`

```dockerfile
# STAGE 1: Builder - Compila o código React/Vite
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                    # Instala todas as dependências
COPY . .
RUN npm run build             # Build do Vite → dist/ (HTML/CSS/JS estático)

# STAGE 2: Production - Servidor HTTP simples
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve      # Instala 'serve' para servir arquivos estáticos
COPY --from=builder /app/dist ./dist  # Copia build do React
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
```

**Características**:
- ✅ Multi-stage: Build isolado do runtime
- ✅ Serve: Servidor HTTP simples e eficiente para SPAs
- ✅ Flags do serve: `-s` (SPA mode), `-l` (porta), `--no-clipboard` (sem clipboard)
- ✅ Sem Nginx: Solução mais simples para SPAs pequenos/médios

---

## 🚀 Processo Completo de Build e Push

### **PASSO 1: Preparação do Ambiente**

#### 1.1. Login no Docker Hub
```bash
# Login interativo (pedirá usuário e senha)
docker login

# OU login direto (menos seguro, usar apenas em CI/CD)
docker login -u paxley -p SEU_TOKEN_DOCKER_HUB
```

**Verificação**:
```bash
cat ~/.docker/config.json  # Deve mostrar auth configurado para docker.io
```

#### 1.2. Verificar estrutura do projeto
```bash
# Backend
ls -la backend/ifood-token-service/
# Deve conter: Dockerfile, package.json, src/, tsconfig.json

# Frontend
ls -la frontend/plano-certo-hub-insights/
# Deve conter: Dockerfile, package.json, src/, index.html, vite.config.ts
```

---

### **PASSO 2: Build da Imagem Backend**

#### 2.1. Navegar para o diretório do backend
```bash
cd backend/ifood-token-service/
```

#### 2.2. Build da imagem com tag de versão
```bash
# Formato: docker build -t NAMESPACE/NOME:VERSAO .
docker build -t paxley/plano-certo-backend:1.0.8 .

# OU build com múltiplas tags (versão + latest)
docker build \
  -t paxley/plano-certo-backend:1.0.8 \
  -t paxley/plano-certo-backend:latest \
  .
```

**Explicação dos parâmetros**:
- `-t`: Tag da imagem (formato: registry/namespace/nome:versao)
- `paxley`: Namespace no Docker Hub (seu username)
- `plano-certo-backend`: Nome da imagem
- `1.0.8`: Versão semântica (major.minor.patch)
- `.`: Contexto de build (diretório atual com Dockerfile)

#### 2.3. Verificar imagem criada
```bash
docker images | grep plano-certo-backend

# Saída esperada:
# paxley/plano-certo-backend  1.0.8   abc123def456   2 minutes ago   150MB
# paxley/plano-certo-backend  latest  abc123def456   2 minutes ago   150MB
```

#### 2.4. Testar imagem localmente (IMPORTANTE!)
```bash
# Executar container de teste
docker run -d \
  --name test-backend \
  -p 3010:3010 \
  -e SUPABASE_URL=https://icovzxzchijidohccopf.supabase.co \
  -e SUPABASE_ANON_KEY=eyJhbGciOiJI... \
  -e PORT=3010 \
  -e NODE_ENV=production \
  paxley/plano-certo-backend:1.0.8

# Verificar logs
docker logs test-backend -f

# Testar endpoint
curl http://localhost:3010/health

# Parar e remover container de teste
docker stop test-backend
docker rm test-backend
```

---

### **PASSO 3: Push da Imagem Backend**

```bash
# Push da versão específica
docker push paxley/plano-certo-backend:1.0.8

# Push da tag latest (se foi criada)
docker push paxley/plano-certo-backend:latest
```

**Saída esperada**:
```
The push refers to repository [docker.io/paxley/plano-certo-backend]
abc123def456: Pushed
1.0.8: digest: sha256:abc...def size: 1234
```

**Verificação no Docker Hub**:
- Acessar: https://hub.docker.com/r/paxley/plano-certo-backend
- Verificar tag `1.0.8` aparece na lista
- Verificar tamanho da imagem (~150MB)

---

### **PASSO 4: Build da Imagem Frontend**

#### 4.1. Navegar para o diretório do frontend
```bash
cd ../../frontend/plano-certo-hub-insights/
# OU: cd /root/Filipe/Plano-Certo/Nova-pasta--2-/frontend/plano-certo-hub-insights/
```

#### 4.2. Build da imagem com tag de versão
```bash
docker build -t paxley/plano-certo-frontend:1.0.8 .

# OU com múltiplas tags
docker build \
  -t paxley/plano-certo-frontend:1.0.8 \
  -t paxley/plano-certo-frontend:latest \
  .
```

#### 4.3. Verificar imagem criada
```bash
docker images | grep plano-certo-frontend

# Saída esperada:
# paxley/plano-certo-frontend  1.0.8   xyz789abc123   1 minute ago   120MB
```

#### 4.4. Testar imagem localmente
```bash
# Executar container de teste
docker run -d \
  --name test-frontend \
  -p 3000:3000 \
  paxley/plano-certo-frontend:1.0.8

# Verificar logs
docker logs test-frontend -f

# Testar no browser
curl http://localhost:3000
# OU abrir: http://localhost:3000 no navegador

# Parar e remover container de teste
docker stop test-frontend
docker rm test-frontend
```

---

### **PASSO 5: Push da Imagem Frontend**

```bash
# Push da versão específica
docker push paxley/plano-certo-frontend:1.0.8

# Push da tag latest (se foi criada)
docker push paxley/plano-certo-frontend:latest
```

---

## 🎯 Script Automatizado (Recomendado)

Crie um script `build-and-push.sh` na raiz do projeto:

```bash
#!/bin/bash
set -e  # Para em caso de erro

VERSION="1.0.8"
DOCKER_USER="paxley"
PROJECT_NAME="plano-certo"

echo "🔐 Fazendo login no Docker Hub..."
docker login

echo ""
echo "🏗️  Building Backend..."
cd backend/ifood-token-service/
docker build -t ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION} .
docker build -t ${DOCKER_USER}/${PROJECT_NAME}-backend:latest .

echo ""
echo "🚀 Pushing Backend..."
docker push ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION}
docker push ${DOCKER_USER}/${PROJECT_NAME}-backend:latest

echo ""
echo "🏗️  Building Frontend..."
cd ../../frontend/plano-certo-hub-insights/
docker build -t ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION} .
docker build -t ${DOCKER_USER}/${PROJECT_NAME}-frontend:latest .

echo ""
echo "🚀 Pushing Frontend..."
docker push ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION}
docker push ${DOCKER_USER}/${PROJECT_NAME}-frontend:latest

echo ""
echo "✅ Build e push completos!"
echo "📦 Imagens criadas:"
echo "   - ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION}"
echo "   - ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION}"
```

**Uso**:
```bash
chmod +x build-and-push.sh
./build-and-push.sh
```

---

## 📝 Convenções de Versionamento

### Semântica de Versões (SemVer)

Formato: `MAJOR.MINOR.PATCH`

```
1.0.8
│ │ │
│ │ └─── PATCH: Correções de bugs, hotfixes
│ └───── MINOR: Novas features (compatível com versões anteriores)
└─────── MAJOR: Mudanças que quebram compatibilidade

Exemplos:
- 1.0.8 → 1.0.9: Bug fix
- 1.0.9 → 1.1.0: Nova feature
- 1.9.5 → 2.0.0: Breaking change
```

### Tags Recomendadas

```bash
# Tag de versão específica (obrigatória)
docker build -t paxley/app:1.0.8 .

# Tag latest (opcional, aponta para última versão)
docker build -t paxley/app:latest .

# Tag de branch (útil para staging)
docker build -t paxley/app:develop .

# Tag de commit (rastreabilidade)
docker build -t paxley/app:sha-abc123 .
```

---

## ✅ Checklist Completo para Nova Aplicação

### **PRÉ-BUILD**
- [ ] Dockerfile criado e validado
- [ ] package.json configurado com scripts `build` e `start`
- [ ] Arquivo `.dockerignore` criado (node_modules, .git, .env, etc)
- [ ] Variáveis de ambiente documentadas
- [ ] Porta exposta documentada

### **BUILD**
- [ ] Login no Docker Hub realizado
- [ ] Build executado sem erros
- [ ] Imagem inspecionada (`docker images`)
- [ ] Tamanho da imagem razoável (<200MB para Node.js)

### **TESTES LOCAIS**
- [ ] Container iniciado com sucesso
- [ ] Logs sem erros críticos
- [ ] Endpoints principais testados
- [ ] Health check funcionando (se aplicável)

### **PUSH**
- [ ] Tag de versão correta
- [ ] Push executado com sucesso
- [ ] Imagem verificada no Docker Hub
- [ ] Tag latest atualizada (se aplicável)

### **DOCKER-COMPOSE**
- [ ] docker-compose.yml atualizado com nova imagem
- [ ] Variáveis de ambiente configuradas
- [ ] Networks configuradas
- [ ] Deploy configs validadas (replicas, resources, etc)

### **DEPLOY**
- [ ] Stack atualizada em produção
- [ ] Serviços reiniciados corretamente
- [ ] Health checks passando
- [ ] Logs de produção verificados
- [ ] Monitoramento ativo

---

## 🔧 Troubleshooting

### Erro: "denied: requested access to the resource is denied"
**Causa**: Não logado no Docker Hub ou sem permissão no namespace

**Solução**:
```bash
docker login
# Verificar que está usando o namespace correto (seu username)
```

---

### Erro: "failed to solve with frontend dockerfile.v0"
**Causa**: Sintaxe inválida no Dockerfile

**Solução**:
```bash
# Validar Dockerfile
docker build --no-cache -t test:latest .

# Verificar linhas com erro no output
```

---

### Build muito lento
**Causa**: Cache ineficiente ou muitos arquivos sendo copiados

**Solução**:
```bash
# 1. Criar .dockerignore
cat > .dockerignore << EOF
node_modules
.git
.env
dist
build
*.log
.DS_Store
EOF

# 2. Usar cache de build
docker build --cache-from paxley/app:latest -t paxley/app:1.0.9 .
```

---

### Imagem muito grande (>500MB)
**Causa**: Não usando multi-stage ou copiando arquivos desnecessários

**Solução**:
```dockerfile
# Use multi-stage build
FROM node:20-alpine AS builder
# ... build

FROM node:20-alpine  # Imagem final limpa
COPY --from=builder /app/dist ./dist
```

---

## 📚 Comandos Docker Úteis

```bash
# Listar imagens locais
docker images

# Remover imagem local
docker rmi paxley/app:1.0.8

# Remover todas imagens não usadas
docker image prune -a

# Inspecionar imagem
docker inspect paxley/app:1.0.8

# Ver histórico de layers
docker history paxley/app:1.0.8

# Executar comando dentro do container
docker exec -it container_name sh

# Ver logs em tempo real
docker logs -f container_name

# Parar todos containers
docker stop $(docker ps -q)

# Remover todos containers parados
docker container prune
```

---

## 🎓 Resumo para Replicar em Outra Aplicação

### **Template Rápido**:

```bash
# 1. PREPARAR
cd /caminho/para/aplicacao
docker login

# 2. CRIAR Dockerfile (se não existir)
cat > Dockerfile << 'EOF'
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
EXPOSE 3000
CMD ["npm", "start"]
EOF

# 3. CRIAR .dockerignore
cat > .dockerignore << 'EOF'
node_modules
.git
.env
*.log
dist
build
EOF

# 4. BUILD
docker build -t SEU_USER/SEU_APP:1.0.0 .

# 5. TESTAR
docker run -d -p 3000:3000 --name test SEU_USER/SEU_APP:1.0.0
docker logs test -f
curl http://localhost:3000
docker stop test && docker rm test

# 6. PUSH
docker push SEU_USER/SEU_APP:1.0.0

# 7. ATUALIZAR docker-compose.yml
services:
  seu-app:
    image: SEU_USER/SEU_APP:1.0.0
    # ... resto da config
```

---

## 📞 Informações Importantes para o Outro Claude

### **Contexto da Stack Atual**:
- **Registry**: Docker Hub (docker.io)
- **Namespace**: paxley
- **Versão atual**: 1.0.8
- **Node version**: 20-alpine
- **Build tool**: npm (não yarn/pnpm)
- **Backend**: TypeScript compilado para dist/
- **Frontend**: React/Vite build para dist/

### **Modificações Necessárias para Outra Aplicação**:
1. Alterar namespace: `paxley` → `SEU_DOCKER_USERNAME`
2. Alterar nome da imagem: `plano-certo-*` → `SEU_APP_NAME`
3. Alterar portas se necessário: 3010 (backend), 3000 (frontend)
4. Adaptar variáveis de ambiente no docker-compose.yml
5. Verificar se usa mesmo build tool (npm vs yarn vs pnpm)
6. Adaptar healthcheck endpoints se necessário

### **Arquivos Essenciais**:
- ✅ Dockerfile (cada serviço)
- ✅ .dockerignore (cada serviço)
- ✅ docker-compose.yml (raiz do projeto)
- ✅ package.json com scripts `build` e `start`

---

**FIM DO GUIA** 🎉

Para dúvidas ou problemas, verificar:
- Docker Hub: https://hub.docker.com
- Docker Docs: https://docs.docker.com
- Troubleshooting section acima
