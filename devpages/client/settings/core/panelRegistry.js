/**
 * client/settings/core/panelRegistry.js
 * COMPATIBILITY LAYER: Re-exports the registry from settingsRegistry.js
 * 
 * This file exists only for backward compatibility.
 * All new code should import from settingsRegistry.js directly.
 */

import { settingsRegistry } from './settingsRegistry.js';

// Re-export the registry with a different name for compatibility
export const panelRegistry = settingsRegistry;

// Log a deprecation warning
console.warn('[PanelRegistry] This module is deprecated. Import from settingsRegistry.js instead.'); 