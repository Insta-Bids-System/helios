import { BaseAgent } from '../BaseAgent';
import { AgentRole, HeliosSwarmState, AgentContext, Task } from '../types';
import { LLMMessage } from '../../services/llm';
import { v4 as uuidv4 } from 'uuid';

interface TaskBreakdown {
  tasks: Array<{
    title: string;
    description: string;
    type: 'frontend' | 'backend' | 'database' | 'devops' | 'testing' | 'documentation';
    dependencies: string[]; // References to other task titles
    estimatedHours: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  executionPlan: string[];
}

export class TaskDecomposerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.TASK_DECOMPOSER, projectId, context);
  }

  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('TaskDecomposerAgent: Decomposing project into tasks');
    
    if (!this.context.llm) {
      return this.executePlaceholder(state);
    }

    try {
      const projectDescription = state.projectDescription || '';
      const projectAnalysis = state.projectAnalysis;
      
      // Use LLM to break down the project
      const systemPrompt = `You are an expert project manager breaking down a software project into discrete, actionable tasks.
Consider the project analysis and create a comprehensive task breakdown including:
- Clear, specific tasks with descriptions
- Task types (frontend, backend, database, devops, testing, documentation)
- Dependencies between tasks
- Time estimates
- Execution order`;

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: `Break down this project into tasks:
Project: ${projectDescription}
Analysis: ${JSON.stringify(projectAnalysis, null, 2)}`
        }
      ];

      const breakdown = await this.context.llm.generateStructuredOutput<TaskBreakdown>(
        messages,
        {
          tasks: [{
            title: 'string',
            description: 'string',
            type: 'frontend|backend|database|devops|testing|documentation',
            dependencies: ['string'],
            estimatedHours: 'number',
            priority: 'high|medium|low'
          }],
          executionPlan: ['string']
        },
        systemPrompt
      );

      // Create task objects and save to database
      const taskMap = new Map<string, string>(); // title -> id mapping
      const tasks: Task[] = [];

      // First pass: create all tasks with IDs
      for (const taskData of breakdown.tasks) {
        const taskId = uuidv4();
        taskMap.set(taskData.title, taskId);
        
        const task: Task = {
          id: taskId,
          projectId: this.projectId,
          title: taskData.title,
          description: taskData.description,
          status: 'pending',
          assignedAgent: this.determineAgent(taskData.type),
          dependencies: [], // Will be filled in second pass
          artifacts: [],
          metadata: {
            type: taskData.type,
            estimatedHours: taskData.estimatedHours,
            priority: taskData.priority
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        tasks.push(task);
      }

      // Second pass: resolve dependencies
      for (let i = 0; i < tasks.length; i++) {
        const taskData = breakdown.tasks[i];
        const task = tasks[i];
        
        // Map dependency titles to IDs
        task.dependencies = taskData.dependencies
          .map(depTitle => taskMap.get(depTitle))
          .filter(id => id !== undefined) as string[];
      }

      // Save tasks to database
      for (const task of tasks) {
        await this.saveTaskToDatabase(task);
      }

      // Log the task breakdown
      await this.logAction('tasks_created', {
        taskCount: tasks.length,
        breakdown
      });

      // Determine the first task to execute
      const firstTask = this.findFirstTask(tasks);
      
      return {
        tasks,
        plan: tasks,
        currentTaskId: firstTask?.id || null,
        current_task: firstTask || undefined,
        nextAgent: firstTask?.assignedAgent || AgentRole.BACKEND_ENGINEER,
        agentStates: {
          ...state.agentStates,
          [AgentRole.TASK_DECOMPOSER]: {
            breakdown,
            taskCount: tasks.length,
            completedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      this.context.logger.error('Failed to decompose tasks:', error);
      return this.executePlaceholder(state);
    }
  }

  private determineAgent(taskType: string): AgentRole {
    switch (taskType) {
      case 'frontend':
        return AgentRole.FRONTEND_ENGINEER;
      case 'backend':
      case 'database':
        return AgentRole.BACKEND_ENGINEER;
      case 'devops':
        return AgentRole.DEVOPS_ENGINEER;
      case 'testing':
        return AgentRole.QA_ENGINEER;
      case 'documentation':
        return AgentRole.DOCUMENTATION_WRITER;
      default:
        return AgentRole.FULLSTACK_ENGINEER;
    }
  }

  private findFirstTask(tasks: Task[]): Task | null {
    // Find tasks with no dependencies
    const rootTasks = tasks.filter(task => task.dependencies.length === 0);
    
    // Sort by priority
    rootTasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.metadata?.priority || 'medium'];
      const bPriority = priorityOrder[b.metadata?.priority || 'medium'];
      return aPriority - bPriority;
    });
    
    return rootTasks[0] || null;
  }

  private async saveTaskToDatabase(task: Task): Promise<void> {
    try {
      const query = `
        INSERT INTO helios.tasks (
          id, project_id, title, description, status,
          assigned_agent, dependencies, artifacts, metadata,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      
      await this.context.db.query(query, [
        task.id,
        task.projectId,
        task.title,
        task.description,
        task.status,
        task.assignedAgent,
        JSON.stringify(task.dependencies),
        JSON.stringify(task.artifacts),
        JSON.stringify(task.metadata || {}),
        task.createdAt,
        task.updatedAt
      ]);
      
      this.context.logger.info(`Task saved to database: ${task.title}`);
    } catch (error) {
      this.context.logger.error('Failed to save task to database:', error);
      throw error;
    }
  }

  private async executePlaceholder(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    // Simplified placeholder behavior
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
    }];
    
    return {
      tasks,
      plan: tasks,
      nextAgent: AgentRole.BACKEND_ENGINEER
    };
  }

  async validate(input: any): Promise<boolean> {
    return true;
  }
}
