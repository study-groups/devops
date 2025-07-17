/**
 * IconsPanel.js - Icons and icon design tokens management panel
 * Provides comprehensive icon management with design tokens for explicit icon specification
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';
import { settingsSectionRegistry } from '../../core/settingsSectionRegistry.js';

const SYSTEM_ICONS = [
    'gear', 'folder', 'info', 'chevron-right', 'chevron-down', 'close', 
    'check', 'search', 'menu', 'edit', 'delete', 'add', 'copy', 'external-link'
];

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
        
        // Default icon sets - now defined directly
        this.iconSets.set('system', {
            name: 'System Icons',
            description: 'Core system interface icons, powered by CSS masks.',
            icons: SYSTEM_ICONS.reduce((acc, name) => {
                acc[name] = name; // Value is the same as the key
                return acc;
            }, {})
        });
        
        this.loadCSS();
        this.createPanelContent(parentElement);

        // Defer listener attachment and initialization
        Promise.resolve().then(() => {
            this.attachEventListeners();
            // No longer need to call initializeIconSets for defaults
        });

        this.subscribeToState();
        
        // Register with the new devpages structure
        if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
            window.devpages._internal.consolidator.migrate('iconsPanel', this);
            window.devpages._internal.consolidator.migrate('iconUtils', window.iconUtils);
        } else {
            // Fallback for legacy support
            window.iconsPanel = this;
        }
        
        // Enforce custom icon usage
        this.enforceCustomIcons();
        
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
    }

    attachEventListeners() {
        const query = (selector) => this.containerElement.querySelector(selector);

        // Icon set controls
        query('#active-icon-set')?.addEventListener('change', (e) => this.setActiveIconSet(e.target.value));
        query('#create-icon-set')?.addEventListener('click', () => this.createIconSet());
        query('#import-icon-set')?.addEventListener('click', () => this.importIconSet());
        query('#export-icon-tokens')?.addEventListener('click', () => this.exportIconTokens());

        // Icon browser controls
        query('#icon-search')?.addEventListener('input', (e) => this.filterIcons(e.target.value));
        query('#show-icon-names')?.addEventListener('change', () => this.renderIconGrid());
        query('#show-icon-codes')?.addEventListener('change', () => this.renderIconGrid());

        // Icon grid interaction (delegated)
        query('#icon-grid')?.addEventListener('click', (e) => {
            const iconElement = e.target.closest('.icon-item');
            if (iconElement) {
                const name = iconElement.dataset.iconName;
                if (e.ctrlKey || e.metaKey) {
                    this.useIcon(name);
                } else {
                    this.copyIcon(name);
                }
            }
        });

        // Custom icon controls
        query('#add-custom-icon')?.addEventListener('click', () => this.addCustomIcon());
        query('#custom-icon-list')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-custom-icon')) {
                const iconName = e.target.dataset.name;
                this.removeCustomIcon(iconName);
            }
        });

        // Icon token configuration
        query('#icon-size-base')?.addEventListener('change', () => this.updateTokenPreview());
        query('#icon-color-primary')?.addEventListener('change', () => this.updateTokenPreview());
        query('#icon-color-secondary')?.addEventListener('change', () => this.updateTokenPreview());
    }

    initializeIconSets() {
        // This method is now only for loading custom icons, which is handled elsewhere.
        // We can potentially remove this or repurpose it later.
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
        
        if (!activeSet) {
            gridContainer.innerHTML = '<p class="no-icons">No icons available</p>';
            return;
        }

        const iconsHtml = Object.keys(activeSet.icons).map((name) => `
            <div class="icon-item" data-icon-name="${name}">
                <div class="icon-symbol">
                    <span class="icon icon-${name}"></span>
                </div>
                ${showNames ? `<div class="icon-name">${name}</div>` : ''}
                <div class="icon-actions">
                    <button class="icon-action" onclick="window.iconsPanel?.copyIcon('${name}')">Copy CSS</button>
                    <button class="icon-action" onclick="window.iconsPanel?.useIcon('${name}')">Use</button>
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
                this.copyIcon(name);
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

    copyIcon(name) {
        const className = `icon-${name}`;
        
        navigator.clipboard.writeText(className).then(() => {
            this.showTemporaryMessage(`Copied CSS class: .${className}`, 'success');
            logIcons(`Copied class for: ${name}`);
        }).catch((err) => {
            this.showTemporaryMessage(`Failed to copy: ${err}`, 'error');
        });
    }

    useIcon(name) {
        // This would integrate with other panels or the page editor
        // For now, just show how to use the icon
        const usage = `
/* HTML Usage */
<span class="icon icon-${name}" style="color: var(--color-primary);"></span>

/* CSS Usage */
.my-element::before {
    content: '';
    display: inline-block;
    width: 1em;
    height: 1em;
    background-color: var(--color-primary);
    -webkit-mask-image: var(--icon-${name});
    mask-image: var(--icon-${name});
}
        `.trim();
        
        this.showUsageModal(name, `<span class="icon icon-${name}"></span>`, usage);
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
                const tabName = e.currentTarget.dataset.tab;
                
                // Update active tab button
                modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
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
        const previewContainer = document.querySelector(".preview-container");
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
                        <span class="example-icon" style="font-size: ${tokens['size-base']}; color: ${tokens['color-secondary']};">i</span>
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

    /**
     * Enforce custom icon usage throughout the application
     */
    enforceCustomIcons() {
        // Replace hardcoded emoji icons with custom icon tokens
        this.scanAndReplaceHardcodedIcons();
        
        // Set up mutation observer to catch new hardcoded icons
        this.setupIconEnforcement();
        
        logIcons('Icon enforcement enabled');
    }

    /**
     * Scan document for hardcoded emoji icons and replace with tokens
     */
    scanAndReplaceHardcodedIcons() {
        const emojiMap = this.getIconNameForEmoji(null, true); // Get the whole map
        const emojiKeys = Object.keys(emojiMap);
        const emojiRegex = new RegExp(`(${emojiKeys.join('|')})`, 'g');

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (node.parentElement.closest('script, style, [contenteditable], .ace_editor')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    const testRegex = new RegExp(emojiRegex.source, 'g');
                    if (testRegex.test(node.textContent)) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                },
            },
            false
        );

        const nodesToProcess = [];
        let node;
        while ((node = walker.nextNode())) {
            nodesToProcess.push(node);
        }

        let replacementsCount = 0;
        nodesToProcess.forEach((textNode) => {
            if (!textNode.parentElement) {
                return;
            }
            const parts = textNode.textContent.split(emojiRegex);
            
            if (parts.length <= 1) {
                return;
            }

            const fragment = document.createDocumentFragment();
            parts.forEach((part) => {
                if (!part) return; 

                const iconName = emojiMap[part];
                if (iconName) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = `icon icon-${iconName}`;
                    iconSpan.setAttribute('role', 'img');
                    iconSpan.setAttribute('aria-label', iconName.replace('-', ' '));
                    fragment.appendChild(iconSpan);
                    replacementsCount++;
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            textNode.parentElement.replaceChild(fragment, textNode);
        });

        if (replacementsCount > 0) {
            logIcons(`Replaced ${replacementsCount} hardcoded icons with tokens`);
        }
    }

    /**
     * Get icon name for emoji replacement
     */
    getIconNameForEmoji(emoji, returnMap = false) {
        const emojiMap = {
            '🏠': 'home',
            '📁': 'folder', 
            '📄': 'file',
            '⚙️': 'settings',
            '🔍': 'search',
            '🗑️': 'delete',
            '✏️': 'edit',
            '📋': 'copy',
            '🎨': 'themes',
            '🖼️': 'image',
            '🎥': 'video',
            '🔊': 'audio',
            '📅': 'calendar',
            '🕐': 'clock',
            '🏷️': 'tag',
            '🔖': 'bookmark',
            '⭐': 'star',
            '♥️': 'heart',
            '👍': 'thumbs-up',
            '👎': 'thumbs-down',
            '🔔': 'notification',
            '💬': 'tooltip',
            '🗖️': 'modal',
            '📑': 'tab',
            '🛡️': 'secure',
            '🔒': 'locked',
            '🔓': 'unlocked',
            '👁️': 'visible',
            '🙈': 'hidden'
        };
        
        if (returnMap) {
            return emojiMap;
        }
        return emojiMap[emoji] || null;
    }

    /**
     * Setup mutation observer to enforce icon usage
     */
    setupIconEnforcement() {
        if (this.iconObserver) {
            this.iconObserver.disconnect();
        }

        this.iconObserver = new MutationObserver((mutations) => {
            let needsReplacement = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE && this.containsHardcodedIcons(node.textContent)) {
                            needsReplacement = true;
                        }
                    });
                }
            });

            if (needsReplacement) {
                // Debounce replacement to avoid excessive operations
                clearTimeout(this.replacementTimeout);
                this.replacementTimeout = setTimeout(() => {
                    this.scanAndReplaceHardcodedIcons();
                }, 100);
            }
        });

        this.iconObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Check if text contains hardcoded emoji icons
     */
    containsHardcodedIcons(text) {
        const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
        return emojiPattern.test(text);
    }

    /**
     * Provide icon tokens for other parts of the application
     */
    getIconToken(iconName) {
        // Check custom icons first
        if (this.customIcons.has(iconName)) {
            return `var(--icon-${iconName}, '${this.customIcons.get(iconName)}')`;
        }

        // Check default icon sets
        for (const [setKey, iconSet] of this.iconSets.entries()) {
            if (iconSet.icons[iconName]) {
                return `var(--icon-${iconName}, '${iconSet.icons[iconName]}')`;
            }
        }

        logIcons(`Icon not found: ${iconName}`, 'warning');
        return `var(--icon-${iconName}, '?')`;
    }

    /**
     * Create icon element using token system
     */
    createIconElement(iconName, className = '') {
        const icon = document.createElement('span');
        icon.className = `icon icon-${iconName} ${className}`.trim();
        icon.style.cssText = `
            font-family: var(--icon-font-family);
            font-size: var(--icon-size-base);
            color: var(--icon-color-primary);
            display: inline-block;
            line-height: 1;
            vertical-align: middle;
        `;
        icon.setAttribute('aria-label', iconName.replace('-', ' '));
        icon.textContent = this.getIconSymbol(iconName);
        return icon;
    }

    /**
     * Get icon symbol for direct use
     */
    getIconSymbol(iconName) {
        // Check custom icons first
        if (this.customIcons.has(iconName)) {
            return this.customIcons.get(iconName);
        }

        // Check default icon sets
        for (const [setKey, iconSet] of this.iconSets.entries()) {
            if (iconSet.icons[iconName]) {
                return iconSet.icons[iconName];
            }
        }

        return '?';
    }

    destroy() {
        logIcons('Destroying IconsPanel...');
        
        // Clean up mutation observer
        if (this.iconObserver) {
            this.iconObserver.disconnect();
            this.iconObserver = null;
        }
        
        // Clean up timeout
        if (this.replacementTimeout) {
            clearTimeout(this.replacementTimeout);
        }
        
        if (this.stateUnsubscribe) {
            this.stateUnsubscribe();
            this.stateUnsubscribe = null;
        }
        
        // Clean up global references
        if (window.iconsPanel === this) {
            window.iconsPanel = null;
        }
        
        // Clean up from devpages structure
        if (window.devpages && window.devpages.panels && window.devpages.panels.icons === this) {
            window.devpages.panels.icons = null;
        }
        
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
        }
        this.containerElement = null;
        logIcons('IconsPanel destroyed.');
    }
}

// Global icon utility functions
window.iconUtils = {
    /**
     * Get icon token for CSS usage
     */
    getToken: (iconName) => {
        return window.iconsPanel?.getIconToken(iconName) || `var(--icon-${iconName}, '?')`;
    },
    
    /**
     * Create icon element
     */
    createElement: (iconName, className = '') => {
        return window.iconsPanel?.createIconElement(iconName, className) || 
               document.createTextNode('?');
    },
    
    /**
     * Get icon symbol
     */
    getSymbol: (iconName) => {
        return window.iconsPanel?.getIconSymbol(iconName) || '?';
    },
    
    /**
     * Validate if icon exists
     */
    exists: (iconName) => {
        return window.iconsPanel ? 
               window.iconsPanel.getIconSymbol(iconName) !== '?' : 
               false;
    }
};

// Register this panel with the registry
settingsSectionRegistry.register({
    id: 'icons-panel',
    title: 'Icons',
    component: IconsPanel,
    defaultCollapsed: true,
}); 