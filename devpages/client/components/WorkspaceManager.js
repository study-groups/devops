/**
 * WorkspaceManager.js - Manages workspace UI state and content display
 * Automatically sets up editor and preview when files are loaded
 */

import { appStore } from '/client/appState.js';
import { ZoneTopBar } from './ZoneTopBar.js';

class WorkspaceManager {
    constructor() {
        this.initialized = false;
        this.lastFileContent = null;
        this.lastFilePath = null;
        this.sidebarTopBar = null;
        this.editorTopBar = null;
        this.previewTopBar = null;
        this.sidebarTabs = new Map(); // Track sidebar content tabs
    }

    initialize() {
        if (this.initialized) return;
        
        console.log('[WorkspaceManager] Initializing...');
        
        // Subscribe to Redux state changes
        appStore.subscribe(() => {
            this.handleStateChange();
        });
        
        // Set initial zone visibility
        this.updateZoneVisibility(appStore.getState());
        
        this.initialized = true;
        console.log('[WorkspaceManager] Initialized');
    }

    handleStateChange() {
        const state = appStore.getState();
        const fileContent = state.file?.currentFile?.content;
        const filePath = state.file?.currentFile?.pathname;
        
        // Handle UI visibility changes
        this.updateZoneVisibility(state);
        
        // Only act when file content changes
        if (fileContent && fileContent !== this.lastFileContent) {
            console.log(`[WorkspaceManager] New file content detected: ${filePath} (${fileContent.length} chars)`);
            this.setupWorkspaceForFile(fileContent, filePath);
            this.lastFileContent = fileContent;
            this.lastFilePath = filePath;
        }
    }

    updateZoneVisibility(state) {
        const ui = state.ui || {};
        
        // Update sidebar zone visibility
        const sidebarZone = document.getElementById('workspace-sidebar');
        if (sidebarZone) {
            sidebarZone.style.display = ui.leftSidebarVisible ? 'flex' : 'none';
        }
        
        // Update editor zone visibility
        const editorZone = document.getElementById('workspace-editor');
        if (editorZone) {
            editorZone.style.display = ui.editorVisible ? 'flex' : 'none';
        }
        
        // Update preview zone visibility
        const previewZone = document.getElementById('workspace-preview');
        if (previewZone) {
            previewZone.style.display = ui.previewVisible ? 'flex' : 'none';
        }
    }

    setupWorkspaceForFile(content, filePath) {
        const state = appStore.getState();
        
        console.log('[WorkspaceManager] Setting up workspace for file...');
        
        // Respect user's persisted visibility preferences - don't force zones visible
        
        // Wait for UI state to update, then populate containers
        setTimeout(() => {
            this.populateWorkspaceContainers(content, filePath);
            this.initializeZoneTopBars();
        }, 100);
    }

    initializeZoneTopBars() {
        // Initialize sidebar with custom tab bar
        if (!this.sidebarTopBar) {
            const sidebarContainer = document.getElementById('workspace-sidebar');
            if (sidebarContainer) {
                this.createSidebarTabBar(sidebarContainer);
                this.addSidebarTab('files', 'Files', '<div class="sidebar-content">File browser content</div>', true);
                this.addSidebarTab('outline', 'Outline', '<div class="sidebar-content">Document outline</div>', false);
            }
        }

        // Initialize editor top bar
        if (!this.editorTopBar) {
            const editorContainer = document.getElementById('workspace-editor');
            if (editorContainer) {
                this.editorTopBar = new ZoneTopBar(editorContainer, { title: 'Editor' });
                editorContainer.prepend(this.editorTopBar.getElement());
            }
        }

        // Initialize preview top bar
        if (!this.previewTopBar) {
            const previewContainer = document.getElementById('workspace-preview');
            if (previewContainer) {
                this.previewTopBar = new ZoneTopBar(previewContainer, { title: 'Preview' });
                previewContainer.prepend(this.previewTopBar.getElement());
            }
        }
    }

    createSidebarTabBar(container) {
        // Add basic CSS for tabs if not already added
        if (!document.getElementById('sidebar-tab-styles')) {
            const style = document.createElement('style');
            style.id = 'sidebar-tab-styles';
            style.textContent = `
                .sidebar-tab-bar {
                    height: 48px;
                    border-bottom: 1px solid var(--color-border, #ddd);
                    background: var(--color-bg-alt, #f8f9fa);
                    display: flex;
                    align-items: center;
                }
                .sidebar-tabs {
                    display: flex;
                    gap: 1px;
                    padding: 8px 12px;
                    height: 100%;
                    align-items: center;
                }
                .sidebar-tab {
                    padding: 2px 6px;
                    border: 1px solid transparent;
                    background: transparent;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 400;
                    color: var(--color-text-secondary, #666);
                    white-space: nowrap;
                    min-width: 0;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    transition: all 0.15s ease;
                }
                .sidebar-tab:hover {
                    border-color: rgba(0,0,0,0.1);
                    background: rgba(255,255,255,0.8);
                    color: var(--color-text, #333);
                }
                .sidebar-tab.active {
                    border-color: rgba(0,0,0,0.15);
                    background: rgba(255,255,255,0.9);
                    color: var(--color-text, #333);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .sidebar-content-area {
                    flex: 1;
                    padding: 12px;
                    overflow-y: auto;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Create tab bar element
        const tabBar = document.createElement('div');
        tabBar.className = 'sidebar-tab-bar';
        tabBar.innerHTML = `
            <div class="sidebar-tabs"></div>
        `;
        
        // Create content area
        const contentArea = document.createElement('div');
        contentArea.className = 'sidebar-content-area';
        
        // Clear container and add tab system
        container.innerHTML = '';
        container.appendChild(tabBar);
        container.appendChild(contentArea);
        
        this.sidebarTabBar = tabBar;
        this.sidebarContentArea = contentArea;
    }

    addSidebarTab(id, title, content, active = false) {
        if (!this.sidebarTabBar) return;
        
        const tabsContainer = this.sidebarTabBar.querySelector('.sidebar-tabs');
        if (!tabsContainer) return;
        
        // Create tab button
        const tabButton = document.createElement('button');
        tabButton.className = `sidebar-tab ${active ? 'active' : ''}`;
        tabButton.dataset.tabId = id;
        tabButton.textContent = title;
        
        // Add click handler
        tabButton.addEventListener('click', () => {
            this.activateSidebarTab(id);
        });
        
        tabsContainer.appendChild(tabButton);
        this.sidebarTabs.set(id, { title, content, active });
        
        if (active) {
            this.setSidebarContent(content);
        }
    }

    activateSidebarTab(id) {
        // Deactivate all tabs
        const allTabs = this.sidebarTabBar.querySelectorAll('.sidebar-tab');
        allTabs.forEach(tab => tab.classList.remove('active'));
        
        // Activate selected tab
        const selectedTab = this.sidebarTabBar.querySelector(`[data-tab-id="${id}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Show content
        const tabData = this.sidebarTabs.get(id);
        if (tabData) {
            this.setSidebarContent(tabData.content);
        }
    }

    setSidebarContent(content) {
        if (this.sidebarContentArea) {
            this.sidebarContentArea.innerHTML = content;
        }
    }

    populateWorkspaceContainers(content, filePath) {
        const editorContainer = document.getElementById('workspace-editor');
        const previewContainer = document.getElementById('workspace-preview');
        
        if (!editorContainer || !previewContainer) {
            console.warn('[WorkspaceManager] Workspace containers not found');
            return;
        }
        
        // Set up editor if empty or has placeholder content
        if (this.shouldPopulateContainer(editorContainer)) {
            console.log('[WorkspaceManager] Populating editor container...');
            this.createEditor(editorContainer, content, filePath);
        }
        
        // Set up preview if empty or has placeholder content
        if (this.shouldPopulateContainer(previewContainer)) {
            console.log('[WorkspaceManager] Populating preview container...');
            this.createPreview(previewContainer, content, filePath);
        }
        
        // Update button states
        this.updateButtonStates();
    }

    shouldPopulateContainer(container) {
        return container.children.length === 0 || 
               container.textContent.includes('No content') ||
               container.textContent.includes('Loading') ||
               container.textContent.includes('Preview will appear here');
    }

    createEditor(container, content, filePath) {
        const fileName = filePath ? filePath.split('/').pop() : 'file.md';
        
        container.innerHTML = `
            <div class="editor-section">
                <textarea 
                    id="md-editor" 
                    class="markdown-editor" 
                    placeholder="Start typing..."
                >${content}</textarea>
            </div>
        `;
        
        // Create programmable top bar
        this.editorTopBar = new ZoneTopBar(container, {
            title: 'Editor',
            showStats: true,
            showStatus: true
        });
        
        // Insert top bar at the beginning
        const editorSection = container.querySelector('.editor-section');
        editorSection.insertBefore(this.editorTopBar.getElement(), editorSection.firstChild);
        
        // Set initial stats
        this.editorTopBar.setStats({
            'chars': content.length,
            'lines': content.split('\n').length,
            'file': fileName
        });
        
        // Set up editor functionality
        const textarea = container.querySelector('#md-editor');
        if (textarea) {
            // Auto-save on changes
            textarea.addEventListener('input', () => {
                // Update Redux state
                appStore.dispatch({ type: 'editor/setContent', payload: textarea.value });
                
                // Update stats in real-time
                this.editorTopBar.setStats({
                    'chars': textarea.value.length,
                    'lines': textarea.value.split('\n').length
                });
            });
        }
    }

    createPreview(container, content, filePath) {
        container.innerHTML = `
            <div class="preview-section">
                <div class="preview-container">
                    <div style="color: var(--color-text-secondary); text-align: center; padding: 20px;">
                        Rendering preview...
                    </div>
                </div>
            </div>
        `;
        
        // Create programmable top bar
        this.previewTopBar = new ZoneTopBar(container, {
            title: 'Preview',
            showStats: true,
            showStatus: true
        });
        
        // Insert top bar at the beginning
        const previewSection = container.querySelector('.preview-section');
        previewSection.insertBefore(this.previewTopBar.getElement(), previewSection.firstChild);
        
        // Set initial stats and status
        this.previewTopBar
            .setStats({ 'mode': 'markdown' })
            .setStatus('loading', 'Rendering...');
        
        // Trigger markdown rendering
        this.renderPreview(container, content, filePath);
    }

    async renderPreview(container, content, filePath) {
        const previewDiv = container.querySelector('.preview-container');
        if (!previewDiv) return;
        
        try {
            // Try to use the proper preview system
            const { updatePreview } = await import('/client/preview/index.js');
            
            appStore.dispatch(updatePreview({ content, filePath })).then(() => {
                console.log('[WorkspaceManager] Preview rendered successfully');
                
                // Update the preview container with rendered content
                setTimeout(() => {
                    const previewState = appStore.getState().preview;
                    if (previewState?.htmlContent) {
                        previewDiv.innerHTML = previewState.htmlContent;
                        console.log('[WorkspaceManager] Preview content updated in UI');
                        
                        // Update preview top bar
                        this.previewTopBar
                            .setStats({ 
                                'mode': 'markdown',
                                'size': `${Math.round(previewState.htmlContent.length / 1024)}kb`
                            })
                            .setStatus('ready');
                    }
                }, 500);
            }).catch(err => {
                console.warn('[WorkspaceManager] Preview rendering failed, using fallback:', err.message);
                this.previewTopBar.setStatus('error', 'Render failed');
                this.renderFallbackPreview(previewDiv, content);
            });
        } catch (error) {
            console.warn('[WorkspaceManager] Could not import preview system:', error.message);
            this.previewTopBar.setStatus('error', 'System error');
            this.renderFallbackPreview(previewDiv, content);
        }
    }

    renderFallbackPreview(previewDiv, content) {
        // Simple markdown-like rendering for immediate display
        const simpleHtml = content
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/\n\n/gim, '</p><p>')
            .replace(/\n/gim, '<br>');
        
        previewDiv.innerHTML = `<p>${simpleHtml}</p>`;
        console.log('[WorkspaceManager] Fallback preview rendered');
    }

    updateButtonStates() {
        const editButton = document.querySelector('#edit-toggle');
        const previewButton = document.querySelector('#preview-toggle');
        
        if (editButton) {
            editButton.classList.add('active');
        }
        
        if (previewButton) {
            previewButton.classList.add('active');
        }
    }
}

// Create and export singleton instance
export const workspaceManager = new WorkspaceManager();

// Auto-initialize when module is loaded
workspaceManager.initialize();
