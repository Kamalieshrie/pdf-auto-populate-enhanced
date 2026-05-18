// public/js/utils/event-utils.js - Event Utility Functions

class EventUtils {
    // Event registry for tracking handlers
    static eventRegistry = new Map();
    static delegatedEvents = new Map();
    static touchStartTime = 0;
    static touchEndTime = 0;
    static touchThreshold = 300; // ms for tap detection

    // ===== BASIC EVENT HANDLING =====
    
    static on(element, event, handler, options = {}) {
        if (!element || !event || !handler) return false;
        
        element.addEventListener(event, handler, options);
        
        // Track the event for cleanup
        if (!this.eventRegistry.has(element)) {
            this.eventRegistry.set(element, []);
        }
        this.eventRegistry.get(element).push({
            event,
            handler,
            options
        });
        
        return true;
    }

    static off(element, event, handler, options = {}) {
        if (!element || !event) return false;
        
        if (handler) {
            element.removeEventListener(event, handler, options);
        } else {
            // Remove all handlers for this event
            const events = this.eventRegistry.get(element);
            if (events) {
                events
                    .filter(e => e.event === event)
                    .forEach(e => element.removeEventListener(e.event, e.handler, e.options));
            }
        }
        
        return true;
    }

    static once(element, event, handler, options = {}) {
        if (!element || !event || !handler) return false;
        
        const onceHandler = (e) => {
            handler(e);
            this.off(element, event, onceHandler);
        };
        
        return this.on(element, event, onceHandler, options);
    }

    static trigger(element, eventType, detail = null, options = {}) {
        if (!element || !eventType) return false;
        
        const eventOptions = {
            bubbles: true,
            cancelable: true,
            ...options
        };
        
        let event;
        if (detail !== null) {
            event = new CustomEvent(eventType, { 
                detail, 
                ...eventOptions 
            });
        } else {
            event = new Event(eventType, eventOptions);
        }
        
        return element.dispatchEvent(event);
    }

    // ===== EVENT DELEGATION =====
    
    static delegate(parent, selector, event, handler) {
        if (!parent || !selector || !event || !handler) return false;
        
        const delegateHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && parent.contains(target)) {
                handler.call(target, e);
            }
        };
        
        this.on(parent, event, delegateHandler);
        
        // Track delegated events
        const key = `${parent}_${selector}_${event}`;
        this.delegatedEvents.set(key, delegateHandler);
        
        return true;
    }

    static undelegate(parent, selector, event) {
        const key = `${parent}_${selector}_${event}`;
        const handler = this.delegatedEvents.get(key);
        
        if (handler) {
            this.off(parent, event, handler);
            this.delegatedEvents.delete(key);
            return true;
        }
        
        return false;
    }

    // ===== MOUSE EVENTS =====
    
    static getMousePosition(event) {
        return {
            x: event.clientX || event.pageX,
            y: event.clientY || event.pageY,
            pageX: event.pageX,
            pageY: event.pageY,
            screenX: event.screenX,
            screenY: event.screenY
        };
    }

    static getRelativeMousePosition(event, element) {
        const rect = element.getBoundingClientRect();
        const mouse = this.getMousePosition(event);
        
        return {
            x: mouse.x - rect.left,
            y: mouse.y - rect.top,
            relativeX: (mouse.x - rect.left) / rect.width,
            relativeY: (mouse.y - rect.top) / rect.height
        };
    }

    static isLeftClick(event) {
        return event.button === 0;
    }

    static isRightClick(event) {
        return event.button === 2;
    }

    static isMiddleClick(event) {
        return event.button === 1;
    }

    static hasModifierKey(event) {
        return event.ctrlKey || event.altKey || event.shiftKey || event.metaKey;
    }

    // ===== TOUCH EVENTS =====
    
    static getTouchPosition(event) {
        const touch = event.touches[0] || event.changedTouches[0];
        if (!touch) return null;
        
        return {
            x: touch.clientX,
            y: touch.clientY,
            pageX: touch.pageX,
            pageY: touch.pageY,
            screenX: touch.screenX,
            screenY: touch.screenY
        };
    }

    static getMultiTouchPositions(event) {
        const touches = Array.from(event.touches || event.changedTouches || []);
        return touches.map(touch => ({
            identifier: touch.identifier,
            x: touch.clientX,
            y: touch.clientY,
            pageX: touch.pageX,
            pageY: touch.pageY
        }));
    }

    static getTouchDistance(touch1, touch2) {
        const dx = touch1.x - touch2.x;
        const dy = touch1.y - touch2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static isTap(event) {
        if (event.type === 'touchstart') {
            this.touchStartTime = Date.now();
            return false;
        }
        
        if (event.type === 'touchend') {
            this.touchEndTime = Date.now();
            return (this.touchEndTime - this.touchStartTime) < this.touchThreshold;
        }
        
        return false;
    }

    // ===== KEYBOARD EVENTS =====
    
    static getKeyInfo(event) {
        return {
            key: event.key,
            code: event.code,
            keyCode: event.keyCode,
            which: event.which,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            repeat: event.repeat
        };
    }

    static isEnterKey(event) {
        return event.key === 'Enter' || event.keyCode === 13;
    }

    static isEscapeKey(event) {
        return event.key === 'Escape' || event.keyCode === 27;
    }

    static isArrowKey(event) {
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        return arrowKeys.includes(event.key) || 
               [37, 38, 39, 40].includes(event.keyCode);
    }

    static isDeleteKey(event) {
        return event.key === 'Delete' || event.key === 'Backspace' ||
               event.keyCode === 8 || event.keyCode === 46;
    }

    static isSpaceKey(event) {
        return event.key === ' ' || event.keyCode === 32;
    }

    static isTabKey(event) {
        return event.key === 'Tab' || event.keyCode === 9;
    }

    // ===== DRAG AND DROP EVENTS =====
    
    static makeDraggable(element, options = {}) {
        if (!element) return false;
        
        const config = {
            handle: options.handle || element,
            containment: options.containment || null,
            onStart: options.onStart || (() => {}),
            onMove: options.onMove || (() => {}),
            onEnd: options.onEnd || (() => {}),
            grid: options.grid || null,
            axis: options.axis || null // 'x', 'y', or null for both
        };
        
        let isDragging = false;
        let startPos = { x: 0, y: 0 };
        let elementStart = { x: 0, y: 0 };
        
        const handleMouseDown = (e) => {
            if (!this.isLeftClick(e)) return;
            
            e.preventDefault();
            isDragging = true;
            
            startPos = this.getMousePosition(e);
            elementStart = {
                x: element.offsetLeft,
                y: element.offsetTop
            };
            
            config.onStart(e, element);
            
            // Add temporary event listeners
            this.on(document, 'mousemove', handleMouseMove);
            this.on(document, 'mouseup', handleMouseUp);
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            const currentPos = this.getMousePosition(e);
            let deltaX = currentPos.x - startPos.x;
            let deltaY = currentPos.y - startPos.y;
            
            // Apply axis constraints
            if (config.axis === 'x') deltaY = 0;
            if (config.axis === 'y') deltaX = 0;
            
            let newX = elementStart.x + deltaX;
            let newY = elementStart.y + deltaY;
            
            // Apply grid snapping
            if (config.grid) {
                newX = Math.round(newX / config.grid[0]) * config.grid[0];
                newY = Math.round(newY / config.grid[1]) * config.grid[1];
            }
            
            // Apply containment
            if (config.containment) {
                const bounds = config.containment.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();
                
                newX = Math.max(0, Math.min(newX, bounds.width - elementRect.width));
                newY = Math.max(0, Math.min(newY, bounds.height - elementRect.height));
            }
            
            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
            
            config.onMove(e, element, { x: newX, y: newY });
        };
        
        const handleMouseUp = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            
            this.off(document, 'mousemove', handleMouseMove);
            this.off(document, 'mouseup', handleMouseUp);
            
            config.onEnd(e, element);
        };
        
        this.on(config.handle, 'mousedown', handleMouseDown);
        
        return true;
    }

    static makeDroppable(element, options = {}) {
        if (!element) return false;
        
        const config = {
            accept: options.accept || '*',
            onDragOver: options.onDragOver || (() => {}),
            onDragEnter: options.onDragEnter || (() => {}),
            onDragLeave: options.onDragLeave || (() => {}),
            onDrop: options.onDrop || (() => {})
        };
        
        this.on(element, 'dragover', (e) => {
            e.preventDefault();
            config.onDragOver(e, element);
        });
        
        this.on(element, 'dragenter', (e) => {
            e.preventDefault();
            config.onDragEnter(e, element);
        });
        
        this.on(element, 'dragleave', (e) => {
            config.onDragLeave(e, element);
        });
        
        this.on(element, 'drop', (e) => {
            e.preventDefault();
            config.onDrop(e, element);
        });
        
        return true;
    }

    // ===== FORM EVENTS =====
    
    static onFormSubmit(form, handler, validate = true) {
        if (!form || !handler) return false;
        
        this.on(form, 'submit', (e) => {
            if (validate && !this.validateForm(form)) {
                e.preventDefault();
                return false;
            }
            
            return handler(e, form);
        });
        
        return true;
    }

    static onInputChange(input, handler, debounce = 0) {
        if (!input || !handler) return false;
        
        let timeout;
        const debouncedHandler = (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => handler(e, input), debounce);
        };
        
        const actualHandler = debounce > 0 ? debouncedHandler : handler;
        
        this.on(input, 'input', actualHandler);
        this.on(input, 'change', actualHandler);
        
        return true;
    }

    static validateForm(form) {
        if (!form) return false;
        
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.addClass(field, 'error');
                isValid = false;
            } else {
                this.removeClass(field, 'error');
            }
        });
        
        return isValid;
    }

    // ===== SCROLL EVENTS =====
    
    static onScroll(element, handler, throttle = 16) {
        if (!element || !handler) return false;
        
        let isThrottled = false;
        const throttledHandler = (e) => {
            if (isThrottled) return;
            
            isThrottled = true;
            requestAnimationFrame(() => {
                handler(e, element);
                isThrottled = false;
            });
        };
        
        const actualHandler = throttle > 0 ? throttledHandler : handler;
        this.on(element, 'scroll', actualHandler);
        
        return true;
    }

    static getScrollInfo(element) {
        const isWindow = element === window;
        
        return {
            scrollTop: isWindow ? window.pageYOffset : element.scrollTop,
            scrollLeft: isWindow ? window.pageXOffset : element.scrollLeft,
            scrollHeight: isWindow ? document.documentElement.scrollHeight : element.scrollHeight,
            scrollWidth: isWindow ? document.documentElement.scrollWidth : element.scrollWidth,
            clientHeight: isWindow ? window.innerHeight : element.clientHeight,
            clientWidth: isWindow ? window.innerWidth : element.clientWidth
        };
    }

    // ===== RESIZE EVENTS =====
    
    static onResize(element, handler, throttle = 100) {
        if (!handler) return false;
        
        const targetElement = element || window;
        let isThrottled = false;
        
        const throttledHandler = (e) => {
            if (isThrottled) return;
            
            isThrottled = true;
            setTimeout(() => {
                handler(e, targetElement);
                isThrottled = false;
            }, throttle);
        };
        
        const actualHandler = throttle > 0 ? throttledHandler : handler;
        this.on(targetElement, 'resize', actualHandler);
        
        return true;
    }

    // ===== FOCUS EVENTS =====
    
    static onFocusChange(elements, onFocus, onBlur) {
        if (!elements) return false;
        
        const elementList = Array.isArray(elements) ? elements : [elements];
        
        elementList.forEach(element => {
            if (onFocus) this.on(element, 'focus', onFocus);
            if (onBlur) this.on(element, 'blur', onBlur);
        });
        
        return true;
    }

    static trapFocus(container) {
        if (!container) return false;
        
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return false;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        this.on(container, 'keydown', (e) => {
            if (!this.isTabKey(e)) return;
            
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
        
        firstElement.focus();
        return true;
    }

    // ===== CLEANUP =====
    
    static removeAllEvents(element) {
        if (!element) return false;
        
        const events = this.eventRegistry.get(element);
        if (events) {
            events.forEach(({ event, handler, options }) => {
                element.removeEventListener(event, handler, options);
            });
            this.eventRegistry.delete(element);
        }
        
        return true;
    }

    static cleanup() {
        this.eventRegistry.clear();
        this.delegatedEvents.clear();
    }

    // ===== UTILITY HELPERS =====
    
    static preventDefault(event) {
        if (event && event.preventDefault) {
            event.preventDefault();
        }
    }

    static stopPropagation(event) {
        if (event && event.stopPropagation) {
            event.stopPropagation();
        }
    }

    static stopImmediatePropagation(event) {
        if (event && event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
        }
    }

    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventUtils;
} else if (typeof window !== 'undefined') {
    window.EventUtils = EventUtils;
}