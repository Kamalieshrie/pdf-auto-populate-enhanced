const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Joi = require('joi');

// Middleware and validation
const validation = require('../middleware/validation');
const errorHandler = require('../middleware/error-handler');
const auth = require('../middleware/auth');

// Controllers
const templateController = require('../controllers/template-controller');
const pdfController = require('../controllers/pdf-controller');

// Models
const Template = require('../models/templates');
const Field = require('../models/field');
const Project = require('../models/project');

// Apply rate limiting and sanitization
router.use(validation.validateRateLimit(15 * 60 * 1000, 300)); // 300 requests per 15 minutes
router.use(validation.sanitizeInput);

// Template Management Routes

// Create new template
router.post('/',
  auth.authenticate,
  validation.validateSchema(validation.schemas.customValidate({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional().allow(''),
    category: Joi.string().valid(
      'property', 'legal', 'business', 'personal', 
      'medical', 'financial', 'educational', 'government', 'custom'
    ).required(),
    subcategory: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string().max(50)).default([]),
    isPublic: Joi.boolean().default(false)
  })),
  async (req, res, next) => {
    try {
      const templateData = req.body;
      templateData.createdBy = req.user.id;

      const template = await templateController.createTemplate(templateData);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get all templates (with filtering and pagination)
router.get('/',
  validation.validateQueryParams,
  async (req, res, next) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        category, 
        subcategory, 
        tags, 
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includePublic = true 
      } = req.query;

      const userId = req.user?.id;
      const filters = {};

      if (category) filters.category = category;
      if (subcategory) filters.subcategory = subcategory;
      if (tags) filters.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      
      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Include public templates or user's own templates
      if (includePublic && userId) {
        filters.$or = [
          { isPublic: true, status: 'active' },
          { createdBy: userId, status: 'active' }
        ];
      } else if (userId) {
        filters.createdBy = userId;
        filters.status = 'active';
      } else {
        filters.isPublic = true;
        filters.status = 'active';
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
        populate: ['customFields', 'detectedFields']
      };

      const templates = await templateController.getTemplates(filters, options);

      res.json({
        success: true,
        data: templates,
        pagination: {
          page: templates.page,
          limit: templates.limit,
          total: templates.total,
          pages: templates.pages
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get template by ID
router.get('/:templateId',
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const userId = req.user?.id;

      const template = await Template.findById(templateId)
        .populate('customFields')
        .populate('detectedFields')
        .populate('createdBy', 'name email');

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Increment view count
      template.stats.views += 1;
      await template.save();

      res.json({
        success: true,
        data: template
      });

    } catch (error) {
      next(error);
    }
  }
);

// Update template
router.put('/:templateId',
  auth.authenticate,
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(1000).optional().allow(''),
    category: Joi.string().valid(
      'property', 'legal', 'business', 'personal', 
      'medical', 'financial', 'educational', 'government', 'custom'
    ).optional(),
    subcategory: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string().max(50)).optional(),
    isPublic: Joi.boolean().optional(),
    settings: Joi.object({
      allowCollaboration: Joi.boolean(),
      requireApproval: Joi.boolean(),
      fieldValidation: Joi.boolean()
    }).optional()
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'edit')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const updatedTemplate = await templateController.updateTemplate(templateId, updateData);

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: updatedTemplate
      });

    } catch (error) {
      next(error);
    }
  }
);

// Delete template (soft delete)
router.delete('/:templateId',
  auth.authenticate,
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const userId = req.user.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'delete')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      await templateController.archiveTemplate(templateId, userId);

      res.json({
        success: true,
        message: 'Template archived successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// Field Mapping and Management Routes

// Get detected fields from PDF
router.get('/:templateId/fields/detected',
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const userId = req.user?.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const detectedFields = await templateController.getDetectedFields(templateId);

      res.json({
        success: true,
        data: detectedFields,
        count: detectedFields.length
      });

    } catch (error) {
      next(error);
    }
  }
);

// Add custom field (drag-and-drop)
router.post('/:templateId/fields/custom',
  auth.authenticate,
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    type: Joi.string().valid(
      'text', 'checkbox', 'signature', 'date', 'initial', 
      'number', 'email', 'phone', 'dropdown', 'radio'
    ).required(),
    label: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(500).optional().allow(''),
    position: Joi.object({
      page: Joi.number().min(1).required(),
      x: Joi.number().min(0).required(),
      y: Joi.number().min(0).required(),
      width: Joi.number().min(10).required(),
      height: Joi.number().min(10).required()
    }).required(),
    validation: Joi.object({
      required: Joi.boolean().default(false),
      minLength: Joi.number().min(0).optional(),
      maxLength: Joi.number().min(1).optional(),
      pattern: Joi.string().optional(),
      min: Joi.number().optional(),
      max: Joi.number().optional()
    }).default({}),
    styling: Joi.object({
      fontSize: Joi.number().min(6).max(72).default(12),
      fontFamily: Joi.string().default('Helvetica'),
      textAlign: Joi.string().valid('left', 'center', 'right').default('left'),
      color: Joi.string().default('#000000'),
      backgroundColor: Joi.string().optional()
    }).default({}),
    options: Joi.array().items(Joi.string()).optional(), // For dropdown/radio
    defaultValue: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array()
    ).optional()
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const fieldData = req.body;
      const userId = req.user.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'edit')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const field = await templateController.addCustomField(templateId, fieldData);

      res.status(201).json({
        success: true,
        message: 'Custom field added successfully',
        data: field
      });

    } catch (error) {
      next(error);
    }
  }
);

// Update field position (drag-and-drop)
router.put('/:templateId/fields/:fieldId/position',
  auth.authenticate,
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    position: Joi.object({
      page: Joi.number().min(1).required(),
      x: Joi.number().min(0).required(),
      y: Joi.number().min(0).required(),
      width: Joi.number().min(10).optional(),
      height: Joi.number().min(10).optional()
    }).required()
  })),
  async (req, res, next) => {
    try {
      const { templateId, fieldId } = req.params;
      const { position } = req.body;
      const userId = req.user.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'edit')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const updatedField = await templateController.updateFieldPosition(
        templateId, 
        fieldId, 
        position
      );

      res.json({
        success: true,
        message: 'Field position updated successfully',
        data: updatedField
      });

    } catch (error) {
      next(error);
    }
  }
);

// Map detected field to data source
router.post('/:templateId/fields/:fieldId/map',
  auth.authenticate,
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    dataSource: Joi.string().min(1).max(255).required(),
    dataType: Joi.string().valid('string', 'number', 'boolean', 'date', 'array').default('string'),
    transformation: Joi.object({
      type: Joi.string().valid('uppercase', 'lowercase', 'trim', 'dateFormat', 'custom').optional(),
      pattern: Joi.string().optional()
    }).optional(),
    fallbackValue: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array()
    ).optional()
  })),
  async (req, res, next) => {
    try {
      const { templateId, fieldId } = req.params;
      const mappingData = req.body;
      const userId = req.user.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'edit')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const mappedField = await templateController.mapFieldToDataSource(
        templateId, 
        fieldId, 
        mappingData
      );

      res.json({
        success: true,
        message: 'Field mapped successfully',
        data: mappedField
      });

    } catch (error) {
      next(error);
    }
  }
);

// Bulk field mapping
router.post('/:templateId/fields/bulk-map',
  auth.authenticate,
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    mappings: Joi.array().items(
      Joi.object({
        fieldId: Joi.string().required(),
        dataSource: Joi.string().required(),
        dataType: Joi.string().valid('string', 'number', 'boolean', 'date', 'array').default('string')
      })
    ).min(1).required(),
    clearExisting: Joi.boolean().default(false)
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { mappings, clearExisting } = req.body;
      const userId = req.user.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'edit')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const results = await templateController.bulkMapFields(
        templateId, 
        mappings, 
        clearExisting
      );

      res.json({
        success: true,
        message: 'Bulk field mapping completed',
        data: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          details: results
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get field mapping for template
router.get('/:templateId/field-mappings',
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const userId = req.user?.id;

      const template = await Template.findById(templateId)
        .populate('customFields')
        .populate('detectedFields');

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const mappings = await templateController.getFieldMappings(templateId);

      res.json({
        success: true,
        data: {
          template: {
            id: template._id,
            name: template.name,
            category: template.category
          },
          mappings,
          summary: {
            totalFields: template.customFields.length + template.detectedFields.length,
            mappedFields: mappings.filter(m => m.dataSource).length,
            customFields: template.customFields.length,
            detectedFields: template.detectedFields.length
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Template Preview and Testing Routes

// Preview template with sample data
router.post('/:templateId/preview',
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    sampleData: Joi.object().default({}),
    options: Joi.object({
      includeWatermark: Joi.boolean().default(true),
      highlightFields: Joi.boolean().default(false),
      page: Joi.number().min(1).optional()
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { sampleData, options } = req.body;
      const userId = req.user?.id;

      const template = await Template.findById(templateId)
        .populate('customFields')
        .populate('detectedFields');

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const previewResult = await templateController.generatePreview(
        template, 
        sampleData, 
        options
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': previewResult.buffer.length,
        'Content-Disposition': `inline; filename="preview_${template.name}.pdf"`
      });

      res.send(previewResult.buffer);

    } catch (error) {
      next(error);
    }
  }
);

// Test field validation
router.post('/:templateId/validate-fields',
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    fieldValues: Joi.object().pattern(
      Joi.string(), // fieldId
      Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean(),
        Joi.array(),
        Joi.object()
      )
    ).required()
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { fieldValues } = req.body;
      const userId = req.user?.id;

      const template = await Template.findById(templateId)
        .populate('customFields')
        .populate('detectedFields');

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const validationResults = await templateController.validateFieldValues(
        template, 
        fieldValues
      );

      res.json({
        success: true,
        data: {
          isValid: validationResults.every(r => r.isValid),
          results: validationResults,
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

// Template Import/Export Routes

// Export template configuration
router.get('/:templateId/export',
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { format = 'json' } = req.query;
      const userId = req.user?.id;

      const template = await Template.findById(templateId)
        .populate('customFields')
        .populate('detectedFields');

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'export')) {
        return res.status(403).json({
          success: false,
          message: 'Export permission denied'
        });
      }

      const exportData = await templateController.exportTemplate(templateId, format);

      const fileName = `template_${template.name.replace(/[^a-z0-9]/gi, '_')}.${format}`;

      res.set({
        'Content-Type': format === 'json' ? 'application/json' : 'application/xml',
        'Content-Disposition': `attachment; filename="${fileName}"`
      });

      res.send(exportData);

    } catch (error) {
      next(error);
    }
  }
);

// Import template configuration
router.post('/import',
  auth.authenticate,
  validation.validateSchema(validation.schemas.customValidate({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional().allow(''),
    category: Joi.string().valid(
      'property', 'legal', 'business', 'personal', 
      'medical', 'financial', 'educational', 'government', 'custom'
    ).required(),
    config: Joi.alternatives().try(
      Joi.object(), // JSON object
      Joi.string()  // JSON string
    ).required(),
    importOptions: Joi.object({
      importFields: Joi.boolean().default(true),
      importMappings: Joi.boolean().default(true),
      importSettings: Joi.boolean().default(true)
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const importData = req.body;
      importData.createdBy = req.user.id;

      const template = await templateController.importTemplate(importData);

      res.status(201).json({
        success: true,
        message: 'Template imported successfully',
        data: template
      });

    } catch (error) {
      next(error);
    }
  }
);

// Template Collaboration Routes

// Add collaborator
router.post('/:templateId/collaborators',
  auth.authenticate,
  validation.validateObjectId,
  validation.validateSchema(validation.schemas.customValidate({
    userId: Joi.string().required(),
    role: Joi.string().valid('viewer', 'editor', 'admin').default('editor'),
    permissions: Joi.object({
      canEdit: Joi.boolean().default(false),
      canDelete: Joi.boolean().default(false),
      canInvite: Joi.boolean().default(false)
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { userId, role, permissions } = req.body;
      const currentUserId = req.user.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(currentUserId, 'admin')) {
        return res.status(403).json({
          success: false,
          message: 'Admin privileges required'
        });
      }

      const collaboration = await templateController.addCollaborator(
        templateId, 
        userId, 
        role, 
        permissions
      );

      res.json({
        success: true,
        message: 'Collaborator added successfully',
        data: collaboration
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get template collaborators
router.get('/:templateId/collaborators',
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const userId = req.user?.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const collaborators = await templateController.getCollaborators(templateId);

      res.json({
        success: true,
        data: collaborators
      });

    } catch (error) {
      next(error);
    }
  }
);

// Template Analytics Routes

// Get template usage statistics
router.get('/:templateId/analytics',
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { timeframe = 'month' } = req.query;
      const userId = req.user?.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const analytics = await templateController.getTemplateAnalytics(
        templateId, 
        timeframe
      );

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      next(error);
    }
  }
);

// Get template activity log
router.get('/:templateId/activity',
  validation.validateObjectId,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { limit = 50, page = 1 } = req.query;
      const userId = req.user?.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const activityLog = await templateController.getActivityLog(
        templateId, 
        parseInt(limit), 
        parseInt(page)
      );

      res.json({
        success: true,
        data: activityLog
      });

    } catch (error) {
      next(error);
    }
  }
);

// Error handling middleware
router.use(errorHandler);

module.exports = router;
