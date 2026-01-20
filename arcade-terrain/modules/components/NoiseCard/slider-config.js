/**
 * Slider Configuration for NoiseCard CLI
 *
 * Defines which commands support inline slider editing via space+tab.
 * Pattern from Vecterm: type command, press space+tab to get slider.
 */

// Commands that support continuous value adjustment via slider
export const SLIDER_COMMANDS = {
  // Noise rendering
  'blend': {
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.15,
    unit: '',
    description: 'Noise opacity'
  },
  'speed': {
    min: 0,
    max: 120,
    step: 1,
    default: 30,
    unit: ' fps',
    description: 'Animation speed'
  },
  'scale': {
    min: 0.001,
    max: 0.2,
    step: 0.001,
    default: 0.02,
    unit: '',
    description: 'Noise scale (smaller = larger patterns)'
  },

  // Cellular automata
  'rule': {
    min: 0,
    max: 255,
    step: 1,
    default: 30,
    unit: '',
    description: 'CA rule number (0-255)'
  },
  'cells': {
    min: 1,
    max: 64,
    step: 1,
    default: 4,
    unit: 'px',
    description: 'Cell size'
  },

  // Quality
  'resolution': {
    min: 0.1,
    max: 1,
    step: 0.05,
    default: 0.5,
    unit: '',
    description: 'Render quality'
  }
};

// Category colors matching the design system
export const CATEGORY_COLORS = {
  noise: 'var(--one, #ff9900)',    // Orange - noise commands
  cellular: 'var(--three, #00e1cf)', // Cyan - CA commands
  quality: 'var(--four, #65ac07)',   // Green - quality/perf
  animation: 'var(--two, #f04f4a)'   // Red - animation controls
};

// Map commands to categories
export const COMMAND_CATEGORIES = {
  'blend': 'noise',
  'scale': 'noise',
  'speed': 'animation',
  'rule': 'cellular',
  'cells': 'cellular',
  'resolution': 'quality'
};

/**
 * Check if a command supports slider mode
 */
export function isSliderCommand(cmd) {
  return cmd && SLIDER_COMMANDS.hasOwnProperty(cmd.toLowerCase());
}

/**
 * Get slider config for a command
 */
export function getSliderConfig(cmd) {
  return SLIDER_COMMANDS[cmd.toLowerCase()] || null;
}

/**
 * Get category color for a command
 */
export function getCategoryColor(cmd) {
  const category = COMMAND_CATEGORIES[cmd.toLowerCase()];
  return category ? CATEGORY_COLORS[category] : CATEGORY_COLORS.noise;
}

export default SLIDER_COMMANDS;
