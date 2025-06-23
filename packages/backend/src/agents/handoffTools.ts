/**
 * Handoff Tools
 * Creates tools for transferring control between agents
 */

import { HeliosSwarmState, HandoffTool, HandoffRecord, AgentRole } from './types';
import { logger } from '../utils/logger';

/**
 * Configuration interface for handoff tools
 * Restores the blueprint's semantic richness
 */
export interface HandoffToolConfig {
  name: string;
  description: string;
  targetAgent: AgentRole;
  condition?: (state: HeliosSwarmState) => boolean;
  prepareContext?: (state: HeliosSwarmState) => any;
}

/**
 * Extended HandoffTool with metadata
 */
export interface HandoffToolWithConfig extends HandoffToolConfig {
  execute: HandoffTool;
}

/**
 * Creates a handoff tool for transferring control to a specific agent
 * This is the primary mechanism for agent coordination
 */
export function createHandoffTool(targetAgentRole: AgentRole): HandoffTool {
  return (state: HeliosSwarmState, reason: string): Partial<HeliosSwarmState> => {
    const handoffRecord: HandoffRecord = {
      from_agent: state.active_agent ? String(state.active_agent) : null,
      to_agent: targetAgentRole,
      reason,
      task_id: state.current_task?.id,
      timestamp: new Date()
    };

    logger.info(`Handoff: ${state.active_agent} -> ${targetAgentRole} (${reason})`);

    return {
      active_agent: targetAgentRole,
      handoff_history: [...(state.handoff_history || []), handoffRecord]
    };
  };
}

/**
 * Creates a handoff tool with full configuration
 */
export function createConfiguredHandoffTool(config: HandoffToolConfig): HandoffToolWithConfig {
  return {
    ...config,
    execute: createHandoffTool(config.targetAgent)
  };
}

/**
 * Pre-defined handoff tools for common transitions
 * Updated to use correct agent names from blueprint
 */
export const HandoffTools = {
  // Planning phase handoffs
  toProjectAnalyzer: createHandoffTool(AgentRole.PROJECT_ANALYZER),
  toTaskDecomposer: createHandoffTool(AgentRole.TASK_DECOMPOSER),
  
  // Engineering phase handoffs
  toBackendEngineer: createHandoffTool(AgentRole.BACKEND_ENGINEER),
  toFrontendEngineer: createHandoffTool(AgentRole.FRONTEND_ENGINEER),
  toFullstackEngineer: createHandoffTool(AgentRole.FULLSTACK_ENGINEER),
  toDevOpsEngineer: createHandoffTool(AgentRole.DEVOPS_ENGINEER),
  
  // Quality and documentation handoffs
  toQAEngineer: createHandoffTool(AgentRole.QA_ENGINEER),
  toCodeReviewer: createHandoffTool(AgentRole.CODE_REVIEWER),
  toDocumentationWriter: createHandoffTool(AgentRole.DOCUMENTATION_WRITER),
  
  // Special handoffs
  toOrchestrator: createHandoffTool(AgentRole.ORCHESTRATOR),
  complete: (_state: HeliosSwarmState, reason: string): Partial<HeliosSwarmState> => ({
    completed: true,
    active_agent: null,
    finalOutput: reason
  })
};

/**
 * Configured handoff tools with metadata
 * Provides semantic information about each handoff
 */
export const ConfiguredHandoffTools: Record<string, HandoffToolWithConfig> = {
  projectAnalysis: createConfiguredHandoffTool({
    name: 'handoff_to_project_analyzer',
    description: 'Transfer control to Project Analyzer for requirements analysis',
    targetAgent: AgentRole.PROJECT_ANALYZER,
    condition: (state) => !state.projectDescription || state.projectDescription.length === 0
  }),
  
  taskDecomposition: createConfiguredHandoffTool({
    name: 'handoff_to_task_decomposer',
    description: 'Transfer control to Task Decomposer for breaking down project into tasks',
    targetAgent: AgentRole.TASK_DECOMPOSER,
    condition: (state) => state.projectDescription !== undefined && (!state.plan || state.plan.length === 0)
  }),
  
  backendDevelopment: createConfiguredHandoffTool({
    name: 'handoff_to_backend_engineer',
    description: 'Transfer control to Backend Engineer for API development',
    targetAgent: AgentRole.BACKEND_ENGINEER,
    prepareContext: (state) => ({
      tasks: state.tasks?.filter(t => t.assignedAgent === AgentRole.BACKEND_ENGINEER)
    })
  }),
  
  frontendDevelopment: createConfiguredHandoffTool({
    name: 'handoff_to_frontend_engineer',
    description: 'Transfer control to Frontend Engineer for UI development',
    targetAgent: AgentRole.FRONTEND_ENGINEER,
    prepareContext: (state) => ({
      tasks: state.tasks?.filter(t => t.assignedAgent === AgentRole.FRONTEND_ENGINEER)
    })
  }),
  
  qualityAssurance: createConfiguredHandoffTool({
    name: 'handoff_to_qa_engineer',
    description: 'Transfer control to QA Engineer for testing',
    targetAgent: AgentRole.QA_ENGINEER,
    condition: (state) => state.artifacts && state.artifacts.size > 0
  }),
  
  documentation: createConfiguredHandoffTool({
    name: 'handoff_to_documentation_writer',
    description: 'Transfer control to Documentation Writer for generating docs',
    targetAgent: AgentRole.DOCUMENTATION_WRITER,
    condition: (state) => state.artifacts && state.artifacts.size > 0
  })
};

/**
 * Creates a conditional handoff based on validation results
 */
export function createConditionalHandoff(
  successAgent: AgentRole,
  failureAgent: AgentRole
): (state: HeliosSwarmState, success: boolean, reason: string) => Partial<HeliosSwarmState> {
  return (state: HeliosSwarmState, success: boolean, reason: string) => {
    const targetAgent = success ? successAgent : failureAgent;
    return createHandoffTool(targetAgent)(state, reason);
  };
}

/**
 * Creates a handoff tool that includes task assignment
 */
export function createTaskHandoff(
  targetAgentRole: AgentRole,
  taskId: string
): HandoffTool {
  return (state: HeliosSwarmState, reason: string): Partial<HeliosSwarmState> => {
    const task = state.plan?.find(t => t.id === taskId);
    
    if (!task) {
      logger.error(`Task ${taskId} not found for handoff to ${targetAgentRole}`);
      throw new Error(`Task ${taskId} not found`);
    }

    const handoffRecord: HandoffRecord = {
      from_agent: state.active_agent ? String(state.active_agent) : null,
      to_agent: targetAgentRole,
      reason,
      task_id: taskId,
      timestamp: new Date()
    };

    return {
      active_agent: targetAgentRole,
      current_task: task,
      handoff_history: [...(state.handoff_history || []), handoffRecord],
      plan: state.plan?.map(t => 
        t.id === taskId 
          ? { ...t, assignedAgent: targetAgentRole, status: 'in_progress' as const } 
          : t
      )
    };
  };
}

/**
 * Report success handoff for QA validation
 */
export function reportSuccess(nextAgent: AgentRole): HandoffTool {
  return createHandoffTool(nextAgent);
}

/**
 * Report failure handoff for QA validation
 */
export function reportFailure(originalAgent: AgentRole, errorLog: string): HandoffTool {
  return (state: HeliosSwarmState, reason: string): Partial<HeliosSwarmState> => {
    const handoff = createHandoffTool(originalAgent)(state, `QA Failed: ${reason}`);
    return {
      ...handoff,
      errors: [...(state.errors || []), new Error(`QA Failure: ${errorLog}`)]
    };
  };
}
