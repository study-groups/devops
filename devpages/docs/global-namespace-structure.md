# Global Namespace Structure

This document defines the unified global namespace structure for DevPages, consolidating all global variables under `window.APP`.

## Structure Overview

```javascript
window.APP = {
    // Core system
    initializer: AppInitializer,
    version: '1.0.0',
    initialized: boolean,
    
    // Service registry
    services: {
        // Core services
        log: LoggingService,
        store: ReduxStore,
        eventBus: EventBus,
        globalFetch: GlobalFetch,
        workspaceManager: WorkspaceManager,
        
        // Authentication
        auth: AuthService,
        
        // Game client services
        gameClient: GameClient,
        PJA: PJAService,
        initializeGameClient: Function,
        
        // Markdown processing
        markdownit: MarkdownIt,
        
        // Logging services
        logManager: LogManager,
        isConsoleLoggingEnabled: Function,
        enableConsoleLogging: Function,
        disableConsoleLogging: Function,
        getLogBuffer: Function,
        clearLogBuffer: Function,
        
        // Settings
        settingsRegistry: SettingsRegistry,
        
        // Mermaid services
        _mermaidActivePanSvg: Object,
        _mermaidPanData: Object,
        
        // Image handling
        handleImageDelete: Function,
        
        // Z-Index management
        zIndexManager: ZIndexManager
    },
    
    // Component registry
    components: {
        iconsPanel: IconsPanel,
        // Other UI components...
    },
    
    // Debug interface
    debug: {
        // Debug utilities...
    },
    
    // Legacy namespace compatibility
    devPages: Object, // Migrated from window.devPages
    devpages: Object, // Migrated from window.devpages
    
    // System references
    bootloader: BootloaderInstance,
    testing: TestingUtilities,
    debugDock: DebugDock,
    pdataPanel: PDataPanel
}
```

## Migration Guide

### Before (Conflicting Globals)
```javascript
// Multiple conflicting patterns
window.devPages = {...};
window.devpages = {...};
window.gameClient = {...};
window.logManager = {...};
window.settingsRegistry = {...};
```

### After (Unified Namespace)
```javascript
// All under APP namespace
window.APP.devPages = {...};
window.APP.devpages = {...};
window.APP.services.gameClient = {...};
window.APP.services.logManager = {...};
window.APP.services.settingsRegistry = {...};
```

## Service Registration

Use the `AppInitializer` to register services:

```javascript
import { appInitializer } from '/client/core/AppInitializer.js';

// Register a service
appInitializer.registerService('myService', serviceInstance, {
    namespace: 'custom', // Optional namespace
    override: false      // Allow overriding existing service
});

// Register a component
appInitializer.registerComponent('myComponent', componentInstance, {
    global: false // If true, goes directly on APP, otherwise in APP.components
});

// Register debug utility
appInitializer.registerDebugUtility('myDebugTool', debugTool);
```

## Access Patterns

### Accessing Services
```javascript
// Core services
const store = window.APP.services.store;
const log = window.APP.services.log;
const eventBus = window.APP.services.eventBus;

// Custom services
const myService = window.APP.services.myService;
const namespacedService = window.APP.services.custom.myService;
```

### Accessing Components
```javascript
// Components
const iconsPanel = window.APP.components.iconsPanel;

// Global components (registered with global: true)
const globalComponent = window.APP.globalComponent;
```

### Accessing Debug Tools
```javascript
// Debug utilities
const debugTool = window.APP.debug.myDebugTool;
```

## Best Practices

1. **Always check for initialization**:
   ```javascript
   if (window.APP?.initialized) {
       // Safe to use APP services
   }
   ```

2. **Use the registration system**:
   ```javascript
   // Don't do this
   window.APP.services.myService = service;
   
   // Do this instead
   appInitializer.registerService('myService', service);
   ```

3. **Handle initialization timing**:
   ```javascript
   appInitializer.onInitialized(() => {
       // Code that depends on APP being ready
   });
   ```

4. **Namespace appropriately**:
   - Core system services → `APP.services`
   - UI components → `APP.components`
   - Debug tools → `APP.debug`
   - Legacy compatibility → `APP.devPages`, `APP.devpages`

## Conflict Resolution

The audit found 31 conflicting global exports. Here's how they're resolved:

| Old Global | New Location | Type |
|------------|--------------|------|
| `window.devPages` | `window.APP.devPages` | Legacy compatibility |
| `window.devpages` | `window.APP.devpages` | Legacy compatibility |
| `window.gameClient` | `window.APP.services.gameClient` | Service |
| `window.PJA` | `window.APP.services.PJA` | Service |
| `window.logManager` | `window.APP.services.logManager` | Service |
| `window.markdownit` | `window.APP.services.markdownit` | Service |
| `window.settingsRegistry` | `window.APP.services.settingsRegistry` | Service |
| `window.iconsPanel` | `window.APP.components.iconsPanel` | Component |

## Testing

After migration, verify:

1. All services are accessible via new paths
2. No console errors about undefined globals
3. All functionality works as expected
4. Legacy code still works with compatibility layer

## Cleanup

After successful migration:

1. Update all code to use new namespace
2. Remove backup files
3. Update documentation
4. Consider removing legacy compatibility layer in future version
