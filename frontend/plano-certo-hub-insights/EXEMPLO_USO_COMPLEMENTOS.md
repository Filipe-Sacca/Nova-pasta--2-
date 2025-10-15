# 📖 Como Usar os Complementos no MenuManagement

## 🎯 Opção 1: Ver Detalhes de Um Produto (Modal)

Adicione isso no seu `MenuManagement.tsx`:

```tsx
import { ProductComplementsView } from './ProductComplementsView';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Adicionar estados
const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
const [isComplementsModalOpen, setIsComplementsModalOpen] = useState(false);

// Função para abrir modal
const handleViewComplements = (productId: string) => {
  setSelectedProductId(productId);
  setIsComplementsModalOpen(true);
};

// Adicionar botão na tabela de produtos (onde você lista os produtos)
<Button
  size="sm"
  variant="outline"
  onClick={() => handleViewComplements(product.product_id)}
>
  <Eye className="h-4 w-4 mr-1" />
  Ver Complementos
</Button>

// Adicionar o Modal no final do componente
<Dialog open={isComplementsModalOpen} onOpenChange={setIsComplementsModalOpen}>
  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Produto e Complementos</DialogTitle>
    </DialogHeader>
    {selectedProductId && (
      <ProductComplementsView productId={selectedProductId} />
    )}
  </DialogContent>
</Dialog>
```

---

## 🎯 Opção 2: Adicionar Coluna de Complementos na Tabela

```tsx
import { useProductComplements } from '@/hooks/useProductComplements';

// Dentro do map de produtos
{products.map((product) => {
  const { data: productWithComplements } = useProductComplements(product.product_id);

  return (
    <TableRow key={product.id}>
      <TableCell>{product.name}</TableCell>
      <TableCell>{formatPrice(product.price)}</TableCell>

      {/* NOVA COLUNA - Complementos */}
      <TableCell>
        {productWithComplements?.complementGroups?.length > 0 ? (
          <Badge variant="outline">
            {productWithComplements.complementGroups.length} grupos
          </Badge>
        ) : (
          <span className="text-gray-400 text-sm">Sem complementos</span>
        )}
      </TableCell>

      <TableCell>
        <Button onClick={() => handleViewComplements(product.product_id)}>
          Detalhes
        </Button>
      </TableCell>
    </TableRow>
  );
})}
```

---

## 🎯 Opção 3: Hook Simples para Verificar se Tem Complementos

Se você só quer saber SE o produto tem complementos (sem buscar todos):

```tsx
import { useProductComplements } from '@/hooks/useProductComplements';

const ProductRow = ({ product }) => {
  const { data, isLoading } = useProductComplements(product.product_id);

  const hasComplements = data?.complementGroups && data.complementGroups.length > 0;
  const totalComplements = data?.complementGroups?.reduce(
    (sum, group) => sum + group.complements.length,
    0
  ) || 0;

  return (
    <div className="flex items-center gap-2">
      <span>{product.name}</span>
      {hasComplements && (
        <Badge variant="secondary">
          {totalComplements} complementos
        </Badge>
      )}
    </div>
  );
};
```

---

## 🎯 Opção 4: Busca em Lote (Múltiplos Produtos)

Para listas grandes, use o hook de busca em lote:

```tsx
import { useBulkProductComplements } from '@/hooks/useProductComplements';

const ProductsList = ({ products }) => {
  // Pegar IDs de todos os produtos
  const productIds = products.map(p => p.product_id);

  // Buscar complementos de todos de uma vez
  const { data: complementsMap, isLoading } = useBulkProductComplements(productIds);

  return (
    <div>
      {products.map(product => {
        const groups = complementsMap?.get(product.product_id) || [];

        return (
          <div key={product.id}>
            <h3>{product.name}</h3>
            {groups.length > 0 && (
              <Badge>{groups.length} grupos de complementos</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
};
```

---

## 📋 Estrutura de Dados Retornada

```typescript
{
  id: "uuid",
  product_id: "produto-123",
  name: "American Updated",
  description: "É uma pizza americana",
  price: 59.90,
  imagePath: "https://...",
  is_active: "AVAILABLE",
  complementGroups: [
    {
      id: "uuid",
      group_compl_id: "grupo-123",
      name: "Adicionis",
      min_selection: 0,
      max_selection: 1,
      option_group_type: "SINGLE",
      status: "AVAILABLE",
      complements: [
        {
          id: "uuid",
          option_id: "opt-123",
          name: "Molho Rose",
          description: "Molho rose",
          context_price: 5.00,
          status: "AVAILABLE",
          imagePath: null
        },
        {
          id: "uuid",
          option_id: "opt-456",
          name: "Molho Verde",
          description: "Molho Verde",
          context_price: 4.00,
          status: "AVAILABLE",
          imagePath: null
        }
      ]
    }
  ]
}
```

---

## 🎨 Onde Usar Cada Opção

| Situação | Melhor Opção |
|----------|--------------|
| Ver todos os detalhes de 1 produto | **Opção 1** - Modal |
| Mostrar indicador na lista | **Opção 2** - Coluna |
| Apenas verificar se tem | **Opção 3** - Hook simples |
| Lista com muitos produtos | **Opção 4** - Busca em lote |

---

## ✅ Próximos Passos

1. Escolha qual opção usar
2. Importe o hook no seu componente
3. Use conforme o exemplo
4. Ajuste o layout/estilo conforme necessário

**Os dados já estão no banco e sempre atualizados!** 🚀
