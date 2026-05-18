/**
 * Field Mapper Utility
 * Handles mapping between different field types, coordinate systems, and data formats
 */

class FieldMapper {
    constructor() {
        this.fieldTypeMap = {
            'text': 'PDFTextField',
            'number': 'PDFTextField',
            'email': 'PDFTextField',
            'phone': 'PDFTextField',
            'date': 'PDFTextField',
            'checkbox': 'PDFCheckBox',
            'radio': 'PDFRadioGroup',
            'dropdown': 'PDFDropdown',
            'signature': 'PDFSignature',
            'image': 'PDFImage'
        };

        this.validationPatterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^[\+]?[1-9][\d]{0,15}$/,
            date: /^\d{4}-\d{2}-\d{2}$/,
            number: /^-?\d+(\.\d+)?$/
        };

        this.defaultProperties = {
            text: { multiline: false, maxLength: 255, fontSize: 12 },
            number: { min: null, max: null, step: 1, fontSize: 12 },
            email: { maxLength: 255, fontSize: 12 },
            phone: { maxLength: 20, fontSize: 12 },
            date: { format: 'YYYY-MM-DD', fontSize: 12 },
            checkbox: { checked: false },
            radio: { options: [], selected: null },
            dropdown: { options: [], selected: null, editable: false },
            signature: { width: 200, height: 100 },
            image: { width: 100, height: 100, aspectRatio: true }
        };
    }

    /**
     * Map frontend field to PDF field format
     */
    mapFieldToPDF(field) {
        const pdfField = {
            name: field.name || `field_${Date.now()}`,
            type: this.fieldTypeMap[field.type] || 'PDFTextField',
            x: this.convertCoordinate(field.x, 'toPDF'),
            y: this.convertCoordinate(field.y, 'toPDF'),
            width: field.width || 100,
            height: field.height || 20,
            properties: this.mergeProperties(field.type, field.properties || {})
        };

        // Add type-specific properties
        switch (field.type) {
            case 'text':
            case 'number':
            case 'email':
            case 'phone':
            case 'date':
                pdfField.value = field.value || '';
                pdfField.fontSize = field.properties?.fontSize || 12;
                pdfField.fontColor = field.properties?.fontColor || '#000000';
                pdfField.backgroundColor = field.properties?.backgroundColor || 'transparent';
                break;

            case 'checkbox':
                pdfField.checked = field.checked || false;
                pdfField.checkType = field.properties?.checkType || 'check';
                break;

            case 'radio':
                pdfField.options = field.options || [];
                pdfField.selected = field.selected || null;
                pdfField.layout = field.properties?.layout || 'vertical';
                break;

            case 'dropdown':
                pdfField.options = field.options || [];
                pdfField.selected = field.selected || null;
                pdfField.editable = field.properties?.editable || false;
                break;

            case 'signature':
                pdfField.signatureData = field.signatureData || null;
                pdfField.signatureType = field.properties?.signatureType || 'draw';
                break;

            case 'image':
                pdfField.imageData = field.imageData || null;
                pdfField.imageFormat = field.properties?.imageFormat || 'png';
                pdfField.aspectRatio = field.properties?.aspectRatio !== false;
                break;
        }

        return pdfField;
    }

    /**
     * Map PDF field to frontend format
     */
    mapPDFToField(pdfField) {
        const fieldType = this.getFieldTypeFromPDF(pdfField.type);
        
        const field = {
            id: pdfField.id || `field_${Date.now()}`,
            name: pdfField.name,
            type: fieldType,
            x: this.convertCoordinate(pdfField.x, 'fromPDF'),
            y: this.convertCoordinate(pdfField.y, 'fromPDF'),
            width: pdfField.width,
            height: pdfField.height,
            properties: this.extractProperties(fieldType, pdfField)
        };

        // Add type-specific data
        switch (fieldType) {
            case 'text':
            case 'number':
            case 'email':
            case 'phone':
            case 'date':
                field.value = pdfField.value || '';
                break;

            case 'checkbox':
                field.checked = pdfField.checked || false;
                break;

            case 'radio':
            case 'dropdown':
                field.options = pdfField.options || [];
                field.selected = pdfField.selected || null;
                break;

            case 'signature':
                field.signatureData = pdfField.signatureData || null;
                break;

            case 'image':
                field.imageData = pdfField.imageData || null;
                break;
        }

        return field;
    }

    /**
     * Convert coordinates between different coordinate systems
     */
    convertCoordinate(value, direction, pageHeight = 792) {
        if (direction === 'toPDF') {
            // Convert from screen coordinates (top-left origin) to PDF coordinates (bottom-left origin)
            return pageHeight - value;
        } else {
            // Convert from PDF coordinates to screen coordinates
            return pageHeight - value;
        }
    }

    /**
     * Map database field to frontend format
     */
    mapDatabaseToField(dbField) {
        return {
            id: dbField._id || dbField.id,
            name: dbField.name,
            type: dbField.type,
            x: dbField.coordinates?.x || 0,
            y: dbField.coordinates?.y || 0,
            width: dbField.dimensions?.width || 100,
            height: dbField.dimensions?.height || 20,
            value: dbField.value || '',
            properties: dbField.properties || {},
            validation: dbField.validation || {},
            createdAt: dbField.createdAt,
            updatedAt: dbField.updatedAt
        };
    }

    /**
     * Map frontend field to database format
     */
    mapFieldToDatabase(field) {
        return {
            name: field.name,
            type: field.type,
            coordinates: {
                x: field.x,
                y: field.y
            },
            dimensions: {
                width: field.width,
                height: field.height
            },
            value: field.value || '',
            properties: field.properties || {},
            validation: this.generateValidation(field),
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Map template data for export/import
     */
    mapTemplateForExport(template) {
        return {
            id: template.id,
            name: template.name,
            description: template.description,
            version: template.version || '1.0.0',
            fields: template.fields.map(field => this.mapFieldForExport(field)),
            metadata: {
                createdAt: template.createdAt,
                updatedAt: template.updatedAt,
                author: template.author,
                category: template.category
            },
            settings: template.settings || {}
        };
    }

    /**
     * Map field for export
     */
    mapFieldForExport(field) {
        return {
            name: field.name,
            type: field.type,
            position: { x: field.x, y: field.y },
            size: { width: field.width, height: field.height },
            properties: field.properties,
            validation: field.validation,
            defaultValue: field.value
        };
    }

    /**
     * Map imported template data
     */
    mapImportedTemplate(importData) {
        return {
            name: importData.name,
            description: importData.description,
            version: importData.version || '1.0.0',
            fields: importData.fields.map(field => this.mapImportedField(field)),
            settings: importData.settings || {},
            imported: true,
            importedAt: new Date()
        };
    }

    /**
     * Map imported field data
     */
    mapImportedField(fieldData) {
        return {
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: fieldData.name,
            type: fieldData.type,
            x: fieldData.position?.x || 0,
            y: fieldData.position?.y || 0,
            width: fieldData.size?.width || 100,
            height: fieldData.size?.height || 20,
            properties: fieldData.properties || this.defaultProperties[fieldData.type] || {},
            validation: fieldData.validation || {},
            value: fieldData.defaultValue || ''
        };
    }

    /**
     * Merge properties with defaults
     */
    mergeProperties(fieldType, properties) {
        const defaults = this.defaultProperties[fieldType] || {};
        return { ...defaults, ...properties };
    }

    /**
     * Extract properties from PDF field
     */
    extractProperties(fieldType, pdfField) {
        const properties = {};

        switch (fieldType) {
            case 'text':
            case 'number':
            case 'email':
            case 'phone':
            case 'date':
                if (pdfField.fontSize) properties.fontSize = pdfField.fontSize;
                if (pdfField.fontColor) properties.fontColor = pdfField.fontColor;
                if (pdfField.backgroundColor) properties.backgroundColor = pdfField.backgroundColor;
                if (pdfField.maxLength) properties.maxLength = pdfField.maxLength;
                break;

            case 'checkbox':
                if (pdfField.checkType) properties.checkType = pdfField.checkType;
                break;

            case 'radio':
                if (pdfField.layout) properties.layout = pdfField.layout;
                break;

            case 'dropdown':
                if (typeof pdfField.editable === 'boolean') properties.editable = pdfField.editable;
                break;

            case 'signature':
                if (pdfField.signatureType) properties.signatureType = pdfField.signatureType;
                break;

            case 'image':
                if (pdfField.imageFormat) properties.imageFormat = pdfField.imageFormat;
                if (typeof pdfField.aspectRatio === 'boolean') properties.aspectRatio = pdfField.aspectRatio;
                break;
        }

        return properties;
    }

    /**
     * Generate validation rules for field
     */
    generateValidation(field) {
        const validation = { ...field.validation };

        // Add default validation based on field type
        switch (field.type) {
            case 'email':
                validation.pattern = this.validationPatterns.email.source;
                validation.message = 'Please enter a valid email address';
                break;

            case 'phone':
                validation.pattern = this.validationPatterns.phone.source;
                validation.message = 'Please enter a valid phone number';
                break;

            case 'date':
                validation.pattern = this.validationPatterns.date.source;
                validation.message = 'Please enter a valid date (YYYY-MM-DD)';
                break;

            case 'number':
                validation.pattern = this.validationPatterns.number.source;
                validation.message = 'Please enter a valid number';
                break;
        }

        // Add required validation if specified
        if (field.properties?.required) {
            validation.required = true;
            validation.requiredMessage = `${field.name} is required`;
        }

        return validation;
    }

    /**
     * Get field type from PDF type
     */
    getFieldTypeFromPDF(pdfType) {
        for (const [fieldType, mappedType] of Object.entries(this.fieldTypeMap)) {
            if (mappedType === pdfType) {
                return fieldType;
            }
        }
        return 'text'; // default fallback
    }

    /**
     * Validate field mapping
     */
    validateFieldMapping(field) {
        const errors = [];

        if (!field.name) {
            errors.push('Field name is required');
        }

        if (!field.type || !this.fieldTypeMap[field.type]) {
            errors.push('Invalid field type');
        }

        if (typeof field.x !== 'number' || typeof field.y !== 'number') {
            errors.push('Invalid field coordinates');
        }

        if (typeof field.width !== 'number' || typeof field.height !== 'number') {
            errors.push('Invalid field dimensions');
        }

        // Type-specific validation
        if (field.type === 'email' && field.value && !this.validationPatterns.email.test(field.value)) {
            errors.push('Invalid email format');
        }

        if (field.type === 'phone' && field.value && !this.validationPatterns.phone.test(field.value)) {
            errors.push('Invalid phone format');
        }

        if (field.type === 'number' && field.value && !this.validationPatterns.number.test(field.value)) {
            errors.push('Invalid number format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Transform coordinates for different PDF page orientations
     */
    transformCoordinatesForOrientation(x, y, width, height, orientation = 'portrait', pageWidth = 612, pageHeight = 792) {
        switch (orientation) {
            case 'landscape':
                return {
                    x: y,
                    y: pageWidth - x - width,
                    width: height,
                    height: width
                };
            case 'portrait':
            default:
                return { x, y, width, height };
        }
    }

    /**
     * Scale coordinates for different PDF page sizes
     */
    scaleCoordinates(field, fromSize, toSize) {
        const scaleX = toSize.width / fromSize.width;
        const scaleY = toSize.height / fromSize.height;

        return {
            ...field,
            x: field.x * scaleX,
            y: field.y * scaleY,
            width: field.width * scaleX,
            height: field.height * scaleY
        };
    }
}

module.exports = new FieldMapper();