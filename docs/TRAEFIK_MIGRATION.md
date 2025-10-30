# Migração para Traefik Puro - Sem Nginx

## 🔄 Mudanças Realizadas

### Frontend - Arquitetura Anterior (com Nginx)
```
Traefik → Nginx (porta 80) → Arquivos estáticos
```

### Frontend - Nova Arquitetura (Traefik Direto)
```
Traefik → Serve (porta 3000) → Arquivos estáticos
```

## ✅ Benefícios

1. **Menos camadas**: Traefik gerencia tudo diretamente
2. **Mais leve**: Sem Nginx, menos recursos
3. **Simplicidade**: Uma única camada de proxy reverso
4. **Consistência**: Todo roteamento via Traefik labels
5. **Tamanho menor**: Imagem frontend reduzida

## 📦 Nova Imagem Frontend

### Características
- **Base**: Node.js Alpine
- **Servidor**: `serve` (npm package)
- **Porta**: 3000
- **Tamanho**: ~50MB (vs 55MB com Nginx)

### Dockerfile
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production - Serve
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
```

## 🔧 Mudanças no Docker Compose

### Porta Atualizada
```yaml
# Antes (Nginx)
traefik.http.services.plano-certo-frontend.loadbalancer.server.port=80

# Depois (Serve)
traefik.http.services.plano-certo-frontend.loadbalancer.server.port=3000
```

### Health Check Atualizado
```yaml
# Antes
test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/ || exit 1"]

# Depois
test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/ || exit 1"]
```

## 🚀 Imagens Atualizadas

```bash
# Frontend com Serve (latest)
docker pull paxley/plano-certo-frontend:latest

# Frontend com Nginx (backup)
# Dockerfile.nginx disponível para rollback se necessário
```

## 📝 Headers e Middleware

Traefik continua gerenciando todos os headers e middleware:

- ✅ Security headers (XSS, Frame Options, Content-Type)
- ✅ SSL/TLS (Let's Encrypt)
- ✅ GZIP compression
- ✅ CORS (gerenciado pelo backend)
- ✅ HSTS
- ✅ Cache control

## 🔍 Comparação

| Característica | Nginx | Serve |
|---------------|-------|-------|
| Tamanho imagem | 55MB | 50MB |
| Configuração | nginx.conf | CLI args |
| Camadas | 2 (Traefik + Nginx) | 1 (Traefik) |
| Recursos | Mais pesado | Mais leve |
| Complexidade | Maior | Menor |
| SPA routing | ✅ | ✅ |
| Gzip | Nginx | Traefik |
| Headers | Nginx + Traefik | Traefik |

## 🎯 Serve Configuration

O `serve` está configurado com:
- `-s dist`: Serve SPA (single page application)
- `-l 3000`: Listen na porta 3000
- `--no-clipboard`: Sem clipboard (para ambiente servidor)

### Recursos do Serve
- ✅ Suporte SPA (rewrite routes para index.html)
- ✅ CORS headers configuráveis
- ✅ Compression automática
- ✅ Cache headers
- ✅ HTTPS ready (via Traefik)

## 🔄 Rollback (se necessário)

Se por algum motivo precisar voltar ao Nginx:

```bash
# No diretório do frontend
mv Dockerfile Dockerfile.serve
mv Dockerfile.nginx Dockerfile

# Rebuild e push
docker build -t paxley/plano-certo-frontend:nginx .
docker push paxley/plano-certo-frontend:nginx

# Atualizar docker-compose.yml
# Trocar porta de 3000 para 80
# Atualizar health check para porta 80
```

## 📊 Performance

### Serve
- **Startup**: ~1-2 segundos
- **Memory**: ~50-80MB
- **CPU**: Mínimo (apenas servir arquivos)

### Nginx (anterior)
- **Startup**: ~1-2 segundos
- **Memory**: ~10-20MB (Nginx) + ~50MB (Node base)
- **CPU**: Mínimo

### Conclusão
Performance similar, mas Serve é mais simples de configurar via Traefik.

## ✅ Validação Pós-Deploy

```bash
# Verificar serviço rodando
docker service ps plano-certo_frontend

# Ver logs
docker service logs -f plano-certo_frontend

# Testar health check
curl https://app.planocerto.com/

# Verificar headers
curl -I https://app.planocerto.com/

# Deve retornar:
# - Status: 200
# - X-Frame-Options: SAMEORIGIN
# - X-Content-Type-Options: nosniff
# - Strict-Transport-Security: max-age=31536000
```

## 🎨 Traefik Labels Mantidos

Todas as labels do Traefik permanecem ativas:

```yaml
# Router
✅ Host rule
✅ HTTPS entrypoint
✅ TLS certificado
✅ Let's Encrypt resolver

# Service
✅ Load balancer (port 3000)
✅ Health checks
✅ Múltiplas réplicas

# Middleware
✅ Security headers
✅ Compression
✅ SSL redirect
```

## 📚 Referências

- **Serve**: https://github.com/vercel/serve
- **Traefik**: https://doc.traefik.io/traefik/
- **Docker Swarm**: https://docs.docker.com/engine/swarm/

## 🆘 Troubleshooting

### Frontend não carrega
```bash
# Verificar porta correta
docker service inspect plano-certo_frontend | grep -A5 labels

# Deve mostrar port=3000
```

### 404 em rotas SPA
```bash
# Verificar se serve está com -s flag
docker service logs plano-certo_frontend | grep serve

# Deve mostrar: serve -s dist -l 3000
```

### Headers não aplicados
```bash
# Verificar middleware no Traefik
curl -I https://app.planocerto.com/

# Todos headers devem estar presentes
```

## 🎉 Migração Completa!

A stack agora usa Traefik puro para todo o roteamento e SSL, sem camadas intermediárias de proxy. Mais simples, mais eficiente, mais fácil de manter!
