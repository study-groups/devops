# Bootloader Migration Guide

## Overview

The application has been migrated from the old `bootstrap.js` system to a new, cleaner `bootloader.js` that follows the lifecycle messaging pattern you requested. This provides better coordination of startup sequencing, dependency injection, and asynchronous initialization.

## What Changed

### Old System (bootstrap.js)
- Complex multi-stage initialization with manual dependency management
- Mixed approaches to component mounting
- Inconsistent error handling
- Difficult to debug initialization issues

### New System (bootloader.js)
- **Clean lifecycle messaging**: `boot:start` → `boot:domReady` → `boot:authReady` → `boot:complete`
- **Proper integration**: Works seamlessly with your existing `appStore`, `eventBus`, and `appDispatch`
- **Deterministic ordering**: Auth check → Component initialization → Event setup → Finalization
- **Better error handling**: Clear error messages with detailed debugging information
- **Improved logging**: Emoji-enhanced logs with clear stage progression

## Lifecycle Stages

The new bootloader follows these sequential stages:

1. **`boot:start`** - Bootloader initialization begins
2. **`boot:domReady`** - DOM is ready for manipulation
3. **`boot:domVerified`** - Required DOM elements verified
4. **`boot:coreServicesReady`** - appStore, eventBus, appDispatch initialized
5. **`boot:authReady`** - Authentication status checked
6. **`boot:componentsReady`** - All components mounted
7. **`boot:eventListenersReady`** - Global event listeners set up
8. **`boot:complete`** - Application fully initialized

## Integration with Your Architecture

### AppStore Integration
```javascript
// The bootloader properly integrates with your StateKit store
this.services.appStore = appStore;
await appStore.dispatch(authThunks.checkAuth());
```

### EventBus Integration
```javascript
// Uses your existing pub/sub system
eventBus.on('auth:loginRequested', async ({ username, password }) => {
    await appStore.dispatch(authThunks.login({ username, password }));
});
```

### Component Integration
```javascript
// Properly mounts your existing components
const { createPathManagerComponent } = await import('./components/PathManagerComponent.js');
this.components.pathManager = createPathManagerComponent('context-manager-container');
this.components.pathManager.mount();
```

## Error Handling

The new bootloader provides comprehensive error handling:

- **Visual Error Display**: Shows a detailed error dialog if boot fails
- **Stage Tracking**: Shows exactly which stage failed
- **Stack Traces**: Provides technical details for debugging
- **Graceful Degradation**: Attempts to continue when possible

## Key Features

### 1. DOM Verification
Ensures all required DOM elements exist before component mounting:
```javascript
const requiredDOMElements = [
    'context-manager-container',
    'auth-component-container', 
    'view-controls-container',
    'sidebar-container',
    'editor-container'
];
```

### 2. Service Exposure
Maintains backward compatibility by exposing services globally:
```javascript
window.APP = window.APP || {};
window.APP.services = this.services;
window.APP.eventBus = eventBus;
window.APP.store = appStore;
```

### 3. Authentication Flow
Properly sequences auth check before component initialization:
```javascript
const authResult = await appStore.dispatch(authThunks.checkAuth());
const authState = appStore.getState().auth;
this.state.isAuthenticated = authState.isAuthenticated;
```

### 4. Component Lifecycle
Loads and mounts components in the correct order:
```javascript
// Auth display first (always shows)
this.components.authDisplay = createAuthDisplayComponent('auth-component-container');

// Path manager (main functionality)  
this.components.pathManager = createPathManagerComponent('context-manager-container');

// Additional components based on auth state
if (this.state.isAuthenticated) {
    await this.initAuthenticatedComponents();
}
```

## Event Messages

The bootloader emits these events for components to listen to:

- `core:servicesReady` - Core services initialized
- `auth:statusChecked` - Auth status determined
- `components:ready` - All components mounted
- `app:ready` - Application fully ready
- `boot:complete` - Boot sequence finished
- `boot:failed` - Boot sequence failed

## Debugging

Enhanced logging provides clear visibility into the boot process:

```
🚀 Starting application boot sequence
📄 DOM ready event fired
🔍 Verifying required DOM elements...
✅ All required DOM elements verified
🔧 Initializing core services...
✅ Core services initialized
🔐 Checking authentication status...
ℹ️ User not authenticated - limited functionality available
🧩 Initializing components...
✅ Components initialized
📡 Setting up global event listeners...
✅ Event listeners initialized
🎯 Finalizing application startup...
🎉 Application ready for use
```

## Migration Benefits

1. **Cleaner Architecture**: Sequential, predictable initialization
2. **Better Debugging**: Clear stage progression and error reporting
3. **Proper Integration**: Works with your existing appStore/eventBus architecture
4. **Deterministic Dependencies**: Auth → Components → Events → Ready
5. **Error Recovery**: Graceful failure handling with user feedback
6. **Future Extensibility**: Easy to add new initialization stages

## Files Changed

- **New**: `client/bootloader.js` - Main bootloader implementation
- **Updated**: `client/index.js` - Now imports bootloader instead of bootstrap
- **Updated**: `client/styles/splash-screen.css` - Added error handling styles
- **Deprecated**: `client/bootstrap.js` - Marked as deprecated but kept for reference

## Testing

The new bootloader can be tested by:

1. **Normal Boot**: Verify all stages complete successfully
2. **Missing DOM Elements**: Remove required elements to test error handling
3. **Auth Failures**: Test with invalid credentials to verify auth flow
4. **Component Failures**: Test component mounting error scenarios

## Next Steps

The old `bootstrap.js` has been marked as deprecated but kept for reference. You can safely remove it once you've verified the new bootloader works correctly for your use case.

The new system is extensible - you can easily add new lifecycle stages or components by modifying the `bootloader.js` file. 