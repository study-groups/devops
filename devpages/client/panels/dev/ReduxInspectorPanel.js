/**
 * ReduxInspectorPanel.js - Redux state inspector with spreadsheet-like interface
 * 
 * Features:
 * - Collapsible slices displayed as expandable rows
 * - Spreadsheet-like table layout
 * - Real-time state monitoring
 * - Annotations for state values
 * - Search and filter capabilities
 */

import { BasePanel } from '../BasePanel.js';
import { appStore } from '../../appState.js';

export class ReduxInspectorPanel extends BasePanel {
    constructor(config = {}) {
        super({
            title: 'Redux Inspector',
            type: 'redux-inspector',
            defaultWidth: 600,
            defaultHeight: 500,
            minWidth: 400,
            minHeight: 300,
            ...config
        });

        // Inspector state
        this.expandedSlices = new Set();
        this.annotations = new Map();
        this.searchFilter = '';
        this.updateInterval = null;
        this.lastStateSnapshot = null;
        this.lastFloatingState = false;
        
        // Bind methods
        this.handleStoreUpdate = this.handleStoreUpdate.bind(this);
        this.toggleSlice = this.toggleSlice.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
    }

    onMount(container = null) {
        super.onMount();
        this.sidebarContainer = container;
        this.attachInspectorEventListeners();
        this.startMonitoring();
        this.loadAnnotations();
    }

    onDestroy() {
        super.onDestroy();
        this.stopMonitoring();
    }

    startMonitoring() {
        // Subscribe to store changes
        this.storeUnsubscribe = appStore.subscribe(this.handleStoreUpdate);
        
        // Initial render
        this.handleStoreUpdate();
        
        // Set up periodic updates for real-time monitoring
        this.updateInterval = setInterval(() => {
            this.updateTimestamps();
        }, 1000);
    }

    stopMonitoring() {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    handleStoreUpdate() {
        const currentState = appStore.getState();
        
        // Check if state actually changed
        if (JSON.stringify(currentState) !== JSON.stringify(this.lastStateSnapshot)) {
            this.lastStateSnapshot = JSON.parse(JSON.stringify(currentState));
            this.renderStateTable();
        }
        
        // Check if floating panel state changed and re-render sidebar if needed
        this.checkFloatingStateChange();
    }

    checkFloatingStateChange() {
        const floatingExists = this.checkFloatingPanelExists();
        if (this.lastFloatingState !== floatingExists) {
            this.lastFloatingState = floatingExists;
            // Re-render sidebar content when floating state changes
            if (!this.isFloatingPanel() && this.sidebarContainer) {
                const newContent = this.renderContent();
                this.sidebarContainer.innerHTML = newContent;
                this.attachInspectorEventListeners();
                this.renderStateTable();
            }
        }
    }

    loadAnnotations() {
        try {
            const saved = localStorage.getItem('devpages_redux_annotations');
            if (saved) {
                const annotations = JSON.parse(saved);
                this.annotations = new Map(Object.entries(annotations));
            }
        } catch (error) {
            console.warn('[ReduxInspector] Failed to load annotations:', error);
        }
    }

    saveAnnotations() {
        try {
            const annotationsObj = Object.fromEntries(this.annotations);
            localStorage.setItem('devpages_redux_annotations', JSON.stringify(annotationsObj));
        } catch (error) {
            console.warn('[ReduxInspector] Failed to save annotations:', error);
        }
    }

    renderContent() {
        const isFloating = this.isFloatingPanel();
        
        if (isFloating) {
            // Full floating panel content
            return this.renderFloatingContent();
        } else {
            // Collapsed sidebar content when floating panel exists
            const floatingExists = this.checkFloatingPanelExists();
            if (floatingExists) {
                return this.renderCollapsedContent();
            } else {
                return this.renderSidebarContent();
            }
        }
    }

    renderSidebarContent() {
        return `
            <div class="devpages-panel redux-inspector">
                <div class="devpages-panel-content">
                    <table class="devpages-table state-table">
                        <thead>
                            <tr>
                                <th style="width: 25%; font-family: var(--devpages-panel-font-mono);">Slice</th>
                                <th style="width: 35%; font-family: var(--devpages-panel-font-mono);">Value</th>
                                <th style="width: 15%; font-family: var(--devpages-panel-font-mono);">Type</th>
                                <th style="width: 25%; font-family: var(--devpages-panel-font-mono);">Note</th>
                            </tr>
                        </thead>
                        <tbody class="state-table-body">
                            <!-- State rows will be rendered here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderFloatingContent() {
        return `
            <div class="devpages-panel redux-inspector">
                <div class="devpages-panel-toolbar">
                    <div class="devpages-flex-center devpages-flex-gap">
                        <input type="text" 
                               class="devpages-input-compact search-input" 
                               placeholder="Search state..."
                               value="${this.searchFilter}"
                               style="width: 150px;">
                        <button class="devpages-btn-ghost clear-search" title="Clear">×</button>
                    </div>
                    <div class="devpages-flex-center devpages-flex-gap-sm">
                        <button class="devpages-btn-ghost expand-all" title="Expand all">Expand All</button>
                        <button class="devpages-btn-ghost collapse-all" title="Collapse all">Collapse All</button>
                        <button class="devpages-btn-ghost export-state" title="Export state">Export JSON</button>
                    </div>
                </div>
                
                <div class="devpages-panel-content">
                    <table class="devpages-table state-table">
                        <thead>
                            <tr>
                                <th style="width: 20%;">Slice</th>
                                <th style="width: 25%;">Key</th>
                                <th style="width: 30%;">Value</th>
                                <th style="width: 8%;">Type</th>
                                <th style="width: 12%;">Note</th>
                                <th style="width: 5%;">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="state-table-body">
                            <!-- State rows will be rendered here -->
                        </tbody>
                    </table>
                </div>
                
                <div class="devpages-panel-toolbar" style="border-top: 1px solid var(--devpages-panel-toolbar-border); border-bottom: none;">
                    <div class="devpages-flex-center devpages-flex-gap devpages-text-micro devpages-text-muted">
                        <span class="slice-count">0 slices</span>
                        <span>•</span>
                        <span class="key-count">0 keys</span>
                    </div>
                    <div class="devpages-text-micro devpages-text-subtle last-update">
                        Never
                    </div>
                </div>
            </div>
        `;
    }

    renderCollapsedContent() {
        return `
            <div class="devpages-panel redux-inspector collapsed-state">
                <div style="padding: var(--devpages-panel-padding); text-align: center; font-family: var(--devpages-panel-font-mono); font-size: var(--devpages-panel-font-size-micro); color: var(--devpages-panel-text-muted);">
                    Redux Inspector (Floating)
                </div>
            </div>
        `;
    }

    isFloatingPanel() {
        // Check if this is a floating panel instance or if we're rendering in a floating panel
        const floatingPanel = document.querySelector(`#floating-panel-${this.id}`);
        return (this.element && this.element.classList.contains('floating-panel')) || 
               (floatingPanel && floatingPanel.contains(this.sidebarContainer));
    }

    checkFloatingPanelExists() {
        // Check if there's a floating Redux Inspector panel
        return document.querySelector(`#floating-panel-${this.id}`) !== null;
    }

    attachInspectorEventListeners() {
        // Find the container - either from sidebar or floating panel
        let container;
        if (this.element) {
            // Floating panel context
            container = this.element.querySelector('.redux-inspector');
        } else if (this.sidebarContainer) {
            // Sidebar context
            container = this.sidebarContainer.querySelector('.redux-inspector');
        } else {
            // Fallback - search in document
            container = document.querySelector(`#panel-instance-${this.id} .redux-inspector`);
        }
        
        if (!container) {
            console.warn('[ReduxInspector] Could not find container for event listeners');
            return;
        }

        // Only add export functionality for floating panels
        if (this.isFloatingPanel()) {
            // Search functionality
            const searchInput = container.querySelector('.search-input');
            const clearSearch = container.querySelector('.clear-search');
            
            searchInput?.addEventListener('input', this.handleSearch);
            clearSearch?.addEventListener('click', () => {
                searchInput.value = '';
                this.searchFilter = '';
                this.renderStateTable();
            });

            // Toolbar actions
            container.querySelector('.expand-all')?.addEventListener('click', () => {
                const state = appStore.getState();
                this.expandedSlices = new Set(Object.keys(state));
                this.renderStateTable();
            });

            container.querySelector('.collapse-all')?.addEventListener('click', () => {
                this.expandedSlices.clear();
                this.renderStateTable();
            });

            container.querySelector('.export-state')?.addEventListener('click', () => {
                this.exportState();
            });
        }

        // Table interactions will be attached after rendering
    }

    handleSearch(e) {
        this.searchFilter = e.target.value.toLowerCase();
        this.renderStateTable();
    }

    renderStateTable() {
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            this.doRenderStateTable();
        }, 10);
    }

    doRenderStateTable() {
        // Find the table body - check multiple locations
        let tbody;
        
        // Check floating panel first
        const floatingPanel = document.querySelector(`#floating-panel-${this.id}`);
        if (floatingPanel) {
            tbody = floatingPanel.querySelector('.state-table-body');
        }
        
        // Then check regular panel element
        if (!tbody && this.element) {
            tbody = this.element.querySelector('.state-table-body');
        }
        
        // Then check sidebar container
        if (!tbody && this.sidebarContainer) {
            tbody = this.sidebarContainer.querySelector('.state-table-body');
        }
        
        // Finally check by panel instance ID
        if (!tbody) {
            tbody = document.querySelector(`#panel-instance-${this.id} .state-table-body`);
        }
        
        if (!tbody) {
            console.warn('[ReduxInspector] Could not find table body for rendering. Checked:', {
                floatingPanel: !!floatingPanel,
                element: !!this.element,
                sidebarContainer: !!this.sidebarContainer,
                panelInstanceId: `#panel-instance-${this.id}`
            });
            return;
        }

        const state = appStore.getState();
        const rows = [];
        let totalKeys = 0;

        Object.entries(state).forEach(([sliceName, sliceData]) => {
            const isExpanded = this.expandedSlices.has(sliceName);
            const sliceKeys = this.getFilteredKeys(sliceData, this.searchFilter);
            totalKeys += sliceKeys.length;

            // Slice header row
            rows.push(this.renderSliceRow(sliceName, sliceData, isExpanded, sliceKeys.length));

            // Slice content rows (if expanded)
            if (isExpanded) {
                sliceKeys.forEach(({ key, value, path }) => {
                    rows.push(this.renderValueRow(sliceName, key, value, path));
                });
            }
        });

        tbody.innerHTML = rows.join('');
        this.updateSummary(Object.keys(state).length, totalKeys);
        this.attachTableEventListeners();
    }

    renderSliceRow(sliceName, sliceData, isExpanded, keyCount) {
        const sliceSize = this.calculateSliceSize(sliceData);
        const hasAnnotation = this.annotations.has(sliceName);
        const annotation = hasAnnotation ? this.annotations.get(sliceName) : '';
        const isFloating = this.isFloatingPanel();

        if (isFloating) {
            // Full floating panel row
            return `
                <tr class="devpages-panel-row slice-row ${isExpanded ? 'expanded' : ''}" data-slice="${sliceName}">
                    <td>
                        <div class="devpages-flex-center devpages-flex-gap-sm">
                            <button class="devpages-btn-ghost slice-toggle" data-slice="${sliceName}" style="width: 14px; height: 14px; padding: 0;">
                                ${isExpanded ? '−' : '+'}
                            </button>
                            <span class="devpages-text-mono" style="font-weight: 600; color: var(--devpages-type-object); font-size: 10px;">${sliceName}</span>
                            <span class="devpages-type-badge type-object" style="font-size: 7px; height: 12px; min-width: 16px;">${keyCount}</span>
                        </div>
                    </td>
                    <td>
                        <span class="devpages-text-muted devpages-text-micro">${sliceSize} props</span>
                    </td>
                    <td>
                        <div class="devpages-text-mono devpages-text-micro devpages-text-muted" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                            ${this.formatValuePreview(sliceData)}
                        </div>
                    </td>
                    <td>
                        <span class="devpages-type-badge type-object">obj</span>
                    </td>
                    <td>
                        <input type="text" 
                               class="devpages-input-compact annotation-input ${hasAnnotation ? 'has-annotation' : ''}" 
                               placeholder="..."
                               value="${annotation}"
                               data-path="${sliceName}"
                               style="width: 100%; font-size: 9px;">
                    </td>
                    <td>
                        <div class="devpages-flex-center devpages-flex-gap-sm">
                            <button class="devpages-btn-ghost action-btn" data-action="copy" data-path="${sliceName}" title="Copy" style="width: 14px; height: 14px; padding: 0;">⧉</button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Compact sidebar row (with expand button)
            return `
                <tr class="devpages-panel-row slice-row ${isExpanded ? 'expanded' : ''}" data-slice="${sliceName}">
                    <td>
                        <div class="devpages-flex-center devpages-flex-gap-sm">
                            <button class="devpages-btn-ghost slice-toggle" data-slice="${sliceName}" style="width: 12px; height: 12px; padding: 0; font-size: 8px; font-family: var(--devpages-panel-font-mono);">
                                ${isExpanded ? '−' : '+'}
                            </button>
                            <span class="devpages-text-mono" style="font-weight: 600; color: var(--devpages-type-object); font-size: var(--devpages-panel-font-size-compact); font-family: var(--devpages-panel-font-mono);">${sliceName}</span>
                            <span class="devpages-type-badge type-object" style="font-size: 8px; height: 12px; min-width: 14px; padding: 0 3px; font-family: var(--devpages-panel-font-mono);">${keyCount}</span>
                        </div>
                    </td>
                    <td>
                        <div class="devpages-text-mono devpages-text-micro devpages-text-muted" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; font-size: var(--devpages-panel-font-size-micro); font-family: var(--devpages-panel-font-mono);">
                            ${this.formatValuePreview(sliceData)}
                        </div>
                    </td>
                    <td>
                        <span class="devpages-type-badge type-object" style="font-size: 8px; height: 12px; font-family: var(--devpages-panel-font-mono);">obj</span>
                    </td>
                    <td>
                        <input type="text" 
                               class="devpages-input-compact annotation-input ${hasAnnotation ? 'has-annotation' : ''}" 
                               placeholder="..."
                               value="${annotation}"
                               data-path="${sliceName}"
                               style="width: 100%; font-size: var(--devpages-panel-font-size-micro); height: 16px; font-family: var(--devpages-panel-font-mono);">
                    </td>
                </tr>
            `;
        }
    }

    renderValueRow(sliceName, key, value, path) {
        const valueType = this.getValueType(value);
        const formattedValue = this.formatValue(value, valueType);
        const hasAnnotation = this.annotations.has(path);
        const annotation = hasAnnotation ? this.annotations.get(path) : '';
        const isFloating = this.isFloatingPanel();

        if (isFloating) {
            // Full floating panel row
            return `
                <tr class="devpages-panel-row value-row" data-slice="${sliceName}" data-path="${path}">
                    <td>
                        <div class="devpages-flex-center" style="padding-left: 16px;">
                            <span class="devpages-text-mono devpages-text-muted" style="font-size: 9px;">${key}</span>
                        </div>
                    </td>
                    <td>
                        <span class="devpages-text-subtle devpages-text-micro">—</span>
                    </td>
                    <td>
                        <div class="devpages-text-mono devpages-text-micro" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; color: var(--devpages-type-${valueType}); font-size: 9px;">
                            ${formattedValue}
                        </div>
                    </td>
                    <td>
                        <span class="devpages-type-badge type-${valueType}" style="font-size: 6px; height: 10px;">${this.getTypeAbbrev(valueType)}</span>
                    </td>
                    <td>
                        <input type="text" 
                               class="devpages-input-compact annotation-input ${hasAnnotation ? 'has-annotation' : ''}" 
                               placeholder="..."
                               value="${annotation}"
                               data-path="${path}"
                               style="width: 100%; font-size: 8px;">
                    </td>
                    <td>
                        <div class="devpages-flex-center devpages-flex-gap-sm">
                            <button class="devpages-btn-ghost action-btn" data-action="copy" data-path="${path}" title="Copy" style="width: 12px; height: 12px; padding: 0; font-size: 8px;">⧉</button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Compact sidebar row
            return `
                <tr class="devpages-panel-row value-row" data-slice="${sliceName}" data-path="${path}">
                    <td>
                        <div class="devpages-flex-center" style="padding-left: 16px;">
                            <span class="devpages-text-mono devpages-text-muted" style="font-size: var(--devpages-panel-font-size-micro); font-family: var(--devpages-panel-font-mono);">${key}</span>
                        </div>
                    </td>
                    <td>
                        <div class="devpages-text-mono devpages-text-micro" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; color: var(--devpages-type-${valueType}); font-size: var(--devpages-panel-font-size-micro); font-family: var(--devpages-panel-font-mono);">
                            ${formattedValue}
                        </div>
                    </td>
                    <td>
                        <span class="devpages-type-badge type-${valueType}" style="font-size: 7px; height: 10px; padding: 0 2px; font-family: var(--devpages-panel-font-mono);">${this.getTypeAbbrev(valueType)}</span>
                    </td>
                    <td>
                        <input type="text" 
                               class="devpages-input-compact annotation-input ${hasAnnotation ? 'has-annotation' : ''}" 
                               placeholder="..."
                               value="${annotation}"
                               data-path="${path}"
                               style="width: 100%; font-size: var(--devpages-panel-font-size-micro); height: 14px; font-family: var(--devpages-panel-font-mono);">
                    </td>
                </tr>
            `;
        }
    }

    attachTableEventListeners() {
        // Find the table body - either from sidebar or floating panel
        let tbody;
        if (this.element) {
            tbody = this.element.querySelector('.state-table-body');
        } else if (this.sidebarContainer) {
            tbody = this.sidebarContainer.querySelector('.state-table-body');
        } else {
            tbody = document.querySelector(`#panel-instance-${this.id} .state-table-body`);
        }
        
        if (!tbody) return;

        // Slice toggle buttons
        tbody.querySelectorAll('.slice-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                const sliceName = e.target.dataset.slice;
                this.toggleSlice(sliceName);
            });
        });

        // Annotation inputs
        tbody.querySelectorAll('.annotation-input').forEach(input => {
            input.addEventListener('blur', (e) => {
                const path = e.target.dataset.path;
                const value = e.target.value.trim();
                
                if (value) {
                    this.annotations.set(path, value);
                    e.target.classList.add('has-annotation');
                } else {
                    this.annotations.delete(path);
                    e.target.classList.remove('has-annotation');
                }
                
                this.saveAnnotations();
            });
        });

        // Action buttons
        tbody.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const path = e.target.dataset.path;
                this.handleAction(action, path);
            });
        });
    }

    toggleSlice(sliceName) {
        if (this.expandedSlices.has(sliceName)) {
            this.expandedSlices.delete(sliceName);
        } else {
            this.expandedSlices.add(sliceName);
        }
        this.renderStateTable();
    }

    handleAction(action, path) {
        const state = appStore.getState();
        const value = this.getValueByPath(state, path);

        switch (action) {
            case 'copy':
                this.copyToClipboard(JSON.stringify(value, null, 2));
                this.showNotification('Copied to clipboard');
                break;
            case 'watch':
                this.addWatcher(path);
                break;
            case 'edit':
                this.openValueEditor(path, value);
                break;
        }
    }

    getFilteredKeys(obj, filter) {
        const keys = [];
        
        const traverse = (current, currentPath = '') => {
            if (typeof current !== 'object' || current === null) return;
            
            Object.entries(current).forEach(([key, value]) => {
                const fullPath = currentPath ? `${currentPath}.${key}` : key;
                
                if (!filter || key.toLowerCase().includes(filter) || 
                    fullPath.toLowerCase().includes(filter)) {
                    keys.push({ key, value, path: fullPath });
                }
                
                // Don't traverse too deep to avoid performance issues
                if (currentPath.split('.').length < 3 && typeof value === 'object' && value !== null) {
                    traverse(value, fullPath);
                }
            });
        };
        
        traverse(obj);
        return keys.slice(0, 50); // Limit to 50 keys per slice
    }

    calculateSliceSize(obj) {
        if (typeof obj !== 'object' || obj === null) return 0;
        return Object.keys(obj).length;
    }

    formatValuePreview(value) {
        if (value === null) return '<span class="null">null</span>';
        if (value === undefined) return '<span class="undefined">undefined</span>';
        
        const type = typeof value;
        switch (type) {
            case 'object':
                if (Array.isArray(value)) {
                    return `<span class="array-preview">[${value.length} items]</span>`;
                }
                return `<span class="object-preview">{${Object.keys(value).length} keys}</span>`;
            case 'string':
                return value.length > 30 ? `"${value.substring(0, 30)}..."` : `"${value}"`;
            case 'number':
            case 'boolean':
                return String(value);
            default:
                return `<span class="unknown">${type}</span>`;
        }
    }

    formatValue(value, type) {
        switch (type) {
            case 'string':
                return `"${value}"`;
            case 'number':
            case 'boolean':
                return String(value);
            case 'null':
                return 'null';
            case 'undefined':
                return 'undefined';
            case 'array':
                return `[${value.length} items]`;
            case 'object':
                return `{${Object.keys(value).length} keys}`;
            default:
                return String(value);
        }
    }

    getValueType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (Array.isArray(value)) return 'array';
        return typeof value;
    }

    getTypeAbbrev(type) {
        const abbrevs = {
            string: 'str',
            number: 'num',
            boolean: 'bool',
            object: 'obj',
            array: 'arr',
            null: 'null',
            undefined: 'undef'
        };
        return abbrevs[type] || type;
    }

    getValueByPath(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    updateSummary(sliceCount, keyCount) {
        // Find the footer - either from sidebar or floating panel
        let footer;
        if (this.element) {
            footer = this.element.querySelector('.inspector-footer');
        } else if (this.sidebarContainer) {
            footer = this.sidebarContainer.querySelector('.inspector-footer');
        } else {
            footer = document.querySelector(`#panel-instance-${this.id} .inspector-footer`);
        }
        
        if (!footer) return;

        footer.querySelector('.slice-count').textContent = `${sliceCount} slices`;
        footer.querySelector('.key-count').textContent = `${keyCount} keys`;
        footer.querySelector('.last-update').textContent = new Date().toLocaleTimeString();
    }

    updateTimestamps() {
        // Update relative timestamps if needed
        let lastUpdate;
        if (this.element) {
            lastUpdate = this.element.querySelector('.last-update');
        } else if (this.sidebarContainer) {
            lastUpdate = this.sidebarContainer.querySelector('.last-update');
        } else {
            lastUpdate = document.querySelector(`#panel-instance-${this.id} .last-update`);
        }
        
        if (lastUpdate) {
            lastUpdate.textContent = new Date().toLocaleTimeString();
        }
    }

    exportState() {
        const state = appStore.getState();
        const dataStr = JSON.stringify(state, null, 2);
        
        // Create and trigger download
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `redux-state-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('State exported');
    }

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    }

    showNotification(message) {
        // Simple notification - could be enhanced
        const notification = document.createElement('div');
        notification.className = 'redux-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--color-success, #10b981);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Load DevPages panel design system
    addBaseStyles() {
        super.addBaseStyles();
        
        // Load the DevPages panel design system CSS
        const linkId = 'devpages-panel-styles';
        if (document.getElementById(linkId)) return;

        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = '/client/styles/design-system-panels.css';
        document.head.appendChild(link);
        
        // Add minimal inspector-specific styles
        const styleId = 'redux-inspector-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .redux-inspector {
                height: 100%;
                font-family: var(--devpages-panel-font-mono);
            }

            .redux-inspector *,
            .redux-inspector th,
            .redux-inspector td,
            .redux-inspector input,
            .redux-inspector button,
            .redux-inspector span,
            .redux-inspector div {
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace !important;
            }

            .redux-inspector.collapsed-state {
                height: auto;
                min-height: var(--devpages-panel-toolbar-height);
            }

            .annotation-input.has-annotation {
                background: var(--devpages-type-string-bg);
                border-color: var(--devpages-type-string);
            }

            .redux-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--devpages-type-string);
                color: white;
                padding: var(--devpages-panel-padding-sm) var(--devpages-panel-padding);
                border-radius: var(--devpages-panel-btn-border-radius);
                font-size: var(--devpages-panel-font-size-micro);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }

            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
    }
}
