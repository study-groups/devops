/**
 * client/file-browser/FileBrowserPanel.js
 * A panel that displays the file system tree.
 */

import { BasePanel } from '/client/panels/BasePanel.js';
import { FileTreeManager } from './FileTreeManager.js';
import { appStore } from '/client/appState.js';

const log = window.APP.services.log.createLogger('FileBrowserPanel');

export class FileBrowserPanel extends BasePanel {
    constructor(options) {
        // Pass options to the base class, including a title
        super({ title: 'Files', ...options });
        
        console.warn('[FileBrowserPanel] Constructor called');
        this.treeContainer = null;
        this.fileTreeManager = new FileTreeManager();
        this.unsubscribe = null;
        this.isInitialized = false;
    }

    /**
     * Required by BasePanel. Renders the panel's specific content.
     */
    renderContent() {
        console.warn('[FileBrowserPanel] renderContent() called');
        
        const container = document.createElement('div');
        container.className = 'file-browser-panel';
        container.innerHTML = `
            <div class="file-browser-cwd-container">
                <span class="publish-badges"></span>
                <span class="cwd-path"></span>
            </div>
            <div class="file-browser-tree-container">
                <!-- Tree will be rendered here -->
            </div>
        `;
        
        // Return the container element
        return container;
    }

    /**
     * Lifecycle hook from BasePanel, called after the panel is mounted.
     */
    onMount() {
        super.onMount(); // It's good practice to call the parent's method
        
        console.warn('[FileBrowserPanel] onMount called');
        
        // this.contentElement is now guaranteed to exist by BasePanel
        this.treeContainer = this.contentElement.querySelector('.file-browser-tree-container');
        this.cwdPathContainer = this.contentElement.querySelector('.cwd-path');
        this.badgesContainer = this.contentElement.querySelector('.publish-badges');
        
        if (!this.treeContainer) {
            log.error('FILE_BROWSER', 'TREE_CONTAINER_NOT_FOUND', 'Tree container not found!');
            return;
        }
        
        this.initializePanel();
    }
    
    /**
     * Initialize the panel after DOM is ready
     */
    initializePanel() {
        if (this.isInitialized) {
            return;
        }

        this.isInitialized = true;

        this.fetchAndDisplayCwd();
        log.info('FILE_BROWSER', 'PANEL_ACTIVATED', 'FileBrowserPanel activated.');

        this.fileTreeManager.setTreeContainer(this.treeContainer);

        // Make the CWD path clickable to load the tree
        if (this.cwdPathContainer) {
            this.cwdPathContainer.classList.add('clickable-path'); // For styling
            this.cwdPathContainer.title = 'Click to load file tree';
            this.cwdPathContainer.addEventListener('click', () => this.loadTree(), { once: true });
        }

        this.unsubscribe = appStore.subscribe(() => {
            const state = appStore.getState();
            // Assuming publish status is tracked per file path
            const publishStatus = state.file?.publishStatus || {};
            this.updatePublishingBadges(publishStatus);
        });
    }

    loadTree() {
        if (!this.treeContainer) {
            log.error('FILE_BROWSER', 'LOAD_TREE_NO_CONTAINER', 'Cannot load tree: tree container not found.');
            return;
        }

        if (this.cwdPathContainer) {
            this.cwdPathContainer.classList.remove('clickable-path');
            this.cwdPathContainer.title = '';
        }

        log.info('FILE_BROWSER', 'LOADING_TREE', 'Loading file tree...');
        const path = this.fetchCwd();
        this.fileTreeManager.buildTree({
            onFileClick: (file) => this.handleFileClick(file),
        }, path);
    }

    updatePublishingBadges(status) {
        if (!this.badgesContainer) return;

        const badges = [
            { key: 'notes', label: 'Notes', icon: 'file' },
            { key: 'spaces', label: 'Spaces', icon: 'folder' }
        ];

        this.badgesContainer.innerHTML = badges.map(badge => `
            <span class="publish-badge ${status[badge.key] ? 'active' : ''}" title="Published to ${badge.label}">
                <span class="icon icon-${badge.icon}"></span>
            </span>
        `).join('');
    }

    async fetchServerConfig() {
        try {
            const response = await window.APP.services.globalFetch('/api/config');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            log.error('FILE_BROWSER', 'FETCH_CONFIG_ERROR', `Failed to fetch server config: ${error.message}`, error);
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
            log.error('FILE_BROWSER', 'FETCH_CWD_ERROR', `Failed to fetch CWD: ${error.message}`, error);
            this.cwdPathContainer.textContent = 'Error loading CWD.';
        }
    }

    fetchCwd() {
        return window.location.pathname;
    }

    handleFileClick(file) {
        log.info('FILE_BROWSER', 'FILE_CLICK', `File clicked: ${file.path}`);
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
        log.info('FILE_BROWSER', 'DIRECTORY_CLICK', `Directory clicked: ${dir.path}`);
        // This is handled by the tree manager's toggle logic, but we can add more actions here if needed.
    }

    destroy() {
        super.destroy(); // Call parent's destroy method
        log.info('FILE_BROWSER', 'PANEL_DESTROYED', 'FileBrowserPanel destroyed.');
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
} 