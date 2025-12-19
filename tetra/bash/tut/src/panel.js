/**
 * TUT Panel - Dynamic panel creation and UI controls
 */

const TUT_Panel = {
    // Token definitions derived from TUT_DEFAULT_TOKENS and TUT_TOKEN_GROUPS (core.js)
    _tokens: null,  // Lazily initialized

    /**
     * Get token definitions, deriving from core.js constants
     */
    _getTokens: function() {
        if (this._tokens) return this._tokens;

        this._tokens = {};
        for (const [group, vars] of Object.entries(TUT_TOKEN_GROUPS)) {
            this._tokens[group] = vars.map(cssVar => ({
                name: cssVar.replace('--', ''),
                var: cssVar,
                default: TUT_DEFAULT_TOKENS[cssVar]
            }));
        }
        return this._tokens;
    },

    _panelElement: null,
    _fabElement: null,

    // =========================================================================
    // DYNAMIC CREATION
    // =========================================================================

    /**
     * Create the FAB button
     * Adds to .fab-container if it exists, otherwise creates standalone
     */
    createFAB: function() {
        if (document.getElementById('designFab')) {
            this._fabElement = document.getElementById('designFab');
            return this._fabElement;
        }

        const fab = document.createElement('button');
        fab.id = 'designFab';
        fab.className = 'fab fab-design';
        fab.innerHTML = this._getFABIcon();
        fab.title = 'Design Tokens (TUT)';
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Add to fab-container if it exists, otherwise body
        const container = document.querySelector('.fab-container');
        if (container) {
            container.appendChild(fab);
        } else {
            // Fallback: create standalone FAB
            fab.style.position = 'fixed';
            fab.style.bottom = '16px';
            fab.style.right = '16px';
            fab.style.zIndex = '1001';
            document.body.appendChild(fab);
        }

        this._fabElement = fab;
        return fab;
    },

    /**
     * Create the full design panel
     * Replaces any existing design-panel from fab.js
     */
    create: function() {
        // Check for existing panels (TUT or fab.js)
        let existingPanel = document.getElementById('designPanel') || document.getElementById('design-panel');

        if (existingPanel) {
            // Replace existing panel content with rich TUT panel
            existingPanel.id = 'designPanel';
            existingPanel.innerHTML = this._buildPanelHTML();
            this._panelElement = existingPanel;
            this._bindEvents();
            return existingPanel;
        }

        // Create new panel if none exists
        const panel = document.createElement('div');
        panel.id = 'designPanel';
        panel.className = 'design-panel';
        panel.innerHTML = this._buildPanelHTML();

        document.body.appendChild(panel);
        this._panelElement = panel;

        // Bind events after panel is in DOM
        this._bindEvents();

        return panel;
    },

    /**
     * FAB icon SVG
     */
    _getFABIcon: function() {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28">
            <circle cx="50" cy="50" r="45" fill="currentColor" opacity="0.15"/>
            <rect x="25" y="30" width="18" height="18" rx="3" fill="var(--fab-accent-primary, #58a6ff)"/>
            <rect x="47" y="30" width="18" height="18" rx="3" fill="var(--fab-success, #3fb950)"/>
            <rect x="69" y="30" width="18" height="18" rx="3" fill="var(--fab-warning, #d29922)"/>
            <rect x="25" y="52" width="18" height="18" rx="3" fill="var(--fab-error, #f85149)"/>
            <rect x="47" y="52" width="18" height="18" rx="3" fill="var(--fab-text-primary, #c9d1d9)"/>
            <rect x="69" y="52" width="18" height="18" rx="3" fill="var(--fab-text-secondary, #8b949e)"/>
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2" opacity="0.8"/>
        </svg>`;
    },

    /**
     * Build the complete panel HTML
     */
    _buildPanelHTML: function() {
        return `
            <div class="design-panel-header">
                <span>Design Tokens</span>
                <span class="design-panel-close" data-action="close-panel">&times;</span>
            </div>
            <div class="design-panel-content">
                ${this._buildThemeSwitcherSection()}
                ${this._buildMetadataSection()}
                ${this._buildColorsSection()}
                ${this._buildLayoutSection()}
                ${this._buildTypographySection()}
                ${this._buildAnalysisSection()}
                ${this._buildExportSection()}
            </div>
        `;
    },

    /**
     * Theme Switcher Section
     */
    _buildThemeSwitcherSection: function() {
        return `
            <div class="token-section" data-section="switcher">
                <div class="token-section-header" data-action="toggle-section" data-target="switcher">
                    <span>Theme Switcher</span>
                    <span class="section-toggle">▼</span>
                </div>
                <div class="token-section-content">
                    <div class="metadata-field">
                        <label>Active Theme</label>
                        <select id="themeSwitcher" class="font-select mt-0" data-action="switch-theme">
                            <option value="">-- Select Theme --</option>
                        </select>
                    </div>
                    <div class="design-panel-buttons mt-half">
                        <button class="design-panel-btn design-panel-btn--primary flex-1" data-action="save-theme">
                            Save Current
                        </button>
                        <button class="design-panel-btn design-panel-btn--secondary flex-1" data-action="delete-theme">
                            Delete
                        </button>
                    </div>
                    <div id="themeFeedback" class="theme-feedback hidden"></div>
                </div>
            </div>
        `;
    },

    /**
     * Theme Metadata Section
     */
    _buildMetadataSection: function() {
        return `
            <div class="token-section collapsed" data-section="metadata">
                <div class="token-section-header" data-action="toggle-section" data-target="metadata">
                    <span>Theme Metadata</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="metadata-field">
                        <label>Name</label>
                        <input type="text" id="themeName" value="my-theme" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Version</label>
                        <input type="text" id="themeVersion" value="1.0.0" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Description</label>
                        <input type="text" id="themeDescription" value="Custom theme" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Author</label>
                        <input type="text" id="themeAuthor" value="Designer" class="font-input">
                    </div>
                    <div class="metadata-field">
                        <label>Temperature</label>
                        <select id="themeTemperature" class="font-select">
                            <option value="warm">Warm</option>
                            <option value="cool">Cool</option>
                            <option value="neutral" selected>Neutral</option>
                        </select>
                    </div>
                    <div class="metadata-field">
                        <label>Color Mode</label>
                        <select id="themeColorMode" class="font-select">
                            <option value="dark" selected>Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Colors Section - generates all token groups
     */
    _buildColorsSection: function() {
        return `
            <div class="token-section" data-section="colors">
                <div class="token-section-header" data-action="toggle-section" data-target="colors">
                    <span>Colors</span>
                    <span class="section-toggle">▼</span>
                </div>
                <div class="token-section-content">
                    ${this._buildTokenGroup('Background', this._getTokens().backgrounds)}
                    ${this._buildTokenGroup('Border', this._getTokens().borders)}
                    ${this._buildTokenGroup('Text', this._getTokens().text)}
                    ${this._buildTokenGroup('Accent & Status', this._getTokens().accents)}
                </div>
            </div>
        `;
    },

    /**
     * Build a token group with color pickers
     */
    _buildTokenGroup: function(title, tokens) {
        let html = `<div class="token-group"><div class="token-group-title">${title}</div>`;

        tokens.forEach(token => {
            const currentValue = this._getTokenValue(token.var) || token.default;
            html += `
                <div class="token-item">
                    <input type="color" class="token-picker" data-action="update-token" data-token="${token.var}" value="${currentValue}">
                    <div class="token-swatch" style="background: var(${token.var})"></div>
                    <div class="token-info">
                        <div class="token-name">${token.var}</div>
                        <div class="token-value" id="token-${token.name}">${currentValue}</div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    },

    /**
     * Layout Section
     */
    _buildLayoutSection: function() {
        return `
            <div class="token-section collapsed" data-section="layout">
                <div class="token-section-header" data-action="toggle-section" data-target="layout">
                    <span>Layout</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="token-group-title">Section Style</div>
                        <div class="control-group">
                            <label class="field-label">Border Style</label>
                            <select class="font-select mt-0" data-action="update-section-border" id="sectionBorderStyle">
                                <option value="left">Left accent (default)</option>
                                <option value="full-muted">Full border (muted)</option>
                                <option value="full-accent">Full border (accent)</option>
                                <option value="none">No border</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Corner Radius</label>
                            <input type="range" min="0" max="24" value="8" data-action="update-section-radius" id="sectionRadius">
                            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--fab-text-secondary);">
                                <span>Sharp</span>
                                <span id="sectionRadiusValue">8px</span>
                                <span>Round</span>
                            </div>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Sidebar Position</label>
                            <select class="font-select mt-0" data-action="update-sidebar-position" id="sidebarPosition">
                                <option value="right">Right (default)</option>
                                <option value="left">Left</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Typography Section
     */
    _buildTypographySection: function() {
        return `
            <div class="token-section collapsed" data-section="typography">
                <div class="token-section-header" data-action="toggle-section" data-target="typography">
                    <span>Typography</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="fab-card">
                            <label class="field-label">Add Google Font</label>
                            <textarea class="font-input" id="fontEmbedCode" placeholder="Paste Google Fonts embed code here..." style="height: 60px; resize: vertical;"></textarea>
                            <button class="add-font-btn" data-action="add-font">Add Font to Page</button>
                            <div class="font-example-toggle" data-action="toggle-font-example">
                                ▶ Show example
                            </div>
                            <div class="font-example-content" id="fontExampleContent">
                                <strong>How to add Google Fonts:</strong>
                                <ol>
                                    <li>Go to <a href="https://fonts.google.com" target="_blank">fonts.google.com</a></li>
                                    <li>Select fonts and click <strong>"Get font"</strong></li>
                                    <li>Click <strong>"Get embed code"</strong></li>
                                    <li>Copy the embed code and paste above</li>
                                </ol>
                                <div class="fab-tip">
                                    <strong>Tip:</strong> Mono fonts auto-assign to Code, sans fonts to Heading/Body.
                                </div>
                            </div>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Heading Font</label>
                            <select class="font-select mt-0" data-action="update-font" data-font-type="heading" id="headingFont">
                                <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">System (Default)</option>
                                <option value="'Courier New', monospace">Courier New</option>
                                <option value="Monaco, monospace">Monaco</option>
                                <option value="Georgia, serif">Georgia</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Body Font</label>
                            <select class="font-select mt-0" data-action="update-font" data-font-type="body" id="bodyFont">
                                <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">System (Default)</option>
                                <option value="'Courier New', monospace">Courier New</option>
                                <option value="Monaco, monospace">Monaco</option>
                                <option value="Georgia, serif">Georgia</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label class="field-label">Code Font</label>
                            <select class="font-select mt-0" data-action="update-font" data-font-type="code" id="codeFont">
                                <option value="'Courier New', Monaco, monospace">Courier New (Default)</option>
                                <option value="Monaco, monospace">Monaco</option>
                                <option value="'Fira Code', monospace">Fira Code</option>
                                <option value="Consolas, monospace">Consolas</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Analysis Section - Usage and Deps integration
     */
    _buildAnalysisSection: function() {
        return `
            <div class="token-section collapsed" data-section="analysis">
                <div class="token-section-header" data-action="toggle-section" data-target="analysis">
                    <span>Analysis</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="token-group-title">Summary</div>
                        <div id="analysisSummary" class="help-text">
                            Click "Scan" to analyze token usage
                        </div>
                        <button class="design-panel-btn design-panel-btn--secondary mt-half" data-action="run-analysis">
                            Scan Tokens
                        </button>
                    </div>
                    <div class="token-group" id="analysisOrphans" style="display: none;">
                        <div class="token-group-title">Orphaned Tokens</div>
                        <div id="orphansList" class="help-text"></div>
                    </div>
                    <div class="token-group" id="analysisMissing" style="display: none;">
                        <div class="token-group-title">Missing Tokens</div>
                        <div id="missingList" class="help-text"></div>
                    </div>
                    <div class="token-group" id="analysisLayers" style="display: none;">
                        <div class="token-group-title">Dependency Layers</div>
                        <div id="layersList" class="help-text"></div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Export/Import Section
     */
    _buildExportSection: function() {
        return `
            <div class="token-section collapsed" data-section="export">
                <div class="token-section-header" data-action="toggle-section" data-target="export">
                    <span>Export / Import</span>
                    <span class="section-toggle">▶</span>
                </div>
                <div class="token-section-content">
                    <div class="token-group">
                        <div class="token-group-title">Theme (tokens.json)</div>
                        <div class="design-panel-buttons mt-half">
                            <button class="design-panel-btn design-panel-btn--primary flex-1" data-action="export-theme">
                                Download
                            </button>
                            <button class="design-panel-btn design-panel-btn--secondary flex-1" data-action="import-theme">
                                Import
                            </button>
                        </div>
                        <p class="help-text">Full theme with metadata and TDS mapping</p>
                    </div>
                    <div class="token-group">
                        <div class="token-group-title">CSS Variables</div>
                        <div class="design-panel-buttons mt-half">
                            <button class="design-panel-btn design-panel-btn--secondary flex-1" data-action="copy-css">
                                Copy CSS
                            </button>
                            <button class="design-panel-btn design-panel-btn--danger flex-1" data-action="reset-tokens">
                                Reset All
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // =========================================================================
    // ANALYSIS
    // =========================================================================

    /**
     * Run usage and dependency analysis
     */
    runAnalysis: function() {
        if (typeof TUT_Usage === 'undefined' || typeof TUT_Deps === 'undefined') {
            document.getElementById('analysisSummary').textContent = 'Analysis modules not loaded';
            return;
        }

        // Run scans
        TUT_Usage.scan();
        TUT_Deps.build();

        // Get summary
        const summary = TUT_Usage.getSummary();
        document.getElementById('analysisSummary').innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem;">
                <span>Total tokens:</span><span>${summary.total}</span>
                <span>Defined:</span><span>${summary.defined}</span>
                <span>Used:</span><span>${summary.used}</span>
                <span>Orphaned:</span><span style="color: var(--fab-warning);">${summary.orphans}</span>
                <span>Missing:</span><span style="color: var(--fab-error);">${summary.missing}</span>
            </div>
        `;

        // Show orphaned tokens
        const orphans = TUT_Usage.getOrphans();
        const orphansDiv = document.getElementById('analysisOrphans');
        const orphansList = document.getElementById('orphansList');
        if (orphans.length > 0) {
            orphansDiv.style.display = 'block';
            orphansList.innerHTML = orphans.map(t => `<code>${t.name}</code>`).join(', ');
        } else {
            orphansDiv.style.display = 'none';
        }

        // Show missing tokens
        const missing = TUT_Usage.getMissing();
        const missingDiv = document.getElementById('analysisMissing');
        const missingList = document.getElementById('missingList');
        if (missing.length > 0) {
            missingDiv.style.display = 'block';
            missingList.innerHTML = missing.map(t => `<code>${t.name}</code>`).join(', ');
        } else {
            missingDiv.style.display = 'none';
        }

        // Show dependency layers
        const layers = TUT_Deps.getLayers();
        const layersDiv = document.getElementById('analysisLayers');
        const layersList = document.getElementById('layersList');
        const layerKeys = Object.keys(layers).sort((a, b) => parseInt(a) - parseInt(b));
        if (layerKeys.length > 0) {
            layersDiv.style.display = 'block';
            layersList.innerHTML = layerKeys.map(depth =>
                `<div><strong>Layer ${depth}:</strong> ${layers[depth].length} tokens</div>`
            ).join('');
        } else {
            layersDiv.style.display = 'none';
        }
    },

    // =========================================================================
    // EVENT BINDING
    // =========================================================================

    /**
     * Bind panel events
     */
    _bindEvents: function() {
        // Event binding now handled by TUT_Actions delegation in api.js
    },

    /**
     * Update a token value
     */
    _updateToken: function(varName, value) {
        document.documentElement.style.setProperty(varName, value);

        // Update display
        const tokenName = varName.replace('--', '');
        const valueEl = document.getElementById(`token-${tokenName}`);
        if (valueEl) valueEl.textContent = value;

        // Update swatch
        const picker = document.querySelector(`[data-token="${varName}"]`);
        if (picker) {
            const swatch = picker.parentElement.querySelector('.token-swatch');
            if (swatch) swatch.style.background = value;
        }

        // Notify TUT_Tokens if available
        if (typeof TUT_Tokens !== 'undefined' && TUT_Tokens.update) {
            TUT_Tokens.update(varName.replace('--', ''), value, { silent: true });
        }

        // Record in usage history if available
        if (typeof TUT_Usage !== 'undefined' && TUT_Usage.recordChange) {
            const oldValue = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            TUT_Usage.recordChange(varName, oldValue, value);
        }
    },

    /**
     * Get current token value from DOM
     */
    _getTokenValue: function(varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    },

    // =========================================================================
    // EXISTING METHODS (preserved)
    // =========================================================================

    /**
     * Toggle design panel visibility
     */
    toggle: function() {
        const panel = document.getElementById('designPanel') || document.getElementById('design-panel');
        if (panel) {
            panel.classList.toggle('visible');
        }
    },

    /**
     * Close the panel
     */
    close: function() {
        const panel = document.getElementById('designPanel') || document.getElementById('design-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
    },

    /**
     * Toggle a collapsible section
     */
    toggleSection: function(sectionName) {
        const section = document.querySelector(`[data-section="${sectionName}"]`);
        if (!section) return;

        section.classList.toggle('collapsed');
        const toggle = section.querySelector('.section-toggle');
        if (toggle) {
            toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        }
    },

    /**
     * Collapse all sections
     */
    collapseAll: function() {
        document.querySelectorAll('.token-section').forEach(section => {
            section.classList.add('collapsed');
            const toggle = section.querySelector('.section-toggle');
            if (toggle) toggle.textContent = '▶';
        });
    },

    /**
     * Get theme metadata from form fields
     */
    getMetadata: function() {
        return {
            name: document.getElementById('themeName')?.value || 'my-theme',
            version: document.getElementById('themeVersion')?.value || '1.0.0',
            description: document.getElementById('themeDescription')?.value || 'Custom theme',
            author: document.getElementById('themeAuthor')?.value || 'Designer',
            temperature: document.getElementById('themeTemperature')?.value || 'neutral',
            colorMode: document.getElementById('themeColorMode')?.value || 'dark'
        };
    },

    /**
     * Set theme metadata in form fields
     */
    setMetadata: function(metadata) {
        if (metadata.name) {
            const el = document.getElementById('themeName');
            if (el) el.value = metadata.name;
        }
        if (metadata.version) {
            const el = document.getElementById('themeVersion');
            if (el) el.value = metadata.version;
        }
        if (metadata.description) {
            const el = document.getElementById('themeDescription');
            if (el) el.value = metadata.description;
        }
        if (metadata.author) {
            const el = document.getElementById('themeAuthor');
            if (el) el.value = metadata.author;
        }
        if (metadata.temperature) {
            const el = document.getElementById('themeTemperature');
            if (el) el.value = metadata.temperature;
        }
        if (metadata.colorMode) {
            const el = document.getElementById('themeColorMode');
            if (el) el.value = metadata.colorMode;
        }
    },

    /**
     * Update sidebar position
     */
    updateSidebarPosition: function(position) {
        document.body.setAttribute('data-sidebar-position', position);
        localStorage.setItem('tut-sidebar-position', position);
    },

    /**
     * Restore sidebar position from localStorage
     */
    restoreSidebarPosition: function() {
        const saved = localStorage.getItem('tut-sidebar-position');
        const current = document.body.getAttribute('data-sidebar-position');
        const position = saved || current || 'right';

        document.body.setAttribute('data-sidebar-position', position);
        const select = document.getElementById('sidebarPosition');
        if (select) select.value = position;
    },

    /**
     * Setup click-outside to close panel
     */
    setupClickOutside: function() {
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('designPanel');
            const fab = document.getElementById('designFab');
            if (panel && panel.classList.contains('visible') &&
                !panel.contains(e.target) &&
                fab && !fab.contains(e.target)) {
                panel.classList.remove('visible');
            }
        });
    },

    /**
     * Get all token definitions
     */
    getTokenDefinitions: function() {
        return this._getTokens();
    }
};
