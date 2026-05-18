// server/config/app-config.js - Application Configuration
const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
    // Server Configuration
    server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || 'localhost',
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
    },

    // File Upload Configuration
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
        maxFiles: parseInt(process.env.MAX_FILES) || 10,
        timeout: parseInt(process.env.UPLOAD_TIMEOUT) || 30000, // 30 seconds
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['.pdf'],
    },

    // Directory Configuration
    directories: {
        root: path.resolve(__dirname, '../..'),
        uploads: path.resolve(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads'),
        output: path.resolve(__dirname, '../..', process.env.OUTPUT_DIR || 'output'),
        templates: path.resolve(__dirname, '../..', process.env.TEMPLATE_DIR || 'templates'),
        temp: path.resolve(__dirname, '../..', process.env.TEMP_DIR || 'temp'),
        public: path.resolve(__dirname, '../..', process.env.PUBLIC_DIR || 'public'),
        logs: path.resolve(__dirname, '../..', 'logs'),
    },

    // PDF Processing Configuration
    pdf: {
        quality: process.env.PDF_QUALITY || 'high',
        compression: process.env.PDF_COMPRESSION || 'medium',
        maxSize: parseInt(process.env.MAX_PDF_SIZE) || 50 * 1024 * 1024,
        allowedVersions: (process.env.ALLOWED_PDF_VERSIONS || '1.4,1.5,1.6,1.7').split(','),
        defaultFont: 'Helvetica',
        defaultFontSize: 12,
        defaultTextColor: { r: 0, g: 0, b: 0 },
    },

    // Security Configuration
    security: {
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-me',
        rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        },
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                },
            },
        },
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log',
        enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
        enableConsole: process.env.NODE_ENV !== 'production',
        format: process.env.NODE_ENV === 'production' ? 'json' : 'simple',
    },

    // Template Storage Configuration
    templates: {
        maxPerUser: parseInt(process.env.MAX_TEMPLATES_PER_USER) || 50,
        retentionDays: parseInt(process.env.TEMPLATE_RETENTION_DAYS) || 365,
        allowedFormats: ['json'],
        maxNameLength: 50,
        maxDescriptionLength: 200,
    },

    // Canvas Configuration
    canvas: {
        maxWidth: parseInt(process.env.MAX_CANVAS_WIDTH) || 1200,
        maxHeight: parseInt(process.env.MAX_CANVAS_HEIGHT) || 1600,
        defaultZoom: parseInt(process.env.DEFAULT_ZOOM) || 100,
        minZoom: parseInt(process.env.MIN_ZOOM) || 25,
        maxZoom: parseInt(process.env.MAX_ZOOM) || 500,
        gridSize: 10,
        snapToGrid: true,
    },

    // Field Configuration
    fields: {
        maxCustomFields: parseInt(process.env.MAX_CUSTOM_FIELDS) || 100,
        maxLabelLength: parseInt(process.env.MAX_FIELD_LABEL_LENGTH) || 100,
        maxValueLength: parseInt(process.env.MAX_FIELD_VALUE_LENGTH) || 1000,
        types: {
            TEXT: 'text',
            CHECKBOX: 'checkbox',
            DATE: 'date',
            SIGNATURE: 'signature',
            INITIALS: 'initials',
            RADIO: 'radio',
        },
        defaultSizes: {
            text: { width: 120, height: 20 },
            checkbox: { width: 15, height: 15 },
            date: { width: 100, height: 20 },
            signature: { width: 200, height: 60 },
            initials: { width: 60, height: 30 },
            radio: { width: 15, height: 15 },
        },
    },

    // Signature Configuration
    signature: {
        maxWidth: parseInt(process.env.SIGNATURE_MAX_WIDTH) || 400,
        maxHeight: parseInt(process.env.SIGNATURE_MAX_HEIGHT) || 200,
        format: process.env.SIGNATURE_FORMAT || 'png',
        quality: parseFloat(process.env.SIGNATURE_QUALITY) || 0.9,
        backgroundColor: 'transparent',
        penColor: '#000000',
        penWidth: 2,
    },

    // Cache Configuration
    cache: {
        enabled: process.env.REDIS_URL ? true : false,
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: parseInt(process.env.REDIS_TTL) || 3600, // 1 hour
        keyPrefix: 'pdf-system:',
    },

    // Email Configuration
    email: {
        enabled: process.env.SMTP_HOST ? true : false,
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
        },
        from: process.env.EMAIL_FROM || 'PDF System <noreply@localhost>',
    },

    // AWS S3 Configuration
    aws: {
        enabled: process.env.AWS_ACCESS_KEY_ID ? true : false,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
        s3: {
            bucket: process.env.AWS_S3_BUCKET || '',
            acl: 'private',
            expires: 3600, // 1 hour for signed URLs
        },
    },

    // Property Data Configuration
    propertyData: {
        default: JSON.parse(process.env.DEFAULT_PROPERTY_DATA || JSON.stringify({
            property: 1,
            name: "Unit A101",
            beds: 2,
            baths: 1,
            sqft: 850,
            rent: "1200.00",
            management_fee: "100.00",
            balance_amount: "50.00",
            threshold_amount: "200.00",
            disbursement_amount: "1150.00",
            status: "available"
        })),
        mappings: {
            // Field name mappings for auto-population
            name: ['name', 'address', 'property_address', 'premises', 'unit', 'property_name', 'property'],
            beds: ['bedrooms', 'beds', 'bedroom_count', 'num_bedrooms', 'bed_count'],
            baths: ['bathrooms', 'baths', 'bathroom_count', 'num_bathrooms', 'bath_count'],
            rent: ['rent', 'rent_amount', 'monthly_rent', 'rental_amount', 'rent_per_month'],
            sqft: ['sqft', 'square_feet', 'sq_ft', 'area'],
            management_fee: ['management_fee', 'mgmt_fee', 'fee'],
            balance_amount: ['balance', 'balance_amount', 'remaining_balance'],
            threshold_amount: ['threshold', 'threshold_amount', 'minimum_balance'],
            disbursement_amount: ['disbursement', 'disbursement_amount', 'payout'],
            status: ['status', 'availability', 'state'],
        },
    },

    // Feature Flags
    features: {
        templates: process.env.ENABLE_TEMPLATES !== 'false',
        signatures: process.env.ENABLE_SIGNATURES !== 'false',
        cloudStorage: process.env.ENABLE_CLOUD_STORAGE === 'true',
        userAccounts: process.env.ENABLE_USER_ACCOUNTS === 'true',
        analytics: process.env.ENABLE_ANALYTICS === 'true',
        realTimePreview: true,
        fieldValidation: true,
        autoSave: true,
    },

    // Development Configuration
    development: {
        debug: process.env.DEBUG === 'true',
        hotReload: process.env.HOT_RELOAD === 'true',
        mockData: process.env.MOCK_DATA === 'true',
        verbose: true,
    },

    // API Configuration
    api: {
        version: 'v1',
        prefix: '/api',
        timeout: 30000,
        maxRetries: 3,
        endpoints: {
            inspectPdf: '/inspect-pdf',
            populatePdf: '/populate-pdf',
            saveTemplate: '/save-template',
            loadTemplates: '/templates',
            propertyData: '/property-data',
            health: '/health',
        },
    },
};

// Validation function
function validateConfig() {
    const errors = [];

    // Validate required directories
    if (!config.directories.uploads) {
        errors.push('Upload directory not configured');
    }

    // Validate file size limits
    if (config.upload.maxFileSize > 100 * 1024 * 1024) {
        errors.push('Maximum file size too large (>100MB)');
    }

    // Validate security settings
    if (config.server.isProduction && config.security.sessionSecret === 'default-secret-change-me') {
        errors.push('Session secret must be changed in production');
    }

    if (errors.length > 0) {
        throw new Error('Configuration validation failed: ' + errors.join(', '));
    }
}

// Environment-specific overrides
if (config.server.isProduction) {
    // Production overrides
    config.logging.enableConsole = false;
    config.development.debug = false;
    config.development.verbose = false;
    config.security.rateLimit.max = 50; // Stricter rate limiting
}

// Validate configuration on load
try {
    validateConfig();
} catch (error) {
    console.error('Configuration Error:', error.message);
    if (config.server.isProduction) {
        process.exit(1);
    }
}

module.exports = config;