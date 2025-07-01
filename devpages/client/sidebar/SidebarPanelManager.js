/**
 * SidebarPanelManager.js - Manages reorderable sidebar panels with drag and drop
 */
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';

export class SidebarPanelManager {
    constructor() {
        this.panels = new Map();
        this.container = null;
        this.panelOrder = JSON.parse(localStorage.getItem('sidebarPanelOrder') || '[]');
        this.draggedPanel = null;
        this.dropZone = null;
        
        this.log('SidebarPanelManager created');
    }

    log(message, level = 'info') {
        const type = 'SIDEBAR_PANELS';
        if (typeof window.logMessage === 'function') {
            window.logMessage(message, level, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    setContainer(containerElement) {
        this.container = containerElement;
        this.setupDragAndDrop();
        this.log('Container set and drag/drop initialized');
    }

    register(panelId, config) {
        const panel = {
            id: panelId,
            title: config.title || panelId,
            icon: config.icon || 'default',
            category: config.category || 'general',
            priority: config.priority || 50,
            render: config.render || (() => `<div>Panel ${panelId}</div>`),
            onActivate: config.onActivate || (() => {}),
            onFloat: config.onFloat || (() => {}),
            onDock: config.onDock || (() => {}),
            canFloat: config.canFloat !== false,
            canClose: config.canClose !== false,
            isVisible: config.isVisible !== false,
            isFloating: false,
            metadata: config.metadata || {},
            element: null
        };

        this.panels.set(panelId, panel);
        
        // Add to order if not already there
        if (!this.panelOrder.includes(panelId)) {
            this.panelOrder.push(panelId);
            this.savePanelOrder();
        }

        this.log(`Registered panel: ${panelId} (${panel.title})`);
        
        if (this.container && panel.isVisible) {
            this.renderPanel(panelId);
        }
    }

    renderPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !this.container) return;

        // Create panel element
        const panelElement = document.createElement('div');
        panelElement.className = 'sidebar-panel';
        panelElement.dataset.panelId = panelId;
        panelElement.draggable = true;
        
        const iconPath = `/client/styles/icons/${panel.icon}.svg`;
        
        panelElement.innerHTML = `
            <div class="sidebar-panel-header">
                <div class="panel-drag-handle"><img src="${iconPath}" alt="${panel.title} icon"></div>
                <div class="panel-title">${panel.title}</div>
                <div class="panel-actions">
                    ${panel.canFloat ? `<button class="panel-action-btn float-btn" title="Float Panel">⏏</button>` : ''}
                    ${panel.canClose ? `<button class="panel-action-btn close-btn" title="Close Panel">×</button>` : ''}
                </div>
            </div>
            <div class="sidebar-panel-content">
                ${panel.render()}
            </div>
        `;

        // Add event listeners
        this.attachPanelEventListeners(panelElement, panel);
        
        // Insert in correct order
        this.insertPanelInOrder(panelElement, panelId);
        
        panel.element = panelElement;
        
        // Call activation handler
        if (panel.onActivate) {
            panel.onActivate();
        }
    }

    insertPanelInOrder(panelElement, panelId) {
        const currentIndex = this.panelOrder.indexOf(panelId);
        const existingPanels = Array.from(this.container.querySelectorAll('.sidebar-panel'));
        
        if (currentIndex === 0 || existingPanels.length === 0) {
            this.container.insertBefore(panelElement, this.container.firstChild);
        } else {
            // Find the panel that should come before this one
            let insertAfter = null;
            for (let i = currentIndex - 1; i >= 0; i--) {
                const beforePanelId = this.panelOrder[i];
                insertAfter = this.container.querySelector(`[data-panel-id="${beforePanelId}"]`);
                if (insertAfter) break;
            }
            
            if (insertAfter) {
                insertAfter.insertAdjacentElement('afterend', panelElement);
            } else {
                this.container.appendChild(panelElement);
            }
        }
    }

    attachPanelEventListeners(panelElement, panel) {
        // Drag and drop
        panelElement.addEventListener('dragstart', (e) => this.handleDragStart(e, panel));
        panelElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        // Panel actions
        const floatBtn = panelElement.querySelector('.float-btn');
        if (floatBtn) {
            floatBtn.addEventListener('click', () => this.floatPanel(panel.id));
        }
        
        const closeBtn = panelElement.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel(panel.id));
        }
        
        // Header click to focus/activate
        const header = panelElement.querySelector('.sidebar-panel-header');
        header.addEventListener('click', (e) => {
            if (!e.target.closest('.panel-actions') && !e.target.closest('.panel-drag-handle')) {
                this.togglePanelCollapse(panel.id);
            }
        });
    }

    togglePanelCollapse(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.element) return;

        panel.element.classList.toggle('collapsed');
        this.log(`Toggled collapse for panel: ${panel.title}`);
    }

    setupDragAndDrop() {
        if (!this.container) return;
        
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.handleDragOver(e);
        });
        
        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleDrop(e);
        });
        
        this.container.addEventListener('dragleave', (e) => {
            this.handleDragLeave(e);
        });
    }

    handleDragStart(e, panel) {
        this.draggedPanel = panel;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', panel.id);
        
        // Add visual feedback
        e.target.classList.add('dragging');
        this.log(`Started dragging panel: ${panel.title}`);
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.clearDropZones();
        this.draggedPanel = null;
    }

    handleDragOver(e) {
        if (!this.draggedPanel) return;
        
        const afterElement = this.getDragAfterElement(e.clientY);
        const draggedElement = this.draggedPanel.element;
        
        this.clearDropZones();
        
        if (afterElement == null) {
            this.container.appendChild(draggedElement);
        } else {
            this.container.insertBefore(draggedElement, afterElement);
        }
        
        this.showDropZone(afterElement);
    }

    handleDrop(e) {
        if (!this.draggedPanel) return;
        
        // Update panel order based on new DOM order
        const newOrder = Array.from(this.container.querySelectorAll('.sidebar-panel'))
            .map(el => el.dataset.panelId);
        
        this.panelOrder = newOrder;
        this.savePanelOrder();
        
        this.clearDropZones();
        this.log(`Reordered panels: ${newOrder.join(', ')}`);
    }

    handleDragLeave(e) {
        // Only clear if leaving the container entirely
        if (!this.container.contains(e.relatedTarget)) {
            this.clearDropZones();
        }
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

    showDropZone(afterElement) {
        const dropZone = document.createElement('div');
        dropZone.className = 'panel-drop-zone';
        dropZone.innerHTML = '<div class="drop-indicator">Drop here</div>';
        
        if (afterElement) {
            this.container.insertBefore(dropZone, afterElement);
        } else {
            this.container.appendChild(dropZone);
        }
        
        this.dropZone = dropZone;
    }

    clearDropZones() {
        if (this.dropZone) {
            this.dropZone.remove();
            this.dropZone = null;
        }
    }

    activatePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        
        // Remove active state from all panels
        this.container.querySelectorAll('.sidebar-panel').forEach(el => {
            el.classList.remove('active');
        });
        
        // Add active state to this panel
        if (panel.element) {
            panel.element.classList.add('active');
        }
        
        // Call activation handler
        if (panel.onActivate) {
            panel.onActivate();
        }
        
        this.log(`Activated panel: ${panel.title}`);
    }

    floatPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.canFloat) return;
        
        // Create floating window
        const floatingWindow = document.createElement('div');
        floatingWindow.className = 'floating-panel-window';
        
        const iconPath = `/client/styles/icons/${panel.icon}.svg`;
        
        floatingWindow.innerHTML = `
            <div class="floating-panel-header">
                <div class="panel-icon"><img src="${iconPath}" alt="${panel.title} icon"></div>
                <div class="panel-title">${panel.title}</div>
                <div class="floating-panel-actions">
                    <button class="panel-action-btn dock-btn" title="Dock Panel">⧈</button>
                    <button class="panel-action-btn close-btn" title="Close Panel">✕</button>
                </div>
            </div>
            <div class="floating-panel-content">
                ${panel.render()}
            </div>
        `;
        
        // Position the floating window
        floatingWindow.style.position = 'fixed';
        floatingWindow.style.top = '100px';
        floatingWindow.style.left = '100px';
        floatingWindow.style.width = '400px';
        floatingWindow.style.height = '300px';
        floatingWindow.style.zIndex = '1000';
        
        document.body.appendChild(floatingWindow);
        
        // Hide the docked panel
        if (panel.element) {
            panel.element.style.display = 'none';
        }
        
        panel.isFloating = true;
        panel.floatingElement = floatingWindow;
        
        // Add event listeners for floating window
        const dockBtn = floatingWindow.querySelector('.dock-btn');
        dockBtn.addEventListener('click', () => this.dockPanel(panelId));
        
        const closeBtn = floatingWindow.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.closePanel(panelId));
        
        // Make it draggable
        this.makeFloatingPanelDraggable(floatingWindow);
        
        if (panel.onFloat) {
            panel.onFloat();
        }
        
        this.log(`Floated panel: ${panel.title}`);
    }

    dockPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.isFloating) return;
        
        // Remove floating window
        if (panel.floatingElement) {
            panel.floatingElement.remove();
            panel.floatingElement = null;
        }
        
        // Show the docked panel
        if (panel.element) {
            panel.element.style.display = '';
        } else {
            // If element doesn't exist, render it
            this.renderPanel(panelId);
        }
        
        panel.isFloating = false;
        
        if (panel.onDock) {
            panel.onDock();
        }
        
        this.log(`Docked panel: ${panel.title}`);
        this.updatePanelManager();
    }

    closePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        
        if (!panel.canClose && !panel.isFloating) return;

        if (panel.isFloating && panel.floatingElement) {
            panel.floatingElement.remove();
            panel.floatingElement = null;
        }
        
        if (panel.element) {
            panel.element.style.display = 'none';
        }
        
        panel.isVisible = false;
        this.log(`Closed panel: ${panel.title}`);
        this.updatePanelManager();
    }

    showPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        if (panel.element) {
            panel.element.style.display = '';
        } else {
            this.renderPanel(panelId);
        }
        panel.isVisible = true;
        panel.isFloating = false; // Ensure it's not marked as floating
        this.log(`Shown panel: ${panel.title}`);
        this.updatePanelManager();
    }

    togglePanelVisibility(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        if (panel.isVisible) {
            this.closePanel(panelId);
        } else {
            this.showPanel(panelId);
        }
    }

    makeFloatingPanelDraggable(windowElement) {
        const header = windowElement.querySelector('.floating-panel-header');
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.floating-panel-actions')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(windowElement.style.left);
            startTop = parseInt(windowElement.style.top);
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            e.preventDefault();
        });
        
        function handleMouseMove(e) {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            windowElement.style.left = (startLeft + deltaX) + 'px';
            windowElement.style.top = (startTop + deltaY) + 'px';
        }
        
        function handleMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    }

    renderAllPanels() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        for (const panelId of this.panelOrder) {
            const panel = this.panels.get(panelId);
            if (panel && panel.isVisible) {
                this.renderPanel(panelId);
            }
        }
        
        this.log(`Rendered visible panels`);
        this.updatePanelManager();
    }

    savePanelOrder() {
        localStorage.setItem('sidebarPanelOrder', JSON.stringify(this.panelOrder));
    }

    getPanelOrder() {
        return [...this.panelOrder];
    }

    setPanelOrder(newOrder) {
        this.panelOrder = newOrder;
        this.savePanelOrder();
        this.renderAllPanels();
    }

    getPanel(panelId) {
        return this.panels.get(panelId);
    }

    getAllPanels() {
        return Array.from(this.panels.values());
    }

    // Content generators for default panels
    generatePanelManagerContent() {
        let content = '<div class="panel-manager-grid">';
        const sortedPanels = [...this.panels.values()].sort((a, b) => a.priority - b.priority);

        for (const panel of sortedPanels) {
            if (panel.id === 'panel-manager') continue;
            
            const iconPath = `/client/styles/icons/${panel.icon}.svg`;
            const activeClass = panel.isVisible && !panel.isFloating ? 'active' : 'inactive';
            content += `
                <div class="panel-manager-item ${activeClass}" onclick="sidebarPanelManager.togglePanelVisibility('${panel.id}')" title="Toggle ${panel.title}">
                    <div class="panel-manager-icon"><img src="${iconPath}" alt="${panel.title}"/></div>
                </div>
            `;
        }
        content += '</div>';
        return content;
    }

    updatePanelManager() {
        const panelManager = this.panels.get('panel-manager');
        if (panelManager && panelManager.element) {
            const content = panelManager.element.querySelector('.sidebar-panel-content');
            if (content) {
                content.innerHTML = this.generatePanelManagerContent();
            }
        }
    }

    generateFilesContent() {
        return `
            <div class="files-panel">
                <div id="file-list-container">
                    <!-- File list will be rendered here -->
                </div>
            </div>
        `;
    }

    generateContextContent() {
        return `
            <div class="context-manager-panel">
                <div class="context-header">
                    <button class="panel-action-btn" onclick="sidebarPanelManager.addContext()">+ Add Context</button>
                </div>
                <div class="context-list">
                    <div class="context-item active">
                        <div class="context-name">Current Project</div>
                        <div class="context-actions">
                            <button class="context-action-btn" onclick="sidebarPanelManager.editContext('current')" title="Edit">✏️</button>
                            <button class="context-action-btn" onclick="sidebarPanelManager.deleteContext('current')" title="Delete">🗑️</button>
                        </div>
                    </div>
                    <div class="context-item">
                        <div class="context-name">Documentation</div>
                        <div class="context-actions">
                            <button class="context-action-btn" onclick="sidebarPanelManager.editContext('docs')" title="Edit">✏️</button>
                            <button class="context-action-btn" onclick="sidebarPanelManager.deleteContext('docs')" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateTokensContent() {
        return `
            <div class="design-tokens-panel">
                <div class="tokens-panel-header">
                    <select id="token-filter-select" onchange="sidebarPanelManager.filterTokens(this.value)">
                        <option value="all">All Groups</option>
                        <option value="color">Color</option>
                        <option value="typography">Typography</option>
                        <option value="spacing">Spacing</option>
                        <option value="layout">Layout</option>
                        <option value="transition">Transitions</option>
                    </select>
                </div>
                <div class="token-grid">
                    <div class="token-category">
                        <div class="token-category-title">Colors</div>
                        <div class="token-item" data-category="color" onclick="sidebarPanelManager.copyToken('--color-primary')">
                            <div class="token-info">
                                <div class="token-name">--color-primary</div>
                                <div class="token-value">#0066cc</div>
                            </div>
                            <div class="token-preview" style="background-color: var(--color-primary);"></div>
                            <button class="token-copy-btn" title="Copy">📋</button>
                        </div>
                        <div class="token-item" data-category="color" onclick="sidebarPanelManager.copyToken('--color-background')">
                            <div class="token-info">
                                <div class="token-name">--color-background</div>
                                <div class="token-value">#ffffff</div>
                            </div>
                            <div class="token-preview" style="background-color: var(--color-background);"></div>
                            <button class="token-copy-btn" title="Copy">📋</button>
                        </div>
                    </div>
                    <div class="token-category">
                        <div class="token-category-title">Typography</div>
                        <div class="token-item" data-category="typography" onclick="sidebarPanelManager.copyToken('--font-size-base')">
                            <div class="token-info">
                                <div class="token-name">--font-size-base</div>
                                <div class="token-value">14px</div>
                            </div>
                            <button class="token-copy-btn" title="Copy">📋</button>
                        </div>
                        <div class="token-item" data-category="typography" onclick="sidebarPanelManager.copyToken('--font-mono')">
                            <div class="token-info">
                                <div class="token-name">--font-mono</div>
                                <div class="token-value">Monaco, monospace</div>
                            </div>
                            <button class="token-copy-btn" title="Copy">📋</button>
                        </div>
                    </div>
                    <div class="token-category">
                        <div class="token-category-title">Spacing</div>
                        <div class="token-item" data-category="spacing" onclick="sidebarPanelManager.copyToken('--spacing-sm')">
                            <div class="token-info">
                                <div class="token-name">--spacing-sm</div>
                                <div class="token-value">8px</div>
                            </div>
                            <button class="token-copy-btn" title="Copy">📋</button>
                        </div>
                        <div class="token-item" data-category="spacing" onclick="sidebarPanelManager.copyToken('--spacing-md')">
                            <div class="token-info">
                                <div class="token-name">--spacing-md</div>
                                <div class="token-value">16px</div>
                            </div>
                            <button class="token-copy-btn" title="Copy">📋</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateLogsContent() {
        return `
            <div class="logs-panel">
                <div id="log-panel-container">
                    <!-- Log content will be rendered here -->
                </div>
            </div>
        `;
    }

    // Context management methods
    addContext() {
        const name = prompt('Enter context name:');
        if (name) {
            this.log(`Adding context: ${name}`);
            // TODO: Implement context creation
        }
    }

    editContext(contextId) {
        this.log(`Editing context: ${contextId}`);
        // TODO: Implement context editing
    }

    deleteContext(contextId) {
        if (confirm('Delete this context?')) {
            this.log(`Deleting context: ${contextId}`);
            // TODO: Implement context deletion
        }
    }

    // Token management methods
    filterTokens(category) {
        const panel = this.panels.get('tokens');
        if (!panel || !panel.element) return;

        const tokenItems = panel.element.querySelectorAll('.token-item');
        tokenItems.forEach(item => {
            if (category === 'all' || item.dataset.category === category) {
                item.style.display = 'grid';
            } else {
                item.style.display = 'none';
            }
        });

        const selector = panel.element.querySelector('#token-filter-select');
        if (selector) {
            selector.value = category;
        }

        this.log(`Filtered tokens to category: ${category}`);
    }
    
    copyToken(tokenName) {
        const computedStyle = getComputedStyle(document.documentElement);
        const tokenValue = computedStyle.getPropertyValue(tokenName);
        
        if (tokenValue) {
            navigator.clipboard.writeText(tokenValue.trim()).then(() => {
                this.log(`Copied token ${tokenName}: ${tokenValue.trim()}`);
                // Show temporary feedback
                this.showCopyFeedback(tokenName);
            }).catch(err => {
                this.log(`Failed to copy token: ${err}`, 'error');
            });
        } else {
            // Fallback to copying the token name itself
            navigator.clipboard.writeText(tokenName).then(() => {
                this.log(`Copied token name: ${tokenName}`);
                this.showCopyFeedback(tokenName);
            });
        }
    }

    showCopyFeedback(tokenName) {
        // Find the token item and show brief feedback
        const tokenItems = document.querySelectorAll('.token-item');
        tokenItems.forEach(item => {
            const nameEl = item.querySelector('.token-name');
            if (nameEl && nameEl.textContent === tokenName) {
                const copyBtn = item.querySelector('.token-copy-btn');
                if (copyBtn) {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✓';
                    copyBtn.style.color = 'var(--color-success, #28a745)';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.color = '';
                    }, 1000);
                }
            }
        });
    }

    // Initialize default panels
    initializeDefaultPanels() {
        this.register('panel-manager', {
            title: 'Panel Manager',
            icon: 'panel-manager',
            category: 'core',
            priority: 5,
            render: () => this.generatePanelManagerContent(),
            canClose: false,
            canFloat: false
        });

        this.register('files', {
            title: 'Files',
            icon: 'files',
            category: 'navigation',
            priority: 10,
            render: () => this.generateFilesContent()
        });

        this.register('context', {
            title: 'Context Manager',
            icon: 'context',
            category: 'tools',
            priority: 20,
            render: () => this.generateContextContent()
        });

        this.register('tokens', {
            title: 'Design Tokens',
            icon: 'tokens',
            category: 'tools',
            priority: 30,
            render: () => this.generateTokensContent()
        });

        this.register('logs', {
            title: 'Logs',
            icon: 'logs',
            category: 'debug',
            priority: 40,
            render: () => this.generateLogsContent()
        });

        this.log('Default panels initialized');
    }
}

// Create singleton instance
export const sidebarPanelManager = new SidebarPanelManager(); 