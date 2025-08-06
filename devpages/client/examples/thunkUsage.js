/**
 * client/examples/thunkUsage.js
 * Examples of how to use the new thunk system
 */

// REMOVED: messageQueue import (file deleted)
import { authActions, fileActions, uiActions, settingsActions, pluginActions } from '/client/messaging/actionCreators.js';

// ===== AUTHENTICATION EXAMPLES =====

// Login with username and password
async function loginExample() {
    try {
        console.log('Logging in user...');
        const success = await dispatch(authActions.login('username', 'password'));
        
        if (success) {
            console.log('Login successful!');
        } else {
            console.log('Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
    }
}

// Check authentication status
function checkAuthExample() {
    console.log('Checking auth status...');
    dispatch(authActions.checkAuthStatus());
}

// Logout
async function logoutExample() {
    try {
        console.log('Logging out...');
        await dispatch(authActions.logoutAsync());
        console.log('Logout successful!');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Generate API token
async function generateTokenExample() {
    try {
        console.log('Generating API token...');
        const tokenData = await dispatch(authActions.generateToken(24, 'My API Token'));
        console.log('Token generated:', tokenData.token.substring(0, 8) + '...');
    } catch (error) {
        console.error('Token generation error:', error);
    }
}

// ===== FILE SYSTEM EXAMPLES =====

// Load top-level directories
async function loadDirectoriesExample() {
    try {
        console.log('Loading top-level directories...');
        const directories = await dispatch(fileActions.loadTopLevelDirectories());
        console.log('Directories loaded:', directories);
    } catch (error) {
        console.error('Error loading directories:', error);
    }
}

// Load directory listing
async function loadDirectoryListingExample() {
    try {
        console.log('Loading directory listing...');
        const listing = await dispatch(fileActions.loadDirectoryListing('/my-directory'));
        console.log('Directory listing loaded:', listing);
    } catch (error) {
        console.error('Error loading directory listing:', error);
    }
}

// Load file content
async function loadFileExample() {
    try {
        console.log('Loading file content...');
        const content = await dispatch(fileActions.loadFileContent('/my-file.md'));
        console.log('File content loaded:', content.substring(0, 100) + '...');
    } catch (error) {
        console.error('Error loading file:', error);
    }
}

// Save file content
async function saveFileExample() {
    try {
        console.log('Saving file content...');
        const result = await dispatch(fileActions.saveFileContent('/my-file.md', '# Hello World\n\nThis is my content.'));
        console.log('File saved successfully:', result);
    } catch (error) {
        console.error('Error saving file:', error);
    }
}

// Delete file
async function deleteFileExample() {
    try {
        console.log('Deleting file...');
        await dispatch(fileActions.deleteFile('/my-file.md'));
        console.log('File deleted successfully');
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

// ===== UI EXAMPLES =====

// Set view mode with persistence
async function setViewModeExample() {
    try {
        console.log('Setting view mode...');
        const mode = await dispatch(uiActions.setViewModeAsync('split'));
        console.log('View mode set to:', mode);
    } catch (error) {
        console.error('Error setting view mode:', error);
    }
}

// Toggle log visibility with persistence
async function toggleLogVisibilityExample() {
    try {
        console.log('Toggling log visibility...');
        const newVisibility = await dispatch(uiActions.toggleLogVisibilityAsync());
        console.log('Log visibility toggled to:', newVisibility);
    } catch (error) {
        console.error('Error toggling log visibility:', error);
    }
}

// Set log height with persistence
async function setLogHeightExample() {
    try {
        console.log('Setting log height...');
        const height = await dispatch(uiActions.setLogHeightAsync(300));
        console.log('Log height set to:', height);
    } catch (error) {
        console.error('Error setting log height:', error);
    }
}

// Apply initial UI state from localStorage
function applyInitialUIStateExample() {
    console.log('Applying initial UI state...');
    dispatch(uiActions.applyInitialUIState());
    console.log('Initial UI state applied');
}

// ===== SETTINGS EXAMPLES =====

// Toggle preview CSS enabled
async function togglePreviewCssExample() {
    try {
        console.log('Toggling preview CSS...');
        await dispatch(settingsActions.togglePreviewCssEnabledAsync('my-css-file.css'));
        console.log('Preview CSS toggled');
    } catch (error) {
        console.error('Error toggling preview CSS:', error);
    }
}

// Add preview CSS file
async function addPreviewCssExample() {
    try {
        console.log('Adding preview CSS...');
        await dispatch(settingsActions.addPreviewCssAsync('/styles/custom.css'));
        console.log('Preview CSS added');
    } catch (error) {
        console.error('Error adding preview CSS:', error);
    }
}

// Toggle root CSS enabled
async function toggleRootCssExample() {
    try {
        console.log('Toggling root CSS...');
        const newState = await dispatch(settingsActions.toggleRootCssEnabledAsync());
        console.log('Root CSS toggled to:', newState);
    } catch (error) {
        console.error('Error toggling root CSS:', error);
    }
}

// Set active design theme
async function setDesignThemeExample() {
    try {
        console.log('Setting design theme...');
        const theme = await dispatch(settingsActions.setActiveDesignThemeAsync('modern'));
        console.log('Design theme set to:', theme);
    } catch (error) {
        console.error('Error setting design theme:', error);
    }
}

// ===== PLUGIN EXAMPLES =====

// Initialize plugins
async function initializePluginsExample() {
    try {
        console.log('Initializing plugins...');
        await dispatch(pluginActions.initializePlugins());
        console.log('Plugins initialized');
    } catch (error) {
        console.error('Error initializing plugins:', error);
    }
}

// Toggle plugin enabled state
async function togglePluginExample() {
    try {
        console.log('Toggling plugin...');
        const newState = await dispatch(pluginActions.togglePluginEnabled('mermaid'));
        console.log('Plugin toggled to:', newState);
    } catch (error) {
        console.error('Error toggling plugin:', error);
    }
}

// Update plugin settings
async function updatePluginSettingsExample() {
    try {
        console.log('Updating plugin settings...');
        const settings = await dispatch(pluginActions.updatePluginSettings('mermaid', {
            enabled: true,
            theme: 'dark'
        }));
        console.log('Plugin settings updated:', settings);
    } catch (error) {
        console.error('Error updating plugin settings:', error);
    }
}

// Load plugin module
async function loadPluginModuleExample() {
    try {
        console.log('Loading plugin module...');
        const module = await dispatch(pluginActions.loadPluginModule('mermaid', '/client/preview/plugins/mermaid/index.js'));
        console.log('Plugin module loaded:', module);
    } catch (error) {
        console.error('Error loading plugin module:', error);
    }
}

// ===== COMPLEX EXAMPLES =====

// Complete file workflow
async function completeFileWorkflowExample() {
    try {
        console.log('Starting complete file workflow...');
        
        // 1. Load top-level directories
        const directories = await dispatch(fileActions.loadTopLevelDirectories());
        console.log('Directories loaded:', directories);
        
        // 2. Load directory listing
        const listing = await dispatch(fileActions.loadDirectoryListing('/my-project'));
        console.log('Directory listing loaded:', listing);
        
        // 3. Load file content
        const content = await dispatch(fileActions.loadFileContent('/my-project/readme.md'));
        console.log('File content loaded');
        
        // 4. Modify content
        const newContent = content + '\n\n# Updated via thunks!';
        
        // 5. Save file
        await dispatch(fileActions.saveFileContent('/my-project/readme.md', newContent));
        console.log('File saved successfully');
        
        console.log('Complete file workflow finished!');
    } catch (error) {
        console.error('Error in file workflow:', error);
    }
}

// UI state management workflow
async function uiStateWorkflowExample() {
    try {
        console.log('Starting UI state workflow...');
        
        // 1. Apply initial state
        dispatch(uiActions.applyInitialUIState());
        console.log('Initial UI state applied');
        
        // 2. Set view mode
        await dispatch(uiActions.setViewModeAsync('split'));
        console.log('View mode set to split');
        
        // 3. Toggle log visibility
        await dispatch(uiActions.toggleLogVisibilityAsync());
        console.log('Log visibility toggled');
        
        // 4. Set log height
        await dispatch(uiActions.setLogHeightAsync(250));
        console.log('Log height set');
        
        console.log('UI state workflow finished!');
    } catch (error) {
        console.error('Error in UI workflow:', error);
    }
}

// Export all examples
export {
    // Auth examples
    loginExample,
    checkAuthExample,
    logoutExample,
    generateTokenExample,
    
    // File examples
    loadDirectoriesExample,
    loadDirectoryListingExample,
    loadFileExample,
    saveFileExample,
    deleteFileExample,
    
    // UI examples
    setViewModeExample,
    toggleLogVisibilityExample,
    setLogHeightExample,
    applyInitialUIStateExample,
    
    // Settings examples
    togglePreviewCssExample,
    addPreviewCssExample,
    toggleRootCssExample,
    setDesignThemeExample,
    
    // Plugin examples
    initializePluginsExample,
    togglePluginExample,
    updatePluginSettingsExample,
    loadPluginModuleExample,
    
    // Complex examples
    completeFileWorkflowExample,
    uiStateWorkflowExample
}; 