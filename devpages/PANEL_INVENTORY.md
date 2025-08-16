# Panel Inventory

This document provides a comprehensive inventory of all UI panel components in the application. It is generated as part of a "broad sweep" review to unify the panel architecture.

| File Path | Panel ID | Component API | Registration Method | Notes |
|---|---|---|---|---|
| `client/file-browser/FileBrowserPanel.js` | `file-browser` | Extends `BasePanel` | `panelRegistry.js` | Legacy panel, follows standard. |
| `client/panels/CodePanel.js` | `code` | Extends `BasePanel` | `panelRegistry.js` | Legacy panel, follows standard. |
| `client/panels/EditorPanel.js` | `editor` | Extends `BasePanel` | `panelRegistry.js` | Legacy panel, follows standard. |
| `client/panels/PreviewPanel.js` | `preview` | Extends `BasePanel` | `panelRegistry.js` | Legacy panel, follows standard. |
| `client/log/LogDisplay.js` | `log` | **Custom API** | `panelRegistry.js` | Complex custom panel with its own Redux integration. |
| `client/panels/NlpPanel.js` | `nlp-panel` | **Custom API** (creates `.element`) | `panelRegistry.js` | Simple custom panel. |
| `client/settings/panels/css-design/DesignTokensPanel.js` | `settings-panel` | Extends `BasePanel` | `panelRegistry.js` | Used for the settings panel. Follows standard. |
| `client/panels/JavaScriptPanel.js` | `javascript-panel` | Extends `BasePanel` | Dynamic (not in registry) | Specialized viewer for JS files. |
| `client/panels/HtmlPanel.js` | `html-panel` | Extends `BasePanel` | Dynamic (not in registry) | Specialized viewer for HTML files. |
| `client/panels/ContextPanel.js` | `context` | Extends `BasePanel` | Dynamic (not in registry) | Panel for context management. |
| `client/dom-inspector/DomInspectorPanel.js` | `dom-inspector` | **Custom API** | Dynamic (not in registry) | Very complex, standalone feature with its own ecosystem. |
| `client/dom-inspector/DomInspectorSettingsPanel.js` | `dom-inspector-settings`| **Custom API** | Dynamic (not in registry) | Companion settings panel for the DOM inspector. |
| `client/settings/panels/themes/ThemeSelectorPanel.js` | `themes` | **Custom API** | `panelRegistry.js` | Custom settings panel. |
| `client/settings/panels/icons/IconsPanel.js` | `icons-panel` | **Custom API** | `panelRegistry.js` | Custom settings panel. |
| `client/settings/panels/console/ConsoleLogPanel.js` | `console-log-panel`| **Custom API** | `panelRegistry.js` | Custom settings panel. |
| `client/settings/panels/html-render/HtmlRenderSettingsPanel.js`| `html-render-settings` | **Custom API** | `panelRegistry.js` | Custom settings panel. |
| `client/settings/panels/api-tokens/ApiTokenPanel.js` | `api-tokens` | **Custom API** | `panelRegistry.js` | Custom settings panel. |
| `client/settings/panels/plugins/PluginsPanel.js` | `plugins` | **Custom API** | `panelRegistry.js` | Custom settings panel. |
| `client/settings/panels/context/ContextManagerPanel.js` | `mount-info-panel` | Extends `BasePanel` | Redux `initialState` | A Redux-native panel. |
| `client/sidebar/panels/PublishedSummaryPanel.js` | `published-summary` | **Custom API** | Dynamic (not in registry) | Custom panel for sidebar. |
| `client/panels/SidebarManagerPanel.js` | `panel-manager` | Extends `BasePanel` | Dynamic (not in registry) | "Meta-panel" that manages other panels. |
| `client/panels/TreesPanel.js` | `trees-panel` | **Custom API** | Dynamic (not in registry) | "Meta-panel" that contains other panels. |
| `client/panels/FileTreePanel.js` | `file-tree-panel` | **Custom API** | Dynamic (child of `TreesPanel`) | Child panel for displaying file trees. |
