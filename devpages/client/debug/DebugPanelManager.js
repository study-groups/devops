/**
 * client/debug/DebugPanelManager.js
 * Manages the floating debug panel which contains various debug-related sub-panels.
 */

import { zIndexManager } from '/client/utils/ZIndexManager.js';
import { panelRegistry } from '/client/panels/core/panelRegistry.js';
import { logMessage } from '/client/log/index.js';
import { appStore, dispatch } from '/client/appState.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

const DEBUG_PANEL_STATE_KEY = 'devpages_debug_panel_state';

class DebugPanelManager {
    constructor() {
        this.panelElement = null;
        this.headerElement = null;
        this.contentElement = null;
        this.resizeHandle = null;
        this.closeButton = null;

        this.isVisible = false;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

        this.currentPos = { x: 150, y: 150 };
        this.currentSize = { width: 500, height: 400 };
        
        this.sectionInstances = {};

        // Delay initialization to allow logging system to be ready
        setTimeout(() => {
            this.loadPersistedState();
            this.init();
        }, 0);
    }

    async init() {
        this.createPanelDOM();
        this.attachEventListeners();
        this.registerWithZIndexManager();
        this.syncRegisteredPanels();
        this.loadPanels();
        this.updatePanelVisibility(); // Apply loaded visibility state
    }

    createPanelDOM() {
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'debug-panel';
        this.panelElement.className = 'settings-panel'; // Reuse styles
        this.panelElement.style.cssText = `
            position: fixed;
            display: ${this.isVisible ? 'flex' : 'none'};
            left: ${this.currentPos.x}px;
            top: ${this.currentPos.y}px;
            width: ${this.currentSize.width}px;
            height: ${this.currentSize.height}px;
        `;

        this.headerElement = document.createElement('div');
        this.headerElement.className = 'settings-panel-header';
        this.headerElement.innerHTML = `
            <span class="settings-panel-title">Debug Panel</span>
            <button class="settings-panel-close" aria-label="Close Debug Panel">X</button>
        `;

        this.contentElement = document.createElement('div');
        this.contentElement.className = 'settings-panel-content';

        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'settings-panel-resize-handle';
        this.resizeHandle.innerHTML = '⋰';

        this.panelElement.appendChild(this.headerElement);
        this.panelElement.appendChild(this.contentElement);
        this.panelElement.appendChild(this.resizeHandle);
        document.body.appendChild(this.panelElement);

        this.closeButton = this.headerElement.querySelector('.settings-panel-close');
        
        // Debug: Check if close button was found
        if (this.closeButton) {
            console.log('[DebugPanelManager] Close button found successfully');
        } else {
            console.error('[DebugPanelManager] Close button not found in DOM');
            logMessage('[DebugPanelManager] Close button not found in DOM', 'error');
        }
    }

    attachEventListeners() {
        this.headerElement.addEventListener('mousedown', this.startDrag.bind(this));
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
        
        // Add error checking for close button
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hide());
        } else {
            console.error('[DebugPanelManager] Close button not found when attaching event listeners');
            logMessage('[DebugPanelManager] Close button not found when attaching event listeners', 'error');
        }
        
        this.panelElement.addEventListener('mousedown', () => this.bringToFront());

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) this.doDrag(e);
            if (this.isResizing) this.doResize(e);
        });
        window.addEventListener('mouseup', () => {
            if (this.isDragging) this.endDrag();
            if (this.isResizing) this.endResize();
        });
    }
    
    syncRegisteredPanels() {
        // Add registered debug panels to the debug state if they don't exist
        const debugPanels = panelRegistry.getAllPanels().filter(p => p.group === 'debug');
        const debugState = appStore.getState().debugPanel;
        
        debugPanels.forEach((panelConfig, index) => {
            const panelExists = debugState.panels.find(p => p.id === panelConfig.id);
            
            if (!panelExists) {
                // Add the panel to the debug state
                dispatch({
                    type: ActionTypes.DEBUG_PANEL_ADD_PANEL,
                    payload: {
                        id: panelConfig.id,
                        title: panelConfig.title,
                        visible: panelConfig.isVisible !== false,
                        enabled: true,
                        order: index
                    }
                });
                
                logMessage(`[DebugPanelManager] Added panel to debug state: ${panelConfig.id}`, 'debug');
            }
        });
    }

    loadPanels() {
        const debugPanels = panelRegistry.getAllPanels().filter(p => p.group === 'debug');
        const debugState = appStore.getState().debugPanel;

        debugPanels.forEach(panelConfig => {
            const sectionId = panelConfig.id;
            
            // Get panel state from the reducer
            const panelState = debugState.panels.find(p => p.id === sectionId);
            const isVisible = panelState?.visible !== false;
            const isCollapsed = debugState.collapsedSections.includes(sectionId);
            
            if (!isVisible) {
                // Don't render hidden panels
                return;
            }
            
            const sectionContainer = document.createElement('div');
            sectionContainer.classList.add('settings-section-container');
            sectionContainer.dataset.panelId = sectionId;
            
            const header = document.createElement('div');
            header.className = 'settings-section-header';
            
            // Use + / - indicator based on collapsed state
            const indicator = isCollapsed ? '+' : '-';
            header.innerHTML = `
                <span class="settings-section-title">${indicator} ${panelConfig.title}</span>
            `;
            
            // Single click toggles collapse state
            header.addEventListener('click', () => {
                this.toggleSectionCollapse(sectionId);
            });
            
            const content = document.createElement('div');
            content.className = 'settings-section-content';
            
            // Apply collapsed state to the container, not the content
            if (isCollapsed) {
                sectionContainer.classList.add('collapsed');
            }
            
            sectionContainer.appendChild(header);
            sectionContainer.appendChild(content);
            this.contentElement.appendChild(sectionContainer);
            
            const PanelComponent = panelConfig.component;
            if (PanelComponent) {
                this.sectionInstances[sectionId] = new PanelComponent(content);
            } else {
                console.error(`No component found for debug panel: ${sectionId}`);
            }
        });
    }
    
    toggleSectionCollapse(sectionId) {
        // Use the existing debug panel action to toggle collapse state
        dispatch({
            type: ActionTypes.DEBUG_PANEL_TOGGLE_SECTION,
            payload: { sectionId }
        });
        
        // Update the UI based on the NEW reducer state, not current DOM state
        const debugState = appStore.getState().debugPanel;
        const isCollapsed = debugState.collapsedSections.includes(sectionId);
        
        const container = document.querySelector(`[data-panel-id="${sectionId}"]`);
        if (container) {
            const titleElement = container.querySelector('.settings-section-title');
            
            if (titleElement) {
                // Apply the collapsed state from the reducer
                if (isCollapsed) {
                    container.classList.add('collapsed');
                } else {
                    container.classList.remove('collapsed');
                }
                
                // Update the indicator based on reducer state
                const indicator = isCollapsed ? '+' : '-';
                const titleText = titleElement.textContent.substring(2); // Remove old indicator
                titleElement.textContent = `${indicator} ${titleText}`;
            }
        }
        
        logMessage(`[DebugPanelManager] Toggled section ${sectionId} to ${isCollapsed ? 'collapsed' : 'expanded'}`, 'debug');
    }
    

    
    reopenSectionPanel(sectionId) {
        // Use the existing debug panel action to show the panel
        dispatch({
            type: ActionTypes.DEBUG_PANEL_SET_PANEL_VISIBILITY,
            payload: { panelId: sectionId, visible: true }
        });
        
        // Reload panels to show the reopened one
        this.contentElement.innerHTML = '';
        this.loadPanels();
        
        logMessage(`[DebugPanelManager] Reopened panel ${sectionId}`, 'debug');
    }
    

    
    toggleVisibility() {
        logMessage(`[DebugPanelManager] Toggling visibility. Currently visible: ${this.isVisible}`, 'debug');
        this.isVisible ? this.hide() : this.show();
    }
    
    show() {
        this.isVisible = true;
        this.panelElement.style.display = 'flex';
        this.bringToFront();
        this.savePersistedState(); // Save state to persist visibility
        logMessage(`[DebugPanelManager] Panel shown.`, 'debug');
        console.log('[DebugPanelManager] panelElement rect:', this.panelElement.getBoundingClientRect());
    }
    
    hide() {
        this.isVisible = false;
        this.panelElement.style.display = 'none';
        this.savePersistedState();
        logMessage(`[DebugPanelManager] Panel hidden.`, 'debug');
    }

    updatePanelVisibility() {
        if (this.panelElement) {
            this.panelElement.style.display = this.isVisible ? 'flex' : 'none';
            if (this.isVisible) {
                this.bringToFront();
            }
            logMessage(`[DebugPanelManager] Panel visibility updated to: ${this.isVisible}`, 'debug');
        }
    }

    startDrag(e) {
        if (e.target.tagName === 'BUTTON') return;
        this.isDragging = true;
        const rect = this.panelElement.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    doDrag(e) {
        if (!this.isDragging) return;
        this.currentPos.x = e.clientX - this.dragOffset.x;
        this.currentPos.y = e.clientY - this.dragOffset.y;
        this.panelElement.style.left = `${this.currentPos.x}px`;
        this.panelElement.style.top = `${this.currentPos.y}px`;
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.savePersistedState();
    }

    startResize(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: this.panelElement.offsetWidth,
            height: this.panelElement.offsetHeight
        };
    }

    doResize(e) {
        if (!this.isResizing) return;
        this.currentSize.width = Math.max(300, this.resizeStart.width + (e.clientX - this.resizeStart.x));
        this.currentSize.height = Math.max(200, this.resizeStart.height + (e.clientY - this.resizeStart.y));
        this.panelElement.style.width = `${this.currentSize.width}px`;
        this.panelElement.style.height = `${this.currentSize.height}px`;
    }

    endResize() {
        if (!this.isResizing) return;
        this.isResizing = false;
        this.savePersistedState();
    }

    registerWithZIndexManager() {
        if (this.panelElement && zIndexManager) {
            zIndexManager.register(this.panelElement, 'UI', 60, { name: 'Debug Panel' });
        }
    }

    bringToFront() {
        if (this.panelElement && zIndexManager) {
            zIndexManager.bringToFront(this.panelElement);
        }
    }

    savePersistedState() {
        // The debug panel state is now managed by the reducer
        // Update the main panel position, size, and visibility
        dispatch({
            type: ActionTypes.DEBUG_PANEL_SET_POSITION,
            payload: this.currentPos
        });
        
        dispatch({
            type: ActionTypes.DEBUG_PANEL_SET_SIZE,
            payload: this.currentSize
        });
        
        // Save the visibility state so it persists across sessions
        dispatch({
            type: ActionTypes.DEBUG_PANEL_TOGGLE,
            payload: this.isVisible
        });
    }

    loadPersistedState() {
        try {
            // Load state from the reducer
            const debugState = appStore.getState().debugPanel;
            this.currentPos = debugState.position || this.currentPos;
            this.currentSize = debugState.size || this.currentSize;
            // Properly handle boolean visibility state - use the stored value if it exists, otherwise default to false
            this.isVisible = debugState.visible !== undefined ? debugState.visible : false;
        } catch (e) {
            // Safe fallback for when logging system isn't ready during module loading
            if (typeof logMessage === 'function') {
                logMessage('Failed to load debug panel state', 'error');
            } else {
                console.error('[DebugPanelManager] Failed to load debug panel state:', e);
            }
        }
    }

    getClosedPanels() {
        const debugState = appStore.getState().debugPanel;
        return debugState.panels.filter(panel => !panel.visible).map(panel => panel.id);
    }
    
    getAllPanels() {
        const debugState = appStore.getState().debugPanel;
        return debugState.panels;
    }

    destroy() {
        if (this.panelElement) {
            this.panelElement.remove();
            this.panelElement = null;
        }
        // Destroy section instances
        Object.values(this.sectionInstances).forEach(instance => {
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
            }
        });
    }
}

export const debugPanelManager = new DebugPanelManager();

// Expose to window for global access from shortcuts or console
window.debugPanelManager = debugPanelManager;

// Add debug function to test panel functionality
window.testDebugPanel = function() {
    console.log('=== DEBUG PANEL TEST ===');
    
    // Test main panel
    console.log('Debug panel visible:', debugPanelManager.isVisible);
    console.log('Debug panel element:', debugPanelManager.panelElement);
    console.log('Close button element:', debugPanelManager.closeButton);
    
    // Test section instances
    console.log('Section instances:', debugPanelManager.sectionInstances);
    console.log('Available sections:', Object.keys(debugPanelManager.sectionInstances));
    
    // Test panel states (from reducer)
    console.log('All panels:', debugPanelManager.getAllPanels());
    console.log('Closed panels:', debugPanelManager.getClosedPanels());
    
    console.log('=== END DEBUG PANEL TEST ===');
};

// Add function to reopen closed panels
window.reopenDebugPanel = function(panelId) {
    if (panelId) {
        debugPanelManager.reopenSectionPanel(panelId);
        console.log(`Reopened panel: ${panelId}`);
    } else {
        console.log('Available closed panels:', debugPanelManager.getClosedPanels());
        console.log('Usage: reopenDebugPanel("panel-id")');
    }
};

// Debug panel manager is handled separately via keyboard shortcuts
// No need to register it as a panel since it's a standalone component 