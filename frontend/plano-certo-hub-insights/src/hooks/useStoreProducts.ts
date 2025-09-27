import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreProduct {
  id: string;
  client_id: string;
  item_id: string;
  name: string;
  category: any;
  price: number;
  description: string;
  is_active: 'AVAILABLE' | 'UNAVAILABLE';
  created_at: string;
  updated_at: string;
  merchant_id: string;
  imagePath: string | null;
  product_id: string;
}

export interface UseStoreProductsResult {
  data: StoreProduct[] | undefined;
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

export interface ProductsByStore {
  [merchantId: string]: {
    merchantName: string;
    products: StoreProduct[];
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
  };
}

/**
 * Hook para buscar produtos de lojas específicas
 */
export const useStoreProducts = (clientId?: string, merchantIds?: string[]): UseStoreProductsResult => {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['store-products', clientId, merchantIds],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .order('updated_at', { ascending: false });

      // Filtrar por client_id se fornecido
      if (clientId) {
        query = query.eq('user_id', clientId);
      }

      // Filtrar por merchant_ids se fornecido
      if (merchantIds && merchantIds.length > 0) {
        query = query.in('merchant_id', merchantIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar produtos:', error);
        throw error;
      }

      return data as StoreProduct[];
    },
    enabled: !!clientId, // Só executa se tiver client_id
    refetchInterval: 5 * 60 * 1000, // Atualiza a cada 5 minutos (300000ms)
    staleTime: 4 * 60 * 1000, // Considera dados stale após 4 minutos
    refetchOnWindowFocus: true, // Atualiza ao focar na janela
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook para buscar produtos agrupados por loja
 */
export const useProductsByStore = (clientId?: string, merchantIds?: string[]) => {
  const { data: products, isLoading, error, refetch } = useStoreProducts(clientId, merchantIds);

  const productsByStore: ProductsByStore = {};

  if (products) {
    products.forEach((product) => {
      const merchantId = product.merchant_id;
      
      if (!productsByStore[merchantId]) {
        productsByStore[merchantId] = {
          merchantName: merchantId, // Será atualizado se tivermos dados do merchant
          products: [],
          totalProducts: 0,
          activeProducts: 0,
          inactiveProducts: 0,
        };
      }

      productsByStore[merchantId].products.push(product);
      productsByStore[merchantId].totalProducts++;
      
      if (product.is_active === 'AVAILABLE') {
        productsByStore[merchantId].activeProducts++;
      } else {
        productsByStore[merchantId].inactiveProducts++;
      }
    });
  }

  return {
    data: productsByStore,
    products,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook para buscar estatísticas de produtos
 */
export const useProductsStats = (clientId?: string, merchantIds?: string[]) => {
  const { data: products, isLoading, error } = useStoreProducts(clientId, merchantIds);

  const stats = {
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    averagePrice: 0,
    totalValue: 0,
  };

  if (products && products.length > 0) {
    stats.totalProducts = products.length;
    stats.activeProducts = products.filter(p => p.is_active === 'AVAILABLE').length;
    stats.inactiveProducts = products.filter(p => p.is_active === 'UNAVAILABLE').length;
    stats.totalValue = products.reduce((sum, p) => sum + (p.price || 0), 0);
    stats.averagePrice = stats.totalValue / stats.totalProducts;
  }

  return {
    ...stats,
    isLoading,
    error,
  };
};