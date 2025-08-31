/**
 * BasePanel.js - Core panel system with Redux integration
 * 
 * Provides a standardized panel interface with:
 * - Position and size management
 * - State persistence via Redux
 * - Lifecycle management
 * - Debug integration
 */

import { appStore } from '../appState.js';
import { panelActions } from '../store/slices/panelSlice.js';

/**
 * Base class for creating dynamic, draggable, and resizable panels.
 * Integrates with Redux for state management and aligns with the application's design system.
 * Panels can be instantiated, mounted to the DOM, shown/hidden, and destroyed.
 * Provides lifecycle hooks for extended functionality.
 * @property {string} id - Unique identifier for the panel.
 * @property {string} title - Title displayed in the panel header.
 * @property {string} type - Type of the panel, used for styling and identification.
 * @property {HTMLElement|null} element - The root DOM element for the panel.
 * @property {boolean} mounted - True if the panel is currently in the DOM.
 * @property {object} config - Configuration options for the panel's behavior and appearance.
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
     */
    constructor(config = {}) {
        this.id = config.id || `panel-${Date.now()}`;
        this.title = config.title || 'Untitled Panel';
        this.type = config.type || 'generic';
        this.element = null;
        this.mounted = false;
        
        // Enhanced configuration with panel state
        this.config = {
            resizable: true,
            draggable: true,
            collapsible: true,
            closable: true,
            modal: false,
            zIndex: 'var(--z-popover)', // Use design token for z-index
            minWidth: 200,
            minHeight: 150,
            defaultWidth: 400,
            defaultHeight: 300,
            defaultPosition: { x: 100, y: 100 },
            // New state parameters
            isDocked: true,  // Default to docked in sidebar
            isOpen: false,   // Whether the panel is currently open
            floatingState: {
                position: { x: 100, y: 100 },
                size: { width: 400, height: 300 },
                zIndex: 'var(--z-popover)' // Use design token
            },
            ...config
        };

        // Bind methods
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        // Initialize panel state in Redux
        this.initializeState();
    }

    initializeState() {
        // Create a comprehensive panel state with robust default values
        appStore.dispatch(panelActions.createPanel({
            id: this.id,
            title: this.title,
            type: this.type,
            isDocked: this.config.isDocked,
            isOpen: this.config.isOpen,
            position: this.config.defaultPosition,
            size: { 
                width: this.config.defaultWidth, 
                height: this.config.defaultHeight 
            },
            floatingState: {
                position: this.config.defaultPosition,
                size: { 
                    width: this.config.defaultWidth, 
                    height: this.config.defaultHeight 
                },
                zIndex: this.config.zIndex
            },
            visible: false,
            collapsed: false,
            zIndex: this.config.zIndex,
            config: this.config
        }));
    }

    getState() {
        // This method should now reliably return the state, as it's created on construction.
        const state = appStore.getState().panels?.panels?.[this.id];
        if (state) {
            return state;
        }
        // Fallback for race conditions during initial render.
        return {
            id: this.id,
            title: this.title,
            type: this.type,
            isDocked: true,
            isOpen: false,
            position: this.config.defaultPosition,
            size: { 
                width: this.config.defaultWidth, 
                height: this.config.defaultHeight 
            },
            floatingState: {
                position: this.config.defaultPosition,
                size: { 
                    width: this.config.defaultWidth, 
                    height: this.config.defaultHeight 
                },
                zIndex: 1000
            },
            visible: false,
            collapsed: false,
            zIndex: this.config.zIndex,
            config: this.config,
            mounted: false
        };
    }

    updateState(updates) {
        appStore.dispatch(panelActions.updatePanel({
            id: this.id,
            updates
        }));
    }

    // Method to toggle between docked and floating states
    togglePanelMode() {
        const currentState = this.getState();
        const newIsDocked = !currentState.isDocked;

        this.updateState({
            isDocked: newIsDocked,
            // If becoming floating, update floating state
            ...(newIsDocked ? {} : { 
                floatingState: {
                    position: this.element ? {
                        x: parseInt(this.element.style.left || '100'),
                        y: parseInt(this.element.style.top || '100')
                    } : { x: 100, y: 100 },
                    size: this.element ? {
                        width: parseInt(this.element.style.width || '400'),
                        height: parseInt(this.element.style.height || '300')
                    } : { width: 400, height: 300 },
                    zIndex: this.config.zIndex
                }
            })
        });

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

        // Add base panel styles
        this.addBaseStyles();

        const state = this.getState();
        
        this.element.innerHTML = `
            <div class="panel-header" data-action="drag">
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

    // Override show method to manage open state
    show() {
        this.updateState({ 
            visible: true,
            isOpen: true,
            zIndex: appStore.getState().panels.maxZIndex + 1
        });
        this.applyStateToElement();
        this.bringToFront();
        this.onShow();
        return this;
    }

    // Override hide method to manage open state
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

    // Modify existing methods to work with new state structure
    applyStateToElement() {
        if (!this.element) return;

        const state = this.getState();
        if (!state) {
            console.warn(`[BasePanel] No state found for panel ${this.id}`);
            return;
        }

        // Ensure floatingState exists with default values
        const floatingState = state.floatingState || {
            position: this.config.defaultPosition,
            size: { 
                width: this.config.defaultWidth, 
                height: this.config.defaultHeight 
            },
            zIndex: 1000
        };

        // Determine which position/size to use based on docked state
        const position = state.isDocked 
            ? this.config.defaultPosition 
            : (floatingState.position || this.config.defaultPosition);
        const size = state.isDocked 
            ? { width: this.config.defaultWidth, height: this.config.defaultHeight }
            : (floatingState.size || { 
                width: this.config.defaultWidth, 
                height: this.config.defaultHeight 
            });

        // Safely apply position and size
        this.element.style.left = `${position.x || 100}px`;
        this.element.style.top = `${position.y || 100}px`;
        this.element.style.width = `${size.width || 400}px`;
        this.element.style.height = `${size.height || 300}px`;
        
        // Apply z-index, with multiple fallback mechanisms
        const zIndex = floatingState.zIndex || state.zIndex || this.config.zIndex || 1000;
        const computedZIndex = typeof zIndex === 'string' && zIndex.startsWith('var(')
            ? parseInt(getComputedStyle(document.documentElement).getPropertyValue(zIndex.slice(4, -1))) || 1000
            : (typeof zIndex === 'number' ? zIndex : 1000);
        
        this.element.style.zIndex = computedZIndex;

        // Visibility and open state
        this.element.style.display = state.visible ? 'flex' : 'none';
        if (state.visible) {
            // Use a timeout to allow the element to be rendered before adding the class
            setTimeout(() => {
                this.element.classList.add('is-visible');
            }, 10);
        } else {
            this.element.classList.remove('is-visible');
        }

        // Additional styling for docked vs floating
        this.element.classList.toggle('is-docked', state.isDocked);
        this.element.classList.toggle('is-floating', !state.isDocked);
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
     * Brings the panel to the front by increasing its z-index.
     */
    bringToFront() {
        const allPanels = appStore.getState().panels.panels;
        
        // Safely calculate max z-index with fallback to design tokens
        const maxZ = allPanels ? 
            Math.max(...Object.values(allPanels)
                .map(p => {
                    // Safely extract zIndex, with multiple fallback levels
                    const zIndex = p?.floatingState?.zIndex || 
                                   p?.zIndex || 
                                   'var(--z-popover)';
                    
                    // If it's a CSS variable, convert to numeric value
                    if (typeof zIndex === 'string' && zIndex.startsWith('var(')) {
                        return parseInt(getComputedStyle(document.documentElement).getPropertyValue(zIndex.slice(4, -1))) || 1000;
                    }
                    
                    // If it's already a number, return it
                    return typeof zIndex === 'number' ? zIndex : 1000;
                })
            ) : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--z-popover')) || 1000;

        // Get current panel state
        const currentState = this.getState();
        
        // Safely update state with new z-index
        this.updateState({ 
            floatingState: {
                ...(currentState.floatingState || {}),
                zIndex: maxZ + 1
            }
        });

        this.applyStateToElement();
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
                    this.updateState({ position: { x: newX, y: newY } });
                }
                break;
            case 'resize':
                if (this.config.resizable) {
                    const newWidth = Math.max(this.config.minWidth, this.dragState.startWidth + deltaX);
                    const newHeight = Math.max(this.config.minHeight, this.dragState.startHeight + deltaY);
                    this.updateState({ size: { width: newWidth, height: newHeight } });
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

    // Modify bringToFront to update floating state
    // bringToFront() {
    //     const allPanels = appStore.getState().panels.panels;
    //     const maxZ = Math.max(...Object.values(allPanels).map(p => p.floatingState.zIndex || 1000));
        
    //     this.updateState({ 
    //         floatingState: {
    //             ...this.getState().floatingState,
    //             zIndex: maxZ + 1
    //         }
    //     });
    //     this.applyStateToElement();
    // }

    /**
     * Removes the panel from the DOM and cleans up its state.
     */
    destroy() {
        if (this.element) {
            this.element.remove();
        }
        this.mounted = false;
        appStore.dispatch(panelActions.removePanel(this.id));
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

    addBaseStyles() {
        const styleId = 'base-panel-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .base-panel {
                position: fixed;
                display: flex;
                flex-direction: column;
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                overflow: hidden;
                transition: opacity 0.2s, transform 0.2s;
                opacity: 0;
                transform: scale(0.95);
            }
            .base-panel.is-visible {
                opacity: 1;
                transform: scale(1);
            }
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #f7f7f7;
                border-bottom: 1px solid #ddd;
                cursor: move;
                height: 40px;
            }
            .panel-title {
                font-weight: 600;
            }
            .panel-controls {
                display: flex;
                gap: 4px;
            }
            .panel-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
            }
            .panel-btn:hover {
                background: #eee;
            }
            .panel-body {
                flex: 1;
                padding: 12px;
                overflow: auto;
            }
            .base-panel.collapsed .panel-body {
                display: none;
            }
            .panel-resize-handle {
                position: absolute;
                right: 0;
                bottom: 0;
                width: 12px;
                height: 12px;
                cursor: se-resize;
                background: repeating-linear-gradient(
                    -45deg,
                    #ccc,
                    #ccc 1px,
                    transparent 1px,
                    transparent 4px
                );
            }
        `;
        document.head.appendChild(style);
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
