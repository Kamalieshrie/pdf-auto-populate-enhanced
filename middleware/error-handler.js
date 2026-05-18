// server/middleware/error-handler.js - Comprehensive Error Handling Middleware
const fs = require('fs').promises;
const path = require('path');
const appConfig = require('../config/app-config');

class ErrorHandler {
    constructor() {
        this.logFile = path.join(appConfig.directories.logs, 'error.log');
        this.isProduction = appConfig.server.isProduction;
        this.logLevel = appConfig.logging.level;
        this.enableLogging = appConfig.logging.enableConsole || appConfig.logging.file;
    }

    /**
     * Main error handling middleware
     */
    handle() {
        return (error, req, res, next) => {
            // Log the error
            this.logError(error, req);

            // Determine error type and response
            const errorResponse = this.createErrorResponse(error, req);

            // Send response
            res.status(errorResponse.status).json(errorResponse);
        };
    }

    /**
     * Create standardized error response
     */
    createErrorResponse(error, req) {
        const errorId = this.generateErrorId();
        
        // Base error response
        const response = {
            success: false,
            error: {
                id: errorId,
                message: 'An error occurred',
                type: 'internal_error',
                timestamp: new Date().toISOString()
            }
        };

        // Handle specific error types
        if (error.name === 'ValidationError') {
            response.error.type = 'validation_error';
            response.error.message = 'Validation failed';
            response.error.details = error.details || error.message;
            response.status = 400;
        } 
        else if (error.name === 'MulterError') {
            response.error.type = 'upload_error';
            response.status = 400;
            
            switch (error.code) {
                case 'LIMIT_FILE_SIZE':
                    response.error.message = `File too large. Maximum size: ${this.formatFileSize(error.limit)}`;
                    break;
                case 'LIMIT_FILE_COUNT':
                    response.error.message = `Too many files. Maximum: ${error.limit}`;
                    break;
                case 'LIMIT_UNEXPECTED_FILE':
                    response.error.message = 'Unexpected file field';
                    break;
                default:
                    response.error.message = 'File upload failed';
            }
        }
        else if (error.code === 'ENOENT') {
            response.error.type = 'file_not_found';
            response.error.message = 'File not found';
            response.status = 404;
        }
        else if (error.code === 'EACCES') {
            response.error.type = 'permission_denied';
            response.error.message = 'Permission denied';
            response.status = 403;
        }
        else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
            response.error.type = 'json_parse_error';
            response.error.message = 'Invalid JSON format';
            response.status = 400;
        }
        else if (error.message && error.message.includes('PDF')) {
            response.error.type = 'pdf_processing_error';
            response.error.message = 'PDF processing failed';
            response.status = 422;
        }
        else if (error.status) {
            response.status = error.status;
            response.error.message = error.message || 'Request failed';
            response.error.type = this.getErrorTypeFromStatus(error.status);
        }
        else {
            response.status = 500;
            response.error.message = this.isProduction ? 'Internal server error' : error.message;
        }

        // Add development details
        if (!this.isProduction && error.stack) {
            response.error.stack = error.stack;
            response.error.details = {
                name: error.name,
                code: error.code,
                syscall: error.syscall,
                path: error.path
            };
        }

        // Add request context
        response.error.request = {
            method: req.method,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            ip: this.getClientIP(req)
        };

        return response;
    }

    /**
     * Log error to console and/or file
     */
    async logError(error, req) {
        if (!this.enableLogging) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: error.message,
            stack: error.stack,
            request: {
                method: req.method,
                url: req.originalUrl,
                headers: req.headers,
                body: this.sanitizeRequestBody(req.body),
                ip: this.getClientIP(req)
            },
            error: {
                name: error.name,
                code: error.code,
                status: error.status
            }
        };

        // Console logging
        if (appConfig.logging.enableConsole) {
            console.error('\n=== ERROR LOG ===');
            console.error(`${logEntry.timestamp} - ${error.name}: ${error.message}`);
            console.error(`Request: ${req.method} ${req.originalUrl}`);
            console.error(`IP: ${logEntry.request.ip}`);
            if (!this.isProduction && error.stack) {
                console.error('Stack:', error.stack);
            }
            console.error('================\n');
        }

        // File logging
        if (appConfig.logging.file) {
            try {
                await fs.mkdir(appConfig.directories.logs, { recursive: true });
                const logString = JSON.stringify(logEntry) + '\n';
                await fs.appendFile(this.logFile, logString);
            } catch (logError) {
                console.error('Failed to write error log:', logError.message);
            }
        }
    }

    /**
     * Handle 404 errors
     */
    handle404() {
        return (req, res, next) => {
            const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
            error.status = 404;
            error.name = 'NotFoundError';
            next(error);
        };
    }

    /**
     * Handle async route errors
     */
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Validation error handler
     */
    validationError(message, details = null) {
        const error = new Error(message);
        error.name = 'ValidationError';
        error.details = details;
        return error;
    }

    /**
     * File processing error handler
     */
    fileError(message, code = 'FILE_ERROR') {
        const error = new Error(message);
        error.name = 'FileError';
        error.code = code;
        return error;
    }

    /**
     * PDF processing error handler
     */
    pdfError(message, details = null) {
        const error = new Error(message);
        error.name = 'PDFError';
        error.details = details;
        return error;
    }

    // Utility methods

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getErrorTypeFromStatus(status) {
        const statusTypes = {
            400: 'bad_request',
            401: 'unauthorized',
            403: 'forbidden',
            404: 'not_found',
            405: 'method_not_allowed',
            409: 'conflict',
            422: 'unprocessable_entity',
            429: 'too_many_requests',
            500: 'internal_server_error',
            501: 'not_implemented',
            502: 'bad_gateway',
            503: 'service_unavailable'
        };
        return statusTypes[status] || 'unknown_error';
    }

    getClientIP(req) {
        return req.ip || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0] ||
               'unknown';
    }

    sanitizeRequestBody(body) {
        if (!body) return null;

        // Remove sensitive fields
        const sanitized = { ...body };
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        
        Object.keys(sanitized).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Rate limiting error
     */
    rateLimitError() {
        const error = new Error('Too many requests. Please try again later.');
        error.status = 429;
        error.name = 'RateLimitError';
        return error;
    }

    /**
     * Clean up old error logs
     */
    async cleanupLogs() {
        try {
            const logDir = appConfig.directories.logs;
            const files = await fs.readdir(logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep logs for 30 days

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(logDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.unlink(filePath);
                        console.log(`Cleaned up old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error cleaning up logs:', error.message);
        }
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Export middleware functions
module.exports = {
    handle: errorHandler.handle.bind(errorHandler),
    handle404: errorHandler.handle404.bind(errorHandler),
    asyncHandler: errorHandler.asyncHandler.bind(errorHandler),
    validationError: errorHandler.validationError.bind(errorHandler),
    fileError: errorHandler.fileError.bind(errorHandler),
    pdfError: errorHandler.pdfError.bind(errorHandler),
    rateLimitError: errorHandler.rateLimitError.bind(errorHandler),
    cleanupLogs: errorHandler.cleanupLogs.bind(errorHandler),
    ErrorHandler
};