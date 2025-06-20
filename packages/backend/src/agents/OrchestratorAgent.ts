import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from './BaseAgent';
import { 
  AgentRole, 
  AgentStatus, 
  HeliosSwarmState, 
  IAgent, 
  AgentContext,
  Task,
  AgentMessage,
  AgentResponse
} from './types';
import { OrchestratorGraph } from '../orchestrator';
import { ProductManagerAgent } from './ProductManagerAgent';
import { FrontendEngineerAgent } from './FrontendEngineerAgent';
import { BackendEngineerAgent } from './BackendEngineerAgent';
import { FullstackEngineerAgent } from './FullstackEngineerAgent';
import { DevOpsEngineerAgent } from './DevOpsEngineerAgent';
import { QAEngineerAgent } from './QAEngineerAgent';
import { CodeReviewerAgent } from './CodeReviewerAgent';
import { IntegrationSpecialistAgent } from './IntegrationSpecialistAgent';

export class OrchestratorAgent extends BaseAgent {
  private graph: OrchestratorGraph | null = null;
  private projectEmitter: EventEmitter;
  private executionTimer: NodeJS.Timeout | null = null;
  
  constructor(
    id: string,
    projectId: string,
    context: AgentContext
  ) {
    super(id, AgentRole.ORCHESTRATOR, projectId, context);
    this.projectEmitter = new EventEmitter();
  }

  /**
   * Initialize the orchestrator and set up the agent graph
   */
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Initialize the orchestrator graph
    this.graph = new OrchestratorGraph();
    
    // Register all agents in the graph
    await this.registerSwarmAgents();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.logger.info(`OrchestratorAgent initialized for project ${this.projectId}`);
  }

  /**
   * Register all swarm agents with the graph
   */
  private async registerSwarmAgents(): Promise<void> {
    if (!this.graph) {
      throw new Error('Graph not initialized');
    }

    // Create and add all agents
    const agents: IAgent[] = [
      new ProductManagerAgent(
        `${this.projectId}-pm`,
        this.projectId,
        this.context
      ),
      new FrontendEngineerAgent(
        `${this.projectId}-frontend`,
        this.projectId,
        this.context
      ),
      new BackendEngineerAgent(
        `${this.projectId}-backend`,
        this.projectId,
        this.context
      ),
      new FullstackEngineerAgent(
        `${this.projectId}-fullstack`,
        this.projectId,
        this.context
      ),
      new DevOpsEngineerAgent(
        `${this.projectId}-devops`,
        this.projectId,
        this.context
      ),
      new QAEngineerAgent(
        `${this.projectId}-qa`,
        this.projectId,
        this.context
      ),
      new CodeReviewerAgent(
        `${this.projectId}-reviewer`,
        this.projectId,
        this.context
      ),
      new IntegrationSpecialistAgent(
        `${this.projectId}-integration`,
        this.projectId,
        this.context
      )
    ];

    // Initialize and add each agent
    for (const agent of agents) {
      await agent.initialize();
      this.graph.addAgent(agent);
    }
  }

  /**
   * Set up event listeners for graph execution
   */
  private setupEventListeners(): void {
    if (!this.graph) return;

    this.graph.on('stateUpdate', (state: Partial<HeliosSwarmState>) => {
      // Emit state updates to project monitoring
      this.io.to(`/projects:${this.projectId}`).emit('stateUpdate', state);
      this.projectEmitter.emit('stateUpdate', state);
    });

    this.graph.on('agentStart', (data: any) => {
      this.io.to(`/projects:${this.projectId}`).emit('agentStart', data);
      this.projectEmitter.emit('agentStart', data);
    });

    this.graph.on('agentComplete', (data: any) => {
      this.io.to(`/projects:${this.projectId}`).emit('agentComplete', data);
      this.projectEmitter.emit('agentComplete', data);
    });

    this.graph.on('error', (error: any) => {
      this.logger.error('Graph execution error:', error);
      this.io.to(`/projects:${this.projectId}`).emit('error', error);
      this.projectEmitter.emit('error', error);
    });
  }

  /**
   * Execute the orchestrator - starts the project execution
   */
  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    try {
      this.setStatus(AgentStatus.EXECUTING);
      
      // Initialize project in database
      await this.initializeProject(state);
      
      // Create initial state
      const initialState: HeliosSwarmState = {
        projectId: this.projectId,
        projectName: state.projectName || 'Unnamed Project',
        projectDescription: state.projectDescription || '',
        active_agent: AgentRole.PRODUCT_MANAGER,
        messages: [],
        tasks: [],
        currentTaskId: null,
        taskDependencies: new Map(),
        artifacts: new Map(),
        agentStates: new Map(),
        errors: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        completed: false,
        nextAgent: AgentRole.PRODUCT_MANAGER
      };

      // Start the graph execution
      if (!this.graph) {
        throw new Error('Graph not initialized');
      }

      // Run the graph asynchronously
      this.executeGraphAsync(initialState);

      // Return immediate response
      return {
        projectId: this.projectId,
        active_agent: AgentRole.PRODUCT_MANAGER,
        messages: [{
          id: uuidv4(),
          from: AgentRole.ORCHESTRATOR,
          to: 'all',
          type: 'event',
          content: 'Project execution started',
          timestamp: new Date()
        }]
      };

    } catch (error) {
      this.logger.error('OrchestratorAgent execution error:', error);
      this.setStatus(AgentStatus.ERROR);
      throw error;
    }
  }

  /**
   * Execute the graph asynchronously
   */
  private async executeGraphAsync(initialState: HeliosSwarmState): Promise<void> {
    try {
      if (!this.graph) {
        throw new Error('Graph not initialized');
      }

      // Run the graph
      const finalState = await this.graph.run(initialState);
      
      // Update project status
      await this.updateProjectStatus('completed', finalState);
      
      // Emit completion event
      this.projectEmitter.emit('completed', finalState);
      this.io.to(`/projects:${this.projectId}`).emit('projectCompleted', {
        projectId: this.projectId,
        finalState
      });

      this.setStatus(AgentStatus.COMPLETED);

    } catch (error) {
      this.logger.error('Graph execution failed:', error);
      await this.updateProjectStatus('failed', { error: error.message });
      
      this.projectEmitter.emit('failed', error);
      this.io.to(`/projects:${this.projectId}`).emit('projectFailed', {
        projectId: this.projectId,
        error: error.message
      });

      this.setStatus(AgentStatus.ERROR);
    }
  }

  /**
   * Initialize project in the database
   */
  private async initializeProject(state: Partial<HeliosSwarmState>): Promise<void> {
    const client = await (this.context.db as Pool).connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert or update project
      await client.query(`
        INSERT INTO helios.projects (
          id, name, description, status, created_by, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        this.projectId,
        state.projectName || 'Unnamed Project',
        state.projectDescription || '',
        'active',
        this.id,
        JSON.stringify(state)
      ]);
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update project status in the database
   */
  private async updateProjectStatus(status: string, metadata?: any): Promise<void> {
    const client = await (this.context.db as Pool).connect();
    
    try {
      await client.query(`
        UPDATE helios.projects
        SET status = $1, 
            metadata = metadata || $2::jsonb,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [status, JSON.stringify(metadata || {}), this.projectId]);
      
    } finally {
      client.release();
    }
  }

  /**
   * Handle messages from other agents or external sources
   */
  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    try {
      switch (message.type) {
        case 'request':
          return await this.handleRequest(message);
        case 'event':
          return await this.handleEvent(message);
        default:
          return {
            success: false,
            error: `Unknown message type: ${message.type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle request messages
   */
  private async handleRequest(message: AgentMessage): Promise<AgentResponse> {
    const { content } = message;
    
    switch (content.action) {
      case 'start':
        await this.execute(content.state || {});
        return { success: true, data: { status: 'started' } };
        
      case 'pause':
        return await this.pauseExecution();
        
      case 'resume':
        return await this.resumeExecution();
        
      case 'status':
        return await this.getProjectStatus();
        
      case 'addAgent':
        return await this.addCustomAgent(content.agent);
        
      default:
        return {
          success: false,
          error: `Unknown action: ${content.action}`
        };
    }
  }

  /**
   * Handle event messages
   */
  private async handleEvent(message: AgentMessage): Promise<AgentResponse> {
    // Forward events to the project emitter
    this.projectEmitter.emit(message.content.type, message.content.data);
    return { success: true };
  }

  /**
   * Pause project execution
   */
  private async pauseExecution(): Promise<AgentResponse> {
    if (this.graph) {
      // Implementation would pause the graph execution
      await this.updateProjectStatus('paused');
      return { success: true, data: { status: 'paused' } };
    }
    return { success: false, error: 'No active execution' };
  }

  /**
   * Resume project execution
   */
  private async resumeExecution(): Promise<AgentResponse> {
    if (this.graph && this.status === AgentStatus.WAITING) {
      await this.updateProjectStatus('active');
      // Implementation would resume graph execution
      return { success: true, data: { status: 'resumed' } };
    }
    return { success: false, error: 'No paused execution to resume' };
  }

  /**
   * Get current project status
   */
  private async getProjectStatus(): Promise<AgentResponse> {
    const client = await (this.context.db as Pool).connect();
    
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
      `, [this.projectId]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Project not found' };
      }
      
      return {
        success: true,
        data: result.rows[0]
      };
      
    } finally {
      client.release();
    }
  }

  /**
   * Add a custom agent to the graph
   */
  private async addCustomAgent(agent: IAgent): Promise<AgentResponse> {
    if (!this.graph) {
      return { success: false, error: 'Graph not initialized' };
    }
    
    try {
      await agent.initialize();
      this.graph.addAgent(agent);
      return { success: true, data: { agentId: agent.id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get project event emitter for external monitoring
   */
  getProjectEmitter(): EventEmitter {
    return this.projectEmitter;
  }

  /**
   * Validate input - orchestrator accepts project definitions
   */
  async validate(input: any): Promise<boolean> {
    return !!(input.projectName || input.projectDescription);
  }

  /**
   * Shutdown the orchestrator and all agents
   */
  async shutdown(): Promise<void> {
    if (this.executionTimer) {
      clearTimeout(this.executionTimer);
    }
    
    if (this.graph) {
      // Shutdown all agents in the graph
      const agents = this.graph.getAgents();
      for (const agent of agents.values()) {
        await agent.shutdown();
      }
    }
    
    this.projectEmitter.removeAllListeners();
    await super.shutdown();
  }
}
