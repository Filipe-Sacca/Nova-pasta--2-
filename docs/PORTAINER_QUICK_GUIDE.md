# Portainer Deployment - Quick Guide

## 🎯 Deploy via Portainer UI

### Step 1: Access Portainer
1. Login to your Portainer instance
2. Navigate to **Stacks**
3. Click **Add stack**

### Step 2: Stack Configuration
- **Name**: `plano-certo`
- **Build method**: Select **Web editor**

### Step 3: Choose Deployment Type

#### Option A: With Environment Variables (Easier)

Copy the entire content of `docker-compose.yml` and paste into the web editor.

**Before deploying, update:**
1. Domain names:
   - Replace `api.planocerto.com` with your backend domain
   - Replace `app.planocerto.com` with your frontend domain

2. Environment variables (if needed):
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY

#### Option B: With Docker Secrets (More Secure)

1. **First, create secrets in Portainer:**
   - Go to **Secrets** → **Add secret**
   - Create three secrets:
     - Name: `supabase_url`, Value: Your Supabase URL
     - Name: `supabase_anon_key`, Value: Your Supabase anon key
     - Name: `supabase_service_key`, Value: Your Supabase service key

2. **Then deploy stack:**
   - Copy content of `docker-compose.secrets.yml`
   - Update domain names as in Option A
   - Deploy

### Step 4: Deploy
1. Click **Deploy the stack**
2. Wait for deployment to complete
3. Check **Services** tab to verify both services are running

## 📊 Monitor Deployment

### In Portainer:
1. Go to **Stacks** → **plano-certo**
2. Check **Services** tab:
   - `plano-certo_backend` should show 2/2 replicas
   - `plano-certo_frontend` should show 2/2 replicas

### View Logs:
1. Click on service name
2. Click **Service logs**
3. Enable **Auto-refresh** for live logs

## ✅ Verify Deployment

### Test Backend:
```bash
curl https://api.planocerto.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": ...,
  "version": "2.1.0"
}
```

### Test Frontend:
Open browser: `https://app.planocerto.com`

## 🔄 Update Stack

### Method 1: Via Portainer UI
1. Go to **Stacks** → **plano-certo**
2. Click **Editor**
3. Make changes
4. Click **Update the stack**
5. Select **Pull latest image** if you want to update images
6. Click **Update**

### Method 2: Pull New Images
1. Go to **Images**
2. Search for `paxley/plano-certo-backend`
3. Click **Pull image**
4. Repeat for `paxley/plano-certo-frontend`
5. Go to **Stacks** → **plano-certo**
6. Click **Update the stack** with **Pull latest image** enabled

## 📈 Scale Services

### Via Portainer:
1. Go to **Services**
2. Click on service (e.g., `plano-certo_backend`)
3. Click **Scaling/Placement**
4. Adjust **Replicas** number
5. Click **Update service**

### Recommended Scaling:
- **Light load**: 2 backend, 2 frontend (default)
- **Medium load**: 3 backend, 3 frontend
- **Heavy load**: 4-5 backend, 4-5 frontend

## 🐛 Troubleshooting in Portainer

### Service Not Starting:
1. Click on the service
2. Check **Service logs** for errors
3. Check **Tasks** tab for failed containers
4. Click on failed task for detailed error

### Common Issues:

#### Network Not Found
**Solution:**
1. Go to **Networks**
2. Create network: `traefik-public`
   - Driver: overlay
   - Attachable: enabled

#### Secret Not Found (if using secrets version)
**Solution:**
1. Go to **Secrets**
2. Verify all three secrets exist:
   - supabase_url
   - supabase_anon_key
   - supabase_service_key
3. Recreate if missing

#### Traefik Not Routing
**Solution:**
1. Verify Traefik is running
2. Check DNS records point to server
3. View Traefik logs for routing errors
4. Verify domain names in labels match DNS

## 📋 Quick Reference

### Stack Name
```
plano-certo
```

### Services
```
plano-certo_backend
plano-certo_frontend
```

### Networks
```
traefik-public (external)
plano-certo_internal (created by stack)
```

### Secrets (if using secrets version)
```
supabase_url
supabase_anon_key
supabase_service_key
```

### Domains (update these!)
```
Backend: api.planocerto.com
Frontend: app.planocerto.com
```

### Health Endpoints
```
Backend: https://api.planocerto.com/health
Frontend: https://app.planocerto.com/
```

## 🔐 Security Checklist

Before deploying to production:

- [ ] Update domain names in compose file
- [ ] Use Docker secrets for sensitive data
- [ ] Verify SSL certificates are issued
- [ ] Test HTTPS redirect works
- [ ] Check rate limiting is active
- [ ] Verify security headers are set
- [ ] Test CORS configuration
- [ ] Enable Portainer access control
- [ ] Configure firewall rules
- [ ] Set up monitoring/alerts

## 📞 Support Commands

### Get Stack Status:
Click on stack → View **Services** and **Containers** tabs

### View All Logs:
Stack → **Service logs** (for combined logs)

### Restart Service:
Service → **Update service** → **Force update**

### Remove Stack:
Stack → **Delete this stack**

## 🎨 Portainer Tips

1. **Auto-refresh logs**: Enable for real-time monitoring
2. **Service console**: Access container shell via service → container → console
3. **Stats**: View resource usage per service
4. **Events**: Monitor stack events for debugging
5. **Webhooks**: Set up automatic redeployment on image updates

## 📝 Notes

- First deployment may take 2-3 minutes for SSL certificates
- Health checks start after 40 seconds (start_period)
- Traefik automatically discovers services via labels
- Use secrets for production deployments
- Regular backups recommended for Supabase
- Monitor resource usage and scale accordingly
