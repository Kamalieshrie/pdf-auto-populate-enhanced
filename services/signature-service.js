/**
 * Signature Service
 * Handles digital signatures, initials, date stamps, and signature validation
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const fileUtils = require('../utils/file-utils');
const validationUtils = require('../utils/validation-utils');

class SignatureService {
    constructor() {
        this.supportedSignatureTypes = ['draw', 'type', 'image', 'stamp'];
        this.signatureFormats = ['png', 'svg', 'jpeg', 'base64'];
        this.defaultSignatureSettings = {
            width: 200,
            height: 100,
            backgroundColor: '#FFFFFF',
            penColor: '#000000',
            penWidth: 2,
            fontSize: 16,
            fontFamily: 'Arial'
        };
    }

    /**
     * Create signature field
     */
    async createSignatureField(fieldData, templateId = null) {
        try {
            const validation = this.validateSignatureData(fieldData);
            if (!validation.isValid) {
                throw new Error(`Signature validation failed: ${validation.errors.join(', ')}`);
            }

            const signatureId = fieldData.id || `sig_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            
            const signatureField = {
                id: signatureId,
                name: fieldData.name,
                type: 'signature',
                label: fieldData.label || 'Signature',
                x: fieldData.x || 0,
                y: fieldData.y || 0,
                width: fieldData.width || this.defaultSignatureSettings.width,
                height: fieldData.height || this.defaultSignatureSettings.height,
                properties: {
                    ...this.defaultSignatureSettings,
                    signatureType: fieldData.signatureType || 'draw',
                    required: fieldData.required || false,
                    ...fieldData.properties
                },
                value: null,
                templateId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            return signatureField;

        } catch (error) {
            throw new Error(`Failed to create signature field: ${error.message}`);
        }
    }

    /**
     * Save signature data
     */
    async saveSignature(signatureData, options = {}) {
        try {
            const { userId, fieldId, format = 'png' } = options;
            
            if (!this.signatureFormats.includes(format)) {
                throw new Error(`Unsupported signature format: ${format}`);
            }

            const signatureId = `signature_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            const filename = `${signatureId}.${format}`;
            const signaturePath = path.join(fileUtils.directories.signatures, filename);

            let processedData = signatureData;
            
            // Process based on signature type
            if (signatureData.type === 'draw') {
                processedData = await this.processDrawnSignature(signatureData);
            } else if (signatureData.type === 'type') {
                processedData = await this.processTypedSignature(signatureData);
            } else if (signatureData.type === 'image') {
                processedData = await this.processImageSignature(signatureData);
            }

            // Save signature file
            await fileUtils.saveSignatureFile(processedData.data, signaturePath, format);

            const signatureRecord = {
                id: signatureId,
                userId,
                fieldId,
                type: signatureData.type,
                format,
                path: signaturePath,
                filename,
                size: processedData.data.length,
                hash: this.generateHash(processedData.data),
                createdAt: new Date(),
                metadata: {
                    width: processedData.width,
                    height: processedData.height,
                    ...signatureData.metadata
                }
            };

            return signatureRecord;

        } catch (error) {
            throw new Error(`Failed to save signature: ${error.message}`);
        }
    }

    /**
     * Validate signature
     */
    async validateSignature(signatureData, fieldProperties) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            score: 0
        };

        try {
            // Check signature size
            if (signatureData.data && signatureData.data.length > 1024 * 1024) { // 1MB limit
                validation.isValid = false;
                validation.errors.push('Signature data too large');
            }

            // Validate signature type
            if (!this.supportedSignatureTypes.includes(signatureData.type)) {
                validation.isValid = false;
                validation.errors.push('Invalid signature type');
            }

            // Check required fields
            if (fieldProperties.required && !signatureData.data) {
                validation.isValid = false;
                validation.errors.push('Signature is required');
            }

            // Quality checks for drawn signatures
            if (signatureData.type === 'draw') {
                const qualityCheck = this.checkSignatureQuality(signatureData);
                if (!qualityCheck.isValid) {
                    validation.warnings.push(...qualityCheck.warnings);
                    validation.score = qualityCheck.score;
                }
            }

            return validation;

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Validation error: ${error.message}`);
            return validation;
        }
    }

    /**
     * Generate timestamp for signature
     */
    generateTimestamp() {
        return {
            timestamp: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            format: 'ISO8601'
        };
    }

    /**
     * Create initial field
     */
    async createInitialField(fieldData, templateId = null) {
        try {
            const initialField = await this.createSignatureField({
                ...fieldData,
                type: 'initial',
                properties: {
                    ...fieldData.properties,
                    signatureType: 'type',
                    fontSize: fieldData.properties?.fontSize || 12,
                    width: fieldData.width || 80,
                    height: fieldData.height || 30
                }
            }, templateId);

            initialField.label = fieldData.label || 'Initial';
            initialField.type = 'initial';

            return initialField;

        } catch (error) {
            throw new Error(`Failed to create initial field: ${error.message}`);
        }
    }

    /**
     * Create date stamp field
     */
    async createDateField(fieldData, templateId = null) {
        try {
            const dateId = fieldData.id || `date_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            
            const dateField = {
                id: dateId,
                name: fieldData.name,
                type: 'date',
                label: fieldData.label || 'Date',
                x: fieldData.x || 0,
                y: fieldData.y || 0,
                width: fieldData.width || 120,
                height: fieldData.height || 20,
                properties: {
                    format: fieldData.format || 'YYYY-MM-DD',
                    editable: fieldData.editable !== false,
                    autoFill: fieldData.autoFill !== false,
                    ...fieldData.properties
                },
                value: fieldData.autoFill !== false ? new Date().toISOString().split('T')[0] : null,
                templateId,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            return dateField;

        } catch (error) {
            throw new Error(`Failed to create date field: ${error.message}`);
        }
    }

    /**
     * Process drawn signature
     */
    async processDrawnSignature(signatureData) {
        try {
            const { points, width, height } = signatureData;
            
            // Validate drawing points
            if (!Array.isArray(points) || points.length < 10) {
                throw new Error('Invalid signature drawing data');
            }

            // Normalize points and create signature image
            const processedData = await this.createSignatureImage(points, width, height);
            
            return {
                data: processedData,
                width,
                height,
                pointCount: points.length
            };

        } catch (error) {
            throw new Error(`Failed to process drawn signature: ${error.message}`);
        }
    }

    /**
     * Process typed signature
     */
    async processTypedSignature(signatureData) {
        try {
            const { text, fontFamily, fontSize, fontColor } = signatureData;
            
            if (!text || text.trim().length === 0) {
                throw new Error('Signature text cannot be empty');
            }

            // Create text-based signature image
            const signatureImage = await this.createTextSignatureImage(text, {
                fontFamily: fontFamily || 'Arial',
                fontSize: fontSize || 16,
                color: fontColor || '#000000'
            });

            return {
                data: signatureImage,
                width: 200,
                height: 60,
                textLength: text.length
            };

        } catch (error) {
            throw new Error(`Failed to process typed signature: ${error.message}`);
        }
    }

    /**
     * Process image signature
     */
    async processImageSignature(signatureData) {
        try {
            const { imageData, width, height } = signatureData;
            
            if (!imageData) {
                throw new Error('Image data is required');
            }

            // Validate and process image
            const processedImage = await this.processSignatureImage(imageData, width, height);
            
            return {
                data: processedImage,
                width: width || 200,
                height: height || 100
            };

        } catch (error) {
            throw new Error(`Failed to process image signature: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    validateSignatureData(signatureData) {
        const validation = { isValid: true, errors: [], warnings: [] };

        if (!signatureData.name) {
            validation.isValid = false;
            validation.errors.push('Signature name is required');
        }

        if (signatureData.type && !this.supportedSignatureTypes.includes(signatureData.type)) {
            validation.isValid = false;
            validation.errors.push(`Unsupported signature type: ${signatureData.type}`);
        }

        if (signatureData.width && (signatureData.width < 50 || signatureData.width > 1000)) {
            validation.warnings.push('Signature width should be between 50 and 1000 pixels');
        }

        if (signatureData.height && (signatureData.height < 20 || signatureData.height > 500)) {
            validation.warnings.push('Signature height should be between 20 and 500 pixels');
        }

        return validation;
    }

    checkSignatureQuality(signatureData) {
        const quality = { isValid: true, score: 0, warnings: [] };
        const { points } = signatureData;

        if (points.length < 15) {
            quality.score = 1;
            quality.warnings.push('Signature appears too simple');
        } else if (points.length < 30) {
            quality.score = 2;
            quality.warnings.push('Signature could be more detailed');
        } else {
            quality.score = 3;
        }

        // Check for straight lines (potential fraud)
        const straightLineCheck = this.detectStraightLines(points);
        if (straightLineCheck.isStraight) {
            quality.score = Math.max(0, quality.score - 1);
            quality.warnings.push('Signature appears mechanical');
        }

        return quality;
    }

    detectStraightLines(points) {
        // Simple straight line detection algorithm
        if (points.length < 3) return { isStraight: true };

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        // Calculate expected points for straight line
        const totalDistance = Math.sqrt(
            Math.pow(lastPoint.x - firstPoint.x, 2) + 
            Math.pow(lastPoint.y - firstPoint.y, 2)
        );

        let deviationSum = 0;
        for (let i = 1; i < points.length - 1; i++) {
            const point = points[i];
            const expectedY = firstPoint.y + (point.x - firstPoint.x) * 
                (lastPoint.y - firstPoint.y) / (lastPoint.x - firstPoint.x);
            
            deviationSum += Math.abs(point.y - expectedY);
        }

        const avgDeviation = deviationSum / (points.length - 2);
        return { isStraight: avgDeviation < 5 }; // Threshold for straightness
    }

    generateHash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    async createSignatureImage(points, width, height) {
        // This would typically use a canvas library to create signature image
        // For now, return a mock implementation
        return Buffer.from(`signature_${width}x${height}_${points.length}_points`);
    }

    async createTextSignatureImage(text, style) {
        // Create image from text signature
        return Buffer.from(`text_signature_${text}_${style.fontSize}`);
    }

    async processSignatureImage(imageData, width, height) {
        // Process and optimize signature image
        return Buffer.from(`processed_image_${width}x${height}`);
    }
}

module.exports = new SignatureService();