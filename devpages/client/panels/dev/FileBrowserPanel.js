/**
 * FileBrowserPanel.js - File management panel with subsection-based architecture
 *
 * Features:
 * - Subsection-based interface (each subsection is a pointer to file-like data)
 * - System Information: shows PD_DIR paths and admin status
 * - PD_DIR: complete file structure (admin only)
 * - Images subsection: interface to uploads directory
 * - Image index viewer with reference tracking and orphan detection
 * - Unused image cleanup with timestamp tracking
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore } from '../../appState.js';

export class FileBrowserPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'file-browser',
            title: 'Files',
            defaultWidth: 320,
            defaultHeight: 500,
            ...config
        });

        this.isAdmin = false;
        this.systemInfo = null;
        this.fileTree = null;
        this.imageStats = null;
    }

    renderContent() {
        return `
            <div class="file-browser-panel">
                <!-- System Info Section -->
                <div class="fb-section collapsed" data-section="system-info">
                    <div class="fb-section-header">
                        <span class="fb-section-icon">▶</span>
                        <span class="fb-section-title">System Information</span>
                    </div>
                    <div class="fb-section-content">
                        <div class="fb-section-info">
                            <p class="fb-info-text">Server environment and path configuration</p>
                        </div>
                        <div class="fb-subsection">
                            <div id="system-info-content" class="fb-subsection-content">
                                <div class="fb-loading">Loading system information...</div>
                            </div>
                        </div>
                    </div>
                </div>

                ${this.isAdmin ? `
                <!-- PD_DIR Section -->
                <div class="fb-section collapsed" data-section="pd-tree">
                    <div class="fb-section-header">
                        <span class="fb-section-icon">▶</span>
                        <span class="fb-section-title">PD_DIR</span>
                    </div>
                    <div class="fb-section-content">
                        <div class="fb-section-info">
                            <p class="fb-info-text">Complete file structure</p>
                        </div>
                        <div class="fb-subsection">
                            <div id="file-tree-content" class="fb-tree-container">
                                <div class="fb-loading">Click to expand and load file tree...</div>
                            </div>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Images Section -->
                <div class="fb-section collapsed" data-section="images">
                    <div class="fb-section-header">
                        <span class="fb-section-icon">▶</span>
                        <span class="fb-section-title">Images</span>
                    </div>
                    <div class="fb-section-content">
                        <div class="fb-section-info">
                            <p class="fb-info-text">Interface to PD_DIR/uploads directory</p>
                        </div>

                        <!-- Image Management Actions -->
                        <div class="fb-subsection">
                            <div class="fb-subsection-content">
                                <div id="image-feedback" class="fb-feedback" style="display: none;"></div>
                                <button class="fb-action-btn" data-action="open-image-index">
                                    <span class="btn-text">View Image Index</span>
                                </button>
                                <button class="fb-action-btn" data-action="generate-image-index">
                                    <span class="btn-text">Regenerate Index</span>
                                </button>
                                <button class="fb-action-btn fb-action-btn-danger" data-action="delete-unused-images">
                                    <span class="btn-text">Delete Unused Images</span>
                                </button>
                                <div class="fb-info-box">
                                    <small>The image index shows all uploaded images, which documents reference them, orphan status, and allows you to delete images.</small>
                                </div>
                            </div>
                        </div>

                        <!-- Statistics -->
                        <div class="fb-subsection">
                            <div class="fb-subsection-header">
                                <span class="fb-subsection-title">Statistics</span>
                            </div>
                            <div class="fb-subsection-content">
                                <div class="fb-stat-item">
                                    <span class="fb-stat-label">Total Images:</span>
                                    <span class="fb-stat-value" id="total-images">-</span>
                                </div>
                                <div class="fb-stat-item">
                                    <span class="fb-stat-label">Unused Images:</span>
                                    <span class="fb-stat-value" id="unused-images">-</span>
                                </div>
                                <div class="fb-stat-item">
                                    <span class="fb-stat-label">Orphaned:</span>
                                    <span class="fb-stat-value" id="orphaned-images">-</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    onMount(container = null) {
        super.onMount(container);

        this.checkAdminStatus();
        this.addStyles();
        this.attachEventListeners();
        this.loadSystemInfo();
        this.loadStats();
    }

    checkAdminStatus() {
        const state = appStore.getState();
        const user = state.auth?.user;
        this.isAdmin = user && (user.role === 'admin' || user.username === 'admin');
    }

    attachEventListeners() {
        const container = this.getContainer();
        if (!container) {
            console.warn('[FileBrowser] No container found for event listeners');
            return;
        }

        // Use event delegation
        container.addEventListener('click', (e) => {
            // Section header clicks
            const sectionHeader = e.target.closest('.fb-section-header');
            if (sectionHeader) {
                const section = sectionHeader.closest('.fb-section');
                const sectionName = section.dataset.section;
                this.toggleSection(section, sectionName);
                return;
            }

            // File tree item clicks
            const treeItem = e.target.closest('.fb-tree-item');
            if (treeItem && treeItem.dataset.type === 'directory') {
                this.toggleTreeItem(treeItem);
                return;
            }

            // Action button clicks
            const actionBtn = e.target.closest('.fb-action-btn');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                const action = actionBtn.dataset.action;
                this.handleAction(action);
                return;
            }
        });
    }

    toggleSection(section, sectionName) {
        const icon = section.querySelector('.fb-section-icon');
        const isCollapsed = section.classList.contains('collapsed');

        section.classList.toggle('collapsed');
        icon.textContent = isCollapsed ? '▼' : '▶';

        // Load file tree when PD_DIR section is expanded for first time
        if (isCollapsed && sectionName === 'pd-tree' && !this.fileTree) {
            this.loadFileTree();
        }
    }

    toggleTreeItem(item) {
        const children = item.nextElementSibling;
        if (children && children.classList.contains('fb-tree-children')) {
            const icon = item.querySelector('.fb-tree-expand');
            const isCollapsed = children.style.display === 'none';

            children.style.display = isCollapsed ? 'block' : 'none';
            icon.textContent = isCollapsed ? '▼' : '▶';
        }
    }

    async loadSystemInfo() {
        try {
            const response = await fetch('/api/system/info', {
                credentials: 'include'
            });

            if (response.status === 401) {
                // Not logged in - silently handle
                this.systemInfo = null;
                this.updateSystemInfoDisplay();
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to load system info: ${response.status}`);
            }

            this.systemInfo = await response.json();
            this.updateSystemInfoDisplay();
        } catch (error) {
            console.error('[FileBrowser] Failed to load system info:', error);
            this.updateSystemInfoDisplay({ error: error.message });
        }
    }

    updateSystemInfoDisplay() {
        const container = this.getContainer();
        if (!container) return;

        const contentEl = container.querySelector('#system-info-content');
        if (!contentEl) return;

        if (!this.systemInfo || this.systemInfo.error) {
            contentEl.innerHTML = `<div class="fb-error">Error loading system info</div>`;
            return;
        }

        contentEl.innerHTML = `
            <div class="fb-system-info">
                <div class="fb-info-item">
                    <span class="fb-info-label">Mode:</span>
                    <code class="fb-info-value fb-admin-badge">${this.isAdmin ? 'Admin' : 'User'}</code>
                </div>
                <div class="fb-info-item">
                    <span class="fb-info-label">PD_DIR:</span>
                    <code class="fb-info-value">${this.systemInfo.PD_DIR || '(not set)'}</code>
                </div>
                <div class="fb-info-item">
                    <span class="fb-info-label">MD_DIR:</span>
                    <code class="fb-info-value">${this.systemInfo.MD_DIR || '(derived)'}</code>
                </div>
                <div class="fb-info-item">
                    <span class="fb-info-label">Uploads:</span>
                    <code class="fb-info-value">${this.systemInfo.uploadsDirectory || '-'}</code>
                </div>
                <div class="fb-info-item">
                    <span class="fb-info-label">Images:</span>
                    <code class="fb-info-value">${this.systemInfo.imagesDirectory || '-'}</code>
                </div>
                <div class="fb-info-item">
                    <span class="fb-info-label">Node ENV:</span>
                    <code class="fb-info-value">${this.systemInfo.NODE_ENV || '-'}</code>
                </div>
                <div class="fb-info-item">
                    <span class="fb-info-label">Port:</span>
                    <code class="fb-info-value">${this.systemInfo.PORT || '-'}</code>
                </div>
            </div>
        `;
    }

    async loadFileTree() {
        const container = this.getContainer();
        if (!container) return;

        const contentEl = container.querySelector('#file-tree-content');
        if (!contentEl) return;

        contentEl.innerHTML = '<div class="fb-loading">Loading file tree...</div>';

        try {
            const response = await fetch('/api/system/file-tree', {
                credentials: 'include'
            });

            if (response.status === 401) {
                // Not logged in - silently handle
                this.fileTree = null;
                this.updateFileTreeDisplay();
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to load file tree: ${response.status}`);
            }

            this.fileTree = await response.json();
            this.updateFileTreeDisplay();
        } catch (error) {
            console.error('[FileBrowser] Failed to load file tree:', error);
            if (contentEl) {
                contentEl.innerHTML = `<div class="fb-error">Error: ${error.message}</div>`;
            }
        }
    }

    updateFileTreeDisplay() {
        const container = this.getContainer();
        if (!container) return;

        const contentEl = container.querySelector('#file-tree-content');
        if (!contentEl) return;

        if (!this.fileTree || this.fileTree.error) {
            contentEl.innerHTML = `<div class="fb-error">Error loading file tree</div>`;
            return;
        }

        contentEl.innerHTML = this.renderTreeNode(this.fileTree, '', true);
    }

    renderTreeNode(node, path, isRoot = false) {
        if (!node) return '';

        const hasChildren = node.children && node.children.length > 0;
        let html = '';

        if (!isRoot) {
            const icon = node.type === 'directory' ? '▶' : '';
            const fileIcon = this.getFileIcon(node);

            html += `
                <div class="fb-tree-item" data-path="${path}" data-type="${node.type}">
                    <span class="fb-tree-expand">${icon}</span>
                    <span class="fb-tree-icon">${fileIcon}</span>
                    <span class="fb-tree-name">${node.name}</span>
                </div>
            `;
        }

        if (hasChildren) {
            html += '<div class="fb-tree-children" style="display: none;">';
            for (const child of node.children) {
                const childPath = isRoot ? child.name : `${path}/${child.name}`;
                html += this.renderTreeNode(child, childPath, false);
            }
            html += '</div>';
        }

        return html;
    }

    getFileIcon(node) {
        if (node.type === 'directory') return '📁';

        const ext = node.name.split('.').pop().toLowerCase();
        const icons = {
            'js': '📄',
            'json': '⚙️',
            'css': '🎨',
            'html': '🌐',
            'md': '📝',
            'yml': '⚙️',
            'yaml': '⚙️',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'webp': '🖼️',
            'svg': '🖼️'
        };

        return icons[ext] || '📄';
    }

    async loadStats() {
        try {
            const response = await fetch('/api/images/stats', {
                credentials: 'include'
            });

            if (response.status === 401) {
                // Not logged in - silently handle
                this.updateStatsDisplay(null);
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to load stats: ${response.status}`);
            }

            const stats = await response.json();
            this.updateStatsDisplay(stats);
        } catch (error) {
            console.error('[FileBrowser] Failed to load stats:', error);
            this.updateStatsDisplay(null);
        }
    }

    updateStatsDisplay(stats) {
        const container = this.getContainer();
        if (!container) return;

        const totalEl = container.querySelector('#total-images');
        const unusedEl = container.querySelector('#unused-images');
        const orphanedEl = container.querySelector('#orphaned-images');

        if (totalEl) totalEl.textContent = stats ? (stats.total || '0') : '-';
        if (unusedEl) unusedEl.textContent = stats ? (stats.unused || '0') : '-';
        if (orphanedEl) orphanedEl.textContent = stats ? (stats.orphaned || '0') : '-';
    }

    async handleAction(action) {
        switch (action) {
            case 'open-image-index':
                await this.openImageIndex();
                break;
            case 'generate-image-index':
                await this.generateImageIndex();
                break;
            case 'delete-unused-images':
                await this.deleteUnusedImages();
                break;
        }
    }

    showFeedback(message, type = 'info') {
        const container = this.getContainer();
        if (!container) return;

        const feedbackEl = container.querySelector('#image-feedback');
        if (!feedbackEl) return;

        feedbackEl.textContent = message;
        feedbackEl.className = `fb-feedback fb-feedback-${type}`;
        feedbackEl.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            feedbackEl.style.display = 'none';
        }, 5000);
    }

    async openImageIndex() {
        try {
            console.log('[FileBrowser] Opening image index...');

            // Use the proper Redux navigation system
            const { appStore, dispatch } = await import('/client/appState.js');
            const { pathThunks } = await import('/client/store/slices/pathSlice.js');

            // Navigate to the image index file
            await dispatch(pathThunks.navigateToPath({
                pathname: 'images/index.md',
                isDirectory: false
            }));

            this.showFeedback('Image index opened successfully!', 'success');
        } catch (error) {
            console.error('[FileBrowser] Failed to open image index:', error);
            this.showFeedback(`Failed to open image index: ${error.message}`, 'error');
        }
    }

    async generateImageIndex() {
        try {
            console.log('[FileBrowser] Generating image index...');
            this.showFeedback('Generating image index...', 'info');

            const response = await fetch('/api/images/generate-index', {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to generate index: ${response.status}`);
            }

            console.log('[FileBrowser] Image index generated successfully');
            this.showFeedback('Image index generated successfully!', 'success');
            this.loadStats();
        } catch (error) {
            console.error('[FileBrowser] Failed to generate image index:', error);
            this.showFeedback(`Failed to generate image index: ${error.message}`, 'error');
        }
    }

    async deleteUnusedImages() {
        if (!confirm('Are you sure you want to delete all unused images? This cannot be undone.')) {
            return;
        }

        try {
            console.log('[FileBrowser] Deleting unused images...');
            this.showFeedback('Deleting unused images...', 'info');

            const response = await fetch('/api/images/delete-unused', {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to delete unused images: ${response.status}`);
            }

            console.log('[FileBrowser] Unused images deleted successfully');
            this.showFeedback('Unused images deleted successfully!', 'success');
            this.loadStats();
        } catch (error) {
            console.error('[FileBrowser] Failed to delete unused images:', error);
            this.showFeedback(`Failed to delete unused images: ${error.message}`, 'error');
        }
    }

    addStyles() {
        if (document.getElementById('file-browser-styles')) return;

        const style = document.createElement('style');
        style.id = 'file-browser-styles';
        style.textContent = `
            .file-browser-panel {
                height: 100%;
                display: flex;
                flex-direction: column;
                font-size: 12px;
                overflow-y: auto;
            }

            /* Section styles */
            .fb-section {
                border-bottom: 1px solid var(--color-border);
            }

            .fb-section-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: var(--color-bg-alt);
                cursor: pointer;
                user-select: none;
                font-weight: 600;
            }

            .fb-section-header:hover {
                background: var(--color-bg-hover);
            }

            .fb-section-icon {
                font-size: 10px;
                opacity: 0.7;
                width: 12px;
            }

            .fb-section-title {
                font-size: 13px;
            }

            .fb-section-content {
                max-height: 2000px;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .fb-section.collapsed .fb-section-content {
                max-height: 0;
            }

            .fb-section-info {
                padding: 12px;
                background: var(--color-bg);
            }

            .fb-info-text {
                margin: 0;
                font-size: 11px;
                color: var(--color-text-secondary);
            }

            /* Subsection styles */
            .fb-subsection {
                border-top: 1px solid var(--color-border);
                padding: 12px;
                background: var(--color-bg);
            }

            .fb-subsection-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 10px;
                font-weight: 600;
                font-size: 12px;
            }

            .fb-subsection-content {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            /* System Info */
            .fb-system-info {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .fb-info-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px;
                background: var(--color-bg-alt);
                border-radius: 4px;
            }

            .fb-info-label {
                font-size: 10px;
                font-weight: 600;
                color: var(--color-text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .fb-info-value {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--color-text);
                background: var(--color-bg);
                padding: 4px 6px;
                border-radius: 3px;
                word-break: break-all;
            }

            .fb-admin-badge {
                font-weight: 700;
                color: var(--color-primary);
            }

            /* File Tree */
            .fb-tree-container {
                max-height: 400px;
                overflow-y: auto;
                padding: 8px;
                background: var(--color-bg);
                border-radius: 4px;
            }

            .fb-tree-item {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                cursor: pointer;
                line-height: 20px;
                user-select: none;
            }

            .fb-tree-item:hover {
                background: var(--color-bg-hover);
            }

            .fb-tree-expand {
                width: 14px;
                font-size: 9px;
                text-align: center;
                opacity: 0.6;
                margin-right: 4px;
            }

            .fb-tree-icon {
                font-size: 12px;
                margin-right: 6px;
            }

            .fb-tree-name {
                font-size: 12px;
                font-family: var(--font-mono);
                color: var(--color-text);
            }

            .fb-tree-children {
                padding-left: 20px;
            }

            /* Action buttons */
            .fb-action-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 12px;
                color: var(--color-text);
            }

            .fb-action-btn:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary);
            }

            .fb-action-btn-sm {
                padding: 6px 10px;
                font-size: 11px;
            }

            .fb-action-btn-danger {
                border-color: var(--color-danger, #dc3545);
                color: var(--color-danger, #dc3545);
            }

            .fb-action-btn-danger:hover {
                background: rgba(220, 53, 69, 0.1);
            }

            .btn-text {
                flex: 1;
            }

            /* Info box */
            .fb-info-box {
                padding: 8px;
                background: var(--color-bg-alt);
                border-left: 3px solid var(--color-primary);
                border-radius: 4px;
                font-size: 11px;
                color: var(--color-text-secondary);
                line-height: 1.4;
            }

            /* Statistics */
            .fb-stat-item {
                display: flex;
                justify-content: space-between;
                padding: 6px 8px;
                background: var(--color-bg-alt);
                border-radius: 4px;
                font-size: 11px;
            }

            .fb-stat-label {
                color: var(--color-text-secondary);
            }

            .fb-stat-value {
                font-weight: 600;
                color: var(--color-text);
            }

            .fb-loading {
                padding: 12px;
                text-align: center;
                color: var(--color-text-secondary);
                font-size: 11px;
            }

            .fb-error {
                padding: 12px;
                color: var(--color-danger, #dc3545);
                font-size: 11px;
                background: rgba(220, 53, 69, 0.1);
                border-radius: 4px;
            }

            /* Feedback */
            .fb-feedback {
                padding: 10px 12px;
                border-radius: 4px;
                font-size: 12px;
                margin-bottom: 8px;
                border-left: 3px solid;
            }

            .fb-feedback-info {
                background: rgba(59, 130, 246, 0.1);
                border-color: rgb(59, 130, 246);
                color: rgb(59, 130, 246);
            }

            .fb-feedback-success {
                background: rgba(34, 197, 94, 0.1);
                border-color: rgb(34, 197, 94);
                color: rgb(34, 197, 94);
            }

            .fb-feedback-error {
                background: rgba(220, 53, 69, 0.1);
                border-color: rgb(220, 53, 69);
                color: rgb(220, 53, 69);
            }

            /* Scrollbar */
            .fb-tree-container::-webkit-scrollbar,
            .file-browser-panel::-webkit-scrollbar {
                width: 6px;
            }

            .fb-tree-container::-webkit-scrollbar-track,
            .file-browser-panel::-webkit-scrollbar-track {
                background: transparent;
            }

            .fb-tree-container::-webkit-scrollbar-thumb,
            .file-browser-panel::-webkit-scrollbar-thumb {
                background: var(--color-border);
                border-radius: 3px;
            }

            .fb-tree-container::-webkit-scrollbar-thumb:hover,
            .file-browser-panel::-webkit-scrollbar-thumb:hover {
                background: var(--color-text-secondary);
            }
        `;
        document.head.appendChild(style);
    }
}

panelRegistry.registerType('file-browser', FileBrowserPanel);
