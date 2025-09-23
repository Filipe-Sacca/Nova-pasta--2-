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
 * Realiza polling automático a cada 5 minutos
 */
export const useUserStoreProducts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Primeiro, busca os merchant_ids das lojas do usuário
  const { data: userMerchants } = useQuery({
    queryKey: ['user-merchants', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, name')
        .eq('user_id', user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutos para merchant data
  });

  // Busca produtos baseado nos merchant_ids com sincronização iFood
  const productsQuery = useQuery({
    queryKey: ['user-store-products', user?.id, userMerchants?.map(m => m.merchant_id)],
    queryFn: async () => {
      if (!userMerchants || userMerchants.length === 0) return [];

      console.log('🔄 [POLLING] Iniciando sincronização com dados frescos do iFood...');

      // STEP 1: Buscar produtos frescos do iFood para cada merchant
      for (const merchant of userMerchants) {
        try {
          console.log(`📡 [IFOOD] Sincronizando merchant: ${merchant.name} (${merchant.merchant_id})`);

          // Chamar endpoint de sincronização do servidor
          const response = await fetch(`http://localhost:8092/merchants/${merchant.merchant_id}/products/smart-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: user?.id
            })
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`✅ [SYNC] ${merchant.name}: ${result.updated_products} produtos atualizados`);
          } else {
            console.error(`❌ [SYNC] Erro ao sincronizar ${merchant.name}:`, response.status);
          }
        } catch (error) {
          console.error(`❌ [SYNC] Erro na sincronização do merchant ${merchant.name}:`, error);
        }
      }

      // STEP 2: Buscar dados atualizados do banco local
      console.log('🗄️ [DB] Buscando dados atualizados do banco...');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('merchant_id', userMerchants.map(m => m.merchant_id))
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ [DB] Erro ao buscar produtos das lojas:', error);
        throw error;
      }

      console.log(`✅ [POLLING] Sincronização completa: ${data?.length || 0} produtos`);
      return data as UserStoreProduct[];
    },
    enabled: !!user?.id && !!userMerchants && userMerchants.length > 0,
    refetchInterval: 30 * 1000, // 30 segundos de polling automático
    staleTime: 25 * 1000, // Dados ficam "stale" após 25 segundos
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

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

  return {
    products: productsQuery.data || [],
    groupedProducts,
    merchants: userMerchants || [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
    refetch: productsQuery.refetch,
    forceRefresh,
    lastUpdated: productsQuery.dataUpdatedAt,
    isRefetching: productsQuery.isRefetching,
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