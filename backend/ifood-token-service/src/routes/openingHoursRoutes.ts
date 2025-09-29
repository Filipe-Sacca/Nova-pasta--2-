import { Router } from 'express';
import { getAnyAvailableToken } from '../ifoodTokenService';
import { IFoodMerchantStatusService } from '../ifoodMerchantStatusService';

const router = Router();

// 🕐 OPENING HOURS ENDPOINTS

router.get('/merchants/:merchantId/opening-hours', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('🕐 OPENING HOURS - Listando horários para merchant:', merchantId);

    // Buscar qualquer token disponível no banco (não depende de user_id específico)
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Nenhum token iFood disponível no sistema. Configure um token primeiro.'
      });
    }

    const result = await IFoodMerchantStatusService.fetchOpeningHours(merchantId, tokenInfo.access_token);

    if (result.success) {
      console.log('🕐 OPENING HOURS - Horários listados com sucesso:', merchantId, `${result.hours.length} horários`);

      // 💾 AUTO-SAVE: Salvar horários no banco de dados após buscar do iFood
      console.log('💾 OPENING HOURS - Salvando horários no banco de dados...');
      const saveResult = await IFoodMerchantStatusService.saveOpeningHoursToDatabase(merchantId, result.hours);

      if (saveResult) {
        console.log('✅ OPENING HOURS - Horários salvos no banco com sucesso');
      } else {
        console.log('⚠️ OPENING HOURS - Falha ao salvar no banco, mas retornando dados do iFood');
      }

      res.json({
        message: 'Horários de funcionamento listados e salvos com sucesso',
        data: result.hours,
        saved_to_database: saveResult
      });
    } else {
      console.log('🕐 OPENING HOURS - Erro ao listar horários:', merchantId);
      res.status(500).json({
        error: 'Erro ao listar horários de funcionamento'
      });
    }
  } catch (error) {
    console.error('🕐 OPENING HOURS - Erro geral ao listar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/merchants/:merchantId/opening-hours', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { dayOfWeek, startTime, endTime } = req.body;

    console.log('🕐 OPENING HOURS - Atualizando horários para merchant:', merchantId, { dayOfWeek, startTime, endTime });

    // Validação dos parâmetros obrigatórios
    if (!dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({
        error: 'dayOfWeek, startTime e endTime são obrigatórios'
      });
    }

    // Validação do formato do dia da semana
    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    if (!validDays.includes(dayOfWeek)) {
      return res.status(400).json({
        error: 'dayOfWeek deve ser um dos valores: ' + validDays.join(', ')
      });
    }

    // Validação do formato de horário (HH:MM ou HH:MM:SS)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        error: 'startTime e endTime devem estar no formato HH:MM ou HH:MM:SS'
      });
    }

    // Buscar qualquer token disponível no banco (não depende de user_id específico)
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Nenhum token iFood disponível no sistema. Configure um token primeiro.'
      });
    }

    // Garantir formato HH:MM:SS
    const formatTime = (time: string) => {
      return time.includes(':') && time.split(':').length === 2 ? `${time}:00` : time;
    };

    const result = await IFoodMerchantStatusService.updateOpeningHours(
      merchantId,
      dayOfWeek,
      formatTime(startTime),
      formatTime(endTime),
      tokenInfo.access_token
    );

    if (result.success) {
      console.log('🕐 OPENING HOURS - Horários atualizados com sucesso:', merchantId, dayOfWeek);
      res.json({
        message: result.message || 'Horários de funcionamento atualizados com sucesso',
        data: {
          merchantId,
          dayOfWeek,
          startTime: formatTime(startTime),
          endTime: formatTime(endTime)
        }
      });
    } else {
      console.log('🕐 OPENING HOURS - Erro ao atualizar horários:', result.message);
      res.status(500).json({
        error: result.message || 'Erro ao atualizar horários de funcionamento'
      });
    }
  } catch (error) {
    console.error('🕐 OPENING HOURS - Erro geral ao atualizar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/merchants/:merchantId/opening-hours/delete', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { dayOfWeek } = req.body;

    console.log('🗑️ OPENING HOURS - Deletando horário para merchant:', merchantId, 'dia:', dayOfWeek);

    // Validação dos parâmetros obrigatórios
    if (!dayOfWeek) {
      return res.status(400).json({
        error: 'dayOfWeek é obrigatório'
      });
    }

    // Validação do formato do dia da semana
    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    if (!validDays.includes(dayOfWeek)) {
      return res.status(400).json({
        error: 'dayOfWeek deve ser um dos valores: ' + validDays.join(', ')
      });
    }

    // Buscar qualquer token disponível no banco (não depende de user_id específico)
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Nenhum token iFood disponível no sistema. Configure um token primeiro.'
      });
    }

    const result = await IFoodMerchantStatusService.deleteOpeningHours(
      merchantId,
      dayOfWeek,
      tokenInfo.access_token
    );

    if (result.success) {
      console.log('🗑️ OPENING HOURS - Horário deletado com sucesso:', merchantId, dayOfWeek);
      res.json({
        message: result.message || 'Horário de funcionamento deletado com sucesso',
        data: {
          merchantId,
          dayOfWeek
        }
      });
    } else {
      console.log('🗑️ OPENING HOURS - Erro ao deletar horário:', result.message);
      res.status(500).json({
        error: result.message || 'Erro ao deletar horário de funcionamento'
      });
    }
  } catch (error) {
    console.error('🗑️ OPENING HOURS - Erro geral ao deletar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;