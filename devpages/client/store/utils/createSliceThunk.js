/**
 * createSliceThunk.js - Standardized thunk factory for Redux slices
 *
 * Provides consistent patterns for async operations across all slices:
 * - Automatic action type prefixing
 * - Standard pending/fulfilled/rejected states
 * - Error handling and logging
 * - Integration with RTK's createAsyncThunk
 */

import { createAsyncThunk } from '/node_modules/@reduxjs/toolkit/dist/redux-toolkit.browser.mjs';

/**
 * Create a single async thunk with standardized error handling
 *
 * @param {string} sliceName - Name of the slice (e.g., 'path', 'file')
 * @param {string} actionName - Name of the action (e.g., 'fetchDirectory', 'saveFile')
 * @param {Function} asyncFn - Async function: (args, thunkAPI) => Promise<result>
 * @param {Object} options - Additional createAsyncThunk options
 * @returns {AsyncThunk} RTK async thunk
 *
 * @example
 * const fetchUser = createSliceThunk('users', 'fetchUser', async (userId, { rejectWithValue }) => {
 *   try {
 *     const response = await fetch(`/api/users/${userId}`);
 *     if (!response.ok) throw new Error('Failed to fetch user');
 *     return response.json();
 *   } catch (error) {
 *     return rejectWithValue(error.message);
 *   }
 * });
 */
export function createSliceThunk(sliceName, actionName, asyncFn, options = {}) {
    const typePrefix = `${sliceName}/${actionName}`;

    return createAsyncThunk(
        typePrefix,
        async (args, thunkAPI) => {
            try {
                return await asyncFn(args, thunkAPI);
            } catch (error) {
                console.error(`[${typePrefix}] Error:`, error);
                return thunkAPI.rejectWithValue({
                    message: error.message || 'Unknown error',
                    code: error.code,
                    stack: error.stack
                });
            }
        },
        options
    );
}

/**
 * Create multiple thunks for a slice at once
 *
 * @param {string} sliceName - Name of the slice
 * @param {Object} thunkDefs - Object mapping action names to async functions
 * @returns {Object} Object mapping action names to async thunks
 *
 * @example
 * const userThunks = createSliceThunks('users', {
 *   fetchUser: async (userId, { rejectWithValue }) => {
 *     const response = await fetch(`/api/users/${userId}`);
 *     return response.json();
 *   },
 *   updateUser: async ({ id, data }, { rejectWithValue }) => {
 *     const response = await fetch(`/api/users/${id}`, {
 *       method: 'PUT',
 *       body: JSON.stringify(data)
 *     });
 *     return response.json();
 *   }
 * });
 *
 * // Use in slice extraReducers:
 * extraReducers: (builder) => {
 *   addThunkReducers(builder, userThunks.fetchUser, {
 *     onPending: (state) => { state.loading = true; },
 *     onFulfilled: (state, action) => { state.user = action.payload; },
 *     onRejected: (state, action) => { state.error = action.payload; }
 *   });
 * }
 */
export function createSliceThunks(sliceName, thunkDefs) {
    const thunks = {};

    for (const [actionName, asyncFn] of Object.entries(thunkDefs)) {
        if (typeof asyncFn !== 'function') {
            console.warn(`[createSliceThunks] Skipping ${actionName}: not a function`);
            continue;
        }
        thunks[actionName] = createSliceThunk(sliceName, actionName, asyncFn);
    }

    return thunks;
}

/**
 * Add standard thunk reducers (pending/fulfilled/rejected) to a builder
 *
 * @param {ActionReducerMapBuilder} builder - RTK builder from extraReducers
 * @param {AsyncThunk} thunk - The async thunk
 * @param {Object} handlers - Handler functions
 * @param {Function} handlers.onPending - (state, action) => void
 * @param {Function} handlers.onFulfilled - (state, action) => void
 * @param {Function} handlers.onRejected - (state, action) => void
 *
 * @example
 * extraReducers: (builder) => {
 *   addThunkReducers(builder, fetchUserThunk, {
 *     onPending: (state) => {
 *       state.status = 'loading';
 *       state.error = null;
 *     },
 *     onFulfilled: (state, action) => {
 *       state.status = 'succeeded';
 *       state.data = action.payload;
 *     },
 *     onRejected: (state, action) => {
 *       state.status = 'failed';
 *       state.error = action.payload?.message || 'Unknown error';
 *     }
 *   });
 * }
 */
export function addThunkReducers(builder, thunk, handlers = {}) {
    const { onPending, onFulfilled, onRejected } = handlers;

    if (onPending) {
        builder.addCase(thunk.pending, onPending);
    }
    if (onFulfilled) {
        builder.addCase(thunk.fulfilled, onFulfilled);
    }
    if (onRejected) {
        builder.addCase(thunk.rejected, onRejected);
    }

    return builder;
}

/**
 * Standard loading state handlers for common patterns
 */
export const standardHandlers = {
    /**
     * Standard loading state pattern
     * Sets status to 'loading' and clears error on pending
     */
    loading: (statusKey = 'status', errorKey = 'error') => ({
        onPending: (state) => {
            state[statusKey] = 'loading';
            state[errorKey] = null;
        },
        onFulfilled: (state) => {
            state[statusKey] = 'succeeded';
        },
        onRejected: (state, action) => {
            state[statusKey] = 'failed';
            state[errorKey] = action.payload?.message || action.error?.message || 'Unknown error';
        }
    }),

    /**
     * Standard data fetch pattern
     * Like loading but also stores fetched data
     */
    fetch: (dataKey, statusKey = 'status', errorKey = 'error') => ({
        onPending: (state) => {
            state[statusKey] = 'loading';
            state[errorKey] = null;
        },
        onFulfilled: (state, action) => {
            state[statusKey] = 'succeeded';
            state[dataKey] = action.payload;
        },
        onRejected: (state, action) => {
            state[statusKey] = 'failed';
            state[errorKey] = action.payload?.message || action.error?.message || 'Unknown error';
        }
    })
};
