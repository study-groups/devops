# StateKit DevTools Usage Guide

## Overview

StateKit now includes Redux DevTools-like functionality for debugging and development. This includes action history tracking, time travel debugging, performance monitoring, and state inspection.

## Basic Setup

### 1. Add DevTools Middleware

```javascript
import { createStore, createLogger, createThunk, createDevTools } from 'devpages';

const store = createStore(
    reducer,
    initialState,
    [
        createLogger({ collapsed: true, duration: true }),
        createThunk(),
        createDevTools({ 
            maxAge: 50, // Keep last 50 actions
            name: 'My App DevTools'
        })
    ]
);
```

### 2. Access DevTools in Browser Console

Once the middleware is loaded, DevTools are automatically available on `window.__STATEKIT_DEVTOOLS__`:

```javascript
// Get the DevTools instance
const devTools = window.__STATEKIT_DEVTOOLS__;

// View action history
console.log(devTools.getActionHistory());

// View performance metrics
console.log(devTools.getPerformanceMetrics());

// Time travel to a specific action
devTools.timeTravel(5); // Go to action #5

// Replay an action
devTools.replayAction(3); // Replay action #3

// Clear history
devTools.clearHistory();
```

## Console Panel

A console panel is also available for easier debugging:

```javascript
const panel = window.__STATEKIT_PANEL__;

// Show action history in console
panel.showHistory();

// Show performance metrics
panel.showPerformance();

// Time travel
panel.timeTravel(5);

// Replay action
panel.replayAction(3);

// Clear history
panel.clearHistory();
```

## DevPages Integration

For DevPages specifically, use the integration module:

```javascript
import { initDevTools } from '/client/devtools/StateKitDevTools.js';

// Initialize DevTools (auto-initializes)
initDevTools();

// Access via window.devTools
window.devTools.getHistory();
window.devTools.getMetrics();
window.devTools.timeTravel(5);
window.devTools.getStateSlice('auth');
```

## Keyboard Shortcuts

- **Ctrl+Shift+T**: Show DevTools help in console

## Features

### 1. Action History
- Tracks all dispatched actions
- Stores previous and next state for each action
- Includes timing information
- Configurable history size

### 2. Time Travel
- Jump to any point in action history
- Temporarily view state as it was at that moment
- Useful for debugging state changes

### 3. Action Replay
- Replay any action from history
- Useful for testing and debugging

### 4. Performance Monitoring
- Tracks action execution time
- Identifies slowest and fastest actions
- Provides average execution time

### 5. State Inspection
- Easy access to current state
- Inspect specific state slices
- Compare state before/after actions

## Advanced Usage

### Custom DevTools Options

```javascript
createDevTools({
    name: 'Custom DevTools',
    maxAge: 100, // Keep 100 actions
    shouldIncludeAction: (action) => {
        // Only track certain actions
        return action.type.startsWith('USER_');
    },
    shouldIncludeState: (state) => {
        // Only track certain state slices
        return state.auth || state.ui;
    }
});
```

### Event System

```javascript
const devTools = window.__STATEKIT_DEVTOOLS__;

// Subscribe to DevTools events
devTools.subscribe((event, data) => {
    switch (event) {
        case 'actionDispatched':
            console.log('New action:', data.action.type);
            break;
        case 'timeTravel':
            console.log('Time traveled to:', data.index);
            break;
        case 'historyCleared':
            console.log('History cleared');
            break;
    }
});
```

### UI Integration

```javascript
import { createDevToolsUI } from 'devpages';

// Create a DevTools UI panel
const container = document.getElementById('devtools-container');
const ui = createDevToolsUI(devTools, container);

// Toggle visibility
ui.toggle();
```

## Troubleshooting

### DevTools Not Available
- Ensure `createDevTools()` is in your middleware array
- Check that the middleware is loaded before accessing DevTools
- Verify the store is created with DevTools middleware

### Performance Issues
- Reduce `maxAge` if memory usage is high
- Use `shouldIncludeAction` to filter actions
- Use `shouldIncludeState` to limit state tracking

### Time Travel Not Working
- Ensure you're not in the middle of dispatching an action
- Check that the action index is valid
- Verify the state structure hasn't changed significantly

## Examples

### Debugging a Specific Action

```javascript
// Find all actions of a specific type
const history = window.devTools.getHistory();
const authActions = history.filter(entry => 
    entry.action.type.startsWith('auth/')
);

// Time travel to the last auth action
if (authActions.length > 0) {
    const lastAuthIndex = history.indexOf(authActions[authActions.length - 1]);
    window.devTools.timeTravel(lastAuthIndex);
}
```

### Performance Analysis

```javascript
const metrics = window.devTools.getMetrics();
console.log(`Average action time: ${metrics.averageTime.toFixed(2)}ms`);
console.log(`Slowest action: ${metrics.slowestAction.action} (${metrics.slowestAction.duration}ms)`);
```

### State Comparison

```javascript
const history = window.devTools.getHistory();
const lastAction = history[history.length - 1];

console.log('State before:', lastAction.prevState);
console.log('State after:', lastAction.state);
console.log('Action that caused change:', lastAction.action);
``` 