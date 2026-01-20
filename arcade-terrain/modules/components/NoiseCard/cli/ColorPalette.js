/**
 * ColorPalette - 8-color palettes for noise/CA layers
 *
 * Each palette has exactly 8 colors, designed for visual depth
 * in noise patterns and cellular automata.
 */

export const PALETTES = {
  fire: {
    label: 'Fire',
    colors: ['#0a0000', '#2d0a00', '#5c1a00', '#8b2a00', '#c44d00', '#ff6600', '#ff9933', '#ffcc66'],
    description: 'Ember to flame'
  },
  ocean: {
    label: 'Ocean',
    colors: ['#000810', '#001428', '#002850', '#004080', '#0066aa', '#0099cc', '#33bbdd', '#88ddff'],
    description: 'Deep to surface'
  },
  forest: {
    label: 'Forest',
    colors: ['#0a1205', '#142408', '#1e360c', '#2d4a12', '#3d6018', '#4d7820', '#6a9030', '#8ab050'],
    description: 'Shadow to canopy'
  },
  neon: {
    label: 'Neon',
    colors: ['#000000', '#1a0033', '#330066', '#6600cc', '#9933ff', '#cc00ff', '#ff00cc', '#ff66ff'],
    description: 'Cyberpunk glow'
  },
  sunset: {
    label: 'Sunset',
    colors: ['#1a0a1e', '#3d1a40', '#6b2050', '#992060', '#cc3366', '#ff5544', '#ff8833', '#ffcc22'],
    description: 'Dusk horizon'
  },
  ice: {
    label: 'Ice',
    colors: ['#0a1520', '#152535', '#203848', '#2a4a5c', '#3a6070', '#5588a0', '#88b0c8', '#c0e0f0'],
    description: 'Frozen depths'
  },
  lava: {
    label: 'Lava',
    colors: ['#0f0000', '#200000', '#400000', '#600800', '#802000', '#a04000', '#d06000', '#ff8800'],
    description: 'Molten rock'
  },
  mono: {
    label: 'Mono',
    colors: ['#000000', '#1c1c1c', '#383838', '#555555', '#777777', '#999999', '#bbbbbb', '#e0e0e0'],
    description: 'Pure grayscale'
  }
};

/**
 * Get a palette by name
 */
export function getPalette(name) {
  return PALETTES[name] || null;
}

/**
 * Get all palette names
 */
export function getPaletteNames() {
  return Object.keys(PALETTES);
}

/**
 * Resolve color - accepts hex or palette index
 */
export function resolveColor(color) {
  if (color.startsWith('#')) return color;
  if (/^[0-9a-fA-F]{3,6}$/.test(color)) return `#${color}`;
  return color;
}

/**
 * Resolve array of colors
 */
export function resolveColors(colors) {
  return colors.map(resolveColor);
}

export default { PALETTES, getPalette, getPaletteNames };
