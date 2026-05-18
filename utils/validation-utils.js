/**
 * Validation Utilities
 * Handles data validation, sanitization, and security checks
 */

class ValidationUtils {
    constructor() {
        // Common validation patterns
        this.patterns = {
            email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
            phone: /^[\+]?[1-9][\d]{0,15}$/,
            date: /^\d{4}-\d{2}-\d{2}$/,
            datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
            number: /^-?\d+(\.\d+)?$/,
            integer: /^-?\d+$/,
            positiveNumber: /^\d+(\.\d+)?$/,
            url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
            uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
            base64: /^[A-Za-z0-9+/]*={0,2}$/,
            alphanumeric: /^[a-zA-Z0-9]+$/,
            alpha: /^[a-zA-Z]+$/,
            slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
        };

        // Field type validators
        this.fieldValidators = {
            text: this.validateText.bind(this),
            number: this.validateNumber.bind(this),
            email: this.validateEmail.bind(this),
            phone: this.validatePhone.bind(this),
            date: this.validateDate.bind(this),
            url: this.validateUrl.bind(this),
            checkbox: this.validateCheckbox.bind(this),
            radio: this.validateRadio.bind(this),
            dropdown: this.validateDropdown.bind(this),
            signature: this.validateSignature.bind(this),
            image: this.validateImage.bind(this)
        };

        // Security patterns to check for
        this.securityPatterns = {
            sqlInjection: /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
            xss: /<.*?>/,
            pathTraversal: /\.\./,
            scriptTag: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            htmlTag: /<[^>]*>/g,
            javascript: /javascript:/i,
            dataUrl: /data:/i
        };

        // Common password requirements
        this.passwordRequirements = {
            minLength: 8,
            maxLength: 128,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            specialChars: '!@#$%^&*(),.?":{}|<>'
        };
    }

    /**
     * Validate field based on type and rules
     */
    validateField(field, value, rules = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        try {
            // Check if field is required
            if (rules.required && this.isEmpty(value)) {
                validation.isValid = false;
                validation.errors.push(`${field.name || 'Field'} is required`);
                return validation;
            }

            // Skip validation for empty optional fields
            if (!rules.required && this.isEmpty(value)) {
                return validation;
            }

            // Type-specific validation
            const validator = this.fieldValidators[field.type];
            if (validator) {
                const typeValidation = validator(value, field.properties || {});
                validation.isValid = validation.isValid && typeValidation.isValid;
                validation.errors.push(...typeValidation.errors);
                validation.warnings.push(...typeValidation.warnings);
                if (typeValidation.sanitizedValue !== undefined) {
                    validation.sanitizedValue = typeValidation.sanitizedValue;
                }
            }

            // Custom validation rules
            if (rules.pattern && value !== null && value !== undefined) {
                const patternRegex = typeof rules.pattern === 'string' ? new RegExp(rules.pattern) : rules.pattern;
                if (!patternRegex.test(String(value))) {
                    validation.isValid = false;
                    validation.errors.push(rules.patternMessage || `Invalid format for ${field.name || 'field'}`);
                }
            }

            // Length validation (only for string values)
            if (value !== null && value !== undefined) {
                const stringValue = String(value);
                if (rules.minLength && stringValue.length < rules.minLength) {
                    validation.isValid = false;
                    validation.errors.push(`${field.name || 'Field'} must be at least ${rules.minLength} characters long`);
                }

                if (rules.maxLength && stringValue.length > rules.maxLength) {
                    validation.isValid = false;
                    validation.errors.push(`${field.name || 'Field'} must not exceed ${rules.maxLength} characters`);
                }
            }

            // Numeric validation
            if (rules.min !== undefined && value !== null && value !== undefined) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue < rules.min) {
                    validation.isValid = false;
                    validation.errors.push(`${field.name || 'Field'} must be at least ${rules.min}`);
                }
            }

            if (rules.max !== undefined && value !== null && value !== undefined) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue > rules.max) {
                    validation.isValid = false;
                    validation.errors.push(`${field.name || 'Field'} must not exceed ${rules.max}`);
                }
            }

            // Security validation
            if (rules.sanitize !== false && value !== null && value !== undefined) {
                const securityCheck = this.checkSecurity(value);
                if (!securityCheck.isSecure) {
                    validation.isValid = false;
                    validation.errors.push(...securityCheck.threats.map(threat => `Security threat detected: ${threat}`));
                }
                validation.sanitizedValue = this.sanitizeInput(validation.sanitizedValue);
            }

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Validation error: ${error.message}`);
        }

        return validation;
    }

    /**
     * Validate text field
     */
    validateText(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value === null || value === undefined ? '' : String(value)
        };

        // Multiline validation
        if (!properties.multiline && validation.sanitizedValue.includes('\n')) {
            validation.warnings.push('Multiline text detected in single-line field');
            validation.sanitizedValue = validation.sanitizedValue.replace(/\n/g, ' ');
        }

        // Character encoding validation
        if (!/^[\x00-\x7F]*$/.test(validation.sanitizedValue) && properties.asciiOnly) {
            validation.isValid = false;
            validation.errors.push('Only ASCII characters are allowed');
        }

        return validation;
    }

    /**
     * Validate number field
     */
    validateNumber(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        if (value === null || value === undefined) {
            return validation;
        }

        const numValue = parseFloat(value);

        if (isNaN(numValue)) {
            validation.isValid = false;
            validation.errors.push('Invalid number format');
            return validation;
        }

        validation.sanitizedValue = numValue;

        // Integer validation
        if (properties.integer && !Number.isInteger(numValue)) {
            validation.isValid = false;
            validation.errors.push('Value must be an integer');
        }

        // Precision validation
        if (properties.precision !== undefined) {
            const valueStr = String(value);
            const decimalPlaces = valueStr.includes('.') ? valueStr.split('.')[1].length : 0;
            if (decimalPlaces > properties.precision) {
                validation.warnings.push(`Number precision exceeds ${properties.precision} decimal places`);
                validation.sanitizedValue = parseFloat(numValue.toFixed(properties.precision));
            }
        }

        return validation;
    }

    /**
     * Validate email field
     */
    validateEmail(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value === null || value === undefined ? '' : String(value).toLowerCase().trim()
        };

        if (!validation.sanitizedValue) {
            return validation;
        }

        if (!this.patterns.email.test(validation.sanitizedValue)) {
            validation.isValid = false;
            validation.errors.push('Invalid email address format');
            return validation;
        }

        // Domain validation
        if (properties.allowedDomains && Array.isArray(properties.allowedDomains)) {
            const domain = validation.sanitizedValue.split('@')[1];
            if (domain && !properties.allowedDomains.includes(domain)) {
                validation.isValid = false;
                validation.errors.push(`Email domain not allowed. Allowed domains: ${properties.allowedDomains.join(', ')}`);
            }
        }

        // Blocked domains
        if (properties.blockedDomains && Array.isArray(properties.blockedDomains)) {
            const domain = validation.sanitizedValue.split('@')[1];
            if (domain && properties.blockedDomains.includes(domain)) {
                validation.isValid = false;
                validation.errors.push('Email domain is blocked');
            }
        }

        return validation;
    }

    /**
     * Validate phone field
     */
    validatePhone(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value === null || value === undefined ? '' : String(value).replace(/\D/g, '')
        };

        if (!validation.sanitizedValue) {
            return validation;
        }

        if (!this.patterns.phone.test(validation.sanitizedValue)) {
            validation.isValid = false;
            validation.errors.push('Invalid phone number format');
            return validation;
        }

        // Country code validation
        if (properties.requireCountryCode && !String(value).startsWith('+')) {
            validation.warnings.push('Country code recommended for phone numbers');
        }

        // Format phone number
        if (properties.format && validation.isValid) {
            validation.sanitizedValue = this.formatPhoneNumber(validation.sanitizedValue, properties.format);
        }

        return validation;
    }

    /**
     * Validate date field
     */
    validateDate(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        if (value === null || value === undefined) {
            return validation;
        }

        const dateObj = new Date(value);

        if (isNaN(dateObj.getTime())) {
            validation.isValid = false;
            validation.errors.push('Invalid date format');
            return validation;
        }

        // Date range validation
        if (properties.minDate) {
            const minDate = new Date(properties.minDate);
            if (dateObj < minDate) {
                validation.isValid = false;
                validation.errors.push(`Date must be after ${properties.minDate}`);
            }
        }

        if (properties.maxDate) {
            const maxDate = new Date(properties.maxDate);
            if (dateObj > maxDate) {
                validation.isValid = false;
                validation.errors.push(`Date must be before ${properties.maxDate}`);
            }
        }

        // Future date validation
        if (properties.noFutureDates && dateObj > new Date()) {
            validation.isValid = false;
            validation.errors.push('Future dates are not allowed');
        }

        // Past date validation
        if (properties.noPastDates && dateObj < new Date()) {
            validation.isValid = false;
            validation.errors.push('Past dates are not allowed');
        }

        // Format date
        if (properties.format && validation.isValid) {
            validation.sanitizedValue = this.formatDate(dateObj, properties.format);
        }

        return validation;
    }

    /**
     * Validate URL field
     */
    validateUrl(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value === null || value === undefined ? '' : String(value).trim()
        };

        if (!validation.sanitizedValue) {
            return validation;
        }

        if (!this.patterns.url.test(validation.sanitizedValue)) {
            validation.isValid = false;
            validation.errors.push('Invalid URL format');
            return validation;
        }

        // Protocol validation
        if (properties.httpsOnly && !validation.sanitizedValue.startsWith('https://')) {
            validation.isValid = false;
            validation.errors.push('Only HTTPS URLs are allowed');
        }

        // Domain whitelist
        if (properties.allowedDomains && Array.isArray(properties.allowedDomains)) {
            try {
                const url = new URL(validation.sanitizedValue);
                if (!properties.allowedDomains.includes(url.hostname)) {
                    validation.isValid = false;
                    validation.errors.push(`Domain not allowed. Allowed domains: ${properties.allowedDomains.join(', ')}`);
                }
            } catch (error) {
                validation.isValid = false;
                validation.errors.push('Invalid URL format for domain validation');
            }
        }

        return validation;
    }

    /**
     * Validate checkbox field
     */
    validateCheckbox(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: Boolean(value)
        };

        // Required checkbox validation
        if (properties.required && !validation.sanitizedValue) {
            validation.isValid = false;
            validation.errors.push('Checkbox must be checked');
        }

        return validation;
    }

    /**
     * Validate radio field
     */
    validateRadio(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        if (!properties.options || !Array.isArray(properties.options)) {
            validation.isValid = false;
            validation.errors.push('No radio options defined');
            return validation;
        }

        if (value !== null && value !== undefined && !properties.options.includes(value)) {
            validation.isValid = false;
            validation.errors.push('Invalid radio option selected');
        }

        return validation;
    }

    /**
     * Validate dropdown field
     */
    validateDropdown(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        if (!properties.options || !Array.isArray(properties.options)) {
            validation.isValid = false;
            validation.errors.push('No dropdown options defined');
            return validation;
        }

        // Multi-select validation
        if (properties.multiSelect) {
            if (value !== null && value !== undefined) {
                if (!Array.isArray(value)) {
                    validation.isValid = false;
                    validation.errors.push('Multi-select value must be an array');
                    return validation;
                }

                const invalidOptions = value.filter(v => !properties.options.includes(v));
                if (invalidOptions.length > 0) {
                    validation.isValid = false;
                    validation.errors.push(`Invalid options: ${invalidOptions.join(', ')}`);
                }
            }
        } else {
            if (value !== null && value !== undefined && !properties.options.includes(value)) {
                validation.isValid = false;
                validation.errors.push('Invalid dropdown option selected');
            }
        }

        return validation;
    }

    /**
     * Validate signature field
     */
    validateSignature(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        if (properties.required && !value) {
            validation.isValid = false;
            validation.errors.push('Signature is required');
            return validation;
        }

        if (!value) {
            return validation;
        }

        // Base64 signature validation
        if (typeof value === 'string' && value.startsWith('data:image')) {
            const base64Data = value.split(',')[1];
            if (!this.patterns.base64.test(base64Data)) {
                validation.isValid = false;
                validation.errors.push('Invalid signature format');
            }
        }

        // Signature size validation
        if (properties.maxSize && value.length > properties.maxSize) {
            validation.isValid = false;
            validation.errors.push(`Signature data exceeds maximum size of ${properties.maxSize} characters`);
        }

        return validation;
    }

    /**
     * Validate image field
     */
    validateImage(value, properties = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            sanitizedValue: value
        };

        if (properties.required && !value) {
            validation.isValid = false;
            validation.errors.push('Image is required');
            return validation;
        }

        if (!value) {
            return validation;
        }

        // Base64 image validation
        if (typeof value === 'string' && value.startsWith('data:image')) {
            const [header, data] = value.split(',');
            
            // Check MIME type
            if (properties.allowedTypes && Array.isArray(properties.allowedTypes)) {
                const mimeMatch = header.match(/data:([^;]+)/);
                if (mimeMatch && !properties.allowedTypes.includes(mimeMatch[1])) {
                    validation.isValid = false;
                    validation.errors.push(`Invalid image type. Allowed types: ${properties.allowedTypes.join(', ')}`);
                }
            }

            if (!this.patterns.base64.test(data)) {
                validation.isValid = false;
                validation.errors.push('Invalid image format');
            }
        }

        return validation;
    }

    /**
     * Check for security threats
     */
    checkSecurity(input) {
        const security = {
            isSecure: true,
            threats: []
        };

        if (input === null || input === undefined) {
            return security;
        }

        const inputStr = String(input);

        // Check for various security patterns
        for (const [threat, pattern] of Object.entries(this.securityPatterns)) {
            if (pattern.test(inputStr)) {
                security.isSecure = false;
                security.threats.push(threat);
            }
        }

        return security;
    }

    /**
     * Sanitize input to prevent XSS and injection attacks
     */
    sanitizeInput(input, options = {}) {
        if (input === null || input === undefined) {
            return input;
        }

        if (typeof input !== 'string') {
            input = String(input);
        }

        let sanitized = input;

        // HTML encoding
        if (options.encodeHtml !== false) {
            sanitized = sanitized
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        }

        // Remove script tags
        if (options.removeScripts !== false) {
            sanitized = sanitized.replace(this.securityPatterns.scriptTag, '');
        }

        // Remove javascript: URLs
        if (options.removeJavaScript !== false) {
            sanitized = sanitized.replace(this.securityPatterns.javascript, '');
        }

        // Remove data: URLs if specified
        if (options.removeDataUrls) {
            sanitized = sanitized.replace(this.securityPatterns.dataUrl, '');
        }

        // Trim whitespace
        if (options.trim !== false) {
            sanitized = sanitized.trim();
        }

        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');

        return sanitized;
    }

    /**
     * Validate password strength
     */
    validatePassword(password, requirements = {}) {
        const reqs = { ...this.passwordRequirements, ...requirements };
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            score: 0,
            strength: 'weak'
        };

        if (!password) {
            validation.isValid = false;
            validation.errors.push('Password is required');
            return validation;
        }

        const passStr = String(password);

        // Length check
        if (passStr.length < reqs.minLength) {
            validation.isValid = false;
            validation.errors.push(`Password must be at least ${reqs.minLength} characters long`);
        } else {
            validation.score += 1;
        }

        if (passStr.length > reqs.maxLength) {
            validation.isValid = false;
            validation.errors.push(`Password must not exceed ${reqs.maxLength} characters`);
        }

        // Character type checks
        if (reqs.requireUppercase && !/[A-Z]/.test(passStr)) {
            validation.isValid = false;
            validation.errors.push('Password must contain at least one uppercase letter');
        } else if (reqs.requireUppercase) {
            validation.score += 1;
        }

        if (reqs.requireLowercase && !/[a-z]/.test(passStr)) {
            validation.isValid = false;
            validation.errors.push('Password must contain at least one lowercase letter');
        } else if (reqs.requireLowercase) {
            validation.score += 1;
        }

        if (reqs.requireNumbers && !/\d/.test(passStr)) {
            validation.isValid = false;
            validation.errors.push('Password must contain at least one number');
        } else if (reqs.requireNumbers) {
            validation.score += 1;
        }

        if (reqs.requireSpecialChars) {
            const specialCharRegex = new RegExp(`[${this.escapeRegex(reqs.specialChars)}]`);
            if (!specialCharRegex.test(passStr)) {
                validation.isValid = false;
                validation.errors.push(`Password must contain at least one special character: ${reqs.specialChars}`);
            } else {
                validation.score += 1;
            }
        }

        // Additional strength checks
        if (passStr.length >= 12) validation.score += 1;
        if (/(.)\1{2,}/.test(passStr)) validation.score -= 1; // Repeated characters
        if (/^(.+)\1+$/.test(passStr)) validation.score -= 2; // Pattern repetition

        // Calculate strength
        if (validation.score >= 5) {
            validation.strength = 'very strong';
        } else if (validation.score >= 4) {
            validation.strength = 'strong';
        } else if (validation.score >= 3) {
            validation.strength = 'medium';
        } else if (validation.score >= 2) {
            validation.strength = 'weak';
        } else {
            validation.strength = 'very weak';
        }

        return validation;
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Validate JSON data structure
     */
    validateJSON(jsonString, schema = null) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            parsedData: null
        };

        try {
            validation.parsedData = JSON.parse(jsonString);
        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Invalid JSON format: ${error.message}`);
            return validation;
        }

        // Schema validation if provided
        if (schema) {
            const schemaValidation = this.validateAgainstSchema(validation.parsedData, schema);
            validation.isValid = validation.isValid && schemaValidation.isValid;
            validation.errors.push(...schemaValidation.errors);
            validation.warnings.push(...schemaValidation.warnings);
        }

        return validation;
    }

    /**
     * Validate data against schema
     */
    validateAgainstSchema(data, schema) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        const validateProperty = (value, propSchema, path = '') => {
            // Skip if value is undefined and not required
            if (value === undefined) {
                if (propSchema.required) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} is required`);
                }
                return;
            }

            // Type validation
            if (propSchema.type) {
                let isValidType = false;
                switch (propSchema.type) {
                    case 'string':
                        isValidType = typeof value === 'string';
                        break;
                    case 'number':
                        isValidType = typeof value === 'number' && !isNaN(value);
                        break;
                    case 'boolean':
                        isValidType = typeof value === 'boolean';
                        break;
                    case 'object':
                        isValidType = typeof value === 'object' && value !== null && !Array.isArray(value);
                        break;
                    case 'array':
                        isValidType = Array.isArray(value);
                        break;
                    case 'null':
                        isValidType = value === null;
                        break;
                    default:
                        isValidType = true;
                }

                if (!isValidType) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must be of type ${propSchema.type}`);
                    return;
                }
            }

            // String validations
            if (propSchema.type === 'string' && typeof value === 'string') {
                if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must be at least ${propSchema.minLength} characters`);
                }

                if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must not exceed ${propSchema.maxLength} characters`);
                }

                if (propSchema.pattern && !new RegExp(propSchema.pattern).test(value)) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} does not match required pattern`);
                }

                if (propSchema.enum && !propSchema.enum.includes(value)) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must be one of: ${propSchema.enum.join(', ')}`);
                }
            }

            // Number validations
            if (propSchema.type === 'number' && typeof value === 'number') {
                if (propSchema.minimum !== undefined && value < propSchema.minimum) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must be at least ${propSchema.minimum}`);
                }

                if (propSchema.maximum !== undefined && value > propSchema.maximum) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must not exceed ${propSchema.maximum}`);
                }
            }

            // Array validations
            if (propSchema.type === 'array' && Array.isArray(value)) {
                if (propSchema.minItems !== undefined && value.length < propSchema.minItems) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must have at least ${propSchema.minItems} items`);
                }

                if (propSchema.maxItems !== undefined && value.length > propSchema.maxItems) {
                    validation.isValid = false;
                    validation.errors.push(`Property ${path} must not exceed ${propSchema.maxItems} items`);
                }

                if (propSchema.items) {
                    value.forEach((item, index) => {
                        validateProperty(item, propSchema.items, `${path}[${index}]`);
                    });
                }
            }

            // Object validations
            if (propSchema.type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (propSchema.properties) {
                    Object.keys(propSchema.properties).forEach(key => {
                        validateProperty(value[key], propSchema.properties[key], path ? `${path}.${key}` : key);
                    });
                }

                // Check for additional properties
                if (propSchema.additionalProperties === false) {
                    const allowedKeys = Object.keys(propSchema.properties || {});
                    Object.keys(value).forEach(key => {
                        if (!allowedKeys.includes(key)) {
                            validation.isValid = false;
                            validation.errors.push(`Property ${path ? `${path}.${key}` : key} is not allowed`);
                        }
                    });
                }
            }
        };

        if (schema.type === 'object' && schema.properties) {
            Object.keys(schema.properties).forEach(key => {
                validateProperty(data[key], schema.properties[key], key);
            });
        } else {
            validateProperty(data, schema, '');
        }

        return validation;
    }

    /**
     * Validate batch data
     */
    validateBatch(dataArray, validator, options = {}) {
        const results = {
            validCount: 0,
            invalidCount: 0,
            totalCount: dataArray.length,
            results: [],
            errors: [],
            warnings: []
        };

        dataArray.forEach((item, index) => {
            try {
                const validation = validator(item, options);
                
                if (validation.isValid) {
                    results.validCount++;
                } else {
                    results.invalidCount++;
                }

                results.results.push({
                    index,
                    item,
                    validation
                });

                results.errors.push(...validation.errors.map(error => `Item ${index}: ${error}`));
                results.warnings.push(...validation.warnings.map(warning => `Item ${index}: ${warning}`));

            } catch (error) {
                results.invalidCount++;
                results.errors.push(`Item ${index}: Validation error - ${error.message}`);
            }
        });

        return results;
    }

    /**
     * Format phone number
     */
    formatPhoneNumber(phoneNumber, format = 'international') {
        const digits = phoneNumber.replace(/\D/g, '');
        
        switch (format) {
            case 'us':
                if (digits.length === 10) {
                    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
                }
                break;
            case 'international':
                if (digits.length >= 10) {
                    const countryCode = digits.length > 10 ? `+${digits.substring(0, digits.length - 10)} ` : '';
                    return `${countryCode}${digits.substring(-10, 3)} ${digits.substring(-7, 3)} ${digits.substring(-4)}`;
                }
                break;
            case 'dots':
                if (digits.length === 10) {
                    return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6)}`;
                }
                break;
        }
        
        return phoneNumber; // Return original if formatting fails
    }

    /**
     * Format date
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return date;
        }

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    /**
     * Check if value is empty
     */
    isEmpty(value) {
        return value === null || 
               value === undefined || 
               value === '' || 
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'object' && value !== null && Object.keys(value).length === 0);
    }

    /**
     * Deep validation for nested objects
     */
    validateNested(data, schema, path = '') {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (typeof data !== 'object' || data === null) {
            validation.isValid = false;
            validation.errors.push(`${path} must be an object`);
            return validation;
        }

        Object.keys(schema).forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;
            const value = data[key];
            const rules = schema[key];

            if (rules.required && this.isEmpty(value)) {
                validation.isValid = false;
                validation.errors.push(`${currentPath} is required`);
                return;
            }

            if (!this.isEmpty(value)) {
                if (rules.type === 'object' && rules.properties) {
                    const nestedValidation = this.validateNested(value, rules.properties, currentPath);
                    validation.isValid = validation.isValid && nestedValidation.isValid;
                    validation.errors.push(...nestedValidation.errors);
                    validation.warnings.push(...nestedValidation.warnings);
                } else if (rules.type === 'array' && rules.items) {
                    if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            const itemPath = `${currentPath}[${index}]`;
                            if (rules.items.properties) {
                                const itemValidation = this.validateNested(item, rules.items.properties, itemPath);
                                validation.isValid = validation.isValid && itemValidation.isValid;
                                validation.errors.push(...itemValidation.errors);
                                validation.warnings.push(...itemValidation.warnings);
                            } else {
                                const itemValidation = this.validateField(
                                    { name: itemPath, type: rules.items.type || 'text' }, 
                                    item, 
                                    rules.items
                                );
                                validation.isValid = validation.isValid && itemValidation.isValid;
                                validation.errors.push(...itemValidation.errors);
                                validation.warnings.push(...itemValidation.warnings);
                            }
                        });
                    } else {
                        validation.isValid = false;
                        validation.errors.push(`${currentPath} must be an array`);
                    }
                } else {
                    // Simple field validation
                    const fieldValidation = this.validateField({ name: key, type: rules.type || 'text' }, value, rules);
                    validation.isValid = validation.isValid && fieldValidation.isValid;
                    validation.errors.push(...fieldValidation.errors.map(error => `${currentPath}: ${error}`));
                    validation.warnings.push(...fieldValidation.warnings.map(warning => `${currentPath}: ${warning}`));
                }
            }
        });

        return validation;
    }

    /**
     * Validate file upload data
     */
    validateFileUpload(fileData, allowedTypes = [], maxSize = 10 * 1024 * 1024) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!fileData) {
            validation.isValid = false;
            validation.errors.push('No file data provided');
            return validation;
        }

        // Size validation
        if (fileData.size > maxSize) {
            validation.isValid = false;
            validation.errors.push(`File size exceeds maximum allowed size of ${maxSize} bytes`);
        }

        // Type validation
        if (allowedTypes.length > 0 && fileData.type && !allowedTypes.includes(fileData.type)) {
            validation.isValid = false;
            validation.errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
        }

        // Filename validation
        if (fileData.name) {
            if (!/^[a-zA-Z0-9._-]+$/.test(fileData.name)) {
                validation.warnings.push('Filename contains special characters');
            }

            if (fileData.name.length > 255) {
                validation.isValid = false;
                validation.errors.push('Filename is too long (max 255 characters)');
            }
        }

        return validation;
    }

    /**
     * Create custom validator
     */
    createValidator(rules) {
        return (data) => {
            const validation = {
                isValid: true,
                errors: [],
                warnings: [],
                sanitizedData: {}
            };

            Object.keys(rules).forEach(field => {
                const rule = rules[field];
                const value = data[field];
                
                const fieldValidation = this.validateField(
                    { name: field, type: rule.type || 'text' },
                    value,
                    rule
                );

                validation.isValid = validation.isValid && fieldValidation.isValid;
                validation.errors.push(...fieldValidation.errors);
                validation.warnings.push(...fieldValidation.warnings);
                validation.sanitizedData[field] = fieldValidation.sanitizedValue;
            });

            return validation;
        };
    }

    /**
     * Validate configuration objects
     */
    validateConfig(config, configSchema) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Check required configuration keys
        if (configSchema.required) {
            configSchema.required.forEach(key => {
                if (!(key in config)) {
                    validation.isValid = false;
                    validation.errors.push(`Required configuration key missing: ${key}`);
                }
            });
        }

        // Validate each configuration value
        if (configSchema.properties) {
            Object.keys(configSchema.properties).forEach(key => {
                if (key in config) {
                    const propSchema = configSchema.properties[key];
                    const value = config[key];
                    
                    const propValidation = this.validateAgainstSchema({ [key]: value }, { 
                        type: 'object', 
                        properties: { [key]: propSchema } 
                    });
                    validation.isValid = validation.isValid && propValidation.isValid;
                    validation.errors.push(...propValidation.errors);
                    validation.warnings.push(...propValidation.warnings);
                }
            });
        }

        return validation;
    }

    /**
     * Generate validation report
     */
    generateValidationReport(validationResults) {
        const report = {
            summary: {
                totalValidations: validationResults.length,
                passedValidations: validationResults.filter(r => r.isValid).length,
                failedValidations: validationResults.filter(r => !r.isValid).length,
                totalErrors: validationResults.reduce((sum, r) => sum + r.errors.length, 0),
                totalWarnings: validationResults.reduce((sum, r) => sum + r.warnings.length, 0)
            },
            details: validationResults,
            timestamp: new Date().toISOString()
        };

        report.summary.successRate = report.summary.totalValidations > 0 ? 
            (report.summary.passedValidations / report.summary.totalValidations * 100).toFixed(2) : 0;

        return report;
    }
}

module.exports = new ValidationUtils();