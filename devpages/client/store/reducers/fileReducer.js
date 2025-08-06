// client/store/reducers/fileReducer.js

// --- Action Types ---
const LOAD_FILE_PENDING = 'file/loadFile/pending';
const LOAD_FILE_SUCCESS = 'file/loadFile/fulfilled';
const LOAD_FILE_FAILURE = 'file/loadFile/rejected';
const CLEAR_FILE = 'file/clearFile';
const UPDATE_FILE_CONTENT = 'file/updateContent';

// --- Initial State ---
const initialState = {
    currentFile: {
        pathname: null,
        content: '',
        originalContent: '', // Keep track of the original content to check for dirtiness
        isDirty: false,
        lastModified: null
    },
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null
};

const SAVE_FILE_PENDING = 'file/saveFile/pending';

// --- Action Creators ---
export const fileActions = {
    saveFilePending: () => ({
        type: SAVE_FILE_PENDING
    }),
    loadFilePending: (pathname) => ({ 
        type: LOAD_FILE_PENDING, 
        payload: { pathname } 
    }),
    loadFileSuccess: (data) => ({ 
        type: LOAD_FILE_SUCCESS, 
        payload: data 
    }),
    loadFileFailure: (error) => ({ 
        type: LOAD_FILE_FAILURE, 
        payload: error 
    }),
    clearFile: () => ({ 
        type: CLEAR_FILE 
    }),
    updateFileContent: (content) => ({
        type: UPDATE_FILE_CONTENT,
        payload: { content }
    })
};

// --- Reducer ---
export const fileReducer = (state = initialState, action) => {
    switch (action.type) {
        case LOAD_FILE_PENDING:
            return {
                ...state,
                status: 'loading',
                error: null,
                currentFile: {
                    ...initialState.currentFile, // Reset file state on new load
                    pathname: action.payload.pathname
                }
            };
        case LOAD_FILE_SUCCESS:
            const { pathname, content } = action.payload;
            return {
                ...state,
                status: 'succeeded',
                currentFile: {
                    pathname,
                    content,
                    originalContent: content, // Set original content on successful load
                    isDirty: false,
                    lastModified: new Date().toISOString()
                },
                error: null
            };
        case LOAD_FILE_FAILURE:
            return {
                ...state,
                status: 'failed',
                error: action.payload,
                currentFile: {
                    ...initialState.currentFile // Reset on failure
                }
            };
        case CLEAR_FILE:
            return {
                ...initialState
            };
        case UPDATE_FILE_CONTENT:
            if (state.currentFile.pathname) {
                const newContent = action.payload.content;
                return {
                    ...state,
                    currentFile: {
                        ...state.currentFile,
                        content: newContent,
                        isDirty: newContent !== state.currentFile.originalContent
                    }
                };
            }
            return state; // Do nothing if no file is loaded
        case SAVE_FILE_PENDING:
            return {
                ...state,
                status: 'saving'
            };
        default:
            return state;
    }
};
