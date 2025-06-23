/**
 * AgentRegistry Class
 * Manages all active agents in the Helios system
 */

import { IAgent, AgentRole } from './types';
import { logger } from '../utils/logger';

/**
 * Registry for managing agent instances
 * Provides lookup and lifecycle management for all agents
 */
export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map();
  private agentsByRole: Map<AgentRole, Set<string>> = new Map();
  private agentsByProject: Map<string, Set<string>> = new Map();

  constructor() {
    // Initialize role mappings
    Object.values(AgentRole).forEach(role => {
      this.agentsByRole.set(role as AgentRole, new Set());
    });
  }

  /**
   * Register a new agent
   */
  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      logger.warn(`Agent ${agent.id} is already registered`);
      return;
    }

    // Add to main registry
    this.agents.set(agent.id, agent);

    // Add to role index
    const roleAgents = this.agentsByRole.get(agent.role) || new Set();
    roleAgents.add(agent.id);
    this.agentsByRole.set(agent.role, roleAgents);

    // Add to project index
    const projectAgents = this.agentsByProject.get(agent.projectId) || new Set();
    projectAgents.add(agent.id);
    this.agentsByProject.set(agent.projectId, projectAgents);

    logger.info(`Registered agent ${agent.role} (${agent.id}) for project ${agent.projectId}`);
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn(`Attempted to unregister non-existent agent ${agentId}`);
      return;
    }

    // Remove from main registry
    this.agents.delete(agentId);

    // Remove from role index
    const roleAgents = this.agentsByRole.get(agent.role);
    if (roleAgents) {
      roleAgents.delete(agentId);
    }

    // Remove from project index
    const projectAgents = this.agentsByProject.get(agent.projectId);
    if (projectAgents) {
      projectAgents.delete(agentId);
      
      // Clean up empty project sets
      if (projectAgents.size === 0) {
        this.agentsByProject.delete(agent.projectId);
      }
    }

    logger.info(`Unregistered agent ${agent.role} (${agentId})`);
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents with a specific role
   */
  getAgentsByRole(role: AgentRole): IAgent[] {
    const agentIds = this.agentsByRole.get(role) || new Set();
    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is IAgent => agent !== undefined);
  }

  /**
   * Get all agents for a specific project
   */
  getAgentsByProject(projectId: string): IAgent[] {
    const agentIds = this.agentsByProject.get(projectId) || new Set();
    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is IAgent => agent !== undefined);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number;
    agentsByRole: Record<string, number>;
    activeProjects: number;
  } {
    const stats: Record<string, number> = {};
    
    this.agentsByRole.forEach((agents, role) => {
      stats[role] = agents.size;
    });

    return {
      totalAgents: this.agents.size,
      agentsByRole: stats,
      activeProjects: this.agentsByProject.size
    };
  }

  /**
   * Shutdown all agents for a project
   */
  async shutdownProject(projectId: string): Promise<void> {
    const projectAgents = this.getAgentsByProject(projectId);
    
    logger.info(`Shutting down ${projectAgents.length} agents for project ${projectId}`);
    
    await Promise.all(
      projectAgents.map(async agent => {
        try {
          await agent.shutdown();
          this.unregister(agent.id);
        } catch (error) {
          logger.error(`Error shutting down agent ${agent.id}: ${error}`);
        }
      })
    );
  }

  /**
   * Clear all agents (used for cleanup)
   */
  clear(): void {
    this.agents.clear();
    this.agentsByRole.forEach(set => set.clear());
    this.agentsByProject.clear();
    logger.info('Agent registry cleared');
  }
}
