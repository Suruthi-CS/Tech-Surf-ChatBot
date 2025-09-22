const express = require('express');
const { body, query, validationResult } = require('express-validator');
const ContentstackService = require('../services/contentstackService');

const router = express.Router();

// Validation middleware
const validateContentSearch = [
  query('q').optional().isString(),
  query('contentType').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validateContentCreate = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').optional().isString(),
  body('contentType').optional().isString()
];

// Search content
router.get('/search', validateContentSearch, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q: query, contentType = 'tours', limit = 10 } = req.query;

    const results = await ContentstackService.searchContent({
      query,
      contentType,
      maxResults: parseInt(limit)
    });

    res.json({
      results,
      total: results.length,
      contentType,
      query
    });
  } catch (error) {
    console.error('Content search error:', error);
    res.status(500).json({ 
      error: 'Failed to search content',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get all content entries
router.get('/entries', async (req, res) => {
  try {
    const { contentType = 'tours', limit = 50 } = req.query;

    const entries = await ContentstackService.getAllEntries({
      contentType,
      limit: parseInt(limit)
    });

    res.json({
      entries,
      total: entries.length,
      contentType
    });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch entries',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Create new content entry
router.post('/entries', validateContentCreate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, contentType = 'tours', ...additionalFields } = req.body;

    const entry = await ContentstackService.createEntry({
      title,
      description,
      contentType,
      additionalFields
    });

    res.status(201).json({
      message: 'Entry created successfully',
      entry
    });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ 
      error: 'Failed to create entry',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Update content entry
router.put('/entries/:uid', validateContentCreate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { uid } = req.params;
    const { title, description, contentType = 'tours', ...additionalFields } = req.body;

    const entry = await ContentstackService.updateEntry({
      uid,
      title,
      description,
      contentType,
      additionalFields
    });

    res.json({
      message: 'Entry updated successfully',
      entry
    });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ 
      error: 'Failed to update entry',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Publish content entry
router.post('/entries/:uid/publish', async (req, res) => {
  try {
    const { uid } = req.params;
    const { contentType = 'tours' } = req.body;

    const result = await ContentstackService.publishEntry({
      uid,
      contentType
    });

    res.json({
      message: 'Entry published successfully',
      result
    });
  } catch (error) {
    console.error('Publish entry error:', error);
    res.status(500).json({ 
      error: 'Failed to publish entry',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Delete content entry
router.delete('/entries/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { contentType = 'tour' } = req.query;

    await ContentstackService.deleteEntry({
      uid,
      contentType
    });

    res.json({
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ 
      error: 'Failed to delete entry',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Bulk create entries
router.post('/entries/bulk', async (req, res) => {
  try {
    const { entries, contentType = 'tour', publish = false } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const results = await ContentstackService.bulkCreateEntries({
      entries,
      contentType,
      publish
    });

    res.json({
      message: `${results.successful.length} entries created successfully`,
      successful: results.successful,
      failed: results.failed,
      total: entries.length
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ 
      error: 'Failed to bulk create entries',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Get content types
router.get('/content-types', async (req, res) => {
  try {
    const contentTypes = await ContentstackService.getContentTypes();
    
    res.json({
      contentTypes
    });
  } catch (error) {
    console.error('Get content types error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch content types',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

module.exports = router;
