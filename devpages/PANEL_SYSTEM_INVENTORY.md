# Panel System Inventory

## 📊 Panel Files Overview

### 🔍 Core Panel Files
| Category | File Path | Description | Status |
|----------|-----------|-------------|--------|
| Base Panel | `client/panels/BasePanel.js` | Main base panel implementation | Active |
| Base Panel Backup | `client/panels/BasePanel_backup.js` | Legacy backup of base panel | Inactive |
| Base Panel Restored | `client/panels/BasePanel_restored.js` | Restored version of base panel | Inactive |
| Panel Interface | `client/panels/PanelInterface.js` | Core panel interface definition | Active |

### 🧩 Specific Panels
| Panel Name | File Path | Category | Description |
|------------|-----------|----------|-------------|
| CLI Panel | `client/panels/CLIPanel.js` | Utility | Command-line interface panel |
| Code Panel | `client/panels/CodePanel.js` | Development | Code editing panel |
| Comm Panel | `client/panels/CommPanel.js` | Communication | Communication panel |
| Context Panel | `client/panels/ContextPanel.js` | Navigation | Project context panel |
| Editor Panel | `client/panels/EditorPanel.js` | Editing | Main editor panel |
| File Tree Panel | `client/panels/FileTreePanel.js` | Navigation | File tree view panel |
| HTML Panel | `client/panels/HtmlPanel.js` | Development | HTML viewing panel |
| JavaScript Panel | `client/panels/JavaScriptPanel.js` | Development | JavaScript console panel |
| NLP Panel | `client/panels/NlpPanel.js` | AI | Natural Language Processing panel |
| Preview Panel | `client/panels/PreviewPanel.js` | Editing | Preview panel |
| Sidebar Manager Panel | `client/panels/SidebarManagerPanel.js` | Layout | Manages sidebar panels |

### 🔧 Panel Management
| File Path | Description | Status |
|-----------|-------------|--------|
| `client/panels/PanelControlCenter.js` | Panel control management | Active |
| `client/panels/PanelFlyoutManager.js` | Manages panel flyout behavior | Active |
| `client/panels/PanelNavBar.js` | Panel navigation bar | Active |
| `client/panels/PanelRenderer.js` | Renders panels | Active |
| `client/panels/PanelReorderManager.js` | Manages panel reordering | Active |
| `client/panels/PanelStateManager.js` | Manages panel state | Active |
| `client/panels/panelConfiguration.js` | Panel configuration | Active |
| `client/panels/panelRegistrationFix.js` | Fixes panel registration | Active |
| `client/panels/panelRegistry.js` | Panel registration system | Active |

### 🔬 Debug Panels
| Panel Name | File Path | Description |
|------------|-----------|-------------|
| CSS Files Panel | `packages/devpages-debug/panels/CssFilesPanel/CssFilesPanel.js` | CSS debugging panel |
| External Dependencies Panel | `packages/devpages-debug/panels/ExternalDependenciesPanel.js` | External dependencies panel |
| JavaScript Info Panel | `packages/devpages-debug/panels/JavaScriptInfoPanel.js` | JavaScript info panel |
| PData Panel | `packages/devpages-debug/panels/PDataPanel.js` | PData debugging panel |
| DOM Inspector Debug Panel | `packages/devpages-debug/panels/dom-inspector/DomInspectorDebugPanel.js` | DOM inspection panel |
| State Inspector Panel | `packages/devpages-debug/panels/state/StateInspectorPanel.js` | State inspection panel |

### 🎨 Settings Panels
| Panel Name | File Path | Category |
|------------|-----------|----------|
| Console Log Panel | `client/settings/panels/console/ConsoleLogPanel.js` | Logging |
| Design Tokens Panel | `client/settings/panels/css-design/DesignTokensPanel.js` | Design |
| HTML Render Settings Panel | `client/settings/panels/html-render/HtmlRenderSettingsPanel.js` | Rendering |
| Icons Panel | `client/settings/panels/icons/IconsPanel.js` | Design |
| Plugins Panel | `client/settings/panels/plugins/PluginsPanel.js` | System |
| Preview Settings Panel | `client/settings/panels/preview/PreviewSettingsPanel.js` | Preview |
| Publish Settings Panel | `client/settings/panels/publish/PublishSettingsPanel.js` | Publishing |
| Theme Selector Panel | `client/settings/panels/themes/ThemeSelectorPanel.js` | Theming |

## 🔢 Redux-Related Files
| File Path | Description | Category |
|-----------|-------------|----------|
| `client/store/PanelStatePersistence.js` | Panel state persistence | State Management |
| `client/store/reduxConnect.js` | Redux connection utilities | Utilities |
| `client/store/middleware/panelPersistenceMiddleware.js` | Panel persistence middleware | Middleware |
| `client/store/middleware/panelSizesPersistenceMiddleware.js` | Panel sizes persistence middleware | Middleware |
| `client/store/reducers/panelMetadata.js` | Panel metadata reducer | Reducer |
| `client/store/slices/debugPanelSlice.js` | Debug panel slice | Slice |
| `client/store/slices/panelSlice.js` | Main panel slice | Slice |

## 🚧 Modern Panel Files (To Be Renamed)
| File Path | Proposed New Name | Description |
|-----------|-------------------|-------------|
| `client/panels/ModernBasePanel.js` | `BasePanel.js` | Unified base panel implementation |
| `client/panels/ModernContextPanel.js` | `ContextPanel.js` | Modern context panel |
| `client/panels/ModernPanelRegistry.js` | `PanelRegistry.js` | Modern panel registry |

## 📝 Notes
- Some files are in `notsure/` directory and may need review
- Multiple panel management and registration systems exist
- Significant opportunity for consolidation and simplification

## 🔍 Next Steps
1. Rename Modern* files to standard names
2. Consolidate panel management systems
3. Remove redundant files
4. Standardize panel registration process
