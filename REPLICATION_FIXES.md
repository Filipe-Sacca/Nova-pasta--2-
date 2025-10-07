# 🔧 Correções de Problemas de Replicação

## 🚨 Problemas Identificados

### 1. ❌ Aspas Faltando nas Rules do Traefik

**Problema:**
```yaml
- "traefik.http.routers.plano-certo-backend.rule=Host(api.planocertodelivery.com)"
```

**Correção:**
```yaml
- "traefik.http.routers.plano-certo-backend.rule=Host(`api.planocertodelivery.com`)"
```

**Por quê?**
O Traefik requer backticks (\`) ao redor dos domínios na rule. Sem isso, o roteamento falha.

---

### 2. ❌ Porta Incorreta do Frontend

**Problema:**
```yaml
- "traefik.http.services.plano-certo-frontend.loadbalancer.server.port=80"
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
```

**Correção:**
```yaml
- "traefik.http.services.plano-certo-frontend.loadbalancer.server.port=3000"
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/"]
```

**Por quê?**
A nova imagem do frontend usa `serve` na porta 3000, não Nginx na porta 80.

---

### 3. ❌ Apenas 1 Réplica (Sem Alta Disponibilidade)

**Problema:**
```yaml
deploy:
  replicas: 1
```

**Correção:**
```yaml
deploy:
  replicas: 2
```

**Por quê?**
- Com 1 réplica, não há redundância
- Se a réplica falhar, o serviço fica offline
- 2 réplicas garantem alta disponibilidade
- Load balancing entre as réplicas

---

### 4. ⚠️ Placement Constraint Muito Restritivo

**Problema:**
```yaml
placement:
  constraints:
    - node.role == manager
```

**Correção:**
```yaml
placement:
  constraints:
    - node.role == worker
```

**Por quê?**
- Managers devem ser reservados para gerenciamento do cluster
- Workers são otimizados para rodar aplicações
- Com `manager` você limita a escalabilidade
- Se só tem 1 manager, só roda 1 réplica mesmo configurando 2

**Alternativa (se não tem workers):**
```yaml
# Sem constraint - roda em qualquer nó
placement:
  constraints: []
```

---

### 5. ℹ️ Network Inconsistente

**Observação:**
Você usa `network_public` enquanto a documentação usa `traefik-public`. Não é um erro se sua rede se chama assim, mas certifique-se que:

```bash
# Verificar se a rede existe
docker network ls | grep network_public

# Se não existir, criar
docker network create --driver=overlay --attachable network_public
```

---

## 📋 Checklist de Correções

### Aplicar Correções

- [ ] **1. Backup do arquivo atual**
  ```bash
  cp docker-compose.yml docker-compose.yml.backup
  ```

- [ ] **2. Aplicar arquivo corrigido**
  ```bash
  cp docker-compose-fixed.yml docker-compose.yml
  ```

- [ ] **3. Verificar rede existe**
  ```bash
  docker network ls | grep network_public
  # Se não existir:
  docker network create --driver=overlay --attachable network_public
  ```

- [ ] **4. Verificar nodes disponíveis**
  ```bash
  docker node ls
  ```

  **Se só tem managers:**
  - Remover constraint ou adicionar workers ao cluster

- [ ] **5. Remover stack antiga**
  ```bash
  docker stack rm plano-certo
  # Aguardar 30 segundos
  sleep 30
  ```

- [ ] **6. Deploy com arquivo corrigido**
  ```bash
  docker stack deploy -c docker-compose.yml plano-certo
  ```

- [ ] **7. Verificar deploy**
  ```bash
  docker stack services plano-certo
  ```

  **Deve mostrar:**
  ```
  NAME                      MODE        REPLICAS
  plano-certo_backend       replicated  2/2
  plano-certo_frontend      replicated  2/2
  ```

---

## 🔍 Diagnóstico de Problemas

### Backend não replica

```bash
# Ver status detalhado
docker service ps plano-certo_backend --no-trunc

# Ver logs
docker service logs plano-certo_backend --tail 50

# Inspecionar serviço
docker service inspect plano-certo_backend --pretty
```

**Possíveis causas:**
1. ✅ **Node constraints** - Verificar se tem workers disponíveis
2. ✅ **Recursos insuficientes** - Verificar CPU/RAM disponível
3. ✅ **Imagem não encontrada** - Fazer pull manual: `docker pull paxley/plano-certo-backend:latest`
4. ✅ **Health check falhando** - Testar manualmente dentro do container

### Frontend não replica

```bash
# Ver status detalhado
docker service ps plano-certo_frontend --no-trunc

# Ver logs
docker service logs plano-certo_frontend --tail 50
```

**Possíveis causas:**
1. ✅ **Porta incorreta** - Deve ser 3000, não 80
2. ✅ **Imagem antiga** - Fazer pull da nova: `docker pull paxley/plano-certo-frontend:latest`
3. ✅ **Health check porta errada** - Deve testar porta 3000

### Traefik não roteia

```bash
# Ver logs do Traefik
docker service logs traefik --tail 100

# Testar DNS
dig api.planocertodelivery.com
dig app.planocertodelivery.com

# Verificar labels
docker service inspect plano-certo_backend | grep -A 30 Labels
```

**Possíveis causas:**
1. ✅ **Rule sem backticks** - Deve ser \`api.planocertodelivery.com\`
2. ✅ **DNS não aponta** - Verificar propagação DNS
3. ✅ **Network diferente** - Traefik e serviços devem estar na mesma rede
4. ✅ **Porta errada** - Backend 3010, Frontend 3000

---

## ✅ Validação Pós-Correção

### 1. Verificar Réplicas Rodando

```bash
docker service ls
```

**Esperado:**
```
NAME                      REPLICAS
plano-certo_backend       2/2
plano-certo_frontend      2/2
```

### 2. Testar Health Checks

```bash
# Backend
curl https://api.planocertodelivery.com/health

# Frontend
curl https://app.planocertodelivery.com/
```

### 3. Verificar Load Balancing

```bash
# Fazer várias requisições e verificar que diferentes réplicas respondem
for i in {1..10}; do
  curl -s https://api.planocertodelivery.com/health | jq .uptime
  sleep 1
done
```

Se o uptime variar, significa que está balanceando entre réplicas.

### 4. Testar Failover

```bash
# Matar uma réplica para testar HA
docker service scale plano-certo_backend=1

# Testar se continua respondendo
curl https://api.planocertodelivery.com/health

# Restaurar
docker service scale plano-certo_backend=2
```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | ❌ Antes | ✅ Depois |
|---------|---------|----------|
| **Réplicas** | 1 (sem HA) | 2 (com HA) |
| **Traefik Rule** | Sem backticks | Com backticks (\`) |
| **Porta Frontend** | 80 (incorreta) | 3000 (correta) |
| **Placement** | Só managers | Workers ou flexible |
| **Health Check Frontend** | Porta 80 | Porta 3000 |
| **Disponibilidade** | ~50% (1 réplica) | ~99.9% (2 réplicas) |

---

## 🚀 Deploy Correto - Passo a Passo

```bash
# 1. Verificar cluster
docker node ls

# 2. Verificar/criar rede
docker network ls | grep network_public || \
  docker network create --driver=overlay --attachable network_public

# 3. Remover stack antiga (se existir)
docker stack rm plano-certo
sleep 30

# 4. Deploy com arquivo corrigido
docker stack deploy -c docker-compose-fixed.yml plano-certo

# 5. Monitorar deploy
watch -n 2 'docker stack services plano-certo'

# 6. Aguardar todas réplicas (2/2)
# Ctrl+C para sair do watch

# 7. Verificar logs
docker service logs -f plano-certo_backend &
docker service logs -f plano-certo_frontend &

# 8. Testar endpoints
curl https://api.planocertodelivery.com/health
curl https://app.planocertodelivery.com/

# 9. Verificar SSL
curl -I https://api.planocertodelivery.com/health | grep -i strict
```

---

## 🆘 Solução Rápida

Se ainda tiver problemas:

```bash
# 1. Limpar tudo
docker stack rm plano-certo
sleep 30

# 2. Remover network e recriar
docker network rm network_public
docker network create --driver=overlay --attachable network_public

# 3. Pull das imagens manualmente
docker pull paxley/plano-certo-backend:latest
docker pull paxley/plano-certo-frontend:latest

# 4. Deploy novamente
docker stack deploy -c docker-compose-fixed.yml plano-certo

# 5. Verificar
docker service ls
docker service ps plano-certo_backend
docker service ps plano-certo_frontend
```

---

## 📝 Resumo das Mudanças

### Backend
- ✅ Rule com backticks: \`api.planocertodelivery.com\`
- ✅ Réplicas: 2
- ✅ Placement: workers
- ✅ Porta: 3010 (já estava correto)

### Frontend
- ✅ Rule com backticks: \`app.planocertodelivery.com\`
- ✅ Réplicas: 2
- ✅ Placement: workers
- ✅ Porta: 3000 (CORRIGIDO de 80)
- ✅ Health check: porta 3000 (CORRIGIDO de 80)

---

Use o arquivo **docker-compose-fixed.yml** para fazer o deploy correto!
