
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Store, 
  AlertTriangle, 
  CheckCircle, 
  Pause,
  MessageCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  X,
  MapPin,
  Phone,
  Clock
} from 'lucide-react';
import { useAuth } from '@/App';
import { useIfoodMerchants } from '@/hooks/useIfoodMerchants';
import { useIntegrationCheck } from '@/hooks/useIntegrationCheck';
import { useUserStoreProducts, useUserProductsStats } from '@/hooks/useUserStoreProducts';
import { useUserPausedProducts, useUserPausedProductsStats } from '@/hooks/useUserPausedProducts';

export const StoreMonitoring = () => {
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  
  // Buscar dados das lojas do iFood com polling automático
  const { 
    data: merchants, 
    isLoading: merchantsLoading, 
    error: merchantsError,
    refetch: refetchMerchants 
  } = useIfoodMerchants(user?.id);
  
  // Verificar status da integração com polling
  const { 
    data: integrationStatus, 
    isLoading: integrationLoading 
  } = useIntegrationCheck(user?.id);

  // Buscar produtos das lojas do usuário com polling automático
  const { 
    products, 
    groupedProducts, 
    isLoading: productsLoading,
    forceRefresh: refreshProducts 
  } = useUserStoreProducts();

  // Buscar APENAS produtos pausados do banco de dados
  const { 
    pausedProducts, 
    groupedPausedProducts, 
    isLoading: pausedProductsLoading,
    forceRefresh: refreshPausedProducts,
    totalPausedProducts
  } = useUserPausedProducts();

  // Estatísticas dos produtos
  const productsStats = useUserProductsStats();
  const pausedProductsStats = useUserPausedProductsStats();

  // Estados de carregamento
  const isLoading = merchantsLoading || integrationLoading;

  // Calcular métricas baseadas em dados reais
  const onlineStores = merchants?.filter(m => m.status === true).length || 0;
  const offlineStores = merchants?.filter(m => m.status === false).length || 0;
  const totalStores = merchants?.length || 0;

  // Função para atualizar dados
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchMerchants(),
        refreshProducts(),
        refreshPausedProducts()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Função para mapear status do iFood para exibição
  const getStatusInfo = (status: boolean | null) => {
    if (status === true) {
      return {
        badge: <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Disponível</Badge>,
        color: 'green'
      };
    } else if (status === false) {
      return {
        badge: <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Indisponível</Badge>,
        color: 'red'
      };
    } else {
      return {
        badge: <Badge variant="outline">Desconhecido</Badge>,
        color: 'gray'
      };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Monitoramento de Lojas
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Acompanhe o status das lojas em tempo real
          </p>
        </div>
        
        <div className="flex justify-start">
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing || isLoading}
            variant="outline"
            className="whitespace-nowrap"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Verificação de Integração */}
      {!integrationStatus?.hasIfoodIntegration && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center space-x-3 flex-1">
                <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-orange-900">Integração iFood não configurada</h3>
                  <p className="text-sm text-orange-700">Configure sua integração com o iFood para visualizar dados em tempo real.</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="whitespace-nowrap w-full sm:w-auto"
                  onClick={() => {
                    // Navegar para a configuração da API do iFood
                    const url = new URL(window.location.href);
                    url.searchParams.set('module', 'ifood-api');
                    window.location.href = url.toString();
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Configurar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Overview - Cards com altura mínima e layout responsivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="h-full min-h-[120px]">
          <CardContent className="p-6 h-full flex items-center">
            <div className="flex items-start space-x-3 w-full">
              <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {isLoading ? '...' : onlineStores}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Lojas Disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full min-h-[120px]">
          <CardContent className="p-6 h-full flex items-center">
            <div className="flex items-start space-x-3 w-full">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {isLoading ? '...' : offlineStores}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Lojas Indisponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full min-h-[120px]">
          <CardContent className="p-6 h-full flex items-center">
            <div className="flex items-start space-x-3 w-full">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <Store className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {isLoading ? '...' : totalStores}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Total de Lojas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full min-h-[120px]">
          <CardContent className="p-6 h-full flex items-center">
            <div className="flex items-start space-x-3 w-full">
              <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                <Pause className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {pausedProductsLoading ? '...' : totalPausedProducts}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Produtos Pausados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Store className="h-5 w-5" />
            <span>Status das Lojas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando dados das lojas...</span>
            </div>
          ) : merchantsError ? (
            <div className="text-center py-8 text-red-600">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>Erro ao carregar dados das lojas</p>
              <p className="text-sm">{merchantsError.message}</p>
            </div>
          ) : !merchants || merchants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Store className="h-8 w-8 mx-auto mb-2" />
              <p>Nenhuma loja encontrada</p>
              <p className="text-sm">Configure a integração com o iFood para ver suas lojas</p>
            </div>
                    ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
            <TableBody>
                {merchants.map((merchant) => {
                  const statusInfo = getStatusInfo(merchant.status);
                  return (
                    <TableRow key={merchant.merchant_id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{merchant.name}</p>
                          {merchant.corporate_name && (
                            <p className="text-xs text-gray-500">{merchant.corporate_name}</p>
                          )}
                        </div>
                      </TableCell>
                  <TableCell>
                        {statusInfo.badge}
                  </TableCell>
                  <TableCell>
                        <div className="text-sm">
                          {merchant.address_city && merchant.address_state && (
                            <p>{merchant.address_city}, {merchant.address_state}</p>
                          )}
                          {merchant.address_neighborhood && (
                            <p className="text-gray-500">{merchant.address_neighborhood}</p>
                          )}
                        </div>
                  </TableCell>
                  <TableCell>
                        <div className="text-sm">
                          {merchant.last_sync_at ? 
                            new Date(merchant.last_sync_at).toLocaleString('pt-BR') 
                            : 'Nunca'
                          }
                    </div>
                  </TableCell>
                  <TableCell>
                        {merchant.clients?.name ? (
                          <Badge variant="outline">{merchant.clients.name}</Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">Não vinculado</span>
                        )}
                  </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedMerchant(merchant)}
                          className="whitespace-nowrap"
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Produtos Pausados por Loja */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Pause className="h-5 w-5" />
            <span>Produtos Pausados por Loja</span>
            <Badge variant="destructive" className="ml-2">{totalPausedProducts} pausados</Badge>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
              Auto-sync 5min
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pausedProductsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Carregando produtos pausados...</span>
            </div>
          ) : !pausedProducts || pausedProducts.length === 0 ? (
            <div className="text-center py-8 text-green-500">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Nenhum produto pausado encontrado! 🎉</p>
              <p className="text-sm">Todos os produtos das suas lojas estão disponíveis no iFood</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedPausedProducts.map((storeData) => {
                const merchant = merchants?.find(m => m.merchant_id === storeData.merchantId);
                return (
                  <div key={storeData.merchantId} className="border border-red-200 rounded-lg p-4 bg-red-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Store className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <h3 className="font-medium text-gray-900 dark:text-white">{storeData.merchantName}</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive" className="text-red-700">
                          {storeData.totalPaused} produtos pausados
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {storeData.pausedProducts.slice(0, 6).map((product) => (
                        <div key={product.id} className="border border-red-300 rounded p-3 bg-white hover:bg-red-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
                              <p className="text-xs text-gray-700 mt-1">
                                R$ {product.price?.toFixed(2) || '0,00'}
                              </p>
                              {product.category && (
                                <p className="text-xs text-gray-600 mt-1">{product.category}</p>
                              )}
                            </div>
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Pausado
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {storeData.pausedProducts.length > 6 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-3 text-center font-medium">
                        +{storeData.pausedProducts.length - 6} produtos pausados adicionais
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes da Loja */}
      <Dialog open={!!selectedMerchant} onOpenChange={() => setSelectedMerchant(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Store className="h-5 w-5" />
              <span>Detalhes da Loja</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedMerchant && (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Informações Básicas</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600">Nome</p>
                      <p className="font-medium">{selectedMerchant.name}</p>
                    </div>
                    {selectedMerchant.corporate_name && (
                      <div>
                        <p className="text-sm text-gray-600">Razão Social</p>
                        <p className="font-medium">{selectedMerchant.corporate_name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">ID do Merchant</p>
                      <p className="font-mono text-sm">{selectedMerchant.merchant_id}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Status</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600">Status Atual</p>
                      {getStatusInfo(selectedMerchant.status).badge}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Última Sincronização</p>
                      <p className="font-medium">
                        {selectedMerchant.last_sync_at ? 
                          new Date(selectedMerchant.last_sync_at).toLocaleString('pt-BR') 
                          : 'Nunca'
                        }
                      </p>
                    </div>
                    {selectedMerchant.clients?.name && (
                      <div>
                        <p className="text-sm text-gray-600">Cliente Vinculado</p>
                        <Badge variant="outline">{selectedMerchant.clients.name}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Informações de Contato */}
              {selectedMerchant.phone && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                    <Phone className="h-4 w-4" />
                    <span>Contato</span>
                  </h3>
                  <p className="text-sm">{selectedMerchant.phone}</p>
                </div>
              )}

              {/* Endereço */}
              {(selectedMerchant.address_city || selectedMerchant.address_state) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>Endereço</span>
                  </h3>
                  <div className="text-sm space-y-1">
                    {selectedMerchant.address_neighborhood && (
                      <p>{selectedMerchant.address_neighborhood}</p>
                    )}
                    <p>{selectedMerchant.address_city}, {selectedMerchant.address_state}</p>
                  </div>
                </div>
              )}

              {/* Horários de Funcionamento */}
              {selectedMerchant.operating_hours && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>Horários de Funcionamento</span>
                  </h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">
                      Dados disponíveis em formato JSON
                    </p>
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">Ver dados brutos</summary>
                      <pre className="text-xs mt-2 bg-white p-2 rounded border">
                        {JSON.stringify(selectedMerchant.operating_hours, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedMerchant(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
