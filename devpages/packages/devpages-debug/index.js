/**
 * @devpages/debug - Debug Tools Package
 * Main entry point for debug tools and panels
 */

// Core debug functionality
export { initializeDebugPanels } from './debugPanelInitializer.js';

// Individual panels (for selective import)
export { DevToolsPanel } from './devtools/DevToolsPanel.js';
export { DomInspectorDebugPanel } from './panels/dom-inspector/DomInspectorDebugPanel.js';
export { CssFilesPanel } from './panels/CssFilesPanel/CssFilesPanel.js';
export { JavaScriptInfoPanel } from './panels/JavaScriptInfoPanel.js';

// Utilities and managers (if needed)
// Note: DebugPanelManager is deprecated/disabled - using sidebar integration instead

// Package metadata
export const debugPackageInfo = {
  name: '@devpages/debug',
  version: '1.0.0',
  description: 'Debug tools and panels for DevPages',
  features: [
    'StateKit DevTools integration',
    'CSS file debugging',
    'DOM inspection',
    'JavaScript debugging',
    'Panel system debugging'
  ]
};