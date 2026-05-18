// server/controllers/pdf-controller.js - PDF Processing Controller
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const appConfig = require('../config/app-config');

class PDFController {
    constructor() {
        this.propertyData = appConfig.propertyData.default;
        this.fieldMappings = appConfig.propertyData.mappings;
        this.maxPdfSize = appConfig.pdf.maxSize;
    }

    /**
     * Inspect PDF form fields and return field information
     */
    async inspectPdf(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No PDF file uploaded'
                });
            }

            const pdfPath = req.file.path;
            const pdfBytes = await fs.readFile(pdfPath);

            // Clean up uploaded file
            await fs.unlink(pdfPath).catch(() => {});

            // Load and analyze PDF
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const form = pdfDoc.getForm();
            const fields = form.getFields();
            const pages = pdfDoc.getPages();

            console.log(`\n=== PDF INSPECTION ===`);
            console.log(`File: ${req.file.originalname}`);
            console.log(`Size: ${pdfBytes.length} bytes`);
            console.log(`Pages: ${pages.length}`);
            console.log(`Form fields: ${fields.length}`);

            const fieldDetails = [];
            const pageInfo = [];

            // Analyze pages
            pages.forEach((page, index) => {
                const { width, height } = page.getSize();
                pageInfo.push({
                    pageNumber: index + 1,
                    width,
                    height,
                    rotation: page.getRotation().angle
                });
            });

            // Analyze form fields
            fields.forEach((field, index) => {
                const fieldInfo = {
                    id: uuidv4(),
                    name: field.getName(),
                    type: field.constructor.name,
                    isReadOnly: false,
                    currentValue: '',
                    position: null,
                    size: null,
                    pageIndex: 0
                };

                try {
                    // Get field properties based on type
                    if (field.constructor.name === 'PDFTextField') {
                        fieldInfo.currentValue = field.getText() || '';
                        fieldInfo.isReadOnly = field.isReadOnly();
                        fieldInfo.maxLength = field.getMaxLength();
                    } else if (field.constructor.name === 'PDFCheckBox') {
                        fieldInfo.currentValue = field.isChecked();
                        fieldInfo.isReadOnly = field.isReadOnly();
                    } else if (field.constructor.name === 'PDFDropdown') {
                        fieldInfo.currentValue = field.getSelected() || [];
                        fieldInfo.options = field.getOptions();
                        fieldInfo.isReadOnly = field.isReadOnly();
                    } else if (field.constructor.name === 'PDFRadioGroup') {
                        fieldInfo.currentValue = field.getSelected();
                        fieldInfo.options = field.getOptions();
                    }

                    // Try to get field widget information (position/size)
                    const widgets = field.acroField.getWidgets();
                    if (widgets.length > 0) {
                        const widget = widgets[0];
                        const rect = widget.getRectangle();
                        
                        fieldInfo.position = {
                            x: rect.x,
                            y: rect.y
                        };
                        fieldInfo.size = {
                            width: rect.width,
                            height: rect.height
                        };

                        // Find which page this field is on
                        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
                            const pageAnnots = pages[pageIndex].node.Annots;
                            if (pageAnnots && pageAnnots.asArray().some(annot => annot === widget.dict)) {
                                fieldInfo.pageIndex = pageIndex;
                                break;
                            }
                        }
                    }

                } catch (error) {
                    console.log(`Warning: Could not read details for field "${field.getName()}":`, error.message);
                }

                fieldDetails.push(fieldInfo);
                console.log(`${index + 1}. "${fieldInfo.name}" (${fieldInfo.type}) - ReadOnly: ${fieldInfo.isReadOnly}`);
            });

            // Suggest field mappings
            const suggestedMappings = this.suggestFieldMappings(fieldDetails);

            console.log(`===================\n`);

            res.json({
                success: true,
                message: `PDF inspection complete. Found ${fields.length} form fields on ${pages.length} pages.`,
                pdf: {
                    filename: req.file.originalname,
                    size: pdfBytes.length,
                    pageCount: pages.length,
                    hasFormFields: fields.length > 0
                },
                pages: pageInfo,
                fields: fieldDetails,
                suggestedMappings,
                propertyData: this.propertyData
            });

        } catch (error) {
            // Clean up file on error
            if (req.file) {
                await fs.unlink(req.file.path).catch(() => {});
            }

            console.error('PDF inspection error:', error);
            res.status(500).json({
                success: false,
                message: 'PDF inspection failed: ' + error.message
            });
        }
    }

    /**
     * Suggest field mappings based on field names
     */
    suggestFieldMappings(fields) {
        const suggestions = [];

        fields.forEach(field => {
            const fieldName = field.name.toLowerCase();
            let bestMatch = null;
            let confidence = 0;

            // Check each property for potential matches
            Object.entries(this.fieldMappings).forEach(([property, aliases]) => {
                // Check direct match with property name
                if (fieldName.includes(property)) {
                    const matchConfidence = fieldName === property ? 1.0 : 0.8;
                    if (matchConfidence > confidence) {
                        bestMatch = {
                            property,
                            value: this.propertyData[property],
                            confidence: matchConfidence
                        };
                        confidence = matchConfidence;
                    }
                }

                // Check aliases
                aliases.forEach(alias => {
                    if (fieldName.includes(alias.toLowerCase())) {
                        const matchConfidence = fieldName === alias.toLowerCase() ? 0.9 : 0.7;
                        if (matchConfidence > confidence) {
                            bestMatch = {
                                property,
                                value: this.propertyData[property],
                                confidence: matchConfidence,
                                matchedAlias: alias
                            };
                            confidence = matchConfidence;
                        }
                    }
                });
            });

            if (bestMatch) {
                suggestions.push({
                    fieldId: field.id,
                    fieldName: field.name,
                    suggestion: bestMatch
                });
            }
        });

        return suggestions;
    }

    /**
     * Populate PDF with form field mapping and custom fields
     */
    async populatePdf(req, res) {
        const startTime = Date.now();
        
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No PDF file uploaded'
                });
            }

            const pdfPath = req.file.path;
            const pdfBytes = await fs.readFile(pdfPath);
            const customFields = JSON.parse(req.body.customFields || '[]');
            const fieldMappings = JSON.parse(req.body.fieldMappings || '{}');
            const useCustomData = req.body.useCustomData === 'true';
            const customPropertyData = useCustomData ? JSON.parse(req.body.propertyData || '{}') : null;

            console.log(`\n=== PDF POPULATION ===`);
            console.log(`File: ${req.file.originalname}`);
            console.log(`Custom fields: ${customFields.length}`);
            console.log(`Field mappings: ${Object.keys(fieldMappings).length}`);
            console.log(`Using custom data: ${useCustomData}`);

            // Clean up uploaded file
            await fs.unlink(pdfPath).catch(() => {});

            const propertyData = customPropertyData || this.propertyData;
            const result = await this.processAndPopulatePdf(
                pdfBytes, 
                propertyData, 
                customFields, 
                fieldMappings,
                req.file.originalname
            );

            const processingTime = Date.now() - startTime;
            
            console.log(`Processing completed in ${processingTime}ms`);
            console.log(`=====================\n`);

            res.json({
                success: true,
                message: `PDF populated successfully. ${result.fieldsPopulated} fields populated (${result.formFieldsPopulated} form fields, ${result.customFieldsPopulated} custom fields).`,
                downloadUrl: result.downloadUrl,
                fieldsPopulated: result.fieldsPopulated,
                formFieldsPopulated: result.formFieldsPopulated,
                customFieldsPopulated: result.customFieldsPopulated,
                populationLog: result.populationLog,
                processingTimeMs: processingTime,
                outputFilename: result.filename
            });

        } catch (error) {
            // Clean up file on error
            if (req.file) {
                await fs.unlink(req.file.path).catch(() => {});
            }

            console.error('PDF population error:', error);
            res.status(500).json({
                success: false,
                message: 'PDF population failed: ' + error.message
            });
        }
    }

    /**
     * Core PDF processing and population logic
     */
    async processAndPopulatePdf(pdfBytes, propertyData, customFields, fieldMappings, originalFilename) {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const pages = pdfDoc.getPages();
        
        let formFieldsPopulated = 0;
        let customFieldsPopulated = 0;
        const populationLog = [];

        // Step 1: Populate existing form fields
        const existingFields = form.getFields();
        
        existingFields.forEach(field => {
            const fieldName = field.getName();
            let value = null;

            // Check for custom mapping first
            if (fieldMappings[fieldName]) {
                const mappedProperty = fieldMappings[fieldName];
                value = propertyData[mappedProperty];
                if (value !== undefined) {
                    populationLog.push(`🎯 Custom mapping: "${fieldName}" → "${mappedProperty}" = "${value}"`);
                }
            }

            // Fall back to automatic mapping if no custom mapping
            if (value === null || value === undefined) {
                value = this.mapDataToField(fieldName, propertyData);
                if (value !== null) {
                    populationLog.push(`🤖 Auto mapping: "${fieldName}" = "${value}"`);
                }
            }

            // Populate the field if we found a value
            if (value !== null && value !== undefined) {
                try {
                    if (field.constructor.name === 'PDFTextField') {
                        field.setText(String(value));
                        formFieldsPopulated++;
                    } else if (field.constructor.name === 'PDFCheckBox') {
                        const isChecked = Boolean(value) && value !== 'false' && value !== '0';
                        field.check(isChecked);
                        formFieldsPopulated++;
                        populationLog[populationLog.length - 1] += ` (checked: ${isChecked})`;
                    } else if (field.constructor.name === 'PDFDropdown') {
                        field.select(String(value));
                        formFieldsPopulated++;
                    }
                } catch (error) {
                    populationLog.push(`❌ Error populating "${fieldName}": ${error.message}`);
                }
            } else {
                populationLog.push(`⚠️ No mapping found for "${fieldName}"`);
            }
        });

        // Step 2: Add custom fields
        if (customFields && customFields.length > 0) {
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            for (const customField of customFields) {
                try {
                    const page = pages[customField.pageIndex || 0];
                    if (!page) continue;

                    const { width: pageWidth, height: pageHeight } = page.getSize();
                    
                    // Convert coordinates (assuming customField coordinates are already in PDF space)
                    const x = customField.x || 50;
                    const y = customField.y || 50;

                    await this.renderCustomField(page, customField, propertyData, font, boldFont, pageHeight);
                    customFieldsPopulated++;
                    
                    populationLog.push(`✨ Custom field: "${customField.label || customField.type}" at (${Math.round(x)}, ${Math.round(y)})`);

                } catch (error) {
                    populationLog.push(`❌ Error adding custom field "${customField.label}": ${error.message}`);
                }
            }
        }

        // Step 3: Save the populated PDF
        const filename = `populated-${Date.now()}-${originalFilename}`;
        const populatedPdfBytes = await pdfDoc.save();
        const outputPath = path.join(appConfig.directories.output, filename);
        await fs.writeFile(outputPath, populatedPdfBytes);

        return {
            downloadUrl: `/output/${filename}`,
            filename,
            fieldsPopulated: formFieldsPopulated + customFieldsPopulated,
            formFieldsPopulated,
            customFieldsPopulated,
            populationLog
        };
    }

    /**
     * Render a custom field on the PDF page
     */
    async renderCustomField(page, field, propertyData, font, boldFont, pageHeight) {
        const x = field.x || 50;
        const y = pageHeight - (field.y || 50) - (field.height || 20);
        
        switch (field.type) {
            case 'text':
                let textValue = field.value || '';
                
                // Map to property data if specified
                if (field.dataMapping && propertyData[field.dataMapping]) {
                    textValue = String(propertyData[field.dataMapping]);
                }
                
                const fontSize = field.fontSize || 12;
                const textFont = field.fontWeight === 'bold' ? boldFont : font;
                const color = this.hexToRgb(field.color || '#000000');
                
                page.drawText(textValue, {
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    size: fontSize,
                    font: textFont,
                    color: rgb(color.r, color.g, color.b),
                });
                break;

            case 'checkbox':
                const isChecked = field.checked || field.value || false;
                const checkSize = field.size || 12;
                
                // Draw checkbox border
                page.drawRectangle({
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    width: checkSize,
                    height: checkSize,
                    borderColor: rgb(0, 0, 0),
                    borderWidth: 1,
                });
                
                // Draw checkmark if checked
                if (isChecked) {
                    page.drawText('✓', {
                        x: Math.max(0, x + 2),
                        y: Math.max(0, y + 2),
                        size: checkSize - 2,
                        font: font,
                        color: rgb(0, 0, 0),
                    });
                }
                
                // Draw label if present
                if (field.label) {
                    page.drawText(field.label, {
                        x: Math.max(0, x + checkSize + 5),
                        y: Math.max(0, y + 2),
                        size: field.fontSize || 10,
                        font: font,
                        color: rgb(0, 0, 0),
                    });
                }
                break;

            case 'date':
                let dateValue = field.value || '';
                
                if (field.useCurrentDate || !dateValue) {
                    const now = new Date();
                    dateValue = field.format === 'DD/MM/YYYY' 
                        ? `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
                        : field.format === 'YYYY-MM-DD'
                        ? now.toISOString().split('T')[0]
                        : `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`;
                }
                
                page.drawText(dateValue, {
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    size: field.fontSize || 12,
                    font: font,
                    color: rgb(0, 0, 0),
                });
                break;

            case 'signature':
                const sigWidth = field.width || 150;
                const sigHeight = field.height || 50;
                
                // Draw signature box
                page.drawRectangle({
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    width: sigWidth,
                    height: sigHeight,
                    borderColor: rgb(0.7, 0.7, 0.7),
                    borderWidth: 1,
                });
                
                // Add signature label
                page.drawText(field.label || 'Signature', {
                    x: Math.max(0, x + 5),
                    y: Math.max(0, y + sigHeight/2 - 5),
                    size: 10,
                    font: font,
                    color: rgb(0.5, 0.5, 0.5),
                });
                break;

            case 'initials':
                const initWidth = field.width || 50;
                const initHeight = field.height || 30;
                
                // Draw initials box
                page.drawRectangle({
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    width: initWidth,
                    height: initHeight,
                    borderColor: rgb(0.7, 0.7, 0.7),
                    borderWidth: 1,
                });
                
                page.drawText(field.label || 'Init.', {
                    x: Math.max(0, x + 5),
                    y: Math.max(0, y + initHeight/2 - 5),
                    size: 8,
                    font: font,
                    color: rgb(0.5, 0.5, 0.5),
                });
                break;

            case 'radio':
                if (field.options && Array.isArray(field.options)) {
                    const radioSize = 12;
                    const spacing = 20;
                    
                    field.options.forEach((option, index) => {
                        const radioY = y - (index * spacing);
                        const isSelected = field.selected === option || field.selected === index;
                        
                        // Draw radio button circle
                        page.drawCircle({
                            x: Math.max(0, x + radioSize/2),
                            y: Math.max(0, radioY + radioSize/2),
                            size: radioSize/2,
                            borderColor: rgb(0, 0, 0),
                            borderWidth: 1,
                        });
                        
                        // Fill if selected
                        if (isSelected) {
                            page.drawCircle({
                                x: Math.max(0, x + radioSize/2),
                                y: Math.max(0, radioY + radioSize/2),
                                size: radioSize/4,
                                color: rgb(0, 0, 0),
                            });
                        }
                        
                        // Draw option label
                        page.drawText(String(option), {
                            x: Math.max(0, x + radioSize + 5),
                            y: Math.max(0, radioY + 2),
                            size: field.fontSize || 10,
                            font: font,
                            color: rgb(0, 0, 0),
                        });
                    });
                }
                break;
        }
    }

    /**
     * Map property data to field names (existing functionality)
     */
    mapDataToField(fieldName, data) {
        const lowerFieldName = fieldName.toLowerCase();
        
        // Direct mapping
        if (data[lowerFieldName]) return String(data[lowerFieldName]);
        
        // Smart mapping with pattern matching
        for (const [property, aliases] of Object.entries(this.fieldMappings)) {
            // Check property name
            if (lowerFieldName.includes(property.toLowerCase()) || property.toLowerCase().includes(lowerFieldName)) {
                return data[property] ? String(data[property]) : null;
            }
            
            // Check aliases
            for (const alias of aliases) {
                if (lowerFieldName.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lowerFieldName)) {
                    return data[property] ? String(data[property]) : null;
                }
            }
        }
        
        return null;
    }

    /**
     * Convert hex color to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0, g: 0, b: 0 };
    }

    /**
     * Get current date in various formats
     */
    getFormattedDate(format = 'MM/DD/YYYY') {
        const now = new Date();
        
        switch (format) {
            case 'DD/MM/YYYY':
                return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
            case 'YYYY-MM-DD':
                return now.toISOString().split('T')[0];
            case 'MM/DD/YYYY':
            default:
                return `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`;
        }
    }

    /**
     * Download generated PDF
     */
    async downloadPdf(req, res) {
        try {
            const { filename } = req.params;
            
            if (!filename) {
                return res.status(400).json({
                    success: false,
                    message: 'Filename required'
                });
            }

            const filePath = path.join(appConfig.directories.output, filename);
            
            // Check if file exists
            try {
                await fs.access(filePath);
            } catch (error) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found'
                });
            }

            // Set appropriate headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // Stream the file
            const fileStream = require('fs').createReadStream(filePath);
            fileStream.pipe(res);

        } catch (error) {
            console.error('PDF download error:', error);
            res.status(500).json({
                success: false,
                message: 'Download failed: ' + error.message
            });
        }
    }

    /**
     * Health check for PDF processing capabilities
     */
    async healthCheck(req, res) {
        try {
            // Test PDF-lib functionality
            const testDoc = await PDFDocument.create();
            const testPage = testDoc.addPage([612, 792]);
            testPage.drawText('Test', { x: 50, y: 50 });
            await testDoc.save();

            res.json({
                success: true,
                message: 'PDF processing system healthy',
                capabilities: {
                    pdfLib: true,
                    fontEmbedding: true,
                    formProcessing: true,
                    customFields: true
                },
                limits: {
                    maxFileSize: this.maxPdfSize,
                    maxCustomFields: appConfig.fields.maxCustomFields
                },
                supportedFormats: ['PDF'],
                version: '2.0.0'
            });

        } catch (error) {
            console.error('PDF health check failed:', error);
            res.status(500).json({
                success: false,
                message: 'PDF processing system error: ' + error.message
            });
        }
    }
}

module.exports = new PDFController();