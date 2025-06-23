import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { OrchestratorAgent, AgentRegistry } from '../agents';
import { AgentContext, AgentRole } from '../agents/types';
import { logger } from '../utils/logger';

const router = Router();

// Store active orchestrators
const activeOrchestrators = new Map<string, OrchestratorAgent>();

/**
 * POST /api/projects
 * Create a new project and start orchestration
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    
    if (!name || !description) {
      res.status(400).json({
        error: 'Project name and description are required'
      });
      return;
    }
    
    const projectId = uuidv4();
    const db = (req.app as any).agentContext.db as Pool;
    const agentContext = (req.app as any).agentContext as AgentContext;
    const agentRegistry = (req.app as any).agentRegistry as AgentRegistry;
    
    // Create project in database
    await db.query(
      'INSERT INTO helios.projects (id, name, description, status) VALUES ($1, $2, $3, $4)',
      [projectId, name, description, 'initializing']
    );
    
    // Create orchestrator agent
    const orchestrator = new OrchestratorAgent(
      `orchestrator-${projectId}`,
      projectId,
      agentContext
    );
    
    // Initialize orchestrator
    await orchestrator.initialize();
    
    // Register orchestrator
    agentRegistry.register(orchestrator);
    activeOrchestrators.set(projectId, orchestrator);
    
    // Start project execution asynchronously
    orchestrator.executeProject({ name, description }).catch(error => {
      logger.error(`Project execution failed for ${projectId}:`, error);
    });
    
    // Update project status
    await db.query(
      'UPDATE helios.projects SET status = $1 WHERE id = $2',
      ['running', projectId]
    );
    
    res.status(201).json({
      id: projectId,
      name,
      description,
      status: 'running',
      message: 'Project created and orchestration started'
    });
    
  } catch (error) {
    logger.error('Failed to create project:', error);
    res.status(500).json({
      error: 'Failed to create project',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/projects
 * List all projects
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
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
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/projects/:id
 * Get project details
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = (req.app as any).agentContext.db as Pool;
    const orchestrator = activeOrchestrators.get(id);
    
    // Get project from database
    const result = await db.query(
      'SELECT * FROM helios.projects WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    const project = result.rows[0];
    
    // Get current state from orchestrator if available
    let currentState = null;
    if (orchestrator) {
      try {
        const response = await orchestrator.handleMessage({
          id: uuidv4(),
          from: AgentRole.ORCHESTRATOR,
          to: AgentRole.ORCHESTRATOR,
          type: 'request',
          content: { action: 'status' },
          timestamp: new Date()
        });
        
        if (response.success) {
          currentState = response.data;
        }
      } catch (error) {
        logger.warn('Failed to get orchestrator state:', error);
      }
    }
    
    res.json({
      ...project,
      currentState,
      isActive: !!orchestrator
    });
    
  } catch (error) {
    logger.error('Failed to get project:', error);
    res.status(500).json({
      error: 'Failed to get project',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/projects/:id/pause
 * Pause project execution
 */
router.post('/:id/pause', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orchestrator = activeOrchestrators.get(id);
    
    if (!orchestrator) {
      res.status(404).json({ error: 'Project not found or not active' });
      return;
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
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/projects/:id/resume
 * Resume project execution
 */
router.post('/:id/resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orchestrator = activeOrchestrators.get(id);
    
    if (!orchestrator) {
      res.status(404).json({ error: 'Project not found or not active' });
      return;
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
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/projects/:id/tasks
 * Get project tasks
 */
router.get('/:id/tasks', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = (req.app as any).agentContext.db as Pool;
    
    const result = await db.query(`
      SELECT t.*, 
             array_agg(DISTINCT td.depends_on_task_id) as dependencies
      FROM helios.tasks t
      LEFT JOIN helios.task_dependencies td ON td.task_id = t.id
      WHERE t.project_id = $1
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `, [id]);
    
    res.json({
      tasks: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    logger.error('Failed to get tasks:', error);
    res.status(500).json({
      error: 'Failed to get tasks',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/projects/:id/artifacts
 * Get project artifacts
 */
router.get('/:id/artifacts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = (req.app as any).agentContext.db as Pool;
    
    const result = await db.query(`
      SELECT * FROM helios.artifacts
      WHERE project_id = $1 AND is_latest = true
      ORDER BY created_at DESC
    `, [id]);
    
    res.json({
      artifacts: result.rows,
      total: result.rowCount
    });
    
  } catch (error) {
    logger.error('Failed to get artifacts:', error);
    res.status(500).json({
      error: 'Failed to get artifacts',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project and stop orchestration
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = (req.app as any).agentContext.db as Pool;
    const agentRegistry = (req.app as any).agentRegistry as AgentRegistry;
    
    // Stop orchestrator if active
    const orchestrator = activeOrchestrators.get(id);
    if (orchestrator) {
      await orchestrator.shutdown();
      agentRegistry.unregister(orchestrator.id);
      activeOrchestrators.delete(id);
    }
    
    // Delete from database (cascades to related tables)
    const result = await db.query(
      'DELETE FROM helios.projects WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    res.json({
      message: 'Project deleted successfully',
      project: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Failed to delete project:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/projects/:id/start
 * Start project execution
 */
router.post('/:id/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: _id } = req.params;
    
    // TODO: Implement start logic
    res.json({ message: 'Project start endpoint - not yet implemented' });
    
  } catch (error) {
    logger.error('Failed to start project:', error);
    res.status(500).json({
      error: 'Failed to start project',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/projects/:id/stop
 * Stop project execution
 */
router.post('/:id/stop', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orchestrator = activeOrchestrators.get(id);
    
    if (!orchestrator) {
      res.status(404).json({ error: 'Project not found or not active' });
      return;
    }
    
    await orchestrator.shutdown();
    activeOrchestrators.delete(id);
    
    res.json({ message: 'Project stopped successfully' });
    
  } catch (error) {
    logger.error('Failed to stop project:', error);
    res.status(500).json({
      error: 'Failed to stop project',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/projects/:id/state
 * Get current project state
 */
router.get('/:id/state', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orchestrator = activeOrchestrators.get(id);
    
    if (!orchestrator) {
      res.status(404).json({ error: 'Project not found or not active' });
      return;
    }
    
    const response = await orchestrator.handleMessage({
      id: uuidv4(),
      from: AgentRole.ORCHESTRATOR,
      to: AgentRole.ORCHESTRATOR,
      type: 'request',
      content: { action: 'status' },
      timestamp: new Date()
    });
    
    if (response.success) {
      res.json(response.data);
    } else {
      res.status(400).json({ error: response.error });
    }
    
  } catch (error) {
    logger.error('Failed to get project state:', error);
    res.status(500).json({
      error: 'Failed to get project state',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;