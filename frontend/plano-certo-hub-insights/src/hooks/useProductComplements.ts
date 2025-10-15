import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Complement {
  id: string;
  option_id: string;
  name: string;
  description: string | null;
  context_price: number;
  status: string;
  imagePath: string | null;
}

export interface ProductWithComplements {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  imagePath: string | null;
  is_active: string;
  complements: Complement[];
}

/**
 * Hook para buscar complementos de um produto específico
 * Busca individualmente cada option_id do array option_ids
 */
export const useProductComplements = (productId?: string) => {
  return useQuery({
    queryKey: ['product-complements', productId],
    queryFn: async () => {
      if (!productId) {
        console.log('❌ [COMPLEMENTS] Sem product_id fornecido');
        return null;
      }

      console.log('🔍 [COMPLEMENTS] Buscando complementos para produto:', productId);

      // 1. Buscar produto
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (productError) {
        console.error('❌ [COMPLEMENTS] Erro ao buscar produto:', productError);
        throw productError;
      }

      console.log('✅ [COMPLEMENTS] Produto encontrado:', product.name);
      console.log('🔍 [COMPLEMENTS] option_ids:', product.option_ids);

      // 2. Se não tem option_ids, retorna produto sem complementos
      if (!product.option_ids || product.option_ids.length === 0) {
        console.log('ℹ️ [COMPLEMENTS] Produto não possui complementos');
        return {
          id: product.id,
          product_id: product.product_id,
          name: product.name,
          description: product.description,
          price: product.price || 0,
          imagePath: product.imagePath,
          is_active: product.is_active,
          complements: []
        };
      }

      // 3. Buscar complementos individualmente (um por um)
      console.log(`🔄 [COMPLEMENTS] Buscando ${product.option_ids.length} complementos...`);
      const complements: any[] = [];

      for (const optionId of product.option_ids) {
        const { data: comp, error: compError } = await supabase
          .from('ifood_complements')
          .select('*')
          .eq('option_id', optionId)
          .maybeSingle();

        if (compError) {
          console.error(`❌ [COMPLEMENTS] Erro ao buscar ${optionId}:`, compError);
        } else if (comp) {
          console.log(`✅ [COMPLEMENTS] Encontrado: ${comp.name} (R$ ${comp.context_price})`);
          complements.push(comp);
        } else {
          console.log(`⚠️ [COMPLEMENTS] Complemento ${optionId} não encontrado na tabela`);
        }
      }

      console.log(`📊 [COMPLEMENTS] Total encontrados: ${complements.length} de ${product.option_ids.length}`);

      // 4. Retornar produto com complementos
      return {
        id: product.id,
        product_id: product.product_id,
        name: product.name,
        description: product.description,
        price: product.price || 0,
        imagePath: product.imagePath,
        is_active: product.is_active,
        complements: complements.map(comp => ({
          id: comp.id,
          option_id: comp.option_id,
          name: comp.name || 'Sem nome',
          description: comp.description,
          context_price: comp.context_price || 0,
          status: comp.status || 'AVAILABLE',
          imagePath: comp.imagePath
        }))
      };
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook para buscar todos os complementos de múltiplos produtos
 * Útil para exibir em lista
 */
export const useBulkProductComplements = (productIds: string[]) => {
  return useQuery({
    queryKey: ['bulk-complements', productIds],
    queryFn: async () => {
      if (!productIds || productIds.length === 0) {
        return [];
      }

      console.log('🔍 [BULK-COMPLEMENTS] Buscando para', productIds.length, 'produtos');

      // Buscar todos os grupos que contêm qualquer um dos produtos
      const { data: groups, error: groupsError } = await supabase
        .from('complement_groups')
        .select('*')
        .overlaps('product_ids', productIds);

      if (groupsError) {
        console.error('❌ [BULK-COMPLEMENTS] Erro:', groupsError);
        return [];
      }

      // Criar Map: productId -> grupos
      const productGroupsMap = new Map<string, any[]>();

      groups?.forEach(group => {
        group.product_ids?.forEach((pid: string) => {
          if (productIds.includes(pid)) {
            if (!productGroupsMap.has(pid)) {
              productGroupsMap.set(pid, []);
            }
            productGroupsMap.get(pid)!.push(group);
          }
        });
      });

      console.log('✅ [BULK-COMPLEMENTS] Mapeados grupos para produtos');
      return productGroupsMap;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
};
