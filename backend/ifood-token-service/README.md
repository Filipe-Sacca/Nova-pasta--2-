# 🍔 iFood Token Service

Serviço Node.js/TypeScript para geração e gestão de tokens de acesso da API do iFood.

## 🚀 Instalação e Execução

### 1. Instalar dependências

```bash
cd ifood-token-service
npm install
```

### 2. Configurar ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com suas credenciais
```

### 3. Executar serviço

```bash
# Modo desenvolvimento
npm run dev

# Build para produção
npm run build
npm start
```

### 4. Testar serviço

```bash
# Executar teste automatizado
npm run test

# Health check
curl http://localhost:8000/health
```

## 🔧 Configuração

### Arquivo `.env`

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Server Configuration  
PORT=8000
NODE_ENV=development
```

## 📡 API Endpoints

### `GET /health`
Health check do serviço

### `POST /token`
Gera ou recupera token de acesso iFood

**Body:**
```json
{
  "clientId": "seu-client-id",
  "clientSecret": "seu-client-secret",
  "user_id": "uuid-do-usuario"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token generated and stored successfully",
  "data": {
    "client_id": "...",
    "access_token": "...", 
    "expires_at": "2024-01-01T12:00:00Z",
    "user_id": "..."
  }
}
```

## 🛠️ Desenvolvimento

### Scripts disponíveis

- `npm run dev` - Executa em modo desenvolvimento
- `npm run build` - Compila TypeScript
- `npm run start` - Executa versão compilada
- `npm run test` - Executa testes

### Estrutura do projeto

```
src/
├── server.ts              # Servidor Express
├── ifoodTokenService.ts   # Serviço principal
├── types.ts               # Definições de tipos
└── test.ts                # Script de teste
```

## 🔗 Integração

Este serviço é usado pela aplicação React como endpoint primário, com fallback automático para o webhook N8N existente.