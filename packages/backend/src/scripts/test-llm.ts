import dotenv from 'dotenv';
import { LLMService } from '../services/llm';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function testLLMService() {
  console.log('Testing LLM Service...\n');
  
  try {
    // Initialize LLM Service
    const llm = new LLMService(logger);
    console.log('✅ LLM Service initialized');
    
    // Get configuration
    const config = llm.getConfig();
    console.log(`Provider: ${config.provider}`);
    console.log(`Model: ${config.model}`);
    console.log(`Max Tokens: ${config.maxTokens}`);
    console.log(`Temperature: ${config.temperature}\n`);
    
    // Test simple prompt
    console.log('Testing simple prompt...');
    const response = await llm.prompt(
      'What are the key components of a REST API?',
      'You are a helpful technical assistant. Be concise.'
    );
    console.log('Response:', response.substring(0, 200) + '...\n');
    
    // Test structured output
    console.log('Testing structured output...');
    const structured = await llm.generateStructuredOutput(
      [{ role: 'user', content: 'List 3 popular JavaScript frameworks' }],
      {
        frameworks: [{
          name: 'string',
          description: 'string',
          popularity: 'high|medium|low'
        }]
      }
    );
    console.log('Structured Response:', JSON.stringify(structured, null, 2));
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testLLMService().catch(console.error);
