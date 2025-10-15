# 🐰 RABBITMQ SETUP - Local + Docker + Produção

**Data:** 12/10/2025
**Objetivo:** Guia completo de instalação e configuração do RabbitMQ

---

## 1️⃣ DESENVOLVIMENTO LOCAL

### **Instalação via Docker (Recomendado)**

```bash
# Pull da imagem oficial com management UI
docker pull rabbitmq:3-management

# Executar RabbitMQ
docker run -d \
  --name rabbitmq-dev \
  --hostname rabbitmq-local \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3-management

# Verificar se está rodando
docker ps | grep rabbitmq

# Acessar Management UI
# http://localhost:15672
# User: admin
# Pass: admin123
```

### **Variáveis de Ambiente (.env)**

```env
# Adicionar ao arquivo .env existente:
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
RABBITMQ_MANAGEMENT_URL=http://localhost:15672
```

---

## 2️⃣ PRODUÇÃO (VPS + Docker)

### **Docker Compose (docker-compose.yml)**

Criar arquivo `docker-compose.yml` na raiz do projeto:

```yaml
version: '3.8'

services:
  # Aplicação Backend
  ifood-backend:
    build: .
    container_name: ifood-backend
    ports:
      - "8093:8093"
    environment:
      - NODE_ENV=production
      - RABBITMQ_URL=amqp://admin:${RABBITMQ_PASSWORD}@rabbitmq:5672
    depends_on:
      - rabbitmq
    networks:
      - ifood-network
    restart: unless-stopped

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq-prod
    hostname: rabbitmq-prod
    ports:
      - "5672:5672"   # AMQP port
      - "15672:15672" # Management UI
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - rabbitmq_logs:/var/log/rabbitmq
    networks:
      - ifood-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

networks:
  ifood-network:
    driver: bridge

volumes:
  rabbitmq_data:
  rabbitmq_logs:
```

### **Arquivo .env de Produção**

```env
# RabbitMQ
RABBITMQ_PASSWORD=SUA_SENHA_FORTE_AQUI
RABBITMQ_URL=amqp://admin:SUA_SENHA_FORTE_AQUI@rabbitmq:5672
RABBITMQ_MANAGEMENT_URL=http://localhost:15672
```

### **Deploy via Portainer**

1. **Fazer build da imagem:**
```bash
docker build -t seu-usuario/ifood-backend:latest .
docker push seu-usuario/ifood-backend:latest
```

2. **No Portainer:**
   - Stacks → Add stack
   - Copiar docker-compose.yml
   - Adicionar variáveis de ambiente
   - Deploy stack

---

## 3️⃣ DEPENDÊNCIAS NPM

```bash
npm install amqplib
npm install @types/amqplib --save-dev
```

**package.json:**
```json
{
  "dependencies": {
    "amqplib": "^0.10.3"
  },
  "devDependencies": {
    "@types/amqplib": "^0.10.1"
  }
}
```

---

## 4️⃣ ESTRUTURA DE QUEUES

### **Queues do Sistema**

```
Exchange: "ifood.sync.exchange" (tipo: topic)

Queues:
├─ ifood.sync.products        # Sincronização de produtos (5 min)
├─ ifood.sync.categories      # Sincronização de categorias (30 min)
├─ ifood.sync.initial         # Sincronização inicial (quando conecta)
└─ ifood.sync.failed          # Dead Letter Queue (mensagens com erro)

Routing Keys:
├─ sync.products              → ifood.sync.products
├─ sync.categories            → ifood.sync.categories
├─ sync.initial               → ifood.sync.initial
└─ sync.failed                → ifood.sync.failed (DLQ)
```

---

## 5️⃣ TESTES DE CONEXÃO

### **Script de Teste (src/test-rabbitmq.ts)**

```typescript
import amqp from 'amqplib';

async function testRabbitMQ() {
  try {
    console.log('🐰 Testando conexão RabbitMQ...');

    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672'
    );

    console.log('✅ Conexão estabelecida!');

    const channel = await connection.createChannel();
    console.log('✅ Canal criado!');

    const queue = 'test_queue';
    await channel.assertQueue(queue, { durable: true });
    console.log(`✅ Queue "${queue}" criada!`);

    // Publicar mensagem de teste
    channel.sendToQueue(queue, Buffer.from('Hello RabbitMQ!'));
    console.log('✅ Mensagem enviada!');

    // Consumir mensagem
    channel.consume(queue, (msg) => {
      if (msg) {
        console.log('✅ Mensagem recebida:', msg.content.toString());
        channel.ack(msg);
      }
    });

    setTimeout(() => {
      connection.close();
      console.log('✅ Teste concluído com sucesso!');
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

testRabbitMQ();
```

**Executar:**
```bash
tsx src/test-rabbitmq.ts
```

---

## 6️⃣ MONITORAMENTO

### **Management UI**
- **Local:** http://localhost:15672
- **Produção:** http://seu-servidor:15672
- **Credenciais:** admin / sua_senha

### **Métricas Importantes**
- Messages in queues (deve ficar próximo de 0)
- Message rates (publish/deliver)
- Consumer count (workers ativos)
- Connection status

---

## ✅ CHECKLIST DE INSTALAÇÃO

### **Desenvolvimento:**
- [ ] Docker instalado
- [ ] RabbitMQ container rodando
- [ ] Porta 5672 acessível
- [ ] Management UI funcionando (15672)
- [ ] Dependências NPM instaladas
- [ ] Script de teste executado com sucesso

### **Produção:**
- [ ] docker-compose.yml configurado
- [ ] Variáveis de ambiente definidas
- [ ] Senha forte do RabbitMQ configurada
- [ ] Volumes persistentes configurados
- [ ] Build da imagem feito
- [ ] Deploy via Portainer concluído
- [ ] Portas expostas corretamente
- [ ] Management UI acessível

---

## 🚀 PRÓXIMOS PASSOS

Após RabbitMQ configurado:
1. ✅ Executar migrations do banco de dados
2. ✅ Implementar workers de sincronização
3. ✅ Implementar schedulers de polling
4. ✅ Testar sincronização completa
