/**
 * PanelNavBar.js - Unified panel navigation system
 */

import { appStore } from '/client/appState.js';
import { uiThunks } from '/client/store/uiSlice.js';
import { settingsThunks } from '/client/store/slices/settingsSlice.js';
import { logMessage } from '/client/log/index.js';

export class PanelNavBar {
    constructor(panelId, options = {}) {
        this.panelId = panelId;
        this.options = {
            enabled: true,
            showContextControls: true,
            showViewControls: true,
            showPanelControls: true,
            customActions: [],
            ...options
        };
        
        this.element = null;
        this.storeUnsubscribe = null;
        this.currentContext = '';
        
        this.loadCSS();
        this.subscribeToStore();
    }

    loadCSS() {
        const cssId = 'panel-navbar-styles';
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.href = '/client/panels/core/PanelNavBar.css';
            document.head.appendChild(link);
        }
    }

    subscribeToStore() {
        this.storeUnsubscribe = appStore.subscribe((state) => {
            const newContext = state.settings?.currentContext || '';
            if (newContext !== this.currentContext) {
                this.currentContext = newContext;
                this.updateContextDisplay();
            }
        });
        
        // Initial load
        const state = appStore.getState();
        this.currentContext = state.settings?.currentContext || '';
    }

    create() {
        if (!this.options.enabled) {
            return null;
        }

        this.element = document.createElement('div');
        this.element.className = 'panel-navbar';
        this.element.innerHTML = this.renderNavBar();
        
        this.attachEventListeners();
        return this.element;
    }

    renderNavBar() {
        const contextControls = this.options.showContextControls ? this.renderContextControls() : '';
        const viewControls = this.options.showViewControls ? this.renderViewControls() : '';
        const panelControls = this.options.showPanelControls ? this.renderPanelControls() : '';
        const customActions = this.renderCustomActions();

        return `
            <div class="panel-navbar-content">
                <div class="panel-navbar-left">
                    ${contextControls}
                    ${viewControls}
                </div>
                <div class="panel-navbar-center">
                    ${customActions}
                </div>
                <div class="panel-navbar-right">
                    ${panelControls}
                </div>
            </div>
        `;
    }

    renderContextControls() {
        const contextName = this.currentContext || 'none';
        const contextDisplayName = contextName === 'none' ? 'No Context' : contextName;
        
        return `
            <div class="navbar-section context-section">
                <div class="context-indicator" title="Current Context: ${contextDisplayName}">
                    <span class="context-icon">📁</span>
                    <span class="context-name">${contextDisplayName}</span>
                </div>
                <button class="btn btn-sm btn-ghost context-btn" data-action="select-context" title="Change Context">
                    <span class="btn-icon">🔄</span>
                </button>
            </div>
        `;
    }

    renderViewControls() {
        return `
            <div class="navbar-section view-section">
                <button class="btn btn-sm btn-ghost view-btn" data-action="zoom-out" title="Zoom Out">
                                            <svg class="btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                            <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                </button>
                <button class="btn btn-sm btn-ghost view-btn" data-action="zoom-reset" title="Reset Zoom">
                                            <svg class="btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                        </svg>
                </button>
                <button class="btn btn-sm btn-ghost view-btn" data-action="zoom-in" title="Zoom In">
                                            <svg class="btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.35-4.35"/>
                            <line x1="11" y1="8" x2="11" y2="14"/>
                            <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                </button>
            </div>
        `;
    }

    renderPanelControls() {
        return `
            <div class="navbar-section panel-section">
                <button class="btn btn-sm btn-ghost panel-btn" data-action="panel-settings" title="Panel Settings">
                                            <svg class="btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                </button>
                <button class="btn btn-sm btn-ghost panel-btn" data-action="panel-help" title="Panel Help">
                    <span class="btn-icon">❓</span>
                </button>
            </div>
        `;
    }

    renderCustomActions() {
        if (!this.options.customActions.length) return '';

        return `
            <div class="navbar-section custom-section">
                ${this.options.customActions.map(action => `
                    <button class="btn btn-sm btn-ghost custom-btn" 
                            data-action="${action.id}" 
                            title="${action.title}">
                        <span class="btn-icon">${action.icon}</span>
                        ${action.label ? `<span class="btn-label">${action.label}</span>` : ''}
                    </button>
                `).join('')}
            </div>
        `;
    }

    attachEventListeners() {
        if (!this.element) return;

        this.element.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action) {
                this.handleAction(action, e);
            }
        });
    }

    async handleAction(action, event) {
        try {
            switch (action) {
                case 'select-context':
                    await this.handleSelectContext();
                    break;
                case 'zoom-out':
                    this.handleZoom('out');
                    break;
                case 'zoom-in':
                    this.handleZoom('in');
                    break;
                case 'zoom-reset':
                    this.handleZoom('reset');
                    break;
                case 'panel-settings':
                    this.handlePanelSettings();
                    break;
                case 'panel-help':
                    this.handlePanelHelp();
                    break;
                default:
                    // Custom action
                    this.handleCustomAction(action, event);
                    break;
            }
        } catch (error) {
            logMessage(`Panel navbar action error: ${error.message}`, 'error');
        }
    }

    async handleSelectContext() {
        // Show context selection dropdown
        const currentState = appStore.getState();
        const availableContexts = currentState.contexts?.available || [];
        
        const contextMenu = this.createContextMenu(availableContexts);
        document.body.appendChild(contextMenu);
        
        // Position menu
        const contextBtn = this.element.querySelector('[data-action="select-context"]');
        const rect = contextBtn.getBoundingClientRect();
        contextMenu.style.top = `${rect.bottom + 5}px`;
        contextMenu.style.left = `${rect.left}px`;
    }

    createContextMenu(contexts) {
        const menu = document.createElement('div');
        menu.className = 'context-menu-dropdown';
        menu.innerHTML = `
            <div class="context-menu-content">
                <div class="context-menu-header">Select Context</div>
                <div class="context-menu-list">
                    <div class="context-menu-item ${!this.currentContext ? 'active' : ''}" 
                         data-context="">
                        <svg class="context-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2l5 0 2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span class="context-name">No Context</span>
                    </div>
                    ${contexts.map(context => `
                        <div class="context-menu-item ${context === this.currentContext ? 'active' : ''}" 
                             data-context="${context}">
                            <svg class="context-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2l5 0 2 3h9a2 2 0 0 1 2 2z"/>
                            </svg>
                            <span class="context-name">${context}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="context-menu-footer">
                    <button class="btn btn-sm btn-secondary" data-action="manage-contexts">
                        Manage Contexts
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        menu.addEventListener('click', (e) => {
            const contextItem = e.target.closest('[data-context]');
            const manageBtn = e.target.closest('[data-action="manage-contexts"]');
            
            if (contextItem) {
                const newContext = contextItem.dataset.context;
                appStore.dispatch(settingsThunks.setCurrentContext(newContext));
                menu.remove();
            } else if (manageBtn) {
                // Open settings panel to context management
                appStore.dispatch(uiThunks.toggleContextManager());
                menu.remove();
            }
        });

        // Close on click outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);

        return menu;
    }

    handleZoom(direction) {
        const panelContent = this.element.closest('.panel')?.querySelector('.panel-content');
        if (!panelContent) return;

        const currentZoom = parseFloat(panelContent.style.zoom || '1');
        let newZoom;

        switch (direction) {
            case 'in':
                newZoom = Math.min(currentZoom * 1.1, 3);
                break;
            case 'out':
                newZoom = Math.max(currentZoom * 0.9, 0.5);
                break;
            case 'reset':
                newZoom = 1;
                break;
        }

        panelContent.style.zoom = newZoom;
        logMessage(`Panel ${this.panelId} zoom: ${newZoom}`, 'debug');
    }

    handlePanelSettings() {
        appStore.dispatch({
            type: 'panels/togglePanelVisibility',
            payload: { panelId: 'settings-panel' }
        });
    }

    handlePanelHelp() {
        const helpModal = this.createHelpModal();
        document.body.appendChild(helpModal);
    }

    createHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'panel-help-modal';
        modal.innerHTML = `
            <div class="help-modal-overlay"></div>
            <div class="help-modal-content">
                <div class="help-modal-header">
                    <h3>Panel Help - ${this.panelId}</h3>
                    <button class="btn btn-sm btn-ghost help-modal-close">×</button>
                </div>
                <div class="help-modal-body">
                    <p>This panel provides controls and functionality for managing your content.</p>
                    <h4>Navigation Bar Features:</h4>
                    <ul>
                        <li><strong>Context Controls:</strong> Manage the current context for Cursor AI</li>
                        <li><strong>View Controls:</strong> Zoom in, out, or reset the panel view</li>
                        <li><strong>Panel Controls:</strong> Access settings and help</li>
                    </ul>
                    <h4>Keyboard Shortcuts:</h4>
                    <p><em>Ctrl+Plus:</em> Zoom in<br>
                    <em>Ctrl+Minus:</em> Zoom out<br>
                    <em>Ctrl+0:</em> Reset zoom</p>
                </div>
                <div class="help-modal-footer">
                    <button class="btn btn-secondary help-modal-close">Close</button>
                </div>
            </div>
        `;

        const closeElements = modal.querySelectorAll('.help-modal-close, .help-modal-overlay');
        closeElements.forEach(el => {
            el.addEventListener('click', () => modal.remove());
        });

        return modal;
    }

    handleCustomAction(actionId, event) {
        const action = this.options.customActions.find(a => a.id === actionId);
        if (action && action.handler) {
            action.handler(event, this);
        }
    }

    updateContextDisplay() {
        if (!this.element) return;

        const contextName = this.currentContext || 'none';
        const contextDisplayName = contextName === 'none' ? 'No Context' : contextName;
        
        const contextNameEl = this.element.querySelector('.context-name');
        const contextIndicator = this.element.querySelector('.context-indicator');
        
        if (contextNameEl) {
            contextNameEl.textContent = contextDisplayName;
        }
        
        if (contextIndicator) {
            contextIndicator.title = `Current Context: ${contextDisplayName}`;
        }
    }

    addCustomAction(action) {
        this.options.customActions.push(action);
        if (this.element) {
            this.element.innerHTML = this.renderNavBar();
            this.attachEventListeners();
        }
    }

    removeCustomAction(actionId) {
        this.options.customActions = this.options.customActions.filter(a => a.id !== actionId);
        if (this.element) {
            this.element.innerHTML = this.renderNavBar();
            this.attachEventListeners();
        }
    }

    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        if (this.element) {
            this.element.innerHTML = this.renderNavBar();
            this.attachEventListeners();
        }
    }

    destroy() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        
        if (this.element) {
            this.element.remove();
        }
    }
} 