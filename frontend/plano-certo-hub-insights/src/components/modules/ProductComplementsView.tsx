import { useState } from 'react';
import { useProductComplements } from '@/hooks/useProductComplements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ImageIcon, ChevronUp, Pause, Play, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/api';

interface ProductComplementsViewProps {
  productId: string;
  merchantId: string;
}

interface Complement {
  option_id: string;
  name: string;
  description?: string;
  context_price: number;
  status: string;
  imagePath?: string;
}

/**
 * Componente para exibir produto com seus complementos
 * Visual 100% idêntico ao iFood + Botões Funcionais
 */
export const ProductComplementsView = ({ productId, merchantId }: ProductComplementsViewProps) => {
  const { data: product, isLoading, error, refetch } = useProductComplements(productId);
  const { toast } = useToast();

  // Estados para modais
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [selectedComplement, setSelectedComplement] = useState<Complement | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // ===== FUNÇÃO: Alterar Preço =====
  const handleUpdatePrice = async () => {
    if (!selectedComplement || !newPrice) return;

    setIsUpdating(true);
    try {
      console.log('🔄 [PRICE] Atualizando preço do complemento:', selectedComplement.name);
      console.log('🔄 [PRICE] optionId:', selectedComplement.option_id);
      console.log('🔄 [PRICE] Novo preço:', newPrice);
      console.log('🔄 [PRICE] URL:', `${API_BASE_URL}/merchants/${merchantId}/options/price`);

      const response = await fetch(
        `${API_BASE_URL}/merchants/${merchantId}/options/price`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            optionId: selectedComplement.option_id,
            price: parseFloat(newPrice)
          })
        }
      );

      console.log('📡 [PRICE] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [PRICE] Erro na resposta:', errorText);
        throw new Error(`Erro ao atualizar preço: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ [PRICE] Resposta do servidor:', responseData);

      toast({
        title: '✅ Preço atualizado!',
        description: `${selectedComplement.name} agora custa R$ ${newPrice}`,
      });

      setPriceModalOpen(false);
      setNewPrice('');
      refetch();
    } catch (err: any) {
      console.error('❌ [PRICE] Erro capturado:', err);
      console.error('❌ [PRICE] Erro stack:', err.stack);

      toast({
        title: '❌ Erro',
        description: err.message || 'Não foi possível atualizar o preço',
        variant: 'destructive'
      });
    } finally {
      console.log('🔄 [PRICE] Resetando isUpdating para false');
      setIsUpdating(false);
    }
  };

  // ===== FUNÇÃO: Alterar Status =====
  const handleUpdateStatus = async (complement: Complement, newStatus: 'AVAILABLE' | 'UNAVAILABLE') => {
    setIsUpdating(true);
    try {
      console.log('🔄 [STATUS] Atualizando status do complemento:', complement.name);
      console.log('🔄 [STATUS] optionId:', complement.option_id);
      console.log('🔄 [STATUS] Novo status:', newStatus);
      console.log('🔄 [STATUS] URL:', `${API_BASE_URL}/merchants/${merchantId}/options/status`);

      const response = await fetch(
        `${API_BASE_URL}/merchants/${merchantId}/options/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            optionId: complement.option_id,
            status: newStatus
          })
        }
      );

      console.log('📡 [STATUS] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [STATUS] Erro na resposta:', errorText);
        throw new Error(`Erro ao atualizar status: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ [STATUS] Resposta do servidor:', responseData);

      toast({
        title: '✅ Status atualizado!',
        description: `${complement.name} está ${newStatus === 'AVAILABLE' ? 'disponível' : 'pausado'}`,
      });

      refetch();
    } catch (err: any) {
      console.error('❌ [STATUS] Erro capturado:', err);
      console.error('❌ [STATUS] Erro stack:', err.stack);

      toast({
        title: '❌ Erro',
        description: err.message || 'Não foi possível atualizar o status',
        variant: 'destructive'
      });
    } finally {
      console.log('🔄 [STATUS] Resetando isUpdating para false');
      setIsUpdating(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando produto...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Erro ao carregar produto: {error.message}
      </div>
    );
  }

  if (!product) {
    return <div className="p-4">Produto não encontrado</div>;
  }

  return (
    <div className="w-full bg-white rounded-lg border">
      {/* ===== PRODUTO PRINCIPAL (Topo) ===== */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b rounded-t-lg">
        <div className="flex items-center gap-3 flex-1">
          {product.imagePath ? (
            <img
              src={product.imagePath}
              alt={product.name}
              className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <ImageIcon className="h-6 w-6 text-gray-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-gray-900">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-sm text-gray-600 line-clamp-1">
                {product.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 ml-3">
          <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-200">
            <ChevronUp className="h-4 w-4 mr-1" />
            Esconder
          </Button>

          <div className="text-lg font-semibold text-gray-900">
            {formatPrice(product.price)}
          </div>
        </div>
      </div>

      {/* ===== LISTA DE COMPLEMENTOS ===== */}
      {product.complements && product.complements.length > 0 && (
        <div className="divide-y">
            {product.complements.map((complement: Complement) => (
              <div
                key={complement.option_id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                {/* Ícone + Nome */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {complement.imagePath ? (
                    <img
                      src={complement.imagePath}
                      alt={complement.name}
                      className="w-10 h-10 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  )}

                  <span className="font-normal text-gray-900 truncate">{complement.name}</span>
                </div>

                {/* Preço + Botões */}
                <div className="flex items-center gap-2 ml-3">
                  {/* Botão Preço */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-900 hover:bg-gray-200 font-normal"
                    onClick={() => {
                      setSelectedComplement(complement);
                      setNewPrice(complement.context_price.toString());
                      setPriceModalOpen(true);
                    }}
                    disabled={isUpdating}
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    {formatPrice(complement.context_price || 0)}
                  </Button>

                  {/* Botão Status (Pausar/Ativar) */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-gray-200"
                    onClick={() => {
                      const newStatus = complement.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
                      handleUpdateStatus(complement, newStatus);
                    }}
                    disabled={isUpdating}
                    title={complement.status === 'AVAILABLE' ? 'Pausar complemento' : 'Ativar complemento'}
                  >
                    {complement.status === 'AVAILABLE' ? (
                      <Pause className="h-4 w-4 text-gray-700" />
                    ) : (
                      <Play className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Mensagem se não tiver complementos */}
      {(!product.complements || product.complements.length === 0) && (
        <div className="p-6 text-center text-gray-500">
          Este produto não possui complementos
        </div>
      )}

      {/* ===== MODAL: Editar Preço ===== */}
      <Dialog open={priceModalOpen} onOpenChange={setPriceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Preço do Complemento</DialogTitle>
            <DialogDescription>
              {selectedComplement?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Novo Preço (R$)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0.00"
              className="text-lg"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPriceModalOpen(false)}
              disabled={isUpdating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdatePrice}
              disabled={isUpdating || !newPrice}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Preço'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
