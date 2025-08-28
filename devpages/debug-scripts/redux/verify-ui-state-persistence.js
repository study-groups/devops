/**
 * UI State Persistence Verification Script
 * Tests localStorage saving and retrieval for UI slice
 */
(function(global) {
    function verifyUIStatePersistence() {
        // Detailed debugging of APP and store access
        console.group('%c[UI State Verification - Detailed Debug]', 'color: orange; font-weight: bold;');
        
        // Potential store locations
        const storePaths = [
            'APP.store',
            'APP.services.store',
            'APP.bootloader.instance.getSystemAPIs().store',
            'window.APP.store',
            'window.APP.services.store',
            'global.APP.store',
            'global.APP.services.store'
        ];

        let store = null;
        let uiActions = null;

        // Try multiple paths to find the store
        for (const path of storePaths) {
            try {
                const resolvedStore = path.split('.').reduce((obj, key) => obj && obj[key], global);
                if (resolvedStore && resolvedStore.getState) {
                    store = resolvedStore;
                    console.log(`Store found via path: ${path}`);
                    break;
                }
            } catch (err) {
                console.log(`Failed to access store via ${path}:`, err);
            }
        }

        // If store found, try to get UI actions
        if (store) {
            try {
                const state = store.getState();
                console.log('Current Redux state:', state);
                console.log('UI Slice in State:', state.ui);

                // Comprehensive debugging of potential action sources
                const actionSources = [
                    { 
                        path: 'global.APP.uiActions', 
                        getter: () => global.APP.uiActions 
                    },
                    { 
                        path: 'global.APP.store.uiSlice.actions', 
                        getter: () => global.APP.store.uiSlice.actions 
                    },
                    { 
                        path: 'global.APP.uiSlice.actions', 
                        getter: () => global.APP.uiSlice.actions 
                    },
                    {
                        path: 'Imported uiActions from uiSlice.js',
                        getter: () => {
                            const uiSlice = require('/client/store/uiSlice.js');
                            return uiSlice.uiActions;
                        }
                    }
                ];

                // Try to find UI actions
                for (const source of actionSources) {
                    try {
                        const actions = source.getter();
                        console.log(`Checking actions from ${source.path}:`, actions);
                        
                        if (actions && actions.updateSetting) {
                            uiActions = actions;
                            console.log(`UI Actions found via: ${source.path}`);
                            break;
                        }
                    } catch (actionErr) {
                        console.log(`Failed to get actions from ${source.path}:`, actionErr);
                    }
                }

                // Fallback: create manual action dispatcher
                if (!uiActions) {
                    console.log('Creating manual action dispatcher');
                    uiActions = {
                        updateSetting: (payload) => ({
                            type: 'ui/updateSetting',
                            payload
                        })
                    };
                }

                // Log available actions
                console.log('Available UI Actions:', Object.keys(uiActions || {}));
            } catch (stateError) {
                console.error('Error accessing store state:', stateError);
            }
        }

        // Detailed error if store or actions are not available
        if (!store || !uiActions) {
            console.error('[UI State Verification] Unable to access store or UI actions');
            console.log('Store available:', !!store);
            console.log('UI Actions available:', !!uiActions);
            
            // Dump all properties of APP for debugging
            console.log('All APP object properties:', Object.keys(global.APP || {}));
            
            console.groupEnd();
            
            return {
                success: false,
                error: 'Store or UI actions not available',
                debugInfo: {
                    storeAvailable: !!store,
                    uiActionsAvailable: !!uiActions,
                    appProperties: Object.keys(global.APP || {})
                }
            };
        }

        const results = {
            initialState: null,
            afterModification: null,
            localStorageContent: null,
            success: false,
            errors: []
        };

        try {
            // Capture initial state
            results.initialState = store.getState().ui;
            console.log('[UI State Verification] Initial State:', results.initialState);

            // Attempt to modify UI state
            store.dispatch(uiActions.updateSetting({ 
                key: 'theme', 
                value: results.initialState.theme === 'light' ? 'dark' : 'light' 
            }));

            // Capture state after modification
            results.afterModification = store.getState().ui;
            console.log('[UI State Verification] Modified State:', results.afterModification);

            // Retrieve from localStorage
            const storedUIState = global.localStorage.getItem('devpages_settings_ui');
            results.localStorageContent = storedUIState ? JSON.parse(storedUIState) : null;
            console.log('[UI State Verification] Stored UI State:', results.localStorageContent);

            // Verify state was saved
            if (results.localStorageContent) {
                // Compare payload with afterModification state
                const payload = results.localStorageContent.payload || results.localStorageContent;
                
                // Deep comparison of relevant fields
                const relevantFields = [
                    'theme', 'viewMode', 'logVisible', 'logHeight', 
                    'logMenuVisible', 'leftSidebarVisible', 'editorVisible', 
                    'previewVisible', 'contextManagerVisible', 'colorScheme', 
                    'designDensity', 'isAuthDropdownVisible'
                ];

                results.success = relevantFields.every(field => 
                    payload[field] === results.afterModification[field]
                );

                // Log detailed comparison
                console.group('%c[Persistence Verification]', 'color: blue; font-weight: bold;');
                relevantFields.forEach(field => {
                    console.log(`${field}:`, 
                        `Modified: ${results.afterModification[field]}`, 
                        `Stored: ${payload[field]}`, 
                        payload[field] === results.afterModification[field] ? '✅' : '❌'
                    );
                });
                console.groupEnd();
            }

            // Log detailed results
            console.log('Initial Theme:', results.initialState.theme);
            console.log('Modified Theme:', results.afterModification.theme);
            console.log('Stored Theme:', results.localStorageContent?.theme);
            console.log('Persistence Test:', results.success ? '✅ PASSED' : '❌ FAILED');
            console.groupEnd();

        } catch (error) {
            console.error('[UI State Verification] Test failed:', error);
            results.errors.push(error.message);
            results.success = false;
            console.groupEnd();
        }

        return results;
    }

    // Expose to global scope for easy testing
    if (global.APP) {
        global.APP.verifyUIStatePersistence = verifyUIStatePersistence;
    }

    // If this is being used as a module, also export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { verifyUIStatePersistence };
    }

    // Auto-run verification
    verifyUIStatePersistence();

})(typeof window !== 'undefined' ? window : global);
