/**
 * Agent System Exports
 * Central export point for all agent-related modules
 */

export * from './types';
export { BaseAgent } from './BaseAgent';
export { AgentRegistry } from './AgentRegistry';

// Export handoff tool creator
export { createHandoffTool } from './handoffTools';

// Export the Orchestrator Agent
export { OrchestratorAgent } from './OrchestratorAgent';

// Export placeholder agents
export {
  ProjectAnalyzerAgent,
  TaskDecomposerAgent,
  FrontendEngineerAgent,
  BackendEngineerAgent,
  FullstackEngineerAgent,
  DevOpsEngineerAgent,
  QAEngineerAgent,
  CodeReviewerAgent,
  DocumentationWriterAgent
} from './PlaceholderAgents';

// Re-export commonly used types for convenience
export type {
  IAgent,
  AgentMessage,
  AgentResponse,
  HeliosSwarmState,
  Task,
  Artifact,
  AgentConfig,
  AgentContext
} from './types';

export {
  AgentRole,
  AgentStatus
} from './types';
