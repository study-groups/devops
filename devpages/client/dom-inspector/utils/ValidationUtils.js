/**
 * ValidationUtils.js
 * CSS selector validation and auto-fixing utilities
 */

export class ValidationUtils {
    /**
     * Check if a CSS selector contains invalid characters
     * @param {string} selector - The CSS selector to validate
     * @returns {boolean} - True if selector is invalid
     */
    static isInvalidSelector(selector) {
        if (!selector || typeof selector !== 'string') {
            return true;
        }
        
        // Allow escaped forward slashes (\/) but not unescaped ones
        const hasUnescapedSlash = selector.includes('/') && !selector.includes('\\/');
        return hasUnescapedSlash;
    }

    /**
     * Auto-fix common selector issues
     * @param {string} selector - The selector to fix
     * @returns {string} - The fixed selector
     */
    static fixSelector(selector) {
        if (!selector || typeof selector !== 'string') {
            return '';
        }
        
        let fixed = selector;
        
        // Escape forward slashes in selectors
        if (fixed.includes('/') && !fixed.includes('\\/')) {
            fixed = fixed.replace(/\//g, '\\/');
        }
        
        return fixed;
    }

    /**
     * Generate helpful error messages and suggestions for invalid selectors
     * @param {string} query - The invalid selector
     * @param {Error} error - The error object
     * @returns {Object} - Error information with suggestions
     */
    static generateErrorInfo(query, error) {
        let suggestions = '';
        let correctedQuery = query;
        
        if (query.includes('/')) {
            // Handle the specific case of theme-selector/directory-information
            if (query.includes('theme-selector/directory-information')) {
                correctedQuery = query.replace('theme-selector/directory-information', 'theme-selector\\/directory-information');
                suggestions = `
                    <div style="margin-top: 10px;">
                        <strong>💡 Fix:</strong> Forward slashes in IDs need to be escaped in CSS selectors.
                        <br><strong>Try this:</strong> <code>${correctedQuery}</code>
                        <br><strong>Or use attribute selector:</strong> <code>[id="theme-selector/directory-information"] > h2.settings-section-header</code>
                        <button class="dom-inspector-fix-btn" onclick="
                            const input = document.querySelector('.dom-inspector-query-input');
                            if (input) { 
                                input.value = '${correctedQuery}'; 
                                input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
                            }
                        ">Try Fixed Selector</button>
                    </div>
                `;
            } else {
                correctedQuery = this.fixSelector(query);
                suggestions = `
                    <div style="margin-top: 10px;">
                        <strong>💡 Common fix:</strong> Forward slashes (/) in CSS selectors need to be escaped with backslashes.
                        <br><strong>Fixed selector:</strong> <code>${correctedQuery}</code>
                        <br>Or use attribute selectors like <code>[id="element-id"]</code> for IDs containing special characters.
                        <button class="dom-inspector-fix-btn" onclick="
                            const input = document.querySelector('.dom-inspector-query-input');
                            if (input) { 
                                input.value = '${correctedQuery}'; 
                                input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
                            }
                        ">Try Fixed Selector</button>
                    </div>
                `;
            }
        }
        
        return {
            query,
            error: error.message,
            suggestions,
            correctedQuery,
            hasAutoFix: correctedQuery !== query
        };
    }

    /**
     * Sanitize a selector part (ID or class name) by removing invalid characters
     * @param {string} selector - The selector part to sanitize
     * @returns {string} - The sanitized selector
     */
    static sanitizeSelector(selector) {
        if (!selector) return '';
        
        // Remove invalid characters for CSS selectors
        // Keep only letters, numbers, hyphens, underscores
        return selector.replace(/[^a-zA-Z0-9\-_]/g, '');
    }

    /**
     * Validate and potentially fix a selector before execution
     * @param {string} query - The selector to validate
     * @returns {Object} - Validation result with fixed selector if applicable
     */
    static validateAndFix(query) {
        const result = {
            isValid: true,
            originalQuery: query,
            fixedQuery: query,
            error: null,
            autoFixed: false
        };

        // Check for invalid characters
        if (this.isInvalidSelector(query)) {
            // Try to auto-fix the selector
            const fixedQuery = this.fixSelector(query);
            
            if (fixedQuery !== query) {
                result.fixedQuery = fixedQuery;
                result.autoFixed = true;
                result.isValid = true; // Consider it valid after auto-fix
            } else {
                result.isValid = false;
                result.error = new Error('Selector contains invalid characters. Common issues: forward slashes (/) are not valid in CSS selectors.');
            }
        }

        return result;
    }

    /**
     * Test if a selector would work without throwing an error
     * @param {string} selector - The selector to test
     * @returns {boolean} - True if selector is syntactically valid
     */
    static testSelector(selector) {
        try {
            document.querySelector(selector);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get common validation rules and their descriptions
     * @returns {Array} - Array of validation rules
     */
    static getValidationRules() {
        return [
            {
                rule: 'no-unescaped-slashes',
                description: 'Forward slashes (/) must be escaped as (\\/) in CSS selectors',
                example: 'div#my\\/id instead of div#my/id'
            },
            {
                rule: 'valid-characters',
                description: 'IDs and classes should only contain letters, numbers, hyphens, and underscores',
                example: 'Use my-element instead of my@element'
            },
            {
                rule: 'attribute-selector-alternative',
                description: 'For complex IDs, consider using attribute selectors',
                example: '[id="complex/id"] instead of #complex\\/id'
            }
        ];
    }
} 