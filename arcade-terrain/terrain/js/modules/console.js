/**
 * Terrain Console Module
 * Panel management with view/environment/org selectors
 *
 * Each panel can independently show different views and environments
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'terrain-console-panels';

    // Available views (iframe sources)
    const VIEWS = {
        console: { name: 'Console', src: 'console.iframe.html', icon: '>' },
        tsm: { name: 'TSM', src: 'tsm.iframe.html', icon: '~' },
        deploy: { name: 'Deploy', src: 'deploy.iframe.html', icon: '^' },
        logs: { name: 'Logs', src: 'logs.iframe.html', icon: '#' },
        playwright: { name: 'Playwright', src: 'playwright.iframe.html', icon: '@' },
        tests: { name: 'Tests', src: 'tests.iframe.html', icon: '*' }
    };

    // Default panel configuration
    const DEFAULT_PANELS = {
        'top-left': { view: 'console', env: 'local', org: 'tetra' },
        'top-right': { view: 'tsm', env: 'local', org: 'tetra' },
        'bottom-left': { view: 'deploy', env: 'local', org: 'tetra' },
        'bottom-right': { view: 'logs', env: 'local', org: 'tetra' }
    };

    const TerrainConsole = {
        panels: {},          // Panel state by position
        environments: {},    // Cached environments per org
        orgs: [],           // Available organizations

        /**
         * Initialize console module
         */
        init: async function() {
            // Load saved panel state
            this.panels = this._loadState() || { ...DEFAULT_PANELS };

            // Fetch available orgs and environments
            await this._fetchOrgs();
            await this._fetchEnvironments();

            // Set up panel headers
            this._setupPanelHeaders();

            // Apply initial state
            this._applyPanelState();

            // Listen for bridge messages
            if (window.TERRAIN?.Bridge) {
                TERRAIN.Bridge.on('panel:view', (data) => this.setView(data.panel, data.view));
                TERRAIN.Bridge.on('panel:env', (data) => this.setEnv(data.panel, data.env));
                TERRAIN.Bridge.on('panel:org', (data) => this.setOrg(data.panel, data.org));
            }

            console.log('[Terrain.Console] Initialized');
        },

        /**
         * Set panel view
         */
        setView: function(panelId, viewId) {
            if (!this.panels[panelId]) return;
            if (!VIEWS[viewId]) {
                console.warn(`[Console] Unknown view: ${viewId}`);
                return;
            }

            this.panels[panelId].view = viewId;
            this._updatePanelIframe(panelId);
            this._saveState();
            this._emitChange(panelId);
        },

        /**
         * Set panel environment
         */
        setEnv: function(panelId, env) {
            if (!this.panels[panelId]) return;

            this.panels[panelId].env = env;
            this._updatePanelEnvIndicator(panelId);
            this._saveState();
            this._emitChange(panelId);

            // Notify iframe of environment change
            this._sendToPanel(panelId, { type: 'env:change', env });
        },

        /**
         * Set panel organization
         */
        setOrg: async function(panelId, org) {
            if (!this.panels[panelId]) return;

            this.panels[panelId].org = org;

            // Fetch environments for new org if not cached
            if (!this.environments[org]) {
                await this._fetchEnvironmentsForOrg(org);
            }

            this._updatePanelOrgIndicator(panelId);
            this._updateEnvDropdown(panelId);
            this._saveState();
            this._emitChange(panelId);

            // Notify iframe of org change
            this._sendToPanel(panelId, { type: 'org:change', org });
        },

        /**
         * Get current panel state
         */
        getState: function(panelId) {
            return this.panels[panelId] || null;
        },

        /**
         * Refresh panel (reload iframe)
         */
        refresh: function(panelId) {
            const panel = document.querySelector(`[data-panel="${panelId}"]`);
            const iframe = panel?.querySelector('iframe');
            if (iframe) {
                iframe.src = iframe.src;
            }
        },

        // =====================================================================
        // Internal Methods
        // =====================================================================

        _fetchOrgs: async function() {
            try {
                const res = await fetch('/api/orgs');
                if (res.ok) {
                    this.orgs = await res.json();
                } else {
                    // Fallback to defaults
                    this.orgs = ['tetra', 'pixeljam-arcade', 'nodeholder'];
                }
            } catch (e) {
                console.warn('[Console] Failed to fetch orgs:', e);
                this.orgs = ['tetra', 'pixeljam-arcade', 'nodeholder'];
            }
        },

        _fetchEnvironments: async function() {
            for (const org of this.orgs) {
                await this._fetchEnvironmentsForOrg(org);
            }
        },

        _fetchEnvironmentsForOrg: async function(org) {
            try {
                const res = await fetch(`/api/environments?org=${encodeURIComponent(org)}`);
                if (res.ok) {
                    this.environments[org] = await res.json();
                } else {
                    this.environments[org] = ['local'];
                }
            } catch (e) {
                console.warn(`[Console] Failed to fetch environments for ${org}:`, e);
                this.environments[org] = ['local'];
            }
        },

        _setupPanelHeaders: function() {
            const panelPositions = Object.keys(this.panels);

            panelPositions.forEach(panelId => {
                const panel = document.querySelector(`[data-panel="${panelId}"]`);
                if (!panel) return;

                // Find or create header
                let header = panel.querySelector('.panel-header');
                if (!header) {
                    header = document.createElement('div');
                    header.className = 'panel-header';
                    panel.insertBefore(header, panel.firstChild);
                }

                // Build header content
                header.innerHTML = this._buildHeaderHTML(panelId);

                // Attach event listeners
                this._attachHeaderEvents(panelId, header);
            });
        },

        _buildHeaderHTML: function(panelId) {
            const state = this.panels[panelId];
            const view = VIEWS[state.view] || VIEWS.console;

            // Build view options
            const viewOptions = Object.entries(VIEWS).map(([id, v]) =>
                `<option value="${id}" ${id === state.view ? 'selected' : ''}>${v.icon} ${v.name}</option>`
            ).join('');

            // Build org options
            const orgOptions = this.orgs.map(org =>
                `<option value="${org}" ${org === state.org ? 'selected' : ''}>${org}</option>`
            ).join('');

            // Build env options
            const envs = this.environments[state.org] || ['local'];
            const envOptions = envs.map(env =>
                `<option value="${env}" ${env === state.env ? 'selected' : ''}>${env}</option>`
            ).join('');

            // Status indicator
            const statusClass = state.env === 'local' ? 'status-local' :
                               state.env === 'prod' ? 'status-prod' : 'status-remote';

            return `
                <select class="view-select" data-action="view">${viewOptions}</select>
                <select class="env-select ${statusClass}" data-action="env">${envOptions}</select>
                <select class="org-select" data-action="org">${orgOptions}</select>
                <button class="refresh-btn" data-action="refresh" title="Refresh">&#x21bb;</button>
            `;
        },

        _attachHeaderEvents: function(panelId, header) {
            // View select
            const viewSelect = header.querySelector('.view-select');
            if (viewSelect) {
                viewSelect.addEventListener('change', (e) => {
                    this.setView(panelId, e.target.value);
                });
            }

            // Env select
            const envSelect = header.querySelector('.env-select');
            if (envSelect) {
                envSelect.addEventListener('change', (e) => {
                    this.setEnv(panelId, e.target.value);
                });
            }

            // Org select
            const orgSelect = header.querySelector('.org-select');
            if (orgSelect) {
                orgSelect.addEventListener('change', (e) => {
                    this.setOrg(panelId, e.target.value);
                });
            }

            // Refresh button
            const refreshBtn = header.querySelector('.refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.refresh(panelId);
                });
            }
        },

        _applyPanelState: function() {
            Object.keys(this.panels).forEach(panelId => {
                this._updatePanelIframe(panelId);
            });
        },

        _updatePanelIframe: function(panelId) {
            const state = this.panels[panelId];
            const view = VIEWS[state.view];
            if (!view) return;

            const panel = document.querySelector(`[data-panel="${panelId}"]`);
            if (!panel) return;

            let iframe = panel.querySelector('iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.className = 'panel-iframe';
                const content = panel.querySelector('.panel-content') || panel;
                content.appendChild(iframe);
            }

            // Build src with env/org params
            const params = new URLSearchParams({
                env: state.env,
                org: state.org
            });
            iframe.src = `${view.src}?${params}`;

            // Update header view select
            const viewSelect = panel.querySelector('.view-select');
            if (viewSelect) viewSelect.value = state.view;
        },

        _updatePanelEnvIndicator: function(panelId) {
            const state = this.panels[panelId];
            const panel = document.querySelector(`[data-panel="${panelId}"]`);
            if (!panel) return;

            const envSelect = panel.querySelector('.env-select');
            if (envSelect) {
                envSelect.value = state.env;
                envSelect.className = 'env-select ' +
                    (state.env === 'local' ? 'status-local' :
                     state.env === 'prod' ? 'status-prod' : 'status-remote');
            }
        },

        _updatePanelOrgIndicator: function(panelId) {
            const state = this.panels[panelId];
            const panel = document.querySelector(`[data-panel="${panelId}"]`);
            if (!panel) return;

            const orgSelect = panel.querySelector('.org-select');
            if (orgSelect) orgSelect.value = state.org;
        },

        _updateEnvDropdown: function(panelId) {
            const state = this.panels[panelId];
            const panel = document.querySelector(`[data-panel="${panelId}"]`);
            if (!panel) return;

            const envSelect = panel.querySelector('.env-select');
            if (!envSelect) return;

            const envs = this.environments[state.org] || ['local'];
            envSelect.innerHTML = envs.map(env =>
                `<option value="${env}" ${env === state.env ? 'selected' : ''}>${env}</option>`
            ).join('');

            // Reset to local if current env not available
            if (!envs.includes(state.env)) {
                state.env = 'local';
                envSelect.value = 'local';
            }
        },

        _sendToPanel: function(panelId, message) {
            const panel = document.querySelector(`[data-panel="${panelId}"]`);
            const iframe = panel?.querySelector('iframe');
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage({
                    ...message,
                    source: 'terrain',
                    timestamp: Date.now()
                }, '*');
            }
        },

        _emitChange: function(panelId) {
            if (window.TERRAIN?.Events) {
                TERRAIN.Events.emit('console:panel:change', {
                    panel: panelId,
                    state: this.panels[panelId]
                });
            }
        },

        _loadState: function() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                return saved ? JSON.parse(saved) : null;
            } catch (e) {
                console.warn('[Console] Failed to load state:', e);
                return null;
            }
        },

        _saveState: function() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.panels));
            } catch (e) {
                console.warn('[Console] Failed to save state:', e);
            }
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Console = TerrainConsole;

    // Also register with TERRAIN if available
    if (window.TERRAIN?.register) {
        TERRAIN.register('Console', TerrainConsole);
    }

})();
