# Exemplos Práticos: Build e Push Docker

## 🎯 Cenários Comuns

### Cenário 1: Build e Push Versão 1.0.8 (Manual)

```bash
# 1. Login
docker login

# 2. Backend
cd backend/ifood-token-service/
docker build -t paxley/plano-certo-backend:1.0.8 .
docker build -t paxley/plano-certo-backend:latest .
docker push paxley/plano-certo-backend:1.0.8
docker push paxley/plano-certo-backend:latest

# 3. Frontend
cd ../../frontend/plano-certo-hub-insights/
docker build -t paxley/plano-certo-frontend:1.0.8 .
docker build -t paxley/plano-certo-frontend:latest .
docker push paxley/plano-certo-frontend:1.0.8
docker push paxley/plano-certo-frontend:latest
```

---

### Cenário 2: Build e Push Usando Script Automatizado

```bash
# Build versão 1.0.8
./build-and-push.sh 1.0.8

# Build versão 1.0.9
./build-and-push.sh 1.0.9

# Build versão 2.0.0
./build-and-push.sh 2.0.0
```

**Output esperado**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Validações Iniciais
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  Verificando Docker...
✅ Docker instalado: Docker version 24.0.5
ℹ️  Verificando login no Docker Hub...
✅ Já está logado no Docker Hub
...
✅ BUILD E PUSH COMPLETOS
📦 Imagens criadas e enviadas para Docker Hub
```

---

### Cenário 3: Build Local para Testes (Sem Push)

```bash
# Backend
cd backend/ifood-token-service/
docker build -t test-backend:dev .

# Testar localmente
docker run -d \
  --name test-backend \
  -p 3010:3010 \
  -e SUPABASE_URL=https://... \
  -e PORT=3010 \
  test-backend:dev

# Ver logs
docker logs -f test-backend

# Testar endpoint
curl http://localhost:3010/health

# Limpar
docker stop test-backend
docker rm test-backend
docker rmi test-backend:dev
```

---

### Cenário 4: Build com Cache de Imagem Anterior

```bash
# Usar cache da versão 1.0.7 para acelerar build da 1.0.8
cd backend/ifood-token-service/
docker build \
  --cache-from paxley/plano-certo-backend:1.0.7 \
  -t paxley/plano-certo-backend:1.0.8 \
  .
```

**Benefício**: Build ~50% mais rápido se houver poucas mudanças

---

### Cenário 5: Build Multiplataforma (AMD64 + ARM64)

```bash
# Criar builder multiplataforma
docker buildx create --name multiplatform --use

# Build para ambas arquiteturas
cd backend/ifood-token-service/
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t paxley/plano-certo-backend:1.0.8 \
  --push \
  .
```

**Quando usar**: Deploy em servidores ARM (AWS Graviton, Apple Silicon)

---

## 🔄 Fluxo Completo: Dev → Staging → Production

### 1. Desenvolvimento Local

```bash
# Build com tag de desenvolvimento
docker build -t paxley/plano-certo-backend:dev .

# Testar localmente
docker run -d -p 3010:3010 \
  --env-file .env.dev \
  paxley/plano-certo-backend:dev

# Validar
curl http://localhost:3010/health
```

---

### 2. Deploy em Staging

```bash
# Build com tag de staging
docker build -t paxley/plano-certo-backend:staging .
docker push paxley/plano-certo-backend:staging

# Atualizar docker-compose.staging.yml
services:
  backend:
    image: paxley/plano-certo-backend:staging

# Deploy
docker stack deploy -c docker-compose.staging.yml plano-certo-staging
```

---

### 3. Deploy em Production

```bash
# Build com versão semântica
docker build -t paxley/plano-certo-backend:1.0.8 .
docker build -t paxley/plano-certo-backend:latest .
docker push paxley/plano-certo-backend:1.0.8
docker push paxley/plano-certo-backend:latest

# Atualizar docker-compose.yml
services:
  backend:
    image: paxley/plano-certo-backend:1.0.8

# Deploy com rollback automático em caso de falha
docker stack deploy \
  --with-registry-auth \
  -c docker-compose.yml \
  plano-certo

# Monitorar deploy
watch -n 2 "docker service ls | grep plano-certo"
docker service logs -f plano-certo_backend
```

---

## 🐛 Debug e Troubleshooting

### Debug 1: Entrar no Container em Execução

```bash
# Listar containers
docker ps

# Entrar no container
docker exec -it plano-certo_backend.1.abc123 sh

# Dentro do container:
cd /app
ls -la
cat package.json
npm list
env | grep SUPABASE
exit
```

---

### Debug 2: Inspecionar Imagem Sem Executar

```bash
# Extrair filesystem da imagem
docker create --name temp paxley/plano-certo-backend:1.0.8
docker export temp | tar -xv
docker rm temp

# OU: Usar dive (ferramenta especializada)
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive:latest \
  paxley/plano-certo-backend:1.0.8
```

---

### Debug 3: Verificar Diferenças Entre Versões

```bash
# Ver mudanças entre 1.0.7 e 1.0.8
docker history paxley/plano-certo-backend:1.0.7 > v1.0.7.txt
docker history paxley/plano-certo-backend:1.0.8 > v1.0.8.txt
diff v1.0.7.txt v1.0.8.txt
```

---

### Debug 4: Rebuild Completo (Sem Cache)

```bash
# Quando o build está com problemas de cache
cd backend/ifood-token-service/
docker build --no-cache -t paxley/plano-certo-backend:1.0.8 .
```

---

## 📊 Comandos de Monitoramento

### Ver Tamanhos de Imagens

```bash
# Todas as imagens do projeto
docker images | grep plano-certo

# Comparar tamanhos
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep plano-certo

# Output esperado:
# paxley/plano-certo-backend    1.0.8   150MB
# paxley/plano-certo-frontend   1.0.8   120MB
```

---

### Verificar Layers da Imagem

```bash
# Ver todas as layers e seus tamanhos
docker history paxley/plano-certo-backend:1.0.8

# Output:
# IMAGE          CREATED         SIZE      COMMENT
# abc123def456   2 hours ago     50MB      CMD ["npm" "start"]
# def789ghi012   2 hours ago     100MB     COPY --from=builder...
# ...
```

---

### Inspecionar Metadados

```bash
# Ver todas as informações da imagem
docker inspect paxley/plano-certo-backend:1.0.8

# Extrair apenas porta exposta
docker inspect --format='{{.Config.ExposedPorts}}' \
  paxley/plano-certo-backend:1.0.8

# Extrair CMD
docker inspect --format='{{.Config.Cmd}}' \
  paxley/plano-certo-backend:1.0.8
```

---

## 🧹 Limpeza e Manutenção

### Remover Imagens Antigas

```bash
# Remover versão específica localmente
docker rmi paxley/plano-certo-backend:1.0.7

# Remover todas as imagens não usadas
docker image prune -a

# Remover tudo relacionado ao projeto localmente
docker rmi $(docker images | grep plano-certo | awk '{print $3}')
```

---

### Limpar Build Cache

```bash
# Ver uso de cache
docker system df

# Limpar cache de build
docker builder prune

# Limpar tudo (CUIDADO!)
docker system prune -a --volumes
```

---

## 🔐 Segurança: Docker Hub Tokens

### Criar Token de Acesso (Recomendado)

1. Acessar: https://hub.docker.com/settings/security
2. Criar novo token: "plano-certo-ci"
3. Copiar token (só aparece uma vez!)

```bash
# Login com token (CI/CD)
echo "SEU_TOKEN" | docker login -u paxley --password-stdin

# Salvar em variável de ambiente
export DOCKER_TOKEN="dckr_pat_abc123..."
echo $DOCKER_TOKEN | docker login -u paxley --password-stdin
```

---

## 📝 Templates para Outras Aplicações

### Template: Node.js + TypeScript (Backend)

```dockerfile
# Dockerfile
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
```

```bash
# Build e Push
docker build -t SEU_USER/SEU_APP-backend:1.0.0 .
docker push SEU_USER/SEU_APP-backend:1.0.0
```

---

### Template: React/Vite (Frontend)

```dockerfile
# Dockerfile
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

```bash
# Build e Push
docker build -t SEU_USER/SEU_APP-frontend:1.0.0 .
docker push SEU_USER/SEU_APP-frontend:1.0.0
```

---

### Template: .dockerignore (Essencial!)

```
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
.env.*.local
dist
build
coverage
.vscode
.idea
*.log
.DS_Store
README.md
docker-compose*.yml
Dockerfile*
```

---

## 🎓 Checklist para Outro Claude

Ao fazer build/push de outra aplicação, siga esta ordem:

### Fase 1: Preparação
- [ ] Analisar estrutura do projeto (backend/frontend)
- [ ] Identificar tecnologias (Node.js, React, Python, etc)
- [ ] Localizar package.json ou equivalente
- [ ] Verificar scripts de build disponíveis
- [ ] Identificar porta de exposição

### Fase 2: Criar Dockerfile
- [ ] Escolher imagem base apropriada
- [ ] Implementar multi-stage build
- [ ] Copiar apenas arquivos necessários
- [ ] Criar .dockerignore
- [ ] Validar sintaxe do Dockerfile

### Fase 3: Build Local
- [ ] docker login
- [ ] Build com tag de teste
- [ ] Verificar tamanho da imagem (<500MB)
- [ ] Inspecionar layers
- [ ] Testar localmente

### Fase 4: Push para Registry
- [ ] Build com versão correta
- [ ] Push para Docker Hub
- [ ] Verificar no registry
- [ ] Documentar versão

### Fase 5: Docker Compose
- [ ] Atualizar docker-compose.yml
- [ ] Configurar variáveis de ambiente
- [ ] Configurar networks
- [ ] Configurar healthchecks
- [ ] Testar stack completa

### Fase 6: Deploy
- [ ] Deploy em ambiente de staging
- [ ] Verificar logs
- [ ] Testar endpoints
- [ ] Deploy em produção
- [ ] Monitorar métricas

---

## 📚 Referências Rápidas

### Estrutura do Plano Certo
```
/root/Filipe/Plano-Certo/Nova-pasta--2-/
├── backend/
│   └── ifood-token-service/
│       ├── Dockerfile          # Build backend
│       ├── package.json
│       └── src/
├── frontend/
│   └── plano-certo-hub-insights/
│       ├── Dockerfile          # Build frontend
│       ├── package.json
│       └── src/
├── docker-compose-original.yml # Stack produção
├── build-and-push.sh          # Script automático
└── claudedocs/
    ├── GUIA_BUILD_PUSH_DOCKER.md  # Guia completo
    ├── RESUMO_BUILD_PUSH.md       # Resumo executivo
    └── EXEMPLOS_PRATICOS.md       # Este arquivo
```

### Links Úteis
- Docker Hub: https://hub.docker.com/r/paxley/
- Docker Docs: https://docs.docker.com
- Multi-stage: https://docs.docker.com/build/building/multi-stage/
- Best practices: https://docs.docker.com/develop/dev-best-practices/

---

**FIM DOS EXEMPLOS** 🎉
