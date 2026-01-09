/**
 * ThemeManagementPanel.js - Modern theme management interface
 *
 * Complete redesign integrating with ThemeService and Theme System v2.0
 * Features:
 * - Theme selection (built-in and custom themes)
 * - Live theme preview
 * - Token editing (colors, typography, spacing)
 * - Export functionality (CSS, JSON)
 * - OS dark mode sync
 * - Proper storage management
 */

import { BasePanel, panelRegistry } from './BasePanel.js';
import { themeService } from '../services/ThemeService.js';
import { BUILT_IN_THEMES, createUserTheme } from '../constants/themes.js';

export class ThemeManagementPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'theme-management',
            title: 'Theme Manager',
            defaultWidth: 800,
            defaultHeight: 600,
            ...config
        });

        this.currentTheme = null;
        this.activeTab = 'colors'; // 'colors', 'typography', 'spacing', 'export'
        this.editMode = false; // Whether user is editing a custom theme
        this.unsubscribe = null; // ThemeService subscription
        this.showNewThemeForm = false; // Show new theme creation form
        this.showDeleteConfirm = false; // Show delete confirmation
    }

    renderContent() {
        const themes = themeService.getAllThemes();
        const currentThemeId = themeService.currentTheme?.id || 'devpages-light';
        const currentTheme = themeService.currentTheme || BUILT_IN_THEMES['devpages-light'];

        return `
            <div class="theme-management-panel">
                <!-- Header: Theme Selector and Actions -->
                <div class="tm-header">
                    <div class="tm-header-row">
                        <div class="tm-selector-group">
                            <label for="theme-select">Active Theme:</label>
                            <select id="theme-select" class="tm-select">
                                ${Object.values(themes).map(theme => `
                                    <option value="${theme.id}" ${theme.id === currentThemeId ? 'selected' : ''}>
                                        ${theme.name} ${theme.metadata?.editable ? '(Custom)' : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <div class="tm-actions">
                            <button id="sync-os-btn" class="tm-btn ${localStorage.getItem('devpages:theme:syncOS') === 'true' ? 'active' : ''}"
                                    title="Sync with OS dark mode">
                                <span>🌓</span> OS Sync
                            </button>
                            <button id="new-theme-btn" class="tm-btn" title="Create new custom theme">
                                <span>+</span> New Theme
                            </button>
                        </div>
                    </div>

                    <!-- New Theme Creation Form -->
                    ${this.showNewThemeForm ? `
                        <div class="tm-new-theme-form">
                            <div class="tm-form-header">
                                <h4>Create New Theme</h4>
                                <button id="cancel-new-theme-btn" class="tm-btn-icon" title="Cancel">×</button>
                            </div>
                            <div class="tm-form-body">
                                <div class="tm-form-group">
                                    <label for="new-theme-name">Theme Name</label>
                                    <input
                                        type="text"
                                        id="new-theme-name"
                                        class="tm-input"
                                        placeholder="My Custom Theme"
                                        value="My Custom Theme"
                                    />
                                </div>
                                <div class="tm-form-group">
                                    <label for="new-theme-base">Base Theme</label>
                                    <select id="new-theme-base" class="tm-select">
                                        <option value="devpages-light">DevPages Light</option>
                                        <option value="devpages-dark">DevPages Dark</option>
                                    </select>
                                </div>
                                <div class="tm-form-actions">
                                    <button id="create-theme-btn" class="tm-btn tm-btn-primary">Create Theme</button>
                                    <button id="cancel-new-theme-btn-2" class="tm-btn">Cancel</button>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Theme Info and Name Edit -->
                <div class="tm-info">
                    ${currentTheme.metadata?.editable ? `
                        <div class="tm-name-edit-group">
                            <label for="theme-name-input">Name:</label>
                            <input
                                type="text"
                                id="theme-name-input"
                                class="tm-name-input"
                                value="${currentTheme.name}"
                                placeholder="Theme name"
                            />
                        </div>
                    ` : `
                        <div class="tm-theme-name">${currentTheme.name}</div>
                    `}
                    <div class="tm-theme-badge ${currentTheme.mode}">${currentTheme.mode}</div>
                    <div class="tm-theme-desc">${currentTheme.description}</div>
                    ${currentTheme.metadata?.editable ? `
                        <div class="tm-edit-notice">Custom Theme</div>
                    ` : ''}
                </div>

                <!-- Tab Navigation -->
                <div class="tm-tabs">
                    <button class="tm-tab ${this.activeTab === 'colors' ? 'active' : ''}" data-tab="colors">
                        Colors
                    </button>
                    <button class="tm-tab ${this.activeTab === 'typography' ? 'active' : ''}" data-tab="typography">
                        Typography
                    </button>
                    <button class="tm-tab ${this.activeTab === 'spacing' ? 'active' : ''}" data-tab="spacing">
                        Spacing
                    </button>
                    <button class="tm-tab ${this.activeTab === 'export' ? 'active' : ''}" data-tab="export">
                        Export
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="tm-content">
                    ${this.renderTabContent(currentTheme)}
                </div>

                <!-- Footer Actions -->
                <div class="tm-footer">
                    <div class="tm-footer-info">
                        <span class="tm-version">v${currentTheme.version || '1.0.0'}</span>
                        <span class="tm-author">${currentTheme.author || 'DevPages'}</span>
                    </div>
                    <div class="tm-footer-actions">
                        ${currentTheme.metadata?.editable ? `
                            ${this.showDeleteConfirm ? `
                                <div class="tm-delete-confirm">
                                    <span class="tm-delete-message">Delete "${currentTheme.name}"?</span>
                                    <button id="confirm-delete-btn" class="tm-btn tm-btn-danger tm-btn-sm">
                                        Yes, Delete
                                    </button>
                                    <button id="cancel-delete-btn" class="tm-btn tm-btn-sm">
                                        Cancel
                                    </button>
                                </div>
                            ` : `
                                <button id="save-theme-btn" class="tm-btn tm-btn-primary">
                                    <span>💾</span> Save Theme
                                </button>
                                <button id="delete-theme-btn" class="tm-btn tm-btn-danger">
                                    <span>🗑️</span> Delete
                                </button>
                            `}
                        ` : ''}
                        ${!this.showDeleteConfirm ? `
                            <button id="apply-theme-btn" class="tm-btn tm-btn-success">
                                <span>✓</span> Apply Theme
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderTabContent(theme) {
        switch (this.activeTab) {
            case 'colors':
                return this.renderColorsTab(theme);
            case 'typography':
                return this.renderTypographyTab(theme);
            case 'spacing':
                return this.renderSpacingTab(theme);
            case 'export':
                return this.renderExportTab(theme);
            default:
                return '<div class="tm-error">Unknown tab</div>';
        }
    }

    renderColorsTab(theme) {
        const colors = theme.colors || {};
        const colorGroups = this.groupColors(colors);

        return `
            <div class="tm-colors-tab">
                ${Object.entries(colorGroups).map(([groupName, colorTokens]) => `
                    <div class="tm-color-group">
                        <h4 class="tm-group-title">${this.formatGroupName(groupName)}</h4>
                        <div class="tm-color-grid">
                            ${colorTokens.map(([tokenName, value]) => `
                                <div class="tm-color-item">
                                    <div class="tm-color-swatch" style="background: ${value}">
                                        <input
                                            type="color"
                                            value="${this.normalizeColorForInput(value)}"
                                            data-token="${tokenName}"
                                            class="tm-color-input"
                                            ${theme.metadata?.editable ? '' : 'disabled'}
                                        />
                                    </div>
                                    <div class="tm-color-info">
                                        <div class="tm-color-name">${tokenName}</div>
                                        <input
                                            type="text"
                                            value="${value}"
                                            data-token="${tokenName}"
                                            class="tm-color-value"
                                            ${theme.metadata?.editable ? '' : 'readonly'}
                                        />
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderTypographyTab(theme) {
        const typography = theme.typography || {};
        const fontFamilies = Object.entries(typography).filter(([k]) => k.includes('font'));
        const fontSizes = Object.entries(typography).filter(([k]) => k.includes('size'));
        const fontWeights = Object.entries(typography).filter(([k]) => k.includes('weight'));
        const lineHeights = Object.entries(typography).filter(([k]) => k.includes('leading'));

        return `
            <div class="tm-typography-tab">
                <div class="tm-typo-section">
                    <h4>Font Families</h4>
                    <div class="tm-typo-list">
                        ${fontFamilies.map(([name, value]) => `
                            <div class="tm-typo-item">
                                <label>${name}</label>
                                <input
                                    type="text"
                                    value="${value}"
                                    data-token="${name}"
                                    class="tm-typo-input"
                                    ${theme.metadata?.editable ? '' : 'readonly'}
                                />
                                <div class="tm-typo-preview" style="font-family: ${value}">Aa Bb Cc</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="tm-typo-section">
                    <h4>Font Sizes</h4>
                    <div class="tm-typo-grid">
                        ${fontSizes.map(([name, value]) => `
                            <div class="tm-typo-size-item">
                                <label>${name}</label>
                                <input
                                    type="text"
                                    value="${value}"
                                    data-token="${name}"
                                    class="tm-typo-input"
                                    ${theme.metadata?.editable ? '' : 'readonly'}
                                />
                                <span class="tm-size-preview" style="font-size: ${value}">Aa</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="tm-typo-section">
                    <h4>Font Weights</h4>
                    <div class="tm-typo-grid">
                        ${fontWeights.map(([name, value]) => `
                            <div class="tm-typo-item">
                                <label>${name}</label>
                                <input
                                    type="text"
                                    value="${value}"
                                    data-token="${name}"
                                    class="tm-typo-input"
                                    ${theme.metadata?.editable ? '' : 'readonly'}
                                />
                                <span style="font-weight: ${value}">Sample</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="tm-typo-section">
                    <h4>Line Heights</h4>
                    <div class="tm-typo-grid">
                        ${lineHeights.map(([name, value]) => `
                            <div class="tm-typo-item">
                                <label>${name}</label>
                                <input
                                    type="text"
                                    value="${value}"
                                    data-token="${name}"
                                    class="tm-typo-input"
                                    ${theme.metadata?.editable ? '' : 'readonly'}
                                />
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderSpacingTab(theme) {
        const spacing = theme.spacing || {};

        return `
            <div class="tm-spacing-tab">
                <div class="tm-spacing-list">
                    ${Object.entries(spacing).map(([name, value]) => `
                        <div class="tm-spacing-item">
                            <label>${name}</label>
                            <input
                                type="text"
                                value="${value}"
                                data-token="${name}"
                                class="tm-spacing-input"
                                ${theme.metadata?.editable ? '' : 'readonly'}
                            />
                            <div class="tm-spacing-visual">
                                <div class="tm-spacing-bar" style="width: ${this.getSpacingWidth(value)}"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderExportTab(theme) {
        return `
            <div class="tm-export-tab">
                <div class="tm-export-options">
                    <h4>Export Format</h4>
                    <div class="tm-export-buttons">
                        <button class="tm-export-btn" data-format="css">
                            <span>📄</span>
                            <div>CSS Variables</div>
                        </button>
                        <button class="tm-export-btn" data-format="json">
                            <span>{ }</span>
                            <div>JSON</div>
                        </button>
                        <button class="tm-export-btn" data-format="js">
                            <span>JS</span>
                            <div>JavaScript Module</div>
                        </button>
                    </div>
                </div>

                <div class="tm-export-preview">
                    <div class="tm-export-header">
                        <span id="export-format-label">Select a format above</span>
                        <button class="tm-btn" id="copy-export-btn">
                            <span>📋</span> Copy
                        </button>
                    </div>
                    <pre id="export-output"><code>// Click a format button to generate export code</code></pre>
                </div>
            </div>
        `;
    }

    // Helper methods
    groupColors(colors) {
        const groups = {
            primary: [],
            neutral: [],
            semantic: [],
            surface: [],
            text: [],
            other: []
        };

        Object.entries(colors).forEach(([name, value]) => {
            if (name.includes('primary')) groups.primary.push([name, value]);
            else if (name.includes('neutral')) groups.neutral.push([name, value]);
            else if (['success', 'warning', 'error', 'info'].includes(name)) groups.semantic.push([name, value]);
            else if (name.startsWith('bg') || name.startsWith('surface') || name.startsWith('border') || name.startsWith('divider')) groups.surface.push([name, value]);
            else if (name.startsWith('text')) groups.text.push([name, value]);
            else groups.other.push([name, value]);
        });

        // Remove empty groups
        return Object.fromEntries(
            Object.entries(groups).filter(([_, values]) => values.length > 0)
        );
    }

    formatGroupName(name) {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    normalizeColorForInput(color) {
        // Convert rgb/rgba to hex if needed
        if (color.startsWith('rgb')) {
            // For now, return a default - in production use proper color conversion
            return '#000000';
        }
        return color.startsWith('#') ? color : '#000000';
    }

    getSpacingWidth(value) {
        const numValue = parseFloat(value);
        if (value.includes('rem')) {
            return Math.min(numValue * 16, 100) + 'px';
        } else if (value.includes('px')) {
            return Math.min(numValue, 100) + 'px';
        }
        return '20px';
    }

    // Event handling
    onMount(container) {
        super.onMount(container);
        this.container = container;

        // Subscribe to theme changes
        this.unsubscribe = themeService.subscribe((theme) => {
            this.currentTheme = theme;
            this.updateDisplay();
        });

        this.attachEventListeners();
        console.log('[ThemeManagementPanel] Mounted and subscribed to theme changes');
    }

    onUnmount() {
        // Unsubscribe from theme changes
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        super.onUnmount();
    }

    attachEventListeners() {
        if (!this.container) return;

        // Theme selector
        const themeSelect = this.container.querySelector('#theme-select');
        themeSelect?.addEventListener('change', (e) => {
            this.loadTheme(e.target.value);
        });

        // Tab switching
        this.container.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                this.activeTab = tab.dataset.tab;
                this.updateDisplay();
            }
        });

        // OS Sync toggle
        const osSyncBtn = this.container.querySelector('#sync-os-btn');
        osSyncBtn?.addEventListener('click', () => {
            const isEnabled = localStorage.getItem('devpages:theme:syncOS') === 'true';
            themeService.setOSThemeSync(!isEnabled);
            this.updateDisplay();
        });

        // New theme button - toggle form
        const newThemeBtn = this.container.querySelector('#new-theme-btn');
        newThemeBtn?.addEventListener('click', () => this.toggleNewThemeForm());

        // Cancel new theme buttons
        const cancelNewThemeBtn = this.container.querySelector('#cancel-new-theme-btn');
        const cancelNewThemeBtn2 = this.container.querySelector('#cancel-new-theme-btn-2');
        cancelNewThemeBtn?.addEventListener('click', () => this.toggleNewThemeForm());
        cancelNewThemeBtn2?.addEventListener('click', () => this.toggleNewThemeForm());

        // Create theme button
        const createThemeBtn = this.container.querySelector('#create-theme-btn');
        createThemeBtn?.addEventListener('click', () => this.createNewTheme());

        // Theme name input for editable themes
        const themeNameInput = this.container.querySelector('#theme-name-input');
        themeNameInput?.addEventListener('change', (e) => this.updateThemeName(e.target.value));

        // Apply theme button
        const applyBtn = this.container.querySelector('#apply-theme-btn');
        applyBtn?.addEventListener('click', () => this.applyTheme());

        // Save theme button
        const saveBtn = this.container.querySelector('#save-theme-btn');
        saveBtn?.addEventListener('click', () => this.saveTheme());

        // Delete theme button - show confirmation
        const deleteBtn = this.container.querySelector('#delete-theme-btn');
        deleteBtn?.addEventListener('click', () => this.toggleDeleteConfirm());

        // Confirm delete button
        const confirmDeleteBtn = this.container.querySelector('#confirm-delete-btn');
        confirmDeleteBtn?.addEventListener('click', () => this.deleteTheme());

        // Cancel delete button
        const cancelDeleteBtn = this.container.querySelector('#cancel-delete-btn');
        cancelDeleteBtn?.addEventListener('click', () => this.toggleDeleteConfirm());

        // Color inputs (for editable themes)
        this.container.addEventListener('input', (e) => {
            if (e.target.classList.contains('tm-color-input') ||
                e.target.classList.contains('tm-color-value')) {
                this.updateToken('colors', e.target.dataset.token, e.target.value);
            } else if (e.target.classList.contains('tm-typo-input')) {
                this.updateToken('typography', e.target.dataset.token, e.target.value);
            } else if (e.target.classList.contains('tm-spacing-input')) {
                this.updateToken('spacing', e.target.dataset.token, e.target.value);
            }
        });

        // Export buttons
        this.container.addEventListener('click', (e) => {
            const exportBtn = e.target.closest('[data-format]');
            if (exportBtn) {
                this.exportTheme(exportBtn.dataset.format);
            }

            if (e.target.closest('#copy-export-btn')) {
                this.copyExport();
            }
        });
    }

    /**
     * Get the container element where our content lives
     * Checks container first (for floating panels), then standard locations
     */
    getContainer() {
        return this.container || this.element?.querySelector('.panel-body') || this.element;
    }

    updateDisplay() {
        const container = this.getContainer();
        if (!container) return;

        container.innerHTML = this.renderContent();
        this.attachEventListeners();
    }

    async loadTheme(themeId) {
        try {
            await themeService.loadTheme(themeId);
            console.log(`[ThemeManagementPanel] Loaded theme: ${themeId}`);
        } catch (error) {
            console.error('[ThemeManagementPanel] Error loading theme:', error);
        }
    }

    applyTheme() {
        if (themeService.currentTheme) {
            themeService.applyTheme(themeService.currentTheme);
            console.log('[ThemeManagementPanel] Applied current theme');
        }
    }

    toggleNewThemeForm() {
        this.showNewThemeForm = !this.showNewThemeForm;
        this.updateDisplay();
    }

    toggleDeleteConfirm() {
        this.showDeleteConfirm = !this.showDeleteConfirm;
        this.updateDisplay();
    }

    createNewTheme() {
        const nameInput = this.container.querySelector('#new-theme-name');
        const baseSelect = this.container.querySelector('#new-theme-base');

        const name = nameInput?.value.trim();
        if (!name) {
            console.warn('[ThemeManagementPanel] Theme name is required');
            return;
        }

        const baseThemeId = baseSelect?.value || 'devpages-light';
        const baseTheme = themeService.getAllThemes()[baseThemeId] || BUILT_IN_THEMES['devpages-light'];

        const newTheme = createUserTheme({
            name: name,
            description: 'Custom theme',
            mode: baseTheme.mode,
            colors: { ...baseTheme.colors },
            typography: { ...baseTheme.typography },
            spacing: { ...baseTheme.spacing },
            effects: { ...baseTheme.effects },
            components: { ...baseTheme.components },
            embed: { ...baseTheme.embed }
        });

        themeService.saveCustomTheme(newTheme);
        themeService.loadTheme(newTheme.id);

        // Hide form after creation
        this.showNewThemeForm = false;

        console.log('[ThemeManagementPanel] Created new theme:', newTheme.id);
    }

    updateThemeName(newName) {
        const theme = themeService.currentTheme;
        if (!theme || !theme.metadata?.editable) {
            console.warn('[ThemeManagementPanel] Cannot rename non-editable theme');
            return;
        }

        theme.name = newName.trim();
        themeService.saveCustomTheme(theme);
        console.log('[ThemeManagementPanel] Updated theme name:', theme.name);
    }

    saveTheme() {
        const theme = themeService.currentTheme;
        if (!theme || !theme.metadata?.editable) {
            console.warn('[ThemeManagementPanel] Cannot save non-editable theme');
            return;
        }

        themeService.saveCustomTheme(theme);
        console.log('[ThemeManagementPanel] Saved theme:', theme.id);

        // Show success feedback
        const saveBtn = this.container.querySelector('#save-theme-btn');
        if (saveBtn) {
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span>✓</span> Saved!';
            saveBtn.classList.add('tm-btn-success');
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.classList.remove('tm-btn-success');
            }, 2000);
        }
    }

    deleteTheme() {
        const theme = themeService.currentTheme;
        if (!theme || !theme.metadata?.editable) {
            console.warn('[ThemeManagementPanel] Cannot delete non-editable theme');
            return;
        }

        themeService.deleteCustomTheme(theme.id);
        themeService.loadTheme('devpages-light'); // Switch to default

        // Hide confirmation after delete
        this.showDeleteConfirm = false;

        console.log('[ThemeManagementPanel] Deleted theme:', theme.id);
    }

    updateToken(category, tokenName, value) {
        const theme = themeService.currentTheme;
        if (!theme || !theme.metadata?.editable) return;

        // Update the theme object
        if (!theme[category]) theme[category] = {};
        theme[category][tokenName] = value;

        // Sync color picker and text input
        if (category === 'colors') {
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

        // Live preview - apply the token immediately
        themeService.updateToken(category, tokenName, value);
    }

    exportTheme(format) {
        const theme = themeService.currentTheme;
        if (!theme) return;

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
        }

        const container = this.getContainer();
        const outputEl = container.querySelector('#export-output code');
        const labelEl = container.querySelector('#export-format-label');

        if (outputEl) outputEl.textContent = output;
        if (labelEl) labelEl.textContent = `${format.toUpperCase()} Export`;
    }

    exportToCSS(theme) {
        let css = `:root {\n`;

        // Colors
        Object.entries(theme.colors || {}).forEach(([name, value]) => {
            css += `  --color-${name}: ${value};\n`;
        });

        // Typography
        Object.entries(theme.typography || {}).forEach(([name, value]) => {
            css += `  --font-${name}: ${value};\n`;
        });

        // Spacing
        Object.entries(theme.spacing || {}).forEach(([name, value]) => {
            css += `  --spacing-${name}: ${value};\n`;
        });

        css += `}\n`;
        return css;
    }

    copyExport() {
        const container = this.getContainer();
        const output = container.querySelector('#export-output code');

        if (output && navigator.clipboard) {
            navigator.clipboard.writeText(output.textContent)
                .then(() => {
                    const copyBtn = container.querySelector('#copy-export-btn');
                    if (copyBtn) {
                        const originalText = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<span>✓</span> Copied!';
                        setTimeout(() => {
                            copyBtn.innerHTML = originalText;
                        }, 2000);
                    }
                })
                .catch(err => console.error('Failed to copy:', err));
        }
    }
}

// Register panel type
panelRegistry.registerType('theme-management', ThemeManagementPanel);

// Factory function
export function createThemeManagementPanel(config = {}) {
    return new ThemeManagementPanel(config);
}

// Global access for debugging
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.panels = window.APP.panels || {};
    window.APP.panels.ThemeManagementPanel = ThemeManagementPanel;
}
