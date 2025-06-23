import { Router } from 'express';
import projectRoutes from './projects';
import monitoringRoutes from './monitoring';

const router = Router();

// Mount project routes
router.use('/projects', projectRoutes);

// Mount monitoring routes
router.use('/monitor', monitoringRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  const registry = (req.app as any).agentRegistry;
  const stats = registry?.getStatistics ? registry.getStatistics() : {};
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    agents: stats
  });
});

export default router;
