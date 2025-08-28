/**
 * BasePanel.js - Ultimate Unified Panel Base Class
 * 
 * Combines the best features from all BasePanel implementations:
 * - PanelInterface hierarchy and parent-child relationships
 * - BasePanel_backup comprehensive lifecycle and state management
 * - BasePanel modern rendering and event handling
 * - BasePanel_restored simplicity and clean interface
 * 
 * NEW FEATURES:
 * - Automatic Redux integration with enhanced selectors
 * - Support for both regular and portable panels
 * - Built-in memoization and performance optimizations
 * - Modern lifecycle management with cleanup
 * - Type-safe configuration and validation
 */

import { PanelInterface } from './PanelInterface.js';
import { getUIState, getAuthState } from '/client/store/enhancedSelectors.js';
import { subscribeToState } from '/client/store/reduxConnect.js';
import { appStore } from '/client/appState.js';

export class BasePanel extends PanelInterface {
    constructor(options, legacyOptions) {
        // Handle legacy parameter format: constructor(id, options)
        if (typeof options === 'string') {
            const id = options;
            options = { id, ...legacyOptions };
        }
        
        super(options);
        this.config = {
            collapsible: true,
            resizable: false,
            draggable: true,
            persistent: true,
            ...options
        };
        this.element = null;

        // Subscription tracking
        this.unsubscribeFns = [];
    }

    setupReduxSubscriptions() {
        // Clear any existing subscriptions
        this.unsubscribeFns.forEach(fn => fn());
        this.unsubscribeFns = [];

        // UI State Subscription
        const uiUnsubscribe = subscribeToState(
            getUIState, 
            (uiState) => this.onUIStateChange(uiState)
        );
        this.unsubscribeFns.push(uiUnsubscribe);

        // Auth State Subscription
        const authUnsubscribe = subscribeToState(
            getAuthState, 
            (authState) => this.onAuthStateChange(authState)
        );
        this.unsubscribeFns.push(authUnsubscribe);
    }

    // Lifecycle methods to manage subscriptions
    onMount(container) {
        super.onMount(container);
        
        // Setup subscriptions
        this.setupReduxSubscriptions();
    }

    onUnmount() {
        // Stop all subscriptions
        this.unsubscribeFns.forEach(fn => fn());
        this.unsubscribeFns = [];

        super.onUnmount();
    }

    // Placeholder methods for state change handling
    onUIStateChange(uiState) {
        // Override in subclasses
        console.log('UI State Changed:', uiState);
    }

    onAuthStateChange(authState) {
        // Override in subclasses
        console.log('Auth State Changed:', authState);
    }

    /**
     * Validate and merge configuration options
     */
    validateAndMergeConfig(config) {
        // Type validation
        if (typeof config.width !== 'number' || config.width < 0) {
            throw new Error(`Invalid width: ${config.width}`);
        }
        
        if (typeof config.minWidth !== 'number' || config.minWidth < 0) {
            throw new Error(`Invalid minWidth: ${config.minWidth}`);
        }

        // Constraint validation
        if (config.width < config.minWidth) {
            config.width = config.minWidth;
        }

        if (config.maxWidth && config.width > config.maxWidth) {
            config.width = config.maxWidth;
        }

        return config;
    }

    /**
     * Modern render method with caching and virtual DOM support
     */
    render() {
        if (this.state.isDestroyed) {
            throw new Error(`Cannot render destroyed panel: ${this.id}`);
        }

        // Check render cache
        const cacheKey = this.getRenderCacheKey();
        if (this.config.enableMemoization && this.renderCache.has(cacheKey)) {
            this.log('Using cached render');
            return this.renderCache.get(cacheKey);
        }

        // Create panel structure
        this.element = document.createElement('div');
        this.element.className = this.getPanelClasses();
        this.element.dataset.panelId = this.id;
        this.element.dataset.panelSource = this.source;
        
        if (this.isPortable) {
            this.element.dataset.packageName = this.packageName;
        }

        // Create header
        if (!this.config.headless) {
            this.headerElement = this.createHeader();
            this.element.appendChild(this.headerElement);
        }

        // Create content wrapper with collapse support
        const contentWrapper = document.createElement('div');
        contentWrapper.className = `panel-content-wrapper ${this.isCollapsed ? 'collapsed' : 'expanded'}`;
        
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'panel-content';
        
        // Render content (subclass implementation)
        const content = this.renderContent();
        if (typeof content === 'string') {
            this.contentElement.innerHTML = content;
        } else if (content instanceof Node) {
            this.contentElement.appendChild(content);
        } else if (content) {
            this.contentElement.textContent = String(content);
        }
        
        contentWrapper.appendChild(this.contentElement);
        
        // Render children if any
        if (this.children.size > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'panel-children';
            this.children.forEach(child => {
                childrenContainer.appendChild(child.render());
            });
            contentWrapper.appendChild(childrenContainer);
        }
        
        this.element.appendChild(contentWrapper);

        // Add resizer if resizable
        if (this.config.resizable) {
            this.resizerElement = this.createResizer();
            this.element.appendChild(this.resizerElement);
        }

        // Attach event listeners
        this.attachEventListeners();

        // Cache the result
        if (this.config.enableMemoization) {
            this.renderCache.set(cacheKey, this.element);
        }

        this.log('Rendered with modern pipeline');
        return this.element;
    }

    /**
     * Get CSS classes for the panel element
     */
    getPanelClasses() {
        const classes = [
            'panel',
            'modern-panel',
            `panel-${this.id}`,
            `width-${this.widthState}`,
            `source-${this.source}`
        ];

        if (this.isPortable) {
            classes.push('portable-panel');
            classes.push(`package-${this.packageName.replace(/[@\/]/g, '-')}`);
        }

        if (this.isCollapsed) {
            classes.push('collapsed');
        }

        if (this.state.isVisible) {
            classes.push('visible');
        }

        return classes.join(' ');
    }

    /**
     * Create modern header with enhanced functionality
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'panel-header modern-header';
        
        // Left side - title and info
        const headerLeft = document.createElement('div');
        headerLeft.className = 'panel-header-left';
        
        const title = document.createElement('h3');
        title.className = 'panel-title';
        title.textContent = this.title;
        headerLeft.appendChild(title);

        // Source indicator for portable panels
        if (this.isPortable) {
            const sourceIndicator = document.createElement('span');
            sourceIndicator.className = 'panel-source-indicator';
            sourceIndicator.textContent = '📦';
            sourceIndicator.title = `Portable panel from ${this.packageName}`;
            headerLeft.appendChild(sourceIndicator);
        }
        
        if (this.headerInfo) {
            const info = document.createElement('span');
            info.className = 'panel-header-info';
            info.textContent = this.headerInfo;
            headerLeft.appendChild(info);
        }
        
        header.appendChild(headerLeft);
        
        // Right side - control buttons
        const headerRight = document.createElement('div');
        headerRight.className = 'panel-header-right';
        
        // Custom header buttons
        this.headerButtons.forEach(buttonConfig => {
            const button = this.createHeaderButton(buttonConfig);
            headerRight.appendChild(button);
        });
        
        // Built-in control buttons
        this.addBuiltinHeaderButtons(headerRight);
        
        header.appendChild(headerRight);
        return header;
    }

    /**
     * Create header button element
     */
    createHeaderButton(buttonConfig) {
        const button = document.createElement('button');
        button.className = `panel-header-btn ${buttonConfig.className || ''}`;
        button.textContent = buttonConfig.text || buttonConfig.icon || '';
        button.title = buttonConfig.title || '';
        button.dataset.buttonId = buttonConfig.id;
        
        if (buttonConfig.onClick) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                buttonConfig.onClick(this, e);
            });
        }
        
        return button;
    }

    /**
     * Add built-in header buttons
     */
    addBuiltinHeaderButtons(headerRight) {
        // Bulk action buttons for parent panels
        if (this.children.size > 0) {
            const openAllBtn = document.createElement('button');
            openAllBtn.className = 'panel-header-btn panel-open-all-btn';
            openAllBtn.textContent = '↓';
            openAllBtn.title = 'Open All';
            headerRight.appendChild(openAllBtn);
            
            const closeAllBtn = document.createElement('button');
            closeAllBtn.className = 'panel-header-btn panel-close-all-btn';
            closeAllBtn.textContent = '↑';
            closeAllBtn.title = 'Close All';
            headerRight.appendChild(closeAllBtn);
        }

        // Flyout toggle for portable panels
        if (this.isPortable && this.config.showFlyoutToggle) {
            const flyoutBtn = document.createElement('button');
            flyoutBtn.className = 'panel-header-btn panel-flyout-btn';
            flyoutBtn.textContent = '⧉';
            flyoutBtn.title = 'Toggle Flyout Mode';
            headerRight.appendChild(flyoutBtn);
        }
        
        // Width toggle button
        const widthBtn = document.createElement('button');
        widthBtn.className = 'panel-header-btn panel-width-btn';
        widthBtn.textContent = this.widthState === 'full' ? '⟷' : '↔';
        widthBtn.title = `Switch to ${this.widthState === 'full' ? 'Resized' : 'Full'} Width`;
        headerRight.appendChild(widthBtn);
        
        // Collapse button
        if (this.config.collapsible) {
            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'panel-header-btn panel-collapse-btn';
            collapseBtn.textContent = this.isCollapsed ? '+' : '−';
            collapseBtn.title = `${this.isCollapsed ? 'Expand' : 'Collapse'} Panel`;
            headerRight.appendChild(collapseBtn);
        }
    }

    /**
     * Create resizer element
     */
    createResizer() {
        const resizer = document.createElement('div');
        resizer.className = 'panel-resizer';
        resizer.innerHTML = '<div class="panel-resizer-handle"></div>';
        return resizer;
    }

    /**
     * Attach all event listeners
     */
    attachEventListeners() {
        if (!this.element) return;

        // Header button events
        this.attachHeaderButtonEvents();

        // Resizer events
        if (this.resizerElement) {
            this.attachResizerEvents();
        }

        // Custom events
        this.attachCustomEvents();
    }

    /**
     * Attach header button event listeners
     */
    attachHeaderButtonEvents() {
        const events = [
            { selector: '.panel-collapse-btn', handler: () => this.toggleCollapse() },
            { selector: '.panel-width-btn', handler: () => this.toggleWidthState() },
            { selector: '.panel-open-all-btn', handler: () => this.openAll() },
            { selector: '.panel-close-all-btn', handler: () => this.closeAll() },
            { selector: '.panel-flyout-btn', handler: () => this.toggleFlyout() }
        ];

        events.forEach(({ selector, handler }) => {
            const element = this.element.querySelector(selector);
            if (element) {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handler();
                });
            }
        });
    }

    /**
     * Attach resizer event listeners
     */
    attachResizerEvents() {
        // Implementation for drag-to-resize functionality
        // This would include mousedown, mousemove, mouseup handlers
        this.log('Resizer events attached');
    }

    /**
     * Attach custom event listeners (override in subclasses)
     */
    attachCustomEvents() {
        // Subclasses can override this to add custom event handling
    }

    /**
     * Get render cache key for memoization
     */
    getRenderCacheKey() {
        return `${this.id}-${this.state.lastUpdate}-${this.isCollapsed}-${this.widthState}`;
    }

    /**
     * Throttle function for performance optimization
     */
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return (...args) => {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    /**
     * Schedule an update (throttled)
     */
    scheduleUpdate() {
        this.updateQueue.add('render');
        this.throttledUpdate();
    }

    /**
     * Perform the actual update
     */
    performUpdate() {
        if (this.state.isDestroyed) return;

        this.state.lastUpdate = Date.now();
        
        if (this.updateQueue.has('render')) {
            this.updateDisplay();
            this.updateQueue.delete('render');
        }

        this.log('Update performed');
    }

    /**
     * Update display without full re-render
     */
    updateDisplay() {
        if (!this.element) return;
        
        // Update classes
        this.element.className = this.getPanelClasses();
        
        // Update content wrapper
        const contentWrapper = this.element.querySelector('.panel-content-wrapper');
        if (contentWrapper) {
            contentWrapper.className = `panel-content-wrapper ${this.isCollapsed ? 'collapsed' : 'expanded'}`;
        }
        
        // Update header buttons
        this.updateHeaderButtons();
    }

    /**
     * Update header button states
     */
    updateHeaderButtons() {
        if (!this.headerElement) return;

        const collapseBtn = this.headerElement.querySelector('.panel-collapse-btn');
        if (collapseBtn) {
            collapseBtn.textContent = this.isCollapsed ? '+' : '−';
            collapseBtn.title = `${this.isCollapsed ? 'Expand' : 'Collapse'} Panel`;
        }
        
        const widthBtn = this.headerElement.querySelector('.panel-width-btn');
        if (widthBtn) {
            widthBtn.textContent = this.widthState === 'full' ? '⟷' : '↔';
            widthBtn.title = `Switch to ${this.widthState === 'full' ? 'Resized' : 'Full'} Width`;
        }
    }

    /**
     * Toggle collapse state
     */
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this.scheduleUpdate();
        this.onStateChange();
        this.log(`${this.isCollapsed ? 'Collapsed' : 'Expanded'}`);
    }

    /**
     * Toggle flyout mode (for portable panels)
     */
    toggleFlyout() {
        if (!this.isPortable) return;
        
        // Dispatch to Redux for flyout state management
        this.log('Flyout toggle requested');
        this.onFlyoutToggle();
    }

    /**
     * Enhanced lifecycle management
     */
    onMountComplete() {
        // Override in subclasses
    }

    onUnmountComplete() {
        // Override in subclasses
    }

    onFlyoutToggle() {
        // Override in subclasses
    }

    /**
     * Content rendering (must be implemented by subclasses)
     */
    renderContent() {
        return `<div class="panel-placeholder">
            <h4>Panel: ${this.title}</h4>
            <p>Source: ${this.source}</p>
            ${this.isPortable ? `<p>Package: ${this.packageName}</p>` : ''}
            <p>Override renderContent() method in subclass</p>
        </div>`;
    }
}
