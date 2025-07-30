/**
 * Redux System Bootloader - Orchestration Layer
 * 
 * This bootloader follows a phase-based pattern for clarity and maintainability.
 * It initializes systems in a strict, ordered sequence.
 * 
 * Phases:
 * 1. Pre-Initialization: Setup environment, global config, logging.
 * 2. Core Initialization: Create core services (e.g., Redux store).
 * 3. Secondary Initialization: Initialize features that depend on core services.
 * 4. Finalization: Signal readiness, hide splash screen, etc.
 */

import { createStore, combineReducers, applyMiddleware, compose } from '/node_modules/redux/dist/redux.browser.mjs';
import { logMessage } from './log/index.js';

const log = (message, level = 'info') => logMessage(`[REDUX-BOOT] ${message}`, level, 'REDUX');

// =============================================================================
// INITIALIZATION PHASES
// =============================================================================

/**
 * Phase 1: Pre-Initialization
 * Sets up the global environment, logging, and application shell.
 */
async function bootPreInit() {
    log('🚀 Phase 1: Pre-Initialization');
    
    // Initialize window.APP if it doesn't exist
    window.APP = window.APP || {};
    window.APP.services = window.APP.services || {};

    // Set up bootloader interface on APP for compatibility
    window.APP.bootloader = {
        start: async () => {
            log('[REDUX-BOOT] Starting via APP.bootloader.start()...');
            return initializeReduxSystem();
        },
        instance: null,
        isReady: () => !!systemAPIs,
        type: 'redux'
    };
    
    // Also expose as ReduxBootloader for backward compatibility
    window.ReduxBootloader = window.APP.bootloader;

    // Create the container for the AuthDisplay component
    if (!document.getElementById('auth-component-container')) {
        const authContainer = document.createElement('div');
        authContainer.id = 'auth-component-container';
        authContainer.style.position = 'fixed';
        authContainer.style.top = '10px';
        authContainer.style.right = '10px';
        authContainer.style.zIndex = '10000';
        document.body.appendChild(authContainer);
        log('🌍 Created auth display container');
    }
    
    // Set up event bus if available
    if (typeof window.EventBus !== 'undefined') {
        window.APP.eventBus = window.EventBus;
        window.APP.services.eventBus = window.EventBus;
        log('🌍 EventBus attached to APP');
    } else {
        // Create a simple event bus if none exists
        window.APP.eventBus = { on: () => {}, emit: () => {}, off: () => {} };
        log('🌍 Simple EventBus placeholder created');
    }
}

/**
 * Phase 2: Core Initialization
 * Creates the Redux store and other essential services.
 */
async function bootCore() {
    log('📦 Phase 2: Core Initialization - Creating Redux store...');

    // Import Redux modules
        const authModule = await import('./slices/authSlice.js');
        const pathModule = await import('./slices/pathSlice.js');
        const settingsModule = await import('./slices/settingsSlice.js');
        const panelModule = await import('./slices/panelSlice.js');
        
        // Combine reducers
        const rootReducer = combineReducers({
            auth: authModule.default,
            path: pathModule.default,
            settings: settingsModule.default,
            panels: panelModule.default
        });
        
        // Simple thunk middleware for async actions
        const thunkMiddleware = (store) => (next) => (action) => {
            if (typeof action === 'function') {
                return action(store.dispatch, store.getState);
            }
            return next(action);
        };

        // Import persistence middleware
        const { persistenceMiddleware } = await import('./middleware/persistenceMiddleware.js');

        // Load initial settings from localStorage
        let preloadedState = {};
        try {
            const savedSettings = localStorage.getItem('devpages-settings');
            if (savedSettings) {
                preloadedState.settings = JSON.parse(savedSettings);
            log('📦 Loaded saved settings from localStorage');
            }
        } catch (error) {
        log('⚠️ Failed to load saved settings, using defaults', 'warn');
        }

        // Create store with Redux DevTools support
        const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
        const store = createStore(
            rootReducer,
            preloadedState,
            composeEnhancers(applyMiddleware(thunkMiddleware, persistenceMiddleware))
        );
        
        // Load initial settings if not already loaded
        if (!preloadedState.settings) {
            try {
                store.dispatch(settingsModule.settingsThunks.loadFromStorage());
            log('📦 Loaded initial settings via thunk');
        } catch (error) {
            log('⚠️ Failed to load settings via thunk, using defaults', 'warn');
        }
    }
    
    // Set up settings persistence
    try {
            store.subscribe(() => {
            const settings = store.getState().settings;
                setTimeout(() => {
                    try {
                        localStorage.setItem('devpages-settings', JSON.stringify(settings));
                    } catch (error) {
                        console.warn('Failed to save settings:', error);
                    }
                }, 100);
            });
        log('✅ Settings persistence configured');
        } catch (error) {
        log(`⚠️ Settings persistence setup failed: ${error.message}`, 'warn');
    }

    const actions = { auth: authModule, path: pathModule, settings: settingsModule, panels: panelModule };
    
    // Expose store globally
    window.APP.store = store;
    window.APP.services.store = store;
    window.APP.redux = { store, actions, dispatch: store.dispatch, getState: store.getState };
    window.reduxStore = store;
    log('🌍 Store exposed globally on window.APP');
    
    log('✅ Redux store created and tested');
    return { store, actions };
}

/**
 * Phase 3: Secondary Initialization
 * Initializes systems that depend on the core services.
 * @param {{ store: object, actions: object }} coreAPIs - The core APIs from the previous phase.
 */
async function bootSecondary({ store, actions }) {
    log('🔧 Phase 3: Secondary Initialization');
    
    let authAPI, panelAPI, appDispatchAPI;
    
    // Initialize Auth System (optional)
    try {
        log('🔐 Initializing authentication system...');
        const { authThunks } = actions.auth;
        await store.dispatch(authThunks.checkAuth());
        const authState = store.getState().auth;
        if (authState.isAuthenticated) {
            log(`✅ User authenticated: ${authState.user?.username}`);
        } else {
            log('ℹ️ User not authenticated');
        }
        authAPI = { checkAuth: () => store.dispatch(authThunks.checkAuth()) };
    } catch (error) {
        log(`⚠️ Auth system initialization failed: ${error.message}`, 'warn');
        console.error('Auth system error details:', error);
        }

    // Initialize Panel System (optional)
    try {
        log('🎛️ Initializing panel system...');
        const { initializePanelSystem, setupAuthListener } = await import('./panels.js');
        panelAPI = await initializePanelSystem(store);
        
        // Set up authentication listener for panel lifecycle
        setupAuthListener(store);
        
        log('✅ Redux Panel System ready - Login required for debug panels');
        log('🔑 Press Ctrl+Shift+D for Debug Dock (authenticated users only)');
        log('🗑️ Legacy debug panel system completely removed - fully Redux-native now');
    } catch (error) {
        log(`⚠️ Panel system initialization failed: ${error.message}`, 'warn');
        console.error('Panel system error details:', error);
    }
    
    // Initialize AppDispatch Compatibility Layer (required)
    log('🔗 Setting up appDispatch compatibility layer...');
    const appDispatch = (action) => {
        if (typeof action === 'function') {
            return action(store.dispatch, store.getState);
        }
        return store.dispatch(action);
    };
    window.appDispatch = appDispatch;
    appDispatchAPI = { appDispatch };
    
    return { authAPI, panelAPI, appDispatchAPI };
}

/**
 * Phase 4: Finalization
 * Completes the boot process, hides splash screens, and signals readiness.
 */
async function bootFinalize() {
    log('🎯 Phase 4: Finalization');
        
        // Hide splash screen
        try {
            const splashElement = document.getElementById('devpages-splash');
            if (splashElement) {
                splashElement.style.display = 'none';
            log('🎭 Splash screen hidden');
            }
            document.body.classList.remove('splash-active');
            
            // Emit ready events
            window.dispatchEvent(new CustomEvent('redux-bootloader-ready'));
            window.dispatchEvent(new CustomEvent('bootloader-system-ready', {
                detail: { system: 'redux' }
            }));
            
        } catch (error) {
        log(`⚠️ Failed to hide splash screen: ${error.message}`, 'warn');
        }
    
    log('🎉 Redux system ready for use');
    }


// =============================================================================
// SYSTEM ORCHESTRATION
// =============================================================================

let systemAPIs = null;
let initializationPromise = null;

/**
 * Main entry point for the Redux bootloader.
 * Orchestrates the initialization phases.
 */
async function initializeReduxSystem() {
    // If already initializing, return the existing promise
    if (initializationPromise) {
        return initializationPromise;
    }
    
    // If already initialized, return the APIs
    if (systemAPIs) {
        return systemAPIs;
    }
    
    // Start initialization
    initializationPromise = (async () => {
        try {
            await bootPreInit();
            const coreAPIs = await bootCore();
            const secondaryAPIs = await bootSecondary(coreAPIs);
            
            systemAPIs = {
                store: coreAPIs.store,
                panelAPI: secondaryAPIs.panelAPI,
                appDispatch: secondaryAPIs.appDispatchAPI?.appDispatch,
                isReady: () => true,
                getSystems: () => ['store', 'panelAPI', 'appDispatch'].filter(key => !!systemAPIs[key]),
                getStore: () => coreAPIs.store,
            };
            
            await bootFinalize();
            
            if (window.APP?.bootloader) {
                window.APP.bootloader.instance = { getSystemAPIs: () => systemAPIs };
            }
            
            log('✅ Redux system initialization completed successfully');
            return systemAPIs;
            
        } catch (error) {
            log(`💥 Critical initialization failure: ${error.message}`, 'error');
            console.error('[REDUX-BOOT] Full initialization error:', error);
            // Re-throw to allow for top-level handling
            throw error;
        }
    })();
    
    return initializationPromise;
}

// Export the initialization function
export { initializeReduxSystem };

// Export accessors for convenience
export function getStore() {
    return systemAPIs?.store;
}

export function getSystemAPIs() {
    return systemAPIs;
}

// Auto-start when imported
export const autoStart = initializeReduxSystem().then(apis => {
    console.log('[REDUX-BOOT] Auto-start completed, bootloader ready on APP.bootloader');
    return apis;
}); 