/**
 * Terrain Auth Module
 * Authentication service with route guards
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'terrain-auth-token';

    let state = {
        isAuthenticated: false,
        user: null,
        isAdmin: false
    };

    const subscribers = new Set();

    const TerrainAuth = {
        /**
         * Initialize auth service
         */
        init: function() {
            const token = this.getToken();
            if (token) {
                this.validateToken(token).catch(function() {
                    TerrainAuth.clearToken();
                });
            }

            if (window.Terrain && window.Terrain.Events) {
                Terrain.Events.emit('AUTH_INIT', state);
            }

            console.log('[Terrain.Auth] Initialized, authenticated:', state.isAuthenticated);
        },

        /**
         * Get stored token
         */
        getToken: function() {
            try {
                return localStorage.getItem(STORAGE_KEY);
            } catch (e) {
                return null;
            }
        },

        /**
         * Store token
         */
        setToken: function(token) {
            try {
                localStorage.setItem(STORAGE_KEY, token);
            } catch (e) {
                console.warn('[Terrain.Auth] Could not store token:', e);
            }
        },

        /**
         * Clear token and reset state
         */
        clearToken: function() {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) {
                // Ignore
            }
            state = { isAuthenticated: false, user: null, isAdmin: false };
            notify();
        },

        /**
         * Validate token (stub - implement API call)
         */
        validateToken: function(token) {
            return new Promise(function(resolve, reject) {
                // Stub implementation
                // In production: POST to /api/auth/validate
                if (token && token.length > 0) {
                    state.isAuthenticated = true;
                    state.user = { id: 'user', name: 'Player' };
                    state.isAdmin = token.includes('admin');
                    notify();
                    resolve(true);
                } else {
                    reject(new Error('Invalid token'));
                }
            });
        },

        /**
         * Login with credentials
         */
        login: function(credentials) {
            var self = this;
            return new Promise(function(resolve) {
                // Stub implementation
                // In production: POST to /api/auth/login
                console.log('[Terrain.Auth] Login:', credentials);

                var token = 'token-' + Date.now();
                if (credentials && credentials.admin) {
                    token = 'admin-' + token;
                }

                self.setToken(token);
                self.validateToken(token).then(function() {
                    resolve({ success: true, user: state.user });
                });
            });
        },

        /**
         * Logout
         */
        logout: function() {
            this.clearToken();

            if (window.Terrain && window.Terrain.Events) {
                Terrain.Events.emit('AUTH_LOGOUT');
            }

            return { success: true };
        },

        /**
         * Check if authenticated
         */
        check: function() {
            return state.isAuthenticated;
        },

        /**
         * Check if admin
         */
        isAdmin: function() {
            return state.isAdmin;
        },

        /**
         * Get current user
         */
        getUser: function() {
            return state.user ? Object.assign({}, state.user) : null;
        },

        /**
         * Subscribe to auth changes
         */
        subscribe: function(fn) {
            subscribers.add(fn);
            return function() {
                subscribers.delete(fn);
            };
        },

        /**
         * Route guard - check if route is accessible
         * @param {string} route - Current route path
         * @param {Object} modeConfig - Mode configuration with auth settings
         */
        guard: function(route, modeConfig) {
            var authConfig = (modeConfig && modeConfig.auth) || {};
            var protectedRoutes = authConfig.protectedRoutes || [];
            var adminRoutes = authConfig.adminRoutes || [];

            // Check admin routes first
            for (var i = 0; i < adminRoutes.length; i++) {
                if (route.indexOf(adminRoutes[i]) === 0) {
                    return state.isAdmin;
                }
            }

            // Check protected routes
            for (var j = 0; j < protectedRoutes.length; j++) {
                if (route.indexOf(protectedRoutes[j]) === 0) {
                    return state.isAuthenticated;
                }
            }

            // Public route
            return true;
        }
    };

    /**
     * Notify subscribers of state change
     */
    function notify() {
        var stateCopy = Object.assign({}, state);

        subscribers.forEach(function(fn) {
            fn(stateCopy);
        });

        if (window.Terrain && window.Terrain.Events) {
            Terrain.Events.emit('AUTH_CHANGE', stateCopy);
        }
    }

    // Export to Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Auth = TerrainAuth;
})();
