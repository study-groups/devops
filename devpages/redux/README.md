# Redux Toolkit Bootloader System

This directory contains a complete Redux Toolkit-based replacement for the StateKit bootloader system. It provides idiomatic Redux state management while maintaining compatibility with the existing component architecture.

## Architecture Overview

### Single File Architecture

- **`bootloader.js`** - Complete Redux Toolkit bootloader system in one file

This file contains:
- **Redux Store Configuration** - Configured with Redux Toolkit and DevTools
- **Auth Slice** - Authentication state, login/logout thunks, user management
- **Path Slice** - File system navigation, PData integration, directory listings
- **Settings Slice** - App preferences with localStorage persistence
- **Bootloader Implementation** - Component initialization and lifecycle management
- **All Exports** - Store, selectors, thunks, and utilities

## Key Features

### 🔐 Authentication Integration
```javascript
// Login with proper session handling
await appDispatch(authThunks.login({ username, password }));

// Check auth status on startup
await appDispatch(authThunks.checkAuth());
```

### 📁 File System Operations
```javascript
// Load top-level directories
await appDispatch(pathThunks.loadTopLevelDirectories());

// Navigate to path (file or directory)
await appDispatch(pathThunks.fetchListingByPath({ pathname, isDirectory }));

// Save file content
await appDispatch(pathThunks.saveFileContent({ pathname, content }));
```

### ⚙️ Settings Management
```javascript
// Load initial settings
await appDispatch(settingsThunks.loadInitialSettings());

// Update specific settings
store.dispatch(setTheme('dark'));
store.dispatch(setViewMode('split'));
```

## Boot Sequence

The Redux bootloader follows the same stages as the original:

1. **DOM Ready** - Wait for document ready state
2. **DOM Verification** - Check required elements exist
3. **Core Services** - Initialize Redux store, event bus, logging
4. **Authentication** - Check auth status, load user data
5. **Component Registration** - Register UI components with component manager
6. **Component Initialization** - Mount and initialize components
7. **Event Listeners** - Set up global navigation and keyboard handlers
8. **Finalization** - Hide splash screen, emit ready events

## Usage

### Starting the App
The bootloader starts automatically when `client/index.js` is loaded:

```javascript
// client/index.js
import '../redux/bootloader.js';
```

### Accessing Redux Store
```javascript
// From anywhere in the app (adjust path as needed)
import { store, appDispatch } from '../redux/bootloader.js';

// Get current state
const state = store.getState();
const isAuth = selectIsAuthenticated(state);

// Dispatch actions
await appDispatch(authThunks.checkAuth());
```

### Component Integration
Components can access Redux state via selectors:

```javascript
import { 
    store, 
    selectIsAuthenticated, 
    selectUser 
} from '../redux/bootloader.js';

// In component
const state = store.getState();
const isAuthenticated = selectIsAuthenticated(state);
const user = selectUser(state);
```

## appDispatch Compatibility

The system provides an `appDispatch` function that's compatible with the existing codebase:

```javascript
// Supports both plain actions and thunks
appDispatch({ type: 'some/action', payload: data });
appDispatch(authThunks.login({ username, password }));
```

## Migration Benefits

### From StateKit to Redux Toolkit
- ✅ Industry-standard Redux patterns
- ✅ Better TypeScript support (when needed)
- ✅ Excellent DevTools integration
- ✅ Immutable updates with Immer
- ✅ Built-in async thunk support
- ✅ Simplified slice patterns

### Backward Compatibility
- ✅ Same component architecture
- ✅ Event bus integration maintained
- ✅ Global window.APP exposure
- ✅ Same DOM requirements
- ✅ Component manager integration

## Critical Authentication Rules

⚠️ **ALWAYS include `credentials: 'include'`** in fetch requests for authenticated endpoints. This is implemented in all API helper functions within the slices.

## Future Extensions

This foundation supports easy addition of:
- Additional slices for new features
- RTK Query for advanced data fetching
- Redux DevTools time-travel debugging
- State persistence middleware
- Real-time data synchronization

## Development

To extend the system:

1. **Add new slices** directly in `bootloader.js`
2. **Add to store configuration** in the `configureStore` section
3. **Export new thunks and selectors** at the bottom of the file
4. **Use createAsyncThunk** for async operations
5. **Add selectors** following the existing pattern

The single-file approach keeps everything centralized while maintaining Redux Toolkit patterns. The system is designed to grow while keeping the existing component patterns and user experience. 