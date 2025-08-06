/**
 * client/layout/Sidebar.js 
 * SIDEBAR = DOCK MANAGER
 * 
 * Clear Chain of Command:
 * - Sidebar manages docks (loads, renders, coordinates docks)
 * - Docks manage panels (each dock handles its own panels)
 * - Panels manage content (just render their specific content)
 * 
 * Sidebar responsibilities:
 * - Load and initialize docks from dock registry
 * - Provide dock coordination and communication
 * - Render SidebarHeader (CLI interface)
 * - Expose dock management API
 */

import { appStore, dispatch } from '/client/appState.js';
import { panelActions, selectDocks } from '/client/store/slices/panelSlice.js';
import { SidebarHeader } from './SidebarHeader.js';
import { SettingsDock } from './docks/SettingsDock.js';
import { LogsDock } from './docks/LogsDock.js';
import { panelRegistry } from '../panels/panelRegistry.js';
import { logMessage } from '/client/log/index.js';

export class Sidebar {
    constructor() {
        this.container = null;
        this.sidebarHeader = new SidebarHeader();
        this.docks = new Map();
        this.docksInitialized = false;
        
        this.initialize();
    }
    
    async initialize() {
        // SIMPLIFIED: No store subscription to prevent render loops
        // Sidebar renders on-demand when explicitly called
        
        // Expose global API
        this.exposeAPI();
        
        logMessage('INFO', 'SIDEBAR_INIT', '🏗️ Sidebar dock manager initialized');
    }
    
    // REMOVED: subscribeToStore - caused infinite render loops
    // Sidebar now renders only on explicit calls (no reactive updates)
    
    // REMOVED: scheduleRender - no longer needed without store subscription
    
    // REMOVED: ensurePanelsRegistered - this is now the responsibility of each dock
    // Following the chain of command: Sidebar manages docks, docks manage panels
    
    /**
     * Render the complete sidebar layout
     * @param {HTMLElement} container - The workspace-sidebar element
     */
    render(container) {
        if (container) {
            this.container = container;
        }
        
        if (!this.container) {
            console.warn('[Sidebar] No container provided for rendering');
            return;
        }

        // Only create the initial DOM structure ONCE
        if (!this.container.querySelector('.sidebar-layout')) {
            this.container.innerHTML = `
                <div class="sidebar-layout">
                    <div class="sidebar-header-container"></div>
                    <div class="sidebar-docks-container"></div>
                </div>
            `;
            
            // Render header and add styles ONCE
            this.renderSidebarHeader();
            this.addStyles();
        }
        
        // Initialize docks ONCE
        const docksContainer = this.container.querySelector('.sidebar-docks-container');
        if (docksContainer && !this.docksInitialized) {
            this.initializeDocks(docksContainer).catch(error => {
                console.error('[Sidebar] Failed to initialize docks:', error);
            });
        }
        
        // Subsequent renders can update docks if needed (e.g., from Redux state)
        for (const dock of this.docks.values()) {
            if (typeof dock.update === 'function') {
                dock.update();
            }
        }
        
        logMessage('INFO', 'SIDEBAR_RENDER', '✅ Sidebar layout rendered');
    }
    
    renderSidebarHeader() {
        const headerContainer = this.container.querySelector('.sidebar-header-container');
        if (headerContainer) {
            this.sidebarHeader.render(headerContainer);
        }
    }
    
    async initializeDocks(docksContainer) {
        if (this.docksInitialized) return;

        const dockClasses = {
            'settings-dock': SettingsDock,
            'logs-dock': LogsDock,
        };

        const docksFromState = selectDocks(appStore.getState());

        for (const dockId in docksFromState) {
            if (dockClasses[dockId]) {
                try {
                    const dock = new dockClasses[dockId]();
                    this.docks.set(dockId, dock);
                    
                    const dockContainer = document.createElement('div');
                    dockContainer.className = 'sidebar-dock-container';
                    dockContainer.id = `${dockId}-container`;
                    docksContainer.appendChild(dockContainer);
                    
                    if (typeof dock.mount === 'function') {
                        await dock.mount(dockContainer);
                    } else {
                        if (typeof dock.initialize === 'function') dock.initialize();
                        if (typeof dock.render === 'function') dock.render(dockContainer);
                    }
                    
                    logMessage('INFO', 'DOCK_INIT', `✅ Initialized dock: ${dockId}`);
                    
                } catch (error) {
                    console.error(`[Sidebar] Failed to initialize dock ${dockId}:`, error);
                    logMessage('ERROR', 'DOCK_INIT_FAILED', `❌ Failed to initialize dock: ${dockId}`, error);
                }
            }
        }
        
        this.docksInitialized = true;
        logMessage('INFO', 'DOCKS_INIT', `✅ All ${this.docks.size} docks initialized`);
    }
    
    /**
     * Get dock instance by ID
     * @param {string} dockId - The dock ID
     * @returns {BaseDock|null} The dock instance or null if not found
     */
    getDock(dockId) {
        return this.docks.get(dockId) || null;
    }
    
    /**
     * Toggle dock visibility
     * @param {string} dockId - The dock ID to toggle
     */
    toggleDock(dockId) {
        const dock = this.getDock(dockId);
        if (dock && typeof dock.toggleVisibility === 'function') {
            dock.toggleVisibility();
            logMessage('INFO', 'DOCK_TOGGLE', `🔄 Toggled dock: ${dockId}`);
        } else {
            console.warn(`[Sidebar] Dock not found or has no toggle method: ${dockId}`);
        }
    }
    
    /**
     * Get current sidebar state for debugging
     * @returns {Object} Current sidebar state
     */
    getState() {
        const state = appStore.getState();
        return {
            visible: state.ui?.leftSidebarVisible !== false,
            docks: Array.from(this.docks.keys()),
            docksInitialized: this.docksInitialized,
            activeDocks: Array.from(this.docks.entries())
                .filter(([, dock]) => dock.isExpanded && dock.isExpanded())
                .map(([id]) => id)
        };
    }
    
    addStyles() {
        if (document.querySelector('style[data-sidebar-styles]')) return;
        
        const style = document.createElement('style');
        style.setAttribute('data-sidebar-styles', 'true');
        style.textContent = `
            .sidebar-layout { display: flex; flex-direction: column; height: 100%; background: var(--color-bg-alt, #2a2a2a); }
            .sidebar-header-container { flex-shrink: 0; border-bottom: 1px solid var(--color-border, #444); }
            .sidebar-docks-container { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--color-border, #444) transparent; }
            .sidebar-docks-container::-webkit-scrollbar { width: 6px; }
            .sidebar-docks-container::-webkit-scrollbar-track { background: transparent; }
            .sidebar-docks-container::-webkit-scrollbar-thumb { background: var(--color-border, #444); border-radius: 3px; }
            .sidebar-dock-container:last-child { border-bottom: none; }
            .workspace-sidebar[data-visible="false"] .sidebar-layout { display: none; }
            @media (max-width: 768px) { .sidebar-layout { min-width: 280px; } }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Cleanup method
     */
    destroy() {
        if (this.storeUnsubscribe) this.storeUnsubscribe();
        
        for (const dock of this.docks.values()) {
            if (dock?.destroy) dock.destroy();
        }
        this.docks.clear();
        
        if (this.sidebarHeader?.destroy) this.sidebarHeader.destroy();
        
        if (this.container) this.container.innerHTML = '';
        
        logMessage('INFO', 'SIDEBAR_DESTROY', '🧹 Sidebar manager destroyed');
    }
    
    /**
     * Expose Sidebar API to window.APP
     */
    exposeAPI() {
        if (typeof window === 'undefined') return;
        
        window.APP = window.APP || {};
        window.APP.sidebar = {
            // PRIMARY: Dock Management (Sidebar's main responsibility)
            toggle: () => {
                window.APP?.services?.workspaceManager?.toggleSidebar();
            },
            getDock: (dockId) => this.getDock(dockId),
            toggleDock: (dockId) => this.toggleDock(dockId),
            getState: () => this.getState(),
            
            // DELEGATION: Panel Management (delegated to appropriate dock)
            getPanel: (panelId) => {
                for (const dock of this.docks.values()) {
                    if (dock.getPanelInstance?.(panelId)) return dock.getPanelInstance(panelId);
                }
                return null;
            },
            togglePanel: (panelId) => {
                for (const dock of this.docks.values()) {
                    if (dock.hasPanel?.(panelId)) return dock.togglePanel(panelId);
                }
                return false;
            },
            
            // System Information
            getSystemInfo: () => ({
                architecture: 'SIDEBAR_DOCK_MANAGER',
                version: '2.1',
                chainOfCommand: ['Sidebar manages docks', 'Docks manage panels', 'Panels manage content'],
                totalDocks: this.docks.size,
                docksInitialized: this.docksInitialized,
            }),
            
            // Debug and Development
            listDocks: () => {
                console.table(Array.from(this.docks.entries()).map(([id, dock]) => ({
                    dockId: id,
                    title: dock.title,
                    isExpanded: dock.isExpanded ? dock.isExpanded() : 'N/A',
                    panelCount: dock.panelInstances?.size || 0
                })));
            },
            listPanels: () => {
                console.table(Array.from(panelRegistry.getPanels()));
            }
        };
        
        logMessage('INFO', 'SIDEBAR_API', '🌐 Sidebar API exposed globally at window.APP.sidebar');
    }
}
