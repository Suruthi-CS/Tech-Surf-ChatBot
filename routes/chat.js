const express = require('express');
const { body, validationResult } = require('express-validator');
const LLMService = require('../services/llmService');
const ContentstackService = require('../services/contentstackService');

const router = express.Router();

// Validation middleware
const validateChatRequest = [
  body('message').notEmpty().withMessage('Message is required'),
  body('botId').optional().isString(),
  body('provider').optional().isIn(['openrouter', 'openai', 'anthropic', 'groq']),
  body('model').optional().isString(),
  body('stream').optional().isBoolean()
];

// Regular chat completion
router.post('/completions', validateChatRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, botId, provider = 'openrouter', model, context = [] } = req.body;
    
    const response = await LLMService.generateResponse({
      message,
      provider,
      model,
      context,
      botId
    });

    res.json({
      response: response.content,
      provider: response.provider,
      model: response.model,
      usage: response.usage
    });
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Streaming chat completion
router.post('/stream', validateChatRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, botId, provider = 'openrouter', model, context = [] } = req.body;

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const stream = await LLMService.generateStreamingResponse({
      message,
      provider,
      model,
      context,
      botId
    });

    stream.on('data', (chunk) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (error) => {
      console.error('Streaming error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      stream.destroy();
    });

  } catch (error) {
    console.error('Streaming setup error:', error);
    res.status(500).json({ 
      error: 'Failed to setup streaming',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Chat with content-enhanced responses
router.post('/chat-with-content', validateChatRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      message, 
      botId, 
      provider = 'openrouter', 
      model, 
      context = [],
      contentType = 'tours',
      maxResults = 5 
    } = req.body;

    // Search for relevant content in Contentstack
    const relevantContent = await ContentstackService.searchContent({
      query: message,
      contentType,
      maxResults
    });

    // Enhance the message with relevant content
    const enhancedContext = [
      ...context,
      {
        role: 'system',
        content: `You are a helpful assistant. Use the following relevant content to answer the user's question:\n\n${relevantContent.map(item => `Title: ${item.title}\nDescription: ${item.description || item.content || ''}`).join('\n\n')}`
      }
    ];

    const response = await LLMService.generateResponse({
      message,
      provider,
      model,
      context: enhancedContext,
      botId
    });

    res.json({
      response: response.content,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      relevantContent: relevantContent,
      sources: relevantContent.length
    });
  } catch (error) {
    console.error('Content-enhanced chat error:', error);
    res.status(500).json({ 
      error: 'Failed to generate content-enhanced response',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get available LLM providers
router.get('/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'openrouter',
        name: 'OpenRouter',
        models: [
          'meta-llama/llama-3.1-8b-instruct:free',
          'microsoft/wizardlm-2-8x22b',
          'anthropic/claude-3-haiku',
          'openai/gpt-3.5-turbo',
          'openai/gpt-4'
        ],
        available: !!process.env.OPENROUTER_API_KEY
      },
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        available: !!process.env.OPENAI_API_KEY
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        available: !!process.env.ANTHROPIC_API_KEY
      },
      {
        id: 'groq',
        name: 'Groq',
        models: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
        available: !!process.env.GROQ_API_KEY
      }
    ]
  });
});

module.exports = router;
