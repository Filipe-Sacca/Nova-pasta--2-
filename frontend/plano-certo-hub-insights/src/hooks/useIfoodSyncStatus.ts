import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/App';

export interface IfoodSyncStatus {
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'partial';
  lastSync?: string;
  count?: number;
}

export interface PeakHours {
  lunchHours: number;    // Horas de almoço (11h-15h)
  dinnerHours: number;   // Horas de janta (18h-23h)
}

export const useIfoodSyncStatus = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<IfoodSyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [peakHours, setPeakHours] = useState<PeakHours>({
    lunchHours: 0,
    dinnerHours: 0
  });

  console.log('🔍 [HOOK STATE] peakHours atual:', peakHours);

  const calculatePeakHours = async () => {
    console.log('🍽️ [PEAK HOURS START] Função chamada, user?.id:', user?.id);
    
    if (!user?.id) {
      console.log('❌ [PEAK HOURS] Sem user ID, definindo valores padrão');
      setPeakHours({ lunchHours: 28, dinnerHours: 35 });
      return;
    }

    console.log('✅ [PEAK HOURS] User ID encontrado, prosseguindo...');
    
    try {
      console.log('🍽️ [PEAK HOURS] Calculando horas de pico...');
      
      console.log('🔍 [DB QUERY] Buscando merchants para user_id:', user.id);
      
      // Buscar horários de funcionamento dos merchants
      const { data: merchantsData, error: merchantsError } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, operating_hours')
        .eq('user_id', user.id);

      console.log('📊 [MERCHANTS DATA]', merchantsData);
      console.log('❌ [MERCHANTS ERROR]', merchantsError);

      let totalLunchHours = 0;
      let totalDinnerHours = 0;

      if (!merchantsData || merchantsData.length === 0) {
        console.log('⚠️ [PEAK HOURS] Nenhum merchant encontrado para user_id:', user.id);
        console.log('🔍 [DEBUG] Vamos verificar se existem merchants no banco sem user_id...');
        
        // Tentar buscar sem filtro de user_id para debug
        const { data: allMerchants } = await supabase
          .from('ifood_merchants')
          .select('merchant_id, user_id, operating_hours');
          
        console.log('🔍 [ALL MERCHANTS DEBUG]', allMerchants);
        
        totalLunchHours = 28; // Fallback
        totalDinnerHours = 35; // Fallback
      } else {
        console.log('✅ [MERCHANTS FOUND] Processando', merchantsData.length, 'merchants');
        
        // Calcular baseado nos horários reais
        merchantsData.forEach(merchant => {
          if (merchant.operating_hours && merchant.operating_hours.shifts) {
            console.log('📅 [PROCESSING] Merchant:', merchant.merchant_id);
            console.log('🕒 [SHIFTS]', merchant.operating_hours.shifts);
            
            merchant.operating_hours.shifts.forEach((shift: any) => {
              const from = parseTime(shift.start);
              const durationHours = shift.duration / 60;
              const to = from + durationHours;
              
              // Calcular overlap com horário de almoço (11h-15h)
              const lunchStart = 11;
              const lunchEnd = 15;
              if (from < lunchEnd && to > lunchStart) {
                const overlap = Math.min(lunchEnd, to) - Math.max(lunchStart, from);
                totalLunchHours += Math.max(0, overlap);
                console.log(`🍽️ [LUNCH] ${shift.dayOfWeek}: +${overlap}h`);
              }
              
              // Calcular overlap com horário de janta (18h-23h)
              const dinnerStart = 18;
              const dinnerEnd = 23;
              if (from < dinnerEnd && to > dinnerStart) {
                const overlap = Math.min(dinnerEnd, to) - Math.max(dinnerStart, from);
                totalDinnerHours += Math.max(0, overlap);
                console.log(`🌙 [DINNER] ${shift.dayOfWeek}: +${overlap}h`);
              }
            });
          } else {
            console.log('⚠️ [NO HOURS] Merchant sem operating_hours:', merchant.merchant_id);
          }
        });
      }

      console.log(`📊 [PEAK HOURS RESULT] Almoço: ${totalLunchHours}h, Janta: ${totalDinnerHours}h`);
      
      setPeakHours({
        lunchHours: Math.round(totalLunchHours),
        dinnerHours: Math.round(totalDinnerHours)
      });

    } catch (error) {
      console.error('❌ [PEAK HOURS] Erro ao calcular horas de pico:', error);
      setPeakHours({ lunchHours: 28, dinnerHours: 35 });
    }
  };

  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
  };

  const checkSyncStatus = async () => {
    console.log('🔍 [SYNC STATUS] Verificando status de sincronização...');
    console.log('👤 [SYNC STATUS] User ID:', user?.id);
    
    if (!user?.id) {
      console.log('⚠️ [SYNC STATUS] Usuário não autenticado, limpando status');
      setStatus([]);
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 [SYNC STATUS] Iniciando verificação de status...');
      setLoading(true);

      console.log('🔍 [STEP 1] Verificando token de acesso...');
      // 1. Verificar se há token de acesso (Authentication)
      const { data: tokenData, error: tokenError } = await supabase
        .from('ifood_tokens')
        .select('access_token, created_at, token_updated_at')
        .eq('user_id', user.id)
        .single();
        
      console.log('📊 [TOKEN CHECK] Token encontrado:', !!tokenData);
      console.log('❌ [TOKEN CHECK] Erro token:', tokenError?.message || 'Nenhum');


      console.log('🔍 [STEP 2] Verificando merchants sincronizados...');
      // 2. Verificar se há merchants sincronizados (Merchant API)
      const { data: merchantsData, error: merchantsError } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, last_sync_at, updated_at')
        .eq('user_id', user.id);
        
      console.log('🏪 [MERCHANT CHECK] Merchants encontrados:', merchantsData?.length || 0);
      console.log('❌ [MERCHANT CHECK] Erro merchants:', merchantsError?.message || 'Nenhum');

      console.log('🔍 [STEP 3] Verificando produtos sincronizados...');
      // 3. Verificar se há produtos sincronizados (Catalog API)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, updated_at')
        .in('merchant_id', merchantsData?.map(m => m.merchant_id) || []);
        
      console.log('📦 [PRODUCT CHECK] Produtos encontrados:', productsData?.length || 0);
      console.log('❌ [PRODUCT CHECK] Erro produtos:', productsError?.message || 'Nenhum');

      const syncStatus: IfoodSyncStatus[] = [
        {
          name: 'Merchant API',
          description: 'Dados dos restaurantes e configurações',
          status: (merchantsData && merchantsData.length > 0 && !merchantsError) ? 'connected' : 'disconnected',
          lastSync: merchantsData?.[0]?.last_sync_at ?
            formatLastSync(merchantsData[0].last_sync_at) :
            merchantsData?.[0]?.updated_at ? formatLastSync(merchantsData[0].updated_at) : undefined,
          count: merchantsData?.length || 0
        },
        {
          name: 'Catalog API',
          description: 'Gestão do catálogo de produtos',
          status: (productsData && productsData.length > 0 && !productsError) ? 'connected' : 'disconnected',
          lastSync: productsData?.[0]?.updated_at ?
            formatLastSync(productsData[0].updated_at) : undefined,
          count: productsData?.length || 0
        }
      ];

      setStatus(syncStatus);
      
      // Calcular horas de pico de almoço e janta
      await calculatePeakHours();
    } catch (error) {
      console.error('Erro ao verificar status de sincronização:', error);
      setStatus([]);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSync = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Agora mesmo';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minuto${diffInMinutes !== 1 ? 's' : ''} atrás`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hora${hours !== 1 ? 's' : ''} atrás`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} dia${days !== 1 ? 's' : ''} atrás`;
    }
  };

  useEffect(() => {
    checkSyncStatus();
  }, [user?.id]);

  return {
    status,
    loading,
    peakHours,
    refreshStatus: checkSyncStatus
  };
};