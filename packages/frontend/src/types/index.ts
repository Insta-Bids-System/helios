// Re-export common types from API service
export type { 
  Project, 
  Task, 
  Artifact, 
  AgentLog, 
  CreateProjectRequest 
} from '../services/api';

// Socket event types
export interface SocketEvents {
  'connected': (isConnected: boolean) => void;
  'error': (error: Error) => void;
  'project:update': (data: { project: Project; currentAgent?: string }) => void;
  'project:created': (project: Project) => void;
  'project:completed': (data: { projectId: string; result: any }) => void;
  'project:error': (data: { projectId: string; error: string }) => void;
  'agent:state': (data: AgentStateUpdate) => void;
  'task:created': (data: { projectId: string; task: Task }) => void;
  'task:updated': (data: { projectId: string; task: Task }) => void;
  'artifact:created': (data: { projectId: string; artifact: Artifact }) => void;
  'log:created': (data: { projectId: string; log: AgentLog }) => void;
}

export interface AgentStateUpdate {
  projectId: string;
  agentId: string;
  agentRole: string;
  status: 'IDLE' | 'EXECUTING' | 'WAITING' | 'ERROR' | 'COMPLETED';
  message?: string;
  progress?: number;
}

// Re-export for convenience
import type { Project, Task, Artifact, AgentLog } from '../services/api';
