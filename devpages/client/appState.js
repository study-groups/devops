/**
 * client/state/appState.js
 * Centralized application state management using statekit.
 */

import { createStore } from '/client/store/statekit.js';
import { mainReducer } from '/client/store/reducer.js'; // Import mainReducer

export const ActionTypes = {
    // Auth Actions
    AUTH_SET_STATE: 'auth/setState',
    AUTH_LOGIN_SUCCESS: 'auth/loginSuccess',
    AUTH_LOGOUT: 'auth/logout',
    AUTH_INITIALIZING: 'auth/setInitializing',
    AUTH_ERROR: 'auth/setError',

    // File Actions
    FS_SELECT_FILE: 'fs/selectFile',
    FS_LOAD_FILE_CONTENT: 'fs/loadFileContent',
    FS_SET_FILE_LISTING: 'fs/setFileListing',
    FS_SET_TOP_DIRS: 'fs/setTopDirs',

    // UI Actions
    UI_SET_VIEW_MODE: 'ui/setViewMode',
    UI_TOGGLE_LOG_VISIBILITY: 'ui/toggleLogVisibility',
    UI_SET_LOG_HEIGHT: 'ui/setLogHeight',
    UI_TOGGLE_LOG_MENU: 'ui/toggleLogMenu',
    UI_APPLY_INITIAL_STATE: 'ui/applyInitialState',

    // Log Panel Actions
    LOG_PANEL_SET_SELECTION_STATE: 'logPanel/setSelectionState',
    LOG_PANEL_SET_ACTIVE_FENCE: 'logPanel/setActiveFence',

    // Log Filtering Actions
    LOG_INIT_TYPES: 'log/initTypes',
    LOG_SET_FILTERS: 'log/setFilters',
    LOG_TOGGLE_FILTER: 'log/toggleFilter',
    LOG_CLEAR: 'log/clear',

    // Panel Management Actions
    PANEL_REGISTER: 'panels/register',
    PANEL_UNREGISTER: 'panels/unregister',
    PANEL_SET_VISIBLE: 'panels/setVisible',
    PANEL_SET_COLLAPSED: 'panels/setCollapsed',
    PANEL_SET_ORDER: 'panels/setOrder',
    PANEL_SET_INSTANCE: 'panels/setInstance',
    PANEL_CLEAR_INSTANCE: 'panels/clearInstance',
    PANEL_SAVE_STATE: 'panels/saveState',

    // Generic state update for backward compatibility
    STATE_UPDATE: 'app/stateUpdate',
};

const LOG_VISIBLE_KEY = 'log_panel_visible';
const LOG_HEIGHT_KEY = 'log_panel_height';
const PLUGINS_STATE_KEY = 'pluginsFullState';
// <<< NEW: Keys for persisting SmartCopy buffers >>>
export const SMART_COPY_A_KEY = 'smartCopyBufferA';
export const SMART_COPY_B_KEY = 'smartCopyBufferB';
// <<< Key for persisting preview CSS file list >>>
const PREVIEW_CSS_FILES_KEY = 'devpages_preview_css_files';
const ENABLE_ROOT_CSS_KEY = 'devpages_enable_root_css'; // <<< NEW KEY
const VIEW_MODE_KEY = 'appViewMode'; // <<< ADDED: Key for persisting viewMode
const DOM_INSPECTOR_STATE_KEY = 'devpages_dom_inspector_state';
const WORKSPACE_STATE_KEY = 'devpages_workspace_state';

function getInitialUiState() {
    const DEFAULT_LOG_HEIGHT = 200;
    let logVisible = false;
    let logHeight = DEFAULT_LOG_HEIGHT;

    try {
        const storedVisibility = localStorage.getItem(LOG_VISIBLE_KEY);
        if (storedVisibility !== null) {
            logVisible = JSON.parse(storedVisibility);
        }
    } catch (e) {
        console.error(`[AppState] Error reading ${LOG_VISIBLE_KEY} from localStorage:`, e);
    }

    try {
        const storedHeight = localStorage.getItem(LOG_HEIGHT_KEY);
        if (storedHeight !== null) {
            const parsedHeight = parseInt(storedHeight, 10);
            if (!isNaN(parsedHeight)) {
                logHeight = parsedHeight;
            }
        }
    } catch (e) {
        console.error(`[AppState] Error reading ${LOG_HEIGHT_KEY} from localStorage:`, e);
    }

    return {
        viewMode: getInitialViewMode(), // Keep existing view mode logic
        logVisible,
        logHeight,
        logMenuVisible: false,
    };
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

// <<< ADDED: Helper to load workspace state from localStorage >>>
function getInitialWorkspaceState() {
    const defaults = {
        sidebar: { width: 280, visible: true },
        editor: { width: 50, visible: true }, // percentage
        preview: { width: 50, visible: true }, // percentage
    };

    try {
        const storedState = localStorage.getItem(WORKSPACE_STATE_KEY);
        if (storedState) {
            const parsed = JSON.parse(storedState);
            // Basic validation
            if (parsed && parsed.sidebar && parsed.editor && parsed.preview) {
                 return {
                    ...defaults,
                    ...parsed,
                    sidebar: { ...defaults.sidebar, ...(parsed.sidebar || {}) },
                    editor: { ...defaults.editor, ...(parsed.editor || {}) },
                    preview: { ...defaults.preview, ...(parsed.preview || {}) },
                };
            }
        }
    } catch (e) {
        console.error('[AppState] Error reading workspace state from localStorage:', e);
    }
    return defaults;
}

// --- Enhanced Data-Driven Plugin Configuration ---
export const defaultPluginsConfig = {
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
        module: 'https://esm.sh/markdown-it-katex@latest',
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
    const storedState = localStorage.getItem('devpages_settings_panel_state');
    if (storedState) {
      const parsed = JSON.parse(storedState);
      // Basic validation
      if (parsed && typeof parsed.visible === 'boolean' &&
          typeof parsed.position === 'object' && parsed.position !== null &&
          typeof parsed.size === 'object' && parsed.size !== null &&
          typeof parsed.collapsedSections === 'object' && parsed.collapsedSections !== null) {
        return { ...defaults, ...parsed };
      }
    }
  } catch (e) {
    console.error('[AppState] Error reading settings panel state from localStorage:', e);
  }
  return defaults;
}

// Helper for log state
function getInitialLogState() {
    const defaultLogState = {
        entries: [], // Array of log entries { message, level, type, timestamp }
        discoveredTypes: [], // List of all unique types seen
        activeFilters: [], // Filters applied to display, e.g., ['level:error', 'type:AUTH']
        searchTerm: '', // Text to search within log messages
        isInitialized: false, // Flag to ensure default filters are set only once
    };

    // No localStorage persistence for log entries or discovered types,
    // as they are ephemeral and rebuilt on each session.
    // Filters and search term could be persisted if desired.

    return defaultLogState;
}

// Helper to load panels state from localStorage
const PANELS_STATE_KEY = 'devpages_panels_state';
const SIDEBAR_PANELS_STATE_KEY = 'devpages_sidebar_panels_state';

function getInitialPanelsState() {
    const defaults = {
        // Main workspace panels
        editor: { visible: true, width: 50 },
        preview: { visible: true, width: 50 },
        sidebar: { visible: true, width: 280 },
        
        // Sidebar panels state
        sidebarPanels: {
            // UI state for each sidebar panel
            'files': { visible: true, collapsed: false, order: 1 },
            'panel-manager': { visible: true, collapsed: false, order: 0 },
            'published-summary': { visible: true, collapsed: false, order: 2 },
            'context': { visible: true, collapsed: false, order: 3 },
            'tokens': { visible: true, collapsed: false, order: 4 },
            'controller': { visible: false, collapsed: false, order: 5 },
        },
        
        // Panel instances cache (not persisted)
        instances: {}, // Will be populated at runtime
        
        // Panel registry cache (not persisted)
        registry: {}, // Will be populated at runtime
    };

    try {
        const storedState = localStorage.getItem(PANELS_STATE_KEY);
        if (storedState) {
            const parsed = JSON.parse(storedState);
            // Basic validation for main panel visibility
            if (parsed && typeof parsed.editor === 'object' && typeof parsed.preview === 'object' &&
                typeof parsed.sidebar === 'object') {
                return {
                    ...defaults,
                    editor: { ...defaults.editor, ...(parsed.editor || {}) },
                    preview: { ...defaults.preview, ...(parsed.preview || {}) },
                    sidebar: { ...defaults.sidebar, ...(parsed.sidebar || {}) },
                    // Merge sidebar panels state
                    sidebarPanels: { ...defaults.sidebarPanels, ...(parsed.sidebarPanels || {}) },
                };
            }
        }
    } catch (e) {
        console.error('[AppState] Error reading panels state from localStorage:', e);
    }
    return defaults;
}

// Helper to load DOM Inspector state from localStorage
function getInitialDomInspectorState() {
    const defaults = {
        visible: false,
        elementDetails: null, // Stores details of the currently inspected element
        highlightedElement: null, // Selector for the element currently highlighted on page
        isPicking: false, // Whether the user is in element picking mode
        position: { x: 100, y: 100 }, // Panel position
        size: { width: 800, height: 600 }, // Panel size
        splitPosition: 33, // Tree/details split position
        highlight: {
            enabled: true,
            color: '#007bff',
            zIndex: 10000
        }
    };
    try {
        const storedState = localStorage.getItem(DOM_INSPECTOR_STATE_KEY);
        if (storedState) {
            const parsed = JSON.parse(storedState);
            if (parsed && typeof parsed.visible === 'boolean') {
                return { ...defaults, ...parsed };
            }
        }
    } catch (e) {
        console.error('[AppState] Error loading DOM Inspector state from localStorage:', e);
    }
    return defaults;
}

function getInitialPreviewMode() {
    try {
        const storedMode = localStorage.getItem('previewMode');
        if (['markdown', 'html'].includes(storedMode)) {
            return storedMode;
        }
    } catch (e) {
        console.error('[AppState] Error loading preview mode from localStorage:', e);
    }
    return 'markdown'; // Default to markdown
}


// --- Initial Application State ---
const initialAppState = {
    auth: {
        isAuthenticated: false,
        user: null,
        authChecked: false, // To indicate if initial auth check has completed
    },
    file: {
        currentPathname: null, // Path of the currently selected file
        currentContent: '',    // Content of the currently selected file
        isDirectorySelected: true, // If the current selection is a directory
        isInitialized: false, // Has the file system been loaded?
        currentListing: null, // Current directory listing
        parentListing: null,  // Parent directory listing
        availableTopLevelDirs: [], // For initial folder selection
        currentOrg: getInitialSelectedOrg(), // Selected org for the file system
        error: null, // Any error related to file operations
    },
    ui: getInitialUiState(),
    // Enhanced plugin state with full configs and default states
    plugins: getInitialPluginsState(),
    settings: {
        preview: {
            cssFiles: getInitialPreviewCssFiles(),
            enableRootCss: getInitialEnableRootCss(),
        },
        // Other settings can be added here
    },
    smartCopy: {
        bufferA: localStorage.getItem(SMART_COPY_A_KEY) || '',
        bufferB: localStorage.getItem(SMART_COPY_B_KEY) || '',
    },
    settingsPanel: getInitialSettingsPanelState(),
    logFiltering: {
        discoveredTypes: [],
        activeFilters: [],
        isInitialized: false,
        defaultFilters: {
            // Pre-define default types that might not appear in initial logs
            'API': 'API',
            'EVENT': 'EVENT',
            'STATE': 'STATE',
        }
    },
    logPanel: {
        selectionStateA: null,
        selectionStateB: null,
        activeCodeFenceBuffer: null, // can be 'A' or 'B'
    },
    panels: getInitialPanelsState(), // Centralized panel visibility and dimensions
    domInspector: getInitialDomInspectorState(), // DOM Inspector state
    workspace: getInitialWorkspaceState(), // Workspace layout state
    previewMode: getInitialPreviewMode(), // 'markdown' or 'html'
};

// --- Export the Central Application Store ---
// The appStore is the single source of truth for application state.
// Other modules should subscribe to this store for state changes.
const store = createStore(mainReducer, initialAppState);

export const appStore = store;

// Make appStore available globally for components that need it
if (typeof window !== 'undefined') {
    window.appStore = store;
}
export const dispatch = store.dispatch;

// Add backward-compatible update function
appStore.update = function(updater) {
    const currentState = appStore.getState();
    const newState = updater(currentState);
    dispatch({ type: ActionTypes.STATE_UPDATE, payload: newState });
};

// <<< IMPORTANT: DO NOT add appStore.subscribe blocks here that dispatch actions.
// This creates a circular dependency and is an anti-pattern.
// All state transformations should happen within reducers.
// Persistence logic for localStorage is handled within appState.js,
// which is acceptable as it's not dispatching actions to the store itself.
// This file is purely for defining the store and initial state.
// Any logic that needs to react to state changes and dispatch new actions
// should live in separate modules (e.g., action handlers, components).
// Refer to the mainReducer for how state changes are processed.
// Refer to individual components (like PreviewPanel) for how they subscribe to state.
// Refer to fileActions.js for how actions are defined and dispatched.
// >>>

console.log('[AppState] Central store initialized.'); 