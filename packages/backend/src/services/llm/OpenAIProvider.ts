import { OpenAI } from 'openai';
import { LLMProvider, LLMMessage, LLMResponse, LLMConfig } from './types';
import { Logger } from 'winston';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private config: LLMConfig;
  private logger: Logger;

  constructor(config: LLMConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async generateResponse(
    messages: LLMMessage[], 
    systemPrompt?: string
  ): Promise<LLMResponse> {
    try {
      const formattedMessages = this.formatMessages(messages, systemPrompt);
      
      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4-turbo-preview',
        messages: formattedMessages,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
      });

      const choice = completion.choices[0];
      
      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        model: completion.model,
      };
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async generateStructuredOutput<T>(
    messages: LLMMessage[],
    schema: any,
    systemPrompt?: string
  ): Promise<T> {
    try {
      const formattedMessages = this.formatMessages(messages, systemPrompt);
      
      // Add instruction for JSON output
      formattedMessages.push({
        role: 'system',
        content: `You must respond with valid JSON that matches the following schema: ${JSON.stringify(schema)}`
      });

      const completion = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4-turbo-preview',
        messages: formattedMessages,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0].message.content || '{}';
      
      try {
        return JSON.parse(content) as T;
      } catch (parseError) {
        this.logger.error('Failed to parse JSON response:', content);
        throw new Error('Invalid JSON response from model');
      }
    } catch (error) {
      this.logger.error('OpenAI structured output error:', error);
      throw new Error(`Failed to generate structured output: ${error.message}`);
    }
  }

  private formatMessages(
    messages: LLMMessage[], 
    systemPrompt?: string
  ): Array<{role: string; content: string}> {
    const formattedMessages: Array<{role: string; content: string}> = [];
    
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }
    
    return formattedMessages.concat(
      messages.map(msg => ({ role: msg.role, content: msg.content }))
    );
  }
}
