import { BaseAgent } from '../BaseAgent';
import { AgentRole, HeliosSwarmState, AgentContext } from '../types';
import { LLMMessage } from '../../services/llm';
import { v4 as uuidv4 } from 'uuid';

interface TestGeneration {
  testSuites: Array<{
    name: string;
    type: 'unit' | 'integration' | 'e2e';
    framework: string;
    files: Array<{
      path: string;
      content: string;
      description: string;
    }>;
  }>;
  testPlan: {
    coverage: string[];
    scenarios: string[];
    edgeCases: string[];
  };
  setupInstructions: string;
}

export class QAEngineerAgent extends BaseAgent {
  constructor(id: string, projectId: string, context: AgentContext) {
    super(id, AgentRole.QA_ENGINEER, projectId, context);
  }

  async execute(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    this.context.logger.info('QAEngineerAgent: Creating and running tests');
    
    if (!this.context.llm) {
      return this.executePlaceholder(state);
    }

    try {
      // Gather all completed tasks and artifacts
      const completedTasks = (state.tasks || []).filter(task => task.status === 'completed');
      const artifacts = await this.gatherArtifacts(completedTasks);
      
      // Use LLM to generate test suites
      const systemPrompt = `You are an expert QA engineer. Generate comprehensive test suites including:
- Unit tests for individual functions/components
- Integration tests for API endpoints
- E2E tests for user workflows
- Edge cases and error scenarios
- Performance considerations
Use appropriate testing frameworks (Jest, React Testing Library, Cypress, etc.)`;

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: `Generate test suites for this project:
Project: ${state.projectDescription}
Completed Features: ${completedTasks.map(t => t.title).join(', ')}
Code Summary: ${this.summarizeArtifacts(artifacts)}`
        }
      ];

      const testGen = await this.context.llm.generateStructuredOutput<TestGeneration>(
        messages,
        {
          testSuites: [{
            name: 'string',
            type: 'unit|integration|e2e',
            framework: 'string',
            files: [{
              path: 'string',
              content: 'string',
              description: 'string'
            }]
          }],
          testPlan: {
            coverage: ['string'],
            scenarios: ['string'],
            edgeCases: ['string']
          },
          setupInstructions: 'string'
        },
        systemPrompt
      );

      // Save test files as artifacts
      const testArtifactIds: string[] = [];
      for (const suite of testGen.testSuites) {
        for (const file of suite.files) {
          const artifactId = await this.saveTestArtifact(file, suite);
          testArtifactIds.push(artifactId);
        }
      }

      // Create a QA report
      const qaReport = {
        testSuiteCount: testGen.testSuites.length,
        totalTests: testGen.testSuites.reduce((sum, suite) => sum + suite.files.length, 0),
        coverage: testGen.testPlan.coverage,
        testTypes: testGen.testSuites.map(s => s.type),
        frameworks: [...new Set(testGen.testSuites.map(s => s.framework))]
      };

      // Log the test generation
      await this.logAction('tests_generated', {
        report: qaReport,
        testPlan: testGen.testPlan
      });

      return {
        nextAgent: AgentRole.CODE_REVIEWER,
        agentStates: {
          ...state.agentStates,
          [AgentRole.QA_ENGINEER]: {
            qaReport,
            testArtifacts: testArtifactIds,
            completedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      this.context.logger.error('Failed to generate tests:', error);
      return this.executePlaceholder(state);
    }
  }

  private async gatherArtifacts(tasks: any[]): Promise<any[]> {
    const artifacts = [];
    
    for (const task of tasks) {
      if (task.artifacts && task.artifacts.length > 0) {
        // In a real implementation, we would fetch artifact content from DB
        artifacts.push(...task.artifacts);
      }
    }
    
    return artifacts;
  }

  private summarizeArtifacts(artifacts: any[]): string {
    // In a real implementation, we would analyze the actual code
    return `${artifacts.length} code files generated across frontend and backend`;
  }

  private async saveTestArtifact(file: any, suite: any): Promise<string> {
    try {
      const artifactId = uuidv4();
      
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
        null, // No specific task for QA artifacts
        file.path,
        file.content,
        'test',
        1,
        true,
        JSON.stringify({
          description: file.description,
          testType: suite.type,
          framework: suite.framework,
          suiteName: suite.name
        }),
        new Date(),
        new Date()
      ]);
      
      this.context.logger.info(`Test artifact saved: ${file.path}`);
      return result.rows[0].id;
    } catch (error) {
      this.context.logger.error('Failed to save test artifact:', error);
      throw error;
    }
  }

  private async executePlaceholder(state: Partial<HeliosSwarmState>): Promise<Partial<HeliosSwarmState>> {
    return { nextAgent: AgentRole.CODE_REVIEWER };
  }

  async validate(input: any): Promise<boolean> {
    return true;
  }
}
