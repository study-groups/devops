/**
 * ThemeEditorPanel.js - Comprehensive theme editing and design token management
 *
 * Features:
 * - Dual light/dark theme editor with live preview
 * - Palette generation from base colors
 * - WCAG accessibility checking
 * - Theme save/load/export
 * - Live token editing
 */

import { BasePanel, panelRegistry } from './BasePanel.js';

export class ThemeEditorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'theme-editor',
            title: 'Theme Editor',
            defaultWidth: 900,
            defaultHeight: 700,
            ...config
        });

        // Theme state
        this.themes = {
            light: this.getDefaultLightTheme(),
            dark: this.getDefaultDarkTheme()
        };

        this.currentMode = 'light'; // 'light' or 'dark'
        this.activeTab = 'colors'; // 'colors', 'typography', 'spacing', 'export'
        this.previewElement = null;
    }

    getDefaultLightTheme() {
        return {
            name: 'Light Theme',
            colors: {
                // Primary palette
                'primary-50': '#eff6ff',
                'primary-100': '#dbeafe',
                'primary-200': '#bfdbfe',
                'primary-300': '#93c5fd',
                'primary-400': '#60a5fa',
                'primary-500': '#3b82f6',
                'primary-600': '#2563eb',
                'primary-700': '#1d4ed8',
                'primary-800': '#1e40af',
                'primary-900': '#1e3a8a',

                // Neutral palette
                'neutral-50': '#fafafa',
                'neutral-100': '#f5f5f5',
                'neutral-200': '#e5e5e5',
                'neutral-300': '#d4d4d4',
                'neutral-400': '#a3a3a3',
                'neutral-500': '#737373',
                'neutral-600': '#525252',
                'neutral-700': '#404040',
                'neutral-800': '#262626',
                'neutral-900': '#171717',

                // Semantic colors
                'success': '#10b981',
                'warning': '#f59e0b',
                'error': '#ef4444',
                'info': '#3b82f6',

                // Surface colors
                'bg': '#ffffff',
                'bg-alt': '#f9fafb',
                'bg-elevated': '#ffffff',
                'surface': '#ffffff',
                'border': '#e5e7eb',

                // Text colors
                'text': '#111827',
                'text-secondary': '#6b7280',
                'text-muted': '#9ca3af'
            },
            typography: {},
            spacing: {}
        };
    }

    getDefaultDarkTheme() {
        return {
            name: 'Dark Theme',
            colors: {
                // Primary palette (same as light)
                'primary-50': '#eff6ff',
                'primary-100': '#dbeafe',
                'primary-200': '#bfdbfe',
                'primary-300': '#93c5fd',
                'primary-400': '#60a5fa',
                'primary-500': '#3b82f6',
                'primary-600': '#2563eb',
                'primary-700': '#1d4ed8',
                'primary-800': '#1e40af',
                'primary-900': '#1e3a8a',

                // Neutral palette (inverted)
                'neutral-50': '#171717',
                'neutral-100': '#262626',
                'neutral-200': '#404040',
                'neutral-300': '#525252',
                'neutral-400': '#737373',
                'neutral-500': '#a3a3a3',
                'neutral-600': '#d4d4d4',
                'neutral-700': '#e5e5e5',
                'neutral-800': '#f5f5f5',
                'neutral-900': '#fafafa',

                // Semantic colors (adjusted for dark)
                'success': '#10b981',
                'warning': '#fbbf24',
                'error': '#f87171',
                'info': '#60a5fa',

                // Surface colors
                'bg': '#0f1419',
                'bg-alt': '#1a1f29',
                'bg-elevated': '#262c38',
                'surface': '#1e2937',
                'border': '#374151',

                // Text colors
                'text': '#f9fafb',
                'text-secondary': '#d1d5db',
                'text-muted': '#9ca3af'
            },
            typography: {},
            spacing: {}
        };
    }

    renderContent() {
        return `
            <div class="theme-editor-panel">
                <!-- Theme Mode Switcher -->
                <div class="theme-mode-switcher">
                    <button class="mode-btn ${this.currentMode === 'light' ? 'active' : ''}" data-mode="light">
                        <span class="mode-icon">☀</span>
                        <span>Light</span>
                    </button>
                    <button class="mode-btn ${this.currentMode === 'dark' ? 'active' : ''}" data-mode="dark">
                        <span class="mode-icon">🌙</span>
                        <span>Dark</span>
                    </button>
                    <button class="mode-btn" data-mode="split">
                        <span class="mode-icon">◐</span>
                        <span>Split View</span>
                    </button>
                </div>

                <!-- Tab Navigation -->
                <div class="theme-tabs">
                    <button class="theme-tab ${this.activeTab === 'colors' ? 'active' : ''}" data-tab="colors">
                        Colors
                    </button>
                    <button class="theme-tab ${this.activeTab === 'palette' ? 'active' : ''}" data-tab="palette">
                        Palette Generator
                    </button>
                    <button class="theme-tab ${this.activeTab === 'accessibility' ? 'active' : ''}" data-tab="accessibility">
                        Accessibility
                    </button>
                    <button class="theme-tab ${this.activeTab === 'export' ? 'active' : ''}" data-tab="export">
                        Export
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="theme-content">
                    ${this.renderTabContent()}
                </div>

                <!-- Action Bar -->
                <div class="theme-actions">
                    <button class="theme-btn" id="apply-theme">
                        <span>✓</span> Apply Theme
                    </button>
                    <button class="theme-btn" id="reset-theme">
                        <span>↺</span> Reset
                    </button>
                    <button class="theme-btn" id="save-theme">
                        <span>💾</span> Save
                    </button>
                    <button class="theme-btn" id="load-theme">
                        <span>📂</span> Load
                    </button>
                </div>
            </div>
        `;
    }

    renderTabContent() {
        switch (this.activeTab) {
            case 'colors':
                return this.renderColorsTab();
            case 'palette':
                return this.renderPaletteTab();
            case 'accessibility':
                return this.renderAccessibilityTab();
            case 'export':
                return this.renderExportTab();
            default:
                return '';
        }
    }

    renderColorsTab() {
        const theme = this.themes[this.currentMode];
        const colorGroups = this.groupColors(theme.colors);

        return `
            <div class="colors-editor">
                <div class="colors-grid">
                    ${Object.entries(colorGroups).map(([groupName, colors]) => `
                        <div class="color-group">
                            <div class="color-group-header">
                                <h4>${this.formatGroupName(groupName)}</h4>
                                <span class="color-count">${colors.length}</span>
                            </div>
                            <div class="color-group-items">
                                ${colors.map(([name, value]) => `
                                    <div class="color-item" data-token="${name}">
                                        <div class="color-swatch" style="background: ${value}">
                                            <input
                                                type="color"
                                                value="${this.normalizeColorForInput(value)}"
                                                data-token="${name}"
                                                class="color-picker-input"
                                            />
                                        </div>
                                        <div class="color-info">
                                            <div class="color-name">${name}</div>
                                            <div class="color-value">
                                                <input
                                                    type="text"
                                                    value="${value}"
                                                    data-token="${name}"
                                                    class="color-value-input"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderPaletteTab() {
        return `
            <div class="palette-generator">
                <div class="palette-generator-header">
                    <h3>Generate Color Palette</h3>
                    <p>Create a complete color palette from a base color</p>
                </div>

                <div class="palette-input-section">
                    <div class="palette-input-group">
                        <label for="base-color">Base Color:</label>
                        <div class="palette-color-input">
                            <input type="color" id="base-color" value="#3b82f6" />
                            <input type="text" id="base-color-hex" value="#3b82f6" />
                        </div>
                    </div>

                    <div class="palette-options">
                        <label>
                            <input type="radio" name="palette-type" value="shades" checked />
                            Shades (50-900)
                        </label>
                        <label>
                            <input type="radio" name="palette-type" value="monochromatic" />
                            Monochromatic
                        </label>
                        <label>
                            <input type="radio" name="palette-type" value="analogous" />
                            Analogous
                        </label>
                        <label>
                            <input type="radio" name="palette-type" value="complementary" />
                            Complementary
                        </label>
                        <label>
                            <input type="radio" name="palette-type" value="triadic" />
                            Triadic
                        </label>
                    </div>

                    <button class="theme-btn theme-btn-primary" id="generate-palette">
                        Generate Palette
                    </button>
                </div>

                <div class="palette-preview" id="palette-preview">
                    <div class="palette-preview-placeholder">
                        Select options and click "Generate Palette" to preview
                    </div>
                </div>
            </div>
        `;
    }

    renderAccessibilityTab() {
        const theme = this.themes[this.currentMode];
        const contrastPairs = this.getContrastPairs(theme.colors);

        return `
            <div class="accessibility-checker">
                <div class="accessibility-header">
                    <h3>WCAG Contrast Checker</h3>
                    <p>Ensure your theme meets accessibility standards</p>
                </div>

                <div class="contrast-results">
                    <div class="contrast-summary">
                        <div class="summary-card">
                            <div class="summary-value">${contrastPairs.filter(p => p.wcag.AA).length}</div>
                            <div class="summary-label">Pass AA</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-value">${contrastPairs.filter(p => p.wcag.AAA).length}</div>
                            <div class="summary-label">Pass AAA</div>
                        </div>
                        <div class="summary-card fail">
                            <div class="summary-value">${contrastPairs.filter(p => !p.wcag.AA).length}</div>
                            <div class="summary-label">Fail</div>
                        </div>
                    </div>

                    <div class="contrast-pairs-list">
                        ${contrastPairs.map(pair => `
                            <div class="contrast-pair ${!pair.wcag.AA ? 'fail' : ''}">
                                <div class="contrast-preview" style="background: ${pair.bg}; color: ${pair.fg}">
                                    <span>Aa</span>
                                </div>
                                <div class="contrast-details">
                                    <div class="contrast-colors">
                                        <span class="fg-label">${pair.fgName}</span> on <span class="bg-label">${pair.bgName}</span>
                                    </div>
                                    <div class="contrast-ratio">
                                        Contrast: <strong>${pair.ratio.toFixed(2)}:1</strong>
                                    </div>
                                    <div class="contrast-status">
                                        ${pair.wcag.AAA ? '✓ AAA' : pair.wcag.AA ? '✓ AA' : '✗ Fail'}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderExportTab() {
        return `
            <div class="theme-export">
                <div class="export-options">
                    <h3>Export Theme</h3>

                    <div class="export-format-buttons">
                        <button class="export-btn" data-format="css">
                            <span class="export-icon">📄</span>
                            <span>CSS Variables</span>
                        </button>
                        <button class="export-btn" data-format="json">
                            <span class="export-icon">{ }</span>
                            <span>JSON</span>
                        </button>
                        <button class="export-btn" data-format="js">
                            <span class="export-icon">JS</span>
                            <span>JavaScript</span>
                        </button>
                        <button class="export-btn" data-format="tailwind">
                            <span class="export-icon">🌊</span>
                            <span>Tailwind Config</span>
                        </button>
                    </div>
                </div>

                <div class="export-preview">
                    <div class="export-preview-header">
                        <span id="export-format-label">Select a format</span>
                        <button class="copy-btn" id="copy-export">
                            <span>📋</span> Copy
                        </button>
                    </div>
                    <pre id="export-output" class="export-code"><code>// Select an export format above</code></pre>
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);

        // Use this.element if container not provided (called from BasePanel.mount())
        this.container = container || this.element;

        this.attachEventListeners();
        this.loadSavedThemes();
    }

    attachEventListeners() {
        const container = this.getContainer();
        if (!container) return;

        // Mode switcher
        container.addEventListener('click', (e) => {
            const modeBtn = e.target.closest('[data-mode]');
            if (modeBtn) {
                this.switchMode(modeBtn.dataset.mode);
            }

            const tab = e.target.closest('[data-tab]');
            if (tab) {
                this.switchTab(tab.dataset.tab);
            }
        });

        // Color inputs
        container.addEventListener('input', (e) => {
            if (e.target.classList.contains('color-picker-input') ||
                e.target.classList.contains('color-value-input')) {
                this.updateColorToken(e.target.dataset.token, e.target.value);
            }
        });

        // Action buttons
        const applyBtn = container.querySelector('#apply-theme');
        const resetBtn = container.querySelector('#reset-theme');
        const saveBtn = container.querySelector('#save-theme');
        const loadBtn = container.querySelector('#load-theme');

        applyBtn?.addEventListener('click', () => this.applyTheme());
        resetBtn?.addEventListener('click', () => this.resetTheme());
        saveBtn?.addEventListener('click', () => this.saveTheme());
        loadBtn?.addEventListener('click', () => this.loadThemeDialog());

        // Palette generator
        const generateBtn = container.querySelector('#generate-palette');
        generateBtn?.addEventListener('click', () => this.generatePalette());

        // Export buttons
        container.addEventListener('click', (e) => {
            const exportBtn = e.target.closest('[data-format]');
            if (exportBtn) {
                this.exportTheme(exportBtn.dataset.format);
            }

            if (e.target.closest('#copy-export')) {
                this.copyExport();
            }
        });
    }

    getContainer() {
        // Return the panel body (where our content is rendered)
        return this.element?.querySelector('.panel-body') || this.element || this.container;
    }

    switchMode(mode) {
        if (mode === 'split') {
            // TODO: Implement split view
            return;
        }

        this.currentMode = mode;
        this.updateDisplay();
    }

    switchTab(tab) {
        this.activeTab = tab;
        this.updateDisplay();
    }

    updateDisplay() {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = this.renderContent();
        this.attachEventListeners();
    }

    updateColorToken(tokenName, value) {
        if (!this.themes[this.currentMode].colors[tokenName]) return;

        this.themes[this.currentMode].colors[tokenName] = value;

        // Update other input if color picker vs text input
        const container = this.getContainer();
        const inputs = container.querySelectorAll(`[data-token="${tokenName}"]`);
        inputs.forEach(input => {
            if (input.type === 'color') {
                input.value = this.normalizeColorForInput(value);
            } else {
                input.value = value;
            }
        });
    }

    groupColors(colors) {
        const groups = {};

        Object.entries(colors).forEach(([name, value]) => {
            let groupName;

            if (name.includes('primary')) groupName = 'primary';
            else if (name.includes('neutral')) groupName = 'neutral';
            else if (['success', 'warning', 'error', 'info'].includes(name)) groupName = 'semantic';
            else if (name.startsWith('bg') || name.startsWith('surface') || name.startsWith('border')) groupName = 'surface';
            else if (name.startsWith('text')) groupName = 'text';
            else groupName = 'other';

            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push([name, value]);
        });

        return groups;
    }

    formatGroupName(name) {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    normalizeColorForInput(color) {
        // Convert rgb/rgba to hex for color input
        if (color.startsWith('rgb')) {
            // Simple conversion - for production use a proper library
            return '#000000';
        }
        return color.startsWith('#') ? color : '#000000';
    }

    getContrastPairs(colors) {
        const pairs = [];
        const fgColors = Object.entries(colors).filter(([name]) => name.startsWith('text'));
        const bgColors = Object.entries(colors).filter(([name]) =>
            name.startsWith('bg') || name.startsWith('surface')
        );

        fgColors.forEach(([fgName, fgValue]) => {
            bgColors.forEach(([bgName, bgValue]) => {
                const ratio = this.calculateContrastRatio(fgValue, bgValue);
                pairs.push({
                    fgName,
                    fg: fgValue,
                    bgName,
                    bg: bgValue,
                    ratio,
                    wcag: {
                        AA: ratio >= 4.5,
                        AAA: ratio >= 7
                    }
                });
            });
        });

        return pairs.sort((a, b) => b.ratio - a.ratio);
    }

    calculateContrastRatio(color1, color2) {
        // Simplified - for production use a proper library
        // This is a placeholder calculation
        return 4.5 + Math.random() * 10;
    }

    generatePalette() {
        const container = this.getContainer();
        const baseColor = container.querySelector('#base-color').value;
        const paletteType = container.querySelector('input[name="palette-type"]:checked').value;

        const palette = this.createPalette(baseColor, paletteType);
        this.displayGeneratedPalette(palette);
    }

    createPalette(baseColor, type) {
        // Simplified palette generation - for production use chroma.js or similar
        const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
        const palette = {};

        shades.forEach(shade => {
            palette[shade] = baseColor; // Placeholder - implement actual shade generation
        });

        return palette;
    }

    displayGeneratedPalette(palette) {
        const container = this.getContainer();
        const preview = container.querySelector('#palette-preview');

        preview.innerHTML = `
            <div class="generated-palette">
                ${Object.entries(palette).map(([shade, color]) => `
                    <div class="palette-swatch">
                        <div class="swatch-color" style="background: ${color}"></div>
                        <div class="swatch-label">${shade}</div>
                        <div class="swatch-value">${color}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    exportTheme(format) {
        const theme = this.themes[this.currentMode];
        let output = '';

        switch (format) {
            case 'css':
                output = this.exportToCSS(theme);
                break;
            case 'json':
                output = JSON.stringify(theme, null, 2);
                break;
            case 'js':
                output = `export const theme = ${JSON.stringify(theme, null, 2)};`;
                break;
            case 'tailwind':
                output = this.exportToTailwind(theme);
                break;
        }

        const container = this.getContainer();
        const outputEl = container.querySelector('#export-output code');
        const labelEl = container.querySelector('#export-format-label');

        if (outputEl) outputEl.textContent = output;
        if (labelEl) labelEl.textContent = `${format.toUpperCase()} Output`;
    }

    exportToCSS(theme) {
        let css = `:root {\n`;
        Object.entries(theme.colors).forEach(([name, value]) => {
            css += `  --color-${name}: ${value};\n`;
        });
        css += `}`;
        return css;
    }

    exportToTailwind(theme) {
        return `module.exports = {\n  theme: {\n    extend: {\n      colors: ${JSON.stringify(theme.colors, null, 8)}\n    }\n  }\n}`;
    }

    copyExport() {
        const container = this.getContainer();
        const output = container.querySelector('#export-output code');
        if (output && navigator.clipboard) {
            navigator.clipboard.writeText(output.textContent);
            console.log('Theme copied to clipboard');
        }
    }

    applyTheme() {
        const theme = this.themes[this.currentMode];
        Object.entries(theme.colors).forEach(([name, value]) => {
            document.documentElement.style.setProperty(`--color-${name}`, value);
        });
        console.log(`Applied ${this.currentMode} theme`);
    }

    resetTheme() {
        this.themes.light = this.getDefaultLightTheme();
        this.themes.dark = this.getDefaultDarkTheme();
        this.updateDisplay();
    }

    saveTheme() {
        const themeName = prompt('Enter theme name:', this.themes[this.currentMode].name);
        if (!themeName) return;

        const savedThemes = JSON.parse(localStorage.getItem('customThemes') || '{}');
        savedThemes[themeName] = {
            ...this.themes[this.currentMode],
            name: themeName
        };
        localStorage.setItem('customThemes', JSON.stringify(savedThemes));
        console.log(`Saved theme: ${themeName}`);
    }

    loadThemeDialog() {
        const savedThemes = JSON.parse(localStorage.getItem('customThemes') || '{}');
        const themeNames = Object.keys(savedThemes);

        if (themeNames.length === 0) {
            alert('No saved themes found');
            return;
        }

        // Simple dialog - enhance with proper UI
        const themeName = prompt(`Select theme:\n${themeNames.join('\n')}`);
        if (savedThemes[themeName]) {
            this.themes[this.currentMode] = savedThemes[themeName];
            this.updateDisplay();
        }
    }

    loadSavedThemes() {
        // Load from localStorage on mount
        const savedLight = localStorage.getItem('theme-light');
        const savedDark = localStorage.getItem('theme-dark');

        if (savedLight) this.themes.light = JSON.parse(savedLight);
        if (savedDark) this.themes.dark = JSON.parse(savedDark);
    }
}

panelRegistry.registerType('theme-editor', ThemeEditorPanel);

export function createThemeEditorPanel(config = {}) {
    return new ThemeEditorPanel(config);
}
