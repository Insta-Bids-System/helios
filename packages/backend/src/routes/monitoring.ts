import { Router, Request, Response } from 'express';
import { 
  getProjectStatus, 
  getRecentAgentActivity,
  subscribeToAgentLogs,
  supabase 
} from '../services/supabase';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get project monitoring data from Supabase
 */
router.get('/projects/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Get project status from Supabase
    const { data: project, error: projectError } = await getProjectStatus(id);
    
    if (projectError) {
      res.status(404).json({ error: 'Project not found', details: projectError.message });
      return;
    }
    
    // Get recent activity
    const { data: activity, error: activityError } = await supabase
      .from('agent_logs')
      .select('*')
      .eq('project_id', id)
      .order('timestamp', { ascending: false })
      .limit(20);
    
    if (activityError) {
      logger.error('Failed to fetch activity:', activityError);
    }
    
    // Get workflow stats instead of tasks
    const { data: workflows } = await supabase
      .from('workflows')
      .select('status')
      .eq('project_id', id);
    
    const workflowStats = workflows?.reduce((acc: any, workflow: any) => {
      acc[workflow.status] = (acc[workflow.status] || 0) + 1;
      return acc;
    }, {}) || {};
    
    // Get agent performance
    const { data: agentStats } = await supabase
      .from('agent_logs')
      .select('agent_role, duration_ms')
      .eq('project_id', id)
      .not('duration_ms', 'is', null);
    
    const agentPerformance = agentStats?.reduce((acc: any, log: any) => {
      if (!acc[log.agent_role]) {
        acc[log.agent_role] = { count: 0, totalDuration: 0 };
      }
      acc[log.agent_role].count++;
      acc[log.agent_role].totalDuration += log.duration_ms;
      return acc;
    }, {}) || {};
    
    // Calculate averages
    Object.keys(agentPerformance).forEach(role => {
      const stats = agentPerformance[role];
      stats.avgDuration = Math.round(stats.totalDuration / stats.count);
    });
    
    res.json({
      project,
      recentActivity: activity || [],
      workflowStats,
      agentPerformance,
      monitoring: {
        supabaseUrl: process.env.SUPABASE_URL,
        dashboardUrl: `https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/editor/helios`
      }
    });
  } catch (error) {
    logger.error('Monitoring error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch monitoring data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get global agent activity across all projects
 */
router.get('/agents', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data: activity, error } = await getRecentAgentActivity(100);
    
    if (error) {
      res.status(500).json({ error: 'Failed to fetch agent activity', details: error.message });
      return;
    }
    
    res.json({
      activity,
      totalLogs: activity?.length || 0,
      monitoring: {
        supabaseUrl: process.env.SUPABASE_URL,
        tableUrl: `https://supabase.com/dashboard/project/kaeydovooyaxczctsmas/editor/18025` // agent_logs table
      }
    });
  } catch (error) {
    logger.error('Agent monitoring error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch agent data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * SSE endpoint for real-time monitoring
 */
router.get('/stream/:projectId', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  
  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Subscribe to real-time updates
  const subscription = subscribeToAgentLogs(projectId, (log) => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });
  
  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);
  
  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    subscription.unsubscribe();
  });
});

export default router;
