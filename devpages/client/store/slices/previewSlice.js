/**
 * @file previewSlice.js
 * @description Redux slice for managing the state of the preview system.
 * This slice handles the initialization of the preview, manages plugins,
 * and tracks the overall state of the preview panel.
 */

import { createSlice, createAsyncThunk } from '/packages/devpages-statekit/src/index.js';

let log = null;

function getLogger() {
    if (!log) {
        log = window.APP.services.log.createLogger('PreviewSlice');
    }
    return log;
}

// --- Thunks ---

/**
 * Thunk for initializing the preview system.
 * It loads the renderer and initializes all enabled plugins.
 */
export const initializePreviewSystem = createAsyncThunk(
    'preview/initialize',
    async (_, { dispatch, getState }) => {
        const logger = getLogger();
        logger.info('PREVIEW_INIT', 'START', 'Initializing preview system...');
        dispatch(previewSlice.actions.setInitializationStatus('loading'));

        try {
            // Dynamically import the renderer and plugin manager
            const { PreviewRenderer } = await import('/client/preview/PreviewRenderer.js');
            const { pluginManager } = await import('/client/preview/PluginManager.js');

            const renderer = new PreviewRenderer();

            // Get enabled plugins from the settings
            const settings = getState().settings.preview;
            const enabledPlugins = settings.enabledPlugins || ['mermaid', 'highlight'];

            // Initialize plugins
            for (const pluginName of enabledPlugins) {
                try {
                    await pluginManager.loadPlugin(pluginName, settings[pluginName] || {});
                } catch (error) {
                    logger.warn('PREVIEW_INIT', 'PLUGIN_LOAD_FAILED', `Failed to load plugin ${pluginName}: ${error.message}`, error);
                }
            }

            dispatch(previewSlice.actions.setInitializationStatus('ready'));
            logger.info('PREVIEW_INIT', 'SUCCESS', 'Preview system initialized successfully.');

            return { renderer, pluginManager };
        } catch (error) {
            logger.error('PREVIEW_INIT', 'FAILED', `Preview system initialization failed: ${error.message}`, error);
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

// Note: The final log message is removed as it would execute on module load
// and cause the same error. Logging for slice creation should be done
// from the part of the code that imports and uses the slice. 