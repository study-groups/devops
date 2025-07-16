/**
 * client/file-browser/FileBrowserPanel.js
 * A panel that displays the file system tree.
 */

import { logMessage } from '/client/log/index.js';
import { FileTreeManager } from './FileTreeManager.js';
import { appStore } from '/client/appState.js';
import { globalFetch } from '/client/globalFetch.js';

export class FileBrowserPanel {
    constructor() {
        console.warn('[FileBrowserPanel] Constructor called');
        this.container = null;
        this.treeContainer = null;
        this.fileTreeManager = new FileTreeManager();
        this.unsubscribe = null;
    }

    /**
     * Renders the initial structure of the panel.
     */
    async render() {
        console.warn('[FileBrowserPanel] render() called');
        try {
            const html = `
                <div class="file-browser-panel">
                    <div class="file-browser-cwd-container">
                        <span class="publish-badges"></span>
                        <span class="cwd-path"></span>
                    </div>
                    <div class="file-browser-tree-container">
                        <!-- Tree will be rendered here -->
                    </div>
                </div>
            `;
            console.warn('[FileBrowserPanel] render() returning HTML length:', html.length);
            console.warn('[FileBrowserPanel] render() HTML preview:', html.substring(0, 200));
            console.warn('[FileBrowserPanel] render() about to return HTML');
            return Promise.resolve(html);
        } catch (error) {
            console.error('[FileBrowserPanel] render() error:', error);
            throw error;
        }
    }

    /**
     * Called when the panel becomes active.
     */
    onActivate(panelElement) {
        console.warn('[FileBrowserPanel] onActivate called');
        
        this.container = panelElement;
        
        // Wait for DOM to be ready if needed
        setTimeout(() => {
            console.warn('[FileBrowserPanel] Looking for tree container...');
            this.treeContainer = this.container.querySelector('.file-browser-tree-container');
            this.cwdPathContainer = this.container.querySelector('.cwd-path');
            this.badgesContainer = this.container.querySelector('.publish-badges');
            
            console.warn('[FileBrowserPanel] Tree container found:', !!this.treeContainer);
            console.warn('[FileBrowserPanel] Container HTML:', this.container.innerHTML.substring(0, 200));
            
            if (!this.treeContainer) {
                logMessage('FileBrowserPanel: tree container not found!', 'error', 'FileBrowser');
                return;
            }
            
            this.initializePanel();
        }, 0);
    }
    
    /**
     * Initialize the panel after DOM is ready
     */
    initializePanel() {

        this.fetchAndDisplayCwd();
        logMessage('FileBrowserPanel activated.', 'info', 'FileBrowser');

        this.fileTreeManager.setTreeContainer(this.treeContainer);
        
        const path = this.fetchCwd();
        this.fileTreeManager.buildTree({
            onFileClick: (file) => this.handleFileClick(file),
        }, path);

        this.unsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            // Assuming publish status is tracked per file path
            const publishStatus = state.file?.publishStatus || {};
            this.updatePublishingBadges(publishStatus);
        });
    }

    updatePublishingBadges(status) {
        if (!this.badgesContainer) return;

        const badges = [
            { key: 'notes', label: 'Notes' },
            { key: 'spaces', label: 'Spaces' }
        ];

        this.badgesContainer.innerHTML = badges.map(badge => `
            <span class="publish-badge ${status[badge.key] ? 'active' : ''}" title="Published to ${badge.label}">
                ${badge.label.charAt(0)}
            </span>
        `).join('');
    }

    async fetchServerConfig() {
        try {
            const response = await globalFetch('/api/config');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            logMessage(`Failed to fetch server config: ${error.message}`, 'error', 'FileBrowser');
            return { PD_DIR: null, error: true };
        }
    }

    async fetchAndDisplayCwd() {
        if (!this.cwdPathContainer) return;
        this.cwdPathContainer.textContent = 'Loading...';
        try {
            const config = await this.fetchServerConfig();
            
            const joinPath = (...parts) => {
                const newPath = parts.join('/');
                return newPath.replace(/\/+/g, '/');
            };

            const basePath = config.PD_DIR ? joinPath(config.PD_DIR, 'data') : '/server';
            const currentPath = this.fetchCwd();
            const fullPath = joinPath(basePath, currentPath);
            
            this.cwdPathContainer.textContent = fullPath;
        } catch (error) {
            logMessage(`Failed to fetch CWD: ${error.message}`, 'error', 'FileBrowser');
            this.cwdPathContainer.textContent = 'Error loading CWD.';
        }
    }

    fetchCwd() {
        return window.location.pathname;
    }

    handleFileClick(file) {
        logMessage(`File clicked: ${file.path}`, 'info', 'FileBrowser');
        // Here you would dispatch an action to load the file
        // and its corresponding publish status.
        // For now, let's simulate a state change for demonstration.
        const mockStatus = {
            notes: Math.random() > 0.5,
            spaces: Math.random() > 0.5,
        };
        appStore.dispatch({
            type: 'FILE_SET_PUBLISH_STATUS',
            payload: mockStatus
        });
    }

    handleDirectoryClick(dir) {
        logMessage(`Directory clicked: ${dir.path}`, 'info', 'FileBrowser');
        // This is handled by the tree manager's toggle logic, but we can add more actions here if needed.
    }

    destroy() {
        logMessage('FileBrowserPanel destroyed.', 'info', 'FileBrowser');
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        // this.fileTreeManager.destroy(); // Assuming FileTreeManager gets a destroy method
    }
} 