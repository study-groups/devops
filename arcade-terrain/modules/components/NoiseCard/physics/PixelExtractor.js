/**
 * PixelExtractor - Generic SVG-to-pixel rasterizer
 *
 * Converts SVG paths to colored pixel data for particle effects.
 * Only extracts visible (non-transparent) pixels.
 */

import { LETTER_PATHS, SVG_VIEWBOX } from './CollisionMask.js';

export class PixelExtractor {
  constructor() {
    // Offscreen canvas for rasterization
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Extract visible pixels from SVG paths
   * @param {Object} paths - Letter paths object { letter: pathData }
   * @param {string} fillColor - Color to render paths (e.g., '#616161')
   * @param {number} resolution - Pixels per SVG unit (higher = more pixels)
   * @returns {Array<{x: number, y: number, color: number}>} Pixel data with normalized coords
   */
  extract(paths = LETTER_PATHS, fillColor = '#616161', resolution = 0.5) {
    const width = Math.floor(SVG_VIEWBOX.width * resolution);
    const height = Math.floor(SVG_VIEWBOX.height * resolution);

    this.canvas.width = width;
    this.canvas.height = height;

    // Clear with transparent
    this.ctx.clearRect(0, 0, width, height);

    // Scale to fit
    this.ctx.save();
    this.ctx.scale(resolution, resolution);

    // Draw all paths with the fill color
    this.ctx.fillStyle = fillColor;
    for (const pathData of Object.values(paths)) {
      const path = new Path2D(pathData);
      this.ctx.fill(path);
    }

    this.ctx.restore();

    // Extract pixel data
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const pixels = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        // Only include visible pixels (alpha > threshold)
        if (a > 32) {
          pixels.push({
            x: x / width,        // Normalized 0-1
            y: y / height,       // Normalized 0-1
            color: (r << 24) | (g << 16) | (b << 8) | a  // Packed RGBA
          });
        }
      }
    }

    return pixels;
  }

  /**
   * Extract pixels for pixelation effect (lower resolution, blocky)
   * @param {Object} paths - Letter paths
   * @param {string} fillColor - Color
   * @param {number} blockSize - Size of each pixel block in SVG units
   * @returns {Array<{x, y, color, size}>} Pixel blocks with size info
   */
  extractBlocks(paths = LETTER_PATHS, fillColor = '#616161', blockSize = 2) {
    // Calculate dimensions based on block size
    const blocksX = Math.ceil(SVG_VIEWBOX.width / blockSize);
    const blocksY = Math.ceil(SVG_VIEWBOX.height / blockSize);

    this.canvas.width = blocksX;
    this.canvas.height = blocksY;

    // Clear
    this.ctx.clearRect(0, 0, blocksX, blocksY);

    // Scale down to block resolution
    this.ctx.save();
    this.ctx.scale(blocksX / SVG_VIEWBOX.width, blocksY / SVG_VIEWBOX.height);

    // Draw paths
    this.ctx.fillStyle = fillColor;
    for (const pathData of Object.values(paths)) {
      const path = new Path2D(pathData);
      this.ctx.fill(path);
    }

    this.ctx.restore();

    // Extract blocks
    const imageData = this.ctx.getImageData(0, 0, blocksX, blocksY);
    const blocks = [];

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const i = (by * blocksX + bx) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        if (a > 32) {
          blocks.push({
            x: bx / blocksX,
            y: by / blocksY,
            color: (r << 24) | (g << 16) | (b << 8) | 0xff,
            // Block size in normalized coords
            width: 1 / blocksX,
            height: 1 / blocksY
          });
        }
      }
    }

    return blocks;
  }

  /**
   * Get canvas for debug visualization
   */
  getDebugCanvas() {
    return this.canvas;
  }
}

export default PixelExtractor;
