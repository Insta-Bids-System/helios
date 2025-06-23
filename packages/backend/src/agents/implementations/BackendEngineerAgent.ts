import { BaseAgent } from '../BaseAgent';
import { AgentRole, HeliosSwarmState, AgentContext, Task } from '../types';
import { LLMMessage } from '../../services/llm';
import { v4 as uuidv4 } from 'uuid';

interface CodeGeneration {
  files: Array<{
    path: string;
    content: string;
    language: string;
    description: string;
  }>;
  dependencies: {
    npm?: string[];
    pip?: string[];
    other?: string[];
  };
  setupInstructions?: string;
}

export class BackendEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.BACKEND_ENGINEER, projectId, context);
  }

  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('BackendEngineerAgent: Building backend services');
    
    if (!this.context.llm) {
      return this.executePlaceholder(state);
    }

    const currentTask = state.current_task;
    if (!currentTask) {
      return { nextAgent: AgentRole.FRONTEND_ENGINEER };
    }

    try {
      // Use LLM to generate backend code
      const systemPrompt = `You are an expert backend engineer. Generate production-ready code for the given task.
Include:
- Clean, well-commented code
- Error handling
- Input validation
- Appropriate design patterns
- Database models if needed
- API endpoints if needed
- Configuration files`;

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: `Generate backend code for this task:
Title: ${currentTask.title}
Description: ${currentTask.description}
Project Context: ${state.projectDescription}
Tech Stack Suggestions: ${JSON.stringify(state.projectAnalysis?.suggestedTech?.backend || ['Node.js', 'Express'])}`
        }
      ];

      const codeGen = await this.context.llm.generateStructuredOutput<CodeGeneration>(
        messages,
        {
          files: [{
            path: 'string',
            content: 'string',
            language: 'string',
            description: 'string'
          }],
          dependencies: {
            npm: ['string'],
            pip: ['string'],
            other: ['string']
          },
          setupInstructions: 'string'
        },
        systemPrompt
      );

      // Save artifacts to database
      const artifactIds: string[] = [];
      for (const file of codeGen.files) {
        const artifactId = await this.saveArtifact(file, currentTask.id);
        artifactIds.push(artifactId);
      }

      // Update task status
      await this.updateTaskStatus(currentTask.id, 'in_progress', artifactIds);

      // Log the code generation
      await this.logAction('code_generated', {
        taskId: currentTask.id,
        fileCount: codeGen.files.length,
        dependencies: codeGen.dependencies
      });

      // Find next task or agent
      const nextTaskInfo = await this.findNextTask(state);
      
      return {
        ...nextTaskInfo,
        agentStates: {
          ...state.agentStates,
          [AgentRole.BACKEND_ENGINEER]: {
            lastTask: currentTask.id,
            generatedFiles: codeGen.files.length,
            completedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      this.context.logger.error('Failed to generate backend code:', error);
      return this.executePlaceholder(state);
    }
  }

  private async saveArtifact(file: any, taskId: string): Promise<string> {
    try {
      const artifactId = uuidv4();
      
      // First, mark any existing artifacts for this path as not latest
      await this.context.db.query(`
        UPDATE helios.artifacts 
        SET is_latest = false 
        WHERE project_id = $1 AND file_path = $2
      `, [this.projectId, file.path]);
      
      // Insert new artifact
      const query = `
        INSERT INTO helios.artifacts (
          id, project_id, task_id, file_path, content,
          content_type, version, is_latest, metadata,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;
      
      const result = await this.context.db.query(query, [
        artifactId,
        this.projectId,
        taskId,
        file.path,
        file.content,
        file.language,
        1, // version
        true, // is_latest
        JSON.stringify({
          description: file.description,
          language: file.language
        }),
        new Date(),
        new Date()
      ]);
      
      this.context.logger.info(`Artifact saved: ${file.path}`);
      return result.rows[0].id;
    } catch (error) {
      this.context.logger.error('Failed to save artifact:', error);
      throw error;
    }
  }

  private async updateTaskStatus(taskId: string, status: string, artifactIds: string[]): Promise<void> {
    try {
      const query = `
        UPDATE helios.tasks 
        SET status = $1, artifacts = $2, updated_at = $3
        WHERE id = $4
      `;
      
      await this.context.db.query(query, [
        status,
        JSON.stringify(artifactIds),
        new Date(),
        taskId
      ]);
      
      this.context.logger.info(`Task ${taskId} updated to ${status}`);
    } catch (error) {
      this.context.logger.error('Failed to update task status:', error);
      throw error;
    }
  }

  private async findNextTask(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    const tasks = state.tasks || [];
    const currentTaskId = state.currentTaskId;
    
    // Find tasks that depend on the current task and are not yet started
    const dependentTasks = tasks.filter(task => 
      task.dependencies.includes(currentTaskId || '') && 
      task.status === 'pending'
    );
    
    if (dependentTasks.length > 0) {
      // If there are dependent tasks, pick one assigned to backend
      const backendTask = dependentTasks.find(task => 
        task.assignedAgent === AgentRole.BACKEND_ENGINEER
      );
      
      if (backendTask) {
        return {
          currentTaskId: backendTask.id,
          current_task: backendTask,
          nextAgent: AgentRole.BACKEND_ENGINEER
        };
      }
    }
    
    // Find any other pending backend tasks
    const pendingBackendTasks = tasks.filter(task => 
      task.assignedAgent === AgentRole.BACKEND_ENGINEER && 
      task.status === 'pending'
    );
    
    if (pendingBackendTasks.length > 0) {
      return {
        currentTaskId: pendingBackendTasks[0].id,
        current_task: pendingBackendTasks[0],
        nextAgent: AgentRole.BACKEND_ENGINEER
      };
    }
    
    // No more backend tasks, move to frontend
    return { nextAgent: AgentRole.FRONTEND_ENGINEER };
  }

  private async executePlaceholder(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    return { nextAgent: AgentRole.FRONTEND_ENGINEER };
  }

  async validate(input: any): Promise<boolean> {
    return true;
  }
}
