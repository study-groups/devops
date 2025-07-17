/**
 * StateDebugPanel.js - State introspection panel for the debug panel
 * 
 * This panel provides comprehensive introspection of all reducer state slices
 * with real-time updates, search capabilities, and detailed state exploration.
 */

import { appStore } from "/client/appState.js";
import { logMessage } from "/client/log/index.js";

// Ensure icons.css is loaded
const iconsLink = document.createElement('link');
iconsLink.rel = 'stylesheet';
iconsLink.href = '/client/styles/icons.css';
if (!document.head.querySelector('link[href="/client/styles/icons.css"]')) {
    document.head.appendChild(iconsLink);
}

export class StateDebugPanel {
    constructor(container) {
        console.log('[StateDebugPanel] Constructor called.');
        this.container = container;
        if (!this.container) {
            console.error('[StateDebugPanel] Constructor: container is null!');
            return;
        }
        
        this.isInitialized = false;
        this.updateInterval = null;
        this.searchTerm = '';
        this.expandedPaths = new Set();
        this.expandedValues = new Set();
        this.lastState = null;
        this.changedPaths = new Set();
        
        this.createUI();
        this.setupEventHandlers();
        this.initialize();
    }

    createUI() {
        this.container.innerHTML = `
            <div class="state-debug-panel">
                <div class="panel-header">
                    <h3>State Inspector</h3>
                    <div class="panel-controls">
                        <button id="refresh-state" class="btn btn-sm" title="Refresh State">
                            <span class="icon icon-settings"></span>
                        </button>
                        <button id="export-state" class="btn btn-sm" title="Export State to Console">
                            <span class="icon icon-copy"></span>
                        </button>
                        <button id="toggle-auto-refresh" class="btn btn-sm active" title="Toggle Auto-refresh">
                            <span class="icon icon-reset"></span>
                        </button>
                    </div>
                </div>
                
                <div class="panel-content">
                    <div class="search-section">
                        <input type="text" id="state-search" placeholder="Search state properties..." />
                        <div class="search-stats" id="search-stats"></div>
                    </div>
                    
                    <div class="state-overview">
                        <div class="overview-stats" id="overview-stats">
                            <div class="stat-item">
                                <label>Total Slices:</label>
                                <span id="total-slices">0</span>
                            </div>
                            <div class="stat-item">
                                <label>Auto-refresh:</label>
                                <span id="auto-refresh-status">On</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="state-content" id="state-content">
                        <div class="loading">Loading state...</div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .state-debug-panel {
                padding: 16px;
                font-family: var(--font-family-sans, system-ui);
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--color-border, #eee);
            }
            
            .panel-header h3 {
                margin: 0;
                font-size: 16px;
                color: var(--color-fg, #333);
            }
            
            .panel-controls {
                display: flex;
                gap: 4px;
            }
            
            .search-section {
                margin-bottom: 16px;
            }
            
            .search-section input {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
                font-size: 12px;
                background: var(--color-bg, white);
                color: var(--color-fg, #333);
            }
            
            .search-section input:focus {
                outline: none;
                border-color: var(--color-primary, #007bff);
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
            }
            
            .search-stats {
                margin-top: 4px;
                font-size: 11px;
                color: var(--color-fg-muted, #666);
            }
            
            .state-overview {
                margin-bottom: 16px;
                padding: 12px;
                background: var(--color-bg-alt, #f8f9fa);
                border-radius: 4px;
            }
            
            .overview-stats {
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
            }
            
            .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
            }
            
            .stat-item label {
                font-weight: 500;
                color: var(--color-fg-muted, #666);
            }
            
            .stat-item span {
                color: var(--color-fg, #333);
                font-weight: 600;
            }
            
                         .state-content {
                 flex: 1;
                 overflow-y: auto;
                 font-family: var(--font-family-mono, monospace);
                 font-size: 12px;
                 line-height: 1.4;
             }
             
             .state-table {
                 width: 100%;
                 border-collapse: collapse;
                 margin-top: 8px;
             }
             
             .state-table th {
                 background: var(--color-bg-alt, #f8f9fa);
                 border: 1px solid var(--color-border, #ddd);
                 padding: 8px 12px;
                 text-align: left;
                 font-weight: 600;
                 font-size: 11px;
                 color: var(--color-fg, #333);
                 position: sticky;
                 top: 0;
                 z-index: 10;
             }
             
             .state-table td {
                 border: 1px solid var(--color-border, #ddd);
                 padding: 6px 12px;
                 vertical-align: top;
                 font-size: 11px;
                 line-height: 1.3;
                 text-align: left;
             }
             
             .state-table tbody tr:hover {
                 background: var(--color-bg-hover, #f8f9fa);
             }
             
             .state-table tbody tr.changed {
                 background: var(--color-bg-warning, #fff3cd);
             }
             
             .state-table tbody tr.highlight {
                 background: var(--color-bg-info, #b3d9e6);
             }
             
             .var-column {
                 font-weight: 600;
                 color: var(--color-primary, #007bff);
                 min-width: 100px;
                 max-width: 150px;
                 word-break: break-word;
             }
             
             .props-column {
                 color: var(--color-success, #28a745);
                 min-width: 120px;
                 max-width: 200px;
                 word-break: break-word;
                 text-align: left;
             }
             
             .value-column {
                 color: var(--color-fg, #333);
                 min-width: 150px;
                 max-width: 300px;
                 word-break: break-word;
                 white-space: pre-wrap;
                 text-align: left;
             }
             
             .type-column {
                 color: var(--color-fg-muted, #666);
                 font-style: italic;
                 min-width: 80px;
                 max-width: 100px;
             }
             
             .value-string {
                 color: var(--color-warning, #ffc107);
             }
             
             .value-number {
                 color: var(--color-info, #17a2b8);
             }
             
             .value-boolean {
                 color: var(--color-success, #28a745);
             }
             
             .value-null {
                 color: var(--color-danger, #dc3545);
                 font-style: italic;
             }
             
             .value-object {
                 color: var(--color-primary, #007bff);
                 font-weight: 500;
                 text-align: left;
                 display: inline-block;
             }
             
             .expandable-value {
                 cursor: pointer;
                 padding: 2px 4px;
                 border-radius: 2px;
                 display: inline-block;
                 text-align: left;
             }
             
             .expandable-value:hover {
                 background: var(--color-bg-hover, #e9ecef);
             }
             
             .truncated-value {
                 max-width: 200px;
                 overflow: hidden;
                 display: inline-block;
             }
             
             .truncated-content {
                 white-space: nowrap;
                 overflow: hidden;
                 text-overflow: ellipsis;
             }
             
             .expand-link {
                 color: var(--color-primary, #007bff);
                 cursor: pointer;
                 text-decoration: underline;
                 margin-left: 4px;
                 font-size: 10px;
             }
             
             .expand-link:hover {
                 color: var(--color-primary-hover, #0056b3);
             }
             
             .expanded-value {
                 white-space: pre-wrap;
                 word-break: break-word;
                 max-width: 400px;
             }
             
             .collapse-link {
                 color: var(--color-primary, #007bff);
                 cursor: pointer;
                 text-decoration: underline;
                 margin-left: 4px;
                 font-size: 10px;
             }
             
             .collapse-link:hover {
                 color: var(--color-primary-hover, #0056b3);
             }
            
            
            
            .btn {
                padding: 4px 8px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
                background: var(--color-bg, white);
                color: var(--color-fg, #333);
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .btn:hover:not(:disabled) {
                background: var(--color-bg-hover, #f8f9fa);
            }
            
            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .btn.active {
                background: var(--color-primary, #007bff);
                color: white;
                border-color: var(--color-primary, #007bff);
            }
            
            .btn-sm {
                padding: 2px 6px;
                font-size: 10px;
            }
            
            .btn .icon {
                width: 12px;
                height: 12px;
            }
            
            .expandable-value .icon {
                width: 10px;
                height: 10px;
                margin-left: 4px;
                vertical-align: middle;
            }
            
            .loading {
                text-align: center;
                padding: 20px;
                color: var(--color-fg-muted, #666);
            }
            
            .error {
                color: var(--color-error, #dc3545);
                padding: 8px;
                background: var(--color-bg-error, #f8d7da);
                border: 1px solid var(--color-error, #dc3545);
                border-radius: 4px;
                margin-bottom: 8px;
            }
        `;
        
        document.head.appendChild(style);
    }

    setupEventHandlers() {
        console.log('[StateDebugPanel] setupEventHandlers called.');
        
        // Search functionality
        const searchInput = this.container.querySelector('#state-search');
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.renderState();
        });

        // Control buttons
        this.container.querySelector('#refresh-state').addEventListener('click', () => {
            this.renderState();
        });

        this.container.querySelector('#export-state').addEventListener('click', () => {
            this.exportState();
        });

        this.container.querySelector('#toggle-auto-refresh').addEventListener('click', (e) => {
            this.toggleAutoRefresh();
            e.currentTarget.classList.toggle('active');
        });

        // State container for dynamic event delegation
        this.container.querySelector('#state-content').addEventListener('click', (e) => {
            // Handle expandable value clicks
            let expandableValue = e.target.closest('.expandable-value');
            if (expandableValue) {
                this.togglePathExpansion(expandableValue);
                return;
            }
            
            // Handle expand/collapse value clicks
            let expandLink = e.target.closest('.expand-link');
            if (expandLink) {
                this.toggleValueExpansion(expandLink);
                return;
            }
            
            let collapseLink = e.target.closest('.collapse-link');
            if (collapseLink) {
                this.toggleValueExpansion(collapseLink);
                return;
            }
        });
    }

    async initialize() {
        try {
            this.isInitialized = true;
            console.log('[StateDebugPanel] State inspector initialized successfully');
            
            // Initial render
            this.renderState();
            
            // Set up auto-refresh
            this.startAutoRefresh();
            
            // Subscribe to state changes
            if (appStore && typeof appStore.subscribe === 'function') {
                this.unsubscribe = appStore.subscribe(() => {
                    this.detectChanges();
                });
            }
            
        } catch (error) {
            console.error('[StateDebugPanel] Error initializing state inspector:', error);
            this.container.querySelector('#state-content').innerHTML = 
                `<div class="error">Error initializing: ${error.message}</div>`;
        }
    }

    detectChanges() {
        if (!this.isInitialized) return;
        
        const currentState = appStore.getState();
        if (this.lastState) {
            this.changedPaths.clear();
            this.findChanges('', this.lastState, currentState);
        }
        this.lastState = JSON.parse(JSON.stringify(currentState));
    }

    findChanges(path, oldObj, newObj) {
        if (oldObj === newObj) return;
        
        if (typeof oldObj !== 'object' || typeof newObj !== 'object' || 
            oldObj === null || newObj === null) {
            this.changedPaths.add(path);
            return;
        }
        
        const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            if (!(key in oldObj) || !(key in newObj)) {
                this.changedPaths.add(currentPath);
            } else {
                this.findChanges(currentPath, oldObj[key], newObj[key]);
            }
        }
    }

    renderState() {
        if (!appStore) {
            this.container.querySelector('#state-content').innerHTML = 
                '<div class="error">AppStore not available</div>';
            return;
        }

        const state = appStore.getState();
        const sliceNames = Object.keys(state);
        
        // Update stats
        this.container.querySelector('#total-slices').textContent = sliceNames.length;
        
        // Flatten state into table rows
        const tableRows = [];
        sliceNames.forEach(sliceName => {
            const sliceData = state[sliceName];
            this.flattenObjectToRows(sliceData, sliceName, '', tableRows);
        });
        
        // Filter rows based on search
        const filteredRows = tableRows.filter(row => {
            if (!this.searchTerm) return true;
            return row.variable.toLowerCase().includes(this.searchTerm) ||
                   row.property.toLowerCase().includes(this.searchTerm) ||
                   String(row.value).toLowerCase().includes(this.searchTerm) ||
                   row.type.toLowerCase().includes(this.searchTerm);
        });
        
        // Update search stats
        const searchStats = this.container.querySelector('#search-stats');
        if (this.searchTerm) {
            searchStats.textContent = `Found ${filteredRows.length} of ${tableRows.length} properties`;
        } else {
            searchStats.textContent = '';
        }
        
        // Render table
        const content = this.container.querySelector('#state-content');
        content.innerHTML = `
            <table class="state-table">
                <thead>
                    <tr>
                        <th class="var-column">Variable</th>
                        <th class="props-column">Property</th>
                        <th class="value-column">Value</th>
                        <th class="type-column">Type</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredRows.map(row => this.renderTableRow(row)).join('')}
                </tbody>
            </table>
        `;
    }

    flattenObjectToRows(obj, variable, parentPath, rows, depth = 0) {
        if (depth > 10) return; // Prevent infinite recursion
        
        if (obj === null || obj === undefined) {
            rows.push({
                variable: variable,
                property: parentPath || '(root)',
                value: obj,
                type: obj === null ? 'null' : 'undefined',
                path: parentPath || variable,
                depth: depth
            });
            return;
        }
        
        if (typeof obj !== 'object') {
            rows.push({
                variable: variable,
                property: parentPath || '(root)',
                value: obj,
                type: typeof obj,
                path: parentPath || variable,
                depth: depth
            });
            return;
        }
        
        if (Array.isArray(obj)) {
            // Add array summary row
            rows.push({
                variable: variable,
                property: parentPath || '(root)',
                value: `[${obj.length} items]`,
                type: 'array',
                path: parentPath || variable,
                depth: depth,
                isExpandable: obj.length > 0
            });
            
            // Add array items if expanded
            const currentPath = parentPath || variable;
            if (this.expandedPaths.has(currentPath)) {
                obj.forEach((item, index) => {
                    const itemPath = `${currentPath}[${index}]`;
                    this.flattenObjectToRows(item, variable, `[${index}]`, rows, depth + 1);
                });
            }
            return;
        }
        
        // Regular object
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            rows.push({
                variable: variable,
                property: parentPath || '(root)',
                value: '{}',
                type: 'object',
                path: parentPath || variable,
                depth: depth
            });
            return;
        }
        
        // Add object summary row
        if (parentPath) {
            rows.push({
                variable: variable,
                property: parentPath,
                value: `{${keys.length} properties}`,
                type: 'object',
                path: parentPath || variable,
                depth: depth,
                isExpandable: true
            });
        }
        
        // Add object properties if expanded or if this is the root
        const currentPath = parentPath || variable;
        if (!parentPath || this.expandedPaths.has(currentPath)) {
            keys.forEach(key => {
                const value = obj[key];
                const propertyPath = parentPath ? `${parentPath}.${key}` : key;
                const fullPath = parentPath ? `${currentPath}.${key}` : `${variable}.${key}`;
                
                this.flattenObjectToRows(value, variable, propertyPath, rows, depth + 1);
            });
        }
    }
    
    renderTableRow(row) {
        const hasChanges = this.changedPaths.has(row.path);
        const isHighlighted = this.searchTerm && (
            row.variable.toLowerCase().includes(this.searchTerm) ||
            row.property.toLowerCase().includes(this.searchTerm) ||
            String(row.value).toLowerCase().includes(this.searchTerm) ||
            row.type.toLowerCase().includes(this.searchTerm)
        );
        
        let cssClass = '';
        if (hasChanges) cssClass += ' changed';
        if (isHighlighted) cssClass += ' highlight';
        
        const indent = '  '.repeat(row.depth);
        
        return `
            <tr class="${cssClass}">
                <td class="var-column">${row.variable}</td>
                <td class="props-column">${indent}${row.property}</td>
                <td class="value-column">${this.formatValueForTable(row.value, row.type, row.isExpandable, row.path)}</td>
                <td class="type-column">${row.type}</td>
            </tr>
        `;
    }
    
    formatValueForTable(value, type, isExpandable, path) {
        if (value === null) {
            return '<span class="value-null">null</span>';
        }
        
        if (value === undefined) {
            return '<span class="value-null">undefined</span>';
        }
        
        // Handle expandable objects/arrays
        if (type === 'array' || type === 'object') {
            if (isExpandable) {
                const isExpanded = this.expandedPaths.has(path);
                const iconClass = isExpanded ? 'icon-chevron-down' : 'icon-chevron-right';
                return `<div style="text-align: left;"><span class="value-object expandable-value" data-path="${path}">${value} <span class="icon ${iconClass}"></span></span></div>`;
            }
            return `<div style="text-align: left;"><span class="value-object">${value}</span></div>`;
        }
        
        // Handle primitive values with truncation
        const stringValue = String(value);
        const displayValue = type === 'string' ? `"${stringValue}"` : stringValue;
        const valueId = `${path}_value`;
        const isExpanded = this.expandedValues.has(valueId);
        
        // Check if value needs truncation (more than 25 chars or contains newlines)
        const needsTruncation = stringValue.length > 25 || stringValue.includes('\n');
        
        if (needsTruncation && !isExpanded) {
            // Show truncated version
            const truncated = stringValue.substring(0, 22) + '...';
            const truncatedDisplay = type === 'string' ? `"${truncated}"` : truncated;
            
            return `<div style="text-align: left;"><span class="value-${type}">
                <span class="truncated-content">${this.escapeHtml(truncatedDisplay)}</span>
                <span class="expand-link" data-value-id="${valueId}">expand</span>
            </span></div>`;
        } else if (needsTruncation && isExpanded) {
            // Show full version
            return `<div style="text-align: left;"><span class="value-${type}">
                <span class="expanded-value">${this.escapeHtml(displayValue)}</span>
                <span class="collapse-link" data-value-id="${valueId}">collapse</span>
            </span></div>`;
        } else {
            // Show normal version (short values)
            return `<div style="text-align: left;"><span class="value-${type}">${this.escapeHtml(displayValue)}</span></div>`;
        }
    }



    togglePathExpansion(element) {
        const path = element.dataset.path;
        if (this.expandedPaths.has(path)) {
            this.expandedPaths.delete(path);
        } else {
            this.expandedPaths.add(path);
        }
        this.renderState();
    }
    
    toggleValueExpansion(element) {
        const valueId = element.dataset.valueId;
        if (this.expandedValues.has(valueId)) {
            this.expandedValues.delete(valueId);
        } else {
            this.expandedValues.add(valueId);
        }
        this.renderState();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    exportState() {
        const state = appStore.getState();
        console.group('🔍 Application State Export');
        console.log('Full State:', state);
        
        Object.keys(state).forEach(sliceName => {
            console.log(`${sliceName}:`, state[sliceName]);
        });
        
        console.groupEnd();
        logMessage('Application state exported to console', 'info', 'STATE_DEBUG');
    }

    startAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.renderState();
        }, 1000);
    }

    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    toggleAutoRefresh() {
        const statusSpan = this.container.querySelector('#auto-refresh-status');
        if (this.updateInterval) {
            this.stopAutoRefresh();
            statusSpan.textContent = 'Off';
        } else {
            this.startAutoRefresh();
            statusSpan.textContent = 'On';
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        
        // Clear expanded state
        this.expandedPaths.clear();
        this.expandedValues.clear();
        
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        console.log('[StateDebugPanel] Panel destroyed');
    }
} 