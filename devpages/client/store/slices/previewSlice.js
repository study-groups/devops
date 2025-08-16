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

const initialState = {
    htmlContent: '',
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
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
        // In the future, this will call the markdown rendering service
        // For now, it's a placeholder
        const html = `<p>${markdown}</p>`;
        dispatch({ type: RENDER_MARKDOWN_FULFILLED, payload: html });
    } catch (error) {
        dispatch({ type: RENDER_MARKDOWN_REJECTED, payload: error.message });
    }
};

export const initializePreviewSystem = () => (dispatch) => {
    // This is a placeholder for a more complex initialization process
    // that might involve loading plugins, setting up event listeners, etc.
    console.log('Preview system initialized');
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
            };
        default:
            return state;
    }
}; 