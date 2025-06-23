import { BaseAgent } from '../BaseAgent';
import { AgentRole, HeliosSwarmState, AgentContext, Task } from '../types';
import { LLMMessage } from '../../services/llm';
import { v4 as uuidv4 } from 'uuid';

interface FrontendCodeGeneration {
  files: Array<{
    path: string;
    content: string;
    language: string;
    description: string;
  }>;
  dependencies: {
    npm?: string[];
  };
  styling: {
    framework: string;
    theme?: string;
  };
  components: string[];
}

export class FrontendEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.FRONTEND_ENGINEER, projectId, context);
  }

  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('FrontendEngineerAgent: Building frontend components');
    
    if (!this.context.llm) {
      return this.executePlaceholder(state);
    }

    const currentTask = this.findFrontendTask(state);
    if (!currentTask) {
      return { nextAgent: AgentRole.QA_ENGINEER };
    }

    try {
      // Use LLM to generate frontend code
      const systemPrompt = `You are an expert frontend engineer specializing in React and modern web development.
Generate clean, accessible, and responsive UI code including:
- React components with TypeScript
- Proper state management
- Error boundaries
- Loading states
- Responsive design
- Accessibility features (ARIA labels, keyboard navigation)
- Modern CSS (Tailwind or styled-components)`;

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: `Generate frontend code for this task:
Title: ${currentTask.title}
Description: ${currentTask.description}
Project Context: ${state.projectDescription}
Tech Stack: ${JSON.stringify(state.projectAnalysis?.suggestedTech?.frontend || ['React', 'TypeScript', 'Tailwind CSS'])}
Related Backend APIs: ${this.getRelatedAPIs(state)}`
        }
      ];

      const codeGen = await this.context.llm.generateStructuredOutput<FrontendCodeGeneration>(
        messages,
        {
          files: [{
            path: 'string',
            content: 'string',
            language: 'string',
            description: 'string'
          }],
          dependencies: {
            npm: ['string']
          },
          styling: {
            framework: 'string',
            theme: 'string'
          },
          components: ['string']
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
      await this.updateTaskStatus(currentTask.id, 'completed', artifactIds);

      // Log the code generation
      await this.logAction('frontend_code_generated', {
        taskId: currentTask.id,
        fileCount: codeGen.files.length,
        components: codeGen.components,
        styling: codeGen.styling
      });

      // Find next task or agent
      const nextTaskInfo = await this.findNextTask(state);
      
      return {
        ...nextTaskInfo,
        agentStates: {
          ...state.agentStates,
          [AgentRole.FRONTEND_ENGINEER]: {
            lastTask: currentTask.id,
            generatedFiles: codeGen.files.length,
            components: codeGen.components,
            completedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      this.context.logger.error('Failed to generate frontend code:', error);
      return this.executePlaceholder(state);
    }
  }

  private findFrontendTask(state: Partial<HeliosSwarmState>): Task | undefined {
    const tasks = state.tasks || [];
    
    // First, check if there's a current task assigned to frontend
    if (state.current_task?.assignedAgent === AgentRole.FRONTEND_ENGINEER) {
      return state.current_task;
    }
    
    // Find pending frontend tasks
    return tasks.find(task => 
      task.assignedAgent === AgentRole.FRONTEND_ENGINEER && 
      task.status === 'pending'
    );
  }

  private getRelatedAPIs(state: Partial<HeliosSwarmState>): string {
    // Extract API information from completed backend tasks
    const backendArtifacts = state.tasks
      ?.filter(task => 
        task.assignedAgent === AgentRole.BACKEND_ENGINEER && 
        task.status === 'completed'
      )
      .flatMap(task => task.artifacts || [])
      || [];
    
    // In a real implementation, we would parse the artifacts to find API endpoints
    return 'Check backend artifacts for API endpoints';
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
      
      this.context.logger.info(`Frontend artifact saved: ${file.path}`);
      return result.rows[0].id;
    } catch (error) {
      this.context.logger.error('Failed to save frontend artifact:', error);
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
    
    // Find more frontend tasks
    const pendingFrontendTasks = tasks.filter(task => 
      task.assignedAgent === AgentRole.FRONTEND_ENGINEER && 
      task.status === 'pending'
    );
    
    if (pendingFrontendTasks.length > 0) {
      return {
        currentTaskId: pendingFrontendTasks[0].id,
        current_task: pendingFrontendTasks[0],
        nextAgent: AgentRole.FRONTEND_ENGINEER
      };
    }
    
    // Check if all tasks are complete
    const incompleteTasks = tasks.filter(task => task.status !== 'completed');
    if (incompleteTasks.length === 0) {
      // All tasks done, move to QA
      return { nextAgent: AgentRole.QA_ENGINEER };
    }
    
    // Otherwise, let orchestrator decide
    return { nextAgent: null };
  }

  private async executePlaceholder(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    return { nextAgent: AgentRole.QA_ENGINEER };
  }

  async validate(input: any): Promise<boolean> {
    return true;
  }
}
