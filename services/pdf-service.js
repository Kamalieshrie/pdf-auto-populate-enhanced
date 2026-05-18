/**
 * PDF Service
 * Handles PDF processing, form generation, filling, and manipulation
 */

const pdfUtils = require('../utils/pdf-utils');
const fieldMapper = require('../utils/field-mapper');
const fileUtils = require('../utils/file-utils');
const validationUtils = require('../utils/validation-utils');
const path = require('path');
const fs = require('fs').promises;

class PDFService {
    constructor() {
        this.processingOptions = {
            maxFileSize: 50 * 1024 * 1024, // 50MB
            allowedFormats: ['pdf'],
            compressionQuality: 0.8,
            defaultPageSize: 'letter',
            defaultOrientation: 'portrait'
        };

        this.outputFormats = ['pdf', 'json', 'xml'];
    }

    /**
     * Process uploaded PDF file
     */
    async processPDF(file, options = {}) {
        try {
            // Validate uploaded file
            const validation = fileUtils.validateFile(file, 'pdf');
            if (!validation.isValid) {
                throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
            }

            // Save uploaded file
            const savedFile = await fileUtils.saveFile(file, 'pdfs');
            const pdfBuffer = await fileUtils.loadFile(savedFile.path);

            // Extract PDF information
            const pdfInfo = await pdfUtils.extractPDFInfo(pdfBuffer);
            
            // Extract existing form fields if any
            const existingFields = pdfInfo.hasForm ? 
                await pdfUtils.extractFormFields(pdfBuffer) : [];

            // Create processing result
            const result = {
                file: {
                    id: savedFile.filename.split('.')[0],
                    name: savedFile.filename,
                    originalName: savedFile.originalName,
                    path: savedFile.path,
                    relativePath: savedFile.relativePath,
                    size: savedFile.size,
                    hash: savedFile.hash
                },
                pdf: {
                    pageCount: pdfInfo.pageCount,
                    hasExistingForm: pdfInfo.hasForm,
                    existingFieldCount: pdfInfo.formFieldCount,
                    pages: pdfInfo.pages,
                    metadata: pdfInfo.metadata
                },
                fields: existingFields.map(field => fieldMapper.mapPDFToField(field)),
                processedAt: new Date(),
                options: options
            };

            return result;

        } catch (error) {
            throw new Error(`Failed to process PDF: ${error.message}`);
        }
    }

    /**
     * Create new PDF with form fields
     */
    async createPDFWithFields(fields, options = {}) {
        try {
            const {
                pageSize = this.processingOptions.defaultPageSize,
                orientation = this.processingOptions.defaultOrientation,
                title = 'Generated PDF Form',
                author = 'PDF Auto-Populate'
            } = options;

            // Validate fields
            const fieldValidation = this.validateFields(fields);
            if (!fieldValidation.isValid) {
                throw new Error(`Field validation failed: ${fieldValidation.errors.join(', ')}`);
            }

            // Map fields to PDF format
            const pdfFields = fields.map(field => fieldMapper.mapFieldToPDF(field));

            // Create PDF with fields
            const pdfBuffer = await pdfUtils.createPDFWithFields(pdfFields, {
                pageSize,
                orientation,
                title,
                author
            });

            // Save generated PDF
            const filename = `generated_${Date.now()}.pdf`;
            const filePath = path.join(fileUtils.getDirectory('pdfs'), filename);
            await fileUtils.savePDFToFile(pdfBuffer, filePath);

            return {
                filename,
                path: filePath,
                size: pdfBuffer.length,
                pageSize,
                orientation,
                fieldCount: fields.length,
                createdAt: new Date(),
                metadata: {
                    title,
                    author,
                    creator: 'PDF Auto-Populate Service'
                }
            };

        } catch (error) {
            throw new Error(`Failed to create PDF with fields: ${error.message}`);
        }
    }

    /**
     * Fill existing PDF form
     */
    async fillPDFForm(pdfPath, fieldData, options = {}) {
        try {
            // Load PDF file
            const pdfBuffer = await fileUtils.loadPDFFromFile(pdfPath);
            
            // Validate PDF
            const pdfValidation = await pdfUtils.validatePDF(pdfBuffer);
            if (!pdfValidation.isValid) {
                throw new Error(`PDF validation failed: ${pdfValidation.errors.join(', ')}`);
            }

            // Validate field data
            const dataValidation = this.validateFieldData(fieldData);
            if (!dataValidation.isValid) {
                throw new Error(`Field data validation failed: ${dataValidation.errors.join(', ')}`);
            }

            // Fill PDF form
            const filledPdfBuffer = await pdfUtils.fillPDFFields(pdfBuffer, dataValidation.sanitizedData);

            // Save filled PDF
            const outputFilename = options.outputFilename || 
                `filled_${Date.now()}_${path.basename(pdfPath)}`;
            const outputPath = path.join(fileUtils.getDirectory('pdfs'), outputFilename);
            
            await fileUtils.savePDFToFile(filledPdfBuffer, outputPath);

            // Flatten PDF if requested
            let finalPdfBuffer = filledPdfBuffer;
            if (options.flatten) {
                finalPdfBuffer = await pdfUtils.flattenPDF(filledPdfBuffer, options.fieldsToFlatten);
                await fileUtils.savePDFToFile(finalPdfBuffer, outputPath);
            }

            return {
                originalFile: pdfPath,
                filledFile: outputPath,
                filename: outputFilename,
                size: finalPdfBuffer.length,
                fieldsCount: Object.keys(fieldData).length,
                flattened: !!options.flatten,
                filledAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to fill PDF form: ${error.message}`);
        }
    }

    /**
     * Extract form data from filled PDF
     */
    async extractFormData(pdfPath, options = {}) {
        try {
            const pdfBuffer = await fileUtils.loadPDFFromFile(pdfPath);
            
            // Extract form fields with values
            const formFields = await pdfUtils.extractFormFields(pdfBuffer);
            
            // Format extracted data
            const extractedData = {};
            const fieldDetails = [];

            formFields.forEach(field => {
                extractedData[field.name] = field.value;
                fieldDetails.push({
                    name: field.name,
                    type: field.type,
                    value: field.value,
                    position: field.position,
                    properties: {
                        readOnly: field.isReadOnly,
                        required: field.isRequired
                    }
                });
            });

            return {
                data: extractedData,
                fields: fieldDetails,
                fieldCount: formFields.length,
                extractedAt: new Date(),
                sourceFile: pdfPath
            };

        } catch (error) {
            throw new Error(`Failed to extract form data: ${error.message}`);
        }
    }

    /**
     * Merge multiple PDFs
     */
    async mergePDFs(pdfPaths, options = {}) {
        try {
            if (!Array.isArray(pdfPaths) || pdfPaths.length < 2) {
                throw new Error('At least 2 PDF files are required for merging');
            }

            // Load all PDF buffers
            const pdfBuffers = [];
            for (const pdfPath of pdfPaths) {
                const buffer = await fileUtils.loadPDFFromFile(pdfPath);
                pdfBuffers.push(buffer);
            }

            // Merge PDFs
            const mergedPdfBuffer = await pdfUtils.mergePDFs(pdfBuffers);

            // Save merged PDF
            const outputFilename = options.outputFilename || `merged_${Date.now()}.pdf`;
            const outputPath = path.join(fileUtils.getDirectory('pdfs'), outputFilename);
            
            await fileUtils.savePDFToFile(mergedPdfBuffer, outputPath);

            return {
                mergedFile: outputPath,
                filename: outputFilename,
                size: mergedPdfBuffer.length,
                sourceFiles: pdfPaths,
                sourceCount: pdfPaths.length,
                mergedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to merge PDFs: ${error.message}`);
        }
    }

    /**
     * Split PDF into separate pages
     */
    async splitPDF(pdfPath, options = {}) {
        try {
            const pdfBuffer = await fileUtils.loadPDFFromFile(pdfPath);
            
            // Split PDF
            const splitPDFs = await pdfUtils.splitPDF(pdfBuffer);
            
            // Save split pages
            const savedPages = [];
            const baseName = path.basename(pdfPath, '.pdf');
            
            for (const splitPDF of splitPDFs) {
                const pageFilename = `${baseName}_page_${splitPDF.pageNumber}.pdf`;
                const pagePath = path.join(fileUtils.getDirectory('pdfs'), pageFilename);
                
                await fileUtils.savePDFToFile(splitPDF.pdfBuffer, pagePath);
                
                savedPages.push({
                    pageNumber: splitPDF.pageNumber,
                    filename: pageFilename,
                    path: pagePath,
                    size: splitPDF.pdfBuffer.length
                });
            }

            return {
                originalFile: pdfPath,
                pages: savedPages,
                pageCount: splitPDFs.length,
                splitAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to split PDF: ${error.message}`);
        }
    }

    /**
     * Add watermark to PDF
     */
    async addWatermark(pdfPath, watermarkText, options = {}) {
        try {
            const pdfBuffer = await fileUtils.loadPDFFromFile(pdfPath);
            
            // Add watermark
            const watermarkedPdfBuffer = await pdfUtils.addWatermark(pdfBuffer, watermarkText, options);
            
            // Save watermarked PDF
            const outputFilename = options.outputFilename || 
                `watermarked_${Date.now()}_${path.basename(pdfPath)}`;
            const outputPath = path.join(fileUtils.getDirectory('pdfs'), outputFilename);
            
            await fileUtils.savePDFToFile(watermarkedPdfBuffer, outputPath);

            return {
                originalFile: pdfPath,
                watermarkedFile: outputPath,
                filename: outputFilename,
                watermarkText,
                size: watermarkedPdfBuffer.length,
                watermarkedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to add watermark: ${error.message}`);
        }
    }

    /**
     * Optimize PDF file
     */
    async optimizePDF(pdfPath, options = {}) {
        try {
            const pdfBuffer = await fileUtils.loadPDFFromFile(pdfPath);
            const originalSize = pdfBuffer.length;
            
            // Optimize PDF
            const optimizedPdfBuffer = await pdfUtils.optimizePDF(pdfBuffer, options);
            
            // Save optimized PDF
            const outputFilename = options.outputFilename || 
                `optimized_${Date.now()}_${path.basename(pdfPath)}`;
            const outputPath = path.join(fileUtils.getDirectory('pdfs'), outputFilename);
            
            await fileUtils.savePDFToFile(optimizedPdfBuffer, outputPath);

            const compressionRatio = (originalSize - optimizedPdfBuffer.length) / originalSize;

            return {
                originalFile: pdfPath,
                optimizedFile: outputPath,
                filename: outputFilename,
                originalSize,
                optimizedSize: optimizedPdfBuffer.length,
                compressionRatio,
                sizeReduction: fileUtils.formatFileSize(originalSize - optimizedPdfBuffer.length),
                optimizedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to optimize PDF: ${error.message}`);
        }
    }

    /**
     * Generate PDF from template
     */
    async generateFromTemplate(templateId, fillData = {}, options = {}) {
        try {
            // Load field service to avoid circular dependency
            const fieldService = require('./field-service');
            
            // Get template fields
            const fields = await fieldService.getFieldsByTemplate(templateId);
            
            if (!fields || fields.length === 0) {
                throw new Error('No fields found in template');
            }

            // Fill fields with provided data
            const filledFields = fields.map(field => ({
                ...field,
                value: fillData[field.name] || field.value || this.getDefaultValueForType(field.type)
            }));

            // Validate filled data
            const validationResults = filledFields.map(field => {
                if (fillData[field.name] !== undefined) {
                    return validationUtils.validateField(field, fillData[field.name]);
                }
                return { isValid: true, errors: [], warnings: [] };
            });

            const invalidFields = validationResults.filter(result => !result.isValid);
            if (invalidFields.length > 0) {
                const errors = invalidFields.flatMap(result => result.errors);
                throw new Error(`Field validation failed: ${errors.join(', ')}`);
            }

            // Create PDF with filled fields
            return await this.createPDFWithFields(filledFields, options);

        } catch (error) {
            throw new Error(`Failed to generate PDF from template: ${error.message}`);
        }
    }

    /**
     * Compare two PDFs
     */
    async comparePDFs(pdf1Path, pdf2Path) {
        try {
            const pdf1Buffer = await fileUtils.loadPDFFromFile(pdf1Path);
            const pdf2Buffer = await fileUtils.loadPDFFromFile(pdf2Path);
            
            const comparison = await pdfUtils.comparePDFs(pdf1Buffer, pdf2Buffer);
            
            return {
                ...comparison,
                file1: pdf1Path,
                file2: pdf2Path,
                comparedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to compare PDFs: ${error.message}`);
        }
    }

    /**
     * Extract PDF metadata
     */
    async extractMetadata(pdfPath) {
        try {
            const pdfBuffer = await fileUtils.loadPDFFromFile(pdfPath);
            const pdfInfo = await pdfUtils.extractPDFInfo(pdfBuffer);
            
            return {
                file: pdfPath,
                size: pdfBuffer.length,
                formattedSize: fileUtils.formatFileSize(pdfBuffer.length),
                ...pdfInfo,
                extractedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to extract PDF metadata: ${error.message}`);
        }
    }

    /**
     * Batch process multiple PDFs
     */
    async batchProcessPDFs(operations) {
        try {
            const results = {
                successful: [],
                failed: [],
                totalCount: operations.length,
                processedAt: new Date()
            };

            for (const operation of operations) {
                try {
                    let result;
                    
                    switch (operation.type) {
                        case 'fill':
                            result = await this.fillPDFForm(
                                operation.pdfPath, 
                                operation.fieldData, 
                                operation.options
                            );
                            break;
                            
                        case 'merge':
                            result = await this.mergePDFs(
                                operation.pdfPaths, 
                                operation.options
                            );
                            break;
                            
                        case 'split':
                            result = await this.splitPDF(
                                operation.pdfPath, 
                                operation.options
                            );
                            break;
                            
                        case 'watermark':
                            result = await this.addWatermark(
                                operation.pdfPath, 
                                operation.watermarkText, 
                                operation.options
                            );
                            break;
                            
                        case 'optimize':
                            result = await this.optimizePDF(
                                operation.pdfPath, 
                                operation.options
                            );
                            break;
                            
                        default:
                            throw new Error(`Unknown operation type: ${operation.type}`);
                    }

                    results.successful.push({
                        operation,
                        result,
                        processedAt: new Date()
                    });

                } catch (error) {
                    results.failed.push({
                        operation,
                        error: error.message,
                        failedAt: new Date()
                    });
                }
            }

            return results;

        } catch (error) {
            throw new Error(`Failed to batch process PDFs: ${error.message}`);
        }
    }

    /**
     * Create PDF report
     */
    async createPDFReport(data, template = 'default') {
        try {
            const reportData = {
                title: data.title || 'Generated Report',
                date: new Date().toLocaleDateString(),
                content: data.content || [],
                summary: data.summary || {}
            };

            // Generate report fields based on data
            const reportFields = this.generateReportFields(reportData, template);

            // Create PDF with report fields
            const result = await this.createPDFWithFields(reportFields, {
                title: reportData.title,
                author: 'PDF Auto-Populate Report Generator'
            });

            return {
                ...result,
                reportType: template,
                dataFields: Object.keys(reportData).length,
                generatedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to create PDF report: ${error.message}`);
        }
    }

    /**
     * Convert PDF to different formats
     */
    async convertPDF(pdfPath, outputFormat, options = {}) {
        try {
            if (!this.outputFormats.includes(outputFormat)) {
                throw new Error(`Unsupported output format: ${outputFormat}. Supported: ${this.outputFormats.join(', ')}`);
            }

            let result;
            
            switch (outputFormat) {
                case 'json':
                    result = await this.convertPDFToJSON(pdfPath);
                    break;
                    
                case 'xml':
                    result = await this.convertPDFToXML(pdfPath);
                    break;
                    
                default:
                    throw new Error(`Conversion to ${outputFormat} not implemented`);
            }

            return result;

        } catch (error) {
            throw new Error(`Failed to convert PDF: ${error.message}`);
        }
    }

    /**
     * Validate PDF file
     */
    async validatePDFFile(pdfPath, options = {}) {
        try {
            const pdfBuffer = await fileUtils.loadPDFFromFile(pdfPath);
            return await pdfUtils.validatePDF(pdfBuffer, options);
        } catch (error) {
            return {
                isValid: false,
                errors: [error.message],
                warnings: [],
                info: null
            };
        }
    }

    /**
     * Get PDF processing statistics
     */
    async getProcessingStats(timeRange = '24h') {
        try {
            // This would typically query a database for processing logs
            // For now, return mock statistics
            const stats = {
                timeRange,
                processed: {
                    total: 0,
                    successful: 0,
                    failed: 0
                },
                operations: {
                    fill: 0,
                    create: 0,
                    merge: 0,
                    split: 0,
                    optimize: 0
                },
                averageProcessingTime: 0,
                totalSizeProcessed: 0,
                generatedAt: new Date()
            };

            return stats;

        } catch (error) {
            throw new Error(`Failed to get processing statistics: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    validateFields(fields) {
        const validation = { isValid: true, errors: [], warnings: [] };
        
        if (!Array.isArray(fields)) {
            validation.isValid = false;
            validation.errors.push('Fields must be an array');
            return validation;
        }

        if (fields.length === 0) {
            validation.isValid = false;
            validation.errors.push('At least one field is required');
            return validation;
        }

        fields.forEach((field, index) => {
            // Basic field validation
            if (!field.name || typeof field.name !== 'string') {
                validation.isValid = false;
                validation.errors.push(`Field ${index}: name is required and must be a string`);
            }
            
            if (!field.type || typeof field.type !== 'string') {
                validation.isValid = false;
                validation.errors.push(`Field ${index}: type is required and must be a string`);
            }
        });

        return validation;
    }

    validateFieldData(fieldData) {
        const validation = { 
            isValid: true, 
            errors: [], 
            warnings: [],
            sanitizedData: {}
        };

        try {
            Object.keys(fieldData).forEach(fieldName => {
                const value = fieldData[fieldName];
                
                // Basic sanitization
                const sanitizedValue = typeof value === 'string' ? 
                    validationUtils.sanitizeInput(value) : value;
                    
                validation.sanitizedData[fieldName] = sanitizedValue;
            });
        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Field data validation error: ${error.message}`);
        }

        return validation;
    }

    getDefaultValueForType(fieldType) {
        const defaults = {
            text: '',
            number: 0,
            email: '',
            phone: '',
            date: new Date().toISOString().split('T')[0],
            url: '',
            checkbox: false,
            radio: null,
            dropdown: null,
            signature: null,
            image: null
        };
        return defaults[fieldType] || '';
    }

    generateReportFields(reportData, template) {
        const fields = [];
        let yPosition = 50;
        const lineHeight = 30;

        // Title field
        fields.push({
            name: 'title',
            type: 'text',
            label: 'Report Title',
            value: reportData.title,
            x: 50,
            y: yPosition,
            width: 500,
            height: 25,
            properties: { fontSize: 16, fontWeight: 'bold' }
        });
        yPosition += lineHeight;

        // Date field
        fields.push({
            name: 'date',
            type: 'text',
            label: 'Generated Date',
            value: reportData.date,
            x: 50,
            y: yPosition,
            width: 200,
            height: 20,
            properties: { fontSize: 12 }
        });
        yPosition += lineHeight;

        // Content fields
        if (reportData.content && Array.isArray(reportData.content)) {
            reportData.content.forEach((item, index) => {
                fields.push({
                    name: `content_${index}`,
                    type: 'text',
                    label: item.label || `Content ${index + 1}`,
                    value: item.value || '',
                    x: 50,
                    y: yPosition,
                    width: 500,
                    height: 20,
                    properties: { fontSize: 12 }
                });
                yPosition += lineHeight;
            });
        }

        return fields;
    }

    async convertPDFToJSON(pdfPath) {
        try {
            const formData = await this.extractFormData(pdfPath);
            const outputFilename = `${path.basename(pdfPath, '.pdf')}.json`;
            const outputPath = path.join(fileUtils.getDirectory('exports'), outputFilename);
            
            await fs.writeFile(outputPath, JSON.stringify(formData, null, 2));

            return {
                originalFile: pdfPath,
                convertedFile: outputPath,
                filename: outputFilename,
                format: 'json',
                size: (await fs.stat(outputPath)).size,
                convertedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to convert PDF to JSON: ${error.message}`);
        }
    }

    async convertPDFToXML(pdfPath) {
        try {
            const formData = await this.extractFormData(pdfPath);
            
            // Simple XML conversion
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<pdfData>\n';
            
            Object.keys(formData.data).forEach(key => {
                const value = formData.data[key] || '';
                xml += `  <${key}>${this.escapeXML(value)}</${key}>\n`;
            });
            
            xml += '</pdfData>';

            const outputFilename = `${path.basename(pdfPath, '.pdf')}.xml`;
            const outputPath = path.join(fileUtils.getDirectory('exports'), outputFilename);
            
            await fs.writeFile(outputPath, xml);

            return {
                originalFile: pdfPath,
                convertedFile: outputPath,
                filename: outputFilename,
                format: 'xml',
                size: (await fs.stat(outputPath)).size,
                convertedAt: new Date()
            };

        } catch (error) {
            throw new Error(`Failed to convert PDF to XML: ${error.message}`);
        }
    }

    escapeXML(unsafe) {
        return unsafe.toString().replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }
}

module.exports = new PDFService();