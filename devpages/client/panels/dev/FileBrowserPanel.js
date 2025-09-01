/**
 * FileBrowserPanel.js - Compact file browser and navigator
 * 
 * Sleek, minimal file system browser with:
 * - Compact tree view
 * - Quick file access
 * - Path navigation
 * - File type icons
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore } from '../../appState.js';

export class FileBrowserPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'file-browser',
            title: 'Files',
            defaultWidth: 280,
            defaultHeight: 400,
            ...config
        });
        
        this.currentPath = '/';
        this.expandedFolders = new Set();
        this.fileTree = null;
    }

    renderContent() {
        return `
            <div class="file-browser-panel">
                <div class="fb-header">
                    <div class="fb-path">
                        <span class="fb-path-icon">📁</span>
                        <input type="text" class="fb-path-input" value="${this.currentPath}" placeholder="/path/to/files">
                        <button class="fb-refresh-btn" title="Refresh">↻</button>
                    </div>
                </div>
                <div class="fb-tree" id="file-tree">
                    ${this.renderFileTree()}
                </div>
            </div>
        `;
    }

    renderFileTree() {
        // Mock file structure for now - replace with actual file system data
        const mockFiles = [
            { name: 'client', type: 'folder', path: '/client', expanded: true, children: [
                { name: 'components', type: 'folder', path: '/client/components' },
                { name: 'panels', type: 'folder', path: '/client/panels' },
                { name: 'store', type: 'folder', path: '/client/store' },
                { name: 'styles', type: 'folder', path: '/client/styles' },
                { name: 'appState.js', type: 'file', path: '/client/appState.js' }
            ]},
            { name: 'server', type: 'folder', path: '/server' },
            { name: 'package.json', type: 'file', path: '/package.json' },
            { name: 'README.md', type: 'file', path: '/README.md' }
        ];

        return this.renderTreeItems(mockFiles, 0);
    }

    renderTreeItems(items, depth) {
        return items.map(item => {
            const indent = depth * 12;
            const icon = this.getFileIcon(item);
            const expandIcon = item.type === 'folder' ? 
                (item.expanded ? '▼' : '▶') : '';
            
            let html = `
                <div class="fb-item ${item.type}" 
                     data-path="${item.path}" 
                     data-type="${item.type}"
                     style="padding-left: ${indent}px;">
                    <span class="fb-expand">${expandIcon}</span>
                    <span class="fb-icon">${icon}</span>
                    <span class="fb-name">${item.name}</span>
                </div>
            `;

            if (item.children && item.expanded) {
                html += this.renderTreeItems(item.children, depth + 1);
            }

            return html;
        }).join('');
    }

    getFileIcon(item) {
        if (item.type === 'folder') return '📁';
        
        const ext = item.name.split('.').pop().toLowerCase();
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
            'svg': '🖼️'
        };
        
        return icons[ext] || '📄';
    }

    onMount(container) {
        super.onMount(container);
        this.attachEventListeners();
        this.loadFileTree();
    }

    attachEventListeners() {
        if (!this.container) return;

        // Path input handling
        const pathInput = this.container.querySelector('.fb-path-input');
        if (pathInput) {
            pathInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.navigateToPath(pathInput.value);
                }
            });
        }

        // Refresh button
        const refreshBtn = this.container.querySelector('.fb-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadFileTree());
        }

        // Tree item clicks
        const tree = this.container.querySelector('.fb-tree');
        if (tree) {
            tree.addEventListener('click', (e) => {
                const item = e.target.closest('.fb-item');
                if (!item) return;

                const path = item.dataset.path;
                const type = item.dataset.type;

                if (type === 'folder') {
                    this.toggleFolder(path);
                } else {
                    this.openFile(path);
                }
            });
        }
    }

    async loadFileTree() {
        // TODO: Replace with actual file system API call
        console.log('[FileBrowser] Loading file tree...');
        this.renderFileTree();
    }

    navigateToPath(path) {
        this.currentPath = path;
        this.loadFileTree();
    }

    toggleFolder(path) {
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
        } else {
            this.expandedFolders.add(path);
        }
        this.renderFileTree();
    }

    openFile(path) {
        console.log('[FileBrowser] Opening file:', path);
        // TODO: Integrate with editor or file viewer
    }

    addStyles() {
        // Note: FileBrowserPanel uses specific fb- prefixed CSS classes that are not in external CSS
        // This is acceptable since it doesn't cause the race condition seen in UIInspectorPanel
        if (document.getElementById('file-browser-styles')) return;

        const style = document.createElement('style');
        style.id = 'file-browser-styles';
        style.textContent = `
            .file-browser-panel {
                height: 100%;
                display: flex;
                flex-direction: column;
                font-size: 11px;
                font-family: var(--font-family-mono, 'SF Mono', Consolas, monospace);
            }

            .fb-header {
                padding: 6px;
                border-bottom: 1px solid var(--color-border);
                background: var(--color-bg-alt);
            }

            .fb-path {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .fb-path-icon {
                font-size: 10px;
                opacity: 0.7;
            }

            .fb-path-input {
                flex: 1;
                padding: 2px 6px;
                font-size: 10px;
                border: 1px solid var(--color-border);
                border-radius: 2px;
                background: var(--color-bg);
                color: var(--color-text);
                font-family: inherit;
            }

            .fb-refresh-btn {
                padding: 2px 6px;
                font-size: 10px;
                border: 1px solid var(--color-border);
                border-radius: 2px;
                background: var(--color-bg);
                color: var(--color-text);
                cursor: pointer;
                font-family: inherit;
            }

            .fb-refresh-btn:hover {
                background: var(--color-bg-hover);
            }

            .fb-tree {
                flex: 1;
                overflow-y: auto;
                padding: 2px 0;
            }

            .fb-item {
                display: flex;
                align-items: center;
                padding: 1px 4px;
                cursor: pointer;
                white-space: nowrap;
                line-height: 16px;
                min-height: 16px;
            }

            .fb-item:hover {
                background: var(--color-bg-hover);
            }

            .fb-expand {
                width: 12px;
                font-size: 8px;
                text-align: center;
                opacity: 0.6;
            }

            .fb-icon {
                font-size: 10px;
                margin-right: 4px;
            }

            .fb-name {
                font-size: 10px;
                color: var(--color-text);
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .fb-item.folder .fb-name {
                font-weight: 500;
            }

            .fb-item.file .fb-name {
                opacity: 0.9;
            }

            /* Scrollbar styling */
            .fb-tree::-webkit-scrollbar {
                width: 4px;
            }

            .fb-tree::-webkit-scrollbar-track {
                background: transparent;
            }

            .fb-tree::-webkit-scrollbar-thumb {
                background: var(--color-border);
                border-radius: 2px;
            }

            .fb-tree::-webkit-scrollbar-thumb:hover {
                background: var(--color-text-secondary);
            }
        `;
        document.head.appendChild(style);
    }

    onMount(container) {
        super.onMount(container);
        this.addStyles();
        this.attachEventListeners();
        this.loadFileTree();
    }
}

panelRegistry.registerType('file-browser', FileBrowserPanel);
