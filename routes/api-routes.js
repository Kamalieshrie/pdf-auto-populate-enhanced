const express = require('express');
const router = express.Router();
const validation = require('../middleware/validation');
const errorHandler = require('../middleware/error-handler');

// Import controllers
const pdfController = require('../controllers/pdf-controller');
const templateController = require('../controllers/template-controller');
const fieldController = require('../controllers/field-controller');

// Import models for direct queries
const Template = require('../models/Template');
const Project = require('../models/Project');
const Field = require('../models/Field');

// Apply rate limiting to all API routes
router.use(validation.validateRateLimit(15 * 60 * 1000, 1000)); // 1000 requests per 15 minutes

// Apply input sanitization to all routes
router.use(validation.sanitizeInput);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
router.get('/info', (req, res) => {
  res.json({
    name: 'PDF Auto-Populate API',
    version: process.env.API_VERSION || '1.0.0',
    description: 'Advanced PDF form generation and field mapping API',
    endpoints: {
      templates: '/api/templates',
      projects: '/api/projects',
      pdfs: '/api/pdfs',
      fields: '/api/fields',
      search: '/api/search',
      analytics: '/api/analytics'
    },
    features: [
      'drag-and-drop field mapping',
      'automatic field detection',
      'signature support',
      'template management',
      'real-time collaboration',
      'multi-format export'
    ]
  });
});

// Search endpoints
router.get('/search', validation.validateQueryParams, async (req, res, next) => {
  try {
    const { q: query, type, category, limit = 20, page = 1 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchResults = {
      templates: [],
      projects: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    // Search templates
    if (!type || type === 'templates') {
      const templates = await Template.searchTemplates(query, {
        category,
        limit: Math.ceil(limit / 2),
        includePrivate: false // Only public templates in general search
      });
      searchResults.templates = templates;
    }

    // Search projects (would require user authentication)
    if (!type || type === 'projects') {
      // This would typically require user context from auth middleware
      const userId = req.user?.id; // Assuming auth middleware sets req.user
      if (userId) {
        const projects = await Project.find({
          $and: [
            { $text: { $search: query } },
            {
              $or: [
                { createdBy: userId },
                { 'collaborators.userId': userId, 'collaborators.status': 'active' }
              ]
            }
          ]
        }).limit(Math.ceil(limit / 2)).select('name description status progress createdAt');
        
        searchResults.projects = projects;
      }
    }

    searchResults.total = searchResults.templates.length + searchResults.projects.length;

    res.json({
      success: true,
      data: searchResults,
      query,
      filters: { type, category }
    });

  } catch (error) {
    next(error);
  }
});

// Global search with filters
router.post('/search/advanced', 
  validation.validateSchema(validation.schemas.customValidate({
    query: validation.schemas.queryParams.extract('search').required(),
    filters: Joi.object({
      type: Joi.array().items(Joi.string().valid('templates', 'projects', 'fields')),
      category: Joi.array().items(Joi.string()),
      tags: Joi.array().items(Joi.string()),
      dateRange: Joi.object({
        from: Joi.date(),
        to: Joi.date()
      }),
      status: Joi.array().items(Joi.string()),
      createdBy: Joi.string()
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const { query, filters } = req.body;
      const results = {};

      // Advanced search logic would go here
      // This is a simplified version

      if (!filters.type || filters.type.includes('templates')) {
        results.templates = await Template.find({
          $and: [
            { $text: { $search: query } },
            { isPublic: true, status: 'active' },
            ...(filters.category ? [{ category: { $in: filters.category } }] : []),
            ...(filters.tags ? [{ tags: { $in: filters.tags } }] : [])
          ]
        }).limit(20);
      }

      if (!filters.type || filters.type.includes('projects')) {
        // Would require user authentication
        results.projects = [];
      }

      if (!filters.type || filters.type.includes('fields')) {
        results.fields = await Field.find({
          $and: [
            { 
              $or: [
                { label: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
              ]
            },
            { isPublic: true, status: 'active' },
            ...(filters.category ? [{ category: { $in: filters.category } }] : [])
          ]
        }).limit(20);
      }

      res.json({
        success: true,
        data: results,
        query,
        filters
      });

    } catch (error) {
      next(error);
    }
  }
);

// Analytics endpoints
router.get('/analytics/overview', async (req, res, next) => {
  try {
    const { timeframe = 'month' } = req.query;
    const userId = req.user?.id; // From auth middleware

    const analytics = {
      templates: {
        total: await Template.countDocuments({ isPublic: true, status: 'active' }),
        popular: await Template.getPopular(5)
      },
      usage: {
        totalForms: await Project.countDocuments({ status: 'completed' }),
        activeProjects: await Project.countDocuments({ 
          status: { $in: ['draft', 'in_progress', 'review'] } 
        })
      }
    };

    if (userId) {
      // User-specific analytics
      analytics.user = await Project.getProjectStats(userId, timeframe);
      analytics.user.recentProjects = await Project.findByUser(userId, { 
        limit: 10, 
        sort: 'recent' 
      });
    }

    res.json({
      success: true,
      data: analytics,
      timeframe
    });

  } catch (error) {
    next(error);
  }
});

// System statistics
router.get('/analytics/stats', async (req, res, next) => {
  try {
    const stats = await Promise.all([
      Template.aggregate([
        { $match: { isPublic: true, status: 'active' } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgRating: { $avg: '$stats.rating.average' }
          }
        }
      ]),
      
      Project.aggregate([
        { $match: { status: { $ne: 'archived' } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgProgress: { $avg: '$progress.percentage' }
          }
        }
      ]),
      
      Field.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            avgUsage: { $avg: '$usageCount' }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        templatesByCategory: stats[0],
        projectsByStatus: stats[1],
        fieldsByType: stats[2],
        generatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

// Field types and validation info
router.get('/field-types', (req, res) => {
  res.json({
    success: true,
    data: {
      types: Field.getFieldTypes(),
      categories: ['personal', 'business', 'financial', 'legal', 'medical', 'custom'],
      validationOptions: {
        text: ['minLength', 'maxLength', 'pattern'],
        number: ['min', 'max'],
        date: ['dateFormat'],
        email: ['pattern'],
        phone: ['pattern']
      },
      stylingOptions: {
        fontFamilies: ['Helvetica', 'Times-Roman', 'Courier', 'Arial', 'Georgia', 'Verdana'],
        textAlign: ['left', 'center', 'right'],
        fontSizes: { min: 6, max: 72, default: 12 }
      }
    }
  });
});

// Template categories
router.get('/template-categories', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: Template.getCategories(),
      subcategories: {
        property: ['lease', 'sale', 'rental', 'management'],
        legal: ['contract', 'agreement', 'waiver', 'disclosure'],
        business: ['invoice', 'proposal', 'report', 'application'],
        personal: ['form', 'application', 'survey', 'registration'],
        medical: ['intake', 'consent', 'history', 'insurance'],
        financial: ['application', 'disclosure', 'statement', 'tax'],
        educational: ['enrollment', 'transcript', 'evaluation', 'survey'],
        government: ['application', 'permit', 'registration', 'filing']
      }
    }
  });
});

// Bulk operations
router.post('/bulk/validate-fields', 
  validation.validateSchema(Joi.object({
    fields: Joi.array().items(
      Joi.object({
        fieldId: Joi.string().required(),
        value: Joi.alternatives().try(
          Joi.string(),
          Joi.number(),
          Joi.boolean(),
          Joi.array()
        ).required()
      })
    ).required(),
    templateId: Joi.string().required()
  })),
  async (req, res, next) => {
    try {
      const { fields, templateId } = req.body;
      
      const template = await Template.findById(templateId).populate('customFields');
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      const validationResults = [];

      for (const fieldData of fields) {
        const field = template.customFields.find(f => f.fieldId === fieldData.fieldId);
        if (!field) {
          validationResults.push({
            fieldId: fieldData.fieldId,
            isValid: false,
            errors: ['Field not found in template']
          });
          continue;
        }

        const errors = Field.validateFieldValue(field, fieldData.value);
        validationResults.push({
          fieldId: fieldData.fieldId,
          isValid: errors.length === 0,
          errors,
          field: {
            label: field.label,
            type: field.type,
            required: field.required
          }
        });
      }

      res.json({
        success: true,
        data: {
          validationResults,
          summary: {
            total: validationResults.length,
            valid: validationResults.filter(r => r.isValid).length,
            invalid: validationResults.filter(r => !r.isValid).length
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Export multiple projects
router.post('/bulk/export',
  validation.validateSchema(Joi.object({
    projectIds: Joi.array().items(Joi.string()).min(1).max(10).required(),
    format: Joi.string().valid('pdf', 'json', 'zip').default('zip'),
    includeAttachments: Joi.boolean().default(false)
  })),
  async (req, res, next) => {
    try {
      const { projectIds, format, includeAttachments } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Verify user has access to all projects
      const projects = await Project.find({
        _id: { $in: projectIds },
        $or: [
          { createdBy: userId },
          { 'collaborators.userId': userId, 'collaborators.status': 'active' }
        ]
      });

      if (projects.length !== projectIds.length) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to one or more projects'
        });
      }

      // This would trigger the bulk export process
      const exportJob = {
        jobId: `bulk_export_${Date.now()}`,
        projects: projects.map(p => ({
          id: p._id,
          name: p.name,
          status: p.status
        })),
        format,
        includeAttachments,
        createdBy: userId,
        status: 'queued'
      };

      // In a real implementation, you'd queue this job for background processing
      
      res.json({
        success: true,
        message: 'Bulk export job created',
        data: exportJob
      });

    } catch (error) {
      next(error);
    }
  }
);

// Webhook endpoints for integrations
router.post('/webhooks/form-submitted',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      // Webhook for external form submissions
      // This would validate webhook signatures and process the data
      
      const signature = req.headers['x-webhook-signature'];
      // Validate signature here
      
      const payload = JSON.parse(req.body);
      
      // Process webhook payload
      res.json({
        success: true,
        message: 'Webhook processed',
        timestamp: new Date()
      });

    } catch (error) {
      next(error);
    }
  }
);

// Error handling middleware
router.use(errorHandler);

module.exports = router;