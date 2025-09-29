import { IFoodMerchantService } from './ifoodMerchantService';
import { IFoodMerchantStatusService } from './ifoodMerchantStatusService';
import { IFoodTokenService } from './ifoodTokenService';

interface Token {
  user_id: string;
  access_token: string;
  client_id: string;
}

export class MerchantPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly POLLING_INTERVAL = 30000; // 30 segundos
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL!;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!;
  }

  /**
   * Inicia o polling de merchants a cada 30 segundos
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 MERCHANT POLLING - Já está em execução');
      return;
    }

    console.log('🚀 MERCHANT POLLING - Iniciando polling a cada 30 segundos');
    this.isRunning = true;

    // Executa imediatamente na primeira vez
    await this.executePoll();

    // Configura intervalo para execuções futuras
    this.intervalId = setInterval(async () => {
      await this.executePoll();
    }, this.POLLING_INTERVAL);

    console.log('✅ MERCHANT POLLING - Polling iniciado com sucesso');
  }

  /**
   * Para o polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 MERCHANT POLLING - Polling parado');
  }

  /**
   * Verifica se o polling está ativo
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Executa um ciclo completo de polling
   */
  private async executePoll(): Promise<void> {
    try {
      console.log('🔄 MERCHANT POLLING - Iniciando ciclo de polling');
      const startTime = Date.now();

      // 1. Buscar todos os tokens disponíveis
      const tokens = await this.getAvailableTokens();

      if (tokens.length === 0) {
        console.log('⚠️ MERCHANT POLLING - Nenhum token disponível, pulando ciclo');
        return;
      }

      console.log(`🔑 MERCHANT POLLING - Encontrados ${tokens.length} tokens para processar`);

      // 2. Processar cada token
      let totalMerchantsProcessed = 0;
      let totalStatusUpdated = 0;

      for (const token of tokens) {
        try {
          const result = await this.processMerchantsForToken(token);
          totalMerchantsProcessed += result.merchantsProcessed;
          totalStatusUpdated += result.statusUpdated;
        } catch (error) {
          console.error(`❌ MERCHANT POLLING - Erro ao processar token ${token.user_id}:`, error);
          // Continua com próximo token mesmo se um falhar
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ MERCHANT POLLING - Ciclo concluído em ${duration}ms`);
      console.log(`📊 MERCHANT POLLING - Merchants processados: ${totalMerchantsProcessed}, Status atualizados: ${totalStatusUpdated}`);

    } catch (error) {
      console.error('❌ MERCHANT POLLING - Erro geral no ciclo de polling:', error);
    }
  }

  /**
   * Busca todos os tokens válidos disponíveis
   */
  private async getAvailableTokens(): Promise<Token[]> {
    try {
      const tokenService = new IFoodTokenService(this.supabaseUrl, this.supabaseKey);
      const result = await tokenService.getAllValidTokens();

      if (result.success) {
        return result.tokens || [];
      } else {
        console.error('❌ MERCHANT POLLING - Erro ao buscar tokens:', result.error);
        return [];
      }
    } catch (error) {
      console.error('❌ MERCHANT POLLING - Erro ao buscar tokens:', error);
      return [];
    }
  }

  /**
   * Processa merchants para um token específico
   */
  private async processMerchantsForToken(token: Token): Promise<{ merchantsProcessed: number; statusUpdated: number }> {
    console.log(`🏪 MERCHANT POLLING - Processando merchants para token ${token.user_id}`);

    const merchantService = new IFoodMerchantService(this.supabaseUrl, this.supabaseKey);
    let merchantsProcessed = 0;
    let statusUpdated = 0;

    try {
      // 1. Buscar merchants da API do iFood
      const { success, merchants } = await merchantService.fetchMerchantsFromIFood(token.access_token);

      if (!success) {
        console.error(`❌ MERCHANT POLLING - Erro ao buscar merchants da API para token ${token.user_id}`);
        return { merchantsProcessed: 0, statusUpdated: 0 };
      }

      const merchantList = merchants as any[];
      console.log(`📋 MERCHANT POLLING - Encontrados ${merchantList.length} merchants na API para token ${token.user_id}`);

      // 2. Salvar/atualizar merchants no banco
      for (const ifoodMerchant of merchantList) {
        try {
          // Verificar se merchant já existe
          const exists = await merchantService.checkMerchantExists(ifoodMerchant.id);

          if (!exists) {
            // Preparar dados do merchant para salvar
            const merchantData = {
              merchant_id: ifoodMerchant.id,
              name: ifoodMerchant.name,
              corporate_name: ifoodMerchant.corporateName || ifoodMerchant.name,
              user_id: token.user_id,
              client_id: token.client_id || '',
              status: true, // Valor padrão
              description: ifoodMerchant.description || null,
              phone: ifoodMerchant.phone || null,
              address_street: ifoodMerchant.address?.street || null,
              address_number: ifoodMerchant.address?.number || null,
              address_complement: ifoodMerchant.address?.complement || null,
              address_neighborhood: ifoodMerchant.address?.neighborhood || null,
              address_city: ifoodMerchant.address?.city || null,
              address_state: ifoodMerchant.address?.state || null,
              postalCode: ifoodMerchant.address?.postalCode || null,
              address_country: ifoodMerchant.address?.country || 'BR',
              operating_hours: ifoodMerchant.operatingHours || null,
              type: ifoodMerchant.type || null,
              latitude: ifoodMerchant.latitude || null,
              longitude: ifoodMerchant.longitude || null,
              last_sync_at: new Date().toISOString()
            };

            const storeResult = await merchantService.storeMerchant(merchantData);
            if (storeResult.success) {
              console.log(`➕ MERCHANT POLLING - Novo merchant salvo: ${ifoodMerchant.name}`);
            }
          }

          merchantsProcessed++;

          // 3. Buscar e atualizar status do merchant
          const statusResult = await IFoodMerchantStatusService.fetchMerchantStatus(
            ifoodMerchant.id,
            token.access_token
          );

          if (statusResult.success && statusResult.data) {
            const statusData = statusResult.data;

            // Extrair campo 'available' da resposta
            let available = false;
            if (Array.isArray(statusData) && statusData.length > 0) {
              available = statusData[0]?.available || false;
            } else if (statusData.available !== undefined) {
              available = statusData.available;
            }

            // Atualizar status na tabela
            const updateResult = await merchantService.updateMerchantStatus(ifoodMerchant.id, available);
            if (updateResult.success) {
              statusUpdated++;
              console.log(`🔄 MERCHANT POLLING - Status atualizado para ${ifoodMerchant.name}: ${available ? 'aberto' : 'fechado'}`);
            }
          }

          // 4. Buscar e sincronizar horários de funcionamento
          try {
            console.log(`🕐 MERCHANT POLLING - Sincronizando horários para ${ifoodMerchant.name}`);
            const hoursResult = await IFoodMerchantStatusService.fetchOpeningHours(
              ifoodMerchant.id,
              token.access_token
            );

            if (hoursResult.success && hoursResult.hours.length > 0) {
              const saveResult = await IFoodMerchantStatusService.saveOpeningHoursToDatabase(
                ifoodMerchant.id,
                hoursResult.hours
              );

              if (saveResult) {
                console.log(`✅ MERCHANT POLLING - Horários sincronizados para ${ifoodMerchant.name}: ${hoursResult.hours.length} turnos`);
              } else {
                console.log(`⚠️ MERCHANT POLLING - Falha ao salvar horários para ${ifoodMerchant.name}`);
              }
            }
          } catch (hoursError) {
            console.error(`❌ MERCHANT POLLING - Erro ao sincronizar horários para ${ifoodMerchant.name}:`, hoursError);
          }

        } catch (merchantError) {
          console.error(`❌ MERCHANT POLLING - Erro ao processar merchant ${ifoodMerchant.name}:`, merchantError);
          // Continua com próximo merchant
        }
      }

    } catch (error) {
      console.error(`❌ MERCHANT POLLING - Erro geral ao processar token ${token.user_id}:`, error);
    }

    return { merchantsProcessed, statusUpdated };
  }
}