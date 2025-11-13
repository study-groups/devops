/**
 * BoxModelRenderer.js
 *
 * Visualize CSS box model (margin, border, padding, content) for any element:
 * - Interactive visualization overlay
 * - Measurement display
 * - Color-coded areas
 * - Tooltip with detailed measurements
 *
 * Part of Phase 2: Inspector Utilities
 */

export class BoxModelRenderer {
  constructor() {
    this.container = null;
    this.targetElement = null;
    this.visible = false;

    // Box model colors (similar to browser DevTools)
    this.colors = {
      margin: 'rgba(246, 178, 107, 0.4)',
      border: 'rgba(255, 229, 153, 0.4)',
      padding: 'rgba(147, 196, 125, 0.4)',
      content: 'rgba(111, 168, 220, 0.4)'
    };

    this._createContainer();
  }

  /**
   * Create the container for box model visualization
   * @private
   */
  _createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'devpages-box-model-overlay';
    this.container.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 999998;
      display: none;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
    `;

    document.body.appendChild(this.container);
  }

  /**
   * Show box model for an element
   * @param {HTMLElement} element - Element to visualize
   */
  show(element) {
    if (!element) return;

    this.targetElement = element;
    this.visible = true;

    const computed = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    // Get box model values
    const boxModel = this._getBoxModel(computed);

    // Clear previous content
    this.container.innerHTML = '';

    // Render box model layers
    this._renderLayers(rect, boxModel);

    // Show container
    this.container.style.display = 'block';

    // Note: _updatePosition() is NOT called here to avoid infinite recursion
    // It should only be called from scroll handlers
  }

  /**
   * Hide box model visualization
   */
  hide() {
    this.visible = false;
    this.targetElement = null;
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }

  /**
   * Toggle box model visualization
   * @param {HTMLElement} element
   */
  toggle(element) {
    if (this.visible && this.targetElement === element) {
      this.hide();
    } else {
      this.show(element);
    }
  }

  /**
   * Extract box model measurements from computed style
   * @private
   */
  _getBoxModel(computed) {
    return {
      margin: {
        top: parseFloat(computed.marginTop) || 0,
        right: parseFloat(computed.marginRight) || 0,
        bottom: parseFloat(computed.marginBottom) || 0,
        left: parseFloat(computed.marginLeft) || 0
      },
      border: {
        top: parseFloat(computed.borderTopWidth) || 0,
        right: parseFloat(computed.borderRightWidth) || 0,
        bottom: parseFloat(computed.borderBottomWidth) || 0,
        left: parseFloat(computed.borderLeftWidth) || 0
      },
      padding: {
        top: parseFloat(computed.paddingTop) || 0,
        right: parseFloat(computed.paddingRight) || 0,
        bottom: parseFloat(computed.paddingBottom) || 0,
        left: parseFloat(computed.paddingLeft) || 0
      }
    };
  }

  /**
   * Render all box model layers
   * @private
   */
  _renderLayers(rect, boxModel) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Calculate layer positions (from outside to inside)
    const layers = this._calculateLayers(rect, boxModel, scrollX, scrollY);

    // Render margin
    if (this._hasNonZeroValues(boxModel.margin)) {
      this._renderLayer('margin', layers.margin, this.colors.margin);
      this._renderLabels('margin', layers.margin, boxModel.margin);
    }

    // Render border
    if (this._hasNonZeroValues(boxModel.border)) {
      this._renderLayer('border', layers.border, this.colors.border);
      this._renderLabels('border', layers.border, boxModel.border);
    }

    // Render padding
    if (this._hasNonZeroValues(boxModel.padding)) {
      this._renderLayer('padding', layers.padding, this.colors.padding);
      this._renderLabels('padding', layers.padding, boxModel.padding);
    }

    // Render content
    this._renderLayer('content', layers.content, this.colors.content);
    this._renderContentLabel(layers.content);
  }

  /**
   * Calculate layer positions
   * @private
   */
  _calculateLayers(rect, boxModel, scrollX, scrollY) {
    const m = boxModel.margin;
    const b = boxModel.border;
    const p = boxModel.padding;

    return {
      margin: {
        top: rect.top + scrollY - m.top,
        left: rect.left + scrollX - m.left,
        width: rect.width + m.left + m.right,
        height: rect.height + m.top + m.bottom
      },
      border: {
        top: rect.top + scrollY,
        left: rect.left + scrollX,
        width: rect.width,
        height: rect.height
      },
      padding: {
        top: rect.top + scrollY + b.top,
        left: rect.left + scrollX + b.left,
        width: rect.width - b.left - b.right,
        height: rect.height - b.top - b.bottom
      },
      content: {
        top: rect.top + scrollY + b.top + p.top,
        left: rect.left + scrollX + b.left + p.left,
        width: rect.width - b.left - b.right - p.left - p.right,
        height: rect.height - b.top - b.bottom - p.top - p.bottom
      }
    };
  }

  /**
   * Render a single layer
   * @private
   */
  _renderLayer(name, layer, color) {
    const div = document.createElement('div');
    div.className = `box-model-layer-${name}`;
    div.style.cssText = `
      position: absolute;
      top: ${layer.top}px;
      left: ${layer.left}px;
      width: ${layer.width}px;
      height: ${layer.height}px;
      background: ${color};
      border: 1px solid ${this._darkenColor(color)};
    `;

    this.container.appendChild(div);
  }

  /**
   * Render measurement labels for a layer
   * @private
   */
  _renderLabels(name, layer, values) {
    // Top
    if (values.top > 0) {
      this._renderLabel(
        Math.round(values.top),
        layer.left + layer.width / 2,
        layer.top + values.top / 2,
        'top'
      );
    }

    // Right
    if (values.right > 0) {
      this._renderLabel(
        Math.round(values.right),
        layer.left + layer.width - values.right / 2,
        layer.top + layer.height / 2,
        'right'
      );
    }

    // Bottom
    if (values.bottom > 0) {
      this._renderLabel(
        Math.round(values.bottom),
        layer.left + layer.width / 2,
        layer.top + layer.height - values.bottom / 2,
        'bottom'
      );
    }

    // Left
    if (values.left > 0) {
      this._renderLabel(
        Math.round(values.left),
        layer.left + values.left / 2,
        layer.top + layer.height / 2,
        'left'
      );
    }
  }

  /**
   * Render content area label (dimensions)
   * @private
   */
  _renderContentLabel(layer) {
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      top: ${layer.top + layer.height / 2 - 10}px;
      left: ${layer.left + layer.width / 2}px;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      white-space: nowrap;
    `;
    label.textContent = `${Math.round(layer.width)} × ${Math.round(layer.height)}`;

    this.container.appendChild(label);
  }

  /**
   * Render a single measurement label
   * @private
   */
  _renderLabel(value, x, y, side) {
    const label = document.createElement('div');
    label.style.cssText = `
      position: absolute;
      top: ${y}px;
      left: ${x}px;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 2px 6px;
      border-radius: 2px;
      font-size: 10px;
    `;
    label.textContent = value;

    this.container.appendChild(label);
  }

  /**
   * Update position (e.g., on scroll)
   * @private
   */
  _updatePosition() {
    if (!this.visible || !this.targetElement) return;

    const computed = window.getComputedStyle(this.targetElement);
    const rect = this.targetElement.getBoundingClientRect();
    const boxModel = this._getBoxModel(computed);

    // Clear and re-render without calling show()
    this.container.innerHTML = '';
    this._renderLayers(rect, boxModel);
  }

  /**
   * Check if any value in an object is non-zero
   * @private
   */
  _hasNonZeroValues(obj) {
    return Object.values(obj).some(v => v > 0);
  }

  /**
   * Darken a color for borders
   * @private
   */
  _darkenColor(rgba) {
    // Simple darkening by reducing opacity alpha
    return rgba.replace(/[\d.]+\)$/, '0.6)');
  }

  /**
   * Check if visualization is visible
   * @returns {Boolean}
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Get current target element
   * @returns {HTMLElement|null}
   */
  getTargetElement() {
    return this.targetElement;
  }

  /**
   * Clean up and destroy renderer
   */
  destroy() {
    this.hide();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.targetElement = null;
  }
}

// Create singleton instance
const boxModelRenderer = new BoxModelRenderer();

export default boxModelRenderer;
