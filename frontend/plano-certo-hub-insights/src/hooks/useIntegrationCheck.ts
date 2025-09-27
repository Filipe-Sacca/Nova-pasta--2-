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
          .select('*')
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
          
          // Verificação robusta de expiração
          if (ifoodData.expires_at) {
            const now = new Date();
            let expiresAt: Date | null = null;
            
            logger.debug('🔍 [useIntegrationCheck] Verificando expiração do token:', {
              rawExpiresAt: ifoodData.expires_at,
              type: typeof ifoodData.expires_at,
              currentTime: now.toISOString()
            });

            try {
              if (typeof ifoodData.expires_at === 'number') {
                // Se é número, tentar diferentes interpretações
                if (ifoodData.expires_at > 10000000000) {
                  // Timestamp em milissegundos
                  expiresAt = new Date(ifoodData.expires_at);
                  logger.debug('📅 [useIntegrationCheck] Interpretado como timestamp em milissegundos');
                } else if (ifoodData.expires_at > 1000000000) {
                  // Timestamp em segundos
                  expiresAt = new Date(ifoodData.expires_at * 1000);
                  logger.debug('📅 [useIntegrationCheck] Interpretado como timestamp em segundos');
                } else if (ifoodData.expires_at > 0 && ifoodData.expires_at < 86400) {
                  // Duração em segundos (menos de 24h), usar updated_at como base
                  const baseTime = ifoodData.updated_at ? new Date(ifoodData.updated_at) : new Date(ifoodData.created_at);
                  expiresAt = new Date(baseTime.getTime() + (ifoodData.expires_at * 1000));
                  logger.debug('📅 [useIntegrationCheck] Interpretado como duração em segundos desde', baseTime);
                }
              } else if (typeof ifoodData.expires_at === 'string') {
                // Se é string, tentar parse direto
                expiresAt = new Date(ifoodData.expires_at);
                logger.debug('📅 [useIntegrationCheck] Interpretado como string de data');
              }

              // Verificar se conseguimos uma data válida
              if (!expiresAt || isNaN(expiresAt.getTime())) {
                logger.debug('⚠️ [useIntegrationCheck] Não foi possível interpretar expires_at, assumindo token válido');
              } else {
                const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
                
                logger.debug('⏰ [useIntegrationCheck] Verificação final:', {
                  now: now.toISOString(),
                  expiresAt: expiresAt.toISOString(),
                  hoursUntilExpiry: hoursUntilExpiry,
                  isExpired: hoursUntilExpiry <= 0
                });

                // Só considerar expirado se realmente passou do tempo
                if (hoursUntilExpiry <= 0) {
                  logger.debug('⚠️ [useIntegrationCheck] Token iFood expirado para client_secret:', ifoodData.client_secret);
                } else {
                  logger.debug('✅ [useIntegrationCheck] Token válido, expira em:', Math.round(hoursUntilExpiry), 'horas');
                }
              }
            } catch (parseError) {
              logger.debug('⚠️ [useIntegrationCheck] Erro ao interpretar expires_at:', parseError);
            }
          } else {
            logger.debug('⚠️ [useIntegrationCheck] expires_at não definido, assumindo token válido');
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