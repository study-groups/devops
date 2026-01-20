/**
 * NoiseRenderer
 * Canvas-based noise rendering with animation support
 */

import { NoiseGenerators } from './generators.js';
import { CellularAutomata } from './cellular.js';

const DEFAULTS = {
  type: 'random',
  scale: 0.1,
  speed: 0,
  blend: 0.15,
  blendMode: 'overlay',
  resolution: 0.5,
  colors: ['#000000', '#ffffff'],
  cellSize: 32,
  lineHeight: 2,
  rule: 30,
  glitch: false,
  direction: null
};

export class NoiseRenderer {
  constructor(element, config = {}) {
    this.element = element;
    this.config = { ...DEFAULTS, ...config };
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.timeoutId = null;
    this.time = 0;
    this.lastRender = 0;
    this._parsedColors = [];

    this._init();
  }

  _init() {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'noise-canvas';
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Parse colors
    this._updateColors();

    // Size to element
    this._resize();

    // Style canvas
    const position = getComputedStyle(this.element).position;
    if (position === 'static') {
      this.element.style.position = 'relative';
    }

    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      opacity: ${this.config.blend};
      mix-blend-mode: ${this.config.blendMode};
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    `;

    // Insert as first child (behind content)
    this.element.insertBefore(this.canvas, this.element.firstChild);

    // Handle resize
    this._resizeObserver = new ResizeObserver(() => {
      this._resize();
      if (this.config.speed === 0) {
        this.render();
      }
    });
    this._resizeObserver.observe(this.element);

    // Initial render
    this.render();

    // Start animation if needed
    if (this.config.speed > 0) {
      this.start();
    }
  }

  _resize() {
    const rect = this.element.getBoundingClientRect();
    const scale = this.config.resolution;
    this.canvas.width = Math.max(1, Math.floor(rect.width * scale));
    this.canvas.height = Math.max(1, Math.floor(rect.height * scale));
  }

  _updateColors() {
    this._parsedColors = this.config.colors.map(c => this._parseColor(c));
  }

  render() {
    const { width, height } = this.canvas;
    if (width === 0 || height === 0) return;

    const imageData = this.ctx.createImageData(width, height);
    const data = imageData.data;

    // Generate noise based on type
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = this._getValue(x, y, this.time);
        const color = this._getColor(value);
        const idx = (y * width + x) * 4;
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = 255;
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  _getValue(x, y, time) {
    const { type, scale, rule, cellSize, lineHeight, glitch, direction } = this.config;

    // Apply direction offset for scrolling effects
    let offsetX = 0, offsetY = 0;
    if (direction === 'down') {
      offsetY = time * 2;
    } else if (direction === 'up') {
      offsetY = -time * 2;
    } else if (direction === 'left') {
      offsetX = -time * 2;
    } else if (direction === 'right') {
      offsetX = time * 2;
    }

    const px = x + offsetX;
    const py = y + offsetY;

    switch (type) {
      case 'random':
        return NoiseGenerators.random(px + time * 100, py + time * 50);

      case 'perlin':
        return NoiseGenerators.perlin(px + time * 10, py, scale);

      case 'simplex':
        return NoiseGenerators.simplex(px + time * 5, py + time * 5, scale);

      case 'worley':
        return NoiseGenerators.worley(px, py, cellSize);

      case 'cellular':
        return CellularAutomata.getValue(
          Math.floor(px),
          Math.floor(py + time),
          rule
        );

      case 'scanlines':
        return NoiseGenerators.scanlines(px, py, lineHeight, glitch && time % 10 < 2);

      case 'grid':
        return NoiseGenerators.grid(px, py, cellSize);

      default:
        return Math.random();
    }
  }

  _getColor(value) {
    const colors = this._parsedColors;
    if (colors.length === 0) return { r: 0, g: 0, b: 0 };
    if (colors.length === 1) return colors[0];

    // Map value to color gradient
    const idx = value * (colors.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.min(lower + 1, colors.length - 1);
    const t = idx - lower;

    const c1 = colors[lower];
    const c2 = colors[upper];

    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
  }

  _parseColor(hex) {
    // Handle shorthand (#abc -> #aabbcc)
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return { r, g, b };
  }

  start() {
    if (this.animationId || this.timeoutId) return;

    const fps = this.config.speed;
    const frameTime = 1000 / fps;

    const loop = () => {
      const now = performance.now();
      if (now - this.lastRender >= frameTime) {
        this.time += 1;
        this.render();
        this.lastRender = now;
      }
      this.animationId = requestAnimationFrame(loop);
    };

    this.lastRender = performance.now();
    loop();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Update configuration
   */
  setConfig(newConfig) {
    const oldSpeed = this.config.speed;
    Object.assign(this.config, newConfig);

    // Update canvas styles if blend changed
    if ('blend' in newConfig) {
      this.canvas.style.opacity = this.config.blend;
    }
    if ('blendMode' in newConfig) {
      this.canvas.style.mixBlendMode = this.config.blendMode;
    }

    // Update colors if changed
    if ('colors' in newConfig) {
      this._updateColors();
    }

    // Update resolution if changed
    if ('resolution' in newConfig) {
      this._resize();
    }

    // Handle animation state changes
    if (this.config.speed > 0 && !this.animationId) {
      this.start();
    } else if (this.config.speed === 0 && this.animationId) {
      this.stop();
      this.render(); // Final static render
    }

    // Re-render if static
    if (this.config.speed === 0) {
      this.render();
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Reset time counter
   */
  resetTime() {
    this.time = 0;
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.stop();
    this._resizeObserver?.disconnect();
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
}

export default NoiseRenderer;
