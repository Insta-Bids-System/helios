import { BaseAgent } from './BaseAgent';
import { AgentRole, HeliosSwarmState, AgentContext } from './types';

// Project Analyzer Agent (renamed from Product Manager)
export class ProjectAnalyzerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.PROJECT_ANALYZER, projectId, context);
  }

  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    // Analyze project requirements and prepare for task decomposition
    this.context.logger.info('ProjectAnalyzerAgent: Analyzing project requirements');
    
    // Pass to task decomposer for breakdown
    return {
      projectDescription: state.projectDescription || '',
      nextAgent: AgentRole.TASK_DECOMPOSER
    };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// Task Decomposer Agent (NEW)
export class TaskDecomposerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.TASK_DECOMPOSER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    // Break down project into discrete tasks
    this.context.logger.info('TaskDecomposerAgent: Decomposing project into tasks');
    
    // Create task breakdown
    const tasks = [{
      id: `task-${Date.now()}-backend`,
      projectId: this.projectId,
      title: 'Implement backend services',
      description: 'Create API endpoints and business logic',
      assignedAgent: AgentRole.BACKEND_ENGINEER,
      status: 'pending' as const,
      dependencies: [],
      artifacts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      id: `task-${Date.now()}-frontend`,
      projectId: this.projectId,
      title: 'Implement frontend interface',
      description: 'Create user interface components',
      assignedAgent: AgentRole.FRONTEND_ENGINEER,
      status: 'pending' as const,
      dependencies: [`task-${Date.now()}-backend`],
      artifacts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }];
    
    return {
      tasks,
      plan: tasks,
      nextAgent: AgentRole.BACKEND_ENGINEER
    };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// Frontend Engineer Agent
export class FrontendEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.FRONTEND_ENGINEER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('FrontendEngineerAgent: Building frontend components');
    return { nextAgent: AgentRole.QA_ENGINEER };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// Backend Engineer Agent
export class BackendEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.BACKEND_ENGINEER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('BackendEngineerAgent: Building backend services');
    return { nextAgent: AgentRole.FRONTEND_ENGINEER };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// Fullstack Engineer Agent
export class FullstackEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.FULLSTACK_ENGINEER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('FullstackEngineerAgent: Building full application');
    return { nextAgent: AgentRole.DEVOPS_ENGINEER };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// DevOps Engineer Agent
export class DevOpsEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.DEVOPS_ENGINEER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('DevOpsEngineerAgent: Setting up deployment');
    return { nextAgent: AgentRole.QA_ENGINEER };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// QA Engineer Agent
export class QAEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.QA_ENGINEER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('QAEngineerAgent: Running tests');
    return { nextAgent: AgentRole.CODE_REVIEWER };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// Code Reviewer Agent
export class CodeReviewerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.CODE_REVIEWER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('CodeReviewerAgent: Reviewing code quality');
    // Pass to documentation writer
    return { nextAgent: AgentRole.DOCUMENTATION_WRITER };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}

// Documentation Writer Agent (NEW)
export class DocumentationWriterAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.DOCUMENTATION_WRITER, projectId, context);
  }

  async execute(_state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('DocumentationWriterAgent: Generating project documentation');
    
    // Generate documentation for all code artifacts
    const documentation = {
      id: `doc-${Date.now()}`,
      projectId: this.projectId,
      agentId: this.id,  // Added missing field
      type: 'documentation',
      name: 'Project Documentation',
      content: '# Project Documentation\n\nThis document provides comprehensive documentation for the project.',
      version: 1,
      metadata: { format: 'markdown' },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Mark project as completed after documentation
    return { 
      artifacts: new Map([['documentation', documentation]]),
      completed: true,
      finalOutput: 'Project completed successfully with documentation'
    };
  }

  async validate(_input: any): Promise<boolean> {
    return true;
  }
}
