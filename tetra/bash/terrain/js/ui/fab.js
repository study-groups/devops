/**
 * Terrain FAB (Floating Action Button) Module
 * Design Token Editor with element inspection
 */
(function() {
    'use strict';

    const State = window.Terrain.State;
    const Events = window.Terrain.Events;
    const Config = window.Terrain.Config;

    // Token definitions for Terrain
    const terrainTokens = {
        surfaces: [
            { name: 'surface-void', var: '--surface-void', default: '#0a0a0a' },
            { name: 'surface-panel', var: '--surface-panel', default: '#1a1a1a' },
            { name: 'surface-elevated', var: '--surface-elevated', default: '#2a2a2a' },
            { name: 'surface-hover', var: '--surface-hover', default: '#3a3a3a' }
        ],
        edges: [
            { name: 'edge-subtle', var: '--edge-subtle', default: '#222222' },
            { name: 'edge-visible', var: '--edge-visible', default: '#444444' },
            { name: 'edge-active', var: '--edge-active', default: '#4a9eff' }
        ],
        ink: [
            { name: 'ink-primary', var: '--ink-primary', default: '#ffffff' },
            { name: 'ink-secondary', var: '--ink-secondary', default: '#aaaaaa' },
            { name: 'ink-muted', var: '--ink-muted', default: '#666666' },
            { name: 'ink-code', var: '--ink-code', default: '#00ffaa' }
        ],
        signals: [
            { name: 'signal-primary', var: '--signal-primary', default: '#4a9eff' },
            { name: 'signal-secondary', var: '--signal-secondary', default: '#ff6b35' },
            { name: 'signal-success', var: '--signal-success', default: '#00ff00' },
            { name: 'signal-error', var: '--signal-error', default: '#ff4444' },
            { name: 'signal-warning', var: '--signal-warning', default: '#ffd700' }
        ]
    };

    let designPanel = null;
    let inspectorPanel = null;
    let longPressTimer = null;
    let currentElement = null;
    const LONG_PRESS_DURATION = 1000;

    const TerrainFAB = {
        /**
         * Initialize FAB module
         */
        init: function() {
            if (!Config.features.designMode) {
                console.log('[FAB] Design mode not enabled');
                return;
            }

            this.createPanel();
            this.bindEvents();
            console.log('[FAB] Initialized in design mode');
        },

        /**
         * Create the design panel
         */
        createPanel: function() {
            designPanel = document.createElement('div');
            designPanel.id = 'design-panel';
            designPanel.className = 'design-panel';
            designPanel.innerHTML = this.buildPanelHTML();
            document.body.appendChild(designPanel);

            // Create inspector panel
            inspectorPanel = document.createElement('div');
            inspectorPanel.id = 'element-inspector';
            inspectorPanel.className = 'element-inspector';
            inspectorPanel.innerHTML = '<div class="inspector-title">ELEMENT INSPECTOR</div><div class="inspector-content"></div>';
            document.body.appendChild(inspectorPanel);
        },

        /**
         * Build panel HTML
         */
        buildPanelHTML: function() {
            let html = `
                <div class="design-panel-header">
                    <span class="design-panel-title">DESIGN TOKENS</span>
                    <button class="design-panel-close" onclick="Terrain.FAB.toggle()">×</button>
                </div>
                <div class="design-panel-body">
            `;

            // Add token sections
            Object.keys(terrainTokens).forEach(category => {
                html += `
                    <div class="token-category">
                        <div class="token-category-title">${category.toUpperCase()}</div>
                `;
                terrainTokens[category].forEach(token => {
                    const currentValue = getComputedStyle(document.documentElement).getPropertyValue(token.var).trim() || token.default;
                    html += `
                        <div class="token-row">
                            <span class="token-label">${token.name}</span>
                            <input type="color" class="token-picker" data-var="${token.var}" value="${currentValue}">
                            <span class="token-value">${currentValue}</span>
                        </div>
                    `;
                });
                html += '</div>';
            });

            // Google Fonts section
            html += `
                <div class="token-category">
                    <div class="token-category-title">GOOGLE FONTS</div>
                    <textarea id="google-fonts-embed" class="google-fonts-input" placeholder="Paste Google Fonts embed code here..."></textarea>
                    <button class="design-btn" onclick="Terrain.FAB.loadGoogleFonts()">Load Fonts</button>
                </div>
            `;

            // Export/Import section
            html += `
                <div class="token-category">
                    <div class="token-category-title">EXPORT / IMPORT</div>
                    <button class="design-btn" onclick="Terrain.FAB.exportTokens()">Export JSON</button>
                    <button class="design-btn" onclick="Terrain.FAB.copyCSS()">Copy CSS</button>
                    <input type="file" id="import-tokens-file" accept=".json" style="display:none" onchange="Terrain.FAB.importTokens(event)">
                    <button class="design-btn" onclick="document.getElementById('import-tokens-file').click()">Import JSON</button>
                    <button class="design-btn design-btn-reset" onclick="Terrain.FAB.resetTokens()">Reset</button>
                </div>
            `;

            html += `
                </div>
                <div class="design-panel-footer">
                    <span>Shift+Hold to inspect elements</span>
                </div>
            `;

            return html;
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            // Design FAB click (replace config FAB when in design mode)
            const fab = document.querySelector('.fab');
            if (fab) {
                fab.innerHTML = '&#127912;'; // Paint palette emoji
                fab.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggle();
                });
            }

            // Token picker changes
            designPanel.addEventListener('input', (e) => {
                if (e.target.classList.contains('token-picker')) {
                    const varName = e.target.dataset.var;
                    const value = e.target.value;
                    this.updateToken(varName, value);
                }
            });

            // Long-press element inspection (Shift+Hold)
            document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            document.addEventListener('mouseup', () => this.handleMouseUp());
            document.addEventListener('mouseleave', () => this.handleMouseUp());
        },

        /**
         * Toggle design panel
         */
        toggle: function() {
            designPanel.classList.toggle('visible');
        },

        /**
         * Update a token value
         */
        updateToken: function(varName, value) {
            document.documentElement.style.setProperty(varName, value);

            // Update value display
            const row = designPanel.querySelector(`[data-var="${varName}"]`).closest('.token-row');
            if (row) {
                row.querySelector('.token-value').textContent = value;
            }
        },

        /**
         * Handle mouse down for long-press inspection
         */
        handleMouseDown: function(e) {
            if (!e.shiftKey) return;
            if (e.target.closest('#design-panel')) return;
            if (e.target.closest('#element-inspector')) return;

            currentElement = e.target;
            longPressTimer = setTimeout(() => {
                this.inspectElement(currentElement);
            }, LONG_PRESS_DURATION);
        },

        /**
         * Handle mouse up
         */
        handleMouseUp: function() {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        },

        /**
         * Inspect an element
         */
        inspectElement: function(element) {
            const styles = getComputedStyle(element);
            const content = inspectorPanel.querySelector('.inspector-content');

            content.innerHTML = `
                <div class="inspector-section">
                    <div class="inspector-label">ELEMENT</div>
                    <div class="inspector-value">${element.tagName.toLowerCase()}</div>
                    ${element.id ? `<div class="inspector-value">#${element.id}</div>` : ''}
                    ${element.className ? `<div class="inspector-value">.${element.className.split(' ').join('.')}</div>` : ''}
                </div>
                <div class="inspector-section">
                    <div class="inspector-label">COLORS</div>
                    <div class="inspector-row">
                        <span>background</span>
                        <span class="inspector-color" style="background:${styles.backgroundColor}"></span>
                        <span>${styles.backgroundColor}</span>
                    </div>
                    <div class="inspector-row">
                        <span>color</span>
                        <span class="inspector-color" style="background:${styles.color}"></span>
                        <span>${styles.color}</span>
                    </div>
                </div>
                <div class="inspector-section">
                    <div class="inspector-label">TYPOGRAPHY</div>
                    <div class="inspector-row"><span>font-family</span><span>${styles.fontFamily.split(',')[0]}</span></div>
                    <div class="inspector-row"><span>font-size</span><span>${styles.fontSize}</span></div>
                    <div class="inspector-row"><span>font-weight</span><span>${styles.fontWeight}</span></div>
                </div>
                <div class="inspector-section">
                    <div class="inspector-label">SPACING</div>
                    <div class="inspector-row"><span>padding</span><span>${styles.padding}</span></div>
                    <div class="inspector-row"><span>margin</span><span>${styles.margin}</span></div>
                </div>
            `;

            inspectorPanel.classList.add('visible');

            // Position near element
            const rect = element.getBoundingClientRect();
            inspectorPanel.style.left = Math.min(rect.right + 10, window.innerWidth - 280) + 'px';
            inspectorPanel.style.top = Math.max(rect.top, 10) + 'px';

            // Hide on click outside
            const hideHandler = (e) => {
                if (!inspectorPanel.contains(e.target)) {
                    inspectorPanel.classList.remove('visible');
                    document.removeEventListener('click', hideHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', hideHandler), 100);
        },

        /**
         * Load Google Fonts from embed code
         */
        loadGoogleFonts: function() {
            const textarea = document.getElementById('google-fonts-embed');
            const embedCode = textarea.value;

            if (Terrain.Fonts) {
                const result = Terrain.Fonts.loadFromEmbed(embedCode);
                if (result) {
                    // Apply the font URL
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = result.url;
                    document.head.appendChild(link);

                    if (Terrain.Popups) {
                        Terrain.Popups.alert(`Loaded fonts: ${result.families.join(', ')}`);
                    }
                } else {
                    if (Terrain.Popups) {
                        Terrain.Popups.alert('Could not parse embed code');
                    }
                }
            }
        },

        /**
         * Export tokens as JSON
         */
        exportTokens: function() {
            const tokens = {};
            Object.keys(terrainTokens).forEach(category => {
                terrainTokens[category].forEach(token => {
                    tokens[token.name] = getComputedStyle(document.documentElement).getPropertyValue(token.var).trim();
                });
            });

            const blob = new Blob([JSON.stringify({ tokens }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'terrain-tokens.json';
            a.click();
            URL.revokeObjectURL(url);
        },

        /**
         * Copy CSS to clipboard
         */
        copyCSS: function() {
            let css = ':root {\n';
            Object.keys(terrainTokens).forEach(category => {
                css += `    /* ${category} */\n`;
                terrainTokens[category].forEach(token => {
                    const value = getComputedStyle(document.documentElement).getPropertyValue(token.var).trim();
                    css += `    ${token.var}: ${value};\n`;
                });
            });
            css += '}\n';

            navigator.clipboard.writeText(css).then(() => {
                if (Terrain.Popups) Terrain.Popups.alert('CSS copied to clipboard!');
            });
        },

        /**
         * Import tokens from JSON file
         */
        importTokens: function(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.tokens) {
                        Object.entries(data.tokens).forEach(([name, value]) => {
                            const varName = '--' + name.replace(/-/g, '-');
                            // Find matching token
                            Object.keys(terrainTokens).forEach(category => {
                                terrainTokens[category].forEach(token => {
                                    if (token.name === name) {
                                        this.updateToken(token.var, value);
                                        const picker = designPanel.querySelector(`[data-var="${token.var}"]`);
                                        if (picker) picker.value = value;
                                    }
                                });
                            });
                        });
                        if (Terrain.Popups) Terrain.Popups.alert('Tokens imported!');
                    }
                } catch (err) {
                    if (Terrain.Popups) Terrain.Popups.alert('Invalid JSON file');
                }
            };
            reader.readAsText(file);
        },

        /**
         * Reset tokens to defaults
         */
        resetTokens: function() {
            Object.keys(terrainTokens).forEach(category => {
                terrainTokens[category].forEach(token => {
                    this.updateToken(token.var, token.default);
                    const picker = designPanel.querySelector(`[data-var="${token.var}"]`);
                    if (picker) picker.value = token.default;
                });
            });
            if (Terrain.Popups) Terrain.Popups.alert('Tokens reset to defaults');
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.FAB = TerrainFAB;

})();
