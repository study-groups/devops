/**
 * Terrain Skins Module
 * Manages skin loading and application
 *
 * Skins control:
 * - Project discovery method (static JSON, TOML discovery, etc.)
 * - Card appearance and behavior (CLI, edit, status)
 * - Optional token overrides
 */
(function() {
    'use strict';

    const TerrainSkins = {
        config: null,
        currentSkin: null,
        skinName: null,

        /**
         * Initialize skins module
         * Loads terrain.config.json and applies default skin
         */
        init: async function() {
            try {
                const response = await fetch('terrain.config.json');
                if (!response.ok) {
                    throw new Error('Config not found');
                }
                this.config = await response.json();
                console.log('[Terrain.Skins] Config loaded:', this.config.version);

                // Apply default skin
                const skinName = this.config.skin || 'default';
                await this.applySkin(skinName);

            } catch (e) {
                console.warn('[Terrain.Skins] No config found, using defaults:', e.message);
                // Use built-in default skin
                this.currentSkin = this.getDefaultSkin();
                this.skinName = 'default';
            }
        },

        /**
         * Get built-in default skin configuration
         */
        getDefaultSkin: function() {
            return {
                name: 'Default',
                description: 'Standard project cards',
                discovery: {
                    type: 'static',
                    source: 'data/defaults.json'
                },
                card: {
                    showCli: false,
                    showEdit: true,
                    showStatus: true
                },
                tokens: null
            };
        },

        /**
         * Apply a skin by name
         * @param {string} skinName - Skin identifier
         */
        applySkin: async function(skinName) {
            if (!this.config || !this.config.skins) {
                console.error('[Terrain.Skins] No skins configuration available');
                return false;
            }

            const skin = this.config.skins[skinName];
            if (!skin) {
                console.error('[Terrain.Skins] Skin not found:', skinName);
                return false;
            }

            console.log('[Terrain.Skins] Applying skin:', skinName);
            this.currentSkin = skin;
            this.skinName = skinName;

            // Load skin-specific tokens if specified
            if (skin.tokens) {
                await this.loadTokens(skin.tokens);
            }

            // Update Config with skin settings
            if (window.Terrain.Config) {
                const Config = window.Terrain.Config;
                if (skin.card) {
                    Config.set('card.showCli', skin.card.showCli ?? false);
                    Config.set('card.showEdit', skin.card.showEdit ?? true);
                    Config.set('card.showStatus', skin.card.showStatus ?? true);
                }
            }

            // Emit skin applied event
            if (window.Terrain.Events) {
                window.Terrain.Events.emit('SKIN_APPLIED', {
                    skin: skinName,
                    config: skin
                });
            }

            console.log('[Terrain.Skins] Skin applied:', skinName);
            return true;
        },

        /**
         * Load token stylesheet
         * @param {string} tokenPath - Path to CSS file
         */
        loadTokens: function(tokenPath) {
            return new Promise((resolve) => {
                // Remove existing skin tokens
                const existing = document.getElementById('skin-tokens');
                if (existing) {
                    existing.remove();
                }

                const link = document.createElement('link');
                link.id = 'skin-tokens';
                link.rel = 'stylesheet';
                link.href = tokenPath;
                link.onload = () => {
                    console.log('[Terrain.Skins] Tokens loaded:', tokenPath);
                    resolve();
                };
                link.onerror = () => {
                    console.warn('[Terrain.Skins] Failed to load tokens:', tokenPath);
                    resolve();
                };
                document.head.appendChild(link);
            });
        },

        /**
         * Get current skin configuration
         * @returns {Object} Current skin config
         */
        getCurrent: function() {
            return this.currentSkin;
        },

        /**
         * Get current skin name
         * @returns {string} Skin name
         */
        getCurrentName: function() {
            return this.skinName;
        },

        /**
         * Get card configuration from current skin
         * @returns {Object} Card config
         */
        getCardConfig: function() {
            return this.currentSkin?.card || {
                showCli: false,
                showEdit: true,
                showStatus: true
            };
        },

        /**
         * Get discovery configuration from current skin
         * @returns {Object} Discovery config
         */
        getDiscoveryConfig: function() {
            return this.currentSkin?.discovery || {
                type: 'static',
                source: 'data/defaults.json'
            };
        },

        /**
         * List available skins
         * @returns {Array} Skin names
         */
        listSkins: function() {
            if (!this.config || !this.config.skins) {
                return ['default'];
            }
            return Object.keys(this.config.skins);
        },

        /**
         * Get skin info by name
         * @param {string} skinName - Skin identifier
         * @returns {Object} Skin info (name, description)
         */
        getSkinInfo: function(skinName) {
            const skin = this.config?.skins?.[skinName];
            if (!skin) return null;
            return {
                id: skinName,
                name: skin.name || skinName,
                description: skin.description || ''
            };
        }
    };

    // Export to window.Terrain namespace
    window.Terrain = window.Terrain || {};
    window.Terrain.Skins = TerrainSkins;

})();
