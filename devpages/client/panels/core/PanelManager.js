/**
 * @file client/panels/core/PanelManager.js
 * @description Manages the lifecycle of UI panels, including rendering, state, and drag-and-drop.
 */

import { panelRegistry } from './panelRegistry.js';
import { EventManager } from '/client/utils/EventManager.js';

export class PanelManager {
    /**
     * @param {HTMLElement} container - The DOM element to render panels into.
     * @param {string} group - The panel group this manager is responsible for.
     */
    constructor(container, group) {
        if (!container) {
            throw new Error('PanelManager: A container element is required.');
        }
        console.warn(`[PanelManager] Constructor called for group: ${group}`);
        this.container = container;
        this.group = group;
        this.panelConfigs = [];
        this.draggedPanel = null;
        this.isInitialized = false;
        this.initCallCount = 0;
        this.renderCallCount = 0;
        
        // Initialize EventManager for automatic cleanup
        this.eventManager = new EventManager();
        
        console.warn(`[PanelManager] Constructor completed for group: ${group}`);
    }

    /**
     * Initialize the panel manager with current panels from registry
     */
    init() {
        this.initCallCount++;
        console.warn(`[PanelManager] init() called - COUNT: ${this.initCallCount} for group: ${this.group}`);
        
        if (this.initCallCount > 1) {
            console.error(`[PanelManager] WARNING: init() called ${this.initCallCount} times for group: ${this.group}!`);
        }
        
        if (this.isInitialized) {
            console.error(`[PanelManager] Already initialized for group: ${this.group}, skipping`);
            return;
        }
        
        // Ensure the container is clean before we start.
        const existingPanels = this.container.querySelectorAll('.sidebar-panel');
        console.warn(`[PanelManager] Found ${existingPanels.length} existing panels, removing them`);
        existingPanels.forEach(el => el.remove());
        
        this.loadPanelState();
        console.warn(`[PanelManager] Loaded ${this.panelConfigs.length} panel configurations`);
        
        this.renderPanels();
        this.addDragDropHandlers();
        
        this.isInitialized = true;
        console.warn(`[PanelManager] init() completed for group: ${this.group}`);
    }

    /**
     * Loads panel state from localStorage or initializes from the registry.
     */
    loadPanelState() {
        const storageKey = `panelState_v3_${this.group}`;
        const resetFlagKey = 'panelState_reset_v4';

        // One-time reset to clear out old or corrupted state.
        if (!localStorage.getItem(resetFlagKey)) {
            console.warn('PanelManager: Performing one-time reset of panel state.');
            localStorage.removeItem(storageKey); // Clear the current version's state
            localStorage.removeItem(`panelState_v2_${this.group}`); // Clear older versions
            localStorage.removeItem(`panelState_${this.group}`); // Clear oldest versions
            localStorage.removeItem('sidebar_panel_order'); // From old SidebarPanelManager
            localStorage.removeItem('sidebarPanelOrder'); // From old SidebarPanelManager
            localStorage.setItem(resetFlagKey, 'true');
        }

        let finalConfigs = [];

        // Always start with the full panel definitions from the registry
        const registeredPanels = panelRegistry.getAllPanels().filter(p => p.group === this.group);
        const registeredPanelsMap = new Map(registeredPanels.map(p => [p.id, p]));

        try {
            const savedState = JSON.parse(localStorage.getItem(storageKey));
            
            if (!Array.isArray(savedState)) {
                throw new Error("No saved state found, initializing from defaults.");
            }

            // A map for quick lookups of saved state
            const savedStateMap = new Map(savedState.map(p => [p.id, p]));
            
            // Rebuild configs in the saved order
            savedState.forEach(savedPanel => {
                const registeredPanel = registeredPanelsMap.get(savedPanel.id);
                if (registeredPanel) {
                    finalConfigs.push({
                        ...registeredPanel, // The full object with functions/instances
                        isVisible: savedPanel.isVisible,
                        isCollapsed: savedPanel.isCollapsed,
                    });
                }
            });

            // Add any new panels that weren't in the saved state
            const savedIds = new Set(savedState.map(p => p.id));
            registeredPanels.forEach(p => {
                if (!savedIds.has(p.id)) {
                    finalConfigs.push({ ...p, isVisible: p.defaultVisible !== false, isCollapsed: false });
                }
            });

        } catch (e) {
            // Fallback: initialize from registry with default order and state
            registeredPanels.sort((a, b) => (a.priority || 99) - (b.priority || 99));
            finalConfigs = registeredPanels.map(p => ({ ...p, isVisible: p.defaultVisible !== false, isCollapsed: false }));
        }

        this.panelConfigs = finalConfigs;
        this.savePanelState();
    }

    /**
     * Saves the current panel configurations to localStorage.
     */
    savePanelState() {
        const storageKey = `panelState_v3_${this.group}`;
        // Only save the data that can be serialized (no functions or instances)
        const serializableState = this.panelConfigs.map(p => ({
            id: p.id,
            isVisible: p.isVisible,
            isCollapsed: p.isCollapsed,
        }));
        localStorage.setItem(storageKey, JSON.stringify(serializableState));
    }

    /**
     * Renders all visible panels into the container.
     */
    renderPanels() {
        this.renderCallCount++;
        
        if (this.renderCallCount > 1) {
            console.error(`[PanelManager] WARNING: renderPanels() called ${this.renderCallCount} times for group: ${this.group}!`);
        }
        
        // Clear the container except for the header
        const header = this.container.querySelector('.sidebar-header');
        console.log(`[PanelManager] Found header: ${!!header}`);
        this.container.innerHTML = '';
        if (header) {
            this.container.appendChild(header);
        }

        // Re-append in the correct order
        let renderedCount = 0;
        this.panelConfigs.forEach(panelConfig => {
            if (panelConfig.isVisible) {
                console.log(`[PanelManager] Rendering panel: ${panelConfig.id}`);
                const panelEl = this.createPanel(panelConfig);
                panelEl.draggable = true;
                panelEl.classList.toggle('collapsed', !!panelConfig.isCollapsed);
                this.container.appendChild(panelEl);
                renderedCount++;
            }
        });
        
        console.log(`[PanelManager] Rendered ${renderedCount} panels`);
        
        // Debug: Check for duplicate panels
        const allPanels = this.container.querySelectorAll('.sidebar-panel');
        console.warn(`[PanelManager] Total panels in DOM: ${allPanels.length}`);
        
        const panelIds = Array.from(allPanels).map(p => p.id);
        console.warn(`[PanelManager] Panel IDs in DOM:`, panelIds);
        
        // Check for duplicates
        const duplicates = panelIds.filter((id, index) => panelIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            console.error(`[PanelManager] DUPLICATE PANELS FOUND:`, duplicates);
        }
    }

    /**
     * Creates the DOM element for a single panel.
     * @param {object} panelConfig - The configuration object for the panel.
     * @returns {HTMLElement} The created panel element.
     */
    createPanel(panelConfig) {
        const panel = document.createElement('div');
        panel.id = panelConfig.id;
        panel.className = 'sidebar-panel';
        panel.dataset.panelId = panelConfig.id;

        // Create panel header for all panels except panel-manager which handles its own header
        if (panelConfig.id !== 'panel-manager') {
            this.createPanelHeader(panel, panelConfig);
        }

        const content = document.createElement('div');
        content.className = 'panel-content';

        // Handle both instance-based and function-based panels
        let instance = panelConfig.instance;
        
        // If we have a createInstance factory, create a new instance
        if (!instance && typeof panelConfig.createInstance === 'function') {
            console.warn(`[PanelManager] Creating new instance for panel: ${panelConfig.id}`);
            instance = panelConfig.createInstance();
            // Store the instance for later use (onActivate, etc.)
            panelConfig.instance = instance;
        }
        
        if (instance && typeof instance.render === 'function') {
            console.warn(`[PanelManager] Rendering instance-based panel: ${panelConfig.id}`);
            const renderedContent = instance.render();
            
            // Handle async render methods
            if (renderedContent && typeof renderedContent.then === 'function') {
                console.warn(`[PanelManager] Async render detected for ${panelConfig.id}`);
                content.innerHTML = '<div class="loading-spinner">Loading...</div>';
                renderedContent.then(html => {
                    console.warn(`[PanelManager] Promise resolved for ${panelConfig.id}, html type:`, typeof html);
                    console.warn(`[PanelManager] Promise resolved for ${panelConfig.id}, html length:`, html ? html.length : 'null');
                    console.warn(`[PanelManager] Promise resolved for ${panelConfig.id}, html preview:`, html ? html.substring(0, 200) : 'null');
                    
                    if (typeof html === 'string') {
                        content.innerHTML = html;
                        console.warn(`[PanelManager] Set async innerHTML for ${panelConfig.id}, content.innerHTML length:`, content.innerHTML.length);
                        console.warn(`[PanelManager] Set async innerHTML for ${panelConfig.id}, content.innerHTML preview:`, content.innerHTML.substring(0, 200));
                        
                        if (typeof instance.onActivate === 'function') {
                            console.warn(`[PanelManager] Calling onActivate for ${panelConfig.id} after async render`);
                            setTimeout(() => instance.onActivate(content), 0);
                        }
                    } else {
                        console.error(`[PanelManager] Promise resolved with non-string for ${panelConfig.id}:`, html);
                    }
                }).catch(error => {
                    console.error(`[PanelManager] Promise rejected for ${panelConfig.id}:`, error);
                    content.innerHTML = '<div class="error">Error loading panel</div>';
                });
            } else if (typeof renderedContent === 'string') {
                content.innerHTML = renderedContent;
                console.warn(`[PanelManager] Set innerHTML for ${panelConfig.id}:`, content.innerHTML.substring(0, 100));
                
                if (typeof instance.onActivate === 'function') {
                    console.warn(`[PanelManager] Calling onActivate for ${panelConfig.id}`);
                    setTimeout(() => instance.onActivate(content), 0);
                }
            } else if (renderedContent instanceof Node) {
                content.appendChild(renderedContent);
                console.warn(`[PanelManager] Appended node for ${panelConfig.id}`);
                
                if (typeof instance.onActivate === 'function') {
                    console.warn(`[PanelManager] Calling onActivate for ${panelConfig.id}`);
                    setTimeout(() => instance.onActivate(content), 0);
                }
            }
        } else if (typeof panelConfig.render === 'function') {
            console.warn(`[PanelManager] Rendering function-based panel: ${panelConfig.id}`);
            const renderedContent = panelConfig.render();
            if (typeof renderedContent === 'string') {
                content.innerHTML = renderedContent;
            } else if (renderedContent instanceof Node) {
                content.appendChild(renderedContent);
            }
            if (typeof panelConfig.onActivate === 'function') {
                setTimeout(() => panelConfig.onActivate(content), 0);
            }
        }

        panel.appendChild(content);
        return panel;
    }

    /**
     * Creates the header element for a panel.
     * @param {HTMLElement} panel - The panel element.
     * @param {object} panelConfig - The panel's configuration.
     */
    createPanelHeader(panel, panelConfig) {
        const header = document.createElement('div');
        header.className = 'sidebar-panel-header';

        // Make the entire header clickable to toggle collapse
        this.eventManager.on(header, 'click', () => {
            this.togglePanelCollapse(panelConfig.id);
        });

        const headerLeft = document.createElement('div');
        headerLeft.className = 'sidebar-panel-header-left';

        if (panelConfig.icon) {
            const icon = document.createElement('div');
            icon.className = 'panel-icon';
            const iconPath = `/client/styles/icons/${panelConfig.icon}.svg`;
            icon.innerHTML = `<img src="${iconPath}" alt="">`;
            headerLeft.appendChild(icon);
        }

        const title = document.createElement('span');
        title.className = 'panel-title';
        title.textContent = panelConfig.title;
        headerLeft.appendChild(title);

        header.appendChild(headerLeft);

        const collapseToggle = document.createElement('button');
        collapseToggle.className = 'panel-collapse-toggle';
        collapseToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06z"/></svg>`;
        collapseToggle.title = 'Collapse/Expand Panel';

        this.eventManager.on(collapseToggle, 'click', (e) => {
            // Stop propagation to prevent the header's click listener from firing as well
            e.stopPropagation();
            this.togglePanelCollapse(panelConfig.id);
        });

        header.appendChild(collapseToggle);
        panel.appendChild(header);
    }

    /**
     * Initializes drag-and-drop functionality with automatic cleanup.
     */
    addDragDropHandlers() {
        // Use EventManager for automatic cleanup
        this.eventManager.on(this.container, 'dragstart', this.handleDragStart.bind(this));
        this.eventManager.on(this.container, 'dragend', this.handleDragEnd.bind(this));
        this.eventManager.on(this.container, 'dragover', this.handleDragOver.bind(this));
        this.eventManager.on(this.container, 'drop', this.handleDrop.bind(this));
        
        console.warn(`[PanelManager] Added ${this.eventManager.getListenerCount()} drag-drop listeners`);
    }
    
    handleDragStart(e) {
        if (e.target.classList.contains('sidebar-panel')) {
            this.draggedPanel = e.target;
            this.draggedPanel.classList.add('dragging');
            console.warn('[PanelManager] handleDragStart() called');
        }
    }

    handleDragEnd(e) {
        if (this.draggedPanel) {
            this.draggedPanel.classList.remove('dragging');
            this.draggedPanel = null;
        }
        document.querySelectorAll('.drop-zone').forEach(el => el.remove());
    }
    
    handleDragOver(e) {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(e.clientY);
        
        document.querySelectorAll('.drop-zone').forEach(el => el.remove());
        
        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        
        if (afterElement == null) {
            const lastPanel = this.container.querySelector('.sidebar-panel:last-of-type');
            if (lastPanel) {
                lastPanel.after(dropZone);
            }
        } else {
            this.container.insertBefore(dropZone, afterElement);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        if (!this.draggedPanel) return;
        
        console.warn('[PanelManager] handleDrop() called');

        const draggedId = this.draggedPanel.id;
        const afterElement = this.getDragAfterElement(e.clientY);

        const movedItemIndex = this.panelConfigs.findIndex(p => p.id === draggedId);
        if (movedItemIndex > -1) {
            const [movedItem] = this.panelConfigs.splice(movedItemIndex, 1);
            
            if (afterElement == null) {
                this.panelConfigs.push(movedItem);
            } else {
                const afterId = afterElement.id;
                const newIndex = this.panelConfigs.findIndex(p => p.id === afterId);
                this.panelConfigs.splice(newIndex, 0, movedItem);
            }
        }

        this.savePanelState();
        this.renderPanels(); 
    }

    getDragAfterElement(y) {
        const draggableElements = [...this.container.querySelectorAll('.sidebar-panel:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    /**
     * Creates a header for the sidebar with Panel Manager controls.
     * @deprecated This method is deprecated. Panel Manager now handles its own header.
     */
    createSidebarHeader() {
        // This method is deprecated - PanelManagerPanel now handles its own header
        console.warn('[PanelManager] createSidebarHeader() is deprecated - PanelManagerPanel handles its own header');
    }

    /**
     * Toggles the visibility of a panel.
     * @param {string} panelId - The ID of the panel to toggle.
     */
    togglePanelVisibility(panelId) {
        const panelConfig = this.panelConfigs.find(p => p.id === panelId);
        if (panelConfig) {
            panelConfig.isVisible = !panelConfig.isVisible;
            this.renderPanels();
            this.savePanelState();
        }
    }

    /**
     * Toggles the collapse state of a panel.
     * @param {string} panelId - The ID of the panel to toggle.
     */
    togglePanelCollapse(panelId) {
        const panelConfig = this.panelConfigs.find(p => p.id === panelId);
        if (panelConfig) {
            panelConfig.isCollapsed = !panelConfig.isCollapsed;
            document.getElementById(panelId)?.classList.toggle('collapsed', panelConfig.isCollapsed);
            this.savePanelState();
        }
    }

    /**
     * Collapses all panels.
     */
    collapseAllPanels() {
        console.warn('[PanelManager] collapseAllPanels() called');
        this.panelConfigs.forEach(p => {
            // Do not collapse the panel manager itself
            if (p.id !== 'panel-manager') {
                p.isCollapsed = true;
            }
        });
        this.renderPanels();
        this.savePanelState();
    }

    /**
     * Expands all panels.
     */
    expandAllPanels() {
        console.warn('[PanelManager] expandAllPanels() called');
        this.panelConfigs.forEach(p => p.isCollapsed = false);
        this.renderPanels();
        this.savePanelState();
    }

    /**
     * Toggles the visibility of the Panel Manager controls.
     */
    togglePanelManagerControls() {
        console.warn('[PanelManager] togglePanelManagerControls() called');
        const panelManagerPanel = this.container.querySelector('#panel-manager');
        if (panelManagerPanel) {
            const isCurrentlyCollapsed = panelManagerPanel.classList.contains('collapsed');
            this.togglePanelCollapse('panel-manager');
            
            // Update the button title based on the new state
            const toggleBtn = this.container.querySelector('.sidebar-header-actions button[title*="Toggle Panel Controls"]');
            if (toggleBtn) {
                if (isCurrentlyCollapsed) {
                    // Panel is now expanded
                    toggleBtn.title = 'Toggle Panel Controls';
                } else {
                    // Panel is now collapsed
                    toggleBtn.title = 'Show Panel Controls';
                }
            }
        }
    }

    /**
     * Destroys the panel manager and cleans up all resources.
     */
    destroy() {
        console.warn(`[PanelManager] destroy() called for group: ${this.group}`);
        
        // Use EventManager for automatic cleanup of all event listeners
        this.eventManager.destroy();
        
        // Clean up panel instances that have cleanup methods
        this.panelConfigs.forEach(panelConfig => {
            if (panelConfig.instance) {
                // Call destroy method if it exists
                if (typeof panelConfig.instance.destroy === 'function') {
                    console.warn(`[PanelManager] Calling destroy() on panel instance: ${panelConfig.id}`);
                    panelConfig.instance.destroy();
                }
                // Call unmount method if it exists
                else if (typeof panelConfig.instance.unmount === 'function') {
                    console.warn(`[PanelManager] Calling unmount() on panel instance: ${panelConfig.id}`);
                    panelConfig.instance.unmount();
                }
            }
        });
        
        // Clear the container
        this.container.innerHTML = '';
        
        // Clear internal state
        this.panelConfigs = [];
        this.draggedPanel = null;
        this.isInitialized = false;
        
        console.warn(`[PanelManager] destroy() completed for group: ${this.group}`);
    }
} 