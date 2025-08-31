(function(global) {
    // Ensure verifyStatePersistence is available
    const verifyStatePersistence = global.APP?.verifyStatePersistence || 
        (typeof require !== 'undefined' ? require('./verify-state-persistence.js').verifyStatePersistence : null);

    // Verify auth slice persistence
    function verifyAuthPersistence() {
        if (!verifyStatePersistence) {
            console.error('verifyStatePersistence function not available');
            return {
                success: false,
                error: 'Generic verification function not found'
            };
        }

        return verifyStatePersistence({
            sliceName: 'auth',
            storageKey: 'auth_state',
            relevantFields: [
                'isAuthenticated', 
                'user', 
                'token', 
                'tokenExpiresAt', 
                'isLoading', 
                'error', 
                'authChecked'
            ],
            modifyState: (store) => {
                // Example modification - simulate a token update
                const currentState = store.getState().auth;
                return {
                    type: 'auth/setToken',
                    payload: {
                        token: currentState.token ? null : 'test_token_' + Date.now(),
                        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
                    }
                };
            }
        });
    }

    // Expose to global scope
    if (global.APP) {
        global.APP.verifyAuthPersistence = verifyAuthPersistence;
    }

    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { verifyAuthPersistence };
    }

    // Auto-run verification
    verifyAuthPersistence();
})(typeof window !== 'undefined' ? window : global);
