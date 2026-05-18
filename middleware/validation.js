// server/middleware/validation.js - Request Validation Middleware
const appConfig = require('../config/app-config');
const { validationError } = require('./error-handler');

class ValidationMiddleware {
    constructor() {
        this.fieldTypes = appConfig.fields.types;
        this.maxCustomFields = appConfig.fields.maxCustomFields;
        this.maxLabelLength = appConfig.fields.maxLabelLength;
        this.maxValueLength = appConfig.fields.maxValueLength;
        this.maxTemplateNameLength = appConfig.templates.maxNameLength;
    }

    /**
     * Validate request body structure
     */
    validateBody(schema) {
        return (req, res, next) => {
            const errors = this.validateObject(req.body, schema, 'body');
            if (errors.length > 0) {
                return next(validationError('Request body validation failed', errors));
            }
            next();
        };
    }

    /**
     * Validate query parameters
     */
    validateQuery(schema) {
        return (req, res, next) => {
            const errors = this.validateObject(req.query, schema, 'query');
            if (errors.length > 0) {
                return next(validationError('Query parameters validation failed', errors));
            }
            next();
        };
    }

    /**
     * Validate URL parameters
     */
    validateParams(schema) {
        return (req, res, next) => {
            const errors = this.validateObject(req.params, schema, 'params');
            if (errors.length > 0) {
                return next(validationError('URL parameters validation failed', errors));
            }
            next();
        };
    }

    /**
     * Validate custom fields array
     */
    validateCustomFields() {
        return (req, res, next) => {
            try {
                let customFields = [];
                
                // Parse custom fields from request body
                if (typeof req.body.customFields === 'string') {
                    customFields = JSON.parse(req.body.customFields);
                } else if (Array.isArray(req.body.customFields)) {
                    customFields = req.body.customFields;
                }

                const errors = this.validateCustomFieldsArray(customFields);
                if (errors.length > 0) {
                    return next(validationError('Custom fields validation failed', errors));
                }

                // Add validated fields back to request
                req.body.customFields = customFields;
                next();

            } catch (parseError) {
                next(validationError('Invalid custom fields JSON format', parseError.message));
            }
        };
    }

    /**
     * Validate template data
     */
    validateTemplateData() {
        return (req, res, next) => {
            const { templateName, description, customFields, category } = req.body;
            const errors = [];

            // Validate template name
            if (!templateName) {
                errors.push('Template name is required');
            } else if (typeof templateName !== 'string') {
                errors.push('Template name must be a string');
            } else if (templateName.length > this.maxTemplateNameLength) {
                errors.push(`Template name too long (max ${this.maxTemplateNameLength} characters)`);
            } else if (templateName.trim().length === 0) {
                errors.push('Template name cannot be empty');
            }

            // Validate description (optional)
            if (description !== undefined) {
                if (typeof description !== 'string') {
                    errors.push('Template description must be a string');
                } else if (description.length > 500) {
                    errors.push('Template description too long (max 500 characters)');
                }
            }

            // Validate category (optional)
            if (category !== undefined) {
                if (typeof category !== 'string') {
                    errors.push('Template category must be a string');
                } else if (category.length > 50) {
                    errors.push('Template category too long (max 50 characters)');
                }
            }

            // Validate custom fields
            if (!customFields) {
                errors.push('Custom fields are required');
            } else {
                const fieldErrors = this.validateCustomFieldsArray(customFields);
                errors.push(...fieldErrors);
            }

            if (errors.length > 0) {
                return next(validationError('Template validation failed', errors));
            }

            next();
        };
    }

    /**
     * Validate property data mapping
     */
    validatePropertyMapping() {
        return (req, res, next) => {
            try {
                let fieldMappings = {};
                
                if (typeof req.body.fieldMappings === 'string') {
                    fieldMappings = JSON.parse(req.body.fieldMappings);
                } else if (typeof req.body.fieldMappings === 'object') {
                    fieldMappings = req.body.fieldMappings || {};
                }

                const errors = this.validateFieldMappings(fieldMappings);
                if (errors.length > 0) {
                    return next(validationError('Field mappings validation failed', errors));
                }

                req.body.fieldMappings = fieldMappings;
                next();

            } catch (parseError) {
                next(validationError('Invalid field mappings JSON format', parseError.message));
            }
        };
    }

    /**
     * Validate pagination parameters
     */
    validatePagination() {
        return (req, res, next) => {
            const { page, limit, sortBy, sortOrder } = req.query;
            const errors = [];

            if (page !== undefined) {
                const pageNum = parseInt(page);
                if (isNaN(pageNum) || pageNum < 1) {
                    errors.push('Page must be a positive integer');
                }
                req.query.page = pageNum;
            } else {
                req.query.page = 1;
            }

            if (limit !== undefined) {
                const limitNum = parseInt(limit);
                if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                    errors.push('Limit must be between 1 and 100');
                }
                req.query.limit = limitNum;
            } else {
                req.query.limit = 10;
            }

            if (sortBy !== undefined) {
                const allowedSortFields = ['name', 'created', 'updated', 'usageCount', 'fieldCount'];
                if (!allowedSortFields.includes(sortBy)) {
                    errors.push(`SortBy must be one of: ${allowedSortFields.join(', ')}`);
                }
            }

            if (sortOrder !== undefined) {
                if (!['asc', 'desc'].includes(sortOrder)) {
                    errors.push('SortOrder must be "asc" or "desc"');
                }
            }

            if (errors.length > 0) {
                return next(validationError('Pagination validation failed', errors));
            }

            next();
        };
    }

    // Core validation methods

    /**
     * Validate object against schema
     */
    validateObject(obj, schema, context = 'object') {
        const errors = [];

        for (const [key, rules] of Object.entries(schema)) {
            const value = obj[key];
            const fieldErrors = this.validateField(value, rules, `${context}.${key}`);
            errors.push(...fieldErrors);
        }

        return errors;
    }

    /**
     * Validate individual field
     */
    validateField(value, rules, fieldPath) {
        const errors = [];

        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${fieldPath} is required`);
            return errors; // Skip other validations if required field is missing
        }

        // Skip validation if field is optional and empty
        if (value === undefined || value === null || value === '') {
            return errors;
        }

        // Type validation
        if (rules.type) {
            if (!this.validateType(value, rules.type)) {
                errors.push(`${fieldPath} must be of type ${rules.type}`);
                return errors; // Skip other validations if type is wrong
            }
        }

        // String validations
        if (typeof value === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
                errors.push(`${fieldPath} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
                errors.push(`${fieldPath} must be no more than ${rules.maxLength} characters`);
            }
            if (rules.pattern && !rules.pattern.test(value)) {
                errors.push(`${fieldPath} format is invalid`);
            }
        }

        // Number validations
        if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
                errors.push(`${fieldPath} must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
                errors.push(`${fieldPath} must be no more than ${rules.max}`);
            }
        }

        // Array validations
        if (Array.isArray(value)) {
            if (rules.minItems && value.length < rules.minItems) {
                errors.push(`${fieldPath} must have at least ${rules.minItems} items`);
            }
            if (rules.maxItems && value.length > rules.maxItems) {
                errors.push(`${fieldPath} must have no more than ${rules.maxItems} items`);
            }
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${fieldPath} must be one of: ${rules.enum.join(', ')}`);
        }

        // Custom validation function
        if (rules.custom && typeof rules.custom === 'function') {
            const customError = rules.custom(value);
            if (customError) {
                errors.push(`${fieldPath} ${customError}`);
            }
        }

        return errors;
    }

    /**
     * Validate type
     */
    validateType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'email':
                return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            case 'url':
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            case 'uuid':
                return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
            default:
                return true;
        }
    }

    /**
     * Validate custom fields array
     */
    validateCustomFieldsArray(fields) {
        const errors = [];

        if (!Array.isArray(fields)) {
            return ['Custom fields must be an array'];
        }

        if (fields.length > this.maxCustomFields) {
            return [`Too many custom fields (max ${this.maxCustomFields})`];
        }

        fields.forEach((field, index) => {
            const fieldErrors = this.validateSingleCustomField(field, index);
            errors.push(...fieldErrors);
        });

        return errors;
    }

    /**
     * Validate single custom field
     */
    validateSingleCustomField(field, index) {
        const errors = [];
        const prefix = `customFields[${index}]`;

        // Required properties
        if (!field.type) {
            errors.push(`${prefix}.type is required`);
        } else if (!Object.values(this.fieldTypes).includes(field.type)) {
            errors.push(`${prefix}.type must be one of: ${Object.values(this.fieldTypes).join(', ')}`);
        }

        if (typeof field.x !== 'number') {
            errors.push(`${prefix}.x must be a number`);
        } else if (field.x < 0) {
            errors.push(`${prefix}.x must be non-negative`);
        }

        if (typeof field.y !== 'number') {
            errors.push(`${prefix}.y must be a number`);
        } else if (field.y < 0) {
            errors.push(`${prefix}.y must be non-negative`);
        }

        // Optional properties validation
        if (field.width !== undefined) {
            if (typeof field.width !== 'number' || field.width < 10) {
                errors.push(`${prefix}.width must be a number >= 10`);
            }
        }

        if (field.height !== undefined) {
            if (typeof field.height !== 'number' || field.height < 10) {
                errors.push(`${prefix}.height must be a number >= 10`);
            }
        }

        if (field.label !== undefined) {
            if (typeof field.label !== 'string') {
                errors.push(`${prefix}.label must be a string`);
            } else if (field.label.length > this.maxLabelLength) {
                errors.push(`${prefix}.label too long (max ${this.maxLabelLength} characters)`);
            }
        }

        if (field.value !== undefined) {
            if (typeof field.value !== 'string') {
                errors.push(`${prefix}.value must be a string`);
            } else if (field.value.length > this.maxValueLength) {
                errors.push(`${prefix}.value too long (max ${this.maxValueLength} characters)`);
            }
        }

        // Type-specific validation
        switch (field.type) {
            case this.fieldTypes.TEXT:
                if (field.fontSize !== undefined) {
                    if (typeof field.fontSize !== 'number' || field.fontSize < 8 || field.fontSize > 72) {
                        errors.push(`${prefix}.fontSize must be between 8 and 72`);
                    }
                }
                break;

            case this.fieldTypes.CHECKBOX:
                if (field.checked !== undefined && typeof field.checked !== 'boolean') {
                    errors.push(`${prefix}.checked must be a boolean`);
                }
                break;

            case this.fieldTypes.DATE:
                if (field.format !== undefined) {
                    const validFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
                    if (!validFormats.includes(field.format)) {
                        errors.push(`${prefix}.format must be one of: ${validFormats.join(', ')}`);
                    }
                }
                break;

            case this.fieldTypes.RADIO:
                if (field.options !== undefined) {
                    if (!Array.isArray(field.options)) {
                        errors.push(`${prefix}.options must be an array`);
                    } else if (field.options.length === 0) {
                        errors.push(`${prefix}.options cannot be empty`);
                    }
                }
                break;
        }

        return errors;
    }

    /**
     * Validate field mappings object
     */
    validateFieldMappings(mappings) {
        const errors = [];

        if (typeof mappings !== 'object' || mappings === null) {
            return ['Field mappings must be an object'];
        }

        const validPropertyKeys = Object.keys(appConfig.propertyData.default);

        Object.entries(mappings).forEach(([fieldName, propertyKey]) => {
            if (typeof fieldName !== 'string' || fieldName.trim() === '') {
                errors.push('Field names must be non-empty strings');
            }

            if (typeof propertyKey !== 'string' || !validPropertyKeys.includes(propertyKey)) {
                errors.push(`Property key "${propertyKey}" is invalid. Valid keys: ${validPropertyKeys.join(', ')}`);
            }
        });

        return errors;
    }

    // Predefined validation schemas

    static get schemas() {
        return {
            // Field creation schema
            createField: {
                type: { type: 'string', required: true, enum: Object.values(appConfig.fields.types) },
                x: { type: 'number', required: true, min: 0 },
                y: { type: 'number', required: true, min: 0 },
                label: { type: 'string', maxLength: appConfig.fields.maxLabelLength },
                width: { type: 'number', min: 10 },
                height: { type: 'number', min: 10 }
            },

            // Template search schema
            templateSearch: {
                query: { type: 'string', maxLength: 100 },
                category: { type: 'string', maxLength: 50 },
                tags: { type: 'array' },
                sortBy: { type: 'string', enum: ['name', 'created', 'updated', 'usageCount'] },
                sortOrder: { type: 'string', enum: ['asc', 'desc'] }
            },

            // ID parameter schema
            idParam: {
                id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9\-_]+$/ }
            }
        };
    }

    /**
     * Sanitize input data
     */
    sanitize() {
        return (req, res, next) => {
            // Sanitize strings in body
            if (req.body && typeof req.body === 'object') {
                req.body = this.sanitizeObject(req.body);
            }

            // Sanitize query parameters
            if (req.query && typeof req.query === 'object') {
                req.query = this.sanitizeObject(req.query);
            }

            next();
        };
    }

    /**
     * Sanitize object recursively
     */
    sanitizeObject(obj) {
        const sanitized = {};

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // Basic HTML/script sanitization
                sanitized[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<[^>]*>/g, '')
                    .trim();
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

// Create singleton instance
const validationMiddleware = new ValidationMiddleware();

// Export middleware functions and schemas
module.exports = {
    validateBody: validationMiddleware.validateBody.bind(validationMiddleware),
    validateQuery: validationMiddleware.validateQuery.bind(validationMiddleware),
    validateParams: validationMiddleware.validateParams.bind(validationMiddleware),
    validateCustomFields: validationMiddleware.validateCustomFields.bind(validationMiddleware),
    validateTemplateData: validationMiddleware.validateTemplateData.bind(validationMiddleware),
    validatePropertyMapping: validationMiddleware.validatePropertyMapping.bind(validationMiddleware),
    validatePagination: validationMiddleware.validatePagination.bind(validationMiddleware),
    sanitize: validationMiddleware.sanitize.bind(validationMiddleware),
    schemas: ValidationMiddleware.schemas,
    ValidationMiddleware
};