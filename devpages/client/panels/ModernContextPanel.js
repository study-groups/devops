/**
 * @file client/panels/ModernContextPanel.js
 * @description Modernized Context Panel using ModernBasePanel
 */

import { ModernBasePanel } from './ModernBasePanel.js';
import { appStore } from '/client/appState.js';
import { getParentPath, getFilename, pathJoin } from '/client/utils/pathUtils.js';
import eventBus from '/client/eventBus.js';
import { renderSettingsSections } from '/client/settings/core/SettingsSectionRenderer.js';
import { createSelector } from '@reduxjs/toolkit';

export class ModernContextPanel extends ModernBasePanel {
    constructor(options = {}) {
        super({
            id: 'context',
            title: 'Context Manager',
            collapsible: true,
            resizable: true,
            draggable: true,
            order: 2,
            minWidth: 250,
            maxWidth: 400,
            ...options
        });

        // Context-specific state
        this.currentPath = '';
        this.contextItems = [];
        this.isSettingsMode = false;
        
        // Memoized selectors for performance
        this.fileSelector = createSelector(
            [state => state.file?.currentPathname],
            currentPathname => currentPathname || ''
        );
        
        this.contextSelector = createSelector(
            [state => state.context],
            context => context || {}
        );
    }

    /**
     * Initialize context panel
     */
    async onInit() {
        // Set up file path monitoring
        this.setupFilePathMonitoring();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial context
        await this.loadInitialContext();
        
        this.log('Context panel initialized');
    }

    /**
     * Set up file path monitoring
     */
    setupFilePathMonitoring() {
        // Subscribe to file path changes
        this.fileUnsubscribe = appStore.subscribe(() => {
            const newPath = this.fileSelector(appStore.getState());
            if (newPath !== this.currentPath) {
                this.currentPath = newPath;
                this.updateContextForPath(newPath);
                this.requestRender();
            }
        });
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for context updates
        eventBus.on('context:updated', this.handleContextUpdate.bind(this));
        eventBus.on('context:cleared', this.handleContextClear.bind(this));
        eventBus.on('file:selected', this.handleFileSelected.bind(this));
        
        // Listen for settings mode toggle
        eventBus.on('context:toggleSettings', this.toggleSettingsMode.bind(this));
    }

    /**
     * Load initial context from current state
     */
    async loadInitialContext() {
        const state = appStore.getState();
        this.currentPath = this.fileSelector(state);
        
        if (this.currentPath) {
            await this.updateContextForPath(this.currentPath);
        }
    }

    /**
     * Render context panel content
     */
    renderContent() {
        const container = document.createElement('div');
        container.className = 'context-panel-content';

        // Render mode toggle
        container.appendChild(this.renderModeToggle());

        // Render content based on mode
        if (this.isSettingsMode) {
            container.appendChild(this.renderSettingsContent());
        } else {
            container.appendChild(this.renderContextContent());
        }

        return container;
    }

    /**
     * Render mode toggle buttons
     */
    renderModeToggle() {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'context-mode-toggle';

        const contextBtn = document.createElement('button');
        contextBtn.className = `mode-btn ${!this.isSettingsMode ? 'active' : ''}`;
        contextBtn.textContent = 'Context';
        contextBtn.addEventListener('click', () => this.setMode('context'));

        const settingsBtn = document.createElement('button');
        settingsBtn.className = `mode-btn ${this.isSettingsMode ? 'active' : ''}`;
        settingsBtn.textContent = 'Settings';
        settingsBtn.addEventListener('click', () => this.setMode('settings'));

        toggleContainer.appendChild(contextBtn);
        toggleContainer.appendChild(settingsBtn);

        return toggleContainer;
    }

    /**
     * Render context content
     */
    renderContextContent() {
        const content = document.createElement('div');
        content.className = 'context-content';

        // Current path display
        if (this.currentPath) {
            const pathSection = this.createPathSection();
            content.appendChild(pathSection);
        }

        // Context items
        const itemsSection = this.createContextItemsSection();
        content.appendChild(itemsSection);

        // Actions
        const actionsSection = this.createActionsSection();
        content.appendChild(actionsSection);

        return content;
    }

    /**
     * Render settings content
     */
    renderSettingsContent() {
        const content = document.createElement('div');
        content.className = 'context-settings-content';

        // Use existing settings renderer
        const settingsConfig = {
            sections: [
                {
                    id: 'context-behavior',
                    title: 'Context Behavior',
                    items: [
                        {
                            type: 'checkbox',
                            id: 'auto-update-context',
                            label: 'Auto-update context on file change',
                            value: true
                        },
                        {
                            type: 'checkbox',
                            id: 'show-parent-context',
                            label: 'Show parent directory context',
                            value: false
                        }
                    ]
                },
                {
                    id: 'context-display',
                    title: 'Display Options',
                    items: [
                        {
                            type: 'select',
                            id: 'context-view-mode',
                            label: 'View Mode',
                            options: [
                                { value: 'list', label: 'List View' },
                                { value: 'tree', label: 'Tree View' },
                                { value: 'compact', label: 'Compact View' }
                            ],
                            value: 'list'
                        }
                    ]
                }
            ]
        };

        renderSettingsSections(content, settingsConfig);
        return content;
    }

    /**
     * Create path section
     */
    createPathSection() {
        const section = document.createElement('div');
        section.className = 'context-path-section';

        const header = document.createElement('h4');
        header.textContent = 'Current Path';
        section.appendChild(header);

        const pathDisplay = document.createElement('div');
        pathDisplay.className = 'path-display';
        
        const pathParts = this.currentPath.split('/').filter(part => part);
        pathParts.forEach((part, index) => {
            const partElement = document.createElement('span');
            partElement.className = 'path-part';
            partElement.textContent = part;
            
            if (index < pathParts.length - 1) {
                partElement.classList.add('clickable');
                partElement.addEventListener('click', () => {
                    const parentPath = pathParts.slice(0, index + 1).join('/');
                    this.navigateToPath(parentPath);
                });
            } else {
                partElement.classList.add('current');
            }
            
            pathDisplay.appendChild(partElement);
            
            if (index < pathParts.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'path-separator';
                separator.textContent = '/';
                pathDisplay.appendChild(separator);
            }
        });

        section.appendChild(pathDisplay);
        return section;
    }

    /**
     * Create context items section
     */
    createContextItemsSection() {
        const section = document.createElement('div');
        section.className = 'context-items-section';

        const header = document.createElement('h4');
        header.textContent = 'Context Items';
        section.appendChild(header);

        if (this.contextItems.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No context items available';
            section.appendChild(emptyMessage);
        } else {
            const itemsList = document.createElement('ul');
            itemsList.className = 'context-items-list';

            this.contextItems.forEach(item => {
                const listItem = document.createElement('li');
                listItem.className = 'context-item';
                
                const itemContent = document.createElement('div');
                itemContent.className = 'item-content';
                itemContent.innerHTML = `
                    <span class="item-name">${item.name}</span>
                    <span class="item-type">${item.type}</span>
                `;
                
                if (item.description) {
                    const description = document.createElement('div');
                    description.className = 'item-description';
                    description.textContent = item.description;
                    itemContent.appendChild(description);
                }
                
                listItem.appendChild(itemContent);
                itemsList.appendChild(listItem);
            });

            section.appendChild(itemsList);
        }

        return section;
    }

    /**
     * Create actions section
     */
    createActionsSection() {
        const section = document.createElement('div');
        section.className = 'context-actions-section';

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'context-action-btn primary';
        refreshBtn.textContent = 'Refresh Context';
        refreshBtn.addEventListener('click', () => this.refreshContext());

        const clearBtn = document.createElement('button');
        clearBtn.className = 'context-action-btn secondary';
        clearBtn.textContent = 'Clear Context';
        clearBtn.addEventListener('click', () => this.clearContext());

        section.appendChild(refreshBtn);
        section.appendChild(clearBtn);

        return section;
    }

    /**
     * Set panel mode
     */
    setMode(mode) {
        const wasSettingsMode = this.isSettingsMode;
        this.isSettingsMode = mode === 'settings';
        
        if (wasSettingsMode !== this.isSettingsMode) {
            this.requestRender();
            eventBus.emit('context:modeChanged', { mode });
        }
    }

    /**
     * Toggle settings mode
     */
    toggleSettingsMode() {
        this.setMode(this.isSettingsMode ? 'context' : 'settings');
    }

    /**
     * Update context for given path
     */
    async updateContextForPath(path) {
        try {
            // Simulate context loading (replace with actual implementation)
            this.contextItems = await this.loadContextForPath(path);
            this.requestRender();
            
            eventBus.emit('context:updated', { path, items: this.contextItems });
        } catch (error) {
            this.error('Failed to update context for path:', path, error);
        }
    }

    /**
     * Load context items for path (placeholder implementation)
     */
    async loadContextForPath(path) {
        // This would be replaced with actual context loading logic
        const items = [];
        
        if (path) {
            items.push({
                name: getFilename(path),
                type: 'file',
                description: `Current file: ${path}`
            });
            
            const parentPath = getParentPath(path);
            if (parentPath && parentPath !== path) {
                items.push({
                    name: getFilename(parentPath) || 'Root',
                    type: 'directory',
                    description: `Parent directory: ${parentPath}`
                });
            }
        }
        
        return items;
    }

    /**
     * Navigate to path
     */
    navigateToPath(path) {
        eventBus.emit('file:navigate', { path });
    }

    /**
     * Refresh context
     */
    async refreshContext() {
        await this.updateContextForPath(this.currentPath);
        this.log('Context refreshed');
    }

    /**
     * Clear context
     */
    clearContext() {
        this.contextItems = [];
        this.requestRender();
        eventBus.emit('context:cleared');
        this.log('Context cleared');
    }

    /**
     * Request re-render (debounced)
     */
    requestRender() {
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        this.renderTimeout = setTimeout(() => {
            if (this.isMounted && this.container) {
                const newContent = this.renderContent();
                const contentContainer = this.element.querySelector('.panel-content');
                if (contentContainer) {
                    contentContainer.innerHTML = '';
                    contentContainer.appendChild(newContent);
                }
            }
        }, 100);
    }

    // Event handlers
    handleContextUpdate(data) {
        this.log('Context updated:', data);
    }

    handleContextClear() {
        this.log('Context cleared');
    }

    handleFileSelected(data) {
        if (data.path !== this.currentPath) {
            this.updateContextForPath(data.path);
        }
    }

    /**
     * Enhanced state change handling
     */
    onStateChange(newState) {
        super.onStateChange(newState);
        
        // Handle panel-specific state changes
        if (newState.mode !== undefined && newState.mode !== (this.isSettingsMode ? 'settings' : 'context')) {
            this.setMode(newState.mode);
        }
    }

    /**
     * Cleanup on unmount
     */
    onUnmountStart() {
        // Clean up subscriptions
        if (this.fileUnsubscribe) {
            this.fileUnsubscribe();
            this.fileUnsubscribe = null;
        }
        
        // Clean up event listeners
        eventBus.off('context:updated', this.handleContextUpdate);
        eventBus.off('context:cleared', this.handleContextClear);
        eventBus.off('file:selected', this.handleFileSelected);
        eventBus.off('context:toggleSettings', this.toggleSettingsMode);
        
        // Clear timeouts
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        this.log('Context panel cleaned up');
    }
}
