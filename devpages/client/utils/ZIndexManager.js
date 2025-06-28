/**
 * ZIndexManager.js - Centralized z-index management for DevPages
 * 
 * Manages z-index values across the entire application to prevent conflicts
 * and provide visual debugging of stacking contexts.
 * 
 * Z-Index Layers:
 * - Base Layer: 0-99 (normal content)
 * - UI Layer: 100-999 (panels, toolbars)
 * - Popup Layer: 1000-9999 (modals, dropdowns, tooltips)
 * - System Layer: 10000+ (critical system overlays)
 */

export class ZIndexManager {
  constructor() {
    // Z-Index layer definitions
    this.layers = {
      BASE: { min: 0, max: 99, name: 'Base Content' },
      UI: { min: 100, max: 999, name: 'UI Elements' },
      POPUP: { min: 1000, max: 9999, name: 'Popups & Modals' },
      SYSTEM: { min: 10000, max: 99999, name: 'System Overlays' }
    };
    
    // Track managed elements
    this.managedElements = new Map(); // element -> { layer, priority, originalZ }
    this.stackingContexts = new Map(); // element -> context info
    this.activePopups = new Set(); // Track active popups
    
    // Current z-index counters for each layer
    this.counters = {
      BASE: 1,
      UI: 100,
      POPUP: 1000,
      SYSTEM: 10000
    };
    
    // Configuration
    this.config = {
      autoDetectStackingContexts: true,
      visualDebugging: false,
      logChanges: true
    };
    
    // Initialize
    this.init();
  }

  /**
   * Initialize the Z-Index Manager
   */
  init() {
    // Scan existing elements
    this.scanExistingElements();
    
    // Set up mutation observer to track new elements
    this.setupMutationObserver();
    
    // Add global styles for debugging
    this.injectDebugStyles();
    
    // Make globally available
    window.zIndexManager = this;
    window.devpages = window.devpages || {};
    window.devpages.zIndexManager = this;
    
    console.log('[ZIndexManager] Initialized with layers:', this.layers);
  }

  /**
   * Register an element for z-index management
   * @param {HTMLElement} element - Element to manage
   * @param {string} layer - Layer name (BASE, UI, POPUP, SYSTEM)
   * @param {number} priority - Priority within layer (higher = front)
   * @param {Object} options - Additional options
   */
  register(element, layer = 'UI', priority = 0, options = {}) {
    if (!element || !this.layers[layer]) {
      console.error('[ZIndexManager] Invalid element or layer:', { element, layer });
      return null;
    }

    // Store original z-index
    const computedStyle = window.getComputedStyle(element);
    const originalZ = computedStyle.zIndex;
    
    // Calculate new z-index
    const baseZ = this.layers[layer].min;
    const newZ = baseZ + priority;
    
    // Validate z-index is within layer bounds
    if (newZ > this.layers[layer].max) {
      console.warn(`[ZIndexManager] Z-index ${newZ} exceeds layer ${layer} maximum`);
    }

    // Store management info
    const managementInfo = {
      layer,
      priority,
      originalZ,
      zIndex: newZ,
      options,
      registered: new Date(),
      bringToFrontCount: 0
    };
    
    this.managedElements.set(element, managementInfo);
    
    // Apply z-index
    element.style.zIndex = newZ;
    
    // Add data attributes for debugging
    element.setAttribute('data-z-layer', layer);
    element.setAttribute('data-z-priority', priority);
    element.setAttribute('data-z-managed', 'true');
    
    // Check for stacking context
    this.analyzeStackingContext(element);
    
    if (this.config.logChanges) {
      console.log(`[ZIndexManager] Registered element in ${layer} layer with z-index ${newZ}`, element);
    }
    
    return newZ;
  }

  /**
   * Bring element to front within its layer
   * @param {HTMLElement} element - Element to bring forward
   */
  bringToFront(element) {
    const info = this.managedElements.get(element);
    if (!info) {
      console.warn('[ZIndexManager] Element not managed:', element);
      return;
    }

    // Increment counter for this layer
    this.counters[info.layer] += 10; // Leave gaps for insertion
    const newZ = Math.min(this.counters[info.layer], this.layers[info.layer].max);
    
    // Update element
    element.style.zIndex = newZ;
    info.zIndex = newZ;
    info.priority = newZ - this.layers[info.layer].min;
    info.bringToFrontCount++;
    
    // Update attributes
    element.setAttribute('data-z-priority', info.priority);
    
    if (this.config.logChanges) {
      console.log(`[ZIndexManager] Brought to front: ${info.layer} layer, z-index ${newZ}`, element);
    }
    
    // Emit event
    this.emitZIndexChange(element, newZ, 'bring-to-front');
    
    return newZ;
  }

  /**
   * Register a popup element with automatic cleanup
   * @param {HTMLElement} element - Popup element
   * @param {Object} options - Popup options
   */
  registerPopup(element, options = {}) {
    const priority = options.priority || 0;
    const zIndex = this.register(element, 'POPUP', priority, { ...options, isPopup: true });
    
    this.activePopups.add(element);
    
    // Auto-cleanup when element is removed
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === element) {
            this.unregister(element);
            observer.disconnect();
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    return zIndex;
  }

  /**
   * Unregister an element
   * @param {HTMLElement} element - Element to unregister
   */
  unregister(element) {
    const info = this.managedElements.get(element);
    if (!info) return;
    
    // Restore original z-index if it existed
    if (info.originalZ && info.originalZ !== 'auto') {
      element.style.zIndex = info.originalZ;
    } else {
      element.style.removeProperty('z-index');
    }
    
    // Remove data attributes
    element.removeAttribute('data-z-layer');
    element.removeAttribute('data-z-priority');
    element.removeAttribute('data-z-managed');
    
    // Clean up tracking
    this.managedElements.delete(element);
    this.stackingContexts.delete(element);
    this.activePopups.delete(element);
    
    if (this.config.logChanges) {
      console.log('[ZIndexManager] Unregistered element', element);
    }
  }

  /**
   * Analyze stacking context for an element
   * @param {HTMLElement} element - Element to analyze
   */
  analyzeStackingContext(element) {
    const computedStyle = window.getComputedStyle(element);
    
    // Properties that create stacking contexts
    const stackingProperties = {
      position: ['relative', 'absolute', 'fixed', 'sticky'],
      zIndex: (val) => val !== 'auto',
      opacity: (val) => parseFloat(val) < 1,
      transform: (val) => val !== 'none',
      filter: (val) => val !== 'none',
      perspective: (val) => val !== 'none',
      clipPath: (val) => val !== 'none',
      mask: (val) => val !== 'none',
      isolation: ['isolate'],
      mixBlendMode: (val) => val !== 'normal',
      contain: (val) => val.includes('layout') || val.includes('style') || val.includes('paint')
    };
    
    const contextInfo = {
      element,
      isStackingContext: false,
      reasons: [],
      parent: null,
      children: [],
      zIndex: computedStyle.zIndex
    };
    
    // Check each property
    for (const [prop, condition] of Object.entries(stackingProperties)) {
      const value = computedStyle[prop];
      let creates = false;
      
      if (typeof condition === 'function') {
        creates = condition(value);
      } else if (Array.isArray(condition)) {
        creates = condition.includes(value);
      }
      
      if (creates) {
        contextInfo.isStackingContext = true;
        contextInfo.reasons.push(`${prop}: ${value}`);
      }
    }
    
    // Find parent stacking context
    let parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
      if (this.stackingContexts.has(parent) && this.stackingContexts.get(parent).isStackingContext) {
        contextInfo.parent = parent;
        break;
      }
      parent = parent.parentElement;
    }
    
    this.stackingContexts.set(element, contextInfo);
    
    return contextInfo;
  }

  /**
   * Get all elements in a specific layer
   * @param {string} layer - Layer name
   */
  getElementsInLayer(layer) {
    return Array.from(this.managedElements.entries())
      .filter(([element, info]) => info.layer === layer)
      .sort((a, b) => b[1].zIndex - a[1].zIndex); // Sort by z-index descending
  }

  /**
   * Get z-index information for any element
   * @param {HTMLElement} element - Element to inspect
   */
  getZIndexInfo(element) {
    const computedStyle = window.getComputedStyle(element);
    const managedInfo = this.managedElements.get(element);
    const stackingInfo = this.stackingContexts.get(element);
    
    return {
      element,
      zIndex: computedStyle.zIndex,
      computedZIndex: this.getComputedZIndex(element),
      isManaged: !!managedInfo,
      managedInfo,
      stackingContext: stackingInfo,
      layer: managedInfo?.layer || this.guessLayer(computedStyle.zIndex),
      effectiveParent: this.findEffectiveParent(element)
    };
  }

  /**
   * Get computed z-index (resolving auto values)
   * @param {HTMLElement} element - Element to check
   */
  getComputedZIndex(element) {
    const style = window.getComputedStyle(element);
    if (style.zIndex !== 'auto') {
      return parseInt(style.zIndex);
    }
    
    // For auto values, find the effective z-index
    let parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.zIndex !== 'auto') {
        return parseInt(parentStyle.zIndex);
      }
      parent = parent.parentElement;
    }
    
    return 0; // Default for auto
  }

  /**
   * Find effective stacking parent
   * @param {HTMLElement} element - Element to check
   */
  findEffectiveParent(element) {
    let parent = element.parentElement;
    while (parent && parent !== document.documentElement) {
      const stackingInfo = this.stackingContexts.get(parent);
      if (stackingInfo?.isStackingContext) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return document.documentElement;
  }

  /**
   * Guess layer based on z-index value
   * @param {string|number} zIndex - Z-index value
   */
  guessLayer(zIndex) {
    const z = parseInt(zIndex);
    if (isNaN(z)) return 'BASE';
    
    for (const [layerName, layer] of Object.entries(this.layers)) {
      if (z >= layer.min && z <= layer.max) {
        return layerName;
      }
    }
    
    return z >= 10000 ? 'SYSTEM' : 'BASE';
  }

  /**
   * Scan existing elements for z-index usage
   */
  scanExistingElements() {
    const allElements = document.querySelectorAll('*');
    const elementsWithZ = [];
    
    allElements.forEach(element => {
      const style = window.getComputedStyle(element);
      if (style.zIndex !== 'auto') {
        elementsWithZ.push({
          element,
          zIndex: parseInt(style.zIndex),
          layer: this.guessLayer(style.zIndex)
        });
        
        // Analyze stacking context
        this.analyzeStackingContext(element);
      }
    });
    
    console.log(`[ZIndexManager] Found ${elementsWithZ.length} elements with z-index`, elementsWithZ);
    return elementsWithZ;
  }

  /**
   * Set up mutation observer for new elements
   */
  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      if (!this.config.autoDetectStackingContexts) return;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const style = window.getComputedStyle(node);
            if (style.zIndex !== 'auto') {
              this.analyzeStackingContext(node);
            }
          }
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Toggle visual debugging mode
   * @param {boolean} enabled - Enable/disable visual debugging
   */
  setVisualDebugging(enabled) {
    this.config.visualDebugging = enabled;
    document.documentElement.classList.toggle('z-debug-mode', enabled);
    
    if (enabled) {
      this.addVisualDebugOverlays();
    } else {
      this.removeVisualDebugOverlays();
    }
  }

  /**
   * Add visual debug overlays
   */
  addVisualDebugOverlays() {
    // Remove existing overlays
    this.removeVisualDebugOverlays();
    
    // Add overlays for all managed elements
    this.managedElements.forEach((info, element) => {
      const overlay = document.createElement('div');
      overlay.className = 'z-debug-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        border: 2px solid var(--z-debug-color-${info.layer.toLowerCase()}, #ff0000);
        background: var(--z-debug-bg-${info.layer.toLowerCase()}, rgba(255, 0, 0, 0.1));
        font-size: 10px;
        color: white;
        z-index: 999999;
      `;
      
      const label = document.createElement('div');
      label.textContent = `${info.layer}:${info.zIndex}`;
      label.style.cssText = `
        position: absolute;
        top: 2px;
        left: 2px;
        background: rgba(0, 0, 0, 0.8);
        padding: 2px 4px;
        border-radius: 2px;
        font-family: monospace;
      `;
      
      overlay.appendChild(label);
      element.appendChild(overlay);
      element.setAttribute('data-z-debug-overlay', 'true');
    });
  }

  /**
   * Remove visual debug overlays
   */
  removeVisualDebugOverlays() {
    document.querySelectorAll('.z-debug-overlay').forEach(overlay => {
      overlay.remove();
    });
    
    document.querySelectorAll('[data-z-debug-overlay]').forEach(element => {
      element.removeAttribute('data-z-debug-overlay');
    });
  }

  /**
   * Emit z-index change event
   * @param {HTMLElement} element - Element that changed
   * @param {number} newZIndex - New z-index value
   * @param {string} reason - Reason for change
   */
  emitZIndexChange(element, newZIndex, reason) {
    const event = new CustomEvent('zIndexChange', {
      detail: { element, newZIndex, reason, manager: this }
    });
    
    element.dispatchEvent(event);
    document.dispatchEvent(event);
  }

  /**
   * Inject debug styles
   */
  injectDebugStyles() {
    const style = document.createElement('style');
    style.id = 'z-index-manager-styles';
    style.textContent = `
      /* Z-Index Debug Mode */
      .z-debug-mode [data-z-managed="true"] {
        outline: 1px dashed rgba(255, 0, 0, 0.5) !important;
      }
      
      .z-debug-mode [data-z-layer="BASE"] {
        --z-debug-color-base: #4ade80;
        --z-debug-bg-base: rgba(74, 222, 128, 0.1);
      }
      
      .z-debug-mode [data-z-layer="UI"] {
        --z-debug-color-ui: #3b82f6;
        --z-debug-bg-ui: rgba(59, 130, 246, 0.1);
      }
      
      .z-debug-mode [data-z-layer="POPUP"] {
        --z-debug-color-popup: #f59e0b;
        --z-debug-bg-popup: rgba(245, 158, 11, 0.1);
      }
      
      .z-debug-mode [data-z-layer="SYSTEM"] {
        --z-debug-color-system: #ef4444;
        --z-debug-bg-system: rgba(239, 68, 68, 0.1);
      }
      
      /* Clickable elements for z-order management */
      [data-z-managed="true"] {
        cursor: pointer;
      }
      
      [data-z-managed="true"]:hover {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Get statistics about z-index usage
   */
  getStats() {
    const stats = {
      managedElements: this.managedElements.size,
      activePopups: this.activePopups.size,
      stackingContexts: this.stackingContexts.size,
      layers: {},
      highestZIndex: 0,
      conflicts: []
    };
    
    // Count elements per layer
    for (const layer of Object.keys(this.layers)) {
      stats.layers[layer] = this.getElementsInLayer(layer).length;
    }
    
    // Find highest z-index
    this.managedElements.forEach((info) => {
      if (info.zIndex > stats.highestZIndex) {
        stats.highestZIndex = info.zIndex;
      }
    });
    
    return stats;
  }

  /**
   * Export current z-index configuration
   */
  exportConfiguration() {
    const config = {
      timestamp: new Date().toISOString(),
      layers: this.layers,
      counters: this.counters,
      managedElements: [],
      stackingContexts: []
    };
    
    // Export managed elements (without DOM references)
    this.managedElements.forEach((info, element) => {
      config.managedElements.push({
        selector: this.generateSelector(element),
        ...info,
        element: undefined // Remove DOM reference
      });
    });
    
    // Export stacking contexts
    this.stackingContexts.forEach((info, element) => {
      config.stackingContexts.push({
        selector: this.generateSelector(element),
        ...info,
        element: undefined,
        parent: info.parent ? this.generateSelector(info.parent) : null
      });
    });
    
    return config;
  }

  /**
   * Generate CSS selector for an element
   * @param {HTMLElement} element - Element to generate selector for
   */
  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classNames = element.className && typeof element.className === 'string' ? element.className.split(' ') :
                        element.className && element.className.toString ? element.className.toString().split(' ') : [];
      return `.${classNames.join('.')}`;
    }
    
    return element.tagName.toLowerCase();
  }
}

// Create and export global instance
export const zIndexManager = new ZIndexManager(); 