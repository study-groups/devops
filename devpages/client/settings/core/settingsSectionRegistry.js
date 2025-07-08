/**
 * client/settings/core/settingsSectionRegistry.js
 * COMPATIBILITY LAYER: Re-exports the registry from settingsRegistry.js
 * 
 * This file exists only for backward compatibility.
 * All new code should import from settingsRegistry.js directly.
 */

import { settingsRegistry } from './settingsRegistry.js';

// Re-export the registry with a different name for compatibility
export const settingsSectionRegistry = settingsRegistry;

// Deprecation warning removed to reduce console noise
// TODO: Update all imports to use settingsRegistry.js instead

// Expose globally for debugging
// Register with consolidation system
if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
    window.devpages._internal.consolidator.migrate('settingsSectionRegistry', settingsSectionRegistry);
} else {
    // Fallback for legacy support
    window.settingsSectionRegistry = settingsSectionRegistry;
} 