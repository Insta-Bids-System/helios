import { Socket } from 'socket.io';

/**
 * Enum defining all agent roles in the Helios swarm
 */
export enum AgentRole {
  ORCHESTRATOR = 'orchestrator',
  PRODUCT_MANAGER = 'product_manager',
  FRONTEND_ENGINEER = 'frontend_engineer',
  BACKEND_ENGINEER = 'backend_engineer',
  FULLSTACK_ENGINEER = 'fullstack_engineer',
  DEVOPS_ENGINEER = 'devops_engineer',
  QA_ENGINEER = 'qa_engineer',
  CODE_REVIEWER = 'code_reviewer',
  INTEGRATION_SPECIALIST = 'integration_specialist'
}

/**
 * Agent status enum
 */
export enum AgentStatus {
  IDLE = 'idle',
  EXECUTING = 'executing',
  WAITING = 'waiting',
  ERROR = 'error',
  COMPLETED = 'completed'
}

/**
 * Central state object shared across all agents
 */
export interface HeliosSwarmState {
  // Project information
  projectId: string;
  projectName: string;
  projectDescription: string;
  
  // Current execution state
  active_agent: AgentRole | null;
  messages: AgentMessage[];
  
  // Task management
  tasks: Task[];
  currentTaskId: string | null;
  taskDependencies: Map<string, string[]>;
  
  // Artifacts and outputs
  artifacts: Map<string, Artifact>;
  
  // Agent-specific states
  agentStates: Map<AgentRole, any>;
  
  // Error tracking
  errors: Error[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Additional fields for graph execution
  completed: boolean;
  finalOutput?: any;
  nextAgent?: AgentRole;
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description: string;
  assignedAgent: AgentRole;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  artifacts: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: any;
}

/**
 * Artifact interface
 */
export interface Artifact {
  id: string;
  projectId: string;
  taskId?: string;
  agentId: string;
  type: string;
  name: string;
  content: string;
  version: number;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message passed between agents
 */
export interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole | 'all';
  type: 'request' | 'response' | 'event' | 'handoff';
  content: any;
  timestamp: Date;
  metadata?: any;
}

/**
 * Response structure from agents
 */
export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  nextAgent?: AgentRole;
  handoff?: {
    to: AgentRole;
    reason: string;
    context?: any;
  };
}

/**
 * Error class for agent operations
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public agentRole: AgentRole,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

/**
 * Core agent interface
 */
export interface IAgent {
  id: string;
  role: AgentRole;
  projectId: string;
  status: AgentStatus;
  
  // Core methods
  execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>>;
  validate(input: any): Promise<boolean>;
  handleMessage(message: AgentMessage): Promise<AgentResponse>;
  
  // Lifecycle methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Context provided to agents
 */
export interface AgentContext {
  db: any; // Database connection
  io: Socket; // Socket.io instance
  logger: any; // Logger instance
  config: AgentConfig;
}

/**
 * Handoff tool interface
 */
export interface HandoffTool {
  name: string;
  description: string;
  targetAgent: AgentRole;
  condition?: (state: HeliosSwarmState) => boolean;
  prepareContext?: (state: HeliosSwarmState) => any;
}
