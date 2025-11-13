/**
 * Panel Index
 *
 * This file imports all panel components to ensure they are registered
 * with the PanelRegistry. It should be imported once in the application's
 * main entry point.
 */

import './dev/FileBrowserPanel.js';
import './publish/PublishPanel.js'; // Unified publish panel
import './settings/ThemePanel.js';
import './settings/LogSettingsPanel.js';
import './DesignTokensPanel.js';
import './DiagnosticPanel.js';
import './UIInspectorPanel.js';
import './InspectorUtilitiesPanel.js';
import './ThemeEditorPanel.js';
import './DOMInspectorPanel.js';
import './CSSInspectorPanel.js';
import './TetraSettingsPanel.js';

// Note: CSS is loaded via server bundles (/css/bundles/*.bundle.css)
// Not imported directly in JavaScript modules
