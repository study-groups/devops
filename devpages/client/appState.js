/**
 * client/appState.js
 * Centralized application state management using StateKit with createSlice
 */

// Import from local statekit package to get DevTools support
import { createStore, createLogger, createThunk, createDevpagesTools } from '/packages/devpages-statekit/src/index.js';

// Import the new slices
import { logReducer } from '/client/store/slices/logSlice.js';
import { authSlice } from '/client/store/slices/authSlice.js';
import panelPersistenceMiddleware from '/client/store/middleware/panelPersistence.js';
import { settingsReducer, settingsThunks } from './store/slices/settingsSlice.js';
import { publishSlice } from './store/slices/publishSlice.js';
import { previewSlice } from './store/slices/previewSlice.js';

// Import existing reducers
import { mainReducer } from '/client/store/reducer.js';
import { fileReducer } from '/client/store/reducers/fileReducer.js';

// Export ActionTypes for backward compatibility
export const ActionTypes = {
    // Auth Actions (now use auth slice)
    AUTH_SET_INITIALIZING: 'auth/setInitializing',
    AUTH_SET_AUTH_CHECKED: 'auth/setAuthChecked',
    AUTH_LOGIN_SUCCESS: 'auth/loginSuccess',
    AUTH_LOGOUT: 'auth/logout',
    AUTH_SET_ERROR: 'auth/setError',
    AUTH_CLEAR_ERROR: 'auth/clearError',
    AUTH_UPDATE_USER: 'auth/updateUser',
    AUTH_SET_PERMISSIONS: 'auth/setPermissions',
    
    // Legacy auth actions for backward compatibility
    AUTH_SET_STATE: 'auth/setState',
    AUTH_INITIALIZING: 'auth/setInitializing',
    AUTH_ERROR: 'auth/setError',

    // File Actions
    FS_SELECT_FILE: 'fs/selectFile',
    FS_LOAD_FILE_CONTENT: 'fs/loadFileContent',
    FS_SET_FILE_LISTING: 'fs/setFileListing',
    FS_SET_TOP_DIRS: 'fs/setTopDirs',

    // UI Actions
    UI_SET_VIEW_MODE: 'ui/setViewMode',
    UI_TOGGLE_LOG_VISIBILITY: 'UI_TOGGLE_LOG_VISIBILITY',
    UI_SET_LOG_HEIGHT: 'UI_SET_LOG_HEIGHT',
    UI_TOGGLE_LOG_MENU: 'ui/toggleLogMenu',
    UI_APPLY_INITIAL_STATE: 'ui/applyInitialState',

    // Log Panel Actions (UI related)
    LOG_PANEL_SET_SELECTION_STATE: 'logPanel/setSelectionState',
    LOG_PANEL_SET_ACTIVE_FENCE: 'logPanel/setActiveFence',

    // Log Actions (now use log slice)
    LOG_ADD_ENTRY: 'log/addEntry',
    LOG_CLEAR_ENTRIES: 'log/clearEntries',
    LOG_SET_ACTIVE_FILTERS: 'log/setActiveFilters',
    LOG_TOGGLE_FILTER: 'log/toggleFilter',
    LOG_SET_SEARCH_TERM: 'log/setSearchTerm',
    LOG_INITIALIZE_TYPES: 'log/initializeTypes',

    // Legacy log actions for backward compatibility
    LOG_INIT_TYPES: 'log/initializeTypes',
    LOG_SET_FILTERS: 'log/setActiveFilters',
    LOG_CLEAR: 'log/clearEntries',

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

// Re-export thunks for consistent access
export { settingsThunks };

// Storage keys
const LOG_VISIBLE_KEY = 'log_panel_visible';
const LOG_HEIGHT_KEY = 'log_panel_height';
const PLUGINS_STATE_KEY = 'pluginsFullState';
const PREVIEW_CSS_FILES_KEY = 'devpages_preview_css_files';
const ENABLE_ROOT_CSS_KEY = 'devpages_enable_root_css';
const VIEW_MODE_KEY = 'appViewMode';
const DOM_INSPECTOR_STATE_KEY = 'devpages_dom_inspector_state';
const WORKSPACE_STATE_KEY = 'devpages_workspace_state';

// Export these for backward compatibility with existing imports
export const SMART_COPY_A_KEY = 'smartCopyBufferA';
export const SMART_COPY_B_KEY = 'smartCopyBufferB';

// Helper functions for initial state
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
        viewMode: getInitialViewMode(),
        logVisible,
        logHeight,
        logMenuVisible: false,
    };
}

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
    return 'preview';
}

function getInitialWorkspaceState() {
    const defaults = {
        sidebar: { width: 280, visible: true },
        editor: { width: 50, visible: true },
        preview: { width: 50, visible: true },
    };

    try {
        const storedState = localStorage.getItem(WORKSPACE_STATE_KEY);
        if (storedState) {
            const parsed = JSON.parse(storedState);
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
    console.log('[AppState] Defaulting selected org to "pixeljam-arcade".');
    return 'pixeljam-arcade';
}

const middlewares = [createThunk(), createLogger(), createDevpagesTools()];

middlewares.push(panelPersistenceMiddleware);

// Enhanced Data-Driven Plugin Configuration
export const defaultPluginsConfig = {
    'mermaid': {
        name: "Mermaid Diagrams",
        module: '/client/preview/plugins/mermaid/index.js',
        exportName: 'MermaidPlugin',
        defaultState: { enabled: true, theme: 'default' },
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
        module: 'https://esm.sh/markdown-it-katex@latest',
        exportName: 'default',
        type: 'markdown-it-plugin',
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
    },
};

function getInitialPluginsState() {
    const initialFullState = {};

    for (const pluginId in defaultPluginsConfig) {
        if (Object.prototype.hasOwnProperty.call(defaultPluginsConfig, pluginId)) {
            initialFullState[pluginId] = {
                name: defaultPluginsConfig[pluginId].name,
                settings: { ...defaultPluginsConfig[pluginId].defaultState },
                settingsManifest: defaultPluginsConfig[pluginId].settingsManifest
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
                        
                        const defaultPluginSettings = defaultPluginsConfig[pluginId].defaultState;
                        const storedPluginSettings = parsedStoredPlugins[pluginId].settings;
                        
                        const mergedSettings = { ...defaultPluginSettings };
                        for (const settingKey in defaultPluginSettings) {
                            if (Object.prototype.hasOwnProperty.call(storedPluginSettings, settingKey) &&
                                typeof storedPluginSettings[settingKey] === typeof defaultPluginSettings[settingKey]) {
                                mergedSettings[settingKey] = storedPluginSettings[settingKey];
                            }
                        }
                        initialFullState[pluginId].settings = mergedSettings;
                    }
                }
            }
        }
    } catch (error) {
        console.error('[AppState] Error loading plugin state from localStorage:', error);
    }

    return initialFullState;
}

function getInitialPreviewCssFiles() {
    try {
        const storedValue = localStorage.getItem(PREVIEW_CSS_FILES_KEY);
        if (storedValue) {
            const parsed = JSON.parse(storedValue);
            if (Array.isArray(parsed) && parsed.every(item =>
                item && typeof item.path === 'string' && typeof item.enabled === 'boolean'
            )) {
                console.log('[AppState] Loaded preview CSS config from localStorage:', parsed);
                return parsed;
            } else {
                 console.warn('[AppState] Invalid preview CSS config structure found in localStorage. Using default empty array.');
            }
        }
    } catch(e) {
        console.error('[AppState] Error reading preview CSS config from localStorage:', e);
    }
    return [];
}

function getInitialEnableRootCss() {
    try {
        const storedValue = localStorage.getItem(ENABLE_ROOT_CSS_KEY);
        if (storedValue === 'false') {
            console.log('[AppState] Loaded root CSS state (disabled) from localStorage.');
            return false;
        }
    } catch(e) {
        console.error('[AppState] Error reading root CSS enabled state from localStorage:', e);
    }
    console.log('[AppState] Defaulting root CSS to enabled.');
    return true;
}

function getInitialPanelsState() {
    const SETTINGS_PANEL_STATE_KEY = 'devpages_settings_panel_state';
    const defaults = {
        visible: false,
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
        collapsedSections: {},
        collapsedSubsections: {}
    };

    try {
        const storedState = localStorage.getItem(SETTINGS_PANEL_STATE_KEY);
        if (storedState) {
            return { ...defaults, ...JSON.parse(storedState) };
        }
    } catch (e) {
        console.error('[AppState] Error reading panels state from localStorage:', e);
    }
    return defaults;
}

function getInitialDomInspectorState() {
    const defaults = {
        visible: false,
        elementDetails: null,
        highlightedElement: null,
        isPicking: false,
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
        splitPosition: 33,
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

function getInitialDebugPanelState() {
    const defaults = {
        visible: false,
        position: { x: 150, y: 150 },
        size: { width: 500, height: 400 },
        panels: [
            { id: 'state', title: 'State Inspector', visible: true, order: 0, enabled: true },
            { id: 'dom-inspector', title: 'DOM Inspector', visible: true, order: 1, enabled: true },
            { id: 'network', title: 'Network', visible: false, order: 2, enabled: false },
            { id: 'console', title: 'Console', visible: false, order: 3, enabled: false },
            { id: 'performance', title: 'Performance', visible: false, order: 4, enabled: false },
            { id: 'storage', title: 'Storage', visible: false, order: 5, enabled: false }
        ],
        activePanel: 'state',
        collapsedSections: ['state', 'dom-inspector']
    };
    
    try {
        const storedState = localStorage.getItem('devpages_debug_panel_state');
        if (storedState) {
            const parsed = JSON.parse(storedState);
            if (parsed && typeof parsed.visible === 'boolean') {
                return { ...defaults, ...parsed };
            }
        }
    } catch (e) {
        console.error('[AppState] Error loading Debug Panel state from localStorage:', e);
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
    return 'markdown';
}

// Enhanced reducer combiner that includes the new slices
function combineReducers(slices) {
    return (state = {}, action) => {
        const nextState = {};
        let hasChanged = false;

        // Handle slices created with StateKit createSlice
        for (const [sliceName, sliceReducer] of Object.entries(slices)) {
            if (typeof sliceReducer === 'function') {
                const sliceState = sliceReducer(state[sliceName], action);
                if (sliceState !== state[sliceName]) {
                    hasChanged = true;
                }
                nextState[sliceName] = sliceState;
            }
        }

        // Handle other slices with mainReducer
        const otherState = { ...state };
        // Remove slices that are handled by createSlice
        for (const sliceName of Object.keys(slices)) {
            delete otherState[sliceName];
        }
        
        const updatedOtherState = mainReducer(otherState, action);
        
        // Check if other state changed
        for (const key in updatedOtherState) {
            if (updatedOtherState[key] !== state[key]) {
                hasChanged = true;
            }
            nextState[key] = updatedOtherState[key];
        }

        return hasChanged ? nextState : state;
    };
}

// Initial Application State (only for slices not handled by createSlice)
const initialAppState = {
    // Note: auth and log state are now managed by their respective slices
    file: {
        currentPathname: null,
        currentContent: '',
        isDirectorySelected: true,
        isInitialized: false,
        currentListing: null,
        parentListing: null,
        availableTopLevelDirs: [],
        currentOrg: getInitialSelectedOrg(),
        error: null,
    },
    ui: getInitialUiState(),
    plugins: getInitialPluginsState(),
    settings: {
        preview: {
            cssFiles: getInitialPreviewCssFiles(),
            enableRootCss: getInitialEnableRootCss(),
        },
    },
    smartCopy: {
        bufferA: localStorage.getItem(SMART_COPY_A_KEY) || '',
        bufferB: localStorage.getItem(SMART_COPY_B_KEY) || '',
    },
    panels: getInitialPanelsState(),
    logPanel: {
        selectionStateA: null,
        selectionStateB: null,
        activeCodeFenceBuffer: null,
    },
    domInspector: getInitialDomInspectorState(),
    debugPanel: getInitialDebugPanelState(),
    workspace: getInitialWorkspaceState(),
    previewMode: getInitialPreviewMode(),
    dynamicImports: {
        'markdown-it': {
            loaded: false,
            module: '/client/vendor/scripts/markdown-it.min.js',
            retries: 0,
            maxRetries: 3
        }
    }
};

// --- This is a placeholder for a true combineReducers if you use one ---
// For now, we'll merge the slice reducers into the mainReducer logic
// This part assumes mainReducer is structured to handle this.
// A more standard Redux setup would use a `combineReducers` function.

const rootReducer = combineReducers({
    log: logReducer,
    auth: authSlice.reducer,
    file: fileReducer,
    settings: settingsReducer,
    publish: publishSlice.reducer,
    preview: previewSlice.reducer,
    // Note: panels and main are handled by the legacy mainReducer
    // This will be migrated in the future.
    ...mainReducer.slices
});

// Create the store
export const appStore = createStore(
    rootReducer,
    undefined, // Initial state is handled by reducers
    middlewares
);

export const dispatch = appStore.dispatch;

// Add backward-compatible update function
appStore.update = function(updater) {
    const currentState = appStore.getState();
    const newState = updater(currentState);
    dispatch({ type: ActionTypes.STATE_UPDATE, payload: newState });
};

console.log('[AppState] Central store initialized with log and auth slices.'); 