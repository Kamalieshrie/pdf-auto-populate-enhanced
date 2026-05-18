/**
 * Validation Service
 * Handles data validation, sanitization, and business rule enforcement
 */

const fieldService = require('./field-service');
const signatureService = require('./signature-service');

class ValidationService {
    constructor() {
        this.validationRules = {
            text: { maxLength: 255, pattern: null },
            number: { min: null, max: null, precision: 2 },
            email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
            phone: { pattern: /^\+?[\d\s\-()]+$/ },
            date: { format: 'YYYY-MM-DD', minDate: null, maxDate: null },
            url: { pattern: /^https?:\/\/.+/ },
            checkbox: { required: false },
            radio: { options: [] },
            dropdown: { options: [], multiSelect: false },
            signature: { required: false, format: ['png', 'svg'] },
            initial: { maxLength: 10 }
        };
    }

    /**
     * Validate field value against field type and properties
     */
    validateFieldValue(field, value) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        try {
            if (value === null || value === undefined) {
                if (field.properties?.required) {
                    validation.isValid = false;
                    validation.errors.push('Field is required');
                }
                return validation;
            }

            // Type-specific validation
            switch (field.type) {
                case 'text':
                    this.validateText(field, value, validation);
                    break;
                case 'number':
                    this.validateNumber(field, value, validation);
                    break;
                case 'email':
                    this.validateEmail(field, value, validation);
                    break;
                case 'phone':
                    this.validatePhone(field, value, validation);
                    break;
                case 'date':
                    this.validateDate(field, value, validation);
                    break;
                case 'url':
                    this.validateURL(field, value, validation);
                    break;
                case 'checkbox':
                    this.validateCheckbox(field, value, validation);
                    break;
                case 'radio':
                    this.validateRadio(field, value, validation);
                    break;
                case 'dropdown':
                    this.validateDropdown(field, value, validation);
                    break;
                case 'signature':
                    this.validateSignature(field, value, validation);
                    break;
                case 'initial':
                    this.validateInitial(field, value, validation);
                    break;
                default:
                    validation.warnings.push(`Unknown field type: ${field.type}`);
            }

            // Custom validation rules
            if (field.validation) {
                this.applyCustomValidation(field.validation, value, validation);
            }

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Validation error: ${error.message}`);
        }

        return validation;
    }

    /**
     * Validate complete form data
     */
    validateFormData(formData, fields) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            fieldResults: {},
            summary: {
                totalFields: fields.length,
                validatedFields: 0,
                validFields: 0,
                invalidFields: 0
            }
        };

        try {
            fields.forEach(field => {
                const value = formData[field.name];
                const fieldValidation = this.validateFieldValue(field, value);
                
                validation.fieldResults[field.name] = fieldValidation;
                validation.summary.validatedFields++;

                if (fieldValidation.isValid) {
                    validation.summary.validFields++;
                } else {
                    validation.summary.invalidFields++;
                    validation.isValid = false;
                    validation.errors.push(...fieldValidation.errors.map(err => 
                        `${field.label || field.name}: ${err}`
                    ));
                }

                validation.warnings.push(...fieldValidation.warnings.map(warn => 
                    `${field.label || field.name}: ${warn}`
                ));
            });

            // Cross-field validation
            this.validateCrossFieldRules(formData, fields, validation);

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Form validation error: ${error.message}`);
        }

        return validation;
    }

    /**
     * Validate property data structure
     */
    validatePropertyData(propertyData) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedData: {}
        };

        const requiredFields = ['property', 'name', 'beds', 'baths', 'sqft', 'rent'];
        const numberFields = ['property', 'beds', 'baths', 'sqft'];
        const currencyFields = ['rent', 'management_fee', 'balance_amount', 'threshold_amount', 'disbursement_amount'];

        // Check required fields
        requiredFields.forEach(field => {
            if (propertyData[field] === undefined || propertyData[field] === null) {
                validation.isValid = false;
                validation.errors.push(`Required field missing: ${field}`);
            }
        });

        // Validate number fields
        numberFields.forEach(field => {
            if (propertyData[field] !== undefined) {
                const numValue = Number(propertyData[field]);
                if (isNaN(numValue) || numValue < 0) {
                    validation.isValid = false;
                    validation.errors.push(`Invalid number value for: ${field}`);
                } else {
                    validation.sanitizedData[field] = numValue;
                }
            }
        });

        // Validate currency fields
        currencyFields.forEach(field => {
            if (propertyData[field] !== undefined) {
                const currencyValue = this.sanitizeCurrency(propertyData[field]);
                if (currencyValue === null) {
                    validation.isValid = false;
                    validation.errors.push(`Invalid currency value for: ${field}`);
                } else {
                    validation.sanitizedData[field] = currencyValue;
                }
            }
        });

        // Validate status
        if (propertyData.status && !['available', 'occupied', 'maintenance'].includes(propertyData.status)) {
            validation.warnings.push('Invalid status value');
        }

        return validation;
    }

    /**
     * Sanitize input data
     */
    sanitizeInput(data, fieldType = 'text') {
        if (data === null || data === undefined) return data;

        switch (fieldType) {
            case 'text':
                return this.sanitizeText(data);
            case 'number':
                return this.sanitizeNumber(data);
            case 'email':
                return this.sanitizeEmail(data);
            case 'phone':
                return this.sanitizePhone(data);
            case 'date':
                return this.sanitizeDate(data);
            case 'url':
                return this.sanitizeURL(data);
            default:
                return data;
        }
    }

    /**
     * Type-specific validation methods
     */
    validateText(field, value, validation) {
        const strValue = String(value).trim();
        
        if (field.properties?.maxLength && strValue.length > field.properties.maxLength) {
            validation.isValid = false;
            validation.errors.push(`Text exceeds maximum length of ${field.properties.maxLength} characters`);
        }

        if (field.properties?.pattern && !field.properties.pattern.test(strValue)) {
            validation.isValid = false;
            validation.errors.push('Text does not match required pattern');
        }

        validation.sanitizedValue = strValue;
    }

    validateNumber(field, value, validation) {
        const numValue = Number(value);
        
        if (isNaN(numValue)) {
            validation.isValid = false;
            validation.errors.push('Invalid number format');
            return;
        }

        if (field.properties?.min !== null && numValue < field.properties.min) {
            validation.isValid = false;
            validation.errors.push(`Number must be at least ${field.properties.min}`);
        }

        if (field.properties?.max !== null && numValue > field.properties.max) {
            validation.isValid = false;
            validation.errors.push(`Number must be at most ${field.properties.max}`);
        }

        // Apply precision
        if (field.properties?.precision !== null) {
            validation.sanitizedValue = Number(numValue.toFixed(field.properties.precision));
        } else {
            validation.sanitizedValue = numValue;
        }
    }

    validateEmail(field, value, validation) {
        const emailValue = String(value).trim().toLowerCase();
        const emailRegex = this.validationRules.email.pattern;

        if (!emailRegex.test(emailValue)) {
            validation.isValid = false;
            validation.errors.push('Invalid email format');
        }

        validation.sanitizedValue = emailValue;
    }

    validatePhone(field, value, validation) {
        const phoneValue = String(value).trim();
        const phoneRegex = this.validationRules.phone.pattern;

        // Remove common formatting for validation
        const cleanPhone = phoneValue.replace(/[\s\-()]/g, '');

        if (!phoneRegex.test(phoneValue) || cleanPhone.length < 10) {
            validation.isValid = false;
            validation.errors.push('Invalid phone number format');
        }

        validation.sanitizedValue = phoneValue;
    }

    validateDate(field, value, validation) {
        const dateValue = new Date(value);
        
        if (isNaN(dateValue.getTime())) {
            validation.isValid = false;
            validation.errors.push('Invalid date format');
            return;
        }

        // Check min/max date constraints
        if (field.properties?.minDate) {
            const minDate = new Date(field.properties.minDate);
            if (dateValue < minDate) {
                validation.isValid = false;
                validation.errors.push(`Date must be after ${minDate.toISOString().split('T')[0]}`);
            }
        }

        if (field.properties?.maxDate) {
            const maxDate = new Date(field.properties.maxDate);
            if (dateValue > maxDate) {
                validation.isValid = false;
                validation.errors.push(`Date must be before ${maxDate.toISOString().split('T')[0]}`);
            }
        }

        validation.sanitizedValue = dateValue.toISOString().split('T')[0];
    }

    validateURL(field, value, validation) {
        const urlValue = String(value).trim();
        const urlRegex = this.validationRules.url.pattern;

        try {
            new URL(urlValue); // Basic URL validation
        } catch {
            validation.isValid = false;
            validation.errors.push('Invalid URL format');
            return;
        }

        if (field.properties?.httpsOnly && !urlValue.startsWith('https://')) {
            validation.isValid = false;
            validation.errors.push('URL must use HTTPS');
        }

        validation.sanitizedValue = urlValue;
    }

    validateCheckbox(field, value, validation) {
        const boolValue = Boolean(value);
        validation.sanitizedValue = boolValue;
    }

    validateRadio(field, value, validation) {
        const options = field.properties?.options || [];
        
        if (!options.includes(value)) {
            validation.isValid = false;
            validation.errors.push('Invalid option selected');
        }

        validation.sanitizedValue = value;
    }

    validateDropdown(field, value, validation) {
        const options = field.properties?.options || [];
        
        if (field.properties?.multiSelect) {
            if (!Array.isArray(value)) {
                validation.isValid = false;
                validation.errors.push('Multi-select field requires an array');
                return;
            }

            const invalidOptions = value.filter(opt => !options.includes(opt));
            if (invalidOptions.length > 0) {
                validation.isValid = false;
                validation.errors.push('Invalid options selected');
            }
        } else {
            if (!options.includes(value)) {
                validation.isValid = false;
                validation.errors.push('Invalid option selected');
            }
        }

        validation.sanitizedValue = value;
    }

    validateSignature(field, value, validation) {
        if (field.properties?.required && !value) {
            validation.isValid = false;
            validation.errors.push('Signature is required');
        }

        if (value) {
            const signatureValidation = signatureService.validateSignature(value, field.properties);
            if (!signatureValidation.isValid) {
                validation.isValid = false;
                validation.errors.push(...signatureValidation.errors);
            }
        }

        validation.sanitizedValue = value;
    }

    validateInitial(field, value, validation) {
        const initialValue = String(value).trim().toUpperCase();
        
        if (initialValue.length > (field.properties?.maxLength || 10)) {
            validation.isValid = false;
            validation.errors.push('Initials too long');
        }

        if (!/^[A-Z]+$/.test(initialValue)) {
            validation.isValid = false;
            validation.errors.push('Initials can only contain letters');
        }

        validation.sanitizedValue = initialValue;
    }

    /**
     * Helper methods
     */
    applyCustomValidation(rules, value, validation) {
        if (rules.custom && typeof rules.custom === 'function') {
            const customResult = rules.custom(value);
            if (!customResult.isValid) {
                validation.isValid = false;
                validation.errors.push(customResult.message || 'Custom validation failed');
            }
        }
    }

    validateCrossFieldRules(formData, fields, validation) {
        // Example: If property is occupied, disbursement amount should be 0
        const statusField = fields.find(f => f.name === 'status');
        const disbursementField = fields.find(f => f.name === 'disbursement_amount');
        
        if (statusField && disbursementField) {
            const status = formData[statusField.name];
            const disbursement = formData[disbursementField.name];
            
            if (status === 'occupied' && parseFloat(disbursement) > 0) {
                validation.warnings.push('Disbursement amount should be 0 for occupied properties');
            }
        }
    }

    sanitizeText(data) {
        return String(data).trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    sanitizeNumber(data) {
        const num = Number(data);
        return isNaN(num) ? null : num;
    }

    sanitizeEmail(data) {
        return String(data).trim().toLowerCase();
    }

    sanitizePhone(data) {
        return String(data).trim().replace(/[^\d+]/g, '');
    }

    sanitizeDate(data) {
        const date = new Date(data);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }

    sanitizeURL(data) {
        try {
            const url = new URL(data);
            return url.toString();
        } catch {
            return null;
        }
    }

    sanitizeCurrency(amount) {
        const num = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
        return isNaN(num) ? null : num.toFixed(2);
    }

    /**
     * Get validation rules for field type
     */
    getValidationRules(fieldType) {
        return this.validationRules[fieldType] || {};
    }

    /**
     * Generate validation schema from fields
     */
    generateValidationSchema(fields) {
        const schema = {};
        
        fields.forEach(field => {
            schema[field.name] = {
                type: field.type,
                required: field.properties?.required || false,
                rules: this.getValidationRules(field.type),
                ...field.validation
            };
        });

        return schema;
    }
}

module.exports = new ValidationService();