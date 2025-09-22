const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const LLMService = require('./llmService');
const ContentstackService = require('./contentstackService');

class BotService {
  constructor() {
    this.botsFile = path.join(__dirname, '../data/bots.json');
    this.ensureDataDirectory();
    this.bots = this.loadBots();
  }

  ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadBots() {
    try {
      if (fs.existsSync(this.botsFile)) {
        const data = fs.readFileSync(this.botsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading bots:', error);
    }
    return [];
  }

  saveBots() {
    try {
      fs.writeFileSync(this.botsFile, JSON.stringify(this.bots, null, 2));
    } catch (error) {
      console.error('Error saving bots:', error);
      throw new Error('Failed to save bot data');
    }
  }

  async getAllBots() {
    return this.bots.map(bot => ({
      ...bot,
      // Don't expose sensitive configuration in list view
      systemPrompt: undefined
    }));
  }

  async getBotById(id) {
    return this.bots.find(bot => bot.id === id);
  }

  async createBot({
    name,
    description,
    startMessage,
    contentType = 'tour',
    llmProvider = 'openrouter',
    llmModel = 'meta-llama/llama-3.1-8b-instruct:free',
    systemPrompt
  }) {
    const bot = {
      id: uuidv4(),
      name,
      description,
      startMessage: startMessage || `Hello! I'm ${name}, your AI assistant. How can I help you today?`,
      contentType,
      llmProvider,
      llmModel,
      systemPrompt: systemPrompt || this.generateDefaultSystemPrompt(name, contentType),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      conversationCount: 0,
      lastUsed: null
    };

    this.bots.push(bot);
    this.saveBots();
    
    return bot;
  }

  async updateBot(id, updateData) {
    const botIndex = this.bots.findIndex(bot => bot.id === id);
    
    if (botIndex === -1) {
      return null;
    }

    const bot = this.bots[botIndex];
    const updatedBot = {
      ...bot,
      ...updateData,
      id: bot.id, // Ensure ID cannot be changed
      createdAt: bot.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };

    this.bots[botIndex] = updatedBot;
    this.saveBots();
    
    return updatedBot;
  }

  async deleteBot(id) {
    const botIndex = this.bots.findIndex(bot => bot.id === id);
    
    if (botIndex === -1) {
      return false;
    }

    this.bots.splice(botIndex, 1);
    this.saveBots();
    
    return true;
  }

  async getBotConfig(id) {
    const bot = await this.getBotById(id);
    
    if (!bot) {
      return null;
    }

    return {
      id: bot.id,
      name: bot.name,
      startMessage: bot.startMessage,
      llmProvider: bot.llmProvider,
      llmModel: bot.llmModel,
      contentType: bot.contentType,
      isActive: bot.isActive
    };
  }

  async testBot(id, message) {
    const bot = await this.getBotById(id);
    
    if (!bot) {
      throw new Error('Bot not found');
    }

    if (!bot.isActive) {
      throw new Error('Bot is not active');
    }

    try {
      // Search for relevant content
      const relevantContent = await ContentstackService.intelligentSearch({
        query: message,
        contentType: bot.contentType,
        maxResults: 3
      });

      // Build context with system prompt and relevant content
      const context = [
        {
          role: 'system',
          content: bot.systemPrompt
        }
      ];

      if (relevantContent.length > 0) {
        context.push({
          role: 'system',
          content: `Here's some relevant information from our knowledge base:\n\n${relevantContent.map(item => `Title: ${item.title}\nDescription: ${item.description || item.content || ''}`).join('\n\n')}`
        });
      }

      // Generate response using LLM
      const response = await LLMService.generateResponse({
        message,
        provider: bot.llmProvider,
        model: bot.llmModel,
        context,
        botId: bot.id
      });

      // Update bot usage statistics
      await this.updateBotUsage(id);

      return {
        message: response.content,
        provider: response.provider,
        model: response.model,
        relevantContent: relevantContent.length,
        sources: relevantContent
      };
    } catch (error) {
      console.error('Bot test error:', error);
      throw new Error(`Bot test failed: ${error.message}`);
    }
  }

  async updateBotUsage(id) {
    const botIndex = this.bots.findIndex(bot => bot.id === id);
    
    if (botIndex !== -1) {
      this.bots[botIndex].conversationCount = (this.bots[botIndex].conversationCount || 0) + 1;
      this.bots[botIndex].lastUsed = new Date().toISOString();
      this.saveBots();
    }
  }

  generateDefaultSystemPrompt(botName, contentType) {
    const prompts = {
      tour: `You are ${botName}, a knowledgeable travel assistant specializing in tours and travel experiences. You help users find information about destinations, tours, activities, and travel recommendations. Always be helpful, friendly, and provide accurate information based on the available content. If you don't have specific information, acknowledge it and offer to help in other ways.`,
      
      product: `You are ${botName}, a helpful product assistant. You provide information about products, features, specifications, and help users make informed decisions. Always be accurate and helpful in your responses.`,
      
      support: `You are ${botName}, a customer support assistant. You help users with their questions, issues, and provide solutions. Always be patient, understanding, and try to resolve their concerns effectively.`,
      
      default: `You are ${botName}, an AI assistant. You help users by providing accurate and helpful information based on the available content. Always be friendly, professional, and try your best to assist with their queries.`
    };

    return prompts[contentType] || prompts.default;
  }

  async getBotAnalytics(id) {
    const bot = await this.getBotById(id);
    
    if (!bot) {
      return null;
    }

    return {
      id: bot.id,
      name: bot.name,
      conversationCount: bot.conversationCount || 0,
      lastUsed: bot.lastUsed,
      createdAt: bot.createdAt,
      isActive: bot.isActive,
      contentType: bot.contentType,
      llmProvider: bot.llmProvider
    };
  }

  async searchBots(query) {
    if (!query) {
      return this.bots;
    }

    const searchTerm = query.toLowerCase();
    return this.bots.filter(bot => 
      bot.name.toLowerCase().includes(searchTerm) ||
      (bot.description && bot.description.toLowerCase().includes(searchTerm)) ||
      bot.contentType.toLowerCase().includes(searchTerm)
    );
  }

  async duplicateBot(id, newName) {
    const originalBot = await this.getBotById(id);
    
    if (!originalBot) {
      throw new Error('Bot not found');
    }

    const duplicatedBot = {
      ...originalBot,
      id: uuidv4(),
      name: newName || `${originalBot.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conversationCount: 0,
      lastUsed: null
    };

    this.bots.push(duplicatedBot);
    this.saveBots();
    
    return duplicatedBot;
  }
}

module.exports = new BotService();
