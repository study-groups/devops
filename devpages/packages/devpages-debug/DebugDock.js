import { panelRegistry } from '/client/panels/panelRegistry.js';
import { appStore, dispatch } from '/client/appState.js';
import { 
    toggleVisibility, 
    togglePanelExpanded, 
    reorderPanels, 
    updateDockPosition,
    updateDockSize 
} from '/client/store/slices/debugPanelSlice.js';

// No longer importing panels directly, they will be passed in

// Inject debug dock styles
function injectDebugDockStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .debug-dock-container {
            position: fixed;
            top: 100px;
            right: 20px;
            width: 400px;
            max-height: 80vh;
            background: var(--color-background, white);
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10000;
            display: none;
            /* Complete isolation */
            contain: layout style size;
            transform: translateZ(0);
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        .debug-dock-container.visible {
            display: flex;
            flex-direction: column;
        }
        
        .debug-dock-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: var(--color-background-secondary, #f8f9fa);
            border-bottom: 1px solid var(--color-border, #e1e5e9);
            border-radius: 8px 8px 0 0;
            cursor: move;
            user-select: none;
        }
        
        .debug-dock-title {
            font-weight: 600;
            font-size: 14px;
            color: var(--color-foreground, #333);
        }
        
        .debug-dock-controls {
            display: flex;
            gap: 4px;
        }
        
        .debug-dock-btn {
            width: 20px;
            height: 20px;
            border: none;
            background: none;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: var(--color-foreground-muted, #666);
        }
        
        .debug-dock-btn:hover {
            background: var(--color-background-hover, #e9ecef);
        }
        
        .debug-dock-content {
            flex: 1;
            overflow-y: auto;
            max-height: calc(80vh - 50px);
        }
        
        .debug-panel {
            border-bottom: 1px solid var(--color-border, #e1e5e9);
        }
        
        .debug-panel:last-child {
            border-bottom: none;
        }
        
        .debug-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: var(--color-background, white);
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid var(--color-border-light, #f0f0f0);
        }
        
        .debug-panel-header:hover {
            background: var(--color-background-hover, #f8f9fa);
        }
        
        .debug-panel-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--color-foreground, #333);
        }
        
        .debug-panel-toggle {
            font-size: 12px;
            color: var(--color-foreground-muted, #666);
            transition: transform 0.2s ease;
        }
        
        .debug-panel.expanded .debug-panel-toggle {
            transform: rotate(90deg);
        }
        
        .debug-panel-content {
            display: none;
            padding: 12px;
            background: var(--color-background, white);
            font-size: 12px;
            line-height: 1.4;
        }
        
        .debug-panel.expanded .debug-panel-content {
            display: block;
        }
        
        /* Dragging states */
        .debug-dock-container.dragging {
            opacity: 0.9;
            z-index: 10001;
        }
        
        .debug-panel.dragging {
            opacity: 0.5;
        }
        
        .debug-panel.drag-over {
            border-top: 2px solid var(--color-primary, #007bff);
        }
    `;
    document.head.appendChild(styleElement);
}

export const debugDock = {
    isVisible: false,
    container: null,
    panels: [],
    dragState: { isDragging: false, draggedPanel: null, startY: 0 },

    initialize: function(panelCfgs) {
        // Create container if not exists
        if (!this.container) {
            this.createContainer();
        }

        // Inject styles
        injectDebugDockStyles();

        // Load panels passed from workspace manager
        this.panels = panelCfgs || [];

        // Setup drag and drop
        this.setupDragAndDrop();

        // Sync with Redux state on initialization
        this.syncWithReduxState();
        
        return this;
    },

    createContainer: function() {
        this.container = document.createElement('div');
        this.container.id = 'debug-dock-container';
        this.container.className = 'debug-dock-container';
        
        // Restore position from Redux state
        const state = appStore.getState();
        const debugState = state.debugPanel;
        console.log('[DebugDock] Loading state from Redux:', debugState);
        
        if (debugState && debugState.position) {
            console.log('[DebugDock] Restoring position:', debugState.position);
            this.container.style.left = `${debugState.position.x}px`;
            this.container.style.top = `${debugState.position.y}px`;
            this.container.style.right = 'auto';
        } else {
            console.log('[DebugDock] No saved position found, using default position');
            // Set default position
            this.container.style.left = '100px';
            this.container.style.top = '100px';
            this.container.style.right = 'auto';
        }
        
        // Restore size from Redux state
        if (debugState && debugState.size) {
            console.log('[DebugDock] Restoring size:', debugState.size);
            this.container.style.width = `${debugState.size.width}px`;
            this.container.style.maxHeight = `${debugState.size.height}px`;
        }
        
        // Create header
        const header = document.createElement('div');
        header.className = 'debug-dock-header';
        header.innerHTML = `
            <div class="debug-dock-title">Debug Dock</div>
            <div class="debug-dock-controls">
                <button class="debug-dock-btn" data-action="close">×</button>
            </div>
        `;
        
        // Create content area
        const content = document.createElement('div');
        content.className = 'debug-dock-content';
        
        this.container.appendChild(header);
        this.container.appendChild(content);
        document.body.appendChild(this.container);

        // Setup header drag
        this.setupDockDrag(header);
        
        // Setup close button
        header.querySelector('[data-action="close"]').addEventListener('click', () => {
            this.toggle();
        });
    },

    setupDockDrag: function(header) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = this.container.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            this.container.classList.add('dragging');
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            this.container.style.left = `${startLeft + deltaX}px`;
            this.container.style.top = `${startTop + deltaY}px`;
            this.container.style.right = 'auto';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.container.classList.remove('dragging');
                
                // Save final position to Redux
                const rect = this.container.getBoundingClientRect();
                const position = { x: rect.left, y: rect.top };
                console.log('[DebugDock] Saving position to Redux:', position);
                dispatch(updateDockPosition(position));
                
                // Verify it was saved
                setTimeout(() => {
                    const state = appStore.getState();
                    console.log('[DebugDock] Position saved in Redux:', state.debugPanel.position);
                }, 100);
            }
        });
    },

    setupDragAndDrop: function() {
        // Panel drag and drop will be implemented in render method
    },

    // Sync local state with Redux state
    syncWithReduxState: function() {
        if (appStore) {
            const state = appStore.getState();
            const debugPanelState = state.debugPanel;
            
            console.log('[DebugDock] Syncing with Redux state:', debugPanelState);
            
            if (debugPanelState) {
                this.isVisible = debugPanelState.visible || false;
                
                console.log(`[DebugDock] Setting visibility to: ${this.isVisible}`);
                
                // Update UI to match Redux state
                if (this.isVisible) {
                    this.render(); // Render panels with their saved states
                    this.container.classList.add('visible');
                    this.container.style.display = 'flex';
                    console.log('[DebugDock] Dock shown and rendered');
                } else {
                    this.container.classList.remove('visible');
                    this.container.style.display = 'none';
                    console.log('[DebugDock] Dock hidden');
                }
                
                console.log(`[DebugDock] Synced with Redux state - visible: ${this.isVisible}`);
            }
        }
    },

    toggle: function() {
        // Use Redux state for persistence
        if (appStore) {
            // Dispatch the toggleVisibility action to Redux
            dispatch(toggleVisibility());
            
            // Get the updated state
            const state = appStore.getState();
            const isVisible = state.debugPanel?.visible || false;
            
            // Update the UI based on Redux state
            if (isVisible) {
                this.render();
                this.container.classList.add('visible');
                this.container.style.display = 'flex';
            } else {
                this.container.classList.remove('visible');
                this.container.style.display = 'none';
            }
            
            // Update local state to match Redux (for compatibility)
            this.isVisible = isVisible;
        } else {
            // Fallback to original logic if Redux is not available
            this.isVisible = !this.isVisible;

            if (this.isVisible) {
                this.render();
                this.container.classList.add('visible');
                this.container.style.display = 'flex';
            } else {
                this.container.classList.remove('visible');
                this.container.style.display = 'none';
            }
        }

        return this;
    },



    render: function() {
        const content = this.container.querySelector('.debug-dock-content');
        if (!content) return;

        // Clear previous content
        content.innerHTML = '';

        // Get panels from Redux state, sorted by order
        const state = appStore.getState();
        const debugState = state.debugPanel;
        const panels = debugState.panels ? [...debugState.panels].sort((a, b) => a.order - b.order) : [];

        panels.forEach((panelState, index) => {
            // Find the corresponding panel config from the initialized list
            const panelConfig = this.panels.find(p => p.id === panelState.id);
            if (panelConfig && panelState.visible) {
                const panelElement = this.createCollapsiblePanel(panelConfig, panelState, index);
                content.appendChild(panelElement);
            }
        });
    },

    createCollapsiblePanel: function(panelConfig, panelState, index) {
        const panel = document.createElement('div');
        panel.className = 'debug-panel';
        panel.dataset.panelId = panelConfig.id;
        panel.dataset.index = index;

        // Set expanded state from Redux
        if (panelState.expanded) {
            panel.classList.add('expanded');
        }

        // Create panel header
        const header = document.createElement('div');
        header.className = 'debug-panel-header';
        header.innerHTML = `
            <div class="debug-panel-title">${panelConfig.title}</div>
            <div class="debug-panel-toggle">${panelState.expanded ? '▼' : '▶'}</div>
        `;

        // Create panel content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'debug-panel-content';

        // Load content if already expanded
        if (panelState.expanded) {
            this.loadPanelContent(panelConfig, contentContainer);
        }

        // Add click handler for expand/collapse
        header.addEventListener('click', (e) => {
            // Don't trigger if clicking on drag area
            if (e.target.classList.contains('debug-panel-toggle')) {
                e.stopPropagation();
            }
            
            // Toggle expanded state in Redux
            dispatch(togglePanelExpanded(panelConfig.id));
            
            // Update UI
            panel.classList.toggle('expanded');
            const toggle = header.querySelector('.debug-panel-toggle');
            toggle.textContent = panel.classList.contains('expanded') ? '▼' : '▶';
            
            // Lazy load content when first expanded
            if (panel.classList.contains('expanded') && !contentContainer.hasChildNodes()) {
                this.loadPanelContent(panelConfig, contentContainer);
            }
        });

        // Setup drag handle for reordering
        this.setupPanelDrag(panel, header, index);

        panel.appendChild(header);
        panel.appendChild(contentContainer);

        return panel;
    },

    async loadPanelContent(panelConfig, container) {
        try {
            if (!panelConfig.factory) {
                throw new Error(`Panel ${panelConfig.id} has no factory function.`);
            }

            // Use the factory to get the panel class/module
            const module = await panelConfig.factory();
            const PanelComponent = module.default || module;
            
            // Instantiate the panel, passing necessary props
            const panelInstance = new PanelComponent({
                id: panelConfig.id,
                title: panelConfig.title,
                store: appStore
            });

            // Render the panel's content into the container
            if (typeof panelInstance.render === 'function') {
                const panelContent = panelInstance.render();
                if (typeof panelContent === 'string') {
                    container.innerHTML = panelContent;
                } else if (panelContent instanceof HTMLElement) {
                    container.appendChild(panelContent);
                }
            } else {
                container.innerHTML = `<div>Content for ${panelConfig.title}</div>`;
            }

        } catch (error) {
            console.error(`[DebugDock] Error loading panel ${panelConfig.id}:`, error);
            container.innerHTML = `
                <div style="color: var(--color-danger, red); padding: 8px; font-size: 11px;">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    },

    setupPanelDrag: function(panel, header, currentIndex) {
        let isDragging = false;
        let startY = 0;
        let draggedElement = null;

        header.addEventListener('mousedown', (e) => {
            // Only drag if clicking on the header title, not the toggle button
            if (e.target.classList.contains('debug-panel-toggle')) return;
            
            isDragging = true;
            startY = e.clientY;
            draggedElement = panel;
            panel.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !draggedElement) return;

            const content = this.container.querySelector('.debug-dock-content');
            const panels = Array.from(content.querySelectorAll('.debug-panel'));
            
            // Find the panel we're hovering over
            const mouseY = e.clientY;
            let targetPanel = null;

            panels.forEach((p) => {
                if (p === draggedElement) return;
                
                const rect = p.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                if (mouseY >= rect.top && mouseY <= rect.bottom) {
                    targetPanel = p;
                }
            });

            // Clear previous drag-over states
            panels.forEach(p => p.classList.remove('drag-over'));
            
            if (targetPanel) {
                targetPanel.classList.add('drag-over');
            }
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging || !draggedElement) return;

            const content = this.container.querySelector('.debug-dock-content');
            const panels = Array.from(content.querySelectorAll('.debug-panel'));
            const targetPanel = panels.find(p => p.classList.contains('drag-over'));

            if (targetPanel && targetPanel !== draggedElement) {
                // Get current indices
                const draggedIndex = parseInt(draggedElement.dataset.index);
                const targetIndex = parseInt(targetPanel.dataset.index);
                
                // Dispatch reorder action to Redux
                dispatch(reorderPanels({ fromIndex: draggedIndex, toIndex: targetIndex }));
                
                // Re-render to reflect new order
                this.render();
            }

            // Clean up
            panels.forEach(p => {
                p.classList.remove('dragging', 'drag-over');
            });
            
            isDragging = false;
            draggedElement = null;
        });
    },

    // Method for external access (keyboard shortcuts, etc.)
    getPanels: function() {
        const state = appStore.getState();
        const debugState = state.debugPanel;
        return debugState.panels || [];
    }
};

export function initializeDebugDock() {
    // This is the new entry point called by the bootloader
    // It makes the debugDock globally available
    if (typeof window !== 'undefined') {
        window.APP = window.APP || {};
        window.APP.services = window.APP.services || {};
        window.APP.services.debugDock = debugDock;
    }
    return debugDock;
}

// Ensure DebugDock is globally accessible
if (typeof window !== 'undefined') {
    window.APP = window.APP || {};
    window.APP.debugDock = debugDock;
}

// Expose diagnose method for debugging
debugDock.diagnose = function() {
    console.log('🔍 DebugDock Diagnostic Report');
    console.log('----------------------------');
    console.log('Visibility:', this.isVisible);
    console.log('Container exists:', !!this.container);
    
    console.log('\nPanel Details:');
    const debugPanels = panelRegistry.getAllPanels().filter(p => p.group === 'debug');
    debugPanels.forEach(panel => {
        console.log(`- ${panel.id}:`);
        console.log(`  Title: ${panel.title}`);
        console.log(`  Component: ${panel.component ? panel.component.name : 'Not Available'}`);
    });

    console.log('\nContainer Details:');
    if (this.container) {
        console.log('  Display Style:', this.container.style.display);
        console.log('  Visibility:', this.container.classList.contains('visible') ? 'Visible' : 'Hidden');
    }
};

// Removed the self-initializing logic:
// const initializeWhenReady = () => { ... };
// initializeWhenReady();
