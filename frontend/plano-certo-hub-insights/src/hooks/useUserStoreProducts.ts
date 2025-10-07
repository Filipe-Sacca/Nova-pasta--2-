import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/App';

export interface UserStoreProduct {
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

export interface StoreProductsGroup {
  merchantId: string;
  merchantName: string;
  products: UserStoreProduct[];
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
}

/**
 * Hook para buscar produtos baseado nos merchant_ids das lojas do usuário logado
 * Versão otimizada: carregamento imediato do banco + smart-sync sob demanda
 */
export const useUserStoreProducts = (selectedMerchantId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Primeiro, busca os merchant_ids das lojas do usuário (versão simplificada)
  const { data: userMerchants, isLoading: merchantsLoading } = useQuery({
    queryKey: ['user-merchants', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('❌ [MERCHANTS] Sem user ID');
        return [];
      }

      console.log('🔍 [MERCHANTS] Buscando merchants para user:', user.id);
      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, name')
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ [MERCHANTS] Erro:', error);
        throw error;
      }

      console.log('✅ [MERCHANTS] Encontrados:', data?.length || 0);
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000,
  });

  // Busca produtos diretamente do banco (rápido, sem API calls)
  const productsQuery = useQuery({
    queryKey: ['user-store-products', user?.id, userMerchants?.map(m => m.merchant_id)],
    queryFn: async () => {
      console.log('🗄️ [PRODUCTS] Carregamento direto do banco...');

      if (!userMerchants || userMerchants.length === 0) {
        console.log('❌ [PRODUCTS] Sem merchants');
        return [];
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('merchant_id', userMerchants.map(m => m.merchant_id))
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ [PRODUCTS] Erro:', error);
        throw error;
      }

      console.log(`✅ [PRODUCTS] Carregados do banco: ${data?.length || 0}`);
      return data as UserStoreProduct[];
    },
    enabled: !!user?.id && !!userMerchants && userMerchants.length > 0 && !merchantsLoading,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnWindowFocus: false, // Não refazer ao focar
    refetchOnReconnect: false, // Não refazer ao reconectar
  });

  // Smart-sync sob demanda para merchant específico
  const smartSyncQuery = useQuery({
    queryKey: ['smart-sync', selectedMerchantId, user?.id],
    queryFn: async () => {
      if (!selectedMerchantId || !user?.id) return null;

      const merchant = userMerchants?.find(m => m.merchant_id === selectedMerchantId);
      if (!merchant) return null;

      const timestamp = new Date().toLocaleTimeString();
      console.log(`🧠 [SMART-SYNC] Executando para ${merchant.name} às ${timestamp}`);

      try {
        const response = await fetch(`${API_BASE_URL}/merchants/${merchant.merchant_id}/products/simple-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quick_mode: false // Sempre sincronização completa com iFood
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ [SMART-SYNC] ${merchant.name}: ${result.updated_products || 0} produtos atualizados`);

          // Se houve atualizações, recarregar produtos do banco
          if (result.updated_products > 0) {
            queryClient.invalidateQueries({ queryKey: ['user-store-products'] });
          }

          return result;
        } else {
          console.error(`❌ [SMART-SYNC] Erro ${response.status} para merchant ${merchant.name}`);
          return null;
        }
      } catch (error) {
        console.error(`❌ [SMART-SYNC] Erro na requisição para merchant ${merchant.name}:`, error);
        return null;
      }
    },
    enabled: !!selectedMerchantId && !!user?.id && !!userMerchants,
    refetchInterval: selectedMerchantId ? 30 * 1000 : false, // Polling apenas se merchant selecionado
    staleTime: 25 * 1000,
  });

  // Função para sincronização em background (não bloqueia carregamento)
  const syncInBackground = async (merchants: any[], userId: string | undefined) => {
    if (!userId) return;

    console.log('🔄 [BACKGROUND] Iniciando sincronização em background...');

    for (const merchant of merchants) {
      try {
        console.log(`📡 [BACKGROUND] Sincronizando merchant: ${merchant.name}`);

        // Sincronização completa em background
        const response = await fetch(`${API_BASE_URL}/merchants/${merchant.merchant_id}/products/simple-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quick_mode: false  // Sempre sincronização completa com iFood
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ [BACKGROUND] ${merchant.name}: ${result.updated_products} produtos atualizados`);

          // Se houve atualizações, refazer query para mostrar dados frescos
          if (result.updated_products > 0) {
            console.log('🔄 [BACKGROUND] Dados atualizados, recarregando...');
            queryClient.invalidateQueries({ queryKey: ['user-store-products'] });
          }
        }
      } catch (error) {
        console.error(`❌ [BACKGROUND] Erro na sincronização do merchant ${merchant.name}:`, error);
      }
    }
  };

  // Agrupa produtos por loja
  const groupedProducts: StoreProductsGroup[] = [];
  
  if (productsQuery.data && userMerchants) {
    const productsByMerchant = productsQuery.data.reduce((acc, product) => {
      const merchantId = product.merchant_id;
      if (!merchantId) return acc;

      if (!acc[merchantId]) {
        acc[merchantId] = [];
      }
      acc[merchantId].push(product);
      return acc;
    }, {} as Record<string, UserStoreProduct[]>);

    Object.entries(productsByMerchant).forEach(([merchantId, products]) => {
      const merchant = userMerchants.find(m => m.merchant_id === merchantId);
      const activeProducts = products.filter(p => p.is_active === 'AVAILABLE').length;
      
      groupedProducts.push({
        merchantId,
        merchantName: merchant?.name || merchantId,
        products,
        totalProducts: products.length,
        activeProducts,
        inactiveProducts: products.length - activeProducts,
      });
    });
  }

  // Função para forçar atualização manual
  const forceRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['user-store-products'] });
  };

  // Função para sincronização manual com iFood
  const syncWithIfood = async () => {
    if (!userMerchants || !user?.id) return;

    console.log('🔄 [MANUAL] Iniciando sincronização manual com iFood...');

    for (const merchant of userMerchants) {
      try {
        const response = await fetch(`${API_BASE_URL}/merchants/${merchant.merchant_id}/products/simple-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quick_mode: false  // Sempre sincronização completa com iFood
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ [MANUAL] ${merchant.name}: ${result.updated_products} produtos atualizados`);
        }
      } catch (error) {
        console.error(`❌ [MANUAL] Erro na sincronização:`, error);
      }
    }

    // Atualizar dados após sincronização
    forceRefresh();
  };

  // Debug logging (apenas quando necessário)
  if (merchantsLoading || productsQuery.isLoading) {
    console.log('🔍 [LOADING] Merchants:', merchantsLoading, 'Products:', productsQuery.isLoading);
  }

  return {
    products: productsQuery.data || [],
    groupedProducts,
    merchants: userMerchants || [],
    isLoading: merchantsLoading || productsQuery.isLoading,
    error: productsQuery.error,
    refetch: productsQuery.refetch,
    forceRefresh,
    syncWithIfood,
    lastUpdated: productsQuery.dataUpdatedAt,
    isRefetching: productsQuery.isRefetching,
    // Smart-sync específico por merchant
    smartSync: {
      isLoading: smartSyncQuery.isLoading,
      data: smartSyncQuery.data,
      error: smartSyncQuery.error,
    },
  };
};

/**
 * Hook para estatísticas dos produtos do usuário
 */
export const useUserProductsStats = () => {
  const { products, isLoading, error } = useUserStoreProducts();

  const stats = {
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    averagePrice: 0,
    totalValue: 0,
    storesWithProducts: 0,
  };

  if (products && products.length > 0) {
    stats.totalProducts = products.length;
    stats.activeProducts = products.filter(p => p.is_active === 'AVAILABLE').length;
    stats.inactiveProducts = products.filter(p => p.is_active === 'UNAVAILABLE').length;
    
    const productsWithPrice = products.filter(p => p.price && p.price > 0);
    stats.totalValue = productsWithPrice.reduce((sum, p) => sum + (p.price || 0), 0);
    stats.averagePrice = productsWithPrice.length > 0 ? stats.totalValue / productsWithPrice.length : 0;
    
    const uniqueStores = new Set(products.map(p => p.merchant_id).filter(Boolean));
    stats.storesWithProducts = uniqueStores.size;
  }

  return {
    ...stats,
    isLoading,
    error,
  };
};