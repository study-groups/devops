/**
 * client/dom-inspector/utils/ValidationUtils.js
 * Utility functions for validation and fixing CSS selectors
 */

export class ValidationUtils {
    /**
     * Check if a CSS selector is valid
     */
    static isValidSelector(selector) {
        try {
            document.querySelector(selector);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if selector contains invalid characters
     */
    static isInvalidSelector(selector) {
        // Check for common invalid characters in CSS selectors
        const invalidChars = /[^\w\s\-_#.:\[\]="'()>+~,]/;
        return invalidChars.test(selector);
    }

    /**
     * Attempt to fix a broken selector
     */
    static fixSelector(selector) {
        if (!selector) return '';
        
        let fixed = selector;
        
        // Handle forward slashes in IDs by escaping them
        fixed = fixed.replace(/#([^#\s]*\/[^#\s]*)/g, (match, idPart) => {
            return `#${idPart.replace(/\//g, '\\/')}`;
        });
        
        // Remove other invalid characters
        fixed = fixed.replace(/[^\w\s\-_#.:\[\]="'()>+~,\\]/g, '');
        
        return fixed;
    }

    /**
     * Escape special characters in CSS selectors
     */
    static escapeSelector(selector) {
        if (!selector) return '';
        
        // Escape special CSS characters
        return selector.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    }

    /**
     * Validate element ID for CSS selector use
     */
    static isValidId(id) {
        if (!id) return false;
        
        // CSS ID must start with letter, underscore, or hyphen
        // Can contain letters, numbers, hyphens, underscores
        const validIdPattern = /^[a-zA-Z_-][a-zA-Z0-9_-]*$/;
        return validIdPattern.test(id);
    }

    /**
     * Validate class name for CSS selector use
     */
    static isValidClassName(className) {
        if (!className) return false;
        
        // CSS class names have same rules as IDs
        const validClassPattern = /^[a-zA-Z_-][a-zA-Z0-9_-]*$/;
        return validClassPattern.test(className);
    }

    /**
     * Clean up a string for use in CSS selectors
     */
    static sanitizeForSelector(str) {
        if (!str) return '';
        
        // Remove/replace invalid characters
        return str.replace(/[^a-zA-Z0-9\-_]/g, '');
    }

    /**
     * Check if string contains only safe characters
     */
    static isSafeString(str) {
        if (!str) return true;
        
        // Only allow alphanumeric, hyphen, underscore
        const safePattern = /^[a-zA-Z0-9\-_]*$/;
        return safePattern.test(str);
    }

    /**
     * Validate HTML tag name
     */
    static isValidTagName(tagName) {
        if (!tagName) return false;
        
        // HTML tag names are alphanumeric and hyphens
        const validTagPattern = /^[a-zA-Z][a-zA-Z0-9-]*$/;
        return validTagPattern.test(tagName);
    }

    /**
     * Check if element exists in DOM
     */
    static elementExists(element) {
        return element && 
               element.nodeType === Node.ELEMENT_NODE && 
               document.contains(element);
    }

    /**
     * Validate that element is not null/undefined and is in DOM
     */
    static isValidElement(element) {
        return element && 
               element.nodeType === Node.ELEMENT_NODE && 
               element.tagName && 
               document.contains(element);
    }

    /**
     * Clean up and validate element reference
     */
    static validateElementReference(element) {
        if (!element) {
            return { valid: false, error: 'Element is null or undefined' };
        }
        
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return { valid: false, error: 'Not an element node' };
        }
        
        if (!element.tagName) {
            return { valid: false, error: 'Element has no tag name' };
        }
        
        if (!document.contains(element)) {
            return { valid: false, error: 'Element is not in the document' };
        }
        
        return { valid: true };
    }

    /**
     * Validate selector and provide suggestions
     */
    static validateSelectorWithSuggestions(selector) {
        const result = {
            valid: false,
            selector,
            suggestions: []
        };
        
        if (!selector || typeof selector !== 'string') {
            result.suggestions.push('Selector must be a non-empty string');
            return result;
        }
        
        // Test if selector works as-is
        if (this.isValidSelector(selector)) {
            result.valid = true;
            return result;
        }
        
        // Try to fix common issues
        const fixed = this.fixSelector(selector);
        if (fixed !== selector && this.isValidSelector(fixed)) {
            result.suggestions.push({
                type: 'fixed',
                selector: fixed,
                description: 'Auto-fixed selector'
            });
        }
        
        // Check for specific issues
        if (selector.includes('/')) {
            result.suggestions.push({
                type: 'escape',
                description: 'Forward slashes in selectors need to be escaped: use \\/ or attribute selectors [id="value"]'
            });
        }
        
        if (this.isInvalidSelector(selector)) {
            result.suggestions.push({
                type: 'invalid_chars',
                description: 'Selector contains invalid characters for CSS'
            });
        }
        
        return result;
    }
} 