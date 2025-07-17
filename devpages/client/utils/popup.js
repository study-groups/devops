/**
 * popup.js - Universal popup system for panels
 * 
 * Provides a thin wrapper for instantiating any panel as a popup
 * Usage: window.appname(myPanel)
 */

import { logMessage } from '/client/log/index.js';
import { ZIndexManager } from '/client/utils/ZIndexManager.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

class Popup {
    constructor(options = {}) {
        this.activePopups = new Map();
        this.defaultOptions = {
            width: 400,
            height: 300,
            x: 100,
            y: 100,
            draggable: true,
            resizable: true,
            closable: true,
            title: 'Panel'
        };
    }

    /**
     * Create a popup with a panel
     * @param {string|object} panel - Panel ID or panel configuration
     * @param {object} options - Popup options
     */
    show(panel, options = {}) {
        const popupId = this.generatePopupId();
        const config = this.resolvePanelConfig(panel);
        
        if (!config) {
            console.error('[popup] Invalid panel configuration:', panel);
            return null;
        }

        const popupOptions = { ...this.defaultOptions, ...options };
        const popupElement = this.createPopupElement(popupId, config, popupOptions);
        
        this.activePopups.set(popupId, {
            element: popupElement,
            config: config,
            options: popupOptions,
            instance: null
        });

        document.body.appendChild(popupElement);
        this.initializePanel(popupId, config);
        this.setupEventHandlers(popupId);
        
        return popupId;
    }

    /**
     * Resolve panel configuration from various input types
     */
    resolvePanelConfig(panel) {
        if (typeof panel === 'string') {
            // Panel ID - get from registry
            return panelRegistry.getPanel(panel);
        } else if (typeof panel === 'object' && panel.component) {
            // Panel configuration object
            return panel;
        } else if (typeof panel === 'function') {
            // Panel constructor
            return { component: panel, title: 'Panel' };
        }
        return null;
    }

    /**
     * Create popup DOM element
     */
    createPopupElement(popupId, config, options) {
        const element = document.createElement('div');
        element.id = popupId;
        element.className = 'popup-panel';
        element.style.cssText = `
            position: fixed;
            left: ${options.x}px;
            top: ${options.y}px;
            width: ${options.width}px;
            height: ${options.height}px;
            background: var(--bg-color, #fff);
            border: 1px solid var(--border-color, #ccc);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: ${ZIndexManager.getNextZIndex()};
            display: flex;
            flex-direction: column;
            font-family: var(--font-family, -apple-system, BlinkMacSystemFont, sans-serif);
        `;

        // Header
        const header = document.createElement('div');
        header.className = 'popup-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: var(--header-bg, #f5f5f5);
            border-bottom: 1px solid var(--border-color, #ccc);
            cursor: ${options.draggable ? 'move' : 'default'};
            user-select: none;
        `;

        const title = document.createElement('span');
        title.textContent = config.title || 'Panel';
        title.style.cssText = `
            font-weight: 500;
            font-size: 14px;
        `;

        header.appendChild(title);

        if (options.closable) {
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.className = 'popup-close';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-color, #666);
            `;
            closeBtn.addEventListener('click', () => this.close(popupId));
            header.appendChild(closeBtn);
        }

        // Content container
        const content = document.createElement('div');
        content.className = 'popup-content';
        content.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 12px;
        `;

        // Resize handle
        let resizeHandle = null;
        if (options.resizable) {
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'popup-resize';
            resizeHandle.innerHTML = '⋰';
            resizeHandle.style.cssText = `
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                cursor: se-resize;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: var(--text-color, #999);
            `;
        }

        element.appendChild(header);
        element.appendChild(content);
        if (resizeHandle) element.appendChild(resizeHandle);

        return element;
    }

    /**
     * Initialize panel instance
     */
    initializePanel(popupId, config) {
        const popup = this.activePopups.get(popupId);
        if (!popup) return;

        const content = popup.element.querySelector('.popup-content');
        
        try {
            if (config.component) {
                popup.instance = new config.component(content);
            } else if (config.render) {
                content.innerHTML = config.render();
            } else {
                content.innerHTML = '<p>No content available</p>';
            }
        } catch (error) {
            console.error('[popup] Error initializing panel:', error);
            content.innerHTML = `<p>Error loading panel: ${error.message}</p>`;
        }
    }

    /**
     * Setup event handlers for dragging and resizing
     */
    setupEventHandlers(popupId) {
        const popup = this.activePopups.get(popupId);
        if (!popup) return;

        const element = popup.element;
        const options = popup.options;

        // Dragging
        if (options.draggable) {
            const header = element.querySelector('.popup-header');
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };

            header.addEventListener('mousedown', (e) => {
                isDragging = true;
                dragOffset.x = e.clientX - element.offsetLeft;
                dragOffset.y = e.clientY - element.offsetTop;
                element.style.cursor = 'move';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                
                element.style.left = (e.clientX - dragOffset.x) + 'px';
                element.style.top = (e.clientY - dragOffset.y) + 'px';
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
                element.style.cursor = '';
            });
        }

        // Resizing
        if (options.resizable) {
            const resizeHandle = element.querySelector('.popup-resize');
            let isResizing = false;
            let resizeStart = { x: 0, y: 0, width: 0, height: 0 };

            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizeStart.x = e.clientX;
                resizeStart.y = e.clientY;
                resizeStart.width = element.offsetWidth;
                resizeStart.height = element.offsetHeight;
                e.stopPropagation();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                const newWidth = resizeStart.width + (e.clientX - resizeStart.x);
                const newHeight = resizeStart.height + (e.clientY - resizeStart.y);
                
                if (newWidth > 200 && newHeight > 100) {
                    element.style.width = newWidth + 'px';
                    element.style.height = newHeight + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
            });
        }
    }

    /**
     * Close a popup
     */
    close(popupId) {
        const popup = this.activePopups.get(popupId);
        if (!popup) return;

        // Cleanup panel instance
        if (popup.instance && typeof popup.instance.destroy === 'function') {
            try {
                popup.instance.destroy();
            } catch (error) {
                console.error('[popup] Error destroying panel instance:', error);
            }
        }

        // Remove from DOM
        if (popup.element.parentNode) {
            popup.element.parentNode.removeChild(popup.element);
        }

        this.activePopups.delete(popupId);
    }

    /**
     * Close all popups
     */
    closeAll() {
        const popupIds = Array.from(this.activePopups.keys());
        popupIds.forEach(id => this.close(id));
    }

    /**
     * Get popup by ID
     */
    get(popupId) {
        return this.activePopups.get(popupId);
    }

    /**
     * Get all active popups
     */
    getAll() {
        return Array.from(this.activePopups.entries());
    }

    /**
     * Generate unique popup ID
     */
    generatePopupId() {
        return 'popup-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

// Create singleton instance
const popupInstance = new Popup();

// Expose to window
window.appname = popupInstance;

// Export for module usage
export { popupInstance as popup }; 