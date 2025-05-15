/**
 * client/state/appState.js
 * Centralized application state management using statekit.
 */

import { createStore } from '/client/statekit/statekit.js';

// <<< NEW: Key for localStorage persistence >>>
const LOG_VISIBLE_KEY = 'logVisible'; 
// <<< NEW: Key for persisting plugin state >>>
const PLUGINS_STATE_KEY = 'pluginsEnabledState'; 
// <<< NEW: Keys for persisting SmartCopy buffers >>>
export const SMART_COPY_A_KEY = 'smartCopyBufferA';
export const SMART_COPY_B_KEY = 'smartCopyBufferB';
// <<< Key for persisting preview CSS file list >>>
const PREVIEW_CSS_FILES_KEY = 'previewCssFiles';
const ENABLE_ROOT_CSS_KEY = 'previewEnableRootCss'; // <<< NEW KEY

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
        // Use console.debug for this initial, less critical log
        console.debug(`[AppState] Attempting to load plugins from localStorage. Key: '${PLUGINS_STATE_KEY}'. Stored value: ${storedValue ? `"${storedValue}"` : 'null'}`);

        if (storedValue) {
            const parsedState = JSON.parse(storedValue);
            // Use console.debug for successful parsing
            console.debug(`[AppState] Parsed plugin state from localStorage: ${JSON.stringify(parsedState)}`);

            if (typeof parsedState === 'object' && parsedState !== null) {
                 const mergedState = { ...defaultPluginsState }; 
                 let appliedFromStorage = false; 

                 for (const pluginId in defaultPluginsState) {
                     if (Object.prototype.hasOwnProperty.call(defaultPluginsState, pluginId)) {
                         if (Object.prototype.hasOwnProperty.call(parsedState, pluginId)) {
                             mergedState[pluginId] = {
                                 ...defaultPluginsState[pluginId], 
                                 enabled: !!parsedState[pluginId] 
                             };
                             // Use console.debug for successful application
                             console.debug(`[AppState] Applied stored 'enabled' for ${pluginId}: ${mergedState[pluginId].enabled} (from localStorage value: ${parsedState[pluginId]})`);
                             appliedFromStorage = true;
                         } else {
                             // Use console.debug for cases where default is used because item not in storage
                             console.debug(`[AppState] Plugin ${pluginId} not in localStorage, using default 'enabled': ${mergedState[pluginId].enabled}`);
                         }
                     }
                 }

                 if (Object.keys(parsedState).length > 0 && !appliedFromStorage) {
                    // Use console.warn for potentially unexpected situations
                    console.warn('[AppState] localStorage had plugin data, but no keys matched known default plugins. Using defaults for all known plugins.');
                 } else if (!appliedFromStorage && Object.keys(parsedState).length === 0) {
                    // Use console.info for expected empty storage
                    console.info('[AppState] localStorage plugin data was an empty object. Using defaults.');
                 }
                 
                 // Use console.debug for the final state
                 console.debug(`[AppState] Final merged plugin state for initialization: ${JSON.stringify(mergedState)}`);
                 return mergedState;
            } else {
                // Use console.warn for invalid parsed state
                console.warn('[AppState] Parsed plugin state from localStorage was not a valid object. Using defaultPluginsState.');
                return { ...defaultPluginsState };
            }
        } else {
            // Use console.info for the expected case of no stored state
            console.info('[AppState] No plugin state in localStorage, using defaultPluginsState.');
            return { ...defaultPluginsState };
        }
    } catch (e) {
        // Use console.error for actual errors
        console.error(`[AppState] Error reading or parsing plugin state from localStorage: ${e.message}. Using defaultPluginsState.`);
        console.error(e); // Log the full error object for detailed diagnostics
        return { ...defaultPluginsState };
    }
}

// --- Helper to load configured CSS files (Handles new object structure) ---
function getInitialPreviewCssFiles() {
    try {
        const storedValue = localStorage.getItem(PREVIEW_CSS_FILES_KEY);
        if (storedValue) {
            const parsed = JSON.parse(storedValue);
            // Validate: Is it an array? Does each item have path (string) and enabled (boolean)?
            if (Array.isArray(parsed) && parsed.every(item =>
                item && typeof item.path === 'string' && typeof item.enabled === 'boolean'
            )) {
                console.log('[AppState] Loaded preview CSS config from localStorage:', parsed);
                return parsed; // Return validated array of objects
            } else {
                 console.warn('[AppState] Invalid preview CSS config structure found in localStorage. Using default empty array.');
            }
        }
    } catch(e) {
        console.error('[AppState] Error reading preview CSS config from localStorage:', e);
    }
    return []; // Default to empty array
}

// --- Helper to load root CSS enabled state ---
function getInitialEnableRootCss() {
    try {
        const storedValue = localStorage.getItem(ENABLE_ROOT_CSS_KEY);
        if (storedValue === 'false') { // Only disable if explicitly stored as false
            console.log('[AppState] Loaded root CSS state (disabled) from localStorage.');
            return false;
        }
    } catch(e) {
        console.error('[AppState] Error reading root CSS enabled state from localStorage:', e);
    }
    // Default to true if not stored, invalid, or error
    console.log('[AppState] Defaulting root CSS to enabled.');
    return true;
}

// Define the initial shape of the application state
const initialAppState = {
  auth: {
    isInitializing: true,
    isAuthenticated: false,
    user: null, // e.g., { username: '...', role: '...' } // <<< Role should be included here
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
  // --- REFACTORED File System State ---
  file: {
    isInitialized: false,       // Tracks if file manager has run initial load attempt
    isLoading: false,           // True when loading listing or file content
    isSaving: false,            // True during save operation

    // --- Simplified Path Representation ---
    // Represents the currently selected item (file or directory) relative to PData's dataDir.
    // Examples: '' (MD_DIR root), 'mike', 'mike/notes', 'mike/notes/readme.md', null (nothing selected/init)
    currentPathname: null,
    isDirectorySelected: false, // True if currentPathname refers to a directory, false if it's a file or null.

    // --- Listing and Context ---
    // Stores the listing of the directory relevant to the current selection.
    currentListing: {
        pathname: null,           // The pathname of the directory whose contents are listed.
        dirs: [],
        files: []
    },
    // Listing of the parent directory, needed for sibling navigation dropdown
    parentListing: {
        pathname: null,           // Pathname of the parent directory listed
        triggeringPath: null,     // Pathname that triggered the parent load (for ContextManager)
        dirs: [],
        files: []
    },

    availableTopLevelDirs: [], // Still useful for admin dropdown/initial context.
    error: null,                // Holds error messages related to file operations
  },
  // --- End REFACTORED File System State ---

  // +++ Add the Plugins State Slice +++
  plugins: {
    // Load initial plugin state using the helper function
    ...getInitialPluginsState()
  },
  settings: {
      preview: {
          cssFiles: getInitialPreviewCssFiles(),
          activeCssFiles: [],
          enableRootCss: getInitialEnableRootCss() // <<< NEW STATE FIELD
      }
  },
  // +++ Add the Log Filtering State Slice +++
  logFiltering: {
    discoveredTypes: [], // Stores all unique types encountered, e.g., ['text', 'json', 'cli-input']
    activeFilters: [],   // Stores types currently active for display
  },
  // ... smartCopy ...
};

// Create the application state store instance
export const appStore = createStore(initialAppState);

// Export state slices or selectors if needed for convenience
// Example selector:
// export const selectIsAuthenticated = derived(appStore, $state => $state.auth.isAuthenticated);

console.log('[AppState] Central store initialized.');
