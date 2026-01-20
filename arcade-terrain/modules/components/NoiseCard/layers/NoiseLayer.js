/**
 * NoiseLayer - Layer 1: Procedural noise generators
 *
 * Types: random, perlin, simplex, worley, scanlines, grid
 */

import { NoiseGenerators } from '../../../services/noise/generators.js';

export class NoiseLayer {
  constructor(width, height) {
    this.type = 'noise';
    this.width = width;
    this.height = height;

    // Offscreen canvas for this layer
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    // Config
    this.config = {
      noiseType: 'random',
      scale: 0.02,
      blockSize: 1,  // Pixel size: 1 = 1x1, 10 = 10x10 chunky pixels
      colors: ['#000000', '#ffffff'],
      seed: Math.random() * 1000,
      churn: 1,   // 0-1: fraction of pixels that update per simulation step
      fade: 0,    // 0-1: blend with previous when updating (0 = instant, 0.9 = heavy trail)
      rate: 30    // simulation updates per second (0.01 = very slow, 60 = every frame)
    };

    // Previous frame buffer for fade blending
    this._prevData = null;

    // Time accumulator for sub-frame rate updates
    this._timeAccum = 0;

    this.imageData = this.ctx.createImageData(width, height);
    this._generate();
  }

  /**
   * Generate noise to imageData
   */
  _generate() {
    const { noiseType, scale, blockSize, colors, seed, churn, fade } = this.config;
    const data = this.imageData.data;
    const block = Math.max(1, Math.floor(blockSize));
    const hasPrev = this._prevData !== null;

    // Parse colors
    const parsedColors = colors.map(c => this._parseColor(c));

    // Pre-compute block decisions for churn (so all pixels in a block share the same decision)
    const blocksX = Math.ceil(this.width / block);
    const blocksY = Math.ceil(this.height / block);
    const blockUpdates = new Array(blocksX * blocksY);
    for (let i = 0; i < blockUpdates.length; i++) {
      blockUpdates[i] = Math.random() < churn;
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = (y * this.width + x) * 4;

        // Sample at block-aligned coordinates for chunky pixels
        const bx = Math.floor(x / block);
        const by = Math.floor(y / block);
        const blockIdx = by * blocksX + bx;
        const shouldUpdate = blockUpdates[blockIdx];

        // If not updating and we have previous data, keep old block value
        if (hasPrev && !shouldUpdate) {
          data[i]     = this._prevData[i];
          data[i + 1] = this._prevData[i + 1];
          data[i + 2] = this._prevData[i + 2];
          data[i + 3] = 255;
          continue;
        }

        // Get noise value at block-aligned position
        const sampleX = bx * block;
        const sampleY = by * block;

        let value;
        try {
          if (noiseType === 'perlin' && NoiseGenerators.perlin) {
            value = NoiseGenerators.perlin(sampleX, sampleY, scale, 4, 0.5, seed);
          } else if (noiseType === 'simplex' && NoiseGenerators.simplex) {
            value = NoiseGenerators.simplex(sampleX, sampleY, scale, seed);
          } else if (noiseType === 'worley' && NoiseGenerators.worley) {
            value = NoiseGenerators.worley(sampleX, sampleY, Math.floor(1 / scale), seed);
          } else if (noiseType === 'scanlines' && NoiseGenerators.scanlines) {
            value = NoiseGenerators.scanlines(sampleX, sampleY, 2 * block, seed);
          } else if (noiseType === 'grid' && NoiseGenerators.grid) {
            value = NoiseGenerators.grid(sampleX, sampleY, 3 * block, seed);
          } else {
            // Default: random noise
            value = NoiseGenerators.random(sampleX, sampleY, seed);
          }
        } catch (e) {
          value = Math.random();
        }

        value = Math.max(0, Math.min(1, value || 0));
        const color = this._valueToColor(value, parsedColors);

        // Apply fade blending at block level
        if (hasPrev && fade > 0) {
          const f = fade;
          data[i]     = Math.floor(color.r * (1 - f) + this._prevData[i] * f);
          data[i + 1] = Math.floor(color.g * (1 - f) + this._prevData[i + 1] * f);
          data[i + 2] = Math.floor(color.b * (1 - f) + this._prevData[i + 2] * f);
        } else {
          data[i] = color.r;
          data[i + 1] = color.g;
          data[i + 2] = color.b;
        }
        data[i + 3] = 255;
      }
    }

    // Store current frame for next frame's blending
    if (churn < 1 || fade > 0) {
      this._prevData = new Uint8ClampedArray(data);
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  _parseColor(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      };
    }
    // Short hex
    const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (short) {
      return {
        r: parseInt(short[1] + short[1], 16),
        g: parseInt(short[2] + short[2], 16),
        b: parseInt(short[3] + short[3], 16)
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  _valueToColor(value, colors) {
    if (colors.length === 1) return colors[0];
    if (colors.length === 2) {
      const t = value;
      return {
        r: Math.floor(colors[0].r + (colors[1].r - colors[0].r) * t),
        g: Math.floor(colors[0].g + (colors[1].g - colors[0].g) * t),
        b: Math.floor(colors[0].b + (colors[1].b - colors[0].b) * t)
      };
    }
    // Multi-color gradient
    const segment = value * (colors.length - 1);
    const i = Math.floor(segment);
    const t = segment - i;
    const c1 = colors[Math.min(i, colors.length - 1)];
    const c2 = colors[Math.min(i + 1, colors.length - 1)];
    return {
      r: Math.floor(c1.r + (c2.r - c1.r) * t),
      g: Math.floor(c1.g + (c2.g - c1.g) * t),
      b: Math.floor(c1.b + (c2.b - c1.b) * t)
    };
  }

  /**
   * Render to target context
   */
  render(ctx) {
    ctx.drawImage(this.canvas, 0, 0);
  }

  /**
   * Update (regenerate with new seed for animation)
   * Uses rate to control simulation speed independent of render FPS
   */
  update(deltaTime) {
    const rate = this.config.rate || 30;

    // Accumulate time and check if we should update simulation
    this._timeAccum += deltaTime;
    const updateInterval = 1000 / rate;  // ms between simulation updates

    if (this._timeAccum >= updateInterval) {
      // How many simulation steps to run (usually 1, but catches up if lagging)
      const steps = Math.floor(this._timeAccum / updateInterval);
      this._timeAccum -= steps * updateInterval;

      // Update seed and regenerate
      this.config.seed += 0.1 * steps;
      this._generate();
    }
  }

  /**
   * Resize
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.imageData = this.ctx.createImageData(width, height);
    this._prevData = null;  // Clear persistence buffer on resize
    this._generate();
  }

  /**
   * Get config
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Set config
   */
  setConfig(config) {
    // Clear buffer if effects are turned off
    if ((config.churn !== undefined && config.churn >= 1) &&
        (config.fade !== undefined && config.fade <= 0)) {
      this._prevData = null;
    }
    Object.assign(this.config, config);
    this._generate();
  }

  /**
   * Get available noise types
   */
  static getTypes() {
    return ['random', 'perlin', 'simplex', 'worley', 'scanlines', 'grid'];
  }
}

export default NoiseLayer;
