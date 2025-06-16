/**
 * DesignerThemePanel.js - Designer-friendly theme customization panel
 * Provides UI controls for customizing CSS custom properties
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelRegistry } from './panelRegistry.js';

function logDesignerTheme(message, level = 'info') {
    const type = 'DESIGNER_THEME';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export class DesignerThemePanel {
    constructor(parentElement) {
        this.containerElement = parentElement;
        this.stateUnsubscribe = null;
        this.customThemeVars = {};
        
        this.createPanelContent(parentElement);
        this.subscribeToState();
        this.loadSavedCustomizations();
        
        logDesignerTheme('DesignerThemePanel initialized');
    }

    createPanelContent(parentElement) {
        parentElement.innerHTML = `
            <div class="designer-theme-content">
                <div class="theme-customization-section">
                    <h5>Brand Colors</h5>
                    <div class="color-customization-grid">
                        <div class="color-input-group">
                            <label for="brand-primary">Primary Brand</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="brand-primary" data-var="--brand-primary" value="#2563eb">
                                <input type="text" class="color-hex-input" data-var="--brand-primary" value="#2563eb" placeholder="#2563eb">
                            </div>
                        </div>
                        
                        <div class="color-input-group">
                            <label for="brand-secondary">Secondary Brand</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="brand-secondary" data-var="--brand-secondary" value="#525252">
                                <input type="text" class="color-hex-input" data-var="--brand-secondary" value="#525252" placeholder="#525252">
                            </div>
                        </div>
                        
                        <div class="color-input-group">
                            <label for="brand-accent">Accent Color</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="brand-accent" data-var="--brand-accent" value="#22c55e">
                                <input type="text" class="color-hex-input" data-var="--brand-accent" value="#22c55e" placeholder="#22c55e">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="theme-customization-section">
                    <h5>Navigation & Header</h5>
                    <div class="color-customization-grid">
                        <div class="color-input-group">
                            <label for="nav-background">Navigation Background</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="nav-background" data-var="--nav-background" value="#ffffff">
                                <input type="text" class="color-hex-input" data-var="--nav-background" value="#ffffff" placeholder="#ffffff">
                            </div>
                        </div>
                        
                        <div class="color-input-group">
                            <label for="nav-text">Navigation Text</label>
                            <div class="color-input-wrapper">
                                <input type="color" id="nav-text" data-var="--nav-text" value="#171717">
                                <input type="text" class="color-hex-input" data-var="--nav-text" value="#171717" placeholder="#171717">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="theme-customization-section">
                    <h5>Layout & Spacing</h5>
                    <div class="layout-controls-grid">
                        <div class="layout-input-group">
                            <label for="nav-height">Navigation Height</label>
                            <div class="range-input-wrapper">
                                <input type="range" id="nav-height" data-var="--nav-height" min="40" max="80" value="50" data-unit="px">
                                <span class="range-value">50px</span>
                            </div>
                        </div>
                        
                        <div class="layout-input-group">
                            <label for="sidebar-width">Sidebar Width</label>
                            <div class="range-input-wrapper">
                                <input type="range" id="sidebar-width" data-var="--sidebar-width" min="200" max="400" value="280" data-unit="px">
                                <span class="range-value">280px</span>
                            </div>
                        </div>
                        
                        <div class="layout-input-group">
                            <label for="border-radius-medium">Border Radius</label>
                            <div class="range-input-wrapper">
                                <input type="range" id="border-radius-medium" data-var="--border-radius-medium" min="0" max="20" value="6" data-unit="px">
                                <span class="range-value">6px</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="theme-customization-section">
                    <h5>Typography</h5>
                    <div class="typography-controls">
                        <div class="font-input-group">
                            <label for="font-family-ui">UI Font Family</label>
                            <select id="font-family-ui" data-var="--font-family-ui">
                                <option value="system-ui, -apple-system, sans-serif">System Default</option>
                                <option value="'Inter', sans-serif">Inter</option>
                                <option value="'Roboto', sans-serif">Roboto</option>
                                <option value="'Open Sans', sans-serif">Open Sans</option>
                                <option value="'Poppins', sans-serif">Poppins</option>
                                <option value="'Montserrat', sans-serif">Montserrat</option>
                            </select>
                        </div>
                        
                        <div class="font-input-group">
                            <label for="font-family-code">Code Font Family</label>
                            <select id="font-family-code" data-var="--font-family-code">
                                <option value="ui-monospace, 'SF Mono', Monaco, monospace">System Mono</option>
                                <option value="'Fira Code', monospace">Fira Code</option>
                                <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                                <option value="'Source Code Pro', monospace">Source Code Pro</option>
                                <option value="'Consolas', monospace">Consolas</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="theme-actions-section">
                    <h5>Theme Management</h5>
                    <div class="theme-actions">
                        <button class="theme-action-btn" id="preview-changes">
                            👁️ Preview Changes
                        </button>
                        <button class="theme-action-btn" id="save-theme">
                            💾 Save Theme
                        </button>
                        <button class="theme-action-btn" id="reset-theme">
                            🔄 Reset to Default
                        </button>
                        <button class="theme-action-btn" id="export-theme">
                            📤 Export CSS
                        </button>
                    </div>
                </div>

                <div class="theme-presets-section">
                    <h5>Quick Presets</h5>
                    <div class="theme-presets">
                        <button class="preset-btn" data-preset="corporate-blue">Corporate Blue</button>
                        <button class="preset-btn" data-preset="nature-green">Nature Green</button>
                        <button class="preset-btn" data-preset="sunset-orange">Sunset Orange</button>
                        <button class="preset-btn" data-preset="royal-purple">Royal Purple</button>
                        <button class="preset-btn" data-preset="minimal-gray">Minimal Gray</button>
                    </div>
                </div>

                <div class="theme-preview-section">
                    <h5>Live Preview</h5>
                    <div class="theme-preview-container">
                        <div class="preview-nav" style="background-color: var(--nav-background); color: var(--nav-text); height: var(--nav-height); padding: 8px 16px; border-bottom: 1px solid var(--nav-border); display: flex; align-items: center; justify-content: space-between;">
                            <span>Navigation Preview</span>
                            <button style="background-color: var(--button-primary-background); color: var(--button-primary-text); border: 1px solid var(--button-primary-border); padding: 4px 12px; border-radius: var(--border-radius-medium);">Button</button>
                        </div>
                        <div class="preview-content" style="background-color: var(--content-background); color: var(--content-text); padding: 16px; min-height: 100px;">
                            <h6 style="color: var(--brand-primary); margin-bottom: 8px;">Content Preview</h6>
                            <p style="margin-bottom: 12px;">This is how your content will look with the current theme settings.</p>
                            <a href="#" style="color: var(--preview-link);">Sample Link</a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Color inputs
        const colorInputs = this.containerElement.querySelectorAll('input[type="color"], .color-hex-input');
        colorInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleColorChange(e.target);
            });
        });

        // Range inputs
        const rangeInputs = this.containerElement.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleRangeChange(e.target);
            });
        });

        // Font selects
        const fontSelects = this.containerElement.querySelectorAll('select[data-var]');
        fontSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleFontChange(e.target);
            });
        });

        // Action buttons
        document.getElementById('preview-changes')?.addEventListener('click', () => {
            this.previewChanges();
        });

        document.getElementById('save-theme')?.addEventListener('click', () => {
            this.saveTheme();
        });

        document.getElementById('reset-theme')?.addEventListener('click', () => {
            this.resetTheme();
        });

        document.getElementById('export-theme')?.addEventListener('click', () => {
            this.exportTheme();
        });

        // Preset buttons
        const presetButtons = this.containerElement.querySelectorAll('.preset-btn');
        presetButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.applyPreset(e.target.dataset.preset);
            });
        });
    }

    handleColorChange(input) {
        const cssVar = input.dataset.var;
        const value = input.value;
        
        // Sync color picker and hex input
        const siblingInput = input.parentElement.querySelector(
            input.type === 'color' ? '.color-hex-input' : 'input[type="color"]'
        );
        if (siblingInput) {
            siblingInput.value = value;
        }
        
        this.updateCSSVariable(cssVar, value);
        logDesignerTheme(`Updated ${cssVar} to ${value}`);
    }

    handleRangeChange(input) {
        const cssVar = input.dataset.var;
        const value = input.value;
        const unit = input.dataset.unit || '';
        const fullValue = value + unit;
        
        // Update range display
        const valueDisplay = input.parentElement.querySelector('.range-value');
        if (valueDisplay) {
            valueDisplay.textContent = fullValue;
        }
        
        this.updateCSSVariable(cssVar, fullValue);
        logDesignerTheme(`Updated ${cssVar} to ${fullValue}`);
    }

    handleFontChange(input) {
        const cssVar = input.dataset.var;
        const value = input.value;
        
        this.updateCSSVariable(cssVar, value);
        logDesignerTheme(`Updated ${cssVar} to ${value}`);
    }

    updateCSSVariable(cssVar, value) {
        document.documentElement.style.setProperty(cssVar, value);
        this.customThemeVars[cssVar] = value;
    }

    previewChanges() {
        logDesignerTheme('Previewing theme changes...');
        this.showTemporaryMessage('Theme preview is live! Changes are visible immediately.', 'success');
    }

    saveTheme() {
        try {
            localStorage.setItem('devpages_custom_theme', JSON.stringify(this.customThemeVars));
            logDesignerTheme('Theme saved to localStorage');
            this.showTemporaryMessage('Theme saved successfully!', 'success');
        } catch (error) {
            logDesignerTheme(`Failed to save theme: ${error.message}`, 'error');
            this.showTemporaryMessage('Failed to save theme', 'error');
        }
    }

    loadSavedCustomizations() {
        try {
            const saved = localStorage.getItem('devpages_custom_theme');
            if (saved) {
                this.customThemeVars = JSON.parse(saved);
                
                // Apply saved variables
                Object.entries(this.customThemeVars).forEach(([cssVar, value]) => {
                    document.documentElement.style.setProperty(cssVar, value);
                });
                
                // Update UI controls to reflect saved values
                this.updateUIFromSavedValues();
                
                logDesignerTheme('Loaded saved theme customizations');
            }
        } catch (error) {
            logDesignerTheme(`Failed to load saved theme: ${error.message}`, 'error');
        }
    }

    updateUIFromSavedValues() {
        Object.entries(this.customThemeVars).forEach(([cssVar, value]) => {
            const inputs = this.containerElement.querySelectorAll(`[data-var="${cssVar}"]`);
            inputs.forEach(input => {
                if (input.type === 'color' || input.classList.contains('color-hex-input')) {
                    input.value = value;
                } else if (input.type === 'range') {
                    const numericValue = parseInt(value);
                    if (!isNaN(numericValue)) {
                        input.value = numericValue;
                        const valueDisplay = input.parentElement.querySelector('.range-value');
                        if (valueDisplay) {
                            valueDisplay.textContent = value;
                        }
                    }
                } else if (input.tagName === 'SELECT') {
                    input.value = value;
                }
            });
        });
    }

    resetTheme() {
        // Clear custom variables
        Object.keys(this.customThemeVars).forEach(cssVar => {
            document.documentElement.style.removeProperty(cssVar);
        });
        
        this.customThemeVars = {};
        
        // Reset UI controls to defaults
        this.resetUIControls();
        
        // Clear localStorage
        localStorage.removeItem('devpages_custom_theme');
        
        logDesignerTheme('Theme reset to defaults');
        this.showTemporaryMessage('Theme reset to defaults', 'success');
    }

    resetUIControls() {
        // Reset color inputs
        const colorInputs = this.containerElement.querySelectorAll('input[type="color"], .color-hex-input');
        colorInputs.forEach(input => {
            const defaultValue = input.getAttribute('value') || input.getAttribute('placeholder');
            if (defaultValue) {
                input.value = defaultValue;
            }
        });

        // Reset range inputs
        const rangeInputs = this.containerElement.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            const defaultValue = input.getAttribute('value');
            if (defaultValue) {
                input.value = defaultValue;
                const unit = input.dataset.unit || '';
                const valueDisplay = input.parentElement.querySelector('.range-value');
                if (valueDisplay) {
                    valueDisplay.textContent = defaultValue + unit;
                }
            }
        });

        // Reset selects
        const selects = this.containerElement.querySelectorAll('select[data-var]');
        selects.forEach(select => {
            select.selectedIndex = 0;
        });
    }

    exportTheme() {
        const cssContent = this.generateThemeCSS();
        
        // Create download
        const blob = new Blob([cssContent], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `devpages-custom-theme-${new Date().toISOString().slice(0, 10)}.css`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logDesignerTheme('Theme exported as CSS file');
        this.showTemporaryMessage('Theme exported successfully!', 'success');
    }

    generateThemeCSS() {
        const timestamp = new Date().toISOString();
        let css = `/* DevPages Custom Theme - Generated ${timestamp} */\n\n:root {\n`;
        
        Object.entries(this.customThemeVars).forEach(([cssVar, value]) => {
            css += `  ${cssVar}: ${value};\n`;
        });
        
        css += '}\n\n';
        css += `/* Dark theme overrides */\n[data-theme="dark"] {\n`;
        css += `  /* Add dark theme specific overrides here */\n`;
        css += `}\n`;
        
        return css;
    }

    applyPreset(presetName) {
        const presets = {
            'corporate-blue': {
                '--brand-primary': '#0066cc',
                '--brand-secondary': '#004499',
                '--brand-accent': '#00aaff',
                '--nav-background': '#f8f9fa',
                '--nav-text': '#333333'
            },
            'nature-green': {
                '--brand-primary': '#059669',
                '--brand-secondary': '#047857',
                '--brand-accent': '#10b981',
                '--nav-background': '#f0fdf4',
                '--nav-text': '#14532d'
            },
            'sunset-orange': {
                '--brand-primary': '#ea580c',
                '--brand-secondary': '#c2410c',
                '--brand-accent': '#fb923c',
                '--nav-background': '#fff7ed',
                '--nav-text': '#9a3412'
            },
            'royal-purple': {
                '--brand-primary': '#8b5cf6',
                '--brand-secondary': '#7c3aed',
                '--brand-accent': '#a78bfa',
                '--nav-background': '#faf5ff',
                '--nav-text': '#581c87'
            },
            'minimal-gray': {
                '--brand-primary': '#374151',
                '--brand-secondary': '#6b7280',
                '--brand-accent': '#9ca3af',
                '--nav-background': '#f9fafb',
                '--nav-text': '#111827'
            }
        };

        const preset = presets[presetName];
        if (preset) {
            Object.entries(preset).forEach(([cssVar, value]) => {
                this.updateCSSVariable(cssVar, value);
            });
            
            this.updateUIFromSavedValues();
            logDesignerTheme(`Applied preset: ${presetName}`);
            this.showTemporaryMessage(`Applied ${presetName} preset!`, 'success');
        }
    }

    showTemporaryMessage(message, type = 'info') {
        // Remove any existing message
        const existingMessage = document.querySelector('.designer-temp-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = `designer-temp-message designer-temp-message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}-background);
            color: var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'});
            padding: 12px 16px;
            border-radius: 6px;
            border: 1px solid var(--color-${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'});
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(messageEl);

        // Remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.remove();
                    }
                }, 300);
            }
        }, 3000);
    }

    subscribeToState() {
        this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
            // React to theme-related state changes
            if (newState.ui?.theme !== prevState.ui?.theme) {
                // Theme changed, might need to update preview
                logDesignerTheme(`Theme changed to: ${newState.ui.theme}`);
            }
        });
    }

    destroy() {
        logDesignerTheme('Destroying DesignerThemePanel...');
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        this.containerElement = null;
        logDesignerTheme('DesignerThemePanel destroyed.');
    }
}

// DISABLED - Replaced by ThemeDesignPanel.js
// panelRegistry.register({
//     id: 'theme-design-container',
//     title: 'Theme & Design',
//     component: DesignerThemePanel,
//     order: 4, // Move up in order, before other theme panels
//     defaultCollapsed: false
// }); 