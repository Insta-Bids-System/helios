export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  generateResponse(messages: LLMMessage[], systemPrompt?: string): Promise<LLMResponse>;
  generateStructuredOutput<T>(
    messages: LLMMessage[], 
    schema: any,
    systemPrompt?: string
  ): Promise<T>;
}
