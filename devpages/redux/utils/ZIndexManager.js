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
      SYSTEM: { min: 10000, max: 99999, name: 'System Overlays' },
      DEBUG: { min: 100000, max: 999999, name: 'Debug Tools' }
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
    // Create singleton instance
    if (typeof window !== 'undefined') {
      if (window.zIndexManager) {
        return window.zIndexManager;
      }
      window.zIndexManager = this;
    }
    
    this.log('Z-Index Manager initialized');
    
    // Set up debugging if enabled
    if (this.config.visualDebugging) {
      this.enableVisualDebugging();
    }
  }

  /**
   * Register an element for z-index management
   * @param {HTMLElement} element - Element to manage
   * @param {string} layer - Layer name (BASE, UI, POPUP, SYSTEM)
   * @param {number} priority - Priority within layer (0-100)
   * @returns {number} Assigned z-index value
   */
  register(element, layer = 'UI', priority = 50) {
    if (!element || !element.style) {
      throw new Error('Invalid element provided to ZIndexManager.register');
    }
    
    const layerConfig = this.layers[layer];
    if (!layerConfig) {
      throw new Error(`Invalid layer: ${layer}. Must be one of: ${Object.keys(this.layers).join(', ')}`);
    }
    
    // Store original z-index for potential restoration
    const originalZ = element.style.zIndex || 'auto';
    
    // Calculate z-index based on layer and priority
    const baseZ = layerConfig.min + Math.floor((layerConfig.max - layerConfig.min) * (priority / 100));
    const zIndex = Math.min(baseZ, layerConfig.max);
    
    // Apply z-index
    element.style.zIndex = zIndex;
    
    // Track the element
    this.managedElements.set(element, {
      layer,
      priority,
      originalZ,
      zIndex,
      registered: Date.now()
    });
    
    // Update counter for this layer
    this.counters[layer] = Math.max(this.counters[layer], zIndex + 1);
    
    this.log(`Registered element in ${layer} layer with z-index ${zIndex} (priority: ${priority})`);
    
    return zIndex;
  }

  /**
   * Unregister an element from z-index management
   * @param {HTMLElement} element - Element to unregister
   * @param {boolean} restoreOriginal - Whether to restore original z-index
   */
  unregister(element, restoreOriginal = false) {
    const info = this.managedElements.get(element);
    if (!info) {
      this.log('Attempted to unregister element that was not registered', 'warn');
      return;
    }
    
    if (restoreOriginal && info.originalZ !== 'auto') {
      element.style.zIndex = info.originalZ;
    }
    
    this.managedElements.delete(element);
    this.activePopups.delete(element);
    
    this.log(`Unregistered element from ${info.layer} layer`);
  }

  /**
   * Bring an element to the front of its layer
   * @param {HTMLElement} element - Element to bring forward
   * @returns {number} New z-index value
   */
  bringToFront(element) {
    const info = this.managedElements.get(element);
    if (!info) {
      this.log('Cannot bring unregistered element to front', 'warn');
      return null;
    }
    
    const layerConfig = this.layers[info.layer];
    const newZ = Math.min(this.counters[info.layer], layerConfig.max);
    
    element.style.zIndex = newZ;
    info.zIndex = newZ;
    this.counters[info.layer] = newZ + 1;
    
    this.log(`Brought element to front with z-index ${newZ}`);
    
    return newZ;
  }

  /**
   * Get the next available z-index for a layer
   * @param {string} layer - Layer name
   * @returns {number} Next available z-index
   */
  getNextZ(layer = 'UI') {
    const layerConfig = this.layers[layer];
    if (!layerConfig) {
      throw new Error(`Invalid layer: ${layer}`);
    }
    
    return Math.min(this.counters[layer], layerConfig.max);
  }

  /**
   * Create a popup and manage its lifecycle
   * @param {HTMLElement} element - Popup element
   * @param {Object} options - Popup options
   * @returns {Object} Popup controller
   */
  createPopup(element, options = {}) {
    const {
      layer = 'POPUP',
      priority = 50,
      modal = false,
      autoClose = true,
      closeOnEscape = true,
      closeOnClickOutside = true
    } = options;
    
    // Register in popup layer
    const zIndex = this.register(element, layer, priority);
    this.activePopups.add(element);
    
    // Modal backdrop
    let backdrop = null;
    if (modal) {
      backdrop = this.createModalBackdrop(zIndex - 1);
    }
    
    // Auto-close handlers
    const handlers = {};
    
    if (closeOnEscape) {
      handlers.keydown = (e) => {
        if (e.key === 'Escape') {
          controller.close();
        }
      };
      document.addEventListener('keydown', handlers.keydown);
    }
    
    if (closeOnClickOutside) {
      handlers.click = (e) => {
        if (!element.contains(e.target)) {
          controller.close();
        }
      };
      document.addEventListener('click', handlers.click);
    }
    
    // Popup controller
    const controller = {
      element,
      zIndex,
      backdrop,
      
      close: () => {
        // Remove event listeners
        Object.entries(handlers).forEach(([event, handler]) => {
          document.removeEventListener(event, handler);
        });
        
        // Remove backdrop
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        
        // Unregister element
        this.unregister(element);
        
        this.log('Popup closed');
      },
      
      bringToFront: () => {
        return this.bringToFront(element);
      }
    };
    
    this.log(`Created popup with z-index ${zIndex}`);
    
    return controller;
  }

  /**
   * Create a modal backdrop
   * @param {number} zIndex - Z-index for backdrop
   * @returns {HTMLElement} Backdrop element
   */
  createModalBackdrop(zIndex) {
    const backdrop = document.createElement('div');
    backdrop.className = 'z-modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: ${zIndex};
      pointer-events: auto;
    `;
    
    document.body.appendChild(backdrop);
    return backdrop;
  }

  /**
   * Get debug information about managed elements
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    const elements = Array.from(this.managedElements.entries()).map(([element, info]) => ({
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      ...info
    }));
    
    return {
      totalManaged: this.managedElements.size,
      activePopups: this.activePopups.size,
      counters: { ...this.counters },
      layers: { ...this.layers },
      elements
    };
  }

  /**
   * Enable visual debugging overlay
   */
  enableVisualDebugging() {
    if (this.debugOverlay) return;
    
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'z-debug-overlay';
    this.debugOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: ${this.layers.DEBUG.min};
      border-radius: 4px;
      max-width: 300px;
      pointer-events: none;
    `;
    
    document.body.appendChild(this.debugOverlay);
    
    this.updateDebugOverlay();
    
    // Update every second
    this.debugInterval = setInterval(() => {
      this.updateDebugOverlay();
    }, 1000);
  }

  /**
   * Update debug overlay content
   */
  updateDebugOverlay() {
    if (!this.debugOverlay) return;
    
    const info = this.getDebugInfo();
    this.debugOverlay.innerHTML = `
      <strong>Z-Index Manager Debug</strong><br>
      Managed: ${info.totalManaged}<br>
      Popups: ${info.activePopups}<br>
      <hr style="margin: 5px 0;">
      ${Object.entries(info.counters).map(([layer, count]) => 
        `${layer}: ${count}`
      ).join('<br>')}
    `;
  }

  /**
   * Disable visual debugging
   */
  disableVisualDebugging() {
    if (this.debugOverlay && this.debugOverlay.parentNode) {
      this.debugOverlay.parentNode.removeChild(this.debugOverlay);
      this.debugOverlay = null;
    }
    
    if (this.debugInterval) {
      clearInterval(this.debugInterval);
      this.debugInterval = null;
    }
  }

  /**
   * Clean up all managed elements
   */
  cleanup() {
    // Restore original z-indexes
    this.managedElements.forEach((info, element) => {
      if (info.originalZ !== 'auto') {
        element.style.zIndex = info.originalZ;
      }
    });
    
    // Clear maps
    this.managedElements.clear();
    this.activePopups.clear();
    
    // Disable debugging
    this.disableVisualDebugging();
    
    this.log('Z-Index Manager cleaned up');
  }

  /**
   * Log utility
   * @param {string} message - Log message
   * @param {string} level - Log level
   */
  log(message, level = 'info') {
    if (!this.config.logChanges) return;
    
    const prefix = '[ZIndexManager]';
    switch (level) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }
}

// Create singleton instance
export const zIndexManager = new ZIndexManager();

// Export for direct class access
export default ZIndexManager; 