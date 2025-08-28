(function(global) {
    /**
     * Generic State Persistence Verification
     * @param {Object} config Configuration for state verification
     * @param {string} config.sliceName Name of the Redux slice to verify
     * @param {string} config.storageKey Key used in localStorage
     * @param {string[]} config.relevantFields Fields to compare
     * @param {function} [config.modifyState] Optional function to modify state
     */
    function verifyStatePersistence(config) {
        // Validate config
        if (!config || !config.sliceName || !config.storageKey) {
            console.error('[State Verification] Invalid configuration');
            return {
                success: false,
                error: 'Invalid verification configuration'
            };
        }

        console.group(`%c[${config.sliceName} State Persistence Verification]`, 'color: orange; font-weight: bold;');
        
        // Find the store
        let store = null;
        const storePaths = [
            'APP.store',
            'APP.services.store',
            'window.APP.store',
            'global.APP.store'
        ];

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

        // Validate store
        if (!store) {
            console.error('[State Verification] Unable to find Redux store');
            console.groupEnd();
            return {
                success: false,
                error: 'Store not found'
            };
        }

        // Results object
        const results = {
            initialState: null,
            afterModification: null,
            localStorageContent: null,
            success: false,
            errors: []
        };

        try {
            // Get initial state
            const state = store.getState();
            const sliceState = state[config.sliceName];
            
            console.log('Initial State:', sliceState);
            results.initialState = sliceState;

            // Modify state if a modification function is provided
            if (config.modifyState) {
                const modificationResult = config.modifyState(store);
                
                // If modifyState returns a specific action, dispatch it
                if (modificationResult) {
                    store.dispatch(modificationResult);
                }
            }

            // Get modified state
            const modifiedState = store.getState()[config.sliceName];
            console.log('Modified State:', modifiedState);
            results.afterModification = modifiedState;

            // Retrieve from localStorage
            const storedStateRaw = global.localStorage.getItem(`devpages_${config.storageKey}`);
            const storedState = storedStateRaw ? JSON.parse(storedStateRaw) : null;
            console.log('Stored State:', storedState);
            results.localStorageContent = storedState;

            // Determine success
            if (storedState) {
                // Handle both wrapped and unwrapped storage formats
                const payload = storedState.payload || storedState;
                
                // Use provided relevant fields or default to all fields
                const fieldsToCompare = config.relevantFields || Object.keys(modifiedState);

                results.success = fieldsToCompare.every(field => 
                    payload[field] === modifiedState[field]
                );

                // Detailed field comparison
                console.group('%c[Persistence Verification]', 'color: blue; font-weight: bold;');
                fieldsToCompare.forEach(field => {
                    console.log(`${field}:`, 
                        `Modified: ${modifiedState[field]}`, 
                        `Stored: ${payload[field]}`, 
                        payload[field] === modifiedState[field] ? '✅' : '❌'
                    );
                });
                console.groupEnd();
            }

            console.groupEnd();
            return results;

        } catch (error) {
            console.error(`[${config.sliceName} State Verification] Test failed:`, error);
            results.errors.push(error.message);
            results.success = false;
            console.groupEnd();
            return results;
        }
    }

    // Expose to global scope for easy testing
    if (global.APP) {
        global.APP.verifyStatePersistence = verifyStatePersistence;
    }

    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { verifyStatePersistence };
    }
})(typeof window !== 'undefined' ? window : global);
