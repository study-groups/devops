/**
 * SidebarManager.js - Manages sidebar content and panel display
 * 
 * This is a VIEW into APP.panels - it doesn't own panels, just displays them.
 * Handles sidebar rendering, panel expand/collapse, and Redux state integration.
 */

import { appStore } from '/client/appState.js';
import { SidebarHeader } from './SidebarHeader.js';
import { uiActions } from '/client/store/uiSlice.js';
import { panelActions } from '/client/store/slices/panelSlice.js';
import { panelConfigLoader } from '/client/config/PanelConfigLoader.js';
import { panelRegistry } from '/client/panels/BasePanel.js';
import { DragDropManager } from './DragDropManager.js';
import '/client/panels/index.js'; // Import to register all panels

let log;
const getLogger = () => {
    if (log) return log;
    if (window.APP?.services?.log) {
        log = window.APP.services.log.createLogger('SidebarManager');
    } else {
        log = {
            info: (...args) => console.log('[SidebarManager]', ...args),
            warn: (...args) => console.warn('[SidebarManager]', ...args),
            error: (...args) => console.error('[SidebarManager]', ...args),
            debug: (...args) => console.log('[SidebarManager]', ...args)
        };
    }
    return log;
};

export class SidebarManager {
    constructor() {
        this.container = null;
        this.header = null;
        this.initialized = false;
        this.storeUnsubscribe = null;
        this.panelConfigs = null;
        this.configLoaded = false;
        this.categories = null;
        this.activeCategory = 'dev'; // Default category
        this.panelInstances = new Map();
        this.dragDropManager = null;
        this.lastRenderedState = {
            panels: {},
            sidebarPanels: {},
            panelOrders: {}
        };
    }

    /**
     * Initialize the sidebar manager
     * @param {HTMLElement} container - The sidebar container element
     */
    async initialize(container) {
        if (this.initialized) return;
        
        this.container = container;
        this.setupSidebarStructure();
        this.initializeHeader();
        this.addStyles();
        this.subscribeToStore();
        
        // Load panel configuration
        await this.loadPanelConfiguration();
        
        this.render();
        
        this.initialized = true;
        getLogger().info('[SidebarManager] ✅ Initialized');
    }

    setupSidebarStructure() {
        this.container.innerHTML = `
            <div id="sidebar-header-container"></div>
            <div id="sidebar-content" style="flex: 1; padding: 12px; overflow-y: auto;">
                <div class="sidebar-panel-list">
                    <div style="text-align: center; color: var(--color-text-secondary); font-size: 12px; padding: 20px;">
                        Loading panels...
                    </div>
                </div>
                <div id="sidebar-panels-container" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border);">
                    <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: var(--color-text);">Available Panels</div>
                    <!-- Panels will be rendered here -->
                </div>
            </div>
        `;
    }

    initializeHeader() {
        const headerContainer = this.container.querySelector('#sidebar-header-container');
        this.header = new SidebarHeader();
        this.header.render(headerContainer);
    }

    subscribeToStore() {
        this.storeUnsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            const relevantState = {
                panels: state.panels.panels,
                sidebarPanels: state.panels.sidebarPanels,
                panelOrders: state.panels.panelOrders,
                activeCategory: state.ui.activeSidebarCategory
            };

            if (JSON.stringify(relevantState) !== JSON.stringify(this.lastRenderedState)) {
                this.lastRenderedState = JSON.parse(JSON.stringify(relevantState));
                this.activeCategory = relevantState.activeCategory || 'dev';
                
                // Use setTimeout to allow the Redux state to update before re-rendering
                setTimeout(async () => await this.render(), 0);
            }
        });
    }

    /**
     * Main render method - renders tabbed sidebar interface
     */
    async render() {
        if (!this.container || !this.configLoaded) {
            return;
        }
        
        const state = appStore.getState();
        this.activeCategory = state.ui.activeSidebarCategory || 'dev';

        this.container.innerHTML = `
            <div class="sidebar-category-tabs">
                ${Object.entries(this.categories).map(([categoryId, category]) => `
                    <button class="btn btn-ghost btn-sm category-tab ${categoryId === this.activeCategory ? 'active' : ''}" 
                            data-category="${categoryId}">
                        <span class="tab-icon">${category.icon}</span>
                        <span class="tab-label">${categoryId}</span>
                    </button>
                `).join('')}
            </div>
            
            <div class="sidebar-content">
                <div id="panels-list"></div>
            </div>
        `;

        await this.renderPanelsForCategory();
        this.addSidebarStyles();
        this.attachTabEventListeners();
        await this.restoreFloatingPanels();
    }

    attachTabEventListeners() {
        const tabs = this.container.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const categoryId = tab.dataset.category;
                appStore.dispatch(uiActions.updateSetting({ key: 'activeSidebarCategory', value: categoryId }));
            });
        });
    }

    renderPanelsList() {
        const listContainer = this.container.querySelector('.sidebar-panel-list');
        if (!listContainer) return;

        const state = appStore.getState();
        const panels = state.panels?.panels || {};
        const activePanels = Object.values(panels).filter(p => p.visible && p.mounted);

        if (activePanels.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; color: var(--color-text-secondary); font-size: 12px; padding: 20px;">
                    No panels active
                </div>
            `;
        } else {
            listContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: var(--color-text);">Active Panels</div>
                ${activePanels.map(panel => `
                    <div style="padding: 6px 8px; margin-bottom: 2px; background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: 3px; font-size: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${panel.title}</span>
                        <button data-action="close-panel" data-panel-id="${panel.id}"
                                style="background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 12px;">×</button>
                    </div>
                `).join('')}
            `;
        }
    }

    async loadPanelConfiguration() {
        try {
            getLogger().info('[SidebarManager] Loading panel configuration...');
            this.panelConfigs = await panelConfigLoader.getSidebarPanels();
            getLogger().info('[SidebarManager] Got panel configs:', this.panelConfigs);
            
            this.categories = await panelConfigLoader.getCategories();
            getLogger().info('[SidebarManager] Got categories:', this.categories);
            
            this.configLoaded = true;
            getLogger().info('[SidebarManager] ✅ Panel configuration loaded:', Object.keys(this.panelConfigs));
            getLogger().info('[SidebarManager] ✅ Categories loaded:', Object.keys(this.categories));
            
            // Initialize sidebar panel states in Redux if they don't exist
            const state = appStore.getState();
            const currentSidebarPanels = state.panels?.sidebarPanels || {};
            
            getLogger().info('[SidebarManager] Current sidebar panels state:', currentSidebarPanels);
            
            Object.keys(this.panelConfigs).forEach(panelId => {
                if (!(panelId in currentSidebarPanels)) {
                    const config = this.panelConfigs[panelId];
                    getLogger().info(`[SidebarManager] Initializing panel ${panelId} with default expanded: ${config.default_expanded || false}`);
                    appStore.dispatch(panelActions.setSidebarPanelExpanded({
                        panelId,
                        expanded: config.default_expanded || false
                    }));
                } else {
                    getLogger().info(`[SidebarManager] Panel ${panelId} already exists with expanded: ${currentSidebarPanels[panelId].expanded}`);
                }
            });
            
        } catch (error) {
            getLogger().error('[SidebarManager] Failed to load panel configuration:', error);
            throw error; // Re-throw to prevent broken state
        }
    }

    renderAvailablePanels() {
        const container = this.container.querySelector('#sidebar-panels-container');
        if (!container) return;
        
        if (!this.configLoaded || !this.panelConfigs) {
            container.innerHTML = `
                <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: var(--color-text);">Available Panels</div>
                <div style="text-align: center; color: var(--color-text-secondary); font-size: 12px; padding: 20px;">
                    Loading panel configuration...
                </div>
            `;
            return;
        }
        
        const state = appStore.getState();
        const sidebarPanels = state.panels?.sidebarPanels || {};
        const floatingPanels = state.panels?.panels || {};
        getLogger().info('[SidebarManager] Current sidebar panel states:', sidebarPanels);
        
        const panelsHtml = Object.entries(this.panelConfigs).map(([panelId, config]) => {
            const isExpanded = sidebarPanels[panelId]?.expanded || config.default_expanded || false;
            const isFloating = floatingPanels[panelId]?.visible && floatingPanels[panelId]?.mounted;
            const arrow = isExpanded ? '▲' : '▼';
            const contentDisplay = isExpanded ? 'block' : 'none';
            
            // Get category info for styling
            const categoryColor = this.getCategoryColor(config.category);
            
            return `
                <div class="sidebar-panel-item ${isExpanded ? 'expanded' : ''} ${isFloating ? 'is-floating' : ''}" data-panel-id="${panelId}" data-category="${config.category}">
                    <div onclick="window.APP.services.sidebarManager.togglePanel('${panelId}')" 
                         style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--color-bg-alt); border: 1px solid var(--color-border); border-left: 3px solid ${categoryColor}; border-radius: 4px; cursor: pointer; font-size: 11px; margin-bottom: 4px;">
                        <span>${config.title} ${isFloating ? '(Floating)' : ''}</span>
                        <span style="font-size: 10px; color: var(--color-text-secondary);">${arrow}</span>
                    </div>
                    <div class="panel-content" style="display: ${contentDisplay}; margin-top: 4px; padding: 12px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 4px; font-size: 10px;">
                        <div style="margin-bottom: 8px; color: var(--color-fg-muted);">${config.description}</div>
                        <div style="font-size: 9px; color: var(--color-fg-muted); margin-bottom: 8px;">
                            Category: ${config.category} • Type: ${config.content_type}
                        </div>
                        ${config.floating ? `
                            <button onclick="window.APP.services.sidebarManager.createFloatingPanel('${panelId}')" 
                                    class="btn btn-sm btn-primary" style="width: 100%;">
                                Float Panel
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Update only the panels part, keep the header
        const existingHeader = container.querySelector('div:first-child');
        container.innerHTML = '';
        if (existingHeader) container.appendChild(existingHeader);
        container.insertAdjacentHTML('beforeend', panelsHtml);
    }

    getCategoryColor(category) {
        const categoryColors = {
            debug: '#ff6b6b',
            design: '#4ecdc4',
            navigation: '#45b7d1',
            content: '#96ceb4'
        };
        return categoryColors[category] || '#ccc';
    }



    switchCategory(categoryId) {
        appStore.dispatch(uiActions.updateSetting({ key: 'activeSidebarCategory', value: categoryId }));
    }

    updateTabStates() {
        const tabs = this.container.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            const isActive = tab.dataset.category === this.activeCategory;
            tab.classList.toggle('active', isActive);
        });
    }

    async renderPanelsForCategory() {
        const container = this.container.querySelector('#panels-list');
        if (!container) return;

        const state = appStore.getState();
        const sidebarPanels = state.panels?.sidebarPanels || {};
        const floatingPanels = state.panels?.panels || {};

        // Filter panels by active category
        const categoryPanels = Object.entries(this.panelConfigs)
            .filter(([panelId, config]) => config.category === this.activeCategory);

        if (categoryPanels.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--color-text-secondary); font-size: 12px;">
                    No panels in ${this.activeCategory} category
                </div>
            `;
            return;
        }

        // Get saved order or initialize it
        const panelOrders = state.panels?.panelOrders || {};
        const savedOrder = panelOrders[this.activeCategory] || [];
        const orderedPanels = this.orderPanels(categoryPanels, savedOrder);

        container.innerHTML = `
            
        `;
        
        // Create separate sortable container
        const sortableContainer = document.createElement('div');
        sortableContainer.className = 'panels-container';
        sortableContainer.setAttribute('data-category', this.activeCategory);
        
        sortableContainer.innerHTML = orderedPanels.map(([panelId, config], index) => {
                    const panelState = sidebarPanels[panelId] || {};
                    const isExpanded = panelState.expanded || config.default_expanded;
                    const floatingPanelState = floatingPanels[panelId];
                    const isFloating = floatingPanelState ? floatingPanelState.isFloating : false;
                    const categoryColor = this.categories[config.category]?.color || '#666';
                    
                    return `
                        <div class="panel-item ${isExpanded ? 'expanded' : ''} ${isFloating ? 'floating' : ''}" 
                             data-panel-id="${panelId}" 
                             data-index="${index}"
                             draggable="false">
                            <div class="panel-header" data-action="toggle-panel" data-panel-id="${panelId}" draggable="false">
                                <span class="panel-title">${config.title} ${isFloating ? '(floating)' : ''}</span>
                                <div class="panel-controls">
                                    ${isFloating ? 
                                        `<button class="panel-control-btn" data-action="close-floating" data-panel-id="${panelId}" title="Close floating panel">↙</button>` :
                                        `<button class="panel-control-btn" data-action="float-panel" data-panel-id="${panelId}" title="Float panel">↗</button>`
                                    }
                                </div>
                            </div>
                            <div class="panel-content" style="display: ${isExpanded ? 'block' : 'none'};" id="panel-content-${panelId}">
                                <div class="panel-instance-container" id="panel-instance-${panelId}"></div>
                            </div>
                        </div>
                    `;
                }).join('');
        
        // Append the sortable container to the main container
        container.appendChild(sortableContainer);

        // Setup event listeners
        this.setupEventListeners();

        // Render actual panel instances for expanded panels
        for (const [panelId, config] of orderedPanels) {
            const panelState = sidebarPanels[panelId] || {};
            const isExpanded = panelState.expanded || config.default_expanded;
            if (isExpanded) {
                await this.renderPanelInstance(panelId, config);
            }
        }

        // Reinitialize drag-drop after rendering
        this.initializeDragDrop();
    }

    updatePanelCount() {
        const countElement = this.container.querySelector('.sidebar-panel-count');
        if (!countElement) return;

        const state = appStore.getState();
        const panels = state.panels?.panels || {};
        const activePanels = Object.values(panels).filter(p => p.isFloating || p.visible).length;
        const totalPanels = Object.keys(this.panelConfigs || {}).length;
        
        countElement.textContent = `${activePanels}/${totalPanels} panels`;
    }

    togglePanel(panelId) {
        const state = appStore.getState();
        const currentExpanded = state.panels.sidebarPanels[panelId]?.expanded || false;
        appStore.dispatch(panelActions.setSidebarPanelExpanded({ panelId, expanded: !currentExpanded }));
    }

    /**
     * Render actual panel instance content
     */
    async renderPanelInstance(panelId, config) {
        const container = this.container.querySelector(`#panel-instance-${panelId}`);
        if (!container) return;

        // Check if panel is floating
        const state = appStore.getState();
        const floatingPanelState = state.panels?.panels?.[panelId];
        const isFloating = floatingPanelState?.isFloating && !floatingPanelState?.isDocked;

        try {
            // If panel is floating, show minimized version
            if (isFloating) {
                container.innerHTML = `
                    <div class="panel-minimized" style="
                        padding: 12px;
                        background: var(--color-bg-alt);
                        border: 1px solid var(--color-border);
                        border-radius: 4px;
                        text-align: center;
                        color: var(--color-text-secondary);
                        font-size: 11px;
                    ">
                        <div style="margin-bottom: 8px;">Panel is floating</div>
                        <button onclick="window.APP.services.sidebarManager.focusFloatingPanel('${panelId}')" 
                                class="btn btn-sm" style="font-size: 10px;">
                            Focus Floating Panel
                        </button>
                    </div>
                `;
                return;
            }

            // Check if panel already exists to prevent creation loop
            let panel = this.panelInstances.get(panelId);

            if (!panel) {
                // Create panel instance using the unified registry (now async)
                panel = await panelRegistry.createPanel(panelId, {
                    id: panelId,
                    title: config.title,
                    type: panelId // Use panelId as type to match registration
                });
                this.panelInstances.set(panelId, panel);
            }

            if (panel && typeof panel.renderContent === 'function') {
                // Render panel content
                const content = panel.renderContent();
                container.innerHTML = content;
                
                // Call onMount if available
                if (typeof panel.onMount === 'function') {
                    await panel.onMount(container);
                }
                
            } else {
                // Fallback to basic description
                container.innerHTML = `<div class="panel-fallback">Panel content not available</div>`;
                getLogger().warn(`[SidebarManager] No renderContent method for panel: ${panelId}`);
            }
        } catch (error) {
            getLogger().error(`[SidebarManager] Failed to render panel ${panelId}:`, error);
            container.innerHTML = `<div class="panel-error">Failed to load panel: ${error.message}</div>`;
        }
    }

    togglePanelFloating(panelId) {
        getLogger().info(`[SidebarManager] Toggling floating for panel: ${panelId}`);
        appStore.dispatch(panelActions.togglePanelFloating(panelId));
    }

    closePanel(panelId) {
        getLogger().info(`[SidebarManager] Closing panel: ${panelId}`);
        appStore.dispatch(panelActions.hidePanel(panelId));
    }

    async createFloatingPanel(panelId) {
        const config = this.panelConfigs[panelId];
        if (!config) {
            getLogger().error(`Panel configuration not found for id: ${panelId}`);
            return;
        }

        // Ensure panel exists in Redux state first
        const state = appStore.getState();
        if (!state.panels?.panels?.[panelId]) {
            getLogger().info(`[SidebarManager] Creating panel ${panelId} in Redux state before floating`);
            // Create panel in Redux state first
            appStore.dispatch(panelActions.createPanel({
                id: panelId,
                title: config.title,
                type: panelId,
                visible: false,
                collapsed: false,
                position: { x: 100, y: 100 },
                size: { width: 400, height: 300 }
            }));
        }

        // Now start floating the panel
        appStore.dispatch(panelActions.startFloatingPanel({ panelId }));
        getLogger().info(`[SidebarManager] Started floating panel: ${panelId}`);
    }

    closeFloatingPanel(panelId) {
        // Remove all floating panels with this ID (in case there are duplicates)
        const panels = document.querySelectorAll(`[id^="floating-panel-${panelId}"]`);
        panels.forEach(panel => panel.remove());
        
        // Dispatch Redux action to update state
        appStore.dispatch(panelActions.stopFloatingPanel(panelId));
    }

    focusFloatingPanel(panelId) {
        const floatingPanel = document.getElementById(`floating-panel-${panelId}`);
        if (floatingPanel) {
            // Bring to front by updating z-index
            const state = appStore.getState();
            const maxZ = Math.max(...Object.values(state.panels?.panels || {}).map(p => p.zIndex || 0));
            floatingPanel.style.zIndex = maxZ + 1;
            
            // Update Redux state
            appStore.dispatch(panelActions.bringToFront(panelId));
            
            // Optional: add a brief highlight effect
            floatingPanel.style.boxShadow = '0 0 20px rgba(0, 123, 255, 0.5)';
            setTimeout(() => {
                floatingPanel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }, 1000);
        }
    }

    makeDraggable(panel) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        const panelId = panel.id.replace('floating-panel-', '');

        const header = panel.querySelector('.floating-panel-header');
        if (!header) return;
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const newLeft = e.clientX - dragOffset.x;
                const newTop = e.clientY - dragOffset.y;
                panel.style.left = newLeft + 'px';
                panel.style.top = newTop + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                // Save position when drag ends
                const rect = panel.getBoundingClientRect();
                const position = { x: rect.left, y: rect.top };
                console.log('Saving position:', panelId, position);
                appStore.dispatch(panelActions.movePanel({ id: panelId, position }));
            }
            isDragging = false;
        });
    }

    makeResizable(panel) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        const panelId = panel.id.replace('floating-panel-', '');

        const resizeHandle = panel.querySelector('.resize-handle-se');
        if (!resizeHandle) return;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const newWidth = Math.max(200, startWidth + e.clientX - startX);
                const newHeight = Math.max(150, startHeight + e.clientY - startY);
                panel.style.width = newWidth + 'px';
                panel.style.height = newHeight + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                // Save size when resize ends
                const rect = panel.getBoundingClientRect();
                const size = { width: rect.width, height: rect.height };
                console.log('Saving size:', panelId, size);
                appStore.dispatch(panelActions.resizePanel({ id: panelId, size }));
            }
            isResizing = false;
        });
    }

    async restoreFloatingPanels() {
        const state = appStore.getState();
        const panels = state.panels.panels || {};
        
        console.log('SidebarManager: Checking for floating panels to restore...', Object.keys(panels));
        
        for (const panelState of Object.values(panels)) {
            console.log(`Panel ${panelState.id}:`, {
                isFloating: panelState.isFloating,
                isDocked: panelState.isDocked,
                x: panelState.x,
                y: panelState.y,
                width: panelState.width,
                height: panelState.height
            });
            
            if (panelState.isFloating && !panelState.isDocked) {
                console.log('SidebarManager: Restoring floating panel', panelState.id);
                await this.mountFloatingPanel(panelState);
            }
        }
    }

    async mountFloatingPanel(panelState) {
        const { id: panelId, x, y, width, height } = panelState;
        const config = this.panelConfigs[panelId];
        if (!config) return;

        // Check if floating panel already exists
        const existingPanel = document.getElementById(`floating-panel-${panelId}`);
        if (existingPanel) {
            console.log('Floating panel already exists, skipping:', panelId);
            return;
        }

        // Create simple floating panel HTML
        const panel = document.createElement('div');
        panel.id = `floating-panel-${panelId}`;
        panel.className = 'floating-panel';
        panel.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            width: ${width}px;
            height: ${height}px;
            background: var(--color-bg);
            border: 1px solid var(--color-border);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            display: flex;
            flex-direction: column;
        `;

        panel.innerHTML = `
            <div class="floating-panel-header" style="
                padding: 8px 12px;
                background: var(--color-bg-alt);
                border-bottom: 1px solid var(--color-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
            ">
                <span style="font-size: 12px; font-weight: 500;">${config.title} (floating)</span>
                <button data-action="close-floating" data-panel-id="${panelId}"
                        style="background: none; border: none; cursor: pointer; font-size: 16px; color: var(--color-text-secondary);">×</button>
            </div>
            <div class="floating-panel-content" style="
                flex: 1;
                overflow: hidden;
            " id="floating-panel-content-${panelId}">
                <!-- Panel content will be rendered here -->
            </div>
            <div class="resize-handle resize-handle-se" style="
                position: absolute;
                bottom: 0;
                right: 0;
                width: 12px;
                height: 12px;
                cursor: se-resize;
                background: linear-gradient(-45deg, transparent 0%, transparent 30%, var(--color-border) 30%, var(--color-border) 35%, transparent 35%, transparent 65%, var(--color-border) 65%, var(--color-border) 70%, transparent 70%);
            "></div>
        `;

        // Make it draggable and resizable
        this.makeDraggable(panel);
        this.makeResizable(panel);
        
        // Add close button event listener
        const closeButton = panel.querySelector('[data-action="close-floating"]');
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const panelId = closeButton.dataset.panelId;
                this.closeFloatingPanel(panelId);
            });
        }
        
        document.body.appendChild(panel);
        
        // Render the actual panel content in the floating panel
        try {
            const panelInstance = await panelRegistry.createPanel(panelId, {
                id: panelId,
                title: config.title,
                type: panelId
            });

            if (panelInstance && typeof panelInstance.renderContent === 'function') {
                const floatingContent = document.getElementById(`floating-panel-content-${panelId}`);
                if (floatingContent) {
                    const content = panelInstance.renderContent();
                    floatingContent.innerHTML = content;
                    
                    if (typeof panelInstance.onMount === 'function') {
                        await panelInstance.onMount(floatingContent);
                    }
                }
            }
        } catch (error) {
            getLogger().error(`Failed to render floating panel content for ${panelId}:`, error);
        }
    }

    /**
     * Get saved panel order for a category from Redux state
     */
    getPanelOrder(category) {
        const state = appStore.getState();
        return state.panels.panelOrders[category];
    }

    /**
     * Save panel order for a category to Redux state
     */
    savePanelOrder(category, panelIds) {
        appStore.dispatch(panelActions.setPanelOrder({ category, panelIds }));
    }

    /**
     * Order panels according to saved order, with fallback to config order
     */
    orderPanels(categoryPanels, savedOrder) {
        if (!savedOrder || savedOrder.length === 0) {
            // Initialize order with current config order
            const panelIds = categoryPanels.map(([panelId]) => panelId);
            this.savePanelOrder(this.activeCategory, panelIds);
            return categoryPanels;
        }

        // Create a map for quick lookup
        const panelMap = new Map(categoryPanels);
        
        // Order according to saved order, then add any new panels
        const orderedPanels = [];
        const usedPanels = new Set();

        // Add panels in saved order
        savedOrder.forEach(panelId => {
            if (panelMap.has(panelId)) {
                orderedPanels.push([panelId, panelMap.get(panelId)]);
                usedPanels.add(panelId);
            }
        });

        // Add any new panels that weren't in the saved order
        categoryPanels.forEach(([panelId, config]) => {
            if (!usedPanels.has(panelId)) {
                orderedPanels.push([panelId, config]);
            }
        });

        // Update saved order if it's out of sync (new panels, stale IDs, etc.)
        const newOrder = orderedPanels.map(([panelId]) => panelId);
        if (newOrder.length !== savedOrder.length || newOrder.some((id, index) => id !== savedOrder[index])) {
            this.savePanelOrder(this.activeCategory, newOrder);
        }

        return orderedPanels;
    }

    /**
     * Helper function to get element with closest method (handles SVG elements)
     */
    getElementWithClosest(target) {
        let element = target;
        while (element && !element.closest) {
            element = element.parentElement;
        }
        return element;
    }

    /**
     * Initialize drag and drop functionality using DragDropManager
     */
    initializeDragDrop() {
        const container = this.container.querySelector('.panels-container');
        if (!container) {
            console.log('[SidebarManager] No .panels-container found for drag-drop');
            return;
        }

        console.log('[SidebarManager] Initializing drag-drop for container:', container);
        console.log('[SidebarManager] Container has', container.children.length, 'children');

        // Clean up existing drag drop manager
        if (this.dragDropManager) {
            this.dragDropManager.destroy();
        }

        // Create new drag drop manager with reorder callback
        this.dragDropManager = new DragDropManager((fromIndex, toIndex) => {
            this.reorderPanel(fromIndex, toIndex);
        });

        // Initialize with the container
        this.dragDropManager.initialize(container);
    }

    /**
     * Reorder a panel from one index to another
     */
    reorderPanel(fromIndex, toIndex) {
        console.log(`[SidebarManager] Reordering panel from ${fromIndex} to ${toIndex}`);
        
        appStore.dispatch(panelActions.reorderPanel({
            category: this.activeCategory,
            fromIndex,
            toIndex
        }));
        
        // Don't re-render immediately - let the store subscription handle it
        // The render will be triggered by the state change
    }

    setupEventListeners() {
        const container = this.container.querySelector('#panels-list');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const panelId = target.dataset.panelId;

            if (action === 'toggle-panel') {
                this.togglePanel(panelId);
            } else if (action === 'float-panel') {
                e.stopPropagation(); // Prevent toggling when floating
                this.createFloatingPanel(panelId);
            } else if (action === 'close-panel') {
                this.closePanel(panelId);
            } else if (action === 'close-floating') {
                this.closeFloatingPanel(panelId);
            }
        });

        // Drag and drop is now handled by initializeDragDrop()
        
        // Handle panel header clicks vs drags
        let dragStartTime = 0;
        let dragStartPos = { x: 0, y: 0 };
        let isDragOperation = false;
        
        container.addEventListener('mousedown', (e) => {
            const targetElement = this.getElementWithClosest(e.target);
            const panelHeader = targetElement ? targetElement.closest('.panel-header') : null;
            
            if (panelHeader) {
                dragStartTime = Date.now();
                dragStartPos = { x: e.clientX, y: e.clientY };
                isDragOperation = false;
            }
        });
        
        container.addEventListener('mousemove', (e) => {
            if (dragStartTime > 0) {
                const distance = Math.sqrt(
                    Math.pow(e.clientX - dragStartPos.x, 2) + 
                    Math.pow(e.clientY - dragStartPos.y, 2)
                );
                
                // If moved more than 5px, consider it a drag
                if (distance > 5) {
                    isDragOperation = true;
                }
            }
        });
        
        container.addEventListener('mouseup', (e) => {
            dragStartTime = 0;
            // Reset drag operation flag after a short delay to allow click event to fire
            setTimeout(() => {
                isDragOperation = false;
            }, 10);
        });
        
        container.addEventListener('click', (e) => {
            const targetElement = this.getElementWithClosest(e.target);
            const panelHeader = targetElement ? targetElement.closest('.panel-header') : null;
            const controlBtn = targetElement ? targetElement.closest('.panel-control-btn') : null;
            
            // If clicking a control button, don't prevent the click
            if (controlBtn) {
                return;
            }
            
            if (panelHeader && isDragOperation) {
                // If this was a drag operation, prevent the click
                e.stopPropagation();
                e.preventDefault();
                return;
            }
        });
    }

    




    addSidebarStyles() {
        if (document.getElementById('sidebar-manager-styles')) return;

        const style = document.createElement('style');
        style.id = 'sidebar-manager-styles';
        style.textContent = `
            /* Category Tabs */
            .sidebar-category-tabs {
                display: flex;
                gap: var(--space-1);
                padding: var(--space-3) var(--space-2);
                margin-bottom: var(--space-3);
                flex-wrap: wrap;
                border-bottom: 1px solid var(--color-border);
            }

            .category-tab {
                display: flex;
                align-items: center;
                gap: var(--space-1);
                padding: var(--space-1-5) var(--space-3);
                border-radius: var(--radius-full);
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-medium);
                text-transform: capitalize;
                white-space: nowrap;
                transition: var(--transition-fast);
            }

            .category-tab .tab-icon {
                font-size: var(--font-size-sm);
                opacity: 0.8;
            }

            .category-tab.active {
                background-color: var(--color-primary);
                color: var(--color-primary-foreground);
                border-color: var(--color-primary);
            }

            .category-tab.active .tab-icon {
                opacity: 1;
            }

            /* Sidebar Content */
            .sidebar-content {
                padding: 0 8px;
                overflow-y: auto;
                flex: 1;
            }

            .panels-container {
                padding-bottom: 20px; /* Add space for dropping at the end */
            }

            /* Panel Items */
            .panel-item {
                margin-bottom: var(--space-3);
                border-radius: var(--radius-lg);
                overflow: hidden;
                background: var(--color-bg-elevated);
                border: 1px solid var(--color-border);
                box-shadow: var(--shadow-sm);
                transition: var(--transition-fast);
            }

            .panel-item:hover {
                box-shadow: var(--shadow-md);
                border-color: var(--color-border-hover);
            }

            .panel-item.floating .panel-header {
                background: var(--color-bg-alt);
                opacity: 0.9;
            }

            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-3) var(--space-4);
                background: var(--color-bg-alt);
                cursor: pointer;
                transition: var(--transition-fast);
                border-bottom: 1px solid var(--color-border);
                gap: var(--space-2);
            }

            .panel-header[draggable="true"] {
                cursor: grab;
                user-select: none;
            }

            .panel-header[draggable="true"]:hover {
                background: var(--color-bg-hover);
            }

            .panel-header[draggable="true"]:active {
                cursor: grabbing;
            }

            .panel-drag-indicator {
                color: var(--color-fg-muted);
                font-size: 10px;
                opacity: 0.5;
                transition: opacity 0.2s ease;
                line-height: 1;
            }

            .panel-header:hover .panel-drag-indicator {
                opacity: 1;
                color: var(--color-primary);
            }

            .panel-controls {
                display: flex;
                align-items: center;
                gap: var(--space-1);
            }

            .panel-control-btn {
                background: transparent;
                border: none;
                cursor: pointer;
                font-size: 10px;
                color: var(--color-fg-muted);
                padding: 2px;
                border-radius: var(--radius-sm);
                transition: all 0.2s ease;
                line-height: 1;
                width: 14px;
                height: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.6;
            }

            .panel-control-btn:hover {
                color: var(--color-primary);
                background: transparent;
                opacity: 1;
                transform: scale(1.2);
            }

            .panel-control-btn:active {
                transform: scale(0.9);
                opacity: 0.8;
            }

            .panel-item.dragging {
                opacity: 0.8;
                transform: rotate(1deg) scale(1.05);
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                z-index: 1000;
                border: 2px solid var(--color-primary);
                background: var(--color-bg-elevated);
            }

            /* SortableJS Classes */
            .sortable-ghost {
                opacity: 0.4;
                background: var(--color-primary-background);
                border: 2px dashed var(--color-primary);
            }

            .sortable-chosen {
                opacity: 0.9;
                transform: scale(1.02);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .sortable-drag {
                opacity: 1;
                transform: rotate(2deg);
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                z-index: 1000;
            }

            .drop-indicator {
                height: 3px;
                background: var(--color-primary);
                margin: 6px 8px;
                border-radius: 2px;
                opacity: 1;
                box-shadow: 0 0 4px var(--color-primary);
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 0.4; }
            }

            .panels-reorder-hint {
                display: flex;
                align-items: center;
                gap: var(--space-1);
                padding: var(--space-2);
                margin-bottom: var(--space-2);
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                font-size: var(--font-size-xs);
                color: var(--color-fg-muted);
                opacity: 0.8;
            }

            .panels-reorder-hint .hint-icon {
                color: var(--color-primary);
                font-weight: bold;
            }

            .panel-header:hover {
                background: var(--color-bg-hover);
            }

            .panel-title {
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-semibold);
                color: var(--color-fg);
                margin: 0;
            }

            .panel-controls {
                display: flex;
                align-items: center;
                gap: var(--space-1);
            }

            .panel-btn {
                background: transparent;
                border: 1px solid transparent;
                cursor: pointer;
                padding: var(--space-1);
                border-radius: var(--radius-base);
                font-size: var(--font-size-xs);
                color: var(--color-fg-muted);
                transition: var(--transition-fast);
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
            }

            .panel-btn:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-border);
                color: var(--color-fg);
            }

            /* Panel Content */
            .panel-content {
                padding: var(--space-4);
                background: var(--color-bg-elevated);
            }

            .panel-description {
                font-size: var(--font-size-xs);
                color: var(--color-fg-muted);
                line-height: var(--line-height-normal);
                margin: 0 0 var(--space-2) 0;
            }

            /* Panel Instance Styling */
            .panel-instance-container {
                margin-top: var(--space-2);
                padding: var(--space-2);
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-base);
                width: 100%;
                max-width: 100%;
                overflow: hidden;
                box-sizing: border-box;
            }

            /* Ensure panel content respects container bounds */
            .panel-instance-container * {
                max-width: 100%;
                box-sizing: border-box;
            }

            /* Design tokens panel specific constraints */
            .panel-instance-container .design-tokens-header {
                flex-direction: column;
                gap: var(--space-2);
            }

            .panel-instance-container .header-actions {
                flex-direction: column;
                gap: var(--space-1);
                width: 100%;
            }

            .panel-instance-container .token-search-input {
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
            }

            .panel-instance-container .view-toggle {
                width: 100%;
                justify-content: center;
            }

            .panel-instance-container .tokens-container {
                max-height: 300px;
                overflow-y: auto;
            }

            .panel-instance-container .token-row {
                font-size: 10px;
                padding: 4px;
            }

            .panel-instance-container .design-tokens-filters {
                padding: 8px;
            }

            .panel-instance-container .category-filters {
                flex-wrap: wrap;
                gap: 4px;
            }

            .panel-instance-container .category-filter {
                font-size: 9px;
                padding: 2px 6px;
            }

            .panel-instance-container .tokens-container.grid-view {
                display: grid;
                grid-template-columns: auto 1fr;
                gap: var(--space-1) var(--space-3);
                align-items: center;
            }

            .panel-instance-container .token-row {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                padding: var(--space-2) 0;
                border-bottom: 1px solid var(--color-border);
            }
            
            .panel-instance-container .tokens-container.list-view .token-row:last-child {
                border-bottom: none;
            }
            
            .panel-instance-container .token-color-swatch {
                width: 16px;
                height: 16px;
                border-radius: var(--radius-sm);
                border: 1px solid var(--color-border);
                flex-shrink: 0;
            }

            .panel-instance-container .token-info {
                font-size: 10px;
            }

            .panel-instance-container .token-name {
                font-weight: var(--font-weight-medium);
            }

            .panel-instance-container .token-value {
                color: var(--color-fg-muted);
            }

            .panel-instance-container .tokens-container.grid-view .token-value {
                text-align: right;
                font-family: var(--font-mono);
            }

            .panel-fallback, .panel-error {
                padding: var(--space-2);
                text-align: center;
                font-size: var(--font-size-xs);
                color: var(--color-fg-muted);
                font-style: italic;
            }

            .panel-error {
                color: var(--color-error);
                background: var(--color-error-background);
                border-radius: var(--radius-base);
            }

            /* Publish Panel Specific Styles */
            .publish-panel-content .publish-section {
                margin-bottom: var(--space-3);
            }

            .publish-panel-content .section-title {
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-semibold);
                margin-bottom: var(--space-2);
                color: var(--color-fg);
            }

            .publish-actions {
                display: flex;
                gap: var(--space-2);
                flex-wrap: wrap;
            }

            .deployment-status .status-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: var(--space-1);
                font-size: var(--font-size-xs);
            }

            .status-ready { color: var(--color-success); }
            .status-success { color: var(--color-success); }
            .status-error { color: var(--color-error); }

            .notification {
                position: fixed;
                top: var(--space-4);
                right: var(--space-4);
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-base);
                font-size: var(--font-size-xs);
                z-index: 9999;
            }

            .notification-info { background: var(--color-primary-background); color: var(--color-primary); }
            .notification-success { background: var(--color-success-background); color: var(--color-success); }
            .notification-warning { background: var(--color-warning-background); color: var(--color-warning); }
            .notification-error { background: var(--color-error-background); color: var(--color-error); }
        `;
        document.head.appendChild(style);
    }

    addStyles() {
        // Legacy method - redirect to new method
        this.addSidebarStyles();
    }

    destroy() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        if (this.header) {
            this.header.destroy();
        }
        if (this.dragDropManager) {
            this.dragDropManager.destroy();
            this.dragDropManager = null;
        }
        this.initialized = false;
    }
}
