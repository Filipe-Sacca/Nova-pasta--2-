import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

// Interface para verificação de integração
export interface IntegrationStatus {
  hasIfoodIntegration: boolean;
  ifoodToken?: {
    access_token: string;
    client_id: string;
    client_secret: string;
    expires_at: number;
    created_at: string;
    updated_at: string;
    user_id: string;
  } | null;
  ifoodMerchant?: {
    id: string;
    merchant_id: string;
    name: string;
    user_id: string;
  } | null;
  lastChecked: Date;
}

export const useIntegrationCheck = (userId?: string) => {
  return useQuery<IntegrationStatus>({
    queryKey: ['integration_check', userId],
    queryFn: async () => {
      if (!userId) {
        return {
          hasIfoodIntegration: false,
          ifoodToken: null,
          ifoodMerchant: null,
          lastChecked: new Date()
        };
      }

      try {
        logger.debug('🔍 Verificando integrações ativas para usuário:', userId);
        
        // Verificar integração do iFood
        const { data: ifoodData, error: ifoodError } = await supabase
          .from('ifood_tokens')
          .select('*, token_updated_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (ifoodError) {
          console.error('❌ Erro ao verificar integração iFood:', ifoodError);
        }

        // Buscar merchant do iFood se houver token
        let ifoodMerchantData = null;
        if (ifoodData?.access_token) {
          const { data: merchantData } = await supabase
            .from('ifood_merchants')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          
          ifoodMerchantData = merchantData;
          logger.debug('🏪 Merchant iFood encontrado:', merchantData);
        }

        const hasIfoodIntegration = !!ifoodData?.access_token;
        
        if (hasIfoodIntegration) {
          logger.debug('✅ Integração iFood encontrada para usuário:', userId);

          // Verificação simples de expiração usando a mesma lógica do useIfoodTokens
          if (ifoodData.expires_at && ifoodData.token_updated_at) {
            const nowTimestamp = Math.floor(Date.now() / 1000);
            const durationInSeconds = typeof ifoodData.expires_at === 'string'
              ? parseInt(ifoodData.expires_at)
              : ifoodData.expires_at;

            // Calcular timestamp real de expiração: token_updated_at + expires_at
            const tokenUpdatedAtTimestamp = Math.floor(new Date(ifoodData.token_updated_at).getTime() / 1000);
            const actualExpiresAtTimestamp = tokenUpdatedAtTimestamp + durationInSeconds;
            const isExpired = actualExpiresAtTimestamp <= nowTimestamp;

            logger.debug('⏰ [useIntegrationCheck] Verificação de expiração:', {
              tokenUpdatedAt: new Date(ifoodData.token_updated_at).toISOString(),
              durationSeconds: durationInSeconds,
              actualExpiresAt: new Date(actualExpiresAtTimestamp * 1000).toISOString(),
              now: new Date(nowTimestamp * 1000).toISOString(),
              isExpired: isExpired,
              hoursUntilExpiry: (actualExpiresAtTimestamp - nowTimestamp) / 3600
            });

            if (isExpired) {
              logger.debug('⚠️ [useIntegrationCheck] Token iFood expirado para client_secret:', ifoodData.client_secret);
            } else {
              const hoursLeft = Math.round((actualExpiresAtTimestamp - nowTimestamp) / 3600);
              logger.debug('✅ [useIntegrationCheck] Token válido, expira em:', hoursLeft, 'horas');
            }
          } else {
            logger.debug('⚠️ [useIntegrationCheck] expires_at ou token_updated_at não definido, assumindo token válido');
          }
        } else {
          logger.debug('❌ Nenhuma integração iFood encontrada para usuário:', userId);
        }

        return {
          hasIfoodIntegration,
          ifoodToken: ifoodData,
          ifoodMerchant: ifoodMerchantData,
          lastChecked: new Date()
        };
      } catch (error) {
        console.error('❌ Erro ao verificar integrações:', error);
        return {
          hasIfoodIntegration: false,
          ifoodToken: null,
          ifoodMerchant: null,
          lastChecked: new Date()
        };
      }
    },
    enabled: !!userId,
    refetchOnWindowFocus: true, // Revalidar quando focar na janela
    refetchInterval: 2 * 60 * 1000, // Atualizar a cada 2 minutos
    staleTime: 1 * 60 * 1000, // 1 minuto - mais dinâmico
  });
}; 