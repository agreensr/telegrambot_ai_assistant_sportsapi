/**
 * OpenRouter Client
 * Handles communication with OpenRouter API for multi-model LLM access
 */

import axios from 'axios';
import logger from '../utils/logger.js';

class OpenRouterClient {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.siteUrl = process.env.OPENROUTER_SITE_URL || 'https://clawd.bot';
    this.siteName = process.env.OPENROUTER_SITE_NAME || 'Clawd Bot';
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName
      },
      timeout: 60000
    });

    // Available models (free tier)
    this.models = {
      gemma: 'google/gemma-2-9b-it:free',
      llama: 'meta-llama/llama-3.2-3b-instruct:free',
      mistral: 'mistralai/mistral-7b-instruct:free'
    };

    // System prompts for each mode
    this.systemPrompts = {
      trading: `You are Clawd, a knowledgeable trading assistant helping with:
- Market analysis and trading strategies
- NinjaTrader platform questions
- Trading prep and risk management
- Technical analysis concepts

Keep responses concise and focused on trading. Use trading terminology appropriately.`,
      fitness: `You are Clawd, a fitness and exercise coach helping with:
- Workout routines and exercise form
- Training plans and progression
- Nutrition guidance for fitness
- Motivation and accountability

Be encouraging and informative. Keep responses practical and actionable.`,
      productivity: `You are Clawd, a productivity and coding assistant helping with:
- Software development questions
- Coding problems and debugging
- Productivity techniques
- Workflow optimization

Provide clear, technical answers with examples when helpful.`,
      sports: `You are Clawd, a sports data assistant. You have access to live scores, odds, news, and standings.
Help users with:
- Live game scores and updates
- Betting odds and lines
- Sports news and headlines
- Team and player information

Keep responses brief and data-focused. Use emoji for team sports indicators.`
    };
  }

  /**
   * Get the current model ID
   */
  getModelId(modelKey = 'gemma') {
    return this.models[modelKey] || this.models.gemma;
  }

  /**
   * Get system prompt for a mode
   */
  getSystemPrompt(mode = 'trading') {
    return this.systemPrompts[mode] || this.systemPrompts.trading;
  }

  /**
   * Send a chat completion request
   */
  async chat(messages, options = {}) {
    const {
      model = 'gemma',
      mode = 'trading',
      temperature = 0.7,
      maxTokens = 500
    } = options;

    try {
      // Build messages array with system prompt
      const chatMessages = [
        {
          role: 'system',
          content: this.getSystemPrompt(mode)
        },
        ...messages
      ];

      logger.debug(`OpenRouter request: model=${this.getModelId(model)}, messages=${chatMessages.length}`);

      const response = await this.client.post('/chat/completions', {
        model: this.getModelId(model),
        messages: chatMessages,
        temperature,
        max_tokens: maxTokens
      });

      const content = response.data.choices?.[0]?.message?.content || '';
      logger.debug('OpenRouter response received');

      return {
        content,
        model: response.data.model,
        usage: response.data.usage
      };
    } catch (error) {
      logger.error(`OpenRouter error: ${error.message}`);

      if (error.response) {
        logger.error(`OpenRouter status: ${error.response.status}`);
        logger.error(`OpenRouter data: ${JSON.stringify(error.response.data)}`);
      }

      throw new Error(`LLM request failed: ${error.message}`);
    }
  }

  /**
   * Simple chat with just a prompt (returns last message)
   */
  async chatSimple(prompt, options = {}) {
    const messages = [{ role: 'user', content: prompt }];
    const response = await this.chat(messages, options);
    return response.content;
  }

  /**
   * Check if API is configured
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'your_openrouter_api_key_here';
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConfigured()) {
        return {
          status: 'unconfigured',
          message: 'OpenRouter API key not set'
        };
      }

      const response = await this.client.get('/models', {
        timeout: 10000
      });

      return {
        status: 'healthy',
        modelsAvailable: response.data.data?.length || 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export default new OpenRouterClient();
