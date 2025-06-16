/**
 * client/settings/ThemeDesignPanel.js
 * Enhanced Theme & Design panel that integrates with design tokens structure
 * Manages MD_DIR/themes/ directory and generates design-tokens.js/css files
 */

import { panelRegistry } from './panelRegistry.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelEventBus, PanelEvents, createPanelMixin } from './panelEventBus.js';

const PANEL_ID = 'theme-design-panel';

function logThemeDesign(message, level = 'info') {
    const type = 'THEME_DESIGN';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export class ThemeDesignPanel {
    constructor(container) {
        if (!container) {
            console.error('Container not provided for ThemeDesignPanel');
            return;
        }
        this.container = container;
        this.designTokens = {};
        this.currentPreset = null;
        
        // Get initial state from store
        const state = appStore.getState();
        const designTokensState = state.settings?.designTokens || {};
        
        this.themesDirectory = designTokensState.tokensDirectory || 'MD_DIR/themes';
        this.currentTheme = designTokensState.activeTheme || 'corporate-blue';
        this.previewMode = designTokensState.themeVariant || 'light';
        
        // Subscribe to store changes
        this.storeUnsubscribe = appStore.subscribe((newState, prevState) => {
            if (newState.settings?.designTokens !== prevState.settings?.designTokens) {
                this.handleStoreUpdate(newState.settings.designTokens);
            }
        });

        // Setup event bus
        this.setupEventBus();
        this.setupEventHandlers();

        this.injectStyles();
        this.render();
        this.attachEventListeners();
        this.loadDesignTokens();
    }

    // ===== EVENT BUS INTEGRATION =====
    
    setupEventBus() {
        Object.assign(this, createPanelMixin(PANEL_ID));
        this.setupEventBus();
    }
    
    setupEventHandlers() {
        this.on(PanelEvents.PANEL_VALIDATION_REQUEST, this.handleValidationRequest.bind(this));
        this.on(PanelEvents.PUBLISH_COLLECT_DATA, this.handlePublishDataRequest.bind(this));
    }
    
    handleValidationRequest(message) {
        const { validationType } = message.data;
        
        if (validationType === 'theme' || validationType === 'all') {
            this.validateDesignTokensForRequest(message);
        }
    }
    
    async validateDesignTokensForRequest(originalMessage) {
        try {
            const errors = [];
            const warnings = [];
            
            // Check if themes directory is set
            if (!this.themesDirectory) {
                errors.push('Themes directory not configured');
            }
            
            // Check if design tokens are loaded
            if (Object.keys(this.designTokens).length === 0) {
                warnings.push('No design tokens loaded');
            }
            
            // Check for required token categories
            const requiredCategories = ['colors', 'typography', 'spacing'];
            requiredCategories.forEach(category => {
                if (!this.designTokens[category]) {
                    warnings.push(`Missing ${category} tokens`);
                }
            });
            
            this.respond(originalMessage, {
                isValid: errors.length === 0,
                errors,
                warnings,
                designTokensData: {
                    themesDirectory: this.themesDirectory,
                    tokenCategories: Object.keys(this.designTokens),
                    currentPreset: this.currentPreset
                }
            });
        } catch (error) {
            this.respond(originalMessage, {
                isValid: false,
                errors: [`Design tokens validation failed: ${error.message}`],
                warnings: []
            });
        }
    }
    
    handlePublishDataRequest(message) {
        const publishData = {
            type: 'design-tokens',
            themesDirectory: this.themesDirectory,
            designTokens: this.designTokens,
            currentPreset: this.currentPreset,
            generatedFiles: this.getGeneratedFilesList(),
            timestamp: Date.now()
        };
        
        this.respond(message, publishData);
    }

    injectStyles() {
        if (!document.getElementById('theme-design-panel-styles')) {
            const link = document.createElement('link');
            link.id = 'theme-design-panel-styles';
            link.rel = 'stylesheet';
            link.href = '/client/settings/DesignerThemePanel.css'; // Reuse existing styles
            document.head.appendChild(link);
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="theme-design-panel-content">
                <!-- Directory Configuration -->
                <div class="design-section">
                    <h4>Themes Directory</h4>
                    <div class="setting-row">
                        <label for="themes-dir">Directory:</label>
                        <input type="text" id="themes-dir" value="${this.themesDirectory}" placeholder="MD_DIR/themes">
                        <button id="scan-btn" class="action-btn small">Scan</button>
                    </div>
                    <div class="directory-status" id="directory-status">
                        <span class="status-indicator">●</span>
                        <span class="status-text">Using: ${this.themesDirectory}</span>
                    </div>
                </div>

                <!-- Active Theme Selection -->
                <div class="design-section">
                    <h4>Active Theme</h4>
                    <div class="theme-selector">
                        ${this.renderThemeSelector()}
                    </div>
                </div>

                <!-- Theme Structure -->
                <div class="design-section">
                    <h4>Theme Structure</h4>
                    <div class="theme-structure">
                        ${this.renderThemeStructure()}
                    </div>
                </div>
                
                <!-- File Generation -->
                <div class="design-section">
                    <h4>File Generation</h4>
                    <div class="generation-controls">
                        <button id="generate-core" class="action-btn">Generate core.js</button>
                        <button id="generate-light" class="action-btn">Generate light.js</button>
                        <button id="generate-dark" class="action-btn">Generate dark.js</button>
                        <button id="generate-all" class="action-btn primary">Generate All Files</button>
                    </div>
                    <div class="file-list">
                        ${this.renderGeneratedFiles()}
                    </div>
                </div>

                <!-- Theme Preview -->
                <div class="design-section">
                    <h4>Live Preview</h4>
                    <div class="theme-preview">
                        ${this.renderThemePreview()}
                    </div>
                </div>
            </div>
        `;
    }

    renderThemeSelector() {
        const availableThemes = [
            { id: 'corporate-blue', name: 'Corporate Blue', color: '#0066cc' },
            { id: 'nature-green', name: 'Nature Green', color: '#059669' },
            { id: 'sunset-orange', name: 'Sunset Orange', color: '#ea580c' },
            { id: 'royal-purple', name: 'Royal Purple', color: '#8b5cf6' },
            { id: 'minimal-gray', name: 'Minimal Gray', color: '#374151' }
        ];

        return `
            <div class="theme-grid">
                ${availableThemes.map(theme => `
                    <div class="theme-card ${this.currentTheme === theme.id ? 'active' : ''}" data-theme="${theme.id}">
                        <div class="theme-color" style="background-color: ${theme.color}"></div>
                        <div class="theme-info">
                            <div class="theme-name">${theme.name}</div>
                            <div class="theme-files">
                                <span class="file-indicator ${this.hasFile(theme.id, 'core') ? 'exists' : 'missing'}">core.js</span>
                                <span class="file-indicator ${this.hasFile(theme.id, 'light') ? 'exists' : 'missing'}">light.js</span>
                                <span class="file-indicator ${this.hasFile(theme.id, 'dark') ? 'exists' : 'missing'}">dark.js</span>
                            </div>
                        </div>
                        <button class="select-theme-btn" data-theme="${theme.id}">
                            ${this.currentTheme === theme.id ? 'Active' : 'Select'}
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="theme-actions">
                <button id="create-theme-btn" class="action-btn">Create New Theme</button>
                <button id="duplicate-theme-btn" class="action-btn">Duplicate Theme</button>
            </div>
        `;
    }

    renderThemeStructure() {
        if (!this.currentTheme) {
            return '<p class="no-theme">No theme selected</p>';
        }

        return `
            <div class="structure-display">
                <div class="structure-header">
                    <h5>${this.currentTheme}/</h5>
                    <span class="structure-path">${this.themesDirectory}/${this.currentTheme}/</span>
                </div>
                <div class="structure-files">
                    <div class="structure-file">
                        <span class="file-icon">📄</span>
                        <span class="file-name">core.js</span>
                        <span class="file-desc">Base tokens (colors, typography, spacing)</span>
                        <button class="edit-file-btn" data-file="core">Edit</button>
                    </div>
                    <div class="structure-file">
                        <span class="file-icon">☀️</span>
                        <span class="file-name">light.js</span>
                        <span class="file-desc">Light theme semantic colors</span>
                        <button class="edit-file-btn" data-file="light">Edit</button>
                    </div>
                    <div class="structure-file">
                        <span class="file-icon">🌙</span>
                        <span class="file-name">dark.js</span>
                        <span class="file-desc">Dark theme semantic colors</span>
                        <button class="edit-file-btn" data-file="dark">Edit</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderThemePreview() {
        return `
            <div class="preview-modes">
                <button class="preview-mode-btn active" data-mode="light">☀️ Light</button>
                <button class="preview-mode-btn" data-mode="dark">🌙 Dark</button>
            </div>
            <div class="preview-content" data-preview-mode="light">
                <div class="preview-card">
                    <div class="preview-nav">
                        <span>DevPages</span>
                        <button class="preview-btn">Settings</button>
                    </div>
                    <div class="preview-body">
                        <h3>Preview Heading</h3>
                        <p>This preview shows how your design tokens will look in practice. 
                           Changes are applied in real-time as you edit the theme files.</p>
                        <div class="preview-buttons">
                            <button class="preview-btn primary">Primary Button</button>
                            <button class="preview-btn secondary">Secondary Button</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    hasFile(themeId, fileType) {
        // In real implementation, this would check if the file exists
        // For now, simulate some themes having files
        const existingFiles = {
            'corporate-blue': ['core', 'light', 'dark'],
            'nature-green': ['core', 'light'],
            'sunset-orange': ['core'],
            'royal-purple': [],
            'minimal-gray': ['core', 'light', 'dark']
        };
        
        return existingFiles[themeId]?.includes(fileType) || false;
    }

    renderGeneratedFiles() {
        if (!this.currentTheme) {
            return '<p class="no-files">Select a theme to see generated files</p>';
        }

        const files = [
            { name: 'core.js', desc: 'Base design tokens', exists: this.hasFile(this.currentTheme, 'core') },
            { name: 'light.js', desc: 'Light theme variant', exists: this.hasFile(this.currentTheme, 'light') },
            { name: 'dark.js', desc: 'Dark theme variant', exists: this.hasFile(this.currentTheme, 'dark') }
        ];

        return `
            <div class="generated-files">
                ${files.map(file => `
                    <div class="generated-file ${file.exists ? 'exists' : 'missing'}">
                        <span class="file-status">${file.exists ? '✓' : '○'}</span>
                        <span class="file-name">${this.currentTheme}/${file.name}</span>
                        <span class="file-desc">${file.desc}</span>
                        <button class="download-file-btn" data-file="${file.name}">
                            ${file.exists ? 'Download' : 'Generate'}
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    attachEventListeners() {
        // Directory scanning
        this.container.querySelector('#scan-btn')?.addEventListener('click', () => {
            this.scanDirectory();
        });

        // Theme selection
        this.container.querySelectorAll('.select-theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const themeId = e.target.dataset.theme;
                this.selectTheme(themeId);
            });
        });

        // Theme creation
        this.container.querySelector('#create-theme-btn')?.addEventListener('click', () => {
            this.createNewTheme();
        });

        this.container.querySelector('#duplicate-theme-btn')?.addEventListener('click', () => {
            this.duplicateTheme();
        });

        // File generation
        this.container.querySelector('#generate-core')?.addEventListener('click', () => {
            this.generateCoreFile();
        });

        this.container.querySelector('#generate-light')?.addEventListener('click', () => {
            this.generateLightFile();
        });

        this.container.querySelector('#generate-dark')?.addEventListener('click', () => {
            this.generateDarkFile();
        });

        this.container.querySelector('#generate-all')?.addEventListener('click', () => {
            this.generateAllFiles();
        });

        // File editing
        this.container.querySelectorAll('.edit-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileType = e.target.dataset.file;
                this.editThemeFile(fileType);
            });
        });

        // Preview mode switching
        this.container.querySelectorAll('.preview-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchPreviewMode(mode);
            });
        });
    }

    scanDirectory() {
        const dirInput = this.container.querySelector('#themes-dir');
        const newDirectory = dirInput.value;
        
        // Dispatch action instead of direct state change
        dispatch({
            type: ActionTypes.SETTINGS_SET_DESIGN_TOKENS_DIR,
            payload: newDirectory
        });
        
        console.log('Scanning directory:', newDirectory);
        alert(`Scanning ${newDirectory} for design tokens...`);
    }

    generateTokensJS() {
        const content = `// Generated design tokens
export const designTokens = {
  colors: {
    primary: '#2563eb',
    secondary: '#64748b'
  }
};`;
        this.downloadFile('design-tokens.js', content);
    }

    generateTokensCSS() {
        const lightCSS = this.generateThemeCSS('light');
        const darkCSS = this.generateThemeCSS('dark');
        
        const content = `/* Generated Design Tokens CSS */
/* Theme: ${this.currentTheme} */

/* Light Theme */
:root[data-theme="${this.currentTheme}-light"] {
${lightCSS}
}

/* Dark Theme */
:root[data-theme="${this.currentTheme}-dark"] {
${darkCSS}
}

/* Default theme (fallback) */
:root {
${lightCSS}
}

/* System preference support */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${darkCSS}
  }
}`;
        
        this.downloadFile('design-tokens.css', content);
    }

    generateThemeCSS(variant) {
        const tokens = variant === 'dark' ? this.generateDarkTokensObject() : this.generateLightTokensObject();
        
        let css = '';
        
        // Brand colors
        if (tokens.colors?.brand) {
            css += '  /* Brand Colors */\n';
            Object.entries(tokens.colors.brand).forEach(([key, value]) => {
                css += `  --color-brand-${key}: ${value};\n`;
            });
            css += '\n';
        }
        
        // Semantic colors
        if (tokens.semantic?.background) {
            css += '  /* Background Colors */\n';
            Object.entries(tokens.semantic.background).forEach(([key, value]) => {
                css += `  --color-background-${key}: ${value};\n`;
            });
            css += '\n';
        }
        
        if (tokens.semantic?.foreground) {
            css += '  /* Foreground Colors */\n';
            Object.entries(tokens.semantic.foreground).forEach(([key, value]) => {
                css += `  --color-foreground-${key}: ${value};\n`;
            });
            css += '\n';
        }
        
        if (tokens.semantic?.border) {
            css += '  /* Border Colors */\n';
            Object.entries(tokens.semantic.border).forEach(([key, value]) => {
                css += `  --color-border-${key}: ${value};\n`;
            });
            css += '\n';
        }
        
        // Typography
        if (tokens.typography?.fontSize) {
            css += '  /* Typography - Font Sizes */\n';
            Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
                css += `  --font-size-${key}: ${value};\n`;
            });
            css += '\n';
        }
        
        if (tokens.typography?.fontWeight) {
            css += '  /* Typography - Font Weights */\n';
            Object.entries(tokens.typography.fontWeight).forEach(([key, value]) => {
                css += `  --font-weight-${key}: ${value};\n`;
            });
            css += '\n';
        }
        
        // Spacing
        if (tokens.spacing) {
            css += '  /* Spacing */\n';
            Object.entries(tokens.spacing).forEach(([key, value]) => {
                css += `  --spacing-${key}: ${value};\n`;
            });
            css += '\n';
        }
        
        return css.trim();
    }

    generateLightTokensObject() {
        const coreTokens = this.getThemeTokens(this.currentTheme);
        return {
            colors: coreTokens,
            semantic: {
                background: {
                    primary: '#f8fafc',
                    secondary: '#f1f5f9',
                    tertiary: '#e2e8f0',
                    elevated: '#ffffff'
                },
                foreground: {
                    primary: '#0f172a',
                    secondary: '#334155',
                    tertiary: '#475569',
                    muted: '#64748b'
                },
                border: {
                    primary: '#e2e8f0',
                    secondary: '#cbd5e1',
                    focus: coreTokens.brand?.primary || '#2563eb'
                }
            },
            typography: {
                fontSize: {
                    xs: '0.75rem',
                    sm: '0.875rem',
                    base: '1rem',
                    lg: '1.125rem',
                    xl: '1.25rem'
                },
                fontWeight: {
                    normal: '400',
                    medium: '500',
                    semibold: '600',
                    bold: '700'
                }
            },
            spacing: {
                1: '0.25rem',
                2: '0.5rem',
                3: '0.75rem',
                4: '1rem',
                5: '1.25rem',
                6: '1.5rem',
                8: '2rem'
            }
        };
    }

    generateDarkTokensObject() {
        const coreTokens = this.getThemeTokens(this.currentTheme);
        return {
            colors: coreTokens,
            semantic: {
                background: {
                    primary: '#0f172a',
                    secondary: '#1e293b',
                    tertiary: '#334155',
                    elevated: '#1e293b'
                },
                foreground: {
                    primary: '#f8fafc',
                    secondary: '#e2e8f0',
                    tertiary: '#cbd5e1',
                    muted: '#94a3b8'
                },
                border: {
                    primary: '#334155',
                    secondary: '#475569',
                    focus: coreTokens.brand?.accent || '#00aaff'
                }
            },
            typography: {
                fontSize: {
                    xs: '0.75rem',
                    sm: '0.875rem',
                    base: '1rem',
                    lg: '1.125rem',
                    xl: '1.25rem'
                },
                fontWeight: {
                    normal: '400',
                    medium: '500',
                    semibold: '600',
                    bold: '700'
                }
            },
            spacing: {
                1: '0.25rem',
                2: '0.5rem',
                3: '0.75rem',
                4: '1rem',
                5: '1.25rem',
                6: '1.5rem',
                8: '2rem'
            }
        };
    }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ===== CORE FUNCTIONALITY =====

    async loadDesignTokens() {
        if (!this.themesDirectory) return;

        try {
            // In a real implementation, this would load from the actual files
            // For now, we'll use default tokens
            this.designTokens = this.getDefaultDesignTokens();
            
            logThemeDesign('Design tokens loaded successfully');
            this.render();
            this.attachEventListeners();
            
            // Emit event that tokens were loaded
            this.emit(PanelEvents.THEME_CHANGED, {
                source: PANEL_ID,
                action: 'tokens_loaded',
                tokensDirectory: this.themesDirectory
            });
        } catch (error) {
            logThemeDesign(`Failed to load design tokens: ${error.message}`, 'error');
        }
    }

    getDefaultDesignTokens() {
        return {
            colors: {
                brand: {
                    primary: '#2563eb',
                    secondary: '#64748b',
                    accent: '#10b981',
                    warning: '#f59e0b',
                    error: '#ef4444',
                    success: '#22c55e'
                },
                background: {
                    primary: '#ffffff',
                    secondary: '#f8fafc',
                    tertiary: '#f1f5f9',
                    elevated: '#ffffff'
                },
                text: {
                    primary: '#0f172a',
                    secondary: '#475569',
                    tertiary: '#64748b',
                    muted: '#94a3b8'
                }
            },
            typography: {
                fontFamily: {
                    sans: ['Inter', 'system-ui', 'sans-serif'],
                    serif: ['Georgia', 'serif'],
                    mono: ['JetBrains Mono', 'Consolas', 'monospace']
                },
                fontSize: {
                    xs: '0.75rem',
                    sm: '0.875rem',
                    base: '1rem',
                    lg: '1.125rem',
                    xl: '1.25rem',
                    '2xl': '1.5rem'
                },
                fontWeight: {
                    normal: '400',
                    medium: '500',
                    semibold: '600',
                    bold: '700'
                }
            },
            spacing: {
                0: '0',
                1: '0.25rem',
                2: '0.5rem',
                3: '0.75rem',
                4: '1rem',
                5: '1.25rem',
                6: '1.5rem',
                8: '2rem'
            }
        };
    }

    // ===== STORE UPDATE HANDLER =====
    
    handleStoreUpdate(designTokensState) {
        const oldTheme = this.currentTheme;
        const oldVariant = this.previewMode;
        const oldDirectory = this.themesDirectory;
        
        this.currentTheme = designTokensState.activeTheme || 'corporate-blue';
        this.previewMode = designTokensState.themeVariant || 'light';
        this.themesDirectory = designTokensState.tokensDirectory || 'MD_DIR/themes';
        
        // Re-render if anything changed
        if (oldTheme !== this.currentTheme || oldVariant !== this.previewMode || oldDirectory !== this.themesDirectory) {
            this.render();
            this.attachEventListeners();
            this.loadThemeTokens(this.currentTheme);
        }
    }

    // ===== NEW FUNCTIONALITY METHODS =====

    selectTheme(themeId) {
        // Dispatch action instead of direct state change
        dispatch({
            type: ActionTypes.SETTINGS_SET_ACTIVE_DESIGN_THEME,
            payload: themeId
        });
        
        console.log(`Selected theme: ${themeId}`);
        
        // Load theme tokens
        this.loadThemeTokens(themeId);
    }

    createNewTheme() {
        const themeName = prompt('Enter new theme name:');
        if (themeName && themeName.trim()) {
            const cleanName = themeName.trim().toLowerCase().replace(/\s+/g, '-');
            console.log(`Creating new theme: ${cleanName}`);
            alert(`Creating new theme "${cleanName}" based on ${this.currentTheme}`);
            
            // Generate theme files
            this.generateThemeFiles(cleanName);
        }
    }

    duplicateTheme() {
        if (!this.currentTheme) {
            alert('Please select a theme to duplicate');
            return;
        }
        
        const newName = prompt(`Duplicate "${this.currentTheme}" as:`);
        if (newName && newName.trim()) {
            const cleanName = newName.trim().toLowerCase().replace(/\s+/g, '-');
            console.log(`Duplicating ${this.currentTheme} as ${cleanName}`);
            alert(`Duplicating "${this.currentTheme}" as "${cleanName}"`);
        }
    }

    generateCoreFile() {
        const content = this.generateCoreTokens();
        this.downloadFile(`${this.currentTheme}/core.js`, content);
        console.log(`Generated core.js for ${this.currentTheme}`);
    }

    generateLightFile() {
        const content = this.generateLightTokens();
        this.downloadFile(`${this.currentTheme}/light.js`, content);
        console.log(`Generated light.js for ${this.currentTheme}`);
    }

    generateDarkFile() {
        const content = this.generateDarkTokens();
        this.downloadFile(`${this.currentTheme}/dark.js`, content);
        console.log(`Generated dark.js for ${this.currentTheme}`);
    }

    generateAllFiles() {
        this.generateCoreFile();
        this.generateLightFile();
        this.generateDarkFile();
        
        // Also generate the main design-tokens.js and active-theme.js
        this.downloadFile('design-tokens.js', this.generateMainTokensFile());
        this.downloadFile('active-theme.js', this.generateActiveThemeFile());
        
        alert(`Generated all files for theme: ${this.currentTheme}`);
    }

    editThemeFile(fileType) {
        console.log(`Editing ${fileType}.js for ${this.currentTheme}`);
        alert(`Opening editor for ${this.currentTheme}/${fileType}.js\n\nThis would open a code editor in a real implementation.`);
    }

    switchPreviewMode(mode) {
        // Dispatch action instead of direct state change
        dispatch({
            type: ActionTypes.SETTINGS_SET_DESIGN_THEME_VARIANT,
            payload: mode
        });
        
        console.log(`Switched preview to ${mode} mode`);
        
        // Update UI immediately (store update will handle the rest)
        this.updatePreviewModeUI(mode);
    }
    
    updatePreviewModeUI(mode) {
        // Update preview mode buttons
        this.container.querySelectorAll('.preview-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update preview content
        const previewContent = this.container.querySelector('.preview-content');
        if (previewContent) {
            previewContent.setAttribute('data-preview-mode', mode);
            
            // Apply theme to preview (simulate real theme application)
            this.applyPreviewTheme(mode);
        }
    }

    applyPreviewTheme(variant) {
        // Generate CSS variables for the preview
        const tokens = variant === 'dark' ? this.generateDarkTokensObject() : this.generateLightTokensObject();
        
        // Apply CSS variables to the preview content
        const previewCard = this.container.querySelector('.preview-card');
        if (previewCard) {
            // Apply semantic colors
            if (tokens.semantic?.background) {
                previewCard.style.setProperty('--preview-bg-primary', tokens.semantic.background.primary);
                previewCard.style.setProperty('--preview-bg-secondary', tokens.semantic.background.secondary);
            }
            
            if (tokens.semantic?.foreground) {
                previewCard.style.setProperty('--preview-fg-primary', tokens.semantic.foreground.primary);
                previewCard.style.setProperty('--preview-fg-secondary', tokens.semantic.foreground.secondary);
            }
            
            if (tokens.semantic?.border) {
                previewCard.style.setProperty('--preview-border-primary', tokens.semantic.border.primary);
            }
            
            if (tokens.colors?.brand) {
                previewCard.style.setProperty('--preview-brand-primary', tokens.colors.brand.primary);
            }
        }
    }

    loadThemeTokens(themeId) {
        // In real implementation, would load actual theme files
        console.log(`Loading tokens for theme: ${themeId}`);
        
        // Simulate loading theme-specific tokens
        this.designTokens = this.getThemeTokens(themeId);
    }

    getThemeTokens(themeId) {
        // Return theme-specific tokens based on the examples in the documentation
        const themeTokens = {
            'corporate-blue': {
                brand: { primary: '#0066cc', secondary: '#004499', accent: '#00aaff' },
                name: 'Corporate Blue'
            },
            'nature-green': {
                brand: { primary: '#059669', secondary: '#047857', accent: '#10b981' },
                name: 'Nature Green'
            },
            'sunset-orange': {
                brand: { primary: '#ea580c', secondary: '#c2410c', accent: '#fb923c' },
                name: 'Sunset Orange'
            },
            'royal-purple': {
                brand: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa' },
                name: 'Royal Purple'
            },
            'minimal-gray': {
                brand: { primary: '#374151', secondary: '#6b7280', accent: '#9ca3af' },
                name: 'Minimal Gray'
            }
        };
        
        return themeTokens[themeId] || themeTokens['corporate-blue'];
    }

    generateCoreTokens() {
        return `// ${this.currentTheme} - Core Design Tokens
export const coreTokens = {
  colors: {
    brand: {
      primary: '${this.designTokens.brand?.primary || '#2563eb'}',
      secondary: '${this.designTokens.brand?.secondary || '#64748b'}',
      accent: '${this.designTokens.brand?.accent || '#10b981'}',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    },
    
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a'
    }
  },
  
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Georgia', 'serif'],
      mono: ['JetBrains Mono', 'Consolas', 'monospace']
    },
    
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem'
    },
    
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    }
  },
  
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem'
  }
};`;
    }

    generateLightTokens() {
        return `// ${this.currentTheme} - Light Theme Variant
import { coreTokens } from './core.js';

export const lightTheme = {
  ...coreTokens,
  
  semantic: {
    background: {
      primary: coreTokens.colors.neutral[50],
      secondary: coreTokens.colors.neutral[100],
      tertiary: coreTokens.colors.neutral[200],
      elevated: '#ffffff'
    },
    
    foreground: {
      primary: coreTokens.colors.neutral[900],
      secondary: coreTokens.colors.neutral[700],
      tertiary: coreTokens.colors.neutral[600],
      muted: coreTokens.colors.neutral[500]
    },
    
    border: {
      primary: coreTokens.colors.neutral[200],
      secondary: coreTokens.colors.neutral[300],
      focus: coreTokens.colors.brand.primary
    }
  }
};`;
    }

    generateDarkTokens() {
        return `// ${this.currentTheme} - Dark Theme Variant
import { coreTokens } from './core.js';

export const darkTheme = {
  ...coreTokens,
  
  semantic: {
    background: {
      primary: coreTokens.colors.neutral[900],
      secondary: coreTokens.colors.neutral[800],
      tertiary: coreTokens.colors.neutral[700],
      elevated: coreTokens.colors.neutral[800]
    },
    
    foreground: {
      primary: coreTokens.colors.neutral[50],
      secondary: coreTokens.colors.neutral[200],
      tertiary: coreTokens.colors.neutral[300],
      muted: coreTokens.colors.neutral[400]
    },
    
    border: {
      primary: coreTokens.colors.neutral[700],
      secondary: coreTokens.colors.neutral[600],
      focus: coreTokens.colors.brand.accent
    }
  }
};`;
    }

    generateMainTokensFile() {
        return `// Main design tokens aggregator
import { getActiveTheme } from './active-theme.js';

const activeTheme = getActiveTheme();

export { coreTokens } from \`./\${activeTheme}/core.js\`;
export { lightTheme } from \`./\${activeTheme}/light.js\`;
export { darkTheme } from \`./\${activeTheme}/dark.js\`;

export { getActiveTheme, setActiveTheme, getAvailableThemes } from './active-theme.js';

// Theme application utilities (integrates with DevPages state management)
export function applyTheme(themeName, variant = 'light') {
  // Use DevPages dispatch system instead of direct localStorage
  if (typeof window.dispatch === 'function') {
    window.dispatch({
      type: 'SETTINGS_SET_ACTIVE_DESIGN_THEME',
      payload: themeName
    });
    
    window.dispatch({
      type: 'SETTINGS_SET_DESIGN_THEME_VARIANT', 
      payload: variant
    });
  } else {
    // Fallback for standalone usage
    const fullThemeName = \`\${themeName}-\${variant}\`;
    document.documentElement.setAttribute('data-theme', fullThemeName);
    localStorage.setItem('devpages_active_theme', themeName);
    localStorage.setItem('devpages_theme_variant', variant);
  }
}

export function initializeTheme() {
  // Check if DevPages store is available
  if (typeof window.appStore === 'object') {
    const state = window.appStore.getState();
    const designTokens = state.settings?.designTokens || {};
    const savedTheme = designTokens.activeTheme || 'corporate-blue';
    const savedVariant = designTokens.themeVariant || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    applyTheme(savedTheme, savedVariant);
  } else {
    // Fallback for standalone usage
    const savedTheme = localStorage.getItem('devpages_active_theme') || 'corporate-blue';
    const savedVariant = localStorage.getItem('devpages_theme_variant') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    applyTheme(savedTheme, savedVariant);
  }
}

export default {
  activeTheme,
  applyTheme,
  initializeTheme
};`;
    }

    generateActiveThemeFile() {
        return `// Active theme management
const ACTIVE_THEME_KEY = 'devpages_active_theme';
const DEFAULT_THEME = '${this.currentTheme}';

const AVAILABLE_THEMES = [
  'corporate-blue',
  'nature-green',
  'sunset-orange',
  'royal-purple',
  'minimal-gray'
];

export function getActiveTheme() {
  try {
    const saved = localStorage.getItem(ACTIVE_THEME_KEY);
    return saved && AVAILABLE_THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setActiveTheme(themeName) {
  if (!AVAILABLE_THEMES.includes(themeName)) {
    throw new Error(\`Theme "\${themeName}" not found\`);
  }
  
  try {
    localStorage.setItem(ACTIVE_THEME_KEY, themeName);
    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: themeName }
    }));
    return true;
  } catch {
    return false;
  }
}

export function getAvailableThemes() {
  return [...AVAILABLE_THEMES];
}`;
    }

    generateThemeFiles(themeName) {
        // Generate all three files for a new theme
        this.downloadFile(`${themeName}/core.js`, this.generateCoreTokens());
        this.downloadFile(`${themeName}/light.js`, this.generateLightTokens());
        this.downloadFile(`${themeName}/dark.js`, this.generateDarkTokens());
    }

    destroy() {
        if (this.destroyEventBus) {
            this.destroyEventBus();
        }
        
        // Clean up store subscription
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        
        logThemeDesign('ThemeDesignPanel destroyed');
    }
}

// DISABLED - Replaced by CssDesignPanel.js
// panelRegistry.register({
//     id: 'theme-design-container',
//     title: 'Theme & Design',
//     component: ThemeDesignPanel,
//     order: 4, // Before other theme panels
//     defaultCollapsed: false
// }); 