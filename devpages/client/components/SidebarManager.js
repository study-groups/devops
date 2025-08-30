/**
 * SidebarManager.js - Tag-based panel organization system
 * 
 * Manages sidebar with tag-based tabs that organize panels by category:
 * - settings: Theme, configuration panels
 * - debug: Diagnostic, Redux inspector panels  
 * - publish: Deployment, build panels
 */

import { appStore } from '../appState.js';
import { panelRegistry } from '../panels/BasePanel.js';

export class SidebarManager {
    constructor() {
        this.initialized = false;
        this.currentTag = 'settings';
        this.tags = new Map();
        this.panelConfigs = new Map();
        this.sidebarElement = null;
        this.contentArea = null;
        
        // Per-tag persistent state and contexts
        this.tagStates = new Map();
        this.tagContexts = new Map(); // Each tag gets its own display context
        this.storageKey = 'devpages-sidebar-state';
        
        // Initialize tag categories
        this.initializeTags();
        this.loadTagStates();
        this.activePanel = null;
    }

    initializeTags() {
        this.tags.set('settings', {
            label: 'Settings',
            icon: 'S',
            panels: [],
            description: 'Configuration and preferences'
        });
        
        this.tags.set('debug', {
            label: 'Debug',
            icon: 'D',
            panels: [],
            description: 'Diagnostic and development tools'
        });
        
        this.tags.set('publish', {
            label: 'Publish',
            icon: 'P',
            panels: [],
            description: 'Deployment and publishing'
        });

        // Initialize contexts for each tag
        this.tags.forEach((config, tag) => {
            this.tagContexts.set(tag, {
                element: null,
                stackContainer: null,
                floatingContainer: null,
                activePanels: new Map(), // panelId -> {instance, mode: 'stack'|'floating', position, size}
                displayMode: 'stack', // 'stack' or 'mixed'
                stackOrder: []
            });
        });
    }

    loadTagStates() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                
                // Restore current tag
                if (data.currentTag && this.tags.has(data.currentTag)) {
                    this.currentTag = data.currentTag;
                }
                
                // Restore per-tag states
                if (data.tagStates) {
                    Object.entries(data.tagStates).forEach(([tag, state]) => {
                        this.tagStates.set(tag, {
                            panelOrder: state.panelOrder || [],
                            hiddenPanels: new Set(state.hiddenPanels || []),
                            sortBy: state.sortBy || 'name',
                            filterText: state.filterText || '',
                            expanded: state.expanded !== false // Default to true
                        });
                    });
                }

                // Restore tag contexts
                if (data.tagContexts) {
                    Object.entries(data.tagContexts).forEach(([tag, contextState]) => {
                        const context = this.tagContexts.get(tag);
                        if (context) {
                            context.displayMode = contextState.displayMode || 'stack';
                            context.stackOrder = contextState.stackOrder || [];
                            // Note: activePanels will be restored when panels are recreated
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('[SidebarManager] Failed to load tag states:', error);
        }
        
        // Ensure all tags have default states
        this.tags.forEach((_, tag) => {
            if (!this.tagStates.has(tag)) {
                this.tagStates.set(tag, {
                    panelOrder: [],
                    hiddenPanels: new Set(),
                    sortBy: 'name',
                    filterText: '',
                    expanded: true
                });
            }
        });
    }

    saveTagStates() {
        try {
            const data = {
                currentTag: this.currentTag,
                tagStates: {},
                tagContexts: {}
            };
            
            this.tagStates.forEach((state, tag) => {
                data.tagStates[tag] = {
                    panelOrder: state.panelOrder,
                    hiddenPanels: Array.from(state.hiddenPanels),
                    sortBy: state.sortBy,
                    filterText: state.filterText,
                    expanded: state.expanded
                };
            });

            this.tagContexts.forEach((context, tag) => {
                data.tagContexts[tag] = {
                    displayMode: context.displayMode,
                    stackOrder: context.stackOrder,
                    // Don't save panel instances, just their arrangement
                    panelStates: {}
                };

                // Save panel positions and modes
                context.activePanels.forEach((panelData, panelId) => {
                    data.tagContexts[tag].panelStates[panelId] = {
                        mode: panelData.mode,
                        position: panelData.position,
                        size: panelData.size,
                        stackIndex: panelData.stackIndex
                    };
                });
            });
            
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.warn('[SidebarManager] Failed to save tag states:', error);
        }
    }

    async initialize() {
        if (this.initialized) return this;
        
        console.log('[SidebarManager] Initializing tag-based sidebar...');
        
        // Find or create sidebar container
        this.sidebarElement = document.getElementById('workspace-sidebar');
        if (!this.sidebarElement) {
            console.warn('[SidebarManager] No sidebar container found');
            return this;
        }

        // Load panel configurations
        await this.loadPanelConfigurations();
        
        // Create sidebar structure
        this.createSidebarStructure();
        
        // Set initial tag
        this.switchToTag(this.currentTag);
        this.addPanelManagementTab();
        
        this.initialized = true;
        console.log('[SidebarManager] ✅ Tag-based sidebar initialized');
        
        return this;
    }

    async loadPanelConfigurations() {
        // Load YAML panel configurations
        const panelConfigs = [
            { path: './panels/pdata/auth-panel.yaml', id: 'pdata-auth-panel' },
            { path: './panels/debug/redux-inspector.yaml', id: 'redux-inspector' },
            { path: './panels/publish/deployment-panel.yaml', id: 'deployment-settings' },
            { path: './panels/settings/theme-panel.yaml', id: 'theme-settings' }
        ];

        for (const config of panelConfigs) {
            try {
                // For now, create mock configs based on the YAML structure we saw
                const mockConfig = this.createMockPanelConfig(config.id);
                this.panelConfigs.set(config.id, mockConfig);
                
                // Organize by tags
                if (mockConfig.tags) {
                    mockConfig.tags.forEach(tag => {
                        if (this.tags.has(tag)) {
                            this.tags.get(tag).panels.push(mockConfig);
                        }
                    });
                }
            } catch (error) {
                console.warn(`[SidebarManager] Failed to load ${config.path}:`, error);
            }
        }
    }

    createMockPanelConfig(id) {
        // Create mock configs based on the YAML files we saw
        const configs = {
            'pdata-auth-panel': {
                id: 'pdata-auth-panel',
                name: 'PData Authentication',
                description: 'Manage PData authentication and user sessions',
                tags: ['settings', 'auth'],
                component: { factory: 'createPDataAuthPanel' }
            },
            'redux-inspector': {
                id: 'redux-inspector',
                name: 'Redux Inspector',
                description: 'Inspect Redux state and actions',
                tags: ['debug', 'redux'],
                component: { factory: 'createReduxInspector' }
            },
            'deployment-settings': {
                id: 'deployment-settings',
                name: 'Deployment Settings',
                description: 'Configure deployment targets and publishing options',
                tags: ['publish', 'deployment'],
                component: { factory: 'createDeploymentPanel' }
            },
            'theme-settings': {
                id: 'theme-settings',
                name: 'Theme Settings',
                description: 'Configure application theme and appearance',
                tags: ['settings', 'appearance'],
                component: { factory: 'createThemePanel' }
            }
        };
        
        return configs[id] || {
            id,
            name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: 'Panel description',
            tags: ['debug'],
            component: { factory: 'createGenericPanel' }
        };
    }

    createSidebarStructure() {
        // Add CSS for tag-based sidebar
        this.injectSidebarStyles();
        
        // Create sidebar HTML structure
        this.sidebarElement.innerHTML = `
            <div class="sidebar-top-bar">
                <div class="sidebar-tabs"></div>
            </div>
            <div class="sidebar-tab-content"></div>
        `;

        // Add tag buttons as tabs
        this.tags.forEach((config, tag) => {
            const tab = this.addTab(tag, config.label, config.icon);
            // For now, content will be managed by switchToTag
            tab.content.classList.add('tag-content-area');
        });

        this.contentArea = this.sidebarElement.querySelector('.sidebar-tab-content');
        
        // Create context workspaces for each tag
        this.createTagContexts();
        
        // Attach event listeners for tabs
        this.sidebarElement.querySelector('.sidebar-tabs').addEventListener('click', (e) => {
            const tabButton = e.target.closest('.sidebar-tab');
            if (tabButton && this.tabs[tabButton.dataset.tabId]) {
                const tabId = tabButton.dataset.tabId;
                if (this.tags.has(tabId)) {
                    this.switchToTag(tabId);
                } else {
                    this.openTab(tabId);
                }
            }
        });
        
        // Add ResizeObserver for responsive buttons
        this.setupResponsiveObserver();
    }

    _debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    setupResponsiveObserver() {
        const tabsContainer = this.sidebarElement.querySelector('.sidebar-tabs');
        if (!tabsContainer) return;

        // Debounced handler to prevent ResizeObserver loops
        const handleResize = this._debounce(entry => {
            const containerWidth = entry.contentRect.width;
            const threshold = 190; // From our D2UR analysis
            const hasIconMode = tabsContainer.classList.contains('icon-mode');

            if (containerWidth < threshold && !hasIconMode) {
                tabsContainer.classList.add('icon-mode');
            } else if (containerWidth >= threshold && hasIconMode) {
                tabsContainer.classList.remove('icon-mode');
            }
        }, 50); // 50ms debounce delay

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                handleResize(entry);
            }
        });

        resizeObserver.observe(tabsContainer);
    }

    createTagContexts() {
        // Find the main workspace area
        const workspaceMain = document.querySelector('.workspace-main') || 
                             document.querySelector('.main-content') || 
                             document.body;
        
        this.tags.forEach((config, tag) => {
            const context = this.tagContexts.get(tag);
            const contextElement = document.createElement('div');
            contextElement.className = `tag-context tag-context-${tag}`;
            contextElement.style.display = tag === this.currentTag ? 'block' : 'none';
            
            contextElement.innerHTML = `
                <div class="context-header">
                    <h2 class="context-title">${config.label} Workspace</h2>
                    <div class="context-controls">
                        <button class="context-mode-btn ${context.displayMode === 'stack' ? 'active' : ''}" 
                                data-mode="stack" 
                                title="Stack Mode - Full width panels">
                            ⊞
                        </button>
                        <button class="context-mode-btn ${context.displayMode === 'mixed' ? 'active' : ''}" 
                                data-mode="mixed" 
                                title="Mixed Mode - Stack + Floating">
                            ⧉
                        </button>
                        <button class="context-clear-btn" title="Return all panels to sidebar">
                            ↩
                        </button>
                    </div>
                </div>
                <div class="context-body">
                    <div class="stack-container"></div>
                    <div class="floating-container"></div>
                </div>
            `;
            
            workspaceMain.appendChild(contextElement);
            
            // Store references
            context.element = contextElement;
            context.stackContainer = contextElement.querySelector('.stack-container');
            context.floatingContainer = contextElement.querySelector('.floating-container');
            
            // Attach context control listeners
            this.attachContextControlListeners(contextElement, tag);
        });
    }

    attachContextControlListeners(contextElement, tag) {
        const context = this.tagContexts.get(tag);
        
        // Mode switching
        contextElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('context-mode-btn')) {
                const mode = e.target.dataset.mode;
                this.setContextDisplayMode(tag, mode);
            }
            
            if (e.target.classList.contains('context-clear-btn')) {
                this.returnAllPanelsToSidebar(tag);
            }
        });
    }

    setContextDisplayMode(tag, mode) {
        const context = this.tagContexts.get(tag);
        if (!context) return;
        
        context.displayMode = mode;
        
        // Update button states
        const modeButtons = context.element.querySelectorAll('.context-mode-btn');
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Apply mode-specific styling
        context.element.classList.remove('mode-stack', 'mode-mixed');
        context.element.classList.add(`mode-${mode}`);
        
        this.saveTagStates();
        console.log(`[SidebarManager] Set ${tag} context to ${mode} mode`);
    }

    returnAllPanelsToSidebar(tag) {
        const context = this.tagContexts.get(tag);
        if (!context) return;
        
        // Close all active panels in this context
        const panelsToReturn = Array.from(context.activePanels.keys());
        panelsToReturn.forEach(panelId => {
            const panelData = context.activePanels.get(panelId);
            if (panelData && panelData.instance) {
                // Use the panel's close method which should trigger return to sidebar
                panelData.instance.close();
            }
        });
        
        console.log(`[SidebarManager] Returned ${panelsToReturn.length} panels to sidebar from ${tag} context`);
    }

    attachEventListeners() {
        // Tag switching
        this.sidebarElement.addEventListener('click', (e) => {
            const tagButton = e.target.closest('.sidebar-tag');
            if (tagButton) {
                const tag = tagButton.dataset.tag;
                this.switchToTag(tag);
            }
            
            // Panel actions
            const panelAction = e.target.closest('[data-panel-action]');
            if (panelAction) {
                const action = panelAction.dataset.panelAction;
                const panelId = panelAction.dataset.panelId;
                this.handlePanelAction(action, panelId);
            }
        });
    }

    switchToTag(tag) {
        if (!this.tags.has(tag)) return;
        
        // Save current tag state before switching
        if (this.currentTag !== tag) {
            this.saveCurrentTagState();
            this.hideCurrentContext();
        }
        
        this.openTab(tag); // Use openTab to handle visibility

        const previousTag = this.currentTag;
        this.currentTag = tag;
        
        // Switch context workspaces
        this.showTagContext(tag);
        
        // Update sidebar content area with restored state
        this.updateTagContent(tag);
        
        // Save the tag switch
        this.saveTagStates();
        
        console.log(`[SidebarManager] Switched from ${previousTag} to ${tag} context`);
    }

    hideCurrentContext() {
        const currentContext = this.tagContexts.get(this.currentTag);
        if (currentContext && currentContext.element) {
            currentContext.element.style.display = 'none';
        }
    }

    showTagContext(tag) {
        const context = this.tagContexts.get(tag);
        if (context && context.element) {
            context.element.style.display = 'block';
        }
    }

    saveCurrentTagState() {
        if (!this.contentArea) return;
        
        const tagState = this.tagStates.get(this.currentTag);
        if (!tagState) return;
        
        // Save current panel order from DOM
        const panelCards = this.contentArea.querySelectorAll('.panel-card');
        tagState.panelOrder = Array.from(panelCards).map(card => card.dataset.panelId);
        
        // Save filter text
        const filterInput = this.contentArea.querySelector('.tag-filter-input');
        if (filterInput) {
            tagState.filterText = filterInput.value;
        }
        
        // Save sort option
        const sortSelect = this.contentArea.querySelector('.tag-sort-select');
        if (sortSelect) {
            tagState.sortBy = sortSelect.value;
        }
    }

    updateTagContent(tag) {
        const tagConfig = this.tags.get(tag);
        const tagState = this.tagStates.get(tag);
        if (!tagConfig || !tagState) return;
        
        const tabContent = this.tabs[tag].content;
        tabContent.innerHTML = `
            <div class="tag-content-header">
                <div class="tag-header-main">
                    <h3 class="tag-title">${tagConfig.label}</h3>
                </div>
            </div>
            <div class="tag-panels-list"></div>
        `;
        
        const panelsList = tabContent.querySelector('.tag-panels-list');
        
        // Update panels list with restored order
        this.renderPanelsList(tag, panelsList);
        
        // No controls to attach listeners to anymore
    }

    renderPanelsList(tag, panelsList) {
        const tagConfig = this.tags.get(tag);
        const tagState = this.tagStates.get(tag);
        
        if (tagConfig.panels.length === 0) {
            panelsList.innerHTML = `
                <div class="no-panels-message">
                    <p>No panels available for ${tagConfig.label.toLowerCase()}</p>
                    <button class="btn btn-sm" onclick="window.APP.panels.createTest?.()">
                        Create Test Panel
                    </button>
                </div>
            `;
            return;
        }

        // Simple rendering without filtering or sorting
        let filteredPanels = tagConfig.panels;

        const viewClass = 'panels-list'; // Hardcoded to list view
        
        panelsList.innerHTML = `
            <div class="${viewClass}" data-tag="${tag}">
                ${filteredPanels.map(panel => `
                    <div class="panel-card" 
                         data-panel-id="${panel.id}" 
                         draggable="true">
                        <div class="panel-card-header">
                            <div class="panel-drag-handle">⋮⋮</div>
                            <h4 class="panel-name">${panel.name}</h4>
                            <div class="panel-actions">
                                <button class="panel-action-btn" 
                                        data-panel-action="create" 
                                        data-panel-id="${panel.id}"
                                        title="Create Panel">
                                    +
                                </button>
                            </div>
                        </div>
                        <p class="panel-description">${panel.description}</p>
                        <div class="panel-tags">
                            ${panel.tags.map(t => `<span class="panel-tag">${t}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Disable drag and drop for now
        // this.enablePanelReordering(panelsList);
    }

    attachTagControlListeners() {
        // No-op, controls removed
    }

    handlePanelAction(action, panelId) {
        const panelConfig = this.panelConfigs.get(panelId);
        if (!panelConfig) {
            console.warn(`[SidebarManager] Panel config not found: ${panelId}`);
            return;
        }
        
        switch (action) {
            case 'create':
                this.createPanel(panelConfig);
                break;
            case 'hide':
                this.hidePanelFromTag(panelId);
                break;
            default:
                console.warn(`[SidebarManager] Unknown panel action: ${action}`);
        }
    }

    hidePanelFromTag(panelId) {
        const tagState = this.tagStates.get(this.currentTag);
        if (tagState) {
            tagState.hiddenPanels.add(panelId);
            this.renderPanelsList(this.currentTag, this.tabs[this.currentTag].content.querySelector('.tag-panels-list'));
            this.saveTagStates();
            console.log(`[SidebarManager] Hidden panel ${panelId} from ${this.currentTag} tag`);
        }
    }

    showPanelInTag(panelId, tag = this.currentTag) {
        const tagState = this.tagStates.get(tag);
        if (tagState) {
            tagState.hiddenPanels.delete(panelId);
            if (tag === this.currentTag) {
                this.renderPanelsList(tag, this.tabs[tag].content.querySelector('.tag-panels-list'));
            }
            this.saveTagStates();
            console.log(`[SidebarManager] Showed panel ${panelId} in ${tag} tag`);
        }
    }

    createPanel(panelConfig) {
        // Use the main panel system to create the panel
        if (window.APP?.panels?.createPanel) {
            try {
                // Map panel IDs to their types
                const typeMap = {
                    'redux-inspector': 'redux-inspector',
                    'theme-settings': 'theme-settings',
                    'pdata-auth-panel': 'diagnostic', // Fallback to diagnostic for now
                    'deployment-settings': 'diagnostic' // Fallback to diagnostic for now
                };
                
                const panelType = typeMap[panelConfig.id] || 'diagnostic';
                
                const panel = window.APP.panels.createPanel(panelType, {
                    title: panelConfig.name,
                    id: panelConfig.id
                });
                
                if (panel) {
                    // Add panel to current tag context instead of mounting normally
                    this.addPanelToContext(panel, panelConfig);
                    console.log(`[SidebarManager] Created ${panelType} panel: ${panelConfig.name} in ${this.currentTag} context`);
                }
            } catch (error) {
                console.error(`[SidebarManager] Failed to create panel ${panelConfig.id}:`, error);
            }
        } else {
            console.warn('[SidebarManager] Panel system not available');
        }
    }

    addPanelToContext(panel, panelConfig) {
        const context = this.tagContexts.get(this.currentTag);
        if (!context) {
            console.error('[SidebarManager] No context found for current tag');
            return null;
        }

        // Defensive panel creation fallback
        if (!panel) {
            console.warn(`[SidebarManager] Creating fallback panel for ${panelConfig.id}`);
            panel = {
                id: panelConfig.id || `panel-${Date.now()}`,
                title: panelConfig.name || 'Untitled Panel',
                type: panelConfig.type || 'diagnostic',
                mount: () => {
                    console.warn('Fallback panel mount called');
                    return panel;
                },
                show: () => {
                    console.warn('Fallback panel show called');
                    return panel;
                },
                close: () => {
                    console.warn('Fallback panel close called');
                    return panel;
                }
            };
        }

        // Ensure panel has required methods with safe fallbacks
        const requiredMethods = ['mount', 'show', 'close'];
        requiredMethods.forEach(method => {
            if (typeof panel[method] !== 'function') {
                console.warn(`[SidebarManager] Adding fallback ${method} method to panel`);
                panel[method] = () => {
                    console.warn(`Fallback ${method} method called`);
                    return panel;
                };
            }
        });

        // Safe method binding
        const safeClose = panel.close ? panel.close.bind(panel) : () => {
            console.warn(`[SidebarManager] No native close method for panel ${panelConfig.id}`);
        };

        // Override close method with sidebar-specific behavior
        panel.close = () => {
            try {
                this.returnPanelToSidebar(panel.id, this.currentTag);
                safeClose();
            } catch (error) {
                console.error(`[SidebarManager] Error closing panel ${panel.id}:`, error);
            }
        };

        // Default to stack mode
        const panelData = {
            instance: panel,
            mode: 'stack',
            position: { x: 0, y: 0 },
            size: { width: '100%', height: 'auto' },
            stackIndex: context.stackOrder.length
        };

        // Add to context
        context.activePanels.set(panel.id, panelData);
        context.stackOrder.push(panel.id);

        // Mount in stack container
        try {
            this.mountPanelInStack(panel, context);
            this.saveTagStates();
        } catch (error) {
            console.error(`[SidebarManager] Failed to mount panel ${panel.id}:`, error);
            context.activePanels.delete(panel.id);
            context.stackOrder.pop();
        }

        return panel;
    }

    mountPanelInStack(panel, context) {
        // Create stack wrapper
        const stackWrapper = document.createElement('div');
        stackWrapper.className = 'stack-panel-wrapper';
        stackWrapper.dataset.panelId = panel.id;
        
        // Add stack controls
        stackWrapper.innerHTML = `
            <div class="stack-panel-header">
                <span class="stack-panel-title">${panel.title}</span>
                <div class="stack-panel-controls">
                    <button class="stack-control-btn" data-action="float" title="Make Floating">⧉</button>
                    <button class="stack-control-btn" data-action="close" title="Return to Sidebar">✕</button>
                </div>
            </div>
            <div class="stack-panel-content"></div>
        `;

        // Mount panel in content area
        const contentArea = stackWrapper.querySelector('.stack-panel-content');
        panel.mount(contentArea);
        
        // Add to stack container
        context.stackContainer.appendChild(stackWrapper);
        
        // Attach stack controls
        this.attachStackControlListeners(stackWrapper, panel.id);
        
        // Show panel
        panel.show();
    }

    attachStackControlListeners(stackWrapper, panelId) {
        stackWrapper.addEventListener('click', (e) => {
            if (e.target.classList.contains('stack-control-btn')) {
                const action = e.target.dataset.action;
                
                if (action === 'float') {
                    this.convertStackToFloating(panelId);
                } else if (action === 'close') {
                    this.returnPanelToSidebar(panelId, this.currentTag);
                }
            }
        });
    }

    convertStackToFloating(panelId) {
        const context = this.tagContexts.get(this.currentTag);
        const panelData = context.activePanels.get(panelId);
        
        if (!panelData) return;
        
        // Remove from stack
        const stackWrapper = context.stackContainer.querySelector(`[data-panel-id="${panelId}"]`);
        if (stackWrapper) {
            stackWrapper.remove();
        }
        
        // Update mode
        panelData.mode = 'floating';
        panelData.position = { x: 100, y: 100 };
        panelData.size = { width: '400px', height: '300px' };
        
        // Mount as floating
        this.mountPanelFloating(panelData.instance, context, panelData);
        
        this.saveTagStates();
        console.log(`[SidebarManager] Converted panel ${panelId} to floating mode`);
    }

    mountPanelFloating(panel, context, panelData) {
        // Panel will be mounted in floating container
        panel.mount(context.floatingContainer);
        panel.show();
        
        // Make draggable and resizable
        this.makeFloatingPanel(panel.element, panelData);
    }

    makeFloatingPanel(panelElement, panelData) {
        // Apply floating styles
        panelElement.style.position = 'absolute';
        panelElement.style.left = panelData.position.x + 'px';
        panelElement.style.top = panelData.position.y + 'px';
        panelElement.style.width = panelData.size.width;
        panelElement.style.height = panelData.size.height;
        panelElement.style.zIndex = '1000';
        panelElement.classList.add('floating-panel');
        
        // Make draggable by header
        const header = panelElement.querySelector('.panel-header');
        if (header) {
            this.makeDraggable(panelElement, header, panelData);
        }
    }

    makeDraggable(element, handle, panelData) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        handle.style.cursor = 'move';
        
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(element.style.left) || 0;
            startTop = parseInt(element.style.top) || 0;
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        function onMouseMove(e) {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;
            
            element.style.left = newLeft + 'px';
            element.style.top = newTop + 'px';
            
            panelData.position = { x: newLeft, y: newTop };
        }
        
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }

    returnPanelToSidebar(panelId, tag) {
        const context = this.tagContexts.get(tag);
        if (!context) return;
        
        const panelData = context.activePanels.get(panelId);
        if (panelData) {
            // Remove from context
            context.activePanels.delete(panelId);
            context.stackOrder = context.stackOrder.filter(id => id !== panelId);
            
            // Remove from DOM containers
            const stackWrapper = context.stackContainer.querySelector(`[data-panel-id="${panelId}"]`);
            if (stackWrapper) {
                stackWrapper.remove();
            }
            
            this.saveTagStates();
            console.log(`[SidebarManager] Returned panel ${panelId} to sidebar`);
        }
    }

    // Public API methods
    addPanel(panelConfig) {
        this.panelConfigs.set(panelConfig.id, panelConfig);
        
        // Add to appropriate tags
        if (panelConfig.tags) {
            panelConfig.tags.forEach(tag => {
                if (this.tags.has(tag)) {
                    const tagConfig = this.tags.get(tag);
                    if (!tagConfig.panels.find(p => p.id === panelConfig.id)) {
                        tagConfig.panels.push(panelConfig);
                    }
                }
            });
        }
        
        // Refresh current tag if it matches
        if (panelConfig.tags && panelConfig.tags.includes(this.currentTag)) {
            this.updateTagContent(this.currentTag);
        }
    }

    removePanel(panelId) {
        this.panelConfigs.delete(panelId);
        
        // Remove from all tags
        this.tags.forEach(tagConfig => {
            tagConfig.panels = tagConfig.panels.filter(p => p.id !== panelId);
        });
        
        // Refresh current tag
        this.updateTagContent(this.currentTag);
    }

    getCurrentTag() {
        return this.currentTag;
    }

    getTagPanels(tag) {
        return this.tags.get(tag)?.panels || [];
    }

    injectSidebarStyles() {
        if (document.getElementById('sidebar-tag-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sidebar-tag-styles';
        style.textContent = `
            #workspace-sidebar .sidebar-top-bar {
                background: var(--color-bg-alt, #f8f9fa);
                border-bottom: 1px solid var(--color-border, #ddd);
                padding: 1px 4px;
                display: flex;
                align-items: center;
            }
            
            #workspace-sidebar .sidebar-tabs {
                display: flex;
                gap: 1px;
                flex: 1;
            }
            
            #workspace-sidebar .sidebar-tab {
                display: flex;
                align-items: center;
                gap: 1px;
                padding: 2px 6px;
                border: 1px solid rgba(0,0,0,0.1); /* Ghost border */
                background: transparent;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                color: var(--color-text-secondary, #666);
                transition: all 0.15s ease;
                opacity: 0.7; /* Make ghost buttons more visible */
                min-width: 60px; /* Set a fixed min-width to stop resizing */
                justify-content: center; /* Center content within the fixed width */
            }

            /* --- Responsive Icon Mode --- */
            #workspace-sidebar .sidebar-tabs.icon-mode .sidebar-tab {
                min-width: 28px; /* Small, square-like size */
                padding: 2px;
            }

            #workspace-sidebar .tag-icon {
                display: none; /* Hidden by default */
                font-size: 12px;
                font-weight: 600;
            }

            #workspace-sidebar .sidebar-tabs.icon-mode .tag-icon {
                display: inline-block; /* Visible in icon mode */
            }

            #workspace-sidebar .sidebar-tabs.icon-mode .tag-label {
                display: none; /* Hidden in icon mode */
            }
            
            #workspace-sidebar .sidebar-tab:hover {
                background: rgba(0,0,0,0.05);
                border-color: rgba(0,0,0,0.2);
                opacity: 1;
            }
            
            #workspace-sidebar .sidebar-tab.active {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
                opacity: 1;
            }
            
            #workspace-sidebar .sidebar-tab.active:hover {
                filter: brightness(90%);
            }
            
            #workspace-sidebar .tag-label {
                font-weight: 500;
                display: inline-block;
                white-space: nowrap;
                /* REMOVED max-width transition to stop layout shift */
            }
            
            #workspace-sidebar .sidebar-tab:hover .tag-label,
            #workspace-sidebar .sidebar-tab.active .tag-label {
                /* REMOVED max-width expansion */
            }
            
            /* Responsive icon-only mode */
            @media (max-width: 600px) {
                #workspace-sidebar .sidebar-tab .tag-label {
                    max-width: 0;
                }
            }
            
            .sidebar-content-area {
                flex: 1;
                padding: 16px 12px;
                overflow-y: auto;
            }
            
            .tag-content-header {
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--color-border, #eee);
            }
            
            .tag-title {
                margin: 0 0 4px 0;
                font-size: 14px;
                font-weight: 600;
                color: var(--color-text, #333);
            }
            
            .tag-description {
                margin: 0;
                font-size: 11px;
                color: var(--color-text-secondary, #666);
            }
            
            .panels-grid {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .panel-card {
                background: var(--color-bg, #fff);
                border: 1px solid var(--color-border, #ddd);
                border-radius: 3px;
                padding: 8px;
                transition: border-color 0.15s ease;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            
            .panel-card:hover {
                border-color: var(--color-primary, #007bff);
            }
            
            .panel-card-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                border-bottom: 1px solid var(--color-border, #eee);
                padding-bottom: 4px;
            }
            
            .panel-name {
                margin: 0;
                font-size: 10px;
                font-weight: 600;
                color: var(--color-text, #333);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .panel-actions {
                display: flex;
                gap: 2px;
            }
            
            .panel-action-btn {
                width: 16px;
                height: 16px;
                border: 1px solid transparent;
                background: transparent;
                border-radius: 2px;
                cursor: pointer;
                font-size: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--color-text-secondary, #666);
                transition: all 0.15s ease;
            }
            
            .panel-action-btn:hover {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
            }
            
            .panel-description {
                margin: 0 0 6px 0;
                font-size: 8px;
                color: var(--color-text-secondary, #666);
                line-height: 1.3;
                font-style: italic;
            }
            
            .panel-tags {
                display: flex;
                gap: 2px;
                flex-wrap: wrap;
            }
            
            .panel-tag {
                background: transparent;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 2px;
                padding: 1px 3px;
                font-size: 7px;
                color: var(--color-text-secondary, #666);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .no-panels-message {
                text-align: center;
                padding: 24px 16px;
                color: var(--color-text-secondary, #666);
            }
            
            .no-panels-message p {
                margin: 0 0 12px 0;
                font-size: 11px;
            }
            
            .no-panels-message .btn {
                padding: 6px 12px;
                font-size: 10px;
                background: var(--color-primary, #007bff);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }

            /* Tag Context Workspaces */
            .tag-context {
                position: relative;
                width: 100%;
                height: 100%;
                background: var(--color-bg, #fff);
            }

            .context-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--color-border, #eee);
                background: var(--color-bg-alt, #f8f9fa);
            }

            .context-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--color-text, #333);
            }

            .context-controls {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .context-mode-btn {
                padding: 6px 8px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 3px;
                background: var(--color-bg, #fff);
                color: var(--color-text-secondary, #666);
                cursor: pointer;
                font-size: 14px;
                transition: all 0.15s ease;
            }

            .context-mode-btn:hover {
                background: var(--color-bg-hover, #e9ecef);
            }

            .context-mode-btn.active {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
            }

            .context-clear-btn {
                padding: 6px 8px;
                border: 1px solid var(--color-danger, #dc3545);
                border-radius: 3px;
                background: var(--color-bg, #fff);
                color: var(--color-danger, #dc3545);
                cursor: pointer;
                font-size: 12px;
                transition: all 0.15s ease;
            }

            .context-clear-btn:hover {
                background: var(--color-danger, #dc3545);
                color: white;
            }

            .context-body {
                position: relative;
                height: calc(100% - 60px);
                overflow: hidden;
            }

            /* Stack Container */
            .stack-container {
                width: 100%;
                height: 100%;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .stack-panel-wrapper {
                border: 1px solid var(--color-border, #ddd);
                border-radius: 6px;
                background: var(--color-bg, #fff);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .stack-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: var(--color-bg-alt, #f8f9fa);
                border-bottom: 1px solid var(--color-border, #eee);
                border-radius: 6px 6px 0 0;
            }

            .stack-panel-title {
                font-weight: 600;
                font-size: 12px;
                color: var(--color-text, #333);
            }

            .stack-panel-controls {
                display: flex;
                gap: 4px;
            }

            .stack-control-btn {
                width: 20px;
                height: 20px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 3px;
                background: var(--color-bg, #fff);
                color: var(--color-text-secondary, #666);
                cursor: pointer;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
            }

            .stack-control-btn:hover {
                background: var(--color-bg-hover, #e9ecef);
                border-color: var(--color-primary, #007bff);
            }

            .stack-panel-content {
                padding: 0;
                min-height: 200px;
            }

            /* Floating Container */
            .floating-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 100;
            }

            .floating-panel {
                pointer-events: all;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-radius: 6px;
                background: var(--color-bg, #fff);
                border: 1px solid var(--color-border, #ddd);
            }

            .floating-panel .panel-header {
                cursor: move;
                background: var(--color-bg-alt, #f8f9fa);
                border-bottom: 1px solid var(--color-border, #eee);
            }

            /* Mode-specific styling */
            .tag-context.mode-stack .floating-container {
                display: none;
            }

            .tag-context.mode-mixed .stack-container {
                width: 60%;
            }

            .tag-context.mode-mixed .floating-container {
                left: 60%;
                width: 40%;
            }
        `;
        document.head.appendChild(style);
    }

    addPanelManagementTab() {
        const panelTab = this.addTab('panels', 'Panels', '<i class="fas fa-columns"></i>');
        const panelContent = document.createElement('div');
        panelContent.className = 'panel-list';
        panelTab.content.appendChild(panelContent);

        const registeredPanels = panelRegistry.types;

        registeredPanels.forEach((panelClass, type) => {
            const panelItem = document.createElement('div');
            panelItem.className = 'panel-list-item';
            panelItem.textContent = type;
            panelItem.dataset.panelType = type;
            panelContent.appendChild(panelItem);
        });

        panelContent.addEventListener('click', e => {
            if (e.target.classList.contains('panel-list-item')) {
                const panelType = e.target.dataset.panelType;
                this.launchPanelFromSidebar(panelType, e.target);
            }
        });
    }

    launchPanelFromSidebar(panelType, targetElement) {
        let panel = panelRegistry.getPanel(panelType); // Assume singleton panels for now
        if (!panel) {
            panel = panelRegistry.createPanel(panelType, {
                id: panelType,
                title: `${panelType.charAt(0).toUpperCase() + panelType.slice(1)} Panel`
            });
            panel.mount();
        }

        const rect = targetElement.getBoundingClientRect();
        const initialState = {
            position: { x: rect.left, y: rect.top },
            size: { width: rect.width, height: rect.height }
        };

        panel.updateState(initialState);
        panel.show();
        
        // Center the panel after a short delay to allow for animation from sidebar
        setTimeout(() => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const panelState = panel.getState();
            const targetX = (viewportWidth - panelState.size.width) / 2;
            const targetY = (viewportHeight - panelState.size.height) / 2;
            panel.updateState({ position: { x: targetX, y: targetY } });
            panel.applyStateToElement();
        }, 50);
    }
    
    addTab(id, title, icon) {
        const tab = document.createElement('button');
        tab.className = 'sidebar-tab';
        tab.innerHTML = `
            <span class="tab-icon">${icon}</span>
            <span class="tab-label">${title}</span>
        `;
        tab.dataset.tabId = id;
        this.sidebarElement.querySelector('.sidebar-tabs').appendChild(tab);

        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        this.sidebarElement.querySelector('.sidebar-tab-content').appendChild(tabContent);

        if (!this.tabs) this.tabs = {};
        this.tabs[id] = {
            button: tab,
            content: tabContent
        };
        
        if (Object.keys(this.tabs).length === 1) {
            this.openTab(id);
        }

        return this.tabs[id];
    }
}

// Create and export singleton instance
export const sidebarManager = new SidebarManager();
