/**
 * Terrain Fonts Module
 * Google Fonts loading and management
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;

    const TerrainFonts = {
        loadedFonts: [],

        /**
         * Initialize fonts module
         */
        init: function() {
            // Apply saved fonts
            this.applyAll();
        },

        /**
         * Apply all saved fonts
         */
        applyAll: function() {
            ['primary', 'secondary', 'code'].forEach(type => {
                const font = State.fonts[type];
                if (font) {
                    this.apply(type, font.family, font.cdn);
                }
            });
        },

        /**
         * Apply a font
         */
        apply: function(type, family, cdn) {
            // Load CDN if provided
            if (cdn) {
                const link = document.getElementById(`font-${type}-link`);
                if (link) {
                    link.href = cdn;
                }
            }

            // Apply CSS variable
            document.documentElement.style.setProperty(`--font-${type}`, family);

            // Update state
            State.fonts[type] = { family, cdn: cdn || '' };

            console.log(`[Fonts] Applied ${type}: ${family}`);
        },

        /**
         * Parse Google Fonts embed code
         * @param {string} embedCode - The embed code from Google Fonts
         * @returns {Object|null} Parsed font info or null
         */
        parseGoogleFontsEmbed: function(embedCode) {
            // Match href URL
            const hrefMatch = embedCode.match(/href="([^"]+)"/);
            if (!hrefMatch) return null;

            const url = hrefMatch[1];

            // Extract font families
            const familyMatch = url.match(/family=([^&]+)/);
            if (!familyMatch) return null;

            // Parse families (can be multiple separated by &family=)
            const familyStr = familyMatch[1];
            const families = familyStr.split('&family=').map(f => {
                // Remove weight info (e.g., :wght@400;700)
                return f.split(':')[0].replace(/\+/g, ' ');
            });

            return {
                url: url,
                families: families
            };
        },

        /**
         * Load fonts from Google Fonts embed code
         */
        loadFromEmbed: function(embedCode) {
            const parsed = this.parseGoogleFontsEmbed(embedCode);
            if (!parsed) {
                console.error('[Fonts] Could not parse embed code');
                return null;
            }

            // Add preconnect for performance
            if (!document.querySelector('link[href*="fonts.gstatic.com"]')) {
                const preconnect = document.createElement('link');
                preconnect.rel = 'preconnect';
                preconnect.href = 'https://fonts.gstatic.com';
                preconnect.crossOrigin = 'anonymous';
                document.head.appendChild(preconnect);
            }

            // Store loaded fonts
            parsed.families.forEach(family => {
                if (!this.loadedFonts.includes(family)) {
                    this.loadedFonts.push(family);
                }
            });

            return parsed;
        },

        /**
         * Get list of loaded fonts for dropdown population
         */
        getLoadedFonts: function() {
            return this.loadedFonts;
        },

        /**
         * Apply font from dropdown selection
         */
        applyFromDropdown: function(type) {
            const select = document.getElementById(`font-${type}-select`);
            if (!select) return;

            const value = select.value;
            const parts = value.split('|');
            const family = parts[0];
            const cdn = parts[1] || '';

            this.apply(type, family, cdn);
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Fonts = TerrainFonts;

})();
