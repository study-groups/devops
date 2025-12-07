/**
 * previewSlice v2 - Enhanced Redux slice for preview system
 * Uses Redux Toolkit createAsyncThunk for proper async state management
 * Replaces manual action dispatching with proper thunk patterns
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { markdownRenderingService } from '/client/preview/MarkdownRenderingService.js';
import { pluginRegistry } from '/client/preview/PluginRegistry.js';
import { simpleHash } from '/client/preview/utils/markdownUtils.js';

const log = window.APP?.services?.log?.createLogger('previewSlice') || console;

/**
 * Async thunk for rendering markdown
 * Handles the full rendering pipeline with proper loading/error states
 */
export const renderMarkdown = createAsyncThunk(
    'preview/renderMarkdown',
    async ({ content, filePath }, { getState, rejectWithValue }) => {
        try {
            log.info?.('THUNK', 'RENDER_START', `Rendering: ${filePath}`);

            // Get enabled plugins from store
            const state = getState();
            const enabledPlugins = pluginRegistry.getEnabledPluginConfigs();

            // Get highlight function from highlight plugin if enabled
            let highlightFn = null;
            const highlightPlugin = pluginRegistry.getPlugin('highlight');
            if (highlightPlugin && typeof highlightPlugin.highlight === 'function') {
                highlightFn = (str, lang) => {
                    try {
                        return highlightPlugin.highlight(str, lang);
                    } catch (error) {
                        log.error?.('HIGHLIGHT', 'ERROR', `Highlight error: ${error.message}`, error);
                        return str;
                    }
                };
            }

            // Render markdown
            const result = await markdownRenderingService.render(content, filePath, {
                mode: 'preview',
                enabledPlugins,
                highlightFn
            });

            // Add content hash for cache invalidation
            const contentHash = simpleHash(content);

            log.info?.('THUNK', 'RENDER_SUCCESS', `Rendered: ${filePath}`);

            return {
                ...result,
                contentHash
            };

        } catch (error) {
            log.error?.('THUNK', 'RENDER_ERROR', `Render failed: ${error.message}`, error);
            return rejectWithValue({
                message: error.message,
                filePath
            });
        }
    },
    {
        // Condition: don't re-render if content hash hasn't changed
        condition: ({ content, filePath }, { getState }) => {
            const state = getState();
            const { lastRenderedPath, lastContentHash, status } = state.preview;

            // Allow if different file
            if (filePath !== lastRenderedPath) {
                return true;
            }

            // Allow if content changed
            const contentHash = simpleHash(content);
            if (contentHash !== lastContentHash) {
                return true;
            }

            // Don't render if already loading the same content
            if (status === 'loading') {
                log.info?.('THUNK', 'SKIP_LOADING', 'Already loading, skipping render');
                return false;
            }

            log.info?.('THUNK', 'SKIP_UNCHANGED', 'Content unchanged, skipping render');
            return false;
        }
    }
);

/**
 * Async thunk for post-processing rendered content
 * Handles plugin processing and script execution
 */
export const postProcessContent = createAsyncThunk(
    'preview/postProcess',
    async ({ container, renderResult }, { rejectWithValue }) => {
        try {
            log.info?.('THUNK', 'POST_PROCESS_START', `Post-processing: ${renderResult.filePath}`);

            await markdownRenderingService.postProcess(
                container,
                renderResult,
                {
                    processPlugins: (element) => pluginRegistry.processEnabledPlugins(element)
                }
            );

            log.info?.('THUNK', 'POST_PROCESS_SUCCESS', `Post-processed: ${renderResult.filePath}`);

            return {
                filePath: renderResult.filePath,
                timestamp: Date.now()
            };

        } catch (error) {
            log.error?.('THUNK', 'POST_PROCESS_ERROR', `Post-process failed: ${error.message}`, error);
            return rejectWithValue({
                message: error.message,
                filePath: renderResult.filePath
            });
        }
    }
);

/**
 * Async thunk for initializing preview system
 * Loads plugins and prepares rendering environment
 */
export const initializePreviewSystem = createAsyncThunk(
    'preview/initialize',
    async (_, { rejectWithValue }) => {
        try {
            log.info?.('THUNK', 'INIT_START', 'Initializing preview system');

            // Initialize all enabled plugins
            await pluginRegistry.initializeAllEnabled();

            log.info?.('THUNK', 'INIT_SUCCESS', 'Preview system initialized');

            return {
                initialized: true,
                timestamp: Date.now()
            };

        } catch (error) {
            log.error?.('THUNK', 'INIT_ERROR', `Initialization failed: ${error.message}`, error);
            return rejectWithValue({
                message: error.message
            });
        }
    }
);

/**
 * Initial state
 */
const initialState = {
    // Content
    htmlContent: '',
    frontMatter: null,
    scripts: null,
    styles: null,

    // State tracking
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    postProcessStatus: 'idle',
    error: null,
    postProcessError: null,

    // Initialization
    isInitialized: false,
    initializationError: null,

    // Cache/tracking
    lastRenderedPath: null,
    lastContentHash: null,
    lastRenderedAt: null,
    lastPostProcessedAt: null
};

/**
 * Preview slice
 */
const previewSlice = createSlice({
    name: 'preview',
    initialState,
    reducers: {
        // Manual HTML content setter (for backwards compatibility)
        setHtmlContent: (state, action) => {
            state.htmlContent = action.payload;
        },

        // Clear preview state
        clearPreview: (state) => {
            state.htmlContent = '';
            state.frontMatter = null;
            state.scripts = null;
            state.styles = null;
            state.status = 'idle';
            state.error = null;
            state.lastRenderedPath = null;
            state.lastContentHash = null;
        },

        // Clear cache (force re-render on next request)
        clearCache: (state) => {
            state.lastContentHash = null;
            state.lastRenderedAt = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // renderMarkdown lifecycle
            .addCase(renderMarkdown.pending, (state, action) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(renderMarkdown.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.htmlContent = action.payload.html;
                state.frontMatter = action.payload.frontMatter;
                state.scripts = action.payload.scripts;
                state.styles = action.payload.styles;
                state.lastRenderedPath = action.payload.filePath;
                state.lastContentHash = action.payload.contentHash;
                state.lastRenderedAt = Date.now();
                state.error = null;
            })
            .addCase(renderMarkdown.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload?.message || action.error.message;
            })

            // postProcessContent lifecycle
            .addCase(postProcessContent.pending, (state) => {
                state.postProcessStatus = 'loading';
                state.postProcessError = null;
            })
            .addCase(postProcessContent.fulfilled, (state, action) => {
                state.postProcessStatus = 'succeeded';
                state.lastPostProcessedAt = action.payload.timestamp;
                state.postProcessError = null;
            })
            .addCase(postProcessContent.rejected, (state, action) => {
                state.postProcessStatus = 'failed';
                state.postProcessError = action.payload?.message || action.error.message;
            })

            // initializePreviewSystem lifecycle
            .addCase(initializePreviewSystem.pending, (state) => {
                state.isInitialized = false;
                state.initializationError = null;
            })
            .addCase(initializePreviewSystem.fulfilled, (state) => {
                state.isInitialized = true;
                state.initializationError = null;
            })
            .addCase(initializePreviewSystem.rejected, (state, action) => {
                state.isInitialized = false;
                state.initializationError = action.payload?.message || action.error.message;
            });
    }
});

// Export actions
export const {
    setHtmlContent,
    clearPreview,
    clearCache
} = previewSlice.actions;

// Export reducer
export const previewReducer = previewSlice.reducer;

// Selectors
export const selectPreviewHtml = (state) => state.preview.htmlContent;
export const selectPreviewStatus = (state) => state.preview.status;
export const selectPreviewError = (state) => state.preview.error;
export const selectFrontMatter = (state) => state.preview.frontMatter;
export const selectScripts = (state) => state.preview.scripts;
export const selectStyles = (state) => state.preview.styles;
export const selectIsInitialized = (state) => state.preview.isInitialized;
export const selectLastRenderedPath = (state) => state.preview.lastRenderedPath;

// Memoized selectors
export const selectIsLoading = createSelector(
    [selectPreviewStatus],
    (status) => status === 'loading'
);

export const selectIsReady = createSelector(
    [selectIsInitialized, selectPreviewStatus],
    (isInitialized, status) => isInitialized && status !== 'loading'
);

export const selectRenderResult = createSelector(
    [selectPreviewHtml, selectFrontMatter, selectScripts, selectStyles, selectLastRenderedPath],
    (html, frontMatter, scripts, styles, filePath) => ({
        html,
        frontMatter,
        scripts,
        styles,
        filePath,
        mode: 'preview'
    })
);

export default previewSlice.reducer;
