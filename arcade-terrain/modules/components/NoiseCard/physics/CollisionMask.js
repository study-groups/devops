/**
 * CollisionMask - Rasterized collision detection for SVG paths
 *
 * Renders SVG paths to a low-resolution bitmap for fast hit testing.
 * Particles can query this mask to detect collisions with letter shapes.
 */

// SVG path data for ARCADE letters (from svg-defs.svg)
// Full logo includes: A, R, I, colon-top, colon-bottom, C, A2, D, E
export const LETTER_PATHS = {
  A: 'M28,20L12,20L12,28L0,28L-0,0L28,-0L28,20ZM24,4L4,4L4,24L8,24L8,16L24,16L24,4Z',
  R: 'M60,8L64,8L64,0L76,-0L76,12L68,12L68,16L76,16L76,28L64,28L64,20L60,20L60,28L48,28L48,16L56,16L56,12L48,12L48,0L60,-0L60,8ZM56,8L56,4L52,4L52,8L56,8ZM60,16L64,16L64,12L60,12L60,16ZM56,20L52,20L52,24L56,24L56,20ZM68,20L68,24L72,24L72,20L68,20ZM68,8L72,8L72,4L68,4L68,8Z',
  I: 'M44,28L32,28L32,0L44,-0L44,28ZM40,4L36,4L36,24L40,24L40,4Z',
  COLON_TOP: 'M108,12L80,12L80,0L108,-0L108,12ZM104,4L84,4L84,8L104,8L104,4Z',
  COLON_BOT: 'M108,28L80,28L80,16L108,16L108,28ZM104,20L84,20L84,24L104,24L104,20Z',
  C: 'M124,16L140,16L140,28L112,28L112,0L124,-0L124,16ZM120,18L120,4L116,4L116,24L136,24L136,20L120,20L120,18Z',
  A2: 'M160,16L160,0L172,-0L172,28L144,28L144,16L160,16ZM162,20L148,20L148,24L168,24L168,4L164,4L164,20L162,20Z',
  D: 'M204,28L192,28L192,20L188,20L188,28L176,28L176,0L204,-0L204,28ZM200,4L180,4L180,24L184,24L184,16L196,16L196,24L200,24L200,4Z',
  E: 'M228,8L232,8L232,0L252,-0L252,28L240,28L240,20L236,20L236,28L224,28L224,20L220,20L220,28L208,28L208,0L228,-0L228,8ZM224,10L224,4L212,4L212,24L216,24L216,16L228,16L228,24L232,24L232,16L244,16L244,24L248,24L248,4L236,4L236,12L224,12L224,10Z'
};

// Letter bounds within the SVG viewBox (0 0 252 28) - main logo only
export const LETTER_BOUNDS = {
  A:  { x: 0,   y: 0, w: 28, h: 28 },
  I:  { x: 32,  y: 0, w: 12, h: 28 },
  R:  { x: 48,  y: 0, w: 28, h: 28 },
  COLON_TOP: { x: 80, y: 0, w: 28, h: 12 },
  COLON_BOT: { x: 80, y: 16, w: 28, h: 12 },
  C:  { x: 112, y: 0, w: 28, h: 28 },
  A2: { x: 144, y: 0, w: 28, h: 28 },
  D:  { x: 176, y: 0, w: 28, h: 28 },
  E:  { x: 208, y: 0, w: 44, h: 28 }
};

// Full SVG dimensions - main logo "ARI:CADE" only (not lowercase subtitle)
export const SVG_VIEWBOX = { x: 0, y: 0, width: 252, height: 28 };

export class CollisionMask {
  constructor(width = 126, height = 14) {
    this.width = width;
    this.height = height;

    // Create offscreen canvas for collision testing
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    // Collision data as Uint8Array for fast lookup
    this.data = null;

    // Per-letter masks for detecting which letter was hit
    this.letterMasks = {};
  }

  /**
   * Rasterize all letter paths to collision mask
   */
  rasterize(paths = LETTER_PATHS) {
    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Scale factor from SVG viewBox to canvas
    const scaleX = this.width / SVG_VIEWBOX.width;
    const scaleY = this.height / SVG_VIEWBOX.height;

    this.ctx.save();
    this.ctx.scale(scaleX, scaleY);

    // Draw all paths in white
    this.ctx.fillStyle = '#ffffff';
    for (const pathData of Object.values(paths)) {
      const path = new Path2D(pathData);
      this.ctx.fill(path);
    }

    this.ctx.restore();

    // Extract to Uint8Array (red channel, since we drew white)
    const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    this.data = new Uint8Array(this.width * this.height);
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = imageData.data[i * 4]; // Red channel
    }

    // Build per-letter masks
    this._buildLetterMasks(paths);
  }

  /**
   * Build individual masks for each letter
   */
  _buildLetterMasks(paths) {
    const scaleX = this.width / SVG_VIEWBOX.width;
    const scaleY = this.height / SVG_VIEWBOX.height;

    for (const [letter, pathData] of Object.entries(paths)) {
      // Clear
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Draw single letter
      this.ctx.save();
      this.ctx.scale(scaleX, scaleY);
      this.ctx.fillStyle = '#ffffff';
      const path = new Path2D(pathData);
      this.ctx.fill(path);
      this.ctx.restore();

      // Extract
      const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
      const mask = new Uint8Array(this.width * this.height);
      for (let i = 0; i < mask.length; i++) {
        mask[i] = imageData.data[i * 4];
      }
      this.letterMasks[letter] = mask;
    }

    // Restore full mask to canvas (without recursion)
    this._renderFullMask(paths);
  }

  /**
   * Render all paths to canvas (no recursion)
   */
  _renderFullMask(paths) {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.width, this.height);

    const scaleX = this.width / SVG_VIEWBOX.width;
    const scaleY = this.height / SVG_VIEWBOX.height;

    this.ctx.save();
    this.ctx.scale(scaleX, scaleY);
    this.ctx.fillStyle = '#ffffff';

    for (const pathData of Object.values(paths)) {
      const path = new Path2D(pathData);
      this.ctx.fill(path);
    }

    this.ctx.restore();
  }

  /**
   * Test if a normalized point (0-1) is inside any letter
   * @param {number} x - X position (0-1)
   * @param {number} y - Y position (0-1)
   * @returns {boolean} True if point is inside a letter
   */
  test(x, y) {
    if (!this.data) return false;

    const px = Math.floor(x * this.width);
    const py = Math.floor(y * this.height);

    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return false;
    }

    return this.data[py * this.width + px] > 128;
  }

  /**
   * Get which letter (if any) contains the point
   * @param {number} x - X position (0-1)
   * @param {number} y - Y position (0-1)
   * @returns {string|null} Letter name or null
   */
  testLetter(x, y) {
    const px = Math.floor(x * this.width);
    const py = Math.floor(y * this.height);

    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return null;
    }

    const idx = py * this.width + px;

    for (const [letter, mask] of Object.entries(this.letterMasks)) {
      if (mask[idx] > 128) {
        return letter;
      }
    }

    return null;
  }

  /**
   * Sample solid pixels from a letter shape
   * @param {string} letter - Letter name (A, R, C, A2, D, E)
   * @param {number} count - Number of points to sample
   * @returns {Array<{x: number, y: number}>} Normalized positions
   */
  sampleLetter(letter, count) {
    const mask = this.letterMasks[letter];
    if (!mask) return [];

    // Find all solid pixels
    const solidPixels = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (mask[y * this.width + x] > 128) {
          solidPixels.push({
            x: x / this.width,
            y: y / this.height
          });
        }
      }
    }

    if (solidPixels.length === 0) return [];

    // Random sample
    const samples = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * solidPixels.length);
      samples.push({ ...solidPixels[idx] });
    }

    return samples;
  }

  /**
   * Sample all letters combined
   * @param {number} count - Total points to sample
   * @returns {Array<{x: number, y: number}>} Normalized positions
   */
  sampleAll(count) {
    if (!this.data) return [];

    // Find all solid pixels
    const solidPixels = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.data[y * this.width + x] > 128) {
          solidPixels.push({
            x: x / this.width,
            y: y / this.height
          });
        }
      }
    }

    if (solidPixels.length === 0) return [];

    // Random sample
    const samples = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * solidPixels.length);
      samples.push({ ...solidPixels[idx] });
    }

    return samples;
  }

  /**
   * Get debug canvas for visualization
   */
  getDebugCanvas() {
    return this.canvas;
  }
}

export default CollisionMask;
