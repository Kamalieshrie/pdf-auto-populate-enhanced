// server/middleware/upload.js - File Upload Middleware with Security and Validation
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const appConfig = require('../config/app-config');
const { fileError } = require('./error-handler');

class UploadMiddleware {
    constructor() {
        this.uploadDir = appConfig.directories.uploads;
        this.tempDir = appConfig.directories.temp;
        this.maxFileSize = appConfig.upload.maxFileSize;
        this.maxFiles = appConfig.upload.maxFiles;
        this.allowedMimeTypes = appConfig.upload.allowedMimeTypes;
        this.allowedExtensions = appConfig.upload.allowedExtensions;
        this.uploadTimeout = appConfig.upload.timeout;
    }

    /**
     * Initialize upload directories
     */
    async initializeDirectories() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log('✅ Upload directories initialized');
        } catch (error) {
            console.error('❌ Failed to initialize upload directories:', error.message);
            throw error;
        }
    }

    /**
     * Create multer storage configuration
     */
    createStorage(options = {}) {
        const useTemp = options.temp || false;
        const directory = useTemp ? this.tempDir : this.uploadDir;

        return multer.diskStorage({
            destination: async (req, file, cb) => {
                try {
                    await fs.mkdir(directory, { recursive: true });
                    cb(null, directory);
                } catch (error) {
                    cb(error);
                }
            },
            filename: (req, file, cb) => {
                // Generate secure filename
                const timestamp = Date.now();
                const random = crypto.randomBytes(8).toString('hex');
                const extension = path.extname(file.originalname).toLowerCase();
                const secureName = `${timestamp}-${random}${extension}`;
                
                // Store original filename in file object
                file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
                cb(null, secureName);
            }
        });
    }

    /**
     * File filter function
     */
    createFileFilter(options = {}) {
        return (req, file, cb) => {
            // Check MIME type
            if (!this.allowedMimeTypes.includes(file.mimetype)) {
                const error = fileError(
                    `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
                    'INVALID_MIME_TYPE'
                );
                return cb(error, false);
            }

            // Check file extension
            const extension = path.extname(file.originalname).toLowerCase();
            if (!this.allowedExtensions.includes(extension)) {
                const error = fileError(
                    `Invalid file extension. Allowed extensions: ${this.allowedExtensions.join(', ')}`,
                    'INVALID_EXTENSION'
                );
                return cb(error, false);
            }

            // Check filename length
            if (file.originalname.length > 255) {
                const error = fileError('Filename too long (max 255 characters)', 'FILENAME_TOO_LONG');
                return cb(error, false);
            }

            // Check for dangerous characters in filename
            const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
            if (dangerousChars.test(file.originalname)) {
                const error = fileError('Filename contains invalid characters', 'INVALID_FILENAME');
                return cb(error, false);
            }

            cb(null, true);
        };
    }

    /**
     * Create multer configuration
     */
    createMulterConfig(options = {}) {
        return {
            storage: this.createStorage(options),
            fileFilter: this.createFileFilter(options),
            limits: {
                fileSize: options.maxFileSize || this.maxFileSize,
                files: options.maxFiles || this.maxFiles,
                fieldSize: 10 * 1024 * 1024, // 10MB for form fields
                fieldNameSize: 1000,
                fields: 20
            }
        };
    }

    /**
     * PDF upload middleware
     */
    pdfUpload(options = {}) {
        const config = this.createMulterConfig({
            ...options,
            maxFileSize: options.maxFileSize || this.maxFileSize
        });

        const upload = multer(config).single('pdfTemplate');

        return (req, res, next) => {
            // Set timeout for upload
            const timeout = setTimeout(() => {
                const error = fileError('Upload timeout', 'UPLOAD_TIMEOUT');
                next(error);
            }, this.uploadTimeout);

            upload(req, res, (error) => {
                clearTimeout(timeout);

                if (error) {
                    return next(error);
                }

                // Validate uploaded file
                if (req.file) {
                    this.validateUploadedFile(req.file)
                        .then(() => next())
                        .catch(next);
                } else {
                    next();
                }
            });
        };
    }

    /**
     * Template file upload middleware
     */
    templateUpload(options = {}) {
        const config = this.createMulterConfig({
            ...options,
            maxFileSize: 5 * 1024 * 1024 // 5MB for templates
        });

        // Override file filter for JSON templates
        config.fileFilter = (req, file, cb) => {
            if (file.mimetype === 'application/json' || 
                path.extname(file.originalname).toLowerCase() === '.json') {
                cb(null, true);
            } else {
                const error = fileError('Only JSON template files are allowed', 'INVALID_TEMPLATE_TYPE');
                cb(error, false);
            }
        };

        return multer(config).single('templateFile');
    }

    /**
     * Multiple files upload middleware
     */
    multipleUpload(fieldName, maxCount = 5, options = {}) {
        const config = this.createMulterConfig(options);
        const upload = multer(config).array(fieldName, maxCount);

        return (req, res, next) => {
            upload(req, res, async (error) => {
                if (error) {
                    return next(error);
                }

                // Validate all uploaded files
                if (req.files && req.files.length > 0) {
                    try {
                        for (const file of req.files) {
                            await this.validateUploadedFile(file);
                        }
                        next();
                    } catch (validationError) {
                        next(validationError);
                    }
                } else {
                    next();
                }
            });
        };
    }

    /**
     * Validate uploaded file
     */
    async validateUploadedFile(file) {
        try {
            // Check if file exists
            await fs.access(file.path);

            // Get file stats
            const stats = await fs.stat(file.path);

            // Verify file size matches what multer reported
            if (stats.size !== file.size) {
                throw fileError('File size mismatch', 'SIZE_MISMATCH');
            }

            // Additional PDF validation
            if (file.mimetype === 'application/pdf') {
                await this.validatePdfFile(file);
            }

            // Additional JSON validation for templates
            if (file.mimetype === 'application/json') {
                await this.validateJsonFile(file);
            }

            console.log(`✅ File validated: ${file.originalname} (${this.formatFileSize(file.size)})`);
        } catch (error) {
            // Clean up invalid file
            await fs.unlink(file.path).catch(() => {});
            throw error;
        }
    }

    /**
     * Validate PDF file
     */
    async validatePdfFile(file) {
        try {
            const buffer = await fs.readFile(file.path);

            // Check PDF magic number
            if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
                throw fileError('Invalid PDF file format', 'INVALID_PDF');
            }

            // Check for PDF version
            const versionMatch = buffer.subarray(0, 8).toString().match(/%PDF-(\d\.\d)/);
            if (!versionMatch) {
                throw fileError('Could not determine PDF version', 'INVALID_PDF_VERSION');
            }

            const version = versionMatch[1];
            if (!appConfig.pdf.allowedVersions.includes(version)) {
                throw fileError(
                    `Unsupported PDF version ${version}. Supported versions: ${appConfig.pdf.allowedVersions.join(', ')}`,
                    'UNSUPPORTED_PDF_VERSION'
                );
            }

            // Check for potential security issues (basic check)
            if (buffer.includes(Buffer.from('/JavaScript')) || buffer.includes(Buffer.from('/JS'))) {
                console.warn(`⚠️  PDF contains JavaScript: ${file.originalname}`);
            }

        } catch (error) {
            if (error.code) throw error;
            throw fileError('PDF validation failed: ' + error.message, 'PDF_VALIDATION_ERROR');
        }
    }

    /**
     * Validate JSON file
     */
    async validateJsonFile(file) {
        try {
            const content = await fs.readFile(file.path, 'utf8');
            JSON.parse(content); // Will throw if invalid JSON
        } catch (error) {
            throw fileError('Invalid JSON file format', 'INVALID_JSON');
        }
    }

    /**
     * Clean up uploaded files after processing
     */
    async cleanupFile(filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`🗑️  Cleaned up file: ${path.basename(filePath)}`);
        } catch (error) {
            console.warn(`⚠️  Could not clean up file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Clean up old files in upload directories
     */
    async cleanupOldFiles(maxAgeHours = 24) {
        const directories = [this.uploadDir, this.tempDir];
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleanedCount = 0;

        for (const dir of directories) {
            try {
                const files = await fs.readdir(dir);
                
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime.getTime() < cutoffTime) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                        console.log(`🗑️  Cleaned up old file: ${file}`);
                    }
                }
            } catch (error) {
                console.error(`Error cleaning up directory ${dir}:`, error.message);
            }
        }

        if (cleanedCount > 0) {
            console.log(`✅ Cleaned up ${cleanedCount} old files`);
        }

        return cleanedCount;
    }

    /**
     * Get upload statistics
     */
    async getUploadStats() {
        const directories = [this.uploadDir, this.tempDir];
        const stats = {
            totalFiles: 0,
            totalSize: 0,
            directories: {}
        };

        for (const dir of directories) {
            try {
                const files = await fs.readdir(dir);
                let dirSize = 0;
                
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const fileStats = await fs.stat(filePath);
                    dirSize += fileStats.size;
                }
                
                stats.directories[path.basename(dir)] = {
                    fileCount: files.length,
                    size: dirSize,
                    formattedSize: this.formatFileSize(dirSize)
                };
                
                stats.totalFiles += files.length;
                stats.totalSize += dirSize;
            } catch (error) {
                console.error(`Error getting stats for ${dir}:`, error.message);
            }
        }

        stats.formattedTotalSize = this.formatFileSize(stats.totalSize);
        return stats;
    }

    /**
     * Middleware to add file cleanup to response
     */
    addFileCleanup() {
        return (req, res, next) => {
            const originalSend = res.send;
            
            res.send = function(data) {
                // Clean up uploaded files after response
                if (req.file) {
                    setTimeout(() => {
                        uploadMiddleware.cleanupFile(req.file.path);
                    }, 1000);
                }
                
                if (req.files) {
                    setTimeout(() => {
                        req.files.forEach(file => {
                            uploadMiddleware.cleanupFile(file.path);
                        });
                    }, 1000);
                }
                
                originalSend.call(this, data);
            };
            
            next();
        };
    }

    // Utility methods

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileExtension(filename) {
        return path.extname(filename).toLowerCase();
    }

    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 255);
    }
}

// Create singleton instance
const uploadMiddleware = new UploadMiddleware();

// Initialize directories on startup
uploadMiddleware.initializeDirectories().catch(console.error);

// Export middleware functions
module.exports = {
    pdfUpload: uploadMiddleware.pdfUpload.bind(uploadMiddleware),
    templateUpload: uploadMiddleware.templateUpload.bind(uploadMiddleware),
    multipleUpload: uploadMiddleware.multipleUpload.bind(uploadMiddleware),
    cleanupFile: uploadMiddleware.cleanupFile.bind(uploadMiddleware),
    cleanupOldFiles: uploadMiddleware.cleanupOldFiles.bind(uploadMiddleware),
    getUploadStats: uploadMiddleware.getUploadStats.bind(uploadMiddleware),
    addFileCleanup: uploadMiddleware.addFileCleanup.bind(uploadMiddleware),
    UploadMiddleware
};