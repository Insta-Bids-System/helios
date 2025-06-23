import { EventEmitter } from 'events';
import { BaseAgent } from './BaseAgent';
import { 
  AgentRole, 
  AgentStatus, 
  HeliosSwarmState, 
  AgentContext,
  AgentMessage,
  AgentResponse
} from './types';
import { OrchestratorGraph } from '../orchestrator';
import {
  ProjectAnalyzerAgent,
  TaskDecomposerAgent,
  BackendEngineerAgent,
  FrontendEngineerAgent,
  FullstackEngineerAgent,
  DevOpsEngineerAgent,
  QAEngineerAgent,
  CodeReviewerAgent,
  DocumentationWriterAgent
} from './PlaceholderAgents';

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
    this.graph = new OrchestratorGraph(
      this.projectId,
      'Project', // Will be set later
      'Description', // Will be set later
      this.context
    );
    
    // Register all agents in the graph
    await this.registerSwarmAgents();
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.context.logger.info(`OrchestratorAgent initialized for project ${this.projectId}`);
  }

  /**
   * Register all swarm agents in the graph
   */
  private async registerSwarmAgents(): Promise<void> {
    // Create and register all agent implementations
    const agents = [
      new ProjectAnalyzerAgent(`${this.projectId}-project-analyzer`, this.projectId, this.context),
      new TaskDecomposerAgent(`${this.projectId}-task-decomposer`, this.projectId, this.context),
      new BackendEngineerAgent(`${this.projectId}-backend-engineer`, this.projectId, this.context),
      new FrontendEngineerAgent(`${this.projectId}-frontend-engineer`, this.projectId, this.context),
      new FullstackEngineerAgent(`${this.projectId}-fullstack-engineer`, this.projectId, this.context),
      new DevOpsEngineerAgent(`${this.projectId}-devops-engineer`, this.projectId, this.context),
      new QAEngineerAgent(`${this.projectId}-qa-engineer`, this.projectId, this.context),
      new CodeReviewerAgent(`${this.projectId}-code-reviewer`, this.projectId, this.context),
      new DocumentationWriterAgent(`${this.projectId}-documentation-writer`, this.projectId, this.context)
    ];

    // Initialize and register each agent
    for (const agent of agents) {
      await agent.initialize();
      // Register with the graph by wrapping in AgentNode
      if (this.graph) {
        await this.graph.addAgent(agent.role, {
          name: agent.role,
          execute: agent.execute.bind(agent),
          shutdown: agent.shutdown.bind(agent)
        });
      }
    }

    this.context.logger.info(`Registered ${agents.length} agents in orchestrator graph`);
  }

  /**
   * Set up event listeners for graph execution
   */
  private setupEventListeners(): void {
    if (!this.graph) return;

    this.graph.on('stateUpdate', (state: Partial<HeliosSwarmState>) => {
      // Emit state updates to project monitoring
      this.context.io.to(`/projects:${this.projectId}`).emit('stateUpdate', state);
      this.projectEmitter.emit('stateUpdate', state);
    });

    this.graph.on('agentStart', (data: any) => {
      this.context.io.to(`/projects:${this.projectId}`).emit('agentStart', data);
      this.projectEmitter.emit('agentStart', data);
    });

    this.graph.on('agentComplete', (data: any) => {
      this.context.io.to(`/projects:${this.projectId}`).emit('agentComplete', data);
      this.projectEmitter.emit('agentComplete', data);
    });

    this.graph.on('error', (error: any) => {
      this.context.logger.error('Graph execution error:', error);
      this.context.io.to(`/projects:${this.projectId}`).emit('error', error);
      this.projectEmitter.emit('error', error);
    });
  }

  /**
   * Main execution method for the orchestrator
   */
  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    if (!this.graph) {
      throw new Error('Graph not initialized');
    }

    try {
      this.setStatus(AgentStatus.EXECUTING);

      // The graph manages its own state internally
      const result = await this.graph.run();

      this.setStatus(AgentStatus.COMPLETED);
      return result;
    } catch (error) {
      this.setStatus(AgentStatus.ERROR);
      throw error;
    }
  }

  /**
   * Execute the project asynchronously
   */
  async executeProject(projectData: any): Promise<void> {
    if (!this.graph) {
      throw new Error('Graph not initialized');
    }

    // Start execution in background
    this.executionTimer = setTimeout(async () => {
      try {
        this.context.logger.info(`Starting project execution for ${this.projectId}`);
        
        const state: Partial<HeliosSwarmState> = {
          projectId: this.projectId,
          projectName: projectData.name,
          projectDescription: projectData.description,
          active_agent: AgentRole.PROJECT_ANALYZER,  // Changed from PRODUCT_MANAGER
          messages: [],
          tasks: [],
          currentTaskId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await this.execute(state);
        
        // Emit completion event
        this.context.io.to(`/projects:${this.projectId}`).emit('projectComplete', {
          projectId: this.projectId,
          result
        });
        
      } catch (error) {
        this.context.logger.error(`Project execution error: ${error instanceof Error ? error.message : String(error)}`);
        
        // Emit error event
        this.context.io.to(`/projects:${this.projectId}`).emit('projectError', {
          projectId: this.projectId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 100); // Small delay to allow response to be sent
  }

  /**
   * Validate input for the orchestrator
   */
  async validate(input: any): Promise<boolean> {
    // Validate project data
    if (!input.projectName || !input.projectDescription) {
      return false;
    }
    return true;
  }

  /**
   * Handle messages sent to the orchestrator
   */
  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    switch (message.type) {
      case 'request':
        return this.handleProjectRequest(message);
      case 'event':
        return this.handleProjectEvent(message);
      default:
        return {
          success: false,
          error: 'Unknown message type'
        };
    }
  }

  /**
   * Handle project requests
   */
  private async handleProjectRequest(message: AgentMessage): Promise<AgentResponse> {
    const { content } = message;
    
    switch (content.action) {
      case 'start':
        await this.executeProject(content.data);
        return {
          success: true,
          data: { message: 'Project execution started' }
        };
        
      case 'pause':
        // TODO: Implement pause logic
        return {
          success: true,
          data: { message: 'Project paused' }
        };
        
      case 'resume':
        // TODO: Implement resume logic
        return {
          success: true,
          data: { message: 'Project resumed' }
        };
        
      case 'status':
        return {
          success: true,
          data: await this.getProjectStatus()
        };
        
      default:
        return {
          success: false,
          error: 'Unknown action'
        };
    }
  }

  /**
   * Handle project events
   */
  private async handleProjectEvent(message: AgentMessage): Promise<AgentResponse> {
    // Handle various project events
    this.projectEmitter.emit('projectEvent', message);
    
    return {
      success: true,
      data: { message: 'Event processed' }
    };
  }

  /**
   * Get current project status
   */
  private async getProjectStatus(): Promise<any> {
    if (!this.graph) {
      return { status: 'not_initialized' };
    }

    try {
      const currentState = await this.graph.getState();
      
      return {
        projectId: this.projectId,
        status: this.status,
        currentAgent: currentState?.active_agent,
        completedTasks: currentState?.tasks.filter(t => t.status === 'completed').length || 0,
        totalTasks: currentState?.tasks.length || 0,
        errors: currentState?.errors || []
      };
    } catch (error) {
      return {
        projectId: this.projectId,
        status: this.status,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Register a custom agent
   * TODO: Convert IAgent to AgentNode or update graph to accept IAgent
   */
  // async registerAgent(agent: IAgent): Promise<void> {
  //   if (!this.graph) {
  //     throw new Error('Graph not initialized');
  //   }
    
  //   await agent.initialize();
  //   await this.graph.addAgent(agent.role, agent);
  // }

  /**
   * Get project emitter for external listeners
   */
  getProjectEmitter(): EventEmitter {
    return this.projectEmitter;
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    // Clear execution timer
    if (this.executionTimer) {
      clearTimeout(this.executionTimer);
      this.executionTimer = null;
    }

    // Shutdown all agents
    if (this.graph) {
      const agents = this.graph.getAllAgents();
      for (const agent of agents) {
        await agent.shutdown();
      }
    }

    // Call parent shutdown
    await super.shutdown();
  }
}