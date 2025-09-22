const express = require('express');
const { body, validationResult } = require('express-validator');
const BotService = require('../services/botService');

const router = express.Router();

// Validation middleware
const validateBotCreation = [
  body('name').notEmpty().withMessage('Bot name is required'),
  body('description').optional().isString(),
  body('startMessage').optional().isString(),
  body('contentType').optional().isString(),
  body('llmProvider').optional().isIn(['openrouter', 'openai', 'anthropic', 'groq']),
  body('llmModel').optional().isString(),
  body('systemPrompt').optional().isString()
];

// Get all bots
router.get('/', async (req, res) => {
  try {
    const bots = await BotService.getAllBots();
    res.json({ bots });
  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bots',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get bot by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bot = await BotService.getBotById(id);
    
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    res.json({ bot });
  } catch (error) {
    console.error('Get bot error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bot',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Create new bot
router.post('/', validateBotCreation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      description,
      startMessage,
      contentType = 'tour',
      llmProvider = 'openrouter',
      llmModel = 'meta-llama/llama-3.1-8b-instruct:free',
      systemPrompt
    } = req.body;

    const bot = await BotService.createBot({
      name,
      description,
      startMessage,
      contentType,
      llmProvider,
      llmModel,
      systemPrompt
    });

    res.status(201).json({
      message: 'Bot created successfully',
      bot
    });
  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({ 
      error: 'Failed to create bot',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Update bot
router.put('/:id', validateBotCreation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    const bot = await BotService.updateBot(id, updateData);
    
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({
      message: 'Bot updated successfully',
      bot
    });
  } catch (error) {
    console.error('Update bot error:', error);
    res.status(500).json({ 
      error: 'Failed to update bot',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Delete bot
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await BotService.deleteBot(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json({ message: 'Bot deleted successfully' });
  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({ 
      error: 'Failed to delete bot',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get bot configuration for chat widget
router.get('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    const config = await BotService.getBotConfig(id);
    
    if (!config) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    res.json({ config });
  } catch (error) {
    console.error('Get bot config error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bot configuration',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Test bot with a message
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await BotService.testBot(id, message);
    
    res.json({
      message: 'Bot test completed',
      response
    });
  } catch (error) {
    console.error('Test bot error:', error);
    res.status(500).json({ 
      error: 'Failed to test bot',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;
