/**
 * client/layout/WorkspaceManager.js
 * A unified manager for all panels across all workspace zones (docks).
 * It listens to the Redux store and renders the entire panel layout.
 */
import { appStore, dispatch } from '../appState.js';
import { panelActions, selectDocks } from '../store/slices/panelSlice.js';
import { uiActions } from '../store/uiSlice.js';
import { panelDefinitions } from '../panels/panelRegistry.js';
import { Sidebar } from './Sidebar.js';
import '../libs/Sortable.min.js';

class WorkspaceManager {
    constructor() {
        // Internal semantic zones - DOM uses semantic IDs, zones are internal concept
        this.semanticZones = {
            'sidebar': document.getElementById('workspace-sidebar'),
            'editor': document.getElementById('workspace-editor'), 
            'preview': document.getElementById('workspace-preview'),
            'debug': document.getElementById('workspace-sidebar'), // Debug panels use sidebar for now
            'misc': document.getElementById('workspace-sidebar'), // Misc panels use sidebar
            // Note: console zone (bottom) doesn't exist in current layout
            // Console panels will default to sidebar for now
        };
        
        // FIXED: Make sidebar scrollable
        if (this.semanticZones.sidebar) {
            this.semanticZones.sidebar.style.overflowY = 'auto';
            this.semanticZones.sidebar.style.height = '100%';
        }

        this.loadedPanelInstances = new Map();
        this.sortableInstances = new Map();

        // Elements for resizing functionality
        this.resizerLeft = document.getElementById('resizer-left');
        this.resizerRight = document.getElementById('resizer-right');
        
        // Initialize the new Sidebar component
        this.sidebar = new Sidebar();
        this.sidebarInitialized = false;
    }

    initialize() {
        // Verify all semantic zones exist
        this.validateSemanticZones();
        
        this.registerPanelsFromDefinitions();
        
        // Subscribe to store changes and trigger re-render
        appStore.subscribe(this.render.bind(this));
        
        this.render();
        
        // Expose clean API
        this.exposeWorkspaceAPI();

        this.initDragAndDrop();
        this.initResizers();
        this.initKeyboardShortcuts();
    }
    
    registerPanelsFromDefinitions() {
        const state = appStore.getState();
        const docks = selectDocks(state);

        panelDefinitions.forEach(panelDef => {
            // Find the dock that this panel should belong to.
            const targetDockId = Object.keys(docks).find(dockId => 
                docks[dockId].panels.includes(panelDef.id)
            );

            if (targetDockId) {
                dispatch(panelActions.createPanel({
                    id: panelDef.id,
                    title: panelDef.title,
                    dockId: targetDockId,
                    config: { factory: panelDef.factory }
                }));
            } else {
                // In the new system, we expect panels to be defined in their docks in panelSlice.
                // This console.warn can be removed once the migration is complete.
                console.warn(`[WorkspaceManager] Panel '${panelDef.id}' is defined in panelRegistry but not assigned to any dock in panelSlice initial state.`);
            }
        });
    }
    
    /**
     * Ensure sidebar is properly initialized (async)
     */
    async ensureSidebarInitialized() {
        if (!this.sidebarInitialized) {
            await this.sidebar.initialize();
            this.sidebarInitialized = true;
        }
    }

    validateSemanticZones() {
        const missingZones = [];
        for (const [zoneName, container] of Object.entries(this.semanticZones)) {
            if (!container) {
                missingZones.push(zoneName);
                console.error(`[WorkspaceManager] Missing DOM element for semantic area: ${zoneName}`);
                console.error(`[WorkspaceManager] Expected element ID: workspace-${zoneName}`);
            }
        }
        
        if (missingZones.length > 0) {
            console.error(`[WorkspaceManager] Missing semantic areas: ${missingZones.join(', ')}`);
            console.error('[WorkspaceManager] Available DOM elements:');
            ['workspace-sidebar', 'workspace-editor', 'workspace-preview'].forEach(id => {
                const el = document.getElementById(id);
                console.error(`  ${id}: ${el ? 'EXISTS' : 'MISSING'}`);
            });
        }
    }

    initResizers() {
        this.initResizer(this.resizerLeft, this.semanticZones.sidebar, this.semanticZones.editor);
        this.initResizer(this.resizerRight, this.semanticZones.editor, this.semanticZones.preview);
    }

    initResizer(resizer, leftPanel, rightPanel) {
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const totalWidth = this.semanticZones.sidebar.offsetWidth + this.semanticZones.editor.offsetWidth + this.semanticZones.preview.offsetWidth;
            
            if (resizer === this.resizerLeft) {
                const newLeftWidth = e.clientX - this.semanticZones.sidebar.getBoundingClientRect().left;
                const mainWidth = totalWidth - newLeftWidth - this.semanticZones.preview.offsetWidth - (this.resizerLeft.offsetWidth * 2);
                this.semanticZones.sidebar.style.flexBasis = `${newLeftWidth}px`;
                this.semanticZones.editor.style.flexBasis = `${mainWidth}px`;
            } else { // resizerRight
                const newRightWidth = totalWidth - e.clientX - resizer.offsetWidth;
                const mainWidth = totalWidth - this.semanticZones.sidebar.offsetWidth - newRightWidth - (this.resizerLeft.offsetWidth * 2);
                this.semanticZones.preview.style.flexBasis = `${newRightWidth}px`;
                this.semanticZones.editor.style.flexBasis = `${mainWidth}px`;
            }
        });

        document.addEventListener('mouseup', (e) => {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        });
    }

    render() {
        const state = appStore.getState();
        const docks = selectDocks(state);
        const panels = Object.values(docks).flatMap(dock => dock.panels.map(panelId => state.panels.panels[panelId]));

        // Apply sidebar visibility from the single source of truth: uiSlice
        const sidebarVisible = state.ui?.leftSidebarVisible === true;
        const sidebarElement = this.semanticZones.sidebar;
        if (sidebarElement) {
            sidebarElement.dataset.visible = sidebarVisible;
            
            // Render the new Sidebar component when visible
            if (sidebarVisible) {
                this.ensureSidebarInitialized().then(() => {
                    this.sidebar.render(sidebarElement);
                });
            }
        }

        // Apply editor visibility from textVisible state
        const editorVisible = state.ui?.textVisible !== false;
        const editorElement = this.semanticZones.editor;
        if (editorElement) {
            editorElement.style.display = editorVisible ? 'flex' : 'none';
        }

        // SIMPLIFIED: Sidebar now handles all dock and panel management
        // WorkspaceManager only handles non-sidebar zones (editor, preview)
        // Legacy panel management for non-sidebar zones only
        for (const dockId in docks) {
            const dock = docks[dockId];
            const semanticZone = dockId.replace('-dock', '');

            // Skip sidebar - it's handled by Sidebar component
            if (semanticZone === 'sidebar') {
                continue;
            }

            // Only handle non-sidebar zones
            if (!dock.isVisible) {
                continue;
            }
            
            const container = this.semanticZones[semanticZone];
            if (!container) {
                continue;
            }

            // Handle legacy panels for editor/preview zones
            const panelsInDock = dock.panels.map(id => panels.find(p => p.id === id)).filter(Boolean);
            panelsInDock.forEach(panel => {
                if (panel.isVisible) {
                    const panelEl = document.getElementById(panel.id);
                    if (!panelEl) {
                        this.createAndMountPanel(panel, container, semanticZone);
                    }
                }
            });
        }
    }

    async createAndMountPanel(panel, container, semanticZone) {
        const panelDef = panelDefinitions.find(p => p.id === panel.id);
        if (!panelDef || typeof panelDef.factory !== 'function') {
            console.error(`[WorkspaceManager] No factory for panel: ${panel.id}`);
            return;
        }

        try {
            const PanelClass = await panelDef.factory();
            let panelInstance;
            
            // Try new BasePanel pattern first
            try {
                const panelOptions = {
                    id: panel.id,
                    store: appStore
                };
                panelInstance = new PanelClass(panelOptions);
            } catch (optionsError) {
                // Fallback to legacy pattern with container
                console.warn(`[WorkspaceManager] Panel ${panel.id} using legacy constructor, trying container parameter`);
                panelInstance = new PanelClass(container);
            }
            let panelEl;

            // Use the new BasePanel render/onMount pattern
            if (typeof panelInstance.render === 'function') {
                panelEl = panelInstance.render();
                container.appendChild(panelEl);
                if (typeof panelInstance.onMount === 'function') {
                    panelInstance.onMount(container);
                }
            } else if (typeof panelInstance.mount === 'function') {
                // Legacy support
                panelEl = panelInstance.mount(container);
            } else if (panelInstance.element) {
                container.appendChild(panelInstance.element);
                panelEl = panelInstance.element;
            }

            if (panelEl) {
                panelEl.id = panel.id;
                this.loadedPanelInstances.set(panel.id, panelInstance);
                this.addPanelEventListeners(panelEl, panel);
                this.updatePanelElement(panelEl, panel);
            } else {
                console.error(`[WorkspaceManager] Panel ${panel.id} could not be mounted.`);
            }
        } catch (error) {
            console.error(`[WorkspaceManager] Failed to load/mount panel ${panel.id}:`, error);
        }
    }

    updatePanelElement(panelEl, panel) {
        panelEl.classList.toggle('collapsed', !!panel.isCollapsed);
        panelEl.classList.toggle('docked', !!panel.isFlyout);
        panelEl.style.display = panel.isVisible ? '' : 'none';
        
        const collapseBtn = panelEl.querySelector('.panel-collapse-btn');
        if (collapseBtn) {
            collapseBtn.innerHTML = panel.isCollapsed ? '▼' : '▲';
        }
    }

    addPanelEventListeners(panelEl, panel) {
        // This is a simplified version. Real implementation would dispatch actions.
        const collapseBtn = panelEl.querySelector('.panel-collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => dispatch(panelActions.toggleDockCollapse({ dockId: panel.dockId })));
        }
    }

    renderPanelManager() {
        // DISABLED: User wants clean interface without panel manager
        const container = this.semanticZones.sidebar;
        if (!container) return;
        
        // Remove any existing panel manager
        const managerContainer = container.querySelector('.panel-manager-container');
        if (managerContainer) {
            managerContainer.remove();
        }
    }

    createPanelManagerElement() {
        const state = appStore.getState();
        const panels = Object.values(state.panels.panels);
        const sidebarPanels = panels.filter(p => 
            p.dockId === 'sidebar-dock' || p.group === 'sidebar'
        );

        const managerContainer = document.createElement('div');
        managerContainer.className = 'panel-manager-container';
        managerContainer.innerHTML = `
            <div class="panel-manager-header">
                <div class="panel-manager-header__title">
                    <span class="icon icon-panel-manager"></span>
                    <span>Panel Manager</span>
                </div>
                <div class="panel-manager-header__actions">
                    <button class="btn btn--sm btn--ghost panel-manager-header__button" 
                            title="Toggle Panel Controls" data-action="toggle-controls">
                        <span class="icon icon-settings"></span>
                    </button>
                </div>
            </div>
            <div class="panel-manager-content">
                <div class="panel-manager-toggles">
                    ${sidebarPanels.map(panel => this.createPanelToggleHTML(panel)).join('')}
                </div>
            </div>
        `;

        // Add event listeners for panel toggles
        managerContainer.addEventListener('click', async (e) => {
            if (e.target.closest('[data-panel-id]')) {
                const panelId = e.target.closest('[data-panel-id]').dataset.panelId;
                const { togglePanelVisibility } = await import('/client/store/slices/panelSlice.js');
                appStore.dispatch(togglePanelVisibility({ panelId }));
                
                // Update visual state
                this.updatePanelToggleStates();
            }
        });

        return managerContainer;
    }

    createPanelToggleHTML(panel) {
        const isVisible = panel.isVisible ? 'is-visible' : '';
        const iconPath = panel.icon ? `/client/styles/icons/${panel.icon}.svg` : '';
        
        return `
            <div class="panel-toggle ${isVisible}" data-panel-id="${panel.id}" title="Toggle ${panel.title}">
                <div class="panel-toggle__icon">
                    ${iconPath ? `<img src="${iconPath}" alt="${panel.title} icon">` : ''}
                </div>
                <span class="panel-toggle__title">${panel.title}</span>
            </div>
        `;
    }

    updatePanelToggleStates() {
        const container = this.semanticZones.sidebar;
        const managerContainer = container?.querySelector('.panel-manager-container');
        if (!managerContainer) return;

        const state = appStore.getState();
        const allPanels = state.panels?.panels || {};
        
        managerContainer.querySelectorAll('[data-panel-id]').forEach(toggle => {
            const panelId = toggle.dataset.panelId;
            const panel = allPanels[panelId];
            if (panel) {
                toggle.classList.toggle('is-visible', panel.isVisible);
            }
        });
    }

    initDragAndDrop() {
        for (const [zoneName, container] of Object.entries(this.semanticZones)) {
            if (!container) continue; // Skip missing zones
            
            const dockId = `${zoneName}-dock`; // Convert to dock ID for compatibility
            if (this.sortableInstances.has(dockId)) {
                this.sortableInstances.get(dockId).destroy();
            }

            const sortable = new window.Sortable(container, {
                animation: 150,
                handle: '.panel-header',
                onEnd: (evt) => {
                    const panelOrder = Array.from(evt.to.children)
                        .map(child => child.id)
                        .filter(id => id && !id.startsWith('panel-manager'));
                    
                    // TODO: Dispatch a reorder action here
                    console.log(`TODO: Dispatch reorder for ${dockId}`, panelOrder);
                },
            });
            this.sortableInstances.set(dockId, sortable);
        }
    }

    initKeyboardShortcuts() {
        // Keyboard shortcut definitions - integrated into WorkspaceManager
        const shortcuts = [
            // Debug Panel Toggle
            { key: 'D', ctrl: true, shift: true, alt: false, action: () => this.togglePanel('pdata-panel') },
            // Settings Dock Toggle
            { key: 'S', ctrl: true, shift: true, alt: false, action: () => this.toggleDock('settings-dock') },
            // Save File 
            { key: 's', ctrl: 'optional', shift: false, alt: false, action: () => this.handleSaveFile() },
            // Refresh Preview
            { key: 'r', ctrl: 'optional', shift: false, alt: true, action: () => this.handleRefreshPreview() },
            // Comprehensive Refresh
            { key: 'r', ctrl: true, shift: true, alt: false, action: () => this.handleComprehensiveRefresh() },
            // View Mode Changes
            { key: '1', ctrl: false, shift: false, alt: true, action: () => this.setViewMode('editor') },
            { key: '2', ctrl: false, shift: false, alt: true, action: () => this.setViewMode('preview') },
            { key: '3', ctrl: false, shift: false, alt: true, action: () => this.setViewMode('split') },
            // Smart Copy (simplified for now)
            { key: 'A', ctrl: true, shift: true, alt: false, action: () => this.handleSmartCopyA() },
            { key: 'B', ctrl: true, shift: true, alt: false, action: () => this.handleSmartCopyB() },
        ];

        this.keyboardHandler = (event) => {
            for (const shortcut of shortcuts) {
                if (this.matchesShortcut(event, shortcut)) {
                    event.preventDefault();
                    shortcut.action();
                    return;
                }
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
        console.log('[WorkspaceManager] Keyboard shortcuts initialized');
    }

    matchesShortcut(event, shortcut) {
        const key = event.key;
        if (!key) return false; // Handle undefined/null key
        const keyMatches = key.toLowerCase() === shortcut.key.toLowerCase();
        
        if (!keyMatches) return false;

        // Check modifiers
        const ctrlPressed = event.ctrlKey || event.metaKey;
        const shiftPressed = event.shiftKey;
        const altPressed = event.altKey;

        const ctrlMatch = shortcut.ctrl === 'optional' ? true : 
                         shortcut.ctrl === true ? ctrlPressed : 
                         shortcut.ctrl === false ? !ctrlPressed : true;

        const shiftMatch = shortcut.shift === true ? shiftPressed : 
                          shortcut.shift === false ? !shiftPressed : true;

        const altMatch = shortcut.alt === true ? altPressed : 
                        shortcut.alt === false ? !altPressed : true;

        return ctrlMatch && shiftMatch && altMatch;
    }

    // Keyboard shortcut handlers
    togglePanel(panelId) {
        console.log(`[WorkspaceManager] Toggling panel: ${panelId}`);
        
        // First ensure the panel is registered in Redux state if it isn't already
        const state = appStore.getState();
        
        // Check if panel exists in Redux panels state or sidebarPanels state
        const panelInPanels = state.panels?.panels?.[panelId];
        const panelInSidebar = state.panels?.sidebarPanels?.[panelId];
        
        if (!panelInPanels && !panelInSidebar) {
            console.log(`[WorkspaceManager] Panel ${panelId} not registered, registering now...`);
            // Register the panel with default config
            dispatch(panelActions.registerPanel({ 
                panelId, 
                config: { 
                    title: panelId === 'pdata-panel' ? 'Debug Panel' : 
                           panelId === 'settings-panel' ? 'Settings Panel' : panelId,
                    visible: true,
                    collapsed: false
                }
            }));
        }
        
        // Now toggle visibility
        dispatch(panelActions.togglePanelVisibility({ panelId }));
    }

    // Toggle dock visibility
    toggleDock(dockId) {
        console.log(`[WorkspaceManager] Toggling dock: ${dockId}`);
        dispatch(panelActions.toggleDockVisibility({ dockId }));
    }

    // Zone toggle methods - transitioning from positional to semantic naming
    toggleLeftSidebar() {
        // Legacy method name - delegates to semantic version
        return this.toggleSidebar();
    }

    toggleSidebar() {
        // Semantic method - toggles the sidebar zone (left zone)
        const state = appStore.getState();
        const currentlyVisible = state.ui?.leftSidebarVisible !== false;
        
        dispatch(uiActions.updateSetting({ 
            key: 'leftSidebarVisible', 
            value: !currentlyVisible 
        }));
    }

    toggleEditor() {
        // Semantic method - toggles the editor zone (main zone)  
        const state = appStore.getState();
        const currentlyVisible = state.ui?.textVisible !== false;
        dispatch(uiActions.updateSetting({ 
            key: 'textVisible', 
            value: !currentlyVisible 
        }));
    }

    togglePreview() {
        // Semantic method - toggles the preview zone (right zone)
        const state = appStore.getState();
        const currentlyVisible = state.ui?.previewVisible !== false;
        dispatch(uiActions.updateSetting({ 
            key: 'previewVisible', 
            value: !currentlyVisible 
        }));
    }

    handleSaveFile() {
        // Delegate to active editor panel
        const activeEditorPanel = this.getActivePanelOfType('editor');
        if (activeEditorPanel && activeEditorPanel.save) {
            activeEditorPanel.save();
        } else {
            // Fallback to eventBus for legacy compatibility
            import('../eventBus.js').then(({ eventBus }) => {
                eventBus.emit('shortcut:saveFile');
            });
        }
    }

    handleRefreshPreview() {
        // Delegate to preview panel
        const previewPanel = this.getPanelInstance('preview');
        if (previewPanel && previewPanel.refresh) {
            previewPanel.refresh();
        } else {
            // Fallback to eventBus
            import('../eventBus.js').then(({ eventBus }) => {
                eventBus.emit('shortcut:refreshPreview');
            });
        }
    }

    handleComprehensiveRefresh() {
        // Full application refresh
        import('../eventBus.js').then(({ eventBus }) => {
            eventBus.emit('shortcut:comprehensiveRefresh');
        });
    }

    setViewMode(mode) {
        dispatch({ type: 'UI_SET_VIEW_MODE', payload: { viewMode: mode } });
    }

    handleSmartCopyA() {
        // Context-aware smart copy - could delegate to focused panel
        const focusedPanel = this.getFocusedPanel();
        if (focusedPanel && focusedPanel.getSmartCopyContent) {
            const content = focusedPanel.getSmartCopyContent();
            localStorage.setItem('smartCopyBufferA', content);
        }
    }

    handleSmartCopyB() {
        dispatch({ type: 'SET_SMART_COPY_B', payload: null });
    }

    // Helper methods for shortcut handlers
    getActivePanelOfType(type) {
        for (const [panelId, instance] of this.loadedPanelInstances) {
            if (panelId.includes(type) && instance.isActive) {
                return instance;
            }
        }
        return null;
    }

    getPanelInstance(panelId) {
        return this.loadedPanelInstances.get(panelId);
    }

    getFocusedPanel() {
        // Return the currently focused panel
        const activeElement = document.activeElement;
        for (const [panelId, instance] of this.loadedPanelInstances) {
            if (instance.element && instance.element.contains(activeElement)) {
                return instance;
            }
        }
        return null;
    }

    // Semantic zone access helpers
    getSidebarZone() { return this.semanticZones.sidebar; }
    getEditorZone() { return this.semanticZones.editor; }
    getPreviewZone() { return this.semanticZones.preview; }
    // Note: getConsoleZone() not available - no bottom zone in current layout

    // Direct semantic zone access
    getZoneBySemanticName(semanticName) {
        return this.semanticZones[semanticName];
    }

    // Get semantic name from DOM element
    getSemanticNameFromElement(element) {
        for (const [semanticName, zoneElement] of Object.entries(this.semanticZones)) {
            if (zoneElement === element) return semanticName;
        }
        return null;
    }

    // Direct panel mounting to semantic zones (bypassing Redux dock system)
    async mountPanelToZone(panelId, semanticZone) {
        const container = this.semanticZones[semanticZone];
        if (!container) {
            console.error(`[WorkspaceManager] Invalid semantic zone: ${semanticZone}`);
            return false;
        }

        const panelDef = panelDefinitions.find(p => p.id === panelId);
        if (!panelDef) {
            console.error(`[WorkspaceManager] Panel definition not found: ${panelId}`);
            return false;
        }

        console.log(`[WorkspaceManager] Direct mounting ${panelId} to ${semanticZone} zone`);
        
        const mockPanel = { id: panelId, isVisible: true };
        await this.createAndMountPanel(mockPanel, container, semanticZone);
        return true;
    }

    destroy() {
        // Cleanup keyboard shortcuts
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
        
        // Cleanup other resources
        this.loadedPanelInstances.clear();
        for (const sortable of this.sortableInstances.values()) {
            sortable.destroy();
        }
        this.sortableInstances.clear();
    }
    
    // ENHANCED: Expose clean workspace API
    exposeWorkspaceAPI() {
        if (typeof window === 'undefined') return;
        
        window.APP = window.APP || {};
        window.APP.workspace = {
            // Log Area (most special - has own Redux store)
            toggleLogArea: () => {
                try {
                    if (appStore) {
                        appStore.dispatch({ type: 'UI_TOGGLE_LOG_VISIBILITY' });
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error('[WorkspaceManager] Failed to toggle log area:', error);
                    return false;
                }
            },
            
            // Zone Controls
            toggleZone: (zoneId) => this.toggleZone(zoneId),
            
            // Panel Controls  
            togglePanel: (panelId) => this.togglePanel(panelId),
            
            // Sidebar Controls (SIMPLIFIED - main control is now window.APP.sidebar)
            toggleSidebar: () => this.toggleSidebar(),
            
            // System Info
            getSystemInfo: () => ({
                manager: 'WorkspaceManager (enhanced)',
                hierarchy: ['Log (most special)', 'Editor', 'Preview', 'Sidebar'],
                zones: Object.keys(this.semanticZones),
                loadedPanels: Array.from(this.loadedPanelInstances.keys()),
                debug: 'Check console for panel registration debugging'
            }),
            
            // Legacy compatibility + FIXED: Four-corners button behavior
            resetDefaults: () => {
                console.log('🔄 Four-corners reset: Making sidebar visible and cycling active panel');
                
                // 1. Ensure sidebar is visible
                this.ensureSidebarVisible();
                
                // 2. Cycle to next panel in sidebar (make it idempotent)
                this.cycleToNextSidebarPanel();
                
                return true;
            },
            
            // FIXED: Four-corners helper methods
            ensureSidebarVisible: () => {
                const state = appStore.getState();
                if (!state.ui.leftSidebarVisible) {
                    dispatch(uiActions.setLeftSidebarVisible(true));
                }
            },
            
            cycleToNextSidebarPanel: () => {
                const state = appStore.getState();
                const sidebarDock = state.panels?.docks?.['sidebar-dock'];
                if (sidebarDock && sidebarDock.panels.length > 0) {
                    const currentIndex = sidebarDock.panels.indexOf(sidebarDock.activePanel) || 0;
                    const nextIndex = (currentIndex + 1) % sidebarDock.panels.length;
                    const nextPanel = sidebarDock.panels[nextIndex];
                    console.log(`🔄 Cycling to panel: ${nextPanel}`);
                    return nextPanel;
                }
                return null;
            }
        };
        
        console.log('✅ Enhanced WorkspaceManager API exposed to window.APP.workspace');
    }
    
    // ENHANCED: Add behavior control methods
    toggleZone(zoneId) {
        const container = this.semanticZones[zoneId];
        if (!container) {
            console.warn(`[WorkspaceManager] Unknown zone: ${zoneId}`);
            return false;
        }
        
        // Toggle visibility
        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? '' : 'none';
        console.log(`[WorkspaceManager] Toggled zone ${zoneId}: ${isHidden ? 'shown' : 'hidden'}`);
        return true;
    }
    
    // REMOVED: Duplicate togglePanel method that used direct DOM manipulation
    // This was conflicting with the Redux-based togglePanel method above
    
    // DEBUG: Panel zone assignment test
    testPanelZones() {
        console.log('🧪 TESTING PANEL ZONE ASSIGNMENTS...');
        console.log('=====================================');
        
        // Test 1: Check Redux state
        console.log('\n1️⃣ REDUX STATE CHECK:');
        const state = appStore.getState();
        if (state && state.panels) {
            console.log('📊 Redux Panel Docks:');
            Object.entries(state.panels.docks).forEach(([dockId, dock]) => {
                console.log(`  ${dockId}: panels=[${dock.panels.join(', ') || 'EMPTY'}], visible=${dock.isVisible}`);
            });
            
            console.log('\n📊 Redux Panel Definitions:');
            Object.entries(state.panels.panels).forEach(([panelId, panel]) => {
                console.log(`  ${panelId}: dockId=${panel.dockId}, visible=${panel.isVisible}`);
            });
        }
        
        // Test 2: Check DOM placement
        console.log('\n2️⃣ DOM PLACEMENT CHECK:');
        const zones = {};
        Object.entries(this.semanticZones).forEach(([zoneName, container]) => {
            if (container) {
                const panels = Array.from(container.children)
                    .filter(el => el.id && el.id !== '')
                    .map(el => el.id);
                zones[zoneName] = panels;
                console.log(`🏠 ${zoneName} (${container.id}): [${panels.join(', ') || 'EMPTY'}]`);
            }
        });
        
        // Test 3: Expected vs actual
        console.log('\n3️⃣ EXPECTATION vs REALITY:');
        const expectations = [
            { id: 'file-browser', expectedZone: 'sidebar' },
            { id: 'code', expectedZone: 'sidebar' },
            { id: 'editor', expectedZone: 'editor' },
            { id: 'preview', expectedZone: 'preview' },
            { id: 'settings-panel', expectedZone: 'sidebar' }
        ];
        
        expectations.forEach(({ id, expectedZone }) => {
            const element = document.getElementById(id);
            if (element) {
                let actualZone = 'UNKNOWN';
                Object.entries(this.semanticZones).forEach(([zoneName, container]) => {
                    if (container && container.contains(element)) {
                        actualZone = zoneName;
                    }
                });
                const match = actualZone === expectedZone;
                console.log(`${match ? '✅' : '❌'} ${id}: expected=${expectedZone}, actual=${actualZone}`);
            } else {
                console.log(`⚠️ ${id}: element not found`);
            }
        });
        
        return { state: state?.panels, zones };
    }
}

export const workspaceManager = new WorkspaceManager();
