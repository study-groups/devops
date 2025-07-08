/**
 * client/settings/core/panelOrder.js
 * 
 * Centralized configuration for the display order of settings panels.
 * To reorder the panels, simply change the order of the IDs in this array.
 * Panels not listed here will be appended to the end in their registration order.
 */

export const panelOrder = [
    'themes',                   // From ThemeSelectorPanel.js - Theme selection and appearance
    'CssFilesPanel',            // From CssFilesPanel.js - CSS file management
    'design-tokens',            // From DesignTokensPanel.js - Design tokens editor
    'preview-settings-panel',   // From PreviewSettingsPanel.js
    'html-render-settings-panel', // From HtmlRenderSettingsPanel.js
    'publish-settings-panel',   // From PublishSettingsPanel.js
    'javascript-panel',         // From JavaScriptPanel.js
    'icons-panel',              // From IconsPanel.js
    'plugins-panel',            // From PluginsPanel.js
    'api-token-panel',          // From ApiTokenPanel.js
    'console-log-panel',        // From ConsoleLogPanel.js
    'dev-tools-panel',          // From DevToolsPanel.js
]; 