/**
 * PDF Service - Handles PDF rendering, manipulation, and field detection
 */
class PDFService {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.canvas = null;
        this.context = null;
        this.fields = new Map();
        this.annotations = [];
        this.renderTask = null;
    }

    /**
     * Initialize PDF.js
     */
    async initialize() {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded');
        }
        
        // Configure PDF.js worker
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    /**
     * Load PDF from file
     */
    async loadPDF(file) {
        try {
            await this.initialize();
            
            const arrayBuffer = await this.fileToArrayBuffer(file);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;
            
            await this.extractFields();
            
            return {
                success: true,
                totalPages: this.totalPages,
                fields: Array.from(this.fields.values())
            };
        } catch (error) {
            console.error('Error loading PDF:', error);
            throw new Error(`Failed to load PDF: ${error.message}`);
        }
    }

    /**
     * Load PDF from URL
     */
    async loadPDFFromURL(url) {
        try {
            await this.initialize();
            
            const loadingTask = pdfjsLib.getDocument(url);
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;
            
            await this.extractFields();
            
            return {
                success: true,
                totalPages: this.totalPages,
                fields: Array.from(this.fields.values())
            };
        } catch (error) {
            console.error('Error loading PDF from URL:', error);
            throw new Error(`Failed to load PDF from URL: ${error.message}`);
        }
    }

    /**
     * Render PDF page to canvas
     */
    async renderPage(pageNumber, canvas, scale = 1.0) {
        if (!this.pdfDoc) {
            throw new Error('No PDF loaded');
        }

        if (pageNumber < 1 || pageNumber > this.totalPages) {
            throw new Error('Invalid page number');
        }

        try {
            // Cancel previous render task
            if (this.renderTask) {
                this.renderTask.cancel();
            }

            const page = await this.pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            
            this.canvas = canvas;
            this.context = canvas.getContext('2d');
            this.scale = scale;
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const renderContext = {
                canvasContext: this.context,
                viewport: viewport
            };
            
            this.renderTask = page.render(renderContext);
            await this.renderTask.promise;
            
            this.currentPage = pageNumber;
            
            // Render form fields overlay
            await this.renderFieldsOverlay(page, viewport);
            
            return {
                success: true,
                width: viewport.width,
                height: viewport.height,
                scale: scale
            };
        } catch (error) {
            if (error.name === 'RenderingCancelledException') {
                console.log('Rendering cancelled');
                return { success: false, cancelled: true };
            }
            console.error('Error rendering page:', error);
            throw new Error(`Failed to render page: ${error.message}`);
        }
    }

    /**
     * Extract form fields from PDF
     */
    async extractFields() {
        if (!this.pdfDoc) return;

        this.fields.clear();
        
        try {
            for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
                const page = await this.pdfDoc.getPage(pageNum);
                const annotations = await page.getAnnotations();
                
                annotations.forEach((annotation, index) => {
                    if (this.isFormField(annotation)) {
                        const field = this.createFieldFromAnnotation(annotation, pageNum, index);
                        this.fields.set(field.id, field);
                    }
                });
            }
        } catch (error) {
            console.error('Error extracting fields:', error);
        }
    }

    /**
     * Check if annotation is a form field
     */
    isFormField(annotation) {
        const fieldTypes = ['Tx', 'Btn', 'Ch', 'Sig'];
        return fieldTypes.includes(annotation.subtype);
    }

    /**
     * Create field object from annotation
     */
    createFieldFromAnnotation(annotation, pageNumber, index) {
        const fieldType = this.getFieldType(annotation);
        
        return {
            id: `field_${pageNumber}_${index}`,
            name: annotation.fieldName || `field_${pageNumber}_${index}`,
            type: fieldType,
            page: pageNumber,
            rect: annotation.rect,
            value: annotation.fieldValue || '',
            required: annotation.required || false,
            readOnly: annotation.readOnly || false,
            options: annotation.options || [],
            multiline: annotation.multiline || false,
            maxLength: annotation.maxLen || null,
            annotation: annotation
        };
    }

    /**
     * Get field type from annotation
     */
    getFieldType(annotation) {
        switch (annotation.subtype) {
            case 'Tx':
                return annotation.multiline ? 'textarea' : 'text';
            case 'Btn':
                return annotation.checkBox ? 'checkbox' : 
                       annotation.radioButton ? 'radio' : 'button';
            case 'Ch':
                return annotation.combo ? 'dropdown' : 'listbox';
            case 'Sig':
                return 'signature';
            default:
                return 'text';
        }
    }

    /**
     * Render form fields overlay
     */
    async renderFieldsOverlay(page, viewport) {
        if (!this.canvas) return;

        const annotations = await page.getAnnotations();
        
        annotations.forEach((annotation) => {
            if (this.isFormField(annotation)) {
                this.renderFieldBorder(annotation.rect, viewport);
            }
        });
    }

    /**
     * Render field border on canvas
     */
    renderFieldBorder(rect, viewport) {
        if (!this.context) return;

        const [x1, y1, x2, y2] = rect;
        const canvasRect = viewport.convertToViewportRectangle(rect);
        
        this.context.save();
        this.context.strokeStyle = '#007bff';
        this.context.lineWidth = 2;
        this.context.setLineDash([3, 3]);
        
        this.context.strokeRect(
            canvasRect[0],
            this.canvas.height - canvasRect[3],
            canvasRect[2] - canvasRect[0],
            canvasRect[3] - canvasRect[1]
        );
        
        this.context.restore();
    }

    /**
     * Get field at coordinates
     */
    getFieldAtPosition(x, y, pageNumber = null) {
        const targetPage = pageNumber || this.currentPage;
        
        const fieldsOnPage = Array.from(this.fields.values())
            .filter(field => field.page === targetPage);
        
        return fieldsOnPage.find(field => {
            const [x1, y1, x2, y2] = field.rect;
            return x >= x1 && x <= x2 && y >= y1 && y <= y2;
        });
    }

    /**
     * Update field value
     */
    updateFieldValue(fieldId, value) {
        const field = this.fields.get(fieldId);
        if (field) {
            field.value = value;
            return true;
        }
        return false;
    }

    /**
     * Get all fields
     */
    getAllFields() {
        return Array.from(this.fields.values());
    }

    /**
     * Get fields by page
     */
    getFieldsByPage(pageNumber) {
        return Array.from(this.fields.values())
            .filter(field => field.page === pageNumber);
    }

    /**
     * Get field by ID
     */
    getField(fieldId) {
        return this.fields.get(fieldId);
    }

    /**
     * Add custom field
     */
    addCustomField(fieldData) {
        const field = {
            id: fieldData.id || `custom_${Date.now()}`,
            name: fieldData.name || fieldData.id,
            type: fieldData.type || 'text',
            page: fieldData.page || this.currentPage,
            rect: fieldData.rect || [0, 0, 100, 20],
            value: fieldData.value || '',
            required: fieldData.required || false,
            readOnly: fieldData.readOnly || false,
            options: fieldData.options || [],
            custom: true
        };
        
        this.fields.set(field.id, field);
        return field;
    }

    /**
     * Remove field
     */
    removeField(fieldId) {
        return this.fields.delete(fieldId);
    }

    /**
     * Export field data
     */
    exportFieldData() {
        const fieldData = {};
        this.fields.forEach((field, id) => {
            fieldData[id] = {
                name: field.name,
                value: field.value,
                type: field.type,
                page: field.page
            };
        });
        return fieldData;
    }

    /**
     * Import field data
     */
    importFieldData(fieldData) {
        Object.keys(fieldData).forEach(fieldId => {
            const field = this.fields.get(fieldId);
            if (field && fieldData[fieldId].value !== undefined) {
                field.value = fieldData[fieldId].value;
            }
        });
    }

    /**
     * Convert file to array buffer
     */
    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Get PDF metadata
     */
    async getMetadata() {
        if (!this.pdfDoc) return null;

        try {
            const metadata = await this.pdfDoc.getMetadata();
            return metadata;
        } catch (error) {
            console.error('Error getting metadata:', error);
            return null;
        }
    }

    /**
     * Search text in PDF
     */
    async searchText(query, pageNumber = null) {
        if (!this.pdfDoc) return [];

        const results = [];
        const startPage = pageNumber || 1;
        const endPage = pageNumber || this.totalPages;

        try {
            for (let i = startPage; i <= endPage; i++) {
                const page = await this.pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                
                textContent.items.forEach((item, index) => {
                    if (item.str.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            page: i,
                            text: item.str,
                            index: index,
                            transform: item.transform
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error searching text:', error);
        }

        return results;
    }

    /**
     * Set page scale
     */
    setScale(scale) {
        this.scale = Math.max(0.1, Math.min(5.0, scale));
    }

    /**
     * Get current scale
     */
    getScale() {
        return this.scale;
    }

    /**
     * Go to next page
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            return this.currentPage;
        }
        return null;
    }

    /**
     * Go to previous page
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            return this.currentPage;
        }
        return null;
    }

    /**
     * Go to specific page
     */
    goToPage(pageNumber) {
        if (pageNumber >= 1 && pageNumber <= this.totalPages) {
            this.currentPage = pageNumber;
            return this.currentPage;
        }
        return null;
    }

    /**
     * Get current page number
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Get total pages
     */
    getTotalPages() {
        return this.totalPages;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.renderTask) {
            this.renderTask.cancel();
            this.renderTask = null;
        }
        
        if (this.pdfDoc) {
            this.pdfDoc.destroy();
            this.pdfDoc = null;
        }
        
        this.fields.clear();
        this.annotations = [];
        this.canvas = null;
        this.context = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
    }
}

// Create and export singleton instance
const pdfService = new PDFService();
export default pdfService;