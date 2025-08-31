/**
 * ThemePanel.js - Theme and appearance settings panel
 * 
 * Provides theme switching and appearance customization
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore } from '../../appState.js';

export class ThemePanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'theme-settings',
            title: 'Theme Settings',
            defaultWidth: 350,
            defaultHeight: 400,
            ...config
        });
        
        this.themes = {
            light: {
                name: 'Light',
                colors: {
                    primary: '#007bff',
                    secondary: '#6c757d',
                    background: '#ffffff',
                    surface: '#f8f9fa',
                    text: '#333333'
                }
            },
            dark: {
                name: 'Dark',
                colors: {
                    primary: '#0d6efd',
                    secondary: '#6c757d',
                    background: '#1e1e1e',
                    surface: '#2a2a2a',
                    text: '#ffffff'
                }
            },
            blue: {
                name: 'Blue',
                colors: {
                    primary: '#0066cc',
                    secondary: '#4a90e2',
                    background: '#f0f4f8',
                    surface: '#e1ecf4',
                    text: '#2c3e50'
                }
            }
        };
        
        this.currentTheme = 'light';
        this.container = null; // Store reference to the mounted container
    }

    render() {
        try {
            this.element = document.createElement('div');
            this.element.className = 'theme-panel';
            this.element.innerHTML = this.renderPanelContent();
            return this.element;
        } catch (error) {
            console.error('[ThemePanel] Rendering failed:', error);
            return null;
        }
    }

    renderContent() {
        try {
            return this.renderPanelContent();
        } catch (error) {
            console.error('[ThemePanel] renderContent failed:', error);
            return '<div class="panel-error">Failed to render theme panel</div>';
        }
    }

    renderPanelContent() {
        return `
            <div class="theme-panel-content">
                <div class="theme-section">
                    <h4>Theme Selection</h4>
                    <div class="theme-options">
                        ${Object.entries(this.themes).map(([key, theme]) => `
                            <div class="theme-option ${key === this.currentTheme ? 'active' : ''}" 
                                 data-theme="${key}">
                                <div class="theme-preview" style="
                                    background: ${theme.colors.background};
                                    border: 2px solid ${theme.colors.surface};
                                ">
                                    <div class="preview-header" style="background: ${theme.colors.primary}"></div>
                                    <div class="preview-content" style="color: ${theme.colors.text}">
                                        <div class="preview-text" style="background: ${theme.colors.surface}"></div>
                                        <div class="preview-text" style="background: ${theme.colors.surface}"></div>
                                    </div>
                                </div>
                                <div class="theme-name">${theme.name}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="theme-section">
                    <h4>Custom Colors</h4>
                    <div class="color-controls">
                        <div class="color-control">
                            <label for="primary-color">Primary Color:</label>
                            <input type="color" id="primary-color" value="${this.themes[this.currentTheme].colors.primary}">
                        </div>
                        <div class="color-control">
                            <label for="secondary-color">Secondary Color:</label>
                            <input type="color" id="secondary-color" value="${this.themes[this.currentTheme].colors.secondary}">
                        </div>
                        <div class="color-control">
                            <label for="background-color">Background Color:</label>
                            <input type="color" id="background-color" value="${this.themes[this.currentTheme].colors.background}">
                        </div>
                    </div>
                </div>
                
                <div class="theme-section">
                    <h4>Font Settings</h4>
                    <div class="font-controls">
                        <div class="font-control">
                            <label for="font-size">Font Size:</label>
                            <select id="font-size">
                                <option value="12px">Small (12px)</option>
                                <option value="14px" selected>Medium (14px)</option>
                                <option value="16px">Large (16px)</option>
                                <option value="18px">Extra Large (18px)</option>
                            </select>
                        </div>
                        <div class="font-control">
                            <label for="font-family">Font Family:</label>
                            <select id="font-family">
                                <option value="system">System Default</option>
                                <option value="monospace">Monospace</option>
                                <option value="serif">Serif</option>
                                <option value="sans-serif" selected>Sans Serif</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="theme-section">
                    <h4>Actions</h4>
                    <div class="theme-actions">
                        <button id="apply-theme" class="btn btn-primary">Apply Theme</button>
                        <button id="reset-theme" class="btn btn-secondary">Reset to Default</button>
                        <button id="export-theme" class="btn btn-secondary">Export Theme</button>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);
        this.container = container;
        this.attachThemeListeners();
        this.loadCurrentTheme();
        console.log("ThemePanel mounted in:", container);
    }

    attachThemeListeners() {
        if (!this.container) return;

        // Theme selection
        this.container.addEventListener('click', (e) => {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) {
                this.selectTheme(themeOption.dataset.theme);
            }
        });

        // Color controls
        const colorInputs = this.container.querySelectorAll('input[type="color"]');
        colorInputs.forEach(input => {
            input.addEventListener('change', () => this.updateCustomColors());
        });

        // Font controls
        const fontControls = this.container.querySelectorAll('#font-size, #font-family');
        fontControls.forEach(control => {
            control.addEventListener('change', () => this.updateFontSettings());
        });

        // Action buttons
        const applyBtn = this.container.querySelector('#apply-theme');
        const resetBtn = this.container.querySelector('#reset-theme');
        const exportBtn = this.container.querySelector('#export-theme');

        applyBtn?.addEventListener('click', () => this.applyTheme());
        resetBtn?.addEventListener('click', () => this.resetTheme());
        exportBtn?.addEventListener('click', () => this.exportTheme());
    }

    /**
     * Get the active container element (either mounted container or this.element)
     */
    getContainer() {
        return this.container || this.element;
    }

    selectTheme(themeKey) {
        if (!this.themes[themeKey]) return;
        
        this.currentTheme = themeKey;
        
        // Update UI
        const container = this.getContainer();
        if (!container) return;
        
        container.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === themeKey);
        });
        
        // Update color inputs
        const theme = this.themes[themeKey];
        const primaryInput = container.querySelector('#primary-color');
        const secondaryInput = container.querySelector('#secondary-color');
        const backgroundInput = container.querySelector('#background-color');
        
        if (primaryInput) primaryInput.value = theme.colors.primary;
        if (secondaryInput) secondaryInput.value = theme.colors.secondary;
        if (backgroundInput) backgroundInput.value = theme.colors.background;
    }

    updateCustomColors() {
        const container = this.getContainer();
        if (!container) return;
        
        const primaryColorInput = container.querySelector('#primary-color');
        const secondaryColorInput = container.querySelector('#secondary-color');
        const backgroundColorInput = container.querySelector('#background-color');
        
        if (!primaryColorInput || !secondaryColorInput || !backgroundColorInput) return;
        
        const primaryColor = primaryColorInput.value;
        const secondaryColor = secondaryColorInput.value;
        const backgroundColor = backgroundColorInput.value;
        
        // Update current theme
        this.themes[this.currentTheme].colors.primary = primaryColor;
        this.themes[this.currentTheme].colors.secondary = secondaryColor;
        this.themes[this.currentTheme].colors.background = backgroundColor;
        
        // Update preview
        this.updateThemePreview();
    }

    updateFontSettings() {
        const container = this.getContainer();
        if (!container) return;
        
        const fontSizeSelect = container.querySelector('#font-size');
        const fontFamilySelect = container.querySelector('#font-family');
        
        if (!fontSizeSelect || !fontFamilySelect) return;
        
        const fontSize = fontSizeSelect.value;
        const fontFamily = fontFamilySelect.value;
        
        // Apply font settings immediately
        document.documentElement.style.setProperty('--font-size', fontSize);
        document.documentElement.style.setProperty('--font-family', fontFamily);
    }

    updateThemePreview() {
        const container = this.getContainer();
        if (!container) return;
        
        const activeOption = container.querySelector('.theme-option.active');
        if (!activeOption) return;
        
        const theme = this.themes[this.currentTheme];
        const preview = activeOption.querySelector('.theme-preview');
        
        preview.style.background = theme.colors.background;
        preview.style.borderColor = theme.colors.surface;
        preview.querySelector('.preview-header').style.background = theme.colors.primary;
    }

    applyTheme() {
        const theme = this.themes[this.currentTheme];
        
        // Apply CSS custom properties
        Object.entries(theme.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--color-${key}`, value);
        });
        
        // Save to localStorage
        localStorage.setItem('selectedTheme', this.currentTheme);
        localStorage.setItem('themeColors', JSON.stringify(theme.colors));
        
        console.log(`Applied ${theme.name} theme`);
        
        // Dispatch theme change event
        const container = this.getContainer();
        if (container) {
            container.dispatchEvent(new CustomEvent('theme:changed', {
                detail: { theme: this.currentTheme, colors: theme.colors },
                bubbles: true
            }));
        }
    }

    resetTheme() {
        this.currentTheme = 'light';
        this.selectTheme('light');
        this.applyTheme();
        
        // Reset font settings
        document.documentElement.style.removeProperty('--font-size');
        document.documentElement.style.removeProperty('--font-family');
        
        const container = this.getContainer();
        if (container) {
            const fontSizeSelect = container.querySelector('#font-size');
            const fontFamilySelect = container.querySelector('#font-family');
            
            if (fontSizeSelect) fontSizeSelect.value = '14px';
            if (fontFamilySelect) fontFamilySelect.value = 'sans-serif';
        }
    }

    exportTheme() {
        const container = this.getContainer();
        const fontSize = container?.querySelector('#font-size')?.value || '14px';
        const fontFamily = container?.querySelector('#font-family')?.value || 'sans-serif';
        
        const themeData = {
            name: this.themes[this.currentTheme].name,
            colors: this.themes[this.currentTheme].colors,
            fontSize: fontSize,
            fontFamily: fontFamily
        };
        
        const dataStr = JSON.stringify(themeData, null, 2);
        
        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(dataStr).then(() => {
                console.log('Theme exported to clipboard');
            });
        }
        
        console.log('Theme export:', dataStr);
    }

    loadCurrentTheme() {
        const savedTheme = localStorage.getItem('selectedTheme');
        if (savedTheme && this.themes[savedTheme]) {
            this.selectTheme(savedTheme);
        }
        
        const savedColors = localStorage.getItem('themeColors');
        if (savedColors) {
            try {
                const colors = JSON.parse(savedColors);
                this.themes[this.currentTheme].colors = { ...this.themes[this.currentTheme].colors, ...colors };
                this.updateCustomColors();
            } catch (error) {
                console.warn('Failed to load saved theme colors:', error);
            }
        }
    }
}

panelRegistry.registerType('theme-editor', ThemePanel);

// Factory function
export function createThemePanel(config = {}) {
    return new ThemePanel(config);
}
