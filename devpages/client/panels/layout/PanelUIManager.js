/**
 * PanelUIManager.js - Manages the panel system with Panel Control Center
 */

import { PanelControlCenter } from '/client/panels/core/PanelControlCenter.js';
import { eventBus } from '/client/eventBus.js';
import { appStore } from '/client/appState.js';
import { dispatch, ActionTypes } from '/client/messaging/messageQueue.js';

export class PanelUIManager {
    constructor() {
        this.state = {
            initialized: false,
            controlCenter: null,
            editorPanel: null,
            previewPanel: null
        };
        this.storeUnsubscribe = null;
        console.log('[PanelUIManager] Initialized with Control Center pattern');
    }

    /**
     * Initialize the panel system
     */
    async initialize() {
        if (this.state.initialized) {
            console.warn('[PanelUIManager] Already initialized.');
            return;
        }
        console.log('[PanelUIManager] Starting initialization...');
        
        this.loadPanelSystemCSS();

        // The PanelUIManager NO LONGER manages the main content panels directly.
        // It now waits for the ContentView to be ready before initializing its own
        // managed components, like the Control Center.
        if (window.eventBus) {
            const onContentViewReady = async () => {
                // Immediately unsubscribe to mimic .once() behavior
                window.eventBus.off('content-view:ready', onContentViewReady);
                
                console.log('[PanelUIManager] Received "content-view:ready" event. Proceeding with full initialization.');
                
                // The ContentView now creates the containers, so we don't check for them here.
                
                // Initialize the Panel Control Center (if needed, this part can be modularized)
                // For now, let's assume the control center is not part of this new flow.
                // await this.initializeControlCenter();
                // console.log('[PanelUIManager] Control center initialized');
                
                // Initialize the panels now that their containers are guaranteed to exist.
                await this.initializePanels();
                console.log('[PanelUIManager] All panels initialized');
                
                // Setup state synchronization
                this.setupStateSync();
                console.log('[PanelUIManager] State sync setup complete');
                
                // Apply initial state
                this.applyInitialState();
                console.log('[PanelUIManager] Initial state applied');
                
                this.state.initialized = true;
                console.log('[PanelUIManager] Initialization complete');
                this.notifyPanelsReady();
            };
            
            window.eventBus.on('content-view:ready', onContentViewReady);

        } else {
            console.error('[PanelUIManager] EventBus not available. Cannot complete initialization.');
        }
    }

    /**
     * Check if required DOM containers exist
     */
    checkDOMContainers() {
        // This method is now obsolete as ContentView manages its own DOM.
        // Kept for potential future use or can be removed.
        console.warn('[PanelUIManager] checkDOMContainers is obsolete.');
    }

    /**
     * Create the layout structure if it doesn't exist
     */
    createLayout() {
        // Layout should already exist in HTML, just verify it's there
        const panelsContainer = document.getElementById('panels-container');
        if (!panelsContainer) {
            console.error('[PanelUIManager] panels-container not found in DOM');
            return;
        }
        console.log('[PanelUIManager] panels-container found and ready');
    }

    /**
     * Initialize the Panel Control Center
     */
    async initializeControlCenter() {
        console.log('[PanelUIManager] Creating Panel Control Center...');
        
        // Create the Panel Control Center (leftmost panel)
        this.state.controlCenter = new PanelControlCenter({
            id: 'panel-manager',
            title: 'Panel Manager',
            order: -1, // Leftmost position
            width: 320,
            persistent: true
        });

        // Mount to panels container
        const panelsContainer = document.getElementById('panels-container');
        if (!panelsContainer) {
            throw new Error('panels-container not found');
        }

        const mountResult = this.state.controlCenter.mount(panelsContainer);
        console.log('[PanelUIManager] Control Center mount result:', mountResult);
        
        if (!mountResult) {
            throw new Error('Failed to mount Panel Control Center');
        }
    }

    /**
     * Initialize managed panels (Context, Code, etc.)
     */
    async initializePanels() {
        console.log('[PanelUIManager] Creating managed panels...');
        
        try {
            // The panel's mount method will now target the specific containers
            // rendered by ContentView.
            const editorContainer = document.getElementById('content-editor-panel');
            const previewContainer = document.getElementById('content-preview-panel');

            if (!editorContainer || !previewContainer) {
                throw new Error('Editor or Preview container not found in the DOM. ContentView might have failed to render.');
            }

            // Create Editor Panel
            const { EditorPanel } = await import('/client/panels/types/EditorPanel.js');
            this.state.editorPanel = new EditorPanel({
                id: 'editor-panel',
                order: 0,
                width: 400,
                headless: true
            });

            // Create Preview Panel
            const { PreviewPanel } = await import('/client/panels/types/PreviewPanel.js');
            this.state.previewPanel = new PreviewPanel({
                id: 'preview-panel', 
                order: 1,
                width: 400,
                headless: true
            });

            // Mount managed panels into their dedicated containers
            this.state.editorPanel.mount(editorContainer);
            this.state.previewPanel.mount(previewContainer);

            // Register with control center if it exists
            if (this.state.controlCenter) {
                this.state.controlCenter.registerManagedPanel(this.state.editorPanel);
                this.state.controlCenter.registerManagedPanel(this.state.previewPanel);
            }

            console.log('[PanelUIManager] Managed panels created and mounted.');
        } catch (error) {
            console.error('[PanelUIManager] Error creating managed panels:', error);
            throw error;
        }
    }

    /**
     * Setup state synchronization with app store
     */
    setupStateSync() {
        this.storeUnsubscribe = appStore.subscribe((state, prevState) => {
            if (!prevState) return;

            const newPanelsState = state.panels || {};
            const prevPanelsState = prevState.panels || {};

            // Handle panel visibility
            for (const panelId of ['editor-panel', 'preview-panel']) {
                const newPanelDef = newPanelsState[panelId];
                const prevPanelDef = prevPanelsState[panelId];
                
                if (newPanelDef && (!prevPanelDef || newPanelDef.visible !== prevPanelDef.visible)) {
                    const panelInstance = this.getManagedPanel(panelId);
                    if (panelInstance) {
                        if (newPanelDef.visible) {
                            panelInstance.show();
                        } else {
                            panelInstance.hide();
                        }
                    }
                }
            }

            // Handle log panel visibility affecting layout
            const newLogVisible = state.ui?.logVisible;
            const prevLogVisible = prevState.ui?.logVisible;
            if (newLogVisible !== prevLogVisible) {
                this.adjustLayoutForLog(newLogVisible);
            }
        });

        // Listen for resize events from panels
        if (window.eventBus) {
            window.eventBus.on('panel:resized', ({ panelId, width }) => {
                dispatch({
                    type: ActionTypes.PANEL_SET_WIDTH,
                    payload: { panelId, width }
                });
            });
        }
    }

    /**
     * Adjusts the main content area to accommodate the log panel.
     * @param {boolean} isLogVisible - Whether the log panel is visible.
     */
    adjustLayoutForLog(isLogVisible) {
        document.body.classList.toggle('log-visible', isLogVisible);
    }

    /**
     * Apply initial state from app store
     */
    applyInitialState() {
        const appState = appStore.getState();
        const panelsState = appState.panels || {};

        for (const panelId in panelsState) {
            const panelDef = panelsState[panelId];
            const panelInstance = this.getManagedPanel(panelId);

            if (panelInstance) {
                if (panelDef.visible) {
                    panelInstance.show();
                } else {
                    panelInstance.hide();
                }
            }
        }
        
        // Apply initial log visibility to layout
        if (appState.ui) {
            this.adjustLayoutForLog(appState.ui.logVisible);
        }
    }

    /**
     * Setup simplified gutter buttons
     */
    setupGutterButtons() {
        console.log('[PanelUIManager] Setting up gutter buttons...');
        // Note: Gutter buttons will be managed by CSS/HTML for now
        // This is a placeholder for future gutter button functionality
    }

    /**
     * Toggle Panel Manager (Control Center) visibility
     */
    togglePanelManager() {
        console.log('[PanelUIManager] togglePanelManager called');
        console.log('[PanelUIManager] Control center exists:', !!this.state.controlCenter);
        
        if (this.state.controlCenter) {
            console.log('[PanelUIManager] Control center state:', this.state.controlCenter.state);
            console.log('[PanelUIManager] Control center mounted:', this.state.controlCenter.state?.mounted);
            console.log('[PanelUIManager] Control center element:', this.state.controlCenter.element);
            
            this.state.controlCenter.toggle();
            
            // Update button state
            const button = document.getElementById('gutter-btn-panel-manager-toggle');
            if (button) {
                const isVisible = this.state.controlCenter.state.visible;
                button.style.backgroundColor = isVisible ? '#007bff' : '#fff';
                button.style.color = isVisible ? '#fff' : '#6c757d';
            }

            // Dispatch to app store
            dispatch({
                type: ActionTypes.UI_TOGGLE_LEFT_SIDEBAR,
                payload: { visible: this.state.controlCenter.state.visible }
            });
        } else {
            console.error('[PanelUIManager] No control center found - initialization may have failed');
        }
    }

    /**
     * Toggle debug mode (placeholder)
     */
    toggleDebugMode() {
        this.log('Debug mode toggle - not implemented yet', 'debug');
        alert('Debug mode not implemented yet');
    }

    /**
     * Get managed panel by ID
     */
    getManagedPanel(panelId) {
        if (panelId === 'editor-panel') return this.state.editorPanel;
        if (panelId === 'preview-panel') return this.state.previewPanel;
        return null;
    }

    /**
     * Get Panel Control Center
     */
    getControlCenter() {
        return this.state.controlCenter;
    }

    /**
     * Setup app state subscription to sync control center visibility
     */
    setupAppStateSubscription() {
        this.appStateUnsubscribe = appStore.subscribe((newState, prevState) => {
            const newUI = newState.ui || {};
            const prevUI = prevState.ui || {};

            // Handle left sidebar (Panel Manager) visibility change
            if (newUI.leftSidebarVisible !== prevUI.leftSidebarVisible) {
                if (this.state.controlCenter) {
                    if (newUI.leftSidebarVisible) {
                        this.state.controlCenter.show();
                        this.log('Panel Manager shown via app state change', 'debug');
                    } else {
                        this.state.controlCenter.hide();
                        this.log('Panel Manager hidden via app state change', 'debug');
                    }
                    
                    // Update gutter button state
                    const button = document.getElementById('gutter-btn-panel-manager-toggle');
                    if (button) {
                        const isVisible = newUI.leftSidebarVisible;
                        button.style.backgroundColor = isVisible ? '#007bff' : '#fff';
                        button.style.color = isVisible ? '#fff' : '#6c757d';
                    }
                }
            }

            // The control center manages individual panels, so we don't need to handle
            // rightSidebarVisible here - the control center cards handle that
        });

        this.log('App state subscription setup complete', 'debug');
    }

    /**
     * Load external CSS for the panel system
     */
    loadPanelSystemCSS() {
        // Check if CSS is already loaded
        if (document.querySelector('link[href*="panels.css"]')) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/client/panels/styles/panels.css';
        document.head.appendChild(link);
    }

    /**
     * Notify that panels are ready
     */
    notifyPanelsReady() {
        // Emit event for other components
        if (window.eventBus) {
            window.eventBus.emit('panels:ready', {
                controlCenter: this.state.controlCenter,
                managedPanels: ['editor-panel', 'preview-panel']
            });
        }

        // Set global reference for compatibility
        // window.panelUIManager = this; // This is already set by the singleton export
        
        console.log('[PanelUIManager] Panels ready notification sent.');
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...this.state,
            controlCenterVisible: this.state.controlCenter?.state.visible || false
        };
    }

    /**
     * Clean up and simplify log method
     */
    log(message, level = 'info') {
        const prefix = '[PanelUIManager]';
        switch (level) {
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}`);
                break;
            case 'debug':
                console.log(`${prefix} ${message}`);
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        console.log('[PanelUIManager] Destroying...');
        
        // Unsubscribe from app state
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        
        // Destroy panels
        if (this.state.controlCenter) {
            this.state.controlCenter.destroy();
        }
        if (this.state.editorPanel) {
            this.state.editorPanel.destroy();
        }
        if (this.state.previewPanel) {
            this.state.previewPanel.destroy();
        }
        
        // Clear state
        this.state = {
            initialized: false,
            controlCenter: null,
            editorPanel: null,
            previewPanel: null
        };
        
        console.log('[PanelUIManager] Cleanup complete');
    }

    /**
     * Debug method to manually remount control center
     */
    remountControlCenter() {
        console.warn('[PanelUIManager] remountControlCenter is likely obsolete and needs review.');
    }
}

// Create singleton instance
export const panelUIManager = new PanelUIManager();

// Make globally accessible
window.panelUIManager = panelUIManager; 