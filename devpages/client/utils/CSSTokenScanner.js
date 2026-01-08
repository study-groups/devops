/**
 * CSSTokenScanner.js - Design token and hardcoded color scanning utilities
 *
 * Extracted from CSSInspectorPanel for reuse.
 * Scans stylesheets for:
 * - Hardcoded color values (not using CSS variables)
 * - Design token usage patterns
 * - Unused design tokens
 */

/**
 * Color-related CSS properties to scan
 */
export const COLOR_PROPERTIES = [
    'color',
    'background-color',
    'background',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'box-shadow',
    'text-shadow',
    'fill',
    'stroke',
    'caret-color',
    'column-rule-color',
    'text-decoration-color'
];

/**
 * Regex patterns for detecting color values
 */
const COLOR_PATTERNS = {
    hex: /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    rgb: /rgba?\s*\([^)]+\)/gi,
    hsl: /hsla?\s*\([^)]+\)/gi,
    named: /\b(red|blue|green|yellow|orange|purple|pink|brown|black|white|gray|grey|cyan|magenta|lime|maroon|navy|olive|teal|aqua|fuchsia|silver)\b/gi
};

/**
 * Scan all stylesheets for hardcoded color values
 * @returns {Array} Array of hardcoded color findings
 */
export function scanHardcodedColors() {
    const findings = [];
    const sheets = document.styleSheets;

    for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const source = getStylesheetSource(sheet);

        try {
            const cssRules = sheet.cssRules || sheet.rules;
            if (!cssRules) continue;

            for (let j = 0; j < cssRules.length; j++) {
                const rule = cssRules[j];
                if (!rule.style) continue;

                const selector = rule.selectorText || '';

                // Skip variable definitions
                if (selector === ':root' || selector.includes('[data-theme')) {
                    continue;
                }

                for (const prop of COLOR_PROPERTIES) {
                    const value = rule.style.getPropertyValue(prop);
                    if (!value) continue;

                    // Skip if it uses a CSS variable
                    if (value.includes('var(')) continue;

                    // Check for hardcoded colors
                    const colors = extractColors(value);
                    if (colors.length > 0) {
                        findings.push({
                            stylesheet: source,
                            selector,
                            property: prop,
                            value,
                            colors,
                            ruleIndex: j
                        });
                    }
                }
            }
        } catch (e) {
            // CORS or access issues
            console.warn('[CSSTokenScanner] Cannot access stylesheet:', sheet.href);
        }
    }

    return findings;
}

/**
 * Extract color values from a CSS value string
 * @param {string} value - CSS property value
 * @returns {Array} Array of color strings found
 */
export function extractColors(value) {
    const colors = [];

    // Find hex colors
    const hexMatches = value.match(COLOR_PATTERNS.hex);
    if (hexMatches) colors.push(...hexMatches);

    // Find rgb/rgba colors
    const rgbMatches = value.match(COLOR_PATTERNS.rgb);
    if (rgbMatches) colors.push(...rgbMatches);

    // Find hsl/hsla colors
    const hslMatches = value.match(COLOR_PATTERNS.hsl);
    if (hslMatches) colors.push(...hslMatches);

    // Find named colors (be more selective to avoid false positives)
    const namedMatches = value.match(COLOR_PATTERNS.named);
    if (namedMatches) {
        // Filter out potential false positives
        const filtered = namedMatches.filter(color => {
            const lower = color.toLowerCase();
            // Skip if it's likely part of a class name or identifier
            return !value.includes(`.${lower}`) && !value.includes(`#${lower}`);
        });
        colors.push(...filtered);
    }

    return [...new Set(colors)]; // Remove duplicates
}

/**
 * Group hardcoded color findings by stylesheet
 * @param {Array} findings - Array of findings from scanHardcodedColors
 * @returns {Object} Findings grouped by stylesheet name
 */
export function groupByStylesheet(findings) {
    const grouped = {};

    for (const finding of findings) {
        if (!grouped[finding.stylesheet]) {
            grouped[finding.stylesheet] = [];
        }
        grouped[finding.stylesheet].push(finding);
    }

    return grouped;
}

/**
 * Scan for design token usage across stylesheets
 * @returns {Object} { tokenUsage: Map, unusedTokens: Map, definedTokens: Map }
 */
export function scanDesignTokenUsage() {
    const tokenUsage = new Map();
    const definedTokens = new Map();
    const sheets = document.styleSheets;

    // First pass: collect all defined tokens from :root
    for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        try {
            const cssRules = sheet.cssRules || sheet.rules;
            if (!cssRules) continue;

            for (const rule of cssRules) {
                if (rule.selectorText === ':root' && rule.style) {
                    for (let j = 0; j < rule.style.length; j++) {
                        const prop = rule.style[j];
                        if (prop.startsWith('--color-') || prop.startsWith('--spacing-') ||
                            prop.startsWith('--font-') || prop.startsWith('--radius-')) {
                            definedTokens.set(prop, rule.style.getPropertyValue(prop).trim());
                        }
                    }
                }
            }
        } catch (e) {
            // CORS issues
        }
    }

    // Second pass: find token usages
    for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const source = getStylesheetSource(sheet);

        try {
            const cssRules = sheet.cssRules || sheet.rules;
            if (!cssRules) continue;

            for (let j = 0; j < cssRules.length; j++) {
                const rule = cssRules[j];
                if (!rule.style) continue;

                const selector = rule.selectorText || '';

                // Skip variable definitions
                if (/^:root\b|^\[data-theme|^html\b|^\*\b/.test(selector)) {
                    continue;
                }

                // Check color properties for var() usage
                for (const prop of COLOR_PROPERTIES) {
                    const value = rule.style.getPropertyValue(prop);
                    if (!value || !value.includes('var(')) continue;

                    // Extract all var() references
                    const varMatches = value.matchAll(/var\(\s*(--[\w-]+)/g);
                    for (const match of varMatches) {
                        const tokenName = match[1];

                        if (!tokenUsage.has(tokenName)) {
                            tokenUsage.set(tokenName, []);
                        }
                        tokenUsage.get(tokenName).push({
                            stylesheet: source,
                            selector,
                            property: prop,
                            value
                        });
                    }
                }
            }
        } catch (e) {
            // CORS issues
        }
    }

    // Find unused tokens
    const unusedTokens = new Map();
    for (const [tokenName, tokenValue] of definedTokens) {
        if (!tokenUsage.has(tokenName)) {
            unusedTokens.set(tokenName, tokenValue);
        }
    }

    return {
        tokenUsage,
        unusedTokens,
        definedTokens
    };
}

/**
 * Get stylesheet source name
 * @param {CSSStyleSheet} sheet
 * @returns {string}
 */
function getStylesheetSource(sheet) {
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
            return `<style#${sheet.ownerNode.id}>`;
        }
        return '<style>';
    }
    return 'unknown';
}

/**
 * Generate a summary report of hardcoded colors
 * @param {Array} findings - Array of findings
 * @returns {Object} Summary statistics
 */
export function generateHardcodedColorsSummary(findings) {
    const byStylesheet = groupByStylesheet(findings);
    const uniqueColors = new Set();
    const byProperty = {};

    for (const finding of findings) {
        for (const color of finding.colors) {
            uniqueColors.add(color.toLowerCase());
        }

        if (!byProperty[finding.property]) {
            byProperty[finding.property] = 0;
        }
        byProperty[finding.property]++;
    }

    return {
        totalFindings: findings.length,
        stylesheetCount: Object.keys(byStylesheet).length,
        uniqueColors: uniqueColors.size,
        colorList: [...uniqueColors].sort(),
        byProperty,
        byStylesheet: Object.fromEntries(
            Object.entries(byStylesheet).map(([k, v]) => [k, v.length])
        )
    };
}

/**
 * Generate a summary report of token usage
 * @param {Object} scanResult - Result from scanDesignTokenUsage
 * @returns {Object} Summary statistics
 */
export function generateTokenUsageSummary(scanResult) {
    const { tokenUsage, unusedTokens, definedTokens } = scanResult;

    let totalUsages = 0;
    const usagesByStylesheet = {};

    for (const [token, usages] of tokenUsage) {
        totalUsages += usages.length;
        for (const usage of usages) {
            if (!usagesByStylesheet[usage.stylesheet]) {
                usagesByStylesheet[usage.stylesheet] = 0;
            }
            usagesByStylesheet[usage.stylesheet]++;
        }
    }

    return {
        definedCount: definedTokens.size,
        usedCount: tokenUsage.size,
        unusedCount: unusedTokens.size,
        totalUsages,
        usagesByStylesheet,
        unusedTokenList: [...unusedTokens.keys()].sort()
    };
}
