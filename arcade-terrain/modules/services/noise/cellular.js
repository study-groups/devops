/**
 * Cellular Automata Engine
 * Implements elementary CA rules (Wolfram) and 2D rules (Game of Life variants)
 */

export const CellularAutomata = {
  // Cache for generated grids
  _cache: new Map(),

  /**
   * Elementary 1D cellular automata (Rules 0-255)
   * Generates a 2D texture by evolving rows over time
   * @param {number} width - Grid width
   * @param {number} height - Grid height
   * @param {number} rule - Wolfram rule number (0-255)
   * @param {boolean} wrap - Wrap edges
   * @param {string} init - Initialization: 'center', 'random', 'left', 'right'
   * @returns {Uint8Array} Grid of 0s and 1s
   */
  elementary(width, height, rule = 30, wrap = true, init = 'center') {
    const cacheKey = `elem-${width}-${height}-${rule}-${wrap}-${init}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }

    const grid = new Uint8Array(width * height);

    // Initialize first row
    if (init === 'center') {
      grid[Math.floor(width / 2)] = 1;
    } else if (init === 'random') {
      for (let x = 0; x < width; x++) {
        grid[x] = Math.random() > 0.5 ? 1 : 0;
      }
    } else if (init === 'left') {
      grid[0] = 1;
    } else if (init === 'right') {
      grid[width - 1] = 1;
    }

    // Evolve each row
    for (let y = 1; y < height; y++) {
      const prevRow = y - 1;
      for (let x = 0; x < width; x++) {
        const left = wrap
          ? grid[prevRow * width + ((x - 1 + width) % width)]
          : (x > 0 ? grid[prevRow * width + x - 1] : 0);
        const center = grid[prevRow * width + x];
        const right = wrap
          ? grid[prevRow * width + ((x + 1) % width)]
          : (x < width - 1 ? grid[prevRow * width + x + 1] : 0);

        const pattern = (left << 2) | (center << 1) | right;
        grid[y * width + x] = (rule >> pattern) & 1;
      }
    }

    // Cache result
    if (this._cache.size > 50) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(cacheKey, grid);

    return grid;
  },

  /**
   * 2D Game of Life style automata
   * @param {number} width - Grid width
   * @param {number} height - Grid height
   * @param {number} generations - Number of generations to evolve
   * @param {number[]} birthRule - Neighbor counts that cause birth
   * @param {number[]} surviveRule - Neighbor counts that allow survival
   * @param {number} density - Initial random density (0-1)
   * @returns {Uint8Array} Grid of 0s and 1s
   */
  life(width, height, generations = 100, birthRule = [3], surviveRule = [2, 3], density = 0.3) {
    let grid = new Uint8Array(width * height);

    // Random initial state
    for (let i = 0; i < grid.length; i++) {
      grid[i] = Math.random() < density ? 1 : 0;
    }

    // Evolve
    for (let gen = 0; gen < generations; gen++) {
      const next = new Uint8Array(width * height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const neighbors = this._countNeighbors(grid, width, height, x, y);
          const alive = grid[y * width + x];

          if (alive) {
            next[y * width + x] = surviveRule.includes(neighbors) ? 1 : 0;
          } else {
            next[y * width + x] = birthRule.includes(neighbors) ? 1 : 0;
          }
        }
      }

      grid = next;
    }

    return grid;
  },

  /**
   * Get cell value from cached elementary CA
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} rule - CA rule
   * @param {number} gridWidth - Width of underlying grid
   * @param {number} gridHeight - Height of underlying grid
   * @returns {number} 0 or 1
   */
  getValue(x, y, rule, gridWidth = 256, gridHeight = 256) {
    const grid = this.elementary(gridWidth, gridHeight, rule);
    const gx = Math.abs(x) % gridWidth;
    const gy = Math.abs(y) % gridHeight;
    return grid[gy * gridWidth + gx];
  },

  /**
   * Named CA presets
   */
  RULES: {
    // Elementary (1D) rules
    RULE_30: 30,    // Chaotic, used in Mathematica's random number generator
    RULE_90: 90,    // Sierpinski triangle / XOR pattern
    RULE_110: 110,  // Turing complete, complex localized structures
    RULE_184: 184,  // Traffic flow / ballistic annihilation
    RULE_250: 250,  // Diagonal checkerboard pattern
    RULE_54: 54,    // Complex nested triangles
    RULE_60: 60,    // Sierpinski variant
    RULE_150: 150,  // Fractal / self-similar

    // 2D Life variants
    LIFE: { birth: [3], survive: [2, 3], name: 'Conway Life' },
    HIGHLIFE: { birth: [3, 6], survive: [2, 3], name: 'HighLife (replicators)' },
    SEEDS: { birth: [2], survive: [], name: 'Seeds (explosive)' },
    MAZE: { birth: [3], survive: [1, 2, 3, 4, 5], name: 'Maze' },
    DIAMOEBA: { birth: [3, 5, 6, 7, 8], survive: [5, 6, 7, 8], name: 'Diamoeba' },
    DAY_AND_NIGHT: { birth: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8], name: 'Day & Night' }
  },

  /**
   * Get rule info
   */
  getRuleInfo(rule) {
    if (typeof rule === 'number') {
      const binary = rule.toString(2).padStart(8, '0');
      return {
        number: rule,
        binary,
        description: this._getRuleDescription(rule)
      };
    }
    return rule;
  },

  _getRuleDescription(rule) {
    const descriptions = {
      30: 'Chaotic - used in random number generation',
      90: 'Sierpinski triangle - XOR fractal pattern',
      110: 'Turing complete - supports universal computation',
      184: 'Traffic flow - models particle movement',
      250: 'Diagonal stripes',
      54: 'Complex nested structures',
      60: 'Sierpinski variant',
      150: 'Self-similar fractal'
    };
    return descriptions[rule] || `Rule ${rule}`;
  },

  _countNeighbors(grid, width, height, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + width) % width;
        const ny = (y + dy + height) % height;
        count += grid[ny * width + nx];
      }
    }
    return count;
  },

  /**
   * Clear the cache
   */
  clearCache() {
    this._cache.clear();
  }
};

export default CellularAutomata;
