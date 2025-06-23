import { Logger } from 'winston';
import { LLMProvider, LLMConfig, LLMMessage, LLMResponse } from './types';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';

export class LLMService {
  private provider: LLMProvider;
  private logger: Logger;
  private config: LLMConfig;

  constructor(logger: Logger) {
    this.logger = logger;
    
    // Load configuration from environment
    const provider = process.env.LLM_PROVIDER || 'openai';
    
    if (provider === 'openai') {
      this.config = {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      };
      this.provider = new OpenAIProvider(this.config, logger);
    } else if (provider === 'anthropic') {
      this.config = {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
        maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
      };
      this.provider = new AnthropicProvider(this.config, logger);
    } else {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    // Validate API key
    if (!this.config.apiKey) {
      throw new Error(`Missing API key for ${provider}. Please set ${provider.toUpperCase()}_API_KEY in environment.`);
    }

    this.logger.info(`LLM Service initialized with provider: ${provider}, model: ${this.config.model}`);
  }

  /**
   * Generate a text response from the LLM
   */
  async generateResponse(
    messages: LLMMessage[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.provider.generateResponse(messages, systemPrompt);
      
      const duration = Date.now() - startTime;
      this.logger.info(`LLM response generated in ${duration}ms`, {
        model: response.model,
        usage: response.usage,
      });
      
      return response;
    } catch (error) {
      this.logger.error('LLM generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate structured output from the LLM
   */
  async generateStructuredOutput<T>(
    messages: LLMMessage[],
    schema: any,
    systemPrompt?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await this.provider.generateStructuredOutput<T>(
        messages,
        schema,
        systemPrompt
      );
      
      const duration = Date.now() - startTime;
      this.logger.info(`LLM structured output generated in ${duration}ms`);
      
      return result;
    } catch (error) {
      this.logger.error('LLM structured generation failed:', error);
      throw error;
    }
  }

  /**
   * Helper method to create a simple prompt-response interaction
   */
  async prompt(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await this.generateResponse(messages, systemPrompt);
    return response.content;
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Switch provider at runtime (requires API key)
   */
  switchProvider(provider: 'openai' | 'anthropic', apiKey: string) {
    const newConfig: LLMConfig = {
      ...this.config,
      provider,
      apiKey,
    };

    if (provider === 'openai') {
      this.provider = new OpenAIProvider(newConfig, this.logger);
    } else {
      this.provider = new AnthropicProvider(newConfig, this.logger);
    }

    this.config = newConfig;
    this.logger.info(`Switched LLM provider to: ${provider}`);
  }
}

// Export everything from types
export * from './types';
