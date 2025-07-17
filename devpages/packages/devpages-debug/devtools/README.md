# DevTools Panel System

## Overview

The DevTools Panel System provides comprehensive debugging tools for DevPages, integrating StateKit DevTools with panel-specific debugging features. This system helps developers understand and debug the panel system, state management, and overall application performance.

## Features

### 1. StateKit DevTools Integration
- **Action History**: Track all dispatched actions with timestamps and performance data
- **Time Travel**: Jump to any point in action history to debug state changes
- **Performance Monitoring**: Track action execution times and identify bottlenecks
- **State Inspection**: Real-time state inspection with search capabilities

### 2. Panel System Debugging
- **Panel Registry**: View all registered panels with their configurations
- **Panel Lifecycle**: Track panel creation, rendering, and destruction events
- **Panel Metadata**: Monitor panel performance, error rates, and usage statistics
- **Long Press Support**: Long press on panels to show detailed information

### 3. Performance Monitoring
- **Memory Usage**: Track JavaScript heap usage and limits
- **Performance Metrics**: Monitor action performance and identify slow operations
- **Panel Performance**: Track individual panel render times and error rates

### 4. Development Utilities
- **Panel Testing**: Automated testing of all registered panels
- **Stress Testing**: Simulate high-load scenarios
- **Storage Management**: Clear localStorage and export configurations
- **Debug Functions**: Global functions for quick debugging

## Panel Metadata System

### Metadata Structure

Each panel can include metadata to help with debugging and development:

```javascript
panelRegistry.register('my-panel', {
    title: 'My Panel',
    group: 'debug',
    component: MyPanelComponent,
    metadata: {
        category: 'debugging',
        features: ['state-inspection', 'real-time-updates'],
        dependencies: ['appStore', 'panelRegistry'],
        longPress: {
            enabled: true,
            action: 'showDetails',
            description: 'Long press to show panel details'
        },
        performance: {
            trackRenders: true,
            trackErrors: true,
            maxRenderTime: 100 // ms
        }
    }
});
```

### Metadata Fields

- **category**: Panel category (debugging, ui, data, etc.)
- **features**: Array of features the panel provides
- **dependencies**: Array of required dependencies
- **longPress**: Configuration for long press behavior
- **performance**: Performance tracking configuration

### Long Press Support

Panels can support long press interactions for additional debugging information:

```javascript
longPress: {
    enabled: true,
    action: 'showDetails', // or 'showMenu', 'exportData', etc.
    description: 'Long press to show panel details'
}
```

## Usage

### Accessing DevTools Panel

1. **Keyboard Shortcut**: Press `Ctrl+Shift+D` to toggle the debug panel
2. **Console Command**: `window.debugPanelManager.toggleVisibility()`

### Tab Navigation

The DevTools panel has four main tabs:

1. **StateKit**: Action history, time travel, and state inspection
2. **Panels**: Panel registry, lifecycle events, and metadata
3. **Performance**: Performance metrics and memory usage
4. **Utilities**: Development utilities and debug functions

### Global Debug Functions

```javascript
// Test DevTools functionality
window.testDevTools()

// Debug panel system
window.debugPanels()

// Generate performance report
window.performanceReport()

// Export DevTools data
window.exportDevToolsData()
```

## Panel Lifecycle Tracking

The system automatically tracks panel lifecycle events:

- **registered**: Panel registered with registry
- **created**: Panel instance created
- **rendered**: Panel rendered to DOM
- **destroyed**: Panel instance destroyed
- **error**: Panel encountered an error
- **test_passed**: Panel passed automated test
- **test_failed**: Panel failed automated test

## Performance Monitoring

### Action Performance

- Track execution time for each action
- Identify slowest and fastest actions
- Calculate average execution time
- Monitor action frequency

### Panel Performance

- Track render times for each panel
- Monitor error rates
- Track panel usage patterns
- Identify performance bottlenecks

### Memory Usage

- Monitor JavaScript heap usage
- Track memory growth patterns
- Identify memory leaks
- Monitor garbage collection

## Development Workflow

### 1. Panel Development

```javascript
// Register panel with metadata
panelRegistry.register('my-debug-panel', {
    title: 'My Debug Panel',
    group: 'debug',
    component: MyDebugPanel,
    metadata: {
        category: 'debugging',
        features: ['custom-debugging'],
        dependencies: ['appStore'],
        longPress: {
            enabled: true,
            action: 'showDetails'
        }
    }
});
```

### 2. Debugging Panels

```javascript
// Test all panels
window.debugPanelManager.testAllPanels()

// View panel details
const panel = panelRegistry.getPanel('my-panel')
console.log('Panel metadata:', panel.metadata)

// Long press on panel in DevTools to see details
```

### 3. Performance Analysis

```javascript
// Generate performance report
window.performanceReport()

// View action history
const devTools = window.__STATEKIT_DEVTOOLS__
console.log('Action history:', devTools.getActionHistory())

// View performance metrics
console.log('Performance metrics:', devTools.getPerformanceMetrics())
```

## Integration with Existing Systems

### StateKit DevTools

The DevTools panel integrates with StateKit DevTools middleware:

```javascript
// In appState.js
const store = createStore(
    mainReducer, 
    initialAppState,
    [
        createLogger({ collapsed: true, duration: true }),
        createThunk(),
        createDevTools({ 
            maxAge: 50,
            name: 'DevPages StateKit DevTools'
        })
    ]
);
```

### DebugPanelManager

The DevTools panel is automatically loaded by DebugPanelManager:

```javascript
// Debug panels are registered and loaded automatically
import '/client/panels/registerDebugPanels.js'
```

### Panel Registry

All debug panels are registered with the panel registry:

```javascript
// Debug panels are grouped under 'debug'
const debugPanels = panelRegistry.getAllPanels().filter(p => p.group === 'debug')
```

## Testing

### Automated Testing

```javascript
// Test DevTools panel integration
import('/client/devtools/test-devtools-panel.js').then(m => m.testDevToolsPanel())

// Test all panels
window.debugPanelManager.testAllPanels()
```

### Manual Testing

1. Open DevTools panel (`Ctrl+Shift+D`)
2. Navigate through tabs
3. Test time travel functionality
4. Test panel long press
5. Test performance monitoring
6. Test utility functions

## Troubleshooting

### DevTools Not Available

- Ensure `createDevTools()` is in middleware array
- Check that StateKit DevTools are loaded
- Verify store is created with DevTools middleware

### Panel Not Showing

- Check panel registry for panel registration
- Verify panel component is available
- Check debug panel state in app store

### Performance Issues

- Reduce `maxAge` in DevTools options
- Use `shouldIncludeAction` to filter actions
- Monitor memory usage in Performance tab

## Future Enhancements

### Planned Features

1. **Panel Dependency Graph**: Visual representation of panel dependencies
2. **Custom Debug Panels**: Allow developers to create custom debug panels
3. **Performance Alerts**: Automatic alerts for performance issues
4. **Export/Import**: Save and restore debug configurations
5. **Remote Debugging**: Debug panels in production environments

### Extension Points

The DevTools system is designed to be extensible:

- Add new debug panels by registering with `group: 'debug'`
- Extend panel metadata with custom fields
- Add custom long press actions
- Create custom performance metrics
- Integrate with external debugging tools 