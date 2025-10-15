/**
 * Status Polling Service
 *
 * Serviço simplificado e otimizado para polling de status dos merchants a cada 30 segundos.
 *
 * O QUE FAZ:
 * - ✅ Busca STATUS dos merchants do iFood a cada 30s
 * - ✅ Atualiza status no banco de dados
 * - ✅ Usa opening hours em CACHE (não busca repetidamente)
 *
 * O QUE NÃO FAZ:
 * - ❌ NÃO busca opening hours (usa cache do banco)
 * - ❌ NÃO busca lista de merchants da API (usa banco local)
 * - ❌ NÃO faz sync de produtos/categorias
 */

import { IFoodMerchantStatusService } from './ifoodMerchantStatusService';
import { getSupabaseClient, getTokenForUser } from './ifoodTokenService';

const supabase = getSupabaseClient();

interface Merchant {
  merchant_id: string;
  user_id: string;
  name: string;
  status: boolean;
  operating_hours?: any;
}

export class StatusPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly POLLING_INTERVAL = 30000; // 30 segundos EXATO

  /**
   * Inicia o polling de status a cada 30 segundos
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 [STATUS-POLLING] Já está em execução');
      return;
    }

    console.log('🚀 [STATUS-POLLING] Iniciando polling a cada 30 segundos');
    console.log('📋 [STATUS-POLLING] Função: Apenas verificar STATUS dos merchants');
    console.log('⚠️  [STATUS-POLLING] NÃO busca opening hours (usa cache)');
    this.isRunning = true;

    // Executa imediatamente na primeira vez
    await this.executePollCycle();

    // Configura intervalo para execuções futuras (30s EXATO)
    this.intervalId = setInterval(async () => {
      await this.executePollCycle();
    }, this.POLLING_INTERVAL);

    console.log('✅ [STATUS-POLLING] Polling iniciado com sucesso');
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
    console.log('🛑 [STATUS-POLLING] Polling parado');
  }

  /**
   * Verifica se o polling está ativo
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Executa um ciclo completo de polling de status
   */
  private async executePollCycle(): Promise<void> {
    const cycleStart = Date.now();

    try {
      console.log('\n🔄 ========== STATUS POLLING CYCLE START ==========');
      console.log(`⏰ [STATUS-POLLING] Timestamp: ${new Date().toISOString()}`);

      // 1. Buscar merchants do BANCO LOCAL (não da API)
      const { data: merchants, error } = await supabase
        .from('ifood_merchants')
        .select('merchant_id, user_id, name, status, operating_hours');

      if (error || !merchants || merchants.length === 0) {
        console.log('⚠️ [STATUS-POLLING] Nenhum merchant encontrado no banco');
        return;
      }

      console.log(`🏪 [STATUS-POLLING] Encontrados ${merchants.length} merchants no banco`);

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      // 2. Para cada merchant, buscar APENAS o status
      for (const merchant of merchants as Merchant[]) {
        try {
          const { merchant_id, user_id, operating_hours } = merchant;

          // Validações básicas
          if (!merchant_id || !user_id) {
            skippedCount++;
            continue;
          }

          // Verificar se tem opening hours em cache
          if (!operating_hours || !operating_hours.shifts || operating_hours.shifts.length === 0) {
            console.log(`⚠️ [STATUS-POLLING] Merchant ${merchant_id} sem opening hours em cache - pulando`);
            console.log(`💡 [STATUS-POLLING] TIP: Chame GET /merchants/${merchant_id}/opening-hours para buscar`);
            skippedCount++;
            continue;
          }

          // Buscar token do usuário
          const tokenData = await getTokenForUser(user_id);
          if (!tokenData || !tokenData.access_token) {
            console.warn(`⚠️ [STATUS-POLLING] Token não encontrado para merchant ${merchant_id}`);
            errorCount++;
            continue;
          }

          // 3. Buscar STATUS do iFood (única chamada à API por merchant)
          const { success, data } = await IFoodMerchantStatusService.fetchMerchantStatus(
            merchant_id,
            tokenData.access_token
          );

          if (!success) {
            console.error(`❌ [STATUS-POLLING] Erro ao buscar status de ${merchant_id}`);
            errorCount++;
            continue;
          }

          // 4. Extrair status da resposta
          let isOpen = false;
          if (Array.isArray(data) && data.length > 0) {
            isOpen = data[0]?.available || data[0]?.state === 'OPEN' || false;
          } else if (data) {
            isOpen = data.available || data.state === 'OPEN' || false;
          }

          // 5. Atualizar no banco SOMENTE se mudou
          if (merchant.status !== isOpen) {
            const updated = await IFoodMerchantStatusService.updateMerchantStatus(merchant_id, isOpen);
            if (updated) {
              console.log(`🔄 [STATUS-POLLING] Status atualizado: ${merchant.name} → ${isOpen ? '🟢 ABERTO' : '🔴 FECHADO'}`);
              successCount++;
            }
          } else {
            // Status não mudou, não precisa atualizar
            console.log(`✅ [STATUS-POLLING] Status mantido: ${merchant.name} → ${isOpen ? '🟢' : '🔴'}`);
          }

        } catch (merchantError: any) {
          console.error(`❌ [STATUS-POLLING] Erro ao processar ${merchant.merchant_id}:`, merchantError.message);
          errorCount++;
        }
      }

      const cycleDuration = Date.now() - cycleStart;
      console.log(`\n✅ ========== STATUS POLLING CYCLE END ==========`);
      console.log(`⏰ [STATUS-POLLING] Duração: ${cycleDuration}ms`);
      console.log(`📊 [STATUS-POLLING] Resultados:`);
      console.log(`   - Merchants processados: ${merchants.length}`);
      console.log(`   - Atualizados: ${successCount}`);
      console.log(`   - Erros: ${errorCount}`);
      console.log(`   - Pulados: ${skippedCount}`);
      console.log(`✅ ========== NEXT CYCLE IN 30s ==========\n`);

    } catch (error: any) {
      console.error('❌ [STATUS-POLLING] Erro geral no ciclo:', error.message);
    }
  }

  /**
   * Retorna estatísticas do polling
   */
  getStats(): { isRunning: boolean; interval: number } {
    return {
      isRunning: this.isRunning,
      interval: this.POLLING_INTERVAL
    };
  }
}

// Exportar singleton instance
let statusPollingInstance: StatusPollingService | null = null;

export function getStatusPollingService(): StatusPollingService {
  if (!statusPollingInstance) {
    statusPollingInstance = new StatusPollingService();
  }
  return statusPollingInstance;
}
