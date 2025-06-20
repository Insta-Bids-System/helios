import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { OrchestratorAgent, AgentRegistry } from '../agents';
import { AgentContext, AgentMessage, AgentRole } from '../agents/types';
import logger from '../utils/logger';

const router = Router();

// Store active orchestrators
const activeOrchestrators = new Map<string, OrchestratorAgent>();

/**
 * POST /api/projects
 * Create a new project and start execution
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, config } = req.body;
    
    if (!name && !description) {
      return res.status(400).json({
        error: 'Project name or description is required'
      });
    }

    // Generate project ID
    const projectId = uuidv4();
    
    // Get context from request app
    const context: AgentContext = (req.app as any).agentContext;
    
    // Create orchestrator
    const orchestrator = new OrchestratorAgent(
      `orchestrator-${projectId}`,
      projectId,
      context
    );
    
    // Initialize orchestrator
    await orchestrator.initialize();
    
    // Store active orchestrator
    activeOrchestrators.set(projectId, orchestrator);
    
    // Register with global agent registry
    const registry = (req.app as any).agentRegistry as AgentRegistry;
    registry.register(orchestrator);
    
    // Start project execution
    const initialState = {
      projectName: name,
      projectDescription: description,
      ...config
    };
    
    const result = await orchestrator.execute(initialState);
    
    res.json({
      projectId,
      status: 'started',
      ...result
    });
    
  } catch (error) {
    logger.error('Failed to create project:', error);
    res.status(500).json({
      error: 'Failed to create project',
      details: error.message
    });
  }
});

/**
 * GET /api/projects
 * List all projects
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = (req.app as any).agentContext.db as Pool;
    const client = await db.connect();
    
    try {
      const result = await client.query(`
        SELECT p.*, 
               COUNT(DISTINCT t.id) as total_tasks,
               COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
               COUNT(DISTINCT a.id) as total_artifacts
        FROM helios.projects p
        LEFT JOIN helios.tasks t ON t.project_id = p.id
        LEFT JOIN helios.artifacts a ON a.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `);
      
      res.json({
        projects: result.rows,
        total: result.rowCount
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Failed to list projects:', error);
    res.status(500).json({
      error: 'Failed to list projects',
      details: error.message
    });
  }
});

/**
 * GET /api/projects/:id
 * Get project details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orchestrator = activeOrchestrators.get(id);
    
    if (orchestrator) {
      // Get status from active orchestrator
      const response = await orchestrator.handleMessage({
        id: uuidv4(),
        from: AgentRole.ORCHESTRATOR,
        to: AgentRole.ORCHESTRATOR,
        type: 'request',
        content: { action: 'status' },
        timestamp: new Date()
      });
      
      if (response.success) {
        return res.json(response.data);
      }
    }
    
    // Fall back to database
    const db = (req.app as any).agentContext.db as Pool;
    const client = await db.connect();
    
    try {
      const result = await client.query(`
        SELECT p.*, 
               COUNT(DISTINCT t.id) as total_tasks,
               COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
               COUNT(DISTINCT a.id) as total_artifacts
        FROM helios.projects p
        LEFT JOIN helios.tasks t ON t.project_id = p.id
        LEFT JOIN helios.artifacts a ON a.project_id = p.id
        WHERE p.id = $1
        GROUP BY p.id
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      res.json(result.rows[0]);
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Failed to get project:', error);
    res.status(500).json({
      error: 'Failed to get project',
      details: error.message
    });
  }
});

/**
 * POST /api/projects/:id/pause
 * Pause project execution
 */
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orchestrator = activeOrchestrators.get(id);
    
    if (!orchestrator) {
      return res.status(404).json({ error: 'Project not found or not active' });
    }
    
    const response = await orchestrator.handleMessage({
      id: uuidv4(),
      from: AgentRole.ORCHESTRATOR,
      to: AgentRole.ORCHESTRATOR,
      type: 'request',
      content: { action: 'pause' },
      timestamp: new Date()
    });
    
    if (response.success) {
      res.json(response.data);
    } else {
      res.status(400).json({ error: response.error });
    }
    
  } catch (error) {
    logger.error('Failed to pause project:', error);
    res.status(500).json({
      error: 'Failed to pause project',
      details: error.message
    });
  }
});

/**
 * POST /api/projects/:id/resume
 * Resume project execution
 */
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orchestrator = activeOrchestrators.get(id);
    
    if (!orchestrator) {
      return res.status(404).json({ error: 'Project not found or not active' });
    }
    
    const response = await orchestrator.handleMessage({
      id: uuidv4(),
      from: AgentRole.ORCHESTRATOR,
      to: AgentRole.ORCHESTRATOR,
      type: 'request',
      content: { action: 'resume' },
      timestamp: new Date()
    });
    
    if (response.success) {
      res.json(response.data);
    } else {
      res.status(400).json({ error: response.error });
    }
    
  } catch (error) {
    logger.error('Failed to resume project:', error);
    res.status(500).json({
      error: 'Failed to resume project',
      details: error.message
    });
  }
});

/**
 * GET /api/projects/:id/tasks
 * Get project tasks
 */
router.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = (req.app as any).agentContext.db as Pool;
    const client = await db.connect();
    
    try {
      const result = await client.query(`
        SELECT t.*, 
               COUNT(DISTINCT a.id) as artifact_count
        FROM helios.tasks t
        LEFT JOIN helios.artifacts a ON a.task_id = t.id
        WHERE t.project_id = $1
        GROUP BY t.id
        ORDER BY t.created_at ASC
      `, [id]);
      
      res.json({
        tasks: result.rows,
        total: result.rowCount
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Failed to get project tasks:', error);
    res.status(500).json({
      error: 'Failed to get project tasks',
      details: error.message
    });
  }
});

/**
 * GET /api/projects/:id/artifacts
 * Get project artifacts
 */
router.get('/:id/artifacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = (req.app as any).agentContext.db as Pool;
    const client = await db.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM helios.artifacts
        WHERE project_id = $1
        ORDER BY created_at DESC
      `, [id]);
      
      res.json({
        artifacts: result.rows,
        total: result.rowCount
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Failed to get project artifacts:', error);
    res.status(500).json({
      error: 'Failed to get project artifacts',
      details: error.message
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project and stop execution
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Stop orchestrator if active
    const orchestrator = activeOrchestrators.get(id);
    if (orchestrator) {
      await orchestrator.shutdown();
      activeOrchestrators.delete(id);
      
      // Unregister from global registry
      const registry = (req.app as any).agentRegistry as AgentRegistry;
      registry.unregister(orchestrator.id);
    }
    
    // Delete from database
    const db = (req.app as any).agentContext.db as Pool;
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete project (cascades to tasks, artifacts, logs)
      await client.query('DELETE FROM helios.projects WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      
      res.json({ message: 'Project deleted successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Failed to delete project:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      details: error.message
    });
  }
});

// Clean up active orchestrators on shutdown
process.on('SIGTERM', async () => {
  for (const [id, orchestrator] of activeOrchestrators) {
    await orchestrator.shutdown();
  }
  activeOrchestrators.clear();
});

export default router;
