import { Router } from 'express';
import { getTokenForUser, getAnyAvailableToken, IFoodTokenService } from '../ifoodTokenService';
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

// NEW: Endpoint to fetch all merchants from iFood API and save them
router.post('/merchants/fetch-from-ifood', async (req, res) => {
  try {
    const { user_id } = req.body;

    console.log('🏪 MERCHANT - Buscando merchants do iFood para user:', user_id);

    if (!user_id) {
      return res.status(400).json({
        error: 'user_id é obrigatório'
      });
    }

    // Get token for user
    const tokenInfo = await getTokenForUser(user_id);

    if (!tokenInfo) {
      return res.status(401).json({
        error: 'Token não encontrado ou expirado. Faça login no iFood primeiro.'
      });
    }

    const merchantService = new IFoodMerchantService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );

    // Fetch merchants from iFood API
    const { success, merchants } = await merchantService.fetchMerchantsFromIFood(tokenInfo.access_token);

    if (!success) {
      return res.status(500).json({
        error: 'Erro ao buscar merchants na API do iFood',
        details: merchants
      });
    }

    const merchantList = merchants as any[];
    const results = {
      success: true,
      total_merchants: merchantList.length,
      saved_merchants: [] as string[],
      existing_merchants: [] as string[],
      errors: [] as any[]
    };

    // Save each merchant to database
    for (const ifoodMerchant of merchantList) {
      try {
        // Check if merchant already exists
        const exists = await merchantService.checkMerchantExists(ifoodMerchant.id);

        if (exists) {
          console.log(`⚠️ Merchant ${ifoodMerchant.name} already exists`);
          results.existing_merchants.push(ifoodMerchant.id);
          continue;
        }

        // Prepare merchant data for database
        const merchantData = {
          merchant_id: ifoodMerchant.id,
          name: ifoodMerchant.name,
          corporate_name: ifoodMerchant.corporateName || ifoodMerchant.name,
          user_id: user_id,
          client_id: tokenInfo.client_id || '',
          status: true,
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
          console.log(`✅ Merchant ${ifoodMerchant.name} salvo com sucesso`);
          results.saved_merchants.push(ifoodMerchant.id);
        } else {
          console.error(`❌ Erro ao salvar merchant ${ifoodMerchant.name}:`, storeResult);
          results.errors.push({
            merchant_id: ifoodMerchant.id,
            name: ifoodMerchant.name,
            error: storeResult.response?.error || 'Erro desconhecido'
          });
        }

      } catch (merchantError: any) {
        console.error(`❌ Erro processando merchant ${ifoodMerchant.name}:`, merchantError);
        results.errors.push({
          merchant_id: ifoodMerchant.id,
          name: ifoodMerchant.name,
          error: merchantError.message
        });
      }
    }

    console.log('🎉 MERCHANT - Busca e sincronização concluída:', {
      total: results.total_merchants,
      saved: results.saved_merchants.length,
      existing: results.existing_merchants.length,
      errors: results.errors.length
    });

    res.json({
      message: 'Merchants buscados e sincronizados com sucesso',
      results: results
    });

  } catch (error) {
    console.error('🏪 MERCHANT - Erro geral na busca do iFood:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /merchants - Lista todos os merchants do banco de dados
router.get('/merchants', async (req, res) => {
  try {
    console.log('🏪 MERCHANTS - Buscando todos os merchants do banco');

    const merchantService = new IFoodMerchantService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );

    const result = await merchantService.getAllMerchantsFromDB();

    if (result.success) {
      console.log('🏪 MERCHANTS - Lista obtida com sucesso:', result.merchants?.length || 0, 'merchants');
      res.json({
        success: true,
        merchants: result.merchants || [],
        total: result.merchants?.length || 0
      });
    } else {
      console.log('🏪 MERCHANTS - Erro ao obter lista:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Erro ao obter lista de merchants'
      });
    }
  } catch (error) {
    console.error('🏪 MERCHANTS - Erro geral ao obter lista:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

router.get('/merchants/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { user_id } = req.query;

    console.log('🏪 MERCHANT - Buscando detalhes do merchant:', merchantId);

    // Use any available token from database instead of user-specific token
    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(401).json({
        error: 'Nenhum token encontrado no banco de dados'
      });
    }

    console.log('🔑 MERCHANT - Usando token disponível:', tokenInfo.user_id);

    const merchantService = new IFoodMerchantService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );

    // Use the user_id from the available token instead of query parameter
    const effectiveUserId = (user_id as string) || tokenInfo.user_id;
    const result = await merchantService.getMerchantDetail(merchantId, tokenInfo.access_token, effectiveUserId);

    if (result.success) {
      console.log('🏪 MERCHANT - Detalhes obtidos com sucesso:', merchantId);
      res.json({
        success: true,
        merchant: result.merchant,
        action: result.action || 'fetched_from_api'
      });
    } else {
      console.log('🏪 MERCHANT - Erro ao obter detalhes:', result.error);
      res.status(404).json({
        success: false,
        error: result.error || 'Erro ao obter detalhes do merchant'
      });
    }
  } catch (error) {
    console.error('🏪 MERCHANT - Erro geral ao obter detalhes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// GET /merchants/{merchantId}/status - Status específico do merchant
router.get('/merchants/:merchantId/status', async (req, res) => {
  try {
    const { merchantId } = req.params;

    console.log('🏪 MERCHANT STATUS - Buscando status do merchant:', merchantId);

    const tokenInfo = await getAnyAvailableToken();

    if (!tokenInfo) {
      return res.status(401).json({
        error: 'Nenhum token encontrado no banco de dados'
      });
    }

    const { IFoodMerchantStatusService } = await import('../ifoodMerchantStatusService');
    const result = await IFoodMerchantStatusService.fetchMerchantStatus(merchantId, tokenInfo.access_token);

    if (result.success) {
      console.log('🏪 MERCHANT STATUS - Status obtido com sucesso:', merchantId);
      res.json({
        success: true,
        merchant_id: merchantId,
        status: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('🏪 MERCHANT STATUS - Erro ao obter status:', result.data);
      res.status(500).json({
        success: false,
        error: result.data?.error || 'Erro ao obter status do merchant'
      });
    }
  } catch (error) {
    console.error('🏪 MERCHANT STATUS - Erro geral ao obter status:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;