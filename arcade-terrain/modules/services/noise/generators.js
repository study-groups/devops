/**
 * Noise Generation Algorithms
 * Pure functions for generating noise values
 */

export const NoiseGenerators = {
  /**
   * Simple random noise (TV static)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} seed - Random seed offset
   * @returns {number} Value between 0 and 1
   */
  random(x, y, seed = 0) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
  },

  /**
   * Perlin-style value noise (smooth gradients)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} scale - Frequency scale
   * @param {number} octaves - Number of noise layers
   * @param {number} persistence - Amplitude falloff per octave
   * @param {number} seed - Animation seed offset
   * @returns {number} Value between 0 and 1
   */
  perlin(x, y, scale = 0.1, octaves = 4, persistence = 0.5, seed = 0) {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this._interpolatedNoise(x * frequency, y * frequency, seed) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  },

  /**
   * Worley/cellular noise (cell-like patterns)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} cellSize - Size of each cell
   * @param {number} seed - Animation seed offset
   * @returns {number} Value between 0 and 1
   */
  worley(x, y, cellSize = 32, seed = 0) {
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    let minDist = Infinity;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cellX + dx;
        const ny = cellY + dy;
        // Deterministic random point per cell with seed for animation
        const px = (nx + 0.5 + this.random(nx, ny, seed + 1) * 0.5) * cellSize;
        const py = (ny + 0.5 + this.random(nx, ny, seed + 2) * 0.5) * cellSize;
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        minDist = Math.min(minDist, dist);
      }
    }

    return Math.min(minDist / cellSize, 1);
  },

  /**
   * Simplex-like gradient noise
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} scale - Frequency scale
   * @param {number} seed - Animation seed offset
   * @returns {number} Value between 0 and 1
   */
  simplex(x, y, scale = 0.05, seed = 0) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    x *= scale;
    y *= scale;

    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);

    // Gradient contribution with seed for animation
    return (this._grad(i, j, x0, y0, seed) + 1) / 2;
  },

  /**
   * Scanline pattern with optional glitch
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} lineHeight - Height of each scanline
   * @param {number} seed - Animation seed (shifts scanlines)
   * @returns {number} Value between 0 and 1
   */
  scanlines(x, y, lineHeight = 2, seed = 0) {
    // Add seed-based offset for animation
    const offset = Math.floor(seed) % (lineHeight * 2);
    // Add glitch based on seed
    let glitchOffset = 0;
    if (this.random(0, Math.floor(y / 16), seed) > 0.95) {
      glitchOffset = Math.floor(this.random(x, y, seed) * 6) - 3;
    }
    return ((y + offset + glitchOffset) % (lineHeight * 2)) < lineHeight ? 0.3 : 1;
  },

  /**
   * Grid pattern for LCD effect
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} cellSize - Size of grid cells
   * @param {number} seed - Animation seed (adds flicker)
   * @returns {number} Value between 0 and 1
   */
  grid(x, y, cellSize = 3, seed = 0) {
    const inCell = (x % cellSize) > 0 && (y % cellSize) > 0;
    // Add subtle flicker based on seed
    const flicker = this.random(Math.floor(x / cellSize), Math.floor(y / cellSize), seed);
    const brightness = inCell ? (0.9 + flicker * 0.1) : (0.25 + flicker * 0.1);
    return Math.min(1, brightness);
  },

  // Internal helpers
  _interpolatedNoise(x, y, seed = 0) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const v1 = this.random(ix, iy, seed);
    const v2 = this.random(ix + 1, iy, seed);
    const v3 = this.random(ix, iy + 1, seed);
    const v4 = this.random(ix + 1, iy + 1, seed);

    const i1 = this._lerp(v1, v2, this._smoothstep(fx));
    const i2 = this._lerp(v3, v4, this._smoothstep(fx));

    return this._lerp(i1, i2, this._smoothstep(fy));
  },

  _lerp(a, b, t) {
    return a + (b - a) * t;
  },

  _smoothstep(t) {
    return t * t * (3 - 2 * t);
  },

  _grad(ix, iy, x, y, seed = 0) {
    const h = (this.random(ix, iy, seed) * 4) | 0;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }
};

export default NoiseGenerators;
