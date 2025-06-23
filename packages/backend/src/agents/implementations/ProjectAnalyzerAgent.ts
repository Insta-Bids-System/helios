import { BaseAgent } from '../BaseAgent';
import { AgentRole, HeliosSwarmState, AgentContext } from '../types';
import { LLMMessage } from '../../services/llm';

interface ProjectAnalysis {
  summary: string;
  type: 'web_app' | 'mobile_app' | 'api' | 'cli_tool' | 'library' | 'full_stack';
  requirements: {
    functional: string[];
    technical: string[];
    constraints: string[];
  };
  suggestedTech: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    deployment?: string[];
  };
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

export class ProjectAnalyzerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.PROJECT_ANALYZER, projectId, context);
  }

  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('ProjectAnalyzerAgent: Analyzing project requirements');
    
    if (!this.context.llm) {
      // Fallback to placeholder behavior if no LLM
      return this.executePlaceholder(state);
    }

    try {
      const projectDescription = state.projectDescription || '';
      
      // Use LLM to analyze the project
      const systemPrompt = `You are a senior product manager and technical architect. 
Analyze the given project description and provide a comprehensive analysis including:
- Project type classification
- Functional and technical requirements
- Suggested technology stack
- Complexity assessment`;

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: `Analyze this project request: "${projectDescription}"`
        }
      ];

      const analysis = await this.context.llm.generateStructuredOutput<ProjectAnalysis>(
        messages,
        {
          summary: 'string',
          type: 'web_app|mobile_app|api|cli_tool|library|full_stack',
          requirements: {
            functional: ['string'],
            technical: ['string'],
            constraints: ['string']
          },
          suggestedTech: {
            frontend: ['string'],
            backend: ['string'],
            database: ['string'],
            deployment: ['string']
          },
          estimatedComplexity: 'simple|moderate|complex'
        },
        systemPrompt
      );

      // Store analysis in database
      await this.logAction('project_analyzed', {
        analysis,
        projectDescription
      });

      // Determine next agent based on project type
      let nextAgent = AgentRole.TASK_DECOMPOSER;
      
      return {
        projectAnalysis: analysis,
        nextAgent,
        agentStates: {
          ...state.agentStates,
          [AgentRole.PROJECT_ANALYZER]: {
            analysis,
            completedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      this.context.logger.error('Failed to analyze project:', error);
      return this.executePlaceholder(state);
    }
  }

  private async executePlaceholder(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    // Fallback behavior when LLM is not available
    return {
      projectDescription: state.projectDescription || '',
      nextAgent: AgentRole.TASK_DECOMPOSER
    };
  }

  async validate(input: any): Promise<boolean> {
    return true;
  }
}
