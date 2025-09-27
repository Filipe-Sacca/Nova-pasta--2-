import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface IfoodMerchantFromDB {
  id: string;
  merchant_id: string;
  name: string;
  corporate_name: string | null;
  description: string | null;
  status: boolean | null;
  cuisine_types: string[] | null;
  phone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  address_country: string | null;
  operating_hours: any | null;
  delivery_methods: string[] | null;
  payment_methods: string[] | null;
  average_delivery_time: number | null;
  minimum_order_value: number | null;
  delivery_fee: number | null;
  user_id: string;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  last_sync_at: string;
}

export const useIfoodMerchants = (userId?: string) => {
  return useQuery({
    queryKey: ['ifood-merchants', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      logger.debug('🔍 Buscando lojas sincronizadas para userId:', userId);

      const { data, error } = await supabase
        .from('ifood_merchants')
        .select(`
          merchant_id,
          name,
          corporate_name,
          status,
          phone,
          address_city,
          address_state,
          address_neighborhood,
          last_sync_at,
          client_id,
          clients:client_id (
            name
          )
        `)
        .eq('user_id', userId)
        .order('last_sync_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar lojas sincronizadas:', error);
        throw error;
      }

      logger.debug('✅ Lojas sincronizadas encontradas (antes da deduplicação):', data?.length || 0);

      // DEBUG: Log detalhado dos dados retornados para identificar "Marollo"
      if (data && data.length > 0) {
        console.log('🔍 [DEBUG MAROLLO] Dados completos retornados do Supabase:');
        data.forEach((merchant, index) => {
          console.log(`${index + 1}. merchant_id: ${merchant.merchant_id}, name: "${merchant.name}", client_id: ${merchant.client_id}`);
        });
      }

      // Deduplica por merchant_id, mantendo o registro mais recente
      const merchantsMap = new Map();
      (data || []).forEach((merchant: any) => {
        const existingMerchant = merchantsMap.get(merchant.merchant_id);
        if (!existingMerchant || new Date(merchant.last_sync_at) > new Date(existingMerchant.last_sync_at)) {
          merchantsMap.set(merchant.merchant_id, merchant);
        }
      });
      
      const deduplicatedData = Array.from(merchantsMap.values());
      logger.debug('✅ Lojas após deduplicação:', deduplicatedData.length);

      // DEBUG: Log dos dados finais após deduplicação
      if (deduplicatedData.length > 0) {
        console.log('🔍 [DEBUG MAROLLO] Dados finais após deduplicação:');
        deduplicatedData.forEach((merchant: any, index) => {
          console.log(`${index + 1}. merchant_id: ${merchant.merchant_id}, name: "${merchant.name}"`);
          if (merchant.name && merchant.name.toLowerCase().includes('marollo')) {
            console.log('🎯 [DEBUG MAROLLO] ENCONTRADO MAROLLO NOS DADOS:', merchant);
          }
        });
      }

      if (data && data.length > deduplicatedData.length) {
        logger.debug(`⚠️ Removidas ${data.length - deduplicatedData.length} duplicatas da interface`);
      }

      return deduplicatedData;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutos - mais dinâmico para monitoramento
    refetchOnWindowFocus: true, // Atualizar quando focar na janela
    refetchInterval: 30 * 1000, // Polling: atualizar a cada 30 segundos
  });
};

// Hook para buscar um merchant específico
export const useIfoodMerchant = (merchantId?: string) => {
  return useQuery<IfoodMerchantFromDB | null>({
    queryKey: ['ifood_merchant', merchantId],
    queryFn: async () => {
      if (!merchantId) return null;

      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('*')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar merchant:', error);
        throw error;
      }

      return data;
    },
    enabled: !!merchantId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}; 