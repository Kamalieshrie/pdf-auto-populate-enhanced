// public/js/services/api-service.js - API Service for server communication

class APIService {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        this.timeout = 30000; // 30 seconds
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method: 'GET',
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            config.signal = controller.signal;
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else if (contentType && contentType.includes('application/pdf')) {
                data = await response.arrayBuffer();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return {
                success: true,
                data: data,
                status: response.status,
                headers: response.headers
            };

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            return {
                success: false,
                error: error.message,
                status: error.status || 0
            };
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url);
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // File upload
    async upload(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            headers: {}, // Let browser set Content-Type for FormData
            body: formData
        });
    }

    // PDF Management APIs
    async uploadPDF(formData) {
        return this.upload('/pdf/upload', formData);
    }

    async getPDF(pdfId) {
        return this.get(`/pdf/${pdfId}`);
    }

    async deletePDF(pdfId) {
        return this.delete(`/pdf/${pdfId}`);
    }

    async getPDFPages(pdfId) {
        return this.get(`/pdf/${pdfId}/pages`);
    }

    async getPDFPage(pdfId, pageNumber) {
        return this.get(`/pdf/${pdfId}/pages/${pageNumber}`);
    }

    // Template Management APIs
    async saveTemplate(templateData) {
        return this.post('/templates', templateData);
    }

    async getTemplate(templateId) {
        return this.get(`/templates/${templateId}`);
    }

    async getTemplates(params = {}) {
        return this.get('/templates', params);
    }

    async updateTemplate(templateId, templateData) {
        return this.put(`/templates/${templateId}`, templateData);
    }

    async deleteTemplate(templateId) {
        return this.delete(`/templates/${templateId}`);
    }

    async duplicateTemplate(templateId) {
        return this.post(`/templates/${templateId}/duplicate`);
    }

    // Field Management APIs
    async saveFields(pdfId, fields) {
        return this.post(`/pdf/${pdfId}/fields`, { fields });
    }

    async getFields(pdfId, pageNumber = null) {
        const params = pageNumber ? { page: pageNumber } : {};
        return this.get(`/pdf/${pdfId}/fields`, params);
    }

    async updateField(pdfId, fieldId, fieldData) {
        return this.put(`/pdf/${pdfId}/fields/${fieldId}`, fieldData);
    }

    async deleteField(pdfId, fieldId) {
        return this.delete(`/pdf/${pdfId}/fields/${fieldId}`);
    }

    // PDF Generation APIs
    async generatePDF(generationData) {
        const response = await this.request('/pdf/generate', {
            method: 'POST',
            body: JSON.stringify(generationData)
        });

        if (response.success && response.data instanceof ArrayBuffer) {
            return {
                ...response,
                data: response.data // ArrayBuffer for PDF data
            };
        }

        return response;
    }

    async generatePDFWithData(pdfId, fieldData, options = {}) {
        return this.post('/pdf/generate-with-data', {
            pdfId,
            data: fieldData,
            options
        });
    }

    async previewPDF(pdfId, fieldData, pageNumber = 1) {
        return this.post('/pdf/preview', {
            pdfId,
            data: fieldData,
            page: pageNumber
        });
    }

    // Data Management APIs
    async saveData(dataId, data) {
        return this.post(`/data/${dataId}`, data);
    }

    async getData(dataId) {
        return this.get(`/data/${dataId}`);
    }

    async importData(file, format = 'json') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);
        return this.upload('/data/import', formData);
    }

    async exportData(dataId, format = 'json') {
        return this.get(`/data/${dataId}/export`, { format });
    }

    // Validation APIs
    async validateFields(fields) {
        return this.post('/validation/fields', { fields });
    }

    async validateData(fieldData, validationRules) {
        return this.post('/validation/data', {
            data: fieldData,
            rules: validationRules
        });
    }

    // User Management APIs (if authentication is implemented)
    async login(credentials) {
        return this.post('/auth/login', credentials);
    }

    async logout() {
        return this.post('/auth/logout');
    }

    async getCurrentUser() {
        return this.get('/auth/user');
    }

    async updateProfile(profileData) {
        return this.put('/auth/profile', profileData);
    }

    // Project Management APIs
    async createProject(projectData) {
        return this.post('/projects', projectData);
    }

    async getProject(projectId) {
        return this.get(`/projects/${projectId}`);
    }

    async getProjects(params = {}) {
        return this.get('/projects', params);
    }

    async updateProject(projectId, projectData) {
        return this.put(`/projects/${projectId}`, projectData);
    }

    async deleteProject(projectId) {
        return this.delete(`/projects/${projectId}`);
    }

    async shareProject(projectId, shareData) {
        return this.post(`/projects/${projectId}/share`, shareData);
    }

    // Signature Management APIs
    async saveSignature(signatureData) {
        return this.post('/signatures', signatureData);
    }

    async getSignatures(userId = null) {
        const params = userId ? { userId } : {};
        return this.get('/signatures', params);
    }

    async deleteSignature(signatureId) {
        return this.delete(`/signatures/${signatureId}`);
    }

    // Analytics and Reporting APIs
    async getUsageStats(params = {}) {
        return this.get('/analytics/usage', params);
    }

    async getTemplateStats(templateId) {
        return this.get(`/analytics/templates/${templateId}`);
    }

    async getFieldUsageStats() {
        return this.get('/analytics/fields');
    }

    // Utility APIs
    async healthCheck() {
        return this.get('/health');
    }

    async getSystemInfo() {
        return this.get('/system/info');
    }

    async uploadImage(formData) {
        return this.upload('/images', formData);
    }

    async optimizeImage(imageId, options = {}) {
        return this.post(`/images/${imageId}/optimize`, options);
    }

    // WebSocket connection for real-time features
    connectWebSocket(endpoint = '/ws') {
        if (typeof WebSocket === 'undefined') {
            console.warn('WebSocket not supported');
            return null;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = `${protocol}//${window.location.host}${endpoint}`;
        
        try {
            const ws = new WebSocket(wsURL);
            
            ws.onopen = () => {
                console.log('WebSocket connected');
            };
            
            ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                
                // Attempt to reconnect after a delay
                if (!event.wasClean) {
                    setTimeout(() => {
                        this.connectWebSocket(endpoint);
                    }, 5000);
                }
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
            return ws;
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            return null;
        }
    }

    // Batch operations
    async batchRequest(requests) {
        return this.post('/batch', { requests });
    }

    async batchUpload(files) {
        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append(`file_${index}`, file);
        });
        return this.upload('/batch/upload', formData);
    }

    // Error handling utilities
    handleError(error, context = '') {
        console.error(`API Error${context ? ` in ${context}` : ''}:`, error);
        
        // You can add custom error handling logic here
        // For example, showing notifications, logging to external service, etc.
        
        if (typeof window !== 'undefined' && window.app) {
            window.app.showToast('error', 'API Error', error.message || 'An unexpected error occurred');
        }
    }

    // Request interceptors (for adding auth tokens, etc.)
    setAuthToken(token) {
        this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    removeAuthToken() {
        delete this.defaultHeaders['Authorization'];
    }

    // Request caching (simple in-memory cache)
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        this.timeout = 30000;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    getCacheKey(endpoint, params = {}) {
        return `${endpoint}?${new URLSearchParams(params).toString()}`;
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    // Enhanced GET method with caching
    async getCached(endpoint, params = {}, useCache = true) {
        const cacheKey = this.getCacheKey(endpoint, params);
        
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }
        
        const response = await this.get(endpoint, params);
        
        if (response.success && useCache) {
            this.setCache(cacheKey, response);
        }
        
        return response;
    }

    // Progress tracking for file uploads
    async uploadWithProgress(endpoint, formData, onProgress = null) {
        const url = `${this.baseURL}${endpoint}`;
        
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete, event.loaded, event.total);
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve({ success: true, data, status: xhr.status });
                    } catch (error) {
                        resolve({ success: true, data: xhr.responseText, status: xhr.status });
                    }
                } else {
                    reject(new Error(`HTTP error! status: ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });
            
            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timeout'));
            });
            
            xhr.timeout = this.timeout;
            xhr.open('POST', url);
            
            // Add auth header if available
            if (this.defaultHeaders['Authorization']) {
                xhr.setRequestHeader('Authorization', this.defaultHeaders['Authorization']);
            }
            
            xhr.send(formData);
        });
    }

    // Rate limiting
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        this.timeout = 30000;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
        this.requestQueue = [];
        this.maxConcurrentRequests = 5;
        this.activeRequests = 0;
    }

    async queueRequest(requestFn) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                execute: requestFn,
                resolve,
                reject
            });
            
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
            return;
        }
        
        const { execute, resolve, reject } = this.requestQueue.shift();
        this.activeRequests++;
        
        try {
            const result = await execute();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.activeRequests--;
            this.processQueue();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIService;
} else if (typeof window !== 'undefined') {
    window.APIService = APIService;
}