/**
 * ⚠️ DEPRECATED: Panel Event Bus System ⚠️
 * 
 * This file is DEPRECATED and should no longer be used.
 * 
 * WHY DEPRECATED:
 * - Created unnecessary complexity with multiple event buses
 * - Caused infinite loops and duplicate event emissions
 * - Over-engineered solution for simple event coordination
 * 
 * REPLACED WITH:
 * - Main eventBus (/client/eventBus.js) for all event coordination
 * - Simple event constants (/client/settings/core/settingsEvents.js)
 * - Direct event emission with debouncing helpers
 * 
 * MIGRATION:
 * - Replace `panelEventBus.emit()` with `eventBus.emit()`
 * - Replace `PanelEvents.THEME_CHANGED` with `SettingsEvents.THEME_CHANGED`
 * - Use `emitCssSettingsChanged()` helper for CSS-related events
 * 
 * This file will be removed in a future cleanup.
 * 
 * @deprecated Use main eventBus and settingsEvents instead
 */

console.warn('[DEPRECATED] panelEventBus.js is deprecated. Use main eventBus and settingsEvents instead.');

// Legacy exports for backward compatibility - will be removed
export const PanelEvents = {
  THEME_CHANGED: 'settings:theme:changed',
  CSS_FILES_UPDATED: 'settings:css:files:updated',
  CSS_PREVIEW_REFRESH: 'settings:css:preview:refresh'
};

export const panelEventBus = {
  emit: () => console.warn('[DEPRECATED] Use main eventBus.emit() instead'),
  on: () => console.warn('[DEPRECATED] Use main eventBus.on() instead'),
  getStats: () => ({ deprecated: true, message: 'Use main eventBus instead' })
};

export class PanelEventBus {
  constructor() {
    console.warn('[DEPRECATED] PanelEventBus is deprecated. Use main eventBus instead.');
  }
}

export function createPanelMixin() {
  console.warn('[DEPRECATED] createPanelMixin is deprecated. Use main eventBus directly.');
  return {};
} 