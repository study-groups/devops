# Plugin System Documentation

## Overview

The DevPages plugin system provides a flexible, extensible architecture for adding features to the markdown preview system. Each plugin has its own state slice with configurable settings and dynamic UI generation.

## Architecture

### State Structure
```javascript
{
  plugins: {
    mermaid: {
      name: "Mermaid Diagrams",
      settings: { enabled: true, theme: "default" },
      settingsManifest: [
        { key: 'enabled', label: 'Enable Mermaid', type: 'toggle' },
        { key: 'theme', label: 'Theme', type: 'select', options: ['default', 'forest', 'dark', 'neutral'] }
      ]
    },
    highlight: {
      name: "Syntax Highlighting",
      settings: { enabled: true },
      settingsManifest: [
        { key: 'enabled', label: 'Enable Syntax Highlighting', type: 'toggle' }
      ]
    }
    // ... other plugins
  }
}
```

### Core Components

1. **`appState.js`**: Defines default plugin configuration and handles persistence
2. **`PluginsPanel.js`**: Dynamically generates UI controls based on plugin settings manifests
3. **`pluginsReducer.js`**: Handles plugin state updates via Redux-style actions
4. **`selectors.js`**: Provides clean state access with `getIsPluginEnabled(state, pluginName)`

## Plugin Configuration

### Default Plugin Configuration
Located in `appState.js`:

```javascript
const defaultPluginsConfig = {
  'mermaid': {
    name: "Mermaid Diagrams",
    defaultState: { 
      enabled: true,
      theme: 'default'
    },
    settingsManifest: [
      { key: 'enabled', label: 'Enable Mermaid', type: 'toggle' },
      { key: 'theme', label: 'Theme', type: 'select', options: ['default', 'forest', 'dark', 'neutral'] }
    ]
  }
};
```

### Settings Manifest Types
- **`toggle`**: Checkbox for boolean values
- **`select`**: Dropdown with predefined options
- **Future**: `text`, `number`, `range` for expanded control types

## Adding a New Plugin

1. **Define in `defaultPluginsConfig`**:
```javascript
'myPlugin': {
  name: "My Custom Plugin",
  defaultState: { 
    enabled: false,
    customSetting: 'value1'
  },
  settingsManifest: [
    { key: 'enabled', label: 'Enable My Plugin', type: 'toggle' },
    { key: 'customSetting', label: 'Custom Setting', type: 'select', options: ['value1', 'value2'] }
  ]
}
```

2. **Create Plugin Implementation** (e.g., `client/preview/plugins/myPlugin.js`)

3. **Add Plugin Check in Renderer**:
```javascript
if (isPluginEnabled('myPlugin')) {
  // Plugin-specific rendering logic
}
```

## Usage

### Checking Plugin State
```javascript
import { getIsPluginEnabled } from '/client/store/selectors.js';
import { appStore } from '/client/appState.js';

const state = appStore.getState();
const isMermaidEnabled = getIsPluginEnabled(state, 'mermaid');
```

### Updating Plugin Settings
```javascript
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

dispatch({
  type: ActionTypes.PLUGIN_UPDATE_SETTING,
  payload: {
    pluginId: 'mermaid',
    settingKey: 'theme',
    value: 'dark'
  }
});
```

## UI Features

- **Collapsible Plugin Groups**: Each plugin has its own collapsible section
- **Dynamic Control Generation**: UI controls are automatically generated from settings manifest
- **Real-time Updates**: Changes immediately update the state and re-render content
- **Persistence**: Plugin settings are automatically saved to localStorage

## Current Plugins

1. **Mermaid Diagrams**: Renders flowcharts, sequence diagrams, etc.
2. **Syntax Highlighting**: Code syntax highlighting via highlight.js
3. **KaTeX**: Mathematical notation rendering
4. **Audio Markdown**: Audio file embedding support

## Technical Notes

- **Single Persistence System**: Uses `appState.js` subscription, not dual persistence
- **State-based Plugin Checking**: All plugin status checks go through the state system
- **On-demand Initialization**: Plugins initialize only when enabled and needed
- **Clean Separation**: Plugin logic separated from UI rendering logic

## Future Enhancements

- Plugin marketplace/discovery
- Plugin dependency management
- More control types (text input, number input, range sliders)
- Plugin-specific CSS injection
- Plugin communication/event system 