/**
 * Drag Drop Service - Handles drag and drop functionality for PDF uploads and field positioning
 */
class DragDropService {
    constructor() {
        this.draggedElement = null;
        this.dropZones = new Map();
        this.draggedData = null;
        this.onDragStartCallbacks = [];
        this.onDragEndCallbacks = [];
        this.onDropCallbacks = [];
        this.isDragging = false;
    }

    /**
     * Initialize drag and drop for PDF upload area
     */
    initializePDFDropZone(element, callbacks = {}) {
        if (!element) return;

        const {
            onDragEnter = () => {},
            onDragLeave = () => {},
            onDrop = () => {},
            onError = () => {}
        } = callbacks;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                element.classList.add('drag-over');
                onDragEnter();
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, () => {
                element.classList.remove('drag-over');
                onDragLeave();
            });
        });

        // Handle dropped files
        element.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            const pdfFiles = files.filter(file => file.type === 'application/pdf');
            
            if (pdfFiles.length === 0) {
                onError('Please drop PDF files only');
                return;
            }

            if (pdfFiles.length > 1) {
                onError('Please drop only one PDF file at a time');
                return;
            }

            onDrop(pdfFiles[0]);
        });

        return element;
    }

    /**
     * Initialize drag and drop for field elements
     */
    initializeFieldDragging(element, fieldData) {
        if (!element) return;

        element.draggable = true;
        element.setAttribute('data-field-type', fieldData.type);
        element.setAttribute('data-field-id', fieldData.id || '');

        element.addEventListener('dragstart', (e) => {
            this.isDragging = true;
            this.draggedElement = element;
            this.draggedData = fieldData;
            
            // Set drag image
            const dragImage = this.createDragImage(fieldData);
            e.dataTransfer.setDragImage(dragImage, 0, 0);
            
            // Set data for cross-browser compatibility
            e.dataTransfer.setData('text/plain', JSON.stringify(fieldData));
            e.dataTransfer.effectAllowed = 'copy';

            element.classList.add('dragging');
            this.notifyDragStart(fieldData);
        });

        element.addEventListener('dragend', () => {
            this.isDragging = false;
            this.draggedElement = null;
            this.draggedData = null;
            element.classList.remove('dragging');
            this.notifyDragEnd();
        });

        return element;
    }

    /**
     * Initialize drop zone for field placement
     */
    initializeFieldDropZone(element, callbacks = {}) {
        if (!element) return;

        const {
            onDragEnter = () => {},
            onDragLeave = () => {},
            onDrop = () => {},
            onDragOver = () => {}
        } = callbacks;

        this.dropZones.set(element, callbacks);

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        element.addEventListener('dragenter', (e) => {
            if (this.isDragging) {
                element.classList.add('drop-zone-active');
                onDragEnter(e, this.draggedData);
            }
        });

        element.addEventListener('dragleave', (e) => {
            if (!element.contains(e.relatedTarget)) {
                element.classList.remove('drop-zone-active');
                onDragLeave(e);
            }
        });

        element.addEventListener('dragover', (e) => {
            if (this.isDragging) {
                e.dataTransfer.dropEffect = 'copy';
                onDragOver(e, this.draggedData);
            }
        });

        element.addEventListener('drop', (e) => {
            element.classList.remove('drop-zone-active');
            
            if (!this.isDragging) return;

            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const dropData = {
                ...this.draggedData,
                position: { x, y },
                elementRect: rect
            };

            onDrop(dropData, e);
        });

        return element;
    }

    /**
     * Create drag image for field dragging
     */
    createDragImage(fieldData) {
        const dragImage = document.createElement('div');
        dragImage.className = 'field-drag-image';
        dragImage.innerHTML = `
            <div class="field-preview">
                <svg class="field-icon" width="20" height="20">
                    <use href="#${fieldData.type}-field"></use>
                </svg>
                <span class="field-label">${fieldData.label || fieldData.type}</span>
            </div>
        `;
        
        // Style the drag image
        Object.assign(dragImage.style, {
            position: 'absolute',
            top: '-1000px',
            left: '-1000px',
            background: '#fff',
            border: '2px solid #007bff',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '12px',
            zIndex: '9999',
            pointerEvents: 'none'
        });

        document.body.appendChild(dragImage);
        
        // Remove after a short delay
        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 1000);

        return dragImage;
    }

    /**
     * Enable field reordering within containers
     */
    initializeFieldReordering(container) {
        if (!container) return;

        let draggedOver = null;

        container.addEventListener('dragover', (e) => {
            if (!this.isDragging) return;
            
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientY);
            const dragging = this.draggedElement;
            
            if (afterElement == null) {
                container.appendChild(dragging);
            } else {
                container.insertBefore(dragging, afterElement);
            }
        });

        return container;
    }

    /**
     * Get element that should come after the dragged element
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Register callbacks for drag events
     */
    onDragStart(callback) {
        this.onDragStartCallbacks.push(callback);
    }

    onDragEnd(callback) {
        this.onDragEndCallbacks.push(callback);
    }

    onDrop(callback) {
        this.onDropCallbacks.push(callback);
    }

    /**
     * Notify registered callbacks
     */
    notifyDragStart(data) {
        this.onDragStartCallbacks.forEach(callback => callback(data));
    }

    notifyDragEnd() {
        this.onDragEndCallbacks.forEach(callback => callback());
    }

    notifyDrop(data) {
        this.onDropCallbacks.forEach(callback => callback(data));
    }

    /**
     * Cleanup drop zone
     */
    removeDropZone(element) {
        if (this.dropZones.has(element)) {
            this.dropZones.delete(element);
        }
    }

    /**
     * Check if currently dragging
     */
    isDraggingField() {
        return this.isDragging;
    }

    /**
     * Get currently dragged data
     */
    getDraggedData() {
        return this.draggedData;
    }

    /**
     * Enable sorting for a list of elements
     */
    enableSorting(container, options = {}) {
        const {
            handle = null,
            onSort = () => {},
            placeholder = null
        } = options;

        let placeholder_element = null;

        container.addEventListener('dragstart', (e) => {
            const item = e.target.closest('[draggable="true"]');
            if (!item || (handle && !e.target.closest(handle))) return;

            this.draggedElement = item;
            item.classList.add('sorting');

            // Create placeholder
            if (placeholder) {
                placeholder_element = document.createElement('div');
                placeholder_element.className = 'sort-placeholder';
                placeholder_element.innerHTML = placeholder;
            }
        });

        container.addEventListener('dragover', (e) => {
            if (!this.draggedElement) return;
            e.preventDefault();

            const afterElement = this.getDragAfterElement(container, e.clientY);
            if (placeholder_element) {
                if (afterElement == null) {
                    container.appendChild(placeholder_element);
                } else {
                    container.insertBefore(placeholder_element, afterElement);
                }
            }
        });

        container.addEventListener('drop', (e) => {
            if (!this.draggedElement) return;
            e.preventDefault();

            const afterElement = this.getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(this.draggedElement);
            } else {
                container.insertBefore(this.draggedElement, afterElement);
            }

            if (placeholder_element && placeholder_element.parentNode) {
                placeholder_element.parentNode.removeChild(placeholder_element);
            }

            onSort(this.draggedElement, container);
        });

        container.addEventListener('dragend', () => {
            if (this.draggedElement) {
                this.draggedElement.classList.remove('sorting');
                this.draggedElement = null;
            }
            if (placeholder_element && placeholder_element.parentNode) {
                placeholder_element.parentNode.removeChild(placeholder_element);
            }
        });

        return container;
    }

    /**
     * Destroy all drag drop functionality
     */
    destroy() {
        this.dropZones.clear();
        this.draggedElement = null;
        this.draggedData = null;
        this.onDragStartCallbacks = [];
        this.onDragEndCallbacks = [];
        this.onDropCallbacks = [];
        this.isDragging = false;
    }
}

// Create and export singleton instance
const dragDropService = new DragDropService();
export default dragDropService;