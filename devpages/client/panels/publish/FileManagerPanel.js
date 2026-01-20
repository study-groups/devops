/**
 * FileManagerPanel.js - File management panel with selection and collections
 *
 * Features:
 * - Checkbox-enabled file tree for marking files
 * - File collections (bookmarks) for saving/loading selections
 * - Context actions (rename, delete) with inline editing
 * - Open in editor integration
 * - Mount point management and selection
 */

import { BasePanel, panelRegistry } from '../BasePanel.js';
import { appStore, dispatch } from '../../appState.js';
import {
    fileCollectionActions,
    selectSelectedFiles,
    selectSelectedCount,
    selectCollections,
    selectCollectionNames,
    selectCollectionFiles,
    selectCollectionMetadata,
    fileCollectionThunks
} from '../../store/slices/fileCollectionSlice.js';
import {
    dataMountActions,
    selectActiveMountPoint,
    selectAllMountPoints,
    selectActiveMountPath,
    selectActiveMountDefaultSubdir,
    dataMountThunks
} from '../../store/slices/dataMountSlice.js';
import { pathThunks, selectCurrentPathname, selectIsDirectorySelected } from '../../store/slices/pathSlice.js';

export class FileManagerPanel extends BasePanel {
    constructor(config = {}) {
        super({
            type: 'file-manager',
            title: 'Files',
            defaultWidth: 320,
            defaultHeight: 500,
            ...config
        });

        this.isAdmin = false;
        this.systemInfo = null;
        this.fileTree = null;
        this.expandedPaths = new Set();
        this.unsubscribe = null;
        this.unsubscribeMount = null;
        this.currentMountId = null;

        // Inline editing state
        this.editingPath = null;  // path being renamed, null if not editing

        // Menu state
        this.menuOpen = false;
    }

    renderContent() {
        const state = appStore.getState();
        const selectedCount = selectSelectedCount(state);
        const collectionNames = selectCollectionNames(state);
        const activeMount = selectActiveMountPoint(state);
        const allMounts = selectAllMountPoints(state);

        return `
            <div class="file-manager-panel">
                <!-- Mount Point Section -->
                <div class="fm-section" data-section="mount-point">
                    <div class="fm-section-header">
                        <span class="fm-section-icon">▼</span>
                        <span class="fm-section-title">Mount Point</span>
                    </div>
                    <div class="fm-section-content">
                        <div class="fm-mount-info">
                            <div class="fm-mount-path">
                                <span class="fm-label">PD_DIR:</span>
                                <code class="fm-path-value">${activeMount?.path || 'Not configured'}</code>
                            </div>
                            ${activeMount?.defaultSubdir ? `
                            <div class="fm-mount-path">
                                <span class="fm-label">Default:</span>
                                <code class="fm-path-value fm-path-subdir">${activeMount.defaultSubdir}/</code>
                            </div>
                            ` : ''}
                            <select id="mount-selector" class="fm-select">
                                ${allMounts.map(m => `
                                    <option value="${m.id}" ${m.id === activeMount?.id ? 'selected' : ''}>
                                        ${this.escapeHtml(m.name)}${m.isDefault ? ' (default)' : ''}
                                    </option>
                                `).join('')}
                            </select>
                            <div class="fm-mount-actions">
                                <button class="fm-btn fm-btn-sm" data-action="add-mount" title="Add new mount point">+ Add</button>
                                <button class="fm-btn fm-btn-sm" data-action="reset-default" title="Reset to default mount">Reset</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Collections Section -->
                <div class="fm-section" data-section="collections">
                    <div class="fm-section-header">
                        <span class="fm-section-icon">▼</span>
                        <span class="fm-section-title">Collections</span>
                    </div>
                    <div class="fm-section-content">
                        <div class="fm-collection-controls">
                            <div class="fm-selection-info">
                                <span id="selected-count">${selectedCount}</span> files selected
                            </div>
                            <div class="fm-collection-row">
                                <input type="text" id="collection-name-input"
                                       class="fm-input" placeholder="Collection name">
                                <button class="fm-btn fm-btn-sm" data-action="save-collection"
                                        title="Save current selection">Save</button>
                            </div>
                            <div class="fm-collection-row">
                                <select id="collection-select" class="fm-select">
                                    <option value="">-- Select collection --</option>
                                    ${collectionNames.map(name => {
                                        const meta = selectCollectionMetadata(state, name);
                                        const isMismatch = meta.mountId !== (activeMount?.id || 'default');
                                        return `<option value="${this.escapeHtml(name)}" ${isMismatch ? 'class="fm-mount-mismatch"' : ''}>
                                            ${this.escapeHtml(name)}${isMismatch ? ' *' : ''}
                                        </option>`;
                                    }).join('')}
                                </select>
                                <button class="fm-btn fm-btn-sm" data-action="load-collection"
                                        title="Load selected collection">Load</button>
                                <button class="fm-btn fm-btn-sm fm-btn-danger" data-action="delete-collection"
                                        title="Delete selected collection">Del</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- File Tree Section -->
                <div class="fm-section" data-section="files">
                    <div class="fm-section-header">
                        <span class="fm-section-icon">▼</span>
                        <span class="fm-section-title">Files</span>
                    </div>
                    <div class="fm-section-content">
                        <div class="fm-tree-toolbar">
                            <button class="fm-toolbar-btn" data-action="locate-file" title="Locate current file">
                                <span class="fm-toolbar-icon">⊙</span>
                                <span class="fm-toolbar-label">Locate</span>
                            </button>
                            <button class="fm-toolbar-btn" data-action="refresh-tree" title="Refresh">
                                <span class="fm-toolbar-icon">↻</span>
                                <span class="fm-toolbar-label">Refresh</span>
                            </button>
                            <div class="fm-toolbar-spacer"></div>
                            <div class="fm-menu-container">
                                <button class="fm-toolbar-btn fm-menu-trigger" data-action="toggle-menu" title="More actions">
                                    <span class="fm-toolbar-icon">⋮</span>
                                </button>
                                <div class="fm-menu-dropdown" id="files-menu" style="display: none;">
                                    <button class="fm-menu-item" data-action="select-all">Select All</button>
                                    <button class="fm-menu-item" data-action="clear-selection">Clear Selection</button>
                                    <div class="fm-menu-divider"></div>
                                    <button class="fm-menu-item" data-action="collapse-all">Collapse All</button>
                                    <button class="fm-menu-item" data-action="expand-all">Expand All</button>
                                </div>
                            </div>
                        </div>
                        <div id="fm-feedback" class="fm-feedback" style="display: none;"></div>
                        <div class="fm-tree-container" id="file-tree">
                            <div class="fm-loading">Loading file tree...</div>
                        </div>
                    </div>
                </div>

                <!-- System Info Section -->
                <div class="fm-section collapsed" data-section="system-info">
                    <div class="fm-section-header">
                        <span class="fm-section-icon">▶</span>
                        <span class="fm-section-title">System Information</span>
                    </div>
                    <div class="fm-section-content">
                        <div id="system-info-content" class="fm-subsection-content">
                            <div class="fm-loading">Loading system information...</div>
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
        this.loadFileTree();

        // Initialize mount points if not already done
        const state = appStore.getState();
        if (!state.dataMount?._initialized) {
            dispatch(dataMountThunks.initializeFromServer());
        }

        // Get initial mount ID
        const activeMount = selectActiveMountPoint(state);
        this.currentMountId = activeMount?.id || null;

        // Subscribe to Redux store changes for selection updates
        this.unsubscribe = appStore.subscribe(() => {
            this.updateSelectionDisplay();
        });

        // Watch for mount changes (including initial load)
        this.unsubscribeMount = appStore.subscribe(() => {
            const state = appStore.getState();
            const activeMount = selectActiveMountPoint(state);
            const newMountId = activeMount?.id || null;

            if (newMountId !== this.currentMountId) {
                this.currentMountId = newMountId;
                this.updateMountDisplay();
                // Only reload file tree if we have an active mount
                if (activeMount) {
                    this.loadFileTree();
                }
            }
        });
    }

    onDestroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.unsubscribeMount) {
            this.unsubscribeMount();
            this.unsubscribeMount = null;
        }
        if (this.closeMenuOnClickOutside) {
            document.removeEventListener('click', this.closeMenuOnClickOutside);
            this.closeMenuOnClickOutside = null;
        }
        super.onDestroy();
    }

    checkAdminStatus() {
        const state = appStore.getState();
        const user = state.auth?.user;
        this.isAdmin = user && (user.role === 'admin' || user.username === 'admin');
    }

    attachEventListeners() {
        const container = this.getContainer();
        if (!container) return;

        container.addEventListener('click', (e) => {
            // Don't process clicks if we're inside an inline edit input
            if (e.target.classList.contains('fm-inline-edit')) {
                return;
            }

            // Section header clicks
            const sectionHeader = e.target.closest('.fm-section-header');
            if (sectionHeader && !e.target.closest('.fm-header-actions') && !e.target.closest('.fm-btn')) {
                const section = sectionHeader.closest('.fm-section');
                this.toggleSection(section);
                return;
            }

            // Tree expand/collapse clicks
            const expandIcon = e.target.closest('.fm-tree-expand');
            if (expandIcon) {
                const treeItem = expandIcon.closest('.fm-tree-item');
                if (treeItem && treeItem.dataset.type === 'directory') {
                    this.toggleTreeItem(treeItem);
                    return;
                }
            }

            // Checkbox clicks
            const checkbox = e.target.closest('.fm-checkbox');
            if (checkbox) {
                const path = checkbox.dataset.path;
                if (path) {
                    dispatch(fileCollectionActions.toggleFile(path));
                }
                return;
            }

            // Action button clicks
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                this.handleAction(actionBtn.dataset.action, actionBtn);
                return;
            }

            // Context action clicks (edit, rename, delete)
            const contextBtn = e.target.closest('.fm-context-btn');
            if (contextBtn) {
                e.preventDefault();
                e.stopPropagation();
                const action = contextBtn.dataset.contextAction;
                const treeItem = contextBtn.closest('.fm-tree-item');
                const path = treeItem?.dataset.path;
                const type = treeItem?.dataset.type;
                if (path && action) {
                    this.handleContextAction(action, path, type);
                }
                return;
            }
        });

        // Mount selector change handler
        container.addEventListener('change', (e) => {
            if (e.target.id === 'mount-selector') {
                const mountId = e.target.value;
                if (mountId) {
                    dispatch(dataMountThunks.switchToMountPoint(mountId));
                }
            }
        });

        // Inline edit keyboard handlers
        container.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('fm-inline-edit')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleRenameConfirm(e.target);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.handleRenameCancel();
                }
            }
        });

        // Inline edit blur handler (confirm on blur)
        container.addEventListener('blur', (e) => {
            if (e.target.classList.contains('fm-inline-edit')) {
                // Small delay to allow click events to process first
                setTimeout(() => {
                    if (this.editingPath) {
                        this.handleRenameConfirm(e.target);
                    }
                }, 100);
            }
        }, true);
    }

    toggleSection(section) {
        const icon = section.querySelector('.fm-section-icon');
        const isCollapsed = section.classList.contains('collapsed');

        section.classList.toggle('collapsed');
        icon.textContent = isCollapsed ? '▼' : '▶';
    }

    toggleTreeItem(item) {
        const path = item.dataset.path;
        const children = item.nextElementSibling;

        if (children && children.classList.contains('fm-tree-children')) {
            const icon = item.querySelector('.fm-tree-expand');
            const isCollapsed = children.style.display === 'none';

            children.style.display = isCollapsed ? 'block' : 'none';
            icon.textContent = isCollapsed ? '▼' : '▶';

            if (isCollapsed) {
                this.expandedPaths.add(path);
            } else {
                this.expandedPaths.delete(path);
            }
        }
    }

    async handleAction(action, btn) {
        // Close menu after any action (except toggle-menu itself)
        if (action !== 'toggle-menu' && this.menuOpen) {
            this.closeMenu();
        }

        switch (action) {
            case 'save-collection':
                this.saveCollection();
                break;
            case 'load-collection':
                this.loadCollection();
                break;
            case 'delete-collection':
                this.deleteCollection();
                break;
            case 'select-all':
                this.selectAllFiles();
                break;
            case 'clear-selection':
                dispatch(fileCollectionActions.clearSelection());
                break;
            case 'refresh-tree':
                await this.loadFileTree();
                break;
            case 'add-mount':
                this.showAddMountDialog();
                break;
            case 'reset-default':
                this.resetToDefaultMount();
                break;
            case 'toggle-menu':
                this.toggleMenu();
                break;
            case 'locate-file':
                this.locateCurrentFile();
                break;
            case 'collapse-all':
                this.collapseAll();
                break;
            case 'expand-all':
                this.expandAll();
                break;
        }
    }

    async handleContextAction(action, path, type) {
        switch (action) {
            case 'edit':
                await this.openInEditor(path, type);
                break;
            case 'rename':
                this.handleRenameStart(path);
                break;
            case 'delete':
                await this.deleteItem(path, type);
                break;
        }
    }

    saveCollection() {
        const container = this.getContainer();
        const input = container?.querySelector('#collection-name-input');
        const name = input?.value?.trim();

        if (!name) {
            this.showFeedback('Please enter a collection name', 'error');
            return;
        }

        const state = appStore.getState();
        const selectedFiles = selectSelectedFiles(state);
        const activeMount = selectActiveMountPoint(state);
        const mountId = activeMount?.id || 'default';

        if (selectedFiles.length === 0) {
            this.showFeedback('No files selected', 'error');
            return;
        }

        dispatch(fileCollectionThunks.saveCollectionAndPersist(name, null, mountId));
        input.value = '';
        this.showFeedback(`Collection "${name}" saved with ${selectedFiles.length} files`, 'success');
        this.updateCollectionsDropdown();
    }

    loadCollection() {
        const container = this.getContainer();
        const select = container?.querySelector('#collection-select');
        const name = select?.value;

        if (!name) {
            this.showFeedback('Please select a collection', 'error');
            return;
        }

        dispatch(fileCollectionActions.loadCollection(name));
        this.showFeedback(`Collection "${name}" loaded`, 'success');
        this.updateCheckboxes();
    }

    deleteCollection() {
        const container = this.getContainer();
        const select = container?.querySelector('#collection-select');
        const name = select?.value;

        if (!name) {
            this.showFeedback('Please select a collection to delete', 'error');
            return;
        }

        if (!confirm(`Delete collection "${name}"?`)) {
            return;
        }

        dispatch(fileCollectionThunks.deleteCollectionAndPersist(name));
        this.showFeedback(`Collection "${name}" deleted`, 'success');
        this.updateCollectionsDropdown();
    }

    selectAllFiles() {
        if (!this.fileTree) return;

        const allPaths = [];
        const collectPaths = (node, basePath = '') => {
            if (!node) return;
            const path = basePath ? `${basePath}/${node.name}` : node.name;

            if (node.type === 'file') {
                allPaths.push(path);
            }

            if (node.children) {
                for (const child of node.children) {
                    collectPaths(child, path);
                }
            }
        };

        if (this.fileTree.children) {
            for (const child of this.fileTree.children) {
                collectPaths(child, '');
            }
        }

        dispatch(fileCollectionActions.selectFiles(allPaths));
    }

    // Inline rename handlers
    handleRenameStart(path) {
        this.editingPath = path;
        this.updateFileTreeDisplay();
        // Focus the input after render
        requestAnimationFrame(() => {
            const container = this.getContainer();
            const input = container?.querySelector('.fm-inline-edit');
            if (input) {
                input.focus();
                input.select();
            }
        });
    }

    async handleRenameConfirm(input) {
        if (!input || !this.editingPath) return;

        const newName = input.value.trim();
        const originalName = input.dataset.original;
        const path = this.editingPath;

        this.editingPath = null;

        if (newName && newName !== originalName) {
            await this.doRename(path, newName);
        } else {
            this.updateFileTreeDisplay();
        }
    }

    handleRenameCancel() {
        this.editingPath = null;
        this.updateFileTreeDisplay();
    }

    async doRename(path, newName) {
        const parts = path.split('/');
        const oldName = parts.pop();
        const dir = parts.join('/') || '.';

        try {
            await dispatch(fileCollectionThunks.renameFile(dir, oldName, newName));
            this.showFeedback(`Renamed "${oldName}" to "${newName}"`, 'success');
            await this.loadFileTree();
        } catch (error) {
            this.showFeedback(`Failed to rename: ${error.message}`, 'error');
            this.updateFileTreeDisplay();
        }
    }

    // Open file in editor
    async openInEditor(path, type) {
        if (type === 'directory') {
            // Navigate to directory
            dispatch(pathThunks.navigateToPath({
                pathname: path,
                isDirectory: true
            }));
        } else {
            // Open file in editor
            dispatch(pathThunks.navigateToPath({
                pathname: path,
                isDirectory: false
            }));
        }
    }

    // Mount management methods
    showAddMountDialog() {
        // Import and show the AddMountDialog
        import('../../components/AddMountDialog.js').then(({ showAddMountDialog }) => {
            showAddMountDialog();
        }).catch(err => {
            console.error('[FileManager] Failed to load AddMountDialog:', err);
            // Fallback to prompt
            const path = prompt('Enter the absolute path to the mount point:');
            if (path) {
                const name = prompt('Enter a name for this mount point:', path.split('/').pop());
                dispatch(dataMountThunks.addAndLoadMountPoint(path, name));
            }
        });
    }

    resetToDefaultMount() {
        const state = appStore.getState();
        const allMounts = selectAllMountPoints(state);
        const defaultMount = allMounts.find(m => m.isDefault);

        if (defaultMount) {
            dispatch(dataMountThunks.switchToMountPoint(defaultMount.id));
            this.showFeedback('Reset to default mount point', 'success');
        } else {
            this.showFeedback('No default mount point found', 'error');
        }
    }

    updateMountDisplay() {
        const container = this.getContainer();
        if (!container) return;

        const state = appStore.getState();
        const activeMount = selectActiveMountPoint(state);
        const allMounts = selectAllMountPoints(state);

        // Update path display
        const pathEls = container.querySelectorAll('.fm-mount-path');
        if (pathEls.length > 0) {
            // First path element is PD_DIR
            const pdDirEl = pathEls[0]?.querySelector('.fm-path-value');
            if (pdDirEl) {
                pdDirEl.textContent = activeMount?.path || 'Not configured';
            }
            // Second path element is default subdir (if it exists)
            if (pathEls.length > 1) {
                const subdirEl = pathEls[1]?.querySelector('.fm-path-value');
                if (subdirEl && activeMount?.defaultSubdir) {
                    subdirEl.textContent = activeMount.defaultSubdir + '/';
                }
            }
        }

        // Update mount selector
        const selector = container.querySelector('#mount-selector');
        if (selector) {
            selector.innerHTML = allMounts.map(m => `
                <option value="${m.id}" ${m.id === activeMount?.id ? 'selected' : ''}>
                    ${this.escapeHtml(m.name)}${m.isDefault ? ' (default)' : ''}
                </option>
            `).join('');
        }

        // Update collections dropdown to show mount mismatch indicators
        this.updateCollectionsDropdown();
    }

    // Menu methods
    toggleMenu() {
        this.menuOpen = !this.menuOpen;
        const container = this.getContainer();
        const menu = container?.querySelector('#files-menu');
        if (menu) {
            menu.style.display = this.menuOpen ? 'block' : 'none';
        }

        // Add click-outside listener to close menu
        if (this.menuOpen) {
            setTimeout(() => {
                this.closeMenuOnClickOutside = (e) => {
                    const menuContainer = container?.querySelector('.fm-menu-container');
                    if (menuContainer && !menuContainer.contains(e.target)) {
                        this.closeMenu();
                    }
                };
                document.addEventListener('click', this.closeMenuOnClickOutside);
            }, 0);
        }
    }

    closeMenu() {
        this.menuOpen = false;
        const container = this.getContainer();
        const menu = container?.querySelector('#files-menu');
        if (menu) {
            menu.style.display = 'none';
        }
        if (this.closeMenuOnClickOutside) {
            document.removeEventListener('click', this.closeMenuOnClickOutside);
            this.closeMenuOnClickOutside = null;
        }
    }

    // Locate current file in tree
    locateCurrentFile() {
        const state = appStore.getState();
        let currentPath = selectCurrentPathname(state);
        const isDirectory = selectIsDirectorySelected(state);

        if (!currentPath) {
            this.showFeedback('No file currently open', 'info');
            return;
        }

        // Normalize path - tree uses paths without leading slash (e.g., "data/file.md")
        if (currentPath.startsWith('/')) {
            currentPath = currentPath.slice(1);
        }

        const container = this.getContainer();
        if (!container) return;

        const parts = currentPath.split('/').filter(Boolean);
        const fileName = parts[parts.length - 1];

        // Build list of directories to expand (all except the file itself)
        const dirsToExpand = [];
        let pathSoFar = '';
        const expandCount = isDirectory ? parts.length : parts.length - 1;
        for (let i = 0; i < expandCount; i++) {
            pathSoFar = pathSoFar ? `${pathSoFar}/${parts[i]}` : parts[i];
            dirsToExpand.push(pathSoFar);
            this.expandedPaths.add(pathSoFar);
        }

        // Directly expand directories in DOM by showing their children
        for (const dirPath of dirsToExpand) {
            const dirItem = container.querySelector(`[data-path="${dirPath}"][data-type="directory"]`);
            if (dirItem) {
                // Find the sibling fm-tree-children div and show it
                const childrenDiv = dirItem.nextElementSibling;
                if (childrenDiv && childrenDiv.classList.contains('fm-tree-children')) {
                    childrenDiv.style.display = 'block';
                }
                // Update the expand icon
                const expandIcon = dirItem.querySelector('.fm-tree-expand');
                if (expandIcon) {
                    expandIcon.textContent = '▼';
                }
            }
        }

        // Now find and highlight the target file
        setTimeout(() => {
            const targetItem = container.querySelector(`[data-path="${currentPath}"]`);

            if (targetItem) {
                targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetItem.classList.add('fm-tree-highlight');
                setTimeout(() => {
                    targetItem.classList.remove('fm-tree-highlight');
                }, 2000);
                this.showFeedback(`Located: ${fileName}`, 'success');
            } else {
                this.showFeedback(`File not found: ${fileName}`, 'error');
            }
        }, 50);
    }

    // Collapse all expanded directories
    collapseAll() {
        console.log('[FileManager] Collapsing all. Current expanded:', [...this.expandedPaths]);
        this.expandedPaths.clear();
        this.updateFileTreeDisplay();
        this.showFeedback('Collapsed all directories', 'info');
    }

    // Expand all directories
    expandAll() {
        if (!this.fileTree) return;

        const collectDirs = (node, basePath = '') => {
            if (!node || !node.children) return;

            for (const child of node.children) {
                if (child.type === 'directory') {
                    const childPath = basePath ? `${basePath}/${child.name}` : child.name;
                    this.expandedPaths.add(childPath);
                    collectDirs(child, childPath);
                }
            }
        };

        collectDirs(this.fileTree);
        this.updateFileTreeDisplay();
        this.showFeedback('Expanded all directories', 'info');
    }

    async deleteItem(path, type) {
        const parts = path.split('/');
        const fileName = parts.pop();
        const dir = parts.join('/') || '.';

        const typeLabel = type === 'directory' ? 'directory' : 'file';
        if (!confirm(`Delete ${typeLabel} "${fileName}"? This cannot be undone.`)) {
            return;
        }

        try {
            await dispatch(fileCollectionThunks.deleteFile(dir, fileName));
            this.showFeedback(`Deleted "${fileName}"`, 'success');

            // Remove from selection if it was selected
            const state = appStore.getState();
            const selectedFiles = selectSelectedFiles(state);
            if (selectedFiles.includes(path)) {
                dispatch(fileCollectionActions.toggleFile(path));
            }

            await this.loadFileTree();
        } catch (error) {
            this.showFeedback(`Failed to delete: ${error.message}`, 'error');
        }
    }

    showFeedback(message, type = 'info') {
        const container = this.getContainer();
        const feedbackEl = container?.querySelector('#fm-feedback');
        if (!feedbackEl) return;

        feedbackEl.textContent = message;
        feedbackEl.className = `fm-feedback fm-feedback-${type}`;
        feedbackEl.style.display = 'block';

        setTimeout(() => {
            feedbackEl.style.display = 'none';
        }, 4000);
    }

    updateSelectionDisplay() {
        const container = this.getContainer();
        if (!container) return;

        const state = appStore.getState();
        const selectedCount = selectSelectedCount(state);

        const countEl = container.querySelector('#selected-count');
        if (countEl) {
            countEl.textContent = selectedCount;
        }
    }

    updateCheckboxes() {
        const container = this.getContainer();
        if (!container) return;

        const state = appStore.getState();
        const selectedFiles = selectSelectedFiles(state);
        const selectedSet = new Set(selectedFiles);

        const checkboxes = container.querySelectorAll('.fm-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectedSet.has(checkbox.dataset.path);
        });
    }

    updateCollectionsDropdown() {
        const container = this.getContainer();
        if (!container) return;

        const state = appStore.getState();
        const collectionNames = selectCollectionNames(state);

        const select = container.querySelector('#collection-select');
        if (select) {
            select.innerHTML = `
                <option value="">-- Select collection --</option>
                ${collectionNames.map(name =>
                    `<option value="${this.escapeHtml(name)}">${this.escapeHtml(name)}</option>`
                ).join('')}
            `;
        }
    }

    async loadSystemInfo() {
        try {
            const response = await fetch('/api/system/info', {
                credentials: 'include'
            });

            if (response.status === 401) {
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
            console.error('[FileManager] Failed to load system info:', error);
            this.updateSystemInfoDisplay({ error: error.message });
        }
    }

    updateSystemInfoDisplay() {
        const container = this.getContainer();
        if (!container) return;

        const contentEl = container.querySelector('#system-info-content');
        if (!contentEl) return;

        if (!this.systemInfo || this.systemInfo.error) {
            contentEl.innerHTML = `<div class="fm-error">Error loading system info</div>`;
            return;
        }

        contentEl.innerHTML = `
            <div class="fm-system-info">
                <div class="fm-info-item">
                    <span class="fm-info-label">Mode:</span>
                    <code class="fm-info-value">${this.isAdmin ? 'Admin' : 'User'}</code>
                </div>
                <div class="fm-info-item">
                    <span class="fm-info-label">PD_DIR:</span>
                    <code class="fm-info-value">${this.systemInfo.PD_DIR || '(not set)'}</code>
                </div>
                <div class="fm-info-item">
                    <span class="fm-info-label">MD_DIR:</span>
                    <code class="fm-info-value">${this.systemInfo.MD_DIR || '(derived)'}</code>
                </div>
            </div>
        `;
    }

    async loadFileTree() {
        const container = this.getContainer();
        if (!container) return;

        const contentEl = container.querySelector('#file-tree');
        if (!contentEl) return;

        contentEl.innerHTML = '<div class="fm-loading">Loading file tree...</div>';

        try {
            const response = await fetch('/api/system/file-tree', {
                credentials: 'include'
            });

            if (response.status === 401) {
                this.fileTree = null;
                contentEl.innerHTML = '<div class="fm-error">Please log in to view files</div>';
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to load file tree: ${response.status}`);
            }

            this.fileTree = await response.json();

            // Auto-expand the default subdirectory (e.g., 'data')
            const state = appStore.getState();
            const defaultSubdir = selectActiveMountDefaultSubdir(state);
            if (defaultSubdir && !this.expandedPaths.has(defaultSubdir)) {
                this.expandedPaths.add(defaultSubdir);
            }

            this.updateFileTreeDisplay();
        } catch (error) {
            console.error('[FileManager] Failed to load file tree:', error);
            if (contentEl) {
                contentEl.innerHTML = `<div class="fm-error">Error: ${error.message}</div>`;
            }
        }
    }

    updateFileTreeDisplay() {
        const container = this.getContainer();
        if (!container) return;

        const contentEl = container.querySelector('#file-tree');
        if (!contentEl) return;

        if (!this.fileTree || this.fileTree.error) {
            contentEl.innerHTML = `<div class="fm-error">Error loading file tree</div>`;
            return;
        }

        contentEl.innerHTML = this.renderTreeNode(this.fileTree, '', true);
        this.updateCheckboxes();
    }

    renderTreeNode(node, path, isRoot = false) {
        if (!node) return '';

        const state = appStore.getState();
        const selectedFiles = selectSelectedFiles(state);
        const selectedSet = new Set(selectedFiles);

        const hasChildren = node.children && node.children.length > 0;
        let html = '';

        if (!isRoot) {
            const fullPath = path;
            const isSelected = selectedSet.has(fullPath);
            const isExpanded = this.expandedPaths.has(fullPath);
            const isEditing = this.editingPath === fullPath;
            const icon = node.type === 'directory' ? (isExpanded ? '▼' : '▶') : '';
            const fileIcon = this.getFileIcon(node);

            html += `
                <div class="fm-tree-item${isEditing ? ' fm-editing' : ''}" data-path="${this.escapeHtml(fullPath)}" data-type="${node.type}">
                    <span class="fm-tree-expand">${icon}</span>
                    ${node.type === 'file' ? `
                        <input type="checkbox" class="fm-checkbox"
                               data-path="${this.escapeHtml(fullPath)}"
                               ${isSelected ? 'checked' : ''}>
                    ` : '<span class="fm-checkbox-placeholder"></span>'}
                    <span class="fm-tree-icon">${fileIcon}</span>
                    ${isEditing ? `
                        <input type="text" class="fm-inline-edit"
                               value="${this.escapeHtml(node.name)}"
                               data-original="${this.escapeHtml(node.name)}"
                               data-path="${this.escapeHtml(fullPath)}">
                    ` : `
                        <span class="fm-tree-name">${this.escapeHtml(node.name)}</span>
                    `}
                    <div class="fm-tree-actions">
                        <button class="fm-context-btn" data-context-action="edit" title="Open in Editor">&#9998;</button>
                        <button class="fm-context-btn" data-context-action="rename" title="Rename">&#9999;</button>
                        <button class="fm-context-btn fm-context-danger" data-context-action="delete" title="Delete">&times;</button>
                    </div>
                </div>
            `;
        }

        if (hasChildren) {
            const isExpanded = isRoot || this.expandedPaths.has(path);
            html += `<div class="fm-tree-children" style="display: ${isExpanded ? 'block' : 'none'};">`;

            // Sort: directories first, then alphabetically
            const sortedChildren = [...node.children].sort((a, b) => {
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
            });

            for (const child of sortedChildren) {
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

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    addStyles() {
        if (document.getElementById('file-manager-styles')) return;

        const style = document.createElement('style');
        style.id = 'file-manager-styles';
        style.textContent = `
            .file-manager-panel {
                height: 100%;
                display: flex;
                flex-direction: column;
                font-size: 12px;
                overflow-y: auto;
            }

            /* Section styles */
            .fm-section {
                border-bottom: 1px solid var(--color-border);
            }

            .fm-section-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: var(--color-bg-alt);
                cursor: pointer;
                user-select: none;
                font-weight: 600;
            }

            .fm-section-header:hover {
                background: var(--color-bg-hover);
            }

            .fm-section-icon {
                font-size: 10px;
                opacity: 0.7;
                width: 12px;
            }

            .fm-section-title {
                font-size: 13px;
                flex: 1;
            }

            .fm-header-actions {
                display: flex;
                gap: 4px;
                align-items: center;
            }

            /* Menu dropdown */
            .fm-menu-container {
                position: relative;
            }

            .fm-menu-trigger {
                font-weight: bold;
                font-size: 14px !important;
                line-height: 1;
            }

            .fm-menu-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 4px;
                min-width: 140px;
                background: var(--color-bg-elevated, #fff);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-md, 6px);
                box-shadow: var(--shadow-lg, 0 4px 12px rgba(0,0,0,0.15));
                z-index: 100;
                overflow: hidden;
            }

            .fm-menu-item {
                display: block;
                width: 100%;
                padding: 8px 12px;
                border: none;
                background: none;
                text-align: left;
                font-size: 12px;
                color: var(--color-text);
                cursor: pointer;
            }

            .fm-menu-item:hover {
                background: var(--color-bg-hover);
            }

            .fm-menu-divider {
                height: 1px;
                background: var(--color-border);
                margin: 4px 0;
            }

            /* Tree toolbar */
            .fm-tree-toolbar {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 6px 8px;
                background: var(--color-bg-alt);
                border-bottom: 1px solid var(--color-border);
            }

            .fm-toolbar-btn {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border: 1px solid var(--color-border);
                border-radius: 4px;
                background: var(--color-bg);
                color: var(--color-text);
                font-size: 11px;
                cursor: pointer;
                white-space: nowrap;
            }

            .fm-toolbar-btn:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary);
            }

            .fm-toolbar-icon {
                font-size: 12px;
            }

            .fm-toolbar-label {
                font-size: 11px;
            }

            .fm-toolbar-spacer {
                flex: 1;
            }

            .fm-section-content {
                max-height: 2000px;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .fm-section.collapsed .fm-section-content {
                max-height: 0;
            }

            /* Collection controls */
            .fm-collection-controls {
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                background: var(--color-bg);
            }

            .fm-selection-info {
                font-size: 11px;
                color: var(--color-text-secondary);
                padding: 4px 0;
            }

            .fm-collection-row {
                display: flex;
                gap: 6px;
                align-items: center;
            }

            .fm-input, .fm-select {
                flex: 1;
                padding: 6px 8px;
                font-size: 11px;
                border: 1px solid var(--color-border);
                border-radius: 4px;
                background: var(--color-bg);
                color: var(--color-text);
            }

            .fm-input:focus, .fm-select:focus {
                outline: none;
                border-color: var(--color-primary);
            }

            /* Buttons */
            .fm-btn {
                padding: 6px 10px;
                font-size: 11px;
                border: 1px solid var(--color-border);
                border-radius: 4px;
                background: var(--color-bg-alt);
                color: var(--color-text);
                cursor: pointer;
                white-space: nowrap;
            }

            .fm-btn:hover {
                background: var(--color-bg-hover);
                border-color: var(--color-primary);
            }

            .fm-btn-sm {
                padding: 4px 8px;
            }

            .fm-btn-xs {
                padding: 2px 6px;
                font-size: 10px;
            }

            .fm-btn-danger {
                color: var(--color-danger, #dc3545);
                border-color: var(--color-danger, #dc3545);
            }

            .fm-btn-danger:hover {
                background: rgba(220, 53, 69, 0.1);
            }

            /* Mount Section */
            .fm-mount-info {
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .fm-mount-path {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .fm-label {
                font-size: 10px;
                font-weight: 600;
                color: var(--color-text-secondary);
                text-transform: uppercase;
            }

            .fm-path-value {
                font-size: 11px;
                padding: 6px 8px;
                background: var(--color-bg-alt);
                border-radius: 4px;
                word-break: break-all;
                user-select: all;
                font-family: var(--font-mono);
            }

            .fm-path-subdir {
                color: var(--color-primary, #3b82f6);
                font-weight: 500;
            }

            .fm-mount-actions {
                display: flex;
                gap: 6px;
            }

            /* File Tree */
            .fm-tree-container {
                max-height: 500px;
                overflow-y: auto;
                padding: 8px;
                background: var(--color-bg);
            }

            .fm-tree-item {
                display: flex;
                align-items: center;
                padding: 4px 6px;
                line-height: 20px;
                user-select: none;
                border-radius: 3px;
            }

            .fm-tree-item:hover {
                background: var(--color-bg-hover);
            }

            .fm-tree-item:hover .fm-tree-actions {
                opacity: 1;
            }

            .fm-tree-item.fm-editing {
                background: var(--color-bg-hover);
            }

            .fm-tree-item.fm-editing .fm-tree-actions {
                opacity: 0;
            }

            /* Highlight animation for locate */
            .fm-tree-item.fm-tree-highlight {
                animation: fm-highlight-pulse 2s ease-out;
            }

            @keyframes fm-highlight-pulse {
                0% {
                    background: var(--color-primary, #3b82f6);
                    color: #fff;
                }
                100% {
                    background: transparent;
                    color: inherit;
                }
            }

            .fm-tree-item.fm-tree-highlight .fm-tree-name,
            .fm-tree-item.fm-tree-highlight .fm-tree-icon {
                animation: fm-highlight-text 2s ease-out;
            }

            @keyframes fm-highlight-text {
                0% { color: #fff; }
                100% { color: inherit; }
            }

            .fm-tree-expand {
                width: 16px;
                font-size: 9px;
                text-align: center;
                opacity: 0.6;
                cursor: pointer;
                flex-shrink: 0;
            }

            .fm-tree-expand:hover {
                opacity: 1;
            }

            .fm-checkbox {
                width: 14px;
                height: 14px;
                margin-right: 6px;
                cursor: pointer;
                flex-shrink: 0;
            }

            .fm-checkbox-placeholder {
                width: 14px;
                margin-right: 6px;
                flex-shrink: 0;
            }

            .fm-tree-icon {
                font-size: 12px;
                margin-right: 6px;
                flex-shrink: 0;
            }

            .fm-tree-name {
                font-size: 12px;
                font-family: var(--font-mono);
                color: var(--color-text);
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Inline editing */
            .fm-inline-edit {
                background: var(--color-bg);
                border: 1px solid var(--color-primary);
                border-radius: 3px;
                padding: 2px 6px;
                font-family: var(--font-mono);
                font-size: 12px;
                flex: 1;
                outline: none;
                color: var(--color-text);
            }

            .fm-inline-edit:focus {
                border-color: var(--color-primary);
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }

            .fm-tree-actions {
                display: flex;
                gap: 2px;
                opacity: 0;
                transition: opacity 0.15s;
            }

            .fm-context-btn {
                width: 20px;
                height: 20px;
                padding: 0;
                border: none;
                background: transparent;
                color: var(--color-text-secondary);
                cursor: pointer;
                font-size: 12px;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .fm-context-btn:hover {
                background: var(--color-bg-alt);
                color: var(--color-text);
            }

            .fm-context-danger:hover {
                background: rgba(220, 53, 69, 0.2);
                color: var(--color-danger, #dc3545);
            }

            .fm-tree-children {
                padding-left: 16px;
            }

            /* Mount mismatch indicator for collections */
            .fm-mount-mismatch {
                color: var(--color-warning, #f59e0b);
            }

            /* System Info */
            .fm-system-info {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px;
            }

            .fm-info-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 6px 8px;
                background: var(--color-bg-alt);
                border-radius: 4px;
            }

            .fm-info-label {
                font-size: 10px;
                font-weight: 600;
                color: var(--color-text-secondary);
                text-transform: uppercase;
            }

            .fm-info-value {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--color-text);
                word-break: break-all;
            }

            /* Feedback */
            .fm-feedback {
                padding: 8px 12px;
                margin: 8px;
                border-radius: 4px;
                font-size: 11px;
                border-left: 3px solid;
            }

            .fm-feedback-info {
                background: rgba(59, 130, 246, 0.1);
                border-color: rgb(59, 130, 246);
                color: rgb(59, 130, 246);
            }

            .fm-feedback-success {
                background: rgba(34, 197, 94, 0.1);
                border-color: rgb(34, 197, 94);
                color: rgb(34, 197, 94);
            }

            .fm-feedback-error {
                background: rgba(220, 53, 69, 0.1);
                border-color: rgb(220, 53, 69);
                color: rgb(220, 53, 69);
            }

            .fm-loading {
                padding: 12px;
                text-align: center;
                color: var(--color-text-secondary);
                font-size: 11px;
            }

            .fm-error {
                padding: 12px;
                color: var(--color-danger, #dc3545);
                font-size: 11px;
                background: rgba(220, 53, 69, 0.1);
                border-radius: 4px;
                margin: 8px;
            }

            /* Scrollbar */
            .fm-tree-container::-webkit-scrollbar,
            .file-manager-panel::-webkit-scrollbar {
                width: 6px;
            }

            .fm-tree-container::-webkit-scrollbar-track,
            .file-manager-panel::-webkit-scrollbar-track {
                background: transparent;
            }

            .fm-tree-container::-webkit-scrollbar-thumb,
            .file-manager-panel::-webkit-scrollbar-thumb {
                background: var(--color-border);
                border-radius: 3px;
            }

            .fm-tree-container::-webkit-scrollbar-thumb:hover,
            .file-manager-panel::-webkit-scrollbar-thumb:hover {
                background: var(--color-text-secondary);
            }
        `;
        document.head.appendChild(style);
    }
}

panelRegistry.registerType('file-manager', FileManagerPanel);
