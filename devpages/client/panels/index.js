/**
 * Panel Index
 *
 * This file imports all panel components to ensure they are registered
 * with the PanelRegistry. It should be imported once in the application's
 * main entry point.
 */

import './dev/FileBrowserPanel.js';
import './publish/PublishPanel.js'; // Unified publish panel
import './settings/LogSettingsPanel.js';
import './DesignTokensPanel.js';
import './DiagnosticPanel.js';
import './UIInspectorPanel.js';
import './InspectorUtilitiesPanel.js';
import './ThemeManagementPanel.js'; // New v2.0 theme manager
import './DOMInspectorPanel.js';
import './CSSInspectorPanel.js';
import './TetraSettingsPanel.js';
import './TetraConfigPanel.js';
import './PreviewRenderingPanel.js'; // Preview & rendering settings

// Note: CSS is loaded via server bundles (/css/bundles/*.bundle.css)
// Not imported directly in JavaScript modules
