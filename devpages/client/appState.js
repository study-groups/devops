/**
 * client/state/appState.js
 * Centralized application state management using statekit.
 */

import { createState } from '/client/statekit/statekit.js';

// <<< NEW: Key for localStorage persistence >>>
const LOG_VISIBLE_KEY = 'logVisible'; 
// <<< NEW: Key for persisting plugin state >>>
const PLUGINS_STATE_KEY = 'pluginsEnabledState'; 

// <<< NEW: Helper to safely get boolean from localStorage >>>
function getInitialLogVisibility() {
    try {
        const storedValue = localStorage.getItem(LOG_VISIBLE_KEY);
        // localStorage stores strings, so compare explicitly
        if (storedValue === 'true') {
            return true;
        } else if (storedValue === 'false') {
            return false;
        }
        // If null, undefined, or anything else, use default
        console.log('[AppState] No valid logVisible state found in localStorage, defaulting to false.');
        return false; // Default to false if not explicitly stored or invalid
    } catch (e) {
        console.error('[AppState] Error reading log visibility from localStorage:', e);
        return false; // Default to false on error
    }
}

// --- Default Plugin State --- 
const defaultPluginsState = {
    'highlight': { name: "Syntax Highlighting", enabled: true },
    'mermaid': { name: "Mermaid Diagrams", enabled: true },
    'katex': { name: "KaTeX Math Rendering", enabled: true },
    'audio-md': { name: "Audio Markdown", enabled: true },
    'github-md': { name: "GitHub Flavored Markdown", enabled: true }
};

// --- Helper to load plugin state from localStorage --- 
function getInitialPluginsState() {
    try {
        const storedValue = localStorage.getItem(PLUGINS_STATE_KEY);
        if (storedValue) {
            const parsedState = JSON.parse(storedValue);
            // Basic validation: check if it's an object and has expected keys (optional but good)
            if (typeof parsedState === 'object' && parsedState !== null && Object.keys(parsedState).length > 0) {
                 // TODO: Deeper validation? Check if values have name/enabled?
                 console.log('[AppState] Loaded plugin state from localStorage:', parsedState);
                 // Merge with defaults to ensure all plugins are present if new ones were added
                 const mergedState = { ...defaultPluginsState };
                 for (const pluginId in parsedState) {
                     if (mergedState.hasOwnProperty(pluginId)) { // Only merge known plugins
                         mergedState[pluginId].enabled = !!parsedState[pluginId].enabled; // Ensure boolean
                     }
                 }
                 return mergedState;
            }
             console.warn('[AppState] Invalid plugin state found in localStorage. Using defaults.', parsedState);
        } else {
            console.log('[AppState] No plugin state found in localStorage, using defaults.');
        }
    } catch (e) {
        console.error('[AppState] Error reading or parsing plugin state from localStorage:', e);
    }
    // Return defaults if anything goes wrong or nothing is stored
    return defaultPluginsState; 
}

// Define the initial shape of the application state
const initialAppState = {
  auth: {
    isInitializing: true, // Track auth initialization state
    isAuthenticated: false,
    user: null, // e.g., { username: '...', token: '...', roles: [] }
    error: null,
  },
  ui: {
    // Global UI states, e.g., current theme, loading indicators
    theme: 'default', // Example
    isLoading: false, // Keep general loading state? Or manage per feature?
    logVisible: getInitialLogVisibility(), // <<< MODIFIED: Load from localStorage >>>
  },
  settingsPanel: {
    enabled: false,
    position: { x: 50, y: 50 },
    size: { width: 380, height: 550 },
    collapsedSections: {},
    // Add specific settings here as needed, e.g.:
    // logLevel: 'info'
  },
  editor: {
    // Example placeholder
    content: '', // Note: fileManager currently calls setContent directly. Refactor later?
    dirty: false,
  },
  // --- Refactored File System State ---
  file: { // Renamed from 'files' for clarity and consistency
    isInitialized: false,       // Tracks if file manager has run initial load
    isLoading: false,           // True when loading listing or file content
    isSaving: false,            // True during save operation
    topLevelDirectory: null,    // e.g., 'gridranger' or null if none selected
    currentRelativePath: null,  // e.g., 'subdir' or null if at top level
    currentFile: null,          // e.g., 'notes.md' or null if none selected
    currentListing: {           // Contents of the current directory
        dirs: [],
        files: []
    },
    availableTopLevelDirs: [], // List of available root directories (e.g., ['user1', 'shared'])
    error: null,                // Holds error messages related to file operations
    // Consider adding current file content or front matter here if needed by many components,
    // otherwise keep content primarily managed by the editor module.
  },
  // --- End Refactored File System State ---

  // +++ Add the Plugins State Slice +++
  plugins: {
    // Load initial plugin state using the helper function
    ...getInitialPluginsState()
  }
};

// Create the application state store instance
export const appStore = createState(initialAppState);

// Export state slices or selectors if needed for convenience
// Example selector:
// export const selectIsAuthenticated = derived(appStore, $state => $state.auth.isAuthenticated);

console.log('[AppState] Central store initialized.');