/**
 * Terrain Environments Module
 * Multi-environment support with SSH execution for remote operations
 *
 * Loads environment configuration from tetra-deploy.toml files
 */
(function() {
    'use strict';

    const TerrainEnvironments = {
        orgs: [],                    // Available organizations
        environments: {},            // { org: { env: config } }
        connections: {},             // { org:env: { status, lastCheck } }
        _initialized: false,

        /**
         * Initialize environments module
         */
        init: async function() {
            if (this._initialized) return;

            await this.refresh();
            this._initialized = true;
            console.log('[Terrain.Environments] Initialized');
        },

        /**
         * Refresh org and environment lists
         */
        refresh: async function() {
            await this._fetchOrgs();
            for (const org of this.orgs) {
                await this._fetchEnvironmentsForOrg(org);
            }
        },

        /**
         * Get list of available organizations
         */
        getOrgs: function() {
            return [...this.orgs];
        },

        /**
         * Get environments for an organization
         */
        getEnvironments: function(org) {
            const envs = this.environments[org] || {};
            return Object.keys(envs);
        },

        /**
         * Get environment config
         */
        getConfig: function(org, env) {
            return this.environments[org]?.[env] || null;
        },

        /**
         * Check if environment is local
         */
        isLocal: function(org, env) {
            return env === 'local';
        },

        /**
         * Check if environment is remote
         */
        isRemote: function(org, env) {
            return env !== 'local';
        },

        /**
         * Get SSH connection string for environment
         */
        getSSH: function(org, env) {
            const config = this.getConfig(org, env);
            return config?.ssh || null;
        },

        /**
         * Get connection status
         */
        getConnectionStatus: function(org, env) {
            const key = `${org}:${env}`;
            return this.connections[key] || { status: 'unknown', lastCheck: null };
        },

        /**
         * Execute command on environment (via server API)
         * @param {string} org - Organization
         * @param {string} env - Environment
         * @param {string} command - Command to execute
         * @returns {Promise<{stdout, stderr, exitCode}>}
         */
        exec: async function(org, env, command) {
            const key = `${org}:${env}`;

            // Update connection status to connecting
            this.connections[key] = { status: 'connecting', lastCheck: Date.now() };
            this._emitConnectionChange(org, env);

            try {
                const res = await fetch('/api/environments/exec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ org, env, command })
                });

                const result = await res.json();

                // Update connection status
                this.connections[key] = {
                    status: res.ok ? 'connected' : 'error',
                    lastCheck: Date.now(),
                    error: result.error || null
                };
                this._emitConnectionChange(org, env);

                return result;
            } catch (e) {
                this.connections[key] = {
                    status: 'error',
                    lastCheck: Date.now(),
                    error: e.message
                };
                this._emitConnectionChange(org, env);
                throw e;
            }
        },

        /**
         * Test connection to environment
         */
        testConnection: async function(org, env) {
            if (env === 'local') {
                return { ok: true, latency: 0 };
            }

            const start = Date.now();
            try {
                const result = await this.exec(org, env, 'echo ok');
                const latency = Date.now() - start;
                return {
                    ok: result.exitCode === 0,
                    latency,
                    output: result.stdout
                };
            } catch (e) {
                return {
                    ok: false,
                    latency: Date.now() - start,
                    error: e.message
                };
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
                    this.orgs = this._getDefaultOrgs();
                }
            } catch (e) {
                console.warn('[Environments] Failed to fetch orgs:', e);
                this.orgs = this._getDefaultOrgs();
            }
        },

        _fetchEnvironmentsForOrg: async function(org) {
            try {
                const res = await fetch(`/api/environments?org=${encodeURIComponent(org)}`);
                if (res.ok) {
                    const data = await res.json();
                    this.environments[org] = data;
                } else {
                    this.environments[org] = { local: { ssh: null } };
                }
            } catch (e) {
                console.warn(`[Environments] Failed to fetch environments for ${org}:`, e);
                this.environments[org] = { local: { ssh: null } };
            }
        },

        _getDefaultOrgs: function() {
            return ['tetra', 'pixeljam-arcade', 'nodeholder'];
        },

        _emitConnectionChange: function(org, env) {
            if (window.TERRAIN?.Events) {
                TERRAIN.Events.emit('environments:connection:change', {
                    org, env,
                    status: this.getConnectionStatus(org, env)
                });
            }
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Environments = TerrainEnvironments;

    // Also register with TERRAIN if available
    if (window.TERRAIN?.register) {
        TERRAIN.register('Environments', TerrainEnvironments);
    }

})();
