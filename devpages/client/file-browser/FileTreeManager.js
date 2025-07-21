/**
 * client/file-browser/FileTreeManager.js
 * Manages the file system tree building and state.
 * Adapted from dom-inspector/managers/TreeManager.js
 */

const log = window.APP.services.log.createLogger('FileTreeManager');

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

    async buildTree(callbacks = {}, path) {
        this.callbacks = callbacks;
        if (!this.treeContainer) {
            log.error('FILE_TREE', 'NO_CONTAINER', 'No tree container for building file tree');
            return;
        }

        this.preserveTreeState();
        this.treeContainer.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const fileTree = await this.fetchFileTree(path);
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
            log.error('FILE_TREE', 'BUILD_ERROR', `Error building file tree: ${error.message}`, error);
            this.treeContainer.innerHTML = '<div class="panel-info-text">Error loading files.</div>';
        }
    }

    createNode(item, depth = 0) {
        const node = document.createElement('div');
        node.className = 'file-browser-node';
        node.dataset.filePath = item.path;
        node.dataset.itemType = item.type;
        node.dataset.depth = depth;

        const header = document.createElement('div');
        header.className = 'file-browser-node-header';
        header.style.paddingLeft = `${depth * 12}px`;

        const toggle = document.createElement('span');
        toggle.className = 'file-browser-node-toggle';

        if (item.type === 'directory') {
            toggle.textContent = '▶';
        } else {
            toggle.style.visibility = 'hidden';
        }
        header.appendChild(toggle);

        const icon = document.createElement('span');
        if (item.type === 'directory') {
            icon.className = 'icon icon-directory file-browser-node-icon';
        } else {
            icon.className = 'icon icon-file-generic file-browser-node-icon';
        }
        header.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'file-browser-node-name';
        name.textContent = item.name;
        header.appendChild(name);
        
        node.appendChild(header);

        if (item.type === 'directory') {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'file-browser-node-children';
            childrenContainer.style.display = 'none';
            node.appendChild(childrenContainer);
        }

        header.addEventListener('click', (e) => {
            if (item.type === 'directory') {
                this.toggleNode(node);
            } else if (item.type === 'file' && this.callbacks.onFileClick) {
                this.callbacks.onFileClick(item);
            }
            this.selectNode(node);
        });

        return node;
    }

    async toggleNode(node) {
        const isExpanded = !node.classList.contains('expanded');
        node.classList.toggle('expanded', isExpanded);
        const childrenContainer = node.querySelector('.file-browser-node-children');
        const toggle = node.querySelector('.file-browser-node-toggle');
        const icon = node.querySelector('.file-browser-node-icon');
        const filePath = node.dataset.filePath;

        if (toggle) {
            toggle.textContent = isExpanded ? '▼' : '▶';
        }

        if (isExpanded && !childrenContainer.hasChildNodes()) {
            childrenContainer.innerHTML = '<div class="loading-spinner"></div>';
            try {
                const items = await this.fetchFileTree(filePath);
                childrenContainer.innerHTML = '';
                if (items.length > 0) {
                    items.forEach(item => {
                        const childNode = this.createNode(item, parseInt(node.dataset.depth) + 1);
                        childrenContainer.appendChild(childNode);
                    });
                } else {
                    childrenContainer.innerHTML = '<div class="panel-info-text" style="padding-left: 12px;">No files found.</div>';
                }
            } catch (error) {
                childrenContainer.innerHTML = '<div class="panel-info-text" style="padding-left: 12px;">Error loading files.</div>';
                log.error('FILE_TREE', 'LOAD_DIRECTORY_ERROR', `Error loading directory ${filePath}: ${error.message}`, error);
            }
        }

        if (childrenContainer) {
            childrenContainer.style.display = isExpanded ? 'block' : 'none';
        }
        
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

    async fetchFileTree(pathname) {
        log.info('FILE_TREE', 'FETCH_START', `Fetching file tree for path: ${pathname}`);
        try {
            const response = await window.APP.services.globalFetch(`/api/files/list?pathname=${encodeURIComponent(pathname)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            const joinPath = (...parts) => {
                const newPath = parts.join('/');
                return newPath.replace(/\/+/g, '/');
            };

            const dirs = data.dirs.map(d => ({ name: d, type: 'directory', path: joinPath(data.pathname, d)}));
            const files = data.files.map(f => ({ name: f, type: 'file', path: joinPath(data.pathname, f) }));

            return [...dirs, ...files];
        } catch (error) {
            console.error("Failed to fetch file tree:", error);
            throw error;
        }
    }
} 