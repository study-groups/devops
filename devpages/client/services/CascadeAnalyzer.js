/**
 * CascadeAnalyzer.js
 *
 * Analyzes CSS cascade and specificity to determine which rules win.
 * Helps understand why certain styles are applied to elements.
 *
 * Features:
 * - Calculate CSS selector specificity
 * - Determine cascade winners
 * - Analyze rule sources (inline, stylesheet, inherited)
 * - Track !important declarations
 * - Integration with CSSSourceParser
 * - Self-registering to window.APP.services
 *
 * Specificity calculation follows CSS spec:
 *   - Inline styles: 1,0,0,0
 *   - IDs: 0,1,0,0
 *   - Classes/attributes/pseudo-classes: 0,0,1,0
 *   - Elements/pseudo-elements: 0,0,0,1
 */

export class CascadeAnalyzer {
  constructor() {
    this.cache = new Map(); // Cache specificity calculations
    console.log('[CascadeAnalyzer] Service created');
  }

  /**
   * Analyze CSS cascade for an element and property
   * @param {HTMLElement} element - Element to analyze
   * @param {string} property - CSS property name (e.g., 'color')
   * @returns {Object} Cascade analysis result
   */
  analyze(element, property) {
    if (!element || !property) {
      return { error: 'Invalid element or property' };
    }

    try {
      const computed = window.getComputedStyle(element);
      const computedValue = computed.getPropertyValue(property);

      // Get all matching rules for this element
      const matchingRules = this.getMatchingRules(element);

      // Filter rules that affect this property
      const relevantRules = matchingRules.filter(rule =>
        this.ruleAffectsProperty(rule, property)
      );

      // Sort by specificity and source order
      const sortedRules = this.sortByCascade(relevantRules);

      // Find winner
      const winner = sortedRules[sortedRules.length - 1]; // Last rule wins

      return {
        property: property,
        computedValue: computedValue,
        winner: winner,
        allRules: sortedRules,
        totalRules: relevantRules.length,
        hasImportant: relevantRules.some(r => r.important)
      };

    } catch (error) {
      console.error('[CascadeAnalyzer] Analysis failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Get all CSS rules that match an element
   * @param {HTMLElement} element - Element to check
   * @returns {Array<Object>} Matching rules
   */
  getMatchingRules(element) {
    const matchingRules = [];

    // Get inline styles first (highest specificity)
    const inlineStyles = this.getInlineStyles(element);
    if (inlineStyles.length > 0) {
      matchingRules.push(...inlineStyles);
    }

    // Get stylesheet rules
    for (const sheet of document.styleSheets) {
      try {
        const rules = this.getMatchingRulesFromSheet(sheet, element);
        matchingRules.push(...rules);
      } catch (error) {
        // CORS or access error - skip
        console.warn('[CascadeAnalyzer] Cannot access stylesheet:', sheet.href);
      }
    }

    return matchingRules;
  }

  /**
   * Get inline styles as rule objects
   * @param {HTMLElement} element
   * @returns {Array<Object>} Inline style rules
   */
  getInlineStyles(element) {
    const inlineRules = [];
    const style = element.style;

    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      const value = style.getPropertyValue(prop);
      const priority = style.getPropertyPriority(prop);

      inlineRules.push({
        selector: '[inline]',
        property: prop,
        value: value,
        important: priority === 'important',
        specificity: { inline: 1, ids: 0, classes: 0, elements: 0, total: 1000 },
        source: 'inline',
        sourceFile: null
      });
    }

    return inlineRules;
  }

  /**
   * Get matching rules from a stylesheet
   * @param {CSSStyleSheet} sheet - Stylesheet to check
   * @param {HTMLElement} element - Element to match
   * @returns {Array<Object>} Matching rules
   */
  getMatchingRulesFromSheet(sheet, element) {
    const rules = [];

    if (!sheet.cssRules) return rules;

    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule) {
        try {
          if (element.matches(rule.selectorText)) {
            const ruleObj = this.parseStyleRule(rule);
            ruleObj.sourceFile = sheet.href || 'embedded';
            rules.push(ruleObj);
          }
        } catch (error) {
          // Invalid selector or matching error - skip
          continue;
        }
      } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
        // Recursively check media/supports rules
        const nestedRules = this.getMatchingRulesFromSheet(rule, element);
        rules.push(...nestedRules);
      }
    }

    return rules;
  }

  /**
   * Parse a CSSStyleRule into our rule format
   * @param {CSSStyleRule} rule - CSS rule to parse
   * @returns {Object} Parsed rule
   */
  parseStyleRule(rule) {
    const specificity = this.calculateSpecificity(rule.selectorText);
    const properties = [];

    for (let i = 0; i < rule.style.length; i++) {
      const prop = rule.style[i];
      properties.push({
        property: prop,
        value: rule.style.getPropertyValue(prop),
        important: rule.style.getPropertyPriority(prop) === 'important'
      });
    }

    return {
      selector: rule.selectorText,
      specificity: specificity,
      properties: properties,
      source: 'stylesheet',
      cssText: rule.cssText
    };
  }

  /**
   * Calculate CSS selector specificity
   * @param {string} selector - CSS selector
   * @returns {Object} Specificity breakdown
   */
  calculateSpecificity(selector) {
    // Check cache first
    if (this.cache.has(selector)) {
      return this.cache.get(selector);
    }

    // Specificity counters: [inline, ids, classes, elements]
    const spec = {
      inline: 0,
      ids: 0,
      classes: 0,
      elements: 0,
      total: 0
    };

    // Remove pseudo-elements for counting
    let cleaned = selector.replace(/::(before|after|first-line|first-letter)/g, ' ');

    // Count IDs
    const idMatches = cleaned.match(/#[\w-]+/g);
    spec.ids = idMatches ? idMatches.length : 0;

    // Count classes, attributes, and pseudo-classes
    const classMatches = cleaned.match(/\.[\w-]+/g);
    const attrMatches = cleaned.match(/\[[^\]]+\]/g);
    const pseudoMatches = cleaned.match(/:(?!not)[\w-]+/g);

    spec.classes =
      (classMatches ? classMatches.length : 0) +
      (attrMatches ? attrMatches.length : 0) +
      (pseudoMatches ? pseudoMatches.length : 0);

    // Count elements (tag names)
    // Remove everything we've already counted
    let elementsOnly = cleaned
      .replace(/#[\w-]+/g, ' ')
      .replace(/\.[\w-]+/g, ' ')
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/:[\w-]+/g, ' ')
      .replace(/[>+~,]/g, ' ');

    const elementMatches = elementsOnly.match(/\b[a-z][\w-]*/g);
    spec.elements = elementMatches ? elementMatches.length : 0;

    // Calculate total (CSS specificity is compared left-to-right, but for sorting we use a number)
    spec.total = spec.inline * 1000 + spec.ids * 100 + spec.classes * 10 + spec.elements;

    // Cache the result
    this.cache.set(selector, spec);

    return spec;
  }

  /**
   * Check if a rule affects a specific property
   * @param {Object} rule - Rule object
   * @param {string} property - Property name
   * @returns {boolean} Whether rule affects property
   */
  ruleAffectsProperty(rule, property) {
    if (rule.source === 'inline') {
      return rule.property === property;
    }

    if (rule.properties) {
      return rule.properties.some(p => p.property === property);
    }

    return false;
  }

  /**
   * Sort rules by cascade order (lowest to highest priority)
   * @param {Array<Object>} rules - Rules to sort
   * @returns {Array<Object>} Sorted rules
   */
  sortByCascade(rules) {
    return rules.sort((a, b) => {
      // !important takes precedence
      const aImportant = a.important || (a.properties && a.properties.some(p => p.important));
      const bImportant = b.important || (b.properties && b.properties.some(p => p.important));

      if (aImportant && !bImportant) return 1;
      if (!aImportant && bImportant) return -1;

      // Then by specificity
      const specA = a.specificity;
      const specB = b.specificity;

      if (specA.inline !== specB.inline) return specA.inline - specB.inline;
      if (specA.ids !== specB.ids) return specA.ids - specB.ids;
      if (specA.classes !== specB.classes) return specA.classes - specB.classes;
      if (specA.elements !== specB.elements) return specA.elements - specB.elements;

      // Source order (we can't determine this precisely without more info, so leave equal)
      return 0;
    });
  }

  /**
   * Get cascade analysis for multiple properties
   * @param {HTMLElement} element - Element to analyze
   * @param {Array<string>} properties - Property names
   * @returns {Array<Object>} Analysis results for each property
   */
  analyzeMultiple(element, properties) {
    return properties.map(prop => this.analyze(element, prop));
  }

  /**
   * Get cascade summary for all computed styles
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} Summary of all styles
   */
  analyzeFull(element) {
    if (!element) return { error: 'Invalid element' };

    const computed = window.getComputedStyle(element);
    const summary = {
      element: element,
      tagName: element.tagName.toLowerCase(),
      totalProperties: computed.length,
      bySource: {
        inline: 0,
        stylesheet: 0,
        inherited: 0
      },
      important: 0,
      properties: []
    };

    // Analyze top properties of interest
    const importantProps = [
      'display', 'position', 'width', 'height',
      'color', 'background-color', 'border',
      'padding', 'margin', 'font-size', 'z-index'
    ];

    for (const prop of importantProps) {
      const analysis = this.analyze(element, prop);
      if (analysis.winner) {
        summary.properties.push(analysis);

        if (analysis.winner.source === 'inline') {
          summary.bySource.inline++;
        } else {
          summary.bySource.stylesheet++;
        }

        if (analysis.hasImportant) {
          summary.important++;
        }
      }
    }

    return summary;
  }

  /**
   * Compare specificity of two selectors
   * @param {string} selectorA - First selector
   * @param {string} selectorB - Second selector
   * @returns {number} -1 if A < B, 0 if equal, 1 if A > B
   */
  compareSpecificity(selectorA, selectorB) {
    const specA = this.calculateSpecificity(selectorA);
    const specB = this.calculateSpecificity(selectorB);

    if (specA.inline !== specB.inline) return specA.inline - specB.inline;
    if (specA.ids !== specB.ids) return specA.ids - specB.ids;
    if (specA.classes !== specB.classes) return specA.classes - specB.classes;
    if (specA.elements !== specB.elements) return specA.elements - specB.elements;

    return 0;
  }

  /**
   * Format specificity for display
   * @param {Object} specificity - Specificity object
   * @returns {string} Formatted string (e.g., "0,1,2,3")
   */
  formatSpecificity(specificity) {
    return `${specificity.inline},${specificity.ids},${specificity.classes},${specificity.elements}`;
  }

  /**
   * Get statistics about cached specificity calculations
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      cachedSelectors: this.cache.size
    };
  }

  /**
   * Clear specificity cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[CascadeAnalyzer] Cache cleared');
  }
}

// =============================================================================
// SELF-REGISTRATION (IIFE-style)
// =============================================================================

// Create singleton instance
const cascadeAnalyzer = new CascadeAnalyzer();

// Self-register into window.APP.services
if (!window.APP) window.APP = {};
if (!window.APP.services) window.APP.services = {};
window.APP.services.cascadeAnalyzer = cascadeAnalyzer;

console.log('[CascadeAnalyzer] Service registered to window.APP.services.cascadeAnalyzer');

// Export singleton instance as default
export default cascadeAnalyzer;
