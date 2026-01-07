/**
 * Pixeljam Arcade - Boot Script
 * Initializes arcade-specific features after terrain loads
 */
(function() {
    'use strict';

    // Arcade namespace
    window.Arcade = {
        version: '2.0.0',
        themes: ['lava', 'tv', 'lcd', 'cyber'],
        currentTheme: 'lava'
    };

    /**
     * Initialize arcade features
     */
    function init() {
        console.log('[Arcade] Initializing...');

        // Initialize auth
        if (Terrain.Auth) {
            Terrain.Auth.init();
        }

        // Register routes
        registerRoutes();

        // Initialize router with merged config
        var config = window.TerrainConfig || {};
        if (Terrain.Router) {
            Terrain.Router.init(config);
        }

        // Setup theme cycling
        setupThemeToggle();

        // Load saved theme
        loadSavedTheme();

        // Add navigation menu
        addNavMenu();

        // Listen for auth changes to refresh current route
        if (Terrain.Events) {
            Terrain.Events.on('AUTH_CHANGE', function() {
                // Re-render current route after auth change
                if (Terrain.Router) {
                    var path = Terrain.Router.getPath();
                    window.location.hash = path;
                    // Force re-render by triggering hashchange
                    window.dispatchEvent(new HashChangeEvent('hashchange'));
                }
            });
        }

        console.log('[Arcade] Ready');
    }

    /**
     * Add navigation menu to header
     */
    function addNavMenu() {
        var header = document.querySelector('.terrain-header');
        if (!header) return;

        var nav = document.createElement('nav');
        nav.className = 'arcade-nav';
        nav.innerHTML =
            '<a href="#/" class="arcade-nav-link">Home</a>' +
            '<a href="#/games" class="arcade-nav-link">Games</a>' +
            '<a href="#/account" class="arcade-nav-link">Account</a>';

        // Insert after title, before controls
        var controls = header.querySelector('.terrain-header-controls');
        if (controls) {
            header.insertBefore(nav, controls);
        } else {
            header.appendChild(nav);
        }
    }

    /**
     * Register application routes
     */
    function registerRoutes() {
        var Router = Terrain.Router;

        // Home page
        Router.register('/', function() {
            return {
                render: function() {
                    return renderHomePage();
                }
            };
        });

        // Games listing
        Router.register('/games', function() {
            return {
                render: function() {
                    return renderGamesPage();
                }
            };
        });

        // Play game
        Router.register('/play/:gameId', function(params) {
            return {
                render: function() {
                    return renderPlayPage(params.gameId);
                }
            };
        });

        // Account (protected)
        Router.register('/account', function() {
            return {
                render: function() {
                    if (!Terrain.Auth.check()) {
                        return renderLoginPrompt();
                    }
                    return renderAccountPage();
                }
            };
        });

        // Admin (admin only)
        Router.register('/admin', function() {
            return {
                render: function() {
                    if (!Terrain.Auth.isAdmin()) {
                        return renderAccessDenied();
                    }
                    return renderAdminPage();
                }
            };
        });

        // 404
        Router.register('*', function() {
            return '<div class="arcade-404"><h1>404</h1><p>Page not found</p><a href="#/">Back to Home</a></div>';
        });
    }

    /**
     * Page render functions
     */
    function renderHomePage() {
        return '<div class="arcade-page arcade-home">' +
            '<section class="arcade-hero">' +
                '<h1 class="arcade-hero-title">Pixeljam Arcade</h1>' +
                '<p class="arcade-hero-subtitle">Retro gaming, reimagined</p>' +
                '<a href="#/games" class="terrain-btn terrain-btn-primary">Browse Games</a>' +
            '</section>' +
            '<section class="arcade-featured">' +
                '<h2>Featured Games</h2>' +
                '<div class="game-grid" id="featuredGames">' +
                    renderGameCards(3, true) +
                '</div>' +
            '</section>' +
        '</div>';
    }

    function renderGamesPage() {
        return '<div class="arcade-page arcade-games">' +
            '<div class="arcade-filters">' +
                '<button class="arcade-filter-btn active" data-filter="all">All</button>' +
                '<button class="arcade-filter-btn" data-filter="arcade">Arcade</button>' +
                '<button class="arcade-filter-btn" data-filter="puzzle">Puzzle</button>' +
                '<button class="arcade-filter-btn" data-filter="action">Action</button>' +
            '</div>' +
            '<div class="game-grid" id="gamesGrid">' +
                renderGameCards(6, false) +
            '</div>' +
        '</div>';
    }

    function renderPlayPage(gameId) {
        return '<div class="arcade-page arcade-play">' +
            '<div class="arcade-game-header">' +
                '<a href="#/games" class="terrain-btn">&larr; Back</a>' +
                '<h1>Game: ' + gameId + '</h1>' +
            '</div>' +
            '<div class="arcade-game-container">' +
                '<iframe id="gameFrame" src="about:blank" allowfullscreen></iframe>' +
                '<div class="arcade-game-loading">' +
                    '<div class="loading-spinner"></div>' +
                    '<p>Loading game...</p>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function renderAccountPage() {
        var user = Terrain.Auth.getUser();
        return '<div class="arcade-page arcade-account">' +
            '<h1>Account</h1>' +
            '<div class="arcade-user-info">' +
                '<p>Welcome, ' + (user ? user.name : 'Player') + '</p>' +
                '<button class="terrain-btn" onclick="Terrain.Auth.logout(); Terrain.Router.navigate(\'/\');">Logout</button>' +
            '</div>' +
        '</div>';
    }

    function renderAdminPage() {
        return '<div class="arcade-page arcade-admin">' +
            '<h1>Admin Dashboard</h1>' +
            '<p>Game management coming soon...</p>' +
        '</div>';
    }

    function renderLoginPrompt() {
        return '<div class="arcade-page arcade-login">' +
            '<h1>Sign In Required</h1>' +
            '<p>Please sign in to access this page.</p>' +
            '<button class="terrain-btn terrain-btn-primary" onclick="Terrain.Auth.login({});">Sign In</button>' +
        '</div>';
    }

    function renderAccessDenied() {
        return '<div class="arcade-page arcade-denied">' +
            '<h1>Access Denied</h1>' +
            '<p>You do not have permission to view this page.</p>' +
            '<a href="#/" class="terrain-btn">Back to Home</a>' +
        '</div>';
    }

    function renderGameCards(count, featured) {
        var html = '';
        for (var i = 1; i <= count; i++) {
            html += '<article class="game-card' + (featured && i === 1 ? ' featured' : '') + '" onclick="Terrain.Router.navigate(\'/play/game-' + i + '\')">' +
                '<div class="game-card-thumb">' +
                    '<span class="game-card-number">' + i + '</span>' +
                '</div>' +
                '<div class="game-card-body">' +
                    '<h3 class="game-card-title">Game ' + i + '</h3>' +
                    '<p class="game-card-desc">A classic retro game</p>' +
                '</div>' +
                '<div class="game-card-meta">' +
                    '<span class="game-card-tag">Arcade</span>' +
                '</div>' +
            '</article>';
        }
        return html;
    }

    /**
     * Theme management
     */
    function loadSavedTheme() {
        var saved = localStorage.getItem('arcade-theme');
        if (saved && Arcade.themes.indexOf(saved) > -1) {
            Arcade.currentTheme = saved;
            document.documentElement.setAttribute('data-theme', saved);
        }
    }

    function setupThemeToggle() {
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action="theme:next"]');
            if (btn) {
                cycleTheme();
            }
        });
    }

    function cycleTheme() {
        var current = Arcade.themes.indexOf(Arcade.currentTheme);
        var next = (current + 1) % Arcade.themes.length;
        var newTheme = Arcade.themes[next];

        Arcade.currentTheme = newTheme;
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('arcade-theme', newTheme);

        console.log('[Arcade] Theme changed to:', newTheme);

        if (Terrain.Events) {
            Terrain.Events.emit('THEME_CHANGE', { theme: newTheme });
        }
    }

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
