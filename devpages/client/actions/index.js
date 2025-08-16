/**
 * Actions index
 * Exports all action handlers and provides the combined triggerActions object
 */
import { fileActionHandlers } from './fileActions.js';
import { uiActionHandlers } from './uiActions.js';
import { editorActionHandlers } from './editorActions.js';
import { imageActionHandlers } from './imageActions.js';
// Auth functionality moved to store/slices/authSlice.js for consistency
// import { authActionHandlers } from './authActions.js';
import { debugActionHandlers } from './debugActions.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('Actions');

// Re-export the action handlers for direct use
export {
    fileActionHandlers,
    uiActionHandlers,
    editorActionHandlers,
    imageActionHandlers,
    // authActionHandlers, // Moved to store/slices/authSlice.js
    debugActionHandlers
};

// Initialize all action handlers
export function initializeActions() {
    log.info('ACTION', 'INIT', 'Action handlers registration complete.');
}

/**
 * Combined triggerActions object that contains all action handlers
 * This maintains the original API of triggerActions while using the modular structure
 */
export const triggerActions = {
    // File actions
    saveFile: fileActionHandlers.saveFile,
    loadFile: fileActionHandlers.loadFile,
    downloadStaticHTML: fileActionHandlers.downloadStaticHTML,
    publishToSpaces: fileActionHandlers.publishToSpaces,
    
    // UI actions
    setView: uiActionHandlers.setView,
    refreshPreview: uiActionHandlers.refreshPreview,
    copyLog: uiActionHandlers.copyLog,
    clearLog: uiActionHandlers.clearLog,
    // toggleLogVisibility: handled directly by ViewControls component
    minimizeLog: uiActionHandlers.minimizeLog,
    showSystemInfo: uiActionHandlers.showSystemInfo,
    toggleLogMenu: uiActionHandlers.toggleLogMenu,
    copyLogEntry: uiActionHandlers.copyLogEntry,
    pasteLogEntry: uiActionHandlers.pasteLogEntry,
    
    // Editor actions
    setSmartCopyBufferA: editorActionHandlers.setSmartCopyBufferA,
    setSmartCopyBufferB: editorActionHandlers.setSmartCopyBufferB,
    replaceEditorSelection: editorActionHandlers.replaceEditorSelection,
    pasteTextAtCursor: editorActionHandlers.pasteTextAtCursor,
    pasteCliResponseOverSelection: editorActionHandlers.pasteCliResponseOverSelection,
    
    // Image actions
    deleteImage: imageActionHandlers.deleteImage,
    'delete-image': imageActionHandlers.handleDeleteImage,
    
    // Auth actions - moved to store/slices/authSlice.js
    // Use authThunks.login, authThunks.logout directly from authSlice.js
    // login: authActionHandlers.login,
    // logout: authActionHandlers.logout,
    
    // Debug actions
    runDebugUI: debugActionHandlers.runDebugUI,
    showAppInfo: debugActionHandlers.showAppInfo,
    debugAllApiEndpoints: debugActionHandlers.debugAllApiEndpoints,
    debugUrlParameters: debugActionHandlers.debugUrlParameters,
    debugFileList: debugActionHandlers.debugFileList,
    debugFileLoadingIssues: debugActionHandlers.debugFileLoadingIssues,
    debugAuthState: debugActionHandlers.debugAuthState
}; 