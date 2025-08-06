/**
 * packages/devpages-debug/DebugDock.js
 * Debug dock implementation - manages debug panels in a floating window
 * Renamed from DebugPanelManager to follow proper dock naming conventions
 */

import { BaseDock } from '/client/layout/docks/BaseDock.js';
import { zIndexManager } from '/client/utils/ZIndexManager.js';
import { logMessage } from '/client/log/index.js';
import { appStore, dispatch } from '/client/appState.js';
import { addPanel, setPanelVisibility, toggleSection, setPosition, setSize, toggleVisibility } from '/client/store/slices/debugPanelSlice.js';

export class DebugDock extends BaseDock {
    constructor() {
        super('debug-dock', 'Debug Tools', 'debug', true); // true = floating dock
        
        // Debug dock specific initialization
        this.initializeDebugDock();
    }

    initializeDebugDock() {
        // Delay initialization to allow logging system to be ready
        setTimeout(() => {
            this.initialize();
        }, 0);
    }

    createDockDOM() {
        // Create floating window structure
        this.dockElement = document.createElement('div');
        this.dockElement.id = 'debug-dock';
        this.dockElement.className = 'settings-panel floating-dock debug-dock'; // Reuse styles
        this.dockElement.style.cssText = `
            position: fixed;
            display: ${this.isVisible ? 'flex' : 'none'};
            left: ${this.currentPos.x}px;
            top: ${this.currentPos.y}px;
            width: ${this.currentSize.width}px;
            height: ${this.currentSize.height}px;
            z-index: 1000;
            flex-direction: column;
            background: var(--color-bg, white);
            border: 1px solid var(--color-border, #ddd);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;

        // Create header
        this.headerElement = document.createElement('div');
        this.headerElement.className = 'settings-panel-header dock-header';
        this.headerElement.innerHTML = `
            <span class="settings-panel-title dock-title">${this.title}</span>
            <button class="settings-panel-close dock-close" aria-label="Close Debug Dock">×</button>
        `;

        // Create content area
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'settings-panel-content dock-content';
        this.contentElement.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        `;

        // Create resize handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'settings-panel-resize-handle dock-resize-handle';
        this.resizeHandle.innerHTML = '⋰';
        this.resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: se-resize;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: var(--color-fg-muted, #999);
        `;

        // Assemble dock structure
        this.dockElement.appendChild(this.headerElement);
        this.dockElement.appendChild(this.contentElement);
        this.dockElement.appendChild(this.resizeHandle);
        document.body.appendChild(this.dockElement);

        // Get close button reference
        this.closeButton = this.headerElement.querySelector('.dock-close');
        
        // Debug: Check if close button was found
        if (this.closeButton) {
            logMessage('[DebugDock] Close button found successfully', 'debug');
        } else {
            logMessage('[DebugDock] Close button not found in DOM', 'error');
        }
    }

    attachEventListeners() {
        // Drag functionality
        this.headerElement.addEventListener('mousedown', this.startDrag.bind(this));
        
        // Resize functionality  
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
        
        // Close button
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hide());
        }
        
        // Bring to front on interaction
        this.dockElement.addEventListener('mousedown', () => this.bringToFront());

        // Global mouse events for drag/resize
        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) this.doDrag(e);
            if (this.isResizing) this.doResize(e);
        });
        
        window.addEventListener('mouseup', () => {
            if (this.isDragging) this.endDrag();
            if (this.isResizing) this.endResize();
        });
    }

    // =================================================================
    // DEBUG DOCK SPECIFIC REDUX INTEGRATION
    // =================================================================

    addPanelToState(panelData) {
        appStore.dispatch(addPanel({
            id: panelData.id,
            title: panelData.title,
            visible: panelData.visible,
            enabled: true,
            order: panelData.order
        }));
    }

    updatePanelInState(panelId, updates) {
        if (updates.hasOwnProperty('collapsed')) {
            // Toggle section uses the existing debugPanelSlice action
            appStore.dispatch(toggleSection(panelId));
        }
        
        if (updates.hasOwnProperty('visible')) {
            appStore.dispatch(setPanelVisibility({ 
                panelId: panelId, 
                visible: updates.visible 
            }));
        }
    }

    savePersistedState() {
        // Update position, size, and visibility in debug panel state
        appStore.dispatch(setPosition(this.currentPos));
        appStore.dispatch(setSize(this.currentSize));
        appStore.dispatch(toggleVisibility(this.isVisible));
    }

    // =================================================================
    // Z-INDEX MANAGEMENT
    // =================================================================

    registerWithZIndexManager() {
        if (this.dockElement && zIndexManager) {
            zIndexManager.register(this.dockElement, 'UI', 60, { name: 'Debug Dock' });
        }
    }

    bringToFront() {
        if (this.dockElement && zIndexManager) {
            zIndexManager.bringToFront(this.dockElement);
        } else {
            super.bringToFront();
        }
    }

    // =================================================================
    // PANEL MANAGEMENT OVERRIDES
    // =================================================================

    show() {
        // Ensure panels are loaded every time the dock is shown
        this.loadPanels();
        super.show();
        this.bringToFront();
    }

    // =================================================================
    // LEGACY COMPATIBILITY METHODS
    // =================================================================

    /**
     * Reopen a closed panel (legacy compatibility)
     */
    reopenSectionPanel(sectionId) {
        this.updatePanelInState(sectionId, { visible: true });
        this.loadPanels(); // Reload to show the reopened panel
        logMessage(`[DebugDock] Reopened panel ${sectionId}`, 'debug');
    }

    /**
     * Get closed panels (legacy compatibility)
     */
    getClosedPanels() {
        const debugState = this.getReduxState();
        return debugState.panels?.filter(panel => !panel.visible).map(panel => panel.id) || [];
    }
    
    /**
     * Get all panels (legacy compatibility)
     */
    getAllPanels() {
        const debugState = this.getReduxState();
        return debugState.panels || [];
    }

    // =================================================================
    // INITIALIZATION OVERRIDE
    // =================================================================

    async initialize() {
        await super.initialize();
        this.registerWithZIndexManager();
    }
}

// Create and export singleton instance
export const debugDock = new DebugDock();

// Expose to window for global access from shortcuts or console
window.debugDock = debugDock;
window.debugPanelManager = debugDock; // Legacy compatibility

// Add debug function to test dock functionality
window.testDebugDock = function() {
    console.log('=== DEBUG DOCK TEST ===');
    
    // Test main dock
    console.log('Debug dock visible:', debugDock.isVisible);
    console.log('Debug dock element:', debugDock.dockElement);
    console.log('Close button element:', debugDock.closeButton);
    
    // Test section instances
    console.log('Section instances:', debugDock.sectionInstances);
    console.log('Available sections:', Object.keys(debugDock.sectionInstances));
    
    // Test panel states (from reducer)
    console.log('All panels:', debugDock.getAllPanels());
    console.log('Closed panels:', debugDock.getClosedPanels());
    
    console.log('=== END DEBUG DOCK TEST ===');
};

// Legacy compatibility function
window.testDebugPanel = window.testDebugDock;

// Add function to reopen closed panels
window.reopenDebugPanel = function(panelId) {
    if (panelId) {
        debugDock.reopenSectionPanel(panelId);
        console.log(`Reopened panel: ${panelId}`);
    } else {
        console.log('Available closed panels:', debugDock.getClosedPanels());
        console.log('Usage: reopenDebugPanel("panel-id")');
    }
};