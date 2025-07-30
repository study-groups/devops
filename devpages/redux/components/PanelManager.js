/**
 * PanelManager.js - Redux-integrated Panel Management System
 * Manages beautiful draggable/resizable panels with Redux state sync
 */

import { PDataPanel } from './PDataPanel.js';
import { DebugDock } from './DebugDock.js';

export class PanelManager {
    constructor(store) {
        this.store = store;
        this.dispatch = store.dispatch;
        this.getState = store.getState;
        
        // Active panels and docks
        this.panels = new Map();
        this.docks = new Map();
        

        
        // State tracking
        this.isInitialized = false;
        
        this.log = (message) => console.log(`[PanelManager] ${message}`);
        this.log('Redux PanelManager initialized');
        
        // Make available globally for debugging
        window.panelManager = this;
    }
    
    /**
     * Initialize the panel system
     */
    async initialize() {
        if (this.isInitialized) {
            this.log('Already initialized, skipping');
            return;
        }
        
        try {

            
            // Subscribe to Redux state changes
            this.store.subscribe(() => {
                this.syncWithReduxState();
            });
            
            // Create debug dock
            await this.createDebugDock();
            
            // Create PData panel
            await this.createPDataPanel();
            
            this.isInitialized = true;
            this.log('Panel system initialized successfully - Ctrl+Shift+D should now work!');
            
        } catch (error) {
            console.error('[PanelManager] Initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Create the debug dock
     */
    async createDebugDock() {
        const dockId = 'debug-dock';
        
        try {
            if (this.docks.has(dockId)) {
                this.log(`Debug dock ${dockId} already exists`);
                return this.docks.get(dockId);
            }
            
            const dock = new DebugDock(dockId, this.dispatch, this.getState);
            this.docks.set(dockId, dock);
            
            this.log(`Created debug dock: ${dockId}`);
            return dock;
            
        } catch (error) {
            console.error(`[PanelManager] Failed to create debug dock ${dockId}:`, error);
            throw error;
        }
    }
    
    /**
     * Create the PData panel
     */
    async createPDataPanel() {
        const panelId = 'pdata-panel';
        
        try {
            if (this.panels.has(panelId)) {
                this.log(`Panel ${panelId} already exists`);
                return this.panels.get(panelId);
            }

            // Create the panel instance first
            const panel = new PDataPanel(panelId, this.store);
            this.panels.set(panelId, panel);
            
            // Mount panel to debug dock container
            const dock = this.docks.get('debug-dock');
            if (dock && dock.panelContainer) {
                panel.mount(dock.panelContainer);
                this.log(`Mounted PData panel to debug dock`);
            } else {
                this.log('Debug dock not found, panel created but not mounted');
            }
            
            return panel;
            
        } catch (error) {
            console.error(`[PanelManager] Failed to create panel ${panelId}:`, error);
            throw error;
        }
    }
    
    /**
     * Sync with Redux state changes
     */
    syncWithReduxState() {
        const state = this.getState();
        const panelState = state.panels;
        
        if (!panelState) return;
        
        // Sync dock states
        if (panelState.docks) {
            for (const [dockId, dockState] of Object.entries(panelState.docks)) {
                const dock = this.docks.get(dockId);
                if (dock && typeof dock.syncWithState === 'function') {
                    dock.syncWithState(dockState);
                }
            }
        }
        
        // Sync panel states and handle mounting/flyout
        if (panelState.panels) {
            for (const [panelId, panelStateData] of Object.entries(panelState.panels)) {
                this.syncPanelState(panelId, panelStateData);
            }
        }
    }
    
    /**
     * Sync individual panel state and handle mounting/flyout
     */
    syncPanelState(panelId, panelState) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        
        // Standard sync
        if (typeof panel.syncFromRedux === 'function') {
            panel.syncFromRedux(panelState);
        }
        
        // Handle mounting/unmounting
        if (panelState.isVisible && !panelState.isMounted) {
            this.mountPanel(panelId, panelState);
        } else if (!panelState.isVisible && panelState.isMounted) {
            this.unmountPanel(panelId);
        } else if (panelState.isVisible && panelState.isMounted) {
            // Check if flyout state changed and remount if needed
            const currentlyInFlyout = panel.element && panel.element.parentNode === document.body;
            if (panelState.isFlyout !== currentlyInFlyout) {
                this.unmountPanel(panelId);
                this.mountPanel(panelId, panelState);
            }
        }
    }
    
    /**
     * Mount a panel (either in dock or as flyout)
     */
    mountPanel(panelId, panelState) {
        const panel = this.panels.get(panelId);
        if (!panel || !panelState.isVisible) return;
        
        if (panelState.isFlyout) {
            this.mountPanelAsFlyout(panelId, panelState);
        } else {
            this.mountPanelInDock(panelId, panelState);
        }
        
        // Update Redux state
        this.dispatch({ 
            type: 'panels/mountPanel', 
            payload: { 
                panelId, 
                dockId: panelState.dockId,
                containerId: panelState.isFlyout ? 'flyout-body' : `container-${panelId}`
            }
        });
    }
    
    /**
     * Mount panel as a flyout window
     */
    mountPanelAsFlyout(panelId, panelState) {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        // Ensure the panel's element exists, re-render if needed
        if (!panel.element) {
            panel.render();
        }
        
        // Ensure panel is removed from any current parent
        if (panel.element.parentNode) {
            panel.element.parentNode.removeChild(panel.element);
        }
        
        // Load saved position from the panel itself
        const saved = typeof panel.loadFlyoutPosition === 'function' ? panel.loadFlyoutPosition() : null;
        const position = saved ? saved.position : { x: 20, y: 20 };
        const size = saved ? saved.size : { width: 400, height: 600 };
        
        this.log(`Mounting ${panelId} as flyout at (${position.x}, ${position.y})`);
        
        // Style for flyout mode - respect current collapsed state
        const isCollapsed = panelState.isCollapsed || panel.state?.isCollapsed;
        const flyoutHeight = isCollapsed ? 'auto' : `${size.height}px`;
        
        panel.element.style.cssText = `
            position: fixed;
            top: ${position.y}px;
            left: ${position.x}px;
            width: ${size.width}px;
            height: ${flyoutHeight};
            min-height: auto;
            z-index: 1050;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        
        document.body.appendChild(panel.element);
        this.addFlyoutControls(panel.element);
        
        if (panel.options.resizable) {
            this.makeFlyoutResizable(panel.element, panel);
        }
        
        this.makeFlyoutDraggable(panel.element, panel);
        
        // Dispatch position and size to Redux
        this.dispatch({
            type: 'panels/updatePanelPosition',
            payload: { panelId, position, size, isFlyout: true }
        });
    }
    
    /**
     * Mount panel in its designated dock
     */
    mountPanelInDock(panelId, panelState) {
        const panel = this.panels.get(panelId);
        const dock = this.docks.get(panelState.dockId);
        
        if (!panel || !dock || !dock.panelContainer) return;
        
        // Ensure panel is removed from any current parent
        if (panel.element.parentNode) {
            panel.element.parentNode.removeChild(panel.element);
        }
        
        // Reset flyout styles
        panel.element.style.cssText = '';
        panel.element.style.display = 'block';
        
        // Mount to dock container
        dock.panelContainer.appendChild(panel.element);
        this.log(`Mounted ${panelId} in dock ${panelState.dockId}`);
    }
    
    /**
     * Add flyout controls (close button, drag handle)
     */
    addFlyoutControls(element) {
        // Check if controls already exist
        if (element.querySelector('.flyout-controls')) return;
        
        const controls = document.createElement('div');
        controls.className = 'flyout-controls';
        controls.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            display: flex;
            gap: 5px;
            z-index: 10;
        `;
        
        // Simple dock return button
        const dockBtn = document.createElement('button');
        dockBtn.className = 'flyout-dock';
        dockBtn.innerHTML = '⧉'; // Broken Square Icon
        dockBtn.title = 'Return to Dock';
        dockBtn.style.cssText = `
            background: var(--color-bg-muted, #e9ecef);
            color: var(--color-fg, #333);
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 2px;
            width: 18px;
            height: 18px;
            cursor: pointer;
            font-size: 11px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        dockBtn.onclick = () => {
            // Save position before closing and return to dock
            const panelId = element.id.replace('container-', '').replace('-flyout', '');
            const panelInstance = this.panels.get(panelId);
            
            this.log(`🔄 Dock button clicked for ${panelId}`);
            
            // Save current position for next time
            if (panelInstance && typeof panelInstance.saveFlyoutPosition === 'function') {
                panelInstance.saveFlyoutPosition();
                this.log(`💾 Saved position before docking ${panelId}`);
            }
            
            this.dispatch({ 
                type: 'panels/togglePanelFlyout', 
                payload: { panelId }
            });
        };
        
        controls.appendChild(dockBtn);
        element.appendChild(controls);
    }
    
    /**
     * Unmount a panel
     */
    unmountPanel(panelId) {
        const targetPanel = this.panels.get(panelId);
        if (!targetPanel || !targetPanel.element) return;
        
        // Unregister from Z-Index Manager if it's a flyout
        if (targetPanel.element.parentNode === document.body && typeof zIndexManager !== 'undefined') {
            zIndexManager.unregister(targetPanel.element);
        }
        
        // Remove from DOM
        if (targetPanel.element.parentNode) {
            targetPanel.element.parentNode.removeChild(targetPanel.element);
        }
        
        // Remove flyout controls
        const controls = targetPanel.element.querySelector('.flyout-controls');
        if (controls) {
            controls.remove();
        }
        
        this.log(`Unmounted ${panelId}`);
        
        // Save flyout position if it was a flyout
        const panelInstance = this.panels.get(panelId);
        if (panelInstance && typeof panelInstance.saveFlyoutPosition === 'function') {
            panelInstance.saveFlyoutPosition();
            this.log(`💾 Saved position on unmount for ${panelId}`);
        }
        
        // Update Redux state
        this.dispatch({ 
            type: 'panels/unmountPanel', 
            payload: { panelId }
        });
    }
    
    /**
     * Make flyout panel draggable for repositioning
     */
    makeFlyoutDraggable(element, panelInstance) {
        const header = element.querySelector('.panel-header');
        if (!header) return;
        
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        
        header.style.cursor = 'move';
        
        header.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on controls
            if (e.target.closest('.panel-controls')) return;
            
            isDragging = true;
            const rect = element.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
            element.style.userSelect = 'none';
            element.style.pointerEvents = 'none';
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            
            // Keep within viewport bounds
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            
            element.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
            element.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.userSelect = '';
                element.style.pointerEvents = '';
                
                // Save new position immediately after drag
                if (typeof panelInstance.saveFlyoutPosition === 'function') {
                    panelInstance.saveFlyoutPosition();
                    this.log(`💾 Saved position after drag for ${panelInstance.id}`);
                }
            }
        });
    }
    
    /**
     * Show a specific dock
     */
    showDock(dockId) {
        const dock = this.docks.get(dockId);
        if (dock) {
            dock.show();
            this.log(`Showed dock: ${dockId}`);
        } else {
            this.log(`Dock not found: ${dockId}`);
        }
    }
    
    /**
     * Hide a specific dock
     */
    hideDock(dockId) {
        const dock = this.docks.get(dockId);
        if (dock) {
            dock.hide();
            this.log(`Hid dock: ${dockId}`);
        } else {
            this.log(`Dock not found: ${dockId}`);
        }
    }
    
    /**
     * Toggle dock visibility
     */
    toggleDock(dockId) {
        const dock = this.docks.get(dockId);
        if (dock) {
            if (dock.isVisible) {
                dock.hide();
            } else {
                dock.show();
            }
            this.log(`Toggled dock: ${dockId} (now ${dock.isVisible ? 'visible' : 'hidden'})`);
        } else {
            this.log(`Dock not found: ${dockId}`);
        }
    }
    
    /**
     * Show a specific panel
     */
    showPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            if (typeof panel.show === 'function') {
                panel.show();
            }
            this.log(`Showed panel: ${panelId}`);
        } else {
            this.log(`Panel not found: ${panelId}`);
        }
    }
    
    /**
     * Hide a specific panel
     */
    hidePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            if (typeof panel.hide === 'function') {
                panel.hide();
            }
            this.log(`Hid panel: ${panelId}`);
        } else {
            this.log(`Panel not found: ${panelId}`);
        }
    }
    
    /**
     * Toggle panel visibility
     */
    togglePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (panel) {
            if (typeof panel.toggle === 'function') {
                panel.toggle();
            } else if (typeof panel.isVisible !== 'undefined') {
                if (panel.isVisible) {
                    this.hidePanel(panelId);
                } else {
                    this.showPanel(panelId);
                }
            }
            this.log(`Toggled panel: ${panelId}`);
        } else {
            this.log(`Panel not found: ${panelId}`);
        }
    }
    
    /**
     * Get all active docks
     */
    getDocks() {
        return Array.from(this.docks.keys());
    }
    
    /**
     * Get all active panels
     */
    getPanels() {
        return Array.from(this.panels.keys());
    }
    
    /**
     * Reset to default state
     */
    resetDefaults() {
        this.log('Resetting panels to default state');
        
        // Show debug dock by default
        this.showDock('debug-dock');
        
        // Show PData panel by default
        this.showPanel('pdata-panel');
        
        this.log('Reset to defaults completed');
    }
    
    /**
     * Destroy all panels and docks
     */
    /**
     * Toggle panel between flyout and dock mode
     */
    togglePanelFlyout(panelId) {
        this.log(`🚀 Toggling flyout mode for panel: ${panelId}`);
        this.dispatch({ 
            type: 'panels/togglePanelFlyout', 
            payload: { panelId }
        });
    }
    
    /**
     * Reset panels to default layout (Ctrl+Shift+1)
     */
    resetDefaults() {
        this.log('⚠️ NUCLEAR RESET: Resetting all panels to default layout...');
        
        try {
            // Import panel actions
            import('../slices/panelSlice.js').then(({ resetToDefaults }) => {
                this.dispatch(resetToDefaults());
                this.log('✅ Panel layout reset to defaults');
            }).catch(error => {
                console.error('[PanelManager] Failed to reset panels:', error);
            });
        } catch (error) {
            console.error('[PanelManager] Reset failed:', error);
        }
    }

    destroy() {
        this.log('Destroying panel system...');
        
        // Destroy all panels
        for (const [panelId, panel] of this.panels) {
            if (typeof panel.destroy === 'function') {
                panel.destroy();
            }
            this.log(`Destroyed panel: ${panelId}`);
        }
        this.panels.clear();
        
        // Destroy all docks
        for (const [dockId, dock] of this.docks) {
            if (typeof dock.destroy === 'function') {
                dock.destroy();
            }
            this.log(`Destroyed dock: ${dockId}`);
        }
        this.docks.clear();
        
        this.isInitialized = false;
        this.log('Panel system destroyed');
    }
    
    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            docks: Array.from(this.docks.keys()),
            panels: Array.from(this.panels.keys()),
            reduxState: this.getState().panels
        };
    }
}

/**
 * Global helper functions for debugging
 */
export function createPanelManager(store) {
    return new PanelManager(store);
}

// Export for global access
if (typeof window !== 'undefined') {
    window.createPanelManager = createPanelManager;
} 