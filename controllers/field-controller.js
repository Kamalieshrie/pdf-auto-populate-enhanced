// server/controllers/field-controller.js - Field Management Controller
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const appConfig = require('../config/app-config');

class FieldController {
    constructor() {
        this.fieldTypes = appConfig.fields.types;
        this.maxCustomFields = appConfig.fields.maxCustomFields;
        this.defaultSizes = appConfig.fields.defaultSizes;
    }

    /**
     * Get available field types and their configurations
     */
    async getFieldTypes(req, res) {
        try {
            const fieldTypes = {
                basic: [
                    {
                        type: this.fieldTypes.TEXT,
                        name: 'Text Box',
                        icon: '📝',
                        description: 'Single or multi-line text input',
                        defaultSize: this.defaultSizes.text,
                        properties: ['label', 'value', 'placeholder', 'required', 'maxLength', 'fontSize']
                    },
                    {
                        type: this.fieldTypes.CHECKBOX,
                        name: 'Checkbox',
                        icon: '☑️',
                        description: 'Boolean checkbox input',
                        defaultSize: this.defaultSizes.checkbox,
                        properties: ['label', 'checked', 'required']
                    },
                    {
                        type: this.fieldTypes.DATE,
                        name: 'Date Field',
                        icon: '📅',
                        description: 'Date picker input',
                        defaultSize: this.defaultSizes.date,
                        properties: ['label', 'value', 'format', 'useCurrentDate', 'required']
                    },
                    {
                        type: this.fieldTypes.RADIO,
                        name: 'Radio Button',
                        icon: '🔘',
                        description: 'Single selection from options',
                        defaultSize: this.defaultSizes.radio,
                        properties: ['label', 'options', 'selected', 'required']
                    }
                ],
                special: [
                    {
                        type: this.fieldTypes.SIGNATURE,
                        name: 'Signature',
                        icon: '✍️',
                        description: 'Digital signature field',
                        defaultSize: this.defaultSizes.signature,
                        properties: ['label', 'required', 'backgroundColor', 'penColor']
                    },
                    {
                        type: this.fieldTypes.INITIALS,
                        name: 'Initials',
                        icon: '📝',
                        description: 'Initial signature field',
                        defaultSize: this.defaultSizes.initials,
                        properties: ['label', 'required', 'backgroundColor']
                    }
                ]
            };

            res.json({
                success: true,
                fieldTypes,
                maxCustomFields: this.maxCustomFields,
                canvasConfig: appConfig.canvas
            });

        } catch (error) {
            console.error('Error getting field types:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get field types: ' + error.message
            });
        }
    }

    /**
     * Validate custom field data
     */
    validateField(field) {
        const errors = [];

        // Required properties
        if (!field.id) field.id = uuidv4();
        if (!field.type || !Object.values(this.fieldTypes).includes(field.type)) {
            errors.push('Invalid or missing field type');
        }

        // Position validation
        if (typeof field.x !== 'number' || field.x < 0) {
            errors.push('Invalid x position');
        }
        if (typeof field.y !== 'number' || field.y < 0) {
            errors.push('Invalid y position');
        }

        // Size validation
        if (field.width && (typeof field.width !== 'number' || field.width < 10)) {
            errors.push('Invalid width (minimum 10px)');
        }
        if (field.height && (typeof field.height !== 'number' || field.height < 10)) {
            errors.push('Invalid height (minimum 10px)');
        }

        // Canvas bounds validation
        if (field.x > appConfig.canvas.maxWidth) {
            errors.push('Field x position exceeds canvas width');
        }
        if (field.y > appConfig.canvas.maxHeight) {
            errors.push('Field y position exceeds canvas height');
        }

        // Label validation
        if (field.label && field.label.length > appConfig.fields.maxLabelLength) {
            errors.push(`Label too long (max ${appConfig.fields.maxLabelLength} characters)`);
        }

        // Value validation
        if (field.value && field.value.length > appConfig.fields.maxValueLength) {
            errors.push(`Value too long (max ${appConfig.fields.maxValueLength} characters)`);
        }

        // Type-specific validation
        switch (field.type) {
            case this.fieldTypes.TEXT:
                if (field.fontSize && (field.fontSize < 8 || field.fontSize > 72)) {
                    errors.push('Font size must be between 8 and 72');
                }
                break;

            case this.fieldTypes.CHECKBOX:
                if (field.checked !== undefined && typeof field.checked !== 'boolean') {
                    errors.push('Checkbox checked value must be boolean');
                }
                break;

            case this.fieldTypes.DATE:
                if (field.format && !['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(field.format)) {
                    errors.push('Invalid date format');
                }
                break;

            case this.fieldTypes.RADIO:
                if (field.options && !Array.isArray(field.options)) {
                    errors.push('Radio options must be an array');
                }
                break;

            case this.fieldTypes.SIGNATURE:
                if (field.penColor && !/^#[0-9A-F]{6}$/i.test(field.penColor)) {
                    errors.push('Invalid pen color format (use hex: #000000)');
                }
                break;
        }

        return errors;
    }

    /**
     * Validate a collection of custom fields
     */
    async validateFields(req, res) {
        try {
            const { fields } = req.body;

            if (!Array.isArray(fields)) {
                return res.status(400).json({
                    success: false,
                    message: 'Fields must be an array'
                });
            }

            if (fields.length > this.maxCustomFields) {
                return res.status(400).json({
                    success: false,
                    message: `Too many fields (max ${this.maxCustomFields})`
                });
            }

            const validationResults = [];
            let hasErrors = false;

            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                const errors = this.validateField(field);
                
                validationResults.push({
                    index: i,
                    fieldId: field.id,
                    valid: errors.length === 0,
                    errors
                });

                if (errors.length > 0) {
                    hasErrors = true;
                }
            }

            res.json({
                success: !hasErrors,
                message: hasErrors ? 'Validation failed for some fields' : 'All fields valid',
                results: validationResults,
                totalFields: fields.length,
                validFields: validationResults.filter(r => r.valid).length
            });

        } catch (error) {
            console.error('Error validating fields:', error);
            res.status(500).json({
                success: false,
                message: 'Field validation error: ' + error.message
            });
        }
    }

    /**
     * Get property data mappings for field configuration
     */
    async getPropertyMappings(req, res) {
        try {
            const propertyData = appConfig.propertyData.default;
            const mappings = appConfig.propertyData.mappings;

            const availableMappings = Object.keys(propertyData).map(key => ({
                key,
                value: propertyData[key],
                type: typeof propertyData[key],
                label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                aliases: mappings[key] || []
            }));

            res.json({
                success: true,
                propertyData,
                mappings: availableMappings,
                totalFields: availableMappings.length
            });

        } catch (error) {
            console.error('Error getting property mappings:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get property mappings: ' + error.message
            });
        }
    }

    /**
     * Generate field configuration for PDF positioning
     */
    async generateFieldConfig(req, res) {
        try {
            const { fields, canvasWidth, canvasHeight, pdfDimensions } = req.body;

            if (!Array.isArray(fields)) {
                return res.status(400).json({
                    success: false,
                    message: 'Fields array required'
                });
            }

            const pdfWidth = pdfDimensions?.width || 612; // Default PDF width (8.5" at 72 DPI)
            const pdfHeight = pdfDimensions?.height || 792; // Default PDF height (11" at 72 DPI)
            const canvasW = canvasWidth || appConfig.canvas.maxWidth;
            const canvasH = canvasHeight || appConfig.canvas.maxHeight;

            const convertedFields = fields.map(field => {
                // Convert canvas coordinates to PDF coordinates
                const pdfX = (field.x / canvasW) * pdfWidth;
                const pdfY = pdfHeight - ((field.y / canvasH) * pdfHeight) - (field.height || this.defaultSizes[field.type]?.height || 20);

                return {
                    ...field,
                    pdfCoordinates: {
                        x: Math.max(0, Math.min(pdfX, pdfWidth)),
                        y: Math.max(0, Math.min(pdfY, pdfHeight))
                    },
                    canvasCoordinates: {
                        x: field.x,
                        y: field.y
                    }
                };
            });

            res.json({
                success: true,
                message: `Converted ${convertedFields.length} fields to PDF coordinates`,
                fields: convertedFields,
                dimensions: {
                    canvas: { width: canvasW, height: canvasH },
                    pdf: { width: pdfWidth, height: pdfHeight }
                }
            });

        } catch (error) {
            console.error('Error generating field config:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate field config: ' + error.message
            });
        }
    }

    /**
     * Create a new custom field with default properties
     */
    async createField(req, res) {
        try {
            const { type, x, y, label } = req.body;

            if (!type || !Object.values(this.fieldTypes).includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid field type required'
                });
            }

            const defaultSize = this.defaultSizes[type] || { width: 100, height: 20 };
            
            const newField = {
                id: uuidv4(),
                type,
                label: label || `New ${type} field`,
                x: x || 50,
                y: y || 50,
                width: defaultSize.width,
                height: defaultSize.height,
                required: false,
                created: new Date().toISOString()
            };

            // Add type-specific default properties
            switch (type) {
                case this.fieldTypes.TEXT:
                    newField.value = '';
                    newField.fontSize = 12;
                    newField.fontFamily = 'Helvetica';
                    newField.color = '#000000';
                    break;

                case this.fieldTypes.CHECKBOX:
                    newField.checked = false;
                    break;

                case this.fieldTypes.DATE:
                    newField.format = 'MM/DD/YYYY';
                    newField.useCurrentDate = false;
                    break;

                case this.fieldTypes.SIGNATURE:
                    newField.backgroundColor = 'transparent';
                    newField.penColor = '#000000';
                    newField.penWidth = 2;
                    break;

                case this.fieldTypes.INITIALS:
                    newField.backgroundColor = 'transparent';
                    break;

                case this.fieldTypes.RADIO:
                    newField.options = ['Option 1', 'Option 2'];
                    newField.selected = null;
                    break;
            }

            const validationErrors = this.validateField(newField);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Field validation failed',
                    errors: validationErrors
                });
            }

            res.json({
                success: true,
                message: `Created new ${type} field`,
                field: newField
            });

        } catch (error) {
            console.error('Error creating field:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create field: ' + error.message
            });
        }
    }

    /**
     * Update an existing field's properties
     */
    async updateField(req, res) {
        try {
            const { fieldId } = req.params;
            const updates = req.body;

            if (!fieldId) {
                return res.status(400).json({
                    success: false,
                    message: 'Field ID required'
                });
            }

            // Preserve the field ID
            updates.id = fieldId;
            updates.updated = new Date().toISOString();

            const validationErrors = this.validateField(updates);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Field validation failed',
                    errors: validationErrors
                });
            }

            res.json({
                success: true,
                message: 'Field updated successfully',
                field: updates
            });

        } catch (error) {
            console.error('Error updating field:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update field: ' + error.message
            });
        }
    }

    /**
     * Delete a field
     */
    async deleteField(req, res) {
        try {
            const { fieldId } = req.params;

            if (!fieldId) {
                return res.status(400).json({
                    success: false,
                    message: 'Field ID required'
                });
            }

            res.json({
                success: true,
                message: 'Field deleted successfully',
                fieldId
            });

        } catch (error) {
            console.error('Error deleting field:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete field: ' + error.message
            });
        }
    }

    /**
     * Duplicate an existing field
     */
    async duplicateField(req, res) {
        try {
            const { field } = req.body;

            if (!field || !field.type) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid field object required'
                });
            }

            const duplicatedField = {
                ...field,
                id: uuidv4(),
                label: (field.label || 'Field') + ' Copy',
                x: field.x + 20, // Offset copy position
                y: field.y + 20,
                created: new Date().toISOString()
            };

            const validationErrors = this.validateField(duplicatedField);
            if (validationErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Duplicated field validation failed',
                    errors: validationErrors
                });
            }

            res.json({
                success: true,
                message: 'Field duplicated successfully',
                field: duplicatedField
            });

        } catch (error) {
            console.error('Error duplicating field:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to duplicate field: ' + error.message
            });
        }
    }
}

module.exports = new FieldController();