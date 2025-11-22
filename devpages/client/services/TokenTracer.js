/**
 * TokenTracer.js
 *
 * Traces CSS custom properties (design tokens) back to their source definitions.
 * Maps CSS variables like --color-primary-default to their token files.
 *
 * Features:
 * - Trace CSS variables to source files
 * - Resolve var() references and chains
 * - Map semantic tokens to palette values
 * - Integration with DevPagesDetector
 * - Self-registering to window.APP.services
 *
 * Token File Structure:
 *   client/styles/tokens/color-palettes.js   - Raw color values
 *   client/styles/tokens/color-themes.js     - Theme definitions
 *   client/styles/tokens/color-tokens.js     - Semantic mappings
 */

export class TokenTracer {
  constructor() {
    this.tokenDefinitions = new Map(); // --var-name → definition metadata
    this.loaded = false;
    this.loading = false;

    // Known token file locations
    this.tokenFiles = {
      'color-palettes': 'client/styles/tokens/color-palettes.js',
      'color-themes': 'client/styles/tokens/color-themes.js',
      'color-tokens': 'client/styles/tokens/color-tokens.js'
    };

    console.log('[TokenTracer] Service created (not loaded)');
  }

  /**
   * Load token definitions
   * In production, this could parse the actual token files or fetch metadata
   * For now, we'll analyze live CSS custom properties
   */
  async load() {
    if (this.loading) {
      console.log('[TokenTracer] Already loading...');
      return this.waitForLoad();
    }

    if (this.loaded) {
      console.log('[TokenTracer] Already loaded');
      return this.tokenDefinitions;
    }

    this.loading = true;
    console.log('[TokenTracer] Loading token definitions...');

    try {
      // Extract all CSS custom properties from document
      this.scanCustomProperties();

      // Try to load token metadata if available
      await this.loadTokenMetadata();

      this.loaded = true;
      this.loading = false;

      console.log(`[TokenTracer] Loaded ${this.tokenDefinitions.size} token definitions`);
      return this.tokenDefinitions;

    } catch (error) {
      console.error('[TokenTracer] Failed to load tokens:', error);
      this.loading = false;
      throw error;
    }
  }

  /**
   * Scan document for all CSS custom properties
   */
  scanCustomProperties() {
    const customProps = new Map();

    // Get all stylesheets
    for (const sheet of document.styleSheets) {
      try {
        this.scanStyleSheet(sheet, customProps);
      } catch (error) {
        // CORS error or other access issue - skip this sheet
        console.warn('[TokenTracer] Cannot access stylesheet:', sheet.href, error.message);
      }
    }

    // Get root element computed styles
    const rootStyles = getComputedStyle(document.documentElement);
    for (let i = 0; i < rootStyles.length; i++) {
      const prop = rootStyles[i];
      if (prop.startsWith('--')) {
        const value = rootStyles.getPropertyValue(prop).trim();
        if (!customProps.has(prop)) {
          customProps.set(prop, {
            name: prop,
            value: value,
            source: ':root',
            type: this.inferTokenType(prop)
          });
        }
      }
    }

    this.tokenDefinitions = customProps;
  }

  /**
   * Scan a stylesheet for custom property definitions
   * @param {CSSStyleSheet} sheet - Stylesheet to scan
   * @param {Map} customProps - Map to populate with found properties
   */
  scanStyleSheet(sheet, customProps) {
    if (!sheet.cssRules) return;

    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule) {
        this.scanStyleRule(rule, customProps);
      } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
        this.scanStyleSheet(rule, customProps);
      }
    }
  }

  /**
   * Scan a style rule for custom properties
   * @param {CSSStyleRule} rule - Style rule to scan
   * @param {Map} customProps - Map to populate with found properties
   */
  scanStyleRule(rule, customProps) {
    const style = rule.style;

    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith('--')) {
        const value = style.getPropertyValue(prop).trim();

        if (!customProps.has(prop)) {
          customProps.set(prop, {
            name: prop,
            value: value,
            selector: rule.selectorText,
            source: this.inferSource(prop, rule.selectorText),
            type: this.inferTokenType(prop),
            references: this.extractVarReferences(value)
          });
        }
      }
    }
  }

  /**
   * Infer source file from property name and selector
   * @param {string} propName - Property name (e.g., --color-primary-default)
   * @param {string} selector - CSS selector
   * @returns {string} Inferred source file
   */
  inferSource(propName, selector) {
    if (selector.includes('[data-theme=')) {
      return this.tokenFiles['color-themes'];
    }

    if (propName.startsWith('--color-')) {
      return this.tokenFiles['color-palettes'];
    }

    if (propName.includes('-palette-') || propName.includes('-scale-')) {
      return this.tokenFiles['color-palettes'];
    }

    return 'client/styles/design-system.css'; // Generic fallback
  }

  /**
   * Infer token type from property name
   * @param {string} propName - Property name
   * @returns {string} Token type
   */
  inferTokenType(propName) {
    const lower = propName.toLowerCase();

    if (lower.includes('color') || lower.includes('bg') || lower.includes('fg')) {
      return 'color';
    }
    if (lower.includes('spacing') || lower.includes('gap') || lower.includes('padding') || lower.includes('margin')) {
      return 'spacing';
    }
    if (lower.includes('font') || lower.includes('text') || lower.includes('line-height')) {
      return 'typography';
    }
    if (lower.includes('z-index')) {
      return 'z-index';
    }
    if (lower.includes('border') || lower.includes('radius')) {
      return 'border';
    }
    if (lower.includes('shadow')) {
      return 'shadow';
    }

    return 'other';
  }

  /**
   * Extract var() references from a CSS value
   * @param {string} value - CSS value
   * @returns {Array<string>} Referenced variable names
   */
  extractVarReferences(value) {
    const references = [];
    const varRegex = /var\((--[a-zA-Z0-9-]+)/g;

    let match;
    while ((match = varRegex.exec(value)) !== null) {
      references.push(match[1]);
    }

    return references;
  }

  /**
   * Load token metadata from token files (if available)
   * This would require importing the JS token files or fetching them
   */
  async loadTokenMetadata() {
    // In a full implementation, we'd import the token files:
    // import { ColorPalettes } from '../styles/tokens/color-palettes.js';
    // import { ColorThemes } from '../styles/tokens/color-themes.js';
    // import { ColorTokens } from '../styles/tokens/color-tokens.js';

    // For now, we rely on the CSS scan above
    console.log('[TokenTracer] Token metadata loading skipped (using CSS scan)');
  }

  /**
   * Trace a CSS variable to its definition
   * @param {string} varName - Variable name (with or without --)
   * @returns {Object|null} Token definition
   */
  trace(varName) {
    // Ensure loading
    if (!this.loaded) {
      this.load().catch(err => console.error('[TokenTracer] Async load failed:', err));
      return { loading: true };
    }

    // Normalize variable name
    const normalized = varName.startsWith('--') ? varName : `--${varName}`;

    const definition = this.tokenDefinitions.get(normalized);
    if (!definition) {
      return null;
    }

    // Resolve references if they exist
    const resolved = this.resolveReferences(definition);

    return {
      ...definition,
      resolved: resolved
    };
  }

  /**
   * Resolve var() references in a token definition
   * @param {Object} definition - Token definition
   * @param {Set} [visited] - Visited tokens (for cycle detection)
   * @returns {Object} Resolved value chain
   */
  resolveReferences(definition, visited = new Set()) {
    if (!definition.references || definition.references.length === 0) {
      return { value: definition.value, chain: [] };
    }

    // Prevent infinite loops
    if (visited.has(definition.name)) {
      return { value: definition.value, chain: [], cycle: true };
    }

    visited.add(definition.name);

    const chain = [];
    let currentValue = definition.value;

    for (const refName of definition.references) {
      const refDef = this.tokenDefinitions.get(refName);
      if (refDef) {
        chain.push({
          name: refName,
          value: refDef.value,
          source: refDef.source
        });

        // Recursively resolve
        const subResolved = this.resolveReferences(refDef, visited);
        if (subResolved.chain) {
          chain.push(...subResolved.chain);
        }
        currentValue = subResolved.value || refDef.value;
      }
    }

    return { value: currentValue, chain: chain };
  }

  /**
   * Get all tokens used by an element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} Tokens used by element
   */
  getTokensForElement(element) {
    if (!element) return { tokens: [], loading: false };

    // Ensure loading
    if (!this.loaded) {
      this.load().catch(err => console.error('[TokenTracer] Async load failed:', err));
      return { tokens: [], loading: true };
    }

    const tokens = [];
    const computed = getComputedStyle(element);

    // Common properties that might use tokens
    const properties = [
      'color', 'background-color', 'border-color',
      'padding', 'margin', 'gap',
      'font-family', 'font-size', 'line-height',
      'border-radius', 'box-shadow', 'z-index'
    ];

    for (const prop of properties) {
      const value = computed.getPropertyValue(prop);
      if (value && value.includes('var(--')) {
        const varNames = this.extractVarReferences(value);
        for (const varName of varNames) {
          const traced = this.trace(varName);
          if (traced && !traced.loading) {
            tokens.push({
              property: prop,
              variable: varName,
              ...traced
            });
          }
        }
      }
    }

    return { tokens: tokens, loading: false };
  }

  /**
   * Search tokens by pattern
   * @param {string} pattern - Search pattern (substring or regex)
   * @returns {Array<Object>} Matching tokens
   */
  searchTokens(pattern) {
    if (!this.loaded) return [];

    const regex = new RegExp(pattern, 'i');
    const results = [];

    for (const [name, def] of this.tokenDefinitions) {
      if (regex.test(name) || regex.test(def.value)) {
        results.push({ name, ...def });
      }
    }

    return results;
  }

  /**
   * Get tokens by type
   * @param {string} type - Token type (color, spacing, typography, etc.)
   * @returns {Array<Object>} Tokens of specified type
   */
  getTokensByType(type) {
    if (!this.loaded) return [];

    const results = [];

    for (const [name, def] of this.tokenDefinitions) {
      if (def.type === type) {
        results.push({ name, ...def });
      }
    }

    return results;
  }

  /**
   * Get statistics about loaded tokens
   * @returns {Object} Statistics
   */
  getStats() {
    if (!this.loaded) {
      return { loaded: false, loading: this.loading };
    }

    const stats = {
      loaded: true,
      loading: false,
      total: this.tokenDefinitions.size,
      byType: {}
    };

    for (const def of this.tokenDefinitions.values()) {
      const type = def.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Wait for loading to complete
   * @returns {Promise<Map>} Token definitions
   */
  async waitForLoad() {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.loading) {
          clearInterval(checkInterval);
          if (this.loaded) {
            resolve(this.tokenDefinitions);
          } else {
            reject(new Error('Token tracer failed to load'));
          }
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Token tracer load timeout'));
      }, 5000);
    });
  }
}

// =============================================================================
// SELF-REGISTRATION (IIFE-style)
// =============================================================================

// Create singleton instance
const tokenTracer = new TokenTracer();

// Self-register into window.APP.services
if (!window.APP) window.APP = {};
if (!window.APP.services) window.APP.services = {};
window.APP.services.tokenTracer = tokenTracer;

console.log('[TokenTracer] Service registered to window.APP.services.tokenTracer');

// Export singleton instance as default
export default tokenTracer;
