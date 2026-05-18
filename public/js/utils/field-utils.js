// public/js/utils/field-utils.js - Field Utility Functions

class FieldUtils {
    // Field type definitions and metadata
    static fieldTypes = {
        text: {
            name: 'Text Field',
            description: 'Single line text input',
            icon: 'type',
            category: 'basic',
            defaultWidth: 120,
            defaultHeight: 30,
            properties: ['name', 'defaultValue', 'placeholder', 'maxLength', 'required', 'readonly'],
            validation: ['required', 'minLength', 'maxLength', 'pattern']
        },
        textarea: {
            name: 'Text Area',
            description: 'Multi-line text input',
            icon: 'file-text',
            category: 'basic',
            defaultWidth: 200,
            defaultHeight: 80,
            properties: ['name', 'defaultValue', 'placeholder', 'maxLength', 'rows', 'cols', 'required', 'readonly'],
            validation: ['required', 'minLength', 'maxLength']
        },
        date: {
            name: 'Date Field',
            description: 'Date picker input',
            icon: 'calendar',
            category: 'basic',
            defaultWidth: 120,
            defaultHeight: 30,
            properties: ['name', 'defaultValue', 'min', 'max', 'required', 'readonly'],
            validation: ['required', 'dateRange']
        },
        checkbox: {
            name: 'Checkbox',
            description: 'Yes/No selection',
            icon: 'check-square',
            category: 'choice',
            defaultWidth: 20,
            defaultHeight: 20,
            properties: ['name', 'defaultValue', 'label', 'required'],
            validation: ['required']
        },
        radio: {
            name: 'Radio Button',
            description: 'Single choice selection',
            icon: 'radio',
            category: 'choice',
            defaultWidth: 20,
            defaultHeight: 20,
            properties: ['name', 'defaultValue', 'options', 'required'],
            validation: ['required']
        },
        dropdown: {
            name: 'Dropdown',
            description: 'Select from list',
            icon: 'chevron-down',
            category: 'choice',
            defaultWidth: 150,
            defaultHeight: 30,
            properties: ['name', 'defaultValue', 'options', 'multiple', 'required'],
            validation: ['required']
        },
        signature: {
            name: 'Signature',
            description: 'Digital signature pad',
            icon: 'edit',
            category: 'signature',
            defaultWidth: 200,
            defaultHeight: 60,
            properties: ['name', 'required'],
            validation: ['required']
        },
        initial: {
            name: 'Initial',
            description: 'User initials',
            icon: 'user',
            category: 'signature',
            defaultWidth: 50,
            defaultHeight: 50,
            properties: ['name', 'required'],
            validation: ['required']
        }
    };

    // Get field type metadata
    static getFieldType(type) {
        return this.fieldTypes[type] || null;
    }

    static getAllFieldTypes() {
        return Object.keys(this.fieldTypes).map(type => ({
            type,
            ...this.fieldTypes[type]
        }));
    }

    static getFieldTypesByCategory(category) {
        return Object.entries(this.fieldTypes)
            .filter(([_, config]) => config.category === category)
            .map(([type, config]) => ({ type, ...config }));
    }

    // Field creation and configuration
    static createField(type, x, y, properties = {}) {
        const typeConfig = this.getFieldType(type);
        if (!typeConfig) {
            throw new Error(`Unknown field type: ${type}`);
        }

        const fieldId = properties.id || this.generateFieldId();
        
        return {
            id: fieldId,
            type: type,
            name: properties.name || `${type}_${fieldId.split('-')[1]}`,
            x: x,
            y: y,
            width: properties.width || typeConfig.defaultWidth,
            height: properties.height || typeConfig.defaultHeight,
            defaultValue: properties.defaultValue || '',
            value: properties.value || '',
            required: properties.required || false,
            readonly: properties.readonly || false,
            placeholder: properties.placeholder || '',
            options: properties.options || [],
            validation: properties.validation || {},
            style: properties.style || {},
            data: properties.data || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...this.getTypeSpecificDefaults(type, properties)
        };
    }

    static getTypeSpecificDefaults(type, properties = {}) {
        const defaults = {};
        
        switch (type) {
            case 'textarea':
                defaults.rows = properties.rows || 4;
                defaults.cols = properties.cols || 40;
                defaults.resize = properties.resize || 'vertical';
                break;
                
            case 'date':
                defaults.format = properties.format || 'YYYY-MM-DD';
                defaults.min = properties.min || null;
                defaults.max = properties.max || null;
                break;
                
            case 'checkbox':
                defaults.label = properties.label || 'Check me';
                defaults.checked = properties.checked || false;
                break;
                
            case 'radio':
                defaults.groupName = properties.groupName || `radio_group_${Date.now()}`;
                defaults.options = properties.options || ['Option 1', 'Option 2'];
                break;
                
            case 'dropdown':
                defaults.multiple = properties.multiple || false;
                defaults.options = properties.options || ['Option 1', 'Option 2', 'Option 3'];
                break;
                
            case 'signature':
                defaults.strokeWidth = properties.strokeWidth || 2;
                defaults.strokeColor = properties.strokeColor || '#000000';
                defaults.backgroundColor = properties.backgroundColor || 'transparent';
                break;
                
            case 'initial':
                defaults.fontSize = properties.fontSize || 16;
                defaults.fontFamily = properties.fontFamily || 'Arial, sans-serif';
                defaults.textAlign = properties.textAlign || 'center';
                break;
        }
        
        return defaults;
    }

    // Field validation
    static validateField(field, value = null) {
        const fieldValue = value !== null ? value : (field.value || field.defaultValue);
        const errors = [];
        const typeConfig = this.getFieldType(field.type);

        // Required validation
        if (field.required && this.isEmpty(fieldValue, field.type)) {
            errors.push({
                type: 'required',
                message: `${field.name} is required`
            });
        }

        // Type-specific validation
        if (!this.isEmpty(fieldValue, field.type)) {
            switch (field.type) {
                case 'text':
                    errors.push(...this.validateText(field, fieldValue));
                    break;
                case 'textarea':
                    errors.push(...this.validateTextarea(field, fieldValue));
                    break;
                case 'date':
                    errors.push(...this.validateDate(field, fieldValue));
                    break;
                case 'checkbox':
                    errors.push(...this.validateCheckbox(field, fieldValue));
                    break;
                case 'radio':
                    errors.push(...this.validateRadio(field, fieldValue));
                    break;
                case 'dropdown':
                    errors.push(...this.validateDropdown(field, fieldValue));
                    break;
                case 'signature':
                    errors.push(...this.validateSignature(field, fieldValue));
                    break;
                case 'initial':
                    errors.push(...this.validateInitial(field, fieldValue));
                    break;
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    static isEmpty(value, type) {
        switch (type) {
            case 'checkbox':
                return !value;
            case 'signature':
            case 'initial':
                return !value || value.length === 0;
            default:
                return !value || value.toString().trim() === '';
        }
    }

    static validateText(field, value) {
        const errors = [];
        const stringValue = value.toString();

        if (field.validation) {
            if (field.validation.minLength && stringValue.length < field.validation.minLength) {
                errors.push({
                    type: 'minLength',
                    message: `${field.name} must be at least ${field.validation.minLength} characters`
                });
            }

            if (field.validation.maxLength && stringValue.length > field.validation.maxLength) {
                errors.push({
                    type: 'maxLength',
                    message: `${field.name} must not exceed ${field.validation.maxLength} characters`
                });
            }

            if (field.validation.pattern) {
                const regex = new RegExp(field.validation.pattern);
                if (!regex.test(stringValue)) {
                    errors.push({
                        type: 'pattern',
                        message: `${field.name} format is invalid`
                    });
                }
            }
        }

        return errors;
    }

    static validateTextarea(field, value) {
        return this.validateText(field, value); // Same validation as text
    }

    static validateDate(field, value) {
        const errors = [];
        const date = new Date(value);

        if (isNaN(date.getTime())) {
            errors.push({
                type: 'invalidDate',
                message: `${field.name} must be a valid date`
            });
            return errors;
        }

        if (field.min && date < new Date(field.min)) {
            errors.push({
                type: 'dateMin',
                message: `${field.name} must be after ${field.min}`
            });
        }

        if (field.max && date > new Date(field.max)) {
            errors.push({
                type: 'dateMax',
                message: `${field.name} must be before ${field.max}`
            });
        }

        return errors;
    }

    static validateCheckbox(field, value) {
        // Checkbox validation is mainly just required check
        return [];
    }

    static validateRadio(field, value) {
        const errors = [];

        if (field.options && !field.options.includes(value)) {
            errors.push({
                type: 'invalidOption',
                message: `${field.name} has an invalid selection`
            });
        }

        return errors;
    }

    static validateDropdown(field, value) {
        const errors = [];
        const values = Array.isArray(value) ? value : [value];

        if (field.options) {
            const invalidValues = values.filter(v => !field.options.includes(v));
            if (invalidValues.length > 0) {
                errors.push({
                    type: 'invalidOption',
                    message: `${field.name} has invalid selections: ${invalidValues.join(', ')}`
                });
            }
        }

        return errors;
    }

    static validateSignature(field, value) {
        const errors = [];

        // Basic signature validation - check if it exists and has content
        if (value && typeof value === 'string' && value.startsWith('data:image/')) {
            // Valid data URL signature
        } else if (value && Array.isArray(value) && value.length > 0) {
            // Valid signature path data
        } else {
            errors.push({
                type: 'invalidSignature',
                message: `${field.name} signature is invalid`
            });
        }

        return errors;
    }

    static validateInitial(field, value) {
        const errors = [];
        const stringValue = value.toString().trim();

        if (stringValue.length > 3) {
            errors.push({
                type: 'tooLong',
                message: `${field.name} should be 1-3 characters only`
            });
        }

        return errors;
    }

    // Field manipulation utilities
    static cloneField(field, offsetX = 20, offsetY = 20) {
        const cloned = { ...field };
        cloned.id = this.generateFieldId();
        cloned.name = `${field.name}_copy`;
        cloned.x = field.x + offsetX;
        cloned.y = field.y + offsetY;
        cloned.createdAt = new Date().toISOString();
        cloned.updatedAt = new Date().toISOString();
        return cloned;
    }

    static updateField(field, updates) {
        const updated = { ...field, ...updates };
        updated.updatedAt = new Date().toISOString();
        return updated;
    }

    static moveField(field, deltaX, deltaY) {
        return this.updateField(field, {
            x: field.x + deltaX,
            y: field.y + deltaY
        });
    }

    static resizeField(field, newWidth, newHeight) {
        return this.updateField(field, {
            width: Math.max(10, newWidth),
            height: Math.max(10, newHeight)
        });
    }

    static setFieldValue(field, value) {
        return this.updateField(field, { value });
    }

    // Field positioning and alignment
    static alignFields(fields, alignment) {
        if (!fields || fields.length < 2) return fields;

        const updated = [...fields];

        switch (alignment) {
            case 'left':
                const leftX = Math.min(...fields.map(f => f.x));
                updated.forEach(field => { field.x = leftX; });
                break;

            case 'right':
                const rightX = Math.max(...fields.map(f => f.x + f.width));
                updated.forEach(field => { field.x = rightX - field.width; });
                break;

            case 'center-horizontal':
                const centerX = fields.reduce((sum, f) => sum + f.x + f.width / 2, 0) / fields.length;
                updated.forEach(field => { field.x = centerX - field.width / 2; });
                break;

            case 'top':
                const topY = Math.min(...fields.map(f => f.y));
                updated.forEach(field => { field.y = topY; });
                break;

            case 'bottom':
                const bottomY = Math.max(...fields.map(f => f.y + f.height));
                updated.forEach(field => { field.y = bottomY - field.height; });
                break;

            case 'center-vertical':
                const centerY = fields.reduce((sum, f) => sum + f.y + f.height / 2, 0) / fields.length;
                updated.forEach(field => { field.y = centerY - field.height / 2; });
                break;
        }

        return updated;
    }

    static distributeFields(fields, direction) {
        if (!fields || fields.length < 3) return fields;

        const sorted = [...fields].sort((a, b) => {
            return direction === 'horizontal' ? a.x - b.x : a.y - b.y;
        });

        if (direction === 'horizontal') {
            const totalWidth = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width - sorted[0].x;
            const availableSpace = totalWidth - sorted.reduce((sum, f) => sum + f.width, 0);
            const spacing = availableSpace / (sorted.length - 1);

            let currentX = sorted[0].x;
            sorted.forEach((field, index) => {
                if (index > 0) {
                    field.x = currentX;
                }
                currentX = field.x + field.width + spacing;
            });
        } else {
            const totalHeight = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height - sorted[0].y;
            const availableSpace = totalHeight - sorted.reduce((sum, f) => sum + f.height, 0);
            const spacing = availableSpace / (sorted.length - 1);

            let currentY = sorted[0].y;
            sorted.forEach((field, index) => {
                if (index > 0) {
                    field.y = currentY;
                }
                currentY = field.y + field.height + spacing;
            });
        }

        return fields;
    }

    // Field export/import utilities
    static serializeField(field) {
        return JSON.stringify(field, null, 2);
    }

    static deserializeField(json) {
        try {
            const field = JSON.parse(json);
            return this.validateFieldStructure(field) ? field : null;
        } catch (error) {
            console.error('Failed to deserialize field:', error);
            return null;
        }
    }

    static exportFields(fields, format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(fields, null, 2);
            case 'csv':
                return this.fieldsToCSV(fields);
            case 'xml':
                return this.fieldsToXML(fields);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    static fieldsToCSV(fields) {
        if (!fields || fields.length === 0) return '';

        const headers = ['id', 'type', 'name', 'x', 'y', 'width', 'height', 'defaultValue', 'required', 'readonly'];
        const rows = fields.map(field => 
            headers.map(header => {
                const value = field[header];
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            }).join(',')
        );

        return [headers.join(','), ...rows].join('\n');
    }

    static fieldsToXML(fields) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<fields>\n';
        
        fields.forEach(field => {
            xml += '  <field>\n';
            Object.entries(field).forEach(([key, value]) => {
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                xml += `    <${key}>${this.escapeXML(value.toString())}</${key}>\n`;
            });
            xml += '  </field>\n';
        });
        
        xml += '</fields>';
        return xml;
    }

    static escapeXML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Field search and filtering
    static findFieldById(fields, id) {
        return fields.find(field => field.id === id);
    }

    static findFieldsByType(fields, type) {
        return fields.filter(field => field.type === type);
    }

    static findFieldsByName(fields, name, exact = false) {
        if (exact) {
            return fields.filter(field => field.name === name);
        }
        const searchTerm = name.toLowerCase();
        return fields.filter(field => 
            field.name.toLowerCase().includes(searchTerm)
        );
    }

    static findFieldsInArea(fields, x, y, width, height) {
        return fields.filter(field => 
            field.x >= x && 
            field.y >= y && 
            field.x + field.width <= x + width &&
            field.y + field.height <= y + height
        );
    }

    static findFieldsAtPosition(fields, x, y) {
        return fields.filter(field =>
            x >= field.x &&
            x <= field.x + field.width &&
            y >= field.y &&
            y <= field.y + field.height
        );
    }

    static filterFieldsByCategory(fields, category) {
        return fields.filter(field => {
            const typeConfig = this.getFieldType(field.type);
            return typeConfig && typeConfig.category === category;
        });
    }

    // Field collision and overlap detection
    static checkFieldCollision(field1, field2, tolerance = 0) {
        return !(
            field1.x + field1.width + tolerance < field2.x ||
            field2.x + field2.width + tolerance < field1.x ||
            field1.y + field1.height + tolerance < field2.y ||
            field2.y + field2.height + tolerance < field1.y
        );
    }

    static findOverlappingFields(fields, targetField) {
        return fields.filter(field => 
            field.id !== targetField.id && 
            this.checkFieldCollision(field, targetField)
        );
    }

    static resolveFieldOverlaps(fields, spacing = 10) {
        const resolved = [...fields];
        
        resolved.forEach((field, index) => {
            const overlapping = this.findOverlappingFields(resolved, field);
            
            if (overlapping.length > 0) {
                // Simple resolution: move field to the right and down
                let newX = field.x;
                let newY = field.y;
                
                overlapping.forEach(other => {
                    if (this.checkFieldCollision(field, other)) {
                        newX = Math.max(newX, other.x + other.width + spacing);
                        newY = Math.max(newY, other.y + other.height + spacing);
                    }
                });
                
                field.x = newX;
                field.y = newY;
            }
        });
        
        return resolved;
    }

    // Field statistics and analysis
    static getFieldStatistics(fields) {
        const stats = {
            total: fields.length,
            byType: {},
            byCategory: {},
            required: 0,
            readonly: 0,
            withValidation: 0,
            averageSize: { width: 0, height: 0 },
            bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
        };

        if (fields.length === 0) return stats;

        // Initialize bounds
        stats.bounds.minX = Math.min(...fields.map(f => f.x));
        stats.bounds.minY = Math.min(...fields.map(f => f.y));
        stats.bounds.maxX = Math.max(...fields.map(f => f.x + f.width));
        stats.bounds.maxY = Math.max(...fields.map(f => f.y + f.height));

        // Calculate statistics
        let totalWidth = 0;
        let totalHeight = 0;

        fields.forEach(field => {
            // Count by type
            stats.byType[field.type] = (stats.byType[field.type] || 0) + 1;

            // Count by category
            const typeConfig = this.getFieldType(field.type);
            if (typeConfig) {
                const category = typeConfig.category;
                stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            }

            // Count properties
            if (field.required) stats.required++;
            if (field.readonly) stats.readonly++;
            if (field.validation && Object.keys(field.validation).length > 0) {
                stats.withValidation++;
            }

            // Sum dimensions
            totalWidth += field.width;
            totalHeight += field.height;
        });

        // Calculate averages
        stats.averageSize.width = totalWidth / fields.length;
        stats.averageSize.height = totalHeight / fields.length;

        return stats;
    }

    // Field templates and presets
    static createFieldTemplate(name, fields, metadata = {}) {
        return {
            name,
            fields: fields.map(field => ({ ...field })), // Deep copy
            metadata: {
                description: metadata.description || '',
                category: metadata.category || 'custom',
                tags: metadata.tags || [],
                createdAt: new Date().toISOString(),
                ...metadata
            }
        };
    }

    static applyFieldTemplate(template, offsetX = 0, offsetY = 0) {
        return template.fields.map(field => ({
            ...field,
            id: this.generateFieldId(),
            x: field.x + offsetX,
            y: field.y + offsetY,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));
    }

    static getCommonFieldPresets() {
        return {
            personalInfo: [
                this.createField('text', 50, 50, { name: 'firstName', placeholder: 'First Name', required: true }),
                this.createField('text', 200, 50, { name: 'lastName', placeholder: 'Last Name', required: true }),
                this.createField('text', 50, 100, { name: 'email', placeholder: 'Email Address', required: true }),
                this.createField('text', 200, 100, { name: 'phone', placeholder: 'Phone Number' }),
                this.createField('textarea', 50, 150, { name: 'address', placeholder: 'Address', width: 250, height: 60 })
            ],
            
            signature: [
                this.createField('signature', 50, 50, { name: 'signature', width: 200, height: 60 }),
                this.createField('text', 50, 120, { name: 'signedBy', placeholder: 'Print Name' }),
                this.createField('date', 200, 120, { name: 'signedDate', defaultValue: new Date().toISOString().split('T')[0] })
            ],
            
            agreement: [
                this.createField('checkbox', 50, 50, { name: 'terms', label: 'I agree to the terms and conditions', required: true }),
                this.createField('checkbox', 50, 80, { name: 'newsletter', label: 'Subscribe to newsletter' }),
                this.createField('checkbox', 50, 110, { name: 'privacy', label: 'I accept the privacy policy', required: true })
            ]
        };
    }

    // Utility functions
    static generateFieldId() {
        return `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static validateFieldStructure(field) {
        const requiredProperties = ['id', 'type', 'name', 'x', 'y', 'width', 'height'];
        return requiredProperties.every(prop => field.hasOwnProperty(prop)) &&
               this.fieldTypes.hasOwnProperty(field.type);
    }

    static sanitizeFieldName(name) {
        return name
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[0-9]/, '_')
            .toLowerCase();
    }

    static findFieldById(fields, id) {
        return fields.find(field => field.id === id);
    }

    static formatFieldValue(field, value) {
        if (value === null || value === undefined) return '';

        switch (field.type) {
            case 'date':
                try {
                    const date = new Date(value);
                    return date.toISOString().split('T')[0];
                } catch {
                    return value;
                }

            case 'checkbox':
                return Boolean(value);

            case 'dropdown':
                return Array.isArray(value) ? value : [value];

            case 'signature':
            case 'initial':
                return value; // Keep as-is for signature data

            default:
                return value.toString();
        }
    }

    static getFieldDisplayValue(field) {
        const value = field.value || field.defaultValue;
        
        if (!value) {
            return field.placeholder || `[${field.name}]`;
        }

        switch (field.type) {
            case 'checkbox':
                return value ? '✓' : '☐';

            case 'dropdown':
                if (Array.isArray(value)) {
                    return value.join(', ');
                }
                return value;

            case 'signature':
                return '[Signature]';

            case 'initial':
                return value.toString().substring(0, 3).toUpperCase();

            default:
                return value.toString();
        }
    }

    static calculateFieldBounds(fields) {
        if (!fields || fields.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        const bounds = {
            minX: Math.min(...fields.map(f => f.x)),
            minY: Math.min(...fields.map(f => f.y)),
            maxX: Math.max(...fields.map(f => f.x + f.width)),
            maxY: Math.max(...fields.map(f => f.y + f.height))
        };

        return {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY
        };
    }

    static snapFieldToGrid(field, gridSize = 10) {
        return this.updateField(field, {
            x: Math.round(field.x / gridSize) * gridSize,
            y: Math.round(field.y / gridSize) * gridSize,
            width: Math.max(gridSize, Math.round(field.width / gridSize) * gridSize),
            height: Math.max(gridSize, Math.round(field.height / gridSize) * gridSize)
        });
    }

    static constrainFieldToContainer(field, containerWidth, containerHeight) {
        const constrainedField = { ...field };
        
        // Ensure field doesn't go outside container bounds
        constrainedField.x = Math.max(0, Math.min(field.x, containerWidth - field.width));
        constrainedField.y = Math.max(0, Math.min(field.y, containerHeight - field.height));
        
        // Ensure field isn't larger than container
        constrainedField.width = Math.min(field.width, containerWidth - constrainedField.x);
        constrainedField.height = Math.min(field.height, containerHeight - constrainedField.y);
        
        return constrainedField;
    }

    // Field data mapping utilities
    static mapDataToFields(fields, data) {
        return fields.map(field => {
            const mappedValue = this.getNestedProperty(data, field.name);
            if (mappedValue !== undefined) {
                return this.setFieldValue(field, mappedValue);
            }
            return field;
        });
    }

    static extractDataFromFields(fields) {
        const data = {};
        fields.forEach(field => {
            const value = field.value || field.defaultValue;
            if (value !== undefined && value !== '') {
                this.setNestedProperty(data, field.name, this.formatFieldValue(field, value));
            }
        });
        return data;
    }

    static getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    static setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    // Field accessibility utilities
    static addAccessibilityAttributes(fieldElement, field) {
        // Add ARIA labels and roles
        fieldElement.setAttribute('role', this.getFieldRole(field.type));
        fieldElement.setAttribute('aria-label', field.name);
        
        if (field.required) {
            fieldElement.setAttribute('aria-required', 'true');
        }
        
        if (field.readonly) {
            fieldElement.setAttribute('aria-readonly', 'true');
        }
        
        if (field.description) {
            const descId = `${field.id}-desc`;
            fieldElement.setAttribute('aria-describedby', descId);
        }
        
        // Add keyboard navigation support
        fieldElement.setAttribute('tabindex', '0');
        
        return fieldElement;
    }

    static getFieldRole(type) {
        const roles = {
            text: 'textbox',
            textarea: 'textbox',
            date: 'textbox',
            checkbox: 'checkbox',
            radio: 'radio',
            dropdown: 'combobox',
            signature: 'img',
            initial: 'textbox'
        };
        
        return roles[type] || 'textbox';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldUtils;
} else if (typeof window !== 'undefined') {
    window.FieldUtils = FieldUtils;
}