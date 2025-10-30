#!/bin/bash

# Script de Diagnóstico de Replicação - Plano Certo Stack
# Uso: ./diagnose-replication.sh

echo "════════════════════════════════════════════════════════════════"
echo "       🔍 DIAGNÓSTICO DE REPLICAÇÃO - PLANO CERTO STACK        "
echo "════════════════════════════════════════════════════════════════"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar se Docker Swarm está ativo
echo "1️⃣  Verificando Docker Swarm..."
if docker info | grep -q "Swarm: active"; then
    echo -e "${GREEN}✅ Docker Swarm está ativo${NC}"
else
    echo -e "${RED}❌ Docker Swarm NÃO está ativo${NC}"
    echo "   Execute: docker swarm init"
    exit 1
fi
echo ""

# 2. Listar nodes disponíveis
echo "2️⃣  Nodes disponíveis no cluster:"
docker node ls
WORKER_COUNT=$(docker node ls --filter "role=worker" -q | wc -l)
MANAGER_COUNT=$(docker node ls --filter "role=manager" -q | wc -l)
echo ""
echo "   📊 Workers: $WORKER_COUNT | Managers: $MANAGER_COUNT"

if [ "$WORKER_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Nenhum worker disponível!${NC}"
    echo "   Recomendação: Adicione workers ou remova placement constraints"
fi
echo ""

# 3. Verificar rede
echo "3️⃣  Verificando network 'network_public'..."
if docker network ls | grep -q "network_public"; then
    echo -e "${GREEN}✅ Network 'network_public' existe${NC}"
    docker network inspect network_public --format '{{.Driver}}' | grep -q overlay && \
        echo -e "${GREEN}✅ Network é do tipo overlay${NC}" || \
        echo -e "${RED}❌ Network NÃO é overlay${NC}"
else
    echo -e "${RED}❌ Network 'network_public' NÃO existe${NC}"
    echo "   Execute: docker network create --driver=overlay --attachable network_public"
fi
echo ""

# 4. Verificar stack
echo "4️⃣  Verificando stack 'plano-certo'..."
if docker stack ls | grep -q "plano-certo"; then
    echo -e "${GREEN}✅ Stack 'plano-certo' está deployada${NC}"
    echo ""
    echo "   Serviços:"
    docker stack services plano-certo
    echo ""
else
    echo -e "${YELLOW}⚠️  Stack 'plano-certo' NÃO está deployada${NC}"
    echo "   Execute: docker stack deploy -c docker-compose.yml plano-certo"
    exit 0
fi

# 5. Verificar réplicas do backend
echo "5️⃣  Verificando réplicas do BACKEND..."
BACKEND_DESIRED=$(docker service ls --filter "name=plano-certo_backend" --format "{{.Replicas}}" | cut -d'/' -f2)
BACKEND_RUNNING=$(docker service ls --filter "name=plano-certo_backend" --format "{{.Replicas}}" | cut -d'/' -f1)

echo "   Réplicas configuradas: $BACKEND_DESIRED"
echo "   Réplicas rodando: $BACKEND_RUNNING"

if [ "$BACKEND_RUNNING" -eq "$BACKEND_DESIRED" ]; then
    echo -e "${GREEN}✅ Backend: $BACKEND_RUNNING/$BACKEND_DESIRED réplicas OK${NC}"
else
    echo -e "${RED}❌ Backend: $BACKEND_RUNNING/$BACKEND_DESIRED réplicas com problemas${NC}"
    echo ""
    echo "   Detalhes das tarefas:"
    docker service ps plano-certo_backend --no-trunc
fi
echo ""

# 6. Verificar réplicas do frontend
echo "6️⃣  Verificando réplicas do FRONTEND..."
FRONTEND_DESIRED=$(docker service ls --filter "name=plano-certo_frontend" --format "{{.Replicas}}" | cut -d'/' -f2)
FRONTEND_RUNNING=$(docker service ls --filter "name=plano-certo_frontend" --format "{{.Replicas}}" | cut -d'/' -f1)

echo "   Réplicas configuradas: $FRONTEND_DESIRED"
echo "   Réplicas rodando: $FRONTEND_RUNNING"

if [ "$FRONTEND_RUNNING" -eq "$FRONTEND_DESIRED" ]; then
    echo -e "${GREEN}✅ Frontend: $FRONTEND_RUNNING/$FRONTEND_DESIRED réplicas OK${NC}"
else
    echo -e "${RED}❌ Frontend: $FRONTEND_RUNNING/$FRONTEND_DESIRED réplicas com problemas${NC}"
    echo ""
    echo "   Detalhes das tarefas:"
    docker service ps plano-certo_frontend --no-trunc
fi
echo ""

# 7. Verificar imagens
echo "7️⃣  Verificando imagens Docker..."
if docker images | grep -q "paxley/plano-certo-backend"; then
    echo -e "${GREEN}✅ Imagem backend encontrada${NC}"
else
    echo -e "${RED}❌ Imagem backend NÃO encontrada${NC}"
    echo "   Execute: docker pull paxley/plano-certo-backend:latest"
fi

if docker images | grep -q "paxley/plano-certo-frontend"; then
    echo -e "${GREEN}✅ Imagem frontend encontrada${NC}"
else
    echo -e "${RED}❌ Imagem frontend NÃO encontrada${NC}"
    echo "   Execute: docker pull paxley/plano-certo-frontend:latest"
fi
echo ""

# 8. Verificar labels do Traefik
echo "8️⃣  Verificando labels do Traefik..."
echo "   Backend rule:"
BACKEND_RULE=$(docker service inspect plano-certo_backend --format '{{index .Spec.Labels "traefik.http.routers.plano-certo-backend.rule"}}' 2>/dev/null)
echo "   $BACKEND_RULE"

if echo "$BACKEND_RULE" | grep -q '`'; then
    echo -e "${GREEN}✅ Backend rule tem backticks${NC}"
else
    echo -e "${RED}❌ Backend rule SEM backticks (precisa corrigir!)${NC}"
fi

echo ""
echo "   Frontend rule:"
FRONTEND_RULE=$(docker service inspect plano-certo_frontend --format '{{index .Spec.Labels "traefik.http.routers.plano-certo-frontend.rule"}}' 2>/dev/null)
echo "   $FRONTEND_RULE"

if echo "$FRONTEND_RULE" | grep -q '`'; then
    echo -e "${GREEN}✅ Frontend rule tem backticks${NC}"
else
    echo -e "${RED}❌ Frontend rule SEM backticks (precisa corrigir!)${NC}"
fi
echo ""

# 9. Verificar portas
echo "9️⃣  Verificando portas dos serviços..."
BACKEND_PORT=$(docker service inspect plano-certo_backend --format '{{index .Spec.Labels "traefik.http.services.plano-certo-backend.loadbalancer.server.port"}}' 2>/dev/null)
FRONTEND_PORT=$(docker service inspect plano-certo_frontend --format '{{index .Spec.Labels "traefik.http.services.plano-certo-frontend.loadbalancer.server.port"}}' 2>/dev/null)

echo "   Backend porta: $BACKEND_PORT"
if [ "$BACKEND_PORT" = "3010" ]; then
    echo -e "${GREEN}✅ Backend porta correta (3010)${NC}"
else
    echo -e "${RED}❌ Backend porta incorreta (esperado 3010)${NC}"
fi

echo "   Frontend porta: $FRONTEND_PORT"
if [ "$FRONTEND_PORT" = "3000" ]; then
    echo -e "${GREEN}✅ Frontend porta correta (3000)${NC}"
else
    echo -e "${RED}❌ Frontend porta incorreta (esperado 3000, não 80!)${NC}"
fi
echo ""

# 10. Recursos disponíveis
echo "🔟 Verificando recursos do sistema..."
echo "   CPU e Memória por serviço:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep plano-certo || echo "   Nenhum container rodando"
echo ""

# 11. Logs recentes
echo "1️⃣1️⃣  Últimas linhas dos logs..."
echo "   📝 Backend (últimas 5 linhas):"
docker service logs plano-certo_backend --tail 5 2>/dev/null | tail -5 || echo "   Sem logs disponíveis"
echo ""
echo "   📝 Frontend (últimas 5 linhas):"
docker service logs plano-certo_frontend --tail 5 2>/dev/null | tail -5 || echo "   Sem logs disponíveis"
echo ""

# Resumo
echo "════════════════════════════════════════════════════════════════"
echo "                       📊 RESUMO                                "
echo "════════════════════════════════════════════════════════════════"
echo ""

ISSUES=0

# Verificar problemas
if [ "$WORKER_COUNT" -eq 0 ] && docker service inspect plano-certo_backend --format '{{range .Spec.TaskTemplate.Placement.Constraints}}{{.}}{{end}}' 2>/dev/null | grep -q "worker"; then
    echo -e "${RED}❌ Problema: Sem workers mas placement constraint requer workers${NC}"
    ((ISSUES++))
fi

if [ "$BACKEND_RUNNING" -ne "$BACKEND_DESIRED" ]; then
    echo -e "${RED}❌ Problema: Backend não tem todas réplicas rodando${NC}"
    ((ISSUES++))
fi

if [ "$FRONTEND_RUNNING" -ne "$FRONTEND_DESIRED" ]; then
    echo -e "${RED}❌ Problema: Frontend não tem todas réplicas rodando${NC}"
    ((ISSUES++))
fi

if [ "$FRONTEND_PORT" != "3000" ]; then
    echo -e "${RED}❌ Problema: Frontend usando porta errada ($FRONTEND_PORT em vez de 3000)${NC}"
    ((ISSUES++))
fi

if ! echo "$BACKEND_RULE" | grep -q '`'; then
    echo -e "${RED}❌ Problema: Backend rule sem backticks${NC}"
    ((ISSUES++))
fi

if ! echo "$FRONTEND_RULE" | grep -q '`'; then
    echo -e "${RED}❌ Problema: Frontend rule sem backticks${NC}"
    ((ISSUES++))
fi

echo ""
if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum problema detectado! Stack parece OK.${NC}"
else
    echo -e "${RED}⚠️  $ISSUES problema(s) detectado(s)${NC}"
    echo ""
    echo "📖 Consulte REPLICATION_FIXES.md para soluções"
    echo "📄 Use docker-compose-fixed.yml para deploy correto"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
