import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IfoodCategory {
  id: string;
  category_id: string;
  ifood_category_id: string;
  merchant_id: string;
  catalog_id: string | null;
  name: string;
  external_code: string | null;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  index: number | null;
  template: string | null;
  user_id: string;
  created_at: string;
}

/**
 * Hook para buscar categorias do iFood por merchant_id
 */
export const useIfoodCategories = (merchantId?: string) => {
  const queryClient = useQueryClient();

  // Busca categorias do merchant específico
  const categoriesQuery = useQuery({
    queryKey: ['ifood-categories', merchantId],
    queryFn: async () => {
      if (!merchantId) {
        console.log('❌ [IFOOD-CATEGORIES] Sem merchant_id fornecido');
        return [];
      }

      console.log('📂 [IFOOD-CATEGORIES] Buscando categorias para merchant:', merchantId);

      const { data, error } = await supabase
        .from('ifood_categories')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('index', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ [IFOOD-CATEGORIES] Erro ao buscar categorias:', error);
        throw error;
      }

      console.log(`✅ [IFOOD-CATEGORIES] ${data?.length || 0} categorias encontradas`);
      return data as IfoodCategory[];
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  });

  // Função para forçar atualização
  const forceRefresh = () => {
    console.log('🔄 [IFOOD-CATEGORIES] Forçando atualização...');
    queryClient.invalidateQueries({ queryKey: ['ifood-categories', merchantId] });
  };

  // Função para obter apenas categorias ativas
  const getActiveCategories = () => {
    return categoriesQuery.data?.filter(cat => cat.status === 'AVAILABLE') || [];
  };

  return {
    categories: categoriesQuery.data || [],
    activeCategories: getActiveCategories(),
    isLoading: categoriesQuery.isLoading,
    isError: categoriesQuery.isError,
    error: categoriesQuery.error,
    forceRefresh,
    refetch: categoriesQuery.refetch,
  };
};
