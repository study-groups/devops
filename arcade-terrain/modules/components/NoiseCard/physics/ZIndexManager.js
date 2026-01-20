/**
 * ZIndexManager - Manages z-index for layers and elements
 *
 * Provides z-index ranges for each layer (100 slots each) and
 * per-letter z-index control within Layer 2.
 *
 * Syncs with CSS custom properties for design system integration.
 */

// Default layer configuration
const DEFAULT_LAYERS = {
  1: { base: 100, range: [100, 199], name: 'noise', elements: {} },
  2: { base: 200, range: [200, 299], name: 'image', elements: {
    A: 210,
    R: 215,
    I: 220,
    COLON_TOP: 225,
    COLON_BOT: 226,
    C: 230,
    A2: 240,
    D: 250,
    E: 260
  }},
  3: { base: 300, range: [300, 399], name: 'ca', elements: {} }
};

export class ZIndexManager {
  constructor() {
    // Deep clone defaults
    this.layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));

    // Read initial values from CSS if available
    this._readFromCSS();
  }

  /**
   * Read z-index values from CSS custom properties
   */
  _readFromCSS() {
    const root = document.documentElement;
    const style = getComputedStyle(root);

    // Read layer bases
    for (const num of [1, 2, 3]) {
      const value = style.getPropertyValue(`--z-layer-${num}-base`).trim();
      if (value) {
        this.layers[num].base = parseInt(value) || this.layers[num].base;
      }
    }

    // Read letter z-indices
    for (const letter of Object.keys(this.layers[2].elements)) {
      const value = style.getPropertyValue(`--z-letter-${letter}`).trim();
      if (value) {
        this.layers[2].elements[letter] = parseInt(value) || this.layers[2].elements[letter];
      }
    }
  }

  /**
   * Update CSS custom properties
   */
  _updateCSS() {
    const root = document.documentElement;

    // Set layer bases
    for (const [num, layer] of Object.entries(this.layers)) {
      root.style.setProperty(`--z-layer-${num}-base`, layer.base);
    }

    // Set letter z-indices
    for (const [letter, z] of Object.entries(this.layers[2].elements)) {
      root.style.setProperty(`--z-letter-${letter}`, z);
    }
  }

  /**
   * Set layer base z-index
   * @param {number} layerNum - Layer number (1, 2, or 3)
   * @param {number} value - Z-index value
   */
  setLayerZ(layerNum, value) {
    if (!this.layers[layerNum]) return false;

    this.layers[layerNum].base = value;
    this._updateCSS();
    return true;
  }

  /**
   * Set element z-index within a layer
   * @param {number} layerNum - Layer number
   * @param {string} element - Element name (e.g., 'A', 'R')
   * @param {number} offset - Offset from layer base (or absolute if > 100)
   */
  setElementZ(layerNum, element, offset) {
    if (!this.layers[layerNum]) return false;

    // If offset is small, treat as relative to layer base
    // If offset is large (> 100), treat as absolute
    const z = offset > 100 ? offset : this.layers[layerNum].base + offset;

    this.layers[layerNum].elements[element] = z;
    this._updateCSS();
    return true;
  }

  /**
   * Get computed z-index for a layer or element
   * @param {number} layerNum - Layer number
   * @param {string} element - Element name (optional)
   * @returns {number} Computed z-index
   */
  getZ(layerNum, element = null) {
    if (!this.layers[layerNum]) return 0;

    if (element && this.layers[layerNum].elements[element] !== undefined) {
      return this.layers[layerNum].elements[element];
    }

    return this.layers[layerNum].base;
  }

  /**
   * Get all elements in a layer sorted by z-index
   * @param {number} layerNum - Layer number
   * @returns {Array<{element: string, z: number}>}
   */
  getSortedElements(layerNum) {
    if (!this.layers[layerNum]) return [];

    return Object.entries(this.layers[layerNum].elements)
      .map(([element, z]) => ({ element, z }))
      .sort((a, b) => a.z - b.z);
  }

  /**
   * Get all layers sorted by z-index
   * @returns {Array<{layer: number, z: number, name: string}>}
   */
  getSortedLayers() {
    return Object.entries(this.layers)
      .map(([num, data]) => ({
        layer: parseInt(num),
        z: data.base,
        name: data.name
      }))
      .sort((a, b) => a.z - b.z);
  }

  /**
   * Reset all z-indices to defaults
   */
  reset() {
    this.layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
    this._updateCSS();
  }

  /**
   * Reset specific layer to defaults
   */
  resetLayer(layerNum) {
    if (DEFAULT_LAYERS[layerNum]) {
      this.layers[layerNum] = JSON.parse(JSON.stringify(DEFAULT_LAYERS[layerNum]));
      this._updateCSS();
    }
  }

  /**
   * Get full configuration
   */
  getConfig() {
    return JSON.parse(JSON.stringify(this.layers));
  }

  /**
   * Set full configuration
   */
  setConfig(config) {
    for (const [num, data] of Object.entries(config)) {
      if (this.layers[num]) {
        if (data.base !== undefined) this.layers[num].base = data.base;
        if (data.elements) {
          Object.assign(this.layers[num].elements, data.elements);
        }
      }
    }
    this._updateCSS();
  }

  /**
   * Check if an element can "transcend" into another layer's range
   * @param {number} layerNum - Source layer
   * @param {string} element - Element name
   * @param {number} targetLayerNum - Target layer to check
   * @returns {boolean}
   */
  isTranscending(layerNum, element, targetLayerNum) {
    const elementZ = this.getZ(layerNum, element);
    const targetRange = this.layers[targetLayerNum]?.range;

    if (!targetRange) return false;

    return elementZ >= targetRange[0] && elementZ <= targetRange[1];
  }
}

export default ZIndexManager;
