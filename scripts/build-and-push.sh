#!/bin/bash

################################################################################
# Script de Build e Push de Imagens Docker
# Projeto: Plano Certo
# Autor: Automatizado
# Uso: ./build-and-push.sh [VERSAO]
################################################################################

set -e  # Para em caso de erro

# Configurações
VERSION="${1:-1.0.8}"  # Usa argumento ou default 1.0.8
DOCKER_USER="paxley"
PROJECT_NAME="plano-certo"
BACKEND_DIR="backend/ifood-token-service"
FRONTEND_DIR="frontend/plano-certo-hub-insights"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Funções auxiliares
################################################################################

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 não está instalado!"
        exit 1
    fi
}

check_file() {
    if [ ! -f "$1" ]; then
        print_error "Arquivo não encontrado: $1"
        exit 1
    fi
}

check_dir() {
    if [ ! -d "$1" ]; then
        print_error "Diretório não encontrado: $1"
        exit 1
    fi
}

################################################################################
# Validações iniciais
################################################################################

print_header "🔍 Validações Iniciais"

# Verificar Docker instalado
print_info "Verificando Docker..."
check_command docker
print_success "Docker instalado: $(docker --version)"

# Verificar login no Docker Hub
print_info "Verificando login no Docker Hub..."
if ! docker info | grep -q "Username"; then
    print_warning "Não está logado no Docker Hub!"
    echo ""
    docker login
else
    print_success "Já está logado no Docker Hub"
fi

# Verificar estrutura de diretórios
print_info "Verificando estrutura do projeto..."
check_dir "$BACKEND_DIR"
check_dir "$FRONTEND_DIR"
check_file "$BACKEND_DIR/Dockerfile"
check_file "$FRONTEND_DIR/Dockerfile"
check_file "$BACKEND_DIR/package.json"
check_file "$FRONTEND_DIR/package.json"
print_success "Estrutura do projeto OK"

echo ""

################################################################################
# Build e Push Backend
################################################################################

print_header "🏗️  BUILD BACKEND (versão ${VERSION})"

cd "$BACKEND_DIR"
print_info "Diretório: $(pwd)"

print_info "Building ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION}..."
docker build \
    -t ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION} \
    -t ${DOCKER_USER}/${PROJECT_NAME}-backend:latest \
    .

print_success "Build do backend concluído!"

# Verificar tamanho da imagem
IMAGE_SIZE=$(docker images ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION} --format "{{.Size}}")
print_info "Tamanho da imagem: ${IMAGE_SIZE}"

echo ""
print_header "🚀 PUSH BACKEND"

print_info "Pushing ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION}..."
docker push ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION}
print_success "Push da versão ${VERSION} concluído!"

print_info "Pushing ${DOCKER_USER}/${PROJECT_NAME}-backend:latest..."
docker push ${DOCKER_USER}/${PROJECT_NAME}-backend:latest
print_success "Push da versão latest concluído!"

cd - > /dev/null

echo ""

################################################################################
# Build e Push Frontend
################################################################################

print_header "🏗️  BUILD FRONTEND (versão ${VERSION})"

cd "$FRONTEND_DIR"
print_info "Diretório: $(pwd)"

print_info "Building ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION}..."
docker build \
    -t ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION} \
    -t ${DOCKER_USER}/${PROJECT_NAME}-frontend:latest \
    .

print_success "Build do frontend concluído!"

# Verificar tamanho da imagem
IMAGE_SIZE=$(docker images ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION} --format "{{.Size}}")
print_info "Tamanho da imagem: ${IMAGE_SIZE}"

echo ""
print_header "🚀 PUSH FRONTEND"

print_info "Pushing ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION}..."
docker push ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION}
print_success "Push da versão ${VERSION} concluído!"

print_info "Pushing ${DOCKER_USER}/${PROJECT_NAME}-frontend:latest..."
docker push ${DOCKER_USER}/${PROJECT_NAME}-frontend:latest
print_success "Push da versão latest concluído!"

cd - > /dev/null

echo ""

################################################################################
# Resumo Final
################################################################################

print_header "✅ BUILD E PUSH COMPLETOS"

echo ""
echo "📦 Imagens criadas e enviadas para Docker Hub:"
echo ""
echo "   Backend:"
echo "   • ${DOCKER_USER}/${PROJECT_NAME}-backend:${VERSION}"
echo "   • ${DOCKER_USER}/${PROJECT_NAME}-backend:latest"
echo ""
echo "   Frontend:"
echo "   • ${DOCKER_USER}/${PROJECT_NAME}-frontend:${VERSION}"
echo "   • ${DOCKER_USER}/${PROJECT_NAME}-frontend:latest"
echo ""
echo "🔗 Verificar no Docker Hub:"
echo "   • https://hub.docker.com/r/${DOCKER_USER}/${PROJECT_NAME}-backend"
echo "   • https://hub.docker.com/r/${DOCKER_USER}/${PROJECT_NAME}-frontend"
echo ""
echo "📝 Próximos passos:"
echo "   1. Atualizar docker-compose.yml com a nova versão: ${VERSION}"
echo "   2. Deploy em produção: docker stack deploy -c docker-compose.yml plano-certo"
echo "   3. Verificar logs: docker service logs -f plano-certo_backend"
echo ""

print_success "Processo concluído com sucesso! 🎉"
