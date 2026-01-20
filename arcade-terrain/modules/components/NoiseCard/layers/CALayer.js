/**
 * CALayer - Layer 3: Cellular Automata & Wave Patterns
 *
 * Types:
 *   wolfram  - 1D elementary CA (rules 0-255), displayed as 2D evolution
 *   life     - 2D Game of Life variants (B/S notation)
 *   cyclic   - Cyclic CA with configurable states
 *   cymatics - Wave interference from 3 point oscillators
 *
 * Colors map to cell values (0-7)
 */

import { CellularAutomata } from '../../../services/noise/cellular.js';
import { Cymatics } from './Cymatics.js';

// Preset rules for each CA type
const WOLFRAM_PRESETS = {
  chaos: { rule: 30, description: 'Chaotic - random number generation' },
  sierpinski: { rule: 90, description: 'Sierpinski triangle fractal' },
  turing: { rule: 110, description: 'Turing complete - complex structures' },
  traffic: { rule: 184, description: 'Traffic flow simulation' },
  pascal: { rule: 60, description: "Pascal's triangle mod 2" },
  xor: { rule: 150, description: 'XOR fractal pattern' },
  nested: { rule: 54, description: 'Complex nested triangles' },
  stripes: { rule: 250, description: 'Diagonal stripe pattern' }
};

const LIFE_PRESETS = {
  conway: { birth: [3], survive: [2, 3], description: 'Classic Game of Life' },
  highlife: { birth: [3, 6], survive: [2, 3], description: 'Replicator patterns' },
  seeds: { birth: [2], survive: [], description: 'Explosive growth' },
  maze: { birth: [3], survive: [1, 2, 3, 4, 5], description: 'Maze-like patterns' },
  coral: { birth: [3], survive: [4, 5, 6, 7, 8], description: 'Coral growth' },
  amoeba: { birth: [3, 5, 7], survive: [1, 3, 5, 8], description: 'Amoeba-like' },
  daynight: { birth: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8], description: 'Symmetric growth' },
  morley: { birth: [3, 6, 8], survive: [2, 4, 5], description: 'Oscillating patterns' }
};

export class CALayer {
  constructor(width, height) {
    this.type = 'ca';
    this.width = width;
    this.height = height;

    // Offscreen canvases
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    // Config
    this.config = {
      caType: 'wolfram',     // wolfram, life, cyclic, cymatics
      rule: 30,              // For wolfram (0-255)
      preset: 'chaos',       // Named preset
      birth: [3],            // For life
      survive: [2, 3],       // For life
      states: 8,             // For cyclic
      threshold: 1,          // For cyclic
      cellSize: 4,
      colors: ['#0a0a0a', '#1a1a1a', '#2d2d2d', '#444444', '#666666', '#888888', '#aaaaaa', '#ffffff'],
      depth: 2,              // How many colors to use (2 = mono, 8 = full)
      density: 0.3,          // Initial density for life/cyclic
      direction: 'down',     // Scroll direction (wolfram)
      wrap: true,
      // Cymatics oscillators (x, y are 0-1 normalized)
      osc: [
        { x: 0.5, y: 0.3, freq: 0.05, amp: 1.0 },
        { x: 0.25, y: 0.7, freq: 0.05, amp: 1.0 },
        { x: 0.75, y: 0.7, freq: 0.05, amp: 1.0 }
      ],
      waveSpeed: 0.1
    };

    // State
    this._grid = null;       // Current state (2D array of ages 0-7)
    this._binary = null;     // Binary state for evolution
    this._currentRow = 0;
    this._generation = 0;
    this._cymatics = null;   // Cymatics engine

    this._init();
  }

  _init() {
    const cols = Math.ceil(this.width / this.config.cellSize);
    const rows = Math.ceil(this.height / this.config.cellSize);

    // Initialize based on CA type
    switch (this.config.caType) {
      case 'life':
        this._initLife(cols, rows);
        break;
      case 'cyclic':
        this._initCyclic(cols, rows);
        break;
      case 'cymatics':
        this._initCymatics();
        break;
      case 'wolfram':
      default:
        this._initWolfram(cols, rows);
        break;
    }

    this._render();
  }

  /**
   * Initialize Wolfram 1D CA
   */
  _initWolfram(cols, rows) {
    this._grid = [];
    this._binary = [];

    for (let y = 0; y < rows; y++) {
      this._grid[y] = new Uint8Array(cols);
      this._binary[y] = new Uint8Array(cols);
    }

    // First row - center cell on
    this._binary[0][Math.floor(cols / 2)] = 1;
    this._grid[0][Math.floor(cols / 2)] = 7; // Max age color

    // Evolve rows
    for (let y = 1; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const left = this._binary[y - 1][(x - 1 + cols) % cols];
        const center = this._binary[y - 1][x];
        const right = this._binary[y - 1][(x + 1) % cols];
        const pattern = (left << 2) | (center << 1) | right;
        const alive = (this.config.rule >> pattern) & 1;

        this._binary[y][x] = alive;

        // Age based on pattern complexity
        if (alive) {
          const neighbors = left + center + right;
          this._grid[y][x] = Math.min(7, neighbors + 4);
        }
      }
    }

    this._currentRow = rows;
  }

  /**
   * Initialize Game of Life 2D CA
   */
  _initLife(cols, rows) {
    this._grid = [];
    this._binary = [];

    for (let y = 0; y < rows; y++) {
      this._grid[y] = new Uint8Array(cols);
      this._binary[y] = new Uint8Array(cols);
      for (let x = 0; x < cols; x++) {
        const alive = Math.random() < this.config.density ? 1 : 0;
        this._binary[y][x] = alive;
        this._grid[y][x] = alive ? 7 : 0;
      }
    }

    this._generation = 0;
  }

  /**
   * Initialize Cyclic CA
   */
  _initCyclic(cols, rows) {
    this._grid = [];
    const { states } = this.config;

    for (let y = 0; y < rows; y++) {
      this._grid[y] = new Uint8Array(cols);
      for (let x = 0; x < cols; x++) {
        this._grid[y][x] = Math.floor(Math.random() * states);
      }
    }

    this._generation = 0;
  }

  /**
   * Initialize Cymatics wave pattern
   */
  _initCymatics() {
    this._cymatics = new Cymatics(this.width, this.height);
    this._cymatics.speed = this.config.waveSpeed;

    // Apply oscillator config
    for (let i = 0; i < 3; i++) {
      if (this.config.osc[i]) {
        this._cymatics.setOscillator(i, this.config.osc[i]);
      }
    }

    // Generate initial grid
    this._grid = this._cymatics.render(this.config.cellSize);
  }

  /**
   * Render grid to canvas using palette colors
   * depth controls how many colors are used (2 = binary, 8 = full gradient)
   */
  _render() {
    const { cellSize, colors, states, depth } = this.config;
    const rows = this._grid.length;
    const cols = this._grid[0]?.length || 0;
    const maxVal = this.config.caType === 'cyclic' ? states - 1 : 7;

    // Build color map based on depth (2-8)
    const useDepth = Math.max(2, Math.min(8, depth || 2));
    const colorMap = this._buildColorMap(colors, useDepth);

    // Clear with background color
    this.ctx.fillStyle = colorMap[0];
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (rows === 0 || cols === 0) return;

    // Draw cells - map value to color from depth-limited palette
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const val = this._grid[y][x];
        if (val > 0) {
          // Map value to depth range
          const idx = Math.floor((val / maxVal) * (useDepth - 1));
          this.ctx.fillStyle = colorMap[Math.min(idx, useDepth - 1)];
          this.ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  /**
   * Build a color map from palette based on depth
   * depth 2: [colors[0], colors[7]]
   * depth 4: [colors[0], colors[2], colors[5], colors[7]]
   * depth 8: all colors
   */
  _buildColorMap(colors, depth) {
    if (depth >= colors.length) return colors;

    const map = [];
    for (let i = 0; i < depth; i++) {
      const idx = Math.round((i / (depth - 1)) * (colors.length - 1));
      map.push(colors[idx]);
    }
    return map;
  }

  /**
   * Render to target context
   */
  render(ctx) {
    ctx.drawImage(this.canvas, 0, 0);
  }

  /**
   * Update/animate
   */
  update(deltaTime) {
    switch (this.config.caType) {
      case 'life':
        this._updateLife();
        break;
      case 'cyclic':
        this._updateCyclic();
        break;
      case 'cymatics':
        this._updateCymatics();
        break;
      case 'wolfram':
      default:
        this._updateWolfram();
        break;
    }
  }

  /**
   * Update Wolfram CA (scroll and generate new row)
   */
  _updateWolfram() {
    const { direction, cellSize } = this.config;
    if (direction === 'none') return;

    const imageData = this.ctx.getImageData(0, 0, this.width, this.height);

    if (direction === 'down' || direction === 'up') {
      const shift = direction === 'down' ? cellSize : -cellSize;
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.putImageData(imageData, 0, shift);

      if (direction === 'down') {
        this._generateWolframRow(0);
      } else {
        this._generateWolframRow(this.height - cellSize);
      }
    }
  }

  /**
   * Generate new Wolfram row
   */
  _generateWolframRow(yPos) {
    const { cellSize, colors, rule, depth } = this.config;
    const cols = Math.ceil(this.width / cellSize);
    const useDepth = Math.max(2, Math.min(8, depth || 2));
    const colorMap = this._buildColorMap(colors, useDepth);

    // Use foreground color (last in depth map) for on cells
    const fgColor = colorMap[useDepth - 1];
    this.ctx.fillStyle = fgColor;

    for (let x = 0; x < cols; x++) {
      const val = CellularAutomata.getValue(x, this._currentRow, rule, cols, 1000);
      if (val) {
        this.ctx.fillRect(x * cellSize, yPos, cellSize, cellSize);
      }
    }
    this._currentRow++;
  }

  /**
   * Update Game of Life
   */
  _updateLife() {
    const { birth, survive, colors } = this.config;
    const rows = this._grid.length;
    const cols = this._grid[0].length;

    const nextBinary = [];
    const nextGrid = [];

    for (let y = 0; y < rows; y++) {
      nextBinary[y] = new Uint8Array(cols);
      nextGrid[y] = new Uint8Array(cols);

      for (let x = 0; x < cols; x++) {
        const neighbors = this._countNeighbors(x, y, cols, rows);
        const alive = this._binary[y][x];
        const age = this._grid[y][x];

        let nextAlive = 0;
        if (alive) {
          nextAlive = survive.includes(neighbors) ? 1 : 0;
        } else {
          nextAlive = birth.includes(neighbors) ? 1 : 0;
        }

        nextBinary[y][x] = nextAlive;

        // Age cells - older = brighter
        if (nextAlive) {
          nextGrid[y][x] = Math.min(7, age + 1);
        } else if (age > 0) {
          // Fade dying cells
          nextGrid[y][x] = Math.max(0, age - 1);
        }
      }
    }

    this._binary = nextBinary;
    this._grid = nextGrid;
    this._generation++;
    this._render();
  }

  /**
   * Update Cyclic CA
   */
  _updateCyclic() {
    const { states, threshold } = this.config;
    const rows = this._grid.length;
    const cols = this._grid[0].length;

    const next = [];

    for (let y = 0; y < rows; y++) {
      next[y] = new Uint8Array(cols);

      for (let x = 0; x < cols; x++) {
        const current = this._grid[y][x];
        const successor = (current + 1) % states;

        // Count neighbors with successor state
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + cols) % cols;
            const ny = (y + dy + rows) % rows;
            if (this._grid[ny][nx] === successor) count++;
          }
        }

        // Advance if enough successor neighbors
        next[y][x] = count >= threshold ? successor : current;
      }
    }

    this._grid = next;
    this._generation++;
    this._render();
  }

  /**
   * Update Cymatics wave pattern
   */
  _updateCymatics() {
    if (!this._cymatics) return;
    this._cymatics.update();
    this._grid = this._cymatics.render(this.config.cellSize);
    this._render();
  }

  _countNeighbors(x, y, cols, rows) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + cols) % cols;
        const ny = (y + dy + rows) % rows;
        count += this._binary[ny][nx];
      }
    }
    return count;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this._init();
  }

  getConfig() {
    return { ...this.config };
  }

  setConfig(config) {
    const typeChanged = config.caType !== undefined && config.caType !== this.config.caType;
    const ruleChanged = config.rule !== undefined && config.rule !== this.config.rule;
    const presetChanged = config.preset !== undefined && config.preset !== this.config.preset;
    const sizeChanged = config.cellSize !== undefined && config.cellSize !== this.config.cellSize;
    const densityChanged = config.density !== undefined && config.density !== this.config.density;

    // Handle preset
    if (presetChanged && config.preset) {
      if (this.config.caType === 'wolfram' && WOLFRAM_PRESETS[config.preset]) {
        config.rule = WOLFRAM_PRESETS[config.preset].rule;
      } else if (this.config.caType === 'life' && LIFE_PRESETS[config.preset]) {
        config.birth = LIFE_PRESETS[config.preset].birth;
        config.survive = LIFE_PRESETS[config.preset].survive;
      }
    }

    Object.assign(this.config, config);

    if (typeChanged || ruleChanged || sizeChanged || presetChanged || densityChanged) {
      this._init();
    } else if (config.colors || config.depth !== undefined) {
      this._render();
    }
  }

  static getPresets(caType) {
    switch (caType) {
      case 'life': return LIFE_PRESETS;
      case 'wolfram': return WOLFRAM_PRESETS;
      default: return {};
    }
  }
}

export default CALayer;
