/**
 * WorkspaceController.js - Defensive Controller for Data-Driven Workspace
 * Replaces the confusion between zones and panels with clear separation
 */

import { 
    WORKSPACE_ZONES, 
    PANEL_DEFINITIONS, 
    getZoneConfig, 
    getPanelConfig,
    getPanelsForZone,
    initializeWorkspaceConfig 
} from './workspaceConfig.js';
import { appStore } from '../appState.js';

export class WorkspaceController {
    constructor() {
        this.zones = new Map(); // Fixed workspace zones
        this.panels = new Map(); // Draggable panels within zones
        this.initialized = false;
        
        // DEFENSIVE: Validate configuration on construction
        this.validateConfiguration();
    }
    
    // DEFENSIVE: Configuration validation
    validateConfiguration() {
        try {
            initializeWorkspaceConfig();
        } catch (error) {
            console.error('[WorkspaceController] Configuration validation failed:', error);
            throw new Error('Cannot initialize WorkspaceController with invalid configuration');
        }
    }
    
    // DEFENSIVE: Safe initialization
    async initialize() {
        if (this.initialized) {
            console.warn('[WorkspaceController] Already initialized, skipping');
            return;
        }
        
        try {
            await this.initializeZones();
            await this.initializePanels();
            this.setupEventListeners();
            this.initialized = true;
            console.log('✅ WorkspaceController initialized successfully');
        } catch (error) {
            console.error('[WorkspaceController] Initialization failed:', error);
            throw error;
        }
    }
    
    // DATA-DRIVEN: Initialize fixed workspace zones
    async initializeZones() {
        console.log('[WorkspaceController] Initializing workspace zones...');
        
        for (const [zoneId, zoneConfig] of Object.entries(WORKSPACE_ZONES)) {
            try {
                const container = document.getElementById(zoneConfig.container);
                
                // DEFENSIVE: Check container exists
                if (!container) {
                    console.error(`[WorkspaceController] Zone container not found: ${zoneConfig.container}`);
                    continue;
                }
                
                // Create zone controller
                const zone = new WorkspaceZone(zoneConfig, container);
                await zone.initialize();
                
                this.zones.set(zoneId, zone);
                console.log(`✅ Zone initialized: ${zoneId}`);
                
            } catch (error) {
                console.error(`[WorkspaceController] Failed to initialize zone ${zoneId}:`, error);
            }
        }
    }
    
    // DATA-DRIVEN: Initialize draggable panels  
    async initializePanels() {
        console.log('[WorkspaceController] Initializing panels...');
        
        for (const [panelId, panelConfig] of Object.entries(PANEL_DEFINITIONS)) {
            try {
                // DEFENSIVE: Validate target zone exists
                const targetZone = this.zones.get(panelConfig.targetZone);
                if (!targetZone) {
                    console.error(`[WorkspaceController] Target zone not found for panel ${panelId}: ${panelConfig.targetZone}`);
                    continue;
                }
                
                // Create panel
                const panel = new WorkspacePanel(panelConfig, targetZone);
                await panel.initialize();
                
                this.panels.set(panelId, panel);
                console.log(`✅ Panel initialized: ${panelId} → ${panelConfig.targetZone}`);
                
            } catch (error) {
                console.error(`[WorkspaceController] Failed to initialize panel ${panelId}:`, error);
            }
        }
    }
    
    // DEFENSIVE: Safe zone access
    getZone(zoneId) {
        const zone = this.zones.get(zoneId);
        if (!zone) {
            console.warn(`[WorkspaceController] Zone not found: ${zoneId}`);
            return null;
        }
        return zone;
    }
    
    // DEFENSIVE: Safe panel access
    getPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            console.warn(`[WorkspaceController] Panel not found: ${panelId}`);
            return null;
        }
        return panel;
    }
    
    // DATA-DRIVEN: Toggle zone visibility
    toggleZone(zoneId) {
        const zone = this.getZone(zoneId);
        if (!zone) return false;
        
        try {
            zone.toggle();
            console.log(`[WorkspaceController] Toggled zone: ${zoneId}`);
            return true;
        } catch (error) {
            console.error(`[WorkspaceController] Failed to toggle zone ${zoneId}:`, error);
            return false;
        }
    }
    
    // DATA-DRIVEN: Toggle panel visibility
    togglePanel(panelId) {
        const panel = this.getPanel(panelId);
        if (!panel) return false;
        
        try {
            panel.toggle();
            console.log(`[WorkspaceController] Toggled panel: ${panelId}`);
            return true;
        } catch (error) {
            console.error(`[WorkspaceController] Failed to toggle panel ${panelId}:`, error);
            return false;
        }
    }
    
    // DEFENSIVE: Get zone status
    getZoneStatus(zoneId) {
        const zone = this.getZone(zoneId);
        return zone ? zone.getStatus() : null;
    }
    
    // DEFENSIVE: Get panel status
    getPanelStatus(panelId) {
        const panel = this.getPanel(panelId);
        return panel ? panel.getStatus() : null;
    }
    
    // Setup event listeners for workspace interactions
    setupEventListeners() {
        // Listen for Redux state changes if needed
        if (appStore) {
            this.unsubscribe = appStore.subscribe(() => {
                this.syncWithState();
            });
        }
    }
    
    // DEFENSIVE: Sync with external state changes
    syncWithState() {
        try {
            // Update panels based on state changes
            this.panels.forEach((panel, panelId) => {
                panel.syncWithState();
            });
        } catch (error) {
            console.error('[WorkspaceController] State sync failed:', error);
        }
    }
    
    // DEFENSIVE: Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        
        this.panels.forEach(panel => panel.destroy());
        this.zones.forEach(zone => zone.destroy());
        
        this.panels.clear();
        this.zones.clear();
        this.initialized = false;
        
        console.log('[WorkspaceController] Destroyed');
    }
}

// Fixed Workspace Zone (not a panel!)
class WorkspaceZone {
    constructor(config, container) {
        this.config = config;
        this.container = container;
        this.visible = true;
        this.panels = [];
    }
    
    async initialize() {
        // Set up zone-specific behavior
        this.container.classList.add('workspace-zone', `zone-${this.config.id}`);
        
        // Apply default sizing
        if (this.config.defaultWidth !== 'flex') {
            this.container.style.width = `${this.config.defaultWidth}px`;
        }
    }
    
    toggle() {
        if (!this.config.collapsible) {
            console.warn(`[WorkspaceZone] Zone ${this.config.id} is not collapsible`);
            return;
        }
        
        this.visible = !this.visible;
        this.container.style.display = this.visible ? '' : 'none';
    }
    
    addPanel(panel) {
        this.panels.push(panel);
    }
    
    removePanel(panel) {
        const index = this.panels.indexOf(panel);
        if (index > -1) {
            this.panels.splice(index, 1);
        }
    }
    
    getStatus() {
        return {
            id: this.config.id,
            visible: this.visible,
            panelCount: this.panels.length,
            type: 'ZONE'
        };
    }
    
    destroy() {
        this.panels.forEach(panel => panel.destroy());
        this.panels = [];
    }
}

// Draggable Panel (actual panel!)
class WorkspacePanel {
    constructor(config, targetZone) {
        this.config = config;
        this.targetZone = targetZone;
        this.element = null;
        this.instance = null;
        this.visible = config.defaultVisible;
    }
    
    async initialize() {
        try {
            // Load panel component
            const PanelClass = await this.config.factory();
            
            // Create panel instance
            this.instance = new PanelClass({
                id: this.config.id,
                store: appStore
            });
            
            // Render panel
            this.element = this.instance.render();
            this.element.id = this.config.id;
            this.element.classList.add('workspace-panel', `panel-${this.config.id}`);
            
            // Add to target zone
            this.targetZone.container.appendChild(this.element);
            this.targetZone.addPanel(this);
            
            // Apply visibility
            this.element.style.display = this.visible ? '' : 'none';
            
            if (this.instance.onMount) {
                this.instance.onMount(this.targetZone.container);
            }
            
        } catch (error) {
            console.error(`[WorkspacePanel] Failed to initialize ${this.config.id}:`, error);
            throw error;
        }
    }
    
    toggle() {
        if (!this.config.collapsible) {
            console.warn(`[WorkspacePanel] Panel ${this.config.id} is not collapsible`);
            return;
        }
        
        this.visible = !this.visible;
        if (this.element) {
            this.element.style.display = this.visible ? '' : 'none';
        }
    }
    
    syncWithState() {
        // Sync with external state if needed
    }
    
    getStatus() {
        return {
            id: this.config.id,
            visible: this.visible,
            zone: this.targetZone.config.id,
            type: 'PANEL'
        };
    }
    
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        if (this.targetZone) {
            this.targetZone.removePanel(this);
        }
        
        if (this.instance && this.instance.destroy) {
            this.instance.destroy();
        }
    }
}

// Export singleton instance
export const workspaceController = new WorkspaceController();