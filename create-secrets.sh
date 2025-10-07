#!/bin/bash

# Script to create Docker secrets for production deployment
# Usage: ./create-secrets.sh

echo "🔐 Creating Docker Secrets for Plano Certo Stack"
echo "================================================"
echo ""

# Check if running in swarm mode
if ! docker info | grep -q "Swarm: active"; then
    echo "❌ Error: Docker Swarm is not initialized"
    echo "Run: docker swarm init"
    exit 1
fi

# Read Supabase URL
read -p "Enter SUPABASE_URL: " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: SUPABASE_URL cannot be empty"
    exit 1
fi

# Read Supabase Anon Key
read -p "Enter SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: SUPABASE_ANON_KEY cannot be empty"
    exit 1
fi

# Read Supabase Service Key
read -p "Enter SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_KEY cannot be empty"
    exit 1
fi

echo ""
echo "📝 Creating secrets..."

# Create secrets
echo "$SUPABASE_URL" | docker secret create supabase_url - 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Created secret: supabase_url"
else
    echo "⚠️  Secret supabase_url already exists or failed to create"
fi

echo "$SUPABASE_ANON_KEY" | docker secret create supabase_anon_key - 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Created secret: supabase_anon_key"
else
    echo "⚠️  Secret supabase_anon_key already exists or failed to create"
fi

echo "$SUPABASE_SERVICE_KEY" | docker secret create supabase_service_key - 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Created secret: supabase_service_key"
else
    echo "⚠️  Secret supabase_service_key already exists or failed to create"
fi

echo ""
echo "📋 Listing all secrets:"
docker secret ls

echo ""
echo "✅ Secret creation complete!"
echo ""
echo "Next steps:"
echo "1. Deploy the stack: docker stack deploy -c docker-compose.secrets.yml plano-certo"
echo "2. Check services: docker stack services plano-certo"
echo "3. View logs: docker service logs -f plano-certo_backend"
