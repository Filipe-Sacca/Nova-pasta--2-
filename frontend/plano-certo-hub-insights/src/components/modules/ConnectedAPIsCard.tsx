import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';
import { useIfoodSyncStatus } from '@/hooks/useIfoodSyncStatus';

const ConnectedAPIsCard = () => {
  const { status, loading } = useIfoodSyncStatus();
  
  // Contar apenas APIs conectadas (sem incluir Authentication que foi removido)
  const connectedCount = status.filter(api => api.status === 'connected').length;
  const totalCount = 2; // Merchant API, Catalog API
  
  const getStatusIcon = () => {
    if (loading) {
      return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>;
    }
    
    if (connectedCount === totalCount && connectedCount > 0) {
      return <CheckCircle className="h-6 w-6 text-green-600" />;
    } else if (connectedCount > 0) {
      return <CheckCircle className="h-6 w-6 text-yellow-600" />;
    } else {
      return <XCircle className="h-6 w-6 text-gray-400" />;
    }
  };
  
  const getStatusColor = () => {
    if (connectedCount === totalCount && connectedCount > 0) {
      return 'bg-green-100';
    } else if (connectedCount > 0) {
      return 'bg-yellow-100';
    } else {
      return 'bg-gray-100';
    }
  };
  
  const getStatusText = () => {
    if (loading) return 'Verificando...';
    return `${connectedCount} de ${totalCount} APIs Conectadas`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className={`p-2 ${getStatusColor()} rounded-lg`}>
            {getStatusIcon()}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : connectedCount}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getStatusText()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectedAPIsCard;