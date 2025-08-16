/**
 * @file client/panels/ModernBasePanel.js
 * @description Modern BasePanel with Redux integration, performance optimizations, and standardized lifecycle
 */

import { PanelInterface } from './PanelInterface.js';
import { appStore } from '/client/appState.js';
import { panelActions } from '/client/store/slices/panelSlice.js';
import { createSelector } from '@reduxjs/toolkit';

export class ModernBasePanel extends PanelInterface {
    constructor(options) {
        super(options);
        
        // Enhanced configuration
        this.config = {
            id: options.id,
            title: options.title || options.id,
            collapsible: options.collapsible !== false, // Default true
            resizable: options.resizable || false,
            draggable: options.draggable || false,
            persistent: options.persistent !== false, // Default true
            autoMount: options.autoMount !== false, // Default true
            ...options
        };
        
        // State management
        this.container = null;
        this.isInitialized = false;
        this.isMounted = false;
        this.isVisible = true;
        
        // Performance optimization - memoized selectors
        this.panelSelector = createSelector(
            [state => state.panels?.sidebarPanels?.[this.id]],
            panelState => panelState || {}
        );
        
        // Redux integration
        this.unsubscribe = null;
        this.lastState = {};
        
        // Lifecycle hooks (can be overridden)
        this.onInit = this.onInit.bind(this);
        this.onMount = this.onMount.bind(this);
        this.onUnmount = this.onUnmount.bind(this);
        this.onStateChange = this.onStateChange.bind(this);
        this.onVisibilityChange = this.onVisibilityChange.bind(this);
        
        // Auto-initialize if enabled
        if (this.config.autoMount) {
            this.initialize();
        }
    }
    
    /**
     * Initialize the panel - sets up Redux subscription and calls onInit hook
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Set up Redux subscription for state changes
            this.setupReduxSubscription();
            
            // Register panel with Redux store if not already registered
            this.registerWithStore();
            
            // Call initialization hook
            await this.onInit();
            
            this.isInitialized = true;
            this.log('Panel initialized successfully');
        } catch (error) {
            this.error('Failed to initialize panel:', error);
            throw error;
        }
    }
    
    /**
     * Set up Redux subscription for automatic state synchronization
     */
    setupReduxSubscription() {
        if (this.unsubscribe) return; // Already subscribed
        
        this.unsubscribe = appStore.subscribe(() => {
            const currentState = this.panelSelector(appStore.getState());
            
            // Only trigger onStateChange if state actually changed
            if (JSON.stringify(currentState) !== JSON.stringify(this.lastState)) {
                this.lastState = { ...currentState };
                this.onStateChange(currentState);
                
                // Handle visibility changes
                if (currentState.visible !== undefined && currentState.visible !== this.isVisible) {
                    this.isVisible = currentState.visible;
                    this.onVisibilityChange(this.isVisible);
                }
            }
        });
    }
    
    /**
     * Register panel with Redux store
     */
    registerWithStore() {
        const state = appStore.getState();
        const panelExists = state.panels?.sidebarPanels?.[this.id];
        
        if (!panelExists) {
            appStore.dispatch(panelActions.createPanel({
                id: this.id,
                title: this.config.title,
                visible: true,
                collapsed: false,
                order: this.config.order || 50,
                ...this.config
            }));
        }
    }
    
    /**
     * Enhanced render method with error handling and performance tracking
     */
    render() {
        const startTime = performance.now();
        
        try {
            // Create base panel structure
            const panelElement = this.createPanelStructure();
            
            // Call subclass render implementation
            const content = this.renderContent();
            if (content) {
                const contentContainer = panelElement.querySelector('.panel-content');
                if (contentContainer) {
                    contentContainer.appendChild(content);
                }
            }
            
            this.element = panelElement;
            
            // Performance tracking
            const renderTime = performance.now() - startTime;
            if (renderTime > 16) { // More than one frame
                this.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`);
            }
            
            return this.element;
        } catch (error) {
            this.error('Failed to render panel:', error);
            return this.createErrorElement(error);
        }
    }
    
    /**
     * Create standardized panel structure
     */
    createPanelStructure() {
        const panel = document.createElement('div');
        panel.className = `panel modern-panel panel-${this.id}`;
        panel.setAttribute('data-panel-id', this.id);
        
        // Panel header
        if (this.config.showHeader !== false) {
            const header = document.createElement('div');
            header.className = 'panel-header';
            
            const title = document.createElement('h3');
            title.className = 'panel-title';
            title.textContent = this.config.title;
            header.appendChild(title);
            
            // Collapse button
            if (this.config.collapsible) {
                const collapseBtn = document.createElement('button');
                collapseBtn.className = 'panel-collapse-btn';
                collapseBtn.innerHTML = '−';
                collapseBtn.addEventListener('click', () => this.toggleCollapse());
                header.appendChild(collapseBtn);
            }
            
            panel.appendChild(header);
        }
        
        // Panel content
        const content = document.createElement('div');
        content.className = 'panel-content';
        panel.appendChild(content);
        
        return panel;
    }
    
    /**
     * Subclasses should override this to provide their content
     */
    renderContent() {
        const div = document.createElement('div');
        div.innerHTML = `<p>Panel ${this.id} - Override renderContent() method</p>`;
        return div;
    }
    
    /**
     * Create error element for render failures
     */
    createErrorElement(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'panel panel-error';
        errorDiv.innerHTML = `
            <div class="panel-header">
                <h3 class="panel-title">⚠️ ${this.config.title} (Error)</h3>
            </div>
            <div class="panel-content">
                <p>Failed to render panel: ${error.message}</p>
                <button onclick="this.closest('.panel').remove()">Remove Panel</button>
            </div>
        `;
        return errorDiv;
    }
    
    /**
     * Enhanced mount with lifecycle management
     */
    async onMount(container) {
        if (this.isMounted) return;
        
        try {
            this.container = container;
            
            // Ensure panel is initialized
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            // Add mounted class for CSS
            if (this.element) {
                this.element.classList.add('panel-mounted');
            }
            
            // Call subclass mount hook
            await this.onMountComplete();
            
            this.isMounted = true;
            this.log('Panel mounted successfully');
        } catch (error) {
            this.error('Failed to mount panel:', error);
        }
    }
    
    /**
     * Enhanced unmount with cleanup
     */
    onUnmount() {
        if (!this.isMounted) return;
        
        try {
            // Call subclass unmount hook
            this.onUnmountStart();
            
            // Clean up Redux subscription
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }
            
            // Remove DOM references
            if (this.element) {
                this.element.classList.remove('panel-mounted');
            }
            this.container = null;
            
            this.isMounted = false;
            this.log('Panel unmounted successfully');
        } catch (error) {
            this.error('Error during unmount:', error);
        }
    }
    
    /**
     * Toggle panel collapse state
     */
    toggleCollapse() {
        const currentState = this.panelSelector(appStore.getState());
        const newCollapsed = !currentState.collapsed;
        
        appStore.dispatch(panelActions.updatePanel({
            id: this.id,
            collapsed: newCollapsed
        }));
        
        // Update DOM immediately for better UX
        if (this.element) {
            this.element.classList.toggle('panel-collapsed', newCollapsed);
        }
    }
    
    /**
     * Update panel visibility
     */
    setVisible(visible) {
        appStore.dispatch(panelActions.updatePanel({
            id: this.id,
            visible: visible
        }));
    }
    
    /**
     * Get current panel state from Redux
     */
    getState() {
        return this.panelSelector(appStore.getState());
    }
    
    // =================================================================
    // LIFECYCLE HOOKS (Override in subclasses)
    // =================================================================
    
    /**
     * Called during initialization - override for custom setup
     */
    async onInit() {
        // Override in subclasses
    }
    
    /**
     * Called after successful mount - override for post-mount setup
     */
    async onMountComplete() {
        // Override in subclasses
    }
    
    /**
     * Called before unmount - override for cleanup
     */
    onUnmountStart() {
        // Override in subclasses
    }
    
    /**
     * Enhanced state change handler with diff detection
     */
    onStateChange(newState) {
        // Override in subclasses for custom state handling
        this.log('State changed:', newState);
    }
    
    /**
     * Enhanced visibility change handler
     */
    onVisibilityChange(isVisible) {
        if (this.element) {
            this.element.style.display = isVisible ? '' : 'none';
            this.element.classList.toggle('panel-hidden', !isVisible);
        }
        this.log(`Visibility changed: ${isVisible}`);
    }
    
    // =================================================================
    // UTILITY METHODS
    // =================================================================
    
    /**
     * Logging with panel context
     */
    log(...args) {
        console.log(`[Panel:${this.id}]`, ...args);
    }
    
    warn(...args) {
        console.warn(`[Panel:${this.id}]`, ...args);
    }
    
    error(...args) {
        console.error(`[Panel:${this.id}]`, ...args);
    }
    
    /**
     * Cleanup method - call before destroying panel
     */
    destroy() {
        this.onUnmount();
        
        // Remove from Redux store
        appStore.dispatch(panelActions.removePanel(this.id));
        
        this.log('Panel destroyed');
    }
}
