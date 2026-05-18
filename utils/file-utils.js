/**
 * File Utilities
 * Handles file operations, validation, storage management, and file system operations
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class FileUtils {
    constructor() {
        this.uploadDir = path.join(process.cwd(), 'public', 'uploads');
        this.tempDir = path.join(process.cwd(), 'temp');
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
        this.maxFiles = 100; // Maximum files per directory
        this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        // Supported file types
        this.supportedTypes = {
            pdf: {
                mimeTypes: ['application/pdf'],
                extensions: ['.pdf'],
                maxSize: 50 * 1024 * 1024 // 50MB
            },
            image: {
                mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
                maxSize: 10 * 1024 * 1024 // 10MB
            },
            template: {
                mimeTypes: ['application/json', 'text/plain'],
                extensions: ['.json', '.txt'],
                maxSize: 1 * 1024 * 1024 // 1MB
            }
        };

        // Directory structure
        this.directories = {
            pdfs: path.join(this.uploadDir, 'pdfs'),
            templates: path.join(this.uploadDir, 'templates'),
            signatures: path.join(this.uploadDir, 'signatures'),
            temp: this.tempDir,
            backups: path.join(this.uploadDir, 'backups'),
            exports: path.join(this.uploadDir, 'exports')
        };

        this.initializeDirectories();
    }

    /**
     * Initialize required directories
     */
    async initializeDirectories() {
        try {
            for (const [key, dir] of Object.entries(this.directories)) {
                await this.ensureDirectoryExists(dir);
            }
        } catch (error) {
            console.error('Failed to initialize directories:', error);
        }
    }

    /**
     * Ensure directory exists
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dirPath, { recursive: true });
            } else {
                throw error;
            }
        }
    }

    /**
     * Validate file before processing
     */
    validateFile(file, fileType = 'pdf') {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!file) {
            validation.isValid = false;
            validation.errors.push('No file provided');
            return validation;
        }

        const typeConfig = this.supportedTypes[fileType];
        if (!typeConfig) {
            validation.isValid = false;
            validation.errors.push(`Unsupported file type: ${fileType}`);
            return validation;
        }

        // Check file size
        if (file.size > typeConfig.maxSize) {
            validation.isValid = false;
            validation.errors.push(`File size exceeds maximum allowed size of ${this.formatFileSize(typeConfig.maxSize)}`);
        }

        // Check MIME type
        if (!typeConfig.mimeTypes.includes(file.mimetype)) {
            validation.isValid = false;
            validation.errors.push(`Invalid MIME type. Expected: ${typeConfig.mimeTypes.join(', ')}, Got: ${file.mimetype}`);
        }

        // Check file extension
        const ext = path.extname(file.originalname || file.name || '').toLowerCase();
        if (!typeConfig.extensions.includes(ext)) {
            validation.isValid = false;
            validation.errors.push(`Invalid file extension. Expected: ${typeConfig.extensions.join(', ')}, Got: ${ext}`);
        }

        // Check for suspicious file names
        const filename = file.originalname || file.name || '';
        if (this.containsSuspiciousPatterns(filename)) {
            validation.warnings.push('File name contains suspicious patterns');
        }

        return validation;
    }

    /**
     * Save uploaded file
     */
    async saveFile(file, fileType = 'pdf', customName = null) {
        try {
            const validation = this.validateFile(file, fileType);
            if (!validation.isValid) {
                throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
            }

            const targetDir = this.directories[fileType === 'pdf' ? 'pdfs' : fileType];
            await this.ensureDirectoryExists(targetDir);

            // Generate unique filename
            const ext = path.extname(file.originalname || file.name || '');
            const filename = customName 
                ? this.sanitizeFilename(customName) + ext
                : this.generateUniqueFilename(ext);

            const filePath = path.join(targetDir, filename);

            // Check if file already exists
            if (await this.fileExists(filePath)) {
                const uniqueFilename = this.generateUniqueFilename(ext, path.parse(filename).name);
                filePath = path.join(targetDir, uniqueFilename);
            }

            // Save file
            if (file.buffer) {
                await fs.writeFile(filePath, file.buffer);
            } else if (file.path) {
                await fs.copyFile(file.path, filePath);
                // Clean up temporary file
                await this.deleteFile(file.path).catch(() => {});
            } else {
                throw new Error('Invalid file object - no buffer or path provided');
            }

            const stats = await fs.stat(filePath);
            const fileHash = await this.calculateFileHash(filePath);

            return {
                filename,
                originalName: file.originalname || file.name,
                path: filePath,
                relativePath: path.relative(this.uploadDir, filePath),
                size: stats.size,
                mimetype: file.mimetype,
                hash: fileHash,
                uploadedAt: new Date(),
                type: fileType
            };

        } catch (error) {
            throw new Error(`Failed to save file: ${error.message}`);
        }
    }

    /**
     * Load file from storage
     */
    async loadFile(filePath, asBuffer = true) {
        try {
            if (!await this.fileExists(filePath)) {
                throw new Error('File not found');
            }

            if (asBuffer) {
                return await fs.readFile(filePath);
            } else {
                return filePath;
            }
        } catch (error) {
            throw new Error(`Failed to load file: ${error.message}`);
        }
    }

    /**
     * Delete file
     */
    async deleteFile(filePath) {
        try {
            if (await this.fileExists(filePath)) {
                await fs.unlink(filePath);
                return true;
            }
            return false;
        } catch (error) {
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }

    /**
     * Move file to different directory
     */
    async moveFile(sourcePath, targetPath) {
        try {
            await this.ensureDirectoryExists(path.dirname(targetPath));
            await fs.rename(sourcePath, targetPath);
            return targetPath;
        } catch (error) {
            throw new Error(`Failed to move file: ${error.message}`);
        }
    }

    /**
     * Copy file
     */
    async copyFile(sourcePath, targetPath) {
        try {
            await this.ensureDirectoryExists(path.dirname(targetPath));
            await fs.copyFile(sourcePath, targetPath);
            return targetPath;
        } catch (error) {
            throw new Error(`Failed to copy file: ${error.message}`);
        }
    }

    /**
     * Create backup of file
     */
    async backupFile(filePath, backupDir = null) {
        try {
            const targetDir = backupDir || this.directories.backups;
            await this.ensureDirectoryExists(targetDir);

            const filename = path.basename(filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `${path.parse(filename).name}_${timestamp}${path.extname(filename)}`;
            const backupPath = path.join(targetDir, backupFilename);

            await this.copyFile(filePath, backupPath);

            return {
                originalPath: filePath,
                backupPath,
                backupFilename,
                timestamp: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to backup file: ${error.message}`);
        }
    }

    /**
     * List files in directory
     */
    async listFiles(dirPath, options = {}) {
        try {
            const {
                recursive = false,
                extensions = null,
                sortBy = 'name',
                sortOrder = 'asc',
                includeStats = false
            } = options;

            let files = [];

            const readDir = async (currentPath, relativePath = '') => {
                const entries = await fs.readdir(currentPath);
                
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry);
                    const relPath = path.join(relativePath, entry);
                    const stats = await fs.stat(fullPath);

                    if (stats.isDirectory()) {
                        if (recursive) {
                            await readDir(fullPath, relPath);
                        }
                    } else {
                        const ext = path.extname(entry).toLowerCase();
                        if (!extensions || extensions.includes(ext)) {
                            const fileInfo = {
                                name: entry,
                                path: fullPath,
                                relativePath: relPath,
                                extension: ext,
                                size: stats.size
                            };

                            if (includeStats) {
                                fileInfo.stats = {
                                    created: stats.birthtime,
                                    modified: stats.mtime,
                                    accessed: stats.atime,
                                    isFile: stats.isFile(),
                                    isDirectory: stats.isDirectory()
                                };
                            }

                            files.push(fileInfo);
                        }
                    }
                }
            };

            await readDir(dirPath);

            // Sort files
            files.sort((a, b) => {
                let aValue, bValue;
                
                switch (sortBy) {
                    case 'size':
                        aValue = a.size;
                        bValue = b.size;
                        break;
                    case 'modified':
                        aValue = a.stats?.modified || new Date(0);
                        bValue = b.stats?.modified || new Date(0);
                        break;
                    case 'created':
                        aValue = a.stats?.created || new Date(0);
                        bValue = b.stats?.created || new Date(0);
                        break;
                    case 'name':
                    default:
                        aValue = a.name.toLowerCase();
                        bValue = b.name.toLowerCase();
                        break;
                }

                if (sortOrder === 'desc') {
                    return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                } else {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                }
            });

            return files;

        } catch (error) {
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    /**
     * Get file information
     */
    async getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const hash = await this.calculateFileHash(filePath);

            return {
                name: path.basename(filePath),
                path: filePath,
                size: stats.size,
                extension: path.extname(filePath),
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                hash,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                permissions: stats.mode
            };
        } catch (error) {
            throw new Error(`Failed to get file info: ${error.message}`);
        }
    }

    /**
     * Calculate file hash
     */
    async calculateFileHash(filePath, algorithm = 'sha256') {
        try {
            const buffer = await fs.readFile(filePath);
            return crypto.createHash(algorithm).update(buffer).digest('hex');
        } catch (error) {
            throw new Error(`Failed to calculate file hash: ${error.message}`);
        }
    }

    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get directory size
     */
    async getDirectorySize(dirPath) {
        try {
            let totalSize = 0;
            
            const calculateSize = async (currentPath) => {
                const entries = await fs.readdir(currentPath);
                
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry);
                    const stats = await fs.stat(fullPath);
                    
                    if (stats.isDirectory()) {
                        await calculateSize(fullPath);
                    } else {
                        totalSize += stats.size;
                    }
                }
            };

            await calculateSize(dirPath);
            return totalSize;
        } catch (error) {
            throw new Error(`Failed to calculate directory size: ${error.message}`);
        }
    }

    /**
     * Clean up old files
     */
    async cleanupOldFiles(dirPath, maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days default
        try {
            const cutoffDate = new Date(Date.now() - maxAge);
            const files = await this.listFiles(dirPath, { includeStats: true, recursive: true });
            const deletedFiles = [];

            for (const file of files) {
                if (file.stats && file.stats.accessed < cutoffDate) {
                    await this.deleteFile(file.path);
                    deletedFiles.push(file.path);
                }
            }

            return {
                deletedCount: deletedFiles.length,
                deletedFiles
            };
        } catch (error) {
            throw new Error(`Failed to cleanup old files: ${error.message}`);
        }
    }

    /**
     * Create zip archive
     */
    async createZipArchive(files, outputPath) {
        try {
            // This would require archiver or similar library
            throw new Error('ZIP archive creation requires additional dependencies like archiver');
        } catch (error) {
            throw new Error(`Failed to create ZIP archive: ${error.message}`);
        }
    }

    /**
     * Extract zip archive
     */
    async extractZipArchive(zipPath, extractPath) {
        try {
            // This would require yauzl or similar library
            throw new Error('ZIP extraction requires additional dependencies like yauzl');
        } catch (error) {
            throw new Error(`Failed to extract ZIP archive: ${error.message}`);
        }
    }

    /**
     * Generate unique filename
     */
    generateUniqueFilename(extension, baseName = null) {
        const timestamp = Date.now();
        const uuid = uuidv4().split('-')[0];
        const name = baseName ? `${this.sanitizeFilename(baseName)}_${timestamp}_${uuid}` : `${timestamp}_${uuid}`;
        return `${name}${extension}`;
    }

    /**
     * Sanitize filename
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9\-_.]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Check for suspicious patterns in filename
     */
    containsSuspiciousPatterns(filename) {
        const suspiciousPatterns = [
            /\.\./,  // Directory traversal
            /[<>:"|?*]/,  // Invalid characters
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i,  // Reserved names
            /\.(exe|bat|cmd|scr|pif|vbs|js)$/i  // Executable extensions
        ];

        return suspiciousPatterns.some(pattern => pattern.test(filename));
    }

    /**
     * Create temporary file
     */
    async createTempFile(data, extension = '.tmp') {
        try {
            await this.ensureDirectoryExists(this.directories.temp);
            const filename = this.generateUniqueFilename(extension);
            const tempPath = path.join(this.directories.temp, filename);
            
            if (Buffer.isBuffer(data)) {
                await fs.writeFile(tempPath, data);
            } else {
                await fs.writeFile(tempPath, JSON.stringify(data));
            }

            return {
                path: tempPath,
                filename,
                cleanup: async () => await this.deleteFile(tempPath)
            };
        } catch (error) {
            throw new Error(`Failed to create temporary file: ${error.message}`);
        }
    }

    /**
     * Schedule cleanup of temporary files
     */
    scheduleCleanup() {
        setInterval(async () => {
            try {
                await this.cleanupOldFiles(this.directories.temp, this.cleanupInterval);
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }, this.cleanupInterval);
    }

    /**
     * Export file with metadata
     */
    async exportFileWithMetadata(filePath, metadata = {}) {
        try {
            const fileInfo = await this.getFileInfo(filePath);
            const fileBuffer = await fs.readFile(filePath);
            
            const exportData = {
                file: {
                    name: fileInfo.name,
                    size: fileInfo.size,
                    hash: fileInfo.hash,
                    created: fileInfo.created,
                    modified: fileInfo.modified
                },
                metadata,
                exportedAt: new Date(),
                version: '1.0.0'
            };

            const exportDir = this.directories.exports;
            await this.ensureDirectoryExists(exportDir);

            const exportFilename = `export_${Date.now()}_${path.parse(fileInfo.name).name}.json`;
            const metadataPath = path.join(exportDir, exportFilename);
            
            // Save metadata
            await fs.writeFile(metadataPath, JSON.stringify(exportData, null, 2));
            
            // Copy original file to export directory
            const exportedFilePath = path.join(exportDir, fileInfo.name);
            await this.copyFile(filePath, exportedFilePath);

            return {
                metadataPath,
                filePath: exportedFilePath,
                exportData
            };
        } catch (error) {
            throw new Error(`Failed to export file with metadata: ${error.message}`);
        }
    }

    /**
     * Import file with metadata
     */
    async importFileWithMetadata(metadataPath) {
        try {
            const metadataBuffer = await fs.readFile(metadataPath);
            const exportData = JSON.parse(metadataBuffer.toString());
            
            const exportDir = path.dirname(metadataPath);
            const originalFilePath = path.join(exportDir, exportData.file.name);
            
            if (!await this.fileExists(originalFilePath)) {
                throw new Error('Original file not found in export directory');
            }

            // Verify file integrity
            const currentHash = await this.calculateFileHash(originalFilePath);
            if (currentHash !== exportData.file.hash) {
                throw new Error('File integrity check failed - hash mismatch');
            }

            return {
                filePath: originalFilePath,
                metadata: exportData.metadata,
                fileInfo: exportData.file,
                exportedAt: exportData.exportedAt
            };
        } catch (error) {
            throw new Error(`Failed to import file with metadata: ${error.message}`);
        }
    }

    /**
     * Create file watcher
     */
    createFileWatcher(filePath, callback) {
        const fs = require('fs');
        
        try {
            const watcher = fs.watchFile(filePath, (current, previous) => {
                callback({
                    type: 'change',
                    filePath,
                    current: {
                        modified: current.mtime,
                        size: current.size
                    },
                    previous: {
                        modified: previous.mtime,
                        size: previous.size
                    }
                });
            });

            return {
                close: () => fs.unwatchFile(filePath),
                filePath
            };
        } catch (error) {
            throw new Error(`Failed to create file watcher: ${error.message}`);
        }
    }

    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const stats = {};
            
            for (const [key, dirPath] of Object.entries(this.directories)) {
                if (await this.fileExists(dirPath)) {
                    const files = await this.listFiles(dirPath, { recursive: true });
                    const totalSize = await this.getDirectorySize(dirPath);
                    
                    stats[key] = {
                        fileCount: files.length,
                        totalSize,
                        formattedSize: this.formatFileSize(totalSize),
                        directory: dirPath
                    };
                } else {
                    stats[key] = {
                        fileCount: 0,
                        totalSize: 0,
                        formattedSize: '0 Bytes',
                        directory: dirPath
                    };
                }
            }

            // Calculate totals
            const totalFiles = Object.values(stats).reduce((sum, stat) => sum + stat.fileCount, 0);
            const totalSize = Object.values(stats).reduce((sum, stat) => sum + stat.totalSize, 0);

            return {
                directories: stats,
                totals: {
                    fileCount: totalFiles,
                    totalSize,
                    formattedSize: this.formatFileSize(totalSize)
                }
            };
        } catch (error) {
            throw new Error(`Failed to get storage stats: ${error.message}`);
        }
    }

    /**
     * Compress file (basic gzip)
     */
    async compressFile(filePath, outputPath = null) {
        try {
            const zlib = require('zlib');
            const { pipeline } = require('stream');
            const { promisify } = require('util');
            const pipelineAsync = promisify(pipeline);

            const output = outputPath || `${filePath}.gz`;
            const readStream = require('fs').createReadStream(filePath);
            const writeStream = require('fs').createWriteStream(output);
            const gzip = zlib.createGzip();

            await pipelineAsync(readStream, gzip, writeStream);

            const originalSize = (await fs.stat(filePath)).size;
            const compressedSize = (await fs.stat(output)).size;

            return {
                originalPath: filePath,
                compressedPath: output,
                originalSize,
                compressedSize,
                compressionRatio: (originalSize - compressedSize) / originalSize
            };
        } catch (error) {
            throw new Error(`Failed to compress file: ${error.message}`);
        }
    }

    /**
     * Decompress file (basic gzip)
     */
    async decompressFile(compressedPath, outputPath = null) {
        try {
            const zlib = require('zlib');
            const { pipeline } = require('stream');
            const { promisify } = require('util');
            const pipelineAsync = promisify(pipeline);

            const output = outputPath || compressedPath.replace('.gz', '');
            const readStream = require('fs').createReadStream(compressedPath);
            const writeStream = require('fs').createWriteStream(output);
            const gunzip = zlib.createGunzip();

            await pipelineAsync(readStream, gunzip, writeStream);

            return {
                compressedPath,
                decompressedPath: output,
                decompressedSize: (await fs.stat(output)).size
            };
        } catch (error) {
            throw new Error(`Failed to decompress file: ${error.message}`);
        }
    }

    /**
     * Validate directory structure
     */
    async validateDirectoryStructure() {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            directories: {}
        };

        for (const [key, dirPath] of Object.entries(this.directories)) {
            try {
                await fs.access(dirPath);
                const stats = await fs.stat(dirPath);
                
                if (!stats.isDirectory()) {
                    validation.isValid = false;
                    validation.errors.push(`${key} path exists but is not a directory: ${dirPath}`);
                }

                // Check permissions
                try {
                    await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
                    validation.directories[key] = {
                        exists: true,
                        writable: true,
                        path: dirPath
                    };
                } catch (permError) {
                    validation.warnings.push(`Directory ${key} may not have proper permissions: ${dirPath}`);
                    validation.directories[key] = {
                        exists: true,
                        writable: false,
                        path: dirPath
                    };
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    validation.warnings.push(`Directory ${key} does not exist: ${dirPath}`);
                    validation.directories[key] = {
                        exists: false,
                        writable: false,
                        path: dirPath
                    };
                } else {
                    validation.isValid = false;
                    validation.errors.push(`Error accessing directory ${key}: ${error.message}`);
                }
            }
        }

        return validation;
    }

    /**
     * Create file from template
     */
    async createFileFromTemplate(templatePath, outputPath, replacements = {}) {
        try {
            let content = await fs.readFile(templatePath, 'utf8');
            
            // Replace template variables
            for (const [key, value] of Object.entries(replacements)) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                content = content.replace(regex, value);
            }

            await this.ensureDirectoryExists(path.dirname(outputPath));
            await fs.writeFile(outputPath, content);

            return {
                templatePath,
                outputPath,
                replacements,
                createdAt: new Date()
            };
        } catch (error) {
            throw new Error(`Failed to create file from template: ${error.message}`);
        }
    }

    /**
     * Batch file operations
     */
    async batchOperation(operation, files, options = {}) {
        const results = [];
        const errors = [];

        for (const file of files) {
            try {
                let result;
                
                switch (operation) {
                    case 'delete':
                        result = await this.deleteFile(file);
                        break;
                    case 'copy':
                        if (!options.targetDir) throw new Error('Target directory required for copy operation');
                        const targetPath = path.join(options.targetDir, path.basename(file));
                        result = await this.copyFile(file, targetPath);
                        break;
                    case 'move':
                        if (!options.targetDir) throw new Error('Target directory required for move operation');
                        const movePath = path.join(options.targetDir, path.basename(file));
                        result = await this.moveFile(file, movePath);
                        break;
                    case 'backup':
                        result = await this.backupFile(file, options.backupDir);
                        break;
                    default:
                        throw new Error(`Unknown operation: ${operation}`);
                }

                results.push({
                    file,
                    operation,
                    success: true,
                    result
                });
            } catch (error) {
                errors.push({
                    file,
                    operation,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            results,
            errors,
            successCount: results.length,
            errorCount: errors.length
        };
    }

    /**
     * Initialize storage with default settings
     */
    async initializeStorage() {
        try {
            await this.initializeDirectories();
            this.scheduleCleanup();
            
            // Create default gitignore for uploads
            const gitignorePath = path.join(this.uploadDir, '.gitignore');
            if (!await this.fileExists(gitignorePath)) {
                await fs.writeFile(gitignorePath, '# Uploaded files\n*\n!.gitignore\n');
            }

            // Create README for uploads directory
            const readmePath = path.join(this.uploadDir, 'README.md');
            if (!await this.fileExists(readmePath)) {
                const readmeContent = `# Upload Directory\n\nThis directory contains uploaded files for the PDF Auto-Populate application.\n\n## Structure\n\n- \`pdfs/\` - Uploaded PDF files\n- \`templates/\` - Template files\n- \`signatures/\` - Signature files\n- \`backups/\` - Backup files\n- \`exports/\` - Exported files\n\n## Note\n\nThis directory is automatically managed by the application.`;
                await fs.writeFile(readmePath, readmeContent);
            }

            return {
                success: true,
                message: 'Storage initialized successfully',
                directories: this.directories
            };
        } catch (error) {
            throw new Error(`Failed to initialize storage: ${error.message}`);
        }
    }
}

module.exports = new FileUtils();
