# Settings Panel System

> **A modular, extensible settings panel system using Inversion of Control**

## 🏗️ Architecture Overview

This settings panel system uses **Inversion of Control (IoC)** to create a modular, data-driven architecture where panels register themselves independently.

### Key Components

- **`panelRegistry.js`** - The IoC container that collects panel configurations
- **`SettingsPanel.js`** - The main host that renders panels from registry data
- **Individual Panel Files** - Self-contained panels that register themselves
- **`PANEL_SDK.md`** - Complete developer guide for creating panels

## 🚀 Quick Start

### For Users
The settings panel appears automatically when you open the application settings. All panels are organized and collapsible.

### For Developers
Want to add a new settings panel? See **[PANEL_SDK.md](./PANEL_SDK.md)** for the complete guide.

**Quick example:**
```javascript
import { panelRegistry } from './panelRegistry.js';

export class MyPanel {
  constructor(container) {
    container.innerHTML = '<p>Hello, World!</p>';
  }
  destroy() {}
}

panelRegistry.register({
  id: 'my-panel',
  title: 'My Panel',
  component: MyPanel,
  order: 50
});
```

## 📁 File Structure

```
client/settings/
├── README.md                    # This file - architecture overview
├── PANEL_SDK.md                 # Complete developer SDK
├── IMPLEMENTATION_DEMO.md       # IoC implementation details
├── ExamplePanel.js              # Working example panel
│
├── panelRegistry.js             # IoC container/registry
├── SettingsPanel.js             # Main settings panel host
├── settingsInitializer.js       # Initialization logic
│
├── ThemeSettingsPanel.js        # Theme & design settings
├── PluginsPanel.js              # Plugin management
├── CssSettingsPanel.js          # CSS file management
├── PublishSettingsPanel.js      # Publishing options
├── JavaScriptPanel.js           # JS documentation
├── ConsoleLogPanel.js           # Console logging controls
├── DevToolsPanel.js             # Development tools
│
├── settings.css                 # Main styles
├── ThemeSettingsPanel.css       # Theme panel styles
├── CssSettingsPanel.css         # CSS panel styles
└── settings-popup.css           # Popup styles
```

## 🎯 Current Panels

| Panel | Order | Default State | Description |
|-------|-------|---------------|-------------|
| Theme & Design | 10 | Expanded | Theme switching, design tokens |
| 🎯 Example Panel | 15 | Expanded | SDK demonstration (if imported) |
| Plugins | 20 | Collapsed | Plugin settings and status |
| CSS | 30 | Collapsed | CSS file management |
| Publish Settings | 40 | Collapsed | Publishing configuration |
| Preview JavaScript | 50 | Collapsed | JS usage documentation |
| Console Log Options | 60 | Collapsed | Logging controls and filters |
| Development Tools | 70 | Collapsed | Cache management, debugging |

## 🔧 How It Works

### 1. Registration Phase
When the application loads, each panel file imports the registry and registers itself:

```javascript
// Each panel file ends with:
panelRegistry.register({
  id: 'unique-panel-id',
  title: 'Panel Title',
  component: PanelClass,
  order: 30,
  defaultCollapsed: true
});
```

### 2. Rendering Phase
The main `SettingsPanel` gets the registered panels and renders them:

```javascript
// In SettingsPanel.js
const panels = panelRegistry.getPanels(); // Sorted by order
panels.forEach(panelData => {
  const container = this.createSectionContainer(panelData.id, panelData.title);
  this.panelInstances[panelData.id] = new panelData.component(container);
});
```

### 3. Lifecycle Management
- Panels are instantiated when the settings panel opens
- Each panel manages its own state and events
- Panels are destroyed when the settings panel closes

## 🎨 Styling System

The system provides consistent CSS classes for all panels:

- `.settings-section-content` - Main content wrapper
- `.settings-input-group` - Form control groups
- `.settings-button` - Standard buttons
- `.settings-label` - Form labels
- `.settings-description` - Help text

See existing panels for styling examples.

## 🧪 Testing the Example Panel

To see the SDK in action:

1. Add this import to `SettingsPanel.js`:
   ```javascript
   import './ExamplePanel.js';
   ```

2. Open the settings panel in your app

3. Look for the "🎯 Example Panel" section

4. Interact with the controls and watch the console

## 📚 Documentation

- **[PANEL_SDK.md](./PANEL_SDK.md)** - Complete developer guide with examples
- **[IMPLEMENTATION_DEMO.md](./IMPLEMENTATION_DEMO.md)** - IoC implementation details
- **[ExamplePanel.js](./ExamplePanel.js)** - Working code example

## 🎯 Benefits

✅ **Modular** - Each panel is self-contained  
✅ **Extensible** - Add panels without modifying core code  
✅ **Maintainable** - Clear separation of concerns  
✅ **Testable** - Panels can be tested independently  
✅ **Configurable** - Easy ordering and default states  
✅ **Developer-Friendly** - Simple API with good documentation  

## 🤝 Contributing

1. Read the **[PANEL_SDK.md](./PANEL_SDK.md)** for the complete API
2. Look at existing panels for patterns
3. Test your panel with the example
4. Follow the established styling conventions

**Happy coding!** 🚀 