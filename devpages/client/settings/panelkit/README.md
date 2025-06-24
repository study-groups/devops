# DevPages Settings UI Layout Language (DSUI)

## Overview

DSUI is a comprehensive, declarative layout language and functional data-driven syntax for defining Settings UI panels that integrate seamlessly with the DevPages system. It provides type safety, validation, automatic rendering, and maintains consistency with the existing design system while offering enhanced functionality.

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Component Types](#component-types)
3. [Layout Language](#layout-language)
4. [State Management](#state-management)
5. [Validation System](#validation-system)
6. [Action System](#action-system)
7. [Integration Guide](#integration-guide)
8. [Examples](#examples)
9. [Migration Guide](#migration-guide)
10. [Best Practices](#best-practices)

## Core Architecture

### Design Principles

1. **Declarative**: Define UI structure through data, not imperative code
2. **Type-Safe**: Full TypeScript support with comprehensive type definitions
3. **Reactive**: Automatic state synchronization with Redux store
4. **Accessible**: Built-in accessibility features and ARIA support
5. **Themeable**: Integrates with DevPages design system and dark mode
6. **Extensible**: Plugin architecture for custom components and validators

### System Components

```
DSUI System
├── Schema Definition (dsui-schema.js)
├── Component Library (dsui-components.js)
├── Integration Layer (dsui-integration.js)
├── Styling System (dsui-styles.css)
└── Documentation (DSUI_DOCUMENTATION.md)
```

## Component Types

### Layout Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `section` | Main content sections with headers | `label`, `description`, `collapsible` |
| `subsection` | Nested content areas | `label`, `level` |
| `group` | Logical grouping of related controls | `layout`, `gap`, `wrap` |
| `grid` | CSS Grid layout container | `columns`, `gap`, `responsive` |
| `flex` | Flexbox layout container | `direction`, `align`, `justify` |
| `tabs` | Tabbed interface | `tabs`, `defaultTab` |
| `accordion` | Collapsible sections | `sections`, `multiple` |

### Input Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `text` | Text input field | `placeholder`, `pattern`, `maxLength` |
| `number` | Numeric input with validation | `min`, `max`, `step`, `unit` |
| `email` | Email input with validation | `placeholder`, `multiple` |
| `url` | URL input with validation | `placeholder`, `protocols` |
| `password` | Password input field | `minLength`, `showStrength` |
| `textarea` | Multi-line text input | `rows`, `cols`, `resize` |
| `select` | Dropdown selection | `options`, `searchable`, `clearable` |
| `multiselect` | Multiple selection dropdown | `options`, `max`, `tags` |
| `radio` | Radio button group | `options`, `inline`, `icons` |
| `checkbox` | Single checkbox | `label`, `description` |
| `toggle` | Toggle switch | `onLabel`, `offLabel` |
| `slider` | Range slider input | `min`, `max`, `step`, `marks` |
| `color` | Color picker input | `format`, `presets`, `alpha` |
| `file` | File upload input | `accept`, `multiple`, `maxSize` |
| `date` | Date picker | `format`, `min`, `max` |
| `time` | Time picker | `format`, `step` |
| `datetime` | Date and time picker | `format`, `timezone` |

### Display Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `label` | Text labels | `text`, `level`, `required` |
| `description` | Help text and descriptions | `text`, `type` |
| `code` | Code display with syntax highlighting | `language`, `theme` |
| `preview` | Live preview areas | `content`, `iframe` |
| `status` | Status indicators | `items`, `layout` |
| `badge` | Small status badges | `text`, `variant`, `icon` |
| `progress` | Progress indicators | `value`, `max`, `label` |

### Action Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `button` | Action buttons | `variant`, `size`, `icon`, `loading` |
| `link` | Navigation links | `href`, `target`, `external` |
| `dropdown` | Action dropdown menus | `items`, `trigger` |
| `menu` | Context menus | `items`, `position` |

### Advanced Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `theme-editor` | Visual theme editing interface | `sections`, `livePreview` |
| `css-editor` | CSS file management | `validation`, `syntax` |
| `token-grid` | Design token editing grid | `categories`, `preview` |
| `color-palette` | Color palette editor | `format`, `harmony` |
| `font-picker` | Font selection interface | `categories`, `preview` |

## Layout Language

### Basic Structure

```javascript
const panelDefinition = {
  id: 'my-panel',
  title: 'My Panel',
  description: 'Panel description',
  order: 10,
  defaultCollapsed: false,
  
  layout: {
    type: 'sections', // 'sections' | 'tabs' | 'wizard' | 'grid' | 'flex'
    responsive: {
      breakpoints: { mobile: 768, tablet: 1024 },
      behavior: 'stack' // 'stack' | 'hide' | 'scroll'
    },
    children: [
      // Component definitions
    ]
  }
};
```

### Component Definition

```javascript
{
  type: 'text',           // Component type
  id: 'unique-id',        // Unique identifier
  label: 'Field Label',   // Display label
  description: 'Help text', // Optional description
  props: {                // Component-specific properties
    placeholder: 'Enter text...',
    maxLength: 100
  },
  state: {                // State binding
    path: 'settings.fieldName',
    action: 'SETTINGS_UPDATE_FIELD'
  },
  validation: [           // Validation rules
    { type: 'required', message: 'This field is required' }
  ],
  conditions: [           // Conditional rendering
    { path: 'settings.enabled', operator: 'equals', value: true }
  ],
  actions: [              // Action handlers
    { type: 'custom-action', payload: { key: 'value' } }
  ]
}
```

### Responsive Layout

```javascript
{
  type: 'grid',
  props: {
    columns: 3,
    gap: 'md',
    responsive: {
      mobile: { columns: 1 },
      tablet: { columns: 2 }
    }
  },
  children: [
    // Grid items
  ]
}
```

## State Management

### State Binding

DSUI integrates with the Redux store through declarative state bindings:

```javascript
{
  type: 'text',
  id: 'theme-directory',
  state: {
    path: 'pageTheme.themeDir',           // Path in Redux state
    action: 'SETTINGS_SET_PAGE_THEME_DIR' // Action to dispatch on change
  }
}
```

### Computed Values

```javascript
{
  type: 'status',
  props: {
    items: [
      {
        label: 'Current Theme',
        value: { 
          path: 'pageTheme.currentTheme', 
          fallback: 'None',
          computed: (state) => state.pageTheme.themeDir ? 'Active' : 'Inactive'
        }
      }
    ]
  }
}
```

### Local Panel State

```javascript
const panelDefinition = {
  // ... other properties
  state: {
    namespace: 'myPanel',
    initialState: {
      activeTab: 0,
      showAdvanced: false
    },
    computed: {
      isValid: (state) => state.field1 && state.field2
    }
  }
};
```

## Validation System

### Built-in Validators

```javascript
validation: [
  { type: 'required', message: 'This field is required' },
  { type: 'minLength', value: 3, message: 'Minimum 3 characters' },
  { type: 'maxLength', value: 50, message: 'Maximum 50 characters' },
  { type: 'pattern', pattern: '^[a-zA-Z]+$', message: 'Letters only' },
  { type: 'min', value: 0, message: 'Must be positive' },
  { type: 'max', value: 100, message: 'Maximum value is 100' },
  { type: 'email', message: 'Invalid email format' },
  { type: 'url', message: 'Invalid URL format' }
]
```
### Custom Validators

```javascript
validation: [
  {
    type: 'custom',
    validator: async (value, context) => {
      // Custom validation logic
      const exists = await context.checkFileExists(value);
      return exists || 'File does not exist';
    },
    message: 'Custom validation failed'
  }
]
```

### Cross-field Validation

```javascript
validation: [
  {
    type: 'custom',
    validator: (value, context) => {
      const otherField = context.getFieldValue('other-field');
      return value !== otherField || 'Values must be different';
    }
  }
]
```

## Action System

### Built-in Actions

```javascript
actions: [
  { type: 'validate-theme' },
  { type: 'reload-theme' },
  { type: 'export-tokens' },
  { type: 'show-notification', payload: { type: 'success', message: 'Saved!' } }
]
```

### Custom Actions

```javascript
const panelDefinition = {
  // ... other properties
  actions: {
    'custom-action': async (payload, context) => {
      // Custom action logic
      const result = await someAsyncOperation(payload);
      context.updateState({ result });
      context.showNotification('success', 'Action completed');
    }
  }
};
```

### Action Context

The action context provides access to:

```javascript
{
  panelId: 'current-panel-id',
  state: /* current Redux state */,
  dispatch: /* Redux dispatch function */,
  updateState: (updates) => /* update panel state */,
  getState: () => /* get panel state */,
  showNotification: (type, message) => /* show notification */,
  checkFileExists: (url) => /* check if file exists */,
  reloadTheme: () => /* reload current theme */,
  validateTheme: (themeDir) => /* validate theme directory */,
  exportDesignTokens: () => /* export design tokens */
}
```

## Integration Guide

### 1. Register a DSUI Panel

```javascript
import { registerDSUIPanel } from './dsui-integration.js';

const myPanelDefinition = {
  id: 'my-custom-panel',
  title: 'My Custom Panel',
  order: 20,
  layout: {
    type: 'sections',
    children: [
      // Component definitions
    ]
  }
};

registerDSUIPanel(myPanelDefinition);
```

### 2. Migrate Existing Panel

```javascript
import { migrateLegacyPanel } from './dsui-integration.js';
import { MyLegacyPanel } from './MyLegacyPanel.js';

migrateLegacyPanel(MyLegacyPanel, {
  id: 'migrated-panel',
  title: 'Migrated Panel',
  order: 25
});
```

### 3. Custom Component Registration

```javascript
import { DSUIRenderer } from './dsui-schema.js';

const renderer = new DSUIRenderer(store, dispatch);

renderer.registerComponent('my-custom-component', (component, context) => {
  const element = document.createElement('div');
  element.className = 'my-custom-component';
  element.textContent = component.props.text;
  return element;
});
```

## Examples

### Complete Design Tokens Panel

```javascript
const DesignTokensPanelDefinition = {
  id: 'design-tokens-panel',
  title: 'Design Tokens',
  description: 'Manage page themes and design tokens',
  order: 10,
  icon: '🎨',
  
  layout: {
    type: 'sections',
    children: [
      {
        type: 'section',
        label: 'Theme Configuration',
        children: [
          {
            type: 'text',
            id: 'theme-dir',
            label: 'Theme Directory',
            description: 'Path to theme directory containing CSS files',
            props: {
              placeholder: '/themes/classic'
            },
            state: {
              path: 'pageTheme.themeDir',
              action: 'SETTINGS_SET_PAGE_THEME_DIR'
            },
            validation: [
              { type: 'required', message: 'Theme directory is required' },
              { type: 'pattern', pattern: '^/.*', message: 'Must start with /' }
            ]
          },
          {
            type: 'radio',
            id: 'theme-mode',
            label: 'Theme Mode',
            props: {
              options: [
                { value: 'light', label: 'Light', icon: '☀️' },
                { value: 'dark', label: 'Dark', icon: '🌙' }
              ],
              inline: true
            },
            state: {
              path: 'pageTheme.themeMode',
              action: 'SETTINGS_SET_PAGE_THEME_MODE'
            }
          }
        ]
      },
      {
        type: 'section',
        label: 'Actions',
        children: [
          {
            type: 'group',
            props: { layout: 'horizontal', gap: 'sm' },
            children: [
              {
                type: 'button',
                label: 'Validate Theme',
                props: { variant: 'secondary' },
                actions: [{ type: 'validate-theme' }]
              },
              {
                type: 'button',
                label: 'Export Tokens',
                props: { variant: 'secondary' },
                actions: [{ type: 'export-tokens' }]
              }
            ]
          }
        ]
      }
    ]
  },
  
  actions: {
    'validate-theme': async (payload, context) => {
      const { themeDir } = context.getState();
      if (!themeDir) {
        context.showNotification('error', 'No theme directory specified');
        return;
      }
      
      const validation = await context.validateTheme(themeDir);
      if (validation.valid) {
        context.showNotification('success', 'Theme validation successful');
      } else {
        context.showNotification('warning', `Missing files: ${validation.missing.join(', ')}`);
      }
    }
  }
};
```

### CSS Settings Panel

```javascript
const CssSettingsPanelDefinition = {
  id: 'css-settings-panel',
  title: 'CSS Settings',
  order: 20,
  
  layout: {
    type: 'sections',
    children: [
      {
        type: 'section',
        label: 'Rendering Mode',
        children: [
          {
            type: 'radio',
            id: 'preview-mode',
            props: {
              options: [
                {
                  value: 'direct',
                  label: 'Direct Attachment',
                  description: 'Faster rendering, may have CSS conflicts'
                },
                {
                  value: 'iframe',
                  label: 'Iframe Isolation',
                  description: 'Better isolation, slightly slower'
                }
              ]
            },
            state: {
              path: 'settings.preview.renderMode',
              action: 'SETTINGS_SET_PREVIEW_MODE'
            }
          }
        ]
      },
      {
        type: 'section',
        label: 'CSS Files',
        children: [
          {
            type: 'css-editor',
            id: 'css-file-manager',
            props: {
              showDefaultFile: true,
              allowReorder: true
            },
            state: {
              path: 'settings.preview.cssFiles',
              actions: {
                add: 'SETTINGS_ADD_PREVIEW_CSS',
                remove: 'SETTINGS_REMOVE_PREVIEW_CSS',
                toggle: 'SETTINGS_TOGGLE_PREVIEW_CSS_ENABLED'
              }
            }
          }
        ]
      }
    ]
  }
};
```

## Migration Guide

### From Legacy Panels to DSUI

1. **Analyze Existing Panel Structure**
   ```javascript
   // Legacy panel
   class MyLegacyPanel {
     constructor(container) {
       this.container = container;
       this.render();
     }
     
     render() {
       this.container.innerHTML = `
         <div class="settings-section-content">
           <h4>Settings</h4>
           <input type="text" id="my-input" />
           <button onclick="this.save()">Save</button>
         </div>
       `;
     }
   }
   ```

2. **Convert to DSUI Definition**
   ```javascript
   const MyPanelDefinition = {
     id: 'my-panel',
     title: 'Settings',
     layout: {
       type: 'sections',
       children: [
         {
           type: 'text',
           id: 'my-input',
           label: 'Input Field',
           state: {
             path: 'myPanel.inputValue',
             action: 'MY_PANEL_SET_INPUT'
           }
         },
         {
           type: 'button',
           label: 'Save',
           actions: [{ type: 'save-settings' }]
         }
       ]
     },
     actions: {
       'save-settings': (payload, context) => {
         // Save logic
       }
     }
   };
   ```

3. **Register the New Panel**
   ```javascript
   import { registerDSUIPanel } from './dsui-integration.js';
   registerDSUIPanel(MyPanelDefinition);
   ```

### Gradual Migration Strategy

1. **Phase 1**: Create DSUI versions alongside legacy panels
2. **Phase 2**: Test DSUI panels in development
3. **Phase 3**: Replace legacy panels one by one
4. **Phase 4**: Remove legacy panel code

## Best Practices

### 1. Component Organization

```javascript
// Group related components in sections
{
  type: 'section',
  label: 'Authentication',
  children: [
    { type: 'text', id: 'username', label: 'Username' },
    { type: 'password', id: 'password', label: 'Password' },
    { type: 'checkbox', id: 'remember', label: 'Remember me' }
  ]
}
```

### 2. State Management

```javascript
// Use clear, hierarchical state paths
state: {
  path: 'settings.authentication.username', // Clear hierarchy
  action: 'SETTINGS_SET_AUTH_USERNAME'      // Descriptive action
}
```

### 3. Validation

```javascript
// Provide clear, helpful validation messages
validation: [
  { 
    type: 'required', 
    message: 'Username is required to sign in' 
  },
  { 
    type: 'minLength', 
    value: 3, 
    message: 'Username must be at least 3 characters long' 
  }
]
```

### 4. Accessibility

```javascript
// Always provide labels and descriptions
{
  type: 'text',
  id: 'email',
  label: 'Email Address',
  description: 'We\'ll use this to send you notifications',
  props: {
    'aria-describedby': 'email-help',
    required: true
  }
}
```

### 5. Responsive Design

```javascript
// Design for mobile-first
{
  type: 'grid',
  props: {
    columns: 1, // Mobile default
    responsive: {
      tablet: { columns: 2 },
      desktop: { columns: 3 }
    }
  }
}
```

### 6. Performance

```javascript
// Use conditional rendering for expensive components
{
  type: 'theme-editor',
  conditions: [
    { path: 'ui.showAdvancedEditor', operator: 'equals', value: true }
  ]
}
```

### 7. Error Handling

```javascript
// Provide graceful error handling in actions
actions: {
  'save-theme': async (payload, context) => {
    try {
      await saveTheme(payload);
      context.showNotification('success', 'Theme saved successfully');
    } catch (error) {
      context.showNotification('error', `Failed to save theme: ${error.message}`);
    }
  }
}
```

## Conclusion

DSUI provides a powerful, declarative way to build Settings UI panels that are:

- **Consistent** with the DevPages design system
- **Maintainable** through declarative definitions
- **Accessible** with built-in ARIA support
- **Performant** with optimized rendering
- **Extensible** through custom components and actions

The system bridges the gap between the existing DevPages architecture and modern UI development practices, providing a smooth migration path while enabling powerful new capabilities.

For more examples and advanced usage, see the example panels in the codebase and the integration tests. 