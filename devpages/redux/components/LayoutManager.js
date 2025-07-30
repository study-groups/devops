/**
 * LayoutManager.js - Central authority for panel layout and positioning
 * 
 * Responsibilities:
 * - Atomic layout operations (no race conditions)
 * - Single source of truth for panel placement
 * - Clean state transitions via Redux
 * - Layout persistence and restoration
 */

import * as panelActions from '../slices/panelSlice.js';

export class LayoutManager {
    constructor(dispatch, getState) {
        this.dispatch = dispatch;
        this.getState = getState;
        
        // Layout operation queue to prevent race conditions
        this.operationQueue = [];
        this.isProcessing = false;
        
        this.log = (message, level = 'info') => 
            console.log(`[LayoutManager] ${message}`);
    }
    
    /**
     * Atomic operation: Move panel between layouts (flyout ↔ dock)
     */
    async movePanelToLayout(panelId, targetLayout, targetDockId = null) {
        const operation = {
            type: 'MOVE_PANEL',
            panelId,
            targetLayout, // 'flyout' | 'dock'
            targetDockId,
            timestamp: Date.now()
        };
        
        return this.enqueueOperation(operation);
    }
    
    /**
     * Atomic operation: Toggle panel between flyout and its home dock
     */
    async togglePanelLayout(panelId) {
        const state = this.getState();
        const panel = state.panels?.panels?.[panelId];
        
        if (!panel) {
            this.log(`Panel ${panelId} not found`, 'error');
            return false;
        }
        
        const currentLayout = panel.isFlyout ? 'flyout' : 'dock';
        const targetLayout = panel.isFlyout ? 'dock' : 'flyout';
        const targetDockId = panel.isFlyout ? panel.dockId : null;
        
        this.log(`🔄 Toggling ${panelId}: ${currentLayout} → ${targetLayout} ${targetDockId ? `(dock: ${targetDockId})` : ''}`);
        this.log(`   Current state: isFlyout=${panel.isFlyout}, isMounted=${panel.isMounted}, isVisible=${panel.isVisible}`);
        
        return this.movePanelToLayout(panelId, targetLayout, targetDockId);
    }
    
    /**
     * Queue system to ensure atomic operations
     */
    async enqueueOperation(operation) {
        return new Promise((resolve, reject) => {
            this.operationQueue.push({ ...operation, resolve, reject });
            this.processQueue();
        });
    }
    
    /**
     * Process layout operations atomically
     */
    async processQueue() {
        if (this.isProcessing || this.operationQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.operationQueue.length > 0) {
            const operation = this.operationQueue.shift();
            
            try {
                const result = await this.executeOperation(operation);
                operation.resolve(result);
            } catch (error) {
                this.log(`Operation failed: ${error.message}`, 'error');
                operation.reject(error);
            }
        }
        
        this.isProcessing = false;
    }
    
    /**
     * Execute a single layout operation atomically
     */
    async executeOperation(operation) {
        this.log(`Executing ${operation.type} for ${operation.panelId}`);
        
        switch (operation.type) {
            case 'MOVE_PANEL':
                return this.executeMovePanel(operation);
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }
    
    /**
     * Execute panel move operation with proper state coordination
     */
    async executeMovePanel({ panelId, targetLayout, targetDockId }) {
        const state = this.getState();
        const panel = state.panels?.panels?.[panelId];
        
        if (!panel) {
            throw new Error(`Panel ${panelId} not found`);
        }
        
        // Step 1: Update panel layout state in Redux (atomic)
        this.dispatch(panelActions.updatePanelLayout({
            panelId,
            isFlyout: targetLayout === 'flyout',
            targetDockId: targetDockId || panel.dockId
        }));
        
        this.log(`Moved ${panelId} to ${targetLayout} layout${targetDockId ? ` in dock ${targetDockId}` : ''}`);
        
        // Step 2: Trigger mounting in new layout
        setTimeout(() => {
            this.dispatch(panelActions.mountPanel({
                panelId,
                dockId: targetDockId || panel.dockId,
                containerId: targetLayout === 'flyout' ? 'flyout-body' : `container-${panelId}`
            }));
            this.log(`Dispatched mount action for ${panelId} in ${targetLayout} layout`);
        }, 100);
        
        return {
            panelId,
            targetLayout,
            targetDockId,
            success: true
        };
    }
    
    /**
     * Get current layout state for a panel
     */
    getPanelLayout(panelId) {
        const state = this.getState();
        const panel = state.panels?.panels?.[panelId];
        
        if (!panel) return null;
        
        return {
            panelId,
            layout: panel.isFlyout ? 'flyout' : 'dock',
            homeDockId: panel.dockId,
            currentDockId: panel.mountedDockId,
            isHome: !panel.isFlyout && panel.mountedDockId === panel.dockId,
            position: panel.isFlyout ? panel.flyoutPosition : panel.position,
            size: panel.isFlyout ? panel.flyoutSize : panel.size
        };
    }
    
    /**
     * Get all panels in a specific layout
     */
    getPanelsInLayout(layout) {
        const state = this.getState();
        const panels = state.panels?.panels || {};
        
        return Object.values(panels).filter(panel => {
            const panelLayout = panel.isFlyout ? 'flyout' : 'dock';
            return panelLayout === layout && panel.isVisible;
        });
    }
    
    /**
     * Validate layout consistency
     */
    validateLayout() {
        const state = this.getState();
        const panels = state.panels?.panels || {};
        const docks = state.panels?.docks || {};
        
        const issues = [];
        
        Object.values(panels).forEach(panel => {
            // Check if panel's home dock exists
            if (!docks[panel.dockId]) {
                issues.push(`Panel ${panel.id} references non-existent dock ${panel.dockId}`);
            }
            
            // Check if mounted dock exists
            if (panel.mountedDockId && !docks[panel.mountedDockId]) {
                issues.push(`Panel ${panel.id} mounted to non-existent dock ${panel.mountedDockId}`);
            }
            
            // Check layout consistency
            if (panel.isFlyout && panel.mountedDockId) {
                issues.push(`Panel ${panel.id} is flyout but has mountedDockId ${panel.mountedDockId}`);
            }
        });
        
        if (issues.length > 0) {
            this.log('Layout validation issues found:', 'warn');
            issues.forEach(issue => this.log(`  - ${issue}`, 'warn'));
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
    
    /**
     * Emergency layout reset
     */
    resetLayout() {
        this.log('Performing emergency layout reset');
        
        const state = this.getState();
        const panels = state.panels?.panels || {};
        
        // Reset all panels to their home docks
        Object.keys(panels).forEach(panelId => {
            this.dispatch(panelActions.resetPanelToHome({ panelId }));
        });
        
        // Clear operation queue
        this.operationQueue = [];
        this.isProcessing = false;
        
        this.log('Layout reset complete');
    }
} 