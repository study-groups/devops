/**
 * ThemeEditorPanel.js - Visual theme editor for creating and customizing themes
 * Extracted from the old DesignTokensPanel to provide dedicated theme editing functionality
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelRegistry } from '../../core/panelRegistry.js';

function logThemeEditor(message, level = 'info') {
    const type = 'THEME_EDITOR';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export class ThemeEditorPanel {
    constructor(parentElement) {
        this.containerElement = parentElement;
        this.stateUnsubscribe = null;
        
        // Theme editor state
        this.currentTheme = {
            typography: {
                headingFont: 'var(--font-family-sans)',
                bodyFont: 'var(--font-family-sans)',
                h1Size: 36,
                bodySize: 16
            },
            colors: {
                primary: '#2563eb',
                bgLight: '#ffffff',
                bgDark: '#0a0a0a',
                textLight: '#171717',
                textDark: '#fafafa'
            },
            spacing: {
                base: 4,
                mobileBreakpoint: 1024
            }
        };
        
        this.loadCSS();
        this.createPanelContent(parentElement);
        this.subscribeToState();
        this.initializeThemeEditor();
        
        logThemeEditor('ThemeEditorPanel initialized');
    }

    loadCSS() {
        const cssId = 'theme-editor-panel-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = '/client/settings/panels/css-design/ThemeEditorPanel.css';
            document.head.appendChild(link);
            logThemeEditor('Loaded ThemeEditorPanel.css');
        }
    }

    createPanelContent(parentElement) {
        parentElement.innerHTML = `
            <div class="theme-editor-panel-content">
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

                <!-- Live Preview Section -->
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

                <!-- Preset Themes -->
                <div class="editor-subsection">
                    <h5>Theme Presets</h5>
                    <div class="preset-buttons">
                        <button class="preset-btn" data-preset="minimal">Minimal</button>
                        <button class="preset-btn" data-preset="modern">Modern</button>
                        <button class="preset-btn" data-preset="classic">Classic</button>
                        <button class="preset-btn" data-preset="dark">Dark</button>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Typography controls
        document.getElementById('heading-font')?.addEventListener('change', (e) => {
            this.currentTheme.typography.headingFont = e.target.value;
            this.updateLivePreview();
        });

        document.getElementById('body-font')?.addEventListener('change', (e) => {
            this.currentTheme.typography.bodyFont = e.target.value;
            this.updateLivePreview();
        });

        document.getElementById('h1-size')?.addEventListener('input', (e) => {
            this.currentTheme.typography.h1Size = parseInt(e.target.value);
            e.target.nextElementSibling.textContent = `${e.target.value}px`;
            this.updateLivePreview();
        });

        document.getElementById('body-size')?.addEventListener('input', (e) => {
            this.currentTheme.typography.bodySize = parseInt(e.target.value);
            e.target.nextElementSibling.textContent = `${e.target.value}px`;
            this.updateLivePreview();
        });

        // Color controls
        document.getElementById('primary-color')?.addEventListener('input', (e) => {
            this.currentTheme.colors.primary = e.target.value;
            e.target.nextElementSibling.textContent = e.target.value;
            this.updateLivePreview();
        });

        document.getElementById('bg-light')?.addEventListener('input', (e) => {
            this.currentTheme.colors.bgLight = e.target.value;
            e.target.nextElementSibling.textContent = e.target.value;
            this.updateLivePreview();
        });

        document.getElementById('bg-dark')?.addEventListener('input', (e) => {
            this.currentTheme.colors.bgDark = e.target.value;
            e.target.nextElementSibling.textContent = e.target.value;
            this.updateLivePreview();
        });

        document.getElementById('text-light')?.addEventListener('input', (e) => {
            this.currentTheme.colors.textLight = e.target.value;
            e.target.nextElementSibling.textContent = e.target.value;
            this.updateLivePreview();
        });

        document.getElementById('text-dark')?.addEventListener('input', (e) => {
            this.currentTheme.colors.textDark = e.target.value;
            e.target.nextElementSibling.textContent = e.target.value;
            this.updateLivePreview();
        });

        // Spacing controls
        document.getElementById('base-spacing')?.addEventListener('input', (e) => {
            this.currentTheme.spacing.base = parseInt(e.target.value);
            e.target.nextElementSibling.textContent = `${e.target.value}px`;
            this.updateLivePreview();
        });

        document.getElementById('mobile-bp-editor')?.addEventListener('change', (e) => {
            this.currentTheme.spacing.mobileBreakpoint = parseInt(e.target.value);
            this.updateLivePreview();
        });

        // Generation buttons
        document.getElementById('generate-core-btn')?.addEventListener('click', () => {
            this.generateCoreCSS();
        });

        document.getElementById('generate-light-btn')?.addEventListener('click', () => {
            this.generateLightCSS();
        });

        document.getElementById('generate-dark-btn')?.addEventListener('click', () => {
            this.generateDarkCSS();
        });

        document.getElementById('download-theme-btn')?.addEventListener('click', () => {
            this.downloadCompleteTheme();
        });

        // Preset buttons
        const presetButtons = this.containerElement.querySelector('.preset-buttons');
        presetButtons?.addEventListener('click', (e) => {
            if (e.target.matches('.preset-btn')) {
                const preset = e.target.dataset.preset;
                this.applyPreset(preset);
            }
        });
    }

    initializeThemeEditor() {
        // Set initial values
        document.getElementById('heading-font').value = this.currentTheme.typography.headingFont;
        document.getElementById('body-font').value = this.currentTheme.typography.bodyFont;
        document.getElementById('h1-size').value = this.currentTheme.typography.h1Size;
        document.getElementById('body-size').value = this.currentTheme.typography.bodySize;
        
        document.getElementById('primary-color').value = this.currentTheme.colors.primary;
        document.getElementById('bg-light').value = this.currentTheme.colors.bgLight;
        document.getElementById('bg-dark').value = this.currentTheme.colors.bgDark;
        document.getElementById('text-light').value = this.currentTheme.colors.textLight;
        document.getElementById('text-dark').value = this.currentTheme.colors.textDark;
        
        document.getElementById('base-spacing').value = this.currentTheme.spacing.base;
        document.getElementById('mobile-bp-editor').value = this.currentTheme.spacing.mobileBreakpoint;
        
        this.updateLivePreview();
        logThemeEditor('Theme editor initialized with default values');
    }

    updateLivePreview() {
        const preview = document.getElementById('live-preview');
        if (!preview) return;

        // Apply current theme to preview
        preview.style.setProperty('--preview-heading-font', this.currentTheme.typography.headingFont);
        preview.style.setProperty('--preview-body-font', this.currentTheme.typography.bodyFont);
        preview.style.setProperty('--preview-h1-size', `${this.currentTheme.typography.h1Size}px`);
        preview.style.setProperty('--preview-body-size', `${this.currentTheme.typography.bodySize}px`);
        preview.style.setProperty('--preview-primary', this.currentTheme.colors.primary);
        preview.style.setProperty('--preview-bg-light', this.currentTheme.colors.bgLight);
        preview.style.setProperty('--preview-text-light', this.currentTheme.colors.textLight);
        preview.style.setProperty('--preview-spacing', `${this.currentTheme.spacing.base}px`);
    }

    applyPreset(preset) {
        logThemeEditor(`Applying preset: ${preset}`);
        
        const presets = {
            minimal: {
                typography: { headingFont: 'var(--font-family-sans)', bodyFont: 'var(--font-family-sans)', h1Size: 32, bodySize: 16 },
                colors: { primary: '#000000', bgLight: '#ffffff', bgDark: '#000000', textLight: '#000000', textDark: '#ffffff' },
                spacing: { base: 4, mobileBreakpoint: 768 }
            },
            modern: {
                typography: { headingFont: 'var(--font-family-sans)', bodyFont: 'var(--font-family-sans)', h1Size: 40, bodySize: 18 },
                colors: { primary: '#3b82f6', bgLight: '#f8fafc', bgDark: '#0f172a', textLight: '#1e293b', textDark: '#f1f5f9' },
                spacing: { base: 6, mobileBreakpoint: 1024 }
            },
            classic: {
                typography: { headingFont: 'var(--font-family-serif)', bodyFont: 'var(--font-family-serif)', h1Size: 36, bodySize: 16 },
                colors: { primary: '#dc2626', bgLight: '#fefefe', bgDark: '#1a1a1a', textLight: '#374151', textDark: '#e5e7eb' },
                spacing: { base: 4, mobileBreakpoint: 1024 }
            },
            dark: {
                typography: { headingFont: 'var(--font-family-sans)', bodyFont: 'var(--font-family-sans)', h1Size: 36, bodySize: 16 },
                colors: { primary: '#8b5cf6', bgLight: '#111827', bgDark: '#000000', textLight: '#f9fafb', textDark: '#f9fafb' },
                spacing: { base: 4, mobileBreakpoint: 1024 }
            }
        };

        if (presets[preset]) {
            this.currentTheme = { ...presets[preset] };
            this.initializeThemeEditor();
        }
    }

    generateCoreCSS() {
        const css = `/* Core Theme CSS - Generated by Theme Editor */
:root {
  /* Typography */
  --font-heading: ${this.currentTheme.typography.headingFont};
  --font-body: ${this.currentTheme.typography.bodyFont};
  --size-h1: ${this.currentTheme.typography.h1Size}px;
  --size-body: ${this.currentTheme.typography.bodySize}px;
  
  /* Colors */
  --color-primary: ${this.currentTheme.colors.primary};
  
  /* Spacing */
  --spacing-base: ${this.currentTheme.spacing.base}px;
  --breakpoint-mobile: ${this.currentTheme.spacing.mobileBreakpoint}px;
}

/* Base Typography */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

h1 { font-size: var(--size-h1); }

body, p, div {
  font-family: var(--font-body);
  font-size: var(--size-body);
}

/* Base Spacing */
.spacing-base { margin: var(--spacing-base); }
.padding-base { padding: var(--spacing-base); }

/* Mobile Breakpoint */
@media (max-width: var(--breakpoint-mobile)) {
  h1 { font-size: calc(var(--size-h1) * 0.8); }
  body { font-size: calc(var(--size-body) * 0.9); }
}`;

        this.downloadFile('core.css', css);
        logThemeEditor('Generated core.css');
    }

    generateLightCSS() {
        const css = `/* Light Theme CSS - Generated by Theme Editor */
:root {
  --color-background: ${this.currentTheme.colors.bgLight};
  --color-text: ${this.currentTheme.colors.textLight};
  --color-primary: ${this.currentTheme.colors.primary};
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
}

a {
  color: var(--color-primary);
}

button {
  background-color: var(--color-primary);
  color: var(--color-background);
  border: none;
  padding: calc(var(--spacing-base) / 2) var(--spacing-base);
  border-radius: 4px;
  font-family: var(--font-body);
}`;

        this.downloadFile('light.css', css);
        logThemeEditor('Generated light.css');
    }

    generateDarkCSS() {
        const css = `/* Dark Theme CSS - Generated by Theme Editor */
:root {
  --color-background: ${this.currentTheme.colors.bgDark};
  --color-text: ${this.currentTheme.colors.textDark};
  --color-primary: ${this.currentTheme.colors.primary};
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
}

a {
  color: var(--color-primary);
}

button {
  background-color: var(--color-primary);
  color: var(--color-background);
  border: none;
  padding: calc(var(--spacing-base) / 2) var(--spacing-base);
  border-radius: 4px;
  font-family: var(--font-body);
}`;

        this.downloadFile('dark.css', css);
        logThemeEditor('Generated dark.css');
    }

    downloadCompleteTheme() {
        const coreCSS = this.generateCoreCSS();
        const lightCSS = this.generateLightCSS();
        const darkCSS = this.generateDarkCSS();
        
        // Create a zip-like structure (simplified as concatenated file)
        const completeTheme = `/* Complete Theme Package - Generated by Theme Editor */

/* ========== CORE.CSS ========== */
${coreCSS}

/* ========== LIGHT.CSS ========== */
${lightCSS}

/* ========== DARK.CSS ========== */
${darkCSS}

/* ========== THEME METADATA ========== */
/*
Theme Configuration:
${JSON.stringify(this.currentTheme, null, 2)}
*/`;

        this.downloadFile('complete-theme.css', completeTheme);
        logThemeEditor('Downloaded complete theme package');
    }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logThemeEditor(`Downloaded: ${filename}`);
    }

    subscribeToState() {
        this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
            // React to theme-related state changes if needed
        });
    }

    destroy() {
        logThemeEditor('Destroying ThemeEditorPanel...');
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        this.containerElement = null;
        logThemeEditor('ThemeEditorPanel destroyed.');
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: 'theme-editor-container',
    title: 'Theme Editor',
    component: ThemeEditorPanel,
    order: 25,
    defaultCollapsed: true
}); 