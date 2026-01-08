/**
 * BasePanel.js - Core panel system with optional Redux integration
 *
 * Provides a standardized panel interface with:
 * - Position and size management
 * - Optional state persistence via Redux
 * - Event-driven communication
 * - Lifecycle management
 * - Debug integration
 */

import { appStore } from '../appState.js';
import { panelActions } from '../store/slices/panelSlice.js';
import { zIndexManager } from '../utils/ZIndexManager.js';
import { eventBus } from '../eventBus.js';

/**
 * Simple EventEmitter for panel-to-panel communication
 */
class PanelEventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {PanelEventEmitter} For chaining
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return this;
    }

    /**
     * Unregister an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     * @returns {PanelEventEmitter} For chaining
     */
    off(event, callback) {
        if (!this.events[event]) return this;

        this.events[event] = this.events[event].filter(cb => cb !== callback);
        return this;
    }

    /**
     * Emit an event to all registered listeners
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @returns {PanelEventEmitter} For chaining
     */
    emit(event, data) {
        if (!this.events[event]) return this;

        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[PanelEventEmitter] Error in event handler for ${event}:`, error);
            }
        });
        return this;
    }

    /**
     * Clear all event listeners
     */
    clear() {
        this.events = {};
    }
}

/**
 * Base class for creating dynamic, draggable, and resizable panels.
 * Supports optional Redux integration and local state management.
 * Panels can be instantiated, mounted to the DOM, shown/hidden, and destroyed.
 * Provides lifecycle hooks and event-driven communication.
 * @property {string} id - Unique identifier for the panel.
 * @property {string} title - Title displayed in the panel header.
 * @property {string} type - Type of the panel, used for styling and identification.
 * @property {HTMLElement|null} element - The root DOM element for the panel.
 * @property {boolean} mounted - True if the panel is currently in the DOM.
 * @property {object} state - Local state (position, size, visibility, etc.)
 * @property {object} config - Configuration options for the panel's behavior and appearance.
 * @property {PanelEventEmitter} events - Event emitter for panel communication.
 */
export class BasePanel {
    /**
     * @param {object} [config={}] - Configuration for the panel.
     * @param {string} [config.id] - A unique ID. If not provided, one is generated.
     * @param {string} [config.title='Untitled Panel'] - The title for the panel header.
     * @param {string} [config.type='generic'] - The type of the panel.
     * @param {boolean} [config.resizable=true] - Whether the panel can be resized.
     * @param {boolean} [config.draggable=true] - Whether the panel can be dragged.
     * @param {boolean} [config.collapsible=true] - Whether the panel can be collapsed.
     * @param {boolean} [config.closable=true] - Whether to show a close button.
     * @param {boolean} [config.useRedux=false] - Whether to sync state with Redux (opt-in).
     * @param {boolean} [config.isDocked=true] - Whether the panel is docked.
     * @param {string} [config.zLayer='POPUP'] - Z-index layer (UI: 100-999, POPUP: 1000-9999).
     */
    constructor(config = {}) {
        this.id = config.id || `panel-${Date.now()}`;
        this.title = config.title || 'Untitled Panel';
        this.type = config.type || 'generic';
        this.element = null;
        this.mounted = false;
        this.events = new PanelEventEmitter();

        // Configuration
        this.config = {
            resizable: true,
            draggable: true,
            collapsible: true,
            closable: true,
            modal: false,
            minWidth: 200,
            minHeight: 150,
            defaultWidth: 400,
            defaultHeight: 300,
            defaultPosition: { x: 100, y: 100 },
            useRedux: false,  // Opt-in Redux
            zLayer: 'POPUP',  // Use ZIndexManager POPUP layer (1000-9999)
            ...config
        };

        // Local state (always exists)
        // Z-index starts at layer minimum, will be managed by ZIndexManager
        const layerMin = zIndexManager.layers[this.config.zLayer]?.min || 1000;
        this.state = {
            x: config.defaultPosition?.x || 100,
            y: config.defaultPosition?.y || 100,
            width: config.defaultWidth || 400,
            height: config.defaultHeight || 300,
            zIndex: layerMin,  // Will be set properly on mount
            visible: false,
            collapsed: false,
            isDocked: config.isDocked ?? true,
            isOpen: false
        };

        // Global event bus (unified eventBus with subscription tracking)
        this.globalEvents = eventBus;
        this.globalSubscriptions = [];

        // Bind methods
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        // Optional Redux integration
        if (this.config.useRedux) {
            this.initializeReduxState();
        }
    }

    /**
     * Initialize Redux state (only if useRedux is enabled)
     */
    initializeReduxState() {
        if (!this.config.useRedux) return;

        appStore.dispatch(panelActions.createPanel({
            id: this.id,
            title: this.title,
            type: this.type,
            ...this.state,
            config: this.config
        }));
    }

    /**
     * Get current state (from Redux if enabled, otherwise local state)
     * @returns {object} Current panel state
     */
    getState() {
        if (this.config.useRedux) {
            const reduxState = appStore.getState().panels?.panels?.[this.id];
            if (reduxState) {
                // Compatibility layer: support old nested state structure
                if (reduxState.floatingState && !reduxState.x) {
                    return {
                        ...reduxState,
                        x: reduxState.floatingState.position?.x || reduxState.position?.x || 100,
                        y: reduxState.floatingState.position?.y || reduxState.position?.y || 100,
                        width: reduxState.floatingState.size?.width || reduxState.size?.width || 400,
                        height: reduxState.floatingState.size?.height || reduxState.size?.height || 300
                    };
                }
                return reduxState;
            }
        }
        return this.state;
    }

    /**
     * Update panel state
     * @param {object} updates - State updates to apply
     */
    updateState(updates) {
        // Update local state
        Object.assign(this.state, updates);

        // Sync to Redux if enabled
        if (this.config.useRedux) {
            appStore.dispatch(panelActions.updatePanel({
                id: this.id,
                updates
            }));
        }

        // Emit event
        this.events.emit('stateChanged', { id: this.id, state: this.state });
    }

    /**
     * Toggle between docked and floating states
     * @returns {BasePanel} For chaining
     */
    togglePanelMode() {
        const state = this.getState();
        this.updateState({ isDocked: !state.isDocked });
        this.applyStateToElement();
        return this;
    }

    /**
     * Mounts the panel to a container in the DOM.
     * Creates the panel element, attaches event listeners, and applies its state.
     * @param {HTMLElement} [container=document.body] - The container element to append the panel to.
     * @returns {BasePanel} The panel instance for chaining.
     */
    mount(container = document.body) {
        if (this.mounted) return this;

        this.createElement();
        container.appendChild(this.element);

        // Register with ZIndexManager for proper z-index management
        const priority = 0; // Start at base priority, increases when brought to front
        const zIndex = zIndexManager.register(this.element, this.config.zLayer, priority);
        this.updateState({ zIndex });

        this.attachEventListeners();
        this.applyStateToElement();
        this.mounted = true;

        this.updateState({ mounted: true });
        this.onMount();

        return this;
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = `base-panel panel-${this.type}`;
        this.element.id = this.id;
        this.element.setAttribute('data-panel-id', this.id);

        // Base panel styles now loaded via CSS bundles

        const state = this.getState();
        
        this.element.innerHTML = `
            <div class="base-panel-header" data-action="drag">
                <div class="panel-title">${this.title}</div>
                <div class="panel-controls">
                    ${this.config.collapsible ? '<button class="panel-btn collapse-btn" data-action="collapse" title="Collapse">−</button>' : ''}
                    ${this.config.closable ? '<button class="panel-btn close-btn" data-action="close" title="Close">×</button>' : ''}
                </div>
            </div>
            <div class="panel-body">
                ${this.renderContent()}
            </div>
            ${this.config.resizable ? '<div class="panel-resize-handle" data-action="resize"></div>' : ''}
        `;
    }

    /**
     * Renders the main content of the panel. This method should be overridden by subclasses
     * to provide specific content.
     * @returns {string} HTML string for the panel's body.
     */
    renderContent() {
        // Override in subclasses
        return '<div class="panel-placeholder">Panel content goes here</div>';
    }

    /**
     * Show the panel with fade-in animation
     * @returns {BasePanel} For chaining
     */
    show() {
        this.updateState({
            visible: true,
            isOpen: true
        });
        this.applyStateToElement();
        this.bringToFront();
        this.onShow();
        return this;
    }

    /**
     * Hide the panel with fade-out animation
     * @returns {BasePanel} For chaining
     */
    hide() {
        this.element.classList.remove('is-visible');

        // Wait for animation to finish before hiding
        setTimeout(() => {
            this.updateState({
                visible: false,
                isOpen: false
            });
            this.applyStateToElement();
            this.onHide();
        }, 200); // Should match transition duration

        return this;
    }

    /**
     * Toggles the collapsed state of the panel.
     * @returns {BasePanel} The panel instance for chaining.
     */
    toggleCollapse() {
        const state = this.getState();
        this.updateState({ collapsed: !state.collapsed });
        this.applyStateToElement();
        return this;
    }

    /**
     * Apply current state to the DOM element
     */
    applyStateToElement() {
        if (!this.element) return;

        const s = this.getState();

        // Position and size
        this.element.style.left = `${s.x}px`;
        this.element.style.top = `${s.y}px`;
        this.element.style.width = `${s.width}px`;
        this.element.style.height = `${s.height}px`;
        this.element.style.zIndex = s.zIndex;

        // Visibility
        this.element.style.display = s.visible ? 'flex' : 'none';
        if (s.visible) {
            setTimeout(() => this.element.classList.add('is-visible'), 10);
        } else {
            this.element.classList.remove('is-visible');
        }

        // State classes
        this.element.classList.toggle('collapsed', s.collapsed);
        this.element.classList.toggle('is-docked', s.isDocked);
        this.element.classList.toggle('is-floating', !s.isDocked);
    }

    /**
     * Attaches all necessary event listeners to the panel element.
     * Handles controls, dragging, and resizing.
     */
    attachEventListeners() {
        if (!this.element) return;

        // Panel controls
        this.element.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action');
            switch (action) {
                case 'close':
                    this.hide();
                    break;
                case 'collapse':
                    this.toggleCollapse();
                    break;
            }
        });

        // Drag and resize
        this.element.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Brings the panel to the front using ZIndexManager
     * @returns {BasePanel} For chaining
     */
    bringToFront() {
        if (!this.element) return this;

        // Use ZIndexManager to bring element to front within its layer
        const newZ = zIndexManager.bringToFront(this.element);
        if (newZ) {
            this.updateState({ zIndex: newZ });
        }

        return this;
    }

    /**
     * Handles the mousedown event to initiate dragging or resizing.
     * @param {MouseEvent} e - The mouse event.
     */
    handleMouseDown(e) {
        const action = e.target.getAttribute('data-action') || 
                     e.target.closest('[data-action]')?.getAttribute('data-action');
        
        if (!action) return;

        e.preventDefault();
        const rect = this.element.getBoundingClientRect();
        
        this.dragState = {
            action,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top,
            startWidth: rect.width,
            startHeight: rect.height
        };

        // Bring to front
        this.bringToFront();
    }

    /**
     * Handles the mousemove event to update panel position or size during a drag.
     * @param {MouseEvent} e - The mouse event.
     */
    handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = e.clientX - this.dragState.startX;
        const deltaY = e.clientY - this.dragState.startY;

        switch (this.dragState.action) {
            case 'drag':
                if (this.config.draggable) {
                    const newX = Math.max(0, this.dragState.startLeft + deltaX);
                    const newY = Math.max(0, this.dragState.startTop + deltaY);
                    this.updateState({ x: newX, y: newY });
                }
                break;
            case 'resize':
                if (this.config.resizable) {
                    const newWidth = Math.max(this.config.minWidth, this.dragState.startWidth + deltaX);
                    const newHeight = Math.max(this.config.minHeight, this.dragState.startHeight + deltaY);
                    this.updateState({ width: newWidth, height: newHeight });
                }
                break;
        }

        this.applyStateToElement();
    }

    /**
     * Handles the mouseup event to end a drag or resize operation.
     * @param {MouseEvent} e - The mouse event.
     */
    handleMouseUp(e) {
        this.dragState = null;
    }

    /**
     * Handles keydown events, such as closing the panel with the Escape key.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    handleKeyDown(e) {
        if (e.key === 'Escape' && this.getState()?.visible) {
            this.hide();
        }
    }

    /**
     * Subscribe to global panel event
     * Enables communication with other panels via the event bus
     * @param {string} event - Event name (e.g., 'element-selected')
     * @param {Function} callback - Callback function (receives payload with source, timestamp, data)
     * @returns {Function} Unsubscribe function
     */
    subscribeGlobal(event, callback) {
        if (!this.globalEvents) {
            console.warn(`[BasePanel] Global event bus not available for panel "${this.id}"`);
            return () => {};
        }

        // Use unified eventBus.subscribeAs for tracked subscriptions
        const unsubscribe = this.globalEvents.subscribeAs(this.id, event, callback);
        this.globalSubscriptions.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Publish global panel event
     * Sends event to all subscribed panels via the event bus
     * @param {string} event - Event name (e.g., 'element-selected')
     * @param {*} data - Event data (will be wrapped with source and timestamp)
     */
    publishGlobal(event, data) {
        if (!this.globalEvents) {
            console.warn(`[BasePanel] Global event bus not available for panel "${this.id}"`);
            return;
        }

        // Emit with standardized payload including source
        this.globalEvents.emit(event, {
            source: this.id,
            timestamp: Date.now(),
            data: data
        });
    }

    /**
     * Removes the panel from the DOM and cleans up its state.
     */
    destroy() {
        // Cleanup global subscriptions
        this.globalSubscriptions.forEach(unsubscribe => unsubscribe());
        this.globalSubscriptions = [];

        // Cleanup all tracked subscriptions for this panel via unified eventBus
        if (this.globalEvents) {
            this.globalEvents.cleanupSource(this.id);
        }

        // Unregister from ZIndexManager
        if (this.element) {
            zIndexManager.unregister(this.element);
            this.element.remove();
        }

        // Clear event listeners
        this.events.clear();

        // Clean up Redux state if used
        if (this.config.useRedux) {
            appStore.dispatch(panelActions.removePanel(this.id));
        }

        this.mounted = false;
        this.onDestroy();
    }

    // Lifecycle hooks - override in subclasses
    onMount() {}
    onShow() {}
    onHide() {}
    onDestroy() {}

    // Debug helpers
    getDebugInfo() {
        return {
            id: this.id,
            title: this.title,
            type: this.type,
            mounted: this.mounted,
            state: this.getState(),
            config: this.config
        };
    }

}

// Panel Registry
/**
 * Unified panel registry that integrates with PanelConfigLoader.
 * Manages both panel type registration and instance lifecycle.
 */
export class PanelRegistry {
    constructor() {
        this.panels = new Map();
        this.types = new Map();
        this.configLoader = null; // Will be injected
    }

    /**
     * Initialize the registry with the config loader
     * @param {PanelConfigLoader} configLoader 
     */
    initialize(configLoader) {
        this.configLoader = configLoader;
        console.log('[PanelRegistry] Initialized with config loader');
    }

    /**
     * Registers a new panel type with its class constructor.
     * @param {string} type - The name of the panel type.
     * @param {typeof BasePanel} panelClass - The class constructor for the panel.
     */
    registerType(type, panelClass) {
        this.types.set(type, panelClass);
        console.log(`[PanelRegistry] Registered panel type: ${type}`);
    }

    /**
     * Creates a panel instance using both type registration and config.
     * @param {string} type - Panel type identifier
     * @param {Object} config - Panel configuration overrides
     */
    async createPanel(type, config = {}) {
        // Get panel class from type registry
        const PanelClass = this.types.get(type) || BasePanel;
        
        // Get panel config from config loader if available
        let panelConfig = {};
        if (this.configLoader) {
            try {
                panelConfig = await this.configLoader.getPanel(type) || {};
            } catch (error) {
                console.warn(`[PanelRegistry] Could not load config for ${type}:`, error);
                panelConfig = {};
            }
        }
        
        // Merge configurations: config loader defaults + runtime overrides
        const finalConfig = {
            ...panelConfig,
            ...config,
            type,
            id: config.id || type // Use provided id or fallback to type
        };
        
        console.log(`[PanelRegistry] Creating panel ${type} with config:`, finalConfig);
        
        const panel = new PanelClass(finalConfig);
        this.panels.set(panel.id, panel);
        return panel;
    }

    /**
     * Gets all registered panel types from both sources
     */
    getRegisteredTypes() {
        const registryTypes = Array.from(this.types.keys());
        const configTypes = this.configLoader ? 
            Object.keys(this.configLoader.config.panels) : [];
        
        // Combine and deduplicate
        return [...new Set([...registryTypes, ...configTypes])];
    }

    /**
     * Checks if a panel type is available (either registered or in config)
     */
    isTypeAvailable(type) {
        return this.types.has(type) || 
               (this.configLoader && this.configLoader.config.panels[type]);
    }

    getPanel(id) {
        return this.panels.get(id);
    }

    getAllPanels() {
        return Array.from(this.panels.values());
    }

    destroyPanel(id) {
        const panel = this.panels.get(id);
        if (panel) {
            panel.destroy();
            this.panels.delete(id);
        }
    }

    getDebugInfo() {
        return {
            totalPanels: this.panels.size,
            registeredTypes: Array.from(this.types.keys()),
            configTypes: this.configLoader ? Object.keys(this.configLoader.config.panels) : [],
            allAvailableTypes: this.getRegisteredTypes(),
            panels: Array.from(this.panels.values()).map(p => p.getDebugInfo?.() || { id: p.id, type: p.type })
        };
    }
}

// Global registry instance
export const panelRegistry = new PanelRegistry();

// Initialize registry with config loader when available
let configLoaderInitialized = false;
export function initializePanelRegistry() {
    if (configLoaderInitialized) return;
    
    // Dynamic import to avoid circular dependencies
    import('../config/PanelConfigLoader.js').then(({ panelConfigLoader }) => {
        panelRegistry.initialize(panelConfigLoader);
        configLoaderInitialized = true;
    }).catch(error => {
        console.warn('[PanelRegistry] Could not initialize with config loader:', error);
    });
}

// Auto-initialize when this module loads
initializePanelRegistry();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.panels = {
        registry: panelRegistry,
        BasePanel,
        initializePanelRegistry
    };
}
