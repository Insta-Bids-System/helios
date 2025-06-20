/**
 * BaseAgent Abstract Class
 * Provides core functionality for all agents in the Helios system
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import { 
  IAgent, 
  AgentRole, 
  AgentStatus, 
  AgentMessage, 
  HeliosSwarmState,
  AgentConfig,
  AgentContext,
  AgentLog,
  ValidationResult
} from './types';
import logger from '../utils/logger';

/**
 * Abstract base class for all Helios agents
 * Implements core agent functionality including logging, communication, and error handling
 */
export abstract class BaseAgent implements IAgent {
  public readonly id: string;
  public readonly role: AgentRole;
  public projectId: string;
  public status: AgentStatus = AgentStatus.IDLE;

  protected config: AgentConfig;
  protected context: AgentContext;
  private retryCount: Map<string, number> = new Map();

  constructor(
    role: AgentRole,
    projectId: string,
    context: AgentContext,
    config?: Partial<AgentConfig>
  ) {
    this.id = uuidv4();
    this.role = role;
    this.projectId = projectId;
    this.context = context;
    
    // Default configuration with overrides
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 60000,
      ...config
    };
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.status = AgentStatus.IDLE;
    logger.info(`Agent ${this.role} (${this.id}) initialized for project ${this.projectId}`);
    await this.log('agent_initialized', { agentId: this.id, role: this.role });
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    this.status = AgentStatus.COMPLETED;
    await this.log('agent_shutdown', { agentId: this.id, role: this.role });
    logger.info(`Agent ${this.role} (${this.id}) shutdown`);
  }

  /**
   * Abstract execute method - must be implemented by subclasses
   * This is where the agent performs its specialized work
   */
  abstract execute(state: HeliosSwarmState): Promise<Partial<HeliosSwarmState>>;

  /**
   * Log an action to the database
   */
  async log(action: string, details: any): Promise<void> {
    try {
      const query = `
        INSERT INTO helios.agent_logs (project_id, agent_role, action, action_details)
        VALUES ($1, $2, $3, $4)
      `;
      
      await this.context.db.query(query, [
        this.projectId,
        this.role,
        action,
        JSON.stringify(details)
      ]);

      // Emit log event via WebSocket
      this.context.io.to(`project:${this.projectId}`).emit('agent_log', {
        projectId: this.projectId,
        agentRole: this.role,
        action,
        actionDetails: details,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error(`Failed to log agent action: ${error}`);
    }
  }

  /**
   * Send a message to another agent
   */
  async communicate(targetAgentId: string, message: Omit<AgentMessage, 'id' | 'from' | 'timestamp'>): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      from: this.id,
      to: targetAgentId,
      timestamp: new Date()
    };

    // Log the communication
    await this.log('agent_communication', {
      targetAgent: targetAgentId,
      messageType: message.type,
      correlationId: message.correlationId
    });

    // Emit via Socket.io for real-time communication
    this.context.io.to(`agent:${targetAgentId}`).emit('agent_message', fullMessage);
    
    // Also emit to project room for monitoring
    this.context.io.to(`project:${this.projectId}`).emit('agent_communication', fullMessage);
  }

  /**
   * Execute with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const attempts = this.retryCount.get(operationName) || 0;
    
    try {
      this.status = AgentStatus.EXECUTING;
      const result = await operation();
      this.retryCount.delete(operationName);
      return result;
    } catch (error) {
      this.status = AgentStatus.ERROR;
      
      if (attempts < this.config.maxRetries) {
        this.retryCount.set(operationName, attempts + 1);
        
        await this.log('retry_operation', {
          operation: operationName,
          attempt: attempts + 1,
          maxRetries: this.config.maxRetries,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempts);
        await this.sleep(delay);
        
        // Recursive retry
        return this.executeWithRetry(operation, operationName);
      } else {
        // Max retries exceeded
        await this.log('operation_failed', {
          operation: operationName,
          attempts: attempts + 1,
          error: error instanceof Error ? error.message : String(error)
        });
        
        throw error;
      }
    }
  }

  /**
   * Validate output using the Generate -> Validate -> Correct pattern
   */
  protected async validateAndCorrect<T>(
    output: T,
    validator: (output: T) => ValidationResult,
    corrector: (output: T, errors: string[]) => Promise<T>,
    maxAttempts: number = 2
  ): Promise<T> {
    let currentOutput = output;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const validation = validator(currentOutput);
      
      if (validation.valid) {
        await this.log('validation_passed', {
          attempts: attempts + 1,
          warnings: validation.warnings
        });
        return currentOutput;
      }

      attempts++;
      
      if (attempts < maxAttempts) {
        await this.log('validation_failed', {
          attempt: attempts,
          errors: validation.errors,
          warnings: validation.warnings
        });
        
        currentOutput = await corrector(currentOutput, validation.errors);
      } else {
        await this.log('validation_exceeded_attempts', {
          attempts,
          errors: validation.errors
        });
        
        throw new Error(`Validation failed after ${attempts} attempts: ${validation.errors.join(', ')}`);
      }
    }

    return currentOutput;
  }

  /**
   * Update agent status and emit status change
   */
  protected async updateStatus(newStatus: AgentStatus): Promise<void> {
    const oldStatus = this.status;
    this.status = newStatus;
    
    await this.log('status_change', {
      oldStatus,
      newStatus
    });
    
    this.context.io.to(`project:${this.projectId}`).emit('agent_status_change', {
      agentId: this.id,
      agentRole: this.role,
      oldStatus,
      newStatus,
      timestamp: new Date()
    });
  }

  /**
   * Helper method for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
