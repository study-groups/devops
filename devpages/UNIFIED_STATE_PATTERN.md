# Unified State Persistence Pattern for DevPages

## Problem Statement

Currently, DevPages has multiple ways to access localStorage:
1. Direct localStorage calls in reducers
2. AppState subscription duplicating persistence logic  
3. Individual modules accessing localStorage directly
4. Multiple persistence utilities

This creates inconsistency, race conditions, and maintenance overhead.

## Solution: Single Source of Truth

**The reducer pattern should be the ONLY way to persist state.** All state changes go through dispatch → reducer → automatic persistence.

## Migration Strategy

### 1. Use Enhanced Reducer Utils

```javascript
import { 
    createStateSlice, 
    createSettingsSlice, 
    createToggleSlice 
} from '/client/store/reducers/enhancedReducerUtils.js';
```

### 2. Simple Toggle Example

**Before (Multiple localStorage access):**
```javascript
// ❌ Direct localStorage access
const debugMode = localStorage.getItem('debugMode') === 'true';

// ❌ Manual persistence
function toggleDebug() {
    const newValue = !debugMode;
    localStorage.setItem('debugMode', newValue);
    updateUI(newValue);
}
```

**After (Unified pattern):**
```javascript
// ✅ Single source of truth
const debugSlice = createToggleSlice('debugMode', false);

// Use through dispatch
dispatch(debugSlice.actions.toggle());
dispatch(debugSlice.actions.set(true));

// State automatically persisted
```

### 3. Settings Example

**Before (Mixed persistence):**
```javascript
// ❌ Multiple localStorage keys, manual persistence
class SettingsPanel {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.autoSave = localStorage.getItem('autoSave') === 'true';
    }
    
    updateTheme(theme) {
        this.theme = theme;
        localStorage.setItem('theme', theme); // Manual persistence
        this.render();
    }
}
```

**After (Unified pattern):**
```javascript
// ✅ Single settings slice with automatic persistence
const settingsSlice = createSettingsSlice('ui', {
    theme: 'dark',
    autoSave: true,
    notifications: true
}, {
    theme: 'string',
    autoSave: 'boolean', 
    notifications: 'boolean'
});

// Use through dispatch
dispatch(settingsSlice.actions.updateSetting({ key: 'theme', value: 'light' }));
dispatch(settingsSlice.actions.updateSettings({ theme: 'light', autoSave: false }));

// All changes automatically persisted
```

### 4. Complex State Example

**Before (Manual persistence in reducer):**
```javascript
// ❌ Manual localStorage calls in reducer
case ActionTypes.SETTINGS_SET_CSS_BUNDLING_ENABLED:
    if (typeof payload === 'boolean') {
        nextPreviewState = { ...currentPreviewState, bundleCss: payload };
        updated = true;
        // Manual persistence
        try { 
            localStorage.setItem(CSS_BUNDLING_KEY, String(payload)); 
        } catch (e) { 
            console.error('Failed to save:', e); 
        }
    }
    break;
```

**After (Automatic persistence):**
```javascript
// ✅ Automatic persistence through enhanced reducer
const cssSettingsSlice = createStateSlice('cssSettings', {
    initialState: {
        bundleCss: true,
        cssPrefix: '',
        enableRootCss: true
    },
    reducers: {
        setBundling: (state, action) => ({
            ...state,
            bundleCss: action.payload
        }),
        setPrefix: (state, action) => ({
            ...state,
            cssPrefix: action.payload
        }),
        toggleRootCss: (state) => ({
            ...state,
            enableRootCss: !state.enableRootCss
        })
    },
    persistenceConfig: {
        stateKey: 'devpages_css_settings',
        persistOnActions: [
            'CSSSETTINGS_SET_BUNDLING',
            'CSSSETTINGS_SET_PREFIX', 
            'CSSSETTINGS_TOGGLE_ROOT_CSS'
        ]
    }
});

// Usage
dispatch(cssSettingsSlice.actions.setBundling(false));
dispatch(cssSettingsSlice.actions.setPrefix('https://cdn.example.com/'));
```

## Implementation Examples

### Example 1: Migrating CSS Settings

```javascript
// client/store/reducers/cssSettingsReducer.js
import { createStateSlice } from './enhancedReducerUtils.js';

export const cssSettingsSlice = createStateSlice('cssSettings', {
    initialState: {
        bundleCss: true,
        cssPrefix: '',
        enableRootCss: true,
        cssFiles: [],
        activeCssFiles: []
    },
    reducers: {
        setBundling: (state, action) => ({
            ...state,
            bundleCss: action.payload
        }),
        setPrefix: (state, action) => ({
            ...state,
            cssPrefix: action.payload
        }),
        toggleRootCss: (state) => ({
            ...state,
            enableRootCss: !state.enableRootCss
        }),
        addCssFile: (state, action) => ({
            ...state,
            cssFiles: [...state.cssFiles, { path: action.payload, enabled: true }]
        }),
        removeCssFile: (state, action) => ({
            ...state,
            cssFiles: state.cssFiles.filter(f => f.path !== action.payload)
        }),
        toggleCssFile: (state, action) => ({
            ...state,
            cssFiles: state.cssFiles.map(f => 
                f.path === action.payload 
                    ? { ...f, enabled: !f.enabled }
                    : f
            )
        }),
        setActiveCssFiles: (state, action) => ({
            ...state,
            activeCssFiles: action.payload
        })
    },
    persistenceConfig: {
        stateKey: 'devpages_css_settings',
        persistOnActions: [
            'CSSSETTINGS_SET_BUNDLING',
            'CSSSETTINGS_SET_PREFIX',
            'CSSSETTINGS_TOGGLE_ROOT_CSS',
            'CSSSETTINGS_ADD_CSS_FILE',
            'CSSSETTINGS_REMOVE_CSS_FILE',
            'CSSSETTINGS_TOGGLE_CSS_FILE'
        ]
    }
});

export const { reducer: cssSettingsReducer, actions: cssActions } = cssSettingsSlice;
```

### Example 2: Migrating UI State

```javascript
// client/store/reducers/uiReducer.js
import { createStateSlice } from './enhancedReducerUtils.js';

export const uiSlice = createStateSlice('ui', {
    initialState: {
        logVisible: false,
        viewMode: 'split',
        leftSidebarVisible: true,
        textVisible: true,
        previewVisible: true,
        theme: 'default'
    },
    reducers: {
        setLogVisibility: (state, action) => ({
            ...state,
            logVisible: action.payload
        }),
        toggleLogVisibility: (state) => ({
            ...state,
            logVisible: !state.logVisible
        }),
        setViewMode: (state, action) => {
            const viewMode = action.payload;
            if (['preview', 'split', 'editor'].includes(viewMode)) {
                return { ...state, viewMode };
            }
            return state;
        },
        toggleSidebar: (state, action) => ({
            ...state,
            leftSidebarVisible: !state.leftSidebarVisible
        }),
        setVisibility: (state, action) => {
            const { textVisible, previewVisible } = action.payload;
            let viewMode = state.viewMode;
            
            // Derive viewMode from visibility
            if (textVisible && previewVisible) {
                viewMode = 'split';
            } else if (textVisible && !previewVisible) {
                viewMode = 'editor';
            } else if (!textVisible && previewVisible) {
                viewMode = 'preview';
            }
            
            return {
                ...state,
                textVisible,
                previewVisible,
                viewMode
            };
        }
    },
    persistenceConfig: {
        stateKey: 'devpages_ui_state',
        persistOnActions: [
            'UI_SET_LOG_VISIBILITY',
            'UI_TOGGLE_LOG_VISIBILITY',
            'UI_SET_VIEW_MODE',
            'UI_TOGGLE_SIDEBAR',
            'UI_SET_VISIBILITY'
        ]
    }
});

export const { reducer: uiReducer, actions: uiActions } = uiSlice;
```

### Example 3: Plugin State

```javascript
// client/store/reducers/pluginReducer.js
import { createStateSlice } from './enhancedReducerUtils.js';

export const pluginSlice = createStateSlice('plugins', {
    initialState: {},
    reducers: {
        initializePlugin: (state, action) => {
            const { pluginId, config } = action.payload;
            return {
                ...state,
                [pluginId]: {
                    enabled: true,
                    config: config || {},
                    ...action.payload
                }
            };
        },
        togglePlugin: (state, action) => {
            const { pluginId } = action.payload;
            if (state[pluginId]) {
                return {
                    ...state,
                    [pluginId]: {
                        ...state[pluginId],
                        enabled: !state[pluginId].enabled
                    }
                };
            }
            return state;
        },
        updatePluginConfig: (state, action) => {
            const { pluginId, config } = action.payload;
            if (state[pluginId]) {
                return {
                    ...state,
                    [pluginId]: {
                        ...state[pluginId],
                        config: { ...state[pluginId].config, ...config }
                    }
                };
            }
            return state;
        }
    },
    persistenceConfig: {
        stateKey: 'devpages_plugins_state',
        persistOnActions: [
            'PLUGINS_TOGGLE_PLUGIN',
            'PLUGINS_UPDATE_PLUGIN_CONFIG'
        ]
    }
});

export const { reducer: pluginReducer, actions: pluginActions } = pluginSlice;
```

## Usage in Components

### Before (Direct localStorage)
```javascript
// ❌ Component directly accessing localStorage
class CssSettingsPanel {
    constructor() {
        this.bundleCss = localStorage.getItem('bundleCss') === 'true';
    }
    
    toggleBundling() {
        this.bundleCss = !this.bundleCss;
        localStorage.setItem('bundleCss', this.bundleCss);
        this.updateUI();
    }
}
```

### After (Dispatch only)
```javascript
// ✅ Component using dispatch only
import { dispatch } from '/client/messaging/messageQueue.js';
import { cssActions } from '/client/store/reducers/cssSettingsReducer.js';

class CssSettingsPanel {
    constructor() {
        this.state = appStore.getState().cssSettings;
        this.unsubscribe = appStore.subscribe(this.onStateChange.bind(this));
    }
    
    toggleBundling() {
        dispatch(cssActions.setBundling(!this.state.bundleCss));
    }
    
    onStateChange(newState) {
        this.state = newState.cssSettings;
        this.updateUI();
    }
}
```

## Migration Checklist

### Phase 1: Remove Direct localStorage Access
- [ ] Remove all `localStorage.getItem()` calls from components
- [ ] Remove all `localStorage.setItem()` calls from components  
- [ ] Remove manual persistence from reducers

### Phase 2: Implement Unified Slices
- [ ] Create state slices using `createStateSlice`
- [ ] Configure automatic persistence
- [ ] Update action types and creators

### Phase 3: Update Components
- [ ] Replace localStorage access with `appStore.getState()`
- [ ] Replace manual persistence with `dispatch()`
- [ ] Subscribe to state changes for UI updates

### Phase 4: Remove Duplicate Persistence
- [ ] Remove appState subscription persistence logic
- [ ] Remove individual module localStorage access
- [ ] Clean up old localStorage keys

### Phase 5: Testing
- [ ] Verify state persists across browser sessions
- [ ] Test state migration for existing users
- [ ] Validate error handling for localStorage failures

## Benefits

1. **Single Source of Truth**: All state changes go through reducers
2. **Automatic Persistence**: No manual localStorage calls
3. **Error Handling**: Centralized error handling for storage failures
4. **Debugging**: All state changes visible in Redux DevTools
5. **Testing**: Easy to test state changes without localStorage mocking
6. **Migration Support**: Built-in state migration utilities
7. **Performance**: Debounced persistence prevents excessive writes

## Best Practices

1. **Use Specific Action Types**: Make actions descriptive and specific
2. **Validate Payloads**: Always validate action payloads in reducers
3. **Immutable Updates**: Always return new state objects
4. **Debounce Persistence**: Use debouncing for frequently updated state
5. **Error Boundaries**: Handle localStorage failures gracefully
6. **State Normalization**: Keep state flat and normalized when possible
7. **Migration Planning**: Version your state and plan migrations

## Example: Complete Migration

```javascript
// Before: Multiple localStorage patterns
localStorage.setItem('theme', 'dark');
localStorage.setItem('autoSave', 'true');
localStorage.setItem('cssFiles', JSON.stringify(files));

// After: Clean API with automatic dispatch
settings.update({ theme: 'dark', autoSave: true });
settings.setCssFiles(files);

// All persistence handled automatically by reducers
```

## Clean API Examples

### ❌ Old Ugly Syntax
```javascript
dispatch(settingsActions.updateSettings({ theme: 'dark' }));
dispatch(settingsActions.setPreviewCssFiles(files));
dispatch(settingsActions.setCssBundling(false));
```

### ✅ New Clean Syntax
```javascript
settings.update({ theme: 'dark' });
settings.setCssFiles(files);
settings.setBundling(false);
```

### 🔗 Method Chaining
```javascript
settings
  .update({ theme: 'dark' })
  .setBundling(false)
  .setPrefix('https://cdn.example.com/');
```

### 🎯 Simple Operations
```javascript
// Toggle operations
settings.toggleRootCss();
settings.toggleCssFile('/path/to/file.css');

// Direct setters
ui.theme('dark');
ui.autoSave(true);
ui.notifications(false);

// Bulk updates
settings.update({
  preview: { bundleCss: true, cssPrefix: 'https://cdn.example.com/' },
  publish: { mode: 'spaces' }
});
```

## Setup

```javascript
// In your app initialization (bootstrap.js)
import { setGlobalDispatch } from '/client/store/reducers/enhancedReducerUtils.js';
import { dispatch } from '/client/messaging/messageQueue.js';

// Set up automatic dispatch
setGlobalDispatch(dispatch);

// Now all bound actions automatically dispatch!
```

This unified pattern eliminates localStorage access inconsistencies and provides a single, reliable way to manage persistent state across DevPages with a beautiful, clean API. 