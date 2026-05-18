/**
 * Validation Service - Handles form field validation and data integrity
 */
class ValidationService {
    constructor() {
        this.validators = new Map();
        this.customValidators = new Map();
        this.errorMessages = new Map();
        this.initializeDefaultValidators();
        this.initializeDefaultErrorMessages();
    }

    /**
     * Initialize default field validators
     */
    initializeDefaultValidators() {
        // Text field validators
        this.validators.set('text', {
            required: (value) => value.trim().length > 0,
            minLength: (value, min) => value.length >= min,
            maxLength: (value, max) => value.length <= max,
            pattern: (value, pattern) => new RegExp(pattern).test(value),
            alphanumeric: (value) => /^[a-zA-Z0-9\s]*$/.test(value),
            alphabetic: (value) => /^[a-zA-Z\s]*$/.test(value),
            numeric: (value) => /^[0-9]*$/.test(value)
        });

        // Email field validators
        this.validators.set('email', {
            required: (value) => value.trim().length > 0,
            format: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            domain: (value, allowedDomains) => {
                if (!allowedDomains || allowedDomains.length === 0) return true;
                const domain = value.split('@')[1];
                return allowedDomains.includes(domain);
            }
        });

        // Phone field validators
        this.validators.set('phone', {
            required: (value) => value.trim().length > 0,
            format: (value) => /^\+?[\d\s\-\(\)]+$/.test(value),
            usFormat: (value) => /^\+?1?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}$/.test(value),
            international: (value) => /^\+[1-9]\d{1,14}$/.test(value)
        });

        // Number field validators
        this.validators.set('number', {
            required: (value) => value !== '' && value !== null && value !== undefined,
            min: (value, min) => parseFloat(value) >= min,
            max: (value, max) => parseFloat(value) <= max,
            integer: (value) => Number.isInteger(parseFloat(value)),
            positive: (value) => parseFloat(value) > 0,
            negative: (value) => parseFloat(value) < 0
        });

        // Date field validators
        this.validators.set('date', {
            required: (value) => value.trim().length > 0,
            format: (value) => !isNaN(Date.parse(value)),
            minDate: (value, minDate) => new Date(value) >= new Date(minDate),
            maxDate: (value, maxDate) => new Date(value) <= new Date(maxDate),
            futureDate: (value) => new Date(value) > new Date(),
            pastDate: (value) => new Date(value) < new Date()
        });

        // Time field validators
        this.validators.set('time', {
            required: (value) => value.trim().length > 0,
            format: (value) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value),
            range: (value, min, max) => {
                const time = this.timeToMinutes(value);
                const minTime = this.timeToMinutes(min);
                const maxTime = this.timeToMinutes(max);
                return time >= minTime && time <= maxTime;
            }
        });

        // URL field validators
        this.validators.set('url', {
            required: (value) => value.trim().length > 0,
            format: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            protocol: (value, allowedProtocols) => {
                try {
                    const url = new URL(value);
                    return allowedProtocols.includes(url.protocol.slice(0, -1));
                } catch {
                    return false;
                }
            }
        });

        // Currency field validators
        this.validators.set('currency', {
            required: (value) => value.trim().length > 0,
            format: (value) => /^\$?\d+(\.\d{2})?$/.test(value),
            min: (value, min) => {
                const amount = parseFloat(value.replace('$', ''));
                return amount >= min;
            },
            max: (value, max) => {
                const amount = parseFloat(value.replace('$', ''));
                return amount <= max;
            }
        });

        // Password field validators
        this.validators.set('password', {
            required: (value) => value.length > 0,
            minLength: (value, min) => value.length >= min,
            maxLength: (value, max) => value.length <= max,
            hasUppercase: (value) => /[A-Z]/.test(value),
            hasLowercase: (value) => /[a-z]/.test(value),
            hasNumber: (value) => /\d/.test(value),
            hasSpecialChar: (value) => /[!@#$%^&*(),.?":{}|<>]/.test(value),
            noSpaces: (value) => !/\s/.test(value)
        });

        // Checkbox validators
        this.validators.set('checkbox', {
            required: (value) => value === true || value === 'true' || value === 'on'
        });

        // Radio validators
        this.validators.set('radio', {
            required: (value) => value.trim().length > 0
        });

        // Dropdown validators
        this.validators.set('dropdown', {
            required: (value) => value.trim().length > 0,
            validOption: (value, options) => options.includes(value)
        });

        // File upload validators
        this.validators.set('file', {
            required: (file) => file !== null && file !== undefined,
            maxSize: (file, maxSize) => file && file.size <= maxSize,
            allowedTypes: (file, types) => file && types.includes(file.type),
            allowedExtensions: (file, extensions) => {
                if (!file) return false;
                const ext = file.name.split('.').pop().toLowerCase();
                return extensions.includes(ext);
            }
        });

        // Signature validators
        this.validators.set('signature', {
            required: (value) => value && value.trim().length > 0,
            minLength: (value, min) => value && value.length >= min
        });
    }

    /**
     * Initialize default error messages
     */
    initializeDefaultErrorMessages() {
        this.errorMessages.set('required', 'This field is required');
        this.errorMessages.set('minLength', 'Must be at least {min} characters long');
        this.errorMessages.set('maxLength', 'Must be no more than {max} characters long');
        this.errorMessages.set('pattern', 'Invalid format');
        this.errorMessages.set('email.format', 'Invalid email address');
        this.errorMessages.set('phone.format', 'Invalid phone number');
        this.errorMessages.set('url.format', 'Invalid URL');
        this.errorMessages.set('date.format', 'Invalid date format');
        this.errorMessages.set('time.format', 'Invalid time format (HH:MM)');
        this.errorMessages.set('number.min', 'Value must be at least {min}');
        this.errorMessages.set('number.max', 'Value must be no more than {max}');
        this.errorMessages.set('currency.format', 'Invalid currency format');
        this.errorMessages.set('file.maxSize', 'File size must be less than {maxSize}MB');
        this.errorMessages.set('file.allowedTypes', 'File type not allowed');
    }

    /**
     * Validate a single field
     */
    validateField(fieldType, value, rules = {}, fieldName = '') {
        const errors = [];
        const typeValidators = this.validators.get(fieldType);
        
        if (!typeValidators) {
            console.warn(`No validators found for field type: ${fieldType}`);
            return { isValid: true, errors: [] };
        }

        // Check each rule
        Object.keys(rules).forEach(rule => {
            const ruleValue = rules[rule];
            const validator = typeValidators[rule];

            if (!validator) {
                console.warn(`No validator found for rule: ${rule} in type: ${fieldType}`);
                return;
            }

            let isValid = false;
            
            try {
                if (typeof ruleValue === 'boolean' && ruleValue) {
                    isValid = validator(value);
                } else if (Array.isArray(ruleValue)) {
                    isValid = validator(value, ...ruleValue);
                } else {
                    isValid = validator(value, ruleValue);
                }
            } catch (error) {
                console.error(`Validation error for ${fieldType}.${rule}:`, error);
                isValid = false;
            }

            if (!isValid) {
                errors.push(this.getErrorMessage(fieldType, rule, ruleValue, fieldName));
            }
        });

        // Check custom validators for this field type
        const customTypeValidators = this.customValidators.get(fieldType);
        if (customTypeValidators) {
            Object.keys(customTypeValidators).forEach(rule => {
                if (rules[rule]) {
                    const validator = customTypeValidators[rule];
                    const ruleValue = rules[rule];
                    
                    let isValid = false;
                    try {
                        isValid = validator(value, ruleValue);
                    } catch (error) {
                        console.error(`Custom validation error for ${fieldType}.${rule}:`, error);
                        isValid = false;
                    }

                    if (!isValid) {
                        errors.push(this.getErrorMessage(fieldType, rule, ruleValue, fieldName));
                    }
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate multiple fields
     */
    validateForm(fields, formData = {}) {
        const results = {
            isValid: true,
            fieldErrors: {},
            globalErrors: []
        };

        fields.forEach(field => {
            const value = formData[field.name] || formData[field.id] || field.value || '';
            const validation = this.validateField(field.type, value, field.validation || {}, field.label || field.name);
            
            if (!validation.isValid) {
                results.isValid = false;
                results.fieldErrors[field.id || field.name] = validation.errors;
            }
        });

        return results;
    }

    /**
     * Get error message for a validation rule
     */
    getErrorMessage(fieldType, rule, ruleValue, fieldName) {
        const messageKey = `${fieldType}.${rule}`;
        let message = this.errorMessages.get(messageKey) || this.errorMessages.get(rule) || `Validation failed for ${rule}`;
        
        // Replace placeholders
        message = message.replace('{fieldName}', fieldName);
        message = message.replace('{min}', ruleValue);
        message = message.replace('{max}', ruleValue);
        message = message.replace('{maxSize}', Math.round(ruleValue / (1024 * 1024)));
        
        return message;
    }

    /**
     * Add custom validator
     */
    addCustomValidator(fieldType, ruleName, validator, errorMessage) {
        if (!this.customValidators.has(fieldType)) {
            this.customValidators.set(fieldType, {});
        }
        
        this.customValidators.get(fieldType)[ruleName] = validator;
        
        if (errorMessage) {
            this.errorMessages.set(`${fieldType}.${ruleName}`, errorMessage);
        }
    }

    /**
     * Remove custom validator
     */
    removeCustomValidator(fieldType, ruleName) {
        const typeValidators = this.customValidators.get(fieldType);
        if (typeValidators) {
            delete typeValidators[ruleName];
            this.errorMessages.delete(`${fieldType}.${ruleName}`);
        }
    }

    /**
     * Set custom error message
     */
    setErrorMessage(rule, message) {
        this.errorMessages.set(rule, message);
    }

    /**
     * Validate data types
     */
    validateDataType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return !isNaN(parseFloat(value)) && isFinite(value);
            case 'boolean':
                return typeof value === 'boolean' || value === 'true' || value === 'false';
            case 'date':
                return !isNaN(Date.parse(value));
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null;
            default:
                return true;
        }
    }

    /**
     * Sanitize input value
     */
    sanitizeValue(value, fieldType) {
        if (typeof value !== 'string') return value;

        let sanitized = value;

        switch (fieldType) {
            case 'text':
            case 'textarea':
                // Remove HTML tags and trim
                sanitized = value.replace(/<[^>]*>/g, '').trim();
                break;
            case 'email':
                sanitized = value.toLowerCase().trim();
                break;
            case 'phone':
                // Keep only digits, spaces, dashes, parentheses, and plus
                sanitized = value.replace(/[^+\d\s\-\(\)]/g, '');
                break;
            case 'number':
            case 'currency':
                // Keep only digits, decimal point, and minus
                sanitized = value.replace(/[^0-9.-]/g, '');
                break;
            case 'url':
                sanitized = value.trim();
                // Add protocol if missing
                if (sanitized && !sanitized.match(/^https?:\/\//)) {
                    sanitized = 'http://' + sanitized;
                }
                break;
            default:
                sanitized = value.trim();
        }

        return sanitized;
    }

    /**
     * Format value for display
     */
    formatValue(value, fieldType, formatOptions = {}) {
        if (!value && value !== 0) return '';

        switch (fieldType) {
            case 'currency':
                const amount = parseFloat(value.toString().replace('$', ''));
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: formatOptions.currency || 'USD'
                }).format(amount);
            
            case 'number':
                const num = parseFloat(value);
                return formatOptions.decimals !== undefined ? 
                    num.toFixed(formatOptions.decimals) : num.toString();
            
            case 'date':
                const date = new Date(value);
                return date.toLocaleDateString(formatOptions.locale || 'en-US');
            
            case 'time':
                return value; // Already in HH:MM format
            
            case 'phone':
                // Format US phone numbers
                const cleaned = value.replace(/\D/g, '');
                if (cleaned.length === 10) {
                    return `(${cleaned.substr(0, 3)}) ${cleaned.substr(3, 3)}-${cleaned.substr(6, 4)}`;
                }
                return value;
            
            default:
                return value.toString();
        }
    }

    /**
     * Convert time to minutes for comparison
     */
    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Validate file upload
     */
    validateFile(file, rules = {}) {
        const errors = [];
        
        if (rules.required && !file) {
            errors.push('File is required');
            return { isValid: false, errors };
        }

        if (!file) {
            return { isValid: true, errors: [] };
        }

        // File size validation
        if (rules.maxSize && file.size > rules.maxSize) {
            errors.push(`File size must be less than ${Math.round(rules.maxSize / (1024 * 1024))}MB`);
        }

        // File type validation
        if (rules.allowedTypes && !rules.allowedTypes.includes(file.type)) {
            errors.push(`File type ${file.type} is not allowed`);
        }

        // File extension validation
        if (rules.allowedExtensions) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (!rules.allowedExtensions.includes(ext)) {
                errors.push(`File extension .${ext} is not allowed`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get validation rules for field type
     */
    getDefaultRules(fieldType) {
        const commonRules = {
            text: { required: false, minLength: 0, maxLength: 255 },
            email: { required: false, format: true },
            phone: { required: false, format: true },
            number: { required: false },
            date: { required: false, format: true },
            time: { required: false, format: true },
            url: { required: false, format: true },
            currency: { required: false, format: true },
            password: { required: false, minLength: 8 },
            checkbox: { required: false },
            radio: { required: false },
            dropdown: { required: false },
            file: { required: false, maxSize: 5 * 1024 * 1024 }, // 5MB
            signature: { required: false }
        };

        return commonRules[fieldType] || { required: false };
    }

    /**
     * Clear all custom validators and error messages
     */
    reset() {
        this.customValidators.clear();
        this.initializeDefaultErrorMessages();
    }
}

// Create and export singleton instance
const validationService = new ValidationService();
export default validationService;