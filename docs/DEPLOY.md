# Deploy Guide - Plano Certo Stack

## Docker Images

- **Backend**: `paxley/plano-certo-backend:latest`
- **Frontend**: `paxley/plano-certo-frontend:latest`

## Prerequisites

1. Docker Swarm cluster initialized
2. Traefik running on the swarm with:
   - Network `traefik-public` created
   - Let's Encrypt configured
   - Entrypoints `web` and `websecure` configured

## Traefik Network Setup

If you don't have the `traefik-public` network, create it:

```bash
docker network create --driver=overlay --attachable traefik-public
```

## Configuration

### 1. Update Domain Names

Edit `docker-compose.yml` and replace the domains:
- `api.planocerto.com` → Your backend domain
- `app.planocerto.com` → Your frontend domain

### 2. Environment Variables

Update the environment variables in `docker-compose.yml`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

Or use Docker secrets for sensitive data (recommended for production).

## Deploy to Portainer

### Option 1: Using Portainer UI

1. Go to **Stacks** → **Add stack**
2. Name: `plano-certo`
3. Build method: **Web editor**
4. Paste the contents of `docker-compose.yml`
5. Click **Deploy the stack**

### Option 2: Using Portainer API

```bash
curl -X POST "https://portainer.yourdomain.com/api/stacks?type=1&method=string&endpointId=1" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "name": "plano-certo",
  "stackFileContent": "$(cat docker-compose.yml | jq -Rs .)"
}
EOF
```

## Deploy via CLI

```bash
# Deploy the stack
docker stack deploy -c docker-compose.yml plano-certo

# Check services status
docker stack services plano-certo

# Check logs
docker service logs -f plano-certo_backend
docker service logs -f plano-certo_frontend

# Scale services
docker service scale plano-certo_backend=3
docker service scale plano-certo_frontend=3
```

## Verify Deployment

```bash
# List all services
docker stack ps plano-certo

# Check service status
docker service ls | grep plano-certo

# Inspect service
docker service inspect plano-certo_backend
docker service inspect plano-certo_frontend
```

## Health Checks

The stack includes health checks for both services:

- **Backend**: `GET /health` on port 3010
- **Frontend**: `GET /` on port 80

Monitor health status:
```bash
docker service ps plano-certo_backend --filter "desired-state=running"
docker service ps plano-certo_frontend --filter "desired-state=running"
```

## Update Stack

```bash
# Pull latest images
docker service update --image paxley/plano-certo-backend:latest plano-certo_backend
docker service update --image paxley/plano-certo-frontend:latest plano-certo_frontend

# Or redeploy entire stack
docker stack deploy -c docker-compose.yml plano-certo
```

## Rollback

```bash
# Rollback specific service
docker service rollback plano-certo_backend
docker service rollback plano-certo_frontend

# Or remove and redeploy
docker stack rm plano-certo
docker stack deploy -c docker-compose.yml plano-certo
```

## Remove Stack

```bash
docker stack rm plano-certo
```

## Traefik Configuration

The stack is configured with:

### Backend (api.planocerto.com)
- HTTPS with Let's Encrypt
- CORS enabled
- Rate limiting: 100 requests/sec average, 50 burst
- Gzip compression
- Security headers
- Load balancing across 2 replicas
- Health checks every 10s

### Frontend (app.planocerto.com)
- HTTPS with Let's Encrypt
- Security headers (XSS, Frame Options, etc.)
- Gzip compression
- Load balancing across 2 replicas
- Health checks every 10s

## Resource Limits

### Backend
- **Limits**: 0.5 CPU, 512MB RAM
- **Reservations**: 0.25 CPU, 256MB RAM
- **Replicas**: 2

### Frontend
- **Limits**: 0.3 CPU, 256MB RAM
- **Reservations**: 0.1 CPU, 128M RAM
- **Replicas**: 2

## Monitoring

Access Traefik dashboard to monitor:
- Service status
- Request rates
- Response times
- SSL certificates

## Troubleshooting

### Service not starting
```bash
# Check service logs
docker service logs plano-certo_backend
docker service logs plano-certo_frontend

# Check events
docker service ps plano-certo_backend --no-trunc
```

### Traefik routing issues
```bash
# Verify Traefik can reach services
docker exec $(docker ps -q -f name=traefik) cat /etc/traefik/traefik.yml

# Check Traefik logs
docker service logs traefik
```

### Health check failures
```bash
# Test health endpoint directly
docker exec $(docker ps -q -f name=plano-certo_backend) wget -O- http://localhost:3010/health
docker exec $(docker ps -q -f name=plano-certo_frontend) wget -O- http://localhost:80/
```

## DNS Configuration

Point your domains to your swarm manager/load balancer:

```
api.planocerto.com    A    YOUR_SERVER_IP
app.planocerto.com    A    YOUR_SERVER_IP
```

## Security Recommendations

1. Use Docker secrets for sensitive environment variables
2. Enable firewall on swarm nodes
3. Use private networks for internal communication
4. Regularly update images
5. Monitor security vulnerabilities
6. Enable audit logging
7. Implement backup strategy for Supabase data

## Support

For issues or questions:
- Check logs: `docker service logs plano-certo_backend`
- Review Traefik dashboard
- Verify DNS configuration
- Check Supabase connectivity
