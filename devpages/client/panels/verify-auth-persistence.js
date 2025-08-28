(function(global) {
    // Import the generic verification function
    const { verifyStatePersistence } = global.APP.verifyStatePersistence || {};

    // Verify auth slice persistence
    function verifyAuthPersistence() {
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

    // Auto-run verification
    verifyAuthPersistence();
})(typeof window !== 'undefined' ? window : global);
