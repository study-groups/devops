/**
 * client/debug/DebugPanelManager.js
 * Manages the floating debug panel which contains various debug-related sub-panels.
 */

import { zIndexManager } from '/client/utils/ZIndexManager.js';
import { debugPanelRegistry } from './debugPanelRegistry.js';
import { logMessage } from '/client/log/index.js';

const DEBUG_PANEL_STATE_KEY = 'devpages_debug_panel_state';

class DebugPanelManager {
    constructor() {
        this.panelElement = null;
        this.headerElement = null;
        this.contentElement = null;
        this.resizeHandle = null;
        this.closeButton = null;

        this.isVisible = false;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };

        this.currentPos = { x: 150, y: 150 };
        this.currentSize = { width: 500, height: 400 };
        
        this.sectionInstances = {};

        this.loadPersistedState();
        this.init();
    }

    async init() {
        await this.loadPanelModules();
        this.createPanelDOM();
        this.attachEventListeners();
        this.registerWithZIndexManager();
        this.loadPanels();
    }

    async loadPanelModules() {
        try {
            logMessage('[DebugPanelManager] Loading debug panel modules...', 'debug');
            const panelImports = [
                import('/client/settings/panels/CssFilesPanel/CssFilesPanel.js'),
                import('/client/settings/panels/javascript/JavaScriptPanel.js'),
                import('/client/settings/panels/dev-tools/DevToolsPanel.js'),
            ];
            await Promise.all(panelImports);
            logMessage(`[DebugPanelManager] Successfully loaded ${debugPanelRegistry.getPanels().length} debug panel modules.`, 'debug');
        } catch (error) {
            logMessage('[DebugPanelManager] Failed to load debug panel modules', 'error');
            console.error(error);
        }
    }

    createPanelDOM() {
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'debug-panel';
        this.panelElement.className = 'settings-panel'; // Reuse styles
        this.panelElement.style.cssText = `
            position: fixed;
            display: ${this.isVisible ? 'flex' : 'none'};
            left: ${this.currentPos.x}px;
            top: ${this.currentPos.y}px;
            width: ${this.currentSize.width}px;
            height: ${this.currentSize.height}px;
        `;

        this.headerElement = document.createElement('div');
        this.headerElement.className = 'settings-panel-header';
        this.headerElement.innerHTML = `
            <span class="settings-panel-title">Debug Panel</span>
            <button class="settings-panel-close" aria-label="Close Debug Panel">X</button>
        `;

        this.contentElement = document.createElement('div');
        this.contentElement.className = 'settings-panel-content';

        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'settings-panel-resize-handle';
        this.resizeHandle.innerHTML = '⋰';

        this.panelElement.appendChild(this.headerElement);
        this.panelElement.appendChild(this.contentElement);
        this.panelElement.appendChild(this.resizeHandle);
        document.body.appendChild(this.panelElement);

        this.closeButton = this.headerElement.querySelector('.settings-panel-close');
    }

    attachEventListeners() {
        this.headerElement.addEventListener('mousedown', this.startDrag.bind(this));
        this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
        this.closeButton.addEventListener('click', () => this.hide());
        
        this.panelElement.addEventListener('mousedown', () => this.bringToFront());

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) this.doDrag(e);
            if (this.isResizing) this.doResize(e);
        });
        window.addEventListener('mouseup', () => {
            if (this.isDragging) this.endDrag();
            if (this.isResizing) this.endResize();
        });
    }
    
    loadPanels() {
        debugPanelRegistry.getPanels().forEach(panelConfig => {
            const sectionId = panelConfig.id;
            const sectionContainer = document.createElement('div');
            sectionContainer.classList.add('settings-section-container');
            
            const header = document.createElement('div');
            header.className = 'settings-section-header';
            header.textContent = panelConfig.title;
            header.addEventListener('click', () => this.toggleSectionCollapse(sectionId));
            
            const content = document.createElement('div');
            content.className = 'settings-section-content-wrapper';
            
            sectionContainer.appendChild(header);
            sectionContainer.appendChild(content);
            this.contentElement.appendChild(sectionContainer);
            
            const PanelComponent = panelConfig.component;
            this.sectionInstances[sectionId] = new PanelComponent(content);
        });
    }
    
    toggleSectionCollapse(sectionId) {
        const section = this.sectionInstances[sectionId];
        if (section && section.containerElement) {
            const contentWrapper = section.containerElement.parentElement;
            contentWrapper.classList.toggle('collapsed');
        }
    }
    
    toggleVisibility() {
        logMessage(`[DebugPanelManager] Toggling visibility. Currently visible: ${this.isVisible}`, 'debug');
        this.isVisible ? this.hide() : this.show();
    }
    
    show() {
        this.isVisible = true;
        this.panelElement.style.display = 'flex';
        this.bringToFront();
        logMessage(`[DebugPanelManager] Panel shown.`, 'debug');
        console.log('[DebugPanelManager] panelElement rect:', this.panelElement.getBoundingClientRect());
    }
    
    hide() {
        this.isVisible = false;
        this.panelElement.style.display = 'none';
    }

    startDrag(e) {
        if (e.target.tagName === 'BUTTON') return;
        this.isDragging = true;
        const rect = this.panelElement.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    doDrag(e) {
        if (!this.isDragging) return;
        this.currentPos.x = e.clientX - this.dragOffset.x;
        this.currentPos.y = e.clientY - this.dragOffset.y;
        this.panelElement.style.left = `${this.currentPos.x}px`;
        this.panelElement.style.top = `${this.currentPos.y}px`;
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.savePersistedState();
    }

    startResize(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isResizing = true;
        this.resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: this.panelElement.offsetWidth,
            height: this.panelElement.offsetHeight
        };
    }

    doResize(e) {
        if (!this.isResizing) return;
        this.currentSize.width = Math.max(300, this.resizeStart.width + (e.clientX - this.resizeStart.x));
        this.currentSize.height = Math.max(200, this.resizeStart.height + (e.clientY - this.resizeStart.y));
        this.panelElement.style.width = `${this.currentSize.width}px`;
        this.panelElement.style.height = `${this.currentSize.height}px`;
    }

    endResize() {
        if (!this.isResizing) return;
        this.isResizing = false;
        this.savePersistedState();
    }

    registerWithZIndexManager() {
        if (this.panelElement && zIndexManager) {
            zIndexManager.register(this.panelElement, 'UI', 60, { name: 'Debug Panel' });
        }
    }

    bringToFront() {
        if (this.panelElement && zIndexManager) {
            zIndexManager.bringToFront(this.panelElement);
        }
    }

    savePersistedState() {
        const state = {
            position: this.currentPos,
            size: this.currentSize,
            visible: this.isVisible,
        };
        localStorage.setItem(DEBUG_PANEL_STATE_KEY, JSON.stringify(state));
    }

    loadPersistedState() {
        try {
            const savedState = localStorage.getItem(DEBUG_PANEL_STATE_KEY);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                this.currentPos = parsed.position || this.currentPos;
                this.currentSize = parsed.size || this.currentSize;
                this.isVisible = parsed.visible || false;
            }
        } catch (e) {
            logMessage('Failed to load debug panel state', 'error');
        }
    }

    destroy() {
        if (this.panelElement) {
            this.panelElement.remove();
            this.panelElement = null;
        }
        // Destroy section instances
        Object.values(this.sectionInstances).forEach(instance => {
            if (instance && typeof instance.destroy === 'function') {
                instance.destroy();
            }
        });
    }
}

export const debugPanelManager = new DebugPanelManager(); 