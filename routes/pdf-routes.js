const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Middleware and validation
const validation = require('../middleware/validation');
const errorHandler = require('../middleware/error-handler');

// Controllers
const pdfController = require('../controllers/pdf-controller');

// Models
const Template = require('../models/templates');
const Project = require('../models/project');
const Field = require('../models/field');

// Apply rate limiting and sanitization

router.use(validation.sanitizeInput);

// PDF Upload and Processing Routes

// Upload PDF file
router.post('/upload',
  validation.validatePdfFileUpload,
  validation.validatePdfUpload,
  pdfController.uploadPdf
);

// Alternative upload endpoint with progress tracking
router.post('/upload-with-progress',
  validation.validatePdfFileUpload,
  async (req, res, next) => {
    try {
      const { title, description, category } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No PDF file uploaded'
        });
      }

      // Create upload session
      const uploadSession = {
        sessionId: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName: file.originalname,
        fileSize: file.size,
        uploadedBy: req.user?.id || 'anonymous',
        status: 'processing',
        progress: 0,
        startedAt: new Date()
      };

      // In a real implementation, this would be stored in Redis or database
      // for tracking progress across requests
      
      // Start async processing
      pdfController.processPdfAsync(file, { title, description, category }, uploadSession)
        .catch(error => console.error('PDF processing error:', error));

      res.json({
        success: true,
        message: 'PDF upload started',
        data: {
          sessionId: uploadSession.sessionId,
          status: uploadSession.status,
          progress: uploadSession.progress
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// Check upload progress
router.get('/upload-progress/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    // In a real implementation, retrieve from Redis/database
    const session = await pdfController.getUploadSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Upload session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    next(error);
  }
});

// PDF Analysis and Field Detection

// Analyze PDF for field detection
router.post('/analyze',
  validation.validateSchema(validation.schemas.customValidate({
    pdfPath: Joi.string().required(),
    options: Joi.object({
      detectSignatures: Joi.boolean().default(true),
      detectCheckboxes: Joi.boolean().default(true),
      detectTextFields: Joi.boolean().default(true),
      confidenceThreshold: Joi.number().min(0).max(1).default(0.7),
      pageRange: Joi.object({
        start: Joi.number().min(1),
        end: Joi.number().min(1)
      }).optional()
    }).default({})
  })),
  pdfController.analyzePdf
);

// Re-analyze PDF with different settings
router.post('/re-analyze/:templateId',
  validation.validateSchema(validation.schemas.customValidate({
    options: Joi.object({
      detectSignatures: Joi.boolean().default(true),
      detectCheckboxes: Joi.boolean().default(true),
      detectTextFields: Joi.boolean().default(true),
      confidenceThreshold: Joi.number().min(0).max(1).default(0.7),
      pageRange: Joi.object({
        start: Joi.number().min(1),
        end: Joi.number().min(1)
      }).optional(),
      clearExisting: Joi.boolean().default(false)
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { options } = req.body;
      const userId = req.user?.id;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Check permissions
      if (!template.canUserAccess(userId, 'edit')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      const analysisResult = await pdfController.reAnalyzePdf(template, options);
      
      res.json({
        success: true,
        message: 'PDF re-analysis completed',
        data: analysisResult
      });

    } catch (error) {
      next(error);
    }
  }
);

// PDF Preview and Rendering

// Get PDF preview (thumbnail)
router.get('/preview/:templateId',
  validation.validateQueryParams,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { page = 1, width = 300, height = 400 } = req.query;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      if (!template.canUserAccess(req.user?.id, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const previewBuffer = await pdfController.generatePreview(template, {
        page: parseInt(page),
        width: parseInt(width),
        height: parseInt(height)
      });

      res.set({
        'Content-Type': 'image/png',
        'Content-Length': previewBuffer.length,
        'Cache-Control': 'public, max-age=3600'
      });

      res.send(previewBuffer);

    } catch (error) {
      next(error);
    }
  }
);

// Get PDF with filled fields rendered
router.get('/render/:projectId',
  validation.validateQueryParams,
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const { format = 'pdf', download = false } = req.query;
      const userId = req.user?.id;

      const project = await Project.findById(projectId).populate('templateId');
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      if (!project.canUserAccess(userId, 'view')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const renderedPdf = await pdfController.renderFilledPdf(project, {
        format,
        includeWatermark: !project.canUserAccess(userId, 'export')
      });

      // Log activity
      project.logActivity(userId, 'exported', { format });
      await project.save();

      const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}.${format}`;
      
      res.set({
        'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/json',
        'Content-Length': renderedPdf.length,
        'Content-Disposition': download ? `attachment; filename="${fileName}"` : 'inline'
      });

      res.send(renderedPdf);

    } catch (error) {
      next(error);
    }
  }
);

// PDF Form Filling

// Fill PDF form with data
router.post('/fill',
  validation.validateFieldData,
  pdfController.fillPdfForm
);

// Batch fill multiple forms
router.post('/fill-batch',
  validation.validateSchema(validation.schemas.customValidate({
    templateId: Joi.string().required(),
    datasets: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        data: Joi.object().required()
      })
    ).min(1).max(50).required(), // Limit to 50 forms per batch
    options: Joi.object({
      format: Joi.string().valid('pdf', 'zip').default('zip'),
      includeOriginals: Joi.boolean().default(false),
      watermark: Joi.boolean().default(false)
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const { templateId, datasets, options } = req.body;
      const userId = req.user?.id;

      const template = await Template.findById(templateId).populate('customFields');
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

      // Create batch job
      const batchJob = {
        jobId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        templateId,
        datasets: datasets.length,
        options,
        status: 'queued',
        progress: 0,
        createdBy: userId,
        createdAt: new Date()
      };

      // Start async processing
      pdfController.processBatchFill(template, datasets, options, batchJob)
        .catch(error => console.error('Batch fill error:', error));

      res.json({
        success: true,
        message: 'Batch fill job created',
        data: batchJob
      });

    } catch (error) {
      next(error);
    }
  }
);

// Check batch job status
router.get('/batch-status/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;
    
    const job = await pdfController.getBatchJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Batch job not found'
      });
    }

    if (job.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: job
    });

  } catch (error) {
    next(error);
  }
});

// PDF Manipulation

// Split PDF into individual pages
router.post('/split/:templateId',
  validation.validateSchema(validation.schemas.customValidate({
    pages: Joi.alternatives().try(
      Joi.string().valid('all'),
      Joi.array().items(Joi.number().min(1))
    ).default('all'),
    outputFormat: Joi.string().valid('pdf', 'image').default('pdf')
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { pages, outputFormat } = req.body;
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

      const splitResult = await pdfController.splitPdf(template, {
        pages,
        outputFormat
      });

      res.json({
        success: true,
        message: 'PDF split completed',
        data: splitResult
      });

    } catch (error) {
      next(error);
    }
  }
);

// Merge multiple PDFs
router.post('/merge',
  validation.validateSchema(validation.schemas.customValidate({
    templateIds: Joi.array().items(Joi.string()).min(2).max(10).required(),
    outputName: Joi.string().max(255).required(),
    includeBookmarks: Joi.boolean().default(true)
  })),
  async (req, res, next) => {
    try {
      const { templateIds, outputName, includeBookmarks } = req.body;
      const userId = req.user?.id;

      // Verify access to all templates
      const templates = await Template.find({ _id: { $in: templateIds } });
      
      if (templates.length !== templateIds.length) {
        return res.status(404).json({
          success: false,
          message: 'One or more templates not found'
        });
      }

      for (const template of templates) {
        if (!template.canUserAccess(userId, 'view')) {
          return res.status(403).json({
            success: false,
            message: `Access denied to template: ${template.name}`
          });
        }
      }

      const mergedPdf = await pdfController.mergePdfs(templates, {
        outputName,
        includeBookmarks
      });

      res.json({
        success: true,
        message: 'PDFs merged successfully',
        data: mergedPdf
      });

    } catch (error) {
      next(error);
    }
  }
);

// PDF Security and Permissions

// Add password protection
router.post('/protect/:templateId',
  validation.validateSchema(validation.schemas.customValidate({
    password: Joi.string().min(6).max(50).required(),
    permissions: Joi.object({
      printing: Joi.boolean().default(true),
      modifying: Joi.boolean().default(false),
      copying: Joi.boolean().default(true),
      annotating: Joi.boolean().default(false)
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { password, permissions } = req.body;
      const userId = req.user?.id;

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

      const protectedPdf = await pdfController.protectPdf(template, {
        password,
        permissions
      });

      res.json({
        success: true,
        message: 'PDF protection added',
        data: {
          templateId,
          protected: true,
          permissions
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// PDF Metadata and Information

// Get PDF metadata
router.get('/info/:templateId', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.id;

    const template = await Template.findById(templateId).populate('customFields');
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

    const pdfInfo = await pdfController.getPdfInfo(template);

    res.json({
      success: true,
      data: {
        template: {
          id: template._id,
          name: template.name,
          description: template.description,
          category: template.category
        },
        pdf: {
          originalName: template.pdfInfo.originalName,
          pageCount: template.pdfInfo.pageCount,
          fileSize: template.pdfInfo.fileSize,
          dimensions: template.pdfInfo.dimensions
        },
        fields: {
          total: template.customFields.length,
          detected: template.detectedFields.length,
          byType: pdfInfo.fieldsByType
        },
        stats: template.stats,
        lastModified: template.updatedAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get PDF text content
router.get('/text/:templateId', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const { page } = req.query;
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

    const textContent = await pdfController.extractText(template, {
      page: page ? parseInt(page) : null
    });

    res.json({
      success: true,
      data: {
        templateId,
        textContent,
        extractedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

// PDF Conversion

// Convert PDF to images
router.post('/convert/images/:templateId',
  validation.validateSchema(validation.schemas.customValidate({
    format: Joi.string().valid('png', 'jpg', 'webp').default('png'),
    quality: Joi.number().min(1).max(100).default(90),
    dpi: Joi.number().min(72).max(300).default(150),
    pages: Joi.alternatives().try(
      Joi.string().valid('all'),
      Joi.array().items(Joi.number().min(1))
    ).default('all')
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { format, quality, dpi, pages } = req.body;
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

      const conversionResult = await pdfController.convertToImages(template, {
        format,
        quality,
        dpi,
        pages
      });

      res.json({
        success: true,
        message: 'PDF converted to images',
        data: conversionResult
      });

    } catch (error) {
      next(error);
    }
  }
);

// Optimize PDF file size
router.post('/optimize/:templateId',
  validation.validateSchema(validation.schemas.customValidate({
    level: Joi.string().valid('low', 'medium', 'high').default('medium'),
    options: Joi.object({
      compressImages: Joi.boolean().default(true),
      imageQuality: Joi.number().min(1).max(100).default(85),
      removeMetadata: Joi.boolean().default(false),
      linearize: Joi.boolean().default(true)
    }).default({})
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { level, options } = req.body;
      const userId = req.user?.id;

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

      const optimizationResult = await pdfController.optimizePdf(template, {
        level,
        options
      });

      res.json({
        success: true,
        message: 'PDF optimization completed',
        data: optimizationResult
      });

    } catch (error) {
      next(error);
    }
  }
);

// PDF Validation and Quality Check

// Validate PDF structure and fields
router.post('/validate/:templateId', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.id;

    const template = await Template.findById(templateId).populate('customFields');
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

    const validationResult = await pdfController.validatePdf(template);

    res.json({
      success: true,
      data: {
        isValid: validationResult.isValid,
        issues: validationResult.issues,
        suggestions: validationResult.suggestions,
        score: validationResult.qualityScore,
        checkedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

// Run accessibility check
router.post('/accessibility-check/:templateId', async (req, res, next) => {
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

    const accessibilityResult = await pdfController.checkAccessibility(template);

    res.json({
      success: true,
      data: {
        score: accessibilityResult.score,
        issues: accessibilityResult.issues,
        recommendations: accessibilityResult.recommendations,
        wcagCompliance: accessibilityResult.wcagCompliance
      }
    });

  } catch (error) {
    next(error);
  }
});

// PDF Backup and Recovery

// Create backup
router.post('/backup/:templateId', async (req, res, next) => {
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

    if (!template.canUserAccess(userId, 'edit')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const backupResult = await pdfController.createBackup(template);

    res.json({
      success: true,
      message: 'Backup created successfully',
      data: backupResult
    });

  } catch (error) {
    next(error);
  }
});

// Restore from backup
router.post('/restore/:templateId',
  validation.validateSchema(validation.schemas.customValidate({
    backupId: Joi.string().required(),
    restoreFields: Joi.boolean().default(true),
    restoreSettings: Joi.boolean().default(true)
  })),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { backupId, restoreFields, restoreSettings } = req.body;
      const userId = req.user?.id;

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

      const restoreResult = await pdfController.restoreFromBackup(template, {
        backupId,
        restoreFields,
        restoreSettings
      });

      res.json({
        success: true,
        message: 'Template restored from backup',
        data: restoreResult
      });

    } catch (error) {
      next(error);
  }
});

// Cleanup and Maintenance

// Delete PDF and associated data
router.delete('/:templateId', async (req, res, next) => {
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

    if (!template.canUserAccess(userId, 'delete')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Soft delete - move to archived status
    template.status = 'archived';
    template.modifiedBy = userId;
    await template.save();

    // Log activity
    template.logActivity?.(userId, 'deleted', {});

    res.json({
      success: true,
      message: 'Template archived successfully',
      data: {
        templateId,
        archivedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

// Permanent delete (admin only)
router.delete('/permanent/:templateId', async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin'; // Assuming role-based auth

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Delete physical files and database records
    await pdfController.permanentDelete(template);

    res.json({
      success: true,
      message: 'Template permanently deleted',
      data: {
        templateId,
        deletedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
});

// Cleanup temporary files
router.post('/cleanup', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    const cleanupResult = await pdfController.cleanupTemporaryFiles();

    res.json({
      success: true,
      message: 'Cleanup completed',
      data: cleanupResult
    });

  } catch (error) {
    next(error);
  }
});

// Error handling middleware
router.use(errorHandler);

module.exports = router;
