/**
 * LayerManager - 3-layer compositing system
 *
 * Layers:
 *   1: Noise layer (perlin, random, simplex, worley)
 *   2: Image layer (SVG logo)
 *   3: CA layer (cellular automata)
 *
 * Blend is a position on the layer spectrum:
 *   0.00 = 100% Layer 1
 *   0.25 = 50% L1 + 50% L2
 *   0.50 = 100% Layer 2
 *   0.75 = 50% L2 + 50% L3
 *   1.00 = 100% Layer 3
 */

import { NoiseLayer } from './NoiseLayer.js';
import { ImageLayer } from './ImageLayer.js';
import { CALayer } from './CALayer.js';
import { ZIndexManager } from '../physics/ZIndexManager.js';

export class LayerManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    // Z-index manager
    this.zManager = new ZIndexManager();

    // Create layers
    this.layers = [
      new NoiseLayer(this.width, this.height),   // Layer 1
      new ImageLayer(this.width, this.height),   // Layer 2
      new CALayer(this.width, this.height)       // Layer 3
    ];

    // Pass z-manager to ImageLayer
    this.layers[1].setZManager(this.zManager);

    // State
    this.selectedLayer = 0;  // 0-indexed
    this.blend = 0.0;        // 0.0 to 1.0
    this.speed = 30;
    this.running = false;
    this._raf = null;
    this._lastFrame = 0;
  }

  /**
   * Get layer by number (1-indexed for CLI)
   */
  getLayer(num) {
    return this.layers[num - 1] || null;
  }

  /**
   * Select layer (1-indexed)
   */
  selectLayer(num) {
    if (num >= 1 && num <= 3) {
      this.selectedLayer = num - 1;
      return true;
    }
    return false;
  }

  /**
   * Get selected layer
   */
  getSelectedLayer() {
    return this.layers[this.selectedLayer];
  }

  /**
   * Get selected layer number (1-indexed)
   */
  getSelectedLayerNum() {
    return this.selectedLayer + 1;
  }

  /**
   * Set blend position (0.0 to 1.0)
   */
  setBlend(value) {
    this.blend = Math.max(0, Math.min(1, value));
  }

  /**
   * Calculate layer opacities from blend value
   * Simple: blend directly controls which layer is visible
   * 0 = L1, 0.5 = L2, 1 = L3
   */
  _calculateOpacities() {
    const b = this.blend;

    // At the three key points:
    // b=0: [1,0,0], b=0.5: [0,1,0], b=1: [0,0,1]
    if (b <= 0.5) {
      const t = b * 2;  // 0→1 as b goes 0→0.5
      return [1 - t, t, 0];
    } else {
      const t = (b - 0.5) * 2;  // 0→1 as b goes 0.5→1
      return [0, 1 - t, t];
    }
  }

  /**
   * Debug: log what's visible
   */
  _debugBlend() {
    const o = this._calculateOpacities();
    console.log(`blend=${this.blend}: L1=${o[0].toFixed(2)} L2=${o[1].toFixed(2)} L3=${o[2].toFixed(2)}`);
  }

  /**
   * Composite all layers
   */
  render() {
    const opacities = this._calculateOpacities();

    // Fill with black first
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Render each layer with its opacity
    this.layers.forEach((layer, i) => {
      if (opacities[i] > 0.01) {
        this.ctx.globalAlpha = opacities[i];
        layer.render(this.ctx);
      }
    });

    this.ctx.globalAlpha = 1;
  }

  /**
   * Update all layers (animation tick)
   */
  update(deltaTime) {
    this.layers.forEach(layer => {
      if (layer.update) {
        layer.update(deltaTime);
      }
    });
  }

  /**
   * Animation loop
   */
  _animate(timestamp) {
    if (!this.running) return;

    const deltaTime = timestamp - this._lastFrame;
    const frameInterval = 1000 / this.speed;

    if (deltaTime >= frameInterval) {
      this.update(deltaTime);
      this.render();
      this._lastFrame = timestamp - (deltaTime % frameInterval);
    }

    this._raf = requestAnimationFrame((t) => this._animate(t));
  }

  /**
   * Start animation
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._lastFrame = performance.now();
    this._animate(this._lastFrame);
  }

  /**
   * Stop animation
   */
  stop() {
    this.running = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  /**
   * Resize layers
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.layers.forEach(layer => layer.resize(width, height));
    this.render();
  }

  /**
   * Get full config
   */
  getConfig() {
    return {
      blend: this.blend,
      speed: this.speed,
      selectedLayer: this.selectedLayer + 1,
      layers: this.layers.map((layer, i) => ({
        num: i + 1,
        type: layer.type,
        ...layer.getConfig()
      }))
    };
  }

  /**
   * Set config
   */
  setConfig(config) {
    if (config.blend !== undefined) this.setBlend(config.blend);
    if (config.speed !== undefined) this.speed = config.speed;
    if (config.selectedLayer !== undefined) this.selectLayer(config.selectedLayer);

    if (config.layers) {
      config.layers.forEach((layerConfig, i) => {
        if (this.layers[i]) {
          this.layers[i].setConfig(layerConfig);
        }
      });
    }

    this.render();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    this.layers.forEach(layer => layer.destroy && layer.destroy());
  }

  // === Z-Index API ===

  /**
   * Set layer z-index
   */
  setLayerZ(layerNum, value) {
    return this.zManager.setLayerZ(layerNum, value);
  }

  /**
   * Set element z-index within a layer
   */
  setElementZ(layerNum, element, offset) {
    return this.zManager.setElementZ(layerNum, element, offset);
  }

  /**
   * Get z-index for layer or element
   */
  getZ(layerNum, element = null) {
    return this.zManager.getZ(layerNum, element);
  }

  /**
   * Get z-index manager
   */
  getZManager() {
    return this.zManager;
  }
}

export default LayerManager;
