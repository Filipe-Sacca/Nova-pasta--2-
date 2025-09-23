import { Router } from 'express';
import { getTokenForUser, IFoodTokenService } from '../ifoodTokenService';
import { IFoodMerchantService } from '../ifoodMerchantService';

const router = Router();

// 🏪 MERCHANT MANAGEMENT ENDPOINTS

router.post('/merchant', async (req, res) => {
  try {
    const { clientId, merchantData } = req.body;

    console.log('🏪 MERCHANT - Processando merchant para clientId:', clientId);

    if (!clientId || !merchantData) {
      return res.status(400).json({
        error: 'clientId e merchantData são obrigatórios'
      });
    }

    const merchantService = new IFoodMerchantService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await merchantService.storeMerchant(merchantData);

    if (result.success) {
      console.log('🏪 MERCHANT - Merchant processado com sucesso:', result.response?.id);
      res.json({
        message: 'Merchant processado com sucesso',
        merchant: result.response
      });
    } else {
      console.log('🏪 MERCHANT - Erro ao processar merchant');
      res.status(500).json({
        error: 'Erro ao processar merchant'
      });
    }
  } catch (error) {
    console.error('🏪 MERCHANT - Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/merchant/check/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🏪 MERCHANT - Verificando merchant:', id);

    const tokenInfo = await getTokenForUser(id);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    const merchantService = new IFoodMerchantService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await merchantService.getMerchantDetail(id, tokenInfo.access_token, id);

    if (result.success) {
      console.log('🏪 MERCHANT - Merchant verificado com sucesso:', id);
      res.json({
        message: 'Merchant verificado com sucesso',
        data: result.merchant
      });
    } else {
      console.log('🏪 MERCHANT - Erro ao verificar merchant:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao verificar merchant'
      });
    }
  } catch (error) {
    console.error('🏪 MERCHANT - Erro geral na verificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/merchants/sync-all', async (req, res) => {
  try {
    console.log('🏪 MERCHANT - Iniciando sincronização de todos os merchants');

    const merchantService = new IFoodMerchantService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await merchantService.syncAllMerchantsForUser('system');

    console.log('🏪 MERCHANT - Sincronização concluída:', result);

    res.json({
      message: 'Sincronização de merchants executada',
      result: result
    });
  } catch (error) {
    console.error('🏪 MERCHANT - Erro na sincronização geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/merchants/refresh', async (req, res) => {
  try {
    console.log('🏪 MERCHANT - Iniciando refresh de todos os merchants');

    const tokenService = new IFoodTokenService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await tokenService.renewAllTokens();

    console.log('🏪 MERCHANT - Refresh concluído:', result);

    res.json({
      message: 'Refresh de merchants executado',
      result: result
    });
  } catch (error) {
    console.error('🏪 MERCHANT - Erro no refresh geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/merchants/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('🏪 MERCHANT - Buscando detalhes do merchant:', merchantId);

    const tokenInfo = await getTokenForUser(merchantId);

    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }

    const merchantService = new IFoodMerchantService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await merchantService.getMerchantDetail(merchantId, tokenInfo.access_token, merchantId);

    if (result.success) {
      console.log('🏪 MERCHANT - Detalhes obtidos com sucesso:', merchantId);
      res.json({
        message: 'Detalhes do merchant obtidos com sucesso',
        data: result.merchant
      });
    } else {
      console.log('🏪 MERCHANT - Erro ao obter detalhes:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao obter detalhes do merchant'
      });
    }
  } catch (error) {
    console.error('🏪 MERCHANT - Erro geral ao obter detalhes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;