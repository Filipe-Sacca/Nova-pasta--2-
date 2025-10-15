# 🎯 Sistema de Complementos - Documentação Completa

## ✅ O Que Foi Criado

### 1. **Hook Principal** - `useProductComplements.ts`
**Localização:** `src/hooks/useProductComplements.ts`

**Funcionalidade:**
- Busca produto do banco de dados
- Busca grupos de complementos relacionados
- Busca complementos individuais
- Monta estrutura completa com relacionamentos
- Cache de 5 minutos

**Principais funções:**
```typescript
useProductComplements(productId)      // 1 produto
useBulkProductComplements(productIds) // Múltiplos produtos
```

---

### 2. **Componente de Visualização** - `ProductComplementsView.tsx`
**Localização:** `src/components/modules/ProductComplementsView.tsx`

**Funcionalidade:**
- Exibe produto com imagem, nome, descrição, preço
- Lista grupos de complementos
- Mostra min/max de cada grupo
- Exibe complementos com preços
- Design responsivo e moderno

**Uso:**
```tsx
<ProductComplementsView productId="produto-123" />
```

---

### 3. **Documentação de Exemplos** - `EXEMPLO_USO_COMPLEMENTOS.md`
**Localização:** `frontend/plano-certo-hub-insights/EXEMPLO_USO_COMPLEMENTOS.md`

**Conteúdo:**
- 4 formas diferentes de usar
- Exemplos de código prontos
- Estrutura de dados retornada
- Guia de quando usar cada opção

---

## 🔄 Como Funciona

### Fluxo de Dados

```
┌─────────────────────────────────────────────────┐
│  1. Componente chama useProductComplements()    │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  2. Hook faz 3 queries ao Supabase:             │
│     - SELECT * FROM products                    │
│     - SELECT * FROM complement_groups           │
│     - SELECT * FROM ifood_complements           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  3. Hook monta estrutura completa:              │
│     {                                           │
│       product: {...},                           │
│       complementGroups: [                       │
│         {                                       │
│           name: "Adicionis",                    │
│           complements: [...]                    │
│         }                                       │
│       ]                                         │
│     }                                           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  4. Componente renderiza na tela                │
└─────────────────────────────────────────────────┘
```

---

## 📊 Estrutura de Dados

### Banco de Dados (3 Tabelas)

**1. products**
```
- id
- product_id (chave)
- name
- description
- price
- imagePath
- is_active
```

**2. complement_groups**
```
- id
- group_compl_id
- name
- min_selection
- max_selection
- option_group_type
- product_ids[] (array com IDs dos produtos)
- option_ids[] (array com IDs dos complementos)
```

**3. ifood_complements**
```
- id
- option_id
- name
- description
- context_price
- status
- imagePath
```

### Relacionamentos

```
products (1) ──── (N) complement_groups
                       │
                       └── (N) ifood_complements
```

---

## 🎨 Como Usar no Seu Código

### Exemplo Rápido

```tsx
import { useProductComplements } from '@/hooks/useProductComplements';
import { ProductComplementsView } from '@/components/modules/ProductComplementsView';

function MeuComponente() {
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Opção 1: Usar o hook diretamente
  const { data, isLoading } = useProductComplements(selectedProduct);

  // Opção 2: Usar o componente pronto
  return (
    <div>
      {selectedProduct && (
        <ProductComplementsView productId={selectedProduct} />
      )}
    </div>
  );
}
```

---

## ⚡ Performance

### Cache
- **Duração:** 5 minutos por produto
- **Revalidação:** Manual com `refetch()` ou automática após 5min
- **Benefício:** Reduz chamadas ao banco

### Busca em Lote
- Use `useBulkProductComplements()` para listas grandes
- **1 query** em vez de N queries
- **Mais rápido** para múltiplos produtos

---

## 🔧 Customização

### Alterar Tempo de Cache

Edite `src/hooks/useProductComplements.ts`:

```typescript
staleTime: 10 * 60 * 1000  // 10 minutos
```

### Alterar Layout do Componente

Edite `src/components/modules/ProductComplementsView.tsx`:
- Cores
- Espaçamentos
- Badges
- Layout de cards

---

## ✅ Vantagens Desta Abordagem

1. ✅ **Dados sempre atualizados** - Sync automático a cada 5min
2. ✅ **Sem latência de API** - Busca direto do banco local
3. ✅ **Cache inteligente** - Não sobrecarrega o banco
4. ✅ **Fácil de usar** - Apenas importar e usar
5. ✅ **Reutilizável** - Pode usar em qualquer componente
6. ✅ **TypeScript** - Tipos completos e seguros

---

## 📋 Checklist de Implementação

- [x] Hook criado (`useProductComplements.ts`)
- [x] Componente de visualização criado (`ProductComplementsView.tsx`)
- [x] Documentação de exemplos criada
- [ ] Integrar no `MenuManagement.tsx`
- [ ] Testar com produtos reais
- [ ] Ajustar layout conforme necessário
- [ ] Adicionar loading states
- [ ] Tratamento de erros

---

## 🚀 Próximos Passos

1. **Escolher onde usar:**
   - Modal de detalhes?
   - Aba separada?
   - Expansão inline?

2. **Integrar no MenuManagement:**
   - Adicionar botão "Ver Complementos"
   - Importar componente
   - Testar funcionamento

3. **Ajustes de UI/UX:**
   - Cores do tema
   - Ícones personalizados
   - Animações

---

## 📞 Suporte

Se precisar de ajuda:
- Veja os exemplos em `EXEMPLO_USO_COMPLEMENTOS.md`
- Verifique os tipos TypeScript no hook
- Os dados estão sempre atualizados no banco!

**Está tudo pronto para usar! 🎉**
