import { Router } from 'express';
import * as jwt from 'jsonwebtoken';
import { IFoodTokenService, getTokenForUser } from '../ifoodTokenService';
import { tokenScheduler } from '../tokenScheduler';

const router = Router();

// 🔐 TOKEN MANAGEMENT ENDPOINTS

router.post('/token', async (req, res) => {
  try {
    const { username, password, userAgent, clientId } = req.body;

    console.log('🔐 TOKEN - Iniciando obtenção de token para:', { username, clientId });

    if (!username || !password || !userAgent || !clientId) {
      console.log('🔐 TOKEN - Dados incompletos:', { username: !!username, password: !!password, userAgent: !!userAgent, clientId: !!clientId });
      return res.status(400).json({
        error: 'Username, password, userAgent and clientId são obrigatórios'
      });
    }

    const service = new IFoodTokenService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await service.processTokenRequest(clientId, password, username, false);

    if (result.success && result.data) {
      console.log('🔐 TOKEN - Token obtido com sucesso para:', username);

      // Gerar JWT
      const jwtToken = jwt.sign(
        {
          userId: username,
          clientId: clientId
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '30d' }
      );

      res.json({
        message: 'Token obtido com sucesso',
        token: result.data,
        jwtToken: jwtToken
      });
    } else {
      console.log('🔐 TOKEN - Erro ao obter token:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao obter token'
      });
    }
  } catch (error) {
    console.error('🔐 TOKEN - Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/token/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔐 TOKEN - Buscando token para usuário:', userId);

    const tokenInfo = await getTokenForUser(userId);

    if (tokenInfo) {
      console.log('🔐 TOKEN - Token encontrado para usuário:', userId);
      res.json({
        token: tokenInfo.access_token,
        userId: tokenInfo.user_id,
        clientId: tokenInfo.client_id,
        expiresAt: tokenInfo.expires_at,
        isValid: Date.now() < (Number(tokenInfo.expires_at) * 1000)
      });
    } else {
      console.log('🔐 TOKEN - Token não encontrado para usuário:', userId);
      res.status(404).json({
        error: 'Token não encontrado ou expirado'
      });
    }
  } catch (error) {
    console.error('🔐 TOKEN - Erro ao buscar token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/token/refresh', async (req, res) => {
  try {
    const { clientId } = req.body;

    console.log('🔐 TOKEN - Iniciando refresh de token para clientId:', clientId);

    if (!clientId) {
      return res.status(400).json({
        error: 'clientId é obrigatório'
      });
    }

    const service = new IFoodTokenService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await service.refreshToken(clientId);

    if (result.success) {
      console.log('🔐 TOKEN - Token refreshed com sucesso para:', clientId);
      res.json({
        message: 'Token atualizado com sucesso',
        token: result.data
      });
    } else {
      console.log('🔐 TOKEN - Erro ao refresh token:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao atualizar token'
      });
    }
  } catch (error) {
    console.error('🔐 TOKEN - Erro geral no refresh:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/token/force-refresh/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    console.log('🔐 TOKEN - Forçando refresh de token para clientId:', clientId);

    const service = new IFoodTokenService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    // Force refresh usando processTokenRequest com forceRefresh=true
    const result = await service.processTokenRequest(clientId, '', 'force-refresh', true);

    if (result.success) {
      console.log('🔐 TOKEN - Token força refresh realizado com sucesso para:', clientId);
      res.json({
        message: 'Token atualizado com sucesso (força)',
        token: result.data
      });
    } else {
      console.log('🔐 TOKEN - Erro ao força refresh token:', result.error);
      res.status(500).json({
        error: result.error || 'Erro ao atualizar token (força)'
      });
    }
  } catch (error) {
    console.error('🔐 TOKEN - Erro geral no força refresh:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/token/update-all-expired', async (req, res) => {
  try {
    console.log('🔐 TOKEN - Iniciando atualização de todos os tokens expirados');

    const service = new IFoodTokenService(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!
    );
    const result = await service.updateAllExpiredTokens();

    console.log('🔐 TOKEN - Atualização de tokens expirados concluída:', result);

    res.json({
      message: 'Processo de atualização de tokens expirados executado',
      result: result
    });
  } catch (error) {
    console.error('🔐 TOKEN - Erro ao atualizar tokens expirados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// 🔐 TOKEN SCHEDULER ENDPOINTS

router.post('/token/scheduler/start', async (req, res) => {
  try {
    const { intervalMinutes = 60 } = req.body;

    console.log('🔐 TOKEN SCHEDULER - Iniciando scheduler com intervalo:', intervalMinutes, 'minutos');

    tokenScheduler.start();

    res.json({
      message: 'Token refresh scheduler iniciado',
      intervalMinutes: intervalMinutes,
      status: 'running'
    });
  } catch (error) {
    console.error('🔐 TOKEN SCHEDULER - Erro ao iniciar:', error);
    res.status(500).json({ error: 'Erro ao iniciar scheduler' });
  }
});

router.post('/token/scheduler/stop', async (req, res) => {
  try {
    console.log('🔐 TOKEN SCHEDULER - Parando scheduler');

    tokenScheduler.stop();

    res.json({
      message: 'Token refresh scheduler parado',
      status: 'stopped'
    });
  } catch (error) {
    console.error('🔐 TOKEN SCHEDULER - Erro ao parar:', error);
    res.status(500).json({ error: 'Erro ao parar scheduler' });
  }
});

router.get('/token/scheduler/status', async (req, res) => {
  try {
    const schedulerStatus = tokenScheduler.getStatus();
    const status = {
      isActive: schedulerStatus.running,
      nextRun: schedulerStatus.nextCheck,
      intervalMinutes: 60
    };

    console.log('🔐 TOKEN SCHEDULER - Status:', status);

    res.json(status);
  } catch (error) {
    console.error('🔐 TOKEN SCHEDULER - Erro ao obter status:', error);
    res.status(500).json({ error: 'Erro ao obter status do scheduler' });
  }
});

export default router;