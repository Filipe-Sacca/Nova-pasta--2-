import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimePicker } from '@/components/ui/time-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  Clock, 
  Plus, 
  Store, 
  Calendar as CalendarIcon,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Edit,
  ChevronDown,
  Trash2,
  X
} from 'lucide-react';

interface OpeningHours {
  id: string;
  dayOfWeek: string;
  start: string;
  duration: number;
}

interface OpeningHoursData {
  shifts: OpeningHours[];
  by_day: { [key: string]: string };
  last_updated: string;
}

interface Merchant {
  merchant_id: string;
  name: string;
  operating_hours: OpeningHoursData;
}

const DAYS_MAPPING = {
  'MONDAY': 'Segunda',
  'TUESDAY': 'Terça',
  'WEDNESDAY': 'Quarta',
  'THURSDAY': 'Quinta',
  'FRIDAY': 'Sexta',
  'SATURDAY': 'Sábado',
  'SUNDAY': 'Domingo'
};

const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

interface ScheduledPause {
  id: string;
  startDate: string;
  endDate: string;
  description: string;
  reason?: string;
  isActive: boolean;
}

export default function OpeningHoursManager() {
  const { user } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [realPeakHours, setRealPeakHours] = useState({ lunchHours: 0, dinnerHours: 0 });
  const lastUpdateRef = useRef<string>('');
  
  console.log('🍽️ [OPENING HOURS] Componente carregado!');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [scheduledPauses, setScheduledPauses] = useState<ScheduledPause[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPauses, setLoadingPauses] = useState(false);
  const [syncingPauses, setSyncingPauses] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [creatingPause, setCreatingPause] = useState(false);
  const [deletingDay, setDeletingDay] = useState<string | null>(null);
  const [dayToDelete, setDayToDelete] = useState<string>('');
  
  // Modal form state
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');

  // Time picker modal states
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showPauseStartTimePicker, setShowPauseStartTimePicker] = useState(false);
  const [showPauseEndTimePicker, setShowPauseEndTimePicker] = useState(false);

  // Pause form state
  const [pauseStartDate, setPauseStartDate] = useState<Date | undefined>(undefined);
  const [pauseStartTime, setPauseStartTime] = useState('');
  const [pauseEndDate, setPauseEndDate] = useState<Date | undefined>(undefined);
  const [pauseEndTime, setPauseEndTime] = useState('');
  const [pauseDescription, setPauseDescription] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [cancelingPause, setCancelingPause] = useState<string | null>(null);

  // Fetch merchants with opening hours
  const fetchMerchants = async (silent = false) => {
    if (!user?.id) return;

    try {
      if (!silent) setLoading(true);
      const { data, error } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, name, operating_hours')
        .eq('user_id', user.id)
        .not('operating_hours', 'is', null);

      if (error) throw error;

      // Verificar se os dados realmente mudaram para evitar re-renders desnecessários
      const newLastUpdate = data?.[0]?.operating_hours?.last_updated || '';
      const hasChanges = newLastUpdate !== lastUpdateRef.current;

      if (hasChanges || !silent) {
        setMerchants(data || []);
        if (data && data.length > 0 && (!selectedMerchant || hasChanges)) {
          setSelectedMerchant(data[0]);
        }
        lastUpdateRef.current = newLastUpdate;

        // Log apenas quando há mudanças reais
        if (hasChanges && silent) {
          console.log('🔄 [OPENING HOURS] Dados atualizados silenciosamente:', newLastUpdate);
        }
      }
    } catch (error) {
      console.error('Error fetching merchants:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar os horários de funcionamento.",
        variant: "destructive",
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch scheduled pauses for the selected merchant
  const fetchScheduledPauses = async () => {
    if (!selectedMerchant?.merchant_id || !user?.id) return;

    try {
      setLoadingPauses(true);
      const response = await fetch(
        `http://localhost:8093/merchants/${selectedMerchant.merchant_id}/interruptions?userId=${user.id}`
      );
      
      if (!response.ok) {
        throw new Error('Falha ao carregar pausas programadas');
      }

      const result = await response.json();
      if (result.success && result.interruptions) {
        setScheduledPauses(result.interruptions.map((pause: any) => ({
          id: pause.id,
          startDate: pause.startDate,
          endDate: pause.endDate,
          description: pause.description,
          reason: pause.reason,
          isActive: new Date(pause.endDate) > new Date()
        })));
      }
    } catch (error) {
      console.error('Error fetching scheduled pauses:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar pausas programadas.",
        variant: "destructive",
      });
    } finally {
      setLoadingPauses(false);
    }
  };

  // Sync scheduled pauses from iFood API
  const syncScheduledPausesFromiFood = async (manual = false) => {
    if (!selectedMerchant?.merchant_id || !user?.id) return;

    try {
      if (manual) setSyncingPauses(true);
      console.log('🔄 [SYNC] Sincronizando pausas do iFood API...');

      const response = await fetch(
        `http://localhost:8093/merchants/${selectedMerchant.merchant_id}/interruptions/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [SYNC] Sincronização concluída:', result);

        // Refresh the scheduled pauses list after sync
        fetchScheduledPauses();

        if (manual) {
          const messages = [];
          if (result.new_interruptions > 0) {
            messages.push(`${result.new_interruptions} nova(s) pausa(s) adicionada(s)`);
          }
          if (result.updated_interruptions > 0) {
            messages.push(`${result.updated_interruptions} pausa(s) atualizada(s)`);
          }
          if (result.deleted_interruptions > 0) {
            messages.push(`${result.deleted_interruptions} pausa(s) removida(s) (deletadas no iFood)`);
          }

          const description = messages.length > 0
            ? messages.join(', ') + '.'
            : 'Nenhuma alteração encontrada.';

          toast({
            title: "Sincronização bidirecional concluída",
            description: description,
          });
        }
      } else {
        const errorText = await response.text();
        console.error('❌ [SYNC] Erro na sincronização:', errorText);

        if (manual) {
          toast({
            title: "Erro na sincronização",
            description: "Falha ao sincronizar pausas do iFood.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('❌ [SYNC] Erro ao sincronizar pausas:', error);

      if (manual) {
        toast({
          title: "Erro na sincronização",
          description: "Falha ao conectar com o iFood.",
          variant: "destructive",
        });
      }
    } finally {
      if (manual) setSyncingPauses(false);
    }
  };

  // Cancel/Remove scheduled pause
  const handleCancelPause = async (pauseId: string) => {
    if (!selectedMerchant?.merchant_id || !user?.id) return;

    try {
      setCancelingPause(pauseId);
      
      const response = await fetch(
        `http://localhost:8093/merchants/${selectedMerchant.merchant_id}/interruptions/${pauseId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id
          })
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Pausa programada cancelada com sucesso.",
        });

        // Remove immediately from local state for instant UI update
        setScheduledPauses(prevPauses =>
          prevPauses.filter(pause => pause.id !== pauseId)
        );

        // Also refresh the list to ensure consistency
        setTimeout(() => {
          fetchScheduledPauses();
        }, 1000);
      } else {
        throw new Error(result.message || 'Erro ao cancelar pausa');
      }
    } catch (error: any) {
      console.error('Error canceling pause:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao cancelar pausa programada.",
        variant: "destructive",
      });
    } finally {
      setCancelingPause(null);
    }
  };

  const calculateRealPeakHours = async () => {
    if (!user?.id) return;

    try {
      console.log('🔍 [OPENING HOURS] Buscando merchants para user_id:', user.id);
      
      // TESTE: Buscar TODOS os merchants primeiro para debug
      const { data: allMerchantsTest, error: allError } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, user_id, operating_hours');
        
      console.log('🔍 [DEBUG] TODOS OS MERCHANTS NO BANCO:', allMerchantsTest);
      console.log('🔍 [DEBUG] Procurando por user_id:', user.id);
      
      // Buscar horários de funcionamento dos merchants
      const { data: merchantsData, error: merchantsError } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, operating_hours')
        .eq('user_id', user.id);

      console.log('📊 [OPENING HOURS] MERCHANTS DATA:', merchantsData);
      console.log('❌ [OPENING HOURS] MERCHANTS ERROR:', merchantsError);

      let totalLunchHours = 0;
      let totalDinnerHours = 0;

      if (!merchantsData || merchantsData.length === 0) {
        console.log('⚠️ [OPENING HOURS] Nenhum merchant encontrado para user_id:', user.id);
        console.log('🔍 [OPENING HOURS] Verificando todos os merchants...');
        
        // Debug: buscar todos os merchants
        const { data: allMerchants } = await supabase
          .from('ifood_merchants')
          .select('merchant_id, user_id, operating_hours');
          
        console.log('🔍 [OPENING HOURS] TODOS OS MERCHANTS:', allMerchants);
        
        setRealPeakHours({ lunchHours: 0, dinnerHours: 0 });
        return;
      }

      console.log('✅ [OPENING HOURS] Processando', merchantsData.length, 'merchants');
      
      // Calcular baseado nos horários reais
      merchantsData.forEach(merchant => {
        if (merchant.operating_hours && merchant.operating_hours.shifts) {
          console.log('📅 [OPENING HOURS] Processando merchant:', merchant.merchant_id);
          console.log('🕒 [OPENING HOURS] Shifts:', merchant.operating_hours.shifts);
          
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
              console.log(`🍽️ [OPENING HOURS] LUNCH ${shift.dayOfWeek}: +${overlap}h`);
            }
            
            // Calcular overlap com horário de janta (18h-23h)
            const dinnerStart = 18;
            const dinnerEnd = 23;
            if (from < dinnerEnd && to > dinnerStart) {
              const overlap = Math.min(dinnerEnd, to) - Math.max(dinnerStart, from);
              totalDinnerHours += Math.max(0, overlap);
              console.log(`🌙 [OPENING HOURS] DINNER ${shift.dayOfWeek}: +${overlap}h`);
            }
          });
        } else {
          console.log('⚠️ [OPENING HOURS] Merchant sem operating_hours:', merchant.merchant_id);
        }
      });

      console.log(`📊 [OPENING HOURS] RESULT Almoço: ${totalLunchHours}h, Janta: ${totalDinnerHours}h`);
      
      setRealPeakHours({
        lunchHours: Math.round(totalLunchHours),
        dinnerHours: Math.round(totalDinnerHours)
      });

    } catch (error) {
      console.error('❌ [OPENING HOURS] Erro ao calcular horas de pico:', error);
      setRealPeakHours({ lunchHours: 0, dinnerHours: 0 });
    }
  };

  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
  };

  useEffect(() => {
    fetchMerchants();
    calculateRealPeakHours();
    
    // Polling silencioso para atualizações suaves
    const pollingInterval = setInterval(() => {
      fetchMerchants(true); // Silent update - não mostra loading
      calculateRealPeakHours();
    }, 30000); // A cada 30 segundos (menos frequente)

    return () => clearInterval(pollingInterval);
  }, [user?.id]);

  useEffect(() => {
    fetchScheduledPauses();

    // Polling para sincronizar pausas programadas do iFood
    const pausesSyncInterval = setInterval(() => {
      if (selectedMerchant?.merchant_id && user?.id) {
        syncScheduledPausesFromiFood();
      }
    }, 60000); // A cada 60 segundos (1 minuto)

    return () => clearInterval(pausesSyncInterval);
  }, [selectedMerchant?.merchant_id, user?.id]);

  // Calculate total weekly hours
  const calculateWeeklyHours = () => {
    if (!selectedMerchant?.operating_hours?.shifts) return 0;
    
    const totalMinutes = selectedMerchant.operating_hours.shifts.reduce((total, shift) => {
      console.log(`⏰ [WEEKLY CALC] ${shift.dayOfWeek}: ${shift.duration}min`);
      return total + shift.duration;
    }, 0);
    
    console.log(`⏰ [WEEKLY CALC] Total minutos: ${totalMinutes}`);
    console.log(`⏰ [WEEKLY CALC] Total horas: ${totalMinutes / 60}`);
    console.log(`⏰ [WEEKLY CALC] Arredondado: ${Math.round(totalMinutes / 60)}`);
    
    return totalMinutes;
  };

  // Calculate lunch hours (11:00-15:00 range)
  const calculateLunchHours = () => {
    if (!selectedMerchant?.operating_hours?.shifts) return 0;
    
    return selectedMerchant.operating_hours.shifts.filter(shift => {
      const startHour = parseInt(shift.start.split(':')[0]);
      return startHour >= 11 && startHour <= 15;
    }).length;
  };

  // Calculate dinner hours (18:00-23:00 range)  
  const calculateDinnerHours = () => {
    if (!selectedMerchant?.operating_hours?.shifts) return 0;
    
    return selectedMerchant.operating_hours.shifts.filter(shift => {
      const startHour = parseInt(shift.start.split(':')[0]);
      return startHour >= 18 && startHour <= 23;
    }).length;
  };

  // Format time from HH:MM:SS to HH:MM
  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  // Calculate end time from start + duration
  const calculateEndTime = (start: string, duration: number) => {
    const [hours, minutes] = start.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + duration;
    
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  // Handle scheduled pause creation
  const handleCreateScheduledPause = async () => {
    if (!selectedMerchant || !pauseStartDate || !pauseStartTime || !pauseEndDate || !pauseEndTime || !pauseDescription || !user?.id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingPause(true);

      // Combine date and time with Brazilian timezone offset
      const startDateTime = new Date(pauseStartDate);
      startDateTime.setHours(parseInt(pauseStartTime.split(':')[0]), parseInt(pauseStartTime.split(':')[1]), 0, 0);
      
      const endDateTime = new Date(pauseEndDate);
      endDateTime.setHours(parseInt(pauseEndTime.split(':')[0]), parseInt(pauseEndTime.split(':')[1]), 0, 0);

      // Send as local datetime strings without timezone conversion
      // The backend will handle timezone properly for both iFood API and database
      const localStartDateTime = startDateTime.toISOString();
      const localEndDateTime = endDateTime.toISOString();

      // Validate dates
      if (endDateTime <= startDateTime) {
        toast({
          title: "Erro",
          description: "Data/hora de fim deve ser posterior ao início.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`http://localhost:8093/merchants/${selectedMerchant.merchant_id}/interruptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: localStartDateTime,
          endDate: localEndDateTime,
          description: pauseDescription,
          reason: pauseReason,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao criar pausa programada');
      }

      toast({
        title: "Sucesso",
        description: `Pausa programada criada de ${startDateTime.toLocaleString('pt-BR')} até ${endDateTime.toLocaleString('pt-BR')}`,
      });

      // Close modal and reset form
      setIsPauseModalOpen(false);
      setPauseStartDate(undefined);
      setPauseStartTime('');
      setPauseEndDate(undefined);
      setPauseEndTime('');
      setPauseDescription('');
      setPauseReason('');

      // Refresh the scheduled pauses list
      setTimeout(() => {
        fetchScheduledPauses();
      }, 1000);

    } catch (error: any) {
      console.error('Error creating scheduled pause:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar pausa programada.",
        variant: "destructive",
      });
    } finally {
      setCreatingPause(false);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (dayToDelete: string) => {
    setDayToDelete(dayToDelete);
    setIsDeleteModalOpen(true);
  };

  // Handle delete opening hours for a specific day
  const handleDeleteOpeningHours = async () => {
    if (!selectedMerchant || !user?.id || !dayToDelete) {
      toast({
        title: "Erro",
        description: "Dados do merchant não encontrados.",
        variant: "destructive",
      });
      return;
    }

    try {
      setDeletingDay(dayToDelete);

      const response = await fetch(`http://localhost:8093/merchants/${selectedMerchant.merchant_id}/opening-hours/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayOfWeek: dayToDelete,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao deletar horário');
      }

      const dayName = DAYS_MAPPING[dayToDelete as keyof typeof DAYS_MAPPING];
      
      toast({
        title: "Sucesso",
        description: `Loja fechada na ${dayName}. Outros dias mantidos.`,
      });

      // Close modal and refresh data
      setIsDeleteModalOpen(false);
      setDayToDelete('');

      // Atualização imediata e suave após operação
      setTimeout(() => {
        fetchMerchants(true); // Silent update
      }, 2000);

    } catch (error: any) {
      console.error('Error deleting opening hours:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao deletar horário.",
        variant: "destructive",
      });
    } finally {
      setDeletingDay(null);
    }
  };

  // Handle opening hours update
  const handleUpdateOpeningHours = async () => {
    if (!selectedMerchant || !selectedDay || !startTime || !endTime || !user?.id) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch(`http://localhost:8093/merchants/${selectedMerchant.merchant_id}/opening-hours`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayOfWeek: selectedDay,
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao atualizar horários');
      }

      toast({
        title: "Sucesso",
        description: result.message,
      });

      // Close modal and refresh data
      setIsModalOpen(false);
      setSelectedDay('');
      setStartTime('08:00');
      setEndTime('18:00');

      // Atualização imediata e suave após operação
      setTimeout(() => {
        fetchMerchants(true); // Silent update
      }, 2000);

    } catch (error: any) {
      console.error('Error updating opening hours:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao atualizar horários de funcionamento.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in pb-6 pt-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Horário de funcionamento
            </h1>
            <p className="text-gray-600">
              Escolha os dias e horários que sua loja receberá pedidos.
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Carregando horários...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (merchants.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in pb-6 pt-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Horário de funcionamento
            </h1>
            <p className="text-gray-600">
              Escolha os dias e horários que sua loja receberá pedidos.
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum merchant com horários de funcionamento encontrado. Execute a sincronização primeiro.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentShifts = selectedMerchant?.operating_hours?.shifts || [];
  // Usando dados calculados localmente
  const weeklyHours = Math.round(calculateWeeklyHours() / 60);
  const lunchHours = realPeakHours.lunchHours;
  const dinnerHours = realPeakHours.dinnerHours;

  return (
    <div className="space-y-6 animate-fade-in pb-6 pt-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 mt-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Horário de funcionamento
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Escolha os dias e horários que sua loja receberá pedidos.
          </p>
        </div>
      </div>

      {/* Tabs for Horários and Pausas */}
      <Tabs defaultValue="horarios" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="horarios">Horários de Funcionamento</TabsTrigger>
          <TabsTrigger value="pausas">Pausas Programadas</TabsTrigger>
        </TabsList>

        <TabsContent value="horarios" className="space-y-6">
          {/* Merchant Selector (igual ao iFood) */}
          <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="mb-6">
              <Select
                value={selectedMerchant?.merchant_id}
                onValueChange={(value) => {
                  const merchant = merchants.find(m => m.merchant_id === value);
                  setSelectedMerchant(merchant || null);
                }}
              >
                <SelectTrigger className="w-64 border-red-300 focus:border-red-500">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
                      <Store className="h-4 w-4 text-white" />
                    </div>
                    <SelectValue placeholder="Site/App iFood" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {merchants.map((merchant) => (
                    <SelectItem key={merchant.merchant_id} value={merchant.merchant_id}>
                      {merchant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  console.log('Abrindo modal de horários');
                  setIsModalOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2"
              >
                Adicionar horário
              </Button>
            </div>
          </div>


          {/* Statistics Cards (igual ao iFood) */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card className="text-center py-8">
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-white">{weeklyHours}h</div>
                <div className="text-sm text-white mt-2">Total na semana</div>
              </CardContent>
            </Card>
            
            <Card className="text-center py-8">
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-white">{lunchHours}h</div>
                <div className="text-sm text-red-500 mt-2">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  No pico de almoço iFood
                </div>
              </CardContent>
            </Card>
            
            <Card className="text-center py-8">
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-white">{dinnerHours}h</div>
                <div className="text-sm text-red-500 mt-2">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  No pico de janta iFood
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Schedule Grid with Time Ruler (igual ao iFood) */}
          <div className="flex gap-4">
            {/* Time Ruler */}
            <div className="relative text-xs text-gray-500 dark:text-gray-300" style={{ height: '390px', width: '40px', marginTop: '110px' }}>
              {Array.from({ length: 13 }, (_, index) => {
                const hour = index * 2; // 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24
                const topPercentage = (hour / 24) * 100;
                return (
                  <div 
                    key={hour} 
                    className="absolute text-right w-full"
                    style={{ top: `${topPercentage}%` }}
                  >
                    <div className="pr-2">{hour}h</div>
                    <div className="absolute right-0 top-0 w-2 h-px bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                );
              })}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2 flex-1">
            {DAYS_ORDER.map((day) => {
              const shift = currentShifts.find(s => s.dayOfWeek === day);
              const isOpen = !!shift;
              
              return (
                <div key={day} className="text-center">
                  <div className="font-medium text-sm mb-8 text-gray-700 dark:text-gray-200" style={{ height: '20px' }}>
                    {DAYS_MAPPING[day as keyof typeof DAYS_MAPPING]}
                  </div>
                  
                  {isOpen && shift ? (
                    <div className="space-y-6">
                      <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1">
                        {shift.duration >= 1430 ? 'Aberta por 24h' : `Aberta por ${Math.floor(shift.duration / 60)}h`}
                      </Badge>
                      
                      <div className="relative" style={{ height: '400px' }}>
                        {/* Calculate block position and height based on time */}
                        {(() => {
                          const startHour = parseInt(shift.start.split(':')[0]);
                          const startMinutes = parseInt(shift.start.split(':')[1]) || 0;
                          const totalStartMinutes = (startHour * 60) + startMinutes;
                          
                          // Position from top (0h = 0%, 24h = 100%)
                          const topPercentage = (totalStartMinutes / (24 * 60)) * 100;
                          
                          // Height based on duration
                          const heightPercentage = (shift.duration / (24 * 60)) * 100;
                          
                          // Debug log
                          if (day === 'TUESDAY') {
                            console.log(`TUESDAY Debug:`, {
                              start: shift.start,
                              startHour,
                              startMinutes,
                              totalStartMinutes,
                              duration: shift.duration,
                              topPercentage,
                              heightPercentage
                            });
                          }
                          
                          return (
                            <div 
                              className="bg-green-100 rounded-lg hover:bg-green-200 transition-colors absolute w-full flex flex-col justify-between px-2 py-1 group"
                              style={{
                                top: `${topPercentage}%`,
                                height: `${heightPercentage}%`,
                                minHeight: '40px'
                              }}
                            >
                              {/* Delete button (top right) */}
                              <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 w-6 p-0 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteModal(day);
                                  }}
                                  disabled={deletingDay === day}
                                >
                                  {deletingDay === day ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <X className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>

                              {/* Clickable area for edit */}
                              <div 
                                className="flex flex-col justify-between h-full cursor-pointer relative overflow-hidden"
                                onClick={() => {
                                  // Show modal with edit/delete options
                                  setSelectedDay(day);
                                  setStartTime(formatTime(shift.start));
                                  setEndTime(calculateEndTime(shift.start, shift.duration));
                                  setIsModalOpen(true);
                                }}
                              >

                                {/* Start time at top */}
                                <div className="text-xs text-green-700 font-medium relative z-10">
                                  {formatTime(shift.start)}
                                </div>
                                
                                {/* End time at bottom (only if block is tall enough) */}
                                {shift.duration > 120 && (
                                  <div className="text-xs text-green-700 font-medium self-end relative z-10">
                                    {calculateEndTime(shift.start, shift.duration)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs px-2 py-1">
                        Fechado
                      </Badge>
                      
                      <div 
                        className="bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors border-2 border-dashed border-gray-300 flex items-center justify-center"
                        style={{ height: '400px' }}
                        onClick={() => {
                          setSelectedDay(day);
                          setStartTime('08:00');
                          setEndTime('18:00');
                          setIsModalOpen(true);
                        }}
                      >
                        <div className="text-center text-gray-500">
                          <Plus className="h-6 w-6 mx-auto mb-2" />
                          <div className="text-xs">Adicionar<br />horário</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>

          {/* Last updated info */}
          {selectedMerchant?.operating_hours?.last_updated && (
            <div className="text-sm text-gray-500 text-center mt-6">
              Última atualização: {new Date(selectedMerchant.operating_hours.last_updated).toLocaleString('pt-BR')}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="pausas" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6">
                <div className="mb-6">
                  <Select
                    value={selectedMerchant?.merchant_id}
                    onValueChange={(value) => {
                      const merchant = merchants.find(m => m.merchant_id === value);
                      setSelectedMerchant(merchant || null);
                    }}
                  >
                    <SelectTrigger className="w-64 border-orange-300 focus:border-orange-500">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center">
                          <Store className="h-4 w-4 text-white" />
                        </div>
                        <SelectValue placeholder="Site/App iFood" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {merchants.map((merchant) => (
                        <SelectItem key={merchant.merchant_id} value={merchant.merchant_id}>
                          {merchant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => {
                      setIsPauseModalOpen(true);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Nova Pausa Programada
                  </Button>
                  <Button
                    onClick={() => syncScheduledPausesFromiFood(true)}
                    variant="outline"
                    disabled={syncingPauses}
                    className="flex items-center space-x-2 bg-green-50 hover:bg-green-100 border-green-300"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingPauses ? 'animate-spin' : ''}`} />
                    <span>Sincronizar iFood</span>
                  </Button>
                  <Button
                    onClick={fetchScheduledPauses}
                    variant="outline"
                    disabled={loadingPauses}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingPauses ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </Button>
                </div>
              </div>

              {/* Scheduled Pauses List */}
              {loadingPauses ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-muted-foreground">Carregando pausas...</span>
                </div>
              ) : scheduledPauses.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <div className="text-muted-foreground mb-2">Nenhuma pausa programada</div>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Nova Pausa Programada" para criar uma pausa temporária
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledPauses.map((pause) => (
                    <div key={pause.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className={pause.isActive ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}>
                              {pause.isActive ? 'Ativa' : 'Expirada'}
                            </Badge>
                            <h4 className="font-medium text-foreground">
                              {pause.description}
                            </h4>
                          </div>
                          
                          {pause.reason && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {pause.reason}
                            </p>
                          )}
                          
                          <div className="text-sm text-muted-foreground">
                            <div>Início: {new Date(pause.startDate).toLocaleString('pt-BR')}</div>
                            <div>Fim: {new Date(pause.endDate).toLocaleString('pt-BR')}</div>
                          </div>
                        </div>
                        
                        {pause.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelPause(pause.id)}
                            disabled={cancelingPause === pause.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {cancelingPause === pause.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Cancelando...
                              </>
                            ) : (
                              'Cancelar'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Hours Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Escolha os dias e horários que a loja vai abrir
            </DialogTitle>
            <DialogDescription>
              Configure os horários de funcionamento da sua loja.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Service selector (simulando iFood) */}
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                <Store className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Site/App</div>
                <div className="text-sm text-gray-600">iFood</div>
              </div>
            </div>

            {/* Day selector pills */}
            <div className="space-y-2">
              <Label>Escolha os dias da semana:</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_ORDER.map((day) => (
                  <Button
                    key={day}
                    variant={selectedDay === day ? "default" : "outline"}
                    size="sm"
                    className={selectedDay === day ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => setSelectedDay(day)}
                  >
                    {DAYS_MAPPING[day as keyof typeof DAYS_MAPPING].substring(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Time range selector */}
            <div className="space-y-2">
              <Label>Selecione o horário em que a loja ficará aberta:</Label>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="custom-time" 
                    name="time-option" 
                    checked={true}
                    readOnly
                    className="text-red-600"
                  />
                  <label htmlFor="custom-time" className="text-sm">
                    Abrir a loja das
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowStartTimePicker(true)}
                    className="w-24 h-8 text-sm"
                  >
                    {startTime}
                  </Button>
                  <span className="text-sm">até</span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEndTimePicker(true)}
                    className="w-24 h-8 text-sm"
                  >
                    {endTime}
                  </Button>
                  
                  {/* Simple trash icon for existing shifts */}
                  {selectedDay && currentShifts.find(s => s.dayOfWeek === selectedDay) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsModalOpen(false);
                        openDeleteModal(selectedDay);
                      }}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                      title="Fechar neste dia"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 opacity-50">
                  <input type="radio" disabled className="text-red-600" />
                  <label className="text-sm text-gray-500">
                    Usar horário de pico do iFood no almoço (11:00 - 15:00)
                  </label>
                </div>
                
                <div className="flex items-center space-x-2 opacity-50">
                  <input type="radio" disabled className="text-red-600" />
                  <label className="text-sm text-gray-500">
                    Usar horário de pico do iFood na janta (18:00 - 23:00)
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateOpeningHours}
              disabled={updating || !selectedDay || !startTime || !endTime}
              className="bg-red-600 hover:bg-red-700"
            >
              {updating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar horários'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheduled Pause Modal */}
      <Dialog open={isPauseModalOpen} onOpenChange={setIsPauseModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Pausa Programada
            </DialogTitle>
            <DialogDescription>
              Configure uma pausa temporária para sua loja. A loja ficará fechada durante o período selecionado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Start Date/Time */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Início da Pausa</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !pauseStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pauseStartDate ? format(pauseStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={pauseStartDate}
                        onSelect={setPauseStartDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pauseStartTime">Hora</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPauseStartTimePicker(true)}
                    className="w-full h-10 justify-start text-sm"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {pauseStartTime || 'Selecionar hora'}
                  </Button>
                </div>
              </div>
            </div>

            {/* End Date/Time */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Fim da Pausa</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !pauseEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pauseEndDate ? format(pauseEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={pauseEndDate}
                        onSelect={setPauseEndDate}
                        disabled={(date) => date < (pauseStartDate || new Date())}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pauseEndTime">Hora</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPauseEndTimePicker(true)}
                    className="w-full h-10 justify-start text-sm"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {pauseEndTime || 'Selecionar hora'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Description and Reason */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pauseDescription">Motivo da Pausa *</Label>
                <Input
                  id="pauseDescription"
                  placeholder="Ex: Manutenção dos equipamentos, Feriado, etc."
                  value={pauseDescription}
                  onChange={(e) => setPauseDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pauseReason">Detalhes (opcional)</Label>
                <Input
                  id="pauseReason"
                  placeholder="Informações adicionais sobre a pausa"
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                />
              </div>
            </div>

            {/* Preview */}
            {pauseStartDate && pauseStartTime && pauseEndDate && pauseEndTime && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Pausa programada:</strong><br />
                  De: {(() => {
                    const start = new Date(pauseStartDate);
                    start.setHours(parseInt(pauseStartTime.split(':')[0]), parseInt(pauseStartTime.split(':')[1]));
                    return start.toLocaleString('pt-BR');
                  })()}<br />
                  Até: {(() => {
                    const end = new Date(pauseEndDate);
                    end.setHours(parseInt(pauseEndTime.split(':')[0]), parseInt(pauseEndTime.split(':')[1]));
                    return end.toLocaleString('pt-BR');
                  })()}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPauseModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateScheduledPause}
              disabled={creatingPause || !pauseStartDate || !pauseStartTime || !pauseEndDate || !pauseEndTime || !pauseDescription}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {creatingPause ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Programar Pausa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dayToDelete && (
                <span>
                  {DAYS_MAPPING[dayToDelete as keyof typeof DAYS_MAPPING]?.toLowerCase()} - {
                    (() => {
                      const shift = currentShifts.find(s => s.dayOfWeek === dayToDelete);
                      return shift ? `${formatTime(shift.start)}-${calculateEndTime(shift.start, shift.duration)}` : '';
                    })()
                  }
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Deseja excluir o horário cadastrado?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleDeleteOpeningHours}
              disabled={deletingDay === dayToDelete}
              className="bg-red-600 hover:bg-red-700 flex-1"
            >
              {deletingDay === dayToDelete ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Picker Modals */}
      <TimePicker
        isOpen={showStartTimePicker}
        onClose={() => setShowStartTimePicker(false)}
        onTimeSelect={setStartTime}
        title="Selecionar Horário de Abertura"
        initialTime={startTime}
      />

      <TimePicker
        isOpen={showEndTimePicker}
        onClose={() => setShowEndTimePicker(false)}
        onTimeSelect={setEndTime}
        title="Selecionar Horário de Fechamento"
        initialTime={endTime}
      />

      <TimePicker
        isOpen={showPauseStartTimePicker}
        onClose={() => setShowPauseStartTimePicker(false)}
        onTimeSelect={setPauseStartTime}
        title="Início da Pausa"
        initialTime={pauseStartTime}
      />

      <TimePicker
        isOpen={showPauseEndTimePicker}
        onClose={() => setShowPauseEndTimePicker(false)}
        onTimeSelect={setPauseEndTime}
        title="Final da Pausa"
        initialTime={pauseEndTime}
      />
    </div>
  );
}