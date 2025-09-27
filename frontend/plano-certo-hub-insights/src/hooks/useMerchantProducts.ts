import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MerchantProduct {
  id: string;
  client_id: string;
  item_id: string | null;
  name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  is_active: 'AVAILABLE' | 'UNAVAILABLE' | null;
  created_at: string;
  updated_at: string;
  merchant_id: string | null;
  imagePath: string | null;
  product_id: string | null;
  ifood_product_id: string | null;
}

export interface MerchantProductsGroup {
  merchantId: string;
  merchantName: string;
  products: MerchantProduct[];
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
}

/**
 * Hook simplificado para buscar produtos por merchant_id específico
 * Não depende de user_id - funciona com qualquer merchant_id
 */
export const useMerchantProducts = (merchantId?: string) => {
  const queryClient = useQueryClient();

  // Busca produtos do merchant específico
  const productsQuery = useQuery({
    queryKey: ['merchant-products', merchantId],
    queryFn: async () => {
      if (!merchantId) {
        console.log('❌ [MERCHANT-PRODUCTS] Sem merchant_id fornecido');
        return [];
      }

      console.log('🗄️ [MERCHANT-PRODUCTS] Buscando produtos para merchant:', merchantId);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ [MERCHANT-PRODUCTS] Erro:', error);
        throw error;
      }

      console.log(`✅ [MERCHANT-PRODUCTS] Produtos encontrados: ${data?.length || 0}`);
      return data as MerchantProduct[];
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Sincronização com iFood para o merchant específico
  const syncQuery = useQuery({
    queryKey: ['merchant-sync', merchantId],
    queryFn: async () => {
      if (!merchantId) return null;

      console.log(`🧠 [MERCHANT-SYNC] Sincronizando produtos para merchant: ${merchantId}`);

      try {
        const response = await fetch(`http://localhost:8093/merchants/${merchantId}/products/simple-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quick_mode: false // Sincronização completa com iFood
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ [MERCHANT-SYNC] ${merchantId}: ${result.updated_products || 0} produtos atualizados`);

          // Se houve atualizações, recarregar produtos
          if (result.updated_products > 0) {
            queryClient.invalidateQueries({ queryKey: ['merchant-products', merchantId] });
          }

          return result;
        } else {
          console.error(`❌ [MERCHANT-SYNC] Erro ${response.status} para merchant ${merchantId}`);
          return null;
        }
      } catch (error) {
        console.error(`❌ [MERCHANT-SYNC] Erro na requisição:`, error);
        return null;
      }
    },
    enabled: !!merchantId,
    refetchInterval: merchantId ? 30 * 1000 : false, // Polling de 30s se merchant ativo
    staleTime: 25 * 1000,
  });

  // Estatísticas dos produtos
  const stats = {
    totalProducts: productsQuery.data?.length || 0,
    activeProducts: productsQuery.data?.filter(p => p.is_active === 'AVAILABLE').length || 0,
    inactiveProducts: productsQuery.data?.filter(p => p.is_active === 'UNAVAILABLE').length || 0,
    averagePrice: 0,
    totalValue: 0,
  };

  if (productsQuery.data && productsQuery.data.length > 0) {
    const productsWithPrice = productsQuery.data.filter(p => p.price && p.price > 0);
    stats.totalValue = productsWithPrice.reduce((sum, p) => sum + (p.price || 0), 0);
    stats.averagePrice = productsWithPrice.length > 0 ? stats.totalValue / productsWithPrice.length : 0;
  }

  // Função para forçar atualização manual
  const forceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['merchant-products', merchantId] });
  };

  // Função para sincronização manual
  const syncWithIfood = async () => {
    if (!merchantId) return;

    console.log('🔄 [MANUAL-SYNC] Iniciando sincronização manual para merchant:', merchantId);

    try {
      const response = await fetch(`http://localhost:8093/merchants/${merchantId}/products/simple-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quick_mode: false
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ [MANUAL-SYNC] ${merchantId}: ${result.updated_products} produtos atualizados`);

        // Atualizar dados após sincronização
        forceRefresh();
        return result;
      } else {
        console.error(`❌ [MANUAL-SYNC] Erro ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ [MANUAL-SYNC] Erro:`, error);
      return null;
    }
  };

  return {
    products: productsQuery.data || [],
    stats,
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
    refetch: productsQuery.refetch,
    forceRefresh,
    syncWithIfood,
    lastUpdated: productsQuery.dataUpdatedAt,
    isRefetching: productsQuery.isRefetching,
    // Informações de sincronização
    sync: {
      isLoading: syncQuery.isLoading,
      data: syncQuery.data,
      error: syncQuery.error,
    },
  };
};

/**
 * Hook para buscar todos os merchants disponíveis (independente de user_id)
 */
export const useAvailableMerchants = () => {
  return useQuery({
    queryKey: ['available-merchants'],
    queryFn: async () => {
      console.log('🏪 [MERCHANTS] Buscando todos os merchants disponíveis...');

      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, name, corporate_name')
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ [MERCHANTS] Erro:', error);
        throw error;
      }

      console.log('✅ [MERCHANTS] Merchants encontrados:', data?.length || 0);
      return data || [];
    },
    staleTime: 30 * 60 * 1000, // Cache por 30 minutos
  });
};