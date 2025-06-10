/**
 * client/state/appState.js
 * Centralized application state management using statekit.
 */

import { createStore } from '/client/store/statekit.js';

// <<< NEW: Key for localStorage persistence >>>
const LOG_VISIBLE_KEY = 'logVisible'; 
// <<< NEW: Key for persisting plugin state >>>
const PLUGINS_STATE_KEY = 'pluginsFullState'; 
// <<< NEW: Keys for persisting SmartCopy buffers >>>
export const SMART_COPY_A_KEY = 'smartCopyBufferA';
export const SMART_COPY_B_KEY = 'smartCopyBufferB';
// <<< Key for persisting preview CSS file list >>>
const PREVIEW_CSS_FILES_KEY = 'previewCssFiles';
const ENABLE_ROOT_CSS_KEY = 'previewEnableRootCss'; // <<< NEW KEY
const VIEW_MODE_KEY = 'appViewMode'; // <<< ADDED: Key for persisting viewMode

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

// <<< ADDED: Helper to load viewMode from localStorage >>>
function getInitialViewMode() {
    try {
        const storedViewMode = localStorage.getItem(VIEW_MODE_KEY);
        if (storedViewMode && ['preview', 'split'].includes(storedViewMode)) {
            console.log('[AppState] Loaded viewMode from localStorage:', storedViewMode);
            return storedViewMode;
        }
        console.log('[AppState] No valid viewMode in localStorage, defaulting to preview.');
    } catch (e) {
        console.error('[AppState] Error reading viewMode from localStorage:', e);
    }
    return 'preview'; // Default to 'preview' (rendered page) if not explicitly stored, invalid, or on error
}

// --- Enhanced Data-Driven Plugin Configuration ---
const defaultPluginsConfig = {
    'mermaid': {
        name: "Mermaid Diagrams",
        // Module loading configuration
        module: '/client/preview/plugins/mermaid/index.js',
        exportName: 'MermaidPlugin',
        // Plugin settings
        defaultState: {
            enabled: true,
            theme: 'default',
        },
        // UI generation manifest
        settingsManifest: [
            { key: 'enabled', label: 'Enable Mermaid', type: 'toggle' },
            { key: 'theme', label: 'Theme', type: 'select', options: ['default', 'forest', 'dark', 'neutral'] }
        ]
    },
    'highlight': {
        name: "Syntax Highlighting",
        module: '/client/preview/plugins/highlight.js',
        exportName: 'HighlightPlugin',
        legacyInitFunction: 'loadHighlightJS',
        defaultState: { enabled: true },
        settingsManifest: [
            { key: 'enabled', label: 'Enable Syntax Highlighting', type: 'toggle' }
        ]
    },
    'katex': {
        name: "KaTeX Math Rendering",
        // Special handling for external CDN module
        module: 'https://esm.sh/markdown-it-katex@2.0.3',
        exportName: 'default',
        type: 'markdown-it-plugin', // Special type for markdown-it plugins
        defaultState: { enabled: true },
        settingsManifest: [
            { key: 'enabled', label: 'Enable KaTeX', type: 'toggle' }
        ]
    },
    'audio-md': {
        name: "Audio Markdown",
        module: '/client/preview/plugins/audio-md.js',
        exportName: 'AudioMDPlugin',
        defaultState: { enabled: true },
        settingsManifest: [
            { key: 'enabled', label: 'Enable Audio Markdown', type: 'toggle' }
        ]
    }
};

// --- Helper to load FULL plugin state from localStorage --- 
function getInitialPluginsState() {
    const initialFullState = {};

    // Initialize with defaults from defaultPluginsConfig
    for (const pluginId in defaultPluginsConfig) {
        if (Object.prototype.hasOwnProperty.call(defaultPluginsConfig, pluginId)) {
            initialFullState[pluginId] = {
                name: defaultPluginsConfig[pluginId].name, // Keep name for display
                settings: { ...defaultPluginsConfig[pluginId].defaultState }, // Actual configurable settings
                settingsManifest: defaultPluginsConfig[pluginId].settingsManifest // UI rendering info
            };
        }
    }

    try {
        const storedValue = localStorage.getItem(PLUGINS_STATE_KEY);

        if (storedValue) {
            const parsedStoredPlugins = JSON.parse(storedValue);

            if (typeof parsedStoredPlugins === 'object' && parsedStoredPlugins !== null) {
                for (const pluginId in initialFullState) {
                    if (Object.prototype.hasOwnProperty.call(initialFullState, pluginId) &&
                        Object.prototype.hasOwnProperty.call(parsedStoredPlugins, pluginId) &&
                        typeof parsedStoredPlugins[pluginId].settings === 'object') {
                        
                        // Merge stored settings with defaults, ensuring all default keys are present
                        const defaultPluginSettings = defaultPluginsConfig[pluginId].defaultState;
                        const storedPluginSettings = parsedStoredPlugins[pluginId].settings;
                        
                        const mergedSettings = { ...defaultPluginSettings };
                        for (const settingKey in defaultPluginSettings) {
                            if (Object.prototype.hasOwnProperty.call(storedPluginSettings, settingKey) &&
                                typeof storedPluginSettings[settingKey] === typeof defaultPluginSettings[settingKey]) { // Basic type check
                                mergedSettings[settingKey] = storedPluginSettings[settingKey];
                            }
                        }
                        initialFullState[pluginId].settings = mergedSettings;
                    }
                }
            } else {
                console.warn('[AppState] Parsed plugin state from localStorage is not a valid object.');
            }
        }
    } catch (error) {
        console.error('[AppState] Error loading plugin state from localStorage:', error);
    }

    return initialFullState;
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

// Helper to get initial org selection from localStorage
function getInitialSelectedOrg() {
    try {
        const storedValue = localStorage.getItem('devpages_selected_org');
        if (storedValue && typeof storedValue === 'string') {
            console.log(`[AppState] Loaded selected org from localStorage: '${storedValue}'`);
            return storedValue;
        }
    } catch(e) {
        console.error('[AppState] Error reading selected org from localStorage:', e);
    }
    // Default to pixeljam-arcade
    console.log('[AppState] Defaulting selected org to "pixeljam-arcade".');
    return 'pixeljam-arcade';
}

// Helper function to load settings panel state from localStorage
function getInitialSettingsPanelState() {
  const defaults = {
    visible: false,  // ✅ Use 'visible', not 'enabled'
    position: { x: 50, y: 50 },
    size: { width: 380, height: 550 },
    collapsedSections: {},
  };

  try {
    const savedState = localStorage.getItem('devpages_settings_panel_state');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      return {
        ...defaults,
        ...parsed,
        position: { ...defaults.position, ...(parsed.position || {}) },
        size: { ...defaults.size, ...(parsed.size || {}) },
      };
    }
  } catch (e) {
    console.warn('[AppState] Failed to load settings panel state:', e);
  }
  
  return defaults;
}

// Helper function to load log state from localStorage  
function getInitialLogState() {
  const defaults = {
    visible: false,
    height: 120,
    menuVisible: false
  };

  try {
    const savedVisible = localStorage.getItem('logVisible');
    const savedHeight = localStorage.getItem('logHeight');
    
    return {
      visible: savedVisible === 'true',
      height: savedHeight ? Math.max(80, parseInt(savedHeight, 10)) : defaults.height,
      menuVisible: false // Always start with menu closed
    };
  } catch (e) {
    console.warn('[AppState] Failed to load log state:', e);
  }
  
  return defaults;
}

// Key for localStorage persistence
const PANELS_STATE_KEY = 'panelsState';

// Helper to load initial panel state from localStorage
function getInitialPanelsState() {
    const defaults = {
        'editor-panel': {
            id: 'editor-panel',
            visible: true,
            width: 450,
            order: 1
        },
        'preview-panel': {
            id: 'preview-panel',
            visible: true,
            width: 450,
            order: 2
        }
    };

    try {
        const savedState = localStorage.getItem(PANELS_STATE_KEY);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            // Merge saved state with defaults to ensure all panels are represented
            // and have all necessary keys.
            return {
                ...defaults,
                'editor-panel': { ...defaults['editor-panel'], ...(parsed['editor-panel'] || {}) },
                'preview-panel': { ...defaults['preview-panel'], ...(parsed['preview-panel'] || {}) },
            };
        }
    } catch (e) {
        console.warn('[AppState] Failed to load panels state from localStorage:', e);
    }

    return defaults;
}

// Define the initial shape of the application state
const initialAppState = {
  auth: {
    isInitializing: true,
    isAuthenticated: false,
    user: null,
    error: null,
  },
  ui: {
    theme: 'default',
    isLoading: false,
    logVisible: getInitialLogState().visible,
    logHeight: getInitialLogState().height,
    logMenuVisible: getInitialLogState().menuVisible,
    viewMode: getInitialViewMode(),
    leftSidebarVisible: false,
    rightSidebarVisible: false,
    textVisible: true,
    previewVisible: true
  },
  panels: getInitialPanelsState(), // +++ NEW, CENTRALIZED PANEL STATE +++
  settingsPanel: getInitialSettingsPanelState(),
  editor: {
    content: '',
    dirty: false,
  },
  // --- REFACTORED File System State ---
  file: {
    isInitialized: false,       // Tracks if file manager has run initial load attempt
    isLoading: false,           // True when loading listing or file content
    isSaving: false,            // True during save operation

    // --- Current Organization Context ---
    currentOrg: getInitialSelectedOrg(), // e.g., '/', '/pj-md', '/another-org'

    // --- Simplified Path Representation ---
    // Represents the currently selected item relative to the current org root
    currentPathname: null,
    isDirectorySelected: false,

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

  // +++ Updated Plugins State Slice Structure +++
  plugins: getInitialPluginsState(), // Now loads the full structure
  settings: {
      // Simple org selection - no server impact
      selectedOrg: getInitialSelectedOrg(), // 'pixeljam-arcade' or 'nodeholder'
      
      preview: {
          configuredCssFiles: getInitialPreviewCssFiles(),
          activeCssFiles: [],
          enableRootCss: getInitialEnableRootCss(),
          previewTheme: 'light'
      }
  },
  // +++ Add the Log Filtering State Slice +++
  logFiltering: {
    discoveredTypes: [], // Stores all unique types encountered
    activeFilters: [],   // Stores types currently active for display
    isInitialized: false // Track if filters have been initialized
  },
  // ... smartCopy ...
  smartCopy: {
    bufferA: localStorage.getItem(SMART_COPY_A_KEY) || '',
    bufferB: localStorage.getItem(SMART_COPY_B_KEY) || ''
  }
};

// Create the application state store instance
export const appStore = createStore(initialAppState);

// Initialize log filtering state when first log entry is added
appStore.subscribe((newState, prevState) => {
    if (!prevState) return;
    
    const newFiltering = newState.logFiltering;
    const prevFiltering = prevState.logFiltering;
    
    // Initialize filters if not done yet and we have discovered types
    if (!newFiltering.isInitialized && newFiltering.discoveredTypes.length > 0) {
        const defaultActiveFilters = [];
        newFiltering.discoveredTypes.forEach(type => {
            if (type !== 'LOG_PANEL') {
                defaultActiveFilters.push(`type:${type}`);
            }
        });
        
        appStore.update(prevState => ({
            ...prevState,
            logFiltering: {
                ...prevState.logFiltering,
                activeFilters: defaultActiveFilters,
                isInitialized: true
            }
        }));
    }
});

// Export state slices or selectors if needed for convenience
// Example selector:
// export const selectIsAuthenticated = derived(appStore, $state => $state.auth.isAuthenticated);

console.log('[AppState] Central store initialized.');

// <<< ADDED: Subscribe to save viewMode to localStorage >>>
let lastKnownViewMode = appStore.getState().ui.viewMode; // Initialize with the initial mode from store

appStore.subscribe((newState) => {
    // Persist logVisible
    const newLogVisible = newState.ui.logVisible;
    if (typeof newLogVisible === 'boolean' && newLogVisible !== (localStorage.getItem(LOG_VISIBLE_KEY) === 'true')) {
        try {
            localStorage.setItem(LOG_VISIBLE_KEY, newLogVisible);
        } catch (e) {
            console.error('[AppState] Error saving log visibility to localStorage:', e);
        }
    }
    
    // Persist logHeight
    const newLogHeight = newState.ui.logHeight;
    // Ensure it's a number before saving
    if (typeof newLogHeight === 'number' && newLogHeight !== parseInt(localStorage.getItem('logHeight'), 10)) {
        try {
            localStorage.setItem('logHeight', newLogHeight.toString());
        } catch (e) {
            console.error('[AppState] Error saving log height to localStorage:', e);
        }
    }

    // Persist full plugin state
    const currentPluginsState = newState.plugins; 
    if (currentPluginsState) { 
        // We want to save the 'settings' part of each plugin
        const stateToSave = {};
        for (const pluginId in currentPluginsState) {
            if(Object.prototype.hasOwnProperty.call(currentPluginsState, pluginId) && currentPluginsState[pluginId].settings) {
                stateToSave[pluginId] = {
                    settings: currentPluginsState[pluginId].settings // Only save the settings object
                };
            }
        }
        
        const serializedStateToSave = JSON.stringify(stateToSave);
        
        let previousSerializedState = null;
        try {
            previousSerializedState = localStorage.getItem(PLUGINS_STATE_KEY);
        } catch (e) {
             console.error('[AppState] Error reading previous full plugin state from localStorage for comparison:', e);
        }

        if (serializedStateToSave !== previousSerializedState) {
            try {
                localStorage.setItem(PLUGINS_STATE_KEY, serializedStateToSave);
            } catch (e) {
                console.error('[AppState] Error saving full plugin state to localStorage:', e);
            }
        }
    }

    // Persist preview CSS file list from settings.preview
    if (newState.settings && newState.settings.preview) {
        const currentCssFiles = newState.settings.preview.configuredCssFiles;
        if (currentCssFiles && JSON.stringify(currentCssFiles) !== localStorage.getItem(PREVIEW_CSS_FILES_KEY)) {
            try {
                localStorage.setItem(PREVIEW_CSS_FILES_KEY, JSON.stringify(currentCssFiles));
            } catch (e) {
                console.error('[AppState] Error saving preview CSS config to localStorage:', e);
            }
        }
        
        // Persist root CSS enabled state from settings.preview
        const currentEnableRootCss = newState.settings.preview.enableRootCss;
        if (typeof currentEnableRootCss === 'boolean' && currentEnableRootCss.toString() !== localStorage.getItem(ENABLE_ROOT_CSS_KEY)) {
            try {
                localStorage.setItem(ENABLE_ROOT_CSS_KEY, currentEnableRootCss.toString());
            } catch (e) {
                console.error('[AppState] Error saving root CSS enabled state to localStorage:', e);
            }
        }
    }
    
    // Persist SmartCopy buffers
    if (newState.smartCopy) { // Check if smartCopy slice exists
        const { bufferA, bufferB } = newState.smartCopy;
        if (bufferA !== localStorage.getItem(SMART_COPY_A_KEY)) {
            localStorage.setItem(SMART_COPY_A_KEY, bufferA);
        }
        if (bufferB !== localStorage.getItem(SMART_COPY_B_KEY)) {
            localStorage.setItem(SMART_COPY_B_KEY, bufferB);
        }
    }
    
    // Persist selected org
    if (newState.file) { // Check if file slice exists
        const currentOrg = newState.file.currentOrg;
        if (currentOrg && currentOrg !== localStorage.getItem('devpages_selected_org')) {
            try {
                localStorage.setItem('devpages_selected_org', currentOrg);
            } catch (e) {
                console.error('[AppState] Error saving selected org to localStorage:', e);
            }
        }
    }

    // Persist settings panel state
    const currentSettingsPanelState = newState.settingsPanel;
    if (currentSettingsPanelState) { // Basic check, could be more robust
        const { visible, position, size, collapsedSections } = currentSettingsPanelState;
        const stateToSave = { visible, position, size, collapsedSections };
        try {
            const storedState = localStorage.getItem('devpages_settings_panel_state');
            if (JSON.stringify(stateToSave) !== storedState) {
                 localStorage.setItem('devpages_settings_panel_state', JSON.stringify(stateToSave));
            }
        } catch(e) {
            console.warn('[AppState] Failed to save settings panel state:', e);
        }
    }

    // Persist viewMode
    if (newState.ui) { // Check if ui slice exists
        const currentViewMode = newState.ui.viewMode;
        if (currentViewMode && currentViewMode !== lastKnownViewMode) {
            try {
                localStorage.setItem(VIEW_MODE_KEY, currentViewMode);
                lastKnownViewMode = currentViewMode; // Update our tracked last known mode
                console.log('[AppState] Saved viewMode to localStorage:', currentViewMode);
            } catch (e) {
                console.error('[AppState] Error saving viewMode to localStorage:', e);
            }
        }
    }

    // +++ NEW: Persist centralized panels state +++
    const currentPanelsState = newState.panels;
    if (currentPanelsState) {
        try {
            const storedState = localStorage.getItem(PANELS_STATE_KEY);
            const stateToSave = JSON.stringify(currentPanelsState);
            if (stateToSave !== storedState) {
                localStorage.setItem(PANELS_STATE_KEY, stateToSave);
            }
        } catch (e) {
            console.warn('[AppState] Failed to save panels state:', e);
        }
    }
});

// Log the initial state for debugging purposes
// console.log('[AppState] Initial application state:', appStore.getState());

// Export the defaultPluginsConfig for use by PluginLoader and other modules
export { defaultPluginsConfig };
