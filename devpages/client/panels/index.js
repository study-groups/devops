/**
 * Panel Index
 *
 * This file imports all panel components to ensure they are registered
 * with the PanelRegistry. It should be imported once in the application's
 * main entry point.
 */

// New unified panels
import './DebugLoggingPanel.js'; // NEW: Unified TETRA + App logging (replaces TetraSettingsPanel + LogSettingsPanel)

// Active panels
import './dev/FileBrowserPanel.js';
import './publish/PublishPanel.js'; // Unified publish panel
import './DesignTokensPanel.js';
import './DiagnosticPanel.js'; // Updated: Auto-refresh removed
import './UIInspectorPanel.js';
import './ThemeManagementPanel.js'; // New v2.0 theme manager
import './DOMInspectorPanel.js';
import './CSSDebugPanel.js'; // Advanced CSS debugging with z-index visualization
import './TetraConfigPanel.js';
import './PreviewRenderingPanel.js'; // Preview & rendering settings

// Legacy panels (deprecated - kept for backwards compatibility)
import './settings/LogSettingsPanel.js'; // DEPRECATED: Use DebugLoggingPanel instead
import './TetraSettingsPanel.js'; // DEPRECATED: Use DebugLoggingPanel instead

// Note: CSS is loaded via server bundles (/css/bundles/*.bundle.css)
// Not imported directly in JavaScript modules
