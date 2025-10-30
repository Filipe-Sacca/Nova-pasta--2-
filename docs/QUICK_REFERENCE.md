# Quick Reference - Plano Certo Docker Stack

## 🚀 Deploy Rápido (Portainer)

```
1. Portainer → Stacks → Add stack
2. Nome: plano-certo
3. Web editor → Cole docker-compose.yml
4. Atualize domínios (api.planocerto.com e app.planocerto.com)
5. Deploy the stack
```

## 📦 Imagens Docker

```
paxley/plano-certo-backend:latest   (155 MB)
paxley/plano-certo-frontend:latest  (55.3 MB)
```

## 🌐 Domínios (ATUALIZAR!)

```yaml
Backend:  api.planocerto.com  → SEU_DOMINIO_API
Frontend: app.planocerto.com  → SEU_DOMINIO_APP
```

## 🔑 Variáveis Obrigatórias

```bash
SUPABASE_URL=https://icovzxzchijidohccopf.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
```

## 🔍 Verificar Deploy

```bash
# Status dos serviços
docker stack services plano-certo

# Logs
docker service logs -f plano-certo_backend
docker service logs -f plano-certo_frontend

# Health checks
curl https://api.planocerto.com/health
curl https://app.planocerto.com/
```

## 📊 Serviços

```
plano-certo_backend   - 2 réplicas, porta 3010
plano-certo_frontend  - 2 réplicas, porta 80
```

## ⚙️ Operações Comuns

```bash
# Escalar
docker service scale plano-certo_backend=3

# Atualizar imagem
docker service update --image paxley/plano-certo-backend:latest plano-certo_backend

# Rollback
docker service rollback plano-certo_backend

# Remover stack
docker stack rm plano-certo
```

## 🔐 Labels Traefik Principais

```yaml
# Domínio e SSL
traefik.http.routers.NAME.rule=Host(`DOMAIN`)
traefik.http.routers.NAME.tls.certresolver=letsencrypt

# Porta do serviço
traefik.http.services.NAME.loadbalancer.server.port=PORT

# Health check
traefik.http.services.NAME.loadbalancer.healthcheck.path=/health
```

## 📈 Recursos

```
Backend (cada réplica):  0.25-0.5 CPU, 256-512 MB
Frontend (cada réplica): 0.1-0.3 CPU, 128-256 MB
Total (2+2 réplicas):    ~1.6 CPU, ~1.5 GB
```

## 🆘 Troubleshooting

```bash
# Serviço não inicia
docker service ps plano-certo_backend --no-trunc

# Network não existe
docker network create --driver=overlay --attachable traefik-public

# SSL não funciona
# Verifique DNS e logs do Traefik
docker service logs traefik

# Health check falha
docker exec CONTAINER wget -O- http://localhost:3010/health
```

## 📚 Documentação

```
DEPLOYMENT_SUMMARY.md     - Visão geral completa
PORTAINER_QUICK_GUIDE.md  - Guia Portainer
DOCKER_README.md          - Referência Docker
DEPLOY.md                 - Deploy detalhado
```

## ✅ Checklist Pré-Deploy

- [ ] Traefik rodando com rede traefik-public
- [ ] DNS apontando para servidor
- [ ] Domínios atualizados no compose
- [ ] Variáveis Supabase configuradas
- [ ] Limites de recursos ajustados

## 🎯 Endpoints

```
Backend API:     https://api.planocerto.com
Backend Health:  https://api.planocerto.com/health
Frontend:        https://app.planocerto.com
```

## 🔧 Comandos Docker Swarm

```bash
# Iniciar swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml plano-certo

# Listar stacks
docker stack ls

# Listar serviços
docker stack services plano-certo

# Ver tarefas
docker stack ps plano-certo

# Remover stack
docker stack rm plano-certo
```

## 📞 Health Check Format

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 12345.67,
  "memory": {...},
  "version": "2.1.0"
}
```

## 🎨 Portainer UI

```
Stacks → plano-certo
  ├─ Services (2)
  │   ├─ plano-certo_backend (2/2)
  │   └─ plano-certo_frontend (2/2)
  ├─ Containers (4)
  └─ Logs
```

## 🔄 Update Strategy

```yaml
Parallelism: 1        # Update 1 replica at a time
Delay: 10s            # Wait 10s between updates
Failure Action: Rollback
Order: start-first    # Zero downtime
```

## 🛡️ Security

```
✅ HTTPS only
✅ Let's Encrypt SSL
✅ Security headers
✅ Rate limiting
✅ CORS configured
✅ Docker secrets support
```

## 💾 Backup

```bash
# Backup Supabase data
# Use Supabase dashboard or pg_dump

# Backup Docker secrets (if using)
docker secret ls
# Store in secure location
```

## 🚦 Status Codes

```
200 - OK, service healthy
404 - Endpoint not found
500 - Internal server error
502 - Backend unavailable
503 - Service unavailable
```
