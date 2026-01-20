/**
 * Terrain Element Inspector Module
 * TUT-compatible CSS inspector with Shift+Hold activation
 * + Design Token Viewer (?design=true)
 */
(function() {
    'use strict';

    const LONG_PRESS_DURATION = 1000;

    let inspectorPanel = null;
    let designTokenPanel = null;
    let progressOverlay = null;
    let progressTimer = null;
    let longPressTimer = null;
    let currentElement = null;
    let startTime = 0;

    // CSS variable categories for organization
    const TOKEN_CATEGORIES = {
        'Palette': /^--p[1-8]$/,
        'Signals': /^--s[1-4]$/,
        'Transparency': /^--t[2-6]$/,
        'Backgrounds': /^--bg-/,
        'Text': /^--text-/,
        'Borders': /^--border/,
        'Accents': /^--accent-|^--success|^--error|^--warning/,
        'Semantic': /^--ink|^--one|^--two|^--three|^--four|^--paper|^--shade/,
        'Layout': /^--gap-|^--curve-|^--tempo-/,
        'Fonts': /^--font-/,
        'Terrain': /^--terrain-/
    };

    const TerrainInspector = {
        /**
         * Initialize inspector module
         */
        init: function() {
            this.createPanel();
            this.bindEvents();
            this.checkAutoShow();
            console.log('[Inspector] Initialized');
        },

        /**
         * Create inspector panel
         */
        createPanel: function() {
            inspectorPanel = document.createElement('div');
            inspectorPanel.id = 'element-inspector';
            inspectorPanel.className = 'element-inspector';
            inspectorPanel.innerHTML = `
                <div class="inspector-header">
                    <span>Element Design Tokens <span class="inspector-hint">(drag to move)</span></span>
                    <span class="inspector-close" onclick="Terrain.Inspector.close()">&times;</span>
                </div>
                <div class="inspector-content"></div>
            `;
            document.body.appendChild(inspectorPanel);

            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.close();
            });
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            document.addEventListener('mousedown', (e) => this.handleMouseDown(e), true);
            document.addEventListener('mouseup', () => this.handleMouseUp(), true);
            document.addEventListener('mouseleave', () => this.handleMouseUp());
        },

        /**
         * Create progress overlay for shift-hold
         */
        createProgressOverlay: function() {
            const overlay = document.createElement('div');
            overlay.className = 'inspector-progress-overlay';
            overlay.innerHTML = `<div class="inspector-progress-badge"><span class="progress-text">0.0s / 1.0s</span></div>`;
            document.body.appendChild(overlay);
            return overlay;
        },

        /**
         * Update progress overlay position and progress
         */
        updateProgressOverlay: function(element, progress) {
            if (!progressOverlay) return;
            const rect = element.getBoundingClientRect();
            progressOverlay.style.left = rect.left + 'px';
            progressOverlay.style.top = rect.top + 'px';
            progressOverlay.style.width = rect.width + 'px';
            progressOverlay.style.height = rect.height + 'px';
            const elapsed = (progress * LONG_PRESS_DURATION / 100) / 1000;
            const progressText = progressOverlay.querySelector('.progress-text');
            if (progressText) progressText.textContent = `${elapsed.toFixed(1)}s / 1.0s`;
            const alpha = Math.min(0.3, progress / 100 * 0.3);
            progressOverlay.style.background = `radial-gradient(circle, rgba(74, 158, 255, ${alpha}) 0%, rgba(74, 158, 255, ${alpha * 0.3}) 100%)`;
        },

        /**
         * Get XPath for element
         */
        getXPath: function(element) {
            if (element.id) return `//*[@id="${element.id}"]`;
            if (element === document.body) return '/html/body';
            let ix = 0;
            const siblings = element.parentNode?.childNodes || [];
            for (let i = 0; i < siblings.length; i++) {
                const sibling = siblings[i];
                if (sibling === element) {
                    const parentPath = element.parentNode ? this.getXPath(element.parentNode) : '';
                    return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
                }
                if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
            }
            return '';
        },

        /**
         * Extract full design tokens from element
         */
        extractDesignTokens: function(element) {
            const computed = window.getComputedStyle(element);
            return {
                element: {
                    tag: element.tagName.toLowerCase(),
                    classes: Array.from(element.classList).join(', ') || 'none',
                    id: element.id || 'none',
                    xpath: this.getXPath(element)
                },
                colors: {
                    background: computed.backgroundColor,
                    color: computed.color,
                    borderColor: computed.borderTopColor
                },
                typography: {
                    fontFamily: computed.fontFamily,
                    fontSize: computed.fontSize,
                    fontWeight: computed.fontWeight,
                    lineHeight: computed.lineHeight,
                    letterSpacing: computed.letterSpacing
                },
                spacing: {
                    padding: computed.padding,
                    margin: computed.margin
                },
                border: {
                    width: computed.borderWidth,
                    style: computed.borderStyle,
                    radius: computed.borderRadius
                },
                layout: {
                    display: computed.display,
                    width: computed.width,
                    height: computed.height
                }
            };
        },

        /**
         * Create token section HTML
         */
        createTokenSection: function(title, tokens) {
            let html = `<div class="inspector-token-section"><div class="inspector-section-title">${title}</div>`;
            for (const [key, value] of Object.entries(tokens)) {
                const isColor = title === 'Colors';
                const colorSwatch = isColor && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent'
                    ? `<div class="inspector-color-swatch" style="background:${value}"></div>` : '';
                html += `<div class="inspector-token-row">${colorSwatch}<div class="inspector-token-info"><div class="inspector-token-key">${key}</div><div class="inspector-token-value">${value}</div></div></div>`;
            }
            html += '</div>';
            return html;
        },

        /**
         * Make inspector panel draggable
         */
        makeDraggable: function(panel) {
            const header = panel.querySelector('.inspector-header');
            let isDragging = false, initialX, initialY;

            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('inspector-close')) return;
                isDragging = true;
                initialX = e.clientX - (parseInt(panel.style.left) || 0);
                initialY = e.clientY - (parseInt(panel.style.top) || 0);
                panel.style.transform = 'none';
                header.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    panel.style.left = (e.clientX - initialX) + 'px';
                    panel.style.top = (e.clientY - initialY) + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
                header.style.cursor = 'grab';
            });
        },

        /**
         * Close inspector panel
         */
        close: function() {
            if (inspectorPanel) {
                inspectorPanel.classList.remove('visible');
            }
        },

        /**
         * Handle mouse down for long-press inspection
         */
        handleMouseDown: function(e) {
            if (!e.shiftKey) return;
            if (e.target.closest('#design-panel')) return;
            if (e.target.closest('#element-inspector')) return;
            if (e.target.closest('.design-fab')) return;

            e.preventDefault();
            e.stopPropagation();

            currentElement = e.target;
            startTime = Date.now();
            progressOverlay = this.createProgressOverlay();
            this.updateProgressOverlay(currentElement, 0);

            let progress = 0;
            progressTimer = setInterval(() => {
                progress = ((Date.now() - startTime) / LONG_PRESS_DURATION) * 100;
                this.updateProgressOverlay(currentElement, progress);
                if (progress >= 100) clearInterval(progressTimer);
            }, 50);

            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                this.inspect(currentElement);
                if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
                if (progressOverlay) { progressOverlay.remove(); progressOverlay = null; }
            }, LONG_PRESS_DURATION);
        },

        /**
         * Handle mouse up
         */
        handleMouseUp: function() {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
            if (progressOverlay) { progressOverlay.remove(); progressOverlay = null; }
            currentElement = null;
        },

        /**
         * Inspect an element
         */
        inspect: function(element) {
            const tokens = this.extractDesignTokens(element);
            const content = inspectorPanel.querySelector('.inspector-content');

            let html = `
                <div class="inspector-element-info">
                    <div class="inspector-section-title">Element Info</div>
                    <div class="inspector-element-detail"><strong>Tag:</strong> &lt;${tokens.element.tag}&gt;</div>
                    <div class="inspector-element-detail"><strong>ID:</strong> ${tokens.element.id}</div>
                    <div class="inspector-element-detail"><strong>Classes:</strong> ${tokens.element.classes}</div>
                    <div class="inspector-element-detail">
                        <strong>XPath:</strong>
                        <div class="inspector-xpath" onclick="navigator.clipboard.writeText('${tokens.element.xpath}')" title="Click to copy">${tokens.element.xpath}</div>
                    </div>
                </div>
            `;

            html += this.createTokenSection('Colors', tokens.colors);
            html += this.createTokenSection('Typography', tokens.typography);
            html += this.createTokenSection('Spacing', tokens.spacing);
            html += this.createTokenSection('Border', tokens.border);
            html += this.createTokenSection('Layout', tokens.layout);

            content.innerHTML = html;
            inspectorPanel.classList.add('visible');

            // Make draggable on first show
            if (!inspectorPanel._draggable) {
                this.makeDraggable(inspectorPanel);
                inspectorPanel._draggable = true;
            }
        },

        // =====================================================================
        // Design Token Panel (?design=true)
        // =====================================================================

        /**
         * Create design FAB button
         */
        createDesignFab: function() {
            const fab = document.createElement('button');
            fab.id = 'design-fab';
            fab.className = 'fab design-fab';
            fab.title = 'Toggle Design Tokens';
            fab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>`;
            fab.addEventListener('click', () => this.toggleDesignPanel());
            document.body.appendChild(fab);
            return fab;
        },

        /**
         * Create design token panel
         */
        createDesignTokenPanel: function() {
            if (designTokenPanel) return;

            designTokenPanel = document.createElement('div');
            designTokenPanel.id = 'design-token-panel';
            designTokenPanel.className = 'design-token-panel';
            designTokenPanel.innerHTML = `
                <div class="design-token-header">
                    <span class="design-token-title">Design Tokens</span>
                    <div class="design-token-controls">
                        <button class="design-token-btn" onclick="Terrain.Inspector.copyTokens()" title="Copy all tokens">Copy</button>
                        <span class="design-token-close" onclick="Terrain.Inspector.closeDesignPanel()">&times;</span>
                    </div>
                </div>
                <div class="design-token-tabs">
                    <button class="design-token-tab active" data-tab="tokens">Tokens</button>
                    <button class="design-token-tab" data-tab="mode">Mode</button>
                    <button class="design-token-tab" data-tab="config">Config</button>
                </div>
                <div class="design-token-content"></div>
            `;
            document.body.appendChild(designTokenPanel);

            // Tab switching
            designTokenPanel.querySelectorAll('.design-token-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    designTokenPanel.querySelectorAll('.design-token-tab').forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    this.renderDesignTab(e.target.dataset.tab);
                });
            });

            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && designTokenPanel?.classList.contains('visible')) {
                    this.closeDesignPanel();
                }
            });
        },

        /**
         * Extract all CSS variables from :root
         */
        extractCSSVariables: function() {
            const vars = {};
            const computed = getComputedStyle(document.documentElement);

            // Get all CSS custom properties
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules || []) {
                        if (rule.selectorText === ':root') {
                            for (const prop of rule.style) {
                                if (prop.startsWith('--')) {
                                    vars[prop] = computed.getPropertyValue(prop).trim();
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Cross-origin stylesheets will throw
                }
            }

            return vars;
        },

        /**
         * Categorize CSS variables
         */
        categorizeVariables: function(vars) {
            const categorized = {};
            const used = new Set();

            for (const [category, pattern] of Object.entries(TOKEN_CATEGORIES)) {
                categorized[category] = {};
                for (const [name, value] of Object.entries(vars)) {
                    if (pattern.test(name)) {
                        categorized[category][name] = value;
                        used.add(name);
                    }
                }
            }

            // Collect uncategorized
            categorized['Other'] = {};
            for (const [name, value] of Object.entries(vars)) {
                if (!used.has(name)) {
                    categorized['Other'][name] = value;
                }
            }

            return categorized;
        },

        /**
         * Check if value looks like a color
         */
        isColorValue: function(value) {
            return /^#|^rgb|^hsl|^var\(--/.test(value);
        },

        /**
         * Render color swatch
         */
        renderSwatch: function(value) {
            if (!this.isColorValue(value)) return '';
            return `<div class="design-token-swatch" style="background:${value}"></div>`;
        },

        /**
         * Render design tab content
         */
        renderDesignTab: function(tab) {
            const content = designTokenPanel.querySelector('.design-token-content');

            switch (tab) {
                case 'tokens':
                    this.renderTokensTab(content);
                    break;
                case 'mode':
                    this.renderModeTab(content);
                    break;
                case 'config':
                    this.renderConfigTab(content);
                    break;
            }
        },

        /**
         * Render tokens tab
         */
        renderTokensTab: function(content) {
            const vars = this.extractCSSVariables();
            const categorized = this.categorizeVariables(vars);

            let html = '';
            for (const [category, tokens] of Object.entries(categorized)) {
                if (Object.keys(tokens).length === 0) continue;

                html += `<div class="design-token-category">
                    <div class="design-token-category-title">${category} <span class="design-token-count">${Object.keys(tokens).length}</span></div>`;

                for (const [name, value] of Object.entries(tokens)) {
                    html += `<div class="design-token-row" data-var="${name}">
                        ${this.renderSwatch(value)}
                        <div class="design-token-info">
                            <div class="design-token-name">${name}</div>
                            <div class="design-token-value">${value}</div>
                        </div>
                    </div>`;
                }

                html += '</div>';
            }

            content.innerHTML = html;

            // Click to copy
            content.querySelectorAll('.design-token-row').forEach(row => {
                row.addEventListener('click', () => {
                    const varName = row.dataset.var;
                    navigator.clipboard.writeText(`var(${varName})`);
                    row.classList.add('copied');
                    setTimeout(() => row.classList.remove('copied'), 500);
                });
            });
        },

        /**
         * Render mode tab
         */
        renderModeTab: function(content) {
            const Mode = window.Terrain?.Mode;
            if (!Mode) {
                content.innerHTML = '<div class="design-token-empty">Mode not available</div>';
                return;
            }

            const config = Mode.getConfig() || {};
            let html = `
                <div class="design-token-mode-header">
                    <div class="design-token-mode-name">${Mode.getName() || 'Unknown'}</div>
                    <div class="design-token-mode-theme">Theme: ${Mode.getTheme() || 'default'}</div>
                </div>
            `;

            // Canvas settings
            if (config.canvas) {
                html += this.renderConfigSection('Canvas', config.canvas);
            }

            // Features
            if (config.features) {
                html += this.renderConfigSection('Features', config.features);
            }

            // UI visibility
            if (config.ui) {
                html += this.renderConfigSection('UI', config.ui);
            }

            // Card settings
            if (config.card) {
                html += this.renderConfigSection('Card', config.card);
            }

            // Discovery
            if (config.discovery) {
                html += this.renderConfigSection('Discovery', config.discovery);
            }

            content.innerHTML = html;
        },

        /**
         * Render config tab
         */
        renderConfigTab: function(content) {
            const Config = window.Terrain?.Config;
            if (!Config) {
                content.innerHTML = '<div class="design-token-empty">Config not available</div>';
                return;
            }

            let html = '';

            // Show each config section
            const sections = ['features', 'canvas', 'ui', 'card', 'discovery', 'toasts'];
            for (const section of sections) {
                if (Config[section]) {
                    html += this.renderConfigSection(section.charAt(0).toUpperCase() + section.slice(1), Config[section]);
                }
            }

            content.innerHTML = html || '<div class="design-token-empty">No config loaded</div>';
        },

        /**
         * Render a config section
         */
        renderConfigSection: function(title, obj) {
            let html = `<div class="design-token-category">
                <div class="design-token-category-title">${title}</div>`;

            for (const [key, value] of Object.entries(obj)) {
                const displayValue = typeof value === 'boolean'
                    ? `<span class="design-token-bool ${value}">${value}</span>`
                    : String(value);

                html += `<div class="design-token-row config">
                    <div class="design-token-info">
                        <div class="design-token-name">${key}</div>
                        <div class="design-token-value">${displayValue}</div>
                    </div>
                </div>`;
            }

            html += '</div>';
            return html;
        },

        /**
         * Show design token panel
         */
        showDesignPanel: function() {
            this.createDesignTokenPanel();
            this.renderDesignTab('tokens');
            designTokenPanel.classList.add('visible');
        },

        /**
         * Close design token panel
         */
        closeDesignPanel: function() {
            if (designTokenPanel) {
                designTokenPanel.classList.remove('visible');
            }
        },

        /**
         * Toggle design token panel
         */
        toggleDesignPanel: function() {
            if (designTokenPanel?.classList.contains('visible')) {
                this.closeDesignPanel();
            } else {
                this.showDesignPanel();
            }
        },

        /**
         * Copy all tokens as CSS
         */
        copyTokens: function() {
            const vars = this.extractCSSVariables();
            let css = ':root {\n';
            for (const [name, value] of Object.entries(vars)) {
                css += `  ${name}: ${value};\n`;
            }
            css += '}';
            navigator.clipboard.writeText(css);

            const btn = designTokenPanel.querySelector('.design-token-btn');
            const orig = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = orig, 1000);
        },

        /**
         * Auto-show on ?design=true
         */
        checkAutoShow: function() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('design') === 'true') {
                // Create FAB for toggling
                this.createDesignFab();
                // Delay to let styles load, then show panel
                setTimeout(() => this.showDesignPanel(), 100);
            }
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Inspector = TerrainInspector;

})();
