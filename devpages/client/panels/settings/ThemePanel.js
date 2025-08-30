/**
 * ThemePanel.js - Theme and appearance settings panel
 * 
 * Provides theme switching and appearance customization
 */

import { BasePanel } from '../BasePanel.js';
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
    }

    renderContent() {
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

    onMount() {
        super.onMount();
        this.attachThemeListeners();
        this.loadCurrentTheme();
    }

    attachThemeListeners() {
        // Theme selection
        this.element.addEventListener('click', (e) => {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) {
                this.selectTheme(themeOption.dataset.theme);
            }
        });

        // Color controls
        const colorInputs = this.element.querySelectorAll('input[type="color"]');
        colorInputs.forEach(input => {
            input.addEventListener('change', () => this.updateCustomColors());
        });

        // Font controls
        const fontControls = this.element.querySelectorAll('#font-size, #font-family');
        fontControls.forEach(control => {
            control.addEventListener('change', () => this.updateFontSettings());
        });

        // Action buttons
        const applyBtn = this.element.querySelector('#apply-theme');
        const resetBtn = this.element.querySelector('#reset-theme');
        const exportBtn = this.element.querySelector('#export-theme');

        applyBtn?.addEventListener('click', () => this.applyTheme());
        resetBtn?.addEventListener('click', () => this.resetTheme());
        exportBtn?.addEventListener('click', () => this.exportTheme());
    }

    selectTheme(themeKey) {
        if (!this.themes[themeKey]) return;
        
        this.currentTheme = themeKey;
        
        // Update UI
        this.element.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === themeKey);
        });
        
        // Update color inputs
        const theme = this.themes[themeKey];
        this.element.querySelector('#primary-color').value = theme.colors.primary;
        this.element.querySelector('#secondary-color').value = theme.colors.secondary;
        this.element.querySelector('#background-color').value = theme.colors.background;
    }

    updateCustomColors() {
        const primaryColor = this.element.querySelector('#primary-color').value;
        const secondaryColor = this.element.querySelector('#secondary-color').value;
        const backgroundColor = this.element.querySelector('#background-color').value;
        
        // Update current theme
        this.themes[this.currentTheme].colors.primary = primaryColor;
        this.themes[this.currentTheme].colors.secondary = secondaryColor;
        this.themes[this.currentTheme].colors.background = backgroundColor;
        
        // Update preview
        this.updateThemePreview();
    }

    updateFontSettings() {
        const fontSize = this.element.querySelector('#font-size').value;
        const fontFamily = this.element.querySelector('#font-family').value;
        
        // Apply font settings immediately
        document.documentElement.style.setProperty('--font-size', fontSize);
        document.documentElement.style.setProperty('--font-family', fontFamily);
    }

    updateThemePreview() {
        const activeOption = this.element.querySelector('.theme-option.active');
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
        this.element.dispatchEvent(new CustomEvent('theme:changed', {
            detail: { theme: this.currentTheme, colors: theme.colors },
            bubbles: true
        }));
    }

    resetTheme() {
        this.currentTheme = 'light';
        this.selectTheme('light');
        this.applyTheme();
        
        // Reset font settings
        document.documentElement.style.removeProperty('--font-size');
        document.documentElement.style.removeProperty('--font-family');
        this.element.querySelector('#font-size').value = '14px';
        this.element.querySelector('#font-family').value = 'sans-serif';
    }

    exportTheme() {
        const themeData = {
            name: this.themes[this.currentTheme].name,
            colors: this.themes[this.currentTheme].colors,
            fontSize: this.element.querySelector('#font-size').value,
            fontFamily: this.element.querySelector('#font-family').value
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

// Factory function
export function createThemePanel(config = {}) {
    return new ThemePanel(config);
}
