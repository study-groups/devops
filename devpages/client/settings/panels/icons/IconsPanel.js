/**
 * IconsPanel.js - Icons and icon design tokens management panel
 * Provides comprehensive icon management with design tokens for explicit icon specification
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { panelRegistry } from '../../core/panelRegistry.js';

function logIcons(message, level = 'info') {
    const type = 'ICONS_PANEL';
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export class IconsPanel {
    constructor(parentElement) {
        this.containerElement = parentElement;
        this.stateUnsubscribe = null;
        this.iconSets = new Map();
        this.customIcons = new Map();
        this.iconTokens = {};
        
        // Default icon sets
        this.defaultIconSets = {
            'system': {
                name: 'System Icons',
                description: 'Core system interface icons',
                icons: {
                    'chevron-right': '▶',
                    'chevron-down': '▼',
                    'chevron-left': '◀',
                    'chevron-up': '▲',
                    'close': '✕',
                    'check': '✓',
                    'warning': '⚠',
                    'error': '✗',
                    'info': 'ℹ',
                    'success': '✓',
                    'loading': '⟳',
                    'search': '🔍',
                    'settings': '⚙',
                    'menu': '☰',
                    'home': '🏠',
                    'folder': '📁',
                    'file': '📄',
                    'edit': '✏',
                    'delete': '🗑',
                    'add': '+',
                    'remove': '−',
                    'copy': '📋',
                    'download': '⬇',
                    'upload': '⬆',
                    'refresh': '↻',
                    'external-link': '↗',
                    'link': '🔗'
                }
            },
            'ui': {
                name: 'UI Elements',
                description: 'User interface element icons',
                icons: {
                    'button': '⬜',
                    'input': '▭',
                    'checkbox': '☐',
                    'checkbox-checked': '☑',
                    'radio': '○',
                    'radio-selected': '●',
                    'dropdown': '▼',
                    'tab': '📑',
                    'modal': '🗖',
                    'tooltip': '💬',
                    'notification': '🔔',
                    'badge': '●',
                    'progress': '▬',
                    'slider': '━',
                    'toggle-off': '○',
                    'toggle-on': '●'
                }
            },
            'content': {
                name: 'Content Icons',
                description: 'Content and document related icons',
                icons: {
                    'text': '📝',
                    'heading': '𝐇',
                    'paragraph': '¶',
                    'list': '≡',
                    'list-ordered': '1.',
                    'quote': '"',
                    'code': '<>',
                    'image': '🖼',
                    'video': '🎥',
                    'audio': '🔊',
                    'table': '⊞',
                    'calendar': '📅',
                    'clock': '🕐',
                    'tag': '🏷',
                    'bookmark': '🔖',
                    'star': '⭐',
                    'heart': '♥',
                    'thumbs-up': '👍',
                    'thumbs-down': '👎'
                }
            },
            'status': {
                name: 'Status Icons',
                description: 'Status and state indicator icons',
                icons: {
                    'online': '●',
                    'offline': '○',
                    'busy': '◐',
                    'away': '◯',
                    'active': '✓',
                    'inactive': '○',
                    'enabled': '●',
                    'disabled': '○',
                    'visible': '👁',
                    'hidden': '🙈',
                    'locked': '🔒',
                    'unlocked': '🔓',
                    'secure': '🛡',
                    'insecure': '⚠',
                    'verified': '✓',
                    'unverified': '?'
                }
            }
        };
        
        this.loadCSS();
        this.createPanelContent(parentElement);
        this.subscribeToState();
        this.initializeIconSets();
        
        // Make panel globally accessible for icon selection
        window.iconsPanel = this;
        
        logIcons('IconsPanel initialized');
    }

    loadCSS() {
        const cssId = 'icons-panel-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = '/client/settings/panels/icons/IconsPanel.css';
            document.head.appendChild(link);
            logIcons('Loaded IconsPanel.css');
        }
    }

    createPanelContent(parentElement) {
        parentElement.innerHTML = `
            <div class="icons-panel-content">
                <div class="icon-sets-section">
                    <h5>Icon Sets</h5>
                    <div class="icon-sets-controls">
                        <div class="form-group">
                            <label for="active-icon-set">Active Icon Set:</label>
                            <select id="active-icon-set" class="form-select">
                                <option value="system">System Icons</option>
                                <option value="ui">UI Elements</option>
                                <option value="content">Content Icons</option>
                                <option value="status">Status Icons</option>
                            </select>
                        </div>
                        <div class="icon-set-actions">
                            <button id="create-icon-set" class="action-btn">Create Icon Set</button>
                            <button id="import-icon-set" class="action-btn secondary">Import Icons</button>
                            <button id="export-icon-tokens" class="action-btn secondary">Export Tokens</button>
                        </div>
                    </div>
                </div>

                <div class="icon-browser-section">
                    <h5>Icon Browser</h5>
                    <div class="icon-browser-controls">
                        <div class="form-group">
                            <input type="text" id="icon-search" placeholder="Search icons..." class="form-input">
                        </div>
                        <div class="icon-display-options">
                            <label class="form-checkbox">
                                <input type="checkbox" id="show-icon-names" checked>
                                <span>Show Names</span>
                            </label>
                            <label class="form-checkbox">
                                <input type="checkbox" id="show-icon-codes" checked>
                                <span>Show Codes</span>
                            </label>
                        </div>
                    </div>
                    <div class="icon-grid" id="icon-grid">
                        <!-- Icons will be populated here -->
                    </div>
                </div>

                <div class="icon-tokens-section">
                    <h5>Icon Design Tokens</h5>
                    <div class="icon-tokens-controls">
                        <div class="form-group">
                            <label for="icon-size-base">Base Icon Size:</label>
                            <input type="text" id="icon-size-base" value="1rem" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="icon-color-primary">Primary Icon Color:</label>
                            <input type="color" id="icon-color-primary" value="#475569" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="icon-color-secondary">Secondary Icon Color:</label>
                            <input type="color" id="icon-color-secondary" value="#9ca3af" class="form-input">
                        </div>
                    </div>
                    <div class="token-preview" id="token-preview">
                        <!-- Token preview will be shown here -->
                    </div>
                </div>

                <div class="custom-icons-section">
                    <h5>Custom Icons</h5>
                    <div class="custom-icons-controls">
                        <div class="form-group">
                            <label for="custom-icon-name">Icon Name:</label>
                            <input type="text" id="custom-icon-name" placeholder="my-custom-icon" class="form-input">
                        </div>
                        <div class="form-group">
                            <label for="custom-icon-symbol">Icon Symbol:</label>
                            <input type="text" id="custom-icon-symbol" placeholder="⚡" class="form-input">
                        </div>
                        <button id="add-custom-icon" class="action-btn">Add Custom Icon</button>
                    </div>
                    <div class="custom-icons-list" id="custom-icons-list">
                        <!-- Custom icons will be listed here -->
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.renderIconGrid();
        this.updateTokenPreview();
    }

    attachEventListeners() {
        // Icon set controls
        document.getElementById('active-icon-set')?.addEventListener('change', (e) => {
            this.setActiveIconSet(e.target.value);
        });

        document.getElementById('create-icon-set')?.addEventListener('click', () => {
            this.createIconSet();
        });

        document.getElementById('import-icon-set')?.addEventListener('click', () => {
            this.importIconSet();
        });

        document.getElementById('export-icon-tokens')?.addEventListener('click', () => {
            this.exportIconTokens();
        });

        // Icon browser controls
        document.getElementById('icon-search')?.addEventListener('input', (e) => {
            this.filterIcons(e.target.value);
        });

        document.getElementById('show-icon-names')?.addEventListener('change', () => {
            this.renderIconGrid();
        });

        document.getElementById('show-icon-codes')?.addEventListener('change', () => {
            this.renderIconGrid();
        });

        // Icon tokens controls
        document.getElementById('icon-size-base')?.addEventListener('input', (e) => {
            this.updateIconToken('size-base', e.target.value);
        });

        document.getElementById('icon-color-primary')?.addEventListener('input', (e) => {
            this.updateIconToken('color-primary', e.target.value);
        });

        document.getElementById('icon-color-secondary')?.addEventListener('input', (e) => {
            this.updateIconToken('color-secondary', e.target.value);
        });

        // Custom icons controls
        document.getElementById('add-custom-icon')?.addEventListener('click', () => {
            this.addCustomIcon();
        });
    }

    initializeIconSets() {
        // Load default icon sets
        for (const [key, iconSet] of Object.entries(this.defaultIconSets)) {
            this.iconSets.set(key, iconSet);
        }
        
        // Load custom icons from state
        this.loadCustomIcons();
        
        logIcons(`Initialized ${this.iconSets.size} icon sets`);
    }

    setActiveIconSet(setKey) {
        this.activeIconSet = setKey;
        this.renderIconGrid();
        
        dispatch({
            type: ActionTypes.SETTINGS_SET_ACTIVE_ICON_SET,
            payload: setKey
        });
        
        logIcons(`Active icon set changed to: ${setKey}`);
    }

    renderIconGrid() {
        const gridContainer = document.getElementById('icon-grid');
        const activeSet = this.iconSets.get(this.activeIconSet || 'system');
        const showNames = document.getElementById('show-icon-names')?.checked ?? true;
        const showCodes = document.getElementById('show-icon-codes')?.checked ?? true;
        
        if (!activeSet) {
            gridContainer.innerHTML = '<p class="no-icons">No icons available</p>';
            return;
        }

        const iconsHtml = Object.entries(activeSet.icons).map(([name, symbol]) => `
            <div class="icon-item" data-icon-name="${name}" data-icon-symbol="${symbol}">
                <div class="icon-symbol" title="Click to copy">${symbol}</div>
                ${showNames ? `<div class="icon-name">${name}</div>` : ''}
                ${showCodes ? `<div class="icon-code">${symbol.codePointAt(0).toString(16).toUpperCase()}</div>` : ''}
                <div class="icon-actions">
                    <button class="icon-action" onclick="window.iconsPanel?.copyIcon('${name}', '${symbol}')">Copy</button>
                    <button class="icon-action" onclick="window.iconsPanel?.useIcon('${name}', '${symbol}')">Use</button>
                </div>
            </div>
        `).join('');

        gridContainer.innerHTML = `
            <div class="icon-set-header">
                <h6>${activeSet.name}</h6>
                <p>${activeSet.description}</p>
                <div class="icon-count">${Object.keys(activeSet.icons).length} icons</div>
            </div>
            <div class="icon-grid-container">
                ${iconsHtml}
            </div>
        `;

        // Add click listeners for icon symbols
        gridContainer.querySelectorAll('.icon-symbol').forEach(symbol => {
            symbol.addEventListener('click', (e) => {
                const iconItem = e.target.closest('.icon-item');
                const name = iconItem.dataset.iconName;
                const symbolText = iconItem.dataset.iconSymbol;
                this.copyIcon(name, symbolText);
            });
        });
    }

    filterIcons(searchTerm) {
        const iconItems = document.querySelectorAll('.icon-item');
        const term = searchTerm.toLowerCase();
        
        iconItems.forEach(item => {
            const name = item.dataset.iconName.toLowerCase();
            const matches = name.includes(term);
            item.style.display = matches ? 'block' : 'none';
        });
        
        logIcons(`Filtered icons with term: "${searchTerm}"`);
    }

    copyIcon(name, symbol) {
        const iconToken = `var(--icon-${name}, '${symbol}')`;
        
        navigator.clipboard.writeText(iconToken).then(() => {
            this.showTemporaryMessage(`Copied icon token: ${iconToken}`, 'success');
            logIcons(`Copied icon token for: ${name}`);
        }).catch(() => {
            // Fallback: copy just the symbol
            navigator.clipboard.writeText(symbol).then(() => {
                this.showTemporaryMessage(`Copied icon symbol: ${symbol}`, 'success');
            });
        });
    }

    useIcon(name, symbol) {
        // This would integrate with other panels or the page editor
        // For now, just show how to use the icon
        const usage = `
/* CSS Usage */
.my-element::before {
    content: var(--icon-${name}, '${symbol}');
    font-family: var(--icon-font-family, inherit);
    font-size: var(--icon-size-base, 1rem);
    color: var(--icon-color-primary, currentColor);
}

/* HTML Usage */
<span class="icon icon-${name}" aria-label="${name.replace('-', ' ')}">${symbol}</span>
        `.trim();
        
        this.showUsageModal(name, symbol, usage);
        logIcons(`Showed usage for icon: ${name}`);
    }

    showUsageModal(name, symbol, usage) {
        const modal = document.createElement('div');
        modal.className = 'icon-usage-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Icon Usage: ${name}</h3>
                    <div class="icon-preview">
                        <span class="preview-symbol">${symbol}</span>
                    </div>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="usage-tabs">
                        <button class="tab-btn active" data-tab="css">CSS</button>
                        <button class="tab-btn" data-tab="html">HTML</button>
                        <button class="tab-btn" data-tab="tokens">Tokens</button>
                    </div>
                    <div class="tab-content">
                        <div class="tab-pane active" id="css-tab">
                            <textarea class="usage-code" readonly>${usage}</textarea>
                        </div>
                        <div class="tab-pane" id="html-tab">
                            <textarea class="usage-code" readonly><span class="icon icon-${name}" aria-label="${name.replace('-', ' ')}">${symbol}</span></textarea>
                        </div>
                        <div class="tab-pane" id="tokens-tab">
                            <textarea class="usage-code" readonly>--icon-${name}: '${symbol}';
--icon-${name}-size: var(--icon-size-base, 1rem);
--icon-${name}-color: var(--icon-color-primary, currentColor);</textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn" onclick="navigator.clipboard.writeText(document.querySelector('.tab-pane.active .usage-code').value)">Copy Code</button>
                    <button class="modal-btn secondary" onclick="this.closest('.icon-usage-modal').remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeModal = () => modal.remove();
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

        // Tab switching
        modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                
                // Update active tab button
                modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update active tab pane
                modal.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                modal.querySelector(`#${tabName}-tab`).classList.add('active');
            });
        });
    }

    updateIconToken(tokenName, value) {
        this.iconTokens[tokenName] = value;
        this.updateTokenPreview();
        this.applyIconTokens();
        
        dispatch({
            type: ActionTypes.SETTINGS_UPDATE_ICON_TOKENS,
            payload: { [tokenName]: value }
        });
        
        logIcons(`Updated icon token: ${tokenName} = ${value}`);
    }

    updateTokenPreview() {
        const previewContainer = document.getElementById('token-preview');
        const tokens = {
            'size-base': document.getElementById('icon-size-base')?.value || '1rem',
            'color-primary': document.getElementById('icon-color-primary')?.value || '#475569',
            'color-secondary': document.getElementById('icon-color-secondary')?.value || '#9ca3af'
        };

        previewContainer.innerHTML = `
            <div class="token-preview-content">
                <h6>Design Token Preview</h6>
                <div class="token-examples">
                    <div class="token-example">
                        <span class="example-icon" style="font-size: ${tokens['size-base']}; color: ${tokens['color-primary']};">⚙</span>
                        <span class="example-label">Primary (${tokens['size-base']})</span>
                    </div>
                    <div class="token-example">
                        <span class="example-icon" style="font-size: ${tokens['size-base']}; color: ${tokens['color-secondary']};">ℹ</span>
                        <span class="example-label">Secondary</span>
                    </div>
                </div>
                <div class="token-css">
                    <code>--icon-size-base: ${tokens['size-base']};</code>
                    <code>--icon-color-primary: ${tokens['color-primary']};</code>
                    <code>--icon-color-secondary: ${tokens['color-secondary']};</code>
                </div>
            </div>
        `;
    }

    applyIconTokens() {
        const root = document.documentElement;
        const tokens = {
            'size-base': document.getElementById('icon-size-base')?.value || '1rem',
            'color-primary': document.getElementById('icon-color-primary')?.value || '#475569',
            'color-secondary': document.getElementById('icon-color-secondary')?.value || '#9ca3af'
        };

        root.style.setProperty('--icon-size-base', tokens['size-base']);
        root.style.setProperty('--icon-color-primary', tokens['color-primary']);
        root.style.setProperty('--icon-color-secondary', tokens['color-secondary']);
    }

    addCustomIcon() {
        const nameInput = document.getElementById('custom-icon-name');
        const symbolInput = document.getElementById('custom-icon-symbol');
        
        const name = nameInput.value.trim();
        const symbol = symbolInput.value.trim();
        
        if (!name || !symbol) {
            this.showTemporaryMessage('Please provide both name and symbol', 'error');
            return;
        }
        
        // Validate name format
        if (!/^[a-z0-9-]+$/.test(name)) {
            this.showTemporaryMessage('Icon name must contain only lowercase letters, numbers, and hyphens', 'error');
            return;
        }
        
        this.customIcons.set(name, symbol);
        this.saveCustomIcons();
        this.renderCustomIconsList();
        
        // Clear inputs
        nameInput.value = '';
        symbolInput.value = '';
        
        this.showTemporaryMessage(`Added custom icon: ${name}`, 'success');
        logIcons(`Added custom icon: ${name} = ${symbol}`);
    }

    renderCustomIconsList() {
        const listContainer = document.getElementById('custom-icons-list');
        
        if (this.customIcons.size === 0) {
            listContainer.innerHTML = '<p class="no-custom-icons">No custom icons added yet</p>';
            return;
        }

        const iconsHtml = Array.from(this.customIcons.entries()).map(([name, symbol]) => `
            <div class="custom-icon-item">
                <div class="custom-icon-info">
                    <span class="custom-icon-symbol">${symbol}</span>
                    <span class="custom-icon-name">${name}</span>
                </div>
                <div class="custom-icon-actions">
                    <button class="icon-action" onclick="window.iconsPanel?.copyIcon('${name}', '${symbol}')">Copy</button>
                    <button class="icon-action warning" onclick="window.iconsPanel?.removeCustomIcon('${name}')">Remove</button>
                </div>
            </div>
        `).join('');

        listContainer.innerHTML = iconsHtml;
    }

    removeCustomIcon(name) {
        if (this.customIcons.has(name)) {
            this.customIcons.delete(name);
            this.saveCustomIcons();
            this.renderCustomIconsList();
            this.showTemporaryMessage(`Removed custom icon: ${name}`, 'success');
            logIcons(`Removed custom icon: ${name}`);
        }
    }

    saveCustomIcons() {
        const customIconsObj = Object.fromEntries(this.customIcons);
        dispatch({
            type: ActionTypes.SETTINGS_SAVE_CUSTOM_ICONS,
            payload: customIconsObj
        });
    }

    loadCustomIcons() {
        const state = appStore.getState();
        const customIcons = state.settings?.icons?.customIcons || {};
        
        this.customIcons.clear();
        for (const [name, symbol] of Object.entries(customIcons)) {
            this.customIcons.set(name, symbol);
        }
        
        this.renderCustomIconsList();
    }

    createIconSet() {
        // This would open a modal to create a new icon set
        this.showTemporaryMessage('Icon set creation coming soon', 'info');
    }

    importIconSet() {
        // This would allow importing icon sets from files
        this.showTemporaryMessage('Icon set import coming soon', 'info');
    }

    exportIconTokens() {
        const tokens = this.generateIconTokens();
        const content = this.generateIconTokensCSS(tokens);
        
        this.downloadFile('icon-tokens.css', content);
        logIcons('Exported icon tokens');
    }

    generateIconTokens() {
        const allIcons = {};
        
        // Add icons from all sets
        for (const [setKey, iconSet] of this.iconSets.entries()) {
            for (const [iconName, symbol] of Object.entries(iconSet.icons)) {
                allIcons[iconName] = symbol;
            }
        }
        
        // Add custom icons
        for (const [name, symbol] of this.customIcons.entries()) {
            allIcons[name] = symbol;
        }
        
        return allIcons;
    }

    generateIconTokensCSS(icons) {
        const baseTokens = {
            'size-base': document.getElementById('icon-size-base')?.value || '1rem',
            'color-primary': document.getElementById('icon-color-primary')?.value || '#475569',
            'color-secondary': document.getElementById('icon-color-secondary')?.value || '#9ca3af'
        };

        let css = `/* Icon Design Tokens - Generated ${new Date().toISOString()} */
/* DevPages Icon System */

:root {
  /* Base Icon Tokens */
  --icon-size-base: ${baseTokens['size-base']};
  --icon-color-primary: ${baseTokens['color-primary']};
  --icon-color-secondary: ${baseTokens['color-secondary']};
  --icon-font-family: inherit;
  
  /* Icon Size Scale */
  --icon-size-xs: calc(var(--icon-size-base) * 0.75);
  --icon-size-sm: calc(var(--icon-size-base) * 0.875);
  --icon-size-md: var(--icon-size-base);
  --icon-size-lg: calc(var(--icon-size-base) * 1.25);
  --icon-size-xl: calc(var(--icon-size-base) * 1.5);
  --icon-size-2xl: calc(var(--icon-size-base) * 2);
  
  /* Icon Symbols */
`;

        // Add all icon tokens
        for (const [name, symbol] of Object.entries(icons)) {
            css += `  --icon-${name}: '${symbol}';\n`;
        }

        css += `}

/* Icon Utility Classes */
.icon {
  font-family: var(--icon-font-family);
  font-size: var(--icon-size-base);
  color: var(--icon-color-primary);
  display: inline-block;
  line-height: 1;
  vertical-align: middle;
}

.icon-xs { font-size: var(--icon-size-xs); }
.icon-sm { font-size: var(--icon-size-sm); }
.icon-md { font-size: var(--icon-size-md); }
.icon-lg { font-size: var(--icon-size-lg); }
.icon-xl { font-size: var(--icon-size-xl); }
.icon-2xl { font-size: var(--icon-size-2xl); }

.icon-primary { color: var(--icon-color-primary); }
.icon-secondary { color: var(--icon-color-secondary); }

/* Specific Icon Classes */
`;

        // Add specific icon classes
        for (const [name, symbol] of Object.entries(icons)) {
            css += `.icon-${name}::before { content: var(--icon-${name}); }\n`;
        }

        return css;
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
        
        logIcons(`File downloaded: ${filename}`);
    }

    showTemporaryMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `temp-message temp-message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }

    subscribeToState() {
        this.stateUnsubscribe = appStore.subscribe((newState, prevState) => {
            if (newState.settings?.icons !== prevState.settings?.icons) {
                this.handleStateUpdate(newState.settings.icons);
            }
        });
    }

    handleStateUpdate(iconsState) {
        if (iconsState?.activeIconSet !== this.activeIconSet) {
            this.activeIconSet = iconsState.activeIconSet;
            document.getElementById('active-icon-set').value = this.activeIconSet;
            this.renderIconGrid();
        }
        
        if (iconsState?.customIcons) {
            this.loadCustomIcons();
        }
    }

    destroy() {
        logIcons('Destroying IconsPanel...');
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        
        // Clean up global reference
        if (window.iconsPanel === this) {
            window.iconsPanel = null;
        }
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        this.containerElement = null;
        logIcons('IconsPanel destroyed.');
    }
}

// Register this panel with the registry
panelRegistry.register({
    id: 'icons-container',
    title: 'Icons',
    component: IconsPanel,
    order: 6,
    defaultCollapsed: false
}); 