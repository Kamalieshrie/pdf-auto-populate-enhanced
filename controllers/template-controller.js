// server/controllers/template-controller.js - Template Management Controller
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const appConfig = require('../config/app-config');

class TemplateController {
    constructor() {
        this.templatesDir = path.join(appConfig.directories.templates, 'saved-layouts');
        this.maxTemplates = appConfig.templates.maxPerUser;
        this.maxNameLength = appConfig.templates.maxNameLength;
        this.retentionDays = appConfig.templates.retentionDays;
    }

    /**
     * Save a custom field template
     */
    async saveTemplate(req, res) {
        try {
            const { templateName, description, customFields, category } = req.body;

            if (!templateName || !customFields) {
                return res.status(400).json({
                    success: false,
                    message: 'Template name and fields are required'
                });
            }

            if (templateName.length > this.maxNameLength) {
                return res.status(400).json({
                    success: false,
                    message: `Template name too long (max ${this.maxNameLength} characters)`
                });
            }

            if (!Array.isArray(customFields)) {
                return res.status(400).json({
                    success: false,
                    message: 'Custom fields must be an array'
                });
            }

            if (customFields.length > appConfig.fields.maxCustomFields) {
                return res.status(400).json({
                    success: false,
                    message: `Too many fields (max ${appConfig.fields.maxCustomFields})`
                });
            }

            // Ensure templates directory exists
            await fs.mkdir(this.templatesDir, { recursive: true });

            // Check if template already exists
            const templateId = this.sanitizeFilename(templateName);
            const templatePath = path.join(this.templatesDir, `${templateId}.json`);
            
            let existingTemplate = null;
            try {
                const existingData = await fs.readFile(templatePath, 'utf8');
                existingTemplate = JSON.parse(existingData);
            } catch (error) {
                // Template doesn't exist, which is fine
            }

            // Validate custom fields
            const validationErrors = [];
            customFields.forEach((field, index) => {
                if (!field.type || !Object.values(appConfig.fields.types).includes(field.type)) {
                    validationErrors.push(`Field ${index + 1}: Invalid type`);
                }
                if (typeof field.x !== 'number' || typeof field.y !== 'number') {
                    validationErrors.push(`Field ${index + 1}: Invalid position`);
                }
            });

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Field validation failed',
                    errors: validationErrors
                });
            }

            const templateData = {
                id: existingTemplate ? existingTemplate.id : uuidv4(),
                name: templateName,
                description: description || '',
                category: category || 'general',
                version: existingTemplate ? (existingTemplate.version || 1) + 1 : 1,
                fields: customFields,
                fieldCount: customFields.length,
                metadata: {
                    created: existingTemplate ? existingTemplate.metadata.created : new Date().toISOString(),
                    updated: new Date().toISOString(),
                    usageCount: existingTemplate ? existingTemplate.metadata.usageCount || 0 : 0,
                    tags: this.generateTags(customFields)
                },
                compatibility: {
                    version: '2.0.0',
                    minVersion: '2.0.0'
                }
            };

            await fs.writeFile(templatePath, JSON.stringify(templateData, null, 2));

            console.log(`Template saved: ${templateName} (${customFields.length} fields)`);

            res.json({
                success: true,
                message: `Template "${templateName}" saved successfully`,
                template: {
                    id: templateData.id,
                    name: templateData.name,
                    description: templateData.description,
                    fieldCount: templateData.fieldCount,
                    version: templateData.version,
                    created: templateData.metadata.created,
                    updated: templateData.metadata.updated
                }
            });

        } catch (error) {
            console.error('Error saving template:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to save template: ' + error.message
            });
        }
    }

    /**
     * Load all available templates
     */
    async loadTemplates(req, res) {
        try {
            await fs.mkdir(this.templatesDir, { recursive: true });

            const files = await fs.readdir(this.templatesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            const templates = [];
            const errors = [];

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    // Validate template structure
                    if (this.validateTemplateStructure(template)) {
                        templates.push({
                            filename: file,
                            id: template.id,
                            name: template.name,
                            description: template.description,
                            category: template.category || 'general',
                            fieldCount: template.fieldCount || template.fields.length,
                            version: template.version || 1,
                            created: template.metadata?.created || template.created,
                            updated: template.metadata?.updated || template.updated,
                            usageCount: template.metadata?.usageCount || 0,
                            tags: template.metadata?.tags || [],
                            preview: this.generatePreview(template.fields)
                        });
                    } else {
                        errors.push(`Invalid template structure: ${file}`);
                    }
                } catch (e) {
                    errors.push(`Could not load template ${file}: ${e.message}`);
                }
            }

            // Sort templates by usage count and creation date
            templates.sort((a, b) => {
                if (b.usageCount !== a.usageCount) {
                    return b.usageCount - a.usageCount;
                }
                return new Date(b.created) - new Date(a.created);
            });

            res.json({
                success: true,
                message: `Loaded ${templates.length} templates`,
                templates,
                totalTemplates: templates.length,
                categories: [...new Set(templates.map(t => t.category))],
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error('Error loading templates:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load templates: ' + error.message
            });
        }
    }

    /**
     * Load a specific template by ID or name
     */
    async loadTemplate(req, res) {
        try {
            const { templateId } = req.params;

            if (!templateId) {
                return res.status(400).json({
                    success: false,
                    message: 'Template ID required'
                });
            }

            // Try to find template by ID or sanitized name
            const files = await fs.readdir(this.templatesDir);
            let templateFile = null;

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    if (template.id === templateId || 
                        file === `${templateId}.json` || 
                        this.sanitizeFilename(template.name) === templateId) {
                        templateFile = template;
                        break;
                    }
                }
            }

            if (!templateFile) {
                return res.status(404).json({
                    success: false,
                    message: 'Template not found'
                });
            }

            // Increment usage count
            templateFile.metadata = templateFile.metadata || {};
            templateFile.metadata.usageCount = (templateFile.metadata.usageCount || 0) + 1;
            templateFile.metadata.lastUsed = new Date().toISOString();

            // Save updated usage count
            const templatePath = path.join(this.templatesDir, `${this.sanitizeFilename(templateFile.name)}.json`);
            await fs.writeFile(templatePath, JSON.stringify(templateFile, null, 2));

            res.json({
                success: true,
                message: 'Template loaded successfully',
                template: templateFile
            });

        } catch (error) {
            console.error('Error loading template:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load template: ' + error.message
            });
        }
    }

    /**
     * Delete a template
     */
    async deleteTemplate(req, res) {
        try {
            const { templateId } = req.params;

            if (!templateId) {
                return res.status(400).json({
                    success: false,
                    message: 'Template ID required'
                });
            }

            // Find and delete the template file
            const files = await fs.readdir(this.templatesDir);
            let deleted = false;

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    if (template.id === templateId || 
                        file === `${templateId}.json` || 
                        this.sanitizeFilename(template.name) === templateId) {
                        await fs.unlink(filePath);
                        deleted = true;
                        console.log(`Template deleted: ${template.name}`);
                        break;
                    }
                }
            }

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Template not found'
                });
            }

            res.json({
                success: true,
                message: 'Template deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting template:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete template: ' + error.message
            });
        }
    }

    /**
     * Duplicate a template with a new name
     */
    async duplicateTemplate(req, res) {
        try {
            const { templateId } = req.params;
            const { newName } = req.body;

            if (!templateId || !newName) {
                return res.status(400).json({
                    success: false,
                    message: 'Template ID and new name required'
                });
            }

            // Find the original template
            const files = await fs.readdir(this.templatesDir);
            let originalTemplate = null;

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    if (template.id === templateId || 
                        file === `${templateId}.json` || 
                        this.sanitizeFilename(template.name) === templateId) {
                        originalTemplate = template;
                        break;
                    }
                }
            }

            if (!originalTemplate) {
                return res.status(404).json({
                    success: false,
                    message: 'Original template not found'
                });
            }

            // Create duplicated template
            const duplicatedTemplate = {
                ...originalTemplate,
                id: uuidv4(),
                name: newName,
                description: (originalTemplate.description || '') + ' (Copy)',
                version: 1,
                metadata: {
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    usageCount: 0,
                    tags: originalTemplate.metadata?.tags || [],
                    originalTemplate: originalTemplate.id
                }
            };

            const duplicatePath = path.join(this.templatesDir, `${this.sanitizeFilename(newName)}.json`);
            await fs.writeFile(duplicatePath, JSON.stringify(duplicatedTemplate, null, 2));

            res.json({
                success: true,
                message: `Template duplicated as "${newName}"`,
                template: {
                    id: duplicatedTemplate.id,
                    name: duplicatedTemplate.name,
                    description: duplicatedTemplate.description,
                    fieldCount: duplicatedTemplate.fieldCount,
                    created: duplicatedTemplate.metadata.created
                }
            });

        } catch (error) {
            console.error('Error duplicating template:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to duplicate template: ' + error.message
            });
        }
    }

    /**
     * Get template statistics and analytics
     */
    async getTemplateStats(req, res) {
        try {
            const files = await fs.readdir(this.templatesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            let totalTemplates = 0;
            let totalFields = 0;
            let totalUsage = 0;
            const categories = {};
            const fieldTypes = {};
            const recentTemplates = [];

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    totalTemplates++;
                    totalFields += template.fields?.length || 0;
                    totalUsage += template.metadata?.usageCount || 0;
                    
                    const category = template.category || 'general';
                    categories[category] = (categories[category] || 0) + 1;
                    
                    // Count field types
                    if (template.fields) {
                        template.fields.forEach(field => {
                            fieldTypes[field.type] = (fieldTypes[field.type] || 0) + 1;
                        });
                    }
                    
                    // Track recent templates
                    if (template.metadata?.created) {
                        recentTemplates.push({
                            name: template.name,
                            created: template.metadata.created,
                            fieldCount: template.fields?.length || 0
                        });
                    }
                } catch (e) {
                    // Skip invalid templates
                }
            }

            // Sort recent templates
            recentTemplates.sort((a, b) => new Date(b.created) - new Date(a.created));

            res.json({
                success: true,
                stats: {
                    totalTemplates,
                    totalFields,
                    totalUsage,
                    averageFieldsPerTemplate: totalTemplates > 0 ? Math.round(totalFields / totalTemplates) : 0,
                    categories: Object.entries(categories).map(([name, count]) => ({ name, count })),
                    fieldTypes: Object.entries(fieldTypes).map(([type, count]) => ({ type, count })),
                    recentTemplates: recentTemplates.slice(0, 5)
                }
            });

        } catch (error) {
            console.error('Error getting template stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get template stats: ' + error.message
            });
        }
    }

    /**
     * Clean up old templates based on retention policy
     */
    async cleanupTemplates(req, res) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            const files = await fs.readdir(this.templatesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            let deletedCount = 0;
            const errors = [];

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    const createdDate = new Date(template.metadata?.created || template.created);
                    const usageCount = template.metadata?.usageCount || 0;
                    
                    // Delete if old and unused
                    if (createdDate < cutoffDate && usageCount === 0) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        console.log(`Cleaned up old template: ${template.name}`);
                    }
                } catch (e) {
                    errors.push(`Could not process ${file}: ${e.message}`);
                }
            }

            res.json({
                success: true,
                message: `Cleanup completed. ${deletedCount} templates deleted.`,
                deletedCount,
                retentionDays: this.retentionDays,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error('Error cleaning up templates:', error);
            res.status(500).json({
                success: false,
                message: 'Template cleanup failed: ' + error.message
            });
        }
    }

    // Helper methods

    /**
     * Sanitize filename for safe filesystem operations
     */
    sanitizeFilename(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Validate template structure
     */
    validateTemplateStructure(template) {
        return (
            template &&
            typeof template.name === 'string' &&
            Array.isArray(template.fields) &&
            template.fields.every(field => 
                field.type &&
                Object.values(appConfig.fields.types).includes(field.type) &&
                typeof field.x === 'number' &&
                typeof field.y === 'number'
            )
        );
    }

    /**
     * Generate tags based on field types and content
     */
    generateTags(fields) {
        const tags = [];
        const fieldTypes = [...new Set(fields.map(field => field.type))];
        
        fieldTypes.forEach(type => {
            tags.push(`field-${type}`);
        });

        // Add category tags based on field combinations
        if (fieldTypes.includes('signature') || fieldTypes.includes('initials')) {
            tags.push('signing');
        }
        if (fieldTypes.includes('date')) {
            tags.push('dated');
        }
        if (fieldTypes.includes('checkbox')) {
            tags.push('checkboxes');
        }
        
        // Add size-based tags
        if (fields.length <= 3) {
            tags.push('simple');
        } else if (fields.length >= 10) {
            tags.push('complex');
        }

        return tags;
    }

    /**
     * Generate a preview of the template (first few fields)
     */
    generatePreview(fields) {
        return fields.slice(0, 3).map(field => ({
            type: field.type,
            label: field.label || `${field.type} field`,
            position: { x: field.x, y: field.y }
        }));
    }

    /**
     * Import template from file upload
     */
    async importTemplate(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No template file uploaded'
                });
            }

            const templateData = await fs.readFile(req.file.path, 'utf8');
            await fs.unlink(req.file.path); // Clean up uploaded file

            let template;
            try {
                template = JSON.parse(templateData);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid JSON format'
                });
            }

            // Validate template structure
            if (!this.validateTemplateStructure(template)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid template structure'
                });
            }

            // Generate new ID and update metadata
            template.id = uuidv4();
            template.metadata = {
                ...template.metadata,
                imported: new Date().toISOString(),
                updated: new Date().toISOString(),
                usageCount: 0
            };

            // Save imported template
            const templatePath = path.join(this.templatesDir, `${this.sanitizeFilename(template.name)}.json`);
            await fs.writeFile(templatePath, JSON.stringify(template, null, 2));

            res.json({
                success: true,
                message: `Template "${template.name}" imported successfully`,
                template: {
                    id: template.id,
                    name: template.name,
                    fieldCount: template.fields.length,
                    imported: template.metadata.imported
                }
            });

        } catch (error) {
            // Clean up file on error
            if (req.file) {
                await fs.unlink(req.file.path).catch(() => {});
            }

            console.error('Error importing template:', error);
            res.status(500).json({
                success: false,
                message: 'Template import failed: ' + error.message
            });
        }
    }

    /**
     * Export template as JSON file
     */
    async exportTemplate(req, res) {
        try {
            const { templateId } = req.params;

            if (!templateId) {
                return res.status(400).json({
                    success: false,
                    message: 'Template ID required'
                });
            }

            // Find the template
            const files = await fs.readdir(this.templatesDir);
            let template = null;

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const templateData = JSON.parse(content);
                    
                    if (templateData.id === templateId || 
                        file === `${templateId}.json` || 
                        this.sanitizeFilename(templateData.name) === templateId) {
                        template = templateData;
                        break;
                    }
                }
            }

            if (!template) {
                return res.status(404).json({
                    success: false,
                    message: 'Template not found'
                });
            }

            // Prepare template for export (remove internal metadata)
            const exportTemplate = {
                ...template,
                metadata: {
                    created: template.metadata.created,
                    version: template.version,
                    exported: new Date().toISOString(),
                    exportVersion: '2.0.0'
                }
            };

            const filename = `${this.sanitizeFilename(template.name)}-template.json`;

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.json(exportTemplate);

        } catch (error) {
            console.error('Error exporting template:', error);
            res.status(500).json({
                success: false,
                message: 'Template export failed: ' + error.message
            });
        }
    }

    /**
     * Search templates by name, category, or tags
     */
    async searchTemplates(req, res) {
        try {
            const { query, category, tags, sortBy, sortOrder } = req.query;

            const files = await fs.readdir(this.templatesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            let templates = [];

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    if (this.validateTemplateStructure(template)) {
                        templates.push({
                            filename: file,
                            id: template.id,
                            name: template.name,
                            description: template.description,
                            category: template.category || 'general',
                            fieldCount: template.fieldCount || template.fields.length,
                            version: template.version || 1,
                            created: template.metadata?.created || template.created,
                            updated: template.metadata?.updated || template.updated,
                            usageCount: template.metadata?.usageCount || 0,
                            tags: template.metadata?.tags || []
                        });
                    }
                } catch (e) {
                    // Skip invalid templates
                }
            }

            // Apply filters
            let filteredTemplates = templates;

            if (query) {
                const searchQuery = query.toLowerCase();
                filteredTemplates = filteredTemplates.filter(template =>
                    template.name.toLowerCase().includes(searchQuery) ||
                    template.description.toLowerCase().includes(searchQuery) ||
                    template.tags.some(tag => tag.toLowerCase().includes(searchQuery))
                );
            }

            if (category) {
                filteredTemplates = filteredTemplates.filter(template =>
                    template.category === category
                );
            }

            if (tags) {
                const searchTags = Array.isArray(tags) ? tags : [tags];
                filteredTemplates = filteredTemplates.filter(template =>
                    searchTags.some(tag => template.tags.includes(tag))
                );
            }

            // Apply sorting
            const sort = sortBy || 'created';
            const order = sortOrder === 'asc' ? 1 : -1;

            filteredTemplates.sort((a, b) => {
                let aValue = a[sort];
                let bValue = b[sort];

                if (sort === 'created' || sort === 'updated') {
                    aValue = new Date(aValue);
                    bValue = new Date(bValue);
                }

                if (aValue < bValue) return -1 * order;
                if (aValue > bValue) return 1 * order;
                return 0;
            });

            res.json({
                success: true,
                message: `Found ${filteredTemplates.length} templates`,
                templates: filteredTemplates,
                totalResults: filteredTemplates.length,
                searchCriteria: {
                    query,
                    category,
                    tags,
                    sortBy: sort,
                    sortOrder: sortOrder || 'desc'
                }
            });

        } catch (error) {
            console.error('Error searching templates:', error);
            res.status(500).json({
                success: false,
                message: 'Template search failed: ' + error.message
            });
        }
    }

    /**
     * Get template categories and their counts
     */
    async getCategories(req, res) {
        try {
            const files = await fs.readdir(this.templatesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            const categories = {};

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.templatesDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    
                    const category = template.category || 'general';
                    categories[category] = (categories[category] || 0) + 1;
                } catch (e) {
                    // Skip invalid templates
                }
            }

            const categoryList = Object.entries(categories).map(([name, count]) => ({
                name,
                count,
                displayName: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')
            }));

            res.json({
                success: true,
                categories: categoryList,
                totalCategories: categoryList.length
            });

        } catch (error) {
            console.error('Error getting categories:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get categories: ' + error.message
            });
        }
    }
}

module.exports = new TemplateController();
