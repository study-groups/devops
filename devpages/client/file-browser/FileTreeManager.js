/**
 * client/file-browser/FileTreeManager.js
 * Manages the file system tree building and state.
 * Adapted from dom-inspector/managers/TreeManager.js
 */
import { globalFetch } from '/client/globalFetch.js';
import { logMessage } from '/client/log/index.js';

export class FileTreeManager {
    constructor() {
        this.treeContainer = null;
        this.treeState = {
            expandedNodes: new Set(),
            selectedNodePath: null,
            scrollPosition: 0
        };
        this.callbacks = {};
    }

    setTreeContainer(container) {
        this.treeContainer = container;
    }

    async buildTree(callbacks = {}) {
        this.callbacks = callbacks;
        if (!this.treeContainer) {
            logMessage('No tree container for building file tree', 'error', 'FileTree');
            return;
        }

        this.preserveTreeState();
        this.treeContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const fileTree = await this.fetchFileTree();
            this.treeContainer.innerHTML = '';

            if (fileTree && fileTree.length > 0) {
                fileTree.forEach(item => {
                    const node = this.createNode(item);
                    if (node) {
                        this.treeContainer.appendChild(node);
                    }
                });
                this.restoreTreeState();
            } else {
                this.treeContainer.innerHTML = '<div class="panel-info-text">No files found.</div>';
            }
        } catch (error) {
            logMessage(`Error building file tree: ${error.message}`, 'error', 'FileTree');
            this.treeContainer.innerHTML = '<div class="panel-info-text">Error loading files.</div>';
        }
    }

    createNode(item) {
        const node = document.createElement('div');
        node.className = 'file-browser-node';
        node.dataset.filePath = item.path;
        node.dataset.itemType = item.type;

        const header = document.createElement('div');
        header.className = 'file-browser-node-header';

        const toggle = document.createElement('span');
        toggle.className = 'file-browser-node-toggle';

        if (item.type === 'directory') {
            toggle.textContent = '▶';
        } else {
            toggle.style.visibility = 'hidden';
        }
        header.appendChild(toggle);

        const icon = document.createElement('span');
        icon.className = `file-browser-node-icon icon-${item.type}`;
        header.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'file-browser-node-name';
        name.textContent = item.name;
        header.appendChild(name);
        
        node.appendChild(header);

        header.addEventListener('click', (e) => {
            if (e.target === toggle) {
                if (item.type === 'directory') {
                    this.toggleNode(node);
                }
            } else {
                if (item.type === 'file' && this.callbacks.onFileClick) {
                    this.callbacks.onFileClick(item);
                }
                this.selectNode(node);
            }
        });

        if (item.type === 'directory' && item.children && item.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'file-browser-node-children';
            childrenContainer.style.display = 'none';

            item.children.forEach(child => {
                const childNode = this.createNode(child);
                if (childNode) {
                    childrenContainer.appendChild(childNode);
                }
            });
            node.appendChild(childrenContainer);
        }

        return node;
    }

    toggleNode(node) {
        node.classList.toggle('expanded');
        const isExpanded = node.classList.contains('expanded');
        const toggle = node.querySelector('.file-browser-node-toggle');
        const childrenContainer = node.querySelector('.file-browser-node-children');

        if (toggle) {
            toggle.textContent = isExpanded ? '▼' : '▶';
        }
        if (childrenContainer) {
            childrenContainer.style.display = isExpanded ? 'block' : 'none';
        }
        
        const filePath = node.dataset.filePath;
        if (isExpanded) {
            this.treeState.expandedNodes.add(filePath);
        } else {
            this.treeState.expandedNodes.delete(filePath);
        }
    }

    selectNode(node) {
        if (this.treeContainer) {
            const currentSelected = this.treeContainer.querySelector('.file-browser-node-header.selected');
            if (currentSelected) {
                currentSelected.classList.remove('selected');
            }
        }
        const header = node.querySelector('.file-browser-node-header');
        if (header) {
            header.classList.add('selected');
            this.treeState.selectedNodePath = node.dataset.filePath;
        }
    }

    preserveTreeState() {
        if (!this.treeContainer) return;
        this.treeState.scrollPosition = this.treeContainer.scrollTop;
    }

    restoreTreeState() {
        if (!this.treeContainer) return;

        this.treeContainer.querySelectorAll('.file-browser-node').forEach(node => {
            const path = node.dataset.filePath;
            if (this.treeState.expandedNodes.has(path)) {
                if (!node.classList.contains('expanded')) {
                    this.toggleNode(node);
                }
            }
            if (this.treeState.selectedNodePath === path) {
                this.selectNode(node);
            }
        });

        this.treeContainer.scrollTop = this.treeState.scrollPosition;
    }

    async fetchFileTree() {
        // In a real scenario, this would fetch from a server endpoint.
        // For now, we use mock data.
        logMessage('Fetching file tree...', 'info', 'FileTree');
        return this.getMockFileSystem();
        /*
        try {
            const response = await globalFetch('/api/files/tree');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch file tree:", error);
            throw error;
        }
        */
    }
    
    getMockFileSystem() {
        return [
            {
                name: 'client', type: 'directory', path: 'client', children: [
                    { name: 'index.html', type: 'file', path: 'client/index.html' },
                    { name: 'styles', type: 'directory', path: 'client/styles', children: [
                        { name: 'main.css', type: 'file', path: 'client/styles/main.css' },
                    ]},
                ]
            },
            {
                name: 'server', type: 'directory', path: 'server', children: [
                    { name: 'server.js', type: 'file', path: 'server/server.js' },
                ]
            },
            { name: 'package.json', type: 'file', path: 'package.json' },
        ];
    }
} 