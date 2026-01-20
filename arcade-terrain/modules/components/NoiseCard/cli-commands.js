/**
 * CLI Command Structure
 *
 * Hierarchical organization:
 *   type     → noise type (random, perlin, cellular, etc.)
 *   ca       → cellular automata settings
 *   style    → visual settings (blend, colors, speed)
 *   preset   → named presets
 *
 * Self-discovery:
 *   Tab with empty input → show categories
 *   Category + Tab → show options in that category
 *   Command + ? → show help for that command
 */

// Top-level categories
export const CATEGORIES = {
  type: {
    label: 'TYPE',
    description: 'Noise generator type',
    color: 'var(--one, #ff9900)'
  },
  ca: {
    label: 'CA',
    description: 'Cellular automata',
    color: 'var(--three, #00e1cf)'
  },
  style: {
    label: 'STYLE',
    description: 'Visual settings',
    color: 'var(--four, #65ac07)'
  },
  preset: {
    label: 'PRESET',
    description: 'Named presets',
    color: 'var(--two, #f04f4a)'
  }
};

// Noise types with descriptions
export const NOISE_TYPES = {
  random: { description: 'TV static noise', icon: '▪' },
  perlin: { description: 'Smooth gradient noise', icon: '◠' },
  simplex: { description: 'Improved Perlin', icon: '◡' },
  worley: { description: 'Cell/Voronoi patterns', icon: '◯' },
  cellular: { description: 'Cellular automata', icon: '▦' },
  scanlines: { description: 'CRT scanlines', icon: '≡' },
  grid: { description: 'Pixel grid', icon: '▤' }
};

// Famous CA rules with descriptions
export const CA_RULES = {
  30:  { name: 'chaos', description: 'Chaotic, used for randomness' },
  90:  { name: 'sierpinski', description: 'Sierpinski triangle fractal' },
  110: { name: 'turing', description: 'Turing complete, complex' },
  184: { name: 'traffic', description: 'Traffic flow simulation' },
  150: { name: 'xor', description: 'XOR pattern, symmetric' },
  60:  { name: 'pascal', description: 'Pascal triangle mod 2' }
};

// Presets organized by mood/use
export const PRESET_GROUPS = {
  basic: {
    label: 'Basic',
    presets: ['static', 'off']
  },
  retro: {
    label: 'Retro',
    presets: ['crt', 'lcd', 'scanlines']
  },
  organic: {
    label: 'Organic',
    presets: ['lava', 'plasma', 'fire', 'ocean']
  },
  digital: {
    label: 'Digital',
    presets: ['cyber', 'matrix', 'cells']
  },
  ca: {
    label: 'Cellular Automata',
    presets: ['rule30', 'rule90', 'rule110']
  }
};

// Slider-enabled commands with configs
export const SLIDERS = {
  blend: {
    min: 0, max: 1, step: 0.05, default: 0.15,
    unit: '', category: 'style',
    description: 'Noise opacity over background'
  },
  speed: {
    min: 0, max: 60, step: 1, default: 30,
    unit: 'fps', category: 'style',
    description: 'Animation speed (0 = static)'
  },
  scale: {
    min: 0.005, max: 0.1, step: 0.005, default: 0.02,
    unit: '', category: 'style',
    description: 'Pattern scale (smaller = larger)'
  },
  rule: {
    min: 0, max: 255, step: 1, default: 30,
    unit: '', category: 'ca',
    description: 'Wolfram CA rule number'
  },
  cells: {
    min: 2, max: 32, step: 2, default: 4,
    unit: 'px', category: 'ca',
    description: 'Cell size for CA/grid'
  }
};

// Build flat command list for tab completion
export const ALL_COMMANDS = [
  // Categories
  'type', 'ca', 'style', 'preset',
  // Type shortcuts
  ...Object.keys(NOISE_TYPES),
  // Style commands
  'blend', 'speed', 'scale', 'color',
  // CA commands
  'rule', 'cells',
  // Utility
  'help', 'config', 'save', 'load', 'clear', 'exit',
  // Animation
  'start', 'stop'
];

/**
 * Get contextual completions based on current input
 */
export function getCompletions(input) {
  const trimmed = input.trim().toLowerCase();

  // Empty: show categories
  if (!trimmed) {
    return {
      type: 'categories',
      items: Object.entries(CATEGORIES).map(([key, cat]) => ({
        cmd: key,
        label: cat.label,
        description: cat.description,
        color: cat.color
      }))
    };
  }

  // Category entered: show items in category
  if (trimmed === 'type') {
    return {
      type: 'types',
      items: Object.entries(NOISE_TYPES).map(([key, t]) => ({
        cmd: key,
        label: `${t.icon} ${key}`,
        description: t.description
      }))
    };
  }

  if (trimmed === 'ca') {
    return {
      type: 'rules',
      items: Object.entries(CA_RULES).map(([num, r]) => ({
        cmd: `rule ${num}`,
        label: `${num} (${r.name})`,
        description: r.description
      }))
    };
  }

  if (trimmed === 'style') {
    return {
      type: 'sliders',
      items: Object.entries(SLIDERS)
        .filter(([_, s]) => s.category === 'style')
        .map(([key, s]) => ({
          cmd: key,
          label: key,
          description: s.description,
          slider: s
        }))
    };
  }

  if (trimmed === 'preset') {
    return {
      type: 'presets',
      groups: PRESET_GROUPS
    };
  }

  // Partial match
  const matches = ALL_COMMANDS.filter(c => c.startsWith(trimmed));
  if (matches.length > 0) {
    return {
      type: 'matches',
      items: matches.map(cmd => ({ cmd }))
    };
  }

  return { type: 'none', items: [] };
}

export default {
  CATEGORIES,
  NOISE_TYPES,
  CA_RULES,
  PRESET_GROUPS,
  SLIDERS,
  ALL_COMMANDS,
  getCompletions
};
