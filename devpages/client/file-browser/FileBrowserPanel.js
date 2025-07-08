/**
 * client/file-browser/FileBrowserPanel.js
 * A panel that displays the file system tree.
 */

import { logMessage } from '/client/log/index.js';
import { FileTreeManager } from './FileTreeManager.js';
import { appStore } from '/client/appState.js';

export class FileBrowserPanel {
    constructor() {
        this.container = null;
        this.treeContainer = null;
        this.fileTreeManager = new FileTreeManager();
        this.unsubscribe = null;
    }

    /**
     * Renders the initial structure of the panel.
     */
    async render() {
        return `
            <div class="file-browser-panel">
                <div class="file-browser-cwd-container">
                    <span class="cwd-path"></span>
                    <span class="publish-badges"></span>
                </div>
                <div class="file-browser-tree-container">
                    <!-- Tree will be rendered here -->
                </div>
            </div>
        `;
    }

    /**
     * Called when the panel becomes active.
     */
    onActivate(panelElement) {
        this.container = panelElement;
        this.treeContainer = this.container.querySelector('.file-browser-tree-container');
        this.cwdPathContainer = this.container.querySelector('.cwd-path');
        this.badgesContainer = this.container.querySelector('.publish-badges');
        
        if (!this.treeContainer) {
            logMessage('FileBrowserPanel: tree container not found!', 'error', 'FileBrowser');
            return;
        }

        this.fetchAndDisplayCwd();
        logMessage('FileBrowserPanel activated.', 'info', 'FileBrowser');

        this.fileTreeManager.setTreeContainer(this.treeContainer);
        
        this.fileTreeManager.buildTree({
            onFileClick: (file) => this.handleFileClick(file),
        });

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

    async fetchAndDisplayCwd() {
        if (!this.cwdPathContainer) return;
        this.cwdPathContainer.textContent = 'Loading...';
        try {
            const cwd = await this.fetchCwd();
            this.cwdPathContainer.textContent = cwd;
        } catch (error) {
            logMessage(`Failed to fetch CWD: ${error.message}`, 'error', 'FileBrowser');
            this.cwdPathContainer.textContent = 'Error loading CWD.';
        }
    }

    async fetchCwd() {
        return Promise.resolve('/root/src/devops/devpages');
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