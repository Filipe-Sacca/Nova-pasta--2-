
import { useState, useEffect } from 'react';
import { useAuth } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import DynamicIntegrationStatus from './DynamicIntegrationStatus';
import ConnectedAPIsCard from './ConnectedAPIsCard';
import { useIfoodSyncStatus } from '@/hooks/useIfoodSyncStatus';
import { 
  Settings, 
  Key,
  Store, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Globe,
  Code,
  Database,
  Zap,
  ExternalLink
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useIfoodConfig } from '@/hooks/useIfoodConfig';
import { useIfoodMerchants } from '@/hooks/useIfoodMerchants';
import { syncMerchants, getMerchantDetail, syncAllMerchants } from '@/services/ifoodMerchantsService';


interface ApiConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  webhookUrl: string;
}

export const IfoodApiConfig = () => {
  const { user } = useAuth();
  const { data: syncedMerchantsData } = useIfoodMerchants(user?.id);
  const { refreshStatus: globalRefreshStatus } = useIfoodSyncStatus();
  const [config, setConfig] = useState<ApiConfig>({
    clientId: '',
    clientSecret: '',
    environment: 'sandbox',
    webhookUrl: ''
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Buscar credenciais do iFood para o usuário logado ao montar (usando user_id)
  useEffect(() => {
    if (user && user.id) {
      console.log('🔍 [DEBUG] Dados do usuário:', {
        id: user.id,
        email: user.email
      });
      console.log('Buscando token do usuário:', user.id);
      
                           import('@/integrations/supabase/client').then(({ supabase }) => {
         console.log('Buscando na tabela ifood_tokens para user_id:', user.id);
        
        // Primeiro, verificar se existe algum token na tabela (sem filtro de user_id)
        supabase
          .from('ifood_tokens')
          .select('user_id, access_token, client_id, expires_at')
          .then(({ data: allTokens, error: allError }) => {
            console.log('🔍 [DEBUG] Todos os tokens na tabela ifood_tokens:', allTokens);
            if (allError) {
              console.error('❌ [DEBUG] Erro ao buscar todos os tokens:', allError);
            }
          });
        
        // Agora buscar o token específico do usuário
         supabase
           .from('ifood_tokens')
           .select('*')
           .eq('user_id', user.id)
           .maybeSingle()
           .then(({ data, error }) => {
            console.log('📊 [DEBUG] Resultado da busca específica:');
            console.log('  - user_id buscado:', user.id);
            console.log('  - dados encontrados:', data);
            console.log('  - erro:', error);
            
             if (error) {
               console.error('Erro na consulta:', error);
             }
                         if (data) {
               console.log('Token encontrado:', {
                 hasAccessToken: !!data.access_token,
                 hasClientId: !!data.client_id,
                 hasClientSecret: !!data.client_secret,
                expiresAt: data.expires_at,
                tokenUserId: data.user_id,
                matchesCurrentUser: data.user_id === user.id
               });

               // Verificar se os dados não estão corrompidos com mensagens de erro
               const cleanClientId = String(data.client_id || '').trim();
               const cleanClientSecret = String(data.client_secret || '').trim();

               if (cleanClientId.includes('POST http://') || cleanClientSecret.includes('POST http://') ||
                   cleanClientId.includes('IfoodApiConfig.tsx') || cleanClientSecret.includes('IfoodApiConfig.tsx')) {
                 console.error('❌ [DEBUG] Dados corrompidos encontrados no banco, limpando...');

                 // Limpar dados corrompidos do banco
                 supabase
                   .from('ifood_tokens')
                   .delete()
                   .eq('user_id', user.id)
                   .then(() => {
                     console.log('✅ Dados corrompidos removidos do banco');
                   });

                 setIsConnected(false);
                 setConfig({
                   clientId: '',
                   clientSecret: '',
                   environment: 'sandbox',
                   webhookUrl: ''
                 });
               } else {
                 setConfig({
                   clientId: cleanClientId,
                   clientSecret: cleanClientSecret,
                   environment: 'sandbox',
                   webhookUrl: ''
                 });
                 setIsConnected(!!data.access_token && !!cleanClientId && !!cleanClientSecret);
               }
             } else {
              console.log('❌ [DEBUG] Nenhum token encontrado para o usuário:', user.id);
               setIsConnected(false);
             }
          });
      });
    } else {
      console.log('Usuário não está logado ou não possui id.');
    }
  }, [user]);

  const form = useForm<ApiConfig>({
    defaultValues: {
      clientId: '',
      clientSecret: ''
    }
  });

  const handleConnect = async (data: ApiConfig) => {
    setIsConnecting(true);
    try {
      // Garantir que os dados do formulário estão limpos e não são mensagens de erro
      const cleanClientId = String(data.clientId || '').trim();
      const cleanClientSecret = String(data.clientSecret || '').trim();

      // Validar se não são mensagens de erro mascaradas como credenciais
      if (cleanClientId.includes('POST http://') || cleanClientSecret.includes('POST http://') ||
          cleanClientId.includes('IfoodApiConfig.tsx') || cleanClientSecret.includes('IfoodApiConfig.tsx') ||
          cleanClientSecret.includes('SUPABASE_SERVICE_KEY') || cleanClientId.includes('SUPABASE_SERVICE_KEY')) {
        console.error('❌ [DEBUG] Dados corrompidos detectados, limpando estado...');

        // Limpar estado corrompido
        form.reset({ clientId: '', clientSecret: '' });
        setConfig({ clientId: '', clientSecret: '', environment: 'sandbox', webhookUrl: '' });

        toast({
          title: '⚠️ Dados corrompidos detectados',
          description: 'Por favor, insira suas credenciais novamente.',
          variant: 'destructive',
        });
        return;
      }

      if (!cleanClientId || !cleanClientSecret) {
        toast({
          title: '❌ Campos obrigatórios',
          description: 'Por favor, preencha Client ID e Client Secret.',
          variant: 'destructive',
        });
        return;
      }

      const payload = {
        clientId: cleanClientId,
        clientSecret: cleanClientSecret,
        user_id: user?.id // Envia o id do usuário logado
      };

      console.log('🚀 [DEBUG] Enviando dados limpos para serviço Node.js local:');
      console.log('  - user_id sendo enviado:', user?.id);
      console.log('  - clientId:', cleanClientId.substring(0, 8) + '...');
      console.log('  - clientSecret length:', cleanClientSecret.length);
      console.log('  - dados do usuário atual:', {
        id: user?.id,
        email: user?.email,
        aud: user?.aud
      });
      
      // Connect to local Node.js service only
      const response = await fetch('http://localhost:8085/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      console.log('✅ [DEBUG] Resposta do serviço Node.js local:', result);

      // Handle successful response
      if (response.ok && result.success) {
        const tokenData = result.data;
        setConfig({
          clientId: tokenData.client_id || payload.clientId,
          clientSecret: tokenData.client_secret || payload.clientSecret,
          environment: 'sandbox',
          webhookUrl: ''
        });
        setIsConnected(true);
        toast({
          title: '✅ Token gerado com sucesso!',
          description: `Token de acesso iFood criado e armazenado. Expira em ${Math.floor(tokenData.expires_in / 3600)} horas.`
        });

        // Atualizar status das integrações após token gerado
        setTimeout(() => {
          globalRefreshStatus();
        }, 1000);

        // Token salvo com sucesso - merchants serão sincronizados manualmente
      } else if (response.ok && result.message && result.message.includes('Valid token already exists')) {
        // Token já existe e é válido
        const tokenData = result.data;
        setConfig({
          clientId: tokenData.client_id || payload.clientId,
          clientSecret: tokenData.client_secret || payload.clientSecret,
          environment: 'sandbox',
          webhookUrl: ''
        });
        setIsConnected(true);
        toast({
          title: '✅ Token válido encontrado!',
          description: 'Token de acesso já existe e ainda é válido.'
        });

        // Atualizar status das integrações após confirmar token válido
        setTimeout(() => {
          globalRefreshStatus();
        }, 1000);

        // Sincronizar merchants automaticamente quando token válido é encontrado
        setTimeout(async () => {
          console.log('🔄 Auto-sincronizando merchants com token existente...');
          await handleSyncMerchants();
        }, 2000);
      } else {
        setIsConnected(false);
        const errorMessage = result.error || 'Erro ao gerar token de acesso';
        toast({
          title: 'Erro ao conectar',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch (error) {
      setIsConnected(false);
      console.error('❌ [DEBUG] Erro na conexão:', error);
      toast({
        title: 'Erro ao conectar',
        description: 'Erro ao conectar ao iFood. Verifique suas credenciais.',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) {
      toast({
        title: '❌ Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      });
      return;
    }

    try {
      console.log('🗑️ Excluindo token do usuário:', user.id);
      
      // Excluir token do banco de dados
      const { error } = await supabase
        .from('ifood_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Erro ao excluir token:', error);
        toast({
          title: '❌ Erro',
          description: 'Erro ao desconectar: ' + error.message,
          variant: 'destructive'
        });
        return;
      }

      console.log('✅ Token excluído com sucesso do banco de dados');

      // Limpar estado local
      setConfig({ clientId: '', clientSecret: '', environment: 'sandbox', webhookUrl: '' });
      setIsConnected(false);
      setShowDisconnectModal(false);

      toast({
        title: '✅ Desconectado',
        description: 'Token removido e desconectado com sucesso!',
      });

    } catch (error) {
      console.error('❌ Erro ao desconectar:', error);
      toast({
        title: '❌ Erro',
        description: 'Erro inesperado ao desconectar',
        variant: 'destructive'
      });
    }
  };

// Componente para carregamento de merchants
const MerchantsCard = ({ user }: { user: any }) => {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSyncMerchants = async () => {
    console.log('🚀 [handleSyncMerchants] Iniciando sincronização de lojas via serviço local...');
    console.log('🔍 [handleSyncMerchants] User:', { id: user?.id, email: user?.email });
    
    if (!user?.id) {
      console.error('❌ [handleSyncMerchants] Usuário não autenticado');
      toast({
        title: '❌ Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('📡 [handleSyncMerchants] Sincronizando lojas...');
      
      // Usar o serviço local diretamente
      const result = await syncMerchants(user.id);
      
      if (!result.success) {
        console.error('❌ [handleSyncMerchants] Erro na sincronização:', result.error);
        toast({
          title: '❌ Erro na sincronização',
          description: result.error || 'Erro desconhecido ao sincronizar lojas',
          variant: 'destructive'
        });
        return;
      }

      console.log('✅ [handleSyncMerchants] Sincronização concluída:', result);
      
      // Invalidar queries para atualizar as listas
      queryClient.invalidateQueries({ queryKey: ['ifood-merchants'] });
      
      // Verificar o tipo de resultado
      const totalMerchants = result.total_merchants || 0;
      const newMerchants = result.new_merchants?.length || 0;
      const existingMerchants = result.existing_merchants?.length || 0;
      
      if (totalMerchants === 0) {
        toast({
          title: '📭 Nenhuma loja encontrada',
          description: 'Nenhuma loja foi encontrada na sua conta do iFood.'
        });
      } else if (newMerchants > 0) {
        toast({
          title: '✅ Novas lojas sincronizadas!',
          description: `${newMerchants} novas lojas adicionadas. Total: ${totalMerchants} lojas.`
        });
        
        // Atualizar status das integrações após sincronizar merchants
        setTimeout(() => {
          globalRefreshStatus();
        }, 1000);
      } else {
        toast({
          title: '✅ Lojas já sincronizadas',
          description: `Todas as ${existingMerchants} lojas já estavam sincronizadas.`
        });
        
        // Atualizar status das integrações para confirmar merchants
        setTimeout(() => {
          globalRefreshStatus();
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ [handleSyncMerchants] Erro:', error);
      toast({
        title: '❌ Erro',
        description: error instanceof Error ? error.message : 'Erro ao sincronizar lojas',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Lojas iFood
              </p>
              <p className="text-sm text-muted-foreground">
                Sincronizar lojas via serviço local
              </p>
            </div>
          </div>
          <Button 
            onClick={handleSyncMerchants}
            disabled={isLoading}
            className="ml-12 flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Carregando...' : 'Carregar Lojas'}</span>
          </Button>
        </div>
        
        {/* Removed client selection */}

        {/* Removed client specific message */}
      </CardContent>
    </Card>
  );
};

// Componente para sincronização individual de merchant
const IndividualMerchantSync = ({ user }: { user: any }) => {
  const [merchantId, setMerchantId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [merchantDetail, setMerchantDetail] = useState<any>(null);

  const handleSyncIndividual = async () => {
    if (!user?.id) {
      toast({
        title: '❌ Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      });
      return;
    }

    if (!merchantId.trim()) {
      toast({
        title: '❌ Campo obrigatório',
        description: 'Por favor, insira um Merchant ID válido',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setMerchantDetail(null);

    try {
      console.log(`🔍 Fetching individual merchant: ${merchantId}`);
      
      const result = await getMerchantDetail(merchantId.trim(), user.id);
      
      if (result.success && result.merchant) {
        setMerchantDetail({...result.merchant, action: result.action});
        
        if (result.action === 'found_in_db') {
          toast({
            title: '📦 Loja já existe!',
            description: `A loja "${result.merchant.name}" já está sincronizada no banco de dados.`
          });
        } else if (result.action === 'added_from_api') {
          toast({
            title: '✅ Nova loja adicionada!',
            description: `Loja "${result.merchant.name}" encontrada na API iFood e salva no banco de dados.`
          });
        } else {
          toast({
            title: '✅ Loja encontrada!',
            description: `Detalhes da loja "${result.merchant.name}" carregados com sucesso.`
          });
        }
      } else {
        setMerchantDetail(null);
        toast({
          title: '❌ Erro ao buscar loja',
          description: result.error || 'Não foi possível encontrar a loja com este ID.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('❌ Error fetching individual merchant:', error);
      setMerchantDetail(null);
      toast({
        title: '❌ Erro',
        description: error.message || 'Erro ao buscar detalhes da loja',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setMerchantId('');
    setMerchantDetail(null);
  };

  if (!user?.id) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Store className="h-5 w-5 text-blue-600" />
          </div>
          <span>Sincronizar Loja Individual</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-3">
            <div className="flex-1">
              <Label htmlFor="merchantId" className="text-sm font-medium text-foreground">
                Merchant ID
              </Label>
              <Input
                id="merchantId"
                placeholder="Ex: 12345678-abcd-1234-efgh-123456789012"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className="mt-1"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Insira o ID específico da loja que deseja sincronizar
              </p>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleSyncIndividual}
              disabled={isLoading || !merchantId.trim()}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Buscando...' : 'Buscar Detalhes'}</span>
            </Button>
            
            {(merchantId || merchantDetail) && (
              <Button
                variant="outline"
                onClick={clearSearch}
                disabled={isLoading}
                className="flex items-center space-x-2"
              >
                <XCircle className="h-4 w-4" />
                <span>Limpar</span>
              </Button>
            )}
          </div>

          {/* Display merchant details if found */}
          {merchantDetail && (
            <div className="mt-4 p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">
                      {merchantDetail.name}
                    </h4>
                  </div>
                  
                  {merchantDetail.corporateName && merchantDetail.corporateName !== merchantDetail.name && (
                    <p className="text-sm text-green-700 mb-2">
                      <strong>Razão Social:</strong> {merchantDetail.corporateName}
                    </p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-green-800">ID:</span>
                      <code className="ml-2 bg-green-100 px-2 py-1 rounded text-xs text-green-800">
                        {merchantDetail.id}
                      </code>
                    </div>
                    
                    {merchantDetail.phone && (
                      <div>
                        <span className="font-medium text-green-800">Telefone:</span>
                        <span className="ml-2 text-green-700">{merchantDetail.phone}</span>
                      </div>
                    )}
                    
                    {merchantDetail.address && (
                      <div className="md:col-span-2">
                        <span className="font-medium text-green-800">Endereço:</span>
                        <span className="ml-2 text-green-700">
                          {typeof merchantDetail.address === 'string' 
                            ? merchantDetail.address 
                            : `${merchantDetail.address.street || ''} ${merchantDetail.address.city || ''} ${merchantDetail.address.state || ''}`.trim()
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 text-xs text-green-600">
                    <span>
                      {merchantDetail.action === 'found_in_db' 
                        ? '📦 Loja já existia no banco de dados (nenhuma ação necessária)'
                        : '✅ Nova loja adicionada da API iFood e salva no banco de dados'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Componente para exibir lojas sincronizadas
const SyncedMerchantsCard = ({ user }: { user: any }) => {
  const { data: syncedMerchants, isLoading, error, refetch } = useIfoodMerchants(user?.id);
  const [isUpdating, setIsUpdating] = useState(false);
  const { data: ifoodConfig, refetch: refetchConfig } = useIfoodConfig(user?.id);
  const queryClient = useQueryClient();

  if (!user?.id) {
    return null;
  }

  const handleUpdateMerchants = async () => {
    if (!user?.id) {
      toast({
        title: '❌ Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      });
      return;
    }

    setIsUpdating(true);
    try {
      console.log('🔄 [handleUpdateMerchants] Atualizando lista de lojas...');
      console.log('👤 Usuário:', user.id);
      
      // Apenas atualizar a lista buscando dados existentes
      queryClient.invalidateQueries({ queryKey: ['ifood-merchants'] });
      await refetch(); // Força um refetch da lista atual
      
      // Buscar contagem atual para feedback
      const { data: currentMerchants } = await supabase
        .from('ifood_merchants')
        .select('merchant_id')
        .eq('user_id', user.id);
      
      const count = currentMerchants?.length || 0;
      
      console.log('✅ [handleUpdateMerchants] Lista atualizada:', count, 'lojas');
        
        toast({
        title: '✅ Lista Atualizada!',
        description: `${count} lojas carregadas do banco de dados`
      });
      
    } catch (error) {
      console.error('❌ [handleUpdateMerchants] Erro:', error);
      toast({
        title: '❌ Erro',
        description: error instanceof Error ? error.message : 'Erro ao atualizar lista',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSyncAllMerchants = async () => {
    if (!user?.id) {
      toast({
        title: '❌ Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      });
      return;
    }

    setIsUpdating(true);
    try {
      console.log('🔄 [handleSyncAllMerchants] Sincronizando todas as lojas existentes...');
      console.log('👤 Usuário:', user.id);
      
      // Usar a nova funcionalidade de sincronização em massa
      const result = await syncAllMerchants(user.id);
      
      if (result.success) {
        // Invalidar queries para forçar atualização da UI
        queryClient.invalidateQueries({ queryKey: ['ifood-merchants'] });
        await refetch(); // Força um refetch da lista atual
        
        const successCount = result.updated_merchants.length;
        const failureCount = result.failed_merchants.length;
        const totalProcessed = result.total_processed;
        
        if (totalProcessed === 0) {
          toast({
            title: '📭 Nenhuma loja encontrada',
            description: 'Nenhuma loja foi encontrada para sincronizar.'
          });
        } else if (successCount > 0 || failureCount > 0) {
          toast({
            title: '✅ Sincronização Completa!',
            description: `${totalProcessed} lojas processadas: ${successCount} atualizadas, ${failureCount} falharam`
          });
        } else {
          toast({
            title: '✅ Todas as lojas atualizadas',
            description: `${totalProcessed} lojas verificadas - todas já estavam atualizadas`
          });
        }
        
        // Atualizar status das integrações após sincronização
        setTimeout(() => {
          globalRefreshStatus();
        }, 1000);
      } else {
        throw new Error(result.error || 'Erro na sincronização em massa');
      }
      
    } catch (error) {
      console.error('❌ [handleSyncAllMerchants] Erro:', error);
      toast({
        title: '❌ Erro na Sincronização',
        description: error instanceof Error ? error.message : 'Erro ao sincronizar lojas',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Store className="h-5 w-5 text-green-600" />
            <span>Lojas Sincronizadas</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAllMerchants}
              disabled={isLoading || isUpdating}
              className="flex items-center space-x-1"
            >
              <RefreshCw className={`h-3 w-3 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Sincronizando...' : 'Recarregar'}</span>
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-muted-foreground">Carregando lojas...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <span className="ml-2 text-red-600">Erro ao carregar lojas sincronizadas</span>
          </div>
        )}

        {!isLoading && !error && (!syncedMerchants || syncedMerchants.length === 0) && (
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Store className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-muted-foreground mb-2">Nenhuma loja encontrada</p>
              <p className="text-sm text-muted-foreground">
                Clique em "Carregar Lojas" acima para sincronizar suas lojas do iFood via serviço local e visualizá-las aqui.
              </p>
            </div>
          </CardContent>
        )}

        {!isLoading && !error && syncedMerchants && syncedMerchants.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                <strong>{syncedMerchants.length}</strong> {syncedMerchants.length === 1 ? 'loja encontrada' : 'lojas encontradas'}
              </p>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Sincronizado
              </Badge>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {syncedMerchants.map((merchant: any) => (
                <div
                  key={merchant.merchant_id}
                  className="flex items-start justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-foreground text-sm">
                        {merchant.name}
                      </h4>
                      
                      <Badge 
                        variant="outline" 
                        className={
                          merchant.status === 'AVAILABLE' || merchant.status === true
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }
                      >
                        {merchant.status === 'AVAILABLE' || merchant.status === true ? 'Disponível' : 'Status desconhecido'}
                      </Badge>
                    </div>

                    {merchant.corporate_name && merchant.corporate_name !== merchant.name && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {merchant.corporate_name}
                      </p>
                    )}

                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      {merchant.address_city && merchant.address_state && (
                        <span className="flex items-center space-x-1">
                          <Globe className="h-3 w-3" />
                          <span>{merchant.address_city}, {merchant.address_state}</span>
                        </span>
                      )}
                      
                      {merchant.phone && (
                        <span className="flex items-center space-x-1">
                          <span>📞</span>
                          <span>{merchant.phone}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="text-xs text-muted-foreground">
                        <span>ID: </span>
                        <code className="bg-gray-100 px-1 rounded text-xs text-gray-800">
                          {merchant.merchant_id.slice(0, 8)}...
                        </code>
                      </div>

                      {merchant.last_sync_at && (
                        <div className="text-xs text-muted-foreground">
                          Sincronizado: {new Date(merchant.last_sync_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>

                    {merchant.clients && (
                      <div className="mt-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          Cliente: {merchant.clients.name}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

  const apiEndpoints = [
    {
      name: 'Authentication',
      description: 'Autenticação OAuth2 com iFood',
      status: isConnected ? 'connected' : 'disconnected',
      endpoint: 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token'
    },
    {
      name: 'Merchant API',
      description: 'Dados dos restaurantes e configurações',
      status: isConnected ? 'connected' : 'disconnected',
      endpoint: 'https://merchant-api.ifood.com.br/merchant/v1.0/'
    },
    {
      name: 'Orders API',
      description: 'Gestão de pedidos em tempo real',
      status: isConnected ? 'connected' : 'disconnected',
      endpoint: 'https://merchant-api.ifood.com.br/order/v1.0/'
    },
    {
      name: 'Catalog API',
      description: 'Gestão do catálogo de produtos',
      status: isConnected ? 'connected' : 'disconnected',
      endpoint: 'https://merchant-api.ifood.com.br/catalog/v1.0/'
    },
    {
      name: 'Financial API',
      description: 'Dados financeiros e faturamento',
      status: isConnected ? 'connected' : 'disconnected',
      endpoint: 'https://merchant-api.ifood.com.br/financial/v1.0/'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Configuração API iFood
        </h1>
        <p className="text-muted-foreground">
          Configure suas credenciais de desenvolvedor para integração com o iFood
        </p>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isConnected ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      Status da Conexão
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isConnected ? 'Conectado ao iFood API' : 'Desconectado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {isConnected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                  <button
                    className="ml-2 p-2 rounded-full hover:bg-gray-200 transition"
                    onClick={() => setShowDisconnectModal(true)}
                    title="Configurações da integração"
                  >
                    <Settings className="h-5 w-5 text-gray-700" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isConnected && (
            <div className="space-y-6 mt-6">
              <ConnectedAPIsCard />

              <div className="w-full">
                {syncedMerchantsData && syncedMerchantsData.length > 0 ? (
                  <SyncedMerchantsCard user={user} />
                ) : (
                  <MerchantsCard user={user} />
                )}
              </div>

              {/* Individual Merchant Sync - NEW FUNCTIONALITY */}
              <div className="w-full">
                <IndividualMerchantSync user={user} />
              </div>
              
              <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4">Status das Integrações</h2>
                <DynamicIntegrationStatus />
              </div>
            </div>
          )}

          <Dialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Desconectar integração do iFood?</DialogTitle>
              </DialogHeader>
              <p>Tem certeza que deseja desconectar? Você precisará inserir as credenciais novamente para reconectar.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDisconnectModal(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Key className="h-5 w-5" />
                  <span>Credenciais de API</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild
                  className="text-xs"
                >
                  <a 
                    href="https://developer.ifood.com.br/pt-BR/docs/guides/authentication/centralized" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Abrir Portal</span>
                  </a>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleConnect)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Seu Client ID do iFood Developer" {...field} />
                        </FormControl>
                        <FormDescription>
                          Client ID fornecido no portal do iFood Developer
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Seu Client Secret" {...field} />
                        </FormControl>
                        <FormDescription>
                          Client Secret fornecido no portal do iFood Developer
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isConnecting}>
                    {isConnecting ? (
                      <>
                        <Zap className="h-4 w-4 mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        {isConnected ? 'Atualizar Conexão' : 'Conectar ao iFood'}
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Endpoints da API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiEndpoints.map((endpoint, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        endpoint.status === 'connected' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Database className={`h-5 w-5 ${
                          endpoint.status === 'connected' ? 'text-green-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{endpoint.name}</h3>
                        <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{endpoint.endpoint}</p>
                      </div>
                    </div>
                    <Badge className={
                      endpoint.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }>
                      {endpoint.status === 'connected' ? 'Conectado' : 'Aguardando'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Code className="h-5 w-5" />
                <span>Recursos para Desenvolvedores</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-foreground mb-2">Portal do Desenvolvedor</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Acesse o portal oficial do iFood para desenvolvedores
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Portal
                  </Button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-foreground mb-2">Documentação da API</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Documentação completa da API do iFood
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Documentação
                  </Button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-foreground mb-2">Ambiente Sandbox</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Teste suas integrações em ambiente seguro
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Acessar Sandbox
                  </Button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-foreground mb-2">Suporte Técnico</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Canal de suporte para desenvolvedores
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Contatar Suporte
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Para implementar a integração completa com a API do iFood, 
              você precisará configurar funções serverless usando Supabase Edge Functions. 
              Isso garantirá que suas credenciais permaneçam seguras e que você possa processar 
              webhooks e fazer chamadas autenticadas para a API.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

    </div>
  );
};
