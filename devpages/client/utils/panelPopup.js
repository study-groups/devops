/**
 * panelPopup.js - Panel-specific popup system for DevPages
 * 
 * Provides a specialized popup system for opening panels as floating windows
 * Usage: window.panelPopup.show('panel-id')
 */

import { zIndexManager } from './ZIndexManager.js';
import { panelRegistry } from '/client/panels/panelRegistry.js';

class panelPopup {
    constructor() {
        this.activePopups = new Map();
        this.defaultOptions = {
            width: 600,
            height: 500,
            x: 150,
            y: 100,
            draggable: true,
            resizable: true,
            closable: true,
            title: 'Panel'
        };
    }

    /**
     * Show a panel as a popup
     * @param {string} panelId - Panel ID from registry
     * @param {object} options - Popup options
     */
    show(panelId, options = {}) {
        console.log(`[panelPopup] Attempting to show panel: ${panelId}`);
        
        // Check if popup is already open
        if (this.isOpen(panelId)) {
            console.log(`[panelPopup] Panel ${panelId} is already open, bringing to front`);
            this.bringToFront(panelId);
            return this.getPopupId(panelId);
        }

        const panelConfig = panelRegistry.getPanel(panelId);
        if (!panelConfig) {
            console.error('[panelPopup] Panel not found in registry:', panelId);
            console.log('[panelPopup] Available panels:', Array.from(panelRegistry.getAllPanels()).map(p => p.id));
            return null;
        }
        
        console.log(`[panelPopup] Found panel config:`, panelConfig);

        const popupId = this.generatePopupId();
        const popupOptions = { 
            ...this.defaultOptions, 
            ...options,
            title: panelConfig.title || panelId
        };

        const popupElement = this.createPopupElement(popupId, panelConfig, popupOptions);
        
        this.activePopups.set(popupId, {
            element: popupElement,
            panelId: panelId,
            config: panelConfig,
            options: popupOptions,
            instance: null
        });

        document.body.appendChild(popupElement);
        
        // Register with zIndexManager for proper z-index management
        if (zIndexManager) {
            zIndexManager.registerPopup(popupElement, {
                name: `Panel Popup: ${panelId}`,
                type: 'panel-popup',
                priority: 10
            });
        } else {
            // Fallback: set a high z-index manually
            popupElement.style.zIndex = '10000';
        }
        
        this.initializePanel(popupId, panelConfig);
        this.setupEventHandlers(popupId);
        
        console.log(`[panelPopup] Opened panel '${panelId}' as popup`);
        return popupId;
    }

    /**
     * Check if a panel popup is already open
     */
    isOpen(panelId) {
        return Array.from(this.activePopups.values()).some(popup => popup.panelId === panelId);
    }

    /**
     * Get popup ID for a panel
     */
    getPopupId(panelId) {
        const popup = Array.from(this.activePopups.values()).find(popup => popup.panelId === panelId);
        return popup ? Array.from(this.activePopups.keys()).find(key => this.activePopups.get(key) === popup) : null;
    }

    /**
     * Bring popup to front
     */
    bringToFront(popupId) {
        const popup = this.activePopups.get(popupId);
        if (popup && zIndexManager) {
            zIndexManager.bringToFront(popup.element);
        }
    }

    /**
     * Create popup DOM element
     */
    createPopupElement(popupId, panelConfig, options) {
        const element = document.createElement('div');
        element.id = popupId;
        element.className = 'panel-popup';
        element.dataset.panelId = panelConfig.id;
        element.style.cssText = `
            position: fixed;
            left: ${options.x}px;
            top: ${options.y}px;
            width: ${options.width}px;
            height: ${options.height}px;
            background: var(--panel-background, #fff);
            border: 1px solid var(--panel-border, #ccc);
            border-radius: var(--panel-radius, 4px);
            box-shadow: var(--panel-shadow, 0 4px 12px rgba(0,0,0,0.15));
            display: flex;
            flex-direction: column;
            font-family: var(--font-family-sans, -apple-system, BlinkMacSystemFont, sans-serif);
        `;

        // Header
        const header = document.createElement('div');
        header.className = 'panel-popup-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: var(--panel-header-bg, #f8f9fa);
            border-bottom: 1px solid var(--panel-border, #ccc);
            cursor: ${options.draggable ? 'move' : 'default'};
            user-select: none;
            border-radius: var(--panel-radius, 4px) var(--panel-radius, 4px) 0 0;
        `;

        const title = document.createElement('span');
        title.textContent = options.title;
        title.style.cssText = `
            font-weight: 600;
            font-size: 14px;
            color: var(--panel-text, #333);
        `;

        header.appendChild(title);

        if (options.closable) {
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.className = 'panel-popup-close';
            closeBtn.style.cssText = `
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--panel-text-muted, #666);
                border-radius: 4px;
                transition: background-color 0.2s;
            `;
            closeBtn.addEventListener('click', () => this.close(popupId));
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.backgroundColor = 'var(--panel-hover-bg, #e9ecef)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.backgroundColor = 'transparent';
            });
            header.appendChild(closeBtn);
        }

        // Content container
        const content = document.createElement('div');
        content.className = 'panel-popup-content';
        content.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 16px;
        `;

        // Resize handle
        let resizeHandle = null;
        if (options.resizable) {
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'panel-popup-resize';
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
                color: var(--panel-text-muted, #999);
                background: var(--panel-background, #fff);
                border-radius: 0 0 var(--panel-radius, 4px) 0;
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
    initializePanel(popupId, panelConfig) {
        const popup = this.activePopups.get(popupId);
        if (!popup) return;

        const content = popup.element.querySelector('.panel-popup-content');
        
        try {
            if (panelConfig.component) {
                popup.instance = new panelConfig.component(content);
            } else if (panelConfig.createInstance) {
                popup.instance = panelConfig.createInstance();
            } else if (panelConfig.render) {
                content.innerHTML = panelConfig.render();
            } else {
                content.innerHTML = '<p>No content available for this panel</p>';
            }
        } catch (error) {
            console.error('[panelPopup] Error initializing panel:', error);
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
            const header = element.querySelector('.panel-popup-header');
            let isDragging = false;
            let dragOffset = { x: 0, y: 0 };

            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('panel-popup-close')) return;
                
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
            const resizeHandle = element.querySelector('.panel-popup-resize');
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
                
                if (newWidth > 300 && newHeight > 200) {
                    element.style.width = newWidth + 'px';
                    element.style.height = newHeight + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
            });
        }

        // Focus management
        element.addEventListener('mousedown', () => {
            if (zIndexManager) {
                zIndexManager.bringToFront(element);
            } else {
                this.bringToFront(popupId);
            }
        });
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
                console.error('[panelPopup] Error destroying panel instance:', error);
            }
        }

        // Unregister from zIndexManager
        if (zIndexManager) {
            zIndexManager.unregister(popup.element);
        }

        // Remove from DOM
        if (popup.element.parentNode) {
            popup.element.parentNode.removeChild(popup.element);
        }

        this.activePopups.delete(popupId);
        console.log(`[panelPopup] Closed popup for panel '${popup.panelId}'`);
    }

    /**
     * Close all popups
     */
    closeAll() {
        const popupIds = Array.from(this.activePopups.keys());
        popupIds.forEach(id => this.close(id));
    }

    /**
     * Get popup by panel ID
     */
    getByPanelId(panelId) {
        return Array.from(this.activePopups.values()).find(popup => popup.panelId === panelId);
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
        return 'panel-popup-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}

// Create singleton instance
const panelPopupInstance = new panelPopup();

// Expose to window
window.panelPopup = panelPopupInstance;

// Export for module usage
export { panelPopupInstance as panelPopup }; 