// public/js/utils/pdf-utils.js - PDF Utility Functions

class PDFUtils {
    // PDF processing states
    static processingStates = {
        IDLE: 'idle',
        LOADING: 'loading',
        PROCESSING: 'processing',
        COMPLETE: 'complete',
        ERROR: 'error'
    };

    // PDF field mapping cache
    static fieldMappingCache = new Map();
    static pdfDocumentCache = new Map();
    
    // Default PDF generation settings
    static defaultSettings = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50
        },
        quality: 1.0,
        compression: 'FAST',
        fontSize: 12,
        fontFamily: 'Helvetica',
        lineHeight: 1.4
    };

    // ===== PDF DOCUMENT OPERATIONS =====
    
    static async loadPDF(file) {
        try {
            if (!file) throw new Error('No file provided');
            
            const cacheKey = this.generateCacheKey(file);
            if (this.pdfDocumentCache.has(cacheKey)) {
                return this.pdfDocumentCache.get(cacheKey);
            }

            const arrayBuffer = await this.fileToArrayBuffer(file);
            const pdfDoc = await this.parsePDFDocument(arrayBuffer);
            
            // Cache the document
            this.pdfDocumentCache.set(cacheKey, pdfDoc);
            
            return pdfDoc;
        } catch (error) {
            console.error('Error loading PDF:', error);
            throw new Error(`Failed to load PDF: ${error.message}`);
        }
    }

    static async parsePDFDocument(arrayBuffer) {
        // This would integrate with PDF.js or similar library
        // For now, return a mock structure
        return {
            numPages: 1,
            pages: [
                {
                    pageNumber: 1,
                    width: 595.28, // A4 width in points
                    height: 841.89, // A4 height in points
                    fields: [],
                    annotations: []
                }
            ],
            metadata: {
                title: '',
                author: '',
                subject: '',
                creator: '',
                producer: '',
                creationDate: new Date(),
                modDate: new Date()
            }
        };
    }

    static async extractFormFields(pdfDocument) {
        try {
            const fields = [];
            
            for (const page of pdfDocument.pages) {
                const pageFields = await this.extractPageFields(page);
                fields.push(...pageFields);
            }
            
            return this.normalizeFields(fields);
        } catch (error) {
            console.error('Error extracting form fields:', error);
            return [];
        }
    }

    static async extractPageFields(page) {
        // Extract interactive form fields from PDF page
        const fields = [];
        
        // Mock field extraction - replace with actual PDF parsing
        if (page.annotations) {
            page.annotations.forEach((annotation, index) => {
                if (annotation.subtype === 'Widget') {
                    fields.push({
                        id: `field_${page.pageNumber}_${index}`,
                        name: annotation.fieldName || `field_${index}`,
                        type: this.mapPDFFieldType(annotation.fieldType),
                        pageNumber: page.pageNumber,
                        rect: annotation.rect,
                        x: annotation.rect[0],
                        y: annotation.rect[1],
                        width: annotation.rect[2] - annotation.rect[0],
                        height: annotation.rect[3] - annotation.rect[1],
                        value: annotation.fieldValue || '',
                        defaultValue: annotation.defaultValue || '',
                        required: annotation.required || false,
                        readonly: annotation.readonly || false,
                        options: annotation.options || []
                    });
                }
            });
        }
        
        return fields;
    }

    static mapPDFFieldType(pdfFieldType) {
        const typeMapping = {
            'Tx': 'text',        // Text field
            'Ch': 'dropdown',    // Choice field (dropdown/listbox)
            'Btn': 'checkbox',   // Button field (checkbox/radio)
            'Sig': 'signature'   // Signature field
        };
        
        return typeMapping[pdfFieldType] || 'text';
    }

    static normalizeFields(fields) {
        return fields.map(field => ({
            ...field,
            id: field.id || this.generateFieldId(),
            name: this.sanitizeFieldName(field.name),
            type: field.type || 'text',
            value: field.value || '',
            mapped: false,
            mappingKey: null
        }));
    }

    // ===== FIELD MAPPING OPERATIONS =====
    
    static createFieldMapping(pdfFields, dataKeys) {
        const mapping = {};
        const usedDataKeys = new Set();
        
        pdfFields.forEach(field => {
            const bestMatch = this.findBestDataKeyMatch(field.name, dataKeys, usedDataKeys);
            if (bestMatch) {
                mapping[field.name] = bestMatch;
                usedDataKeys.add(bestMatch);
            }
        });
        
        return mapping;
    }

    static findBestDataKeyMatch(fieldName, dataKeys, usedKeys = new Set()) {
        if (!fieldName || !dataKeys) return null;
        
        const cleanFieldName = this.sanitizeFieldName(fieldName).toLowerCase();
        const availableKeys = dataKeys.filter(key => !usedKeys.has(key));
        
        // Exact match
        let exactMatch = availableKeys.find(key => 
            key.toLowerCase() === cleanFieldName
        );
        if (exactMatch) return exactMatch;
        
        // Partial match (field name contains data key or vice versa)
        let partialMatch = availableKeys.find(key => {
            const cleanKey = key.toLowerCase();
            return cleanFieldName.includes(cleanKey) || cleanKey.includes(cleanFieldName);
        });
        if (partialMatch) return partialMatch;
        
        // Fuzzy match using common patterns
        const patterns = this.getFieldNamePatterns();
        for (const [pattern, dataKeyPattern] of patterns) {
            if (cleanFieldName.match(pattern)) {
                const match = availableKeys.find(key => 
                    key.toLowerCase().match(dataKeyPattern)
                );
                if (match) return match;
            }
        }
        
        return null;
    }

    static getFieldNamePatterns() {
        return new Map([
            [/name|full.?name|customer.?name/, /name/],
            [/first.?name|fname/, /first|fname/],
            [/last.?name|lname|surname/, /last|lname|surname/],
            [/email|e.?mail/, /email|mail/],
            [/phone|telephone|mobile/, /phone|tel|mobile/],
            [/address|addr/, /address|addr/],
            [/city/, /city/],
            [/state|province/, /state|province/],
            [/zip|postal/, /zip|postal|code/],
            [/date|dt/, /date|dt/],
            [/amount|price|cost/, /amount|price|cost|fee/],
            [/signature|sign/, /signature|sign/],
            [/initial/, /initial/],
            [/rent/, /rent/],
            [/bed|bedroom/, /bed/],
            [/bath|bathroom/, /bath/],
            [/sqft|square.?feet/, /sqft|area/],
            [/unit|apartment/, /unit|name/],
            [/property/, /property/],
            [/balance/, /balance/],
            [/fee/, /fee/],
            [/status/, /status/]
        ]);
    }

    static applyDataMapping(pdfFields, data, mapping = null) {
        if (!mapping) {
            mapping = this.createFieldMapping(
                pdfFields,
                Object.keys(data)
            );
        }
        
        return pdfFields.map(field => {
            const dataKey = mapping[field.name];
            if (dataKey && data.hasOwnProperty(dataKey)) {
                return {
                    ...field,
                    value: this.formatFieldValue(data[dataKey], field.type),
                    mapped: true,
                    mappingKey: dataKey
                };
            }
            return field;
        });
    }

    static formatFieldValue(value, fieldType) {
        if (value === null || value === undefined) return '';
        
        switch (fieldType) {
            case 'date':
                return this.formatDate(value);
            case 'currency':
                return this.formatCurrency(value);
            case 'number':
                return this.formatNumber(value);
            case 'checkbox':
                return this.formatBoolean(value);
            case 'text':
            case 'textarea':
            default:
                return String(value);
        }
    }

    static formatDate(value) {
        try {
            const date = new Date(value);
            if (isNaN(date.getTime())) return String(value);
            return date.toLocaleDateString();
        } catch {
            return String(value);
        }
    }

    static formatCurrency(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return String(value);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(numValue);
    }

    static formatNumber(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return String(value);
        return numValue.toFixed(2);
    }

    static formatBoolean(value) {
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            return ['true', 'yes', '1', 'on'].includes(lower) ? 'Yes' : 'No';
        }
        return value ? 'Yes' : 'No';
    }

    // ===== CUSTOM FIELD OPERATIONS =====
    
    static addCustomField(pdfDocument, fieldConfig) {
        try {
            const field = {
                id: fieldConfig.id || this.generateFieldId(),
                name: fieldConfig.name,
                type: fieldConfig.type || 'text',
                pageNumber: fieldConfig.pageNumber || 1,
                x: fieldConfig.x || 0,
                y: fieldConfig.y || 0,
                width: fieldConfig.width || 100,
                height: fieldConfig.height || 20,
                value: fieldConfig.value || '',
                defaultValue: fieldConfig.defaultValue || '',
                required: fieldConfig.required || false,
                readonly: fieldConfig.readonly || false,
                style: {
                    fontSize: fieldConfig.fontSize || 12,
                    fontFamily: fieldConfig.fontFamily || 'Helvetica',
                    color: fieldConfig.color || '#000000',
                    backgroundColor: fieldConfig.backgroundColor || 'transparent',
                    borderColor: fieldConfig.borderColor || '#000000',
                    borderWidth: fieldConfig.borderWidth || 1,
                    ...fieldConfig.style
                },
                custom: true,
                createdAt: new Date().toISOString()
            };
            
            // Add field to appropriate page
            const page = pdfDocument.pages.find(p => p.pageNumber === field.pageNumber);
            if (page) {
                page.fields = page.fields || [];
                page.fields.push(field);
            }
            
            return field;
        } catch (error) {
            console.error('Error adding custom field:', error);
            throw error;
        }
    }

    static updateCustomField(pdfDocument, fieldId, updates) {
        try {
            for (const page of pdfDocument.pages) {
                const fieldIndex = page.fields?.findIndex(f => f.id === fieldId);
                if (fieldIndex >= 0) {
                    page.fields[fieldIndex] = {
                        ...page.fields[fieldIndex],
                        ...updates,
                        updatedAt: new Date().toISOString()
                    };
                    return page.fields[fieldIndex];
                }
            }
            throw new Error('Field not found');
        } catch (error) {
            console.error('Error updating custom field:', error);
            throw error;
        }
    }

    static removeCustomField(pdfDocument, fieldId) {
        try {
            for (const page of pdfDocument.pages) {
                if (page.fields) {
                    const initialLength = page.fields.length;
                    page.fields = page.fields.filter(f => f.id !== fieldId);
                    if (page.fields.length < initialLength) {
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            console.error('Error removing custom field:', error);
            return false;
        }
    }

    // ===== PDF GENERATION =====
    
    static async generatePDF(pdfDocument, fields, settings = {}) {
        try {
            const config = { ...this.defaultSettings, ...settings };
            
            // Create new PDF with filled data
            const pdfData = await this.createPDFWithFields(pdfDocument, fields, config);
            
            return {
                data: pdfData,
                filename: this.generateFileName(pdfDocument),
                contentType: 'application/pdf',
                size: pdfData.length
            };
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw new Error(`PDF generation failed: ${error.message}`);
        }
    }

    static async createPDFWithFields(pdfDocument, fields, config) {
        // This would integrate with a PDF generation library like jsPDF or PDF-lib
        // For now, return mock data
        const mockPDFData = new Uint8Array([
            0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34 // PDF header
        ]);
        
        return mockPDFData;
    }

    static generateFileName(pdfDocument, suffix = '') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = pdfDocument.metadata?.title || 'document';
        const cleanBaseName = this.sanitizeFileName(baseName);
        
        return `${cleanBaseName}${suffix ? `_${suffix}` : ''}_${timestamp}.pdf`;
    }

    static sanitizeFileName(filename) {
        return filename
            .replace(/[^a-zA-Z0-9\-_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    // ===== VALIDATION =====
    
    static validatePDFDocument(pdfDocument) {
        const errors = [];
        
        if (!pdfDocument) {
            errors.push('PDF document is required');
            return errors;
        }
        
        if (!pdfDocument.pages || pdfDocument.pages.length === 0) {
            errors.push('PDF document must have at least one page');
        }
        
        pdfDocument.pages.forEach((page, index) => {
            if (!page.pageNumber) {
                errors.push(`Page ${index + 1} is missing page number`);
            }
            
            if (!page.width || !page.height) {
                errors.push(`Page ${index + 1} is missing dimensions`);
            }
            
            if (page.fields) {
                page.fields.forEach((field, fieldIndex) => {
                    const fieldErrors = this.validateField(field);
                    fieldErrors.forEach(error => {
                        errors.push(`Page ${index + 1}, Field ${fieldIndex + 1}: ${error}`);
                    });
                });
            }
        });
        
        return errors;
    }

    static validateField(field) {
        const errors = [];
        
        if (!field.name) {
            errors.push('Field name is required');
        }
        
        if (!field.type) {
            errors.push('Field type is required');
        }
        
        if (field.x === undefined || field.y === undefined) {
            errors.push('Field position is required');
        }
        
        if (!field.width || !field.height) {
            errors.push('Field dimensions are required');
        }
        
        if (field.required && !field.value) {
            errors.push('Required field must have a value');
        }
        
        return errors;
    }

    static validateFieldData(fields, data) {
        const errors = [];
        const requiredFields = fields.filter(f => f.required);
        
        requiredFields.forEach(field => {
            if (!field.value && (!data || !data[field.mappingKey])) {
                errors.push(`Required field '${field.name}' is missing data`);
            }
        });
        
        return errors;
    }

    // ===== COORDINATE CONVERSION =====
    
    static convertCoordinates(x, y, fromSystem, toSystem, pageHeight = 841.89) {
        // Convert between different coordinate systems
        switch (`${fromSystem}-${toSystem}`) {
            case 'screen-pdf':
                return {
                    x: x,
                    y: pageHeight - y // PDF coordinates start from bottom-left
                };
            case 'pdf-screen':
                return {
                    x: x,
                    y: pageHeight - y // Convert back to top-left origin
                };
            default:
                return { x, y };
        }
    }

    static pointsToPixels(points, dpi = 72) {
        return (points * dpi) / 72;
    }

    static pixelsToPoints(pixels, dpi = 72) {
        return (pixels * 72) / dpi;
    }

    static calculateFieldBounds(field) {
        return {
            left: field.x,
            top: field.y,
            right: field.x + field.width,
            bottom: field.y + field.height,
            centerX: field.x + field.width / 2,
            centerY: field.y + field.height / 2
        };
    }

    // ===== UTILITY FUNCTIONS =====
    
    static generateFieldId() {
        return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    static generateCacheKey(file) {
        return `${file.name}_${file.size}_${file.lastModified}`;
    }

    static sanitizeFieldName(name) {
        return name
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    static async fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    static async arrayBufferToBlob(arrayBuffer, mimeType = 'application/pdf') {
        return new Blob([arrayBuffer], { type: mimeType });
    }

    static downloadPDF(pdfData, filename) {
        try {
            const blob = this.arrayBufferToBlob(pdfData);
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            return true;
        } catch (error) {
            console.error('Error downloading PDF:', error);
            return false;
        }
    }

    // ===== CACHE MANAGEMENT =====
    
    static clearCache() {
        this.fieldMappingCache.clear();
        this.pdfDocumentCache.clear();
    }

    static getCacheSize() {
        return {
            fieldMappings: this.fieldMappingCache.size,
            documents: this.pdfDocumentCache.size
        };
    }

    static getCacheInfo() {
        return {
            fieldMappings: Array.from(this.fieldMappingCache.keys()),
            documents: Array.from(this.pdfDocumentCache.keys())
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFUtils;
} else if (typeof window !== 'undefined') {
    window.PDFUtils = PDFUtils;
}