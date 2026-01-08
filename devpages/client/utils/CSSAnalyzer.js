/**
 * CSSAnalyzer.js - Pure CSS analysis utilities
 *
 * Extracted from CSSInspectorPanel for reuse across the application.
 * Contains stateless analysis functions for:
 * - Z-index and stacking context analysis
 * - CSS specificity calculation
 * - Matching CSS rules detection
 * - Stylesheet source identification
 */

/**
 * Analyze z-index and stacking context for an element
 * @param {Element} element - DOM element to analyze
 * @returns {Object} Analysis result with zIndex, position, stacking context info
 */
export function analyzeZIndex(element) {
    const computed = window.getComputedStyle(element);
    const zIndex = computed.zIndex;
    const position = computed.position;
    const opacity = computed.opacity;
    const transform = computed.transform;
    const filter = computed.filter;
    const willChange = computed.willChange;

    const isAuto = zIndex === 'auto';
    const stackingContext = createsStackingContext(element);

    let stackingReason = '';
    if (stackingContext) {
        if (position !== 'static' && !isAuto) {
            stackingReason = `Positioned element (${position}) with z-index: ${zIndex}`;
        } else if (opacity !== '1') {
            stackingReason = `Opacity less than 1 (${opacity})`;
        } else if (transform !== 'none') {
            stackingReason = 'Transform applied';
        } else if (filter !== 'none') {
            stackingReason = 'Filter applied';
        } else if (willChange !== 'auto') {
            stackingReason = `will-change: ${willChange}`;
        } else {
            stackingReason = 'Other CSS property creates stacking context';
        }
    }

    return {
        zIndex: isAuto ? 'auto' : zIndex,
        isAuto,
        position,
        stackingContext,
        stackingReason,
        opacity,
        transform,
        filter,
        willChange
    };
}

/**
 * Check if an element creates a stacking context
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if element creates stacking context
 */
export function createsStackingContext(element) {
    const computed = window.getComputedStyle(element);

    return (
        // Root element
        element === document.documentElement ||
        // Position + z-index
        (computed.position !== 'static' && computed.zIndex !== 'auto') ||
        // Position fixed/sticky
        computed.position === 'fixed' ||
        computed.position === 'sticky' ||
        // Opacity
        parseFloat(computed.opacity) < 1 ||
        // Transform
        computed.transform !== 'none' ||
        // Filter
        computed.filter !== 'none' ||
        // Will-change
        computed.willChange === 'transform' ||
        computed.willChange === 'opacity' ||
        // Flex/grid with z-index
        ((computed.display === 'flex' || computed.display === 'inline-flex' ||
          computed.display === 'grid' || computed.display === 'inline-grid') &&
         computed.zIndex !== 'auto') ||
        // Isolation
        computed.isolation === 'isolate' ||
        // Mix-blend-mode
        computed.mixBlendMode !== 'normal' ||
        // Contain
        computed.contain === 'layout' ||
        computed.contain === 'paint' ||
        computed.contain.includes('layout') ||
        computed.contain.includes('paint')
    );
}

/**
 * Calculate CSS specificity of a selector
 * @param {string} selector - CSS selector string
 * @returns {Object} Specificity breakdown { ids, classes, elements, display }
 */
export function calculateSpecificity(selector) {
    const ids = (selector.match(/#/g) || []).length;
    const classes = (selector.match(/\./g) || []).length + (selector.match(/\[/g) || []).length;
    const elements = (selector.match(/(?:^|[\s>+~])(?!#|\.)[\w-]+/g) || []).length;

    return {
        ids,
        classes,
        elements,
        display: `(${ids},${classes},${elements})`,
        // Numeric value for sorting (ids * 100 + classes * 10 + elements)
        value: ids * 100 + classes * 10 + elements
    };
}

/**
 * Get a human-readable source identifier for a stylesheet
 * @param {CSSStyleSheet} sheet - Stylesheet object
 * @returns {string} Source identifier
 */
export function getStylesheetSource(sheet) {
    if (sheet.href) {
        try {
            const url = new URL(sheet.href);
            return url.pathname.split('/').pop() || sheet.href;
        } catch {
            return sheet.href;
        }
    }
    if (sheet.ownerNode) {
        if (sheet.ownerNode.id) {
            return `<style id="${sheet.ownerNode.id}">`;
        }
        return '<style> (inline)';
    }
    return 'Unknown source';
}

/**
 * Get all CSS rules that match an element
 * @param {Element} element - DOM element
 * @returns {Array} Array of matching rules with source info
 */
export function getMatchingCSSRules(element) {
    const rules = [];
    const sheets = document.styleSheets;

    for (const sheet of sheets) {
        try {
            const cssRules = sheet.cssRules || sheet.rules;
            if (!cssRules) continue;

            for (const rule of cssRules) {
                if (rule.type === CSSRule.STYLE_RULE) {
                    try {
                        if (element.matches(rule.selectorText)) {
                            rules.push({
                                source: getStylesheetSource(sheet),
                                selectorText: rule.selectorText,
                                style: rule.style,
                                specificity: calculateSpecificity(rule.selectorText),
                                cssText: rule.cssText
                            });
                        }
                    } catch (e) {
                        // Invalid selector - skip
                    }
                }
            }
        } catch (e) {
            // CORS or access issues - skip this stylesheet
        }
    }

    // Sort by specificity (highest first)
    rules.sort((a, b) => b.specificity.value - a.specificity.value);

    return rules;
}

/**
 * Get computed styles for specific properties
 * @param {Element} element - DOM element
 * @param {string[]} properties - Array of CSS property names
 * @returns {Object} Map of property name to computed value
 */
export function getComputedProperties(element, properties) {
    const computed = window.getComputedStyle(element);
    const result = {};

    for (const prop of properties) {
        result[prop] = computed.getPropertyValue(prop);
    }

    return result;
}

/**
 * Get all CSS custom properties (variables) applied to an element
 * @param {Element} element - DOM element
 * @returns {Array} Array of { name, value } objects
 */
export function getCSSVariables(element) {
    const computed = window.getComputedStyle(element);
    const variables = [];

    for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        if (prop.startsWith('--')) {
            variables.push({
                name: prop,
                value: computed.getPropertyValue(prop).trim()
            });
        }
    }

    return variables;
}

/**
 * Group CSS variables by prefix
 * @param {Array} variables - Array of { name, value } objects
 * @returns {Object} Variables grouped by prefix (e.g., 'color', 'spacing')
 */
export function groupVariablesByPrefix(variables) {
    const groups = {};

    for (const variable of variables) {
        // Extract prefix from --prefix-rest-of-name
        const match = variable.name.match(/^--([^-]+)/);
        const prefix = match ? match[1] : 'other';

        if (!groups[prefix]) {
            groups[prefix] = [];
        }
        groups[prefix].push(variable);
    }

    return groups;
}

/**
 * Analyze stacking context hierarchy for an element
 * @param {Element} element - DOM element
 * @param {number} maxLevels - Maximum levels to traverse up
 * @returns {Array} Array of stacking context info from element to root
 */
export function getStackingContextHierarchy(element, maxLevels = 10) {
    const hierarchy = [];
    let currentEl = element;
    let level = 0;

    while (currentEl && currentEl !== document.documentElement && level < maxLevels) {
        const analysis = analyzeZIndex(currentEl);

        if (analysis.stackingContext || level === 0) {
            hierarchy.push({
                element: currentEl,
                tagName: currentEl.tagName.toLowerCase(),
                id: currentEl.id,
                classList: Array.from(currentEl.classList),
                ...analysis
            });
        }

        currentEl = currentEl.parentElement;
        level++;
    }

    // Add document root if we reached it
    if (currentEl === document.documentElement) {
        hierarchy.push({
            element: document.documentElement,
            tagName: 'html',
            id: '',
            classList: [],
            zIndex: 'auto',
            isAuto: true,
            position: 'static',
            stackingContext: true,
            stackingReason: 'Root element'
        });
    }

    return hierarchy;
}

/**
 * Find sibling elements in the same stacking context
 * @param {Element} element - DOM element
 * @returns {Array} Array of sibling info with z-index data
 */
export function getSiblingsInStackingContext(element) {
    const parent = element.parentElement;
    if (!parent) return [];

    const siblings = [];

    for (const sibling of parent.children) {
        const analysis = analyzeZIndex(sibling);
        siblings.push({
            element: sibling,
            tagName: sibling.tagName.toLowerCase(),
            id: sibling.id,
            classList: Array.from(sibling.classList).slice(0, 3),
            isCurrent: sibling === element,
            ...analysis
        });
    }

    // Sort by z-index (numeric values first, then 'auto')
    siblings.sort((a, b) => {
        if (a.isAuto && b.isAuto) return 0;
        if (a.isAuto) return 1;
        if (b.isAuto) return -1;
        return parseInt(b.zIndex) - parseInt(a.zIndex);
    });

    return siblings;
}
