import { BaseAgent } from '../agents/BaseAgent';
import { 
  AgentRole, 
  AgentContext, 
  HeliosSwarmState,
  AgentError,
  AgentStatus
} from '../agents/types';

/**
 * Generic agent node that can be used in the orchestrator graph.
 * This class provides a standard pattern for agents that participate in the swarm.
 */
export class AgentNode extends BaseAgent {
  private executeFunction?: (state: Partial<HeliosSwarmState>) => Promise<Partial<HeliosSwarmState>>;
  private validateFunction?: (input: any) => Promise<boolean>;
  
  constructor(
    id: string,
    role: AgentRole,
    projectId: string,
    context: AgentContext,
    executeFunction?: (state: Partial<HeliosSwarmState>) => Promise<Partial<HeliosSwarmState>>,
    validateFunction?: (input: any) => Promise<boolean>
  ) {
    super(id, role, projectId, context);
    this.executeFunction = executeFunction;
    this.validateFunction = validateFunction;
  }
  
  /**
   * Execute the agent's main logic with state updates
   */
  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    try {
      this.setStatus(AgentStatus.EXECUTING);
      await this.logAction('execute_started', { state });
      
      // If a custom execute function is provided, use it
      if (this.executeFunction) {
        return await this.executeWithRetry(
          () => this.executeFunction!(state),
          `${this.role}_execute`
        );
      }
      
      // Default implementation based on role
      const updatedState = await this.executeWithRetry(
        () => this.performRoleSpecificExecution(state),
        `${this.role}_execute`
      );
      
      await this.logAction('execute_completed', { updatedState });
      this.setStatus(AgentStatus.COMPLETED);
      
      return updatedState;
    } catch (error) {
      this.setStatus(AgentStatus.ERROR);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logAction('execute_error', { error: errorMessage });
      
      throw new AgentError(
        `Execution failed for ${this.role}`,
        this.role,
        'EXECUTION_FAILED',
        { originalError: errorMessage }
      );
    }
  }
  
  /**
   * Validate input based on agent role
   */
  async validate(input: any): Promise<boolean> {
    try {
      // If a custom validate function is provided, use it
      if (this.validateFunction) {
        return await this.validateFunction(input);
      }
      
      // Default validation based on role
      return await this.performRoleSpecificValidation(input);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logAction('validation_error', { error: errorMessage, input });
      return false;
    }
  }
  
  /**
   * Perform role-specific execution logic
   */
  private async performRoleSpecificExecution(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    const updatedState: Partial<HeliosSwarmState> = { ...state };
    
    switch (this.role) {
      case AgentRole.PROJECT_ANALYZER:
        // Project analyzer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Project analysis completed',
            timestamp: new Date()
          }
        ];
        updatedState.nextAgent = AgentRole.TASK_DECOMPOSER;
        break;
        
      case AgentRole.TASK_DECOMPOSER:
        // Task decomposer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Task decomposition completed',
            timestamp: new Date()
          }
        ];
        // Route to first implementation agent based on tasks
        updatedState.nextAgent = AgentRole.BACKEND_ENGINEER;
        break;
        
      case AgentRole.FRONTEND_ENGINEER:
        // Frontend engineer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Frontend implementation completed',
            timestamp: new Date()
          }
        ];
        updatedState.nextAgent = AgentRole.QA_ENGINEER;
        break;
        
      case AgentRole.BACKEND_ENGINEER:
        // Backend engineer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Backend implementation completed',
            timestamp: new Date()
          }
        ];
        updatedState.nextAgent = AgentRole.FRONTEND_ENGINEER;
        break;
        
      case AgentRole.FULLSTACK_ENGINEER:
        // Fullstack engineer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Full-stack implementation completed',
            timestamp: new Date()
          }
        ];
        updatedState.nextAgent = AgentRole.QA_ENGINEER;
        break;
        
      case AgentRole.QA_ENGINEER:
        // QA engineer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Testing completed',
            timestamp: new Date()
          }
        ];
        updatedState.nextAgent = AgentRole.CODE_REVIEWER;
        break;
        
      case AgentRole.CODE_REVIEWER:
        // Code reviewer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Code review completed',
            timestamp: new Date()
          }
        ];
        updatedState.nextAgent = AgentRole.DOCUMENTATION_WRITER;
        break;
        
      case AgentRole.DOCUMENTATION_WRITER:
        // Documentation writer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Documentation completed',
            timestamp: new Date()
          }
        ];
        updatedState.completed = true;
        break;
        
      case AgentRole.DEVOPS_ENGINEER:
        // DevOps engineer logic
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: 'Deployment configuration completed',
            timestamp: new Date()
          }
        ];
        updatedState.nextAgent = AgentRole.QA_ENGINEER;
        break;
        
      default:
        // Default behavior
        updatedState.messages = [
          ...(state.messages || []),
          {
            id: `msg-${Date.now()}`,
            from: this.role,
            to: 'all',
            type: 'event',
            content: `${this.role} completed task`,
            timestamp: new Date()
          }
        ];
    }
    
    // Update the timestamp
    updatedState.updatedAt = new Date();
    
    return updatedState;
  }
  
  /**
   * Perform role-specific validation
   */
  private async performRoleSpecificValidation(input: any): Promise<boolean> {
    switch (this.role) {
      case AgentRole.PROJECT_ANALYZER:
        // Validate project requirements
        return !!(input.projectName && input.projectDescription);
        
      case AgentRole.TASK_DECOMPOSER:
        // Validate project has been analyzed
        return !!(input.projectDescription);
        
      case AgentRole.FRONTEND_ENGINEER:
      case AgentRole.BACKEND_ENGINEER:
      case AgentRole.FULLSTACK_ENGINEER:
        // Validate code structure
        return !!(input.code && input.language);
        
      case AgentRole.QA_ENGINEER:
        // Validate test results
        return !!(input.testResults && Array.isArray(input.testResults));
        
      case AgentRole.CODE_REVIEWER:
        // Validate review comments
        return !!(input.reviewComments || input.approved);
        
      case AgentRole.DOCUMENTATION_WRITER:
        // Validate documentation input
        return !!(input.artifacts || input.code);
        
      default:
        // Default validation - just check if input exists
        return !!input;
    }
  }
  
  
  /**
   * Set a custom execute function for this node
   */
  setExecuteFunction(fn: (state: Partial<HeliosSwarmState>) => Promise<Partial<HeliosSwarmState>>): void {
    this.executeFunction = fn;
  }
  
  /**
   * Set a custom validate function for this node
   */
  setValidateFunction(fn: (input: any) => Promise<boolean>): void {
    this.validateFunction = fn;
  }
}
