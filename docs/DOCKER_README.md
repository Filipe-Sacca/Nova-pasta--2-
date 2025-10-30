# Plano Certo - Docker Deployment

Complete Docker Swarm deployment stack for Plano Certo iFood Integration Hub.

## 📦 Docker Images

Available on Docker Hub:
- **Backend**: `paxley/plano-certo-backend:latest`
- **Frontend**: `paxley/plano-certo-frontend:latest`

## 🚀 Quick Start

### 1. Prerequisites

- Docker Swarm initialized: `docker swarm init`
- Traefik running with network `traefik-public`
- DNS records pointing to your server

### 2. Choose Deployment Method

#### Option A: Environment Variables (Development/Testing)

```bash
# Edit domains and environment variables in docker-compose.yml
nano docker-compose.yml

# Deploy
docker stack deploy -c docker-compose.yml plano-certo
```

#### Option B: Docker Secrets (Production - Recommended)

```bash
# Create secrets interactively
./create-secrets.sh

# Edit domains in docker-compose.secrets.yml
nano docker-compose.secrets.yml

# Deploy
docker stack deploy -c docker-compose.secrets.yml plano-certo
```

### 3. Verify Deployment

```bash
# Check services
docker stack services plano-certo

# View logs
docker service logs -f plano-certo_backend
docker service logs -f plano-certo_frontend

# Check health
curl https://api.planocerto.com/health
curl https://app.planocerto.com/
```

## 📁 Files Overview

```
.
├── docker-compose.yml              # Main stack file (env vars)
├── docker-compose.secrets.yml      # Production stack file (secrets)
├── create-secrets.sh               # Helper script to create secrets
├── .env.example                    # Environment variables template
├── DEPLOY.md                       # Detailed deployment guide
└── DOCKER_README.md               # This file
```

## 🔧 Configuration

### Update Domains

Replace in `docker-compose.yml` or `docker-compose.secrets.yml`:
- `api.planocerto.com` → Your backend domain
- `app.planocerto.com` → Your frontend domain

### Environment Variables

**Backend:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `PORT` - Backend port (default: 3010)
- `NODE_ENV` - Environment (production/development)
- `IFOOD_API_URL` - iFood API endpoint

**Frontend:**
- Built with environment variables at build time
- API URLs configured via nginx proxy

## 🌐 Architecture

```
                      ┌─────────────┐
                      │   Traefik   │
                      │ (Load Bal.) │
                      └──────┬──────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼─────────┐        ┌─────────▼─────────┐
    │   Frontend (x2)    │        │   Backend (x2)     │
    │  Nginx + React     │        │   Node.js API      │
    │  Port: 80          │        │   Port: 3010       │
    └────────────────────┘        └─────────┬──────────┘
                                           │
                                  ┌────────▼────────┐
                                  │   Supabase      │
                                  │  (PostgreSQL)   │
                                  └─────────────────┘
```

## 🔐 Security Features

### Traefik Labels Applied:

**Backend:**
- ✅ HTTPS with Let's Encrypt
- ✅ CORS headers
- ✅ Rate limiting (100 req/s avg, 50 burst)
- ✅ Gzip compression
- ✅ Security headers (HSTS, XSS, etc.)
- ✅ Health checks

**Frontend:**
- ✅ HTTPS with Let's Encrypt
- ✅ Security headers
- ✅ Gzip compression
- ✅ Cache control
- ✅ Health checks

## 📊 Resource Allocation

### Backend (per replica)
- **CPU Limit**: 0.5 cores
- **Memory Limit**: 512MB
- **CPU Reservation**: 0.25 cores
- **Memory Reservation**: 256MB
- **Replicas**: 2

### Frontend (per replica)
- **CPU Limit**: 0.3 cores
- **Memory Limit**: 256MB
- **CPU Reservation**: 0.1 cores
- **Memory Reservation**: 128MB
- **Replicas**: 2

**Total Resources (all replicas):**
- CPU: ~1.6 cores
- Memory: ~1.5GB

## 🔄 Common Operations

### Scale Services

```bash
# Scale backend to 3 replicas
docker service scale plano-certo_backend=3

# Scale frontend to 4 replicas
docker service scale plano-certo_frontend=4
```

### Update Images

```bash
# Update to new version
docker service update --image paxley/plano-certo-backend:v2.0 plano-certo_backend
docker service update --image paxley/plano-certo-frontend:v2.0 plano-certo_frontend

# Force pull latest
docker service update --force --image paxley/plano-certo-backend:latest plano-certo_backend
```

### View Logs

```bash
# Live logs
docker service logs -f plano-certo_backend
docker service logs -f plano-certo_frontend

# Last 100 lines
docker service logs --tail 100 plano-certo_backend

# Since timestamp
docker service logs --since 2024-01-01T00:00:00 plano-certo_backend
```

### Inspect Services

```bash
# Service details
docker service inspect plano-certo_backend
docker service inspect plano-certo_frontend

# Running tasks
docker service ps plano-certo_backend
docker service ps plano-certo_frontend
```

### Rollback

```bash
# Rollback to previous version
docker service rollback plano-certo_backend
docker service rollback plano-certo_frontend
```

### Remove Stack

```bash
# Remove entire stack
docker stack rm plano-certo

# Verify removal
docker stack ls
docker service ls
```

## 🩺 Health Checks

### Backend Health Endpoint

```bash
curl https://api.planocerto.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 12345.67,
  "memory": { ... },
  "version": "2.1.0"
}
```

### Frontend Health Check

```bash
curl -I https://app.planocerto.com/
```

Expected: HTTP 200 OK

## 🐛 Troubleshooting

### Services Not Starting

```bash
# Check service status
docker service ps plano-certo_backend --no-trunc

# Check events
docker events --filter 'service=plano-certo_backend'

# Check node resources
docker node ls
docker node inspect <node-id>
```

### Network Issues

```bash
# Verify traefik-public network exists
docker network ls | grep traefik-public

# Create if missing
docker network create --driver=overlay --attachable traefik-public

# Inspect network
docker network inspect traefik-public
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker service logs traefik

# Verify DNS records
dig api.planocerto.com
dig app.planocerto.com

# Test SSL
curl -vI https://api.planocerto.com/health
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Reduce replicas
docker service scale plano-certo_backend=1
docker service scale plano-certo_frontend=1

# Increase memory limits
docker service update --limit-memory 1G plano-certo_backend
```

## 📚 Additional Resources

- **Detailed Deployment Guide**: See `DEPLOY.md`
- **Environment Variables**: See `.env.example`
- **Backend Source**: `/backend/ifood-token-service/`
- **Frontend Source**: `/frontend/plano-certo-hub-insights/`

## 🆘 Support

If you encounter issues:

1. Check service logs: `docker service logs plano-certo_backend`
2. Verify Traefik configuration and logs
3. Test health endpoints
4. Check DNS resolution
5. Verify Supabase connectivity

## 📝 Notes

- Backend runs on port 3010 internally
- Frontend runs on port 80 internally
- Traefik handles SSL termination
- All traffic is HTTPS only (HTTP redirects to HTTPS)
- Secrets are recommended for production
- Regular backups of Supabase recommended
- Monitor resource usage and scale as needed
