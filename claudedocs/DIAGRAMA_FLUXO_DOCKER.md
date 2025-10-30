# Diagrama Visual: Fluxo de Build e Push Docker

## 🎨 Visão Geral do Processo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUXO COMPLETO                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│  CÓDIGO      │  ──────>│  DOCKERFILE  │  ──────>│  IMAGEM      │
│  FONTE       │         │  (build)     │         │  DOCKER      │
│              │         │              │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
      │                         │                         │
      │                         │                         │
      v                         v                         v

src/index.ts          Multi-stage Build         paxley/app:1.0.8
package.json          node:20-alpine            (~150MB)
tsconfig.json         npm ci + build

                                                        │
                                                        │
                                                        v

                                              ┌──────────────┐
                                              │              │
                                              │  DOCKER HUB  │
                                              │  (registry)  │
                                              │              │
                                              └──────────────┘
                                                        │
                                                        │
                                                        v

                                              ┌──────────────┐
                                              │              │
                                              │  PRODUÇÃO    │
                                              │  (deploy)    │
                                              │              │
                                              └──────────────┘
```

---

## 🏗️ Multi-Stage Build (Backend)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      STAGE 1: BUILDER                                   │
└─────────────────────────────────────────────────────────────────────────┘

FROM node:20-alpine AS builder  ────────> Imagem base: ~50MB
         │
         v
COPY package*.json  ───────────────────> Copia dependências
         │
         v
RUN npm ci  ───────────────────────────> Instala TODAS deps (~200MB)
         │
         v
COPY . .  ─────────────────────────────> Copia código fonte
         │
         v
RUN npm run build  ────────────────────> Compila TS → JS (dist/)
         │
         │  📦 Resultado: /app/dist/ com código compilado
         │
         └──────────────────────────────────────────┐
                                                     │
                                                     │
┌────────────────────────────────────────────────────┼────────────────────┐
│                      STAGE 2: PRODUCTION           │                    │
└────────────────────────────────────────────────────┼────────────────────┘
                                                     │
FROM node:20-alpine  ───────────────────────────────┤ Nova imagem limpa
         │                                           │
         v                                           │
COPY package*.json  ────────────────────────────────┤ Deps novamente
         │                                           │
         v                                           │
RUN npm ci --only=production  ──────────────────────┤ Só prod deps (~80MB)
         │                                           │
         v                                           │
COPY --from=builder /app/dist ./dist  <─────────────┘ Copia código compilado
         │                                             (do STAGE 1)
         v
EXPOSE 3010  ───────────────────────────────────────> Porta exposta
         │
         v
CMD ["npm", "start"]  ──────────────────────────────> Comando de start

📦 IMAGEM FINAL: ~150MB (vs ~300MB sem multi-stage)
```

---

## 🎨 Multi-Stage Build (Frontend)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      STAGE 1: BUILDER                                   │
└─────────────────────────────────────────────────────────────────────────┘

FROM node:20-alpine AS builder
         │
         v
COPY package*.json
         │
         v
RUN npm ci  ───────────────────────────────> Instala deps (~300MB)
         │
         v
COPY . .  ─────────────────────────────────> src/, index.html, vite.config
         │
         v
RUN npm run build  ────────────────────────> Vite build → dist/
         │                                     (HTML + CSS + JS minificado)
         │
         │  📦 Resultado: /app/dist/ (assets estáticos)
         │
         └──────────────────────────────────────────┐
                                                     │
┌────────────────────────────────────────────────────┼────────────────────┐
│                      STAGE 2: PRODUCTION           │                    │
└────────────────────────────────────────────────────┼────────────────────┘
                                                     │
FROM node:20-alpine  ───────────────────────────────┤ Nova imagem limpa
         │                                           │
         v                                           │
RUN npm install -g serve  ──────────────────────────┤ HTTP server (~10MB)
         │                                           │
         v                                           │
COPY --from=builder /app/dist ./dist  <─────────────┘ Copia build
         │                                             (do STAGE 1)
         v
EXPOSE 3000
         │
         v
CMD ["serve", "-s", "dist", "-l", "3000"]

📦 IMAGEM FINAL: ~120MB (vs ~350MB sem multi-stage)
```

---

## 🔄 Processo de Versionamento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VERSIONAMENTO SEMVER                            │
└─────────────────────────────────────────────────────────────────────────┘

                    1    .    0    .    8
                    │         │         │
                    │         │         └──> PATCH: Bug fixes
                    │         │              (1.0.8 → 1.0.9)
                    │         │
                    │         └───────────> MINOR: New features
                    │                        (1.0.9 → 1.1.0)
                    │
                    └─────────────────────> MAJOR: Breaking changes
                                             (1.9.5 → 2.0.0)

┌──────────────────────────────────────────────────────────────────────────┐
│                              TAGS                                        │
└──────────────────────────────────────────────────────────────────────────┘

docker build -t paxley/plano-certo-backend:1.0.8    ──> Versão específica
docker build -t paxley/plano-certo-backend:latest   ──> Última versão
docker build -t paxley/plano-certo-backend:develop  ──> Branch staging
docker build -t paxley/plano-certo-backend:sha-abc  ──> Commit específico
```

---

## 🚀 Fluxo de Deploy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEV → STAGING → PRODUCTION                           │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ DEVELOPMENT  │
│              │  git commit + push
│ Local Build  │  ─────────────────┐
│ docker:dev   │                   │
└──────────────┘                   │
                                   │
                                   v
                         ┌──────────────────┐
                         │  GIT REPOSITORY  │
                         │                  │
                         │  main branch     │
                         └──────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    v              v              v

          ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
          │   STAGING    │  │  PRODUCTION  │  │    TAGS      │
          │              │  │              │  │              │
          │ :staging     │  │   :1.0.8     │  │   :latest    │
          │ :develop     │  │   :1.0.9     │  │              │
          └──────────────┘  └──────────────┘  └──────────────┘
                 │                  │                  │
                 v                  v                  v

          Test Environment    Docker Hub        Production
          (internal)          (registry)        (live users)
                                   │
                                   v
                         ┌──────────────────┐
                         │  DOCKER SWARM    │
                         │                  │
                         │  docker stack    │
                         │  deploy          │
                         └──────────────────┘
```

---

## 🏛️ Arquitetura de Produção (Plano Certo)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DOCKER SWARM STACK                                 │
└─────────────────────────────────────────────────────────────────────────┘

                            ┌─────────────┐
                            │   TRAEFIK   │
                            │  (Proxy)    │
                            │  :80, :443  │
                            └──────┬──────┘
                                   │
                                   │ SSL/TLS
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              │                    │                    │
              v                    v                    v

    Host: app.planocerto...     Path: /api        Path: /

    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │   FRONTEND   │      │   BACKEND    │      │   BACKEND    │
    │              │      │              │      │              │
    │ paxley/      │      │ paxley/      │      │ Strip /api   │
    │ plano-certo- │      │ plano-certo- │      │ middleware   │
    │ frontend     │      │ backend      │      │              │
    │              │      │              │      │              │
    │ :1.0.8       │      │ :1.0.8       │      │              │
    │              │      │              │      │              │
    │ Port: 3000   │      │ Port: 3010   │      │              │
    │              │      │              │      │              │
    │ serve -s     │      │ Node.js      │      │              │
    │ dist/        │      │ Express API  │      │              │
    └──────────────┘      └──────┬───────┘      └──────────────┘
                                 │
                                 │
                                 v
                        ┌────────────────┐
                        │   SUPABASE     │
                        │   (External)   │
                        │                │
                        │ PostgreSQL     │
                        │ Auth           │
                        │ Storage        │
                        └────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          NETWORKS                                       │
└─────────────────────────────────────────────────────────────────────────┘

network_public (external)  ──> Traefik + Frontend + Backend
internal (overlay)         ──> Backend internals (se necessário)
```

---

## 🔐 Autenticação Docker Hub

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCKER LOGIN FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

                    docker login
                         │
                         v
                 ┌──────────────┐
                 │  Username:   │
                 │  paxley      │
                 └──────────────┘
                         │
                         v
                 ┌──────────────┐
                 │  Password:   │
                 │  ********    │
                 └──────────────┘
                         │
                         v
                 ┌──────────────┐
                 │ Authenticate │
                 │ with         │
                 │ Docker Hub   │
                 └──────────────┘
                         │
                         v
          ┌──────────────┴──────────────┐
          │                             │
    ✅ Success                      ❌ Failed
          │                             │
          v                             v

   ~/.docker/config.json          Retry login
   {                              or check
     "auths": {                   credentials
       "docker.io": {
         "auth": "..."
       }
     }
   }
```

---

## 📦 Cache e Otimização

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   DOCKER BUILD LAYERS                                   │
└─────────────────────────────────────────────────────────────────────────┘

Build 1 (Initial):                Build 2 (Code Change):

FROM node:20-alpine              FROM node:20-alpine
│  [DOWNLOAD ~50MB]              │  ✅ [CACHED]
v                                v

COPY package*.json               COPY package*.json
│  [COPY ~1MB]                   │  ✅ [CACHED]
v                                v

RUN npm ci                       RUN npm ci
│  [DOWNLOAD ~200MB]             │  ✅ [CACHED]
│  [TAKES 2 MINUTES]             │  [INSTANT]
v                                v

COPY . .                         COPY . .
│  [COPY ~5MB]                   │  ❌ [CHANGED] ← Só isso muda!
v                                v

RUN npm run build                RUN npm run build
│  [COMPILE ~30s]                │  ❌ [RE-RUN] ← E isso
v                                v

Total: 3 minutes                 Total: 45 seconds

┌─────────────────────────────────────────────────────────────────────────┐
│  OTIMIZAÇÃO: Copie package.json ANTES do código fonte!                 │
│  Assim, mudanças no código não invalidam cache de npm ci               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Comparação: Com vs Sem Multi-Stage

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SEM MULTI-STAGE BUILD                                │
└─────────────────────────────────────────────────────────────────────────┘

FROM node:20-alpine                    📦 Tamanho: ~350MB
COPY package*.json ./
RUN npm ci                             ↳ devDependencies incluídas (150MB)
COPY . .                               ↳ src/ incluído (5MB)
RUN npm run build                      ↳ node_modules/ completo (200MB)
EXPOSE 3010
CMD ["npm", "start"]

⚠️  Problemas:
- Imagem grande (deploy lento)
- devDependencies em produção (risco de segurança)
- Código fonte em produção (vazamento de IP)


┌─────────────────────────────────────────────────────────────────────────┐
│                     COM MULTI-STAGE BUILD                               │
└─────────────────────────────────────────────────────────────────────────┘

# STAGE 1: Builder
FROM node:20-alpine AS builder         Imagem temporária
COPY package*.json ./                  (descartada no final)
RUN npm ci
COPY . .
RUN npm run build

# STAGE 2: Production                  📦 Tamanho: ~150MB
FROM node:20-alpine                    ↳ Só prodDeps (80MB)
COPY package*.json ./                  ↳ Só dist/ (5MB)
RUN npm ci --only=production           ↳ Node alpine (50MB)
COPY --from=builder /app/dist ./dist   ✅ Copia só código compilado
EXPOSE 3010
CMD ["npm", "start"]

✅ Vantagens:
- Imagem 55% menor (deploy rápido)
- Sem devDependencies (mais seguro)
- Sem código fonte (protege IP)
```

---

## 📊 Métricas de Build

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BUILD METRICS                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│  Service     │  Build   │  Size    │  Layers  │  Push    │
│              │  Time    │          │          │  Time    │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  Backend     │  2m 30s  │  150MB   │  12      │  45s     │
│  Frontend    │  1m 45s  │  120MB   │  10      │  35s     │
│              │          │          │          │          │
│  TOTAL       │  4m 15s  │  270MB   │  22      │  1m 20s  │
└──────────────┴──────────┴──────────┴──────────┴──────────┘

Com cache:
Backend:  45s
Frontend: 35s
TOTAL:    1m 20s

Economia de tempo com cache: ~70%
```

---

## 🔍 Comandos de Inspeção

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INSPECTION COMMANDS                                  │
└─────────────────────────────────────────────────────────────────────────┘

docker images
└─> Lista todas imagens locais

docker inspect IMAGE_NAME
└─> JSON com todos metadados

docker history IMAGE_NAME
└─> Mostra todas as layers e tamanhos

docker logs CONTAINER_NAME
└─> Logs do container em execução

docker exec -it CONTAINER_NAME sh
└─> Acessa shell dentro do container

docker stats CONTAINER_NAME
└─> Métricas em tempo real (CPU, RAM, I/O)

docker ps
└─> Lista containers em execução

docker system df
└─> Uso de disco (images, containers, volumes)
```

---

## ✅ Checklist Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       BUILD & PUSH CHECKLIST                            │
└─────────────────────────────────────────────────────────────────────────┘

PRÉ-BUILD
  ☐ Dockerfile criado
  ☐ .dockerignore configurado
  ☐ package.json com scripts build/start
  ☐ Docker login realizado

BUILD
  ☐ docker build executado sem erros
  ☐ Tamanho da imagem verificado (<500MB)
  ☐ Layers inspecionadas

TESTE
  ☐ docker run local executado
  ☐ Logs verificados (sem erros críticos)
  ☐ Endpoints testados (curl/browser)
  ☐ Container parado e removido

PUSH
  ☐ Tag de versão correta
  ☐ docker push executado
  ☐ Verificado no Docker Hub
  ☐ Tag :latest atualizada

DEPLOY
  ☐ docker-compose.yml atualizado
  ☐ Stack deployed
  ☐ Serviços verificados
  ☐ Logs de produção monitorados
```

---

## 🎓 Resumo para Outro Claude

```
┌─────────────────────────────────────────────────────────────────────────┐
│            INSTRUÇÕES PARA REPLICAR EM OUTRA APLICAÇÃO                 │
└─────────────────────────────────────────────────────────────────────────┘

1. ANALISAR APLICAÇÃO
   ├─ Identificar tecnologia (Node.js, Python, Go, etc)
   ├─ Localizar build scripts (package.json, requirements.txt)
   ├─ Identificar porta de exposição
   └─ Verificar dependências

2. CRIAR DOCKERFILE
   ├─ Usar imagem base apropriada (node:20-alpine, python:3.11-slim)
   ├─ Implementar multi-stage build
   ├─ Copiar package.json antes do código (cache)
   ├─ Instalar dependências
   ├─ Build/compilar
   └─ Stage final: apenas produção

3. CRIAR .dockerignore
   ├─ node_modules
   ├─ .git
   ├─ .env
   ├─ *.log
   └─ dist/build/

4. BUILD E TESTE
   ├─ docker build -t USER/APP:VERSION .
   ├─ docker run -d -p PORT:PORT USER/APP:VERSION
   ├─ Testar endpoints
   └─ docker stop + rm

5. PUSH
   ├─ docker login
   ├─ docker push USER/APP:VERSION
   └─ Verificar Docker Hub

6. DEPLOY
   ├─ Atualizar docker-compose.yml
   ├─ docker stack deploy
   └─ Monitorar logs

┌─────────────────────────────────────────────────────────────────────────┐
│  DOCUMENTAÇÃO COMPLETA: claudedocs/GUIA_BUILD_PUSH_DOCKER.md          │
└─────────────────────────────────────────────────────────────────────────┘
```

**FIM DO DIAGRAMA** 🎉
