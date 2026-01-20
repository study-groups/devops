/**
 * Noise Texture Presets
 * Pre-configured noise settings for common effects
 */

export const PRESETS = {
  // Classic TV static
  static: {
    type: 'random',
    speed: 60,
    colors: ['#000000', '#ffffff'],
    blend: 0.15,
    blendMode: 'overlay',
    resolution: 0.5
  },

  // Slow static - more subtle
  staticSlow: {
    type: 'random',
    speed: 10,
    colors: ['#000000', '#ffffff'],
    blend: 0.08,
    blendMode: 'overlay',
    resolution: 0.25
  },

  // Lava lamp effect
  lava: {
    type: 'perlin',
    scale: 0.015,
    speed: 0.5,
    colors: ['#1a0000', '#8b0000', '#ff4400', '#ffaa00'],
    blend: 0.8,
    blendMode: 'normal',
    resolution: 0.5
  },

  // LCD pixel grid
  lcd: {
    type: 'grid',
    cellSize: 3,
    speed: 0,
    colors: ['#0a1810', '#1a3020', '#3a6040', '#6b9c7b'],
    blend: 0.4,
    blendMode: 'multiply',
    resolution: 1
  },

  // Cyberpunk scanlines
  cyber: {
    type: 'scanlines',
    lineHeight: 2,
    speed: 0,
    colors: ['#0a0015', '#1e062a', '#4a0080', '#ed1dff'],
    blend: 0.25,
    blendMode: 'screen',
    glitch: true,
    resolution: 1
  },

  // Rule 30 - chaotic cellular automata
  rule30: {
    type: 'cellular',
    rule: 30,
    speed: 0,
    colors: ['#050505', '#00ff00'],
    blend: 0.9,
    blendMode: 'normal',
    resolution: 0.5
  },

  // Rule 90 - Sierpinski triangle
  rule90: {
    type: 'cellular',
    rule: 90,
    speed: 0,
    colors: ['#050505', '#0088ff'],
    blend: 0.9,
    blendMode: 'normal',
    resolution: 0.5
  },

  // Rule 110 - Turing complete
  rule110: {
    type: 'cellular',
    rule: 110,
    speed: 0,
    colors: ['#050505', '#ff8800'],
    blend: 0.9,
    blendMode: 'normal',
    resolution: 0.5
  },

  // Matrix rain effect
  matrix: {
    type: 'cellular',
    rule: 30,
    speed: 15,
    colors: ['#000000', '#001100', '#003300', '#00ff00'],
    blend: 0.7,
    blendMode: 'normal',
    direction: 'down',
    resolution: 0.5
  },

  // Plasma effect
  plasma: {
    type: 'simplex',
    scale: 0.008,
    speed: 1,
    colors: ['#000066', '#4400aa', '#aa0066', '#ff4400', '#ffff00'],
    blend: 0.9,
    blendMode: 'normal',
    resolution: 0.5
  },

  // Worley cells
  cells: {
    type: 'worley',
    cellSize: 48,
    speed: 0,
    colors: ['#0a0a0a', '#1a1a1a', '#2a2a2a', '#3a3a3a'],
    blend: 0.5,
    blendMode: 'multiply',
    resolution: 0.5
  },

  // Fire effect
  fire: {
    type: 'perlin',
    scale: 0.03,
    speed: 8,
    colors: ['#000000', '#330000', '#660000', '#cc3300', '#ff6600', '#ffcc00'],
    blend: 0.8,
    blendMode: 'normal',
    direction: 'up',
    resolution: 0.5
  },

  // Ocean waves
  ocean: {
    type: 'perlin',
    scale: 0.02,
    speed: 2,
    colors: ['#001020', '#002040', '#003060', '#0050a0', '#0080c0'],
    blend: 0.7,
    blendMode: 'normal',
    resolution: 0.5
  },

  // Arcade cabinet dark
  cabinet: {
    type: 'random',
    speed: 8,
    colors: ['#080808', '#101010', '#181818'],
    blend: 0.2,
    blendMode: 'overlay',
    resolution: 0.25
  },

  // CRT monitor effect
  crt: {
    type: 'scanlines',
    lineHeight: 1,
    speed: 0,
    colors: ['#000000', '#111111'],
    blend: 0.15,
    blendMode: 'multiply',
    resolution: 1
  },

  // Noise off
  off: {
    type: 'random',
    speed: 0,
    colors: ['#000000'],
    blend: 0,
    blendMode: 'normal',
    resolution: 0.25
  }
};

/**
 * Get preset by name, with fallback to 'static'
 */
export function getPreset(name) {
  return PRESETS[name] || PRESETS.static;
}

/**
 * List all preset names
 */
export function listPresets() {
  return Object.keys(PRESETS);
}

/**
 * Get preset with description
 */
export function describePreset(name) {
  const descriptions = {
    static: 'Classic TV static noise',
    staticSlow: 'Subtle slow static',
    lava: 'Lava lamp flowing effect',
    lcd: 'LCD pixel grid pattern',
    cyber: 'Cyberpunk scanlines with glitch',
    rule30: 'Rule 30 cellular automata (chaotic)',
    rule90: 'Rule 90 - Sierpinski triangle',
    rule110: 'Rule 110 - Turing complete patterns',
    matrix: 'Matrix-style falling code',
    plasma: 'Colorful plasma effect',
    cells: 'Worley/Voronoi cell pattern',
    fire: 'Animated fire effect',
    ocean: 'Ocean wave pattern',
    cabinet: 'Subtle arcade cabinet noise',
    crt: 'CRT monitor scanlines',
    off: 'No noise (disabled)'
  };
  return descriptions[name] || `Preset: ${name}`;
}

export default PRESETS;
