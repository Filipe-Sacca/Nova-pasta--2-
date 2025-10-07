# 📊 Estrutura das Tabelas - Sistema de Grupos de Complementos

## 🎯 Visão Geral das Tabelas

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESTRUTURA DO SISTEMA                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐         ┌────────────────────────────┐   │
│  │ ifood_products   │         │ ifood_option_groups_master │   │
│  │ (Produtos)       │         │ (Grupos de Opções)         │   │
│  └──────────────────┘         └────────────────────────────┘   │
│         │                                │                      │
│         │                                │                      │
│         └────────────┬───────────────────┘                      │
│                      │                                          │
│                      ▼                                          │
│         ┌────────────────────────────┐                          │
│         │ ifood_product_option_groups│                          │
│         │ (Relacionamento N:N)       │                          │
│         └────────────────────────────┘                          │
│                      │                                          │
│                      │                                          │
│                      ▼                                          │
│         ┌────────────────────────────┐                          │
│         │   ifood_options            │                          │
│         │   (Opções do Grupo)        │                          │
│         └────────────────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Tabela 1: `ifood_products`

**Propósito**: Armazena TODOS os produtos (principais E complementos)

### Colunas Principais:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | ID interno do banco |
| `product_id` | VARCHAR(255) | UUID do iFood (ÚNICO) |
| `merchant_id` | VARCHAR(255) | ID do restaurante |
| `user_id` | VARCHAR(255) | ID do usuário |
| `name` | VARCHAR(255) | Nome do produto |
| `description` | TEXT | Descrição completa |
| `image_path` | TEXT | URL da imagem |
| `serving` | VARCHAR(50) | SERVES_1, SERVES_2, NOT_APPLICABLE |
| `tags` | TEXT[] | Array de tags |
| `dietary_restrictions` | TEXT[] | Restrições: VEGETARIAN, VEGAN, etc |
| `industrialized` | BOOLEAN | Se é industrializado |
| `product_type` | VARCHAR(50) | **MAIN** (principal) ou **COMPLEMENT** (complemento) |

### Exemplos de Dados:

```sql
-- Produto Principal
INSERT INTO ifood_products (product_id, name, description, serving, product_type)
VALUES ('uuid-pizza', 'Pizza Calabresa', 'Pizza Saborosa', 'SERVES_1', 'MAIN');

-- Produto Complemento
INSERT INTO ifood_products (product_id, name, description, serving, product_type)
VALUES ('uuid-molho', 'Molho de Alho', 'Molho saboroso', 'NOT_APPLICABLE', 'COMPLEMENT');
```

---

## 📋 Tabela 2: `ifood_option_groups_master`

**Propósito**: Armazena os grupos de opções (reutilizáveis)

### Colunas Principais:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | ID interno do banco |
| `group_id` | VARCHAR(255) | UUID do grupo (ÚNICO) |
| `merchant_id` | VARCHAR(255) | ID do restaurante |
| `user_id` | VARCHAR(255) | ID do usuário |
| `name` | VARCHAR(255) | Nome do grupo (ex: "Complementos") |
| `status` | VARCHAR(50) | AVAILABLE, UNAVAILABLE |
| `option_group_type` | VARCHAR(50) | INGREDIENTS, PIZZA_EDGE, PIZZA_DOUGH, SIZE, FLAVOR |
| `min_selection` | INT | Mínimo de itens obrigatórios |
| `max_selection` | INT | Máximo de itens permitidos |
| `display_index` | INT | Ordem de exibição |

### Exemplos de Dados:

```sql
-- Grupo de Complementos
INSERT INTO ifood_option_groups_master (group_id, name, option_group_type, min_selection, max_selection)
VALUES ('uuid-grupo-comp', 'Complementos', 'INGREDIENTS', 0, 1);

-- Grupo de Bordas
INSERT INTO ifood_option_groups_master (group_id, name, option_group_type, min_selection, max_selection)
VALUES ('uuid-grupo-borda', 'Escolha a Borda', 'PIZZA_EDGE', 0, 1);
```

---

## 📋 Tabela 3: `ifood_product_option_groups`

**Propósito**: Relacionamento N:N entre produtos e grupos de opções

### Colunas Principais:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | ID interno do banco |
| `product_id` | VARCHAR(255) | FK → ifood_products.product_id |
| `option_group_id` | VARCHAR(255) | FK → ifood_option_groups_master.group_id |
| `min_selection` | INT | Sobrescreve min do grupo (opcional) |
| `max_selection` | INT | Sobrescreve max do grupo (opcional) |
| `display_index` | INT | Ordem de exibição no produto |

### Exemplos de Dados:

```sql
-- Associa grupo "Complementos" à "Pizza Calabresa"
INSERT INTO ifood_product_option_groups (product_id, option_group_id, display_index)
VALUES ('uuid-pizza', 'uuid-grupo-comp', 0);

-- Associa grupo "Bordas" à "Pizza Calabresa"
INSERT INTO ifood_product_option_groups (product_id, option_group_id, display_index)
VALUES ('uuid-pizza', 'uuid-grupo-borda', 1);
```

---

## 📋 Tabela 4: `ifood_options`

**Propósito**: Opções individuais dentro de cada grupo

### Colunas Principais:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | SERIAL | ID interno do banco |
| `option_id` | VARCHAR(255) | UUID da opção (ÚNICO) |
| `option_group_id` | VARCHAR(255) | FK → ifood_option_groups_master.group_id |
| `product_id` | VARCHAR(255) | FK → ifood_products.product_id (o complemento) |
| `status` | VARCHAR(50) | AVAILABLE, UNAVAILABLE |
| `display_index` | INT | Ordem de exibição |
| `price` | DECIMAL(10,2) | Preço adicional |
| `catalog_context` | VARCHAR(50) | DEFAULT, DELIVERY, etc |

### Exemplos de Dados:

```sql
-- Adiciona "Molho de Alho" ao grupo "Complementos" por R$ 4,00
INSERT INTO ifood_options (option_id, option_group_id, product_id, price, display_index)
VALUES ('uuid-opt-1', 'uuid-grupo-comp', 'uuid-molho-alho', 4.00, 0);

-- Adiciona "Molho Pomodoro" ao grupo "Complementos" por R$ 6,00
INSERT INTO ifood_options (option_id, option_group_id, product_id, price, display_index)
VALUES ('uuid-opt-2', 'uuid-grupo-comp', 'uuid-molho-pomodoro', 6.00, 1);
```

---

## 🔄 Fluxo Completo de Dados

### Exemplo: Pizza Calabresa com Complementos

```sql
-- 1️⃣ Criar produto principal
INSERT INTO ifood_products (product_id, name, serving, product_type)
VALUES ('pizza-123', 'Pizza Calabresa', 'SERVES_1', 'MAIN');

-- 2️⃣ Criar grupo de opções
INSERT INTO ifood_option_groups_master (group_id, name, option_group_type, min_selection, max_selection)
VALUES ('grupo-comp', 'Complementos', 'INGREDIENTS', 0, 1);

-- 3️⃣ Associar grupo ao produto
INSERT INTO ifood_product_option_groups (product_id, option_group_id, display_index)
VALUES ('pizza-123', 'grupo-comp', 0);

-- 4️⃣ Criar complementos
INSERT INTO ifood_products (product_id, name, serving, product_type)
VALUES
  ('molho-alho', 'Molho de Alho', 'NOT_APPLICABLE', 'COMPLEMENT'),
  ('molho-pomo', 'Molho Pomodoro', 'NOT_APPLICABLE', 'COMPLEMENT');

-- 5️⃣ Adicionar complementos ao grupo
INSERT INTO ifood_options (option_id, option_group_id, product_id, price, display_index)
VALUES
  ('opt-1', 'grupo-comp', 'molho-alho', 4.00, 0),
  ('opt-2', 'grupo-comp', 'molho-pomo', 6.00, 1);
```

---

## 🔍 Queries Úteis

### Buscar produto com todos os grupos e opções:

```sql
SELECT
  p.name AS produto,
  og.name AS grupo,
  og.min_selection,
  og.max_selection,
  pc.name AS complemento,
  o.price AS preco_adicional
FROM ifood_products p
LEFT JOIN ifood_product_option_groups pog ON p.product_id = pog.product_id
LEFT JOIN ifood_option_groups_master og ON pog.option_group_id = og.group_id
LEFT JOIN ifood_options o ON og.group_id = o.option_group_id
LEFT JOIN ifood_products pc ON o.product_id = pc.product_id
WHERE p.product_id = 'pizza-123';
```

### Buscar todos os grupos disponíveis:

```sql
SELECT * FROM ifood_option_groups_master
WHERE status = 'AVAILABLE'
  AND merchant_id = 'merchant-123'
ORDER BY name;
```

### Buscar todos os complementos disponíveis:

```sql
SELECT * FROM ifood_products
WHERE product_type = 'COMPLEMENT'
  AND merchant_id = 'merchant-123'
ORDER BY name;
```

---

## ✅ Vantagens desta Estrutura

1. **Reutilização**: Um grupo pode ser usado em vários produtos
2. **Flexibilidade**: Complementos podem estar em múltiplos grupos
3. **Normalização**: Evita duplicação de dados
4. **Escalabilidade**: Fácil adicionar novos tipos de grupos/opções
5. **Performance**: Índices otimizados para queries comuns

---

## 🎯 Próximos Passos

1. Executar o SQL no banco de dados
2. Criar endpoints na API para gerenciar grupos e opções
3. Implementar interface no frontend
4. Integrar com API do iFood para sincronização
