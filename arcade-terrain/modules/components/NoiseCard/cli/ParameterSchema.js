/**
 * ParameterSchema - Centralized parameter metadata for CLI controls
 *
 * Defines type, constraints, and defaults for all CLI parameters.
 * Used by InlineControls to render appropriate UI (slider/select/toggle).
 */

export const PARAM_TYPES = {
  SLIDER: 'slider',
  SELECT: 'select',
  TOGGLE: 'toggle',
  COLOR: 'color',
  TEXT: 'text'
};

/**
 * Parameter definitions
 * Each parameter specifies:
 *   - type: Control type (slider, select, toggle)
 *   - layer: Which layer(s) this applies to ('global', 'noise', 'image', 'ca')
 *   - min/max/step: For sliders
 *   - options: For selects
 *   - default: Default value
 *   - description: Help text
 *   - presets: Named values (optional, for sliders)
 */
export const PARAMETERS = {
  // === GLOBAL ===
  blend: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
    layer: 'global',
    description: 'Layer blend amount'
  },
  // === LAYER 1: NOISE ===
  type: {
    type: 'select',
    options: ['random', 'perlin', 'simplex', 'worley', 'scanlines', 'grid'],
    default: 'random',
    layer: 'noise',
    description: 'Noise algorithm'
  },
  'noise.scale': {
    type: 'slider',
    min: 0.005,
    max: 0.2,
    step: 0.005,
    default: 0.05,
    layer: 'noise',
    description: 'Noise frequency'
  },
  blocksize: {
    type: 'slider',
    min: 1,
    max: 100,
    step: 1,
    default: 1,
    layer: 'noise',
    description: 'Pixel block size (1-100)'
  },
  'noise.colors': {
    type: 'text',
    default: '#ff9900 #f04f4a',
    layer: 'noise',
    description: 'Space-separated hex colors'
  },
  churn: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
    layer: 'noise',
    description: 'Pixel update rate (1=all, 0.1=10% per frame)'
  },
  fade: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0,
    layer: 'noise',
    description: 'Blend with previous (0=instant, 0.9=heavy trail)'
  },
  rate: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.75,
    layer: 'noise',
    description: 'Simulation rate (0.01-60 updates/sec)',
    logarithmic: true,
    logMin: 0.01,
    logMax: 60
  },

  // === LAYER 2: IMAGE ===
  'image.scale': {
    type: 'slider',
    min: 0.1,
    max: 2,
    step: 0.05,
    default: 0.5,
    layer: 'image',
    description: 'Logo scale'
  },
  invert: {
    type: 'toggle',
    default: false,
    layer: 'image',
    description: 'Invert colors'
  },
  hue: {
    type: 'slider',
    min: 0,
    max: 360,
    step: 1,
    default: 0,
    layer: 'image',
    description: 'Hue rotation (degrees)'
  },
  particles: {
    type: 'toggle',
    default: false,
    layer: 'image',
    description: 'Enable particle system'
  },
  gravity: {
    type: 'slider',
    min: 0,
    max: 0.001,
    step: 0.00005,
    default: 0.0001,
    layer: 'image',
    description: 'Particle gravity'
  },
  bounce: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.7,
    layer: 'image',
    description: 'Bounce factor'
  },

  // === LAYER 3: CA ===
  rule: {
    type: 'slider',
    min: 0,
    max: 255,
    step: 1,
    default: 110,
    layer: 'ca',
    description: 'Cellular automata rule',
    presets: {
      30: 'chaos',
      90: 'sierpinski',
      110: 'turing',
      184: 'traffic'
    }
  },
  cells: {
    type: 'slider',
    min: 1,
    max: 32,
    step: 1,
    default: 4,
    layer: 'ca',
    description: 'Cell size (px)'
  },
  direction: {
    type: 'select',
    options: ['up', 'down', 'left', 'right', 'none'],
    default: 'down',
    layer: 'ca',
    description: 'Scroll direction'
  },

  // CA type and presets
  ca: {
    type: 'select',
    options: ['wolfram', 'life', 'cyclic', 'cymatics'],
    default: 'wolfram',
    layer: 'ca',
    description: 'CA algorithm type'
  },
  preset: {
    type: 'select',
    options: [], // Populated dynamically based on CA type
    dynamic: true,
    default: 'chaos',
    layer: 'ca',
    description: 'Named preset (depends on CA type)'
  },
  density: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.3,
    layer: 'ca',
    description: 'Initial cell density'
  },
  depth: {
    type: 'slider',
    min: 2,
    max: 8,
    step: 1,
    default: 2,
    layer: 'ca',
    description: 'Color depth (2=mono, 8=full)',
    presets: {
      2: 'mono',
      4: 'low',
      8: 'full'
    }
  },

  // Cymatics parameters (CA layer, cymatics mode only)
  freq: {
    type: 'slider',
    min: 0.01,
    max: 0.2,
    step: 0.005,
    default: 0.05,
    layer: 'ca',
    description: 'Wave frequency (cymatics)'
  },
  wavespeed: {
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.1,
    layer: 'ca',
    description: 'Animation speed (cymatics)'
  },

  // Oscillator controls (cymatics mode)
  osc1: {
    type: 'oscillator',
    index: 0,
    layer: 'ca',
    description: 'Oscillator 1 controls'
  },
  osc2: {
    type: 'oscillator',
    index: 1,
    layer: 'ca',
    description: 'Oscillator 2 controls'
  },
  osc3: {
    type: 'oscillator',
    index: 2,
    layer: 'ca',
    description: 'Oscillator 3 controls'
  },

  // Palette selection
  'noise.palette': {
    type: 'palette',
    options: ['fire', 'ocean', 'forest', 'neon', 'sunset', 'ice', 'lava', 'mono'],
    default: 'fire',
    layer: 'noise',
    description: 'Color palette'
  },
  'ca.palette': {
    type: 'palette',
    options: ['fire', 'ocean', 'forest', 'neon', 'sunset', 'ice', 'lava', 'mono'],
    default: 'fire',
    layer: 'ca',
    description: 'Color palette'
  }
};

/**
 * Get parameter definition for a command in the current layer context
 * Handles layer-specific parameters (e.g., 'scale' differs for noise vs image)
 *
 * @param {string} name - Parameter name (e.g., 'scale', 'type', 'rule')
 * @param {string} layerType - Current layer type ('noise', 'image', 'ca')
 * @returns {object|null} Parameter definition with name property, or null if not found
 */
export function getParameter(name, layerType) {
  // Check for layer-specific version first (e.g., 'noise.scale')
  const layerSpecific = `${layerType}.${name}`;
  if (PARAMETERS[layerSpecific]) {
    return { ...PARAMETERS[layerSpecific], name };
  }

  // Check for direct match
  const param = PARAMETERS[name];
  if (param) {
    // Must match layer or be global
    if (param.layer === layerType || param.layer === 'global') {
      return { ...param, name };
    }
  }

  return null;
}

/**
 * Get all parameters for a given layer
 * @param {string} layerType - Layer type ('noise', 'image', 'ca')
 * @returns {Array<object>} Array of parameter definitions
 */
export function getLayerParameters(layerType) {
  const params = [];

  for (const [key, param] of Object.entries(PARAMETERS)) {
    // Include global params and layer-specific params
    if (param.layer === 'global' || param.layer === layerType) {
      // Extract base name (remove layer prefix if present)
      const name = key.includes('.') ? key.split('.')[1] : key;
      params.push({ ...param, name, key });
    }
  }

  return params;
}

/**
 * Get parameter names as simple list for tab completion
 * @param {string} layerType - Layer type
 * @returns {Array<string>} Parameter names
 */
export function getParameterNames(layerType) {
  return getLayerParameters(layerType).map(p => p.name);
}

export default PARAMETERS;
