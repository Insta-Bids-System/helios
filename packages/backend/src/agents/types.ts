/**
 * Agent System Type Definitions
 * Core interfaces and types for the Helios multi-agent system
 */

import { Pool } from 'pg';
import { Server as SocketIOServer } from 'socket.io';

/**
 * Agent roles within the Helios system
 */
export enum AgentRole {
  ORCHESTRATOR = 'ORCHESTRATOR',
  PROJECT_ANALYZER = 'PROJECT_ANALYZER',
  TASK_DECOMPOSER = 'TASK_DECOMPOSER',
  PRODUCT_MANAGER = 'PRODUCT_MANAGER',
  BACKEND_ENGINEER = 'BACKEND_ENGINEER',
  FRONTEND_ENGINEER = 'FRONTEND_ENGINEER',
  QA_ENGINEER = 'QA_ENGINEER',
  DEVOPS_ENGINEER = 'DEVOPS_ENGINEER',
  DOCUMENTATION_WRITER = 'DOCUMENTATION_WRITER'
}

/**
 * Agent status states
 */
export enum AgentStatus {
  IDLE = 'IDLE',
  EXECUTING = 'EXECUTING',
  WAITING = 'WAITING',
  ERROR = 'ERROR',
  COMPLETED = 'COMPLETED'
}

/**
 * Message types for inter-agent communication
 */
export enum MessageType {
  TASK_REQUEST = 'TASK_REQUEST',
  TASK_RESPONSE = 'TASK_RESPONSE',
  HANDOFF = 'HANDOFF',
  STATUS_UPDATE = 'STATUS_UPDATE',
  ERROR_REPORT = 'ERROR_REPORT',
  VALIDATION_REQUEST = 'VALIDATION_REQUEST',
  VALIDATION_RESPONSE = 'VALIDATION_RESPONSE'
}

/**
 * Base interface for all agents
 */
export interface IAgent {
  id: string;
  role: AgentRole;
  projectId: string;
  status: AgentStatus;
  
  // Core methods
  execute(state: HeliosSwarmState): Promise<Partial<HeliosSwarmState>>;
  log(action: string, details: any): Promise<void>;
  communicate(targetAgent: string, message: AgentMessage): Promise<void>;
  
  // Lifecycle methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Inter-agent message structure
 */
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: any;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Agent response structure
 */
export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Task structure from the database
 */
export interface Task {
  id: string;
  project_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  assigned_agent?: string;
  result?: any;
  created_at: Date;
  updated_at: Date;
}

/**
 * Artifact structure from the database
 */
export interface Artifact {
  id: string;
  project_id: string;
  file_path: string;
  content: string;
  version: number;
  is_latest: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  created_by: string;
}

/**
 * Project structure from the database
 */
export interface Project {
  id: string;
  name: string;
  user_prompt: string;
  status: 'planning' | 'in_progress' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

/**
 * Central state object for the Helios swarm
 * This is the single source of truth for all agents
 */
export interface HeliosSwarmState {
  active_agent: string;
  project_id: string;
  project: Project;
  user_prompt: string;
  plan: Task[];
  artifacts: Artifact[];
  current_task?: Task;
  agent_logs: AgentLog[];
  error_logs: ErrorLog[];
  handoff_history: HandoffRecord[];
  validation_results?: ValidationResult[];
}

/**
 * Agent log entry structure
 */
export interface AgentLog {
  id: string;
  project_id: string;
  agent_role: AgentRole;
  action: string;
  action_details: Record<string, any>;
  timestamp: Date;
}

/**
 * Error log structure for debugging
 */
export interface ErrorLog {
  id: string;
  agent_id: string;
  error_type: string;
  message: string;
  stack_trace?: string;
  context: Record<string, any>;
  timestamp: Date;
}

/**
 * Handoff record for tracking control flow
 */
export interface HandoffRecord {
  from_agent: string;
  to_agent: string;
  reason: string;
  task_id?: string;
  timestamp: Date;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

/**
 * Agent configuration options
 */
export interface AgentConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  llmConfig?: LLMConfig;
}

/**
 * LLM configuration for agents that use language models
 */
export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

/**
 * Agent registry interface
 */
export interface IAgentRegistry {
  register(agent: IAgent): void;
  unregister(agentId: string): void;
  getAgent(agentId: string): IAgent | undefined;
  getAgentsByRole(role: AgentRole): IAgent[];
  getAgentsByProject(projectId: string): IAgent[];
  getAllAgents(): IAgent[];
}

/**
 * Handoff tool function type
 */
export type HandoffTool = (state: HeliosSwarmState, reason: string) => Partial<HeliosSwarmState>;

/**
 * Agent context provided to all agents
 */
export interface AgentContext {
  db: Pool;
  io: SocketIOServer;
  registry: IAgentRegistry;
  projectWorkspace: string;
}
