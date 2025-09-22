const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const UploadService = require('../services/uploadService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload and process Excel/CSV file
router.post('/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      botId,
      contentType = 'tour',
      publish = false,
      titleColumn = 'title',
      descriptionColumn = 'description'
    } = req.body;

    const filePath = req.file.path;
    
    // Process the uploaded file
    const result = await UploadService.processExcelFile({
      filePath,
      contentType,
      publish: publish === 'true',
      titleColumn,
      descriptionColumn,
      botId
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'File processed successfully',
      ...result
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      error: 'Failed to process file',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Preview Excel/CSV file content
router.post('/excel/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    
    // Preview the file content
    const preview = await UploadService.previewExcelFile(filePath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'File preview generated',
      preview
    });

  } catch (error) {
    console.error('File preview error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      error: 'Failed to preview file',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Upload JSON data directly
router.post('/json', async (req, res) => {
  try {
    const {
      data,
      botId,
      contentType = 'tour',
      publish = false
    } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data array is required' });
    }

    const result = await UploadService.processJsonData({
      data,
      contentType,
      publish,
      botId
    });

    res.json({
      message: 'Data processed successfully',
      ...result
    });

  } catch (error) {
    console.error('JSON upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process data',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get upload history
router.get('/history', async (req, res) => {
  try {
    const { botId, limit = 10 } = req.query;
    
    const history = await UploadService.getUploadHistory({
      botId,
      limit: parseInt(limit)
    });

    res.json({ history });
  } catch (error) {
    console.error('Get upload history error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch upload history',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Download template Excel file
router.get('/template', (req, res) => {
  try {
    const { contentType = 'tour' } = req.query;
    
    const templatePath = UploadService.generateTemplate(contentType);
    
    res.download(templatePath, `${contentType}_template.xlsx`, (err) => {
      if (err) {
        console.error('Template download error:', err);
        res.status(500).json({ error: 'Failed to download template' });
      }
      
      // Clean up template file
      fs.unlinkSync(templatePath);
    });
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate template',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;
