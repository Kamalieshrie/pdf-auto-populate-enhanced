// public/js/utils/dom-utils.js - DOM Utility Functions

class DOMUtils {
    // Element creation and manipulation
    static createElement(tag, className = '', attributes = {}) {
        const element = document.createElement(tag);
        
        if (className) {
            element.className = className;
        }
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key === 'style') {
                Object.entries(value).forEach(([styleKey, styleValue]) => {
                    element.style[styleKey] = styleValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });
        
        return element;
    }

    static createElementWithHTML(tag, className = '', html = '') {
        const element = this.createElement(tag, className);
        element.innerHTML = html;
        return element;
    }

    // Element queries
    static $(selector, parent = document) {
        return parent.querySelector(selector);
    }

    static $$(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }

    static getById(id) {
        return document.getElementById(id);
    }

    static getByClass(className, parent = document) {
        return Array.from(parent.getElementsByClassName(className));
    }

    // Class manipulation
    static addClass(element, className) {
        if (element && className) {
            element.classList.add(className);
        }
    }

    static removeClass(element, className) {
        if (element && className) {
            element.classList.remove(className);
        }
    }

    static toggleClass(element, className) {
        if (element && className) {
            element.classList.toggle(className);
        }
    }

    static hasClass(element, className) {
        return element && className && element.classList.contains(className);
    }

    // Style manipulation
    static setStyle(element, styles) {
        if (!element || !styles) return;
        
        Object.entries(styles).forEach(([property, value]) => {
            element.style[property] = value;
        });
    }

    static getStyle(element, property) {
        if (!element) return null;
        return window.getComputedStyle(element)[property];
    }

    // Attribute manipulation
    static setAttribute(element, name, value) {
        if (element && name !== undefined) {
            element.setAttribute(name, value);
        }
    }

    static getAttribute(element, name) {
        if (!element || !name) return null;
        return element.getAttribute(name);
    }

    static removeAttribute(element, name) {
        if (element && name) {
            element.removeAttribute(name);
        }
    }

    // Data attributes
    static setData(element, key, value) {
        if (element && key !== undefined) {
            element.dataset[key] = value;
        }
    }

    static getData(element, key) {
        if (!element || !key) return null;
        return element.dataset[key];
    }

    // Event handling
    static on(element, event, handler, options = {}) {
        if (element && event && handler) {
            element.addEventListener(event, handler, options);
        }
    }

    static off(element, event, handler, options = {}) {
        if (element && event && handler) {
            element.removeEventListener(event, handler, options);
        }
    }

    static once(element, event, handler, options = {}) {
        if (element && event && handler) {
            element.addEventListener(event, handler, { ...options, once: true });
        }
    }

    static trigger(element, eventType, detail = null) {
        if (!element || !eventType) return;
        
        const event = detail 
            ? new CustomEvent(eventType, { detail })
            : new Event(eventType, { bubbles: true });
            
        element.dispatchEvent(event);
    }

    // Element positioning and dimensions
    static getOffset(element) {
        if (!element) return { top: 0, left: 0 };
        
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        return {
            top: rect.top + scrollTop,
            left: rect.left + scrollLeft,
            width: rect.width,
            height: rect.height
        };
    }

    static getPosition(element) {
        if (!element) return { x: 0, y: 0 };
        
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };
    }

    static getElementCenter(element) {
        if (!element) return { x: 0, y: 0 };
        
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    static isElementInViewport(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // Mouse/touch position helpers
    static getMousePosition(event) {
        return {
            x: event.clientX,
            y: event.clientY
        };
    }

    static getTouchPosition(event) {
        const touch = event.touches[0] || event.changedTouches[0];
        return touch ? {
            x: touch.clientX,
            y: touch.clientY
        } : { x: 0, y: 0 };
    }

    static getEventPosition(event) {
        return event.touches ? this.getTouchPosition(event) : this.getMousePosition(event);
    }

    // Relative position within element
    static getRelativePosition(event, element) {
        const rect = element.getBoundingClientRect();
        const pos = this.getEventPosition(event);
        
        return {
            x: pos.x - rect.left,
            y: pos.y - rect.top
        };
    }

    // Element manipulation
    static show(element, display = 'block') {
        if (element) {
            element.style.display = display;
        }
    }

    static hide(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    static toggle(element, display = 'block') {
        if (!element) return;
        
        const isVisible = element.style.display !== 'none' && 
                         this.getStyle(element, 'display') !== 'none';
        
        if (isVisible) {
            this.hide(element);
        } else {
            this.show(element, display);
        }
    }

    static remove(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    static empty(element) {
        if (element) {
            element.innerHTML = '';
        }
    }

    // Content manipulation
    static setText(element, text) {
        if (element) {
            element.textContent = text;
        }
    }

    static getText(element) {
        return element ? element.textContent : '';
    }

    static setHTML(element, html) {
        if (element) {
            element.innerHTML = html;
        }
    }

    static getHTML(element) {
        return element ? element.innerHTML : '';
    }

    // Form utilities
    static getValue(element) {
        if (!element) return '';
        
        switch (element.type) {
            case 'checkbox':
            case 'radio':
                return element.checked;
            case 'select-multiple':
                return Array.from(element.selectedOptions).map(opt => opt.value);
            default:
                return element.value;
        }
    }

    static setValue(element, value) {
        if (!element) return;
        
        switch (element.type) {
            case 'checkbox':
            case 'radio':
                element.checked = Boolean(value);
                break;
            case 'select-multiple':
                if (Array.isArray(value)) {
                    Array.from(element.options).forEach(option => {
                        option.selected = value.includes(option.value);
                    });
                }
                break;
            default:
                element.value = value;
                break;
        }
    }

    // Animation helpers
    static fadeIn(element, duration = 300) {
        if (!element) return Promise.resolve();
        
        return new Promise(resolve => {
            element.style.opacity = '0';
            element.style.display = 'block';
            
            const start = performance.now();
            
            const animate = (current) => {
                const elapsed = current - start;
                const progress = Math.min(elapsed / duration, 1);
                
                element.style.opacity = progress;
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    static fadeOut(element, duration = 300) {
        if (!element) return Promise.resolve();
        
        return new Promise(resolve => {
            const start = performance.now();
            const initialOpacity = parseFloat(this.getStyle(element, 'opacity')) || 1;
            
            const animate = (current) => {
                const elapsed = current - start;
                const progress = Math.min(elapsed / duration, 1);
                
                element.style.opacity = initialOpacity * (1 - progress);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.style.display = 'none';
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    static slideDown(element, duration = 300) {
        if (!element) return Promise.resolve();
        
        return new Promise(resolve => {
            element.style.overflow = 'hidden';
            element.style.height = '0';
            element.style.display = 'block';
            
            const targetHeight = element.scrollHeight;
            const start = performance.now();
            
            const animate = (current) => {
                const elapsed = current - start;
                const progress = Math.min(elapsed / duration, 1);
                
                element.style.height = (targetHeight * progress) + 'px';
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.style.height = '';
                    element.style.overflow = '';
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    static slideUp(element, duration = 300) {
        if (!element) return Promise.resolve();
        
        return new Promise(resolve => {
            const initialHeight = element.scrollHeight;
            element.style.overflow = 'hidden';
            element.style.height = initialHeight + 'px';
            
            const start = performance.now();
            
            const animate = (current) => {
                const elapsed = current - start;
                const progress = Math.min(elapsed / duration, 1);
                
                element.style.height = (initialHeight * (1 - progress)) + 'px';
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.style.display = 'none';
                    element.style.height = '';
                    element.style.overflow = '';
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    // Scroll utilities
    static scrollTo(element, options = {}) {
        if (!element) return;
        
        const defaultOptions = {
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    }

    static isScrollable(element) {
        if (!element) return false;
        
        const style = this.getStyle(element, 'overflow');
        const overflowY = this.getStyle(element, 'overflowY');
        const overflowX = this.getStyle(element, 'overflowX');
        
        return ['auto', 'scroll'].some(value => 
            [style, overflowY, overflowX].includes(value)
        );
    }

    // Focus management
    static focus(element) {
        if (element && element.focus) {
            element.focus();
        }
    }

    static blur(element) {
        if (element && element.blur) {
            element.blur();
        }
    }

    // Measurement utilities
    static measure(element) {
        if (!element) return { width: 0, height: 0 };
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return {
            width: rect.width,
            height: rect.height,
            innerWidth: rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            innerHeight: rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
            outerWidth: rect.width + parseFloat(style.marginLeft) + parseFloat(style.marginRight),
            outerHeight: rect.height + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
        };
    }

    // Debounce and throttle utilities
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    static throttle(func, wait) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, wait);
            }
        };
    }

    // Device detection
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    // Browser detection
    static getBrowser() {
        const userAgent = navigator.userAgent;
        
        if (userAgent.includes('Chrome')) return 'chrome';
        if (userAgent.includes('Firefox')) return 'firefox';
        if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'safari';
        if (userAgent.includes('Edge')) return 'edge';
        if (userAgent.includes('Opera')) return 'opera';
        
        return 'unknown';
    }

    // Local storage helpers
    static setStorage(key, value, type = 'local') {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Storage failed:', error);
            return false;
        }
    }

    static getStorage(key, defaultValue = null, type = 'local') {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            const item = storage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Storage retrieval failed:', error);
            return defaultValue;
        }
    }

    static removeStorage(key, type = 'local') {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Storage removal failed:', error);
            return false;
        }
    }

    static clearStorage(type = 'local') {
        try {
            const storage = type === 'session' ? sessionStorage : localStorage;
            storage.clear();
            return true;
        } catch (error) {
            console.warn('Storage clear failed:', error);
            return false;
        }
    }

    // URL and query string utilities
    static getQueryParam(name, defaultValue = null) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name) || defaultValue;
    }

    static setQueryParam(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    }

    static removeQueryParam(name) {
        const url = new URL(window.location);
        url.searchParams.delete(name);
        window.history.pushState({}, '', url);
    }

    // Image utilities
    static loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    static imageToDataURL(img, format = 'image/png', quality = 1) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        return canvas.toDataURL(format, quality);
    }

    // File utilities
    static readFile(file, type = 'text') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            
            switch (type) {
                case 'text':
                    reader.readAsText(file);
                    break;
                case 'dataURL':
                    reader.readAsDataURL(file);
                    break;
                case 'arrayBuffer':
                    reader.readAsArrayBuffer(file);
                    break;
                default:
                    reader.readAsText(file);
            }
        });
    }

    static downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const a = this.createElement('a', '', {
            href: url,
            download: filename,
            style: { display: 'none' }
        });
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // Copy to clipboard
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textArea = this.createElement('textarea', '', {
                    value: text,
                    style: {
                        position: 'fixed',
                        top: '0',
                        left: '0',
                        width: '2em',
                        height: '2em',
                        padding: '0',
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        background: 'transparent'
                    }
                });
                
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                return successful;
            }
        } catch (error) {
            console.warn('Copy to clipboard failed:', error);
            return false;
        }
    }

    // String utilities
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static unescapeHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent;
    }

    // Color utilities
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    static getContrastColor(backgroundColor) {
        const rgb = this.hexToRgb(backgroundColor);
        if (!rgb) return '#000000';
        
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // Math utilities
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    static distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    static angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    // Random utilities
    static randomId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    static randomColor() {
        return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    }

    // Validation utilities
    static isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static isValidPhoneNumber(phone) {
        const regex = /^[\+]?[1-9][\d]{0,15}$/;
        return regex.test(phone.replace(/[\s\-\(\)\.]/g, ''));
    }

    // Format utilities
    static formatNumber(num, decimals = 2) {
        return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    static formatCurrency(amount, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    static formatDate(date, locale = 'en-US', options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(new Date(date));
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Performance utilities
    static fps() {
        let frames = 0;
        let lastTime = performance.now();
        
        function tick() {
            frames++;
            const now = performance.now();
            
            if (now >= lastTime + 1000) {
                const fps = Math.round((frames * 1000) / (now - lastTime));
                frames = 0;
                lastTime = now;
                return fps;
            }
            
            requestAnimationFrame(tick);
        }
        
        requestAnimationFrame(tick);
    }

    static measurePerformance(fn, iterations = 1000) {
        const start = performance.now();
        
        for (let i = 0; i < iterations; i++) {
            fn();
        }
        
        const end = performance.now();
        return {
            total: end - start,
            average: (end - start) / iterations,
            iterations: iterations
        };
    }

    // Accessibility utilities
    static addAriaLabel(element, label) {
        this.setAttribute(element, 'aria-label', label);
    }

    static addAriaRole(element, role) {
        this.setAttribute(element, 'role', role);
    }

    static setTabIndex(element, index) {
        this.setAttribute(element, 'tabindex', index);
    }

    static announceToScreenReader(message) {
        const announcement = this.createElement('div', 'sr-only', {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            style: {
                position: 'absolute',
                left: '-10000px',
                width: '1px',
                height: '1px',
                overflow: 'hidden'
            }
        });
        
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            this.remove(announcement);
        }, 1000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMUtils;
} else if (typeof window !== 'undefined') {
    window.DOMUtils = DOMUtils;
}