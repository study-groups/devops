/**
 * DomUtils.js
 * DOM manipulation and element property extraction utilities
 */

export class DomUtils {
    /**
     * Get computed styles for an element
     * @param {Element} element - The DOM element
     * @returns {CSSStyleDeclaration} - Computed styles
     */
    static getComputedStyles(element) {
        return window.getComputedStyle(element);
    }

    /**
     * Get element's bounding rectangle
     * @param {Element} element - The DOM element
     * @returns {DOMRect} - Element's bounding rectangle
     */
    static getBoundingRect(element) {
        return element.getBoundingClientRect();
    }

    /**
     * Check if an element is visible in the viewport
     * @param {Element} element - The DOM element
     * @returns {boolean} - True if element is visible
     */
    static isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );
    }

    /**
     * Check if an element is disabled
     * @param {Element} element - The DOM element
     * @returns {Object} - Disabled state information
     */
    static getDisabledState(element) {
        const isDisabled = element.disabled || 
                          element.hasAttribute('disabled') || 
                          element.getAttribute('aria-disabled') === 'true';
        
        const isReadonly = element.readOnly || element.hasAttribute('readonly');
        
        return {
            isDisabled,
            isReadonly,
            hasDisabledAttribute: element.hasAttribute('disabled'),
            ariaDisabled: element.getAttribute('aria-disabled')
        };
    }

    /**
     * Get all event listeners attached to an element (limited by browser security)
     * @param {Element} element - The DOM element
     * @returns {Array} - Array of detected event types
     */
    static getEventListeners(element) {
        const events = [];
        
        // Check for common event attributes
        const eventAttributes = [
            'onclick', 'onchange', 'onsubmit', 'onload', 'onerror', 'onfocus', 'onblur',
            'onmousedown', 'onmouseup', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup'
        ];
        
        eventAttributes.forEach(attr => {
            if (element[attr]) {
                events.push(attr.substring(2)); // Remove 'on' prefix
            }
        });
        
        return events;
    }

    /**
     * Get element's children count and types
     * @param {Element} element - The DOM element
     * @returns {Object} - Children information
     */
    static getChildrenInfo(element) {
        const children = Array.from(element.children);
        const childTypes = {};
        
        children.forEach(child => {
            const tagName = child.tagName.toLowerCase();
            childTypes[tagName] = (childTypes[tagName] || 0) + 1;
        });
        
        return {
            count: children.length,
            types: childTypes,
            hasText: element.textContent && element.textContent.trim().length > 0
        };
    }

    /**
     * Get element's text content with length information
     * @param {Element} element - The DOM element
     * @returns {Object} - Text content information
     */
    static getTextInfo(element) {
        const textContent = element.textContent || '';
        const innerText = element.innerText || '';
        
        return {
            textContent: textContent.trim(),
            innerText: innerText.trim(),
            length: textContent.trim().length,
            hasText: textContent.trim().length > 0,
            isLongText: textContent.trim().length > 100
        };
    }

    /**
     * Get form element specific information
     * @param {Element} element - The form element
     * @returns {Object} - Form element information
     */
    static getFormElementInfo(element) {
        const formTags = ['input', 'textarea', 'select', 'button', 'form'];
        const tagName = element.tagName.toLowerCase();
        
        if (!formTags.includes(tagName)) {
            return null;
        }
        
        const info = {
            tagName,
            type: element.type || null,
            name: element.name || null,
            value: element.value || null,
            placeholder: element.placeholder || null,
            required: element.required || false,
            disabled: element.disabled || false,
            readonly: element.readOnly || false
        };
        
        // Additional info for select elements
        if (tagName === 'select') {
            info.options = Array.from(element.options || []).map((opt, index) => ({
                index,
                text: opt.text,
                value: opt.value,
                selected: opt.selected
            }));
            info.multiple = element.multiple || false;
        }
        
        return info;
    }

    /**
     * Get element's positioning and layout information
     * @param {Element} element - The DOM element
     * @returns {Object} - Layout information
     */
    static getLayoutInfo(element) {
        const styles = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return {
            display: styles.display,
            position: styles.position,
            float: styles.float,
            clear: styles.clear,
            zIndex: styles.zIndex,
            overflow: styles.overflow,
            visibility: styles.visibility,
            opacity: styles.opacity,
            dimensions: {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom
            }
        };
    }

    /**
     * Get element's box model information
     * @param {Element} element - The DOM element
     * @returns {Object} - Box model information
     */
    static getBoxModel(element) {
        const styles = window.getComputedStyle(element);
        
        return {
            margin: {
                top: styles.marginTop,
                right: styles.marginRight,
                bottom: styles.marginBottom,
                left: styles.marginLeft
            },
            padding: {
                top: styles.paddingTop,
                right: styles.paddingRight,
                bottom: styles.paddingBottom,
                left: styles.paddingLeft
            },
            border: {
                top: styles.borderTopWidth,
                right: styles.borderRightWidth,
                bottom: styles.borderBottomWidth,
                left: styles.borderLeftWidth
            },
            content: {
                width: styles.width,
                height: styles.height
            }
        };
    }

    /**
     * Get element's attributes as an object
     * @param {Element} element - The DOM element
     * @returns {Object} - Element attributes
     */
    static getAttributes(element) {
        const attributes = {};
        
        for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
        }
        
        return attributes;
    }

    /**
     * Get element's data attributes
     * @param {Element} element - The DOM element
     * @returns {Object} - Data attributes
     */
    static getDataAttributes(element) {
        return { ...element.dataset };
    }

    /**
     * Check if element matches a CSS selector
     * @param {Element} element - The DOM element
     * @param {string} selector - CSS selector
     * @returns {boolean} - True if element matches selector
     */
    static matchesSelector(element, selector) {
        try {
            return element.matches(selector);
        } catch (error) {
            return false;
        }
    }

    /**
     * Find the closest ancestor that matches a selector
     * @param {Element} element - The DOM element
     * @param {string} selector - CSS selector
     * @returns {Element|null} - Matching ancestor or null
     */
    static closest(element, selector) {
        try {
            return element.closest(selector);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get element's parent chain up to a certain depth
     * @param {Element} element - The DOM element
     * @param {number} maxDepth - Maximum depth to traverse
     * @returns {Array} - Array of parent elements
     */
    static getParentChain(element, maxDepth = 10) {
        const parents = [];
        let current = element.parentElement;
        let depth = 0;
        
        while (current && current !== document.documentElement && depth < maxDepth) {
            parents.push(current);
            current = current.parentElement;
            depth++;
        }
        
        return parents;
    }

    /**
     * Check if an element is clickable
     * @param {Element} element - The DOM element
     * @returns {Object} - Clickability information
     */
    static getClickabilityInfo(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Test multiple points to find where the element is actually clickable
        const testPoints = [
            { x: centerX, y: centerY, name: 'center' },
            { x: rect.left + 5, y: rect.top + 5, name: 'top-left' },
            { x: rect.right - 5, y: rect.top + 5, name: 'top-right' },
            { x: rect.left + 5, y: rect.bottom - 5, name: 'bottom-left' },
            { x: rect.right - 5, y: rect.bottom - 5, name: 'bottom-right' }
        ];
        
        const results = testPoints.map(point => {
            const elementAtPoint = document.elementFromPoint(point.x, point.y);
            const isDirectHit = elementAtPoint === element;
            const isChildHit = element.contains(elementAtPoint);
            
            return {
                ...point,
                elementAtPoint,
                isDirectHit,
                isChildHit,
                isClickable: isDirectHit || isChildHit
            };
        });
        
        const clickablePoints = results.filter(r => r.isDirectHit);
        const childInterceptPoints = results.filter(r => r.isChildHit && !r.isDirectHit);
        
        return {
            isClickable: clickablePoints.length > 0,
            hasChildIntercepts: childInterceptPoints.length > 0,
            clickablePoints,
            childInterceptPoints,
            bestClickPoint: clickablePoints[0] || null
        };
    }

    /**
     * Create a temporary element for testing purposes
     * @param {string} tagName - Tag name for the element
     * @param {Object} attributes - Attributes to set
     * @returns {Element} - Created element
     */
    static createElement(tagName, attributes = {}) {
        const element = document.createElement(tagName);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        
        return element;
    }

    /**
     * Safely remove an element from the DOM
     * @param {Element} element - The element to remove
     * @returns {boolean} - True if element was removed
     */
    static removeElement(element) {
        try {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
                return true;
            }
            return false;
        } catch (error) {
            console.warn('Failed to remove element:', error);
            return false;
        }
    }

    /**
     * Get element's ARIA information
     * @param {Element} element - The DOM element
     * @returns {Object} - ARIA attributes and information
     */
    static getAriaInfo(element) {
        const ariaAttributes = {};
        
        // Get all aria-* attributes
        for (const attr of element.attributes) {
            if (attr.name.startsWith('aria-')) {
                ariaAttributes[attr.name] = attr.value;
            }
        }
        
        return {
            role: element.getAttribute('role'),
            label: element.getAttribute('aria-label'),
            labelledBy: element.getAttribute('aria-labelledby'),
            describedBy: element.getAttribute('aria-describedby'),
            expanded: element.getAttribute('aria-expanded'),
            hidden: element.getAttribute('aria-hidden'),
            disabled: element.getAttribute('aria-disabled'),
            attributes: ariaAttributes
        };
    }
} 