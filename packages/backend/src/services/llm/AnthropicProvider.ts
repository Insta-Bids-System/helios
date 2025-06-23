import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMMessage, LLMResponse, LLMConfig } from './types';
import { Logger } from 'winston';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private config: LLMConfig;
  private logger: Logger;

  constructor(config: LLMConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async generateResponse(
    messages: LLMMessage[], 
    systemPrompt?: string
  ): Promise<LLMResponse> {
    try {
      const formattedMessages = this.formatMessages(messages);
      
      const completion = await this.client.messages.create({
        model: this.config.model || 'claude-3-opus-20240229',
        messages: formattedMessages,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
        system: systemPrompt,
      });

      // Claude returns content as an array of content blocks
      const content = completion.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
      
      return {
        content,
        usage: {
          promptTokens: completion.usage.input_tokens,
          completionTokens: completion.usage.output_tokens,
          totalTokens: completion.usage.input_tokens + completion.usage.output_tokens,
        },
        model: completion.model,
      };
    } catch (error) {
      this.logger.error('Anthropic API error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async generateStructuredOutput<T>(
    messages: LLMMessage[],
    schema: any,
    systemPrompt?: string
  ): Promise<T> {
    try {
      const formattedMessages = this.formatMessages(messages);
      
      // Add JSON instruction to system prompt
      const enhancedSystemPrompt = `${systemPrompt || ''}\n\nYou must respond with valid JSON that matches the following schema: ${JSON.stringify(schema)}`;
      
      const completion = await this.client.messages.create({
        model: this.config.model || 'claude-3-opus-20240229',
        messages: formattedMessages,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
        system: enhancedSystemPrompt,
      });

      const content = completion.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
      
      try {
        return JSON.parse(content) as T;
      } catch (parseError) {
        this.logger.error('Failed to parse JSON response:', content);
        throw new Error('Invalid JSON response from model');
      }
    } catch (error) {
      this.logger.error('Anthropic structured output error:', error);
      throw new Error(`Failed to generate structured output: ${error.message}`);
    }
  }

  private formatMessages(
    messages: LLMMessage[]
  ): Array<{role: 'user' | 'assistant'; content: string}> {
    // Anthropic doesn't use system messages in the messages array
    // System prompts are passed separately
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }
}
