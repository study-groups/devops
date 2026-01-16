/**
 * ThemeManagementPanel.js - Modern theme management interface
 *
 * CSS-First Theme Architecture:
 * - Themes are metadata only (id, name, mode)
 * - All CSS variables come from theme CSS files
 * - Token editing updates CSS custom properties directly
 * - Export generates CSS from computed styles
 *
 * Features:
 * - Theme selection (built-in and custom themes)
 * - Live token preview from computed styles
 * - Export functionality (CSS, JSON)
 * - OS dark mode sync
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

        // Token cache from CSS computed styles
        this.tokens = { colors: [], typography: [], spacing: [], effects: [] };
    }

    /**
     * Load tokens from CSS computed styles
     */
    loadTokensFromCSS() {
        this.tokens = { colors: [], typography: [], spacing: [], effects: [] };
        const styles = getComputedStyle(document.documentElement);

        for (let i = 0; i < styles.length; i++) {
            const prop = styles[i];
            if (prop.startsWith('--')) {
                const value = styles.getPropertyValue(prop).trim();
                if (value) {
                    const name = prop.slice(2);
                    const category = this.categorizeToken(name, value);
                    if (this.tokens[category]) {
                        this.tokens[category].push({ name, value, variable: prop });
                    }
                }
            }
        }

        // Sort tokens by name
        Object.keys(this.tokens).forEach(cat => {
            this.tokens[cat].sort((a, b) => a.name.localeCompare(b.name));
        });
    }

    categorizeToken(name, value) {
        const lower = name.toLowerCase();

        // Colors
        if (lower.includes('color') || lower.startsWith('devpages-type-') ||
            lower.includes('-bg') || lower.includes('-fg') ||
            /^#[0-9a-f]{3,8}$/i.test(value) || value.startsWith('rgb') || value.startsWith('hsl')) {
            return 'colors';
        }

        // Typography
        if (lower.includes('font') || lower.includes('text') || lower.includes('line-height') ||
            lower.includes('heading')) {
            return 'typography';
        }

        // Spacing
        if (lower.includes('spacing') || lower.includes('space-') || lower.includes('gap') ||
            lower.includes('padding') || lower.includes('margin')) {
            return 'spacing';
        }

        // Effects
        if (lower.includes('shadow') || lower.includes('radius') || lower.includes('transition')) {
            return 'effects';
        }

        return 'effects'; // fallback
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
        // Use tokens from CSS computed styles
        const colors = this.tokens.colors || [];
        const colorGroups = this.groupColorTokens(colors);

        if (colors.length === 0) {
            return `<div class="tm-empty">No color tokens found. Theme CSS may not be loaded.</div>`;
        }

        return `
            <div class="tm-colors-tab">
                ${Object.entries(colorGroups).map(([groupName, groupTokens]) => `
                    <div class="tm-color-group">
                        <h4 class="tm-group-title">${this.formatGroupName(groupName)}</h4>
                        <div class="tm-color-grid">
                            ${groupTokens.map(token => `
                                <div class="tm-color-item">
                                    <div class="tm-color-swatch" style="background: ${token.value}">
                                        <input
                                            type="color"
                                            value="${this.normalizeColorForInput(token.value)}"
                                            data-token="${token.variable}"
                                            class="tm-color-input"
                                        />
                                    </div>
                                    <div class="tm-color-info">
                                        <div class="tm-color-name">${token.name}</div>
                                        <input
                                            type="text"
                                            value="${token.value}"
                                            data-token="${token.variable}"
                                            class="tm-color-value"
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

    groupColorTokens(colors) {
        const groups = {
            primary: [],
            neutral: [],
            status: [],
            surface: [],
            text: [],
            other: []
        };

        colors.forEach(token => {
            const name = token.name.toLowerCase();
            if (name.includes('primary')) groups.primary.push(token);
            else if (name.includes('neutral')) groups.neutral.push(token);
            else if (name.includes('success') || name.includes('warning') || name.includes('error') || name.includes('info')) groups.status.push(token);
            else if (name.includes('bg') || name.includes('surface') || name.includes('border') || name.includes('divider')) groups.surface.push(token);
            else if (name.includes('text') || name.includes('fg')) groups.text.push(token);
            else groups.other.push(token);
        });

        // Filter out empty groups
        return Object.fromEntries(
            Object.entries(groups).filter(([_, tokens]) => tokens.length > 0)
        );
    }

    renderTypographyTab(theme) {
        // Use tokens from CSS computed styles
        const typography = this.tokens.typography || [];

        if (typography.length === 0) {
            return `<div class="tm-empty">No typography tokens found.</div>`;
        }

        const fontFamilies = typography.filter(t => t.name.includes('font-family') || t.name.includes('font-sans') || t.name.includes('font-mono') || t.name.includes('font-serif'));
        const fontSizes = typography.filter(t => t.name.includes('font-size'));
        const fontWeights = typography.filter(t => t.name.includes('font-weight'));
        const lineHeights = typography.filter(t => t.name.includes('line-height'));

        return `
            <div class="tm-typography-tab">
                ${fontFamilies.length > 0 ? `
                <div class="tm-typo-section">
                    <h4>Font Families</h4>
                    <div class="tm-typo-list">
                        ${fontFamilies.map(token => `
                            <div class="tm-typo-item">
                                <label>${token.name}</label>
                                <input
                                    type="text"
                                    value="${token.value}"
                                    data-token="${token.variable}"
                                    class="tm-typo-input"
                                    readonly
                                />
                                <div class="tm-typo-preview" style="font-family: ${token.value}">Aa Bb Cc</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${fontSizes.length > 0 ? `
                <div class="tm-typo-section">
                    <h4>Font Sizes</h4>
                    <div class="tm-typo-grid">
                        ${fontSizes.map(token => `
                            <div class="tm-typo-size-item">
                                <label>${token.name}</label>
                                <input
                                    type="text"
                                    value="${token.value}"
                                    data-token="${token.variable}"
                                    class="tm-typo-input"
                                    readonly
                                />
                                <span class="tm-size-preview" style="font-size: ${token.value}">Aa</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${fontWeights.length > 0 ? `
                <div class="tm-typo-section">
                    <h4>Font Weights</h4>
                    <div class="tm-typo-grid">
                        ${fontWeights.map(token => `
                            <div class="tm-typo-item">
                                <label>${token.name}</label>
                                <input
                                    type="text"
                                    value="${token.value}"
                                    data-token="${token.variable}"
                                    class="tm-typo-input"
                                    readonly
                                />
                                <span style="font-weight: ${token.value}">Sample</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${lineHeights.length > 0 ? `
                <div class="tm-typo-section">
                    <h4>Line Heights</h4>
                    <div class="tm-typo-grid">
                        ${lineHeights.map(token => `
                            <div class="tm-typo-item">
                                <label>${token.name}</label>
                                <input
                                    type="text"
                                    value="${token.value}"
                                    data-token="${token.variable}"
                                    class="tm-typo-input"
                                    readonly
                                />
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    renderSpacingTab(theme) {
        // Use tokens from CSS computed styles
        const spacing = this.tokens.spacing || [];

        if (spacing.length === 0) {
            return `<div class="tm-empty">No spacing tokens found.</div>`;
        }

        return `
            <div class="tm-spacing-tab">
                <div class="tm-spacing-list">
                    ${spacing.map(token => `
                        <div class="tm-spacing-item">
                            <label>${token.name}</label>
                            <input
                                type="text"
                                value="${token.value}"
                                data-token="${token.variable}"
                                class="tm-spacing-input"
                                readonly
                            />
                            <div class="tm-spacing-visual">
                                <div class="tm-spacing-bar" style="width: ${this.getSpacingWidth(token.value)}"></div>
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

    onMount(container) {
        super.onMount(container);

        // Load tokens from CSS
        this.loadTokensFromCSS();

        this.unsubscribe = themeService.subscribe((theme) => {
            this.currentTheme = theme;
            this.loadTokensFromCSS(); // Reload tokens when theme changes
            this.updateDisplay();
        });

        this.attachEventListeners();
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
        if (!this.getContainer()) return;

        // Theme selector
        const themeSelect = this.getContainer().querySelector('#theme-select');
        themeSelect?.addEventListener('change', (e) => {
            this.loadTheme(e.target.value);
        });

        // Tab switching
        this.getContainer().addEventListener('click', (e) => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                this.activeTab = tab.dataset.tab;
                this.updateDisplay();
            }
        });

        // OS Sync toggle
        const osSyncBtn = this.getContainer().querySelector('#sync-os-btn');
        osSyncBtn?.addEventListener('click', () => {
            const isEnabled = localStorage.getItem('devpages:theme:syncOS') === 'true';
            themeService.setOSThemeSync(!isEnabled);
            this.updateDisplay();
        });

        // New theme button - toggle form
        const newThemeBtn = this.getContainer().querySelector('#new-theme-btn');
        newThemeBtn?.addEventListener('click', () => this.toggleNewThemeForm());

        // Cancel new theme buttons
        const cancelNewThemeBtn = this.getContainer().querySelector('#cancel-new-theme-btn');
        const cancelNewThemeBtn2 = this.getContainer().querySelector('#cancel-new-theme-btn-2');
        cancelNewThemeBtn?.addEventListener('click', () => this.toggleNewThemeForm());
        cancelNewThemeBtn2?.addEventListener('click', () => this.toggleNewThemeForm());

        // Create theme button
        const createThemeBtn = this.getContainer().querySelector('#create-theme-btn');
        createThemeBtn?.addEventListener('click', () => this.createNewTheme());

        // Theme name input for editable themes
        const themeNameInput = this.getContainer().querySelector('#theme-name-input');
        themeNameInput?.addEventListener('change', (e) => this.updateThemeName(e.target.value));

        // Apply theme button
        const applyBtn = this.getContainer().querySelector('#apply-theme-btn');
        applyBtn?.addEventListener('click', () => this.applyTheme());

        // Save theme button
        const saveBtn = this.getContainer().querySelector('#save-theme-btn');
        saveBtn?.addEventListener('click', () => this.saveTheme());

        // Delete theme button - show confirmation
        const deleteBtn = this.getContainer().querySelector('#delete-theme-btn');
        deleteBtn?.addEventListener('click', () => this.toggleDeleteConfirm());

        // Confirm delete button
        const confirmDeleteBtn = this.getContainer().querySelector('#confirm-delete-btn');
        confirmDeleteBtn?.addEventListener('click', () => this.deleteTheme());

        // Cancel delete button
        const cancelDeleteBtn = this.getContainer().querySelector('#cancel-delete-btn');
        cancelDeleteBtn?.addEventListener('click', () => this.toggleDeleteConfirm());

        // Token inputs - live preview updates CSS variables directly
        this.getContainer().addEventListener('input', (e) => {
            const tokenVar = e.target.dataset.token;
            if (!tokenVar) return;

            if (e.target.classList.contains('tm-color-input') ||
                e.target.classList.contains('tm-color-value')) {
                this.updateToken(tokenVar, e.target.value);
            }
        });

        // Export buttons
        this.getContainer().addEventListener('click', (e) => {
            const exportBtn = e.target.closest('[data-format]');
            if (exportBtn) {
                this.exportTheme(exportBtn.dataset.format);
            }

            if (e.target.closest('#copy-export-btn')) {
                this.copyExport();
            }
        });
    }

    updateDisplay() {
        const container = this.getContainer();
        if (!container) return;

        // Refresh token data from CSS
        this.loadTokensFromCSS();

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
        const nameInput = this.getContainer().querySelector('#new-theme-name');
        const baseSelect = this.getContainer().querySelector('#new-theme-base');

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
        const saveBtn = this.getContainer().querySelector('#save-theme-btn');
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

    updateToken(variableName, value) {
        // Live preview - update CSS custom property directly
        document.documentElement.style.setProperty(variableName, value);

        // Sync color picker and text input
        const container = this.getContainer();
        const inputs = container.querySelectorAll(`[data-token="${variableName}"]`);
        inputs.forEach(input => {
            if (input.type === 'color') {
                input.value = this.normalizeColorForInput(value);
            } else {
                input.value = value;
            }
        });

        console.log(`[ThemeManagementPanel] Updated ${variableName}: ${value}`);
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
                output = this.exportToJSON();
                break;
            case 'js':
                output = `export const theme = ${this.exportToJSON()};`;
                break;
        }

        const container = this.getContainer();
        const outputEl = container.querySelector('#export-output code');
        const labelEl = container.querySelector('#export-format-label');

        if (outputEl) outputEl.textContent = output;
        if (labelEl) labelEl.textContent = `${format.toUpperCase()} Export`;
    }

    exportToCSS(theme) {
        // Export all tokens from computed CSS styles
        let css = `/* ${theme.name} - Exported CSS Variables */\n`;
        css += `:root {\n`;

        // Colors
        css += `  /* Colors */\n`;
        this.tokens.colors.forEach(token => {
            css += `  ${token.variable}: ${token.value};\n`;
        });

        // Typography
        css += `\n  /* Typography */\n`;
        this.tokens.typography.forEach(token => {
            css += `  ${token.variable}: ${token.value};\n`;
        });

        // Spacing
        css += `\n  /* Spacing */\n`;
        this.tokens.spacing.forEach(token => {
            css += `  ${token.variable}: ${token.value};\n`;
        });

        // Effects
        css += `\n  /* Effects */\n`;
        this.tokens.effects.forEach(token => {
            css += `  ${token.variable}: ${token.value};\n`;
        });

        css += `}\n`;
        return css;
    }

    exportToJSON() {
        // Convert tokens to JSON format
        const jsonExport = {
            colors: {},
            typography: {},
            spacing: {},
            effects: {}
        };

        this.tokens.colors.forEach(t => { jsonExport.colors[t.name] = t.value; });
        this.tokens.typography.forEach(t => { jsonExport.typography[t.name] = t.value; });
        this.tokens.spacing.forEach(t => { jsonExport.spacing[t.name] = t.value; });
        this.tokens.effects.forEach(t => { jsonExport.effects[t.name] = t.value; });

        return JSON.stringify(jsonExport, null, 2);
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
