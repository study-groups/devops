/**
 * SelectorUtils.js
 * CSS selector generation and manipulation utilities
 */

import { ValidationUtils } from './ValidationUtils.js';

export class SelectorUtils {
    /**
     * Generate a unique CSS selector for an element
     * @param {Element} element - The DOM element
     * @returns {string} - A CSS selector string
     */
    static generateCSSSelector(element) {
        if (!element || element === document) return '';
        if (element === document.documentElement) return 'html';
        
        // Try ID first (but sanitize it)
        if (element.id) {
            const sanitizedId = ValidationUtils.sanitizeSelector(element.id);
            if (sanitizedId && sanitizedId === element.id) {
                return `#${sanitizedId}`;
            }
        }
        
        // Try class if unique
        if (element.className) {
            const className = element.className.split(' ')[0];
            const sanitizedClass = ValidationUtils.sanitizeSelector(className);
            if (sanitizedClass && document.querySelectorAll(`.${sanitizedClass}`).length === 1) {
                return `.${sanitizedClass}`;
            }
        }
        
        // Build path selector
        const path = [];
        let current = element;
        
        while (current && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id) {
                const sanitizedId = ValidationUtils.sanitizeSelector(current.id);
                if (sanitizedId) {
                    selector += `#${sanitizedId}`;
                    path.unshift(selector);
                    break;
                }
            }
            
            if (current.className) {
                const classes = current.className.split(' ')
                    .filter(c => c.trim())
                    .map(c => ValidationUtils.sanitizeSelector(c))
                    .filter(c => c);
                if (classes.length > 0) {
                    selector += `.${classes.join('.')}`;
                }
            }
            
            // Add nth-child if needed for uniqueness
            const siblings = Array.from(current.parentElement?.children || [])
                .filter(sibling => sibling.tagName === current.tagName);
            
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
            }
            
            path.unshift(selector);
            current = current.parentElement;
        }
        
        return path.join(' > ');
    }

    /**
     * Generate an optimized CSS selector that's shorter but still unique
     * @param {Element} element - The DOM element
     * @returns {string} - An optimized CSS selector
     */
    static generateOptimizedSelector(element) {
        if (!element || element === document) return '';
        if (element === document.documentElement) return 'html';

        // Try various strategies in order of preference
        const strategies = [
            () => this._tryIdSelector(element),
            () => this._tryUniqueClassSelector(element),
            () => this._tryAttributeSelector(element),
            () => this._tryShortPathSelector(element),
            () => this.generateCSSSelector(element) // Fallback to full path
        ];

        for (const strategy of strategies) {
            const selector = strategy();
            if (selector && this._isUniqueSelector(selector, element)) {
                return selector;
            }
        }

        return this.generateCSSSelector(element);
    }

    /**
     * Try to generate a selector using just the ID
     * @private
     */
    static _tryIdSelector(element) {
        if (!element.id) return null;
        
        const sanitizedId = ValidationUtils.sanitizeSelector(element.id);
        if (sanitizedId && sanitizedId === element.id) {
            return `#${sanitizedId}`;
        }
        
        // Try attribute selector for complex IDs
        return `[id="${element.id}"]`;
    }

    /**
     * Try to generate a selector using a unique class
     * @private
     */
    static _tryUniqueClassSelector(element) {
        if (!element.className) return null;
        
        const classes = element.className.split(' ').filter(c => c.trim());
        
        for (const className of classes) {
            const sanitizedClass = ValidationUtils.sanitizeSelector(className);
            if (sanitizedClass && document.querySelectorAll(`.${sanitizedClass}`).length === 1) {
                return `.${sanitizedClass}`;
            }
        }
        
        return null;
    }

    /**
     * Try to generate a selector using attributes
     * @private
     */
    static _tryAttributeSelector(element) {
        const uniqueAttributes = ['data-testid', 'data-id', 'name', 'role'];
        
        for (const attr of uniqueAttributes) {
            const value = element.getAttribute(attr);
            if (value && document.querySelectorAll(`[${attr}="${value}"]`).length === 1) {
                return `[${attr}="${value}"]`;
            }
        }
        
        return null;
    }

    /**
     * Try to generate a short path selector
     * @private
     */
    static _tryShortPathSelector(element) {
        let current = element;
        const path = [];
        let depth = 0;
        const maxDepth = 3; // Limit depth for short selectors
        
        while (current && current !== document.documentElement && depth < maxDepth) {
            let selector = current.tagName.toLowerCase();
            
            // Add ID if available
            if (current.id) {
                const sanitizedId = ValidationUtils.sanitizeSelector(current.id);
                if (sanitizedId) {
                    selector += `#${sanitizedId}`;
                    path.unshift(selector);
                    break;
                }
            }
            
            // Add first class if available
            if (current.className) {
                const firstClass = current.className.split(' ')[0];
                const sanitizedClass = ValidationUtils.sanitizeSelector(firstClass);
                if (sanitizedClass) {
                    selector += `.${sanitizedClass}`;
                }
            }
            
            path.unshift(selector);
            current = current.parentElement;
            depth++;
        }
        
        return path.join(' > ');
    }

    /**
     * Check if a selector uniquely identifies the target element
     * @private
     */
    static _isUniqueSelector(selector, targetElement) {
        try {
            const elements = document.querySelectorAll(selector);
            return elements.length === 1 && elements[0] === targetElement;
        } catch (error) {
            return false;
        }
    }

    /**
     * Parse a CSS selector and extract its components
     * @param {string} selector - The CSS selector to parse
     * @returns {Object} - Parsed selector components
     */
    static parseSelector(selector) {
        const components = {
            tagName: null,
            id: null,
            classes: [],
            attributes: [],
            pseudoClasses: [],
            combinator: null
        };

        if (!selector) return components;

        // Simple parsing - this could be enhanced for more complex selectors
        const parts = selector.split(/\s*([>+~])\s*/);
        const mainPart = parts[0];

        // Extract tag name
        const tagMatch = mainPart.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
        if (tagMatch) {
            components.tagName = tagMatch[1];
        }

        // Extract ID
        const idMatch = mainPart.match(/#([^.:\[]+)/);
        if (idMatch) {
            components.id = idMatch[1];
        }

        // Extract classes
        const classMatches = mainPart.match(/\.([^.:#\[]+)/g);
        if (classMatches) {
            components.classes = classMatches.map(c => c.substring(1));
        }

        // Extract attributes
        const attrMatches = mainPart.match(/\[([^\]]+)\]/g);
        if (attrMatches) {
            components.attributes = attrMatches.map(a => a.slice(1, -1));
        }

        // Extract pseudo-classes
        const pseudoMatches = mainPart.match(/:([^:\[]+)/g);
        if (pseudoMatches) {
            components.pseudoClasses = pseudoMatches.map(p => p.substring(1));
        }

        // Extract combinator
        if (parts.length > 1) {
            components.combinator = parts[1];
        }

        return components;
    }

    /**
     * Build a CSS selector from components
     * @param {Object} components - Selector components
     * @returns {string} - CSS selector string
     */
    static buildSelector(components) {
        let selector = '';

        if (components.tagName) {
            selector += components.tagName;
        }

        if (components.id) {
            selector += `#${components.id}`;
        }

        if (components.classes && components.classes.length > 0) {
            selector += '.' + components.classes.join('.');
        }

        if (components.attributes && components.attributes.length > 0) {
            components.attributes.forEach(attr => {
                selector += `[${attr}]`;
            });
        }

        if (components.pseudoClasses && components.pseudoClasses.length > 0) {
            components.pseudoClasses.forEach(pseudo => {
                selector += `:${pseudo}`;
            });
        }

        return selector;
    }

    /**
     * Simplify a complex selector by removing unnecessary parts
     * @param {string} selector - The selector to simplify
     * @param {Element} targetElement - The target element (for validation)
     * @returns {string} - Simplified selector
     */
    static simplifySelector(selector, targetElement) {
        if (!selector || !targetElement) return selector;

        const parts = selector.split(' > ');
        
        // Try removing parts from the beginning
        for (let i = 1; i < parts.length; i++) {
            const simplified = parts.slice(i).join(' > ');
            if (this._isUniqueSelector(simplified, targetElement)) {
                return simplified;
            }
        }

        return selector;
    }

    /**
     * Get selector specificity score (approximate)
     * @param {string} selector - The CSS selector
     * @returns {number} - Specificity score
     */
    static getSpecificity(selector) {
        if (!selector) return 0;

        let score = 0;
        
        // Count IDs (100 points each)
        score += (selector.match(/#/g) || []).length * 100;
        
        // Count classes, attributes, pseudo-classes (10 points each)
        score += (selector.match(/\./g) || []).length * 10;
        score += (selector.match(/\[/g) || []).length * 10;
        score += (selector.match(/:/g) || []).length * 10;
        
        // Count elements (1 point each)
        score += (selector.match(/[a-zA-Z]/g) || []).length * 1;

        return score;
    }
} 