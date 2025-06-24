/**
 * PanelManager.js - Coordinates all panels in the DevPages panel system
 * 
 * Responsibilities:
 * - Panel registration and lifecycle management
 * - Panel ordering and layout coordination
 * - State synchronization with app store
 * - Communication between panels and layout manager
 */

import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export class PanelManager {
    constructor() {
        this.panels = new Map(); // panelId -> panel instance
        this.panelOrder = []; // Array of panel IDs in display order
        this.container = null; // Main panels container
        this.gutterContainer = null; // Right gutter container
        this.storeUnsubscribe = null;

        // Panel state management
        this.state = {
            initialized: false,
            panelsVisible: false, // Master visibility toggle
            totalWidth: 0,
            availableWidth: 0
        };

        this.log('PanelManager initialized', 'info');
    }

    /**
     * Initialize the panel manager
     */
    initialize(panelsContainer, gutterContainer) {
        if (this.state.initialized) {
            this.log('Already initialized, skipping', 'warn');
            return;
        }

        this.container = panelsContainer;
        this.gutterContainer = gutterContainer;

        // Subscribe to app state changes
        this.subscribeToStore();

        // Setup container styles
        this.setupContainers();

        this.state.initialized = true;
        this.log('PanelManager initialized successfully', 'info');
    }

    /**
     * Setup panel and gutter containers
     */
    setupContainers() {
        if (this.container) {
            this.container.style.cssText = `
                display: flex;
                flex-direction: row;
                height: 100%;
                background-color: var(--content-background, #f8f9fa);
                transition: width 0.2s ease;
            `;
        }

        if (this.gutterContainer) {
            this.gutterContainer.style.cssText = `
                width: 0;
                background-color: var(--sidebar-background, #e9ecef);
                border-left: none;
                display: none;
                flex-direction: column;
                align-items: center;
                padding: 0;
                gap: 8px;
            `;
        }
    }

    /**
     * Register a panel with the manager
     */
    registerPanel(panel, options = {}) {
        if (!panel || !panel.panelId) {
            this.log('Invalid panel provided for registration', 'error');
            return false;
        }

        if (this.panels.has(panel.panelId)) {
            this.log(`Panel ${panel.panelId} already registered`, 'warn');
            return false;
        }

        // Set panel order if not specified
        if (panel.state.order === undefined || panel.state.order === null) {
            panel.state.order = options.order !== undefined ? options.order : this.panels.size;
        }

        this.panels.set(panel.panelId, panel);
        this.updatePanelOrder();

        // Mount the panel if container is available
        if (this.container) {
            panel.mount(this.container);
        }

        this.log(`Panel ${panel.panelId} registered successfully`, 'info');
        this.updateLayout();
        return true;
    }

    /**
     * Unregister a panel from the manager
     */
    unregisterPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            this.log(`Panel ${panelId} not found for unregistration`, 'warn');
            return false;
        }

        // Unmount the panel
        panel.unmount();

        // Remove from maps and arrays
        this.panels.delete(panelId);
        this.panelOrder = this.panelOrder.filter(id => id !== panelId);

        this.log(`Panel ${panelId} unregistered successfully`, 'info');
        this.updateLayout();
        return true;
    }

    /**
     * Get panel by ID
     */
    getPanel(panelId) {
        return this.panels.get(panelId);
    }

    /**
     * Get all panels
     */
    getAllPanels() {
        return Array.from(this.panels.values());
    }

    /**
     * Get panel info for all panels
     */
    getAllPanelInfo() {
        return this.getAllPanels().map(panel => panel.getPanelInfo());
    }

    /**
     * Show panel by ID
     */
    showPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            this.log(`Panel ${panelId} not found`, 'warn');
            return false;
        }

        panel.show();
        this.updateLayout();
        
        // Dispatch to app store
        dispatch({
            type: ActionTypes.PANEL_SHOW,
            payload: { panelId }
        });

        return true;
    }

    /**
     * Hide panel by ID
     */
    hidePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            this.log(`Panel ${panelId} not found`, 'warn');
            return false;
        }

        panel.hide();
        this.updateLayout();

        // Dispatch to app store
        dispatch({
            type: ActionTypes.PANEL_HIDE,
            payload: { panelId }
        });

        return true;
    }

    /**
     * Toggle panel visibility by ID
     */
    togglePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            this.log(`Panel ${panelId} not found`, 'warn');
            return false;
        }

        if (panel.state.visible) {
            this.hidePanel(panelId);
        } else {
            this.showPanel(panelId);
        }

        return true;
    }

    /**
     * Show all panels
     */
    showAllPanels() {
        this.state.panelsVisible = true;
        this.panels.forEach(panel => panel.show());
        this.updateLayout();

        // Update container visibility
        if (this.container) {
            this.container.style.display = 'flex';
        }

        dispatch({
            type: ActionTypes.PANELS_SHOW_ALL
        });

        this.log('All panels shown', 'info');
    }

    /**
     * Hide all panels
     */
    hideAllPanels() {
        this.state.panelsVisible = false;
        this.panels.forEach(panel => panel.hide());

        // Hide container
        if (this.container) {
            this.container.style.display = 'none';
        }

        dispatch({
            type: ActionTypes.PANELS_HIDE_ALL
        });

        this.log('All panels hidden', 'info');
    }

    /**
     * Toggle all panels visibility
     */
    toggleAllPanels() {
        if (this.state.panelsVisible) {
            this.hideAllPanels();
        } else {
            this.showAllPanels();
        }
    }

    /**
     * Update panel order based on order property
     */
    updatePanelOrder() {
        this.panelOrder = Array.from(this.panels.keys()).sort((a, b) => {
            const panelA = this.panels.get(a);
            const panelB = this.panels.get(b);
            return panelA.state.order - panelB.state.order;
        });

        // Apply order to DOM elements
        this.panelOrder.forEach((panelId, index) => {
            const panel = this.panels.get(panelId);
            if (panel && panel.element) {
                panel.element.style.order = index;
            }
        });

        this.log(`Panel order updated: ${this.panelOrder.join(' -> ')}`, 'debug');
    }

    /**
     * Set panel order
     */
    setPanelOrder(panelId, order) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            this.log(`Panel ${panelId} not found`, 'warn');
            return false;
        }

        panel.state.order = order;
        panel.persistState();
        this.updatePanelOrder();
        this.updateLayout();

        return true;
    }

    /**
     * Calculate and update layout information
     */
    updateLayout() {
        if (!this.container) return;

        const visiblePanels = this.getAllPanels().filter(panel => panel.state.visible);
        const totalWidth = visiblePanels.reduce((sum, panel) => sum + panel.state.width, 0);
        
        this.state.totalWidth = totalWidth;
        this.state.availableWidth = window.innerWidth - totalWidth; // No gutter width needed

        // Update container width
        if (visiblePanels.length > 0) {
            this.container.style.width = `${totalWidth}px`;
            this.container.style.display = 'flex';
        } else {
            this.container.style.display = 'none';
        }

        // Notify layout manager
        this.notifyLayoutChange();

        this.log(`Layout updated: ${visiblePanels.length} panels, ${totalWidth}px total width`, 'debug');
    }

    /**
     * Notify layout manager of changes
     */
    notifyLayoutChange() {
        // Emit event for layout manager
        if (window.eventBus) {
            window.eventBus.emit('panels:layoutChanged', {
                panels: this.getAllPanelInfo(),
                totalWidth: this.state.totalWidth,
                availableWidth: this.state.availableWidth,
                visible: this.state.panelsVisible
            });
        }
    }

    /**
     * Subscribe to app store changes
     */
    subscribeToStore() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }

        this.storeUnsubscribe = appStore.subscribe((newState, prevState) => {
            this.handleStoreChange(newState, prevState);
        });
    }

    /**
     * Handle app store changes
     */
    handleStoreChange(newState, prevState) {
        const newPanels = newState.panels || {};
        const prevPanels = prevState.panels || {};

        // Handle panel visibility changes from store
        Object.keys(newPanels).forEach(panelId => {
            const newPanelState = newPanels[panelId];
            const prevPanelState = prevPanels[panelId] || {};
            const panel = this.panels.get(panelId);

            if (panel && newPanelState.visible !== prevPanelState.visible) {
                if (newPanelState.visible) {
                    panel.show();
                } else {
                    panel.hide();
                }
            }
        });

        // Update layout if panels changed
        if (JSON.stringify(newPanels) !== JSON.stringify(prevPanels)) {
            this.updateLayout();
        }
    }

    /**
     * Add a button to the right gutter
     */
    addGutterButton(id, options = {}) {
        if (!this.gutterContainer) {
            this.log('Gutter container not available', 'warn');
            return null;
        }

        const button = document.createElement('button');
        button.id = `gutter-btn-${id}`;
        button.className = 'gutter-button';
        button.title = options.title || id;
        button.innerHTML = options.icon || '●';
        button.style.cssText = `
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 4px;
            background-color: ${options.active ? 'var(--button-primary-background, #007bff)' : 'var(--button-secondary-background, #fff)'};
            color: ${options.active ? 'var(--button-primary-text, #fff)' : 'var(--button-secondary-text, #6c757d)'};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            transition: all 0.2s ease;
        `;

        // Add hover effects
        button.addEventListener('mouseenter', () => {
            if (!options.active) {
                button.style.backgroundColor = 'var(--button-secondary-background-hover, #f8f9fa)';
            }
        });

        button.addEventListener('mouseleave', () => {
            if (!options.active) {
                button.style.backgroundColor = 'var(--button-secondary-background, #fff)';
            }
        });

        // Add click handler
        if (options.onClick) {
            button.addEventListener('click', options.onClick);
        }

        this.gutterContainer.appendChild(button);
        this.log(`Gutter button ${id} added`, 'debug');

        return button;
    }

    /**
     * Remove a gutter button
     */
    removeGutterButton(id) {
        const button = this.gutterContainer?.querySelector(`#gutter-btn-${id}`);
        if (button) {
            button.remove();
            this.log(`Gutter button ${id} removed`, 'debug');
            return true;
        }
        return false;
    }

    /**
     * Cleanup
     */
    destroy() {
        this.log('Destroying PanelManager...', 'info');

        // Unregister all panels
        Array.from(this.panels.keys()).forEach(panelId => {
            this.unregisterPanel(panelId);
        });

        // Unsubscribe from store
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }

        // Clear references
        this.container = null;
        this.gutterContainer = null;
        this.panels.clear();
        this.panelOrder = [];

        this.state.initialized = false;
        this.log('PanelManager destroyed', 'info');
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...this.state,
            panels: this.getAllPanelInfo(),
            panelOrder: [...this.panelOrder]
        };
    }

    /**
     * Logging helper
     */
    log(message, level = 'info') {
        const prefix = '[PanelManager]';
        if (typeof window.logMessage === 'function') {
            window.logMessage(`${prefix} ${message}`, level, 'PANEL_MANAGER');
        } else {
            console[level] ? console[level](`${prefix} ${message}`) : console.log(`${prefix} ${message}`);
        }
    }
}

// Create singleton instance
export const panelManager = new PanelManager();

// Make globally accessible
// Register with consolidation system
if (window.devpages && window.devpages._internal && window.devpages._internal.consolidator) {
    window.devpages._internal.consolidator.migrate('panelManager', panelManager);
} else {
    // Fallback for legacy support
    window.panelManager = panelManager;
} 