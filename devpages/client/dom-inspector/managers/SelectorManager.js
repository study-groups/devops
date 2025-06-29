/**
 * client/dom-inspector/managers/SelectorManager.js
 * Manages CSS selector generation, validation, and testing
 */

import { ValidationUtils } from "../utils/ValidationUtils.js";

export class SelectorManager {
    constructor() {
        // No special initialization needed
    }

    /**
     * Generate CSS selector for an element
     */
    generateCSSSelector(element) {
        if (!element || element === document) return '';
        if (element === document.documentElement) return 'html';
        
        // Try ID first (but sanitize it)
        if (element.id) {
            const sanitizedId = this.sanitizeSelector(element.id);
            if (sanitizedId && sanitizedId === element.id) {
                return `#${sanitizedId}`;
            }
        }
        
        // Try class if unique
        if (element.className) {
            const classNames = element.className && typeof element.className === 'string' ? element.className.split(' ') :
                              element.className && element.className.toString ? element.className.toString().split(' ') : [];
            const className = classNames[0];
            const sanitizedClass = this.sanitizeSelector(className);
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
                const sanitizedId = this.sanitizeSelector(current.id);
                if (sanitizedId) {
                    selector += `#${sanitizedId}`;
                    path.unshift(selector);
                    break;
                }
            }
            
            if (current.className) {
                const classNames = current.className && typeof current.className === 'string' ? current.className.split(' ') :
                                  current.className && current.className.toString ? current.className.toString().split(' ') : [];
                const classes = classNames
                    .filter(c => c.trim())
                    .map(c => this.sanitizeSelector(c))
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
     * Sanitize selector for CSS use
     */
    sanitizeSelector(selector) {
        if (!selector) return '';
        
        // Remove invalid characters for CSS selectors
        // Keep only letters, numbers, hyphens, underscores
        return selector.replace(/[^a-zA-Z0-9\-_]/g, '');
    }

    /**
     * Validate if a selector is valid
     */
    isValidSelector(selector) {
        return ValidationUtils.isValidSelector(selector);
    }

    /**
     * Check if selector contains invalid characters
     */
    isInvalidSelector(selector) {
        return ValidationUtils.isInvalidSelector(selector);
    }

    /**
     * Attempt to fix a broken selector
     */
    fixSelector(selector) {
        return ValidationUtils.fixSelector(selector);
    }

    /**
     * Test a selector and return the first matching element
     */
    testSelector(query) {
        try {
            console.log('DOM Inspector: Testing selector:', query);
            
            // Check for invalid characters that would make the selector fail
            if (this.isInvalidSelector(query)) {
                // Try to auto-fix the selector
                const fixedQuery = this.fixSelector(query);
                if (fixedQuery !== query) {
                    console.log(`DOM Inspector: Auto-fixing selector from "${query}" to "${fixedQuery}"`);
                    return this.testSelector(fixedQuery);
                } else {
                    throw new Error(`Selector contains invalid characters. Common issues: forward slashes (/) are not valid in CSS selectors.`);
                }
            }
            
            const element = document.querySelector(query);
            
            if (element) {
                console.log('DOM Inspector: Element found:', element);
                return { success: true, element, query };
            } else {
                console.warn(`DOM Inspector: No element found for selector: "${query}"`);
                return { success: false, error: 'No element found', query };
            }
        } catch (error) {
            console.error(`DOM Inspector: Invalid selector: "${query}"`, error);
            return { success: false, error: error.message, query };
        }
    }

    /**
     * Debug a failed selector by testing parts
     */
    debugFailedSelector(query) {
        console.group('DOM Inspector: Selector Debug');
        console.log('Failed query:', query);
        
        try {
            // Try to parse the selector by testing parts
            const parts = query.split(' ');
            console.log('Query parts:', parts);
            
            for (let i = 0; i < parts.length; i++) {
                const partialQuery = parts.slice(0, i + 1).join(' ');
                try {
                    const elements = document.querySelectorAll(partialQuery);
                    console.log(`Part "${partialQuery}": ${elements.length} matches`);
                } catch (e) {
                    console.log(`Part "${partialQuery}": INVALID`);
                }
            }
        } catch (e) {
            console.log('Debug failed:', e);
        }
        
        console.groupEnd();
    }

    /**
     * Create selector error information
     */
    createSelectorError(query, error) {
        const errorInfo = {
            query,
            error: error.message,
            suggestions: []
        };

        if (query.includes('/')) {
            // Try to suggest a corrected selector
            let correctedQuery = query;
            
            // Handle the specific case of theme-selector/directory-information
            if (query.includes('theme-selector/directory-information')) {
                correctedQuery = query.replace('theme-selector/directory-information', 'theme-selector\\/directory-information');
                errorInfo.suggestions.push({
                    type: 'escaped',
                    selector: correctedQuery,
                    description: 'Forward slashes in IDs need to be escaped in CSS selectors'
                });
                errorInfo.suggestions.push({
                    type: 'attribute',
                    selector: `[id="theme-selector/directory-information"] > h2.settings-section-header`,
                    description: 'Use attribute selector for IDs with special characters'
                });
            } else {
                errorInfo.suggestions.push({
                    type: 'general',
                    description: 'Forward slashes (/) in CSS selectors need to be escaped with backslashes, or use attribute selectors like [id="element-id"] for IDs containing special characters.'
                });
            }
        }

        return errorInfo;
    }

    /**
     * Test selector comprehensively
     */
    comprehensiveTest(query) {
        console.log('DOM Inspector: Comprehensive selector test:', query);
        
        // Test the full selector
        const fullResult = document.querySelector(query);
        console.log('Full selector result:', fullResult);
        
        // Test each part if it's a compound selector
        const parts = query.split(' ');
        const partResults = [];
        
        for (let i = 0; i < parts.length; i++) {
            const partialQuery = parts.slice(0, i + 1).join(' ');
            try {
                const elements = document.querySelectorAll(partialQuery);
                partResults.push({
                    query: partialQuery,
                    count: elements.length,
                    valid: true
                });
            } catch (e) {
                partResults.push({
                    query: partialQuery,
                    count: 0,
                    valid: false,
                    error: e.message
                });
            }
        }
        
        return {
            fullResult,
            partResults,
            isValid: !!fullResult,
            query
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Nothing specific to clean up for now
    }
} 