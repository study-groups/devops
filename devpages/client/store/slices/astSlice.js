/**
 * astSlice.js - Redux slice for AST parsing and code intelligence
 * Uses Redux Toolkit createAsyncThunk for async API calls to server-side tree-sitter
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

/**
 * Async thunk for parsing JavaScript code
 * Calls server-side tree-sitter parser via /api/ast/parse
 */
export const parseJavaScript = createAsyncThunk(
    'ast/parseJavaScript',
    async ({ code, filePath }, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/ast/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ code, filePath })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Parse failed: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Parse failed');
            }

            return {
                ...result,
                filePath
            };

        } catch (error) {
            console.error('[astSlice] Parse error:', error);
            return rejectWithValue({
                message: error.message,
                filePath
            });
        }
    },
    {
        // Skip parsing if already parsing the same file
        condition: ({ code, filePath }, { getState }) => {
            const { ast } = getState();

            // Don't re-parse if we're already loading
            if (ast.status === 'loading' && ast.lastParsedPath === filePath) {
                return false;
            }

            // Don't re-parse if content hash matches
            if (ast.lastParsedPath === filePath && ast.lastHash) {
                // Simple hash comparison - server will return same hash for same content
                return true; // Let server handle caching
            }

            return true;
        }
    }
);

/**
 * Initial state
 */
const initialState = {
    // Parsed data
    outline: null,          // { functions: [], classes: [], variables: [], imports: [] }
    dependencies: [],       // [{ source, external, loc }]
    exports: [],           // [{ type, name, kind }]
    errors: [],            // Syntax errors found

    // Stats
    stats: null,           // { nodeCount, functionCount, classCount, importCount }
    parseTime: null,

    // State tracking
    status: 'idle',        // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,

    // Cache tracking
    lastParsedPath: null,
    lastHash: null,
    lastParsedAt: null
};

/**
 * AST slice
 */
const astSlice = createSlice({
    name: 'ast',
    initialState,
    reducers: {
        /**
         * Clear AST state (e.g., when switching to non-JS file)
         */
        clearAst: (state) => {
            state.outline = null;
            state.dependencies = [];
            state.exports = [];
            state.errors = [];
            state.stats = null;
            state.parseTime = null;
            state.status = 'idle';
            state.error = null;
            state.lastParsedPath = null;
            state.lastHash = null;
            state.lastParsedAt = null;
        },

        /**
         * Reset error state
         */
        clearError: (state) => {
            state.error = null;
            if (state.status === 'failed') {
                state.status = 'idle';
            }
        }
    },
    extraReducers: (builder) => {
        builder
            // parseJavaScript pending
            .addCase(parseJavaScript.pending, (state, action) => {
                state.status = 'loading';
                state.error = null;
                state.lastParsedPath = action.meta.arg.filePath;
            })

            // parseJavaScript fulfilled
            .addCase(parseJavaScript.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.outline = action.payload.outline;
                state.dependencies = action.payload.dependencies;
                state.exports = action.payload.exports;
                state.errors = action.payload.errors;
                state.stats = action.payload.stats;
                state.parseTime = action.payload.parseTime;
                state.lastHash = action.payload.hash;
                state.lastParsedPath = action.payload.filePath;
                state.lastParsedAt = Date.now();
            })

            // parseJavaScript rejected
            .addCase(parseJavaScript.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.payload?.message || action.error?.message || 'Parse failed';
                state.outline = null;
                state.dependencies = [];
                state.exports = [];
                state.errors = [];
                state.stats = null;
            });
    }
});

// Export actions
export const { clearAst, clearError } = astSlice.actions;

// Export reducer
export const astReducer = astSlice.reducer;
export default astSlice.reducer;

// Selectors
export const selectAstOutline = (state) => state.ast?.outline;
export const selectAstStatus = (state) => state.ast?.status;
export const selectAstError = (state) => state.ast?.error;
export const selectAstFunctions = (state) => state.ast?.outline?.functions || [];
export const selectAstClasses = (state) => state.ast?.outline?.classes || [];
export const selectAstImports = (state) => state.ast?.outline?.imports || [];
export const selectAstDependencies = (state) => state.ast?.dependencies || [];
export const selectAstExports = (state) => state.ast?.exports || [];
export const selectAstStats = (state) => state.ast?.stats;
