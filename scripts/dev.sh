#!/bin/bash

# Script para iniciar todos os serviços em modo de desenvolvimento
echo "🚀 Iniciando serviços do Plano Certo Hub..."

# Diretório base do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "📁 Diretório do projeto: $PROJECT_DIR"

# Função para verificar se uma porta está em uso
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null; then
        echo "⚠️  Porta $1 já está em uso"
        return 1
    else
        echo "✅ Porta $1 disponível"
        return 0
    fi
}

# Função para matar processos em portas específicas
kill_port() {
    echo "🔄 Liberando porta $1..."
    fuser -k $1/tcp 2>/dev/null || true
    sleep 1
}

# Cleanup na saída
cleanup() {
    echo ""
    echo "🛑 Parando todos os serviços..."
    kill 0
    exit 0
}
trap cleanup SIGINT SIGTERM

# Verificar dependências
echo ""
echo "🔍 Verificando dependências..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

# Verificar Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado"
    exit 1
fi

# Verificar se o ambiente virtual existe
if [ ! -d "$PROJECT_DIR/venv" ]; then
    echo "⚠️  Ambiente virtual não encontrado. Criando..."
    cd "$PROJECT_DIR" && python3 -m venv venv
fi

# Ativar ambiente virtual
source "$PROJECT_DIR/venv/bin/activate"

echo "✅ Dependências verificadas"

# Verificar e liberar portas
echo ""
echo "🔍 Verificando portas..."
kill_port 8082  # Frontend (Vite)
# kill_port 5000  # API Server Python removido
kill_port 8093  # Token Service Node.js

echo ""
echo "🌐 Iniciando serviços..."

# 1. Iniciar Frontend (React + Vite)
echo "📱 Iniciando Frontend (porta 8082)..."
cd "$PROJECT_DIR/frontend/plano-certo-hub-insights"
npm run dev > "$PROJECT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

# 2. API Server não é mais necessário - funcionalidade migrada para Node.js Token Service
echo "🔌 API Server Python removido - funcionalidade no Token Service Node.js"

# 3. Iniciar Token Service (Node.js)
echo "🔑 Iniciando Token Service (porta 8093)..."
cd "$PROJECT_DIR/backend/ifood-token-service"
npm run dev > "$PROJECT_DIR/logs/token_service_node.log" 2>&1 &
TOKEN_PID=$!
echo "   PID: $TOKEN_PID"

# Criar diretório de logs se não existir
mkdir -p "$PROJECT_DIR/logs"

# Aguardar alguns segundos para os serviços iniciarem
echo ""
echo "⏳ Aguardando serviços iniciarem..."
sleep 5

# Verificar se os serviços estão rodando
echo ""
echo "🔍 Verificando status dos serviços..."

# Verificar Frontend
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "✅ Frontend rodando (PID: $FRONTEND_PID)"
else
    echo "❌ Frontend falhou ao iniciar"
fi

# API Server Python foi removido
echo "✅ API Server Python removido - funcionalidade no Node.js"

# Verificar Token Service
if kill -0 $TOKEN_PID 2>/dev/null; then
    echo "✅ Token Service rodando (PID: $TOKEN_PID)"
else
    echo "❌ Token Service falhou ao iniciar"
fi

echo ""
echo "🎉 Serviços iniciados!"
echo ""
echo "📊 URLs dos serviços:"
echo "   Frontend:     http://localhost:8082"
echo "   Token Service: http://localhost:8093 (inclui todas APIs)"
echo ""
echo "📝 Logs disponíveis em:"
echo "   Frontend:     $PROJECT_DIR/logs/frontend.log"
echo "   Token Service: $PROJECT_DIR/logs/token_service_node.log"
echo ""
echo "⌨️  Pressione Ctrl+C para parar todos os serviços"

# Aguardar indefinidamente
wait