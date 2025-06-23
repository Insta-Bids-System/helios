import { EventEmitter } from 'events';
import { 
  IAgent, 
  AgentRole, 
  AgentStatus, 
  AgentMessage, 
  AgentResponse, 
  AgentContext,
  AgentError,
  HeliosSwarmState
} from './types';

/**
 * Abstract base class for all agents in the Helios swarm
 */
export abstract class BaseAgent extends EventEmitter implements IAgent {
  public id: string;
  public role: AgentRole;
  public projectId: string;
  public status: AgentStatus;
  
  protected context: AgentContext;
  protected maxRetries: number;
  protected retryDelay: number;
  
  constructor(
    id: string,
    role: AgentRole,
    projectId: string,
    context: AgentContext
  ) {
    super();
    this.id = id;
    this.role = role;
    this.projectId = projectId;
    this.status = AgentStatus.IDLE;
    this.context = context;
    this.maxRetries = context.config?.maxRetries || 3;
    this.retryDelay = context.config?.retryDelay || 1000;
  }
  
  /**
   * Abstract method to be implemented by specific agents
   */
  abstract execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>>;
  
  /**
   * Validate input for the agent
   */
  abstract validate(input: any): Promise<boolean>;
  
  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.status = AgentStatus.IDLE;
    this.emit('initialized', { agentId: this.id, role: this.role });
    await this.logAction('initialized', { status: 'success' });
  }
  
  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    this.status = AgentStatus.IDLE;
    this.emit('shutdown', { agentId: this.id, role: this.role });
    await this.logAction('shutdown', { status: 'success' });
  }
  
  /**
   * Handle incoming messages
   */
  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    try {
      this.emit('message:received', message);
      
      // Log the message
      await this.logAction('message_received', { message });
      
      // Process based on message type
      switch (message.type) {
        case 'request':
          return await this.handleRequest(message);
        case 'handoff':
          return await this.handleHandoff(message);
        case 'event':
          return await this.handleEvent(message);
        default:
          return {
            success: true,
            data: { acknowledged: true }
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logAction('message_error', { error: errorMessage, message });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Handle request messages
   */
  protected async handleRequest(_message: AgentMessage): Promise<AgentResponse> {
    // Default implementation - can be overridden
    return {
      success: true,
      data: { message: 'Request received', agentRole: this.role }
    };
  }
  
  /**
   * Handle handoff messages
   */
  protected async handleHandoff(_message: AgentMessage): Promise<AgentResponse> {
    // Default implementation - can be overridden
    return {
      success: true,
      data: { message: 'Handoff received', agentRole: this.role }
    };
  }
  
  /**
   * Handle event messages
   */
  protected async handleEvent(_message: AgentMessage): Promise<AgentResponse> {
    // Default implementation - can be overridden
    return {
      success: true,
      data: { message: 'Event received', agentRole: this.role }
    };
  }
  
  /**
   * Execute with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.status = AgentStatus.EXECUTING;
        const result = await operation();
        this.status = AgentStatus.COMPLETED;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        this.context.logger.warn(`${this.role}: ${operationName} failed (attempt ${attempt}/${this.maxRetries})`, {
          error: lastError.message,
          attempt
        });
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.status = AgentStatus.ERROR;
    throw new AgentError(
      `${operationName} failed after ${this.maxRetries} attempts`,
      this.role,
      'MAX_RETRIES_EXCEEDED',
      { lastError: lastError?.message }
    );
  }
  
  /**
   * Log action to database
   */
  protected async logAction(action: string, details: any): Promise<void> {
    try {
      const query = `
        INSERT INTO helios.agent_logs (agent_id, agent_role, project_id, action, details)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await this.context.db.query(query, [
        this.id,
        this.role,
        this.projectId,
        action,
        JSON.stringify(details)
      ]);
    } catch (error) {
      this.context.logger.error(`Failed to log action: ${error}`);
    }
  }
  
  /**
   * Emit status change
   */
  protected setStatus(status: AgentStatus): void {
    const oldStatus = this.status;
    this.status = status;
    this.emit('status:changed', { oldStatus, newStatus: status });
  }
  
  /**
   * Send message to another agent
   */
  protected async sendMessage(to: AgentRole, content: any, type: 'request' | 'response' | 'event' | 'handoff' = 'request'): Promise<void> {
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: this.role,
      to,
      type,
      content,
      timestamp: new Date()
    };
    
    // Emit to Socket.io
    this.context.io.to(`agent-${to}`).emit('agent:message', message);
    
    // Log the message
    await this.logAction('message_sent', { message });
  }
  
  /**
   * Broadcast message to all agents
   */
  protected async broadcast(content: any, type: 'event' = 'event'): Promise<void> {
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: this.role,
      to: 'all',
      type,
      content,
      timestamp: new Date()
    };
    
    // Emit to all agents
    this.context.io.emit('agent:broadcast', message);
    
    // Log the broadcast
    await this.logAction('message_broadcast', { message });
  }
}
