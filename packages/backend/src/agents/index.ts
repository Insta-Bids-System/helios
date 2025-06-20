/**
 * Agent System Exports
 * Central export point for all agent-related modules
 */

export * from './types';
export { BaseAgent } from './BaseAgent';
export { AgentRegistry } from './AgentRegistry';

// Export handoff tool creator
export { createHandoffTool } from './handoffTools';

// Re-export commonly used types for convenience
export type {
  IAgent,
  AgentMessage,
  AgentResponse,
  HeliosSwarmState,
  Task,
  Artifact,
  Project,
  AgentConfig,
  AgentContext,
  ValidationResult
} from './types';

export {
  AgentRole,
  AgentStatus,
  MessageType
} from './types';
