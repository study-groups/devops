/**
 * DevPagesDetector.js
 *
 * Utility for detecting DevPages-specific information from DOM elements:
 * - Design tokens (CSS custom properties)
 * - DevPages panels
 * - Z-index context
 * - Panel element identification
 *
 * Part of Phase 2: Inspector Utilities
 */

export class DevPagesDetector {
  constructor() {
    this.zIndexManager = window.APP?.services?.zIndexManager;
    this.panelRegistry = window.APP?.panels?.registry;
  }

  /**
   * Extract all design tokens (CSS custom properties) from an element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object} Design tokens organized by category
   */
  extractDesignTokens(element) {
    if (!element) return null;

    const computed = window.getComputedStyle(element);
    const tokens = {
      colors: {},
      spacing: {},
      typography: {},
      other: {}
    };

    // Get all CSS custom properties
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (prop.startsWith('--')) {
        const value = computed.getPropertyValue(prop).trim();
        this._categorizeToken(prop, value, tokens);
      }
    }

    return tokens;
  }

  /**
   * Categorize a CSS custom property into design token categories
   * @private
   */
  _categorizeToken(prop, value, tokens) {
    const lower = prop.toLowerCase();

    // Color tokens
    if (lower.includes('color') || lower.includes('bg') ||
        lower.includes('border') && value.match(/#|rgb|hsl/)) {
      tokens.colors[prop] = value;
    }
    // Spacing tokens
    else if (lower.includes('padding') || lower.includes('margin') ||
             lower.includes('gap') || lower.includes('space')) {
      tokens.spacing[prop] = value;
    }
    // Typography tokens
    else if (lower.includes('font') || lower.includes('text') ||
             lower.includes('line-height') || lower.includes('letter-spacing')) {
      tokens.typography[prop] = value;
    }
    // Everything else
    else {
      tokens.other[prop] = value;
    }
  }

  /**
   * Get all actively used design tokens on an element
   * (Only those actually applied, not inherited)
   * @param {HTMLElement} element
   * @returns {Object} Applied design tokens
   */
  getAppliedTokens(element) {
    if (!element) return null;

    const computed = window.getComputedStyle(element);
    const applied = {};

    // Check common properties that might use tokens
    const properties = [
      'color', 'background-color', 'border-color',
      'padding', 'margin', 'gap',
      'font-family', 'font-size', 'line-height'
    ];

    properties.forEach(prop => {
      const value = computed.getPropertyValue(prop);
      if (value && value.includes('var(--')) {
        applied[prop] = value;
      }
    });

    return applied;
  }

  /**
   * Detect if an element is a DevPages panel
   * @param {HTMLElement} element
   * @returns {Object|null} Panel info or null
   */
  detectPanel(element) {
    if (!element) return null;

    // Check if element has panel-related classes
    const classes = Array.from(element.classList || []);
    const isPanelElement = classes.some(cls =>
      cls.includes('panel') ||
      cls.includes('devpages') ||
      cls.includes('inspector')
    );

    if (!isPanelElement) return null;

    // Try to find panel ID
    const panelId = element.dataset?.panelId ||
                    element.id ||
                    this._inferPanelId(element);

    // Get panel from registry if available
    let panelInfo = null;
    if (this.panelRegistry && panelId) {
      try {
        panelInfo = this.panelRegistry.getPanel(panelId);
      } catch (e) {
        // Panel not registered
      }
    }

    return {
      element,
      panelId,
      isRegistered: !!panelInfo,
      panelInfo,
      classes: classes.filter(cls =>
        cls.includes('panel') ||
        cls.includes('devpages')
      ),
      bounds: element.getBoundingClientRect()
    };
  }

  /**
   * Infer panel ID from element structure
   * @private
   */
  _inferPanelId(element) {
    // Look for panel ID in parent hierarchy
    let current = element;
    while (current) {
      if (current.dataset?.panelId) {
        return current.dataset.panelId;
      }
      if (current.id && current.id.includes('panel')) {
        return current.id;
      }
      current = current.parentElement;
    }
    return null;
  }

  /**
   * Get z-index context for an element
   * @param {HTMLElement} element
   * @returns {Object|null} Z-index context
   */
  getZIndexContext(element) {
    if (!element || !this.zIndexManager) return null;

    try {
      const computed = window.getComputedStyle(element);
      const zIndex = computed.zIndex;

      // Get stacking context from ZIndexManager if available
      let stackingContext = null;
      if (this.zIndexManager.getStackingContext) {
        stackingContext = this.zIndexManager.getStackingContext(element);
      }

      return {
        zIndex: zIndex !== 'auto' ? parseInt(zIndex, 10) : 'auto',
        position: computed.position,
        createsStackingContext: this._createsStackingContext(element, computed),
        stackingContext,
        layer: this._getZIndexLayer(zIndex)
      };
    } catch (e) {
      console.error('Error getting z-index context:', e);
      return null;
    }
  }

  /**
   * Check if element creates a stacking context
   * @private
   */
  _createsStackingContext(element, computed) {
    const zIndex = computed.zIndex;
    const position = computed.position;
    const opacity = parseFloat(computed.opacity);
    const transform = computed.transform;
    const filter = computed.filter;

    return (
      // Positioned with z-index
      (position !== 'static' && zIndex !== 'auto') ||
      // Opacity less than 1
      opacity < 1 ||
      // Transform
      transform !== 'none' ||
      // Filter
      filter !== 'none' ||
      // Flex/grid items with z-index
      (element.parentElement &&
       ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(
         window.getComputedStyle(element.parentElement).display
       ) && zIndex !== 'auto')
    );
  }

  /**
   * Determine z-index layer based on value
   * @private
   */
  _getZIndexLayer(zIndex) {
    if (zIndex === 'auto' || zIndex < 0) return 'default';
    if (zIndex < 100) return 'base';
    if (zIndex < 1000) return 'elevated';
    if (zIndex < 10000) return 'overlay';
    return 'modal';
  }

  /**
   * Get all DevPages panels on the page
   * @returns {Array} Array of panel detection results
   */
  getAllPanels() {
    const panels = [];

    // Find all potential panel elements
    const candidates = document.querySelectorAll('[class*="panel"], [class*="devpages"], [id*="panel"]');

    candidates.forEach(element => {
      const panelInfo = this.detectPanel(element);
      if (panelInfo) {
        panels.push(panelInfo);
      }
    });

    return panels;
  }

  /**
   * Get comprehensive element info (all detection methods)
   * @param {HTMLElement} element
   * @returns {Object} Complete element information
   */
  getElementInfo(element) {
    if (!element) return null;

    return {
      element,
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      classes: Array.from(element.classList || []),
      designTokens: this.extractDesignTokens(element),
      appliedTokens: this.getAppliedTokens(element),
      panel: this.detectPanel(element),
      zIndex: this.getZIndexContext(element),
      bounds: element.getBoundingClientRect(),
      path: this.getElementPath(element)
    };
  }

  /**
   * Get CSS selector path to element
   * @param {HTMLElement} element
   * @returns {String} CSS selector path
   */
  getElementPath(element) {
    if (!element) return '';

    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // ID is unique, stop here
      } else {
        // Add nth-child if needed for uniqueness
        const siblings = Array.from(current.parentNode?.children || []);
        const sameTagSiblings = siblings.filter(s => s.tagName === current.tagName);

        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current);
          selector += `:nth-of-type(${index + 1})`;
        }

        // Add classes if present
        if (current.classList.length > 0) {
          selector += '.' + Array.from(current.classList).join('.');
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * Find element by path (reverse of getElementPath)
   * @param {String} path - CSS selector path
   * @returns {HTMLElement|null}
   */
  findElementByPath(path) {
    try {
      return document.querySelector(path);
    } catch (e) {
      console.error('Invalid path:', path, e);
      return null;
    }
  }

  /**
   * Get statistics about DevPages usage on current page
   * @returns {Object} Usage statistics
   */
  getPageStatistics() {
    const allElements = document.querySelectorAll('*');
    const elementsWithTokens = [];
    const panels = this.getAllPanels();

    allElements.forEach(element => {
      const tokens = this.extractDesignTokens(element);
      const hasTokens = Object.values(tokens).some(category =>
        Object.keys(category).length > 0
      );

      if (hasTokens) {
        elementsWithTokens.push(element);
      }
    });

    return {
      totalElements: allElements.length,
      elementsWithTokens: elementsWithTokens.length,
      panels: panels.length,
      registeredPanels: panels.filter(p => p.isRegistered).length,
      tokenUsagePercentage: ((elementsWithTokens.length / allElements.length) * 100).toFixed(2)
    };
  }
}

// Create singleton instance
const devPagesDetector = new DevPagesDetector();

export default devPagesDetector;
