import { EventEmitter } from 'events';
import { AgentNode } from './AgentNode';
import {
  AgentRole,
  AgentContext,
  HeliosSwarmState,
  AgentError
} from '../agents/types';

/**
 * The OrchestratorGraph manages the execution flow of agents in the Helios swarm.
 * It implements the Swarm Router (The Brain) for conditional routing logic.
 */
export class OrchestratorGraph extends EventEmitter {
  private agents: Map<AgentRole, AgentNode>;
  private state: HeliosSwarmState;
  private context: AgentContext;
  private isRunning: boolean;
  private executionHistory: Array<{
    agent: AgentRole;
    timestamp: Date;
    duration: number;
    success: boolean;
    error?: string;
  }>;
  
  constructor(projectId: string, projectName: string, projectDescription: string, context: AgentContext) {
    super();
    this.agents = new Map();
    this.context = context;
    this.isRunning = false;
    this.executionHistory = [];
    
    // Initialize state
    this.state = {
      projectId,
      projectName,
      projectDescription,
      active_agent: null,
      messages: [],
      tasks: [],
      currentTaskId: null,
      taskDependencies: new Map(),
      artifacts: new Map(),
      agentStates: new Map(),
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      completed: false
    };
    
    // Initialize default agents
    this.initializeDefaultAgents();
  }
  
  /**
   * Initialize default agents for the swarm
   */
  private initializeDefaultAgents(): void {
    const roles = [
      AgentRole.PROJECT_ANALYZER,      // Changed from PRODUCT_MANAGER
      AgentRole.TASK_DECOMPOSER,       // NEW
      AgentRole.FRONTEND_ENGINEER,
      AgentRole.BACKEND_ENGINEER,
      AgentRole.FULLSTACK_ENGINEER,
      AgentRole.DEVOPS_ENGINEER,
      AgentRole.QA_ENGINEER,
      AgentRole.CODE_REVIEWER,
      AgentRole.DOCUMENTATION_WRITER   // NEW, replacing INTEGRATION_SPECIALIST
    ];
    
    roles.forEach(role => {
      const agent = new AgentNode(
        `${role}-${this.state.projectId}`,
        role,
        this.state.projectId,
        this.context
      );
      this.agents.set(role, agent);
    });
  }
  
  /**
   * Add a custom agent to the graph
   * Can accept either an AgentNode or an object with execute function
   */
  async addAgent(role: AgentRole, agent: AgentNode | { name: string; execute: Function; shutdown?: Function }): Promise<void> {
    if (this.isRunning) {
      throw new Error('Cannot add agents while graph is running');
    }
    
    let agentNode: AgentNode;
    
    if (agent instanceof AgentNode) {
      agentNode = agent;
    } else {
      // Create an AgentNode wrapper for the provided functions
      agentNode = new AgentNode(
        `${role}-${this.state.projectId}`,
        role,
        this.state.projectId,
        this.context
      );
      
      // Set the custom execute function
      if (agent.execute) {
        agentNode.setExecuteFunction(agent.execute as any);
      }
      
      // Store shutdown function if provided
      if (agent.shutdown) {
        (agentNode as any).customShutdown = agent.shutdown;
      }
    }
    
    this.agents.set(role, agentNode);
    this.emit('agent:added', { role, agentId: agentNode.id });
  }
  
  /**
   * Remove an agent from the graph
   */
  removeAgent(role: AgentRole): void {
    if (this.isRunning) {
      throw new Error('Cannot remove agents while graph is running');
    }
    const agent = this.agents.get(role);
    if (agent) {
      this.agents.delete(role);
      this.emit('agent:removed', { role, agentId: agent.id });
    }
  }
  
  /**
   * Get an agent by role
   */
  getAgent(role: AgentRole): AgentNode | undefined {
    return this.agents.get(role);
  }
  
  /**
   * Get all agents
   */
  getAllAgents(): AgentNode[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Main execution loop - runs agents based on state routing
   */
  async run(initialAgent?: AgentRole): Promise<HeliosSwarmState> {
    if (this.isRunning) {
      throw new Error('Graph is already running');
    }
    
    this.isRunning = true;
    this.emit('execution:started', { projectId: this.state.projectId });
    
    try {
      // Set initial agent
      this.state.active_agent = initialAgent || AgentRole.PROJECT_ANALYZER;
      
      // Initialize all agents
      await this.initializeAgents();
      
      // Main execution loop
      while (!this.state.completed && this.state.active_agent) {
        const startTime = Date.now();
        const currentAgent = this.state.active_agent;
        
        try {
          // Execute current agent
          await this.executeAgent(currentAgent);
          
          // Record successful execution
          this.executionHistory.push({
            agent: currentAgent,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            success: true
          });
          
          // Route to next agent
          await this.routeToNextAgent();
          
        } catch (error) {
          // Record failed execution
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.executionHistory.push({
            agent: currentAgent,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            success: false,
            error: errorMessage
          });
          
          // Handle error and determine recovery strategy
          await this.handleExecutionError(currentAgent, error);
        }
      }
      
      // Finalize execution
      await this.finalizeExecution();
      
      return this.state;
      
    } finally {
      this.isRunning = false;
      await this.shutdownAgents();
      this.emit('execution:completed', { 
        projectId: this.state.projectId,
        success: this.state.completed,
        duration: this.calculateTotalDuration()
      });
    }
  }
  
  /**
   * Execute a specific agent
   */
  private async executeAgent(role: AgentRole): Promise<void> {
    const agent = this.agents.get(role);
    if (!agent) {
      throw new AgentError(
        `Agent not found: ${role}`,
        AgentRole.ORCHESTRATOR,
        'AGENT_NOT_FOUND'
      );
    }
    
    this.emit('agent:executing', { role, agentId: agent.id });
    
    try {
      // Execute agent and get state updates
      const stateUpdates = await agent.execute(this.state);
      
      // Merge state updates
      this.updateState(stateUpdates);
      
      // Store agent-specific state
      if (stateUpdates.agentStates) {
        this.state.agentStates.set(role, stateUpdates.agentStates.get(role));
      }
      
      this.emit('agent:completed', { role, agentId: agent.id, stateUpdates });
      
    } catch (error) {
      this.emit('agent:error', { role, agentId: agent.id, error });
      throw error;
    }
  }
  
  /**
   * Update the global state with partial updates
   */
  private updateState(updates: Partial<HeliosSwarmState>): void {
    // Merge simple properties
    Object.keys(updates).forEach(key => {
      if (key === 'messages' && updates.messages) {
        // Append messages
        this.state.messages = [...this.state.messages, ...updates.messages];
      } else if (key === 'tasks' && updates.tasks) {
        // Merge tasks
        this.state.tasks = [...this.state.tasks, ...updates.tasks];
      } else if (key === 'errors' && updates.errors) {
        // Append errors
        this.state.errors = [...this.state.errors, ...updates.errors];
      } else if (key === 'artifacts' && updates.artifacts) {
        // Merge artifacts
        updates.artifacts.forEach((value, key) => {
          this.state.artifacts.set(key, value);
        });
      } else if (key === 'taskDependencies' && updates.taskDependencies) {
        // Merge task dependencies
        updates.taskDependencies.forEach((value, key) => {
          this.state.taskDependencies.set(key, value);
        });
      } else if (key !== 'agentStates') {
        // Update other properties directly
        (this.state as any)[key] = (updates as any)[key];
      }
    });
    
    // Always update timestamp
    this.state.updatedAt = new Date();
    
    this.emit('state:updated', { updates });
  }
  
  /**
   * Route to the next agent based on current state (The Brain)
   */
  private async routeToNextAgent(): Promise<void> {
    // If nextAgent is explicitly set, use it
    if (this.state.nextAgent) {
      this.state.active_agent = this.state.nextAgent;
      this.state.nextAgent = undefined;
      return;
    }
    
    // Otherwise, apply routing logic based on current state
    const currentAgent = this.state.active_agent;
    
    switch (currentAgent) {
      case AgentRole.PROJECT_ANALYZER:
        // After analysis, move to task decomposition
        this.state.active_agent = AgentRole.TASK_DECOMPOSER;
        break;
        
      case AgentRole.TASK_DECOMPOSER:
        // After task decomposition, route based on project type
        if (this.requiresFullstack()) {
          this.state.active_agent = AgentRole.FULLSTACK_ENGINEER;
        } else {
          this.state.active_agent = AgentRole.BACKEND_ENGINEER;
        }
        break;
        
      case AgentRole.FRONTEND_ENGINEER:
        // Frontend to backend
        this.state.active_agent = AgentRole.BACKEND_ENGINEER;
        break;
        
      case AgentRole.BACKEND_ENGINEER:
        // Backend to DevOps if needed, otherwise QA
        if (this.requiresDevOps()) {
          this.state.active_agent = AgentRole.DEVOPS_ENGINEER;
        } else {
          this.state.active_agent = AgentRole.QA_ENGINEER;
        }
        break;
        
      case AgentRole.FULLSTACK_ENGINEER:
        // Fullstack to DevOps if needed, otherwise QA
        if (this.requiresDevOps()) {
          this.state.active_agent = AgentRole.DEVOPS_ENGINEER;
        } else {
          this.state.active_agent = AgentRole.QA_ENGINEER;
        }
        break;
        
      case AgentRole.DEVOPS_ENGINEER:
        // DevOps to QA
        this.state.active_agent = AgentRole.QA_ENGINEER;
        break;
        
      case AgentRole.QA_ENGINEER:
        // QA to Code Review
        this.state.active_agent = AgentRole.CODE_REVIEWER;
        break;
        
      case AgentRole.CODE_REVIEWER:
        // Code Review decision point
        if (this.hasFailedReview()) {
          // Route back to appropriate engineer
          this.state.active_agent = this.determineEngineerForFixes();
        } else {
          // After code review, generate documentation
          this.state.active_agent = AgentRole.DOCUMENTATION_WRITER;
        }
        break;
        
      case AgentRole.DOCUMENTATION_WRITER:
        // After documentation, mark as completed
        this.state.completed = true;
        this.state.active_agent = null;
        break;
        
      default:
        // Unknown state - mark as completed
        this.state.completed = true;
        this.state.active_agent = null;
    }
    
    this.emit('routing:decided', { 
      from: currentAgent, 
      to: this.state.active_agent,
      completed: this.state.completed
    });
  }
  
  /**
   * Determine if project requires fullstack approach
   */
  private requiresFullstack(): boolean {
    const description = this.state.projectDescription.toLowerCase();
    return description.includes('fullstack') || 
           description.includes('full-stack') ||
           (description.includes('frontend') && description.includes('backend'));
  }
  
  /**
   * Determine if project requires DevOps
   */
  private requiresDevOps(): boolean {
    const description = this.state.projectDescription.toLowerCase();
    return description.includes('deploy') || 
           description.includes('docker') ||
           description.includes('kubernetes') ||
           description.includes('ci/cd') ||
           description.includes('infrastructure');
  }
  
  /**
   * Check if code review failed
   */
  private hasFailedReview(): boolean {
    // Check if there are review-related errors or failed validation
    const reviewState = this.state.agentStates.get(AgentRole.CODE_REVIEWER);
    return reviewState?.reviewPassed === false;
  }
  
  /**
   * Determine which engineer should handle fixes
   */
  private determineEngineerForFixes(): AgentRole {
    const reviewState = this.state.agentStates.get(AgentRole.CODE_REVIEWER);
    const issueType = reviewState?.issueType;
    
    if (issueType === 'frontend') {
      return AgentRole.FRONTEND_ENGINEER;
    } else if (issueType === 'backend') {
      return AgentRole.BACKEND_ENGINEER;
    } else if (this.state.agentStates.has(AgentRole.FULLSTACK_ENGINEER)) {
      return AgentRole.FULLSTACK_ENGINEER;
    }
    
    // Default to frontend
    return AgentRole.FRONTEND_ENGINEER;
  }
  
  /**
   * Handle execution errors
   */
  private async handleExecutionError(agent: AgentRole, error: any): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    // Add to state errors
    this.state.errors.push(errorObj);
    
    // Log error
    await this.logError(agent, errorObj);
    
    // Determine recovery strategy
    if (this.canRecover(agent, errorObj)) {
      // Try alternative route
      this.state.active_agent = this.getAlternativeAgent(agent);
    } else {
      // Mark as failed and stop execution
      this.state.completed = true;
      this.state.active_agent = null;
    }
  }
  
  /**
   * Check if we can recover from error
   */
  private canRecover(agent: AgentRole, error: Error): boolean {
    // Check if error is recoverable
    if (error instanceof AgentError && error.code === 'MAX_RETRIES_EXCEEDED') {
      return false;
    }
    
    // Check if we have alternative agents
    return this.getAlternativeAgent(agent) !== null;
  }
  
  /**
   * Get alternative agent for recovery
   */
  private getAlternativeAgent(failedAgent: AgentRole): AgentRole | null {
    switch (failedAgent) {
      case AgentRole.FRONTEND_ENGINEER:
      case AgentRole.BACKEND_ENGINEER:
        // Try fullstack as alternative
        return this.agents.has(AgentRole.FULLSTACK_ENGINEER) ? 
               AgentRole.FULLSTACK_ENGINEER : null;
               
      case AgentRole.FULLSTACK_ENGINEER:
        // Try separate frontend/backend
        return AgentRole.FRONTEND_ENGINEER;
        
      default:
        // No alternative for other agents
        return null;
    }
  }
  
  /**
   * Initialize all agents
   */
  private async initializeAgents(): Promise<void> {
    const initPromises = Array.from(this.agents.values()).map(agent => 
      agent.initialize()
    );
    await Promise.all(initPromises);
  }
  
  /**
   * Shutdown all agents
   */
  private async shutdownAgents(): Promise<void> {
    const shutdownPromises = Array.from(this.agents.values()).map(agent => 
      agent.shutdown()
    );
    await Promise.all(shutdownPromises);
  }
  
  /**
   * Finalize execution
   */
  private async finalizeExecution(): Promise<void> {
    // Log final state
    await this.logFinalState();
    
    // Generate summary
    const summary = this.generateExecutionSummary();
    this.state.finalOutput = summary;
  }
  
  /**
   * Log error to database
   */
  private async logError(agent: AgentRole, error: Error): Promise<void> {
    try {
      const query = `
        INSERT INTO helios.agent_logs (agent_id, agent_role, project_id, action, details)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await this.context.db.query(query, [
        `orchestrator-${this.state.projectId}`,
        'orchestrator',
        this.state.projectId,
        'execution_error',
        JSON.stringify({
          failedAgent: agent,
          error: error.message,
          stack: error.stack
        })
      ]);
    } catch (logError) {
      this.context.logger.error('Failed to log error:', logError);
    }
  }
  
  /**
   * Log final state
   */
  private async logFinalState(): Promise<void> {
    try {
      const query = `
        INSERT INTO helios.agent_logs (agent_id, agent_role, project_id, action, details)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await this.context.db.query(query, [
        `orchestrator-${this.state.projectId}`,
        'orchestrator',
        this.state.projectId,
        'execution_completed',
        JSON.stringify({
          completed: this.state.completed,
          duration: this.calculateTotalDuration(),
          artifactCount: this.state.artifacts.size,
          errorCount: this.state.errors.length,
          executionHistory: this.executionHistory
        })
      ]);
    } catch (error) {
      this.context.logger.error('Failed to log final state:', error);
    }
  }
  
  /**
   * Generate execution summary
   */
  private generateExecutionSummary(): any {
    return {
      projectId: this.state.projectId,
      projectName: this.state.projectName,
      completed: this.state.completed,
      duration: this.calculateTotalDuration(),
      agentsExecuted: this.executionHistory.length,
      successfulExecutions: this.executionHistory.filter(h => h.success).length,
      failedExecutions: this.executionHistory.filter(h => !h.success).length,
      artifactsGenerated: this.state.artifacts.size,
      tasksCompleted: this.state.tasks.filter(t => t.status === 'completed').length,
      errors: this.state.errors.map(e => e.message)
    };
  }
  
  /**
   * Calculate total execution duration
   */
  private calculateTotalDuration(): number {
    return this.executionHistory.reduce((total, execution) => 
      total + execution.duration, 0
    );
  }
  
  /**
   * Get current state (read-only)
   */
  getState(): Readonly<HeliosSwarmState> {
    return { ...this.state };
  }
  
  /**
   * Get execution history
   */
  getExecutionHistory(): ReadonlyArray<typeof this.executionHistory[0]> {
    return [...this.executionHistory];
  }
}
