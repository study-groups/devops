/**
 * File Tree Panel - Displays file system tree structure
 * Context-aware panel that adapts behavior based on usage (standalone vs child panel)
 */

import { BasePanel } from './BasePanel.js';
import { logMessage } from '/client/log/index.js';

export class FileTreePanel extends BasePanel {
  constructor(options = {}) {
    super({
      id: 'file-tree-panel',
      title: 'File Tree',
      ...options
    });
    
    // Panel context - determines behavior and styling
    this.isChildPanel = options.isChildPanel || false;
    this.parentPanel = options.parentPanel || null;
    this.panelDepth = options.panelDepth || 0;
    
    // File tree state
    this.currentPath = '/root/src/devops/devpages'; // PWD context
    this.expandedFolders = new Set();
    this.selectedItem = null;
    this.treeData = null;
    
    // Interaction settings based on context
    this.collapseOnSingleClick = this.isChildPanel; // Child panels collapse on single click
    this.showFullPath = !this.isChildPanel; // Standalone panels show full paths
    this.enableLongClick = true;
    
    logMessage(`FileTreePanel instance created (${this.isChildPanel ? 'child' : 'standalone'} panel).`, 'debug', 'FILE_TREE_PANEL');
  }

  async onMount(container) {
    super.onMount(container);
    await this.init();
  }

  async init() {
    await this.loadFileTree();
    this.render();
  }

  renderContent() {
    // Adapt styling based on panel context
    const headerStyle = this.isChildPanel ? 
      'padding: 4px 8px; font-size: 12px; border-bottom: 1px solid var(--color-border-light, #f0f0f0);' :
      'padding: 8px 12px; font-size: 14px; border-bottom: 1px solid var(--color-border, #e1e5e9);';
    
    const containerPadding = this.isChildPanel ? '2px' : '4px';
    const treeIndent = this.isChildPanel ? '12px' : '16px';

    return `
      <div class="file-tree-panel-container ${this.isChildPanel ? 'child-panel' : 'standalone-panel'}" style="
        font-family: var(--font-family-mono, 'Courier New', monospace);
        color: var(--color-foreground);
        background: var(--color-background, white);
        border-radius: ${this.isChildPanel ? '3px' : '4px'};
        padding: ${containerPadding};
        height: 100%;
        display: flex;
        flex-direction: column;
        ${this.isChildPanel ? 'border: 1px solid var(--color-border-light, #f0f0f0);' : ''}
      ">
        <div class="file-tree-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          ${headerStyle}
          margin-bottom: ${this.isChildPanel ? '4px' : '8px'};
        ">
          <div class="file-tree-path" style="
            font-size: ${this.isChildPanel ? '10px' : '12px'};
            color: var(--color-foreground-muted, #666);
            font-family: var(--font-family-mono, 'Courier New', monospace);
          ">
            ${this.showFullPath ? this.currentPath : '.../' + this.currentPath.split('/').pop()}
          </div>
          <div class="file-tree-controls">
            <button class="refresh-tree-btn" style="
              padding: ${this.isChildPanel ? '2px 4px' : '4px 6px'};
              background: var(--color-secondary, #6c757d);
              color: white;
              border: none;
              border-radius: 2px;
              cursor: pointer;
              font-size: ${this.isChildPanel ? '9px' : '10px'};
            ">
              ↻
            </button>
          </div>
        </div>
        
        <div class="file-tree-content" style="
          flex: 1;
          overflow-y: auto;
          padding: 0 ${this.isChildPanel ? '4px' : '8px'};
          --tree-indent: ${treeIndent};
        ">
          ${this.renderTreeContent()}
        </div>
      </div>
    `;
  }

  renderTreeContent() {
    if (this.treeData?.error) {
      return `
        <div class="file-tree-error" style="
          color: var(--color-error, #dc3545);
          font-size: ${this.isChildPanel ? '11px' : '12px'};
          padding: 8px;
        ">
          Error: ${this.treeData.error}
        </div>
      `;
    }

    if (!this.treeData) {
      return `
        <div class="file-tree-loading" style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100px;
          color: var(--color-foreground-muted, #666);
          font-size: ${this.isChildPanel ? '11px' : '12px'};
        ">
          Loading file tree...
        </div>
      `;
    }

    return this.renderTreeNode(this.treeData, 0);
  }

  render() {
    super.render();
    this.setupEventListeners();
    return this.element;
  }

  async loadFileTree() {
    try {
      // Mock file tree data for now - in real implementation, this would fetch from API
      this.treeData = await this.fetchFileTreeData(this.currentPath);
      logMessage('File tree data loaded successfully', 'debug', 'FILE_TREE_PANEL');
    } catch (error) {
      logMessage(`Failed to load file tree: ${error.message}`, 'error', 'FILE_TREE_PANEL');
      this.treeData = { error: error.message };
    }
  }

  async fetchFileTreeData(path) {
    // Mock implementation - replace with actual API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          name: 'devpages',
          type: 'directory',
          path: path,
          children: [
            {
              name: 'client',
              type: 'directory',
              path: path + '/client',
              children: [
                { name: 'panels', type: 'directory', path: path + '/client/panels' },
                { name: 'settings', type: 'directory', path: path + '/client/settings' },
                { name: 'utils', type: 'directory', path: path + '/client/utils' },
                { name: 'bootstrap.js', type: 'file', path: path + '/client/bootstrap.js' }
              ]
            },
            {
              name: 'server',
              type: 'directory',
              path: path + '/server',
              children: [
                { name: 'api', type: 'directory', path: path + '/server/api' },
                { name: 'routes', type: 'directory', path: path + '/server/routes' }
              ]
            },
            { name: 'package.json', type: 'file', path: path + '/package.json' },
            { name: 'README.md', type: 'file', path: path + '/README.md' }
          ]
        });
      }, 100);
    });
  }

  renderTreeNode(node, depth) {
    const indent = depth * (this.isChildPanel ? 12 : 16);
    const fontSize = this.isChildPanel ? '11px' : '12px';
    
    let html = '';
    
    if (node.type === 'directory') {
      const isExpanded = this.expandedFolders.has(node.path);
      const expandIcon = isExpanded ? '▼' : '▶';
      
      html += `
        <div class="tree-node directory-node" data-path="${node.path}" data-type="directory" style="
          margin-left: ${indent}px;
          cursor: pointer;
          padding: 2px 4px;
          font-size: ${fontSize};
          display: flex;
          align-items: center;
          gap: 4px;
          ${this.selectedItem === node.path ? 'background: var(--color-primary-light, #e3f2fd);' : ''}
        ">
          <span class="expand-icon" style="
            width: 12px;
            text-align: center;
            font-size: 10px;
            color: var(--color-foreground-muted, #666);
          ">${expandIcon}</span>
          <span class="folder-icon" style="color: var(--color-warning, #ffc107);">📁</span>
          <span class="node-name">${node.name}</span>
        </div>
      `;
      
      if (isExpanded && node.children) {
        for (const child of node.children) {
          html += this.renderTreeNode(child, depth + 1);
        }
      }
    } else {
      html += `
        <div class="tree-node file-node" data-path="${node.path}" data-type="file" style="
          margin-left: ${indent}px;
          cursor: pointer;
          padding: 2px 4px;
          font-size: ${fontSize};
          display: flex;
          align-items: center;
          gap: 4px;
          ${this.selectedItem === node.path ? 'background: var(--color-primary-light, #e3f2fd);' : ''}
        ">
          <span class="expand-icon" style="width: 12px;"></span>
          <span class="file-icon" style="color: var(--color-info, #17a2b8);">📄</span>
          <span class="node-name">${node.name}</span>
        </div>
      `;
    }
    
    return html;
  }

  setupEventListeners() {
    if (!this.element) return;

    let longClickTimer = null;
    
    this.element.addEventListener('click', (e) => {
      // Refresh button
      if (e.target.classList.contains('refresh-tree-btn')) {
        this.refresh();
        return;
      }
      
      // Tree node clicks
      const treeNode = e.target.closest('.tree-node');
      if (treeNode) {
        const path = treeNode.dataset.path;
        const type = treeNode.dataset.type;
        
        if (type === 'directory') {
          if (this.collapseOnSingleClick) {
            this.toggleDirectory(path);
          } else {
            this.selectItem(path);
          }
        } else {
          this.selectItem(path);
          this.notifyParent('file-selected', { path, type });
        }
      }
    });

    // Long click support
    if (this.enableLongClick) {
      this.element.addEventListener('mousedown', (e) => {
        const treeNode = e.target.closest('.tree-node');
        if (treeNode) {
          longClickTimer = setTimeout(() => {
            this.handleLongClick(treeNode);
          }, 500); // 500ms for long click
        }
      });

      this.element.addEventListener('mouseup', () => {
        if (longClickTimer) {
          clearTimeout(longClickTimer);
          longClickTimer = null;
        }
      });

      this.element.addEventListener('mouseleave', () => {
        if (longClickTimer) {
          clearTimeout(longClickTimer);
          longClickTimer = null;
        }
      });
    }

    // Double-click for directories in standalone mode
    if (!this.collapseOnSingleClick) {
      this.element.addEventListener('dblclick', (e) => {
        const treeNode = e.target.closest('.tree-node');
        if (treeNode && treeNode.dataset.type === 'directory') {
          this.toggleDirectory(treeNode.dataset.path);
        }
      });
    }
  }

  toggleDirectory(path) {
    if (this.expandedFolders.has(path)) {
      this.expandedFolders.delete(path);
    } else {
      this.expandedFolders.add(path);
    }
    this.render();
  }

  selectItem(path) {
    this.selectedItem = path;
    this.render();
  }

  handleLongClick(treeNode) {
    const path = treeNode.dataset.path;
    const type = treeNode.dataset.type;
    
    // Show context menu or perform long-click action
    logMessage(`Long click on ${type}: ${path}`, 'debug', 'FILE_TREE_PANEL');
    this.notifyParent('long-click', { path, type });
  }

  notifyParent(event, data) {
    if (this.parentPanel && typeof this.parentPanel.onChildPanelEvent === 'function') {
      this.parentPanel.onChildPanelEvent(this, event, data);
    }
  }

  async refresh() {
    logMessage('Refreshing file tree...', 'debug', 'FILE_TREE_PANEL');
    await this.loadFileTree();
    this.render();
  }

  destroy() {
    logMessage('FileTreePanel destroyed.', 'debug', 'FILE_TREE_PANEL');
    super.destroy();
  }
}