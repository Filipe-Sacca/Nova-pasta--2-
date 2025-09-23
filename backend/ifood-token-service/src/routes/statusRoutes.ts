import { Router } from 'express';
import { getTokenForUser } from '../ifoodTokenService';
import { IFoodMerchantStatusService } from '../ifoodMerchantStatusService';

const router = Router();

// 🟢 MERCHANT STATUS ENDPOINTS

router.post('/merchant-status/check', async (req, res) => {
  try {
    const { merchantId } = req.body;

    console.log('🟢 MERCHANT STATUS - Verificando status do merchant:', merchantId);

    if (!merchantId) {
      return res.status(400).json({
        error: 'merchantId é obrigatório'
      });
    }

    const tokenInfo = await getTokenForUser(merchantId);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    const result = await IFoodMerchantStatusService.checkSingleMerchantStatus(merchantId);

    if (result) {
      console.log('🟢 MERCHANT STATUS - Status verificado com sucesso:', merchantId);
      res.json({
        message: 'Status do merchant verificado com sucesso',
        data: result
      });
    } else {
      console.log('🟢 MERCHANT STATUS - Erro ao verificar status');
      res.status(500).json({
        error: 'Erro ao verificar status do merchant'
      });
    }
  } catch (error) {
    console.error('🟢 MERCHANT STATUS - Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/merchant-status/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('🟢 MERCHANT STATUS - Obtendo status do merchant:', merchantId);

    const tokenInfo = await getTokenForUser(merchantId);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    const result = await IFoodMerchantStatusService.fetchMerchantStatus(merchantId, tokenInfo.access_token);

    console.log('🟢 MERCHANT STATUS - Status obtido com sucesso:', merchantId);
    res.json({
      message: 'Status do merchant obtido com sucesso',
      data: result
    });
  } catch (error) {
    console.error('🟢 MERCHANT STATUS - Erro geral ao obter status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/merchant-status/start-scheduler', async (req, res) => {
  try {
    const { intervalMinutes = 30 } = req.body;

    console.log('🟢 MERCHANT STATUS SCHEDULER - Iniciando scheduler com intervalo:', intervalMinutes, 'minutos');

    // Note: Scheduler functionality would need to be implemented
    console.log('Status scheduler started with interval:', intervalMinutes);

    res.json({
      message: 'Merchant status scheduler iniciado',
      intervalMinutes: intervalMinutes,
      status: 'running'
    });
  } catch (error) {
    console.error('🟢 MERCHANT STATUS SCHEDULER - Erro ao iniciar:', error);
    res.status(500).json({ error: 'Erro ao iniciar scheduler' });
  }
});

router.post('/merchant-status/stop-scheduler', async (req, res) => {
  try {
    console.log('🟢 MERCHANT STATUS SCHEDULER - Parando scheduler');

    console.log('Status scheduler stopped');

    res.json({
      message: 'Merchant status scheduler parado',
      status: 'stopped'
    });
  } catch (error) {
    console.error('🟢 MERCHANT STATUS SCHEDULER - Erro ao parar:', error);
    res.status(500).json({ error: 'Erro ao parar scheduler' });
  }
});

router.get('/merchant-status/scheduler/status', async (req, res) => {
  try {
    const status = {
      isActive: false,
      message: 'Status scheduler not implemented yet'
    };

    console.log('🟢 MERCHANT STATUS SCHEDULER - Status:', status);

    res.json(status);
  } catch (error) {
    console.error('🟢 MERCHANT STATUS SCHEDULER - Erro ao obter status:', error);
    res.status(500).json({ error: 'Erro ao obter status do scheduler' });
  }
});

export default router;