/**
 * client/settings/DesignTokensPanel.js
 * Panel for managing Page CSS Design Tokens and themes.
 */
import { panelRegistry } from './panelRegistry.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { appStore } from '/client/appState.js';

const PANEL_ID = 'design-tokens-panel';

class DesignTokensPanel {
    constructor(container) {
        if (!container) {
            console.error('Container not provided for DesignTokensPanel');
            return;
        }
        this.container = container;
        this.state = {};

        this.injectStyles();
        this.render();
        this.attachEventListeners();
        this.subscribeToStateChanges();
    }

    injectStyles() {
        if (!document.getElementById('design-tokens-panel-styles')) {
            const link = document.createElement('link');
            link.id = 'design-tokens-panel-styles';
            link.rel = 'stylesheet';
            link.href = '/client/settings/DesignTokensPanel.css';
            document.head.appendChild(link);
        }
    }

    render() {
        // Get initial state from the store
        const settings = appStore.getState().settings || {};
        const pageTheme = settings.pageTheme || { themeDir: '', themeMode: 'light' };
        
        this.container.innerHTML = `
            <div class="design-tokens-panel-content">
                <div class="description">
                    <p>Manage design tokens for your page content. This system supports both legacy single-file themes and the new structured approach with core + mode-specific files.</p>
                    <p>Theme structure: <code>themes/classic/</code> → <code>core.css</code> + <code>light.css</code> + <code>dark.css</code></p>
                </div>

                <!-- Theme Directory Section -->
                <div class="setting-section">
                    <h4>Theme Configuration</h4>
                    <div class="setting-row">
                        <label for="theme-dir-input">Theme Directory:</label>
                        <input type="text" id="theme-dir-input" 
                               placeholder="/themes/classic" 
                               value="${pageTheme.themeDir || ''}"
                               title="Path to theme directory containing core.css, light.css, and dark.css">
                    </div>
                    <div class="setting-row">
                        <label>Active Theme Mode:</label>
                        <div class="theme-switcher">
                            <button class="theme-button ${pageTheme.themeMode === 'light' ? 'active' : ''}" data-theme="light">Light</button>
                            <button class="theme-button ${pageTheme.themeMode === 'dark' ? 'active' : ''}" data-theme="dark">Dark</button>
                        </div>
                    </div>
                </div>

                <!-- Responsive Design Section -->
                <div class="setting-section">
                    <h4>Responsive Design</h4>
                    <div class="setting-row">
                        <label for="mobile-breakpoint">Mobile Breakpoint:</label>
                        <input type="number" id="mobile-breakpoint" 
                               value="1024" 
                               min="320" 
                               max="1440" 
                               step="1"
                               title="Breakpoint in pixels for mobile/desktop switch">
                        <span class="unit">px</span>
                    </div>
                    <div class="setting-row">
                        <label>Preview Mode:</label>
                        <div class="preview-mode-switcher">
                            <button class="mode-button active" data-mode="desktop">Desktop</button>
                            <button class="mode-button" data-mode="mobile">Mobile (1024px)</button>
                        </div>
                    </div>
                </div>

                <!-- Theme Presets Section -->
                <div class="setting-section">
                    <h4>Quick Presets</h4>
                    <div class="preset-buttons">
                        <button class="preset-btn" data-preset="classic">Classic</button>
                        <button class="preset-btn" data-preset="modern">Modern</button>
                        <button class="preset-btn" data-preset="minimal">Minimal</button>
                        <button class="preset-btn" data-preset="custom">Custom</button>
                    </div>
                </div>

                <!-- Theme Status Section -->
                <div class="setting-section">
                    <h4>Theme Status</h4>
                    <div id="theme-status" class="theme-status">
                        <div class="status-item">
                            <span class="status-label">Current:</span>
                            <span class="status-value" id="current-theme-display">None</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Files Loaded:</span>
                            <span class="status-value" id="loaded-files-display">0</span>
                        </div>
                    </div>
                </div>

                <!-- Actions Section -->
                <div class="setting-section">
                    <h4>Actions</h4>
                    <div class="action-buttons">
                        <button id="validate-theme-btn" class="action-btn">Validate Theme</button>
                        <button id="reload-theme-btn" class="action-btn">Reload Theme</button>
                        <button id="export-tokens-btn" class="action-btn">Export Tokens</button>
                        <button id="edit-theme-btn" class="action-btn">Edit Theme</button>
                    </div>
                </div>

                <!-- Theme Editor Section (Initially Hidden) -->
                <div class="setting-section" id="theme-editor-section" style="display: none;">
                    <h4>Theme Editor</h4>
                    
                    <!-- Typography Section -->
                    <div class="editor-subsection">
                        <h5>Typography</h5>
                        <div class="token-grid">
                            <div class="token-row">
                                <label>Heading Font:</label>
                                <select id="heading-font">
                                    <option value="var(--font-family-sans)">Sans Serif</option>
                                    <option value="var(--font-family-serif)">Serif</option>
                                    <option value="var(--font-family-mono)">Monospace</option>
                                </select>
                            </div>
                            <div class="token-row">
                                <label>Body Font:</label>
                                <select id="body-font">
                                    <option value="var(--font-family-sans)">Sans Serif</option>
                                    <option value="var(--font-family-serif)">Serif</option>
                                    <option value="var(--font-family-mono)">Monospace</option>
                                </select>
                            </div>
                            <div class="token-row">
                                <label>H1 Size:</label>
                                <input type="range" id="h1-size" min="24" max="48" value="36" step="2">
                                <span class="value-display">36px</span>
                            </div>
                            <div class="token-row">
                                <label>Body Size:</label>
                                <input type="range" id="body-size" min="12" max="24" value="16" step="1">
                                <span class="value-display">16px</span>
                            </div>
                        </div>
                    </div>

                    <!-- Colors Section -->
                    <div class="editor-subsection">
                        <h5>Colors</h5>
                        <div class="token-grid">
                            <div class="token-row">
                                <label>Primary Color:</label>
                                <input type="color" id="primary-color" value="#2563eb">
                                <span class="color-value">#2563eb</span>
                            </div>
                            <div class="token-row">
                                <label>Background (Light):</label>
                                <input type="color" id="bg-light" value="#ffffff">
                                <span class="color-value">#ffffff</span>
                            </div>
                            <div class="token-row">
                                <label>Background (Dark):</label>
                                <input type="color" id="bg-dark" value="#0a0a0a">
                                <span class="color-value">#0a0a0a</span>
                            </div>
                            <div class="token-row">
                                <label>Text (Light):</label>
                                <input type="color" id="text-light" value="#171717">
                                <span class="color-value">#171717</span>
                            </div>
                            <div class="token-row">
                                <label>Text (Dark):</label>
                                <input type="color" id="text-dark" value="#fafafa">
                                <span class="color-value">#fafafa</span>
                            </div>
                        </div>
                    </div>

                    <!-- Spacing Section -->
                    <div class="editor-subsection">
                        <h5>Spacing & Layout</h5>
                        <div class="token-grid">
                            <div class="token-row">
                                <label>Base Spacing:</label>
                                <input type="range" id="base-spacing" min="2" max="8" value="4" step="1">
                                <span class="value-display">4px</span>
                            </div>
                            <div class="token-row">
                                <label>Mobile Breakpoint:</label>
                                <input type="number" id="mobile-bp-editor" value="1024" min="320" max="1440">
                                <span class="unit">px</span>
                            </div>
                        </div>
                    </div>

                    <!-- Preview Section -->
                    <div class="editor-subsection">
                        <h5>Live Preview</h5>
                        <div class="theme-preview" id="live-preview">
                            <h1>Heading 1 Sample</h1>
                            <h2>Heading 2 Sample</h2>
                            <p>This is body text that shows how your theme will look. It includes <strong>bold text</strong> and <em>italic text</em>.</p>
                            <code>console.log('Code sample');</code>
                            <button class="preview-button">Button Sample</button>
                        </div>
                    </div>

                    <!-- Generate Theme Files -->
                    <div class="editor-subsection">
                        <h5>Generate Theme</h5>
                        <div class="action-buttons">
                            <button id="generate-core-btn" class="action-btn">Generate core.css</button>
                            <button id="generate-light-btn" class="action-btn">Generate light.css</button>
                            <button id="generate-dark-btn" class="action-btn">Generate dark.css</button>
                            <button id="download-theme-btn" class="action-btn action-btn--primary">Download Complete Theme</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.updateThemeStatus();
    }

    attachEventListeners() {
        // Theme directory input
        const themeDirInput = this.container.querySelector('#theme-dir-input');
        themeDirInput.addEventListener('change', (e) => {
            const path = e.target.value.trim();
            dispatch({
                type: ActionTypes.SETTINGS_SET_PAGE_THEME_DIR,
                payload: path,
            });
        });

        // Theme mode switcher
        const themeSwitcher = this.container.querySelector('.theme-switcher');
        themeSwitcher.addEventListener('click', (e) => {
            if (e.target.matches('.theme-button')) {
                const theme = e.target.dataset.theme;
                dispatch({
                    type: ActionTypes.SETTINGS_SET_PAGE_THEME_MODE,
                    payload: theme,
                });
            }
        });

        // Mobile breakpoint
        const mobileBreakpoint = this.container.querySelector('#mobile-breakpoint');
        mobileBreakpoint.addEventListener('change', (e) => {
            const breakpoint = parseInt(e.target.value);
            if (breakpoint >= 320 && breakpoint <= 1440) {
                // Update CSS custom property
                document.documentElement.style.setProperty('--mobile-breakpoint', `${breakpoint}px`);
                console.log(`Mobile breakpoint updated to ${breakpoint}px`);
            }
        });

        // Preview mode switcher
        const previewModeSwitcher = this.container.querySelector('.preview-mode-switcher');
        previewModeSwitcher.addEventListener('click', (e) => {
            if (e.target.matches('.mode-button')) {
                const mode = e.target.dataset.mode;
                this.container.querySelectorAll('.mode-button').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Apply preview mode
                this.applyPreviewMode(mode);
            }
        });

        // Preset buttons
        const presetButtons = this.container.querySelector('.preset-buttons');
        presetButtons.addEventListener('click', (e) => {
            if (e.target.matches('.preset-btn')) {
                const preset = e.target.dataset.preset;
                this.applyPreset(preset);
            }
        });

        // Action buttons
        this.container.querySelector('#validate-theme-btn')?.addEventListener('click', () => this.validateTheme());
        this.container.querySelector('#reload-theme-btn')?.addEventListener('click', () => this.reloadTheme());
        this.container.querySelector('#export-tokens-btn')?.addEventListener('click', () => this.exportTokens());
        this.container.querySelector('#edit-theme-btn')?.addEventListener('click', () => this.toggleThemeEditor());

        // Theme Editor Events
        this.attachThemeEditorListeners();
    }

    applyPreviewMode(mode) {
        const previewIframe = document.querySelector('#preview-panel iframe, #content-preview-panel iframe');
        if (previewIframe) {
            if (mode === 'mobile') {
                previewIframe.style.width = '1024px';
                previewIframe.style.maxWidth = '1024px';
                previewIframe.style.margin = '0 auto';
                previewIframe.style.border = '1px solid var(--color-border)';
            } else {
                previewIframe.style.width = '100%';
                previewIframe.style.maxWidth = 'none';
                previewIframe.style.margin = '0';
                previewIframe.style.border = 'none';
            }
        }
    }

    applyPreset(preset) {
        const presetPaths = {
            classic: '/themes/classic',
            modern: '/themes/modern',
            minimal: '/themes/minimal',
            custom: '/themes/custom'
        };

        const path = presetPaths[preset];
        if (path) {
            dispatch({
                type: ActionTypes.SETTINGS_SET_PAGE_THEME_DIR,
                payload: path,
            });
            
            // Update input field
            this.container.querySelector('#theme-dir-input').value = path;
        }
    }

    async validateTheme() {
        const settings = appStore.getState().settings || {};
        const pageTheme = settings.pageTheme || {};
        
        if (!pageTheme.themeDir) {
            alert('Please set a theme directory first.');
            return;
        }

        const coreUrl = `${pageTheme.themeDir}/core.css`;
        const lightUrl = `${pageTheme.themeDir}/light.css`;
        const darkUrl = `${pageTheme.themeDir}/dark.css`;

        try {
            const [coreExists, lightExists, darkExists] = await Promise.all([
                this.checkFileExists(coreUrl),
                this.checkFileExists(lightUrl),
                this.checkFileExists(darkUrl)
            ]);

            const results = [
                `Core theme (${coreUrl}): ${coreExists ? '✅' : '❌'}`,
                `Light mode (${lightUrl}): ${lightExists ? '✅' : '❌'}`,
                `Dark mode (${darkUrl}): ${darkExists ? '✅' : '❌'}`
            ];

            alert(`Theme Validation Results:\n\n${results.join('\n')}`);
        } catch (error) {
            alert(`Validation failed: ${error.message}`);
        }
    }

    async checkFileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    reloadTheme() {
        // Force theme reload by toggling mode
        const settings = appStore.getState().settings || {};
        const pageTheme = settings.pageTheme || {};
        
        dispatch({
            type: ActionTypes.SETTINGS_SET_PAGE_THEME_MODE,
            payload: pageTheme.themeMode === 'light' ? 'dark' : 'light',
        });
        
        setTimeout(() => {
            dispatch({
                type: ActionTypes.SETTINGS_SET_PAGE_THEME_MODE,
                payload: pageTheme.themeMode,
            });
        }, 100);
    }

    exportTokens() {
        // Extract CSS variables from the current theme
        const computedStyle = getComputedStyle(document.documentElement);
        const tokens = {};
        
        // Get all CSS custom properties
        for (let i = 0; i < document.styleSheets.length; i++) {
            try {
                const sheet = document.styleSheets[i];
                for (let j = 0; j < sheet.cssRules.length; j++) {
                    const rule = sheet.cssRules[j];
                    if (rule.style) {
                        for (let k = 0; k < rule.style.length; k++) {
                            const prop = rule.style[k];
                            if (prop.startsWith('--')) {
                                tokens[prop] = rule.style.getPropertyValue(prop);
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip cross-origin stylesheets
            }
        }

        const tokenJson = JSON.stringify(tokens, null, 2);
        const blob = new Blob([tokenJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'design-tokens.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    updateThemeStatus() {
        // This would be called by the theme manager to update status
        const settings = appStore.getState().settings || {};
        const pageTheme = settings.pageTheme || {};
        
        const currentDisplay = this.container.querySelector('#current-theme-display');
        const loadedFilesDisplay = this.container.querySelector('#loaded-files-display');
        
        if (currentDisplay) {
            currentDisplay.textContent = pageTheme.themeDir ? 
                `${pageTheme.themeDir} (${pageTheme.themeMode})` : 'None';
        }
        
        if (loadedFilesDisplay && window.pageThemeManager) {
            const status = window.pageThemeManager.getThemeStatus();
            loadedFilesDisplay.textContent = status.loadedThemes.length.toString();
        }
    }

    subscribeToStateChanges() {
        this.unsubscribe = appStore.subscribe((newState, oldState) => {
            const newSettings = newState.settings || {};
            const oldSettings = oldState.settings || {};

            const newPageTheme = newSettings.pageTheme || {};
            const oldPageTheme = oldSettings.pageTheme || {};
            
            if (newPageTheme.themeDir !== oldPageTheme.themeDir) {
                this.container.querySelector('#theme-dir-input').value = newPageTheme.themeDir || '';
            }

            if (newPageTheme.themeMode !== oldPageTheme.themeMode) {
                this.container.querySelectorAll('.theme-button').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.theme === newPageTheme.themeMode);
                });
            }

            this.updateThemeStatus();
        });
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    toggleThemeEditor() {
        const editorSection = this.container.querySelector('#theme-editor-section');
        const editBtn = this.container.querySelector('#edit-theme-btn');
        
        if (editorSection.style.display === 'none') {
            editorSection.style.display = 'block';
            editBtn.textContent = 'Hide Editor';
            this.initializeThemeEditor();
        } else {
            editorSection.style.display = 'none';
            editBtn.textContent = 'Edit Theme';
        }
    }

    attachThemeEditorListeners() {
        // Typography controls
        const h1Size = this.container.querySelector('#h1-size');
        const bodySize = this.container.querySelector('#body-size');
        const baseSpacing = this.container.querySelector('#base-spacing');

        [h1Size, bodySize, baseSpacing].forEach(control => {
            if (control) {
                control.addEventListener('input', (e) => {
                    const valueDisplay = e.target.nextElementSibling;
                    if (valueDisplay) {
                        valueDisplay.textContent = `${e.target.value}px`;
                    }
                    this.updateLivePreview();
                });
            }
        });

        // Color controls
        ['primary-color', 'bg-light', 'bg-dark', 'text-light', 'text-dark'].forEach(id => {
            const colorInput = this.container.querySelector(`#${id}`);
            if (colorInput) {
                colorInput.addEventListener('input', (e) => {
                    const valueDisplay = e.target.nextElementSibling;
                    if (valueDisplay) {
                        valueDisplay.textContent = e.target.value;
                    }
                    this.updateLivePreview();
                });
            }
        });

        // Generate buttons
        this.container.querySelector('#generate-core-btn')?.addEventListener('click', () => this.generateCoreCSS());
        this.container.querySelector('#generate-light-btn')?.addEventListener('click', () => this.generateLightCSS());
        this.container.querySelector('#generate-dark-btn')?.addEventListener('click', () => this.generateDarkCSS());
        this.container.querySelector('#download-theme-btn')?.addEventListener('click', () => this.downloadCompleteTheme());
    }

    initializeThemeEditor() {
        // Load current theme values into editor
        const computedStyle = getComputedStyle(document.documentElement);
        
        // Set current values
        const h1Size = this.container.querySelector('#h1-size');
        const bodySize = this.container.querySelector('#body-size');
        
        if (h1Size) {
            const currentH1 = parseInt(computedStyle.getPropertyValue('--font-size-h1')) || 36;
            h1Size.value = currentH1;
            h1Size.nextElementSibling.textContent = `${currentH1}px`;
        }
        
        this.updateLivePreview();
    }

    updateLivePreview() {
        const preview = this.container.querySelector('#live-preview');
        if (!preview) return;

        const h1Size = this.container.querySelector('#h1-size')?.value || 36;
        const bodySize = this.container.querySelector('#body-size')?.value || 16;
        const primaryColor = this.container.querySelector('#primary-color')?.value || '#2563eb';

        preview.style.setProperty('--preview-h1-size', `${h1Size}px`);
        preview.style.setProperty('--preview-body-size', `${bodySize}px`);
        preview.style.setProperty('--preview-primary', primaryColor);
    }

    generateCoreCSS() {
        const h1Size = this.container.querySelector('#h1-size')?.value || 36;
        const bodySize = this.container.querySelector('#body-size')?.value || 16;
        const baseSpacing = this.container.querySelector('#base-spacing')?.value || 4;
        const mobileBp = this.container.querySelector('#mobile-bp-editor')?.value || 1024;

        const coreCSS = `/* Generated Core Theme */
:root {
  /* Typography */
  --font-size-h1: ${h1Size}px;
  --font-size-body: ${bodySize}px;
  --font-weight-heading: 600;
  --font-weight-body: 400;
  --line-height-heading: 1.25;
  --line-height-body: 1.5;
  
  /* Spacing */
  --space-base: ${baseSpacing}px;
  --space-sm: calc(var(--space-base) * 2);
  --space-md: calc(var(--space-base) * 4);
  --space-lg: calc(var(--space-base) * 6);
  
  /* Layout */
  --mobile-breakpoint: ${mobileBp}px;
}

/* Responsive overrides */
@media (max-width: ${mobileBp}px) {
  :root {
    --font-size-h1: calc(${h1Size}px * 0.8);
    --font-size-body: calc(${bodySize}px * 0.9);
    --space-md: calc(var(--space-base) * 3);
  }
}

/* Typography application */
h1 { font-size: var(--font-size-h1); font-weight: var(--font-weight-heading); line-height: var(--line-height-heading); }
p, body { font-size: var(--font-size-body); font-weight: var(--font-weight-body); line-height: var(--line-height-body); }
`;

        this.downloadFile('core.css', coreCSS);
    }

    generateLightCSS() {
        const bgLight = this.container.querySelector('#bg-light')?.value || '#ffffff';
        const textLight = this.container.querySelector('#text-light')?.value || '#171717';
        const primaryColor = this.container.querySelector('#primary-color')?.value || '#2563eb';

        const lightCSS = `/* Generated Light Theme */
:root,
[data-theme="light"] {
  --color-background: ${bgLight};
  --color-foreground: ${textLight};
  --color-primary: ${primaryColor};
  --color-border: #e5e5e5;
  --color-muted: #737373;
}
`;

        this.downloadFile('light.css', lightCSS);
    }

    generateDarkCSS() {
        const bgDark = this.container.querySelector('#bg-dark')?.value || '#0a0a0a';
        const textDark = this.container.querySelector('#text-dark')?.value || '#fafafa';
        const primaryColor = this.container.querySelector('#primary-color')?.value || '#2563eb';

        const darkCSS = `/* Generated Dark Theme */
[data-theme="dark"] {
  --color-background: ${bgDark};
  --color-foreground: ${textDark};
  --color-primary: ${primaryColor};
  --color-border: #404040;
  --color-muted: #a3a3a3;
}
`;

        this.downloadFile('dark.css', darkCSS);
    }

    downloadCompleteTheme() {
        // Generate all three files and package them
        const files = {
            'core.css': this.generateCoreCSS(true),
            'light.css': this.generateLightCSS(true),
            'dark.css': this.generateDarkCSS(true)
        };

        // Create a simple archive format (could be enhanced with JSZip)
        let archive = '/* DevPages Theme Package */\n\n';
        Object.entries(files).forEach(([filename, content]) => {
            archive += `/* === ${filename} === */\n${content}\n\n`;
        });

        this.downloadFile('complete-theme.css', archive);
    }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

panelRegistry.register({
    id: PANEL_ID,
    title: 'Page Design Tokens',
    component: DesignTokensPanel,
    isCollapsed: true,
});

export { DesignTokensPanel }; 