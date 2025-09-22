const axios = require('axios');

class ContentstackService {
  constructor() {
    this.apiKey = process.env.CONTENTSTACK_API_KEY;
    this.deliveryToken = process.env.CONTENTSTACK_DELIVERY_TOKEN;
    this.managementToken = process.env.CONTENTSTACK_MANAGEMENT_TOKEN;
    this.environment = process.env.CONTENTSTACK_ENVIRONMENT || 'development';
    this.region = process.env.CONTENTSTACK_REGION || 'eu';
    
    this.deliveryBaseURL = `https://${this.region}-cdn.contentstack.com/v3`;
    this.managementBaseURL = `https://${this.region}-api.contentstack.com/v3`;
  }

  // Delivery API methods (for reading content)
  async getAllEntries({ contentType = 'tours', limit = 50 }) {
    try {
      const response = await axios.get(
        `${this.deliveryBaseURL}/content_types/${contentType}/entries`,
        {
          headers: {
            'api_key': this.apiKey,
            'access_token': this.deliveryToken
          },
          params: {
            environment: this.environment,
            limit
          }
        }
      );

      return response.data.entries || [];
    } catch (error) {
      console.error('Get all entries error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch entries: ${error.response?.data?.error_message || error.message}`);
    }
  }

  async searchContent({ query, contentType = 'tours', maxResults = 10 }) {
    try {
      const entries = await this.getAllEntries({ contentType, limit: 100 });
      
      if (!query) {
        return entries.slice(0, maxResults);
      }

      // Simple text search in title and description
      const searchTerms = query.toLowerCase().split(' ');
      const scoredEntries = entries.map(entry => {
        let score = 0;
        const title = (entry.title || '').toLowerCase();
        
        // Check multiple possible description fields
        const description = (
          entry.description || 
          entry.paris || 
          entry.india || 
          entry.content || 
          entry.body || 
          ''
        ).toLowerCase();
        
        // Also search in all string fields of the entry
        const allText = Object.values(entry)
          .filter(value => typeof value === 'string')
          .join(' ')
          .toLowerCase();
        
        searchTerms.forEach(term => {
          if (title.includes(term)) score += 5;
          if (description.includes(term)) score += 3;
          if (allText.includes(term)) score += 1;
        });
        
        return { ...entry, score };
      });

      return scoredEntries
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    } catch (error) {
      console.error('Search content error:', error.response?.data || error.message);
      throw new Error(`Failed to search content: ${error.response?.data?.error_message || error.message}`);
    }
  }

  // Management API methods (for creating/updating content)
  async createEntry({ title, description, contentType = 'tours', additionalFields = {} }) {
    try {
      const entryData = {
        title,
        description: description || '',
        ...additionalFields
      };

      const response = await axios.post(
        `${this.managementBaseURL}/content_types/${contentType}/entries`,
        {
          entry: entryData
        },
        {
          headers: {
            'api_key': this.apiKey,
            'authorization': this.managementToken,
            'Content-Type': 'application/json'
          },
          params: {
            branch: this.environment
          }
        }
      );

      return response.data.entry;
    } catch (error) {
      console.error('Create entry error:', error.response?.data || error.message);
      throw new Error(`Failed to create entry: ${error.response?.data?.error_message || error.message}`);
    }
  }

  async updateEntry({ uid, title, description, contentType = 'tours', additionalFields = {} }) {
    try {
      const entryData = {
        title,
        description: description || '',
        ...additionalFields
      };

      const response = await axios.put(
        `${this.managementBaseURL}/content_types/${contentType}/entries/${uid}`,
        {
          entry: entryData
        },
        {
          headers: {
            'api_key': this.apiKey,
            'authorization': this.managementToken,
            'Content-Type': 'application/json'
          },
          params: {
            branch: this.environment
          }
        }
      );

      return response.data.entry;
    } catch (error) {
      console.error('Update entry error:', error.response?.data || error.message);
      throw new Error(`Failed to update entry: ${error.response?.data?.error_message || error.message}`);
    }
  }

  async publishEntry({ uid, contentType = 'tours' }) {
    try {
      const response = await axios.post(
        `${this.managementBaseURL}/content_types/${contentType}/entries/${uid}/publish`,
        {
          entry: {
            environments: [this.environment],
            locales: ['en-us']
          }
        },
        {
          headers: {
            'api_key': this.apiKey,
            'authorization': this.managementToken,
            'Content-Type': 'application/json'
          },
          params: {
            branch: this.environment
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Publish entry error:', error.response?.data || error.message);
      throw new Error(`Failed to publish entry: ${error.response?.data?.error_message || error.message}`);
    }
  }

  async deleteEntry({ uid, contentType = 'tour' }) {
    try {
      const response = await axios.delete(
        `${this.managementBaseURL}/content_types/${contentType}/entries/${uid}`,
        {
          headers: {
            'api_key': this.apiKey,
            'authorization': this.managementToken
          },
          params: {
            branch: this.environment
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Delete entry error:', error.response?.data || error.message);
      throw new Error(`Failed to delete entry: ${error.response?.data?.error_message || error.message}`);
    }
  }

  async bulkCreateEntries({ entries, contentType = 'tour', publish = false }) {
    const results = {
      successful: [],
      failed: []
    };

    for (const entryData of entries) {
      try {
        const entry = await this.createEntry({
          title: entryData.title,
          description: entryData.description,
          contentType,
          additionalFields: entryData.additionalFields || {}
        });

        if (publish) {
          await this.publishEntry({
            uid: entry.uid,
            contentType
          });
        }

        results.successful.push({
          uid: entry.uid,
          title: entry.title,
          published: publish
        });
      } catch (error) {
        results.failed.push({
          title: entryData.title,
          error: error.message
        });
      }
    }

    return results;
  }

  async getContentTypes() {
    try {
      const response = await axios.get(
        `${this.managementBaseURL}/content_types`,
        {
          headers: {
            'api_key': this.apiKey,
            'authorization': this.managementToken
          },
          params: {
            branch: this.environment
          }
        }
      );

      return response.data.content_types || [];
    } catch (error) {
      console.error('Get content types error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch content types: ${error.response?.data?.error_message || error.message}`);
    }
  }

  // Intelligent search with AI-enhanced query processing
  async intelligentSearch({ query, contentType = 'tour', maxResults = 10 }) {
    try {
      // First, get all entries
      const allEntries = await this.getAllEntries({ contentType, limit: 100 });
      
      if (!query || allEntries.length === 0) {
        return allEntries.slice(0, maxResults);
      }

      // Enhanced search with semantic matching
      const enhancedQuery = this.enhanceQuery(query);
      const searchTerms = enhancedQuery.toLowerCase().split(' ');
      
      const scoredEntries = allEntries.map(entry => {
        let score = 0;
        const title = (entry.title || '').toLowerCase();
        const description = (entry.description || entry.paris || entry.india || '').toLowerCase();
        const content = `${title} ${description}`;
        
        // Exact phrase matching
        if (content.includes(query.toLowerCase())) {
          score += 10;
        }
        
        // Individual term matching with weights
        searchTerms.forEach(term => {
          if (title.includes(term)) score += 5;
          if (description.includes(term)) score += 2;
          
          // Fuzzy matching for similar terms
          if (this.fuzzyMatch(term, content)) {
            score += 1;
          }
        });
        
        return { ...entry, score, relevance: score / Math.max(searchTerms.length, 1) };
      });

      return scoredEntries
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    } catch (error) {
      console.error('Intelligent search error:', error);
      // Fallback to regular search
      return this.searchContent({ query, contentType, maxResults });
    }
  }

  enhanceQuery(query) {
    // Add synonyms and related terms
    const synonyms = {
      'travel': ['trip', 'journey', 'vacation', 'tour'],
      'food': ['cuisine', 'dining', 'restaurant', 'meal'],
      'hotel': ['accommodation', 'lodging', 'stay'],
      'activity': ['attraction', 'experience', 'thing to do']
    };

    let enhancedQuery = query;
    Object.keys(synonyms).forEach(key => {
      if (query.toLowerCase().includes(key)) {
        enhancedQuery += ' ' + synonyms[key].join(' ');
      }
    });

    return enhancedQuery;
  }

  fuzzyMatch(term, content) {
    // Simple fuzzy matching - check if term is similar to any word in content
    const words = content.split(' ');
    return words.some(word => {
      if (word.length < 3 || term.length < 3) return false;
      const similarity = this.calculateSimilarity(term, word);
      return similarity > 0.7;
    });
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

module.exports = new ContentstackService();
