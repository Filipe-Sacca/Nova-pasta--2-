import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Package, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/App';
import { useIfoodSyncStatus } from '@/hooks/useIfoodSyncStatus';

interface DynamicIntegrationStatusProps {
  onTokenGenerated?: () => void;
}

const DynamicIntegrationStatus = ({ onTokenGenerated }: DynamicIntegrationStatusProps) => {
  console.log('🚀 [DYNAMIC INTEGRATION] Componente renderizado!');
  
  const { user } = useAuth();
  const { status, loading, peakHours, refreshStatus } = useIfoodSyncStatus();
  const { toast } = useToast();
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);

  console.log('🎯 [COMPONENT] peakHours recebido:', peakHours);
  console.log('🎯 [COMPONENT] user:', user);
  console.log('🎯 [COMPONENT] loading:', loading);

  const handleSyncProducts = async () => {
    console.log('🚀 [SYNC START] Função handleSyncProducts chamada');
    console.log('👤 [AUTH CHECK] User object:', user);
    console.log('🆔 [AUTH CHECK] User ID:', user?.id);
    
    if (!user?.id) {
      console.error('❌ [AUTH ERROR] Usuário não autenticado');
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return;
    }

    console.log('✅ [AUTH OK] Usuário autenticado, iniciando sincronização');
    setIsSyncingProducts(true);
    
    try {
      console.log('🛍️ [STEP 1] Iniciando sincronização de produtos...');
      console.log('🔗 [API CALL] URL: http://localhost:3001/products');
      console.log('📤 [REQUEST] Payload:', { user_id: 'c1488646-aca8-4220-aacc-00e7ae3d6490' });

      const response = await fetch('http://localhost:8092/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 'c1488646-aca8-4220-aacc-00e7ae3d6490' // Temporary: using existing token user_id
        })
      });

      console.log('📥 [RESPONSE] Status:', response.status);
      console.log('📥 [RESPONSE] Headers:', Object.fromEntries(response.headers.entries()));
      
      const result = await response.json();
      console.log('📊 [RESULT] Response data:', result);
      
      if (result.success) {
        console.log('✅ [SUCCESS] Sincronização concluída com sucesso!');
        console.log('📊 [METRICS] Produtos sincronizados:', result.total_products || 0);
        console.log('🆕 [METRICS] Novos produtos:', result.new_products || 0);
        console.log('🔄 [METRICS] Produtos atualizados:', result.updated_products || 0);
        
        toast({
          title: '✅ Produtos sincronizados!',
          description: `${result.total_products || 0} produtos sincronizados. ${result.new_products || 0} novos, ${result.updated_products || 0} atualizados.`,
        });
        
        console.log('🔄 [STATUS REFRESH] Agendando refresh do status em 1 segundo...');
        // Atualizar status das integrações
        setTimeout(() => {
          console.log('🔄 [STATUS REFRESH] Executando refreshStatus...');
          refreshStatus();
        }, 1000);
      } else {
        console.error('❌ [API ERROR] Resposta de erro da API:', result);
        console.error('❌ [API ERROR] Mensagem:', result.error);
        throw new Error(result.error || 'Erro na sincronização');
      }
      
    } catch (error: any) {
      console.error('❌ [CATCH ERROR] Erro capturado na sincronização:', error);
      console.error('❌ [CATCH ERROR] Stack trace:', error.stack);
      console.error('❌ [CATCH ERROR] Error name:', error.name);
      console.error('❌ [CATCH ERROR] Error message:', error.message);
      
      toast({
        title: 'Erro na sincronização',
        description: error.message || 'Erro ao sincronizar produtos do iFood',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingProducts(false);
    }
  };

  const getStatusIcon = (apiStatus: string) => {
    switch (apiStatus) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'partial':
        return <CheckCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (apiStatus: string) => {
    switch (apiStatus) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">Conectado</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600">Desconectado</Badge>;
    }
  };

  const getStatusColor = (apiStatus: string) => {
    switch (apiStatus) {
      case 'connected':
        return 'bg-green-100';
      case 'partial':
        return 'bg-yellow-100';
      default:
        return 'bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-white">Verificando status das integrações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com botão de atualizar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-white">
            Status atualizado automaticamente baseado em dados reais
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={refreshStatus}
          disabled={loading}
          className="flex items-center space-x-1"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="text-white">Atualizar Status</span>
        </Button>
      </div>

      {/* Card de Horas de Pico */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">Horas de Pico Semanais</h3>
              <p className="text-sm text-white opacity-75">
                {peakHours.lunchHours > 0 || peakHours.dinnerHours > 0 
                  ? "Baseado nos horários de funcionamento configurados" 
                  : "Calculando baseado em horário padrão..."}
              </p>
            </div>
            <div className="flex space-x-6">
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {peakHours.lunchHours}h
                </div>
                <div className="text-xs text-white opacity-75">
                  Almoço (11h-15h)
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {peakHours.dinnerHours}h
                </div>
                <div className="text-xs text-white opacity-75">
                  Janta (18h-23h)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {status.map((api) => (
        <Card key={api.name}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-4">
              <div className={`p-2 ${getStatusColor(api.status)} rounded-lg`}>
                {getStatusIcon(api.status)}
              </div>
              <div>
                <h3 className="font-medium text-white">{api.name}</h3>
                <p className="text-sm text-white">{api.description}</p>
                {api.lastSync && (
                  <p className="text-xs text-white mt-1">
                    Última sincronização: {api.lastSync}
                  </p>
                )}
                {api.count !== undefined && api.count > 0 && (
                  <p className="text-xs text-blue-600 mt-1">
                    {api.count} item{api.count !== 1 ? 's' : ''} sincronizado{api.count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {api.name === 'Catalog API' && api.status === 'disconnected' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncProducts}
                  disabled={isSyncingProducts}
                  className="flex items-center space-x-1"
                >
                  {isSyncingProducts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  <span className="text-white">Sincronizar Produtos</span>
                </Button>
              )}
              {getStatusBadge(api.status)}
            </div>
          </CardContent>
        </Card>
      ))}
      
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start space-x-2">
          <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Sistema de Status Dinâmico</h4>
            <p className="text-sm text-blue-700 mt-1">
              Os status acima são atualizados automaticamente baseado nos dados realmente sincronizados. 
              Uma API só aparece como "Conectado" quando há dados válidos no sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicIntegrationStatus;