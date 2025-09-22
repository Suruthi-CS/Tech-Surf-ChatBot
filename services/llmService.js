const axios = require('axios');
const { EventEmitter } = require('events');

class LLMService {
  constructor() {
    this.providers = {
      openrouter: {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultModel: 'meta-llama/llama-3.1-8b-instruct:free'
      },
      openai: {
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: 'gpt-3.5-turbo'
      },
      anthropic: {
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel: 'claude-3-haiku-20240307'
      },
      groq: {
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
        defaultModel: 'llama3-8b-8192'
      }
    };
  }

  async generateResponse({ message, provider = 'openrouter', model, context = [], botId }) {
    const providerConfig = this.providers[provider];
    
    if (!providerConfig || !providerConfig.apiKey) {
      throw new Error(`Provider ${provider} is not configured or API key is missing`);
    }

    const selectedModel = model || providerConfig.defaultModel;
    
    // Build messages array
    const messages = [
      ...context,
      { role: 'user', content: message }
    ];

    try {
      const response = await this.makeAPIRequest(provider, {
        model: selectedModel,
        messages,
        max_tokens: 1000,
        temperature: 0.7
      });

      return {
        content: response.data.choices[0].message.content,
        provider,
        model: selectedModel,
        usage: response.data.usage
      };
    } catch (error) {
      console.error(`LLM API Error (${provider}):`, error.response?.data || error.message);
      throw new Error(`Failed to generate response from ${provider}: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async generateStreamingResponse({ message, provider = 'openrouter', model, context = [], botId }) {
    const providerConfig = this.providers[provider];
    
    if (!providerConfig || !providerConfig.apiKey) {
      throw new Error(`Provider ${provider} is not configured or API key is missing`);
    }

    const selectedModel = model || providerConfig.defaultModel;
    const stream = new EventEmitter();

    // Build messages array
    const messages = [
      ...context,
      { role: 'user', content: message }
    ];

    try {
      const response = await this.makeStreamingAPIRequest(provider, {
        model: selectedModel,
        messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: true
      });

      let fullContent = '';

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.includes('[DONE]')) {
            stream.emit('end', {
              provider,
              model: selectedModel,
              fullContent
            });
            return;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullContent += content;
                stream.emit('data', {
                  content,
                  provider,
                  model: selectedModel
                });
              }
            } catch (parseError) {
              // Ignore parsing errors for malformed chunks
            }
          }
        }
      });

      response.data.on('error', (error) => {
        stream.emit('error', error);
      });

      response.data.on('end', () => {
        stream.emit('end', {
          provider,
          model: selectedModel,
          fullContent
        });
      });

    } catch (error) {
      console.error(`Streaming LLM API Error (${provider}):`, error.response?.data || error.message);
      setTimeout(() => {
        stream.emit('error', new Error(`Failed to generate streaming response from ${provider}: ${error.response?.data?.error?.message || error.message}`));
      }, 0);
    }

    return stream;
  }

  async makeAPIRequest(provider, data) {
    const providerConfig = this.providers[provider];
    const headers = this.getHeaders(provider);

    if (provider === 'anthropic') {
      // Anthropic has a different API format
      return await axios.post(`${providerConfig.baseURL}/messages`, {
        model: data.model,
        max_tokens: data.max_tokens,
        messages: data.messages
      }, { headers });
    }

    return await axios.post(`${providerConfig.baseURL}/chat/completions`, data, { headers });
  }

  async makeStreamingAPIRequest(provider, data) {
    const providerConfig = this.providers[provider];
    const headers = this.getHeaders(provider);

    if (provider === 'anthropic') {
      // Anthropic streaming
      return await axios.post(`${providerConfig.baseURL}/messages`, {
        model: data.model,
        max_tokens: data.max_tokens,
        messages: data.messages,
        stream: true
      }, { 
        headers,
        responseType: 'stream'
      });
    }

    return await axios.post(`${providerConfig.baseURL}/chat/completions`, data, {
      headers,
      responseType: 'stream'
    });
  }

  getHeaders(provider) {
    const providerConfig = this.providers[provider];
    const baseHeaders = {
      'Content-Type': 'application/json'
    };

    switch (provider) {
      case 'openrouter':
        return {
          ...baseHeaders,
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'HTTP-Referer': 'http://localhost:7000',
          'X-Title': 'Chat Agent Platform'
        };
      
      case 'openai':
      case 'groq':
        return {
          ...baseHeaders,
          'Authorization': `Bearer ${providerConfig.apiKey}`
        };
      
      case 'anthropic':
        return {
          ...baseHeaders,
          'x-api-key': providerConfig.apiKey,
          'anthropic-version': '2023-06-01'
        };
      
      default:
        return {
          ...baseHeaders,
          'Authorization': `Bearer ${providerConfig.apiKey}`
        };
    }
  }

  getAvailableProviders() {
    return Object.keys(this.providers).filter(provider => 
      this.providers[provider].apiKey
    );
  }

  isProviderAvailable(provider) {
    return this.providers[provider] && this.providers[provider].apiKey;
  }
}

module.exports = new LLMService();
