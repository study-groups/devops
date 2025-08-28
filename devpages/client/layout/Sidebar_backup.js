/**
 * Sidebar.js - Simple, working sidebar component
 * Restored and simplified from the original working system
 */

import { appStore } from '/client/appState.js';
import { selectDocks } from '/client/store/slices/panelSlice.js';
import { SidebarHeader } from './SidebarHeader.js';
import { BaseDock } from './docks/BaseDock.js';

export class Sidebar {
    constructor() {
        this.container = null;
        this.sidebarHeader = new SidebarHeader();
        this.docks = new Map();
        this.docksInitialized = false;
        
        this.initialize();
    }
    
    async initialize() {
        // Expose global API
        this.exposeAPI();
        console.log('[Sidebar] Sidebar initialized');
    }
    
    subscribeToStore() {
        let currentState = selectDocks(appStore.getState());

        appStore.subscribe(() => {
            const previousState = currentState;
            currentState = selectDocks(appStore.getState());

            // Deep compare to avoid unnecessary re-renders
            if (JSON.stringify(previousState) !== JSON.stringify(currentState)) {
                console.log('[Sidebar] State changed, re-rendering docks.');
                this.renderDocks();
            }
        });
    }

    /**
     * Render the complete sidebar layout
     */
    render(container) {
        if (container) {
            this.container = container;
        }
        
        if (!this.container) {
            console.warn('[Sidebar] No container provided for rendering');
            return;
        }

        // Subscribe to store ONLY when rendering
        if (!this.storeUnsubscribe) {
            this.subscribeToStore();
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
        } else if (docksContainer) {
            this.renderDocks(docksContainer);
        }
        
        console.log('[Sidebar] Sidebar layout rendered');
    }
    
    renderSidebarHeader() {
        const headerContainer = this.container.querySelector('.sidebar-header-container');
        if (headerContainer) {
            this.sidebarHeader.render(headerContainer);
        }
    }

    renderDocks(container) {
        const docksContainer = container || this.container.querySelector('.sidebar-docks-container');
        if (!docksContainer) return;

        // Simple re-render logic for now
        docksContainer.innerHTML = '';
        this.docks.clear();
        this.docksInitialized = false;
        this.initializeDocks(docksContainer);
    }
    
    async initializeDocks(docksContainer) {
        if (this.docksInitialized) return;

        const docksFromState = selectDocks(appStore.getState());

        for (const dockId in docksFromState) {
            const dockState = docksFromState[dockId];
            // Only render docks EXPLICITLY intended for the sidebar
            if (dockState && dockState.zone === 'sidebar') {
                try {
                    const dock = new BaseDock(dockId);
                    this.docks.set(dockId, dock);
                    
                    const dockContainer = document.createElement('div');
                    dockContainer.className = 'sidebar-dock-container';
                    dockContainer.id = `${dockId}-container`;
                    docksContainer.appendChild(dockContainer);
                    
                    await dock.initialize(dockContainer);
                    
                    console.log(`[Sidebar] Initialized dock: ${dockId}`);
                    
                } catch (error) {
                    console.error(`[Sidebar] Failed to initialize dock ${dockId}:`, error);
                }
            }
        }
        
        this.docksInitialized = true;
        console.log(`[Sidebar] All docks initialized`);
    }
    
    /**
     * Get dock instance by ID
     */
    getDock(dockId) {
        return this.docks.get(dockId) || null;
    }
    
    addStyles() {
        if (document.querySelector('style[data-sidebar-styles]')) return;
        
        const style = document.createElement('style');
        style.setAttribute('data-sidebar-styles', 'true');
        style.textContent = `
            .sidebar-layout { 
                display: flex; 
                flex-direction: column; 
                height: 100%; 
                background: var(--color-bg-alt, #f8f9fa); 
            }
            .sidebar-header-container { 
                flex-shrink: 0; 
                border-bottom: 1px solid var(--color-border, #e1e5e9); 
            }
            .sidebar-docks-container { 
                flex: 1; 
                overflow-y: auto; 
                overflow-x: hidden;
                padding: 8px;
                max-height: calc(100vh - 60px);
            }
            .sidebar-dock-container:last-child { 
                border-bottom: none; 
            }
            .workspace-sidebar[data-visible="false"] .sidebar-layout { 
                display: none; 
            }
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
        
        console.log('[Sidebar] Sidebar destroyed');
    }
    
    /**
     * Expose Sidebar API to window.APP
     */
    exposeAPI() {
        if (typeof window === 'undefined') return;
        
        window.APP = window.APP || {};
        window.APP.sidebar = {
            getDock: (dockId) => this.getDock(dockId),
            getSystemInfo: () => ({
                architecture: 'SIMPLE_SIDEBAR_DOCK_MANAGER',
                version: '1.0',
                totalDocks: this.docks.size,
                docksInitialized: this.docksInitialized,
            }),
        };
        
        console.log('[Sidebar] API exposed at window.APP.sidebar');
    }
}