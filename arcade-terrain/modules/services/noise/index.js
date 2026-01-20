/**
 * NoiseService
 * Procedural noise and texture generation service
 * Apply pixelated noise backgrounds to any element
 *
 * Usage:
 *   import { NoiseService } from './modules/services/noise/index.js';
 *
 *   // Apply preset
 *   NoiseService.apply(element, { preset: 'static' });
 *
 *   // Custom config
 *   NoiseService.apply(element, {
 *     type: 'perlin',
 *     scale: 0.02,
 *     speed: 30,
 *     colors: ['#000', '#0088ff'],
 *     blend: 0.3
 *   });
 *
 *   // Get instance to control
 *   const instance = NoiseService.getInstance(element);
 *   instance.setConfig({ speed: 60 });
 *   instance.start();
 *
 *   // Remove noise
 *   NoiseService.remove(element);
 */

import { NoiseGenerators } from './generators.js';
import { CellularAutomata } from './cellular.js';
import { PRESETS, getPreset, listPresets, describePreset } from './presets.js';
import { NoiseRenderer } from './renderer.js';

// Track instances by element
const instances = new WeakMap();

export const NoiseService = {
  /**
   * Apply noise background to an element
   * @param {HTMLElement} element - Target element
   * @param {Object} config - Configuration (or { preset: 'name' })
   * @returns {NoiseRenderer} Controller instance
   */
  apply(element, config = {}) {
    // Remove existing instance if any
    this.remove(element);

    // Resolve preset if specified
    let resolvedConfig = config;
    if (config.preset) {
      resolvedConfig = { ...getPreset(config.preset), ...config };
      delete resolvedConfig.preset;
    }

    // Create and store instance
    const instance = new NoiseRenderer(element, resolvedConfig);
    instances.set(element, instance);

    console.log('[NoiseService] Applied to', element.className || element.id || element.tagName);
    return instance;
  },

  /**
   * Remove noise from an element
   * @param {HTMLElement} element - Target element
   */
  remove(element) {
    const instance = instances.get(element);
    if (instance) {
      instance.destroy();
      instances.delete(element);
      console.log('[NoiseService] Removed from', element.className || element.id || element.tagName);
    }
  },

  /**
   * Get the noise instance for an element
   * @param {HTMLElement} element - Target element
   * @returns {NoiseRenderer|null} Instance or null
   */
  getInstance(element) {
    return instances.get(element) || null;
  },

  /**
   * Check if element has noise applied
   * @param {HTMLElement} element - Target element
   * @returns {boolean}
   */
  hasNoise(element) {
    return instances.has(element);
  },

  /**
   * Apply preset by name
   * @param {HTMLElement} element - Target element
   * @param {string} presetName - Preset name
   * @returns {NoiseRenderer} Controller instance
   */
  applyPreset(element, presetName) {
    return this.apply(element, { preset: presetName });
  },

  /**
   * Update existing noise config
   * @param {HTMLElement} element - Target element
   * @param {Object} config - New configuration values
   */
  update(element, config) {
    const instance = instances.get(element);
    if (instance) {
      instance.setConfig(config);
    }
  },

  // Expose sub-modules
  generators: NoiseGenerators,
  cellular: CellularAutomata,
  presets: PRESETS,
  Renderer: NoiseRenderer,

  // Preset utilities
  getPreset,
  listPresets,
  describePreset,

  /**
   * Get info about available noise types
   */
  getNoiseTypes() {
    return [
      { type: 'random', description: 'TV static - fast random noise' },
      { type: 'perlin', description: 'Smooth flowing gradients' },
      { type: 'simplex', description: 'Smooth gradient noise variant' },
      { type: 'worley', description: 'Cell/Voronoi patterns' },
      { type: 'cellular', description: 'Cellular automata (Rules 0-255)' },
      { type: 'scanlines', description: 'CRT scanline effect' },
      { type: 'grid', description: 'LCD pixel grid' }
    ];
  },

  /**
   * Get info about cellular automata rules
   */
  getCARules() {
    return CellularAutomata.RULES;
  }
};

export { NoiseGenerators, CellularAutomata, PRESETS, NoiseRenderer };
export default NoiseService;
