import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TokenData {
  user_id: string;
  client_id: string;
  client_secret: string;
  access_token: string;
  expires_at: string;
  created_at: string;
}

export const useIfoodTokens = () => {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 [useIfoodTokens] Iniciando busca de tokens no banco...');

      const { data, error: fetchError } = await supabase
        .from('ifood_tokens')
        .select('user_id, client_id, client_secret, access_token, expires_at, created_at, token_updated_at')
        .order('token_updated_at', { ascending: false });

      console.log('🔍 [useIfoodTokens] Resposta do Supabase:', {
        data,
        error: fetchError,
        dataLength: data?.length || 0
      });

      if (fetchError) {
        console.error('❌ [useIfoodTokens] Erro ao buscar tokens:', fetchError);
        throw fetchError;
      }

      // Filtrar apenas tokens válidos (não expirados)
      // expires_at é duração em segundos, não timestamp absoluto
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const validTokens = data?.filter(token => {
        const durationInSeconds = typeof token.expires_at === 'string'
          ? parseInt(token.expires_at)
          : token.expires_at;

        // Calcular timestamp real de expiração: token_updated_at + expires_at
        const tokenUpdatedAtTimestamp = Math.floor(new Date(token.token_updated_at).getTime() / 1000);
        const actualExpiresAtTimestamp = tokenUpdatedAtTimestamp + durationInSeconds;

        console.log(`🕐 [DEBUG] Token ${token.client_secret.substring(0, 10)}...`, {
          tokenUpdatedAt: new Date(token.token_updated_at).toISOString(),
          durationSeconds: durationInSeconds,
          actualExpiresAt: new Date(actualExpiresAtTimestamp * 1000).toISOString(),
          now: new Date(nowTimestamp * 1000).toISOString(),
          isValid: actualExpiresAtTimestamp > nowTimestamp
        });

        return actualExpiresAtTimestamp > nowTimestamp;
      }) || [];

      setTokens(validTokens);
      
      console.log('📊 Tokens válidos encontrados:', validTokens.length);
      validTokens.forEach((token, index) => {
        console.log(`${index + 1}. User ID: ${token.user_id} | Client ID: ${token.client_id}`);
      });

    } catch (err: any) {
      console.error('❌ Erro ao buscar tokens:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar token específico para um user_id
  const getTokenForUser = async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('ifood_tokens')
        .select('access_token, expires_at, client_secret')
        .eq('user_id', userId)
        .single();

      if (error || !data?.access_token) {
        console.error('❌ Token não encontrado para user_id:', userId);
        return null;
      }

      // Verificar se token está expirado (expires_at é timestamp Unix em segundos)
      const expiresAtTimestamp = typeof data.expires_at === 'string' 
        ? parseInt(data.expires_at) 
        : data.expires_at;
      const nowTimestamp = Math.floor(Date.now() / 1000);
      
      const isExpired = expiresAtTimestamp <= nowTimestamp;
      
      console.log(`🕐 Token expires at: ${expiresAtTimestamp}, now: ${nowTimestamp}, expired: ${isExpired}`);
      console.log(`📅 Token expiry date: ${new Date(expiresAtTimestamp * 1000).toISOString()}`);
      
      if (isExpired) {
        const expiryDate = new Date(expiresAtTimestamp * 1000);
        console.error('❌ Token expirado para client_secret:', data.client_secret);
        console.error(`📅 Token expirou em: ${expiryDate.toISOString()}`);
        console.error(`⏰ Tempo desde expiração: ${Math.floor((nowTimestamp - expiresAtTimestamp) / 60)} minutos`);
        return null;
      }

      return data.access_token;
    } catch (error) {
      console.error('❌ Erro ao buscar token específico:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  return {
    tokens,
    isLoading,
    error,
    refetch: fetchTokens,
    getTokenForUser
  };
};