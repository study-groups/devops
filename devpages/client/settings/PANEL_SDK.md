# Settings Panel SDK

> **A developer-friendly guide to creating and managing settings panels**

## 🚀 Quick Start

Want to add a new settings panel? It's just 3 steps:

```javascript
// 1. Import the registry
import { panelRegistry } from './panelRegistry.js';

// 2. Create your panel class
export class MyAwesomePanel {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="settings-section-content">
        <h4>My Awesome Feature</h4>
        <p>This panel does amazing things!</p>
      </div>
    `;
  }
  
  destroy() {
    // Optional cleanup
  }
}

// 3. Register your panel
panelRegistry.register({
  id: 'my-awesome-panel',
  title: 'My Awesome Panel',
  component: MyAwesomePanel,
  order: 35,
  defaultCollapsed: false
});
```

Then add the import to `SettingsPanel.js`:
```javascript
import './MyAwesomePanel.js';
```

**That's it!** Your panel will automatically appear in the settings UI.

---

## 📚 Complete API Reference

### Importing the Registry

```javascript
import { panelRegistry } from './panelRegistry.js';
```

The registry is a singleton - import it anywhere you need it.

### Panel Registration

```javascript
panelRegistry.register(config)
```

**Config Object:**
```typescript
{
  id: string,                    // Required: Unique DOM ID
  title: string,                 // Required: Display name
  component: Class,              // Required: Panel constructor
  order?: number,                // Optional: Sort order (default: 100)
  defaultCollapsed?: boolean     // Optional: Initial state (default: false)
}
```

**Example:**
```javascript
panelRegistry.register({
  id: 'my-panel-container',      // Will become DOM id
  title: 'My Panel',             // Shows in header
  component: MyPanelClass,       // Your panel class
  order: 25,                     // Lower = appears first
  defaultCollapsed: true         // Starts collapsed
});
```

### Registry Methods

```javascript
// Get all panels (sorted by order)
const panels = panelRegistry.getPanels();

// Get specific panel by ID
const panel = panelRegistry.getPanel('theme-settings-container');

// Get count of registered panels
const count = panelRegistry.count();

// Clear all panels (useful for testing)
panelRegistry.clear();
```

---

## 🏗️ Panel Class Requirements

Your panel class needs:

### 1. Constructor
```javascript
constructor(containerElement) {
  this.container = containerElement;
  // Your initialization code
}
```

The `containerElement` is a DOM element where your panel content goes.

### 2. Destroy Method (Optional but Recommended)
```javascript
destroy() {
  // Clean up event listeners
  // Remove DOM elements
  // Cancel timers/requests
}
```

Called when the settings panel is destroyed.

---

## 🎨 Styling Your Panel

### Use Existing CSS Classes

```javascript
// Main content wrapper
const content = document.createElement('div');
content.classList.add('settings-section-content');

// Section headers
const header = document.createElement('h4');
header.classList.add('settings-section-title');

// Input groups
const inputGroup = document.createElement('div');
inputGroup.classList.add('settings-input-group');

// Buttons
const button = document.createElement('button');
button.classList.add('settings-button');
```

### Available CSS Classes

- `.settings-section-content` - Main content wrapper
- `.settings-section-title` - Section headers (h3, h4)
- `.settings-input-group` - Input/control groups
- `.settings-button` - Standard buttons
- `.settings-checkbox` - Checkboxes
- `.settings-label` - Labels
- `.settings-description` - Help text

---

## 📋 Panel Templates

### Basic Information Panel
```javascript
export class InfoPanel {
  constructor(container) {
    this.container = container;
    this.render();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="settings-section-content">
        <h4>Information</h4>
        <p class="settings-description">
          This panel displays helpful information.
        </p>
        <div class="info-display">
          <strong>Status:</strong> Active
        </div>
      </div>
    `;
  }
  
  destroy() {}
}
```

### Interactive Controls Panel
```javascript
export class ControlsPanel {
  constructor(container) {
    this.container = container;
    this.render();
    this.attachEvents();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="settings-section-content">
        <h4>Controls</h4>
        
        <div class="settings-input-group">
          <label class="settings-label">
            <input type="checkbox" class="settings-checkbox" id="my-toggle">
            Enable Feature
          </label>
        </div>
        
        <div class="settings-input-group">
          <label class="settings-label" for="my-select">Mode:</label>
          <select id="my-select" class="settings-select">
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        
        <button class="settings-button" id="my-action">
          Perform Action
        </button>
      </div>
    `;
  }
  
  attachEvents() {
    const toggle = this.container.querySelector('#my-toggle');
    const select = this.container.querySelector('#my-select');
    const button = this.container.querySelector('#my-action');
    
    toggle?.addEventListener('change', (e) => {
      console.log('Toggle:', e.target.checked);
    });
    
    select?.addEventListener('change', (e) => {
      console.log('Mode:', e.target.value);
    });
    
    button?.addEventListener('click', () => {
      console.log('Action performed!');
    });
  }
  
  destroy() {
    // Event listeners are automatically cleaned up when DOM is removed
    // But you can do manual cleanup here if needed
  }
}
```

### State-Connected Panel
```javascript
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export class StatePanel {
  constructor(container) {
    this.container = container;
    this.unsubscribe = null;
    this.render();
    this.subscribeToState();
  }
  
  render() {
    const state = appStore.getState();
    this.container.innerHTML = `
      <div class="settings-section-content">
        <h4>State Panel</h4>
        <p>Current theme: ${state.ui?.theme || 'unknown'}</p>
        <button class="settings-button" id="toggle-theme">
          Toggle Theme
        </button>
      </div>
    `;
    
    this.container.querySelector('#toggle-theme')
      ?.addEventListener('click', () => {
        dispatch({ type: ActionTypes.UI_TOGGLE_THEME });
      });
  }
  
  subscribeToState() {
    this.unsubscribe = appStore.subscribe((newState, prevState) => {
      if (newState.ui?.theme !== prevState.ui?.theme) {
        this.render(); // Re-render when theme changes
      }
    });
  }
  
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
```

---

## 🔧 Advanced Features

### Panel Ordering

Panels are sorted by their `order` value (ascending):

```javascript
// These will appear in this order:
panelRegistry.register({ order: 10, ... }); // First
panelRegistry.register({ order: 20, ... }); // Second  
panelRegistry.register({ order: 30, ... }); // Third
panelRegistry.register({ ... });            // Last (default order: 100)
```

### Conditional Registration

```javascript
// Only register in development
if (process.env.NODE_ENV === 'development') {
  panelRegistry.register({
    id: 'debug-panel',
    title: 'Debug Tools',
    component: DebugPanel,
    order: 999
  });
}

// Only register if feature is enabled
if (window.featureFlags?.advancedSettings) {
  panelRegistry.register({
    id: 'advanced-panel',
    title: 'Advanced Settings',
    component: AdvancedPanel
  });
}
```

### Dynamic Panel Updates

```javascript
export class DynamicPanel {
  constructor(container) {
    this.container = container;
    this.data = [];
    this.render();
    this.loadData();
  }
  
  async loadData() {
    try {
      const response = await fetch('/api/panel-data');
      this.data = await response.json();
      this.render(); // Re-render with new data
    } catch (error) {
      console.error('Failed to load panel data:', error);
    }
  }
  
  render() {
    this.container.innerHTML = `
      <div class="settings-section-content">
        <h4>Dynamic Content</h4>
        ${this.data.length === 0 
          ? '<p>Loading...</p>' 
          : this.data.map(item => `<p>${item.name}</p>`).join('')
        }
      </div>
    `;
  }
}
```

---

## 🐛 Debugging & Testing

### Check Registry State

```javascript
// In browser console:
console.log('Registered panels:', panelRegistry.getPanels());
console.log('Panel count:', panelRegistry.count());
```

### Test Panel Registration

```javascript
// Create a test panel
class TestPanel {
  constructor(container) {
    container.innerHTML = '<p>Test panel works!</p>';
  }
  destroy() {}
}

// Register it
panelRegistry.register({
  id: 'test-panel',
  title: 'Test',
  component: TestPanel,
  order: 1 // Will appear first
});

// Check if it registered
console.log(panelRegistry.getPanel('test-panel'));
```

### Common Issues

1. **Panel not appearing**: Check if you imported the panel file in `SettingsPanel.js`
2. **Wrong order**: Check the `order` value in registration
3. **Styling issues**: Use the provided CSS classes
4. **State not updating**: Make sure to subscribe to state changes properly

---

## 🎯 Best Practices

1. **Always provide a destroy method** for cleanup
2. **Use semantic IDs** like `my-feature-panel` not `panel1`
3. **Choose appropriate order values** (multiples of 10 work well)
4. **Follow existing styling patterns** for consistency
5. **Handle errors gracefully** in async operations
6. **Test your panel** in both collapsed and expanded states

---

## 🤝 Need Help?

- Check existing panels for examples
- Look at `IMPLEMENTATION_DEMO.md` for the big picture
- The registry validates your config and will log helpful errors
- All panels follow the same patterns - when in doubt, copy an existing one!

**Happy panel building!** 🎉 