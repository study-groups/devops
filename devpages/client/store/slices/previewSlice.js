/**
 * @file previewSlice.js
 * @description Redux slice for managing the state of the preview system.
 * This slice handles the initialization of the preview, manages plugins,
 * and tracks the overall state of the preview panel.
 */

// Action Types
const SET_HTML_CONTENT = 'preview/setHtmlContent';
const RENDER_MARKDOWN_PENDING = 'preview/renderMarkdown/pending';
const RENDER_MARKDOWN_FULFILLED = 'preview/renderMarkdown/fulfilled';
const RENDER_MARKDOWN_REJECTED = 'preview/renderMarkdown/rejected';
const CLEAR_CACHE = 'preview/clearCache';
const INITIALIZE_PREVIEW = 'preview/initialize';

const initialState = {
    htmlContent: '',
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    isInitialized: false,
    currentContent: null,
    frontMatter: null,
};

// Action Creators
export const setHtmlContent = (htmlContent) => ({
    type: SET_HTML_CONTENT,
    payload: htmlContent,
});

export const clearCache = () => ({
    type: CLEAR_CACHE,
});

// Thunks
export const renderMarkdown = (markdown) => async (dispatch) => {
    dispatch({ type: RENDER_MARKDOWN_PENDING });
    try {
        // Import the actual renderer to avoid circular dependencies
        const { renderMarkdown: actualRenderer } = await import('/client/preview/renderer.js');
        const result = await actualRenderer(markdown);
        dispatch({ type: RENDER_MARKDOWN_FULFILLED, payload: result.html });
        return result;
    } catch (error) {
        dispatch({ type: RENDER_MARKDOWN_REJECTED, payload: error.message });
        throw error;
    }
};

export const initializePreviewSystem = (config = {}) => (dispatch) => {
    try {
        // Initialize the preview system with proper configuration
        console.log('Preview system initializing with config:', config);
        
        // Set initial state
        dispatch({ type: 'preview/initialize', payload: { status: 'initialized' } });
        
        return true;
    } catch (error) {
        console.error('Preview system initialization failed:', error);
        dispatch({ type: RENDER_MARKDOWN_REJECTED, payload: error.message });
        return false;
    }
};


// Reducer
export const previewReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_HTML_CONTENT:
            return {
                ...state,
                htmlContent: action.payload,
            };
        case RENDER_MARKDOWN_PENDING:
            return {
                ...state,
                status: 'loading',
            };
        case RENDER_MARKDOWN_FULFILLED:
            return {
                ...state,
                status: 'succeeded',
                htmlContent: action.payload,
            };
        case RENDER_MARKDOWN_REJECTED:
            return {
                ...state,
                status: 'failed',
                error: action.payload,
            };
        case CLEAR_CACHE:
            return {
                ...state,
                htmlContent: '',
                status: 'idle',
                error: null,
                currentContent: null,
                frontMatter: null,
            };
        case INITIALIZE_PREVIEW:
            return {
                ...state,
                isInitialized: true,
                status: 'idle',
                error: null,
            };
        default:
            return state;
    }
}; 