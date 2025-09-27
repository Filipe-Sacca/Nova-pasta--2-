import { supabase } from '@/integrations/supabase/client';

// Tipos para a resposta da API do iFood
export interface IfoodMerchant {
  id: string;
  name: string;
  corporateName?: string;
  description?: string;
  status: boolean;
  cuisineTypes?: string[];
  phone?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  operatingHours?: any;
  deliveryMethods?: string[];
  paymentMethods?: string[];
  averageDeliveryTime?: number;
  minimumOrderValue?: number;
  deliveryFee?: number;
}

export interface IfoodMerchantsResponse {
  data: IfoodMerchant[];
  pagination?: {
    page: number;
    size: number;
    total: number;
  };
}

// Classe de serviço para gerenciar merchants do iFood
export class IfoodMerchantsService {
  private static readonly LOCAL_SERVICE_URL = 'http://localhost:8093';

  // Buscar token válido da tabela ifood_tokens
  static async getValidToken(userId?: string): Promise<{ token: string | null; error?: string }> {
    try {
      console.log('🔍 Buscando token para userId:', userId);
      
      let query = supabase
        .from('ifood_tokens')
        .select('access_token, expires_at, created_at, updated_at');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.single();

      console.log('📊 Resultado da query:', { data, error });

      if (error) {
        console.error('❌ Erro ao buscar token:', error);
        return { token: null, error: 'Erro ao buscar token no banco de dados: ' + error.message };
      }

      if (!data?.access_token) {
        console.error('❌ Token não encontrado na resposta:', data);
        return { token: null, error: 'Token não encontrado. Configure a integração com o iFood primeiro.' };
      }

      console.log('✅ Token encontrado, verificando expiração...');
      
      // Verificar se o token não expirou
      if (data.expires_at) {
        const now = new Date();
        let expiresAt: Date | null = null;
        
        try {
          if (typeof data.expires_at === 'number') {
            if (data.expires_at > 10000000000) {
              expiresAt = new Date(data.expires_at);
            } else if (data.expires_at > 1000000000) {
              expiresAt = new Date(data.expires_at * 1000);
            } else if (data.expires_at > 0 && data.expires_at < 86400) {
              const baseTime = data.updated_at ? new Date(data.updated_at) : new Date(data.created_at);
              expiresAt = new Date(baseTime.getTime() + (data.expires_at * 1000));
            }
          } else if (typeof data.expires_at === 'string') {
            expiresAt = new Date(data.expires_at);
          }

          if (!expiresAt || isNaN(expiresAt.getTime())) {
            console.warn('⚠️ Não foi possível interpretar expires_at, assumindo token válido');
            console.log('✅ Token considerado válido (fallback)');
            return { token: data.access_token };
          }

          if (now >= expiresAt) {
            console.error('❌ Token expirado');
            return { 
              token: null, 
              error: 'Token expirado. Faça login novamente no iFood para renovar o token.' 
            };
          }
          
          console.log('✅ Token válido, expira em:', Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60)), 'minutos');
          
        } catch (parseError) {
          console.warn('⚠️ Erro ao interpretar expires_at:', parseError);
          console.log('✅ Token considerado válido (erro no parse)');
          return { token: data.access_token };
        }
      } else {
        console.log('⚠️ expires_at não definido, assumindo token válido');
      }

      console.log('✅ Token válido encontrado');
      return { token: data.access_token };
    } catch (error) {
      console.error('❌ Erro ao buscar token:', error);
      return { token: null, error: 'Erro interno ao verificar token: ' + (error as Error).message };
    }
  }

  // Buscar merchants da API do iFood via serviço local
  static async fetchMerchants(userId?: string): Promise<{
    merchants: IfoodMerchant[];
    isExistingClient: boolean;
  }> {
    try {
      const tokenResult = await this.getValidToken(userId);
      if (!tokenResult.token) {
        throw new Error(tokenResult.error || 'Token de acesso não encontrado ou inválido');
      }

      console.log('🍔 Fazendo requisição via serviço local...');
      console.log('📡 Endpoint Local:', `${this.LOCAL_SERVICE_URL}/merchant`);
      console.log('🔑 Enviando token para serviço local...');
      
      // Enviar para o serviço local
      const response = await fetch(`${this.LOCAL_SERVICE_URL}/merchant`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: tokenResult.token,
          user_id: userId
        })
      });

      console.log('📊 Status da resposta do serviço local:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na requisição do serviço local:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        
        if (response.status === 401) {
          throw new Error('Token expirado ou inválido. Faça login novamente no iFood.');
        }
        
        throw new Error(`Erro na requisição do serviço local: ${response.status} - ${response.statusText}. Detalhes: ${errorText}`);
      }

      const result = await response.json();
      
      console.log('📋 Resposta completa do serviço local:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro no serviço local');
      }

      // Processar merchants da resposta do serviço local
      let merchants: IfoodMerchant[] = [];
      
      if (result.data && Array.isArray(result.data)) {
        merchants = result.data.map(merchant => ({
          id: merchant.id,
          name: merchant.name,
          corporateName: merchant.corporateName,
          status: true,
          description: merchant.description || undefined,
          cuisineTypes: merchant.cuisineTypes || undefined,
          phone: merchant.phone || undefined,
          address: merchant.address || undefined,
          operatingHours: merchant.operatingHours || undefined,
          deliveryMethods: merchant.deliveryMethods || undefined,
          paymentMethods: merchant.paymentMethods || undefined,
          averageDeliveryTime: merchant.averageDeliveryTime || undefined,
          minimumOrderValue: merchant.minimumOrderValue || undefined,
          deliveryFee: merchant.deliveryFee || undefined
        }));
      }
      
      console.log('✅ Merchants processados:', merchants.length);
      console.log('📋 Dados dos merchants após processamento:', merchants);

      return {
        merchants: merchants || [],
        isExistingClient: false
      };
    } catch (error) {
      console.error('❌ Erro ao buscar merchants via serviço local:', error);
      throw error;
    }
  }

  // Função para buscar merchants da tabela (GET apenas)
  static async getMerchantsFromDatabase(userId: string): Promise<IfoodMerchant[]> {
    try {
      console.log('📖 [GET ONLY] Buscando merchants da tabela para usuário:', userId);
      
      const { data: merchants, error } = await supabase
        .from('ifood_merchants')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      
      if (error) {
        console.error('❌ Erro ao buscar merchants da tabela:', error);
        throw error;
      }
      
      const count = merchants?.length || 0;
      console.log(`📊 [GET ONLY] ${count} merchants encontrados na tabela`);
      
      return merchants || [];
      
    } catch (error) {
      console.error('❌ Erro ao buscar merchants do banco:', error);
      throw error;
    }
  }

  // Função para limpar duplicatas manualmente
  static async manualCleanupDuplicates(userId: string): Promise<{
    success: boolean;
    duplicatesFound: number;
    duplicatesRemoved: number;
    error?: string;
  }> {
    try {
      console.log('🧹 [MANUAL CLEANUP] Iniciando limpeza manual de duplicatas...');
      
      // Buscar todos os merchants do usuário
      const { data: allMerchants, error: fetchError } = await supabase
        .from('ifood_merchants')
        .select('id, merchant_id, name')
        .eq('user_id', userId);
      
      if (fetchError) {
        console.error('❌ Erro ao buscar merchants:', fetchError);
        throw fetchError;
      }
      
      if (!allMerchants || allMerchants.length === 0) {
        console.log('📭 Nenhum merchant encontrado');
        return { success: true, duplicatesFound: 0, duplicatesRemoved: 0 };
      }
      
      // Agrupar por merchant_id para contar duplicatas
      const merchantGroups = new Map<string, any[]>();
      allMerchants.forEach(merchant => {
        if (!merchantGroups.has(merchant.merchant_id)) {
          merchantGroups.set(merchant.merchant_id, []);
        }
        merchantGroups.get(merchant.merchant_id)!.push(merchant);
      });
      
      let duplicatesFound = 0;
      const toDelete: string[] = [];
      
      for (const [merchantId, merchants] of merchantGroups) {
        if (merchants.length > 1) {
          duplicatesFound += merchants.length - 1;
          console.log(`🔍 [MANUAL CLEANUP] Merchant ${merchantId} (${merchants[0].name}) tem ${merchants.length} duplicatas`);
          
          // Manter o primeiro, deletar o resto
          toDelete.push(...merchants.slice(1).map(m => m.id));
        }
      }
      
      if (duplicatesFound === 0) {
        console.log('✅ [MANUAL CLEANUP] Nenhuma duplicata encontrada');
        return { success: true, duplicatesFound: 0, duplicatesRemoved: 0 };
      }
      
      console.log(`⚠️ [MANUAL CLEANUP] ${duplicatesFound} duplicatas encontradas, iniciando limpeza...`);
      
      // Deletar duplicatas
      let duplicatesRemoved = 0;
      
      if (toDelete.length > 0) {
        const batchSize = 50;
        
        for (let i = 0; i < toDelete.length; i += batchSize) {
          const batch = toDelete.slice(i, i + batchSize);
          console.log(`🔄 Deletando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(toDelete.length/batchSize)} (${batch.length} items)`);
          
          const { error: deleteError } = await supabase
            .from('ifood_merchants')
            .delete()
            .in('id', batch);
          
          if (deleteError) {
            console.error('❌ Erro ao deletar lote:', deleteError);
            throw deleteError;
          }
          
          duplicatesRemoved += batch.length;
        }
        
        console.log(`✅ ${duplicatesRemoved} duplicatas removidas com sucesso`);
      }
      
      return {
        success: true,
        duplicatesFound,
        duplicatesRemoved
      };
      
    } catch (error) {
      console.error('❌ Erro na limpeza manual:', error);
      return {
        success: false,
        duplicatesFound: 0,
        duplicatesRemoved: 0,
        error: error instanceof Error ? error.message : 'Erro desconhecido na limpeza manual'
      };
    }
  }
}

// Interface para notificações de mudança de status
export interface StatusChangeNotification {
  merchantId: string;
  merchantName: string;
  newStatus: boolean;
  previousStatus?: boolean;
  timestamp: string;
}