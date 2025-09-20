/**
 * iFood Orders Manager
 * Created: 19/08/2025
 * Purpose: Dashboard for monitoring iFood orders with real-time polling status
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Play, 
  Square, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  Activity,
  Check,
  X,
  Package,
  Loader2,
  Truck,
  ShoppingCart,
  DollarSign,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FilterBar } from '@/components/ui/filter-bar';
import { useAuth } from '@/App';

interface PollingStatus {
  isRunning: boolean;
  userId: string;
  startedAt: string;
  nextPollingAt: string;
  consecutiveErrors: number;
  metrics: {
    pollingAccuracy: number;
    acknowledgmentRate: number;
    avgApiResponseTime: number;
    errorRate: number;
  };
}

interface Order {
  id: string;
  ifood_order_id: string;
  merchant_id: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  total_amount?: number;
  created_at: string;
  order_data: any;
}

interface Event {
  id: string;
  event_id: string;
  event_type: string;
  event_category: string;
  merchant_id: string;
  acknowledgment_success: boolean;
  received_at: string;
  acknowledged_at?: string;
  event_data: any;
}

const IfoodOrdersManager: React.FC = () => {
  const navigate = useNavigate();
  const [pollingStatus, setPollingStatus] = useState<PollingStatus | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // User context
  const { user } = useAuth();
  const userId = user?.id || 'c1488646-aca8-4220-aacc-00e7ae3d6490'; // Fallback to default
  const { toast } = useToast();

  // iFood cancellation reasons
  const cancellationReasons = [
    { value: 'SYSTEM_ISSUE', label: 'Problemas de sistema na loja' },
    { value: 'DUPLICATE_ORDER', label: 'O pedido está duplicado' },
    { value: 'ITEM_UNAVAILABLE', label: 'Item indisponível' },
    { value: 'NO_DELIVERY_STAFF', label: 'A loja está sem entregadores disponíveis' },
    { value: 'MENU_OUTDATED', label: 'O cardápio está desatualizado' },
    { value: 'OUT_OF_DELIVERY_AREA', label: 'O pedido está fora da área de entrega' },
    { value: 'FRAUD_SUSPICION', label: 'Suspeita de golpe ou trote' },
    { value: 'OUT_OF_BUSINESS_HOURS', label: 'O pedido foi feito fora do horário de funcionamento da loja' },
    { value: 'INTERNAL_DIFFICULTIES', label: 'A loja está passando por dificuldades internas' },
    { value: 'RISKY_AREA', label: 'A entrega é em uma área de risco' },
    { value: 'LATE_OPENING', label: 'A loja só abrirá mais tarde' },
    { value: 'ADDRESS_ISSUE', label: 'O endereço está incompleto e o cliente não atende' },
    { value: 'PAYMENT_ISSUE', label: 'Problema com pagamento do cliente' },
  ];

  const API_BASE = 'http://localhost:8085';

  // Handle merchant selection change
  const handleMerchantChange = (merchantId: string) => {
    setSelectedMerchant(merchantId);
    setOrders([]);
    setCompletedOrders([]);
  };

  // Fetch polling status
  const fetchPollingStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/orders/polling/status/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setPollingStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching polling status:', error);
    }
  };

  // Track order changes for notifications
  const [orderNotifications, setOrderNotifications] = useState<Array<{type: 'new' | 'update', orderId: string, status?: string}>>([]);

  // Fetch orders with smooth update
  const fetchOrders = async (isInitialLoad = false) => {
    try {
      // Skip fetching if no specific merchant is selected
      if (selectedMerchant === 'all') {
        setOrders([]);
        return;
      }

      // Only show loading on initial load
      if (isInitialLoad) {
        setLoading(true);
      }

      const response = await fetch(`${API_BASE}/orders/${selectedMerchant}?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        const newOrders = data.data?.orders || [];
        const notifications: Array<{type: 'new' | 'update', orderId: string, status?: string}> = [];
        
        // Smart update: only update if there are changes
        setOrders(prevOrders => {
          // If it's the initial load or completely different, replace all
          if (isInitialLoad || prevOrders.length === 0) {
            return newOrders;
          }
          
          // Create a map of existing orders for quick lookup
          const existingOrdersMap = new Map(prevOrders.map(order => [order.id, order]));
          
          // Update or add new orders
          const updatedOrders = newOrders.map(newOrder => {
            const existingOrder = existingOrdersMap.get(newOrder.id);
            
            // If order exists and status/data changed, update it
            if (existingOrder && 
                (existingOrder.status !== newOrder.status || 
                 JSON.stringify(existingOrder.order_data) !== JSON.stringify(newOrder.order_data))) {
              // Queue notification for status changes
              if (existingOrder.status !== newOrder.status) {
                notifications.push({
                  type: 'update',
                  orderId: newOrder.id,
                  status: newOrder.status
                });
              }
              return newOrder;
            }
            
            // If it's a completely new order
            if (!existingOrder) {
              notifications.push({
                type: 'new',
                orderId: newOrder.id
              });
              return newOrder;
            }
            
            // No changes, keep existing
            return existingOrder;
          });
          
          // Remove orders that no longer exist
          const newOrderIds = new Set(newOrders.map(o => o.id));
          const filteredOrders = updatedOrders.filter(order => newOrderIds.has(order.id));
          
          // Only update if there are actual changes
          const hasChanges = JSON.stringify(filteredOrders) !== JSON.stringify(prevOrders);
          return hasChanges ? filteredOrders : prevOrders;
        });
        
        // Set notifications to be processed by useEffect
        if (notifications.length > 0 && !isInitialLoad) {
          setOrderNotifications(notifications);
        }
        
        console.log('📦 Orders synced:', newOrders.length);
      } else {
        console.error('❌ Error fetching orders:', data.error);
        if (isInitialLoad) {
          setOrders([]);
        }
      }
    } catch (error) {
      console.error('❌ Network error fetching orders:', error);
      if (isInitialLoad) {
        setOrders([]);
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  // Fetch completed orders for merchant
  const fetchCompletedOrders = async () => {
    try {
      // Skip fetching if no specific merchant is selected
      if (selectedMerchant === 'all') {
        setCompletedOrders([]);
        return;
      }

      setLoadingCompleted(true);
      const response = await fetch(`${API_BASE}/orders/${selectedMerchant}/completed?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setCompletedOrders(data.data?.orders || []);
        console.log('✅ Completed orders fetched:', data.data?.orders?.length || 0);
      } else {
        console.error('❌ Error fetching completed orders:', data.error);
        setCompletedOrders([]);
      }
    } catch (error) {
      console.error('❌ Network error fetching completed orders:', error);
      setCompletedOrders([]);
    } finally {
      setLoadingCompleted(false);
    }
  };

  // Start polling
  const startPolling = async () => {
    try {
      const response = await fetch(`${API_BASE}/orders/polling/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "🚀 Polling Iniciado",
          description: "Sistema de polling iFood ativo (30s intervals)"
        });
        fetchPollingStatus();
      } else {
        toast({
          title: "❌ Erro",
          description: data.error,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error starting polling:', error);
      toast({
        title: "❌ Erro",
        description: "Falha ao iniciar polling",
        variant: "destructive"
      });
    }
  };

  // Stop polling
  const stopPolling = async () => {
    try {
      const response = await fetch(`${API_BASE}/orders/polling/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "🛑 Polling Parado",
          description: "Sistema de polling iFood desativado"
        });
        setPollingStatus(null);
      }
    } catch (error) {
      console.error('Error stopping polling:', error);
    }
  };

  // Smart auto-refresh with smooth updates
  useEffect(() => {
    let isActive = true;
    
    const smartRefresh = async () => {
      if (!isActive) return;
      
      // Fetch polling status silently
      fetchPollingStatus();
      
      // Only refresh orders if merchant is selected and polling is active
      if (selectedMerchant && pollingStatus?.isRunning) {
        // Use non-blocking updates
        await Promise.all([
          fetchOrders(false), // false = not initial load
          fetchCompletedOrders()
        ]);
      }
    };
    
    // Start with longer interval and adjust based on activity
    const interval = setInterval(smartRefresh, 15000); // 15 seconds (less aggressive)
    
    // Initial fetch
    fetchPollingStatus();
    if (selectedMerchant) {
      fetchOrders(true); // true = initial load
      fetchCompletedOrders();
    }
    
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [selectedMerchant, pollingStatus?.isRunning]);

  // Handle order notifications in useEffect to avoid render-time state updates
  useEffect(() => {
    if (orderNotifications.length > 0) {
      orderNotifications.forEach(notification => {
        if (notification.type === 'new') {
          toast({
            title: "🆕 Novo Pedido!",
            description: `Pedido ${notification.orderId.substring(0, 8)}... recebido`,
            duration: 4000
          });
        } else if (notification.type === 'update' && notification.status) {
          toast({
            title: "🔄 Pedido Atualizado",
            description: `Pedido ${notification.orderId.substring(0, 8)}... mudou para ${notification.status}`,
            duration: 3000
          });
        }
      });
      // Clear notifications after processing
      setOrderNotifications([]);
    }
  }, [orderNotifications, toast]);

  // Helper to extract customer data from order
  const getCustomerInfo = (order: Order) => {
    let name = 'Cliente não informado';
    let phone = '';
    
    // Extract name
    if (typeof order.customer_name === 'string' && order.customer_name) {
      name = order.customer_name;
    } else if (typeof order.customer_name === 'object' && order.customer_name !== null) {
      const customerObj = order.customer_name as any;
      
      // For iFood test orders with number field
      if (customerObj.number) {
        name = `Teste iFood: ${customerObj.number}`;
      } else if (customerObj.name) {
        name = customerObj.name;
      } else {
        // Try to get the first string value
        const firstValue = Object.values(customerObj)[0];
        if (typeof firstValue === 'string') {
          name = firstValue;
        }
      }
    }
    
    // Extract phone - handle both string and object formats
    if (typeof order.customer_phone === 'string' && order.customer_phone) {
      phone = order.customer_phone;
    } else if (typeof order.customer_phone === 'object' && order.customer_phone !== null) {
      const phoneObj = order.customer_phone as any;
      
      // For iFood test orders with number field in phone
      if (phoneObj.number) {
        phone = phoneObj.number;
      } else if (phoneObj.phone) {
        phone = phoneObj.phone;
      } else {
        // Try to get the first string value that looks like a phone
        const values = Object.values(phoneObj);
        for (const value of values) {
          if (typeof value === 'string' && value.match(/[0-9]/)) {
            phone = value;
            break;
          }
        }
      }
    }
    
    // Check order_data as fallback
    if (!name || name === 'Cliente não informado') {
      if (order.order_data) {
        const orderData = order.order_data;
        
        // Standard iFood order structure
        if (orderData.customer) {
          name = orderData.customer.name || orderData.customer.firstName || name;
          phone = phone || orderData.customer.phone || orderData.customer.phoneNumber || '';
        }
        
        // Alternative structure
        if (orderData.customerName) {
          name = orderData.customerName;
          phone = phone || orderData.customerPhone || '';
        }
        
        // For test orders
        if (orderData.displayId && orderData.displayId.includes('TEST')) {
          name = 'Pedido de Teste iFood';
        }
      }
    }
    
    return { name, phone };
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',      // Aguardando preparo
      'PREPARING': 'bg-orange-100 text-orange-800 border-orange-200',    // Em preparo
      'READY_FOR_PICKUP': 'bg-purple-100 text-purple-800 border-purple-200', // Pronto para retirada
      'CONFIRMED': 'bg-blue-100 text-blue-800 border-blue-200',          // Confirmado
      'DISPATCHED': 'bg-indigo-100 text-indigo-800 border-indigo-200',   // Despachado para entrega
      'DELIVERED': 'bg-green-100 text-green-800 border-green-200',       // Entregue
      'CANCELLED': 'bg-red-100 text-red-800 border-red-200'              // Cancelado
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Action handlers - IMPLEMENTAÇÃO REAL
  const [loadingActions, setLoadingActions] = useState<Record<string, 'confirming' | 'cancelling' | 'completing' | 'preparing' | 'ready' | 'dispatching' | null>>({});

  const handleConfirmOrder = async (orderId: string) => {
    try {
      console.log('🔄 Confirmando pedido:', orderId);
      setLoadingActions(prev => ({ ...prev, [orderId]: 'confirming' }));
      
      const response = await fetch(`${API_BASE}/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const result = await response.json();
      console.log('📋 Resultado da confirmação:', result);
      
      if (result.success) {
        // Verificar se a preparação foi iniciada automaticamente
        const statusMessage = result.autoPreparationStarted 
          ? "✅ Pedido Confirmado e Preparação Iniciada"
          : "✅ Pedido Confirmado";
        
        const descriptionMessage = result.autoPreparationStarted
          ? `Pedido ${orderId.substring(0, 8)}... confirmado e já está sendo preparado!`
          : `Pedido ${orderId.substring(0, 8)}... confirmado com sucesso!`;
        
        toast({
          title: statusMessage,
          description: descriptionMessage
        });
        
        // Refresh orders list
        await fetchOrders(false); // Smooth update
      } else {
        throw new Error(result.error || 'Erro ao confirmar pedido');
      }
    } catch (error: any) {
      console.error('❌ Erro ao confirmar pedido:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao confirmar pedido: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [orderId]: null }));
    }
  };

  // Open cancel modal
  const openCancelModal = (orderId: string) => {
    setOrderToCancel(orderId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // Handle order cancellation with reason
  const handleCancelOrder = async () => {
    if (!orderToCancel || !cancelReason) {
      toast({
        title: "⚠️ Atenção",
        description: "Selecione um motivo para o cancelamento",
        variant: "destructive"
      });
      return;
    }

    setCancelLoading(true);
    try {
      console.log('🚫 Cancelando pedido:', orderToCancel, 'Motivo:', cancelReason);
      setLoadingActions(prev => ({ ...prev, [orderToCancel]: 'cancelling' }));
      
      const response = await fetch(`${API_BASE}/orders/${orderToCancel}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId,
          reason: cancelReason
        }),
      });
      
      const result = await response.json();
      console.log('📋 Resultado do cancelamento:', result);
      
      if (result.success) {
        toast({
          title: "🚫 Pedido Cancelado",
          description: `Pedido ${orderToCancel.substring(0, 8)}... cancelado com sucesso!`
        });
        
        setShowCancelModal(false);
        setOrderToCancel(null);
        setCancelReason('');
        
        // Refresh orders list (cancelled order will be filtered out)
        await fetchOrders(false); // Smooth update
      } else {
        throw new Error(result.error || 'Erro ao cancelar pedido');
      }
    } catch (error: any) {
      console.error('❌ Erro ao cancelar pedido:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao cancelar pedido: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setCancelLoading(false);
      if (orderToCancel) {
        setLoadingActions(prev => ({ ...prev, [orderToCancel]: null }));
      }
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      console.log('🏁 Concluindo pedido:', orderId);
      setLoadingActions(prev => ({ ...prev, [orderId]: 'completing' }));
      
      const response = await fetch(`${API_BASE}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const result = await response.json();
      console.log('📋 Resultado da conclusão:', result);
      
      if (result.success) {
        toast({
          title: "🏁 Pedido Concluído",
          description: `Pedido ${orderId.substring(0, 8)}... marcado como concluído!`
        });
        
        // Refresh both lists
        await Promise.all([fetchOrders(), fetchCompletedOrders()]);
      } else {
        throw new Error(result.error || 'Erro ao concluir pedido');
      }
    } catch (error: any) {
      console.error('❌ Erro ao concluir pedido:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao concluir pedido: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [orderId]: null }));
    }
  };

  // Change order to PREPARING status
  const handleStartPreparing = async (orderId: string) => {
    try {
      console.log('👨‍🍳 Iniciando preparo:', orderId);
      setLoadingActions(prev => ({ ...prev, [orderId]: 'preparing' }));
      
      const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId,
          status: 'PREPARING' 
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "👨‍🍳 Preparo Iniciado",
          description: `Pedido ${orderId.substring(0, 8)}... está sendo preparado!`
        });
        await fetchOrders(false); // Smooth update
      } else {
        throw new Error(result.error || 'Erro ao iniciar preparo');
      }
    } catch (error: any) {
      console.error('❌ Erro ao iniciar preparo:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao iniciar preparo: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [orderId]: null }));
    }
  };

  // Change order to READY_FOR_PICKUP status
  const handleReadyForPickup = async (orderId: string) => {
    try {
      console.log('📦 Marcando como pronto:', orderId);
      setLoadingActions(prev => ({ ...prev, [orderId]: 'ready' }));
      
      const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId,
          status: 'READY_FOR_PICKUP' 
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "📦 Pronto para Retirada",
          description: `Pedido ${orderId.substring(0, 8)}... está pronto para ser retirado!`
        });
        await fetchOrders(false); // Smooth update
      } else {
        throw new Error(result.error || 'Erro ao marcar como pronto');
      }
    } catch (error: any) {
      console.error('❌ Erro ao marcar como pronto:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao marcar como pronto: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [orderId]: null }));
    }
  };

  // Change order to DISPATCHED status
  const handleDispatchOrder = async (orderId: string) => {
    try {
      console.log('🚚 Despachando pedido:', orderId);
      setLoadingActions(prev => ({ ...prev, [orderId]: 'dispatching' }));
      
      const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId,
          status: 'DISPATCHED' 
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "🚚 Pedido Despachado",
          description: `Pedido ${orderId.substring(0, 8)}... foi enviado para entrega!`
        });
        await fetchOrders(false); // Smooth update
      } else {
        throw new Error(result.error || 'Erro ao despachar pedido');
      }
    } catch (error: any) {
      console.error('❌ Erro ao despachar pedido:', error);
      toast({
        title: "❌ Erro",
        description: `Erro ao despachar pedido: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [orderId]: null }));
    }
  };

  // View order details with items
  const handleViewOrderDetails = async (order: any) => {
    try {
      console.log('👁️ Viewing order details:', order.ifood_order_id);
      setLoadingOrderDetails(true);
      setSelectedOrder(order);
      setShowOrderDetails(true);
      
      // Fetch complete order details including items
      const response = await fetch(`${API_BASE}/orders/${order.ifood_order_id}/fetch-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Update selected order with complete data
          setSelectedOrder({
            ...order,
            order_data: result.data,
            virtual_bag_data: result.data
          });
          
          // Refresh orders list to get updated data
          await fetchOrders(false); // Smooth update
        }
      }
    } catch (error: any) {
      console.error('❌ Error fetching order details:', error);
      toast({
        title: "⚠️ Aviso",
        description: "Não foi possível buscar todos os detalhes do pedido",
        variant: "destructive"
      });
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Navigate to Shipping module
  const handleViewInShipping = (orderId: string) => {
    console.log('🚚 Navigating to shipping for order:', orderId);
    // Navigate to Shipping tab with order ID as state
    navigate('/', { 
      state: { 
        activeModule: 'shipping',
        highlightOrder: orderId 
      } 
    });
    toast({
      title: "🚚 Redirecionando",
      description: "Abrindo módulo de entregas..."
    });
  };


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pedidos iFood</h2>
          <p className="text-muted-foreground">
            Monitor de pedidos em tempo real com polling automático
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        selectedClient={selectedMerchant}
        onClientChange={handleMerchantChange}
        showPeriodFilter={false}
        showClientFilter={true}
        onPeriodChange={() => {}}
      />

      {/* Polling Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status do Polling
          </CardTitle>
          <CardDescription>
            Sistema de monitoramento automático a cada 30 segundos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Polling Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {pollingStatus?.isRunning ? (
                  <>
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-green-600">ATIVO</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 bg-gray-400 rounded-full" />
                    <span className="text-sm font-medium text-gray-600">INATIVO</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={startPolling}
                  disabled={pollingStatus?.isRunning}
                  className="flex items-center gap-1"
                >
                  <Play className="h-3 w-3" />
                  Iniciar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={stopPolling}
                  disabled={!pollingStatus?.isRunning}
                  className="flex items-center gap-1"
                >
                  <Square className="h-3 w-3" />
                  Parar
                </Button>
              </div>
            </div>

            {/* Metrics */}
            {pollingStatus && (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Precisão Timing</p>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-green-600">
                      {pollingStatus.metrics.pollingAccuracy}%
                    </div>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Taxa Acknowledgment</p>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-blue-600">
                      {pollingStatus.metrics.acknowledgmentRate}%
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Resp. API Média</p>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(pollingStatus.metrics.avgApiResponseTime)}ms
                    </div>
                    <Clock className="h-4 w-4 text-purple-500" />
                  </div>
                </div>
              </>
            )}
          </div>

          {pollingStatus?.isRunning && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Próximo polling: {new Date(pollingStatus.nextPollingAt).toLocaleTimeString()}</span>
              </div>
            </div>
          )}

          {pollingStatus?.consecutiveErrors > 0 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {pollingStatus.consecutiveErrors} erros consecutivos detectados
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Pedidos Recentes
          </CardTitle>
          <CardDescription>
            Pedidos processados automaticamente via virtual bag
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedMerchant === 'all' ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Selecione um Merchant</p>
              <p className="text-sm">Escolha um merchant na barra de filtros para visualizar os pedidos</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
              <p className="text-sm">Aguardando pedidos do sistema de polling...</p>
            </div>
          ) : (
            <Table className="transition-all duration-300">
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders || []).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      {order.ifood_order_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {getCustomerInfo(order).name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.total_amount ? `R$ ${order.total_amount.toFixed(2)}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {new Date(order.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        {/* DEBUG: Status do pedido = {order.status} */}
                        {/* FLUXO: PENDING → Confirmar (auto-preparo) → PREPARING → Pronto → DISPATCHED → Concluir */}
                        
                        {/* Etapa 1: Ações para pedidos PENDING ou CONFIRMED */}
                        {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                          <>
                            <Button 
                              size="sm" 
                              variant="default"
                              className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                              onClick={() => {
                                console.log('🎯 Botão Confirmar clicado para pedido:', order.ifood_order_id);
                                handleConfirmOrder(order.ifood_order_id);
                              }}
                              disabled={!!loadingActions[order.ifood_order_id]}
                            >
                              {loadingActions[order.ifood_order_id] === 'confirming' ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3 mr-1" />
                              )}
                              Confirmar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() => {
                                console.log('🎯 Botão Cancelar clicado para pedido:', order.ifood_order_id);
                                openCancelModal(order.ifood_order_id);
                              }}
                              disabled={!!loadingActions[order.ifood_order_id]}
                            >
                              {loadingActions[order.ifood_order_id] === 'cancelling' ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <X className="h-3 w-3 mr-1" />
                              )}
                              Cancelar
                            </Button>
                          </>
                        )}
                        
                        {/* Etapa 2: Finalizar Preparo (PREPARING ou PREPARATION_STARTED) */}
                        {(order.status === 'PREPARING' || order.status === 'PREPARATION_STARTED') && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                              onClick={() => handleReadyForPickup(order.ifood_order_id)}
                              disabled={!!loadingActions[order.ifood_order_id]}
                            >
                              {loadingActions[order.ifood_order_id] === 'ready' ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Package className="h-3 w-3 mr-1" />
                              )}
                              Pronto para Retirada
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() => {
                                console.log('🎯 Botão Cancelar clicado para pedido:', order.ifood_order_id);
                                openCancelModal(order.ifood_order_id);
                              }}
                              disabled={!!loadingActions[order.ifood_order_id]}
                            >
                              {loadingActions[order.ifood_order_id] === 'cancelling' ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <X className="h-3 w-3 mr-1" />
                              )}
                              Cancelar
                            </Button>
                          </>
                        )}
                        
                        {/* Etapa 3: Pedido Pronto para Retirada (READY_FOR_PICKUP ou READY) */}
                        {(order.status === 'READY_FOR_PICKUP' || order.status === 'READY') && (
                          <>
                            <Button 
                              size="sm" 
                              variant="default"
                              className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                              onClick={() => handleDispatchOrder(order.ifood_order_id)}
                              disabled={!!loadingActions[order.ifood_order_id]}
                            >
                              {loadingActions[order.ifood_order_id] === 'dispatching' ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Truck className="h-3 w-3 mr-1" />
                              )}
                              Enviar para Entrega
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() => openCancelModal(order.ifood_order_id)}
                              disabled={!!loadingActions[order.ifood_order_id]}
                            >
                              {loadingActions[order.ifood_order_id] === 'cancelling' ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <X className="h-3 w-3 mr-1" />
                              )}
                              Cancelar
                            </Button>
                          </>
                        )}
                        
                        {/* Etapa 5: Pedido Despachado (DISPATCHED) */}
                        {order.status === 'DISPATCHED' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="default"
                              className="bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                              onClick={() => handleCompleteOrder(order.ifood_order_id)}
                              disabled={!!loadingActions[order.ifood_order_id]}
                            >
                              {loadingActions[order.ifood_order_id] === 'completing' ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Confirmar Entrega
                            </Button>
                          </>
                        )}
                        
                        {/* Status não reconhecido - mostrar botão Ver para debug */}
                        {order.status !== 'PENDING' && 
                         order.status !== 'PREPARING' && 
                         order.status !== 'READY_FOR_PICKUP' && 
                         order.status !== 'DISPATCHED' && 
                         order.status !== 'DELIVERED' && 
                         order.status !== 'CANCELLED' && (
                          <div className="text-xs text-gray-500">
                            Status: {order.status}
                          </div>
                        )}
                        
                        {/* Botão para Ver no módulo de Entregas quando estiver DISPATCHED ou READY_FOR_PICKUP */}
                        {(order.status === 'DISPATCHED' || order.status === 'READY_FOR_PICKUP' || 
                          order.order_data?.deliveryPersonName) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                            onClick={() => handleViewInShipping(order.ifood_order_id)}
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            Ver Entrega
                          </Button>
                        )}
                        
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewOrderDetails(order)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Seção de Pedidos Concluídos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span>Pedidos Concluídos</span>
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
              {completedOrders.length} finalizados
            </Badge>
          </CardTitle>
          <CardDescription>
            Histórico de pedidos que foram entregues/finalizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedMerchant === 'all' ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Selecione um Merchant</p>
              <p className="text-sm">Escolha um merchant na barra de filtros para visualizar os pedidos concluídos</p>
            </div>
          ) : loadingCompleted ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Carregando pedidos concluídos...</span>
            </div>
          ) : completedOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Nenhum pedido concluído</p>
              <p className="text-sm">Pedidos finalizados aparecerão aqui</p>
            </div>
          ) : (
            <Table className="transition-all duration-300">
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Concluído em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedOrders.map((order) => (
                  <TableRow key={order.id} className="bg-green-50/30">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {order.ifood_order_id.substring(0, 8)}...
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {order.ifood_order_id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {getCustomerInfo(order).name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        CONCLUÍDO
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.total_amount ? `R$ ${order.total_amount.toFixed(2)}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {order.delivered_at ? 
                        new Date(order.delivered_at).toLocaleString('pt-BR') : 
                        new Date(order.updated_at).toLocaleString('pt-BR')
                      }
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        <Eye className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status dos Pedidos</p>
                <p className="text-sm font-medium">
                  ✅ {orders?.filter(o => o.status === 'CONFIRMED').length || 0} Confirmados
                </p>
                <p className="text-xs text-muted-foreground">
                  ⏳ {orders?.filter(o => o.status === 'PENDING').length || 0} Pendentes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pedidos</p>
                <p className="text-xl font-bold">{orders?.length || 0}</p>
                <p className="text-xs text-muted-foreground">
                  Pendentes: {orders?.filter(o => o.status === 'PENDING').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold">
                  R$ {(orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Hoje: {orders?.filter(o => {
                    const today = new Date().toDateString();
                    return new Date(o.created_at).toDateString() === today;
                  }).length || 0} pedidos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Atualização</p>
                <p className="text-sm">{new Date().toLocaleTimeString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Development Info */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              Sistema conectado ao backend ({API_BASE}) - 
              Polling automático a cada 30s - 
              Virtual Bag Processing ativo
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
            <CardHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                    Detalhes do Pedido
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    {selectedOrder.ifood_order_id}
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    setShowOrderDetails(false);
                    setSelectedOrder(null);
                  }}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6 bg-white dark:bg-gray-900">
              {/* Loading state */}
              {loadingOrderDetails && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mr-2 text-blue-600" />
                  <span className="text-gray-700 dark:text-gray-300">Buscando detalhes completos do pedido...</span>
                </div>
              )}
              
              {/* Customer Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Informações do Cliente</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Nome</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{getCustomerInfo(selectedOrder).name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Telefone</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{getCustomerInfo(selectedOrder).phone || 'Não informado'}</p>
                  </div>
                </div>
                {selectedOrder.customer_address && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-red-500" />
                      Endereço
                    </p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{selectedOrder.customer_address}</p>
                  </div>
                )}
              </div>
              
              {/* Order Items */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  Itens do Pedido
                </h3>
                {selectedOrder.order_data?.items && selectedOrder.order_data.items.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table className="transition-all duration-300">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Observações</TableHead>
                          <TableHead className="text-right">Preço Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.order_data.items.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.quantity || 1}x</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.name || item.productName || 'Item'}</p>
                                {item.externalCode && (
                                  <p className="text-xs text-muted-foreground">Código: {item.externalCode}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{item.observations || item.notes || '-'}</p>
                              {item.options && item.options.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Complementos:</p>
                                  {item.options.map((option: any, idx: number) => (
                                    <p key={idx} className="text-xs text-gray-700 dark:text-gray-300">
                                      • {option.name} {option.quantity > 1 && `(${option.quantity}x)`} - R$ {(option.price || 0).toFixed(2)}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {(item.unitPrice || item.price || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {(item.totalPrice || (item.price * (item.quantity || 1)) || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-muted-foreground">
                      {loadingOrderDetails ? 'Carregando itens...' : 'Nenhum item encontrado'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Os detalhes dos itens serão exibidos quando disponíveis
                    </p>
                  </div>
                )}
              </div>
              
              {/* Financial Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Informações Financeiras
                </h3>
                <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 space-y-2 bg-gray-50 dark:bg-gray-800">
                  {selectedOrder.order_data?.total?.subTotal !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span>R$ {(selectedOrder.order_data.total.subTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {(selectedOrder.order_data?.total?.deliveryFee !== undefined || selectedOrder.delivery_fee !== undefined) && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Taxa de Entrega</span>
                      <span>R$ {(selectedOrder.order_data?.total?.deliveryFee || selectedOrder.delivery_fee || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.order_data?.total?.benefits > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto</span>
                      <span>- R$ {(selectedOrder.order_data.total.benefits).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2 flex justify-between font-semibold text-lg text-gray-900 dark:text-gray-100">
                    <span>Total</span>
                    <span>R$ {(selectedOrder.order_data?.total?.orderAmount || selectedOrder.total_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 pt-2">
                    Método de Pagamento: {selectedOrder.payment_method || 'N/A'}
                  </div>
                </div>
              </div>
              
              {/* Order Status */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Status do Pedido</h3>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {selectedOrder.status}
                  </Badge>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Criado em: {new Date(selectedOrder.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel Order Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>
              Cancelar muitos pedidos pode afetar o desempenho da sua loja no iFood. 
              Assim que possível, ajuste sua operação para não cancelar novos pedidos pelo mesmo motivo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Atenção:</strong> aguarde alguns minutos após a solicitação para receber a confirmação do cancelamento.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <p className="text-sm font-medium mb-3">Selecione o motivo pelo qual você não pode aceitar este pedido:</p>
              
              <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
                <div className="grid grid-cols-2 gap-3">
                  {cancellationReasons.map((reason) => (
                    <div key={reason.value} className="flex items-start space-x-2">
                      <RadioGroupItem value={reason.value} id={reason.value} />
                      <Label 
                        htmlFor={reason.value} 
                        className="text-sm cursor-pointer leading-relaxed"
                      >
                        {reason.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelModal(false)}
              disabled={cancelLoading}
            >
              Voltar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={!cancelReason || cancelLoading}
            >
              {cancelLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Cancelar pedido'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IfoodOrdersManager;