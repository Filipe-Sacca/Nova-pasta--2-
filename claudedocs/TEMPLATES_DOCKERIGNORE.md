# Templates .dockerignore

## 📋 O que é .dockerignore?

O arquivo `.dockerignore` funciona como o `.gitignore`, mas para builds Docker. Ele especifica quais arquivos e diretórios devem ser **excluídos** do contexto de build, resultando em:

- ✅ Builds mais rápidos (menos arquivos para copiar)
- ✅ Imagens menores (não inclui arquivos desnecessários)
- ✅ Mais segurança (não expõe arquivos sensíveis)
- ✅ Cache mais eficiente

---

## 🎯 .dockerignore do Plano Certo (Atual)

### Backend (.dockerignore)

**Localização**: `backend/ifood-token-service/.dockerignore`

```
node_modules
npm-debug.log
.git
.gitignore
README.md
tests
*.md
.env.example
```

**Análise**:
- ✅ `node_modules`: Não copiar deps (serão instaladas no build)
- ✅ `npm-debug.log`: Logs de debug não necessários
- ✅ `.git`: Histórico Git não necessário em produção
- ✅ `tests`: Testes não vão para produção
- ✅ `*.md`: Documentação não necessária na imagem
- ✅ `.env.example`: Exemplo não usado em runtime

---

### Frontend (.dockerignore)

**Localização**: `frontend/plano-certo-hub-insights/.dockerignore`

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env.local
.env.development.local
.env.test.local
.env.production.local
dist
build
.DS_Store
.vscode
*.log
```

**Análise**:
- ✅ `node_modules`: Dependências reinstaladas no build
- ✅ `.env.*local`: Arquivos de ambiente local não vão para produção
- ✅ `dist`/`build`: Build anterior não necessário (será recriado)
- ✅ `.DS_Store`: Arquivo do macOS não necessário
- ✅ `.vscode`: Configurações do editor não necessárias
- ✅ `*.log`: Logs de desenvolvimento não necessários

---

## 📝 Templates Recomendados

### Template: Node.js Backend (Completo)

```
# Dependencies
node_modules
npm-debug.log
yarn-debug.log*
yarn-error.log*
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build outputs
dist
build
.next
out
.nuxt
.cache

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env*.local

# Testing
coverage
.nyc_output
tests
__tests__
*.test.js
*.test.ts
*.spec.js
*.spec.ts
jest.config.*
.jest

# Git
.git
.gitignore
.gitattributes

# CI/CD
.github
.gitlab-ci.yml
.circleci
.travis.yml
azure-pipelines.yml

# Documentation
README.md
CHANGELOG.md
LICENSE
docs
*.md

# IDE/Editor
.vscode
.idea
.DS_Store
*.swp
*.swo
*~

# Logs
logs
*.log

# Docker
Dockerfile
Dockerfile.*
docker-compose*.yml
.dockerignore

# Other
.editorconfig
.prettierrc
.eslintrc
.eslintignore
tsconfig.json
nodemon.json
```

---

### Template: Node.js Frontend (React/Vue/Angular)

```
# Dependencies
node_modules
npm-debug.log
yarn-debug.log*
yarn-error.log*

# Build outputs
dist
build
.next
out
.nuxt
.cache
.vite

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env*.local

# Testing
coverage
.nyc_output
tests
__tests__
e2e
cypress
playwright-report
test-results

# Git
.git
.gitignore
.gitattributes

# CI/CD
.github
.gitlab-ci.yml
.circleci

# Documentation
README.md
CHANGELOG.md
docs
*.md

# IDE/Editor
.vscode
.idea
.DS_Store
*.swp

# Logs
logs
*.log

# Docker
Dockerfile
Dockerfile.*
docker-compose*.yml
.dockerignore

# Storybook
.storybook
storybook-static

# Other
.editorconfig
.prettierrc
.eslintrc
public/mockServiceWorker.js
```

---

### Template: Python Backend

```
# Python
__pycache__
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# Virtual environments
venv/
env/
ENV/
.venv

# Testing
.pytest_cache
.coverage
htmlcov/
.tox/
.nox/

# Environment files
.env
.env.local
*.env

# Git
.git
.gitignore

# Documentation
README.md
docs/
*.md

# IDE
.vscode
.idea
.DS_Store

# Logs
*.log

# Docker
Dockerfile
docker-compose*.yml
.dockerignore
```

---

### Template: Go Backend

```
# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib
bin/
dist/

# Test binary
*.test

# Output of the go coverage tool
*.out
coverage.txt

# Dependency directories
vendor/
Godeps/

# Build cache
.cache

# Environment files
.env
.env.local

# Git
.git
.gitignore

# Documentation
README.md
docs/
*.md

# IDE
.vscode
.idea
.DS_Store

# Logs
*.log

# Docker
Dockerfile
docker-compose*.yml
.dockerignore

# Go specific
go.sum
go.mod (apenas se usar vendoring)
```

---

## 🔍 Padrões de Exclusão

### Wildcards Suportados

```
# Todos arquivos .log
*.log

# Todos arquivos .md em qualquer subdiretório
**/*.md

# Diretório específico e todo seu conteúdo
node_modules/

# Arquivos que começam com 'test'
test*

# Arquivos que terminam com '.local'
*.local

# Exceção (NÃO ignorar)
!important.log  # Este arquivo será incluído mesmo com *.log
```

---

## ✅ Checklist de .dockerignore

### Sempre Incluir
- [ ] `node_modules` (Node.js)
- [ ] `venv`, `env` (Python)
- [ ] `vendor` (Go, PHP)
- [ ] `.git` (Git)
- [ ] `.env*` (Variáveis de ambiente)
- [ ] `*.log` (Logs)
- [ ] `.DS_Store` (macOS)
- [ ] `.vscode`, `.idea` (IDEs)

### Considerar Incluir
- [ ] `tests`, `__tests__` (Testes)
- [ ] `coverage` (Coverage reports)
- [ ] `docs`, `*.md` (Documentação)
- [ ] `Dockerfile*` (Dockerfiles)
- [ ] `docker-compose*.yml` (Docker Compose)
- [ ] `.github`, `.gitlab-ci.yml` (CI/CD)
- [ ] Build outputs anteriores (`dist`, `build`)

### NÃO Incluir
- [ ] Arquivos necessários para build (package.json, requirements.txt)
- [ ] Código fonte (src/)
- [ ] Arquivos de configuração de build (tsconfig.json, webpack.config.js)
- [ ] Scripts de build (scripts/)

---

## 🎯 Exemplos Práticos

### Exemplo 1: Backend Node.js Mínimo

```
# .dockerignore (mínimo)
node_modules
npm-debug.log
.git
.env
*.log
```

**Uso**: Aplicação simples sem testes ou documentação complexa

---

### Exemplo 2: Frontend React Completo

```
# .dockerignore (completo)
node_modules
npm-debug.log
.git
.gitignore

# Ambientes
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build anterior
dist
build
.vite

# Testes
coverage
tests
__tests__
cypress
playwright-report

# Documentação
README.md
docs
*.md

# IDE
.vscode
.idea
.DS_Store

# CI/CD
.github
.gitlab-ci.yml

# Logs
*.log

# Docker
Dockerfile
docker-compose*.yml
.dockerignore
```

**Uso**: Aplicação completa com testes, CI/CD e documentação

---

### Exemplo 3: Monorepo (Backend + Frontend)

```
# .dockerignore (raiz do monorepo)

# Node
node_modules
npm-debug.log

# Build outputs
**/dist
**/build
**/.next
**/out

# Ambientes
.env
.env.local
**/.env*.local

# Testes
**/coverage
**/tests
**/__tests__

# Git
.git
.gitignore

# Documentação
README.md
docs
*.md

# IDE
.vscode
.idea
.DS_Store

# CI/CD
.github
.gitlab-ci.yml

# Logs
*.log

# Docker (exceto o que está sendo usado)
Dockerfile.*
docker-compose*.yml

# Serviços não necessários
# (adicione diretórios que não fazem parte do build)
```

---

## 🧪 Como Testar .dockerignore

### Método 1: Ver contexto de build

```bash
# Ver todos os arquivos que serão enviados ao contexto de build
docker build --no-cache -t test:latest . 2>&1 | grep "Sending build context"

# Saída: Sending build context to Docker daemon  5.2MB
# Quanto menor, melhor!
```

---

### Método 2: Build com debug

```bash
# Build com output detalhado
DOCKER_BUILDKIT=0 docker build -t test:latest . 2>&1 | head -20

# Procure por "Sending build context"
# Compare tamanho antes e depois de adicionar .dockerignore
```

---

### Método 3: Inspecionar conteúdo

```bash
# Criar imagem temporária
docker build -t test:temp .

# Criar container sem executar
docker create --name temp test:temp

# Explorar filesystem
docker export temp | tar -t | less

# Procure por arquivos que NÃO deveriam estar lá
# Ex: node_modules, .git, .env

# Limpar
docker rm temp
docker rmi test:temp
```

---

## 📊 Comparação: Com vs Sem .dockerignore

### Sem .dockerignore

```bash
$ docker build -t myapp:latest .
Sending build context to Docker daemon  450.2MB  ← RUIM!
Step 1/10 : FROM node:20-alpine
...
```

**Problemas**:
- 🐌 Build lento (muitos arquivos para transferir)
- 💾 Imagem grande (arquivos desnecessários incluídos)
- 🔒 Risco de segurança (.env, .git pode vazar)

---

### Com .dockerignore

```bash
$ docker build -t myapp:latest .
Sending build context to Docker daemon  5.2MB  ← BOM!
Step 1/10 : FROM node:20-alpine
...
```

**Benefícios**:
- ⚡ Build rápido (apenas arquivos necessários)
- 💾 Imagem otimizada (sem lixo)
- 🔒 Mais seguro (arquivos sensíveis excluídos)

**Redução**: ~99% (450MB → 5MB)

---

## 🎓 Boas Práticas

### 1. Criar .dockerignore ANTES do primeiro build
```bash
# Sempre crie junto com o Dockerfile
touch Dockerfile .dockerignore
```

### 2. Usar .gitignore como base
```bash
# Copiar .gitignore como ponto de partida
cp .gitignore .dockerignore

# Adicionar exclusões específicas do Docker
echo "Dockerfile" >> .dockerignore
echo "docker-compose*.yml" >> .dockerignore
```

### 3. Testar impacto
```bash
# Build sem .dockerignore
mv .dockerignore .dockerignore.bak
docker build -t test:without .

# Build com .dockerignore
mv .dockerignore.bak .dockerignore
docker build -t test:with .

# Comparar tamanhos
docker images | grep test
```

### 4. Documentar exceções
```dockerfile
# .dockerignore

# Ignorar todos .md
*.md

# EXCETO README.md que é necessário
!README.md
```

### 5. Revisar regularmente
```bash
# Verificar periodicamente se há novos arquivos para ignorar
git status
ls -la
# Adicionar ao .dockerignore conforme necessário
```

---

## 🚨 Erros Comuns

### ❌ Erro 1: Ignorar package.json

```
# ERRADO!
*.json  # Ignora package.json também
```

**Solução**:
```
# CERTO
tsconfig.json
jest.config.json
# Mas NÃO ignorar package.json ou package-lock.json
```

---

### ❌ Erro 2: Ignorar src/

```
# ERRADO!
src/  # Ignora código fonte!
```

**Solução**: NÃO ignore o diretório de código fonte!

---

### ❌ Erro 3: Não ignorar node_modules

```
# ERRADO: .dockerignore vazio
# Resultado: Build de 500MB com node_modules incluído
```

**Solução**:
```
# CERTO
node_modules
```

---

### ❌ Erro 4: Ignorar Dockerfile (se usar COPY)

```dockerfile
# Dockerfile
COPY . .  # Tenta copiar Dockerfile também
```

Se `.dockerignore` tem `Dockerfile`, ele não será copiado (geralmente OK)
Mas se seu app precisa dele, use:
```
# .dockerignore
!Dockerfile  # Exceção para incluir
```

---

## 📚 Resumo para Outro Claude

Ao criar .dockerignore para nova aplicação:

### Passo 1: Analisar Aplicação
```bash
# Ver estrutura de arquivos
ls -la

# Identificar padrões
# - Dependências (node_modules, venv, vendor)
# - Build outputs (dist, build)
# - Arquivos de config (.env, .vscode)
```

### Passo 2: Criar .dockerignore
```bash
# Usar template apropriado deste documento
# Backend Node.js → Template "Node.js Backend (Completo)"
# Frontend React → Template "Node.js Frontend"
# Python → Template "Python Backend"
# Go → Template "Go Backend"
```

### Passo 3: Personalizar
```bash
# Adicionar padrões específicos do projeto
# Remover linhas não aplicáveis
# Adicionar comentários para clareza
```

### Passo 4: Testar
```bash
# Build e verificar tamanho do contexto
docker build -t test:latest .

# Deve ser < 50MB para maioria dos projetos
# Se > 100MB, revisar .dockerignore
```

### Passo 5: Validar
```bash
# Verificar que arquivos necessários NÃO foram ignorados
# Verificar que imagem funciona corretamente
docker run -d -p 3000:3000 test:latest
curl http://localhost:3000
```

---

## 🔗 Referências

### Documentação Oficial
- Docker .dockerignore: https://docs.docker.com/engine/reference/builder/#dockerignore-file

### Templates Plano Certo
- Backend: `backend/ifood-token-service/.dockerignore`
- Frontend: `frontend/plano-certo-hub-insights/.dockerignore`

### Documentação Relacionada
- GUIA_BUILD_PUSH_DOCKER.md: Processo completo de build
- DIAGRAMA_FLUXO_DOCKER.md: Visualização do fluxo
- EXEMPLOS_PRATICOS.md: Casos de uso reais

---

**FIM DOS TEMPLATES** 🎉
