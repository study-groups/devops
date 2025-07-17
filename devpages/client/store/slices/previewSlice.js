/**
 * @file previewSlice.js
 * @description Redux slice for managing the state of the preview system.
 * This slice handles the initialization of the preview, manages plugins,
 * and tracks the overall state of the preview panel.
 */

import { createSlice, createAsyncThunk } from '/packages/devpages-statekit/src/index.js';
import { logMessage } from '/client/log/index.js';

// --- Helper Functions ---
const log = (message, level = 'debug') => logMessage(message, level, 'PREVIEW_SLICE');

// --- Thunks ---

/**
 * Thunk for initializing the preview system.
 * It loads the renderer and initializes all enabled plugins.
 */
export const initializePreviewSystem = createAsyncThunk(
    'preview/initialize',
    async (_, { dispatch, getState }) => {
        log('Initializing preview system...');
        dispatch(previewSlice.actions.setInitializationStatus('loading'));

        try {
            // Dynamically import the renderer and plugin manager
            const { PreviewRenderer } = await import('/client/preview/PreviewRenderer.js');
            const { PluginManager } = await import('/client/preview/PluginManager.js');

            const renderer = new PreviewRenderer();
            const pluginManager = new PluginManager();

            // Get enabled plugins from the settings
            const settings = getState().settings.preview;
            const enabledPlugins = settings.enabledPlugins || ['mermaid', 'katex', 'highlight'];

            // Initialize plugins
            for (const pluginName of enabledPlugins) {
                await pluginManager.loadPlugin(pluginName, settings[pluginName] || {});
            }

            dispatch(previewSlice.actions.setInitializationStatus('ready'));
            log('Preview system initialized successfully.');

            return { renderer, pluginManager };
        } catch (error) {
            log(`Preview system initialization failed: ${error.message}`, 'error');
            dispatch(previewSlice.actions.setInitializationStatus('error'));
            throw error;
        }
    }
);

// --- Slice Definition ---

const initialState = {
    status: 'idle', // 'idle', 'loading', 'ready', 'error'
    theme: 'light',
    plugins: {
        // Example plugin state
        // 'mermaid': { status: 'idle', config: {} },
        // 'katex': { status: 'idle', config: {} }
    },
    currentContent: '',
    frontMatter: {},
};

export const previewSlice = createSlice({
    name: 'preview',
    initialState,
    reducers: {
        setInitializationStatus: (state, action) => {
            state.status = action.payload;
        },
        setTheme: (state, action) => {
            state.theme = action.payload;
        },
        setPluginState: (state, action) => {
            const { pluginName, status, config } = action.payload;
            if (!state.plugins[pluginName]) {
                state.plugins[pluginName] = {};
            }
            if (status) {
                state.plugins[pluginName].status = status;
            }
            if (config) {
                state.plugins[pluginName].config = config;
            }
        },
        updatePreviewContent: (state, action) => {
            const { content, frontMatter } = action.payload;
            state.currentContent = content;
            state.frontMatter = frontMatter || {};
        },
        resetPreview: () => initialState,
    },
});

export const {
    setInitializationStatus,
    setTheme,
    setPluginState,
    updatePreviewContent,
    resetPreview,
} = previewSlice.actions;

log('Preview slice created successfully.'); 