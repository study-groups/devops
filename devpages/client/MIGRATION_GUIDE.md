# Thunk Migration Guide

This guide explains how to migrate from the old action handling system to the new thunk-based system.

## Overview

The codebase has been refactored to use Redux-style thunks for async operations. This provides better separation of concerns, improved error handling, and more predictable state management.

## Key Changes

### 1. Thunk Structure

**Before (Manual Dispatch):**
```javascript
// Old way - manual dispatch calls
async function saveFile() {
    try {
        dispatch({ type: 'FS_SAVE_FILE_START', payload: { pathname } });
        const result = await api.saveFile(pathname, content);
        dispatch({ type: 'FS_SAVE_FILE_SUCCESS', payload: { pathname } });
        return result;
    } catch (error) {
        dispatch({ type: 'FS_SAVE_FILE_ERROR', payload: { pathname, error: error.message } });
        throw error;
    }
}
```

**After (Thunk):**
```javascript
// New way - thunk action creator
export const saveFileContent = (pathname, content) => async (dispatch, getState) => {
    try {
        dispatch({ type: 'FS_SAVE_FILE_START', payload: { pathname } });
        const result = await api.saveFile(pathname, content);
        dispatch({ type: 'FS_SAVE_FILE_SUCCESS', payload: { pathname } });
        return result;
    } catch (error) {
        dispatch({ type: 'FS_SAVE_FILE_ERROR', payload: { pathname, error: error.message } });
        throw error;
    }
};
```

### 2. Action Creator Structure

**Before:**
```javascript
export const fileActions = {
    saveFileStart: (pathname) => ({
        type: ActionTypes.FS_SAVE_FILE_START,
        payload: { pathname }
    }),
    saveFileSuccess: (pathname) => ({
        type: ActionTypes.FS_SAVE_FILE_SUCCESS,
        payload: { pathname }
    }),
    saveFileError: (error) => ({
        type: ActionTypes.FS_SAVE_FILE_ERROR,
        payload: error
    })
};
```

**After:**
```javascript
export const fileActions = {
    // Regular action creators (for sync operations)
    saveFileStart: (pathname) => ({
        type: ActionTypes.FS_SAVE_FILE_START,
        payload: { pathname }
    }),
    saveFileSuccess: (pathname) => ({
        type: ActionTypes.FS_SAVE_FILE_SUCCESS,
        payload: { pathname }
    }),
    saveFileError: (error) => ({
        type: ActionTypes.FS_SAVE_FILE_ERROR,
        payload: error
    }),
    
    // Thunk action creators (for async operations)
    saveFileContent: fileThunks.saveFileContent,
    loadFileContent: fileThunks.loadFileContent,
    loadDirectoryListing: fileThunks.loadDirectoryListing
};
```

### 3. Usage Patterns

**Before:**
```javascript
// Manual dispatch with error handling
async function handleSave() {
    try {
        dispatch(fileActions.saveFileStart(pathname));
        const result = await api.saveFile(pathname, content);
        dispatch(fileActions.saveFileSuccess(pathname));
        return result;
    } catch (error) {
        dispatch(fileActions.saveFileError(error.message));
        throw error;
    }
}
```

**After:**
```javascript
// Simple thunk dispatch
async function handleSave() {
    try {
        const result = await dispatch(fileActions.saveFileContent(pathname, content));
        return result;
    } catch (error) {
        // Error handling is done in the thunk
        console.error('Save failed:', error);
    }
}
```

## Migration Steps

### Step 1: Update Imports

Update your imports to use the new thunk action creators:

```javascript
// Old
import { fileActions } from '/client/messaging/actionCreators.js';

// New
import { fileActions } from '/client/messaging/actionCreators.js';
// Thunks are now included in the action creators
```

### Step 2: Replace Manual Dispatch Calls

**Before:**
```javascript
// Manual dispatch pattern
dispatch(fileActions.saveFileStart(pathname));
try {
    const result = await api.saveFile(pathname, content);
    dispatch(fileActions.saveFileSuccess(pathname));
} catch (error) {
    dispatch(fileActions.saveFileError(error.message));
}
```

**After:**
```javascript
// Thunk dispatch pattern
try {
    const result = await dispatch(fileActions.saveFileContent(pathname, content));
    // Success handling
} catch (error) {
    // Error handling
}
```

### Step 3: Update Action Handlers

**Before:**
```javascript
export const fileActionHandlers = {
    saveFile: async () => {
        const currentPathname = selectors.getCurrentFilePath(appStore.getState());
        dispatch(fileActions.saveFileStart(currentPathname));
        
        try {
            const success = await saveFile();
            if (success) {
                dispatch(fileActions.saveFileSuccess(currentPathname));
            } else {
                dispatch(fileActions.saveFileError('Unknown save error'));
            }
        } catch (error) {
            dispatch(fileActions.saveFileError(error.message));
        }
    }
};
```

**After:**
```javascript
export const fileActionHandlers = {
    saveFile: async () => {
        const currentPathname = selectors.getCurrentFilePath(appStore.getState());
        const currentContent = selectors.getCurrentFileContent(appStore.getState());
        
        if (!currentPathname || !currentContent) {
            throw new Error('No file selected or no content to save');
        }
        
        try {
            await dispatch(fileActions.saveFileContent(currentPathname, currentContent));
            return true;
        } catch (error) {
            alert('An error occurred while trying to save.');
            return false;
        }
    }
};
```

## Available Thunks

### Authentication Thunks
- `authActions.login(username, password)` - Login user
- `authActions.logoutAsync()` - Logout user
- `authActions.checkAuthStatus()` - Check authentication status
- `authActions.generateToken(expiryHours, description)` - Generate API token

### File System Thunks
- `fileActions.loadTopLevelDirectories()` - Load top-level directories
- `fileActions.loadDirectoryListing(pathname)` - Load directory listing
- `fileActions.loadFileContent(pathname)` - Load file content
- `fileActions.saveFileContent(pathname, content)` - Save file content
- `fileActions.deleteFile(pathname)` - Delete file
- `fileActions.getDirectoryConfig(directory)` - Get directory configuration

### UI Thunks
- `uiActions.setViewModeAsync(mode)` - Set view mode with persistence
- `uiActions.toggleLogVisibilityAsync()` - Toggle log visibility with persistence
- `uiActions.setLogHeightAsync(height)` - Set log height with persistence
- `uiActions.toggleLogMenuAsync()` - Toggle log menu
- `uiActions.applyInitialUIState()` - Apply initial UI state from localStorage
- `uiActions.refreshPreview()` - Refresh preview

### Settings Thunks
- `settingsActions.togglePreviewCssEnabledAsync(cssId)` - Toggle preview CSS enabled
- `settingsActions.addPreviewCssAsync(cssPath)` - Add preview CSS file
- `settingsActions.removePreviewCssAsync(cssId)` - Remove preview CSS file
- `settingsActions.setActivePreviewCssAsync(cssId)` - Set active preview CSS
- `settingsActions.toggleRootCssEnabledAsync()` - Toggle root CSS enabled
- `settingsActions.setRootCssEnabledAsync(isEnabled)` - Set root CSS enabled
- `settingsActions.setPreviewCssFilesAsync(files)` - Set preview CSS files
- `settingsActions.setActiveDesignThemeAsync(themeName)` - Set active design theme
- `settingsActions.setDesignThemeVariantAsync(variant)` - Set design theme variant
- `settingsActions.setDesignTokensDirectoryAsync(directory)` - Set design tokens directory

### Plugin Thunks
- `pluginActions.initializePlugins()` - Initialize plugins
- `pluginActions.updatePluginSettings(pluginId, settings)` - Update plugin settings
- `pluginActions.togglePluginEnabled(pluginId)` - Toggle plugin enabled state
- `pluginActions.loadPluginModule(pluginId, modulePath)` - Load plugin module
- `pluginActions.registerPlugin(pluginId, pluginConfig)` - Register plugin
- `pluginActions.unregisterPlugin(pluginId)` - Unregister plugin
- `pluginActions.savePluginState()` - Save plugin state

## Benefits of the New System

1. **Better Error Handling**: Errors are handled consistently within thunks
2. **Automatic Persistence**: UI state is automatically persisted to localStorage
3. **Cleaner Code**: Less boilerplate for async operations
4. **Better Testing**: Thunks can be easily unit tested
5. **Predictable State**: All async operations follow the same pattern
6. **Type Safety**: Better TypeScript support with thunk patterns

## Testing Thunks

Thunks can be tested by mocking the dispatch and getState functions:

```javascript
// Test example
const mockDispatch = jest.fn();
const mockGetState = jest.fn(() => ({ auth: { isAuthenticated: true } }));

const thunk = fileActions.loadFileContent('/test.md');
await thunk(mockDispatch, mockGetState);

expect(mockDispatch).toHaveBeenCalledWith({
    type: 'FS_LOAD_FILE_START',
    payload: { pathname: '/test.md' }
});
```

## Troubleshooting

### Common Issues

1. **Thunk not dispatching actions**: Make sure you're using `dispatch(thunk)` not `thunk()`
2. **State not updating**: Check that the thunk is returning the correct value
3. **Persistence not working**: Verify localStorage keys match the expected format
4. **Error handling**: Ensure errors are properly caught and re-thrown in thunks

### Debug Tips

1. Use the logger middleware to see all dispatched actions
2. Check the browser console for thunk execution logs
3. Verify localStorage values are being set correctly
4. Use the Redux DevTools (if available) to inspect state changes

## Backward Compatibility

The old action creators are still available for synchronous operations. Only async operations have been moved to thunks. This ensures a gradual migration path.

## Next Steps

1. Update all async operations to use thunks
2. Remove manual dispatch patterns
3. Add comprehensive error handling
4. Implement proper loading states
5. Add unit tests for thunks 