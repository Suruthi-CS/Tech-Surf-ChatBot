const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ContentstackService = require('./contentstackService');

class UploadService {
  constructor() {
    this.uploadHistoryFile = path.join(__dirname, '../data/upload_history.json');
    this.ensureDataDirectory();
    this.uploadHistory = this.loadUploadHistory();
  }

  ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadUploadHistory() {
    try {
      if (fs.existsSync(this.uploadHistoryFile)) {
        const data = fs.readFileSync(this.uploadHistoryFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading upload history:', error);
    }
    return [];
  }

  saveUploadHistory() {
    try {
      fs.writeFileSync(this.uploadHistoryFile, JSON.stringify(this.uploadHistory, null, 2));
    } catch (error) {
      console.error('Error saving upload history:', error);
    }
  }

  async processExcelFile({
    filePath,
    contentType = 'tour',
    publish = false,
    titleColumn = 'title',
    descriptionColumn = 'description',
    botId
  }) {
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        throw new Error('No data found in the Excel file');
      }

      // Process the data
      const processedEntries = this.processData(jsonData, titleColumn, descriptionColumn);
      
      // Upload to Contentstack
      const result = await ContentstackService.bulkCreateEntries({
        entries: processedEntries,
        contentType,
        publish
      });

      // Save to upload history
      const uploadRecord = {
        id: uuidv4(),
        fileName: path.basename(filePath),
        botId,
        contentType,
        totalEntries: processedEntries.length,
        successful: result.successful.length,
        failed: result.failed.length,
        published: publish,
        uploadedAt: new Date().toISOString(),
        titleColumn,
        descriptionColumn
      };

      this.uploadHistory.unshift(uploadRecord);
      this.saveUploadHistory();

      return {
        uploadId: uploadRecord.id,
        totalProcessed: processedEntries.length,
        successful: result.successful,
        failed: result.failed,
        published: publish
      };
    } catch (error) {
      console.error('Excel processing error:', error);
      throw new Error(`Failed to process Excel file: ${error.message}`);
    }
  }

  async previewExcelFile(filePath) {
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON (limit to first 10 rows for preview)
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      const preview = jsonData.slice(0, 10);
      
      // Get column names
      const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
      
      return {
        columns,
        preview,
        totalRows: jsonData.length,
        sheetName,
        suggestedMapping: this.suggestColumnMapping(columns)
      };
    } catch (error) {
      console.error('Excel preview error:', error);
      throw new Error(`Failed to preview Excel file: ${error.message}`);
    }
  }

  processData(jsonData, titleColumn, descriptionColumn) {
    return jsonData.map(row => {
      const title = row[titleColumn] || row.title || row.Title || row.NAME || row.name || '';
      const description = row[descriptionColumn] || row.description || row.Description || row.DESC || row.desc || '';
      
      if (!title.trim()) {
        throw new Error(`Missing title in row: ${JSON.stringify(row)}`);
      }

      // Extract additional fields (excluding title and description columns)
      const additionalFields = {};
      Object.keys(row).forEach(key => {
        if (key !== titleColumn && key !== descriptionColumn && key !== 'title' && key !== 'description') {
          additionalFields[key.toLowerCase()] = row[key];
        }
      });

      return {
        title: title.trim(),
        description: description.trim(),
        additionalFields
      };
    });
  }

  suggestColumnMapping(columns) {
    const titleSuggestions = ['title', 'name', 'heading', 'subject', 'topic'];
    const descriptionSuggestions = ['description', 'desc', 'content', 'details', 'info', 'summary'];
    
    const titleColumn = columns.find(col => 
      titleSuggestions.some(suggestion => 
        col.toLowerCase().includes(suggestion)
      )
    ) || columns[0];
    
    const descriptionColumn = columns.find(col => 
      descriptionSuggestions.some(suggestion => 
        col.toLowerCase().includes(suggestion)
      )
    ) || columns[1];

    return {
      titleColumn,
      descriptionColumn,
      availableColumns: columns
    };
  }

  async processJsonData({
    data,
    contentType = 'tour',
    publish = false,
    botId
  }) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid data format. Expected non-empty array.');
      }

      // Validate data structure
      const processedEntries = data.map((item, index) => {
        if (!item.title || typeof item.title !== 'string') {
          throw new Error(`Missing or invalid title at index ${index}`);
        }

        return {
          title: item.title.trim(),
          description: (item.description || '').trim(),
          additionalFields: item.additionalFields || {}
        };
      });

      // Upload to Contentstack
      const result = await ContentstackService.bulkCreateEntries({
        entries: processedEntries,
        contentType,
        publish
      });

      // Save to upload history
      const uploadRecord = {
        id: uuidv4(),
        fileName: 'JSON Data',
        botId,
        contentType,
        totalEntries: processedEntries.length,
        successful: result.successful.length,
        failed: result.failed.length,
        published: publish,
        uploadedAt: new Date().toISOString(),
        source: 'json'
      };

      this.uploadHistory.unshift(uploadRecord);
      this.saveUploadHistory();

      return {
        uploadId: uploadRecord.id,
        totalProcessed: processedEntries.length,
        successful: result.successful,
        failed: result.failed,
        published: publish
      };
    } catch (error) {
      console.error('JSON processing error:', error);
      throw new Error(`Failed to process JSON data: ${error.message}`);
    }
  }

  async getUploadHistory({ botId, limit = 10 }) {
    let history = [...this.uploadHistory];
    
    if (botId) {
      history = history.filter(record => record.botId === botId);
    }
    
    return history.slice(0, limit);
  }

  generateTemplate(contentType = 'tour') {
    const templateData = this.getTemplateData(contentType);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    // Generate file path
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const fileName = `${contentType}_template_${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, fileName);
    
    // Write file
    XLSX.writeFile(workbook, filePath);
    
    return filePath;
  }

  getTemplateData(contentType) {
    const templates = {
      tour: [
        {
          title: 'Amazing Paris Tour',
          description: 'Explore the beautiful city of Paris with our guided tour including Eiffel Tower, Louvre Museum, and Seine River cruise.',
          duration: '3 days',
          price: '$299',
          category: 'City Tour'
        },
        {
          title: 'Italian Countryside Experience',
          description: 'Discover the charm of Italian countryside with wine tasting, local cuisine, and historic villages.',
          duration: '5 days',
          price: '$599',
          category: 'Cultural Tour'
        }
      ],
      product: [
        {
          title: 'Wireless Headphones',
          description: 'High-quality wireless headphones with noise cancellation and 20-hour battery life.',
          price: '$199',
          category: 'Electronics',
          brand: 'TechBrand'
        },
        {
          title: 'Smart Watch',
          description: 'Advanced smartwatch with health monitoring, GPS, and smartphone integration.',
          price: '$299',
          category: 'Wearables',
          brand: 'SmartTech'
        }
      ],
      default: [
        {
          title: 'Sample Title 1',
          description: 'This is a sample description for the first item.',
          category: 'Sample Category',
          tags: 'sample, example'
        },
        {
          title: 'Sample Title 2',
          description: 'This is a sample description for the second item.',
          category: 'Sample Category',
          tags: 'sample, example'
        }
      ]
    };

    return templates[contentType] || templates.default;
  }

  async validateExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        rowCount: jsonData.length,
        columns: jsonData.length > 0 ? Object.keys(jsonData[0]) : []
      };

      if (jsonData.length === 0) {
        validation.isValid = false;
        validation.errors.push('File contains no data');
        return validation;
      }

      // Check for required columns
      const hasTitle = validation.columns.some(col => 
        ['title', 'name', 'heading'].includes(col.toLowerCase())
      );
      
      if (!hasTitle) {
        validation.warnings.push('No title column detected. Please specify the title column during upload.');
      }

      // Check for empty titles
      const emptyTitleRows = jsonData.filter((row, index) => {
        const titleValue = Object.values(row)[0];
        return !titleValue || titleValue.toString().trim() === '';
      });

      if (emptyTitleRows.length > 0) {
        validation.warnings.push(`${emptyTitleRows.length} rows have empty titles`);
      }

      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [`Failed to validate file: ${error.message}`],
        warnings: [],
        rowCount: 0,
        columns: []
      };
    }
  }
}

module.exports = new UploadService();
