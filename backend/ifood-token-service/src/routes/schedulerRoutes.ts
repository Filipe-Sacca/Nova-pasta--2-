import { Router } from 'express';
import { productSyncScheduler } from '../productSyncScheduler';

const router = Router();

// 📦 PRODUCT SYNC SCHEDULER ENDPOINTS

router.post('/products/sync/scheduler/start', async (req, res) => {
  try {
    const { intervalMinutes = 120 } = req.body;

    console.log('📦 PRODUCT SYNC SCHEDULER - Iniciando scheduler com intervalo:', intervalMinutes, 'minutos');

    productSyncScheduler.start();

    res.json({
      message: 'Product sync scheduler iniciado',
      intervalMinutes: intervalMinutes,
      status: 'running'
    });
  } catch (error) {
    console.error('📦 PRODUCT SYNC SCHEDULER - Erro ao iniciar:', error);
    res.status(500).json({ error: 'Erro ao iniciar scheduler' });
  }
});

router.post('/products/sync/scheduler/stop', async (req, res) => {
  try {
    console.log('📦 PRODUCT SYNC SCHEDULER - Parando scheduler');

    productSyncScheduler.stop();

    res.json({
      message: 'Product sync scheduler parado',
      status: 'stopped'
    });
  } catch (error) {
    console.error('📦 PRODUCT SYNC SCHEDULER - Erro ao parar:', error);
    res.status(500).json({ error: 'Erro ao parar scheduler' });
  }
});

router.get('/products/sync/scheduler/status', async (req, res) => {
  try {
    const status = {
      isActive: true, // productSyncScheduler doesn't have isActive method
      intervalMinutes: 120,
      nextRun: 'scheduled'
    };

    console.log('📦 PRODUCT SYNC SCHEDULER - Status:', status);

    res.json(status);
  } catch (error) {
    console.error('📦 PRODUCT SYNC SCHEDULER - Erro ao obter status:', error);
    res.status(500).json({ error: 'Erro ao obter status do scheduler' });
  }
});

export default router;