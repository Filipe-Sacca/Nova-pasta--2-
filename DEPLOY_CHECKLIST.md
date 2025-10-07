# ✅ Deploy Checklist - Plano Certo Stack

Use este checklist para garantir um deploy sem problemas.

## 📋 Pré-Requisitos

### Infraestrutura
- [ ] Docker Swarm inicializado (`docker swarm init`)
- [ ] Traefik rodando no swarm
- [ ] Network `traefik-public` criada (`docker network create --driver=overlay --attachable traefik-public`)
- [ ] Traefik configurado com Let's Encrypt
- [ ] Entrypoints `web` e `websecure` configurados no Traefik

### DNS
- [ ] Domínio backend (ex: api.seudominio.com) apontando para o servidor
- [ ] Domínio frontend (ex: app.seudominio.com) apontando para o servidor
- [ ] DNS propagado (teste com `dig` ou `nslookup`)

### Acesso
- [ ] Acesso ao Portainer ou Docker CLI
- [ ] Credenciais DockerHub (se precisar pull de imagens privadas)
- [ ] Credenciais Supabase prontas

## 🔧 Configuração

### docker-compose.yml
- [ ] Arquivo baixado/copiado
- [ ] Domínio backend atualizado (linha ~51)
  ```yaml
  - "traefik.http.routers.plano-certo-backend.rule=Host(`api.SEUDOMINIO.com`)"
  ```
- [ ] Domínio frontend atualizado (linha ~125)
  ```yaml
  - "traefik.http.routers.plano-certo-frontend.rule=Host(`app.SEUDOMINIO.com`)"
  ```
- [ ] Variáveis de ambiente Supabase atualizadas (linhas 11-13)
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_KEY

### Limites de Recursos (Opcional)
- [ ] Verificar se os limites de CPU/Memory são adequados para seu servidor
- [ ] Ajustar número de réplicas se necessário (padrão: 2 cada)

## 🚀 Deploy

### Via Portainer
- [ ] Login no Portainer
- [ ] Ir em **Stacks** → **Add stack**
- [ ] Nome do stack: `plano-certo`
- [ ] Método: **Web editor**
- [ ] Colar conteúdo do `docker-compose.yml`
- [ ] Clicar **Deploy the stack**
- [ ] Aguardar deploy completar

### Via Docker CLI
```bash
- [ ] Fazer upload do docker-compose.yml para o servidor
- [ ] Executar: `docker stack deploy -c docker-compose.yml plano-certo`
- [ ] Verificar: `docker stack services plano-certo`
```

## ✅ Verificação

### Serviços Rodando
```bash
docker stack services plano-certo
```
- [ ] `plano-certo_backend` mostra 2/2 réplicas
- [ ] `plano-certo_frontend` mostra 2/2 réplicas
- [ ] Ambos com status "Running"

### Logs Sem Erros
```bash
docker service logs plano-certo_backend --tail 50
docker service logs plano-certo_frontend --tail 50
```
- [ ] Backend: logs mostram "Server running on port 3010"
- [ ] Frontend: logs mostram "serve" rodando na porta 3000
- [ ] Sem erros críticos visíveis

### Health Checks

#### Backend
```bash
curl https://api.SEUDOMINIO.com/health
```
- [ ] Retorna status 200
- [ ] JSON com `"status": "healthy"`
- [ ] Mostra uptime e version

#### Frontend
```bash
curl https://app.SEUDOMINIO.com/
```
- [ ] Retorna status 200
- [ ] HTML da aplicação React
- [ ] Sem erros 404 ou 502

### SSL/TLS
```bash
curl -I https://api.SEUDOMINIO.com/health
curl -I https://app.SEUDOMINIO.com/
```
- [ ] Ambos retornam HTTPS válido
- [ ] Certificados Let's Encrypt ativos
- [ ] HTTP redireciona para HTTPS

### Headers de Segurança

#### Backend
```bash
curl -I https://api.SEUDOMINIO.com/health
```
- [ ] `Strict-Transport-Security: max-age=31536000`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] Compression ativa (verificar tamanho)

#### Frontend
```bash
curl -I https://app.SEUDOMINIO.com/
```
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Strict-Transport-Security: max-age=31536000`

### Aplicação Funcionando

#### Frontend
- [ ] Abrir `https://app.SEUDOMINIO.com` no navegador
- [ ] Página carrega sem erros
- [ ] Console do navegador sem erros críticos
- [ ] Consegue fazer login
- [ ] Dashboard carrega

#### Backend
- [ ] API responde em `https://api.SEUDOMINIO.com`
- [ ] Endpoints funcionam (teste alguns)
- [ ] Conexão com Supabase OK
- [ ] Logs mostram requisições

## 🔍 Troubleshooting

### Se Backend Não Iniciar
```bash
# Ver logs detalhados
docker service logs plano-certo_backend --tail 100 --follow

# Verificar variáveis de ambiente
docker service inspect plano-certo_backend | grep -A 20 Env

# Testar Supabase connection
# Verificar se SUPABASE_URL está acessível
```
- [ ] Verificar credenciais Supabase
- [ ] Verificar conectividade com Supabase
- [ ] Verificar porta 3010 não está em uso

### Se Frontend Não Iniciar
```bash
# Ver logs detalhados
docker service logs plano-certo_frontend --tail 100 --follow

# Verificar se serve está rodando
docker service ps plano-certo_frontend
```
- [ ] Verificar se imagem foi baixada corretamente
- [ ] Verificar porta 3000 disponível

### Se SSL Não Funcionar
```bash
# Ver logs do Traefik
docker service logs traefik

# Verificar DNS
dig api.SEUDOMINIO.com
dig app.SEUDOMINIO.com
```
- [ ] DNS apontando para servidor correto
- [ ] Traefik consegue emitir certificados
- [ ] Portas 80 e 443 abertas no firewall

### Se Health Check Falhar
```bash
# Testar dentro do container
docker exec $(docker ps -q -f name=plano-certo_backend) wget -O- http://localhost:3010/health
docker exec $(docker ps -q -f name=plano-certo_frontend) wget -O- http://localhost:3000/
```
- [ ] Verificar se portas estão corretas
- [ ] Verificar se aplicações estão rodando
- [ ] Verificar logs para erros

## 📊 Monitoramento

### Métricas Iniciais
```bash
# Uso de recursos
docker stats

# Status dos serviços
docker service ls

# Replicas ativas
docker service ps plano-certo_backend
docker service ps plano-certo_frontend
```
- [ ] CPU usage normal (< 50%)
- [ ] Memory usage normal (< 80% dos limites)
- [ ] Todas réplicas rodando

### Logs Contínuos
```bash
# Monitorar logs em tempo real
docker service logs -f plano-certo_backend
docker service logs -f plano-certo_frontend
```
- [ ] Configurar coleta de logs (se aplicável)
- [ ] Configurar alertas (se aplicável)

## 🎯 Pós-Deploy

### Documentação
- [ ] Anotar domínios utilizados
- [ ] Anotar data/hora do deploy
- [ ] Documentar qualquer problema encontrado
- [ ] Atualizar documentação interna se necessário

### Backup
- [ ] Verificar backup do Supabase configurado
- [ ] Backup do docker-compose.yml salvo
- [ ] Credenciais salvas em local seguro

### Comunicação
- [ ] Notificar equipe sobre deploy
- [ ] Compartilhar URLs de acesso
- [ ] Documentar credenciais de acesso (se aplicável)

### Testes Funcionais
- [ ] Login funciona
- [ ] CRUD de produtos funciona
- [ ] Integração iFood funciona
- [ ] Upload de imagens funciona
- [ ] Todos módulos principais testados

## 🎉 Deploy Completo!

- [ ] Stack rodando
- [ ] SSL ativo
- [ ] Health checks passando
- [ ] Aplicação acessível
- [ ] Sem erros críticos
- [ ] Documentação atualizada
- [ ] Equipe notificada

---

**Data do Deploy**: ______________

**Deployed por**: ______________

**Domínios**:
- Backend: ______________
- Frontend: ______________

**Observações**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
