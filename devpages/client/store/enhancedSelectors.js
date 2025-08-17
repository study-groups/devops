/**
 * Enhanced Redux Selectors with Memoization and Performance Optimization
 * 
 * This file provides high-performance, memoized selectors that replace
 * direct state access patterns throughout the application.
 */

import { getCurrentPathname, getIsDirectorySelected, getIsAuthenticated, getAuthUser } from './selectors.js';

// Simple memoization utility for selectors
function createMemoizedSelector(selector, keyFn = (state) => state) {
    let lastKey = null;
    let lastResult = null;
    
    return (state) => {
        const currentKey = keyFn(state);
        if (currentKey !== lastKey) {
            lastKey = currentKey;
            lastResult = selector(state);
        }
        return lastResult;
    };
}

// ===== BASIC STATE ACCESSORS =====

// Common state accessors (non-memoized, basic getters)
export const getSettingsState = (state) => state.settings || {};

// ===== ENHANCED AUTH SELECTORS =====

/**
 * Comprehensive auth state with all common properties
 * Memoized to prevent unnecessary re-computations
 */
export const getAuthState = createMemoizedSelector(
    (state) => {
        const auth = state.auth || {};
        return {
            isAuthenticated: auth.isAuthenticated || false,
            authChecked: auth.authChecked || false,
            isLoading: auth.isLoading || false,
            user: auth.user || null,
            error: auth.error || null,
            isInitializing: auth.isInitializing || false
        };
    },
    (state) => state.auth // Only recompute when auth slice changes
);

/**
 * Simple boolean check for authentication status
 * Most commonly used auth selector
 */
export const getIsAuthenticatedAndChecked = createMemoizedSelector(
    (state) => {
        const auth = state.auth || {};
        return auth.authChecked && auth.isAuthenticated;
    },
    (state) => `${state.auth?.authChecked}-${state.auth?.isAuthenticated}`
);

// ===== ENHANCED FILE SELECTORS =====

/**
 * Comprehensive file state with defensive programming
 * Handles all common file-related properties
 */
export const getFileState = createMemoizedSelector(
    (state) => {
        const file = state.file || {};
        const currentFile = file.currentFile || {};
        const path = state.path || {};
        
        return {
            // Get path info from path slice (source of truth for navigation)
            isDirectorySelected: path.isDirectorySelected || false,
            currentListing: path.currentListing || null,
            parentListing: path.parentListing || null,
            availableTopLevelDirs: path.availableTopLevelDirs || [],
            
            // Get file-specific info from file slice
            error: file.error || null,
            content: currentFile.content || '',
            isModified: currentFile.isModified || false,
            
            // Include currentFile for backward compatibility
            currentFile: currentFile,
            
            // COMBINED PATH INFO: Use file.currentFile.pathname as primary, fallback to path.currentPathname
            currentPathname: currentFile.pathname || path.currentPathname || '',
            
            // STATUS INFO: Map file slice status to legacy boolean properties
            isSaving: file.status === 'loading',
            isLoading: file.status === 'loading'
        };
    },
    (state) => `${state.file?.status}-${state.file?.currentFile?.pathname}-${state.path?.currentPathname}-${state.path?.isDirectorySelected}` // Recompute when relevant parts change
);

/**
 * Current file path (null if directory is selected)
 * Commonly used in editor and preview components
 */
export const getCurrentFileInfo = createMemoizedSelector(
    (state) => {
        const fileState = getFileState(state);
        return {
            path: fileState.isDirectorySelected ? null : fileState.currentPathname,
            isDirectory: fileState.isDirectorySelected,
            isFile: !fileState.isDirectorySelected && !!fileState.currentPathname,
            content: fileState.content,
            isLoading: fileState.isLoading,
            isSaving: fileState.isSaving
        };
    },
    (state) => `${state.file?.currentPathname}-${state.file?.isDirectorySelected}-${state.file?.isLoading}`
);

// ===== ENHANCED UI SELECTORS =====

/**
 * Comprehensive UI state for layout components
 */
export const getUIState = createMemoizedSelector(
    (state) => {
        const ui = state.ui || {};
        return {
            logVisible: ui.logVisible || false,
            logMenuVisible: ui.logMenuVisible || false,
            contextManagerVisible: ui.contextManagerVisible !== false, // Default true
            viewMode: ui.viewMode || 'split',
            isLoading: ui.isLoading || false,
            theme: ui.theme || 'dark',
            sidebarVisible: ui.leftSidebarVisible !== false // Fix: Use correct property name
        };
    },
    (state) => state.ui
);

/**
 * Visibility state for common UI elements
 * Used by layout managers and visibility controllers
 */
export const getVisibilityState = createMemoizedSelector(
    (state) => {
        const ui = getUIState(state);
        return {
            showLog: ui.logVisible,
            showLogMenu: ui.logMenuVisible,
            showContextManager: ui.contextManagerVisible,
            showSidebar: ui.sidebarVisible,
            isLoading: ui.isLoading
        };
    },
    (state) => `${state.ui?.logVisible}-${state.ui?.contextManagerVisible}-${state.ui?.leftSidebarVisible}`
);

// ===== ENHANCED EDITOR SELECTORS =====

/**
 * Editor state with content and metadata
 * Used by EditorPanel and related components
 */
export const getEditorState = createMemoizedSelector(
    (state) => {
        const editor = state.editor || {};
        const fileInfo = getCurrentFileInfo(state);
        const authState = getAuthState(state);
        
        return {
            content: editor.content || fileInfo.content || '',
            isModified: editor.isModified || false,
            isReadOnly: !authState.isAuthenticated,
            canEdit: authState.isAuthenticated && fileInfo.isFile,
            currentFile: fileInfo.path,
            isLoading: fileInfo.isLoading,
            isSaving: fileInfo.isSaving
        };
    },
    (state) => `${state.editor?.content}-${state.editor?.isModified}-${state.auth?.isAuthenticated}-${state.file?.currentPathname}`
);

// ===== ENHANCED PREVIEW SELECTORS =====

/**
 * Preview state with rendering information
 * Used by PreviewPanel and preview-related components
 */
export const getPreviewState = createMemoizedSelector(
    (state) => {
        const preview = state.preview || {};
        const fileInfo = getCurrentFileInfo(state);
        
        return {
            content: preview.content || '',
            status: preview.status || 'idle', // 'idle' | 'loading' | 'ready' | 'error'
            error: preview.error || null,
            currentFile: fileInfo.path,
            isMarkdownFile: fileInfo.path?.endsWith('.md') || false,
            canPreview: !!fileInfo.path
        };
    },
    (state) => `${state.preview?.status}-${state.preview?.content}-${state.file?.currentPathname}`
);

// ===== COMPOSITE SELECTORS =====

/**
 * Application readiness state
 * Combines auth, file system, and UI readiness
 */
export const getAppReadinessState = createMemoizedSelector(
    (state) => {
        const authState = getAuthState(state);
        const fileState = getFileState(state);
        const uiState = getUIState(state);
        
        return {
            isAuthReady: authState.authChecked,
            isFileSystemReady: fileState.availableTopLevelDirs.length > 0,
            isUIReady: !uiState.isLoading,
            isFullyReady: authState.authChecked && 
                         fileState.availableTopLevelDirs.length > 0 && 
                         !uiState.isLoading
        };
    },
    (state) => `${state.auth?.authChecked}-${state.file?.availableTopLevelDirs?.length}-${state.ui?.isLoading}`
);

/**
 * Panel visibility and state for layout management
 * Used by workspace managers and panel controllers
 */
export const getPanelLayoutState = createMemoizedSelector(
    (state) => {
        const ui = getUIState(state);
        const auth = getAuthState(state);
        const file = getCurrentFileInfo(state);
        
        return {
            showEditor: auth.isAuthenticated && file.isFile && ui.editorVisible,
            showPreview: !!file.path && ui.previewVisible,
            showFileBrowser: auth.isAuthenticated,
            showLog: ui.logVisible,
            showSidebar: ui.leftSidebarVisible,
            viewMode: ui.viewMode,
            canEdit: auth.isAuthenticated,
            editorVisible: ui.editorVisible,
            previewVisible: ui.previewVisible
        };
    },
    (state) => `${state.auth?.isAuthenticated}-${state.file?.currentPathname}-${state.ui?.viewMode}-${state.ui?.leftSidebarVisible}-${state.ui?.editorVisible}-${state.ui?.previewVisible}`
);

// ===== UTILITY FUNCTIONS =====

/**
 * Create a selector that only updates when specific state keys change
 * Useful for performance optimization in components
 */
export function createKeyedSelector(selector, ...stateKeys) {
    return createMemoizedSelector(
        selector,
        (state) => stateKeys.map(key => state[key]).join('-')
    );
}

/**
 * Batch multiple selectors for efficient state access
 * Returns an object with all selector results
 */
export function batchSelectors(selectors) {
    return createMemoizedSelector(
        (state) => {
            const result = {};
            for (const [key, selector] of Object.entries(selectors)) {
                result[key] = selector(state);
            }
            return result;
        },
        (state) => Object.values(selectors).map(sel => sel(state)).join('-')
    );
}

// ===== COMMON SELECTOR COMBINATIONS =====

/**
 * Most commonly used selectors bundled together
 * Reduces the number of selector calls in components
 */
export const getCommonAppState = batchSelectors({
    auth: getAuthState,
    file: getFileState,
    ui: getUIState,
    readiness: getAppReadinessState
});

/**
 * Panel-specific state bundle
 * Used by most panel components
 */
export const getPanelState = batchSelectors({
    auth: getAuthState,
    file: getCurrentFileInfo,
    ui: getVisibilityState,
    layout: getPanelLayoutState
});
