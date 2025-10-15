# Fix: options_id em products

**Data:** 14 de Outubro de 2025
**Implementado por:** Claude (Anthropic)
**Status:** ✅ IMPLEMENTADO

---

## 📋 Resumo do Problema

A coluna `options_id` na tabela `products` estava sendo preenchida incorretamente:

### ❌ **ANTES (Errado):**
```
products.options_id = [
  "product-id-complement-1",  ← ID do produto complemento (ERRADO!)
  "product-id-complement-2"   ← ID do produto complemento (ERRADO!)
]
```

### ✅ **DEPOIS (Correto):**
```
products.options_id = [
  "option-id-1",  ← ID da opção do iFood (CORRETO!)
  "option-id-2"   ← ID da opção do iFood (CORRETO!)
]
```

---

## 🎯 Por que isso é um problema?

**Tabela `ifood_complements`:**
- ✅ `option_id` → Preenchido corretamente com o ID da opção do iFood
- ❌ `options_product_id` → Vazio (não contém o product_id)

**Resultado:**
- ❌ Não era possível fazer JOIN entre `products.options_id` e `ifood_complements`
- ❌ Frontend não conseguia carregar complementos dos produtos
- ✅ "Brasileira Updated" funcionava porque foi corrigido manualmente

---

## 🔧 Solução Implementada

### 1. **Correção no `syncService.ts`**

**Arquivo:** `src/sync/syncService.ts`
**Linhas:** 270-302

**Mudança:**
```typescript
// ============================================================================
// 🆕 COLETAR option_ids ANTES de salvar o produto
// ============================================================================
const allOptionIds: string[] = [];

if (product.optionGroups && product.optionGroups.length > 0) {
  for (const productOptionGroup of product.optionGroups) {
    const optionGroup = optionGroupsMap.get(productOptionGroup.id);

    if (optionGroup && optionGroup.optionIds && optionGroup.optionIds.length > 0) {
      // Adicionar todos os option_ids deste grupo
      allOptionIds.push(...optionGroup.optionIds);
    }
  }
}

console.log(`🎯 [SYNC] Product ${product.name} has ${allOptionIds.length} option_ids:`, allOptionIds);

// Adicionar options_id no productData
const productData = {
  // ... campos existentes
  options_id: allOptionIds.length > 0 ? allOptionIds : null  // ✅ Array de option_ids
};
```

**Comportamento:**
- Busca os `optionGroups` do produto
- Extrai todos os `option_ids` de cada grupo
- Salva o array de `option_id` (não `product_id`) em `products.options_id`

---

### 2. **Script de Migração SQL**

**Arquivo:** `migrate_fix_options_id.sql`

**O que faz:**
1. Cria função temporária `fix_product_options_id()`
2. Para cada produto:
   - Busca `option_ids` da tabela `complement_groups`
   - Atualiza `products.options_id` com os valores corretos
3. Retorna relatório de produtos atualizados
4. Remove função temporária

**Como executar:**
```bash
psql -h <host> -U <user> -d <database> -f migrate_fix_options_id.sql
```

---

### 3. **Por que NÃO modifiquei `menuRoutes.ts`?**

O endpoint `smart-sync-working` **não busca option groups** do iFood, apenas produtos básicos:

```typescript
// menuRoutes.ts linha 516-527
for (const item of itemsData.items) {
  allIfoodProducts.push({
    id: item.id,
    name: item.name,
    description: item.description || null,
    status: item.status,
    price: item.price?.value || 0,
    imagePath: item.imagePath || null,
    category: category.name,
    category_id: category.category_id
    // ❌ NÃO tem optionGroups aqui!
  });
}
```

**Decisão:**
- Deixar `smart-sync-working` simples (apenas sync básico)
- Usar `syncService.ts` (via RabbitMQ/scheduler) para sync completo com complementos

---

## 📊 Estrutura Correta

### **iFood API Response:**
```json
{
  "item": {
    "id": "item-123",
    "productId": "product-456",
    "status": "AVAILABLE"
  },
  "products": [{
    "id": "product-456",
    "name": "Pizza Calabresa",
    "optionGroups": [{
      "id": "group-789"
    }]
  }],
  "optionGroups": [{
    "id": "group-789",
    "name": "Bordas",
    "optionIds": ["opt-111", "opt-222"]  ← Estes IDs devem ir para products.options_id
  }],
  "options": [{
    "id": "opt-111",  ← Este é o option_id correto!
    "productId": "prod-borda-catupiry"
  }]
}
```

### **Banco de Dados:**

**Tabela `products`:**
```
id                  | name              | product_id   | options_id
--------------------|-------------------|--------------|------------------
uuid-1              | Pizza Calabresa   | product-456  | ["opt-111", "opt-222"]  ✅
```

**Tabela `ifood_complements`:**
```
id      | option_id  | name               | options_product_id
--------|------------|--------------------|-----------------
comp-1  | opt-111    | Borda Catupiry     | NULL (vazio)
comp-2  | opt-222    | Borda Cheddar      | NULL (vazio)
```

**JOIN:**
```sql
SELECT
    p.name as product_name,
    ic.name as complement_name,
    ic.context_price
FROM products p
JOIN ifood_complements ic
    ON ic.option_id = ANY(
        SELECT jsonb_array_elements_text(p.options_id)
    )
WHERE p.id = 'uuid-1';
```

**Resultado:**
```
product_name     | complement_name    | context_price
-----------------|--------------------|--------------
Pizza Calabresa  | Borda Catupiry     | 5.00
Pizza Calabresa  | Borda Cheddar      | 8.00
```

---

## 🧪 Como Testar

### 1. **Testar após sync de um merchant:**

```bash
# Executar sync completo via syncService
# (via RabbitMQ worker ou manualmente)
```

### 2. **Verificar no banco:**

```sql
-- Ver produtos com options_id preenchidos
SELECT
    p.id,
    p.name,
    p.options_id,
    (
        SELECT COUNT(*)
        FROM ifood_complements ic
        WHERE ic.option_id = ANY(
            SELECT jsonb_array_elements_text(p.options_id)
        )
    ) as matching_complements_count
FROM products p
WHERE p.options_id IS NOT NULL
LIMIT 10;
```

**Resultado esperado:**
- `matching_complements_count` > 0 para produtos com complementos

### 3. **Testar no frontend:**

```
1. Acesse a aba de Gestão de Cardápios
2. Selecione um merchant
3. Clique em um produto que tenha complementos
4. Verifique se os complementos aparecem corretamente
```

---

## 📁 Arquivos Modificados

| Arquivo | Tipo | Mudanças |
|---------|------|----------|
| `src/sync/syncService.ts` (linhas 270-302) | ✨ Novo | Coleta option_ids antes de salvar produto |
| `migrate_fix_options_id.sql` | ✨ Novo | Script de migração para corrigir dados existentes |
| `claudedocs/FIX_OPTIONS_ID.md` | ✨ Novo | Esta documentação |

---

## ✅ Checklist

- [x] Problema identificado e documentado
- [x] Correção implementada em `syncService.ts`
- [x] Script de migração SQL criado
- [x] Documentação completa
- [x] Código comentado e com logs
- [x] Pronto para testes

---

## 🚀 Próximos Passos

1. **Executar migração SQL** para corrigir dados existentes
2. **Testar sync** de um merchant via `syncService.ts`
3. **Validar no frontend** que complementos aparecem corretamente
4. **Monitorar logs** para confirmar que `options_id` está sendo preenchido

---

**Implementado por:** Claude (Anthropic)
**Data:** 14 de Outubro de 2025
**Versão:** 1.0.0
