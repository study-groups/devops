/**
 * Terrain Router Module
 * Hash-based client-side routing for terrain apps
 */
(function() {
    'use strict';

    const routes = new Map();
    let currentRoute = null;
    let appContainer = null;
    let modeConfig = null;

    const TerrainRouter = {
        /**
         * Initialize router
         * @param {Object} config - Mode configuration with routes
         */
        init: function(config) {
            modeConfig = config || {};
            appContainer = document.getElementById('terrain-main') ||
                          document.getElementById('terrain-app');

            // Listen for hash changes
            window.addEventListener('hashchange', handleHashChange);

            // Handle initial route
            handleHashChange();

            console.log('[Terrain.Router] Initialized');
        },

        /**
         * Register a route
         * @param {string} path - Route path (supports :params)
         * @param {Function} handler - Route handler (returns HTML or {render, mount})
         */
        register: function(path, handler) {
            routes.set(path, {
                path,
                handler,
                pattern: pathToPattern(path)
            });
        },

        /**
         * Navigate to path programmatically
         * @param {string} path - Target path
         */
        navigate: function(path) {
            window.location.hash = path.startsWith('/') ? path : '/' + path;
        },

        /**
         * Go back in history
         */
        back: function() {
            window.history.back();
        },

        /**
         * Get current route info
         */
        current: function() {
            return currentRoute ? { ...currentRoute } : null;
        },

        /**
         * Get current path from hash
         */
        getPath: function() {
            const hash = window.location.hash.slice(1) || '/';
            return hash.startsWith('/') ? hash : '/' + hash;
        }
    };

    /**
     * Convert path to regex pattern
     */
    function pathToPattern(path) {
        if (path === '*') return { regex: /.*/, params: [] };

        const params = [];
        const regexStr = path
            .replace(/:([^/]+)/g, function(_, name) {
                params.push(name);
                return '([^/]+)';
            })
            .replace(/\//g, '\\/');

        return {
            regex: new RegExp('^' + regexStr + '$'),
            params: params
        };
    }

    /**
     * Handle hash change
     */
    async function handleHashChange() {
        const path = TerrainRouter.getPath();
        console.log('[Terrain.Router] Navigating to:', path);

        // Check auth guard if Terrain.Auth exists
        if (window.Terrain && window.Terrain.Auth) {
            if (!Terrain.Auth.guard(path, modeConfig)) {
                console.log('[Terrain.Router] Access denied, redirecting');
                const redirect = modeConfig.auth?.loginRedirect || '/';
                if (path !== redirect) {
                    TerrainRouter.navigate(redirect);
                    return;
                }
            }
        }

        // Find matching route
        let matchedRoute = null;
        let params = {};

        routes.forEach(function(route, routePath) {
            if (routePath === '*') return;
            if (matchedRoute) return;

            const match = path.match(route.pattern.regex);
            if (match) {
                matchedRoute = route;
                route.pattern.params.forEach(function(name, i) {
                    params[name] = match[i + 1];
                });
            }
        });

        // Fall back to 404
        if (!matchedRoute) {
            matchedRoute = routes.get('*');
        }

        if (!matchedRoute) {
            console.error('[Terrain.Router] No route found for:', path);
            return;
        }

        try {
            // Execute handler
            const result = await matchedRoute.handler(params);

            // Render content
            if (appContainer) {
                if (typeof result === 'string') {
                    appContainer.innerHTML = result;
                } else if (result && result.render) {
                    appContainer.innerHTML = result.render(params);
                    if (result.mount) {
                        result.mount(appContainer, params);
                    }
                }
            }

            // Update current route
            const oldRoute = currentRoute;
            currentRoute = { path: path, params: params };

            // Emit event
            if (window.Terrain && window.Terrain.Events) {
                Terrain.Events.emit('ROUTE_CHANGE', {
                    route: currentRoute,
                    previous: oldRoute
                });
            }

        } catch (error) {
            console.error('[Terrain.Router] Failed to load page:', error);
            if (appContainer) {
                appContainer.innerHTML =
                    '<div class="terrain-error">' +
                    '<h1>Error</h1>' +
                    '<p>Failed to load page</p>' +
                    '<pre>' + error.message + '</pre>' +
                    '</div>';
            }
        }
    }

    // Export to Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Router = TerrainRouter;
})();
