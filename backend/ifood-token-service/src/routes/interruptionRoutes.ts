import { Router } from 'express';
import { getAnyAvailableToken } from '../ifoodTokenService';
import { IFoodMerchantStatusService } from '../ifoodMerchantStatusService';

const router = Router();

// 📅 INTERRUPTIONS ENDPOINTS

router.get('/merchants/:merchantId/interruptions', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('📅 INTERRUPTIONS - Listando interrupções para merchant:', merchantId);

    // Buscar qualquer token disponível no banco (não depende de user_id específico)
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Nenhum token iFood disponível no sistema. Configure um token primeiro.'
      });
    }

    const result = await IFoodMerchantStatusService.listScheduledPauses(merchantId);

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Interrupções listadas com sucesso:', merchantId);
      res.json({
        success: true,
        message: 'Interrupções listadas com sucesso',
        interruptions: result.data || []
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro ao listar interrupções:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Erro ao listar interrupções'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral ao listar:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

router.post('/merchants/:merchantId/interruptions', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { reason, startDate, endDate, description, userId } = req.body;

    console.log('📅 INTERRUPTIONS - Criando interrupção para merchant:', merchantId, { reason, startDate, endDate });

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate e endDate são obrigatórios'
      });
    }

    // Buscar qualquer token disponível no banco (não depende de user_id específico)
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Nenhum token iFood disponível no sistema. Configure um token primeiro.'
      });
    }

    const result = await IFoodMerchantStatusService.createScheduledPause(
      merchantId,
      startDate,
      endDate,
      description || reason || 'Pausa programada',
      tokenInfo.access_token,
      userId,
      reason
    );

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Interrupção criada com sucesso:', result.data?.id);
      res.json({
        success: true,
        message: 'Interrupção criada com sucesso',
        data: result.data
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro ao criar interrupção:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Erro ao criar interrupção'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral ao criar:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

router.delete('/merchants/:merchantId/interruptions/:interruptionId', async (req, res) => {
  try {
    const { merchantId, interruptionId } = req.params;

    console.log('📅 INTERRUPTIONS - Deletando interrupção:', interruptionId, 'do merchant:', merchantId);

    // Validate parameters
    if (!merchantId || !interruptionId) {
      console.error('❌ Invalid parameters - merchantId:', merchantId, 'interruptionId:', interruptionId);
      return res.status(400).json({
        success: false,
        error: 'Parameters merchantId and interruptionId are required'
      });
    }

    // Buscar qualquer token disponível no banco (não depende de user_id específico)
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Nenhum token iFood disponível no sistema. Configure um token primeiro.'
      });
    }

    const result = await IFoodMerchantStatusService.removeScheduledPause(
      merchantId,
      interruptionId,
      tokenInfo.access_token
    );

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Interrupção deletada com sucesso:', interruptionId);
      res.json({
        success: true,
        message: 'Interrupção deletada com sucesso',
        data: result.data
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro ao deletar interrupção:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Erro ao deletar interrupção'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral ao deletar:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

router.post('/merchants/:merchantId/interruptions/sync', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('📅 INTERRUPTIONS - Sincronizando interrupções para merchant:', merchantId);

    // Buscar qualquer token disponível no banco (não depende de user_id específico)
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Nenhum token iFood disponível no sistema. Configure um token primeiro.'
      });
    }

    // Sync interruptions with iFood API
    const result = await IFoodMerchantStatusService.syncInterruptionsWithiFood(
      merchantId,
      tokenInfo.access_token
    );

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Sincronização realizada com sucesso:', merchantId);
      res.json({
        success: true,
        message: 'Sincronização de interrupções realizada com sucesso',
        new_interruptions: result.new_interruptions,
        updated_interruptions: result.updated_interruptions,
        deleted_interruptions: result.deleted_interruptions
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro na sincronização:', result.message);
      res.status(500).json({
        success: false,
        error: result.message || 'Erro na sincronização de interrupções'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral na sincronização:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

export default router;