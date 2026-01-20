/**
 * Cymatics - Wave interference patterns from point oscillators
 *
 * Each oscillator emits circular waves that interfere with others.
 * The resulting pattern shows constructive/destructive interference.
 */

export class Cymatics {
  constructor(width, height) {
    this.width = width;
    this.height = height;

    // 3 point oscillators with default positions (triangle formation)
    this.oscillators = [
      { x: 0.5, y: 0.3, freq: 0.05, amp: 1.0, phase: 0 },
      { x: 0.25, y: 0.7, freq: 0.05, amp: 1.0, phase: 0 },
      { x: 0.75, y: 0.7, freq: 0.05, amp: 1.0, phase: 0 }
    ];

    this.time = 0;
    this.speed = 0.1;
  }

  /**
   * Set oscillator parameters
   * @param {number} index - Oscillator index (0-2)
   * @param {object} params - { x, y, freq, amp }
   */
  setOscillator(index, params) {
    if (index < 0 || index > 2) return;
    Object.assign(this.oscillators[index], params);
  }

  /**
   * Get oscillator parameters
   */
  getOscillator(index) {
    return { ...this.oscillators[index] };
  }

  /**
   * Calculate wave value at a point
   * Returns -1 to 1 (sum of all oscillator contributions)
   */
  getValue(px, py) {
    let sum = 0;

    for (const osc of this.oscillators) {
      // Convert normalized coords to pixels
      const ox = osc.x * this.width;
      const oy = osc.y * this.height;

      // Distance from oscillator
      const dx = px - ox;
      const dy = py - oy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Wave: sin(distance * frequency - time + phase)
      // Amplitude falls off with distance
      const falloff = 1 / (1 + dist * 0.01);
      const wave = Math.sin(dist * osc.freq - this.time + osc.phase);

      sum += wave * osc.amp * falloff;
    }

    // Normalize to -1 to 1 range
    return Math.tanh(sum);
  }

  /**
   * Render to a grid (Uint8Array values 0-7 for color mapping)
   */
  render(cellSize) {
    const cols = Math.ceil(this.width / cellSize);
    const rows = Math.ceil(this.height / cellSize);
    const grid = [];

    for (let y = 0; y < rows; y++) {
      grid[y] = new Uint8Array(cols);
      for (let x = 0; x < cols; x++) {
        const px = x * cellSize + cellSize / 2;
        const py = y * cellSize + cellSize / 2;
        const val = this.getValue(px, py);
        // Map -1..1 to 0..7
        grid[y][x] = Math.floor((val + 1) * 3.5);
      }
    }

    return grid;
  }

  /**
   * Advance time
   */
  update(deltaTime) {
    this.time += this.speed;
  }

  /**
   * Reset time
   */
  reset() {
    this.time = 0;
  }

  /**
   * Resize
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
}

export default Cymatics;
