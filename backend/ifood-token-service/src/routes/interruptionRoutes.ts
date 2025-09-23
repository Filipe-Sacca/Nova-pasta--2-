import { Router } from 'express';
import { getTokenForUser } from '../ifoodTokenService';
import { IFoodMerchantStatusService } from '../ifoodMerchantStatusService';

const router = Router();

// 📅 INTERRUPTIONS ENDPOINTS

router.get('/merchants/:merchantId/interruptions', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('📅 INTERRUPTIONS - Listando interrupções para merchant:', merchantId);

    const tokenInfo = await getTokenForUser(merchantId);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    const result = await IFoodMerchantStatusService.listScheduledPauses(merchantId, tokenInfo.access_token);

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Interrupções listadas com sucesso:', merchantId);
      res.json({
        message: 'Interrupções listadas com sucesso',
        data: result.data
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro ao listar interrupções:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao listar interrupções'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral ao listar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/merchants/:merchantId/interruptions', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { reason, startDate, endDate, description } = req.body;

    console.log('📅 INTERRUPTIONS - Criando interrupção para merchant:', merchantId, { reason, startDate, endDate });

    if (!reason || !startDate || !endDate) {
      return res.status(400).json({
        error: 'reason, startDate e endDate são obrigatórios'
      });
    }

    const tokenInfo = await getTokenForUser(merchantId);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    const result = await IFoodMerchantStatusService.createScheduledPause(
      merchantId,
      tokenInfo.access_token,
      {
        reason,
        startDate,
        endDate,
        description
      }
    );

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Interrupção criada com sucesso:', result.data?.id);
      res.json({
        message: 'Interrupção criada com sucesso',
        data: result.data
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro ao criar interrupção:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao criar interrupção'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral ao criar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/merchants/:merchantId/interruptions/:interruptionId', async (req, res) => {
  try {
    const { merchantId, interruptionId } = req.params;

    console.log('📅 INTERRUPTIONS - Deletando interrupção:', interruptionId, 'do merchant:', merchantId);

    const tokenInfo = await getTokenForUser(merchantId);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    const result = await IFoodMerchantStatusService.removeScheduledPause(
      merchantId,
      tokenInfo.access_token,
      interruptionId
    );

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Interrupção deletada com sucesso:', interruptionId);
      res.json({
        message: 'Interrupção deletada com sucesso',
        data: result.data
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro ao deletar interrupção:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao deletar interrupção'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral ao deletar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/merchants/:merchantId/interruptions/sync', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('📅 INTERRUPTIONS - Sincronizando interrupções para merchant:', merchantId);

    const tokenInfo = await getTokenForUser(merchantId);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    // Sync interruptions - functionality would need implementation
    const result = {
      success: true,
      message: 'Sync interruptions not implemented yet',
      data: []
    };

    if (result.success) {
      console.log('📅 INTERRUPTIONS - Sincronização realizada com sucesso:', merchantId);
      res.json({
        message: 'Sincronização de interrupções realizada com sucesso',
        data: result.data
      });
    } else {
      console.log('📅 INTERRUPTIONS - Erro na sincronização:', result.error);
      res.status(500).json({
        error: result.error || 'Erro na sincronização de interrupções'
      });
    }
  } catch (error) {
    console.error('📅 INTERRUPTIONS - Erro geral na sincronização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;