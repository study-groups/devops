/**
 * System Slice - Central coordination of application initialization
 * Tracks component readiness and prevents premature rendering
 */

import { createSlice } from '@reduxjs/toolkit';

// --- Initial State ---
const initialState = {
    // Overall system phase
    phase: 'initializing', // 'initializing' | 'ready' | 'error'
    
    // Individual component readiness tracking
    dependencies: {
        auth: { 
            ready: false, 
            loading: false, 
            error: null,
            required: true 
        },
        fileSystem: { 
            ready: false, 
            loading: false, 
            error: null,
            required: true 
        },
        panels: { 
            ready: false, 
            loading: false, 
            error: null,
            required: true 
        },
        ui: { 
            ready: false, 
            loading: false, 
            error: null,
            required: false 
        }
    },
    
    // Prevent component render thrashing
    renderBlocked: true,
    
    // Initialization metadata
    startTime: null,
    readyTime: null,
    retryCount: 0,
    maxRetries: 3
};

// --- Slice Definition ---
const systemSlice = createSlice({
    name: 'system',
    initialState,
    reducers: {
        startInitialization: (state) => {
            state.phase = 'initializing';
            state.startTime = Date.now();
            state.renderBlocked = true;
            state.retryCount = 0;
        },
        
        setComponentLoading: (state, action) => {
            const { component } = action.payload;
            if (state.dependencies[component]) {
                state.dependencies[component].loading = true;
                state.dependencies[component].error = null;
            }
        },
        
        setComponentReady: (state, action) => {
            const { component } = action.payload;
            if (state.dependencies[component]) {
                state.dependencies[component].ready = true;
                state.dependencies[component].loading = false;
                state.dependencies[component].error = null;
                
                // Check if all required components are ready
                const allRequired = Object.entries(state.dependencies)
                    .filter(([_, dep]) => dep.required)
                    .every(([_, dep]) => dep.ready);
                    
                if (allRequired && state.phase === 'initializing') {
                    state.phase = 'ready';
                    state.readyTime = Date.now();
                    state.renderBlocked = false;
                }
            }
        },
        
        setComponentError: (state, action) => {
            const { component, error } = action.payload;
            if (state.dependencies[component]) {
                state.dependencies[component].loading = false;
                state.dependencies[component].error = error;
                
                // If it's a required component and we've exceeded retries
                const shouldError = state.dependencies[component].required && state.retryCount >= state.maxRetries;
                
                if (shouldError) {
                    state.phase = 'error';
                    state.renderBlocked = false;
                }
            }
        },
        
        retryComponent: (state, action) => {
            const { component } = action.payload;
            if (state.retryCount < state.maxRetries && state.dependencies[component]) {
                state.retryCount = state.retryCount + 1;
                state.dependencies[component].error = null;
                state.dependencies[component].loading = true;
            }
        },
        
        allowRender: (state) => {
            state.renderBlocked = false;
        },
        
        blockRender: (state) => {
            state.renderBlocked = true;
        }
    }
});

// --- Action Creators ---
export const {
    startInitialization,
    setComponentLoading,
    setComponentReady,
    setComponentError,
    retryComponent,
    allowRender,
    blockRender
} = systemSlice.actions;

// --- Selectors ---
export const selectSystemPhase = (state) => state.system?.phase || 'initializing';
export const selectIsSystemReady = (state) => state.system?.phase === 'ready';
export const selectRenderBlocked = (state) => state.system?.renderBlocked ?? true;
export const selectComponentStatus = (component) => (state) => 
    state.system?.dependencies?.[component] || { ready: false, loading: false, error: null };

// --- Thunks ---
export const initializeComponent = (componentName) => async (dispatch, getState) => {
    dispatch(setComponentLoading({ component: componentName }));
    
    try {
        // This will be called by individual component initializers
        // They should call setComponentReady when done
        console.log(`[SystemSlice] Starting initialization of ${componentName}`);
    } catch (error) {
        console.error(`[SystemSlice] Failed to initialize ${componentName}:`, error);
        dispatch(setComponentError({ component: componentName, error: error.message }));
    }
};

export default systemSlice.reducer;

console.log('[SystemSlice] ✅ System coordination slice ready');