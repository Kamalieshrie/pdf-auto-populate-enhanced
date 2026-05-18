/**
 * PDF Utilities
 * Handles PDF-specific operations, metadata extraction, and format conversions
 */

const { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

class PDFUtils {
    constructor() {
        this.supportedFormats = ['pdf'];
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
        this.compressionQuality = 0.8;
        
        // Standard PDF page sizes (in points)
        this.pageSizes = {
            'letter': { width: 612, height: 792 },
            'a4': { width: 595, height: 842 },
            'legal': { width: 612, height: 1008 },
            'tabloid': { width: 792, height: 1224 }
        };
    }

    /**
     * Extract PDF metadata and basic information
     */
    async extractPDFInfo(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();
            const pages = pdfDoc.getPages();
            
            const info = {
                pageCount: pages.length,
                hasForm: form.getFields().length > 0,
                formFieldCount: form.getFields().length,
                pages: [],
                metadata: {
                    title: pdfDoc.getTitle(),
                    author: pdfDoc.getAuthor(),
                    subject: pdfDoc.getSubject(),
                    keywords: pdfDoc.getKeywords(),
                    creator: pdfDoc.getCreator(),
                    producer: pdfDoc.getProducer(),
                    creationDate: pdfDoc.getCreationDate(),
                    modificationDate: pdfDoc.getModificationDate()
                },
                fileSize: pdfBuffer.length,
                isEncrypted: false // pdf-lib doesn't directly expose this
            };

            // Extract page information
            pages.forEach((page, index) => {
                const { width, height } = page.getSize();
                info.pages.push({
                    number: index + 1,
                    width,
                    height,
                    orientation: width > height ? 'landscape' : 'portrait',
                    rotation: page.getRotation().angle
                });
            });

            return info;
        } catch (error) {
            throw new Error(`Failed to extract PDF info: ${error.message}`);
        }
    }

    /**
     * Extract existing form fields from PDF
     */
    async extractFormFields(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();
            const extractedFields = [];

            fields.forEach(field => {
                const fieldInfo = {
                    name: field.getName(),
                    type: this.getFieldType(field),
                    isReadOnly: field.isReadOnly(),
                    isRequired: false // pdf-lib doesn't expose this directly
                };

                // Add type-specific properties
                if (field instanceof PDFTextField) {
                    fieldInfo.value = field.getText();
                    fieldInfo.maxLength = field.getMaxLength();
                    fieldInfo.multiline = field.isMultiline();
                    fieldInfo.password = field.isPassword();
                    fieldInfo.fileSelect = field.isFileSelect();
                    fieldInfo.spellCheck = field.isSpellCheckEnabled();
                    fieldInfo.scrollable = field.isScrollable();
                    fieldInfo.combing = field.isCombable();
                    fieldInfo.richText = field.isRichFormatted();
                } else if (field instanceof PDFCheckBox) {
                    fieldInfo.checked = field.isChecked();
                } else if (field instanceof PDFDropdown) {
                    fieldInfo.options = field.getOptions();
                    fieldInfo.selected = field.getSelected();
                    fieldInfo.multiSelect = field.isMultiSelect();
                    fieldInfo.editable = field.isEditable();
                    fieldInfo.sorted = field.isSorted();
                } else if (field instanceof PDFRadioGroup) {
                    fieldInfo.options = field.getOptions();
                    fieldInfo.selected = field.getSelected();
                }

                // Try to extract widget annotations for position/size
                try {
                    const widgets = field.acroField.getWidgets();
                    if (widgets.length > 0) {
                        const widget = widgets[0];
                        const rect = widget.getRectangle();
                        fieldInfo.position = {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        };
                    }
                } catch (e) {
                    // Widget extraction failed, continue without position
                }

                extractedFields.push(fieldInfo);
            });

            return extractedFields;
        } catch (error) {
            throw new Error(`Failed to extract form fields: ${error.message}`);
        }
    }

    /**
     * Create a new PDF with form fields
     */
    async createPDFWithFields(fields, pageSize = 'letter', orientation = 'portrait') {
        try {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage(this.getPageDimensions(pageSize, orientation));
            const form = pdfDoc.getForm();
            const { width: pageWidth, height: pageHeight } = page.getSize();

            fields.forEach(field => {
                this.addFieldToPDF(form, field, pageWidth, pageHeight);
            });

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to create PDF with fields: ${error.message}`);
        }
    }

    /**
     * Fill existing PDF form fields
     */
    async fillPDFFields(pdfBuffer, fieldData) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();

            Object.entries(fieldData).forEach(([fieldName, value]) => {
                try {
                    const field = form.getField(fieldName);
                    this.setFieldValue(field, value);
                } catch (error) {
                    console.warn(`Failed to set field ${fieldName}: ${error.message}`);
                }
            });

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to fill PDF fields: ${error.message}`);
        }
    }

    /**
     * Flatten PDF form (make fields non-editable)
     */
    async flattenPDF(pdfBuffer, fieldsToFlatten = null) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();

            if (fieldsToFlatten) {
                // Flatten specific fields
                fieldsToFlatten.forEach(fieldName => {
                    try {
                        const field = form.getField(fieldName);
                        field.defaultUpdateAppearances();
                        form.flatten([field]);
                    } catch (error) {
                        console.warn(`Failed to flatten field ${fieldName}: ${error.message}`);
                    }
                });
            } else {
                // Flatten all form fields
                form.flatten();
            }

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to flatten PDF: ${error.message}`);
        }
    }

    /**
     * Split PDF into separate pages
     */
    async splitPDF(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pageCount = pdfDoc.getPageCount();
            const splitPDFs = [];

            for (let i = 0; i < pageCount; i++) {
                const newPDF = await PDFDocument.create();
                const [page] = await newPDF.copyPages(pdfDoc, [i]);
                newPDF.addPage(page);
                
                const pdfBytes = await newPDF.save();
                splitPDFs.push({
                    pageNumber: i + 1,
                    pdfBuffer: pdfBytes
                });
            }

            return splitPDFs;
        } catch (error) {
            throw new Error(`Failed to split PDF: ${error.message}`);
        }
    }

    /**
     * Merge multiple PDFs
     */
    async mergePDFs(pdfBuffers) {
        try {
            const mergedPDF = await PDFDocument.create();

            for (const pdfBuffer of pdfBuffers) {
                const pdf = await PDFDocument.load(pdfBuffer);
                const pageIndices = Array.from({ length: pdf.getPageCount() }, (_, i) => i);
                const pages = await mergedPDF.copyPages(pdf, pageIndices);
                pages.forEach(page => mergedPDF.addPage(page));
            }

            return await mergedPDF.save();
        } catch (error) {
            throw new Error(`Failed to merge PDFs: ${error.message}`);
        }
    }

    /**
     * Add watermark to PDF
     */
    async addWatermark(pdfBuffer, watermarkText, options = {}) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();

            const {
                fontSize = 50,
                color = [0.5, 0.5, 0.5],
                opacity = 0.5,
                rotation = -45,
                position = 'center'
            } = options;

            pages.forEach(page => {
                const { width, height } = page.getSize();
                let x, y;

                switch (position) {
                    case 'center':
                        x = width / 2;
                        y = height / 2;
                        break;
                    case 'top-left':
                        x = 50;
                        y = height - 50;
                        break;
                    case 'top-right':
                        x = width - 50;
                        y = height - 50;
                        break;
                    case 'bottom-left':
                        x = 50;
                        y = 50;
                        break;
                    case 'bottom-right':
                        x = width - 50;
                        y = 50;
                        break;
                    default:
                        x = width / 2;
                        y = height / 2;
                }

                page.drawText(watermarkText, {
                    x,
                    y,
                    size: fontSize,
                    color: color,
                    opacity,
                    rotate: { type: 'degrees', angle: rotation }
                });
            });

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to add watermark: ${error.message}`);
        }
    }

    /**
     * Extract text from PDF
     */
    async extractText(pdfBuffer) {
        try {
            // Note: pdf-lib doesn't have built-in text extraction
            // This is a placeholder for when you might integrate with pdf-parse or similar
            throw new Error('Text extraction requires additional dependencies like pdf-parse');
        } catch (error) {
            throw new Error(`Failed to extract text: ${error.message}`);
        }
    }

    /**
     * Validate PDF file
     */
    async validatePDF(pdfBuffer, options = {}) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            info: null
        };

        try {
            // Check file size
            if (pdfBuffer.length > this.maxFileSize) {
                validation.isValid = false;
                validation.errors.push(`File size exceeds maximum allowed size of ${this.maxFileSize / (1024 * 1024)}MB`);
            }

            // Try to load PDF
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const info = await this.extractPDFInfo(pdfBuffer);
            validation.info = info;

            // Check page count
            if (options.maxPages && info.pageCount > options.maxPages) {
                validation.isValid = false;
                validation.errors.push(`PDF has ${info.pageCount} pages, maximum allowed is ${options.maxPages}`);
            }

            // Check if PDF has form fields when required
            if (options.requireFormFields && !info.hasForm) {
                validation.warnings.push('PDF does not contain form fields');
            }

            // Check if PDF is encrypted (basic check)
            if (info.isEncrypted && !options.allowEncrypted) {
                validation.isValid = false;
                validation.errors.push('Encrypted PDFs are not allowed');
            }

        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`Invalid PDF file: ${error.message}`);
        }

        return validation;
    }

    /**
     * Get page dimensions for standard sizes
     */
    getPageDimensions(size, orientation = 'portrait') {
        const dimensions = this.pageSizes[size.toLowerCase()] || this.pageSizes.letter;
        
        if (orientation === 'landscape') {
            return { width: dimensions.height, height: dimensions.width };
        }
        
        return dimensions;
    }

    /**
     * Add field to PDF form
     */
    addFieldToPDF(form, field, pageWidth, pageHeight) {
        const { x, y, width, height } = field.position || { x: 50, y: 50, width: 100, height: 20 };
        
        // Convert coordinates (PDF uses bottom-left origin)
        const pdfY = pageHeight - y - height;

        switch (field.type) {
            case 'text':
            case 'number':
            case 'email':
            case 'phone':
            case 'date':
                const textField = form.createTextField(field.name);
                textField.addToPage(form.getPage(0), {
                    x,
                    y: pdfY,
                    width,
                    height
                });
                if (field.value) textField.setText(field.value);
                if (field.properties?.maxLength) textField.setMaxLength(field.properties.maxLength);
                if (field.properties?.multiline) textField.enableMultiline();
                if (field.properties?.readOnly) textField.enableReadOnly();
                break;

            case 'checkbox':
                const checkBox = form.createCheckBox(field.name);
                checkBox.addToPage(form.getPage(0), {
                    x,
                    y: pdfY,
                    width,
                    height
                });
                if (field.checked) checkBox.check();
                break;

            case 'dropdown':
                const dropdown = form.createDropdown(field.name);
                dropdown.addToPage(form.getPage(0), {
                    x,
                    y: pdfY,
                    width,
                    height
                });
                if (field.options) dropdown.addOptions(field.options);
                if (field.selected) dropdown.select(field.selected);
                if (field.properties?.multiSelect) dropdown.enableMultiSelect();
                break;

            case 'radio':
                const radioGroup = form.createRadioGroup(field.name);
                field.options?.forEach((option, index) => {
                    radioGroup.addOptionToPage(option, form.getPage(0), {
                        x: x,
                        y: pdfY - (index * 25),
                        width: 15,
                        height: 15
                    });
                });
                if (field.selected) radioGroup.select(field.selected);
                break;

            default:
                console.warn(`Unsupported field type: ${field.type}`);
        }
    }

    /**
     * Set field value based on field type
     */
    setFieldValue(field, value) {
        try {
            if (field instanceof PDFTextField) {
                field.setText(String(value));
            } else if (field instanceof PDFCheckBox) {
                if (value) {
                    field.check();
                } else {
                    field.uncheck();
                }
            } else if (field instanceof PDFDropdown) {
                field.select(String(value));
            } else if (field instanceof PDFRadioGroup) {
                field.select(String(value));
            }
        } catch (error) {
            throw new Error(`Failed to set field value: ${error.message}`);
        }
    }

    /**
     * Get field type from PDF field
     */
    getFieldType(field) {
        if (field instanceof PDFTextField) {
            return 'text';
        } else if (field instanceof PDFCheckBox) {
            return 'checkbox';
        } else if (field instanceof PDFDropdown) {
            return 'dropdown';
        } else if (field instanceof PDFRadioGroup) {
            return 'radio';
        }
        return 'unknown';
    }

    /**
     * Convert PDF to images (requires additional dependencies)
     */
    async convertPDFToImages(pdfBuffer, options = {}) {
        // This would require pdf-poppler or similar library
        // Placeholder implementation
        throw new Error('PDF to image conversion requires additional dependencies like pdf-poppler');
    }

    /**
     * Optimize PDF size
     */
    async optimizePDF(pdfBuffer, options = {}) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            
            // Remove metadata if requested
            if (options.removeMetadata) {
                pdfDoc.setTitle('');
                pdfDoc.setAuthor('');
                pdfDoc.setSubject('');
                pdfDoc.setKeywords([]);
                pdfDoc.setProducer('');
                pdfDoc.setCreator('');
            }

            // Compress images (basic implementation)
            // Note: pdf-lib has limited image compression capabilities
            
            return await pdfDoc.save({
                useObjectStreams: options.useObjectStreams !== false,
                addDefaultPage: false,
                objectsPerTick: options.objectsPerTick || 50
            });
        } catch (error) {
            throw new Error(`Failed to optimize PDF: ${error.message}`);
        }
    }

    /**
     * Add page numbers to PDF
     */
    async addPageNumbers(pdfBuffer, options = {}) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();
            const font = await pdfDoc.embedFont('Helvetica');

            const {
                fontSize = 12,
                color = [0, 0, 0],
                position = 'bottom-center',
                format = 'Page {page} of {total}',
                startPage = 1,
                margin = 20
            } = options;

            pages.forEach((page, index) => {
                if (index + 1 < startPage) return;

                const { width, height } = page.getSize();
                const pageNumber = index + 1;
                const totalPages = pages.length;
                
                const text = format
                    .replace('{page}', pageNumber)
                    .replace('{total}', totalPages);

                const textWidth = font.widthOfTextAtSize(text, fontSize);
                let x, y;

                switch (position) {
                    case 'top-left':
                        x = margin;
                        y = height - margin;
                        break;
                    case 'top-center':
                        x = (width - textWidth) / 2;
                        y = height - margin;
                        break;
                    case 'top-right':
                        x = width - textWidth - margin;
                        y = height - margin;
                        break;
                    case 'bottom-left':
                        x = margin;
                        y = margin;
                        break;
                    case 'bottom-center':
                        x = (width - textWidth) / 2;
                        y = margin;
                        break;
                    case 'bottom-right':
                        x = width - textWidth - margin;
                        y = margin;
                        break;
                    default:
                        x = (width - textWidth) / 2;
                        y = margin;
                }

                page.drawText(text, {
                    x,
                    y,
                    size: fontSize,
                    font,
                    color
                });
            });

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to add page numbers: ${error.message}`);
        }
    }

    /**
     * Add header/footer to PDF
     */
    async addHeaderFooter(pdfBuffer, options = {}) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pages = pdfDoc.getPages();
            const font = await pdfDoc.embedFont('Helvetica');

            const {
                header = null,
                footer = null,
                fontSize = 10,
                color = [0, 0, 0],
                margin = 20
            } = options;

            pages.forEach((page, index) => {
                const { width, height } = page.getSize();

                if (header) {
                    const headerText = typeof header === 'function' ? header(index + 1, pages.length) : header;
                    const headerWidth = font.widthOfTextAtSize(headerText, fontSize);
                    
                    page.drawText(headerText, {
                        x: (width - headerWidth) / 2,
                        y: height - margin,
                        size: fontSize,
                        font,
                        color
                    });
                }

                if (footer) {
                    const footerText = typeof footer === 'function' ? footer(index + 1, pages.length) : footer;
                    const footerWidth = font.widthOfTextAtSize(footerText, fontSize);
                    
                    page.drawText(footerText, {
                        x: (width - footerWidth) / 2,
                        y: margin,
                        size: fontSize,
                        font,
                        color
                    });
                }
            });

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to add header/footer: ${error.message}`);
        }
    }

    /**
     * Create PDF from template
     */
    async createFromTemplate(templateData, fillData = {}) {
        try {
            const pdfDoc = await PDFDocument.create();
            const { pageSize = 'letter', orientation = 'portrait', fields = [] } = templateData;
            
            const page = pdfDoc.addPage(this.getPageDimensions(pageSize, orientation));
            const form = pdfDoc.getForm();
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Add fields from template
            fields.forEach(field => {
                const fieldWithData = {
                    ...field,
                    value: fillData[field.name] || field.value || ''
                };
                this.addFieldToPDF(form, fieldWithData, pageWidth, pageHeight);
            });

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to create PDF from template: ${error.message}`);
        }
    }

    /**
     * Get PDF form field names
     */
    async getFormFieldNames(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();
            
            return fields.map(field => ({
                name: field.getName(),
                type: this.getFieldType(field)
            }));
        } catch (error) {
            throw new Error(`Failed to get form field names: ${error.message}`);
        }
    }

    /**
     * Check if PDF has form fields
     */
    async hasFormFields(pdfBuffer) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();
            return form.getFields().length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Remove form fields from PDF
     */
    async removeFormFields(pdfBuffer, fieldNames = null) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();

            if (fieldNames) {
                // Remove specific fields
                fieldNames.forEach(fieldName => {
                    try {
                        form.removeField(form.getField(fieldName));
                    } catch (error) {
                        console.warn(`Failed to remove field ${fieldName}: ${error.message}`);
                    }
                });
            } else {
                // Remove all form fields
                const fields = form.getFields();
                fields.forEach(field => {
                    try {
                        form.removeField(field);
                    } catch (error) {
                        console.warn(`Failed to remove field ${field.getName()}: ${error.message}`);
                    }
                });
            }

            return await pdfDoc.save();
        } catch (error) {
            throw new Error(`Failed to remove form fields: ${error.message}`);
        }
    }

    /**
     * Generate PDF thumbnail (placeholder - requires additional dependencies)
     */
    async generateThumbnail(pdfBuffer, options = {}) {
        // This would require pdf-poppler or canvas + pdf.js
        throw new Error('Thumbnail generation requires additional dependencies');
    }

    /**
     * Calculate PDF file hash
     */
    calculateHash(pdfBuffer, algorithm = 'sha256') {
        const crypto = require('crypto');
        return crypto.createHash(algorithm).update(pdfBuffer).digest('hex');
    }

    /**
     * Compare two PDFs
     */
    async comparePDFs(pdfBuffer1, pdfBuffer2) {
        try {
            const hash1 = this.calculateHash(pdfBuffer1);
            const hash2 = this.calculateHash(pdfBuffer2);
            
            const info1 = await this.extractPDFInfo(pdfBuffer1);
            const info2 = await this.extractPDFInfo(pdfBuffer2);

            return {
                identical: hash1 === hash2,
                hash1,
                hash2,
                differences: {
                    pageCount: info1.pageCount !== info2.pageCount,
                    formFieldCount: info1.formFieldCount !== info2.formFieldCount,
                    fileSize: info1.fileSize !== info2.fileSize
                },
                info1,
                info2
            };
        } catch (error) {
            throw new Error(`Failed to compare PDFs: ${error.message}`);
        }
    }

    /**
     * Save PDF to file system
     */
    async savePDFToFile(pdfBuffer, filePath) {
        try {
            await fs.writeFile(filePath, pdfBuffer);
            return {
                success: true,
                filePath,
                size: pdfBuffer.length
            };
        } catch (error) {
            throw new Error(`Failed to save PDF: ${error.message}`);
        }
    }

    /**
     * Load PDF from file system
     */
    async loadPDFFromFile(filePath) {
        try {
            const pdfBuffer = await fs.readFile(filePath);
            return pdfBuffer;
        } catch (error) {
            throw new Error(`Failed to load PDF: ${error.message}`);
        }
    }
}

module.exports = new PDFUtils();
