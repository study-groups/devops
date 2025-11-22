/**
 * CSSSourceParser.js
 *
 * Parses CSS bundle source comments to build a source map.
 * Maps CSS rules and selectors back to their original source files.
 *
 * Bundle format:
 *   /* client/styles/reset.css *\/
 *   [CSS content]
 *   /* client/styles/design-system.css *\/
 *   [CSS content]
 *
 * Features:
 * - Lazy loading of CSS bundles
 * - Source map cache
 * - Selector → file mapping
 * - Element → CSS sources lookup
 * - Self-registering to window.APP.services
 */

export class CSSSourceParser {
  constructor() {
    this.bundles = ['core', 'layout', 'features', 'panels'];
    this.sourceMap = null;      // Full parsed source map
    this.selectorIndex = null;  // Fast selector lookup
    this.loading = false;
    this.loaded = false;

    console.log('[CSSSourceParser] Service created (not loaded)');
  }

  /**
   * Load and parse all CSS bundles
   * @returns {Promise<Object>} Source map
   */
  async load() {
    if (this.loading) {
      console.log('[CSSSourceParser] Already loading...');
      return this.waitForLoad();
    }

    if (this.loaded) {
      console.log('[CSSSourceParser] Already loaded');
      return this.sourceMap;
    }

    this.loading = true;
    console.log('[CSSSourceParser] Loading CSS bundles...');

    try {
      const sourceMap = {
        bundles: {},
        files: {},
        selectors: {}
      };

      // Load each bundle
      for (const bundleName of this.bundles) {
        const bundleData = await this.loadBundle(bundleName);
        sourceMap.bundles[bundleName] = bundleData;

        // Index by file
        for (const file of bundleData.files) {
          sourceMap.files[file.path] = file;

          // Index selectors for fast lookup
          for (const selector of file.selectors) {
            if (!sourceMap.selectors[selector]) {
              sourceMap.selectors[selector] = [];
            }
            sourceMap.selectors[selector].push({
              file: file.path,
              bundle: bundleName
            });
          }
        }
      }

      this.sourceMap = sourceMap;
      this.selectorIndex = sourceMap.selectors;
      this.loaded = true;
      this.loading = false;

      console.log(`[CSSSourceParser] Loaded ${Object.keys(sourceMap.files).length} CSS files`);
      return sourceMap;

    } catch (error) {
      console.error('[CSSSourceParser] Failed to load bundles:', error);
      this.loading = false;
      throw error;
    }
  }

  /**
   * Load a single CSS bundle
   * @param {string} bundleName - Bundle name (core, layout, features, panels)
   * @returns {Promise<Object>} Parsed bundle data
   */
  async loadBundle(bundleName) {
    const url = `/css/bundles/${bundleName}.bundle.css`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }

      const css = await response.text();
      const parsed = this.parseBundle(css);

      console.log(`[CSSSourceParser] Loaded bundle '${bundleName}': ${parsed.files.length} files`);
      return parsed;

    } catch (error) {
      console.error(`[CSSSourceParser] Failed to load bundle '${bundleName}':`, error);
      return { files: [] };
    }
  }

  /**
   * Parse CSS bundle into source-mapped sections
   * @param {string} css - Bundle CSS content
   * @returns {Object} Parsed data with files and selectors
   */
  parseBundle(css) {
    const files = [];
    const sourceCommentRegex = /\/\*\s*(.+?\.css)\s*\*\//g;

    let currentFile = null;
    let currentContent = '';
    let lastIndex = 0;

    // Find all source comments
    let match;
    while ((match = sourceCommentRegex.exec(css)) !== null) {
      const filePath = match[1];
      const commentIndex = match.index;

      // Save previous file's content
      if (currentFile) {
        const content = css.substring(lastIndex, commentIndex).trim();
        if (content) {
          files.push({
            path: currentFile,
            content: content,
            selectors: this.extractSelectors(content),
            size: content.length
          });
        }
      }

      // Start new file
      currentFile = filePath;
      lastIndex = commentIndex + match[0].length;
    }

    // Save last file
    if (currentFile) {
      const content = css.substring(lastIndex).trim();
      if (content) {
        files.push({
          path: currentFile,
          content: content,
          selectors: this.extractSelectors(content),
          size: content.length
        });
      }
    }

    return { files };
  }

  /**
   * Extract selectors from CSS content
   * @param {string} css - CSS content
   * @returns {Array<string>} List of selectors
   */
  extractSelectors(css) {
    const selectors = [];

    // Very basic selector extraction - matches anything before {
    // This is a simplified parser; production code might use a real CSS parser
    const selectorRegex = /([^{}]+)\s*\{/g;

    let match;
    while ((match = selectorRegex.exec(css)) !== null) {
      const selectorText = match[1].trim();

      // Skip @ rules (media queries, keyframes, etc.)
      if (selectorText.startsWith('@')) continue;

      // Split by comma for multi-selectors
      const parts = selectorText.split(',').map(s => s.trim());
      selectors.push(...parts);
    }

    return selectors;
  }

  /**
   * Get CSS sources for a specific element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} CSS source info
   */
  getSourcesForElement(element) {
    if (!element) return { files: [], rules: [], inferred: true };

    // Ensure CSS is loaded
    if (!this.loaded) {
      // Return placeholder and trigger async load
      this.load().catch(err => console.error('[CSSSourceParser] Async load failed:', err));
      return { files: [], rules: [], loading: true };
    }

    try {
      const matchedRules = this.getMatchingRules(element);
      const files = this.extractFilesFromRules(matchedRules);

      return {
        files: files,
        rules: matchedRules,
        loading: false,
        inferred: false
      };

    } catch (error) {
      console.error('[CSSSourceParser] Failed to get sources for element:', error);
      return { files: [], rules: [], error: error.message };
    }
  }

  /**
   * Get all CSS rules that match an element
   * @param {HTMLElement} element - Element to check
   * @returns {Array<Object>} Matching rules with metadata
   */
  getMatchingRules(element) {
    const matchedRules = [];

    if (!this.selectorIndex) return matchedRules;

    // Get all selectors that match this element
    for (const [selector, sources] of Object.entries(this.selectorIndex)) {
      try {
        if (element.matches(selector)) {
          matchedRules.push({
            selector: selector,
            sources: sources,
            specificity: this.calculateSpecificity(selector)
          });
        }
      } catch (error) {
        // Invalid selector, skip
        continue;
      }
    }

    // Sort by specificity (highest first)
    matchedRules.sort((a, b) => {
      const specA = a.specificity;
      const specB = b.specificity;

      if (specA.inline !== specB.inline) return specB.inline - specA.inline;
      if (specA.ids !== specB.ids) return specB.ids - specA.ids;
      if (specA.classes !== specB.classes) return specB.classes - specA.classes;
      if (specA.elements !== specB.elements) return specB.elements - specA.elements;

      return 0;
    });

    return matchedRules;
  }

  /**
   * Calculate CSS selector specificity
   * @param {string} selector - CSS selector
   * @returns {Object} Specificity breakdown
   */
  calculateSpecificity(selector) {
    // Simplified specificity calculation
    // Real implementation would be more sophisticated
    return {
      inline: 0,
      ids: (selector.match(/#/g) || []).length,
      classes: (selector.match(/\./g) || []).length + (selector.match(/\[/g) || []).length,
      elements: (selector.match(/\w+/g) || []).length,
      total: (selector.match(/#/g) || []).length * 100 +
             ((selector.match(/\./g) || []).length + (selector.match(/\[/g) || []).length) * 10 +
             (selector.match(/\w+/g) || []).length
    };
  }

  /**
   * Extract unique file list from matched rules
   * @param {Array<Object>} rules - Matched rules
   * @returns {Array<string>} Unique file paths
   */
  extractFilesFromRules(rules) {
    const fileSet = new Set();

    for (const rule of rules) {
      for (const source of rule.sources) {
        fileSet.add(source.file);
      }
    }

    return Array.from(fileSet);
  }

  /**
   * Wait for loading to complete
   * @returns {Promise<Object>} Source map
   */
  async waitForLoad() {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.loading) {
          clearInterval(checkInterval);
          if (this.loaded) {
            resolve(this.sourceMap);
          } else {
            reject(new Error('CSS source map failed to load'));
          }
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('CSS source map load timeout'));
      }, 10000);
    });
  }

  /**
   * Get statistics about loaded CSS
   * @returns {Object} Statistics
   */
  getStats() {
    if (!this.loaded) {
      return { loaded: false, loading: this.loading };
    }

    return {
      loaded: true,
      loading: false,
      bundles: this.bundles.length,
      files: Object.keys(this.sourceMap.files).length,
      selectors: Object.keys(this.selectorIndex).length,
      totalSize: Object.values(this.sourceMap.files)
        .reduce((sum, file) => sum + file.size, 0)
    };
  }

  /**
   * Get detailed bundle information
   * @returns {Object|null} Bundle info or null if not loaded
   */
  getBundleInfo() {
    if (!this.loaded) return null;
    return this.sourceMap.bundles;
  }

  /**
   * Search for files by pattern
   * @param {string} pattern - Search pattern (substring or regex)
   * @returns {Array<string>} Matching file paths
   */
  searchFiles(pattern) {
    if (!this.loaded) return [];

    const regex = new RegExp(pattern, 'i');
    return Object.keys(this.sourceMap.files).filter(path => regex.test(path));
  }

  /**
   * Get file content by path
   * @param {string} filePath - File path
   * @returns {Object|null} File data or null
   */
  getFile(filePath) {
    if (!this.loaded) return null;
    return this.sourceMap.files[filePath] || null;
  }
}

// =============================================================================
// SELF-REGISTRATION (IIFE-style)
// =============================================================================

// Create singleton instance
const cssSourceParser = new CSSSourceParser();

// Self-register into window.APP.services
if (!window.APP) window.APP = {};
if (!window.APP.services) window.APP.services = {};
window.APP.services.cssSourceParser = cssSourceParser;

console.log('[CSSSourceParser] Service registered to window.APP.services.cssSourceParser');

// Export singleton instance as default
export default cssSourceParser;
