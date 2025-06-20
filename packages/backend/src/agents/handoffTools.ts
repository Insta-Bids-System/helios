/**
 * Handoff Tools
 * Creates tools for transferring control between agents
 */

import { v4 as uuidv4 } from 'uuid';
import { HeliosSwarmState, HandoffTool, HandoffRecord } from './types';
import logger from '../utils/logger';

/**
 * Creates a handoff tool for transferring control to a specific agent
 * This is the primary mechanism for agent coordination
 */
export function createHandoffTool(targetAgentName: string): HandoffTool {
  return (state: HeliosSwarmState, reason: string): Partial<HeliosSwarmState> => {
    const handoffRecord: HandoffRecord = {
      from_agent: state.active_agent,
      to_agent: targetAgentName,
      reason,
      task_id: state.current_task?.id,
      timestamp: new Date()
    };

    logger.info(`Handoff: ${state.active_agent} -> ${targetAgentName} (${reason})`);

    return {
      active_agent: targetAgentName,
      handoff_history: [...(state.handoff_history || []), handoffRecord]
    };
  };
}

/**
 * Pre-defined handoff tools for common transitions
 */
export const HandoffTools = {
  // Planning phase handoffs
  toProjectAnalyzer: createHandoffTool('PROJECT_ANALYZER'),
  toProductManager: createHandoffTool('PRODUCT_MANAGER'),
  toTaskDecomposer: createHandoffTool('TASK_DECOMPOSER'),
  
  // Engineering phase handoffs
  toBackendEngineer: createHandoffTool('BACKEND_ENGINEER'),
  toFrontendEngineer: createHandoffTool('FRONTEND_ENGINEER'),
  toDevOpsEngineer: createHandoffTool('DEVOPS_ENGINEER'),
  
  // Quality and documentation handoffs
  toQAEngineer: createHandoffTool('QA_ENGINEER'),
  toDocumentationWriter: createHandoffTool('DOCUMENTATION_WRITER'),
  
  // Special handoffs
  toOrchestrator: createHandoffTool('ORCHESTRATOR'),
  complete: createHandoffTool('DONE')
};

/**
 * Creates a conditional handoff based on validation results
 */
export function createConditionalHandoff(
  successAgent: string,
  failureAgent: string
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
  targetAgentName: string,
  taskId: string
): HandoffTool {
  return (state: HeliosSwarmState, reason: string): Partial<HeliosSwarmState> => {
    const task = state.plan.find(t => t.id === taskId);
    
    if (!task) {
      logger.error(`Task ${taskId} not found for handoff to ${targetAgentName}`);
      throw new Error(`Task ${taskId} not found`);
    }

    const handoffRecord: HandoffRecord = {
      from_agent: state.active_agent,
      to_agent: targetAgentName,
      reason,
      task_id: taskId,
      timestamp: new Date()
    };

    return {
      active_agent: targetAgentName,
      current_task: task,
      handoff_history: [...(state.handoff_history || []), handoffRecord],
      plan: state.plan.map(t => 
        t.id === taskId 
          ? { ...t, assigned_agent: targetAgentName, status: 'in_progress' } 
          : t
      )
    };
  };
}
