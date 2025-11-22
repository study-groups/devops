/**
 * SourceTrackerService.js
 *
 * Round-trip source code identification system for DevPages debugging.
 * Tracks DOM elements back to their source code origins (JS/CSS/HTML).
 *
 * Features:
 * - Lightweight element instrumentation with data-source-id
 * - Configurable depth (off/light/medium/deep)
 * - CSS source tracking (files, specificity, tokens)
 * - Lazy initialization (zero overhead when disabled)
 * - Self-registering to window.APP.services
 *
 * Usage:
 *   const { sourceTracker } = window.APP.services;
 *   sourceTracker.register(element, { componentName, filePath, ... });
 *   const info = sourceTracker.getSourceInfo(element);
 */

export class SourceTrackerService {
  constructor() {
    this.registry = new Map(); // source-id → metadata
    this.cssSourceMap = null;  // Lazy-loaded CSS source map
    this.depth = 'off';        // off | light | medium | deep
    this.initialized = false;
    this.nextId = 1;

    // Depth-specific instrumentation rules
    this.depthRules = {
      off: { enabled: false, selector: null },
      light: { enabled: true, selector: '.devpages-panel, [data-panel-type], .panel-container' },
      medium: { enabled: true, selector: 'button, input, select, textarea, a, .devpages-panel, [data-panel-type]' },
      deep: { enabled: true, selector: '*' } // All elements
    };

    console.log('[SourceTracker] Service created (not initialized)');
  }

  /**
   * Initialize the source tracker
   * Only called when first used (lazy init)
   */
  init() {
    if (this.initialized) {
      console.log('[SourceTracker] Already initialized');
      return this;
    }

    console.log('[SourceTracker] Initializing...');

    // Load saved settings from Redux or localStorage
    this.loadSettings();

    // Don't auto-initialize heavy features - wait for user to enable
    // this.loadCSSSourceMap(); // Deferred until needed
    // this.registerShiftClickHandler(); // Deferred until enabled

    this.initialized = true;
    console.log(`[SourceTracker] Initialized (depth: ${this.depth})`);

    return this;
  }

  /**
   * Load settings from Redux store or localStorage
   */
  loadSettings() {
    try {
      // Try Redux first
      const store = window.APP?.services?.store;
      if (store) {
        const state = store.getState();
        const depth = state.settings?.sourceTracker?.depth;
        if (depth) {
          this.depth = depth;
          console.log(`[SourceTracker] Loaded depth from Redux: ${depth}`);
          return;
        }
      }

      // Fallback to localStorage
      const saved = localStorage.getItem('devpages_sourcetracker_depth');
      if (saved) {
        this.depth = saved;
        console.log(`[SourceTracker] Loaded depth from localStorage: ${saved}`);
      }
    } catch (error) {
      console.warn('[SourceTracker] Failed to load settings:', error);
    }
  }

  /**
   * Set instrumentation depth
   * @param {string} depth - off | light | medium | deep
   */
  setDepth(depth) {
    if (!['off', 'light', 'medium', 'deep'].includes(depth)) {
      console.error(`[SourceTracker] Invalid depth: ${depth}`);
      return false;
    }

    const oldDepth = this.depth;
    this.depth = depth;

    // Save to localStorage
    try {
      localStorage.setItem('devpages_sourcetracker_depth', depth);
    } catch (error) {
      console.warn('[SourceTracker] Failed to save depth to localStorage:', error);
    }

    // Save to Redux if available
    try {
      const store = window.APP?.services?.store;
      if (store) {
        store.dispatch({
          type: 'settings/setSourceTrackerDepth',
          payload: depth
        });
      }
    } catch (error) {
      console.warn('[SourceTracker] Failed to save depth to Redux:', error);
    }

    console.log(`[SourceTracker] Depth changed: ${oldDepth} → ${depth}`);

    // Emit event for UI updates
    this.emitEvent('depth-changed', { oldDepth, newDepth: depth });

    return true;
  }

  /**
   * Get current depth
   * @returns {string} Current depth setting
   */
  getDepth() {
    return this.depth;
  }

  /**
   * Check if instrumentation is enabled for an element
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} Whether element should be instrumented
   */
  shouldInstrument(element) {
    if (!element || this.depth === 'off') return false;

    const rule = this.depthRules[this.depth];
    if (!rule.enabled) return false;

    // For 'deep' mode, instrument everything
    if (this.depth === 'deep') return true;

    // For other modes, check if element matches selector
    try {
      return element.matches(rule.selector);
    } catch (error) {
      console.warn('[SourceTracker] Invalid selector match:', error);
      return false;
    }
  }

  /**
   * Generate unique source ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `src_${this.nextId++}`;
  }

  /**
   * Register an element with source metadata
   * @param {HTMLElement} element - Element to instrument
   * @param {Object} metadata - Source metadata
   * @param {string} metadata.componentName - Component name (e.g., 'MyPanel')
   * @param {string} metadata.filePath - File path (e.g., 'client/panels/MyPanel.js')
   * @param {number} [metadata.lineNumber] - Line number in file
   * @param {string} [metadata.createdBy] - Function/method that created it
   * @param {string} [metadata.type] - Element type (panel, component, utility)
   * @returns {string} Generated source ID
   */
  register(element, metadata) {
    if (!element) {
      console.warn('[SourceTracker] Cannot register null element');
      return null;
    }

    // Auto-initialize if not already done
    if (!this.initialized) {
      this.init();
    }

    // Check if instrumentation is enabled for this element
    if (!this.shouldInstrument(element)) {
      return null; // Skip instrumentation
    }

    // Generate unique ID
    const id = this.generateId();

    // Add data attribute to element
    element.setAttribute('data-source-id', id);

    // Store full metadata in registry
    this.registry.set(id, {
      componentName: metadata.componentName || 'Unknown',
      filePath: metadata.filePath || null,
      lineNumber: metadata.lineNumber || null,
      createdBy: metadata.createdBy || null,
      type: metadata.type || 'component',
      timestamp: Date.now(),
      element: element // Keep weak reference for debugging
    });

    console.log(`[SourceTracker] Registered ${id}: ${metadata.componentName} (${metadata.filePath})`);

    return id;
  }

  /**
   * Get metadata for a registered source ID
   * @param {string} id - Source ID
   * @returns {Object|null} Metadata object or null
   */
  getMetadata(id) {
    return this.registry.get(id) || null;
  }

  /**
   * Get full source information for an element
   * @param {HTMLElement} element - Element to analyze
   * @returns {Object|null} Complete source information
   */
  getSourceInfo(element) {
    if (!element) return null;

    // Auto-initialize if not already done
    if (!this.initialized) {
      this.init();
    }

    // Check if element has source ID
    const id = element.getAttribute('data-source-id');
    const metadata = id ? this.registry.get(id) : null;

    // If no metadata, try to infer sources
    const baseInfo = metadata || this.inferSourceInfo(element);

    // Enhance with CSS and token information
    return {
      ...baseInfo,
      sourceId: id,
      css: this.getCSSSourcesForElement(element),
      tokens: this.getDesignTokens(element),
      computed: this.getComputedInfo(element),
      dom: this.getDOMInfo(element)
    };
  }

  /**
   * Infer source information when element is not explicitly instrumented
   * Uses heuristics: classes, IDs, data attributes, parent hierarchy
   * @param {HTMLElement} element
   * @returns {Object} Inferred source info
   */
  inferSourceInfo(element) {
    // Use SourceInferencer service if available
    const inferencer = window.APP?.services?.sourceInferencer;
    if (inferencer) {
      return inferencer.infer(element);
    }

    // Basic inference fallback
    return {
      componentName: this.inferComponentName(element),
      filePath: null,
      inferred: true
    };
  }

  /**
   * Infer component name from element characteristics
   * @param {HTMLElement} element
   * @returns {string} Inferred component name
   */
  inferComponentName(element) {
    // Check for panel type
    const panelType = element.dataset?.panelType;
    if (panelType) return `${panelType}Panel`;

    // Check for DevPages-specific classes
    const classes = Array.from(element.classList || []);
    const devpagesClass = classes.find(c => c.includes('devpages') || c.includes('panel'));
    if (devpagesClass) return devpagesClass;

    // Check ID
    if (element.id) return `#${element.id}`;

    // Fallback to tag name
    return element.tagName.toLowerCase();
  }

  /**
   * Get CSS source information for element
   * @param {HTMLElement} element
   * @returns {Object} CSS source info
   */
  getCSSSourcesForElement(element) {
    // Use CSSSourceParser service if available
    const cssParser = window.APP?.services?.cssSourceParser;
    if (cssParser) {
      return cssParser.getSourcesForElement(element);
    }

    // Basic fallback
    return {
      files: [],
      rules: [],
      inferred: true
    };
  }

  /**
   * Get design tokens used by element
   * @param {HTMLElement} element
   * @returns {Object} Design token info
   */
  getDesignTokens(element) {
    // Use DevPagesDetector (already available)
    const detector = window.APP?.utils?.devPagesDetector;
    if (detector) {
      return {
        all: detector.extractDesignTokens(element),
        applied: detector.getAppliedTokens(element)
      };
    }

    return { all: {}, applied: {} };
  }

  /**
   * Get computed style information
   * @param {HTMLElement} element
   * @returns {Object} Computed style info
   */
  getComputedInfo(element) {
    try {
      const computed = window.getComputedStyle(element);
      return {
        display: computed.display,
        position: computed.position,
        zIndex: computed.zIndex,
        visibility: computed.visibility,
        opacity: computed.opacity
      };
    } catch (error) {
      console.warn('[SourceTracker] Failed to get computed styles:', error);
      return {};
    }
  }

  /**
   * Get DOM hierarchy information
   * @param {HTMLElement} element
   * @returns {Object} DOM info
   */
  getDOMInfo(element) {
    // Use DevPagesDetector (already available)
    const detector = window.APP?.utils?.devPagesDetector;
    if (detector) {
      return {
        path: detector.getElementPath(element),
        tagName: element.tagName.toLowerCase(),
        id: element.id,
        classes: Array.from(element.classList || [])
      };
    }

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      classes: Array.from(element.classList || [])
    };
  }

  /**
   * Get all registered elements
   * @returns {Array} Array of {id, metadata} objects
   */
  getAllRegistered() {
    const results = [];
    for (const [id, metadata] of this.registry) {
      results.push({ id, ...metadata });
    }
    return results;
  }

  /**
   * Clear all registered metadata
   */
  clear() {
    this.registry.clear();
    this.nextId = 1;
    console.log('[SourceTracker] Registry cleared');
  }

  /**
   * Get statistics about tracked elements
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      depth: this.depth,
      registered: this.registry.size,
      initialized: this.initialized,
      cssSourceMapLoaded: this.cssSourceMap !== null
    };
  }

  /**
   * Emit custom event
   * @param {string} eventName - Event name
   * @param {Object} detail - Event detail
   */
  emitEvent(eventName, detail) {
    const event = new CustomEvent(`sourcetracker:${eventName}`, { detail });
    window.dispatchEvent(event);
  }

  /**
   * Listen for events
   * @param {string} eventName - Event name (without 'sourcetracker:' prefix)
   * @param {Function} callback - Event handler
   */
  on(eventName, callback) {
    window.addEventListener(`sourcetracker:${eventName}`, callback);
  }

  /**
   * Remove event listener
   * @param {string} eventName - Event name (without 'sourcetracker:' prefix)
   * @param {Function} callback - Event handler
   */
  off(eventName, callback) {
    window.removeEventListener(`sourcetracker:${eventName}`, callback);
  }
}

// =============================================================================
// SELF-REGISTRATION (IIFE-style)
// =============================================================================

// Create singleton instance
const sourceTracker = new SourceTrackerService();

// Self-register into window.APP.services
if (!window.APP) window.APP = {};
if (!window.APP.services) window.APP.services = {};
window.APP.services.sourceTracker = sourceTracker;

console.log('[SourceTracker] Service registered to window.APP.services.sourceTracker');

// Export singleton instance as default
export default sourceTracker;
