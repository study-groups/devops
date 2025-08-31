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

export class SidebarManager {
    constructor() {
        this.container = null;
        this.header = null;
        this.initialized = false;
        this.storeUnsubscribe = null;
        this.panelConfigs = null;
        this.configLoaded = false;
        this.categories = null;
        this.activeCategory = null; // Will be loaded from Redux state
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
        console.log('[SidebarManager] ✅ Initialized');
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
        // CRITICAL FIX: SidebarManager uses direct localStorage, so it doesn't need Redux subscriptions
        // that cause unnecessary re-renders and interfere with TopBarController
        
        // Only subscribe to very specific state changes that actually affect sidebar content
        let lastFloatingPanelsCount = 0;
        
        this.storeUnsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            const panels = state.panels?.panels || {};
            const currentFloatingCount = Object.values(panels).filter(p => p.isFloating).length;
            
            // Only update panel count when floating panels change
            if (currentFloatingCount !== lastFloatingPanelsCount) {
                console.log('[SidebarManager] Floating panels count changed, updating display');
                lastFloatingPanelsCount = currentFloatingCount;
                this.updatePanelCount();
            }
        });
    }

    /**
     * Main render method - renders tabbed sidebar interface
     */
    render() {
        if (!this.container) return;
        
        this.renderTabbedInterface();
    }

    renderTabbedInterface() {
        if (!this.configLoaded || !this.categories) {
            this.container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--color-text-secondary);">
                    Loading sidebar...
                </div>
            `;
            return;
        }

        // DIRECT localStorage load - fuck Redux complexity
        this.activeCategory = localStorage.getItem('devpages_active_category') || 'dev';

        // Create clean tabbed interface HTML without header
        this.container.innerHTML = `
            <div class="sidebar-category-tabs">
                ${Object.entries(this.categories).map(([categoryId, category]) => `
                    <button class="btn btn-ghost btn-sm category-tab ${categoryId === this.activeCategory ? 'active' : ''}" 
                            data-category="${categoryId}"
                            onclick="window.APP.services.sidebarManager.switchCategory('${categoryId}')">
                        <span class="tab-icon">${category.icon}</span>
                        <span class="tab-label">${categoryId}</span>
                    </button>
                `).join('')}
            </div>
            
            <div class="sidebar-content">
                <div id="panels-list"></div>
            </div>
        `;

        this.renderPanelsForCategory();
        this.addSidebarStyles();
        this.restoreFloatingPanels();
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
                        <button onclick="window.APP.panels.getPanel('${panel.id}')?.hide()" 
                                style="background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-size: 12px;">×</button>
                    </div>
                `).join('')}
            `;
        }
    }

    async loadPanelConfiguration() {
        try {
            console.log('[SidebarManager] Loading panel configuration...');
            this.panelConfigs = await panelConfigLoader.getSidebarPanels();
            console.log('[SidebarManager] Got panel configs:', this.panelConfigs);
            
            this.categories = await panelConfigLoader.getCategories();
            console.log('[SidebarManager] Got categories:', this.categories);
            
            this.configLoaded = true;
            console.log('[SidebarManager] ✅ Panel configuration loaded:', Object.keys(this.panelConfigs));
            console.log('[SidebarManager] ✅ Categories loaded:', Object.keys(this.categories));
            
            // Initialize sidebar panel states in Redux if they don't exist
            const state = appStore.getState();
            const currentSidebarPanels = state.panels?.sidebarPanels || {};
            
            console.log('[SidebarManager] Current sidebar panels state:', currentSidebarPanels);
            
            Object.keys(this.panelConfigs).forEach(panelId => {
                if (!(panelId in currentSidebarPanels)) {
                    const config = this.panelConfigs[panelId];
                    console.log(`[SidebarManager] Initializing panel ${panelId} with default expanded: ${config.default_expanded || false}`);
                    appStore.dispatch(panelActions.setSidebarPanelExpanded({
                        panelId,
                        expanded: config.default_expanded || false
                    }));
                } else {
                    console.log(`[SidebarManager] Panel ${panelId} already exists with expanded: ${currentSidebarPanels[panelId].expanded}`);
                }
            });
            
        } catch (error) {
            console.error('[SidebarManager] Failed to load panel configuration:', error);
            
            // Fallback configuration to prevent infinite loading
            this.panelConfigs = {
                'debug-panel': {
                    title: 'Debug Panel',
                    description: 'Basic debug information',
                    category: 'debug',
                    default_expanded: false
                }
            };
            this.categories = {
                debug: {
                    color: '#ff6b6b',
                    icon: '🐛',
                    description: 'Debug tools'
                }
            };
            this.configLoaded = true; // Set to true so it renders
            
            console.log('[SidebarManager] ⚠️ Using fallback configuration');
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
        console.log('[SidebarManager] Current sidebar panel states:', sidebarPanels);
        
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
        this.activeCategory = categoryId;
        
        // DIRECT localStorage save - fuck Redux complexity
        localStorage.setItem('devpages_active_category', categoryId);
        
        this.renderPanelsForCategory();
        this.updateTabStates();
    }

    updateTabStates() {
        const tabs = this.container.querySelectorAll('.category-tab');
        tabs.forEach(tab => {
            const isActive = tab.dataset.category === this.activeCategory;
            tab.classList.toggle('active', isActive);
        });
    }

    renderPanelsForCategory() {
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
        const savedOrder = this.getPanelOrder(this.activeCategory);
        const orderedPanels = this.orderPanels(categoryPanels, savedOrder);

        container.innerHTML = `
            <div class="panels-container" data-category="${this.activeCategory}">
                ${orderedPanels.map(([panelId, config], index) => {
                    // DIRECT localStorage read for expanded and floating state
                    const isExpanded = localStorage.getItem(`devpages_panel_${panelId}_expanded`) === 'true' || 
                                      (localStorage.getItem(`devpages_panel_${panelId}_expanded`) === null && config.default_expanded);
                    const isFloating = localStorage.getItem(`devpages_panel_${panelId}_floating`) === 'true';
                    const categoryColor = this.categories[config.category]?.color || '#666';
                    
                    return `
                        <div class="panel-item ${isExpanded ? 'expanded' : ''} ${isFloating ? 'floating' : ''}" 
                             data-panel-id="${panelId}" 
                             data-index="${index}"
                             draggable="true">
                            <div class="panel-header" onclick="window.APP.services.sidebarManager.togglePanel('${panelId}')">
                                <div class="panel-drag-handle" title="Drag to reorder">⋮⋮</div>
                                <span class="panel-title">${config.title} ${isFloating ? '(floating)' : ''}</span>
                                <div class="panel-controls">
                                    <button class="panel-btn" 
                                            onclick="event.stopPropagation(); window.APP.services.sidebarManager.createFloatingPanel('${panelId}')"
                                            title="Float Panel">⧉</button>
                                </div>
                            </div>
                            <div class="panel-content" style="display: ${isExpanded ? 'block' : 'none'};" id="panel-content-${panelId}">
                                <div class="panel-description">${config.description}</div>
                                <div class="panel-instance-container" id="panel-instance-${panelId}"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Add drag and drop event listeners
        this.setupDragAndDrop();

        // Render actual panel instances for expanded panels
        orderedPanels.forEach(([panelId, config]) => {
            const isExpanded = localStorage.getItem(`devpages_panel_${panelId}_expanded`) === 'true' || 
                              (localStorage.getItem(`devpages_panel_${panelId}_expanded`) === null && config.default_expanded);
            if (isExpanded) {
                this.renderPanelInstance(panelId, config);
            }
        });
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
        // DIRECT localStorage for panel expanded state
        const currentExpanded = localStorage.getItem(`devpages_panel_${panelId}_expanded`) === 'true';
        const newExpanded = !currentExpanded;
        
        localStorage.setItem(`devpages_panel_${panelId}_expanded`, newExpanded.toString());
        
        // Re-render to show the change
        this.renderPanelsForCategory();
    }

    /**
     * Render actual panel instance content
     */
    renderPanelInstance(panelId, config) {
        const container = this.container.querySelector(`#panel-instance-${panelId}`);
        if (!container) return;

        try {
            // Create panel instance using the registry
            const panel = panelRegistry.createPanel(panelId, {
                id: panelId,
                title: config.title,
                type: panelId // Use panelId as type to match registration
            });

            if (panel && typeof panel.renderContent === 'function') {
                // Render panel content
                const content = panel.renderContent();
                container.innerHTML = content;
                
                // Call onMount if available
                if (typeof panel.onMount === 'function') {
                    panel.onMount(container);
                }
                
                console.log(`[SidebarManager] Rendered panel instance: ${panelId}`);
            } else {
                // Fallback to basic description
                container.innerHTML = `<div class="panel-fallback">Panel content not available</div>`;
                console.warn(`[SidebarManager] No renderContent method for panel: ${panelId}`);
            }
        } catch (error) {
            console.error(`[SidebarManager] Failed to render panel ${panelId}:`, error);
            container.innerHTML = `<div class="panel-error">Failed to load panel: ${error.message}</div>`;
        }
    }

    togglePanelFloating(panelId) {
        console.log(`[SidebarManager] Toggling floating for panel: ${panelId}`);
        appStore.dispatch(panelActions.togglePanelFloating(panelId));
    }

    closePanel(panelId) {
        console.log(`[SidebarManager] Closing panel: ${panelId}`);
        appStore.dispatch(panelActions.hidePanel(panelId));
    }

    createFloatingPanel(panelId) {
        const config = this.panelConfigs[panelId];
        if (!config) {
            console.error(`[SidebarManager] Panel configuration not found for id: ${panelId}`);
            return;
        }

        // DIRECT localStorage for floating state - fuck the complex BasePanel system
        localStorage.setItem(`devpages_panel_${panelId}_floating`, 'true');

        // Remove any existing floating panel
        const existingPanel = document.getElementById(`floating-panel-${panelId}`);
        if (existingPanel) {
            existingPanel.remove();
        }

        // Restore saved position or use defaults
        let position = { left: 300, top: 100 };
        try {
            const savedPosition = localStorage.getItem(`devpages_panel_${panelId}_position`);
            if (savedPosition) {
                position = JSON.parse(savedPosition);
                console.log(`[SidebarManager] Restoring position for ${panelId}:`, position);
            }
        } catch (error) {
            console.warn(`[SidebarManager] Failed to restore position for ${panelId}:`, error);
        }

        // Create simple floating panel HTML
        const panel = document.createElement('div');
        panel.id = `floating-panel-${panelId}`;
        panel.className = 'floating-panel';
        panel.style.cssText = `
            position: fixed;
            top: ${position.top}px;
            left: ${position.left}px;
            width: 400px;
            height: 300px;
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
                <span style="font-size: 12px; font-weight: 500;">${config.title}</span>
                <button onclick="window.APP.services.sidebarManager.closeFloatingPanel('${panelId}')" 
                        style="background: none; border: none; cursor: pointer; font-size: 16px; color: var(--color-text-secondary);">×</button>
            </div>
            <div class="floating-panel-content" style="
                flex: 1;
                overflow: hidden;
            " id="floating-panel-content-${panelId}">
                <!-- Panel content will be rendered here -->
            </div>
        `;

        // Make it draggable
        this.makeDraggable(panel);
        document.body.appendChild(panel);
        
        // Render the actual panel content in the floating panel
        try {
            const panelInstance = panelRegistry.createPanel(panelId, {
                id: panelId,
                title: config.title,
                type: panelId
            });

            if (panelInstance && typeof panelInstance.renderContent === 'function') {
                const floatingContent = document.getElementById(`floating-panel-content-${panelId}`);
                if (floatingContent) {
                    const content = panelInstance.renderContent();
                    floatingContent.innerHTML = content;
                    
                    // Call onMount if available
                    if (typeof panelInstance.onMount === 'function') {
                        panelInstance.onMount(floatingContent);
                    }
                    
                    console.log(`[SidebarManager] Rendered floating panel content: ${panelId}`);
                }
            }
        } catch (error) {
            console.error(`[SidebarManager] Failed to render floating panel content for ${panelId}:`, error);
        }
        
        // Re-render sidebar to show updated state
        this.renderPanelsForCategory();
    }

    closeFloatingPanel(panelId) {
        const panel = document.getElementById(`floating-panel-${panelId}`);
        if (panel) {
            panel.remove();
        }
        // Clean up both floating state and position
        localStorage.removeItem(`devpages_panel_${panelId}_floating`);
        localStorage.removeItem(`devpages_panel_${panelId}_position`);
        this.renderPanelsForCategory();
    }

    makeDraggable(panel) {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        const panelId = panel.id.replace('floating-panel-', '');

        const header = panel.querySelector('.floating-panel-header');
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
                const position = {
                    left: rect.left,
                    top: rect.top
                };
                localStorage.setItem(`devpages_panel_${panelId}_position`, JSON.stringify(position));
                console.log(`[SidebarManager] Saved position for ${panelId}:`, position);
            }
            isDragging = false;
        });
    }

    restoreFloatingPanels() {
        // Check localStorage for floating panels and restore them
        if (!this.panelConfigs) return;
        
        Object.keys(this.panelConfigs).forEach(panelId => {
            const isFloating = localStorage.getItem(`devpages_panel_${panelId}_floating`) === 'true';
            if (isFloating) {
                // Restore the floating panel
                this.createFloatingPanel(panelId);
            }
        });
    }

    /**
     * Get saved panel order for a category from localStorage
     */
    getPanelOrder(category) {
        const key = `devpages_panel_order_${category}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                console.warn(`[SidebarManager] Failed to parse saved order for ${category}:`, error);
            }
        }
        return null;
    }

    /**
     * Save panel order for a category to localStorage
     */
    savePanelOrder(category, panelIds) {
        const key = `devpages_panel_order_${category}`;
        localStorage.setItem(key, JSON.stringify(panelIds));
        
        // Also update Redux state
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

        // Update saved order if we added new panels
        if (orderedPanels.length !== savedOrder.length) {
            const newOrder = orderedPanels.map(([panelId]) => panelId);
            this.savePanelOrder(this.activeCategory, newOrder);
        }

        return orderedPanels;
    }

    /**
     * Setup drag and drop event listeners for panel reordering
     */
    setupDragAndDrop() {
        const container = this.container.querySelector('.panels-container');
        if (!container) return;

        let draggedElement = null;
        let draggedIndex = null;
        let dropIndicator = null;

        // Create drop indicator element
        const createDropIndicator = () => {
            const indicator = document.createElement('div');
            indicator.className = 'drop-indicator';
            indicator.style.cssText = `
                height: 2px;
                background: var(--color-primary);
                margin: 4px 0;
                border-radius: 1px;
                opacity: 0.8;
            `;
            return indicator;
        };

        container.addEventListener('dragstart', (e) => {
            const panelItem = e.target.closest('.panel-item');
            if (!panelItem) return;

            draggedElement = panelItem;
            draggedIndex = parseInt(panelItem.dataset.index);
            
            // Add visual feedback
            panelItem.style.opacity = '0.5';
            
            // Set drag data
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', panelItem.dataset.panelId);
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const panelItem = e.target.closest('.panel-item');
            if (!panelItem || panelItem === draggedElement) {
                if (dropIndicator) {
                    dropIndicator.remove();
                    dropIndicator = null;
                }
                return;
            }

            // Remove existing indicator
            if (dropIndicator) {
                dropIndicator.remove();
            }

            // Create new indicator
            dropIndicator = createDropIndicator();
            
            // Determine drop position
            const rect = panelItem.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                // Insert before
                panelItem.parentNode.insertBefore(dropIndicator, panelItem);
            } else {
                // Insert after
                panelItem.parentNode.insertBefore(dropIndicator, panelItem.nextSibling);
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (!draggedElement || !dropIndicator) return;

            const targetIndex = Array.from(container.children).indexOf(dropIndicator) - 1; // -1 because indicator is inserted
            
            if (targetIndex !== draggedIndex && targetIndex >= 0) {
                this.reorderPanel(draggedIndex, targetIndex);
            }

            // Cleanup
            if (dropIndicator) {
                dropIndicator.remove();
                dropIndicator = null;
            }
        });

        container.addEventListener('dragend', (e) => {
            // Reset visual feedback
            if (draggedElement) {
                draggedElement.style.opacity = '';
                draggedElement = null;
                draggedIndex = null;
            }
            
            // Cleanup indicator
            if (dropIndicator) {
                dropIndicator.remove();
                dropIndicator = null;
            }
        });

        container.addEventListener('dragleave', (e) => {
            // Only remove indicator if we're leaving the container entirely
            if (!container.contains(e.relatedTarget)) {
                if (dropIndicator) {
                    dropIndicator.remove();
                    dropIndicator = null;
                }
            }
        });
    }

    /**
     * Reorder a panel from one index to another
     */
    reorderPanel(fromIndex, toIndex) {
        const savedOrder = this.getPanelOrder(this.activeCategory);
        if (!savedOrder) return;

        const newOrder = [...savedOrder];
        const [movedPanel] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedPanel);

        // Save new order
        this.savePanelOrder(this.activeCategory, newOrder);

        // Re-render to show new order
        this.renderPanelsForCategory();

        console.log(`[SidebarManager] Reordered panel from ${fromIndex} to ${toIndex} in ${this.activeCategory}`);
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

            .panel-drag-handle {
                cursor: grab;
                color: var(--color-fg-muted);
                font-size: var(--font-size-xs);
                padding: var(--space-1);
                border-radius: var(--radius-base);
                transition: var(--transition-fast);
                user-select: none;
                line-height: 1;
            }

            .panel-drag-handle:hover {
                color: var(--color-fg);
                background: var(--color-bg-hover);
            }

            .panel-item[draggable="true"]:active .panel-drag-handle {
                cursor: grabbing;
            }

            .panel-item.dragging {
                opacity: 0.5;
                transform: rotate(2deg);
            }

            .drop-indicator {
                height: 2px;
                background: var(--color-primary);
                margin: 4px 0;
                border-radius: 1px;
                opacity: 0.8;
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 0.4; }
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
        this.initialized = false;
    }
}
