/**
 * ElementPicker.js
 *
 * Click-to-inspect functionality similar to browser DevTools:
 * - Hover highlighting with overlay
 * - Click to select element
 * - Keyboard shortcuts (Escape to cancel)
 * - Visual feedback
 *
 * Part of Phase 2: Inspector Utilities
 */

export class ElementPicker {
  constructor() {
    this.active = false;
    this.overlay = null;
    this.tooltip = null;
    this.banner = null;
    this.currentElement = null;
    this.onSelectCallback = null;
    this.onHoverCallback = null;
    this.onCancelCallback = null;

    // Bound event handlers for cleanup
    this.boundHandlers = {
      mousemove: this._handleMouseMove.bind(this),
      click: this._handleClick.bind(this),
      keydown: this._handleKeyDown.bind(this),
      scroll: this._handleScroll.bind(this)
    };

    // Create overlay elements (hidden by default)
    this._createOverlay();
  }

  /**
   * Create the overlay elements for highlighting
   * @private
   */
  _createOverlay() {
    // Main highlight overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'devpages-element-picker-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 999999;
      background: rgba(59, 130, 246, 0.25);
      border: 2px solid rgba(59, 130, 246, 0.9);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6),
                  0 0 10px rgba(59, 130, 246, 0.5);
      display: none;
      transition: all 0.15s ease;
    `;

    // Tooltip showing element info
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'devpages-element-picker-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 1000000;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      line-height: 1.4;
      display: none;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(59, 130, 246, 0.5);
    `;

    // Info banner shown during picking mode
    this.banner = document.createElement('div');
    this.banner.id = 'devpages-element-picker-banner';
    this.banner.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000001;
      background: rgba(59, 130, 246, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      animation: pickerBannerSlideIn 0.3s ease;
    `;
    this.banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">🎯</span>
        <span>Click any element to inspect • Press <kbd style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px; font-size: 12px;">ESC</kbd> to cancel</span>
      </div>
    `;

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pickerBannerSlideIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);
    document.body.appendChild(this.banner);
  }

  /**
   * Start element picking mode
   * @param {Object} options - Configuration options
   * @param {Function} options.onSelect - Callback when element is selected
   * @param {Function} options.onHover - Callback when element is hovered
   * @param {Function} options.onCancel - Callback when picking is cancelled
   * @param {Boolean} options.ignoreDevPanels - Whether to ignore DevPages panels (default: true)
   */
  start(options = {}) {
    if (this.active) {
      console.warn('[ElementPicker] Already active');
      return;
    }

    this.active = true;
    this.onSelectCallback = options.onSelect || null;
    this.onHoverCallback = options.onHover || null;
    this.onCancelCallback = options.onCancel || null;
    this.ignoreDevPanels = options.ignoreDevPanels !== false;

    // Add event listeners with capture phase to intercept before other handlers
    document.addEventListener('mousemove', this.boundHandlers.mousemove, true);
    document.addEventListener('click', this.boundHandlers.click, true);
    document.addEventListener('keydown', this.boundHandlers.keydown, true);
    document.addEventListener('scroll', this.boundHandlers.scroll, true);

    // Show overlay, tooltip, and banner
    this.overlay.style.display = 'block';
    this.tooltip.style.display = 'block';
    this.banner.style.display = 'block';

    // Add cursor style with high specificity
    document.body.style.cursor = 'crosshair !important';
    document.body.style.setProperty('cursor', 'crosshair', 'important');

    console.log('[ElementPicker] Started - Hover over elements to inspect, click to select (Press Escape to cancel)');
  }

  /**
   * Stop element picking mode
   * @param {Boolean} cancelled - Whether picking was cancelled
   */
  stop(cancelled = false) {
    if (!this.active) return;

    this.active = false;
    this.currentElement = null;

    // Remove event listeners
    document.removeEventListener('mousemove', this.boundHandlers.mousemove, true);
    document.removeEventListener('click', this.boundHandlers.click, true);
    document.removeEventListener('keydown', this.boundHandlers.keydown, true);
    document.removeEventListener('scroll', this.boundHandlers.scroll, true);

    // Hide overlay, tooltip, and banner
    this.overlay.style.display = 'none';
    this.tooltip.style.display = 'none';
    this.banner.style.display = 'none';

    // Restore cursor
    document.body.style.cursor = '';
    document.body.style.removeProperty('cursor');

    if (cancelled && this.onCancelCallback) {
      this.onCancelCallback();
    }

    console.log('[ElementPicker] Stopped');
  }

  /**
   * Handle mouse move - highlight element under cursor
   * @private
   */
  _handleMouseMove(event) {
    if (!this.active) return;

    const element = this._getElementFromPoint(event.clientX, event.clientY);

    if (element && element !== this.currentElement) {
      this.currentElement = element;
      this._highlightElement(element);
      this._updateTooltip(element, event.clientX, event.clientY);

      if (this.onHoverCallback) {
        this.onHoverCallback(element);
      }
    }
  }

  /**
   * Handle click - select element
   * @private
   */
  _handleClick(event) {
    if (!this.active) return;

    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const element = this._getElementFromPoint(event.clientX, event.clientY);

    console.log('[ElementPicker] Element selected:', element?.tagName, element?.className, element?.id);

    if (element) {
      // Stop picker mode first
      this.stop(false);

      // Then trigger the callback
      if (this.onSelectCallback) {
        try {
          this.onSelectCallback(element);
        } catch (error) {
          console.error('[ElementPicker] Error in onSelect callback:', error);
        }
      }
    }

    // Return false to prevent any further event handling
    return false;
  }

  /**
   * Handle keyboard events
   * @private
   */
  _handleKeyDown(event) {
    if (!this.active) return;

    // Escape key cancels picking
    if (event.key === 'Escape') {
      event.preventDefault();
      this.stop(true);
    }
  }

  /**
   * Handle scroll - update overlay position
   * @private
   */
  _handleScroll() {
    if (!this.active && this.currentElement) {
      this._highlightElement(this.currentElement);
    }
  }

  /**
   * Get element from point, ignoring picker overlay and DevPages panels
   * @private
   */
  _getElementFromPoint(x, y) {
    // Temporarily hide overlay to get element underneath
    this.overlay.style.display = 'none';
    this.tooltip.style.display = 'none';

    let element = document.elementFromPoint(x, y);

    // Restore overlay
    this.overlay.style.display = 'block';
    this.tooltip.style.display = 'block';

    // Skip DevPages panels if configured
    if (this.ignoreDevPanels && element) {
      element = this._skipDevPagesElements(element);
    }

    return element;
  }

  /**
   * Skip DevPages panel elements to get to underlying content
   * @private
   */
  _skipDevPagesElements(element) {
    // If element is inside a floating DevPages panel, skip up to find page content
    // But ONLY skip if it's actually inside a panel - don't skip normal page elements

    if (!element) return null;

    // Check if this element or any ancestor is a DevPages panel
    const panelAncestor = element.closest('.devpages-panel, .panel-container, [class*="devpages-"]');

    if (!panelAncestor) {
      // Element is NOT inside any panel - return it as-is (this is page content)
      console.log('[ElementPicker] Selected page element:', element.tagName, element.className, element.id);
      return element;
    }

    // Element IS inside a panel - try to find page content behind it
    console.log('[ElementPicker] Element is inside DevPages panel, looking for page content behind it');

    // Get all elements at this point
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Hide the panel temporarily
    const originalDisplay = panelAncestor.style.display;
    panelAncestor.style.display = 'none';

    // Get element behind the panel
    const elementBehind = document.elementFromPoint(centerX, centerY);

    // Restore panel
    panelAncestor.style.display = originalDisplay;

    if (elementBehind && elementBehind !== element) {
      console.log('[ElementPicker] Found element behind panel:', elementBehind.tagName, elementBehind.className);
      return elementBehind;
    }

    // No element behind panel, return body as last resort
    console.log('[ElementPicker] No element found behind panel, returning body');
    return document.body;
  }

  /**
   * Highlight an element with the overlay
   * @private
   */
  _highlightElement(element) {
    if (!element) return;

    const rect = element.getBoundingClientRect();

    this.overlay.style.left = `${rect.left + window.scrollX}px`;
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  /**
   * Update tooltip with element information
   * @private
   */
  _updateTooltip(element, x, y) {
    if (!element) return;

    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.classList.length > 0
      ? '.' + Array.from(element.classList).slice(0, 3).join('.')
      : '';

    const rect = element.getBoundingClientRect();
    const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;

    const info = `${tagName}${id}${classes}\n${size}`;

    this.tooltip.textContent = info;

    // Position tooltip near cursor, but keep on screen
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const padding = 10;

    let left = x + padding;
    let top = y + padding;

    // Keep tooltip on screen
    if (left + tooltipRect.width > window.innerWidth) {
      left = x - tooltipRect.width - padding;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = y - tooltipRect.height - padding;
    }

    this.tooltip.style.left = `${left + window.scrollX}px`;
    this.tooltip.style.top = `${top + window.scrollY}px`;
  }

  /**
   * Check if picker is currently active
   * @returns {Boolean}
   */
  isActive() {
    return this.active;
  }

  /**
   * Clean up and destroy picker
   */
  destroy() {
    this.stop(true);

    // Remove overlay elements
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
    if (this.banner && this.banner.parentNode) {
      this.banner.parentNode.removeChild(this.banner);
    }

    this.overlay = null;
    this.tooltip = null;
    this.banner = null;
    this.currentElement = null;
    this.onSelectCallback = null;
    this.onHoverCallback = null;
    this.onCancelCallback = null;
  }
}

// Create singleton instance
const elementPicker = new ElementPicker();

export default elementPicker;
