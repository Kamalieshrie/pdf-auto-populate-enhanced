// public/js/main.js - Main Application Controller

class PDFAutoPopulateApp {
    constructor() {
        this.currentPdf = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.zoom = 1.0;
        this.selectedFields = [];
        this.clipboard = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.gridSize = 10;
        this.snapToGrid = true;
        this.showGrid = false;
        this.showRulers = false;
        this.fieldCounter = 0;
        this.theme = 'light';
        
        this.init();
    }

    init() {
        this.loadTheme();
        this.initializeComponents();
        this.setupEventListeners();
        this.hideLoadingOverlay();
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('pdf-editor-theme') || 'light';
        this.setTheme(savedTheme);
    }

    initializeComponents() {
        // Initialize all component modules
        this.fieldPalette = new FieldPalette(this);
        this.pdfCanvas = new PDFCanvas(this);
        this.propertyPanel = new PropertyPanel(this);
        this.signaturePad = new SignaturePad(this);
        this.templateManager = new TemplateManager(this);
        this.dragDropService = new DragDropService(this);
        this.apiService = new APIService();
        this.validationService = new ValidationService();

        console.log('Components initialized');
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('new-project-btn')?.addEventListener('click', () => this.newProject());
        document.getElementById('save-template-btn')?.addEventListener('click', () => this.saveTemplate());
        document.getElementById('generate-pdf-btn')?.addEventListener('click', () => this.generatePDF());
        document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('fullscreen-btn')?.addEventListener('click', () => this.toggleFullscreen());

        // Toolbar buttons
        document.getElementById('upload-pdf-btn')?.addEventListener('click', () => this.uploadPDF());
        document.getElementById('pdf-file-input')?.addEventListener('change', (e) => this.handlePDFUpload(e));
        
        // Zoom controls
        document.getElementById('zoom-in-btn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out-btn')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('fit-to-width-btn')?.addEventListener('click', () => this.fitToWidth());

        // Page navigation
        document.getElementById('prev-page-btn')?.addEventListener('click', () => this.prevPage());
        document.getElementById('next-page-btn')?.addEventListener('click', () => this.nextPage());

        // Toggle controls
        document.getElementById('grid-toggle-btn')?.addEventListener('click', () => this.toggleGrid());
        document.getElementById('snap-toggle-btn')?.addEventListener('click', () => this.toggleSnap());
        document.getElementById('ruler-toggle-btn')?.addEventListener('click', () => this.toggleRulers());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window events
        window.addEventListener('resize', () => this.handleWindowResize());
        window.addEventListener('beforeunload', (e) => this.handleBeforeUnload(e));

        // Context menu
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        document.addEventListener('click', (e) => this.hideContextMenu(e));

        console.log('Event listeners setup complete');
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.style.display = 'none', 300);
        }
    }

    // Theme Management
    setTheme(themeName) {
        const body = document.body;
        const themes = ['light', 'dark', 'high-contrast', 'colorful', 'minimalist'];
        
        // Remove all theme classes
        themes.forEach(theme => body.classList.remove(`theme-${theme}`));
        
        // Add new theme class
        body.classList.add(`theme-${themeName}`);
        this.theme = themeName;
        
        // Save theme preference
        localStorage.setItem('pdf-editor-theme', themeName);
        
        // Update theme toggle button icon
        this.updateThemeToggleIcon();
        
        // Show theme indicator
        this.showThemeIndicator(themeName);
    }

    toggleTheme() {
        const currentTheme = this.theme;
        const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(nextTheme);
    }

    updateThemeToggleIcon() {
        const button = document.getElementById('theme-toggle-btn');
        if (button) {
            const icon = button.querySelector('i');
            if (icon) {
                icon.className = this.theme === 'dark' ? 'icon-sun' : 'icon-moon';
            }
        }
    }

    showThemeIndicator(themeName) {
        let indicator = document.querySelector('.theme-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'theme-indicator';
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `Theme: ${themeName}`;
        indicator.classList.add('show');
        
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    // Project Management
    newProject() {
        if (this.hasUnsavedChanges()) {
            if (!confirm('You have unsaved changes. Are you sure you want to start a new project?')) {
                return;
            }
        }
        
        this.currentPdf = null;
        this.selectedFields = [];
        this.fieldCounter = 0;
        this.pdfCanvas.clear();
        this.propertyPanel.clear();
        this.updateUI();
        
        this.showToast('success', 'New Project', 'Started a new project');
    }

    async saveTemplate() {
        try {
            const template = this.generateTemplate();
            const response = await this.apiService.saveTemplate(template);
            
            if (response.success) {
                this.showToast('success', 'Template Saved', 'Template saved successfully');
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('Save template error:', error);
            this.showToast('error', 'Save Failed', error.message);
        }
    }

    async generatePDF() {
        if (!this.currentPdf) {
            this.showToast('warning', 'No PDF', 'Please upload a PDF first');
            return;
        }

        try {
            this.showLoadingOverlay('Generating PDF...');
            
            const fieldData = this.collectFieldData();
            const response = await this.apiService.generatePDF({
                pdfId: this.currentPdf.id,
                fields: fieldData,
                page: this.currentPage
            });

            if (response.success) {
                // Download the generated PDF
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `populated-${this.currentPdf.name}`;
                a.click();
                window.URL.revokeObjectURL(url);
                
                this.showToast('success', 'PDF Generated', 'PDF downloaded successfully');
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('Generate PDF error:', error);
            this.showToast('error', 'Generation Failed', error.message);
        } finally {
            this.hideLoadingOverlay();
        }
    }

    // PDF Management
    uploadPDF() {
        const input = document.getElementById('pdf-file-input');
        if (input) {
            input.click();
        }
    }

    async handlePDFUpload(event) {
        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            this.showToast('error', 'Invalid File', 'Please select a PDF file');
            return;
        }

        try {
            this.showLoadingOverlay('Loading PDF...');
            
            const formData = new FormData();
            formData.append('pdf', file);
            
            const response = await this.apiService.uploadPDF(formData);
            
            if (response.success) {
                this.currentPdf = response.data;
                this.totalPages = response.data.pages;
                this.currentPage = 1;
                
                await this.pdfCanvas.loadPDF(response.data.url);
                this.updatePDFInfo();
                this.updateUI();
                
                this.showToast('success', 'PDF Loaded', `Loaded ${file.name}`);
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            console.error('PDF upload error:', error);
            this.showToast('error', 'Upload Failed', error.message);
        } finally {
            this.hideLoadingOverlay();
        }
    }

    // Zoom Controls
    zoomIn() {
        this.setZoom(Math.min(this.zoom * 1.2, 3.0));
    }

    zoomOut() {
        this.setZoom(Math.max(this.zoom / 1.2, 0.25));
    }

    fitToWidth() {
        const canvas = document.getElementById('pdf-canvas');
        const container = document.querySelector('.canvas-container');
        if (canvas && container) {
            const containerWidth = container.clientWidth - 64; // Account for padding
            const canvasWidth = canvas.offsetWidth;
            const newZoom = containerWidth / canvasWidth;
            this.setZoom(newZoom);
        }
    }

    setZoom(newZoom) {
        this.zoom = Math.round(newZoom * 100) / 100;
        
        const canvas = document.getElementById('pdf-canvas');
        if (canvas) {
            canvas.style.transform = `scale(${this.zoom})`;
            canvas.style.transformOrigin = 'top left';
        }
        
        this.updateZoomDisplay();
        this.pdfCanvas.updateFieldPositions();
    }

    updateZoomDisplay() {
        const zoomLevel = document.querySelector('.zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    // Page Navigation
    prevPage() {
        if (this.currentPage > 1) {
            this.setPage(this.currentPage - 1);
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.setPage(this.currentPage + 1);
        }
    }

    setPage(pageNumber) {
        this.currentPage = pageNumber;
        this.pdfCanvas.showPage(pageNumber);
        this.updatePageDisplay();
    }

    updatePageDisplay() {
        const currentPageEl = document.querySelector('.current-page');
        const totalPagesEl = document.querySelector('.total-pages');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');

        if (currentPageEl) currentPageEl.textContent = this.currentPage;
        if (totalPagesEl) totalPagesEl.textContent = this.totalPages;
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
    }

    // Grid and Snap Controls
    toggleGrid() {
        this.showGrid = !this.showGrid;
        const canvas = document.getElementById('pdf-canvas');
        const button = document.getElementById('grid-toggle-btn');
        
        if (canvas) {
            canvas.classList.toggle('show-grid', this.showGrid);
        }
        
        if (button) {
            button.classList.toggle('active', this.showGrid);
        }
    }

    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
        const button = document.getElementById('snap-toggle-btn');
        
        if (button) {
            button.classList.toggle('active', this.snapToGrid);
        }
        
        this.showToast('info', 'Snap to Grid', this.snapToGrid ? 'Enabled' : 'Disabled');
    }

    toggleRulers() {
        this.showRulers = !this.showRulers;
        const rulers = document.querySelectorAll('.ruler');
        const button = document.getElementById('ruler-toggle-btn');
        
        rulers.forEach(ruler => {
            ruler.classList.toggle('active', this.showRulers);
        });
        
        if (button) {
            button.classList.toggle('active', this.showRulers);
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // Field Management
    addField(type, x, y, properties = {}) {
        const fieldId = `field-${++this.fieldCounter}`;
        const field = {
            id: fieldId,
            type: type,
            x: this.snapToGrid ? Math.round(x / this.gridSize) * this.gridSize : x,
            y: this.snapToGrid ? Math.round(y / this.gridSize) * this.gridSize : y,
            width: properties.width || this.getDefaultFieldWidth(type),
            height: properties.height || this.getDefaultFieldHeight(type),
            name: properties.name || `${type}_${this.fieldCounter}`,
            defaultValue: properties.defaultValue || '',
            required: properties.required || false,
            readonly: properties.readonly || false,
            options: properties.options || [],
            ...properties
        };

        this.pdfCanvas.addField(field);
        this.updateFieldCount();
        
        return field;
    }

    deleteField(fieldId) {
        this.pdfCanvas.removeField(fieldId);
        this.selectedFields = this.selectedFields.filter(id => id !== fieldId);
        this.propertyPanel.clear();
        this.updateFieldCount();
    }

    selectField(fieldId, multiSelect = false) {
        if (!multiSelect) {
            this.selectedFields = [];
        }
        
        if (!this.selectedFields.includes(fieldId)) {
            this.selectedFields.push(fieldId);
        }
        
        this.pdfCanvas.updateSelection(this.selectedFields);
        this.propertyPanel.showFieldProperties(fieldId);
    }

    deselectAll() {
        this.selectedFields = [];
        this.pdfCanvas.updateSelection([]);
        this.propertyPanel.clear();
    }

    getDefaultFieldWidth(type) {
        const defaults = {
            text: 120,
            textarea: 200,
            date: 120,
            checkbox: 20,
            radio: 20,
            dropdown: 150,
            signature: 200,
            initial: 50
        };
        return defaults[type] || 120;
    }

    getDefaultFieldHeight(type) {
        const defaults = {
            text: 30,
            textarea: 80,
            date: 30,
            checkbox: 20,
            radio: 20,
            dropdown: 30,
            signature: 60,
            initial: 50
        };
        return defaults[type] || 30;
    }

    // Data Management
    collectFieldData() {
        return this.pdfCanvas.getAllFields().map(field => ({
            id: field.id,
            name: field.name,
            type: field.type,
            value: field.value || field.defaultValue || '',
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            page: this.currentPage,
            required: field.required,
            readonly: field.readonly,
            options: field.options
        }));
    }

    generateTemplate() {
        const fields = this.collectFieldData();
        return {
            name: `Template ${Date.now()}`,
            pdfName: this.currentPdf?.name || 'Unknown',
            fields: fields,
            pages: this.totalPages,
            createdAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    // Event Handlers
    handleKeyboard(event) {
        const { ctrlKey, metaKey, shiftKey, key } = event;
        const isModifier = ctrlKey || metaKey;

        // Prevent default for our shortcuts
        const shortcuts = ['s', 'n', 'o', 'z', 'y', 'c', 'v', 'a', 'd', 'Delete', 'Backspace'];
        if (isModifier && shortcuts.includes(key)) {
            event.preventDefault();
        }

        // Handle shortcuts
        if (isModifier) {
            switch (key.toLowerCase()) {
                case 's':
                    this.saveTemplate();
                    break;
                case 'n':
                    this.newProject();
                    break;
                case 'o':
                    this.uploadPDF();
                    break;
                case 'z':
                    if (shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    this.redo();
                    break;
                case 'c':
                    this.copySelectedFields();
                    break;
                case 'v':
                    this.pasteFields();
                    break;
                case 'a':
                    this.selectAllFields();
                    break;
                case 'd':
                    this.duplicateSelectedFields();
                    break;
            }
        } else {
            switch (key) {
                case 'Delete':
                case 'Backspace':
                    this.deleteSelectedFields();
                    break;
                case 'Escape':
                    this.deselectAll();
                    this.hideContextMenu();
                    break;
                case '+':
                case '=':
                    this.zoomIn();
                    break;
                case '-':
                    this.zoomOut();
                    break;
                case '0':
                    this.fitToWidth();
                    break;
            }
        }
    }

    handleWindowResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.pdfCanvas.handleResize();
            this.updateZoomDisplay();
        }, 250);
    }

    handleBeforeUnload(event) {
        if (this.hasUnsavedChanges()) {
            event.preventDefault();
            event.returnValue = '';
            return '';
        }
    }

    handleContextMenu(event) {
        const field = event.target.closest('.custom-field');
        if (field) {
            event.preventDefault();
            this.showContextMenu(event.clientX, event.clientY, field.dataset.fieldId);
        }
    }

    showContextMenu(x, y, fieldId = null) {
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        // Update menu items based on context
        const copyItem = menu.querySelector('[data-action="copy"]');
        const pasteItem = menu.querySelector('[data-action="paste"]');
        const deleteItem = menu.querySelector('[data-action="delete"]');
        const duplicateItem = menu.querySelector('[data-action="duplicate"]');

        if (copyItem) copyItem.style.display = fieldId ? 'flex' : 'none';
        if (deleteItem) deleteItem.style.display = fieldId ? 'flex' : 'none';
        if (duplicateItem) duplicateItem.style.display = fieldId ? 'flex' : 'none';
        if (pasteItem) pasteItem.style.display = this.clipboard ? 'flex' : 'none';

        // Position menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';

        // Store context
        this.contextMenuTarget = fieldId;

        // Add menu item listeners
        this.setupContextMenuListeners();
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.style.display = 'none';
        }
        this.contextMenuTarget = null;
    }

    setupContextMenuListeners() {
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        const items = menu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            item.replaceWith(item.cloneNode(true)); // Remove old listeners
        });

        // Re-attach listeners
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            });
        });
    }

    handleContextMenuAction(action) {
        switch (action) {
            case 'copy':
                this.copySelectedFields();
                break;
            case 'paste':
                this.pasteFields();
                break;
            case 'duplicate':
                this.duplicateSelectedFields();
                break;
            case 'delete':
                this.deleteSelectedFields();
                break;
            case 'bring-front':
                this.bringToFront();
                break;
            case 'send-back':
                this.sendToBack();
                break;
        }
    }

    // Field Operations
    copySelectedFields() {
        if (this.selectedFields.length === 0) return;

        const fieldsToCopy = this.selectedFields.map(id => 
            this.pdfCanvas.getField(id)
        ).filter(Boolean);

        this.clipboard = {
            type: 'fields',
            data: fieldsToCopy,
            timestamp: Date.now()
        };

        this.showToast('info', 'Copied', `Copied ${fieldsToCopy.length} field(s)`);
    }

    pasteFields() {
        if (!this.clipboard || this.clipboard.type !== 'fields') return;

        const offsetX = 20;
        const offsetY = 20;
        const newFields = [];

        this.clipboard.data.forEach(field => {
            const newField = {
                ...field,
                id: `field-${++this.fieldCounter}`,
                name: `${field.name}_copy`,
                x: field.x + offsetX,
                y: field.y + offsetY
            };
            
            this.pdfCanvas.addField(newField);
            newFields.push(newField.id);
        });

        this.selectedFields = newFields;
        this.pdfCanvas.updateSelection(this.selectedFields);
        this.updateFieldCount();

        this.showToast('success', 'Pasted', `Pasted ${newFields.length} field(s)`);
    }

    duplicateSelectedFields() {
        this.copySelectedFields();
        this.pasteFields();
    }

    deleteSelectedFields() {
        if (this.selectedFields.length === 0) return;

        const count = this.selectedFields.length;
        this.selectedFields.forEach(fieldId => {
            this.pdfCanvas.removeField(fieldId);
        });

        this.selectedFields = [];
        this.propertyPanel.clear();
        this.updateFieldCount();

        this.showToast('info', 'Deleted', `Deleted ${count} field(s)`);
    }

    selectAllFields() {
        const allFields = this.pdfCanvas.getAllFields();
        this.selectedFields = allFields.map(field => field.id);
        this.pdfCanvas.updateSelection(this.selectedFields);

        this.showToast('info', 'Selected', `Selected ${allFields.length} field(s)`);
    }

    bringToFront() {
        this.selectedFields.forEach(fieldId => {
            this.pdfCanvas.bringFieldToFront(fieldId);
        });
    }

    sendToBack() {
        this.selectedFields.forEach(fieldId => {
            this.pdfCanvas.sendFieldToBack(fieldId);
        });
    }

    // Undo/Redo functionality
    undo() {
        // Implementation would depend on history tracking
        this.showToast('info', 'Undo', 'Undo functionality coming soon');
    }

    redo() {
        // Implementation would depend on history tracking  
        this.showToast('info', 'Redo', 'Redo functionality coming soon');
    }

    // Utility Methods
    hasUnsavedChanges() {
        // Simple check - in a real app, you'd track modifications
        return this.pdfCanvas.getAllFields().length > 0;
    }

    updateUI() {
        this.updatePageDisplay();
        this.updateZoomDisplay();
        this.updateFieldCount();
        this.updatePDFInfo();
    }

    updateFieldCount() {
        const countEl = document.getElementById('field-count');
        if (countEl) {
            countEl.textContent = this.pdfCanvas.getAllFields().length;
        }
    }

    updatePDFInfo() {
        if (!this.currentPdf) return;

        const filenameEl = document.getElementById('pdf-filename');
        const pagesEl = document.getElementById('pdf-pages');
        const sizeEl = document.getElementById('pdf-size');

        if (filenameEl) filenameEl.textContent = this.currentPdf.name || '-';
        if (pagesEl) pagesEl.textContent = this.totalPages || '-';
        if (sizeEl) sizeEl.textContent = this.formatFileSize(this.currentPdf.size) || '-';
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoadingOverlay(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner">
                    <img src="assets/images/loading-spinner.svg" alt="Loading...">
                    <p>${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            const messageEl = overlay.querySelector('p');
            if (messageEl) messageEl.textContent = message;
        }
        
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                if (overlay.classList.contains('hidden')) {
                    overlay.style.display = 'none';
                }
            }, 300);
        }
    }

    showToast(type, title, message, duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="icon-${this.getToastIcon(type)}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="icon-x"></i>
            </button>
        `;

        // Close button functionality
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.hideToast(toast);
        });

        container.appendChild(toast);

        // Show toast
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto hide
        setTimeout(() => {
            this.hideToast(toast);
        }, duration);
    }

    hideToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    getToastIcon(type) {
        const icons = {
            success: 'check',
            error: 'x',
            warning: 'alert-triangle',
            info: 'info'
        };
        return icons[type] || 'info';
    }

    // Public API for component communication
    onFieldAdded(field) {
        this.updateFieldCount();
        console.log('Field added:', field);
    }

    onFieldSelected(fieldId) {
        this.selectField(fieldId);
    }

    onFieldUpdated(fieldId, properties) {
        this.pdfCanvas.updateField(fieldId, properties);
        console.log('Field updated:', fieldId, properties);
    }

    onFieldDeleted(fieldId) {
        this.deleteField(fieldId);
    }

    // Snap to grid helper
    snapToGridHelper(x, y) {
        if (!this.snapToGrid) return { x, y };
        
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    }

    // Get current app state
    getState() {
        return {
            currentPdf: this.currentPdf,
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            zoom: this.zoom,
            selectedFields: this.selectedFields,
            theme: this.theme,
            showGrid: this.showGrid,
            snapToGrid: this.snapToGrid,
            showRulers: this.showRulers
        };
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PDFAutoPopulateApp();
    console.log('PDF Auto-Populate application initialized');
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFAutoPopulateApp;
}