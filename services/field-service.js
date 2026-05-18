/**
 * Field Service
 * Handles business logic for field management, operations, and interactions
 */

const fieldMapper = require('../utils/field-mapper');
const validationUtils = require('../utils/validation-utils');
const Field = require('../models/Field');
const Template = require('../models/Template');
const { v4: uuidv4 } = require('uuid');

class FieldService {
    constructor() {
        this.supportedFieldTypes = [
            'text', 'number', 'email', 'phone', 'date', 'url',
            'checkbox', 'radio', 'dropdown', 'signature', 'image'
        ];

        this.defaultFieldProperties = {
            text: { fontSize: 12, fontColor: '#000000', maxLength: 255 },
            number: { fontSize: 12, min: null, max: null, precision: 2 },
            email: { fontSize: 12, maxLength: 255 },
            phone: { fontSize: 12, format: 'us' },
            date: { fontSize: 12, format: 'YYYY-MM-DD' },
            url: { fontSize: 12, httpsOnly: false },
            checkbox: { checkType: 'check', required: false },
            radio: { layout: 'vertical', options: [] },
            dropdown: { options: [], multiSelect: false, editable: false },
            signature: { width: 200, height: 100, signatureType: 'draw' },
            image: { width: 100, height: 100, aspectRatio: true }
        };
    }

    /**
     * Create a new field
     */
    async createField(fieldData, templateId = null) {
        try {
            // Validate field data
            const validation = this.validateFieldData(fieldData);
            if (!validation.isValid) {
                throw new Error(`Field validation failed: ${validation.errors.join(', ')}`);
            }

            // Generate unique field ID if not provided
            const fieldId = fieldData.id || `field_${Date.now()}_${uuidv4().split('-')[0]}`;

            // Merge with default properties
            const properties = {
                ...this.defaultFieldProperties[fieldData.type] || {},
                ...fieldData.properties || {}
            };

            // Create field object
            const field = {
                id: fieldId,
                name: fieldData.name,
                type: fieldData.type,
                label: fieldData.label || fieldData.name,
                x: fieldData.x || 0,
                y: fieldData.y || 0,
                width: fieldData.width || this.getDefaultWidth(fieldData.type),
                height: fieldData.height || this.getDefaultHeight(fieldData.type),
                properties,
                validation: fieldData.validation || {},
                value: fieldData.value !== undefined ? fieldData.value : this.getDefaultValue(fieldData.type),
                templateId: templateId || fieldData.templateId || null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Save to database if template ID provided
            if (field.templateId) {
                const savedField = await Field.create(field);
                return this.formatFieldResponse(savedField);
            }

            return this.formatFieldResponse(field);

        } catch (error) {
            throw new Error(`Failed to create field: ${error.message}`);
        }
    }

    /**
     * Update an existing field
     */
    async updateField(fieldId, updateData) {
        try {
            // Find existing field
            const existingField = await Field.findById(fieldId);
            if (!existingField) {
                throw new Error('Field not found');
            }

            // Validate update data
            const validation = this.validateFieldUpdate(updateData, existingField);
            if (!validation.isValid) {
                throw new Error(`Field update validation failed: ${validation.errors.join(', ')}`);
            }

            // Prepare update object
            const updateObject = {
                ...updateData,
                updatedAt: new Date()
            };

            // Update properties if provided
            if (updateData.properties) {
                updateObject.properties = {
                    ...existingField.properties,
                    ...updateData.properties
                };
            }

            // Remove undefined values
            Object.keys(updateObject).forEach(key => {
                if (updateObject[key] === undefined) {
                    delete updateObject[key];
                }
            });

            // Save updated field
            const saved = await Field.findByIdAndUpdate(fieldId, updateObject, { 
                new: true,
                runValidators: true 
            });
            
            if (!saved) {
                throw new Error('Failed to update field');
            }

            return this.formatFieldResponse(saved);

        } catch (error) {
            throw new Error(`Failed to update field: ${error.message}`);
        }
    }

    /**
     * Delete a field
     */
    async deleteField(fieldId) {
        try {
            const field = await Field.findById(fieldId);
            if (!field) {
                throw new Error('Field not found');
            }

            const result = await Field.findByIdAndDelete(fieldId);
            if (!result) {
                throw new Error('Failed to delete field');
            }

            return {
                success: true,
                message: 'Field deleted successfully',
                fieldId: fieldId,
                deletedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to delete field: ${error.message}`);
        }
    }

    /**
     * Get field by ID
     */
    async getField(fieldId) {
        try {
            const field = await Field.findById(fieldId);
            if (!field) {
                throw new Error('Field not found');
            }

            return this.formatFieldResponse(field);

        } catch (error) {
            throw new Error(`Failed to get field: ${error.message}`);
        }
    }

    /**
     * Get fields by template ID
     */
    async getFieldsByTemplate(templateId, options = {}) {
        try {
            const { 
                sortBy = 'createdAt', 
                sortOrder = 'asc', 
                limit, 
                skip,
                includeInactive = false 
            } = options;

            // Build query
            let query = { templateId };
            if (!includeInactive) {
                query.active = true;
            }

            let mongooseQuery = Field.find(query);

            // Apply sorting
            const sortOptions = {};
            const validSortFields = ['name', 'type', 'createdAt', 'updatedAt', 'x', 'y'];
            if (validSortFields.includes(sortBy)) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
                mongooseQuery = mongooseQuery.sort(sortOptions);
            }

            // Apply pagination
            if (skip && skip > 0) {
                mongooseQuery = mongooseQuery.skip(skip);
            }
            if (limit && limit > 0) {
                mongooseQuery = mongooseQuery.limit(limit);
            }

            const fields = await mongooseQuery.exec();
            return fields.map(field => this.formatFieldResponse(field));

        } catch (error) {
            throw new Error(`Failed to get template fields: ${error.message}`);
        }
    }

    /**
     * Duplicate a field
     */
    async duplicateField(fieldId, options = {}) {
        try {
            const originalField = await Field.findById(fieldId);
            if (!originalField) {
                throw new Error('Field not found');
            }

            const { offsetX = 20, offsetY = 20, newName, templateId } = options;

            // Create duplicate field data
            const duplicateData = {
                ...originalField.toObject(),
                id: undefined,
                _id: undefined,
                name: newName || `${originalField.name}_copy`,
                label: `${originalField.label} (Copy)`,
                x: originalField.x + offsetX,
                y: originalField.y + offsetY,
                templateId: templateId || originalField.templateId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Remove MongoDB-specific fields
            delete duplicateData.__v;

            return await this.createField(duplicateData, duplicateData.templateId);

        } catch (error) {
            throw new Error(`Failed to duplicate field: ${error.message}`);
        }
    }

    /**
     * Batch create fields
     */
    async batchCreateFields(fieldsData, templateId = null) {
        try {
            if (!Array.isArray(fieldsData)) {
                throw new Error('fieldsData must be an array');
            }

            const results = {
                successful: [],
                failed: [],
                totalCount: fieldsData.length
            };

            for (let i = 0; i < fieldsData.length; i++) {
                const fieldData = fieldsData[i];
                try {
                    const field = await this.createField(fieldData, templateId);
                    results.successful.push({
                        index: i,
                        field: field,
                        fieldData: fieldData
                    });
                } catch (error) {
                    results.failed.push({
                        index: i,
                        fieldData: fieldData,
                        error: error.message
                    });
                }
            }

            return results;

        } catch (error) {
            throw new Error(`Failed to batch create fields: ${error.message}`);
        }
    }

    /**
     * Batch update fields
     */
    async batchUpdateFields(updates) {
        try {
            if (!Array.isArray(updates)) {
                throw new Error('Updates must be an array');
            }

            const results = {
                successful: [],
                failed: [],
                totalCount: updates.length
            };

            for (let i = 0; i < updates.length; i++) {
                const { fieldId, updateData } = updates[i];
                try {
                    if (!fieldId) {
                        throw new Error('fieldId is required');
                    }
                    const field = await this.updateField(fieldId, updateData);
                    results.successful.push({
                        index: i,
                        fieldId: fieldId,
                        field: field
                    });
                } catch (error) {
                    results.failed.push({
                        index: i,
                        fieldId: fieldId,
                        updateData: updateData,
                        error: error.message
                    });
                }
            }

            return results;

        } catch (error) {
            throw new Error(`Failed to batch update fields: ${error.message}`);
        }
    }

    /**
     * Move field to new position
     */
    async moveField(fieldId, newPosition) {
        try {
            const { x, y } = newPosition;
            
            if (typeof x !== 'number' || typeof y !== 'number') {
                throw new Error('Invalid position coordinates: x and y must be numbers');
            }

            if (x < 0 || y < 0) {
                throw new Error('Position coordinates cannot be negative');
            }

            return await this.updateField(fieldId, { x, y });

        } catch (error) {
            throw new Error(`Failed to move field: ${error.message}`);
        }
    }

    /**
     * Resize field
     */
    async resizeField(fieldId, newDimensions) {
        try {
            const { width, height } = newDimensions;
            
            if (typeof width !== 'number' || typeof height !== 'number') {
                throw new Error('Invalid dimensions: width and height must be numbers');
            }

            if (width <= 0 || height <= 0) {
                throw new Error('Dimensions must be positive numbers');
            }

            // Validate maximum dimensions
            if (width > 10000 || height > 10000) {
                throw new Error('Dimensions too large: maximum allowed is 10000px');
            }

            return await this.updateField(fieldId, { width, height });

        } catch (error) {
            throw new Error(`Failed to resize field: ${error.message}`);
        }
    }

    /**
     * Set field value
     */
    async setFieldValue(fieldId, value) {
        try {
            const field = await Field.findById(fieldId);
            if (!field) {
                throw new Error('Field not found');
            }

            // Validate value based on field type
            const validation = validationUtils.validateField(
                { name: field.name, type: field.type, properties: field.properties }, 
                value
            );
            
            if (!validation.isValid) {
                throw new Error(`Invalid field value: ${validation.errors.join(', ')}`);
            }

            return await this.updateField(fieldId, { 
                value: validation.sanitizedValue 
            });

        } catch (error) {
            throw new Error(`Failed to set field value: ${error.message}`);
        }
    }

    /**
     * Get field validation rules
     */
    getFieldValidationRules(fieldType) {
        if (!this.supportedFieldTypes.includes(fieldType)) {
            return { isValid: false, errors: [`Unsupported field type: ${fieldType}`] };
        }

        const rules = {
            required: false,
            ...this.getTypeSpecificRules(fieldType)
        };

        return rules;
    }

    /**
     * Validate field data
     */
    validateFieldData(fieldData) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!fieldData || typeof fieldData !== 'object') {
            validation.isValid = false;
            validation.errors.push('Field data must be an object');
            return validation;
        }

        // Required fields check
        if (!fieldData.name || typeof fieldData.name !== 'string' || fieldData.name.trim() === '') {
            validation.isValid = false;
            validation.errors.push('Field name is required and must be a non-empty string');
        }

        if (!fieldData.type || typeof fieldData.type !== 'string') {
            validation.isValid = false;
            validation.errors.push('Field type is required and must be a string');
        }

        // Field type validation
        if (fieldData.type && !this.supportedFieldTypes.includes(fieldData.type)) {
            validation.isValid = false;
            validation.errors.push(`Unsupported field type: ${fieldData.type}. Supported types: ${this.supportedFieldTypes.join(', ')}`);
        }

        // Position validation
        if (fieldData.x !== undefined && (typeof fieldData.x !== 'number' || isNaN(fieldData.x))) {
            validation.isValid = false;
            validation.errors.push('X position must be a valid number');
        }

        if (fieldData.y !== undefined && (typeof fieldData.y !== 'number' || isNaN(fieldData.y))) {
            validation.isValid = false;
            validation.errors.push('Y position must be a valid number');
        }

        // Dimension validation
        if (fieldData.width !== undefined) {
            if (typeof fieldData.width !== 'number' || isNaN(fieldData.width) || fieldData.width <= 0) {
                validation.isValid = false;
                validation.errors.push('Width must be a positive number');
            }
        }

        if (fieldData.height !== undefined) {
            if (typeof fieldData.height !== 'number' || isNaN(fieldData.height) || fieldData.height <= 0) {
                validation.isValid = false;
                validation.errors.push('Height must be a positive number');
            }
        }

        // Name validation (alphanumeric and underscores)
        if (fieldData.name && !/^[a-zA-Z0-9_]+$/.test(fieldData.name)) {
            validation.warnings.push('Field name should contain only letters, numbers, and underscores');
        }

        // Type-specific validation
        if (fieldData.type && fieldData.value !== undefined) {
            try {
                const fieldValidation = validationUtils.validateField(
                    { name: fieldData.name, type: fieldData.type },
                    fieldData.value
                );
                
                if (!fieldValidation.isValid) {
                    validation.warnings.push(...fieldValidation.errors);
                }
            } catch (error) {
                validation.warnings.push(`Value validation warning: ${error.message}`);
            }
        }

        return validation;
    }

    /**
     * Validate field update data
     */
    validateFieldUpdate(updateData, existingField) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!updateData || typeof updateData !== 'object') {
            validation.isValid = false;
            validation.errors.push('Update data must be an object');
            return validation;
        }

        // Don't allow type changes
        if (updateData.type && updateData.type !== existingField.type) {
            validation.isValid = false;
            validation.errors.push('Field type cannot be changed');
        }

        // Don't allow template ID changes
        if (updateData.templateId && updateData.templateId !== existingField.templateId) {
            validation.isValid = false;
            validation.errors.push('Template ID cannot be changed');
        }

        // Validate other fields same as creation
        const combinedData = {
            ...existingField.toObject(),
            ...updateData
        };

        const createValidation = this.validateFieldData(combinedData);
        validation.isValid = validation.isValid && createValidation.isValid;
        validation.errors.push(...createValidation.errors);
        validation.warnings.push(...createValidation.warnings);

        return validation;
    }

    /**
     * Export fields as JSON
     */
    async exportFields(templateId, options = {}) {
        try {
            if (!templateId) {
                throw new Error('Template ID is required');
            }

            const fields = await this.getFieldsByTemplate(templateId);
            
            const exportData = {
                templateId: templateId,
                fieldCount: fields.length,
                fields: fields.map(field => {
                    if (typeof fieldMapper.mapFieldForExport === 'function') {
                        return fieldMapper.mapFieldForExport(field);
                    }
                    // Fallback mapping
                    return {
                        id: field.id,
                        name: field.name,
                        type: field.type,
                        label: field.label,
                        x: field.x,
                        y: field.y,
                        width: field.width,
                        height: field.height,
                        properties: field.properties,
                        validation: field.validation,
                        value: field.value
                    };
                }),
                exportedAt: new Date(),
                version: '1.0.0',
                metadata: options.metadata || {}
            };

            return exportData;

        } catch (error) {
            throw new Error(`Failed to export fields: ${error.message}`);
        }
    }

    /**
     * Import fields from JSON
     */
    async importFields(importData, templateId) {
        try {
            if (!templateId) {
                throw new Error('Target template ID is required');
            }

            const validation = this.validateImportData(importData);
            if (!validation.isValid) {
                throw new Error(`Import validation failed: ${validation.errors.join(', ')}`);
            }

            const results = {
                imported: [],
                failed: [],
                totalCount: importData.fields.length
            };

            for (let i = 0; i < importData.fields.length; i++) {
                const fieldData = importData.fields[i];
                try {
                    let mappedField;
                    if (typeof fieldMapper.mapImportedField === 'function') {
                        mappedField = fieldMapper.mapImportedField(fieldData);
                    } else {
                        mappedField = { ...fieldData, templateId: templateId };
                    }
                    
                    const field = await this.createField(mappedField, templateId);
                    results.imported.push({
                        index: i,
                        field: field,
                        originalData: fieldData
                    });
                } catch (error) {
                    results.failed.push({
                        index: i,
                        fieldData: fieldData,
                        error: error.message
                    });
                }
            }

            return results;

        } catch (error) {
            throw new Error(`Failed to import fields: ${error.message}`);
        }
    }

    /**
     * Search fields
     */
    async searchFields(templateId, searchQuery, options = {}) {
        try {
            if (!templateId) {
                throw new Error('Template ID is required');
            }

            const { type, limit = 50, includeInactive = false } = options;
            
            let query = { templateId };
            if (!includeInactive) {
                query.active = true;
            }

            // Add search conditions
            if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim() !== '') {
                const searchRegex = new RegExp(searchQuery.trim(), 'i');
                query.$or = [
                    { name: searchRegex },
                    { label: searchRegex },
                    { value: searchRegex }
                ];
            }

            if (type && this.supportedFieldTypes.includes(type)) {
                query.type = type;
            }

            let mongooseQuery = Field.find(query);
            
            if (limit && limit > 0) {
                mongooseQuery = mongooseQuery.limit(limit);
            }

            mongooseQuery = mongooseQuery.sort({ name: 1 });

            const fields = await mongooseQuery.exec();
            return fields.map(field => this.formatFieldResponse(field));

        } catch (error) {
            throw new Error(`Failed to search fields: ${error.message}`);
        }
    }

    /**
     * Get field statistics
     */
    async getFieldStatistics(templateId) {
        try {
            if (!templateId) {
                throw new Error('Template ID is required');
            }

            const fields = await Field.find({ templateId, active: true });
            
            const stats = {
                totalFields: fields.length,
                fieldsByType: {},
                averagePosition: { x: 0, y: 0 },
                fieldSizes: { min: null, max: null, average: 0 },
                dataTypes: {},
                lastUpdated: null
            };

            if (fields.length === 0) {
                return stats;
            }

            // Count fields by type
            fields.forEach(field => {
                stats.fieldsByType[field.type] = (stats.fieldsByType[field.type] || 0) + 1;
                
                // Track data types for values
                const valueType = field.value !== null && field.value !== undefined ? typeof field.value : 'null';
                stats.dataTypes[valueType] = (stats.dataTypes[valueType] || 0) + 1;
            });

            // Calculate average position
            const totalX = fields.reduce((sum, field) => sum + (field.x || 0), 0);
            const totalY = fields.reduce((sum, field) => sum + (field.y || 0), 0);
            stats.averagePosition.x = totalX / fields.length;
            stats.averagePosition.y = totalY / fields.length;

            // Calculate field sizes
            const areas = fields.map(field => (field.width || 0) * (field.height || 0)).filter(area => area > 0);
            if (areas.length > 0) {
                stats.fieldSizes.min = Math.min(...areas);
                stats.fieldSizes.max = Math.max(...areas);
                stats.fieldSizes.average = areas.reduce((sum, area) => sum + area, 0) / areas.length;
            }

            // Get last updated timestamp
            const lastUpdatedField = fields.reduce((latest, field) => {
                return (!latest || field.updatedAt > latest.updatedAt) ? field : latest;
            }, null);
            
            stats.lastUpdated = lastUpdatedField ? lastUpdatedField.updatedAt : null;

            return stats;

        } catch (error) {
            throw new Error(`Failed to get field statistics: ${error.message}`);
        }
    }

    /**
     * Optimize field positions (prevent overlaps)
     */
    async optimizeFieldPositions(templateId, options = {}) {
        try {
            if (!templateId) {
                throw new Error('Template ID is required');
            }

            const fields = await this.getFieldsByTemplate(templateId);
            const { spacing = 10, sortBy = 'y', startX = 0, startY = 0 } = options;

            if (fields.length === 0) {
                return { success: true, message: 'No fields to optimize', optimizedCount: 0 };
            }

            // Sort fields by specified criteria
            const sortedFields = [...fields].sort((a, b) => {
                if (sortBy === 'y') return (a.y || 0) - (b.y || 0);
                if (sortBy === 'x') return (a.x || 0) - (b.x || 0);
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            const optimizedFields = [];
            let currentX = startX;
            let currentY = startY;

            for (const field of sortedFields) {
                const optimizedField = {
                    ...field,
                    x: currentX,
                    y: currentY
                };

                optimizedFields.push(optimizedField);
                
                // Update position for next field
                if (sortBy === 'x') {
                    currentX += (field.width || 100) + spacing;
                } else {
                    currentY += (field.height || 20) + spacing;
                }
            }

            // Update all fields with optimized positions
            const updates = optimizedFields.map(field => ({
                fieldId: field.id,
                updateData: { x: field.x, y: field.y }
            }));

            const batchResults = await this.batchUpdateFields(updates);

            return {
                success: batchResults.failed.length === 0,
                optimizedCount: batchResults.successful.length,
                failedCount: batchResults.failed.length,
                results: batchResults
            };

        } catch (error) {
            throw new Error(`Failed to optimize field positions: ${error.message}`);
        }
    }

    /**
     * Clone field to another template
     */
    async cloneFieldToTemplate(fieldId, targetTemplateId) {
        try {
            if (!fieldId || !targetTemplateId) {
                throw new Error('Field ID and target template ID are required');
            }

            const sourceField = await Field.findById(fieldId);
            if (!sourceField) {
                throw new Error('Source field not found');
            }

            const targetTemplate = await Template.findById(targetTemplateId);
            if (!targetTemplate) {
                throw new Error('Target template not found');
            }

            // Create clone data
            const cloneData = {
                ...sourceField.toObject(),
                id: undefined,
                _id: undefined,
                templateId: targetTemplateId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Remove MongoDB-specific fields
            delete cloneData.__v;

            return await this.createField(cloneData, targetTemplateId);

        } catch (error) {
            throw new Error(`Failed to clone field: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    getDefaultWidth(fieldType) {
        const widths = {
            text: 150, number: 100, email: 200, phone: 120, date: 120,
            url: 200, checkbox: 20, radio: 150, dropdown: 150,
            signature: 200, image: 100
        };
        return widths[fieldType] || 150;
    }

    getDefaultHeight(fieldType) {
        const heights = {
            text: 20, number: 20, email: 20, phone: 20, date: 20,
            url: 20, checkbox: 20, radio: 80, dropdown: 25,
            signature: 100, image: 100
        };
        return heights[fieldType] || 20;
    }

    getDefaultValue(fieldType) {
        const values = {
            checkbox: false,
            radio: null,
            dropdown: null,
            signature: null,
            image: null,
            text: '',
            number: 0,
            email: '',
            phone: '',
            date: new Date().toISOString().split('T')[0],
            url: ''
        };
        return values[fieldType] !== undefined ? values[fieldType] : '';
    }

    getTypeSpecificRules(fieldType) {
        const rules = {
            email: { pattern: validationUtils.patterns?.email?.source || /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
            phone: { pattern: validationUtils.patterns?.phone?.source || /^[\+]?[1-9][\d]{0,15}$/ },
            date: { pattern: validationUtils.patterns?.date?.source || /^\d{4}-\d{2}-\d{2}$/ },
            number: { pattern: validationUtils.patterns?.number?.source || /^-?\d+(\.\d+)?$/ },
            url: { pattern: validationUtils.patterns?.url?.source || /^https?:\/\/.+/ }
        };
        return rules[fieldType] || {};
    }

    validateImportData(importData) {
        const validation = { isValid: true, errors: [] };

        if (!importData || typeof importData !== 'object') {
            validation.isValid = false;
            validation.errors.push('Import data must be an object');
            return validation;
        }

        if (!importData.fields || !Array.isArray(importData.fields)) {
            validation.isValid = false;
            validation.errors.push('Invalid import data: fields array required');
        } else if (importData.fields.length === 0) {
            validation.isValid = false;
            validation.errors.push('Import data contains no fields');
        }

        return validation;
    }

    formatFieldResponse(field) {
        if (!field) return null;
        
        const fieldObj = field.toObject ? field.toObject() : field;
        
        return {
            id: fieldObj.id || fieldObj._id?.toString() || null,
            name: fieldObj.name || '',
            type: fieldObj.type || 'text',
            label: fieldObj.label || fieldObj.name || '',
            x: fieldObj.x || 0,
            y: fieldObj.y || 0,
            width: fieldObj.width || this.getDefaultWidth(fieldObj.type),
            height: fieldObj.height || this.getDefaultHeight(fieldObj.type),
            properties: fieldObj.properties || {},
            validation: fieldObj.validation || {},
            value: fieldObj.value !== undefined ? fieldObj.value : this.getDefaultValue(fieldObj.type),
            templateId: fieldObj.templateId || null,
            createdAt: fieldObj.createdAt || new Date(),
            updatedAt: fieldObj.updatedAt || new Date(),
            active: fieldObj.active !== undefined ? fieldObj.active : true
        };
    }
}

module.exports = new FieldService();